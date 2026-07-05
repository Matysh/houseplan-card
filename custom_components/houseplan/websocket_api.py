"""House Plan WS commands: layout, space configuration, plan uploads."""
from __future__ import annotations

import asyncio
import base64
import binascii
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import (
    CONF_ADMIN_ONLY, DEFAULT_CONFIG, DOMAIN,
    PLANS_DIR, PLANS_URL,
)
from .validation import (
    CONFIG_SCHEMA, LAYOUT_SCHEMA, MAX_PLAN_BYTES,
    PLAN_EXTENSIONS, POS_SCHEMA, valid_space_id,
)


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


def _store(hass: HomeAssistant):
    return hass.data[DOMAIN]["store"]


def _config_store(hass: HomeAssistant):
    return hass.data[DOMAIN]["config_store"]


def _write_lock(hass: HomeAssistant) -> asyncio.Lock:
    """A single lock over the load→modify→save cycle of both stores.

    Without it, parallel WS calls lose changes (last-writer-wins),
    and the expected_rev check is not atomic.
    """
    return hass.data[DOMAIN].setdefault("write_lock", asyncio.Lock())


def _check_write(hass: HomeAssistant, connection) -> bool:
    entry = hass.data[DOMAIN].get("entry")
    admin_only = bool(entry and entry.options.get(CONF_ADMIN_ONLY, False))
    return connection.user.is_admin if admin_only else True


# ---------------- layout ----------------


@websocket_api.websocket_command({vol.Required("type"): "houseplan/layout/get"})
@websocket_api.async_response
async def ws_layout_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Return the saved layout."""
    data = await _store(hass).async_load() or {}
    connection.send_result(msg["id"], {"layout": data.get("layout", {})})


@websocket_api.websocket_command(
    {vol.Required("type"): "houseplan/layout/set", vol.Required("layout"): LAYOUT_SCHEMA}
)
@websocket_api.async_response
async def ws_layout_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Replace the layout entirely."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Only administrators may edit the layout")
        return
    async with _write_lock(hass):
        await _store(hass).async_save({"layout": msg["layout"]})
    connection.send_result(msg["id"], {"ok": True})


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
    store = _store(hass)
    async with _write_lock(hass):
        data = await store.async_load() or {}
        layout = data.get("layout", {})
        layout[msg["device_id"]] = msg["pos"]
        await store.async_save({"layout": layout})
    connection.send_result(msg["id"], {"ok": True})


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
    store = _store(hass)
    async with _write_lock(hass):
        data = await store.async_load() or {}
        layout = data.get("layout", {})
        if msg["device_id"] in layout:
            del layout[msg["device_id"]]
            await store.async_save({"layout": layout})
    connection.send_result(msg["id"], {"ok": True})


# ---------------- space configuration ----------------


@websocket_api.websocket_command({vol.Required("type"): "houseplan/config/get"})
@websocket_api.async_response
async def ws_config_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Return the configuration and its revision."""
    data = await _config_store(hass).async_load() or {}
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
    store = _config_store(hass)
    async with _write_lock(hass):
        data = await store.async_load() or {}
        current_rev = data.get("rev", 0)
        if "expected_rev" in msg and msg["expected_rev"] != current_rev:
            connection.send_error(
                msg["id"], "conflict",
                f"Configuration was changed in another window (rev {current_rev} != {msg['expected_rev']})",
            )
            return
        new_rev = current_rev + 1
        await store.async_save({"config": msg["config"], "rev": new_rev})
    hass.bus.async_fire("houseplan_config_updated", {"rev": new_rev})
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
        msg["id"], {"ok": True, "url": f"{PLANS_URL}/{space_id}.{msg['ext']}?v={mtime}"}
    )
