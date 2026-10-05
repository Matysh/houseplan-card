"""Admin-only WebSocket observers and explicit actions for background Z2M jobs."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .store import get_data
from .zigbee_topology import ZigbeeScanCoordinator, ZigbeeScanError


def _coordinator(hass: HomeAssistant, connection, msg_id: int) -> ZigbeeScanCoordinator | None:
    runtime = get_data(hass)
    coordinator = getattr(runtime, "zigbee_coordinator", None)
    if not isinstance(coordinator, ZigbeeScanCoordinator) or coordinator.closed:
        connection.send_error(msg_id, "not_ready", "not_ready")
        return None
    return coordinator


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_zigbee_subscribe)
    websocket_api.async_register_command(hass, ws_zigbee_start)
    websocket_api.async_register_command(hass, ws_zigbee_cancel)


@websocket_api.websocket_command({vol.Required("type"): "houseplan/zigbee/subscribe"})
@websocket_api.require_admin
def ws_zigbee_subscribe(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    coordinator = _coordinator(hass, connection, msg["id"])
    if coordinator is None:
        return

    @callback
    def publish(event: dict[str, Any]) -> None:
        # Permission can be revoked during a long-lived browser session.
        if connection.user is None or not connection.user.is_admin:
            remove()
            connection.subscriptions.pop(msg["id"], None)
            return
        connection.send_event(msg["id"], event)

    try:
        remove = coordinator.add_listener(publish)
    except ZigbeeScanError as err:
        connection.send_error(msg["id"], err.code, err.code)
        return
    # HA calls this on unsubscribe/disconnect. It never cancels the shared job.
    connection.subscriptions[msg["id"]] = remove
    connection.send_result(msg["id"], {"session_id": coordinator.session_id,
                                       "revision": coordinator.revision})
    for event in coordinator.initial_events():
        publish(event)


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/zigbee/start",
    vol.Required("base_topic"): vol.All(str, vol.Length(min=1, max=1024)),
})
@websocket_api.require_admin
def ws_zigbee_start(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    coordinator = _coordinator(hass, connection, msg["id"])
    if coordinator is None:
        return
    try:
        result = coordinator.start(msg["base_topic"])
    except ZigbeeScanError as err:
        connection.send_error(msg["id"], err.code, err.code)
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/zigbee/cancel",
    vol.Required("base_topic"): vol.All(str, vol.Length(min=1, max=1024)),
    vol.Required("job_id"): vol.All(str, vol.Length(min=1, max=80)),
})
@websocket_api.require_admin
def ws_zigbee_cancel(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    coordinator = _coordinator(hass, connection, msg["id"])
    if coordinator is None:
        return
    try:
        result = coordinator.cancel(msg["base_topic"], msg["job_id"])
    except ZigbeeScanError as err:
        connection.send_error(msg["id"], err.code, err.code)
        return
    connection.send_result(msg["id"], result)
