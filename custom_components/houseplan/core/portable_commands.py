"""Portable JSON commands: one space/full transaction, explicit host variants."""
from __future__ import annotations

import copy
import logging
import time
from datetime import UTC, datetime
from functools import partial
from types import SimpleNamespace

from .command_ports import (
    CommandError,
    CommandPolicy,
    CommandSession,
    PairCommitFailure,
)
from .command_state import (
    OPTIMIZE_BACKUP,
    OPTIMIZE_PENDING,
    layout_metadata,
    maintenance_pair,
)
from .constants import DEFAULT_CONFIG
from .content_index import internal_plan_names, internal_reference
from .coordinate_canonicalization import (
    canonicalize_config_geometry,
    canonicalize_layout_geometry,
)
from .import_export import (
    ImportFailure,
    finalize_export_document,
    get_candidate,
    parse_document,
    prepare_apply,
    prepare_export_document,
    prepare_preview,
    revalidate_candidate,
)
from .input_policy import InputLimit

_LOGGER = logging.getLogger(__name__)


def environment(session: CommandSession, *, leases=False):
    value = session.environment
    if value is None or leases and value.leases is None:
        raise CommandError("not_ready")
    return value


def check_variant(session: CommandSession, document: dict):
    kind = document.get("kind")
    if kind not in {"space", "full"} or (environment(session).policy is CommandPolicy.PLAN_ONLY and kind != "space"):
        raise ImportFailure("invalid_format", "This host accepts space transfers only")


async def candidate(session: CommandSession, token: str) -> dict:
    env = environment(session, leases=True)
    record = await env.leases.load(session.authority.scope_id, token)
    bridge = SimpleNamespace(instance_id=env.identity.instance_id,
        integration_version=env.identity.integration_version,
        import_previews={token: record} if record is not None else {})

    def checked():
        value = get_candidate(bridge, token, session.authority.owner_id)
        return copy.deepcopy(value)

    try:
        prepared = await session.cpu.run(checked)
    except ImportFailure as error:
        if error.code in {"preview_expired", "invalid_format"} and record is not None:
            try:
                await env.leases.consume(session.authority.scope_id, token)
            except Exception:  # noqa: BLE001 - retain original safe domain error
                _LOGGER.exception("House Plan: retiring invalid preview failed")
        raise
    if "archive" in prepared:
        raise ImportFailure("invalid_format", "An archive requires the installation backup adapter")
    check_variant(session, prepared.get("document") or {})
    return prepared


async def export_create(session: CommandSession, message: dict) -> dict:
    session.authority.ensure()
    env = environment(session)
    if (message.get("archive") or message.get("migration_source") or message.get("plan_graph_migration_source")
            or env.policy is CommandPolicy.PLAN_ONLY and (
                message.get("kind") != "space" or message.get("plan_only") is not True)):
        raise ImportFailure("invalid_format", "Unsupported export variant")
    async with session.storage.transaction() as transaction:
        pair = await session.load(transaction)
        detached = await session.cpu.run(copy.deepcopy, pair)
    document, filename = await session.cpu.run(partial(prepare_export_document, env.identity,
        detached.config_data, detached.layout_data, kind=message.get("kind"), space_id=message.get("space_id"),
        plan_only=message.get("plan_only", False), card_version=message.get("card_version", ""), build=env.identity.build))
    index = await env.content.inspect(document["payload"]["config"])
    document, filename = await session.cpu.run(partial(finalize_export_document, document, filename, content_index=index))
    return {"document": document, "filename": filename,
            **({"recovery": document["transfer"]["recovery"]} if document["transfer"].get("recovery") else {})}


async def import_preview(session: CommandSession, raw: bytes, duplicate_policy: str) -> dict:
    session.authority.ensure()
    env = environment(session, leases=True)
    if duplicate_policy not in {"skip", "virtual"}:
        raise ImportFailure("invalid_format", "Unknown duplicate policy")
    async with session.storage.transaction() as transaction:
        pair = await session.load(transaction)
        detached = await session.cpu.run(copy.deepcopy, pair)
    document = await session.cpu.run(parse_document, raw)
    check_variant(session, document)
    index = await env.content.inspect(document["payload"]["config"])
    registry = env.evidence.import_registry_snapshot()
    result, prepared = await session.cpu.run(partial(prepare_preview, env.identity, raw,
        owner_id=session.authority.owner_id, duplicate_policy=duplicate_policy,
        current_config_data=detached.config_data, current_layout_data=detached.layout_data,
        registry_snapshot=registry, parsed_document=document, content_index=index))
    # Lease publication is a mutation too. Never run the exit deadline after
    # publishing a token the caller would then be told did not get created.
    session.before_commit()
    await env.leases.publish(session.authority.scope_id, result["token"], prepared)
    return result


async def import_revalidate(session: CommandSession, message: dict) -> dict:
    session.authority.ensure()
    env = environment(session, leases=True)
    policy = message.get("duplicate_policy", "skip")
    if policy not in {"skip", "virtual"}:
        raise ImportFailure("invalid_format", "Unknown duplicate policy")
    async with session.storage.transaction() as transaction:
        pair = await session.load(transaction)
        prepared = await candidate(session, message["token"])
        expected_digest = prepared["digest"]
        index = await env.content.inspect(prepared["document"]["payload"]["config"])
        result = await session.cpu.run(partial(revalidate_candidate, prepared, pair.config_data, pair.layout_data,
            duplicate_policy=policy, registry_snapshot=env.evidence.import_registry_snapshot(), content_index=index))
        result["token"] = message["token"]
        result["expires_at"] = datetime.fromtimestamp(prepared["expires"], UTC).isoformat().replace("+00:00", "Z")
        session.before_commit()
        if not await env.leases.update(session.authority.scope_id, message["token"], expected_digest, prepared):
            raise ImportFailure("conflict", "Import preview changed during revalidation")
    return result


