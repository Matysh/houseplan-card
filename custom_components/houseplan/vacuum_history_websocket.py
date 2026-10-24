"""Explicit writer-only historical reads through the registered public camera."""
from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .store import get_data
from .vacuum_camera_read import read_camera
from .vacuum_history import (
    begin_history_watch,
    digest,
    end_history_watch,
    history_catalog,
    history_epoch,
    history_route,
    history_snapshot,
)
from .vacuum_paths import PathRejected
from .vacuum_routes import effective_routes

TIMEOUT_S = 10.0
ID = vol.All(str, vol.Length(min=1, max=256))
OPAQUE = vol.Match(r"^[a-f0-9]{64}$")


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_history_list)
    websocket_api.async_register_command(hass, ws_history_get)


def _owner(hass: HomeAssistant, config: dict, marker_id: str) -> dict[str, Any]:
    """Resolve only saved authority and unique registry-proven robot/camera."""
    from homeassistant.components.camera.helper import get_camera_from_entity_id

    marker = next((row for row in config.get("markers", []) if row.get("id") == marker_id
                   and not row.get("removed")), None)
    rec = hass.data.get(DOMAIN, {}).get("trail_recorder")
    if marker is None or rec is None or rec._closed:
        raise PathRejected("not_found")
    settings = marker.get("vacuum") or {}
    if marker.get("hidden") or marker.get("display") in ("static_icon", "value_static_icon") \
            or settings.get("live") is False:
        raise PathRejected("suppressed")
    registry = er.async_get(hass)
    binding = str(marker.get("binding") or "")
    if binding.startswith("entity:vacuum."):
        robots = [registry.async_get(binding[7:])]
    elif binding.startswith("device:"):
        robots = [row for row in er.async_entries_for_device(registry, binding[7:])
                  if row.entity_id.startswith("vacuum.") and row.disabled_by is None]
    else:
        raise PathRejected("unsupported")
    robots = [row for row in robots if row is not None]
    if len(robots) != 1:
        raise PathRejected("ambiguous")
    robot = robots[0]
    if robot.platform != "dreame_vacuum" or not robot.device_id or robot.disabled_by is not None:
        raise PathRejected("unsupported")
    routes = effective_routes(marker_id, settings, str(marker.get("space") or ""))
    sources = {row["source"] for row in routes}
    if settings.get("source"):
        sources = {settings["source"]}
    if not sources and not isinstance(settings.get("map_routes"), list):
        sources = {row.entity_id for row in er.async_entries_for_device(registry, robot.device_id)
                   if row.entity_id.startswith("camera.")}
    candidates = []
    for source in sorted(sources):
        entry = registry.async_get(source)
        if not entry or not source.startswith("camera.") or entry.platform != "dreame_vacuum" \
                or entry.disabled_by is not None or entry.device_id != robot.device_id:
            continue
        try:
            camera = get_camera_from_entity_id(hass, source)
        except Exception:  # noqa: BLE001 — no provider exception/token crosses WS
            continue
        if type(getattr(camera, "map_index", None)) is int and camera.map_index == 0 \
                and callable(getattr(camera, "history_map_image", None)):
            candidates.append((source, camera, entry))
    if len(candidates) != 1:
        raise PathRejected("ambiguous" if candidates else "unsupported")
    source, camera, entry = candidates[0]
    state, vacuum_state = hass.states.get(source), hass.states.get(robot.entity_id)
    if not state or not vacuum_state or state.state in ("unknown", "unavailable") \
            or vacuum_state.state in ("unknown", "unavailable"):
        raise PathRejected("unavailable")
    routes = effective_routes(marker_id, settings, str(marker.get("space") or ""), source)
    return {"marker": marker, "rec": rec, "source": source, "camera": camera,
            "vacuum": robot.entity_id, "robot_entry": robot, "source_entry": entry,
            "state": state, "routes": [row for row in routes if row["source"] == source],
            "spaces": {row["id"] for row in config.get("spaces", [])},
            "fingerprint": digest([marker, config.get("spaces", [])])}


def _catalog(owner: dict):
    attrs = owner["camera"].extra_state_attributes
    return history_catalog((attrs or {}).get("cleaning_history_picture"), owner["source"], owner["vacuum"])


