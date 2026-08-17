"""House Plan WS commands: layout, space configuration, plan uploads."""
from __future__ import annotations

import logging

import base64
import binascii
import json
import secrets
import time
from datetime import UTC, datetime
from functools import partial
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import (
    DOMAIN,
    CONF_ADMIN_ONLY, DEFAULT_CONFIG,
    CONTENT_URL, FILES_DIR, MAX_PLANS_BYTES, MAX_PLANS_FILES, MAX_PLANS_LISTED,
    MAX_SIGN_PATHS,
    PLANS_DIR, PLANS_URL,
)
from .auth import may_write
from .import_export import (
    ImportFailure,
    content_manifest,
    create_export,
    get_candidate,
    live_layout,
    prepare_apply,
    revalidate_candidate,
)
from .plans import (
    QuotaError, check_quota, collect_attachments, collect_plans, is_plan_file,
    plan_basename, plan_refs, reserve_filename,
)
from .store import (
    LAYOUT_STORE_CORE_KEYS,
    OPTIMIZE_BACKUP as _OPTIMIZE_BACKUP,
    OPTIMIZE_PENDING as _OPTIMIZE_PENDING,
    HouseplanData,
    async_save_config_state,
    async_save_layout_state,
    get_data,
    get_entry,
)
from .virtual_lights import (
    EVENT_VIRTUAL_LIGHT_UPDATED,
    async_toggle_virtual_light,
    async_virtual_light_snapshot,
)
from .registry_snapshot import import_registry_snapshot
from .validation import (
    CONFIG_SCHEMA, LAYOUT_SCHEMA, MAX_CONFIG_BYTES, MAX_PLAN_BYTES,
    PLAN_EXTENSIONS, POS_SCHEMA, MarkerControlError, sanitize_filename,
    validate_marker_controls, validate_marker_light_entities,
    validate_marker_value_badges, valid_space_id,
)


_LOGGER = logging.getLogger(__name__)

def _optimizer_backup_is_current(config_data: dict[str, Any], layout_data: dict[str, Any]) -> bool:
    """An optimization can be undone before any later ordinary plan edit."""
    backup = layout_data.get(_OPTIMIZE_BACKUP)
    if not isinstance(backup, dict):
        return False
    try:
        return (
            int(backup.get("after_config_rev", -1)) == int(config_data.get("rev", 0))
            and int(backup.get("after_layout_rev", -1)) == int(layout_data.get("rev", 0))
        )
    except (TypeError, ValueError):
        return False


def _optimizer_backup_after_layout_maintenance(
    layout_data: dict[str, Any], new_layout_rev: int,
) -> dict[str, Any]:
    """Carry a one-deep plan snapshot across explicit layout maintenance.

    Geometry repair is part of plan maintenance, not an ordinary user edit:
    losing the Optimize/Import undo there makes the advertised safety net
    disappear.  The snapshot must also follow the new layout revision or the
    freshness guard will correctly, but unhelpfully, classify it as stale.
    """
    backup = layout_data.get(_OPTIMIZE_BACKUP)
    if not isinstance(backup, dict):
        return {}
    return {
        _OPTIMIZE_BACKUP: {
            **backup,
            "after_layout_rev": new_layout_rev,
        }
    }


def _undo_kind(config_data: dict[str, Any], layout_data: dict[str, Any]) -> str | None:
    if not _optimizer_backup_is_current(config_data, layout_data):
        return None
    backup = layout_data.get(_OPTIMIZE_BACKUP)
    return str(backup.get("kind") or "optimize") if isinstance(backup, dict) else None


async def _discard_optimizer_snapshot(rt: HouseplanData) -> None:
    """Free a snapshot made stale by a later ordinary config edit."""
    data = await rt.store.async_load() or {}
    if _OPTIMIZE_BACKUP not in data and _OPTIMIZE_PENDING not in data:
        return
    await async_save_layout_state(
        rt,
        data,
        data.get("layout") or {},
        int(data.get("rev", 0)),
        remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING),
    )


@callback
def async_register(hass: HomeAssistant) -> None:
    """Register the WS commands."""
    websocket_api.async_register_command(hass, ws_layout_get)
    websocket_api.async_register_command(hass, ws_trail_get)
    websocket_api.async_register_command(hass, ws_trail_delete)
    websocket_api.async_register_command(hass, ws_layout_set)
    websocket_api.async_register_command(hass, ws_geometry_repair)
    websocket_api.async_register_command(hass, ws_layout_update)
    websocket_api.async_register_command(hass, ws_layout_delete)
    websocket_api.async_register_command(hass, ws_config_get)
    websocket_api.async_register_command(hass, ws_virtual_light_toggle)
    websocket_api.async_register_command(hass, ws_config_set)
    websocket_api.async_register_command(hass, ws_plan_optimize)
    websocket_api.async_register_command(hass, ws_plan_optimize_undo)
    websocket_api.async_register_command(hass, ws_plan_set)
    websocket_api.async_register_command(hass, ws_plans_list)
    websocket_api.async_register_command(hass, ws_plans_delete)
    websocket_api.async_register_command(hass, ws_files_migrate)
    websocket_api.async_register_command(hass, ws_files_cleanup)
    websocket_api.async_register_command(hass, ws_content_sign)
    websocket_api.async_register_command(hass, ws_export_create)
    websocket_api.async_register_command(hass, ws_import_revalidate)
    websocket_api.async_register_command(hass, ws_import_apply)


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


def _check_write(hass: HomeAssistant, connection) -> bool:
    """May this connection write? Thin wrapper over the shared policy."""
    return may_write(hass, getattr(connection, "user", None))


def _connection_user_id(connection) -> str:
    return str(getattr(getattr(connection, "user", None), "id", ""))


