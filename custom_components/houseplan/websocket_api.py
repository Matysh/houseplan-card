"""House Plan WS commands: layout, space configuration, plan uploads."""
from __future__ import annotations

import base64
import binascii
import json
import logging
import re
import secrets
import time
from collections import Counter
from pathlib import Path
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.const import __version__ as HA_VERSION
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import issue_registry as ir

from .auth import may_write
from .build_identity import UNKNOWN_BUILD, BuildIdentity
from .const import (
    CONTENT_URL,
    DEFAULT_CONFIG,
    DOMAIN,
    EXPORT_VERSION,
    FILES_DIR,
    MAX_FILES_BYTES,
    MAX_FILES_COUNT,
    MAX_SIGN_PATHS,
    MAX_SUPPORT_CONTACT_CODEPOINTS,
    MAX_SUPPORT_MESSAGE_CODEPOINTS,
    MAX_SUPPORT_PREVIEWS_PER_USER,
    MAX_SUPPORT_PREVIEWS_TOTAL,
    PLAN_MODEL_VERSION,
    SUPPORT_PREVIEW_TTL_S,
    VERSION,
)
from .contact_basis import validate_contact_bases
from .core.command_ports import PairCommitFailure
from .core.command_state import layout_metadata as _layout_metadata
from .core.space_delete import (
    _delete_plan_markers as _delete_plan_markers,
)
from .core.space_delete import (
    _space_delete_candidate as _space_delete_candidate,
)
from .core.space_delete import (
    _space_delete_target as _space_delete_target,
)
from .core.space_delete import (
    _space_marker_dependencies as _space_marker_dependencies,
)
from .import_export import (
    ImportFailure,
    live_layout,
)
from .marker_copy import marker_copy_candidate
from .marker_history import HistoryError
from .marker_history_websocket import HISTORY_FIELDS
from .plans import (
    QuotaError,
    check_quota,
    reserve_filename,
)
from .radar_validation import (
    RadarValidationError,
    radar_registry_evidence,
    validate_marker_radars,
)
from .registry_snapshot import import_registry_snapshot
from .store import (
    OPTIMIZE_BACKUP as _OPTIMIZE_BACKUP,
)
from .store import (
    OPTIMIZE_PENDING as _OPTIMIZE_PENDING,
)
from .store import (
    HouseplanData,
    ResolvedStorePair,
    async_converge_store_pair,
    async_resolve_pending_pair,
    async_save_layout_state,
    get_data,
)
from .structural_websocket import structural_websocket_command
from .support_package import (
    SupportPackageError,
    build_support_package,
)
from .support_preview import async_build_preview
from .support_snapshot import scope_readable
from .support_transport import SupportTransportError, async_submit_report
from .vacuum_paths import public_trails
from .validation import (
    CONFIG_SCHEMA,
    LAYOUT_SCHEMA,
    MAX_CONFIG_BYTES,
    MAX_LAYOUT,
    MAX_PLAN_BYTES,
    PLAN_EXTENSIONS,
    POS_SCHEMA,
    DuplicateMarkerIdError,
    MarkerControlError,
    valid_space_id,
    validate_active_marker_ids,
    validate_marker_controls,
    validate_marker_light_entities,
    validate_marker_vacuum_routes,
    validate_marker_value_badges,
)
from .virtual_lights import (
    EVENT_VIRTUAL_LIGHT_UPDATED,
    async_toggle_virtual_light,
)

_LOGGER = logging.getLogger(__name__)
_MISSING_REV_DEBUGGED: set[str] = set()


def _debug_missing_revision_once(command: str, current_rev: int) -> None:
    """Log one low-noise diagnostic per legacy write command."""
    if command in _MISSING_REV_DEBUGGED:
        return
    _MISSING_REV_DEBUGGED.add(command)
    _LOGGER.debug(
        "House Plan: %s without expected_rev over rev %s; write rejected",
        command,
        current_rev,
    )





async def _release_space_delete_snapshot(
    rt: HouseplanData, previous_metadata: dict, config: dict, metadata: dict,
    pending_history_config: dict | None = None,
) -> None:
    """Release only expired space-delete pins after their replacement is durable.

    Preserve files referenced by the accepted plan, the replacement Undo, or
    another device-history command. Never turn post-commit housekeeping into a
    failed write or run it while the target pair can still roll back.
    """
    previous = previous_metadata.get(_OPTIMIZE_BACKUP)
    replacement = metadata.get(_OPTIMIZE_BACKUP)
    if (not isinstance(previous, dict) or previous.get("kind") != "space_delete"
            or previous == replacement or getattr(rt, "hass", None) is None):
        return
    try:
        from .plans import attachment_refs
        refs = attachment_refs(config)
        # The new marker-history command is accepted only after _commit_pair
        # returns. Its source files already belong to this pending Undo.
        if pending_history_config is not None:
            refs |= attachment_refs(pending_history_config)
        if isinstance(replacement, dict):
            refs |= attachment_refs(replacement.get("config") or {})
        if rt.marker_history is not None:
            refs |= rt.marker_history.refs()
        live = {marker["id"] for marker in config.get("markers") or [] if not marker.get("removed")}
        retired = {marker["id"] for marker in previous.get("config", {}).get("markers") or []} - live
        files_dir = Path(rt.hass.config.path(FILES_DIR))

        def collect() -> None:
            for marker_id in retired:
                _drop_unreferenced_marker_files(files_dir, marker_id, refs)

        await rt.hass.async_add_executor_job(collect)
    except Exception:  # noqa: BLE001 - the accepting transaction is already durable
        _LOGGER.exception("House Plan: releasing expired space-delete attachments failed")


async def _resolved_write_pair(
    hass: HomeAssistant,
    connection,
    msg_id: int,
    rt: HouseplanData,
) -> ResolvedStorePair | None:
    """Resolve an older pair before a writer reads revisions or state."""
    try:
        resolved = await async_resolve_pending_pair(rt)
    except Exception:  # noqa: BLE001 - the pending intent must remain authoritative
        _LOGGER.exception("House Plan: an interrupted paired write is still pending recovery")
        connection.send_error(
            msg_id,
            "commit_failed",
            "A previous House Plan save is pending recovery; retry or restart Home Assistant",
        )
        return None
    if resolved.recovered_kind is not None:
        # Both durable halves are complete before either event is observable.
        hass.bus.async_fire(
            "houseplan_config_updated", {"rev": int(resolved.config_data.get("rev", 0))}
        )
        hass.bus.async_fire(
            "houseplan_layout_updated", {"rev": int(resolved.layout_data.get("rev", 0))}
        )
        _LOGGER.warning(
            "House Plan: completed an interrupted %s before the next write",
            resolved.recovered_kind.replace("_", " "),
        )
    return resolved


