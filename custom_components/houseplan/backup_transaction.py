"""Portable restore/Undo use the same durable pair fence as every other writer."""
from __future__ import annotations

import copy
import logging
import secrets
import time
from functools import partial
from pathlib import Path

from .backup_files import check_files
from .backup_http import archive_admin
from .backup_service import get_backup_service
from .const import DEFAULT_CONFIG, OPTIMIZE_PENDING
from .coordinate_canonicalization import (
    canonicalize_config_geometry,
    canonicalize_layout_geometry,
)
from .import_export import ImportFailure, get_candidate, prepare_apply
from .zigbee_topology import _enabled

_LOGGER = logging.getLogger(__name__)


async def _notify(hass, target, cr, lr) -> None:
    from . import websocket_api as ws
    hass.bus.async_fire("houseplan_config_updated", {"rev": cr})
    hass.bus.async_fire("houseplan_layout_updated", {"rev": lr})
    try:
        await ws._purge_trail_recorder(hass, target)
        ws._refresh_trail_recorder(hass)
    except Exception:  # noqa: BLE001 - durable commit cannot become a false failure
        _LOGGER.warning("House Plan: post-restore refresh deferred")


async def _commit(hass, runtime, expected_generation: str, build):
    """Lock order is write (caller) -> upload -> lifecycle, BEFORE intent."""
    from . import websocket_api as ws

    coordinator = runtime.zigbee_coordinator
    async with runtime.upload_lock:
        async with coordinator.backup_transaction():
            try:
                if expected_generation != coordinator.cache_generation:
                    raise ImportFailure("conflict")
                before = await coordinator.async_backup_snapshot()
                pending, rollback = await build(before)
                await ws._commit_pair(runtime, pending, rollback)
            finally:
                # Nothing durable was started (or rollback already completed):
                # clear only the fence, not another user's active scan.
                ld = await runtime.store.async_load() or {}
                if OPTIMIZE_PENDING not in ld:
                    coordinator.release_backup_fence()


def _pair(kind, config, layout, cr, lr, metadata, archive):
    return {"kind": kind, "config": canonicalize_config_geometry(config),
            "layout": canonicalize_layout_geometry(layout), "config_rev": cr,
            "layout_rev": lr, "final_metadata": metadata, "archive": archive}


