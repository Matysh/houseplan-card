"""Permission, lifecycle and back-pressure witnesses for radar WebSockets."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from custom_components.houseplan import radar_websocket as radar_ws
from custom_components.houseplan.radar import RadarCoordinator
from custom_components.houseplan.radar_validation import radar_source_entity_ids


class _Permissions:
    def __init__(self, allowed: bool = True, denied: set[str] | None = None) -> None:
        self.allowed = allowed
        self.denied = denied or set()
        self.checked: list[tuple[str, str]] = []

    def check_entity(self, entity_id: str, policy: str) -> bool:
        self.checked.append((entity_id, policy))
        return self.allowed and entity_id not in self.denied


class _Connection:
    def __init__(
        self, *, allowed: bool = True, denied: set[str] | None = None,
    ) -> None:
        self.user = SimpleNamespace(
            id="user-1", permissions=_Permissions(allowed, denied),
        )
        self.subscriptions: dict[int, object] = {}
        self.results: list[tuple[int, object]] = []
        self.errors: list[tuple[int, str, str]] = []
        self.events: list[tuple[int, object]] = []

    def send_result(self, msg_id: int, result: object) -> None:
        self.results.append((msg_id, result))

    def send_error(self, msg_id: int, code: str, message: str) -> None:
        self.errors.append((msg_id, code, message))

    def send_event(self, msg_id: int, event: object) -> None:
        self.events.append((msg_id, event))


class _Coordinator:
    def __init__(self, source_ids: set[str] | None = None) -> None:
        self.hass = SimpleNamespace(states={
            "sensor.x": SimpleNamespace(state="1"),
        })
        self._source_ids = source_ids or {"sensor.x"}
        self.closed = False
        self.server_session_id = "session-1"
        self.config_rev = 7
        self.config = {"markers": []}
        self.radars = {"radar": {"id": "radar", "radar": {"version": 1}}}
        self.listener = None
        self.listener_removed = False
        self.external_cleanup = None

    def has_space(self, space_id: str) -> bool:
        return space_id == "floor"

    def source_ids(self, marker_id: str) -> set[str]:
        return self._source_ids if marker_id == "radar" else set()

    def space_for_marker(self, marker_id: str) -> str | None:
        return "floor" if marker_id == "radar" else "other"

    def frames_for_space(self, _space_id: str) -> list[dict]:
        return [{"marker_id": "radar", "seq": 3, "targets": []}]

    @staticmethod
    def public_frame(frame: dict) -> dict:
        return {**frame, "public": True}

    def add_listener(self, listener, *, publish_initial: bool = True):
        assert publish_initial is False
        self.listener = listener

        def remove() -> None:
            self.listener_removed = True

        return remove

    def inspect(self, marker_id: str) -> dict:
        return {"marker_id": marker_id, "health": "ok"}

    def inspect_draft(self, marker: dict, radar: dict) -> dict:
        return {"marker_id": marker["id"], "profile": radar.get("profile")}

    def marker_config(self, marker_id: str) -> dict | None:
        return self.radars.get(marker_id)

    def add_external_cleanup(self, cleanup):
        self.external_cleanup = cleanup

        def unregister() -> None:
            self.external_cleanup = None

        return unregister


def _radar_config(profile: str, sources: dict) -> tuple[dict, dict, dict]:
    radar = {
        "version": 1, "enabled": True, "profile": profile,
        "sources": sources,
        "mount": {
            "installation_id": "installation-1", "x": .5, "y": .5,
            "heading_deg": 0, "range_cm": 600, "fov_deg": 120,
        },
        "room_id": "living",
        "calibration": {"method": "manual", "mirror": False, "cell_cm": 5},
    }
    marker = {
        "id": "radar", "binding": "device:radar", "space": "floor",
        "radar": radar,
    }
    config = {
        "spaces": [{
            "id": "floor", "cell_cm": 5,
            "rooms": [{
                "id": "living",
                "poly": [[.1, .1], [.9, .1], [.9, .9], [.1, .9]],
            }],
        }],
        "markers": [marker], "settings": {},
    }
    return config, marker, radar


@pytest.fixture(autouse=True)
def _clear_radar_ws_state(monkeypatch):
    monkeypatch.setattr(radar_ws, "radar_registry_evidence", lambda _hass: {})
    radar_ws._INSPECT_CALLS.clear()
    radar_ws._ACTIVE_SUBSCRIPTIONS.clear()
    radar_ws._ACTIVE_SETUP.clear()
    yield
    radar_ws._INSPECT_CALLS.clear()
    radar_ws._ACTIVE_SUBSCRIPTIONS.clear()
    radar_ws._ACTIVE_SETUP.clear()


def test_registers_all_radar_commands(monkeypatch, hass) -> None:
    registered = []
    monkeypatch.setattr(radar_ws.websocket_api, "async_register_command",
                        lambda _hass, command: registered.append(command))
    radar_ws.async_register(hass)
    assert registered == [
        radar_ws.ws_radar_subscribe,
        radar_ws.ws_radar_setup_inspect,
        radar_ws.ws_radar_setup_subscribe,
    ]


def test_coordinator_lookup_and_read_permissions(monkeypatch, hass) -> None:
    connection = _Connection()
    monkeypatch.setattr(radar_ws, "get_data", lambda _hass: None)
    assert radar_ws._coordinator(hass, connection, 1) is None
    assert connection.errors[-1][1] == "not_ready"

    monkeypatch.setattr(radar_ws, "get_data", lambda _hass: SimpleNamespace())
    assert radar_ws._coordinator(hass, connection, 2) is None
    assert connection.errors[-1][1] == "unsupported_capability"

    coordinator = RadarCoordinator(hass, SimpleNamespace())
    monkeypatch.setattr(
        radar_ws, "get_data", lambda _hass: SimpleNamespace(radar_coordinator=coordinator),
    )
    assert radar_ws._coordinator(hass, connection, 3) is coordinator
    coordinator.closed = True
    assert radar_ws._coordinator(hass, connection, 4) is None
    assert radar_ws._can_read(connection, {"sensor.x"}) is True
    connection.user.permissions.allowed = False
    assert radar_ws._can_read(connection, {"sensor.x"}) is False
    connection.user.permissions = None
    assert radar_ws._can_read(connection, set()) is False


def test_rate_limit_prunes_old_calls() -> None:
    now = radar_ws.time.monotonic()
    radar_ws._INSPECT_CALLS["user"].extend([now] * 10)
    assert radar_ws._rate_limit("user") is False
    radar_ws._INSPECT_CALLS["user"].clear()
    radar_ws._INSPECT_CALLS["user"].append(now - 61)
    assert radar_ws._rate_limit("user") is True


def test_live_subscribe_publishes_filters_and_cleans_up(monkeypatch, hass) -> None:
    coordinator = _Coordinator()
    connection = _Connection()
    monkeypatch.setattr(radar_ws, "_coordinator", lambda *_args: coordinator)
    radar_ws.ws_radar_subscribe(hass, connection, {"id": 1, "space_id": "floor"})

    assert connection.results[-1][1] == {"server_session_id": "session-1", "config_rev": 7}
    assert connection.events[-1][1]["public"] is True
    assert radar_ws._ACTIVE_SUBSCRIPTIONS["user-1"] == 1
    assert coordinator.listener is not None
    coordinator.listener("other", {"seq": 4})
    assert len(connection.events) == 1
    connection.user.permissions.allowed = False
    coordinator.listener("radar", {"seq": 5})
    assert connection.events[-1][1]["health"] == "restricted"

    connection.subscriptions[1]()
    assert coordinator.listener_removed is True
    assert "user-1" not in radar_ws._ACTIVE_SUBSCRIPTIONS


def test_live_subscribe_rejects_unknown_space_and_connection_limit(monkeypatch, hass) -> None:
    coordinator = _Coordinator()
    connection = _Connection()
    monkeypatch.setattr(radar_ws, "_coordinator", lambda *_args: coordinator)
    radar_ws.ws_radar_subscribe(hass, connection, {"id": 1, "space_id": "missing"})
    assert connection.errors[-1][1] == "invalid_selection"
    radar_ws._ACTIVE_SUBSCRIPTIONS["user-1"] = 4
    radar_ws.ws_radar_subscribe(hass, connection, {"id": 2, "space_id": "floor"})
    assert connection.errors[-1][1] == "rate_limited"


def test_draft_validation_size_permission_and_success(monkeypatch) -> None:
    coordinator = _Coordinator()
    connection = _Connection()
    marker = {"id": "radar"}
    radar = {"profile": "cartesian_v1"}
    monkeypatch.setattr(
        radar_ws, "validate_radar_draft", lambda *_args: (marker, {"sensor.x"}),
    )
    message = {"id": 1, "marker_id": "radar", "draft_sources": {"radar": radar}}
    assert radar_ws._validated_draft(coordinator, message, connection) == (
        marker, radar, {"sensor.x"},
    )
    connection.user.permissions.allowed = False
    assert radar_ws._validated_draft(coordinator, message, connection) is None
    assert connection.errors[-1][1] == "source_restricted"
    huge = {"id": 2, "marker_id": "radar", "draft_sources": {"x": "x" * 66000}}
    assert radar_ws._validated_draft(coordinator, huge, connection) is None
    assert connection.errors[-1][1] == "invalid_selection"


def test_draft_validation_reports_unavailable_sources(monkeypatch) -> None:
    coordinator = _Coordinator()
    coordinator.hass.states = {}
    connection = _Connection()
    marker = {"id": "radar"}
    radar = {"profile": "cartesian_v1"}
    monkeypatch.setattr(
        radar_ws, "validate_radar_draft", lambda *_args: (marker, {"sensor.x"}),
    )

    assert radar_ws._validated_draft(
        coordinator,
        {"id": 1, "marker_id": "radar", "draft_sources": {"radar": radar}},
        connection,
    ) is None
    assert connection.errors[-1][1] == "source_unavailable"


def test_draft_validation_reports_stable_radar_error(monkeypatch) -> None:
    coordinator = _Coordinator()
    connection = _Connection()

    def reject(*_args):
        raise radar_ws.RadarValidationError("bad")

    monkeypatch.setattr(radar_ws, "validate_radar_draft", reject)
    assert radar_ws._validated_draft(
        coordinator,
        {"id": 1, "marker_id": "radar", "draft_sources": {"radar": {}}},
        connection,
    ) is None
    assert connection.errors[-1][1] == "invalid_radar"


def test_setup_inspect_permissions_limits_saved_and_draft(monkeypatch, hass) -> None:
    coordinator = _Coordinator()
    connection = _Connection()
    monkeypatch.setattr(radar_ws, "_coordinator", lambda *_args: coordinator)
    monkeypatch.setattr(radar_ws, "may_write", lambda *_args: False)
    radar_ws.ws_radar_setup_inspect(hass, connection, {"id": 1, "marker_id": "radar"})
    assert connection.errors[-1][1] == "unauthorized"

    monkeypatch.setattr(radar_ws, "may_write", lambda *_args: True)
    connection.user.permissions.allowed = False
    radar_ws.ws_radar_setup_inspect(hass, connection, {"id": 2, "marker_id": "radar"})
    assert connection.errors[-1][1] == "source_restricted"
    connection.user.permissions.allowed = True
    radar_ws.ws_radar_setup_inspect(hass, connection, {"id": 3, "marker_id": "radar"})
    assert connection.results[-1][1]["health"] == "ok"

    monkeypatch.setattr(
        radar_ws, "_validated_draft",
        lambda *_args: ({"id": "radar"}, {"profile": "range_v1"}, set()),
    )
    radar_ws.ws_radar_setup_inspect(
        hass, connection,
        {"id": 4, "marker_id": "radar", "draft_sources": {}},
    )
    assert connection.results[-1][1]["profile"] == "range_v1"
    monkeypatch.setattr(radar_ws, "_rate_limit", lambda _user_id: False)
    radar_ws.ws_radar_setup_inspect(hass, connection, {"id": 5, "marker_id": "radar"})
    assert connection.errors[-1][1] == "rate_limited"


def test_setup_subscribe_guards_and_missing_marker(monkeypatch, hass) -> None:
    coordinator = _Coordinator()
    connection = _Connection()
    monkeypatch.setattr(radar_ws, "_coordinator", lambda *_args: coordinator)
    monkeypatch.setattr(radar_ws, "may_write", lambda *_args: False)
    base = {"marker_id": "radar", "expected_config_rev": 7}
    radar_ws.ws_radar_setup_subscribe(hass, connection, {"id": 1, **base})
    assert connection.errors[-1][1] == "unauthorized"

    monkeypatch.setattr(radar_ws, "may_write", lambda *_args: True)
    radar_ws.ws_radar_setup_subscribe(
        hass, connection, {"id": 2, **base, "expected_config_rev": 6},
    )
    assert connection.errors[-1][1] == "conflict"
    radar_ws._ACTIVE_SETUP.add(("user-1", "radar"))
    radar_ws.ws_radar_setup_subscribe(hass, connection, {"id": 3, **base})
    assert connection.errors[-1][1] == "rate_limited"
    radar_ws._ACTIVE_SETUP.clear()
    coordinator.radars.clear()
    radar_ws.ws_radar_setup_subscribe(hass, connection, {"id": 4, **base})
    assert connection.errors[-1][1] == "invalid_selection"


@pytest.mark.asyncio
async def test_setup_subscription_coalesces_restricts_and_removes(monkeypatch, hass) -> None:
    coordinator = _Coordinator()
    connection = _Connection()
    callbacks = []
    cleanups = []
    monkeypatch.setattr(radar_ws, "_coordinator", lambda *_args: coordinator)
    monkeypatch.setattr(radar_ws, "may_write", lambda *_args: True)

    def track(_hass, _ids, callback):
        callbacks.append(callback)

        def cleanup() -> None:
            cleanups.append(True)

        return cleanup

    monkeypatch.setattr(radar_ws, "async_track_state_report_event", track)
    monkeypatch.setattr(radar_ws, "async_track_state_change_event", track)
    message = {"id": 9, "marker_id": "radar", "expected_config_rev": 7}
    radar_ws.ws_radar_setup_subscribe(hass, connection, message)
    assert connection.results
    assert connection.events[-1][1]["marker_id"] == "radar"
    assert ("user-1", "radar") in radar_ws._ACTIVE_SETUP

    callbacks[0](None)
    callbacks[1](None)
    connection.user.permissions.allowed = False
    await asyncio.sleep(1 / radar_ws.MAX_FRAME_HZ + .05)
    assert connection.events[-1][1]["health"] == "restricted"

    connection.subscriptions[9]()
    connection.subscriptions[9]()
    assert len(cleanups) == 2
    assert ("user-1", "radar") not in radar_ws._ACTIVE_SETUP
    assert coordinator.external_cleanup is None


@pytest.mark.asyncio
@pytest.mark.parametrize(("profile", "sources", "source_id"), [
    (
        "range_v1",
        {"ranges": [{"id": "range", "entity_id": "sensor.distance", "unit": "m"}]},
        "sensor.distance",
    ),
    (
        "zones_v1",
        {"zones": [{
            "id": "zone", "entity_id": "binary_sensor.zone", "kind": "occupancy",
        }]},
        "binary_sensor.zone",
    ),
])
async def test_setup_subscribes_to_range_and_zone_primary_sources(
    monkeypatch, hass, profile, sources, source_id,
) -> None:
    config, marker, radar = _radar_config(profile, sources)
    coordinator = _Coordinator(radar_source_entity_ids(radar))
    coordinator.config = config
    coordinator.radars = {"radar": marker}
    coordinator.hass.states = {source_id: SimpleNamespace(state="1")}
    tracks = []
    cleanups = []
    monkeypatch.setattr(radar_ws, "_coordinator", lambda *_args: coordinator)
    monkeypatch.setattr(radar_ws, "may_write", lambda *_args: True)

    def track(_hass, entity_ids, callback):
        tracks.append((tuple(entity_ids), callback))

        def cleanup() -> None:
            cleanups.append(tuple(entity_ids))

        return cleanup

    monkeypatch.setattr(radar_ws, "async_track_state_report_event", track)
    monkeypatch.setattr(radar_ws, "async_track_state_change_event", track)

    saved = _Connection()
    message = {"id": 10, "marker_id": "radar", "expected_config_rev": 7}
    radar_ws.ws_radar_setup_subscribe(hass, saved, message)
    assert [ids for ids, _callback in tracks] == [(source_id,), (source_id,)]
    initial_events = len(saved.events)
    tracks[0][1](None)
    await asyncio.sleep(1 / radar_ws.MAX_FRAME_HZ + .05)
    assert len(saved.events) == initial_events + 1
    saved.subscriptions[10]()

    draft = _Connection()
    radar_ws.ws_radar_setup_subscribe(
        hass, draft, {**message, "id": 11, "draft_sources": {"radar": radar}},
    )
    assert [ids for ids, _callback in tracks[2:]] == [(source_id,), (source_id,)]
    draft.subscriptions[11]()
    assert cleanups == [(source_id,)] * 4


@pytest.mark.parametrize(("profile", "sources", "source_id"), [
    (
        "range_v1",
        {"ranges": [{"id": "range", "entity_id": "sensor.distance", "unit": "m"}]},
        "sensor.distance",
    ),
    (
        "zones_v1",
        {"zones": [{
            "id": "zone", "entity_id": "binary_sensor.zone", "kind": "occupancy",
        }]},
        "binary_sensor.zone",
    ),
])
def test_range_and_zone_primary_sources_are_permission_checked_fail_closed(
    monkeypatch, hass, profile, sources, source_id,
) -> None:
    config, marker, radar = _radar_config(profile, sources)
    coordinator = _Coordinator(radar_source_entity_ids(radar))
    coordinator.config = config
    coordinator.radars = {"radar": marker}
    coordinator.hass.states = {source_id: SimpleNamespace(state="1")}
    coordinator.frames_for_space = lambda _space_id: [{
        "marker_id": "radar", "seq": 8,
        "targets": [{"x": .5, "y": .5}],
        "ranges": [{"id": "secret-range", "radius": .5}],
        "zones": [{"id": "secret-zone", "state": True}],
    }]
    monkeypatch.setattr(radar_ws, "_coordinator", lambda *_args: coordinator)
    monkeypatch.setattr(radar_ws, "may_write", lambda *_args: True)

    saved = _Connection(denied={source_id})
    radar_ws.ws_radar_setup_inspect(
        hass, saved, {"id": 20, "marker_id": "radar"},
    )
    assert saved.errors[-1][1] == "source_restricted"
    assert saved.results == []

    draft = _Connection(denied={source_id})
    radar_ws.ws_radar_setup_inspect(
        hass, draft, {
            "id": 21, "marker_id": "radar", "draft_sources": {"radar": radar},
        },
    )
    assert draft.errors[-1][1] == "source_restricted"
    assert draft.results == []

    live = _Connection(denied={source_id})
    radar_ws.ws_radar_subscribe(hass, live, {"id": 22, "space_id": "floor"})
    restricted = live.events[-1][1]
    assert restricted["health"] == "restricted"
    assert restricted["targets"] == []
    assert restricted["ranges"] == []
    assert restricted["zones"] == []
    assert {
        entity_id
        for connection in (saved, draft, live)
        for entity_id, _policy in connection.user.permissions.checked
    } == {source_id}


def test_setup_subscribe_draft_failure_and_source_restriction(monkeypatch, hass) -> None:
    coordinator = _Coordinator()
    connection = _Connection(allowed=False)
    monkeypatch.setattr(radar_ws, "_coordinator", lambda *_args: coordinator)
    monkeypatch.setattr(radar_ws, "may_write", lambda *_args: True)
    base = {"marker_id": "radar", "expected_config_rev": 7}
    radar_ws.ws_radar_setup_subscribe(hass, connection, {"id": 1, **base})
    assert connection.errors[-1][1] == "source_restricted"

    monkeypatch.setattr(radar_ws, "_validated_draft", lambda *_args: None)
    radar_ws.ws_radar_setup_subscribe(
        hass, connection, {"id": 2, **base, "draft_sources": {}},
    )
    assert 2 not in connection.subscriptions