@callback
def async_register(hass: HomeAssistant) -> None:
    """Register the WS commands."""
    from .external_screens_websocket import (
        async_register as async_register_external_screens,
    )
    from .radar_websocket import async_register as async_register_radar
    from .vacuum_ecovacs_websocket import async_register as async_register_ecovacs
    from .vacuum_history_websocket import async_register as async_register_history
    from .zigbee_lqi_websocket import async_register as async_register_zigbee_lqi
    from .zigbee_websocket import async_register as async_register_zigbee

    websocket_api.async_register_command(hass, ws_layout_get)
    websocket_api.async_register_command(hass, ws_trail_get)
    websocket_api.async_register_command(hass, ws_trail_delete)
    async_register_external_screens(hass)
    async_register_ecovacs(hass)
    async_register_history(hass)
    websocket_api.async_register_command(hass, ws_layout_set)
    websocket_api.async_register_command(hass, ws_geometry_repair)
    websocket_api.async_register_command(hass, ws_layout_update)
    websocket_api.async_register_command(hass, ws_layout_delete)
    websocket_api.async_register_command(hass, ws_config_get)
    websocket_api.async_register_command(hass, ws_virtual_light_toggle)
    websocket_api.async_register_command(hass, ws_config_set)
    websocket_api.async_register_command(hass, ws_marker_copy)
    websocket_api.async_register_command(hass, ws_wall_node_move)
    websocket_api.async_register_command(hass, ws_wall_node_delete)
    websocket_api.async_register_command(hass, ws_plan_optimize)
    websocket_api.async_register_command(hass, ws_plan_optimize_undo)
    websocket_api.async_register_command(hass, ws_space_delete)
    websocket_api.async_register_command(hass, ws_plan_set)
    websocket_api.async_register_command(hass, ws_plans_list)
    websocket_api.async_register_command(hass, ws_plans_delete)
    websocket_api.async_register_command(hass, ws_files_migrate)
    websocket_api.async_register_command(hass, ws_files_cleanup)
    websocket_api.async_register_command(hass, ws_assets_list)
    websocket_api.async_register_command(hass, ws_assets_resolve)
    websocket_api.async_register_command(hass, ws_assets_delete)
    websocket_api.async_register_command(hass, ws_content_sign)
    websocket_api.async_register_command(hass, ws_export_create)
    websocket_api.async_register_command(hass, ws_backup_cancel)
    websocket_api.async_register_command(hass, ws_import_revalidate)
    websocket_api.async_register_command(hass, ws_import_apply)
    websocket_api.async_register_command(hass, ws_support_preview)
    websocket_api.async_register_command(hass, ws_support_preview_discard)
    websocket_api.async_register_command(hass, ws_support_submit)
    async_register_radar(hass)
    async_register_zigbee(hass)
    async_register_zigbee_lqi(hass)
    from .marker_history_websocket import (
        async_register as async_register_marker_history,
    )
    async_register_marker_history(hass)


def _runtime(hass: HomeAssistant, connection, msg_id: int) -> HouseplanData | None:
    """Runtime data of the loaded entry; answers `not_ready` when not set up.

    The write_lock inside serializes every load→modify→save cycle of both
    stores: without it parallel WS calls lose changes (last-writer-wins)
    and the expected_rev check is not atomic.
    """
    data = get_data(hass)
    if data is None:
        connection.send_error(msg_id, "not_ready", "House Plan is not set up")
    return data


def _build_identity(rt: HouseplanData) -> BuildIdentity:
    """#836: the build identity read at entry setup; unknown on test doubles."""
    identity = getattr(rt, "build_identity", None)
    return identity if isinstance(identity, BuildIdentity) else UNKNOWN_BUILD


def _check_write(hass: HomeAssistant, connection) -> bool:
    """May this connection write? Thin wrapper over the shared policy."""
    return may_write(hass, getattr(connection, "user", None))


def _write_authority(hass, connection, *, admin=False):
    """Recheck the same live owner after graph/source preparation awaits."""
    user = getattr(connection, "user", None)
    user_id = getattr(user, "id", None)

    def authorize():
        if (getattr(connection, "user", None) is not user
                or getattr(user, "id", None) != user_id
                or not _check_write(hass, connection)
                or admin and not getattr(user, "is_admin", False)):
            raise ImportFailure("unauthorized", "Editing permission was lost")

    return authorize


def _connection_user_id(connection) -> str:
    return str(getattr(getattr(connection, "user", None), "id", ""))


def _send_import_error(connection, msg_id: int, err: ImportFailure) -> None:
    # Validation details may include arbitrary input or server-local paths.
    # Frontend localization already uses the stable code, as support does.
    connection.send_error(msg_id, err.code, err.public_message)


def _send_support_error(connection, msg_id: int, code: str) -> None:
    """Return only a stable code; support data never enters an error string."""
    connection.send_error(msg_id, code, code)


def _support_monotonic() -> float:
    """Clock seam for deterministic support-preview lifecycle tests."""
    return time.monotonic()


def _prune_support_previews(rt: HouseplanData, now: float | None = None) -> None:
    current = _support_monotonic() if now is None else now
    for token, preview in list(rt.support_previews.items()):
        if float(preview.get("expires", 0)) <= current:
            rt.support_previews.pop(token, None)


_SUPPORT_REPAIR_FAMILY = re.compile(r"^[a-z][a-z0-9_]{0,63}$")


