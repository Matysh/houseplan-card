"""Minimal authenticated read-only projection, independent of topology ACLs."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import callback

from .store import get_data


@callback
def async_register(hass):
    websocket_api.async_register_command(hass, ws_zigbee_lqi_subscribe)


@websocket_api.websocket_command({vol.Required("type"): "houseplan/zigbee_lqi/subscribe"})
def ws_zigbee_lqi_subscribe(hass, connection, msg):
    user = connection.user
    if user is None or not user.is_active:
        connection.send_error(msg["id"], "unauthorized", "unauthorized")
        return
    coordinator = getattr(get_data(hass), "zigbee_lqi", None)
    if coordinator is None or coordinator.closed:
        connection.send_error(msg["id"], "not_ready", "not_ready")
        return

    @callback
    def publish(event):
        if connection.user is not user or not user.is_active:
            connection.send_event(msg["id"], {"kind": "closed", "session_id": coordinator.session_id,
                                              "revision": coordinator.revision + 1})
            remove()
            connection.subscriptions.pop(msg["id"], None)
            return
        connection.send_event(msg["id"], event)

    try:
        remove = coordinator.add_listener(publish)
    except ValueError:
        connection.send_error(msg["id"], "not_ready", "not_ready")
        return
    connection.subscriptions[msg["id"]] = remove
    connection.send_result(msg["id"])
    publish(coordinator.snapshot())