async def apply_archive(hass, connection, msg, runtime) -> None:
    from . import websocket_api as ws

    if not archive_admin(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", "Full ZIP requires an administrator")
        return
    service = get_backup_service(hass, runtime)
    session = None
    try:
        async with runtime.write_lock:
            candidate = get_candidate(runtime, msg["token"], ws._connection_user_id(connection))
            session = service.candidate_session(candidate, ws._connection_user_id(connection))
            resolved = await ws._resolved_write_pair(hass, connection, msg["id"], runtime)
            if resolved is None:
                return
            cd, ld = resolved.config_data, resolved.layout_data
            cr, lr = int(cd.get("rev", 0)), int(ld.get("rev", 0))
            if (msg["expected_config_rev"] != cr or msg["expected_layout_rev"] != lr
                    or candidate["config_rev"] != cr or candidate["layout_rev"] != lr):
                raise ImportFailure("conflict")
            target, positions, details = await hass.async_add_executor_job(partial(
                prepare_apply, candidate, cd.get("config") or DEFAULT_CONFIG, ld.get("layout") or {},
                duplicate_policy=msg.get("duplicate_policy"),
                confirm_missing_content=msg.get("confirm_missing_content", False)))
            original = ws._layout_metadata(ld)
            generation = secrets.token_hex(16)

            async def build(before):
                service.candidate_session(candidate, ws._connection_user_id(connection))
                record = {"action": "publish", "session": session.session,
                          "files": copy.deepcopy(session.files), "snapshot": {
                              "topics": session.topics if _enabled(target) else {}, "generation": generation}}
                await hass.async_add_executor_job(check_files, Path(runtime.backup_root), record)
                if not archive_admin(hass, connection.user):
                    raise ImportFailure("unauthorized")
                # TTL / ownership are rechecked after potentially large hashing.
                get_candidate(runtime, msg["token"], ws._connection_user_id(connection))
                backup = {"kind": "import", "config": canonicalize_config_geometry(cd.get("config") or DEFAULT_CONFIG),
                          "layout": canonicalize_layout_geometry(ld.get("layout") or {}), "created": int(time.time()),
                          "after_config_rev": cr + 1, "after_layout_rev": lr + 1,
                          "archive_snapshot": before, "after_cache_generation": generation}
                final = {k: v for k, v in original.items()
                         if k not in {"optimize_backup", OPTIMIZE_PENDING, "repair_backup", "geom_pending"}}
                final["optimize_backup"] = backup
                pending = _pair("import", target, positions, cr + 1, lr + 1, final, record)
                rollback = _pair("import_rollback", cd.get("config") or DEFAULT_CONFIG, ld.get("layout") or {},
                                 cr, lr, original, {**record, "action": "rollback", "snapshot": before})
                return pending, rollback

            await _commit(hass, runtime, candidate["archive"]["cache_generation"], build)
            runtime.import_previews.pop(msg["token"], None)
    except ImportFailure as err:
        ws._send_import_error(connection, msg["id"], err)
        return
    except ws.PairCommitFailure:
        connection.send_error(msg["id"], "commit_failed", "Restore failed; reload the plan")
        return
    except Exception:  # noqa: BLE001 - exact intent remains the recovery authority
        connection.send_error(msg["id"], "commit_failed", "Restore failed; reload the plan")
        return
    await _notify(hass, target, cr + 1, lr + 1)
    connection.send_result(msg["id"], {"ok": True, "kind": "full", "config_rev": cr + 1,
        "layout_rev": lr + 1, "counts": details.get("counts", {}), "can_undo": True})
    try:
        # Committed hardlinks survive private staging cleanup. A cleanup fault
        # cannot make the client retry an already completed restore.
        await service.release(session)
    except Exception:  # noqa: BLE001 - TTL/startup can reclaim private staging
        _LOGGER.warning("House Plan: committed backup staging cleanup deferred")


async def undo_archive_locked(hass, connection, msg, runtime, cd, ld) -> None:
    """Called under the existing Undo write lock; legacy JSON Undo is untouched."""
    from . import websocket_api as ws

    if not archive_admin(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", "ZIP Undo requires an administrator")
        return
    try:
        backup = ld["optimize_backup"]
        cr, lr = int(cd.get("rev", 0)), int(ld.get("rev", 0))
        original = ws._layout_metadata(ld)
        final = {k: v for k, v in original.items() if k not in {"optimize_backup", OPTIMIZE_PENDING, "repair_backup"}}
        restored = backup.get("config") or DEFAULT_CONFIG
        positions = backup.get("layout") or {}
        target_snapshot = {"topics": backup["archive_snapshot"]["topics"], "generation": secrets.token_hex(16)}

        async def build(before):
            if not archive_admin(hass, connection.user):
                raise ImportFailure("unauthorized")
            pending = _pair("import_undo", restored, positions, cr + 1, lr + 1, final,
                            {"action": "cache", "snapshot": target_snapshot})
            rollback = _pair("import_undo_rollback", cd.get("config") or DEFAULT_CONFIG, ld.get("layout") or {},
                             cr, lr, original, {"action": "cache", "snapshot": before})
            return pending, rollback

        await _commit(hass, runtime, backup["after_cache_generation"], build)
    except ImportFailure as err:
        ws._send_import_error(connection, msg["id"], err)
        return
    except Exception:  # noqa: BLE001 - same durable authority as Apply
        connection.send_error(msg["id"], "commit_failed", "Undo failed; reload the plan")
        return
    await _notify(hass, restored, cr + 1, lr + 1)
    connection.send_result(msg["id"], {"ok": True, "kind": "import", "config_rev": cr + 1,
                                      "layout_rev": lr + 1, "can_undo": False})