def _send_import_error(connection, msg_id: int, err: ImportFailure) -> None:
    connection.send_error(msg_id, err.code, err.message)


def _layout_metadata(stored: dict[str, Any]) -> dict[str, Any]:
    """Return the exact non-layout portion of a layout-store document."""
    return {
        key: value for key, value in stored.items()
        if key not in LAYOUT_STORE_CORE_KEYS
    }


async def _persist_pair_intent(
    rt: HouseplanData,
    pending: dict[str, Any],
) -> None:
    """Make a target pair recoverable before either visible half moves."""
    stored = await rt.store.async_load() or {}
    metadata = dict(pending.get("final_metadata") or {})
    metadata[_OPTIMIZE_PENDING] = pending
    await async_save_layout_state(
        rt,
        stored,
        stored.get("layout") or {},
        int(stored.get("rev", 0)),
        metadata=metadata,
        replace_metadata=True,
    )


async def _converge_pair(rt: HouseplanData, pending: dict[str, Any]) -> None:
    """Write both target halves and remove the durable intent last."""
    await async_save_config_state(
        rt,
        pending["config"],
        int(pending["config_rev"]),
    )
    stored = await rt.store.async_load() or {}
    await async_save_layout_state(
        rt,
        stored,
        pending["layout"],
        int(pending["layout_rev"]),
        metadata=dict(pending.get("final_metadata") or {}),
        replace_metadata=True,
    )


async def _commit_import_pair(
    rt: HouseplanData,
    pending: dict[str, Any],
    rollback: dict[str, Any],
) -> None:
    """Commit, retry once, or restore the before-pair before returning.

    A Store write may raise after the bytes reached disk, so recovery always
    reloads and converges an explicit pair instead of guessing which half won.
    If the target cannot be completed, a rollback intent replaces it before we
    restore the old pair; setup will therefore restore, never unexpectedly
    finish an import that was reported as failed.
    """
    try:
        await _persist_pair_intent(rt, pending)
        await _converge_pair(rt, pending)
        return
    except Exception:  # noqa: BLE001 - one retry handles fail-after-write too
        _LOGGER.warning("House Plan import pair write failed; retrying target", exc_info=True)
    try:
        await _persist_pair_intent(rt, pending)
        await _converge_pair(rt, pending)
        return
    except Exception:  # noqa: BLE001 - target is no longer the recovery policy
        _LOGGER.exception("House Plan import target retry failed; restoring previous pair")
    try:
        await _persist_pair_intent(rt, rollback)
        await _converge_pair(rt, rollback)
    except Exception as rollback_error:  # noqa: BLE001
        _LOGGER.exception(
            "House Plan import rollback could not finish; rollback intent remains for setup"
        )
        raise ImportFailure(
            "commit_failed", "Import failed; the previous plan is pending recovery"
        ) from rollback_error
    raise ImportFailure("commit_failed", "Import failed and the previous plan was restored")


