"""Deliver private, placement-scoped alert snapshots to authenticated viewers."""
from __future__ import annotations

from asyncio import Lock

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import callback

from .const import DOMAIN
from .external_alerts import CHANGED

TYPE = f"{DOMAIN}/external_alerts/subscribe"
_EVENTS = (CHANGED, "houseplan_config_updated", "houseplan_layout_updated",
           "entity_registry_updated", "device_registry_updated")


@callback
def async_register(hass):
    websocket_api.async_register_command(hass, ws_external_alerts_subscribe)


@websocket_api.websocket_command({vol.Required("type"): TYPE})
@websocket_api.async_response
async def ws_external_alerts_subscribe(hass, connection, msg):
    msg_id = msg["id"]
    user = connection.user
    if user is None or not user.is_active:
        connection.send_error(msg_id, "unauthorized", "unauthorized")
        return
    alerts = hass.data.get(DOMAIN, {}).get("external_alerts")
    if alerts is None:
        connection.send_error(msg_id, "not_ready", "not_ready")
        return
    if sum(getattr(remove, "_houseplan_external_alerts", False)
           for remove in connection.subscriptions.values()) >= 32:
        connection.send_error(msg_id, "rate_limited", "rate_limited")
        return

    lock = Lock()
    active = True
    last = None

    def still_authorized():
        return connection.user is user and user.is_active

    @callback
    def remove():
        nonlocal active
        if not active:
            return
        active = False
        for unsubscribe in unsubscribers:
            unsubscribe()

    async def publish(_event=None):
        nonlocal last
        async with lock:
            if not active:
                return
            if not still_authorized():
                remove()
                connection.subscriptions.pop(msg_id, None)
                return
            try:
                rows = await alerts.snapshot(user)
            except (OSError, ValueError, KeyError, TypeError):
                # A storage failure cannot justify continuing to display stale data.
                rows = []
            if rows is not None and active and still_authorized() and rows != last:
                last = rows
                connection.send_event(msg_id, {"signals": rows})

    unsubscribers = [hass.bus.async_listen(event_type, publish) for event_type in _EVENTS]
    remove._houseplan_external_alerts = True
    connection.subscriptions[msg_id] = remove
    connection.send_result(msg_id)
    await publish()
