"""House-only commands: one privacy projection, one additive candidate/commit.

Resources expose bytes, private files and leases; they do not merge plans or
decide authority. The existing portable JSON/full-backup paths stay separate.
"""
from __future__ import annotations

import copy
import hashlib
import json
import logging
import secrets
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from functools import partial

from .command_execution import begin_preparation
from .command_ports import CommandError, PairCommitFailure
from .command_state import OPTIMIZE_BACKUP, OPTIMIZE_PENDING, layout_metadata
from .constants import DEFAULT_CONFIG
from .content_index import internal_plan_names
from .house_document import build_merge, export_document
from .import_export import ImportFailure
from .input_policy import InputLimit

_LOGGER = logging.getLogger(__name__)


def resources(session):
    if session.environment is None or session.environment.house is None:
        raise CommandError("unsupported-transfer")
    return session.environment.house


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def _summary(document, config, details, manifest):
    source = document["payload"]["config"]["spaces"]
    counts = {key: sum(len(space.get(key) or []) for space in source)
              for key in ("rooms", "partitions", "wall_segments", "wall_columns", "openings", "decor", "stairs", "led_strips")}
    counts["spaces"] = len(source)
    counts["images"] = len(manifest["blobs"])
    counts.update(walls=counts["wall_segments"] + counts["partitions"], markers=0,
                  layout=len(document["payload"]["layout"]))
    missing = [row for row in manifest["images"] if "reason" in row]
    # These target globals intentionally remain authoritative, not pixel parity.
    settings = config.get("settings") or {}
    appearance = {key: copy.deepcopy(settings.get(key)) for key in (
        "moon", "volumetric_view", "sun_ray_origin", "fill_colors", "night_brightness") if key in settings}
    return {"kind": "house", "plan_only": True, "counts": counts, "spaces": details["spaces"],
            "warnings": [*details["warnings"], *({"code": "image_" + row["reason"], "ref": row["ref"]} for row in missing)],
            "missing_content": missing, "complete": manifest["complete"], "target_appearance": appearance,
            "can_undo": False, "confirmation_required": not manifest["complete"],
            "created_at": document["created_at"], "card_version": document["card_version"],
            "integration_version": document["integration_version"], "model_version": document["model_version"]}


async def _prepare(session, lease, payload, pair):
    port = resources(session)
    config, layout = pair.config_data.get("config") or DEFAULT_CONFIG, pair.layout_data.get("layout") or {}
    # A house append must not opportunistically rewrite an older target graph.
    # Current HA's canonical read/migration fence remains the owner of upgrades.
    if config.get("spaces") and config.get("model_version") != 11:
        raise CommandError("wall_model_client_outdated")
    document, files = await port.prepare(lease, payload, internal_plan_names(config))
    candidate, positions, details = await session.cpu.run(build_merge, document, config, layout)
    repairs = getattr(payload, "workstation_repairs", None)
    if repairs:
        details["warnings"].append({"code": "workstations_detached", "count": repairs["detached"]})
    result = _summary(document, config, details, payload.manifest)
    if repairs:
        result["workstation_repairs"] = copy.deepcopy(repairs)
    record = {"kind": "house", "payload": payload, "candidate": candidate, "layout": positions,
              "files": files, "config_rev": int(pair.config_data.get("rev", 0)),
              "layout_rev": int(pair.layout_data.get("rev", 0)), "summary": result,
              "base_digest": await session.cpu.run(_digest, (pair.config_data, pair.layout_data))}
    return record


def _reply(lease):
    record = lease["record"]
    summary = copy.deepcopy(record["summary"])
    return {**summary, "token": lease["token"],
            **({"preview": summary, "expected_config_rev": record["config_rev"],
                "expected_layout_rev": record["layout_rev"]} if record["kind"] == "house" else {}),
            "expires_at": datetime.fromtimestamp(lease["expires"], UTC).isoformat().replace("+00:00", "Z"),
            "config_rev": record.get("config_rev"), "layout_rev": record.get("layout_rev")}