# ---------------- portable backup / transfer ----------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/export/create",
        vol.Required("kind"): vol.In(["full", "space"]),
        vol.Optional("space_id"): str,
        vol.Optional("plan_only", default=False): bool,
        vol.Optional("card_version", default=""): str,
    }
)
@websocket_api.async_response
async def ws_export_create(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Build a consistent full or one-space JSON snapshot."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only editors may export House Plan")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    try:
        async with rt.write_lock:
            config_data = await rt.config_store.async_load() or {}
            layout_data = await rt.store.async_load() or {}
            document, filename = await hass.async_add_executor_job(
                partial(
                    create_export,
                    rt,
                    config_data,
                    layout_data,
                    kind=msg["kind"],
                    space_id=msg.get("space_id"),
                    plan_only=msg.get("plan_only", False),
                    card_version=msg.get("card_version", ""),
                    config_root=Path(hass.config.path("")),
                )
            )
    except ImportFailure as err:
        _send_import_error(connection, msg["id"], err)
        return
    except Exception:  # noqa: BLE001
        _LOGGER.exception("House Plan export failed")
        connection.send_error(msg["id"], "invalid_config", "Could not create export")
        return
    connection.send_result(msg["id"], {"document": document, "filename": filename})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/import/revalidate",
        vol.Required("token"): str,
        vol.Optional("duplicate_policy", default="skip"): vol.In(["skip", "virtual"]),
    }
)
@websocket_api.async_response
async def ws_import_revalidate(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Re-evaluate a space candidate after its duplicate policy changes."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only editors may import House Plan")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    try:
        async with rt.write_lock:
            candidate = get_candidate(rt, msg["token"], _connection_user_id(connection))
            config_data = await rt.config_store.async_load() or {}
            layout_data = await rt.store.async_load() or {}
            try:
                registry_snapshot = import_registry_snapshot(hass)
            except Exception:  # noqa: BLE001 - summary must not block revalidation
                _LOGGER.debug("House Plan import registry summary unavailable", exc_info=True)
                registry_snapshot = None
            result = await hass.async_add_executor_job(
                partial(
                    revalidate_candidate,
                    candidate,
                    config_data,
                    layout_data,
                    duplicate_policy=msg["duplicate_policy"],
                    registry_snapshot=registry_snapshot,
                    config_root=Path(hass.config.path("")),
                )
            )
            result["token"] = msg["token"]
            result["expires_at"] = datetime.fromtimestamp(
                candidate["expires"], UTC
            ).isoformat().replace("+00:00", "Z")
    except ImportFailure as err:
        _send_import_error(connection, msg["id"], err)
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/import/apply",
        vol.Required("token"): str,
        vol.Required("expected_config_rev"): int,
        vol.Required("expected_layout_rev"): int,
        vol.Optional("duplicate_policy"): vol.In(["skip", "virtual"]),
        vol.Optional("confirm_missing_content", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_import_apply(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Commit exactly the previewed candidate as one crash-resumable pair."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only editors may import House Plan")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    kind = ""
    details: dict[str, Any] = {}
    try:
        async with rt.write_lock:
            candidate = get_candidate(rt, msg["token"], _connection_user_id(connection))
            config_data = await rt.config_store.async_load() or {}
            layout_data = await rt.store.async_load() or {}
            config_rev = int(config_data.get("rev", 0))
            layout_rev = int(layout_data.get("rev", 0))
            if (
                msg["expected_config_rev"] != config_rev
                or msg["expected_layout_rev"] != layout_rev
                or candidate.get("config_rev") != config_rev
                or candidate.get("layout_rev") != layout_rev
            ):
                raise ImportFailure("conflict", "Plan changed after the preview")
            kind = str(candidate["document"]["kind"])
            requested_policy = msg.get("duplicate_policy", candidate.get("duplicate_policy"))
            if kind == "space" and requested_policy != candidate.get("duplicate_policy"):
                raise ImportFailure("conflict", "Duplicate policy changed after the preview")
            target_config, target_layout, details = await hass.async_add_executor_job(
                partial(
                    prepare_apply,
                    candidate,
                    config_data.get("config") or {"spaces": [], "markers": [], "settings": {}},
                    layout_data.get("layout") or {},
                    duplicate_policy=candidate.get("duplicate_policy"),
                    confirm_missing_content=msg["confirm_missing_content"],
                )
            )
            missing = await hass.async_add_executor_job(
                _missing_internal_plans,
                Path(hass.config.path(PLANS_DIR)),
                target_config,
                config_data.get("config"),
            )
            if missing:
                raise ImportFailure(
                    "missing_plan",
                    "Plan file no longer exists: " + ", ".join(sorted(missing)),
                )
            missing_attachments = _missing_internal_attachments(
                Path(hass.config.path("")), target_config, config_data.get("config")
            )
            if missing_attachments:
                raise ImportFailure(
                    "missing_content",
                    "Attachment no longer exists: " + ", ".join(sorted(missing_attachments)),
                )
            new_config_rev = config_rev + 1
            new_layout_rev = layout_rev + 1
            backup = None
            if kind == "full":
                backup = {
                    "kind": "import",
                    "config": config_data.get("config") or DEFAULT_CONFIG,
                    "layout": layout_data.get("layout") or {},
                    "created": int(time.time()),
                    "after_config_rev": new_config_rev,
                    "after_layout_rev": new_layout_rev,
                }
            original_metadata = _layout_metadata(layout_data)
            replaced_metadata = {_OPTIMIZE_PENDING, _OPTIMIZE_BACKUP}
            if kind == "full":
                replaced_metadata.update({"repair_backup", "geom_pending"})
            final_metadata = {
                key: value for key, value in original_metadata.items()
                if key not in replaced_metadata
            }
            if backup is not None:
                final_metadata[_OPTIMIZE_BACKUP] = backup
            pending = {
                "kind": "import",
                "config": target_config,
                "layout": target_layout,
                "config_rev": new_config_rev,
                "layout_rev": new_layout_rev,
                "final_metadata": final_metadata,
            }
            rollback = {
                "kind": "import_rollback",
                "config": config_data.get("config") or DEFAULT_CONFIG,
                "layout": layout_data.get("layout") or {},
                "config_rev": config_rev,
                "layout_rev": layout_rev,
                "final_metadata": original_metadata,
            }
            await _commit_import_pair(rt, pending, rollback)
            # A token becomes single-use only after both durable halves land.
            get_candidate(rt, msg["token"], _connection_user_id(connection), consume=True)
    except ImportFailure as err:
        _send_import_error(connection, msg["id"], err)
        return
    except Exception:  # noqa: BLE001
        _LOGGER.exception("House Plan import commit failed")
        connection.send_error(msg["id"], "commit_failed", "Import commit failed")
        return

    hass.bus.async_fire("houseplan_config_updated", {"rev": new_config_rev})
    hass.bus.async_fire("houseplan_layout_updated", {"rev": new_layout_rev})
    _refresh_trail_recorder(hass)
    if kind == "full":
        recorder = hass.data.get(DOMAIN, {}).get("trail_recorder")
        live_marker_ids = {
            str(marker.get("id")) for marker in target_config.get("markers") or []
        }
        if recorder is not None:
            for marker_id in list(getattr(getattr(recorder, "book", None), "data", {})):
                if marker_id not in live_marker_ids:
                    try:
                        await recorder.async_delete(marker_id)
                    except Exception:  # noqa: BLE001
                        _LOGGER.exception("House Plan: removing orphan import trail failed")
        entry = get_entry(hass)
        if entry is not None:
            from .repairs import async_check_plan_files

            hass.async_create_task(async_check_plan_files(hass, entry))
    connection.send_result(msg["id"], {
        "ok": True,
        "kind": kind,
        "config_rev": new_config_rev,
        "layout_rev": new_layout_rev,
        "counts": details.get("counts", {}),
        "space_id": details.get("space_id"),
        "can_undo": kind == "full",
    })


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


@websocket_api.websocket_command({vol.Required("type"): "houseplan/layout/get"})
@websocket_api.async_response
async def ws_layout_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Return the saved layout."""
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    data = await rt.store.async_load() or {}
    config_data = await rt.config_store.async_load() or {}
    connection.send_result(
        msg["id"], {
            "layout": data.get("layout", {}),
            "rev": int(data.get("rev", 0)),
            "can_optimize_undo": _optimizer_backup_is_current(config_data, data),
            "undo_kind": _undo_kind(config_data, data),
        }
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/layout/set",
        vol.Required("layout"): LAYOUT_SCHEMA,
        vol.Optional("expected_rev"): int,
    }
)
@websocket_api.async_response
async def ws_layout_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Replace the layout entirely, with optimistic locking (audit B3).

    Wholesale layout writes used to have no revision check at all, so two
    clients silently overwrote each other. `expected_rev` is optional for
    backwards compatibility with older cards, but when supplied it is enforced
    exactly like the config store does.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit the layout")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    async with rt.write_lock:
        config_data = await rt.config_store.async_load() or {}
        data = await rt.store.async_load() or {}
        current_rev = int(data.get("rev", 0))
        if "expected_rev" in msg and msg["expected_rev"] != current_rev:
            connection.send_error(
                msg["id"], "conflict", f"Layout changed elsewhere (rev {current_rev})"
            )
            return
        layout = _live_layout(config_data.get("config") or {}, msg["layout"])
        new_rev = current_rev + 1
        await async_save_layout_state(
            rt, data, layout, new_rev,
            remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING),
        )
    hass.bus.async_fire("houseplan_layout_updated", {"rev": new_rev})
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev})


@websocket_api.websocket_command(
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
        config_data = await rt.config_store.async_load() or {}
        config = config_data.get("config") or {}
        markers = config.get("markers") or []
        deleted = any(
            str(m.get("id")) == msg["device_id"] and m.get("removed") is True
            for m in markers
        )
        live_virtual = any(
            str(m.get("id")) == msg["device_id"] and m.get("removed") is not True
            and m.get("binding") == "virtual"
            for m in markers
        )
        live_explicit = any(
            str(m.get("id")) == msg["device_id"] and m.get("removed") is not True
            for m in markers
        )
        orphan_virtual = (
            msg["device_id"].startswith("v_")
            and not live_virtual
            and not live_explicit
        )
        if deleted or orphan_virtual:
            data = await rt.store.async_load() or {}
            connection.send_result(msg["id"], {
                "ok": True,
                "ignored": "removed" if deleted else "missing_virtual",
                "rev": int(data.get("rev", 0)),
            })
            return
        data = await rt.store.async_load() or {}
        layout = data.get("layout", {})
        layout[msg["device_id"]] = msg["pos"]
        # keep the revision: a point-wise write used to drop it, which made the
        # optimistic locking on layout/set meaningless — every drag reset the
        # counter to 0 (HP-1454-08)
        new_rev = int(data.get("rev", 0)) + 1
        await async_save_layout_state(
            rt, data, layout, new_rev,
            remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING),
        )
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
    """Re-apply the square-canvas transform to ONE space's layout, explicitly.

    For installations that hit the v1.48/v1.49 crash window: the config write
    of the migration landed, the layout write did not, and the trigger fields
    were already gone — markers and labels of that space are stranded in the
    old coordinates with nothing able to tell (HP-1500-01). Nothing can be
    detected reliably after the fact, and re-running a transform on a layout
    that is already correct would corrupt it, so this NEVER runs by itself:
    an administrator names the space and its old aspect, may preview with
    `dry_run`, and gets a one-deep backup written in the same store write —
    `undo` restores it.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may repair the layout")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    from .geometry_migration import migrate_layout

    space_id = msg["space_id"]
    if not valid_space_id(space_id):
        connection.send_error(msg["id"], "invalid_space_id", "space_id: only [a-z0-9_-], up to 64 characters")
        return
    async with rt.write_lock:
        data = await rt.store.async_load() or {}
        layout = data.get("layout") or {}
        current_rev = int(data.get("rev", 0))
        if "expected_rev" in msg and msg["expected_rev"] != current_rev:
            connection.send_error(
                msg["id"], "conflict",
                f"Layout was changed in another window (rev {current_rev} != {msg['expected_rev']})",
            )
            return
        if msg.get("undo"):
            backup = data.get("repair_backup")
            if not isinstance(backup, dict) or backup.get("space") != space_id:
                connection.send_error(msg["id"], "no_backup", "No repair backup stored for this space")
                return
            restored = dict(layout)
            for key, pos in (backup.get("positions") or {}).items():
                restored[key] = pos
            new_rev = current_rev + 1
            await async_save_layout_state(
                rt, data, restored, new_rev,
                metadata=_optimizer_backup_after_layout_maintenance(data, new_rev),
                remove=("repair_backup",),
            )
            hass.bus.async_fire("houseplan_layout_updated", {"rev": new_rev})
            connection.send_result(msg["id"], {"ok": True, "rev": new_rev,
                                               "restored": len(backup.get("positions") or {})})
            return
        touched = {
            k: dict(v) for k, v in layout.items()
            if isinstance(v, dict) and str(v.get("s")) == space_id
        }
        if not touched:
            # A typo'd space id used to "succeed" with moved: 0 — and its
            # empty result REPLACED the one-deep backup, destroying the very
            # undo this endpoint promises (HP-1501-02). Nothing to move means
            # nothing to save: no write, no revision bump, the backup stays.
            connection.send_error(
                msg["id"], "nothing_to_repair",
                f"No stored positions belong to space '{space_id}'",
            )
            return
        preview = {k: dict(v) for k, v in touched.items()}
        migrate_layout(preview, {space_id: msg["aspect"]})
        if msg.get("dry_run"):
            connection.send_result(msg["id"], {
                "ok": True, "dry_run": True, "moved": len(preview),
                "before": touched, "after": preview,
            })
            return
        new_layout = {**layout, **preview}
        new_rev = current_rev + 1
        # the backup rides the same store write: either both are durable or
        # neither — the deletion-shy rules of this project apply to positions
        # too
        await async_save_layout_state(
            rt, data, new_layout, new_rev,
            metadata={
                **_optimizer_backup_after_layout_maintenance(data, new_rev),
                "repair_backup": {"space": space_id, "positions": touched},
            },
            remove=("repair_backup",),
        )
    hass.bus.async_fire("houseplan_layout_updated", {"rev": new_rev})
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev, "moved": len(preview)})


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
        mapping = await hass.async_add_executor_job(_copy)
    except OSError as err:
        connection.send_error(msg["id"], "io_error", f"Could not copy marker files: {err}")
        return
    connection.send_result(msg["id"], {"ok": True, "mapping": mapping, "copied": len(mapping)})


