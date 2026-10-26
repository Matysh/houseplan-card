"""Authorized structural history uses the existing recoverable paired writer."""
from __future__ import annotations

import json
from pathlib import Path

import voluptuous as vol
from homeassistant.components import websocket_api

from .const import DEFAULT_CONFIG, FILES_DIR
from .marker_history import HistoryError, MarkerHistory, MAX_COMMANDS, delete_candidate
from .store import get_data
from .validation import CONFIG_SCHEMA, LAYOUT_SCHEMA, MAX_CONFIG_BYTES

_ID = vol.All(str, vol.Match(r"^[A-Za-z0-9_-]{16,100}$"))
HISTORY_FIELDS = {vol.Optional("history_session"): _ID, vol.Optional("operation_id"): _ID,
                  vol.Optional("retained_tokens"): vol.All([_ID], vol.Length(max=MAX_COMMANDS - 1))}


def history(rt) -> MarkerHistory:
    if rt.marker_history is None:
        rt.marker_history = MarkerHistory()
    return rt.marker_history


def owner(connection):
    # Keep the bounded session's actual connection identity. Python may reuse
    # id(connection) after disconnect, so its integer is not an owner token.
    return (connection.user.id, connection)


def request_payload(msg):
    return {key: value for key, value in msg.items() if key != "id"}


def copy_begin(rt, connection, msg):
    """Legacy Copy remains unchanged when no structural capability was used."""
    if not msg.get("history_session") and not msg.get("operation_id"):
        return None, None
    if not msg.get("history_session") or not msg.get("operation_id"):
        raise HistoryError()
    session = history(rt).session(msg["history_session"], owner(connection), create=True)
    replay = history(rt).replay(session, msg["operation_id"], request_payload(msg))
    if not replay:
        history(rt).check_create(session, msg.get("retained_tokens"))
    return session, replay


def copy_prepare(rt, hass, previous, layout, target, positions, marker_id):
    return history(rt).prepare({"config": previous, "layout": layout},
                               {"config": target, "layout": positions}, {marker_id}, Path(hass.config.path(FILES_DIR)))


def copy_accept(rt, session, msg, command, result):
    if session is not None:
        history(rt).accept_create(session, msg.get("retained_tokens"), msg["operation_id"], command)
        result["history_token"] = msg["operation_id"]
        history(rt).receipt(session, msg["operation_id"], request_payload(msg), result)


async def replay_pair(hass, connection, msg, rt, receipt):
    from . import websocket_api as ws
    pair = await ws._resolved_write_pair(hass, connection, msg["id"], rt)
    if pair is None:
        return
    connection.send_result(msg["id"], {**receipt,
        "config": pair.config_data.get("config") or DEFAULT_CONFIG, "layout": pair.layout_data.get("layout") or {},
        "config_rev": int(pair.config_data.get("rev", 0)), "layout_rev": int(pair.layout_data.get("rev", 0))})


async def commit_history_pair(rt, session, pending, rollback):
    from . import websocket_api as ws
    previous = rt.marker_history_owner
    rt.marker_history_owner = session
    try:
        await ws._commit_pair(rt, pending, rollback)
    finally:
        rt.marker_history_owner = previous