async def _cleanup(port, lease):
    try:
        await port.complete(lease)
    except Exception:  # noqa: BLE001 - durable state wins; only positively-owned private bytes remain
        _LOGGER.warning("House Plan: house transfer cleanup deferred", exc_info=True)


async def export_create(session, message):
    session.authority.ensure()
    port, env = resources(session), session.environment
    if message.get("kind") != "house" or message.get("plan_only") is not True or any(message.get(k) for k in (
            "archive", "migration_source", "plan_graph_migration_source")):
        raise CommandError("invalid_format")
    async with session.storage.transaction() as transaction:
        pair = await session.load(transaction)
        document, filename = await session.cpu.run(partial(export_document, env.identity,
            pair.config_data, pair.layout_data, message.get("card_version", ""), env.identity.build))
    session.authority.ensure()
    lease = await port.begin(session.authority.scope_id, session.authority.owner_id,
                             message.get("operation_id") or secrets.token_urlsafe(24), "export")
    try:
        async with port.transaction():
            manifest = await port.build(lease, document)
        session.authority.ensure()
        token = secrets.token_urlsafe(32)
        record = {"kind": "house_export", "filename": filename, "summary": {
            "kind": "house", "archive": True, "transfer_kind": "house", "filename": filename,
            "complete": manifest["complete"], "images": len(manifest["blobs"]), "snapshot": [],
            "missing": [{"name": row["name"], "reason": row["reason"], "kind": row["ref"]["kind"],
                         "owner_id": row["ref"]["owner_id"]} for row in manifest["images"] if "reason" in row],
            "missing_content": [row for row in manifest["images"] if "reason" in row],
            "privacy_warning": "images_may_contain_metadata"}}
        session.before_commit()
        await port.publish(lease, token, record)
        session.authority.ensure()
        return {**_reply(lease), "download_url": f"/api/houseplan/transfer/export/{token}"}
    except BaseException:
        await _cleanup(port, lease)
        raise


async def preview(session, blocks, declared_size, operation):
    session.authority.ensure()
    port = resources(session)
    # Resolve/pin any previous durable house intent before private TTL cleanup.
    async with session.storage.transaction() as transaction:
        await session.load(transaction, prepare=False)
    # The transport already routed the canonical first 1 KiB; the common reader
    # rechecks it before trusting ZIP metadata or any projected document.
    session.authority.ensure()
    lease = await port.begin(session.authority.scope_id, session.authority.owner_id, operation, "import")
    try:
        await port.upload(lease, blocks, declared_size, session.input_policy())
        begin_preparation()
        payload = await port.read(lease)
        async with session.storage.transaction() as transaction:
            pair = await session.load(transaction)
            async with port.transaction():
                record = await _prepare(session, lease, payload, pair)
            session.before_commit()
            await port.publish(lease, secrets.token_urlsafe(32), record)
            session.authority.ensure()
        return _reply(lease)
    except BaseException:
        await _cleanup(port, lease)
        raise


async def revalidate(session, message):
    session.authority.ensure()
    port = resources(session)
    async with session.storage.transaction() as transaction:
        pair = await session.load(transaction)
        lease = await port.load(session.authority.scope_id, session.authority.owner_id, message.get("token"))
        old = lease["record"]
        if old.get("kind") != "house":
            raise CommandError("invalid_format")
        async with port.transaction():
            # Always reverify source/reuse identities; preserve candidate IDs if
            # the whole authoritative pair is unchanged, not only its revs.
            checked = await _prepare(session, lease, old["payload"], pair)
            if checked["base_digest"] == old["base_digest"] and checked["files"] == old["files"]:
                checked = old
            session.before_commit()
            await port.update(lease, checked)
        return _reply(lease)