def attachment_urls(config: dict) -> dict:
    references = {}
    for marker in config.get("markers") or []:
        for attachment in marker.get("pdfs") or []:
            url = attachment.get("url") if isinstance(attachment, dict) else None
            if isinstance(url, str) and (reference := internal_reference(url)) is not None:
                references[url] = reference
    return references


async def import_apply(session: CommandSession, message: dict) -> dict:
    session.authority.ensure()
    env = environment(session, leases=True)
    try:
        async with session.storage.transaction() as transaction:
            pair = await session.load(transaction)
            prepared = await candidate(session, message["token"])
            config_rev, layout_rev = int(pair.config_data.get("rev", 0)), int(pair.layout_data.get("rev", 0))
            if (message.get("expected_config_rev") != config_rev or message.get("expected_layout_rev") != layout_rev
                    or prepared.get("config_rev") != config_rev or prepared.get("layout_rev") != layout_rev):
                raise ImportFailure("conflict", "Plan changed after the preview")
            kind = prepared["document"]["kind"]
            if kind == "space" and message.get("duplicate_policy", prepared.get("duplicate_policy")) != prepared.get("duplicate_policy"):
                raise ImportFailure("conflict", "Duplicate policy changed after the preview")
            config, layout, details = await session.cpu.run(partial(prepare_apply, prepared,
                pair.config_data.get("config") or DEFAULT_CONFIG, pair.layout_data.get("layout") or {},
                duplicate_policy=prepared.get("duplicate_policy"),
                confirm_missing_content=message.get("confirm_missing_content", False)))
            previous = pair.config_data.get("config")
            newly_named = internal_plan_names(config) - internal_plan_names(previous)
            missing = newly_named - await env.content.existing_plans(newly_named)
            if missing:
                raise ImportFailure("missing_plan", "Plan file no longer exists: " + ", ".join(sorted(missing)))
            attachments = attachment_urls(config)
            new_urls = set(attachments) - set(attachment_urls(previous or {}))
            existing = await env.content.existing_content({attachments[url] for url in new_urls})
            if any(attachments[url] not in existing for url in new_urls):
                raise ImportFailure("missing_content", "An attachment no longer exists")
            next_config, next_layout = config_rev + 1, layout_rev + 1
            replaced = {OPTIMIZE_BACKUP, OPTIMIZE_PENDING}
            if kind == "full":
                replaced.update({"repair_backup", "geom_pending"})
            metadata = {key: value for key, value in layout_metadata(pair.layout_data).items() if key not in replaced}
            if kind == "full":
                metadata[OPTIMIZE_BACKUP] = {"kind": "import",
                    "config": canonicalize_config_geometry(previous or DEFAULT_CONFIG),
                    "layout": canonicalize_layout_geometry(pair.layout_data.get("layout") or {}),
                    "created": int(time.time()), "after_config_rev": next_config, "after_layout_rev": next_layout}
            target, rollback = await session.cpu.run(partial(maintenance_pair, "import", config, layout, pair,
                next_config, next_layout, metadata))
            session.before_commit()
            await transaction.commit_pair(target, rollback, authorize=session.authority.ensure)
            try:
                await env.leases.consume(session.authority.scope_id, message["token"])
            except Exception:  # noqa: BLE001 - base revisions already prevent reuse; commit wins
                _LOGGER.exception("House Plan: releasing committed preview failed")
    except PairCommitFailure as error:
        raise CommandError("commit_failed", "Import failed; the previous plan is pending recovery"
                           if error.recovery_pending else "Import failed and the previous plan was restored") from error
    except (CommandError, ImportFailure, InputLimit):
        raise
    except Exception as error:
        _LOGGER.exception("House Plan import commit failed")
        raise CommandError("commit_failed", "Import commit failed") from error
    session.effects.emit("houseplan_config_updated", {"rev": next_config})
    session.effects.emit("houseplan_layout_updated", {"rev": next_layout})
    if kind == "full":
        await session.effects.purge_trails(config)
        session.effects.schedule_repairs()
    session.effects.refresh_trails()
    return {"ok": True, "kind": kind, "config_rev": next_config, "layout_rev": next_layout,
        "counts": details.get("counts", {}), "space_id": details.get("space_id"),
        "repaired_target_refs": details.get("repaired_target_refs", 0),
        "preserved_unresolved_refs": details.get("preserved_unresolved_refs", 0),
        "reference_report": details.get("reference_report", {}), "can_undo": kind == "full",
        "config": target["config"], "layout": target["layout"]}


async def backup_cancel(session: CommandSession, message: dict) -> dict:
    if not session.authority.archive_admin:
        raise CommandError("unauthorized", "Administrator permission required")
    session.authority.ensure()
    if ("operation_id" in message) == ("token" in message):
        raise ImportFailure("zip_invalid")
    if "operation_id" in message:
        raise ImportFailure("invalid_format", "This operation requires the archive adapter")
    # Compatibility, explicitly accepted in #1460: HA never deleted a
    # portable JSON preview here. Do not silently change it during extraction.
    return {"ok": True}
