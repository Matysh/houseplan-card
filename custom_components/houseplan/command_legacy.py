"""HA-only archive/source variants, intentionally outside portable plan commands."""
from __future__ import annotations

import asyncio
import copy
import logging
from datetime import UTC, datetime
from functools import partial
from pathlib import Path

from .backup_http import archive_admin
from .backup_service import get_backup_service
from .const import IMPORT_PREVIEW_TTL_S
from .import_export import ImportFailure, get_candidate, revalidate_candidate
from .registry_snapshot import import_registry_snapshot
from .store import async_resolve_pending_pair
from .websocket_api import (
    _build_identity,
    _check_write,
    _connection_user_id,
    _send_import_error,
)

_LOGGER = logging.getLogger(__name__)


async def export_special(hass, connection, msg, runtime):
    """Retain existing administrator-only original-source and full ZIP paths."""
    if msg.get("migration_source") or msg.get("plan_graph_migration_source"):
        from .config_migrations import CONFIG_MIGRATION_BACKUP
        from .import_export import create_migration_source_export

        if not archive_admin(hass, connection.user):
            connection.send_error(msg["id"], "unauthorized", "Administrator permission required")
            return
        if msg["kind"] != "full" or msg.get("archive") or msg.get("plan_only"):
            connection.send_error(msg["id"], "invalid_format", "Original migration snapshot requires full JSON")
            return
        try:
            async with runtime.write_lock:
                saved = await runtime.store.async_load() or {}
                if msg.get("plan_graph_migration_source") or msg.get("migration_source_kind") == "graph":
                    from .plan_graph_source import BACKUP_KEY, load_source_at

                    original = await load_source_at(hass, saved.get(BACKUP_KEY), msg.get("migration_source_sha256"))
                    snapshot = {"version": 1,
                        "config_data": {"config": original["config"], "rev": original["config_rev"]},
                        "layout_data": {"layout": original["layout"], "rev": original["layout_rev"], **original.get("passports", {})}}
                else:
                    snapshot = copy.deepcopy(saved.get(CONFIG_MIGRATION_BACKUP))
            document, filename = await hass.async_add_executor_job(partial(create_migration_source_export,
                runtime, snapshot, card_version=msg.get("card_version", ""), config_root=Path(hass.config.path(""))))
            if not _check_write(hass, connection) or not archive_admin(hass, connection.user):
                connection.send_error(msg["id"], "unauthorized", "Administrator permission was lost")
                return
        except ImportFailure as error:
            connection.send_error(msg["id"], error.code, "Original migration snapshot is unavailable or invalid")
            return
        except Exception:  # noqa: BLE001 - no stored source data at the public boundary
            connection.send_error(msg["id"], "invalid_config", "Original migration snapshot is unavailable")
            return
        connection.send_result(msg["id"], {"document": document, "filename": filename})
        return
    if not archive_admin(hass, connection.user) or msg["kind"] != "full" or msg.get("plan_only"):
        connection.send_error(msg["id"], "unauthorized", "Full ZIP requires an administrator")
        return
    service = get_backup_service(hass, runtime)
    owner = _connection_user_id(connection)
    try:
        async with asyncio.timeout(IMPORT_PREVIEW_TTL_S):
            result = await service.export(owner, msg.get("card_version", ""), _build_identity(runtime).build)
        if not archive_admin(hass, connection.user) or _connection_user_id(connection) != owner:
            await service.release(service.get(result["token"], owner))
            connection.send_error(msg["id"], "unauthorized", "Administrator permission was lost")
            return
    except ImportFailure as error:
        _send_import_error(connection, msg["id"], error)
        return
    except Exception:  # noqa: BLE001 - no paths/provider data at the public boundary
        connection.send_error(msg["id"], "zip_invalid", "Could not prepare full ZIP")
        return
    connection.send_result(msg["id"], result)


async def revalidate_archive(hass, connection, msg, runtime):
    try:
        async with runtime.write_lock:
            candidate = get_candidate(runtime, msg["token"], _connection_user_id(connection))
            if "archive" not in candidate or not archive_admin(hass, connection.user):
                raise ImportFailure("unauthorized")
            service = get_backup_service(hass, runtime)
            session = service.candidate_session(candidate, _connection_user_id(connection))
            pair = await async_resolve_pending_pair(runtime)
            try:
                registry = import_registry_snapshot(hass)
            except Exception:  # noqa: BLE001 - existing best-effort summary
                _LOGGER.debug("House Plan import registry summary unavailable", exc_info=True)
                registry = None
            result = await hass.async_add_executor_job(partial(revalidate_candidate, candidate,
                pair.config_data, pair.layout_data, duplicate_policy=msg.get("duplicate_policy", "skip"),
                registry_snapshot=registry, config_root=Path(hass.config.path(""))))
            from .import_export import _candidate_digest

            try:
                snapshot = await runtime.zigbee_coordinator.async_backup_snapshot()
            except Exception as error:  # noqa: BLE001 - no raw storage/lifecycle error in UI
                raise ImportFailure("conflict") from error
            candidate["archive"]["cache_generation"] = snapshot["generation"]
            candidate["confirmation_required"] = candidate["confirmation_required"] or not session.manifest["complete"]
            candidate["digest"] = _candidate_digest(candidate)
            result["preview"]["confirmation_required"] = candidate["confirmation_required"]
            result["preview"]["archive"] = service.summary(session, candidate["target_config"])
            result["token"] = msg["token"]
            result["expires_at"] = datetime.fromtimestamp(candidate["expires"], UTC).isoformat().replace("+00:00", "Z")
    except ImportFailure as error:
        _send_import_error(connection, msg["id"], error)
        return
    connection.send_result(msg["id"], result)


async def cancel_archive(hass, connection, msg, runtime) -> bool:
    """Handle archive sessions/operation IDs; portable JSON continues to core."""
    if not archive_admin(hass, connection.user):
        connection.send_error(msg["id"], "unauthorized", "Administrator permission required")
        return True
    if ("operation_id" in msg) == ("token" in msg):
        return False  # The shared legacy cancel owns this stable input error.
    try:
        if "operation_id" in msg:
            await get_backup_service(hass, runtime).cancel_import(_connection_user_id(connection), msg["operation_id"])
        else:
            service = runtime.backup_service
            if service is None:
                return False
            session = service.sessions.get(msg["token"])
            if session is None:
                session = next((value for value in service.sessions.values() if value.preview_token == msg["token"]), None)
            if session is None:
                return False
            if session.owner != _connection_user_id(connection):
                raise ImportFailure("preview_owner_mismatch")
            await service.release(session)
    except ImportFailure as error:
        _send_import_error(connection, msg["id"], error)
        return True
    connection.send_result(msg["id"], {"ok": True})
    return True
