"""Authenticated delivery of this integration's own profile/config revision frames."""
from __future__ import annotations

from copy import deepcopy

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import callback

from .store import get_data

EVENT = "houseplan_config_updated"
TYPE = "houseplan/external_screens/subscribe"
MAX_SUBSCRIPTIONS = 4


def _revision(value):
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 2**53 - 1


def _base_revision(value):
    if not _revision(value):
        raise vol.Invalid("base_rev must be a nonnegative safe integer")
    return value


@callback
def async_register(hass):
    websocket_api.async_register_command(hass, ws_external_screens_subscribe)


@websocket_api.websocket_command({
    vol.Required("type"): TYPE,
    vol.Required("base_rev"): _base_revision,
})
@websocket_api.async_response
async def ws_external_screens_subscribe(hass, connection, msg):
    user = connection.user
    if user is None or not user.is_active:
        connection.send_error(msg["id"], "unauthorized", "unauthorized")
        return
    if sum(bool(getattr(remove, "_houseplan_external_screens", False))
           for remove in connection.subscriptions.values()) >= MAX_SUBSCRIPTIONS:
        connection.send_error(msg["id"], "rate_limited", "rate_limited")
        return
    runtime = get_data(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_ready", "not_ready")
        return
    removed = False

    @callback
    def remove():
        nonlocal removed
        if removed:
            return
        removed = True
        unsubscribe()

    remove._houseplan_external_screens = True

    def current_user():
        return connection.user is user and user.is_active and get_data(hass) is runtime

    @callback
    def close():
        connection.send_event(msg["id"], {"kind": "closed"})
        remove()
        connection.subscriptions.pop(msg["id"], None)

    async def publish(event):
        if removed:
            return
        async with runtime.write_lock:
            if removed:
                return
            if not current_user():
                close()
                return
            raw, frame = event.data, {}
            rev = raw.get("rev")
            if not _revision(rev):
                return
            frame["rev"] = rev
            update = raw.get("external_screens_update")
            stored = await runtime.config_store.async_load() or {}
            if removed:
                return
            if not current_user():
                close()
                return
            # A public bus event is not arbitrary payload authority. Only this
            # exact persisted revision/namespace may carry a complete patch.
            if (isinstance(update, dict) and update.get("version") == 1
                    and _revision(update.get("base_rev")) and update["base_rev"] + 1 == rev
                    and stored.get("rev", 0) == rev
                    and update.get("value") == stored.get("config", {}).get("settings", {}).get("external_screens")):
                frame["external_screens_update"] = {
                    "version": 1, "base_rev": update["base_rev"],
                    "value": deepcopy(update["value"]),
                }
            connection.send_event(msg["id"], frame)

    async with runtime.write_lock:
        stored = await runtime.config_store.async_load() or {}
        if not current_user():
            connection.send_error(msg["id"], "unauthorized", "unauthorized")
            return
        # No await separates listener registration and the authoritative rev
        # read. The initial handshake never claims a full config snapshot.
        if sum(bool(getattr(remove, "_houseplan_external_screens", False))
               for remove in connection.subscriptions.values()) >= MAX_SUBSCRIPTIONS:
            connection.send_error(msg["id"], "rate_limited", "rate_limited")
            return
        unsubscribe = hass.bus.async_listen(EVENT, publish)
        connection.subscriptions[msg["id"]] = remove
        connection.send_result(msg["id"])
        rev = stored.get("rev", 0)
        connection.send_event(msg["id"], {
            "kind": "ready" if msg["base_rev"] == rev else "resync", "rev": rev,
        })