def _support_repairs(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Expose stable House Plan repair families, never raw issue ids/placeholders."""
    counts: Counter[str] = Counter()
    registry = ir.async_get(hass)
    for (domain, _issue_id), issue in list(registry.issues.items()):
        if domain != DOMAIN:
            continue
        family = getattr(issue, "translation_key", None)
        if isinstance(family, str) and _SUPPORT_REPAIR_FAMILY.fullmatch(family):
            counts[family] += 1
    return [{"code": code, "count": count} for code, count in sorted(counts.items())]


def _support_preview_has_capacity(
    rt: HouseplanData,
    owner: str,
    draft_id: str,
) -> bool:
    """Check quota while treating this owner's current draft as replaceable."""
    retained = [
        item for item in rt.support_previews.values()
        if not (item.get("owner") == owner and item.get("draft_id") == draft_id)
    ]
    owned = sum(1 for item in retained if item.get("owner") == owner)
    return (
        owned < MAX_SUPPORT_PREVIEWS_PER_USER
        and len(retained) < MAX_SUPPORT_PREVIEWS_TOTAL
    )




async def _persist_pair_intent(
    rt: HouseplanData,
    pending: dict[str, Any],
) -> None:
    """Make a target pair recoverable before either visible half moves."""
    stored = await rt.store.async_load() or {}
    metadata = dict(pending.get("final_metadata") or {})
    metadata[_OPTIMIZE_PENDING] = pending
    exact_house = pending.get("kind") in {"house_import", "house_import_rollback"} and "house_files" in pending
    try:
        await async_save_layout_state(
            rt, stored, stored.get("layout") or {}, int(stored.get("rev", 0)),
            metadata=metadata, replace_metadata=True,
            preserve_exact=exact_house,
        )
    except Exception:
        if "archive" not in pending and not exact_house:
            raise  # Preserve legacy callers; ZIP must also survive lost intent ACKs.
        from .store import layout_store_payload
        expected = layout_store_payload(stored, stored.get("layout") or {},
                                        int(stored.get("rev", 0)), metadata=metadata, replace_metadata=True,
                                        preserve_exact=exact_house)
        if await rt.store.async_load() != expected:
            raise


async def _converge_pair(rt: HouseplanData, pending: dict[str, Any]) -> None:
    """Write both target halves and remove the durable intent last."""
    await async_converge_store_pair(rt, pending)


async def _commit_pair(
    rt: HouseplanData,
    pending: dict[str, Any],
    rollback: dict[str, Any],
    *, authorize=None,
) -> None:
    """Commit, retry once, or restore the before-pair before returning.

    A Store write may raise after the bytes reached disk, so recovery always
    reloads and converges an explicit pair instead of guessing which half won.
    If the target cannot be completed, a rollback intent replaces it before we
    restore the old pair; setup will therefore restore, never unexpectedly
    finish an import that was reported as failed.
    """
    from .graph_write import prepare_graph_pair
    if (getattr(rt, "hass", None) is not None
            and pending.get("kind") not in {"house_import", "house_import_rollback"}):
        from .plan_graph_exact import GraphError
        try:
            await prepare_graph_pair(rt, pending, rollback)
        except GraphError as error:
            raise ImportFailure(error.code, error.reason) from error
        except OSError as error:
            raise ImportFailure("migration_source_unavailable", "Migration source could not be saved") from error
    if authorize is not None:
        authorize()
    # #1096: a pair writer replaces the stored document outside the ordinary
    # validation path; `ws_config_set` re-stamps after its own pair commit.
    rt.schema_clean_rev = None
    try:
        await _persist_pair_intent(rt, pending)
        await _converge_pair(rt, pending)
        await _release_space_delete_snapshot(rt, rollback.get("final_metadata") or {},
                                            pending.get("config") or {}, pending.get("final_metadata") or {},
                                            rollback.get("config") if pending.get("kind") == "marker_history" else None)
        return
    except Exception:  # noqa: BLE001 - one retry handles fail-after-write too
        _LOGGER.warning("House Plan pair write failed; retrying target", exc_info=True)
    try:
        await _persist_pair_intent(rt, pending)
        await _converge_pair(rt, pending)
        await _release_space_delete_snapshot(rt, rollback.get("final_metadata") or {},
                                            pending.get("config") or {}, pending.get("final_metadata") or {},
                                            rollback.get("config") if pending.get("kind") == "marker_history" else None)
        return
    except Exception:  # noqa: BLE001 - target is no longer the recovery policy
        _LOGGER.exception("House Plan target retry failed; restoring previous pair")
    try:
        await _persist_pair_intent(rt, rollback)
        await _converge_pair(rt, rollback)
    except Exception as rollback_error:  # noqa: BLE001 - a failed rollback must not mask the original commit error
        _LOGGER.exception(
            "House Plan rollback could not finish; rollback intent remains for recovery"
        )
        raise PairCommitFailure(recovery_pending=True) from rollback_error
    raise PairCommitFailure(recovery_pending=False)


@structural_websocket_command({
    vol.Required("type"): "houseplan/marker/copy",
    vol.Required("source_id"): str,
    vol.Required("source_binding"): vol.Match(r"^(device:.+|entity:.+|virtual)$"),
    vol.Required("marker"): dict,
    vol.Required("position"): POS_SCHEMA,
    vol.Required("expected_config_rev"): int,
    vol.Required("expected_layout_rev"): int,
    **HISTORY_FIELDS,
})
@websocket_api.async_response
async def ws_marker_copy(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Create a virtual copy and reverse edges as one recoverable store pair (#935)."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only editors may copy devices")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    from homeassistant.helpers import device_registry as dr
    from homeassistant.helpers import entity_registry as er

    try:
        async with rt.write_lock:
            from .marker_history_websocket import (
                commit_history_pair,
                copy_accept,
                copy_begin,
                copy_prepare,
                replay_pair,
            )
            session, replay = copy_begin(rt, connection, msg)
            if replay is not None:
                await replay_pair(hass, connection, msg, rt, replay)
                return
            resolved = await _resolved_write_pair(hass, connection, msg["id"], rt)
            if resolved is None:
                return
            cd, ld = resolved.config_data, resolved.layout_data
            cr, lr = int(cd.get("rev", 0)), int(ld.get("rev", 0))
            if msg["expected_config_rev"] != cr or msg["expected_layout_rev"] != lr:
                connection.send_error(msg["id"], "conflict", "Plan changed elsewhere")
                return
            previous, layout = cd.get("config") or DEFAULT_CONFIG, ld.get("layout") or {}
            binding = msg["source_binding"]
            kind, _, ref = binding.partition(":")
            def source_available():
                if kind == "virtual":
                    return True
                registry = import_registry_snapshot(hass)
                entity = er.async_get(hass).async_get(ref) if kind == "entity" else None
                parent = dr.async_get(hass).async_get(entity.device_id) if entity and entity.device_id else None
                return (ref in registry["active_" + kind]
                        and not (entity and entity.disabled_by is not None)
                        and not (parent and parent.disabled_by is not None))

            if not source_available():
                connection.send_error(msg["id"], "invalid_data", "Source is no longer available")
                return
            own_entities = ({ref} if kind == "entity" else {
                entry.entity_id for entry in er.async_get(hass).entities.values()
                if entry.device_id == ref and not entry.disabled_by
                and entry.entity_id.startswith(("light.", "switch."))
            }) if kind != "virtual" else set()
            radar_registry = radar_registry_evidence(hass)

            def validate():
                candidate, positions = marker_copy_candidate(
                    previous, layout, msg["source_id"], binding, msg["marker"],
                    msg["position"], own_entities,
                )
                candidate = CONFIG_SCHEMA(candidate)
                positions = LAYOUT_SCHEMA(positions)
                if len(json.dumps(candidate, separators=(",", ":"))) > MAX_CONFIG_BYTES:
                    raise vol.Invalid("Configuration is too large")
                validate_active_marker_ids(candidate, previous)
                validate_marker_controls(candidate, previous)
                validate_marker_light_entities(candidate, previous)
                validate_marker_radars(candidate, previous, registry=radar_registry)
                validate_marker_value_badges(candidate, previous)
                validate_marker_vacuum_routes(candidate, previous)
                return candidate, positions

            target, positions = await hass.async_add_executor_job(validate)
            command = await hass.async_add_executor_job(copy_prepare, rt, hass, previous, layout,
                target, positions, msg["marker"]["id"]) if session is not None else None
            if session is not None:
                rt.marker_history.check_bytes(session, command, msg.get("retained_tokens"))
            # The lock spans validation and the commit. Recheck authority after CPU I/O.
            if not _check_write(hass, connection):
                connection.send_error(msg["id"], "unauthorized", "Editing permission was lost")
                return
            if not source_available():
                connection.send_error(msg["id"], "invalid_data", "Source is no longer available")
                return
            original_metadata = _layout_metadata(ld)
            final_metadata = {k: v for k, v in original_metadata.items()
                              if k not in {_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING, "repair_backup", "geom_pending"}}
            pending = {"kind": "marker_copy", "config": target, "layout": positions,
                       "config_rev": cr + 1, "layout_rev": lr + 1, "final_metadata": final_metadata}
            rollback = {"kind": "marker_copy_rollback", "config": previous, "layout": layout,
                        "config_rev": cr, "layout_rev": lr, "final_metadata": original_metadata}
            await commit_history_pair(rt, session, pending, rollback, authorize=_write_authority(hass, connection))
            result = {"config": target, "layout": positions, "config_rev": cr + 1, "layout_rev": lr + 1}
            copy_accept(rt, session, msg, command, result)
    except ImportFailure as err:
        _send_import_error(connection, msg["id"], err)
        return
    except HistoryError as err:
        connection.send_error(msg["id"], err.code, "Device history is no longer applicable")
        return
    except (DuplicateMarkerIdError, MarkerControlError, RadarValidationError) as err:
        connection.send_error(msg["id"], err.code, str(err))
        return
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    except Exception:  # noqa: BLE001 - paired writer has already recovered or retained rollback
        _LOGGER.exception("House Plan device copy failed")
        connection.send_error(msg["id"], "commit_failed", "Device copy failed; reload the plan")
        return
    hass.bus.async_fire("houseplan_config_updated", {"rev": cr + 1})
    hass.bus.async_fire("houseplan_layout_updated", {"rev": lr + 1})
    _refresh_trail_recorder(hass)
    connection.send_result(msg["id"], result)


# ---------------- portable backup / transfer ----------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/export/create",
        vol.Required("kind"): vol.In(["full", "space", "house"]),
        vol.Optional("operation_id"): str,
        vol.Optional("space_id"): str,
        vol.Optional("plan_only", default=False): bool,
        vol.Optional("card_version", default=""): str,
        vol.Optional("archive", default=False): bool,
        vol.Optional("migration_source", default=False): bool,
        vol.Optional("migration_source_kind", default="config"): vol.In(["config", "graph"]),
        vol.Optional("plan_graph_migration_source", default=False): bool,
        vol.Optional("migration_source_sha256"): vol.All(str, vol.Match(r"^[0-9a-f]{64}$")),
    }
)
@websocket_api.async_response
async def ws_export_create(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/export/create'})


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/backup/cancel",
    vol.Optional("transfer_kind"): vol.In(["house"]),
    vol.Optional("token"): str,
    vol.Optional("operation_id"): str,
})
@websocket_api.async_response
async def ws_backup_cancel(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/backup/cancel'})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/import/revalidate",
        vol.Optional("transfer_kind"): vol.In(["house"]),
        vol.Required("token"): str,
        vol.Optional("duplicate_policy", default="skip"): vol.In(["skip", "virtual"]),
    }
)
@websocket_api.async_response
async def ws_import_revalidate(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/import/revalidate'})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/import/apply",
        vol.Optional("transfer_kind"): vol.In(["house"]),
        vol.Required("token"): str,
        vol.Required("expected_config_rev"): int,
        vol.Required("expected_layout_rev"): int,
        vol.Optional("duplicate_policy"): vol.In(["skip", "virtual"]),
        vol.Optional("confirm_missing_content", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_import_apply(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/import/apply'})


# ---------------- layout ----------------


def _live_layout(config: dict[str, Any], layout: dict[str, Any]) -> dict[str, Any]:
    """Drop positions which a deleted marker can no longer own.

    HA device ids may be layout-only because auto-discovered devices need no
    marker entry. Virtual ids are different: every live virtual marker is
    explicit, so a missing `v_*` owner is stale data. The prefix itself is
    only a legacy naming convention, however; an explicit real marker remains
    authoritative even when its id happens to begin with `v_`.
    """
    return live_layout(config, layout)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/layout/get",
        vol.Optional("space_id"): vol.All(str, vol.Length(min=1, max=200)),
    }
)
@websocket_api.async_response
async def ws_layout_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/layout/get'})


@structural_websocket_command(
    {
        vol.Required("type"): "houseplan/layout/set",
        vol.Required("layout"): LAYOUT_SCHEMA,
        vol.Optional("expected_rev"): int,
        vol.Optional("expected_config_rev"): int,
    }
)
@websocket_api.async_response
async def ws_layout_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/layout/set'})


@structural_websocket_command(
    {
        vol.Required("type"): "houseplan/layout/update",
        vol.Required("device_id"): str,
        vol.Required("pos"): POS_SCHEMA,
    }
)
@websocket_api.async_response
async def ws_layout_update(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Update the position of a single device."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit the layout")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    async with rt.write_lock:
        # A stale browser may still finish a drag after another client deleted
        # the marker. Its tombstone is the server-side authority: acknowledge
        # but ignore the late point so re-adding starts without a zombie
        # position.
        resolved = await _resolved_write_pair(hass, connection, msg["id"], rt)
        if resolved is None:
            return
        config_data = resolved.config_data
        config = config_data.get("config") or {}
        markers = config.get("markers") or []
        live_virtual = any(
            str(m.get("id")) == msg["device_id"] and m.get("removed") is not True
            and m.get("binding") == "virtual"
            for m in markers
        )
        live_explicit = any(
            str(m.get("id")) == msg["device_id"] and m.get("removed") is not True
            for m in markers
        )
        deleted = not live_explicit and any(
            str(m.get("id")) == msg["device_id"] and m.get("removed") is True
            for m in markers
        )
        orphan_virtual = (
            msg["device_id"].startswith("v_")
            and not live_virtual
            and not live_explicit
        )
        if deleted or orphan_virtual:
            data = resolved.layout_data
            connection.send_result(msg["id"], {
                "ok": True,
                "ignored": "removed" if deleted else "missing_virtual",
                "rev": int(data.get("rev", 0)),
            })
            return
        data = resolved.layout_data
        layout = data.get("layout", {})
        try:
            validate_contact_bases({msg["device_id"]: msg["pos"]}, layout)
        except vol.Invalid as err:
            connection.send_error(msg["id"], "invalid_format", str(err))
            return
        if layout.get(msg["device_id"]) == msg["pos"]:
            connection.send_result(msg["id"], {"ok": True, "rev": int(data.get("rev", 0))})
            return
        layout = {**layout, msg["device_id"]: msg["pos"]}
        # keep the revision: a point-wise write used to drop it, which made the
        # optimistic locking on layout/set meaningless — every drag reset the
        # counter to 0 (HP-1454-08)
        new_rev = int(data.get("rev", 0)) + 1
        await async_save_layout_state(
            rt, data, layout, new_rev,
            remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING),
        )
        await _release_space_delete_snapshot(rt, data, config, {})
    hass.bus.async_fire("houseplan_layout_updated", {"rev": new_rev})
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/geometry/repair",
        vol.Required("space_id"): str,
        vol.Required("aspect"): vol.All(vol.Coerce(float), vol.Range(min=0.05, max=20)),
        vol.Optional("dry_run"): bool,
        vol.Optional("undo"): bool,
        vol.Optional("expected_rev"): int,
    }
)
@websocket_api.async_response
async def ws_geometry_repair(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/geometry/repair'})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/files/migrate",
        vol.Required("from_id"): str,
        vol.Required("to_id"): str,
    }
)
@websocket_api.async_response
async def ws_files_migrate(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """COPY a marker's uploaded files to its new id and report the exact mapping.

    Rebinding changes the marker id, so the files must follow (that is how the
    owner lost a set of manuals, 2026-07-26). This used to MOVE them before the
    revision-checked config save: when that save was rejected, the server kept
    the old urls while the files had already left the old folder — a permanent
    broken link (review CR-2, 2026-07-27).

    Now it copies, never overwrites, and returns {src: dst} for every file so
    the client can rewrite EXACTLY the urls that made it (review CR-3). The old
    folder is removed later by houseplan/files/cleanup, once the config is
    safely committed.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit files")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    import shutil
    from pathlib import Path

    from .const import FILES_DIR
    from .validation import sanitize_marker_id

    src_id = sanitize_marker_id(msg["from_id"])
    dst_id = sanitize_marker_id(msg["to_id"])
    if not src_id or not dst_id or src_id == dst_id:
        connection.send_result(msg["id"], {"ok": True, "mapping": {}, "copied": 0})
        return
    base = Path(hass.config.path(FILES_DIR))
    src = base / src_id
    dst = base / dst_id

    def _copy() -> dict[str, str]:
        if not src.is_dir():
            return {}
        dst.mkdir(parents=True, exist_ok=True)
        mapping: dict[str, str] = {}
        for f in sorted(src.iterdir()):
            if not f.is_file():
                continue
            # #935: permanent copies share the upload store's unchanged limits.
            check_quota(base, f.stat().st_size, MAX_FILES_BYTES, MAX_FILES_COUNT)
            # a different file may already own this name — do NOT silently point
            # the url at it. The shared helper CLAIMS a free one atomically, so
            # a concurrent migrate or upload cannot pick the same one, and the
            # name it returns is one the content view accepts back in a request.
            name = reserve_filename(dst, f.name)
            target = dst / name
            try:
                shutil.copy2(str(f), str(target))
            except OSError:
                target.unlink(missing_ok=True)  # never leave an empty placeholder
                raise
            mapping[f.name] = name
        return mapping

    try:
        async with rt.upload_lock:
            mapping = await hass.async_add_executor_job(_copy)
    except QuotaError as err:
        connection.send_error(msg["id"], "too_large", "Could not copy marker files: " + err.detail)
        return
    except OSError as err:
        connection.send_error(msg["id"], "io_error", f"Could not copy marker files: {err}")
        return
    connection.send_result(msg["id"], {"ok": True, "mapping": mapping, "copied": len(mapping)})


@websocket_api.websocket_command({vol.Required("type"): "houseplan/plans/list"})
@websocket_api.async_response
async def ws_plans_list(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/plans/list'})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/plans/delete",
        vol.Required("name"): str,
    }
)
@websocket_api.async_response
async def ws_plans_delete(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/plans/delete'})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/content/sign",
        vol.Required("paths"): [str],
    }
)
@websocket_api.async_response
async def ws_content_sign(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Sign content paths so the BROWSER can fetch them.

    Home Assistant authenticates HTTP requests by a Bearer header or an
    `authSig` signed path — there is no cookie auth. An <image href> inside SVG
    and a plain <a href> can send neither, so after the content endpoint became
    `requires_auth` the plan backgrounds and PDF links returned 401 (audit
    follow-up B1 regression, 2026-07-27 — reproduced live).

    The card asks for signatures and uses the signed urls for display.
    """
    from datetime import timedelta

    from homeassistant.components.http.auth import async_sign_path

    out: dict[str, str] = {}
    token_id = getattr(connection, "refresh_token_id", None)
    for path in msg["paths"][:MAX_SIGN_PATHS]:
        if not isinstance(path, str) or not path.startswith(CONTENT_URL + "/"):
            continue  # only ever sign our own content endpoint
        clean = path.split("?", 1)[0]
        try:
            try:
                signed = async_sign_path(hass, clean, timedelta(hours=24), refresh_token_id=token_id)
            except TypeError:  # older HA signature: (hass, refresh_token_id, path, expiration)
                signed = async_sign_path(hass, token_id, clean, timedelta(hours=24))
        except Exception as err:  # noqa: BLE001 — signing must never break the card
            _LOGGER.warning("House Plan: could not sign %s: %s", clean, err)
            continue
        out[path] = signed
    connection.send_result(msg["id"], {"urls": out})


@websocket_api.websocket_command({vol.Required("type"): "houseplan/assets/list"})
@websocket_api.async_response
async def ws_assets_list(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/assets/list'})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/assets/resolve",
        vol.Required("asset_ids"): vol.All(
            [vol.All(str, vol.Match(r"^[0-9a-f]{64}$"))], vol.Length(max=200),
        ),
    }
)
@websocket_api.async_response
async def ws_assets_resolve(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/assets/resolve'})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/assets/delete",
        vol.Required("asset_id"): vol.All(str, vol.Match(r"^[0-9a-f]{64}$")),
    }
)
@websocket_api.async_response
async def ws_assets_delete(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/assets/delete'})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/files/cleanup",
        vol.Required("marker_id"): str,
    }
)
@websocket_api.async_response
async def ws_files_cleanup(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Drop a marker folder's leftovers after its files moved elsewhere.

    Called after a rebind: the files were copied to the new marker id and the
    config that references them is committed, so the source folder is spent.

    It used to `rmtree` the folder on the client's word alone. Two ways that
    ends badly: a partial copy leaves some urls still pointing INTO this folder
    (the migration deliberately does not rewrite those), and a wrong or stale
    id from any client deletes a live marker's attachments outright. So the
    server checks for itself — under the config lock — and removes only files
    the stored configuration does not reference. Same principle as the
    collector: a client may say what it no longer needs, never what may go.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit files")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    from .plans import attachment_refs

    files_dir = Path(hass.config.path(FILES_DIR))
    async with rt.write_lock:
        stored = await rt.config_store.async_load() or {}
        refs = attachment_refs(stored.get("config") or {})
        layout_data = await rt.store.async_load() or {}
        backup = layout_data.get(_OPTIMIZE_BACKUP)
        if isinstance(backup, dict) and backup.get("kind") == "space_delete":
            refs |= attachment_refs(backup.get("config") or {})
        if rt.marker_history is not None:
            refs |= rt.marker_history.refs()
        removed, kept = await hass.async_add_executor_job(
            _drop_unreferenced_marker_files, files_dir, msg["marker_id"], refs,
        )
    connection.send_result(msg["id"], {"ok": True, "removed": removed, "kept": kept})


def _drop_unreferenced_marker_files(
    files_dir: Path, marker_id: str, refs: set[str],
) -> tuple[int, int]:
    """Remove the files of ``<files>/<marker>`` the stored config does not name.

    The one rule behind ``houseplan/files/cleanup`` and behind the markers a
    space delete takes with it (#819). Runs in the executor; returns
    ``(removed, kept)``. An id that does not name a folder inside the files
    directory touches nothing.
    """
    from .validation import sanitize_marker_id

    mid = sanitize_marker_id(marker_id)
    base = files_dir.resolve()
    target = (base / mid).resolve() if mid else base
    if not mid or not str(target).startswith(str(base)) or target == base:
        return 0, 0
    if not target.is_dir():
        return 0, 0
    removed = kept = 0
    for item in sorted(target.iterdir()):
        if not item.is_file():
            continue
        if f"{mid}/{item.name}" in refs:
            kept += 1
            continue
        try:
            item.unlink()
            removed += 1
        except OSError as err:
            _LOGGER.warning("House Plan: could not remove %s: %s", item, err)
    if not kept:
        try:
            target.rmdir()
        except OSError:
            pass
    else:
        _LOGGER.info(
            "House Plan: kept %s file(s) in %s — the configuration still references them", kept, mid
        )
    return removed, kept


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/layout/delete",
        vol.Required("device_id"): str,
    }
)
@websocket_api.async_response
async def ws_layout_delete(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Delete the position of a single device (cleanup when a marker is removed)."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit the layout")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    new_rev: int | None = None
    async with rt.write_lock:
        resolved = await _resolved_write_pair(hass, connection, msg["id"], rt)
        if resolved is None:
            return
        data = resolved.layout_data
        layout = data.get("layout", {})
        if msg["device_id"] in layout:
            del layout[msg["device_id"]]
            new_rev = int(data.get("rev", 0)) + 1
            await async_save_layout_state(
                rt, data, layout, new_rev,
                remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING),
            )
            await _release_space_delete_snapshot(rt, data, resolved.config_data.get("config") or {}, {})
    if new_rev is not None:
        hass.bus.async_fire("houseplan_layout_updated", {"rev": new_rev})
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev})