async def apply(session, message):
    session.authority.ensure()
    port = resources(session)
    lease = None
    try:
        async with session.storage.transaction() as transaction:
            pair = await session.load(transaction)
            lease = await port.load(session.authority.scope_id, session.authority.owner_id, message.get("token"))
            record = lease["record"]
            if record.get("kind") != "house":
                raise CommandError("invalid_format")
            cr, lr = int(pair.config_data.get("rev", 0)), int(pair.layout_data.get("rev", 0))
            if (type(message.get("expected_config_rev")) is not int or type(message.get("expected_layout_rev")) is not int
                    or message.get("expected_config_rev") != cr or message.get("expected_layout_rev") != lr
                    or record["config_rev"] != cr or record["layout_rev"] != lr
                    or record["base_digest"] != await session.cpu.run(_digest, (pair.config_data, pair.layout_data))):
                raise CommandError("conflict")
            if not record["summary"]["complete"] and message.get("confirm_missing_content") is not True:
                raise CommandError("missing_content")
            metadata = layout_metadata(pair.layout_data)
            target_metadata = {key: value for key, value in metadata.items() if key not in {OPTIMIZE_BACKUP, OPTIMIZE_PENDING}}
            target = {"kind": "house_import", "config": record["candidate"], "layout": record["layout"],
                      "config_rev": cr + 1, "layout_rev": lr + 1, "final_metadata": target_metadata,
                      "house_files": {"action": "publish", "descriptor": record["files"]}}
            rollback = {"kind": "house_import_rollback", "config": pair.config_data.get("config") or DEFAULT_CONFIG,
                        "layout": pair.layout_data.get("layout") or {}, "config_rev": cr, "layout_rev": lr,
                        "final_metadata": metadata,
                        "house_files": {"action": "rollback", "descriptor": record["files"]}}
            async with port.transaction():
                session.before_commit()
                await port.pin(lease)
                await transaction.commit_pair(target, rollback, authorize=session.authority.ensure)
        await _cleanup(port, lease)
    except PairCommitFailure as error:
        if lease is not None and not error.recovery_pending:
            await _cleanup(port, lease)
        raise CommandError("commit_failed") from error
    except (CommandError, ImportFailure, InputLimit):
        if lease is not None and lease.get("pinned"):
            await _cleanup(port, lease)
        raise
    session.effects.emit("houseplan_config_updated", {"rev": cr + 1})
    session.effects.emit("houseplan_layout_updated", {"rev": lr + 1})
    session.effects.refresh_trails()
    return {"ok": True, "kind": "house", "config_rev": cr + 1, "layout_rev": lr + 1,
            "counts": record["summary"]["counts"], "spaces": record["summary"]["spaces"], "can_undo": False}


async def cancel(session, message):
    session.authority.ensure()
    port = resources(session)
    # Signal a preparatory worker before waiting for the state lock it may own.
    # A durable/pinned operation refuses removal; then the recovery fence wins.
    try:
        await port.cancel(session.authority.scope_id, session.authority.owner_id,
                          message.get("token"), message.get("operation_id"))
    except CommandError as error:
        if error.code != "zip_busy":
            raise
    async with session.storage.transaction() as transaction:
        await session.load(transaction)
        session.before_commit()
        await port.cancel(session.authority.scope_id, session.authority.owner_id,
                          message.get("token"), message.get("operation_id"))
    return {"ok": True}


@asynccontextmanager
async def download(session, token, confirm_missing=False):
    session.authority.ensure()
    port = resources(session)
    lease = await port.load(session.authority.scope_id, session.authority.owner_id, token)
    record = lease["record"]
    if record.get("kind") != "house_export":
        raise CommandError("invalid_format")
    if not record["summary"]["complete"] and confirm_missing is not True:
        raise CommandError("content_confirmation_required")
    session.authority.ensure()
    async with port.stream(lease) as blocks:
        yield record["filename"], blocks
