"""Writer-only map preview; the original SVG and HA tokens never leave HA."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .vacuum_ecovacs import EcovacsRejected
from .vacuum_ecovacs_reader import automatic_ecovacs_source, ecovacs_pair


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_map_preview)


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/vacuum/map_preview",
    vol.Required("marker_id"): vol.All(str, vol.Length(min=1, max=256)),
    vol.Required("source"): vol.All(str, vol.Length(min=1, max=256)),
    vol.Required("map_id"): vol.All(str, vol.Length(max=256)),
})
@websocket_api.async_response
async def ws_map_preview(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    from .websocket_api import _check_write, _runtime

    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Editing permission is required")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    stored = await rt.config_store.async_load() or {}
    current = _runtime(hass, connection, msg["id"])
    if current is not rt:
        if current is not None:
            connection.send_error(msg["id"], "unavailable", "The plan context changed")
        return
    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unavailable", "The plan context changed")
        return
    rec = hass.data.get(DOMAIN, {}).get("trail_recorder")
    marker = next((item for item in (stored.get("config") or {}).get("markers", [])
                   if item.get("id") == msg["marker_id"] and not item.get("removed")), None)
    if rec is None or marker is None:
        connection.send_error(msg["id"], "not_found", "Vacuum marker is unavailable")
        return
    vacuum = rec._vacuum_entity(marker)
    settings = marker.get("vacuum") or {}
    root = settings.get("source") or (automatic_ecovacs_source(hass, vacuum) if vacuum else None)
    sources = {root} | {route.get("source") for route in (settings.get("map_routes") or [])
                        if isinstance(route, dict)}
    if settings.get("live") is False or msg["source"] not in sources or not vacuum \
            or not ecovacs_pair(hass, msg["source"], vacuum):
        connection.send_error(msg["id"], "not_found", "Vacuum source is not configured for this marker")
        return
    try:
        preview = rec.ecovacs.preview(msg["source"])
        if preview["map_id"] != msg["map_id"]:
            raise EcovacsRejected("stale")
    except EcovacsRejected as err:
        connection.send_error(msg["id"], str(err), "The current Ecovacs map cannot be previewed")
        return
    connection.send_result(msg["id"], preview)