# ---------------- space configuration ----------------


_PROJECTION_FIELDS = vol.All([vol.All(str, vol.Length(min=1, max=100))], vol.Length(max=50))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/config/get",
        # Проекция ответа (#256). Все параметры необязательны, и без них ответ
        # прежний — это главный инвариант: ни один существующий клиент не
        # должен заметить появление этой возможности.
        vol.Optional("space_id"): vol.All(str, vol.Length(min=1, max=200)),
        vol.Optional("fields"): _PROJECTION_FIELDS,
        vol.Optional("marker_fields"): _PROJECTION_FIELDS,
    }
)
@websocket_api.async_response
async def ws_config_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/config/get'})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/virtual_light/toggle",
        vol.Required("marker_id"): vol.All(str, vol.Length(min=1, max=500)),
    }
)
@websocket_api.async_response
async def ws_virtual_light_toggle(
    hass: HomeAssistant, connection, msg: dict[str, Any]
) -> None:
    """Atomically toggle one eligible virtual light for any signed-in user."""
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    async with rt.write_lock:
        resolved = await _resolved_write_pair(hass, connection, msg["id"], rt)
        if resolved is None:
            return
        data = resolved.config_data
        config = {**DEFAULT_CONFIG, **data.get("config", {})}
        result = await (
            rt.virtual_lights.async_toggle(
                config, int(data.get("rev", 0)), msg["marker_id"]
            )
            if rt.virtual_lights is not None
            else async_toggle_virtual_light(
                rt.virtual_light_store,
                config,
                int(data.get("rev", 0)),
                msg["marker_id"],
            )
        )
        if result is None:
            connection.send_error(
                msg["id"],
                "not_toggleable",
                "Marker is not an active virtual light with tap_action=toggle",
            )
            return
    # The runtime revision is immediate; durable writes are coalesced and
    # flushed before config transitions/unload.
    connection.send_result(msg["id"], result)
    hass.bus.async_fire(EVENT_VIRTUAL_LIGHT_UPDATED, result)













