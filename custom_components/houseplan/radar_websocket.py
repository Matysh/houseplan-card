"""Bounded, permission-aware WebSocket surface for presence radars (#485)."""
from __future__ import annotations

import asyncio
import json
import time
from collections import defaultdict, deque
from typing import Any

import voluptuous as vol
from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import (
    async_track_state_change_event,
    async_track_state_report_event,
)

from .auth import may_write
from .radar import MAX_FRAME_HZ, RadarCoordinator
from .radar_validation import (
    RadarValidationError,
    radar_registry_evidence,
    validate_radar_draft,
)
from .store import get_data

_INSPECT_CALLS: dict[str, deque[float]] = defaultdict(deque)
_ACTIVE_SUBSCRIPTIONS: dict[str, int] = defaultdict(int)
_ACTIVE_SETUP: set[tuple[str, str]] = set()
_MAX_SETUP_TOTAL = 8


def _user_id(connection) -> str:
    return str(getattr(getattr(connection, "user", None), "id", ""))


def _validated_draft(
    coordinator: RadarCoordinator, message: dict[str, Any], connection,
) -> tuple[dict[str, Any], dict[str, Any], set[str]] | None:
    payload = message.get("draft_sources")
    radar = payload.get("radar") if isinstance(payload, dict) else None
    try:
        if len(json.dumps(payload, separators=(",", ":"), allow_nan=False).encode()) > 65536:
            raise vol.Invalid("radar draft is too large")
        marker, source_ids = validate_radar_draft(
            coordinator.config, message["marker_id"], radar,
            radar_registry_evidence(coordinator.hass),
        )
    except RadarValidationError:
        connection.send_error(message["id"], "invalid_radar", "invalid_radar")
        return None
    except (TypeError, ValueError, vol.Invalid):
        connection.send_error(message["id"], "invalid_selection", "invalid_selection")
        return None
    if not _can_read(connection, source_ids):
        connection.send_error(message["id"], "source_restricted", "source_restricted")
        return None
    if any(
        coordinator.hass.states.get(entity_id) is None
        or str(coordinator.hass.states.get(entity_id).state) in {"unknown", "unavailable"}
        for entity_id in source_ids
    ):
        connection.send_error(message["id"], "source_unavailable", "source_unavailable")
        return None
    return marker, radar, source_ids


def _coordinator(hass: HomeAssistant, connection, msg_id: int) -> RadarCoordinator | None:
    runtime = get_data(hass)
    coordinator = getattr(runtime, "radar_coordinator", None) if runtime else None
    if runtime is not None and coordinator is None:
        connection.send_error(msg_id, "unsupported_capability", "unsupported_capability")
        return None
    if not isinstance(coordinator, RadarCoordinator) or coordinator.closed:
        connection.send_error(msg_id, "not_ready", "not_ready")
        return None
    return coordinator


def _can_read(connection, entity_ids: set[str]) -> bool:
    user = getattr(connection, "user", None)
    permissions = getattr(user, "permissions", None)
    return bool(permissions) and all(
        permissions.check_entity(entity_id, POLICY_READ) for entity_id in entity_ids
    )