@websocket_api.websocket_command({vol.Required("type"): "houseplan/plans/list"})
@websocket_api.async_response
async def ws_plans_list(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Plan images on the server, with what still uses them.

    Files are never removed for being unreferenced (docs/SCOPE.md), which only
    works as a policy if the user can see them: detaching a plan keeps the
    image, and this is how it gets picked up again — or deleted on purpose.
    """
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    stored = await rt.config_store.async_load() or {}
    cfg = stored.get("config") or {}
    used: dict[str, list[str]] = {}
    for space in cfg.get("spaces") or []:
        name = plan_basename(space.get("plan_url"))
        if name:
            used.setdefault(name, []).append(space.get("title") or space.get("id") or "?")

    plans_dir = Path(hass.config.path(PLANS_DIR))

    def _scan() -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        if not plans_dir.is_dir():
            return out
        for item in sorted(plans_dir.iterdir()):
            if not item.is_file() or not is_plan_file(item.name):
                continue
            try:
                st = item.stat()
            except OSError:
                continue
            out.append({
                "name": item.name,
                "url": f"{CONTENT_URL}/plans/_/{item.name}",
                "size": st.st_size,
                "modified": int(st.st_mtime),
                "used_by": used.get(item.name, []),
            })
        out.sort(key=lambda x: -x["modified"])
        return out

    plans = await hass.async_add_executor_job(_scan)
    # newest first and capped: a folder with thousands of files would otherwise
    # become one huge message, one huge list and a signing request per row
    connection.send_result(
        msg["id"], {"plans": plans[:MAX_PLANS_LISTED], "total": len(plans)}
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/plans/delete",
        vol.Required("name"): str,
    }
)
@websocket_api.async_response
async def ws_plans_delete(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Delete a plan image because the user asked — the only way one goes.

    Refuses while a space still references it: the answer to "can I delete this"
    is the stored configuration's, not the client's.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may delete plans")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    name = sanitize_filename(msg["name"])
    if not is_plan_file(name):
        connection.send_error(msg["id"], "invalid_name", "Not a plan file")
        return

    async with rt.write_lock:
        stored = await rt.config_store.async_load() or {}
        cfg = stored.get("config") or {}
        if name in plan_refs(cfg):
            connection.send_error(
                msg["id"], "in_use", "A space still uses this plan — detach it first"
            )
            return
        path = Path(hass.config.path(PLANS_DIR)) / name

        def _rm() -> bool:
            try:
                path.unlink()
                return True
            except FileNotFoundError:
                return False
            except OSError as err:
                _LOGGER.warning("House Plan: could not delete %s: %s", path, err)
                return False

        removed = await hass.async_add_executor_job(_rm)
    connection.send_result(msg["id"], {"ok": True, "removed": removed})


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
    from .const import FILES_DIR
    from .plans import attachment_refs
    from .validation import sanitize_marker_id

    mid = sanitize_marker_id(msg["marker_id"])
    base = Path(hass.config.path(FILES_DIR)).resolve()
    target = (base / mid).resolve() if mid else base
    if not mid or not str(target).startswith(str(base)) or target == base:
        connection.send_result(msg["id"], {"ok": True, "removed": 0, "kept": 0})
        return

    async with rt.write_lock:
        stored = await rt.config_store.async_load() or {}
        refs = attachment_refs(stored.get("config") or {})

        def _rm() -> tuple[int, int]:
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
            return removed, kept

        removed, kept = await hass.async_add_executor_job(_rm)
    if kept:
        _LOGGER.info(
            "House Plan: kept %s file(s) in %s — the configuration still references them", kept, mid
        )
    connection.send_result(msg["id"], {"ok": True, "removed": removed, "kept": kept})


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
        data = await rt.store.async_load() or {}
        layout = data.get("layout", {})
        if msg["device_id"] in layout:
            del layout[msg["device_id"]]
            new_rev = int(data.get("rev", 0)) + 1
            await async_save_layout_state(
                rt, data, layout, new_rev,
                remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING),
            )
    if new_rev is not None:
        hass.bus.async_fire("houseplan_layout_updated", {"rev": new_rev})
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev})


# ---------------- space configuration ----------------


@websocket_api.websocket_command({vol.Required("type"): "houseplan/config/get"})
@websocket_api.async_response
async def ws_config_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Return the configuration, its revision, and whether this user may write.

    `can_write` is the single source of truth for the card's editor chrome
    (audit P0-4): the UI must mirror `may_write`, not a hard-coded is_admin
    check that drifted from the integration option.
    """
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    async with rt.write_lock:
        data = await rt.config_store.async_load() or {}
        layout_data = await rt.store.async_load() or {}
        config = {**DEFAULT_CONFIG, **data.get("config", {})}
        config_rev = int(data.get("rev", 0))
        try:
            virtual_lights = await async_virtual_light_snapshot(
                rt.virtual_light_store,
                config,
                config_rev,
            )
        except Exception:  # noqa: BLE001 - config remains independently readable
            _LOGGER.exception("House Plan: reading virtual-light state failed")
            # Never expose a stale off bit after an unreadable/revision-gap
            # operational store. Compatibility/default on is the safe frame.
            virtual_lights = {"rev": 0, "config_rev": config_rev, "off": []}
    connection.send_result(
        msg["id"],
        {
            "config": config,
            "rev": config_rev,
            "virtual_lights": virtual_lights,
            "can_write": may_write(hass, getattr(connection, "user", None)),
            "can_optimize_undo": _optimizer_backup_is_current(data, layout_data),
            "undo_kind": _undo_kind(data, layout_data),
        },
    )


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
        data = await rt.config_store.async_load() or {}
        config = {**DEFAULT_CONFIG, **data.get("config", {})}
        result = await async_toggle_virtual_light(
            rt.virtual_light_store,
            config,
            int(data.get("rev", 0)),
            msg["marker_id"],
        )
        if result is None:
            connection.send_error(
                msg["id"],
                "not_toggleable",
                "Marker is not an active virtual light with tap_action=toggle",
            )
            return
    # Both the reply and event follow the durable Store write.  There is no
    # optimistic client state, so all cards converge on this revision.
    connection.send_result(msg["id"], result)
    hass.bus.async_fire(EVENT_VIRTUAL_LIGHT_UPDATED, result)



def _internal_plan_names(config: dict[str, Any]) -> set[str]:
    """Plan file names a configuration names through OUR urls.

    Only `/api/houseplan/content/plans/_/<name>` and the legacy static path
    count. Anything else belongs to the user and may point wherever they like.
    """
    out: set[str] = set()
    for space in (config or {}).get("spaces") or []:
        url = space.get("plan_url")
        if not isinstance(url, str) or not url:
            continue
        if not (url.startswith(CONTENT_URL + "/plans/") or url.startswith(PLANS_URL + "/")):
            continue
        name = plan_basename(url)
        if name:
            out.add(name)
    return out


def _missing_internal_plans(
    plans_dir: Path, config: dict[str, Any], previous: dict[str, Any] | None = None
) -> set[str]:
    """Newly named plan files that are not on disk.

    Guards the pick-then-save window: another client may delete a plan between
    the moment this one chose it and the moment it saves, which would otherwise
    store a url with nothing behind it (HP-1470-02).

    A name the stored configuration already carries is deliberately let through.
    It is already broken — repairs says so — and refusing the write would lock
    the owner out of every other edit, including the one that detaches it.
    """
    known = _internal_plan_names(previous or {})
    return {
        name
        for name in _internal_plan_names(config)
        if name not in known and not (plans_dir / name).is_file()
    }


def _missing_internal_attachments(
    config_root: Path, config: dict[str, Any], previous: dict[str, Any] | None = None
) -> set[str]:
    """New local attachments that vanished between import preview and apply.

    Existing broken references stay writable for the same reason as historical
    plan URLs: refusing every unrelated write would prevent the user from
    detaching or repairing them.
    """
    known = {
        str(item["url"])
        for item in content_manifest(previous or {}, config_root)
        if item.get("kind") == "attachment" and item.get("storage") == "internal"
    }
    return {
        str(item["url"])
        for item in content_manifest(config, config_root)
        if item.get("kind") == "attachment"
        and item.get("storage") == "internal"
        and item.get("exists_at_export") is False
        and str(item["url"]) not in known
    }


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/config/set",
        vol.Required("config"): CONFIG_SCHEMA,
        vol.Optional("expected_rev"): int,
    }
)
@websocket_api.async_response
async def ws_config_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Replace the configuration with optimistic locking (expected_rev).

    Protects against races between several open clients: if the config has changed since
    the client's last read — a conflict error is returned, and the client must
    re-read the config and re-apply its edit on top of the fresh version.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit the configuration")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    # Per-field limits bound each list; this bounds their product (HP-1454-05).
    # Everything below the caps can still add up to something no dashboard can
    # render, and the store writes it to disk on every save.
    size = len(json.dumps(msg["config"], separators=(",", ":")))
    if size > MAX_CONFIG_BYTES:
        connection.send_error(
            msg["id"], "too_large",
            f"Configuration is {size // 1024} KB, the limit is {MAX_CONFIG_BYTES // 1024} KB",
        )
        return
    async with rt.write_lock:
        data = await rt.config_store.async_load() or {}
        current_rev = data.get("rev", 0)
        if "expected_rev" not in msg and current_rev:
            # audit B4: expected_rev stays optional for old cards mid-upgrade,
            # but a blind overwrite of a non-empty store is worth a warning —
            # it is exactly how a stale client silently discards someone's work.
            _LOGGER.warning(
                "House Plan: config/set without expected_rev over rev %s — "
                "the client bypasses conflict detection (outdated card?)",
                current_rev,
            )
        if "expected_rev" in msg and msg["expected_rev"] != current_rev:
            connection.send_error(
                msg["id"], "conflict",
                f"Configuration was changed in another window (rev {current_rev} != {msg['expected_rev']})",
            )
            return
        # Marker-to-marker light links are a semantic graph layered on top of
        # the lossless controls array. Validate only edges introduced by this
        # write so an unrelated edit can still round-trip a legacy broken ref.
        try:
            validate_marker_controls(msg["config"], data.get("config"))
            validate_marker_light_entities(msg["config"], data.get("config"))
            validate_marker_value_badges(msg["config"], data.get("config"))
        except MarkerControlError as err:
            connection.send_error(msg["id"], err.code, str(err))
            return
        # An internal plan url must name a file that exists. The card can pick a
        # plan and then delete it from the same dialog, and two clients can do
        # the same thing in either order — the lock serialises them but says
        # nothing about whether the file survived (HP-1470-02). External and
        # legacy urls are not ours to check and are left alone.
        missing = await hass.async_add_executor_job(
            _missing_internal_plans,
            Path(hass.config.path(PLANS_DIR)),
            msg["config"],
            data.get("config"),
        )
        if missing:
            connection.send_error(
                msg["id"], "missing_plan",
                "Plan file no longer exists: " + ", ".join(sorted(missing)),
            )
            return
        new_rev = current_rev + 1
        await async_save_config_state(
            rt,
            msg["config"],
            new_rev,
            previous_rev=int(current_rev),
        )
        try:
            await _discard_optimizer_snapshot(rt)
        except Exception:  # noqa: BLE001 — stale backup cleanup is best-effort
            _LOGGER.exception("House Plan: discarding stale optimization backup failed")
        # Still holding the lock: the file system is not part of the store's
        # transaction, so collection has to be pinned to this commit (R3-1).
        # It is best-effort housekeeping behind an already durable write — a
        # failure here must not withhold the event and the success response,
        # or the client retries an edit the server has already accepted and
        # gets a conflict for its trouble (R4-1).
        def _collect() -> None:
            collect_plans(Path(hass.config.path(PLANS_DIR)), data.get("config"), msg["config"])
            collect_attachments(Path(hass.config.path(FILES_DIR)), data.get("config"), msg["config"])

        try:
            await hass.async_add_executor_job(_collect)
        except Exception:  # noqa: BLE001 — see above: the commit stands regardless
            _LOGGER.exception("House Plan: collecting superseded files failed")
    hass.bus.async_fire("houseplan_config_updated", {"rev": new_rev})
    _refresh_trail_recorder(hass)
    # refresh repair issues (broken plan references) without waiting for a restart
    entry = get_entry(hass)
    if entry is not None:
        from .repairs import async_check_plan_files

        hass.async_create_task(async_check_plan_files(hass, entry))
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev})