def _readable_entity_ids(
    hass: HomeAssistant, connection, entity_ids: set[str] | None = None,
) -> set[str]:
    """Snapshot entities readable by this writer on the event loop.

    `entity_ids` (#1096) limits the snapshot to the entities a summary panel
    actually references: those are the only ids
    `validate_summary_panel_references` looks up, so an ordinary write does not
    walk every state of the installation for them. None keeps the full scan.
    """
    user = getattr(connection, "user", None)
    readable: set[str] = set()
    if entity_ids is not None:
        states = [state for state in (hass.states.get(entity_id) for entity_id in entity_ids) if state is not None]
    else:
        states = hass.states.async_all()
    for state in states:
        try:
            if user and (
                getattr(user, "is_admin", False)
                or user.permissions.check_entity(state.entity_id, "read")
            ):
                readable.add(state.entity_id)
        except Exception:  # noqa: BLE001 - denied/unknown is unreadable
            continue
    return readable


@structural_websocket_command(
    {
        vol.Required("type"): "houseplan/config/set",
        # Semantic stale-client detection needs the stored v8 document and
        # therefore runs inside the write lock before CONFIG_SCHEMA.
        vol.Required("config"): dict,
        vol.Optional("expected_rev"): int,
        vol.Optional("contact_layout"): LAYOUT_SCHEMA,
        vol.Optional("room_label_layout"): vol.All(vol.Schema({str: vol.Any(None, POS_SCHEMA)}), vol.Length(max=MAX_LAYOUT)),
        vol.Optional("expected_layout_rev"): int,
        vol.Optional("graph_change"): dict,
        vol.Optional("opening_features_api"): object,
    }
)
@websocket_api.async_response
async def ws_config_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/config/set'})