def _rate_limit(user_id: str) -> bool:
    now = time.monotonic()
    calls = _INSPECT_CALLS[user_id]
    while calls and calls[0] <= now - 60:
        calls.popleft()
    if len(calls) >= 10:
        return False
    calls.append(now)
    return True


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_radar_subscribe)
    websocket_api.async_register_command(hass, ws_radar_setup_inspect)
    websocket_api.async_register_command(hass, ws_radar_setup_subscribe)


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/radar/subscribe",
    vol.Required("space_id"): vol.All(str, vol.Length(min=1, max=64)),
})
def ws_radar_subscribe(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    coordinator = _coordinator(hass, connection, msg["id"])
    if coordinator is None:
        return
    connection_key = _user_id(connection)
    if _ACTIVE_SUBSCRIPTIONS[connection_key] >= 4:
        connection.send_error(msg["id"], "rate_limited", "rate_limited")
        return
    space_id = msg["space_id"]
    if not coordinator.has_space(space_id):
        connection.send_error(msg["id"], "invalid_selection", "invalid_selection")
        return

    @callback
    def publish(marker_id: str, frame: dict[str, Any]) -> None:
        if coordinator.space_for_marker(marker_id) != space_id:
            return
        if not _can_read(connection, coordinator.source_ids(marker_id)):
            connection.send_event(msg["id"], {
                "marker_id": marker_id,
                "server_session_id": coordinator.server_session_id,
                "seq": frame.get("seq", 0), "health": "restricted",
                "reported_presence": None, "complete": False,
                "targets": [], "ranges": [], "zones": [],
            })
            return
        connection.send_event(msg["id"], frame)

    unsub = coordinator.add_listener(publish, publish_initial=False)

    @callback
    def remove() -> None:
        unsub()
        _ACTIVE_SUBSCRIPTIONS[connection_key] = max(
            0, _ACTIVE_SUBSCRIPTIONS[connection_key] - 1
        )
        if not _ACTIVE_SUBSCRIPTIONS[connection_key]:
            _ACTIVE_SUBSCRIPTIONS.pop(connection_key, None)

    _ACTIVE_SUBSCRIPTIONS[connection_key] += 1
    connection.subscriptions[msg["id"]] = remove
    connection.send_result(msg["id"], {
        "server_session_id": coordinator.server_session_id,
        "config_rev": coordinator.config_rev,
    })
    for frame in coordinator.frames_for_space(space_id):
        publish(str(frame.get("marker_id", "")), coordinator.public_frame(frame))


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/radar/setup/inspect",
    vol.Required("marker_id"): vol.All(str, vol.Length(min=1, max=128)),
    vol.Optional("draft_sources"): vol.All(dict, vol.Length(max=128)),
})
def ws_radar_setup_inspect(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    if not may_write(hass, getattr(connection, "user", None)):
        connection.send_error(msg["id"], "unauthorized", "unauthorized")
        return
    coordinator = _coordinator(hass, connection, msg["id"])
    if coordinator is None:
        return
    user_id = _user_id(connection)
    if not _rate_limit(user_id):
        connection.send_error(msg["id"], "rate_limited", "rate_limited")
        return
    if "draft_sources" in msg:
        validated = _validated_draft(coordinator, msg, connection)
        if validated is None:
            return
        marker, radar, _source_ids = validated
        connection.send_result(msg["id"], coordinator.inspect_draft(marker, radar))
        return
    marker_id = msg["marker_id"]
    if not _can_read(connection, coordinator.source_ids(marker_id)):
        connection.send_error(msg["id"], "source_restricted", "source_restricted")
        return
    connection.send_result(msg["id"], coordinator.inspect(marker_id))


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/radar/setup/subscribe",
    vol.Required("marker_id"): vol.All(str, vol.Length(min=1, max=128)),
    vol.Required("expected_config_rev"): int,
    vol.Optional("draft_sources"): vol.All(dict, vol.Length(max=128)),
})
def ws_radar_setup_subscribe(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
    if not may_write(hass, getattr(connection, "user", None)):
        connection.send_error(msg["id"], "unauthorized", "unauthorized")
        return
    coordinator = _coordinator(hass, connection, msg["id"])
    if coordinator is None:
        return
    if msg["expected_config_rev"] != coordinator.config_rev:
        connection.send_error(msg["id"], "conflict", "conflict")
        return
    marker_id = msg["marker_id"]
    user_id = _user_id(connection)
    key = (user_id, marker_id)
    if key in _ACTIVE_SETUP or len(_ACTIVE_SETUP) >= _MAX_SETUP_TOTAL:
        connection.send_error(msg["id"], "rate_limited", "rate_limited")
        return
    draft: tuple[dict[str, Any], dict[str, Any], set[str]] | None = None
    if "draft_sources" in msg:
        draft = _validated_draft(coordinator, msg, connection)
        if draft is None:
            return
        marker, radar, source_ids = draft
    else:
        marker = coordinator.marker_config(marker_id)
        if marker_id not in coordinator.radars or marker is None:
            connection.send_error(msg["id"], "invalid_selection", "invalid_selection")
            return
        radar = marker["radar"]
        source_ids = coordinator.source_ids(marker_id)
        if not _can_read(connection, source_ids):
            connection.send_error(msg["id"], "source_restricted", "source_restricted")
            return

    pending: asyncio.TimerHandle | None = None
    unsubs: list[Any] = []
    unregister_cleanup: Any = None
    removed = False

    @callback
    def send_snapshot() -> None:
        nonlocal pending
        pending = None
        if not _can_read(connection, source_ids):
            connection.send_event(msg["id"], {"marker_id": marker_id, "health": "restricted"})
            return
        connection.send_event(msg["id"], coordinator.inspect_draft(marker, radar))

    @callback
    def source_reported(_event) -> None:
        nonlocal pending
        if pending is None:
            pending = hass.loop.call_later(1 / MAX_FRAME_HZ, send_snapshot)

    if source_ids:
        unsubs.append(async_track_state_report_event(hass, sorted(source_ids), source_reported))
        unsubs.append(async_track_state_change_event(hass, sorted(source_ids), source_reported))

    @callback
    def remove() -> None:
        nonlocal pending, unregister_cleanup, removed
        if removed:
            return
        removed = True
        if pending is not None:
            pending.cancel()
            pending = None
        for unsub in unsubs:
            unsub()
        unsubs.clear()
        _ACTIVE_SETUP.discard(key)
        if unregister_cleanup is not None:
            unregister_cleanup()
            unregister_cleanup = None

    _ACTIVE_SETUP.add(key)
    unregister_cleanup = coordinator.add_external_cleanup(remove)
    connection.subscriptions[msg["id"]] = remove
    connection.send_result(msg["id"], {
        "server_session_id": coordinator.server_session_id,
        "config_rev": coordinator.config_rev,
    })
    send_snapshot()