# ---------------- whole-plan maintenance ----------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/plan/optimize",
        vol.Required("config"): CONFIG_SCHEMA,
        vol.Required("layout"): LAYOUT_SCHEMA,
        vol.Required("expected_config_rev"): int,
        vol.Required("expected_layout_rev"): int,
    }
)
@websocket_api.async_response
async def ws_plan_optimize(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Atomically-intended replacement of config+layout with one-deep undo.

    Home Assistant stores are separate files, so a literal cross-file
    transaction is impossible. Persisting the target as an intent before
    either half changes makes a crash resumable during the next setup; the UI
    only receives success once both halves are durable.
    """
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may optimize plans")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    size = len(json.dumps(msg["config"], separators=(",", ":")))
    if size > MAX_CONFIG_BYTES:
        connection.send_error(
            msg["id"], "too_large",
            f"Configuration is {size // 1024} KB, the limit is {MAX_CONFIG_BYTES // 1024} KB",
        )
        return

    async with rt.write_lock:
        config_data = await rt.config_store.async_load() or {}
        layout_data = await rt.store.async_load() or {}
        config_rev = int(config_data.get("rev", 0))
        layout_rev = int(layout_data.get("rev", 0))
        if msg["expected_config_rev"] != config_rev or msg["expected_layout_rev"] != layout_rev:
            connection.send_error(
                msg["id"], "conflict",
                f"Plan changed elsewhere (config {config_rev}, layout {layout_rev})",
            )
            return

        # Optimization is a normal configuration write with an additional
        # layout transaction. It must enforce the same marker-link semantics
        # as config/set; otherwise a crafted client can persist a new cycle.
        try:
            validate_marker_controls(msg["config"], config_data.get("config"))
            validate_marker_light_entities(msg["config"], config_data.get("config"))
            validate_marker_value_badges(msg["config"], config_data.get("config"))
        except MarkerControlError as err:
            connection.send_error(msg["id"], err.code, str(err))
            return

        missing = await hass.async_add_executor_job(
            _missing_internal_plans,
            Path(hass.config.path(PLANS_DIR)),
            msg["config"],
            config_data.get("config"),
        )
        if missing:
            connection.send_error(
                msg["id"], "missing_plan",
                "Plan file no longer exists: " + ", ".join(sorted(missing)),
            )
            return

        new_config_rev = config_rev + 1
        new_layout_rev = layout_rev + 1
        backup = {
            "kind": "optimize",
            "config": config_data.get("config") or DEFAULT_CONFIG,
            "layout": layout_data.get("layout", {}),
            "created": int(time.time()),
            "after_config_rev": new_config_rev,
            "after_layout_rev": new_layout_rev,
        }
        pending = {
            "config": msg["config"],
            "layout": msg["layout"],
            "config_rev": new_config_rev,
            "layout_rev": new_layout_rev,
            "clear_backup": False,
        }
        # Intent first. A setup-time finisher completes whichever half a crash
        # interrupted; until then the visible layout/revision remain unchanged.
        await async_save_layout_state(
            rt, layout_data, layout_data.get("layout", {}), layout_rev,
            metadata={_OPTIMIZE_BACKUP: backup, _OPTIMIZE_PENDING: pending},
            remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING),
        )
        await async_save_config_state(
            rt,
            msg["config"],
            new_config_rev,
            previous_rev=config_rev,
        )
        await async_save_layout_state(
            rt, layout_data, msg["layout"], new_layout_rev,
            metadata={_OPTIMIZE_BACKUP: backup},
            remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING, "repair_backup", "geom_pending"),
        )

    hass.bus.async_fire("houseplan_config_updated", {"rev": new_config_rev})
    hass.bus.async_fire("houseplan_layout_updated", {"rev": new_layout_rev})
    _refresh_trail_recorder(hass)
    connection.send_result(msg["id"], {
        "ok": True,
        "config_rev": new_config_rev,
        "layout_rev": new_layout_rev,
        "can_undo": True,
    })


@websocket_api.websocket_command(
    {
        vol.Required("type"): "houseplan/plan/optimize_undo",
        vol.Required("expected_config_rev"): int,
        vol.Required("expected_layout_rev"): int,
    }
)
@websocket_api.async_response
async def ws_plan_optimize_undo(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Restore the snapshot, but never overwrite edits made after optimization."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may undo optimization")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return

    restored_kind = "optimize"
    async with rt.write_lock:
        config_data = await rt.config_store.async_load() or {}
        layout_data = await rt.store.async_load() or {}
        config_rev = int(config_data.get("rev", 0))
        layout_rev = int(layout_data.get("rev", 0))
        if msg["expected_config_rev"] != config_rev or msg["expected_layout_rev"] != layout_rev:
            connection.send_error(msg["id"], "conflict", "Plan changed elsewhere")
            return
        if not _optimizer_backup_is_current(config_data, layout_data):
            connection.send_error(
                msg["id"], "no_backup",
                "The optimization backup is unavailable or a later edit made it stale",
            )
            return

        backup = layout_data[_OPTIMIZE_BACKUP]
        restored_kind = str(backup.get("kind") or "optimize")
        restored_config = backup.get("config") or DEFAULT_CONFIG
        restored_layout = backup.get("layout") or {}
        new_config_rev = config_rev + 1
        new_layout_rev = layout_rev + 1
        pending = {
            "kind": "import_undo" if restored_kind == "import" else "optimize_undo",
            "config": restored_config,
            "layout": restored_layout,
            "config_rev": new_config_rev,
            "layout_rev": new_layout_rev,
            "clear_backup": True,
        }
        await async_save_layout_state(
            rt, layout_data, layout_data.get("layout", {}), layout_rev,
            metadata={_OPTIMIZE_BACKUP: backup, _OPTIMIZE_PENDING: pending},
            remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING),
        )
        await async_save_config_state(
            rt,
            restored_config,
            new_config_rev,
            previous_rev=config_rev,
        )
        await async_save_layout_state(
            rt, layout_data, restored_layout, new_layout_rev,
            remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING, "repair_backup"),
        )

    hass.bus.async_fire("houseplan_config_updated", {"rev": new_config_rev})
    hass.bus.async_fire("houseplan_layout_updated", {"rev": new_layout_rev})
    _refresh_trail_recorder(hass)
    if restored_kind == "import":
        recorder = hass.data.get(DOMAIN, {}).get("trail_recorder")
        live_marker_ids = {
            str(marker.get("id")) for marker in restored_config.get("markers") or []
        }
        if recorder is not None:
            for marker_id in list(getattr(getattr(recorder, "book", None), "data", {})):
                if marker_id not in live_marker_ids:
                    try:
                        await recorder.async_delete(marker_id)
                    except Exception:  # noqa: BLE001
                        _LOGGER.exception("House Plan: removing orphan undo trail failed")
        entry = get_entry(hass)
        if entry is not None:
            from .repairs import async_check_plan_files

            hass.async_create_task(async_check_plan_files(hass, entry))
    connection.send_result(msg["id"], {
        "ok": True,
        "config_rev": new_config_rev,
        "layout_rev": new_layout_rev,
        "can_undo": False,
    })


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

    # Copy-on-write: a plan is written under a NEW unique name and nothing is
    # deleted here (review R2-1). The old name stays readable, so a config write
    # that is later rejected — revision conflict, validation, lost connection —
    # leaves the stored plan exactly as it was. The card calls
    # nothing here; the file a commit REPLACES is collected by `config/set`
    # itself, inside the write lock (review R3-1). An upload that never gets
    # committed is not collected at all — it is offered back in the space
    # dialog's "already uploaded" list, where the user can attach or delete it.
    # Every attempt to age these out ended in data loss or a race (v1.46.4-6).
    #
    # `.` separates the id from the token because a space id cannot contain one
    # (SPACE_ID_RE), so "<space>.<token>.<ext>" can never be confused with the
    # files of a differently named space.
    plans_dir = Path(hass.config.path(PLANS_DIR))
    name = f"{space_id}.{secrets.token_hex(4)}.{msg['ext']}"
    path = plans_dir / name

    def _check_and_write() -> None:
        # one executor job for the pair, under upload_lock: the measurement
        # is only a bound if nothing else writes between it and our write
        # (HP-1490-02). A failed write reserves nothing — the file either
        # exists and is counted by the next scan, or does not and is not.
        check_quota(plans_dir, len(raw), MAX_PLANS_BYTES, MAX_PLANS_FILES)
        plans_dir.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)

    data = _runtime(hass, connection, msg["id"])
    if data is None:
        return
    async with data.upload_lock:
        try:
            await hass.async_add_executor_job(_check_and_write)
        except QuotaError as err:
            connection.send_error(msg["id"], err.reason, err.detail)
            return
    connection.send_result(msg["id"], {"ok": True, "url": f"{CONTENT_URL}/plans/_/{name}"})


def _refresh_trail_recorder(hass: HomeAssistant) -> None:
    """Markers changed — the trail recorder must re-resolve what it watches."""
    rec = hass.data.get(DOMAIN, {}).get("trail_recorder")
    if rec:
        hass.async_create_task(rec.async_refresh())


@websocket_api.websocket_command({vol.Required("type"): "houseplan/trail/get"})
@websocket_api.async_response
async def ws_trail_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Current + previous cleanup runs per marker, raw robot coordinates."""
    rec = hass.data.get(DOMAIN, {}).get("trail_recorder")
    connection.send_result(msg["id"], {"trails": rec.book.data if rec else {}})


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