@structural_websocket_command(
    {
        vol.Required("type"): "houseplan/wall/node_move",
        vol.Required("space_id"): str,
        vol.Required("expected_rev"): int,
        vol.Required("intent"): dict,
        vol.Optional("direction", default="apply"): vol.In(["apply", "undo"]),
        vol.Optional("before_space"): dict,
    }
)
@websocket_api.async_response
async def ws_wall_node_move(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/wall/node_move'})


@structural_websocket_command(
    {
        vol.Required("type"): "houseplan/wall/node_delete",
        vol.Required("space_id"): str,
        vol.Required("expected_rev"): int,
        vol.Required("intent"): dict,
        vol.Optional("direction", default="apply"): vol.In(["apply", "undo"]),
        vol.Optional("before_space"): dict,
    }
)
@websocket_api.async_response
async def ws_wall_node_delete(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/wall/node_delete'})


# ---------------- whole-plan maintenance ----------------










async def _forget_deleted_markers(
    hass: HomeAssistant, config: dict[str, Any], marker_ids: list[str],
) -> None:
    """Attachments and robot trails of markers a space delete took (#819).

    The same clean-up the card runs after the device dialog's «Delete»
    (``files/cleanup`` and ``trail/delete`` per marker). It follows an already
    durable commit, so it is best-effort: a failure is logged and never turns
    the accepted delete into an error the client would retry.
    """
    from .plans import attachment_refs

    rt = get_data(hass)
    refs = attachment_refs(config)
    # A reversible whole-space delete retains the attachments owned by its
    # one-deep snapshot until that snapshot expires on a later ordinary edit.
    try:
        stored = (await rt.store.async_load() or {}) if rt is not None else {}
    except Exception:  # noqa: BLE001 - unavailable pin evidence must preserve files
        _LOGGER.exception("House Plan: reading space-delete attachment pins failed")
        return
    backup = stored.get(_OPTIMIZE_BACKUP)
    if isinstance(backup, dict) and backup.get("kind") == "space_delete":
        refs |= attachment_refs(backup.get("config") or {})
    if rt is not None and rt.marker_history is not None:
        refs |= rt.marker_history.refs()
    files_dir = Path(hass.config.path(FILES_DIR))

    def _drop_files() -> None:
        for marker_id in marker_ids:
            _drop_unreferenced_marker_files(files_dir, marker_id, refs)

    try:
        await hass.async_add_executor_job(_drop_files)
    except Exception:  # noqa: BLE001 - the delete is already durable
        _LOGGER.exception("House Plan: removing attachments of deleted markers failed")
    try:
        await _purge_trail_recorder(hass, config)
    except Exception:  # noqa: BLE001 - the delete is already durable
        _LOGGER.exception("House Plan: removing trails of deleted markers failed")


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/space/delete",
        vol.Optional("opening_features_api"): object,
        vol.Required("space_id"): str,
        vol.Required("expected_config_rev"): int,
        vol.Required("expected_layout_rev"): int,
        # #819: optional, so an older card keeps the `space_in_use` answer.
        vol.Optional("remove_markers", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_space_delete(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/space/delete'})


@structural_websocket_command(
    {
        vol.Required("type"): "houseplan/plan/optimize",
        vol.Required("config"): dict,
        vol.Optional("opening_features_api"): object,
        vol.Optional("graph_change"): dict,
        vol.Required("layout"): LAYOUT_SCHEMA,
        vol.Required("expected_config_rev"): int,
        vol.Required("expected_layout_rev"): int,
    }
)
@websocket_api.async_response
async def ws_plan_optimize(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/plan/optimize'})


@structural_websocket_command(
    {
        vol.Required("type"): "houseplan/plan/optimize_undo",
        vol.Required("expected_config_rev"): int,
        vol.Required("expected_layout_rev"): int,
    }
)
@websocket_api.async_response
async def ws_plan_optimize_undo(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """HA transport delegates to the canonical plan command service."""
    from .command_adapter import dispatch_plan_command

    await dispatch_plan_command(hass, connection, {**msg, "type": 'houseplan/plan/optimize_undo'})


# ---------------- plan uploads ----------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/plan/set",
        vol.Required("space_id"): str,
        vol.Required("ext"): vol.In(sorted(PLAN_EXTENSIONS)),
        vol.Required("data"): str,  # base64
    }
)
@websocket_api.async_response
async def ws_plan_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Save a space plan file; return the URL for the card."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may upload plans")
        return
    space_id = msg["space_id"]
    if not valid_space_id(space_id):
        connection.send_error(msg["id"], "invalid_space_id", "space_id: only [a-z0-9_-], up to 64 characters")
        return
    try:
        raw = base64.b64decode(msg["data"], validate=True)
    except (binascii.Error, ValueError):
        connection.send_error(msg["id"], "invalid_data", "data must be valid base64")
        return
    if len(raw) > MAX_PLAN_BYTES:
        connection.send_error(msg["id"], "too_large", f"Plan is larger than {MAX_PLAN_BYTES // 1024 // 1024} MB")
        return

    # Kept for cards cached from before #617: they still upload over WS. A
    # current card uses POST /api/houseplan/plans/upload instead, because the
    # base64 frame of a plan above ~3 MiB exceeds the 4 MiB WebSocket message
    # limit and the socket closes before this handler runs — the size check
    # above is reachable only for small files on this path. Both transports
    # call the same upload command and staged physical writer.
    data = _runtime(hass, connection, msg["id"])
    if data is None:
        return
    from .command_adapter import plan_commands
    from .core.command_ports import CommandError

    try:
        result = await plan_commands(hass, connection, data).upload_plan(raw, space_id, msg["ext"])
    except QuotaError as err:
        connection.send_error(msg["id"], err.reason, err.detail)
        return
    except CommandError as err:
        connection.send_error(msg["id"], err.code, err.public_message)
        return
    connection.send_result(msg["id"], result)


def _refresh_trail_recorder(hass: HomeAssistant) -> None:
    """Markers changed — the trail recorder must re-resolve what it watches."""
    rec = hass.data.get(DOMAIN, {}).get("trail_recorder")
    if rec:
        hass.async_create_task(rec.async_refresh())


async def _purge_trail_recorder(hass: HomeAssistant, config: dict[str, Any]) -> int:
    """Reconcile durable trails with the live marker set after a config commit."""
    rec = hass.data.get(DOMAIN, {}).get("trail_recorder")
    return await rec.async_purge_orphans(config) if rec else 0


def _public_trails(value: Any) -> Any:
    """The shared authenticated read retains only the public format-2 value."""
    return public_trails(value)


@websocket_api.websocket_command({vol.Required("type"): "houseplan/trail/get"})
@websocket_api.async_response
async def ws_trail_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Current + previous runs and raw coordinates, without source entity ids."""
    from .vacuum_history import history_epochs

    rec = hass.data.get(DOMAIN, {}).get("trail_recorder")
    connection.send_result(
        msg["id"], {"trail_format": 2, "live_tail_format": 1, "trails": _public_trails(rec.book.data) if rec else {},
                    "vacuum_source_format": 1, "vacuum_sources": rec.ecovacs.public() if rec else {},
                    "vacuum_history_epochs": history_epochs(rec) if rec else None}
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/trail/delete",
        vol.Required("marker_id"): vol.All(str, vol.Length(min=1, max=256)),
    }
)
@websocket_api.async_response
async def ws_trail_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Permanently forget one deleted marker's current and previous runs."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may delete trails")
        return
    if _runtime(hass, connection, msg["id"]) is None:
        return
    rec = hass.data.get(DOMAIN, {}).get("trail_recorder")
    removed = await rec.async_delete(msg["marker_id"]) if rec else False
    connection.send_result(msg["id"], {"ok": True, "removed": removed})


# ---------------- private support package / feedback (#43) ----------------


def _support_string(value: object) -> str:
    if not isinstance(value, str):
        raise vol.Invalid("support field must be a string")
    return value


def _support_bool(value: object) -> bool:
    if not isinstance(value, bool):
        raise vol.Invalid("support field must be a boolean")
    return value


def _support_browser_major(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 999:
        raise vol.Invalid("browser_major must be an integer in 0..999")
    return value


_SUPPORT_TOKEN = vol.All(
    _support_string, vol.Length(min=16, max=128), vol.Match(r"^[0-9a-f]+$")
)
_SUPPORT_ID = vol.All(
    _support_string, vol.Length(min=8, max=128), vol.Match(r"^[A-Za-z0-9_.:-]+$")
)
_SUPPORT_VERSION = vol.All(
    _support_string, vol.Length(min=1, max=32), vol.Match(r"^[0-9A-Za-z._+-]+$")
)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/support/preview",
        vol.Required("card_version"): _SUPPORT_VERSION,
        vol.Required("browser_family"): vol.In(["chromium", "firefox", "webkit", "unknown"]),
        vol.Required("browser_major"): _support_browser_major,
        vol.Required("language"): vol.In(["en", "ru", "de", "fr"]),
        vol.Required("coarse_pointer"): _support_bool,
        vol.Required("hover_capable"): _support_bool,
        vol.Required("registry_access"): vol.In(["full", "partial", "unavailable"]),
        vol.Required("registry_age_bucket"): vol.In(["fresh", "stale", "unknown"]),
        vol.Required("draft_id"): _SUPPORT_ID,
        vol.Optional("package_version"): _support_browser_major,
        vol.Optional("diagnostics"): dict,
    }
)
@websocket_api.async_response
async def ws_support_preview(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Build and retain one exact, already-sanitized support-package snapshot."""
    if not _check_write(hass, connection):
        _send_support_error(connection, msg["id"], "unauthorized")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return

    owner = _connection_user_id(connection)
    _prune_support_previews(rt)
    if not _support_preview_has_capacity(rt, owner, msg["draft_id"]):
        _send_support_error(connection, msg["id"], "support_rate_limited")
        return

    try:
        raw, preview, read_scope = await async_build_preview(
            hass, connection, rt, msg, builder=build_support_package,
            config_schema=CONFIG_SCHEMA, layout_schema=LAYOUT_SCHEMA,
            repairs=_support_repairs(hass), build=_build_identity(rt).build,
            integration_version=VERSION, ha_version=HA_VERSION,
        )
    except (vol.Invalid, ValueError, TypeError, OverflowError) as error:
        code = error.code if isinstance(error, SupportPackageError) else "support_rejected"
        _send_support_error(connection, msg["id"], code)
        return

    now = _support_monotonic()
    _prune_support_previews(rt, now)
    # The executor yields to other requests. Re-check after it returns so two
    # concurrent builds cannot both consume the final slot. The old preview is
    # retained until the replacement is ready and this second check succeeds.
    if not _support_preview_has_capacity(rt, owner, msg["draft_id"]):
        _send_support_error(connection, msg["id"], "support_rate_limited")
        return
    # A refresh replaces only this card instance's draft. Other cards keep
    # their token and exact bytes.
    for old_token, record in list(rt.support_previews.items()):
        if record.get("owner") == owner and record.get("draft_id") == msg["draft_id"]:
            rt.support_previews.pop(old_token, None)
    token = secrets.token_hex(24)
    expires = now + SUPPORT_PREVIEW_TTL_S
    rt.support_previews[token] = {
        "owner": owner,
        "draft_id": msg["draft_id"],
        "created": now,
        "expires": expires,
        "bytes": raw,
        "sha256": preview["sha256"],
        "versions": preview["versions"],
        "read_scope": read_scope,
    }
    connection.send_result(
        msg["id"],
        {
            "token": token,
            "expires_in": SUPPORT_PREVIEW_TTL_S,
            "size": preview["size"],
            "sha256": preview["sha256"],
            "spaces": preview["spaces"],
            "format": preview["format"],
            "version": preview["version"],
            "text": raw.decode("utf-8"),
            **({"coverage": preview["coverage"]} if "coverage" in preview else {}),
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/support/preview/discard",
        vol.Required("token"): _SUPPORT_TOKEN,
    }
)
@websocket_api.async_response
async def ws_support_preview_discard(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Idempotently discard only a preview owned by this HA user."""
    if not _check_write(hass, connection):
        _send_support_error(connection, msg["id"], "unauthorized")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    _prune_support_previews(rt)
    preview = rt.support_previews.get(msg["token"])
    if preview is not None and preview.get("owner") != _connection_user_id(connection):
        _send_support_error(connection, msg["id"], "support_preview_expired")
        return
    rt.support_previews.pop(msg["token"], None)
    connection.send_result(msg["id"], {"ok": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/support/submit",
        vol.Required("message"): _support_string,
        vol.Optional("contact", default=""): _support_string,
        vol.Optional("preview_token"): _SUPPORT_TOKEN,
        vol.Required("idempotency_key"): _SUPPORT_ID,
    }
)
@websocket_api.async_response
async def ws_support_submit(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Submit text and, when selected, the exact previewed package bytes."""
    if not _check_write(hass, connection):
        _send_support_error(connection, msg["id"], "unauthorized")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    message = msg["message"].strip()
    contact = msg.get("contact", "").strip()
    if not message or len(message) > MAX_SUPPORT_MESSAGE_CODEPOINTS:
        _send_support_error(connection, msg["id"], "support_invalid_message")
        return
    if len(contact) > MAX_SUPPORT_CONTACT_CODEPOINTS:
        _send_support_error(connection, msg["id"], "support_rejected")
        return

    _prune_support_previews(rt)
    token = msg.get("preview_token")
    preview = rt.support_previews.get(token) if token else None
    if token and (preview is None or preview.get("owner") != _connection_user_id(connection)):
        _send_support_error(connection, msg["id"], "support_preview_expired")
        return
    if preview and not scope_readable(connection.user, preview.get("read_scope", ())):
        _send_support_error(connection, msg["id"], "unauthorized")
        return
    attachment = preview.get("bytes") if preview else None
    versions = preview.get("versions") if preview else {
        "card": VERSION,
        "integration": VERSION,
        "home_assistant": HA_VERSION,
        "model": PLAN_MODEL_VERSION,
        "export_schema": EXPORT_VERSION,
    }
    try:
        report_id = await async_submit_report(
            hass,
            message=message,
            contact=contact,
            versions=versions,
            idempotency_key=msg["idempotency_key"],
            attachment=attachment,
            attachment_sha256=preview.get("sha256") if preview else None,
        )
    except SupportTransportError as error:
        _send_support_error(connection, msg["id"], error.code)
        return
    if token:
        # Retry after a timeout keeps the token; only a confirmed delivery
        # consumes it. The relay's idempotency record handles uncertain first
        # attempts with the same frontend key.
        rt.support_previews.pop(token, None)
    connection.send_result(msg["id"], {"report_id": report_id})