async def _request(hass: HomeAssistant, connection, msg: dict, *, geometry: bool) -> None:
    from .websocket_api import _check_write, _runtime

    if not _check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Editing permission is required")
        return
    rt = _runtime(hass, connection, msg["id"])
    if rt is None:
        return
    user = connection.user
    watch = None
    owner = None
    current_check: Callable[[], bool] | None = None
    try:
        stored = await rt.config_store.async_load() or {}
        if get_data(hass) is not rt or connection.user is not user or not _check_write(hass, connection):
            raise PathRejected("retired")
        owner = _owner(hass, stored.get("config") or {}, msg["marker_id"])
        records, revision, limited = _catalog(owner)
        epoch = history_epoch(owner["rec"], msg["marker_id"])
        if not geometry:
            connection.send_result(msg["id"], {"version": 1, "revision": revision, "limited": limited, "epoch": epoch,
                "records": [{"id": row.id, "timestamp": row.timestamp} for row in records]})
            return
        record = next((row for row in records if row.id == msg["record_id"]), None)
        if revision != msg["revision"] or record is None:
            raise PathRejected("stale")
        watch = begin_history_watch(owner["rec"], owner["source"], owner["vacuum"], revision, owner["state"])

        def current() -> bool:
            if get_data(hass) is not rt or connection.user is not user or not _check_write(hass, connection):
                return False
            try:
                now = _owner(hass, stored.get("config") or {}, msg["marker_id"])
                return all(now[key] is owner[key] for key in ("camera", "rec", "robot_entry", "source_entry")) \
                    and not watch.retired and now["state"] is watch.state \
                    and history_epoch(now["rec"], msg["marker_id"]) == epoch \
                    and _catalog(now)[1] == revision
            except PathRejected:
                return False

        current_check = current

        async def read():
            return await owner["camera"].history_map_image(record.index, False, False, True, False, False, False)

        async def admit() -> None:
            # The physical gate may have waited for a live operation/cooldown.
            # Re-read saved authority before starting any provider operation.
            latest = await rt.config_store.async_load() or {}
            if latest.get("rev") != stored.get("rev") or not current():
                raise PathRejected("retired")
            fresh = _owner(hass, latest.get("config") or {}, msg["marker_id"])
            if fresh["fingerprint"] != owner["fingerprint"]:
                raise PathRejected("retired")

        physical = hass.data.setdefault("houseplan_vacuum_path_reads", {})
        payload, _ = await asyncio.wait_for(read_camera(
            hass, physical, owner["source"], read, current, owner["rec"].collector.clock, admit=admit,
        ), TIMEOUT_S)
        if not current():
            raise PathRejected("stale")
        value, completed = await hass.async_add_executor_job(history_snapshot, payload)
        latest = await rt.config_store.async_load() or {}
        if not current() or latest.get("rev") != stored.get("rev"):
            raise PathRejected("retired")
        now = _owner(hass, latest.get("config") or {}, msg["marker_id"])
        if now["fingerprint"] != owner["fingerprint"]:
            raise PathRejected("retired")
        route = history_route(value, now["routes"], now["rec"].book.data.get(msg["marker_id"]), now["spaces"])
        connection.send_result(msg["id"], {"version": 1, "id": record.id,
            "timestamp": record.timestamp, "completed": completed, "revision": revision, "epoch": epoch,
            "route": route, "vacuum": owner["vacuum"], "paths": value.paths})
    except (PathRejected, TimeoutError) as err:
        code = str(err) if isinstance(err, PathRejected) else "stale"
        # A retired owner supersedes a record/provider failure. The client may
        # still have stale permission/config flags and an older painted preview.
        if current_check is not None:
            try:
                if not current_check():
                    code = "retired"
            except Exception:  # noqa: BLE001 — an unproved owner cannot retain preview authority
                code = "retired"
        connection.send_error(msg["id"], code, "Historical cleanup could not be read safely")
    except Exception:  # noqa: BLE001 — optional provider cannot disclose URL/token/error details
        connection.send_error(msg["id"], "unavailable", "Historical cleanup is unavailable")
    finally:
        if watch is not None and owner is not None:
            end_history_watch(owner["rec"], watch)


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/vacuum/history/list",
    vol.Required("marker_id"): ID,
})
@websocket_api.async_response
async def ws_history_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    await _request(hass, connection, msg, geometry=False)


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/vacuum/history/get",
    vol.Required("marker_id"): ID,
    vol.Required("record_id"): OPAQUE,
    vol.Required("revision"): OPAQUE,
})
@websocket_api.async_response
async def ws_history_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    await _request(hass, connection, msg, geometry=True)
