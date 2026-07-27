"""House Plan WS commands: layout, space configuration, plan uploads."""
from __future__ import annotations

import logging

import base64
import binascii
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import (
    CONF_ADMIN_ONLY, DEFAULT_CONFIG,
    CONTENT_URL, PLANS_DIR, PLANS_URL,
)
from .auth import may_write
from .store import HouseplanData, get_data, get_entry
from .validation import (
    CONFIG_SCHEMA, LAYOUT_SCHEMA, MAX_PLAN_BYTES,
    PLAN_EXTENSIONS, POS_SCHEMA, valid_space_id,
)


_LOGGER = logging.getLogger(__name__)


@callback
def async_register(hass: HomeAssistant) -> None:
    """Register the WS commands."""
    websocket_api.async_register_command(hass, ws_layout_get)
    websocket_api.async_register_command(hass, ws_layout_set)
    websocket_api.async_register_command(hass, ws_layout_update)
    websocket_api.async_register_command(hass, ws_layout_delete)
    websocket_api.async_register_command(hass, ws_config_get)
    websocket_api.async_register_command(hass, ws_config_set)
    websocket_api.async_register_command(hass, ws_plan_set)
    websocket_api.async_register_command(hass, ws_files_migrate)
    websocket_api.async_register_command(hass, ws_files_cleanup)
    websocket_api.async_register_command(hass, ws_content_sign)


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


# ---------------- layout ----------------


@websocket_api.websocket_command({vol.Required("type"): "houseplan/layout/get"})
@websocket_api.async_response
async def ws_layout_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Return the saved layout."""
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    data = await rt.store.async_load() or {}
    connection.send_result(msg["id"], {"layout": data.get("layout", {})})


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
        data = await rt.store.async_load() or {}
        current_rev = int(data.get("rev", 0))
        if "expected_rev" in msg and msg["expected_rev"] != current_rev:
            connection.send_error(
                msg["id"], "conflict", f"Layout changed elsewhere (rev {current_rev})"
            )
            return
        await rt.store.async_save({"layout": msg["layout"], "rev": current_rev + 1})
    connection.send_result(msg["id"], {"ok": True, "rev": current_rev + 1})


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
        data = await rt.store.async_load() or {}
        layout = data.get("layout", {})
        layout[msg["device_id"]] = msg["pos"]
        await rt.store.async_save({"layout": layout})
    connection.send_result(msg["id"], {"ok": True})


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
            target = dst / f.name
            if target.exists():
                # a different file already owns this name — do NOT silently
                # point the url at it; give the copy a unique name instead
                stem, suffix = f.stem, f.suffix
                i = 2
                while (dst / f"{stem} ({i}){suffix}").exists():
                    i += 1
                target = dst / f"{stem} ({i}){suffix}"
            shutil.copy2(str(f), str(target))
            mapping[f.name] = target.name
        return mapping

    try:
        mapping = await hass.async_add_executor_job(_copy)
    except OSError as err:
        connection.send_error(msg["id"], "io_error", f"Could not copy marker files: {err}")
        return
    connection.send_result(msg["id"], {"ok": True, "mapping": mapping, "copied": len(mapping)})


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
    for path in msg["paths"][:200]:
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
    """Delete a marker's file folder — called only AFTER the config is committed."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit files")
        return
    import shutil
    from pathlib import Path

    from .const import FILES_DIR
    from .validation import sanitize_marker_id

    mid = sanitize_marker_id(msg["marker_id"])
    if not mid:
        connection.send_result(msg["id"], {"ok": True, "removed": False})
        return
    base = Path(hass.config.path(FILES_DIR)).resolve()
    target = (base / mid).resolve()
    if not str(target).startswith(str(base)) or target == base:
        connection.send_result(msg["id"], {"ok": True, "removed": False})
        return

    def _rm() -> bool:
        if not target.is_dir():
            return False
        shutil.rmtree(target, ignore_errors=True)
        return True

    removed = await hass.async_add_executor_job(_rm)
    connection.send_result(msg["id"], {"ok": True, "removed": removed})


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
    async with rt.write_lock:
        data = await rt.store.async_load() or {}
        layout = data.get("layout", {})
        if msg["device_id"] in layout:
            del layout[msg["device_id"]]
            await rt.store.async_save({"layout": layout})
    connection.send_result(msg["id"], {"ok": True})


# ---------------- space configuration ----------------


@websocket_api.websocket_command({vol.Required("type"): "houseplan/config/get"})
@websocket_api.async_response
async def ws_config_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Return the configuration and its revision."""
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    data = await rt.config_store.async_load() or {}
    config = {**DEFAULT_CONFIG, **data.get("config", {})}
    connection.send_result(msg["id"], {"config": config, "rev": data.get("rev", 0)})


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
        new_rev = current_rev + 1
        await rt.config_store.async_save({"config": msg["config"], "rev": new_rev})
    hass.bus.async_fire("houseplan_config_updated", {"rev": new_rev})
    # refresh repair issues (broken plan references) without waiting for a restart
    entry = get_entry(hass)
    if entry is not None:
        from .repairs import async_check_plan_files

        hass.async_create_task(async_check_plan_files(hass, entry))
    connection.send_result(msg["id"], {"ok": True, "rev": new_rev})


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

    plans_dir = Path(hass.config.path(PLANS_DIR))
    path = plans_dir / f"{space_id}.{msg['ext']}"

    def _write() -> int:
        plans_dir.mkdir(parents=True, exist_ok=True)
        # remove old variants with a different extension
        for old_ext in PLAN_EXTENSIONS:
            old = plans_dir / f"{space_id}.{old_ext}"
            if old_ext != msg["ext"] and old.exists():
                old.unlink()
        path.write_bytes(raw)
        return int(path.stat().st_mtime)

    mtime = await hass.async_add_executor_job(_write)
    connection.send_result(
        msg["id"], {"ok": True, "url": f"{CONTENT_URL}/plans/_/{space_id}.{msg['ext']}?v={mtime}"}
    )
