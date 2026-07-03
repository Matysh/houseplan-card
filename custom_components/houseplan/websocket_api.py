"""WS-команды houseplan/layout/get|set|update — серверное хранение раскладки."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import CONF_ADMIN_ONLY, DOMAIN

POS_SCHEMA = vol.Schema({vol.Required("x"): vol.Coerce(float), vol.Required("y"): vol.Coerce(float)})
LAYOUT_SCHEMA = vol.Schema({str: POS_SCHEMA})


@callback
def async_register(hass: HomeAssistant) -> None:
    """Регистрация WS-команд."""
    websocket_api.async_register_command(hass, ws_layout_get)
    websocket_api.async_register_command(hass, ws_layout_set)
    websocket_api.async_register_command(hass, ws_layout_update)


def _store(hass: HomeAssistant):
    return hass.data[DOMAIN]["store"]


def _check_write(hass: HomeAssistant, connection) -> bool:
    entry = hass.data[DOMAIN].get("entry")
    admin_only = bool(entry and entry.options.get(CONF_ADMIN_ONLY, False))
    return connection.user.is_admin if admin_only else True


@websocket_api.websocket_command({vol.Required("type"): "houseplan/layout/get"})
@websocket_api.async_response
async def ws_layout_get(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Вернуть сохранённую раскладку."""
    data = await _store(hass).async_load() or {}
    connection.send_result(msg["id"], {"layout": data.get("layout", {})})


@websocket_api.websocket_command(
    {vol.Required("type"): "houseplan/layout/set", vol.Required("layout"): LAYOUT_SCHEMA}
)
@websocket_api.async_response
async def ws_layout_set(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    """Полностью заменить раскладку."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Правка раскладки разрешена только администраторам")
        return
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
    """Обновить позицию одного устройства."""
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Правка раскладки разрешена только администраторам")
        return
    store = _store(hass)
    data = await store.async_load() or {}
    layout = data.get("layout", {})
    layout[msg["device_id"]] = msg["pos"]
    await store.async_save({"layout": layout})
    connection.send_result(msg["id"], {"ok": True})