async def _validate(hass, candidate, previous):
    from . import websocket_api as ws
    registry = ws.radar_registry_evidence(hass)

    def validate():
        config, positions = CONFIG_SCHEMA(candidate["config"]), LAYOUT_SCHEMA(candidate["layout"])
        if len(json.dumps(config, separators=(",", ":"))) > MAX_CONFIG_BYTES:
            raise vol.Invalid("Configuration is too large")
        ws.validate_active_marker_ids(config, previous)
        ws.validate_marker_controls(config, previous)
        ws.validate_marker_light_entities(config, previous)
        ws.validate_marker_radars(config, previous, registry=registry)
        ws.validate_marker_value_badges(config, previous)
        ws.validate_marker_vacuum_routes(config, previous)
        return config, positions

    return await hass.async_add_executor_job(validate)


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/marker/history",
    vol.Required("history_session"): _ID,
    vol.Required("operation_id"): _ID,
    vol.Required("action"): vol.In(["delete", "undo", "redo"]),
    vol.Optional("token"): _ID,
    vol.Optional("retained_tokens"): vol.All([_ID], vol.Length(max=MAX_COMMANDS - 1)),
    vol.Optional("targets"): vol.All([{vol.Required("id"): str, vol.Required("binding"): str}], vol.Length(min=1, max=20000)),
    vol.Required("expected_config_rev"): int,
    vol.Required("expected_layout_rev"): int,
})
@websocket_api.async_response
async def ws_marker_history(hass, connection, msg):
    from . import websocket_api as ws
    if not ws._check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Editing permission required")
        return
    rt = get_data(hass)
    if rt is None:
        connection.send_error(msg["id"], "not_ready", "House Plan is not set up")
        return
    service = history(rt)
    try:
        async with rt.write_lock:
            session = service.session(msg["history_session"], owner(connection), create=msg["action"] == "delete")
            replay = service.replay(session, msg["operation_id"], request_payload(msg))
            if replay is not None:
                await replay_pair(hass, connection, msg, rt, replay)
                return
            pair = await ws._resolved_write_pair(hass, connection, msg["id"], rt)
            if pair is None:
                return
            cd, ld = pair.config_data, pair.layout_data
            cr, lr = int(cd.get("rev", 0)), int(ld.get("rev", 0))
            if cr != msg["expected_config_rev"] or lr != msg["expected_layout_rev"]:
                connection.send_error(msg["id"], "conflict", "Plan changed elsewhere")
                return
            previous, layout = cd.get("config") or DEFAULT_CONFIG, ld.get("layout") or {}
            root = Path(hass.config.path(FILES_DIR))
            if msg["action"] == "delete":
                if not msg.get("targets") or msg.get("token"):
                    raise HistoryError("device_history_unavailable")
                service.check_create(session, msg.get("retained_tokens"))
                target, positions = delete_candidate(previous, layout, msg["targets"])
                ids = {item["id"] for item in msg["targets"]}
                ids |= {item["id"] for item in previous.get("markers") or []
                        if item.get("binding") != "virtual" and any(item.get("binding") == t["binding"] for t in msg["targets"])}
                command = await hass.async_add_executor_job(service.prepare,
                    {"config": previous, "layout": layout}, {"config": target, "layout": positions}, ids, root)
                service.check_bytes(session, command, msg.get("retained_tokens"))
                token, forward = msg["operation_id"], True
            else:
                token, forward = msg.get("token"), msg["action"] == "redo"
                command = session.commands.get(token)
                if command is None or msg.get("targets"):
                    raise HistoryError("device_history_unavailable")
                candidate = await hass.async_add_executor_job(service.candidate, command,
                    {"config": previous, "layout": layout}, forward, root)
                target, positions = candidate["config"], candidate["layout"]
            target, positions = await _validate(hass, {"config": target, "layout": positions}, previous)
            if not ws._check_write(hass, connection):
                connection.send_error(msg["id"], "unauthorized", "Editing permission was lost")
                return
            original = ws._layout_metadata(ld)
            final = {key: value for key, value in original.items()
                     if key not in {ws._OPTIMIZE_BACKUP, ws._OPTIMIZE_PENDING, "repair_backup", "geom_pending"}}
            await commit_history_pair(rt, session, {"kind": "marker_history", "config": target, "layout": positions,
                                      "config_rev": cr + 1, "layout_rev": lr + 1, "final_metadata": final},
                                  {"kind": "marker_history_rollback", "config": previous, "layout": layout,
                                   "config_rev": cr, "layout_rev": lr, "final_metadata": original})
            command.after = forward
            if msg["action"] == "delete":
                service.accept_create(session, msg.get("retained_tokens"), token, command)
            else:
                session.commands[token] = command
            result = {"config": target, "layout": positions, "config_rev": cr + 1, "layout_rev": lr + 1,
                      "history_token": token}
            service.receipt(session, msg["operation_id"], request_payload(msg), result)
            # Runtime trails never form part of a reversible configuration delta.
            await ws._purge_trail_recorder(hass, target)
    except HistoryError as error:
        connection.send_error(msg["id"], error.code, "Device history is no longer applicable")
        return
    except (vol.Invalid, ws.DuplicateMarkerIdError, ws.MarkerControlError, ws.RadarValidationError):
        connection.send_error(msg["id"], "device_history_conflict", "Related data changed")
        return
    except ws.PairCommitFailure:
        connection.send_error(msg["id"], "commit_failed", "Device history save failed")
        return
    hass.bus.async_fire("houseplan_config_updated", {"rev": cr + 1})
    hass.bus.async_fire("houseplan_layout_updated", {"rev": lr + 1})
    ws._refresh_trail_recorder(hass)
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command({
    vol.Required("type"): "houseplan/marker/history/retain",
    vol.Required("history_session"): _ID,
    vol.Required("tokens"): vol.All([_ID], vol.Length(max=MAX_COMMANDS)),
})
@websocket_api.async_response
async def ws_marker_history_retain(hass, connection, msg):
    from . import websocket_api as ws
    if not ws._check_write(hass, connection):
        connection.send_error(msg["id"], "unauthorized", "Editing permission required")
        return
    rt = get_data(hass)
    if rt is None:
        connection.send_error(msg["id"], "not_ready", "House Plan is not set up")
        return
    try:
        async with rt.write_lock:
            service = history(rt)
            session = service.session(msg["history_session"], owner(connection))
            service.release(session, msg["tokens"])
            cd = await rt.config_store.async_load() or {}
            await hass.async_add_executor_job(service.collect, Path(hass.config.path(FILES_DIR)), cd.get("config") or {})
    except HistoryError as error:
        connection.send_error(msg["id"], error.code, "History lease expired")
        return
    connection.send_result(msg["id"], {"ok": True})


def async_register(hass):
    websocket_api.async_register_command(hass, ws_marker_history)
    websocket_api.async_register_command(hass, ws_marker_history_retain)
