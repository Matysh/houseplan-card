"""HA-state witnesses for the Stage-1 radar coordinator (#485)."""
from __future__ import annotations

import copy
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from homeassistant.core import HomeAssistant

from custom_components.houseplan.radar import RadarCoordinator


def _stored(profile: str = "esphome_ld2450_v1") -> dict:
    slot = {
        "id": "target_1", "x_entity": "sensor.radar_target_1_x",
        "y_entity": "sensor.radar_target_1_y", "unit": "mm",
    }
    return {"rev": 7, "config": {
        "spaces": [{"id": "floor", "cell_cm": 5, "rooms": [{
            "id": "living", "poly": [[.1, .1], [.9, .1], [.9, .9], [.1, .9]],
        }]}],
        "markers": [{
            "id": "radar", "binding": "device:radar", "space": "floor",
            "radar": {
                "version": 1, "enabled": True, "profile": profile,
                "sources": {"slots": [slot], "occupancy_entity": "binary_sensor.radar_presence"},
                "mount": {"installation_id": "installation-1", "x": .5, "y": .5,
                          "heading_deg": 0, "range_cm": 600, "fov_deg": 120},
                "room_id": "living",
                "calibration": {"method": "manual", "mirror": False, "cell_cm": 5},
            },
        }], "settings": {},
    }}


async def _coordinator(hass: HomeAssistant, document: dict) -> RadarCoordinator:
    runtime = SimpleNamespace(config_store=AsyncMock())
    runtime.config_store.async_load.return_value = document
    coordinator = RadarCoordinator(hass, runtime)
    await coordinator.async_setup()
    return coordinator


@pytest.mark.asyncio
async def test_ld2450_pair_zero_is_absent_but_single_zero_axis_is_valid(
    hass: HomeAssistant,
) -> None:
    hass.states.async_set("binary_sensor.radar_presence", "on")
    hass.states.async_set("sensor.radar_target_1_x", "0")
    hass.states.async_set("sensor.radar_target_1_y", "1000")
    coordinator = await _coordinator(hass, _stored())
    frame = coordinator.frames_for_space("floor")[0]
    assert frame["health"] == "ok"
    assert frame["targets"][0]["x"] == pytest.approx(.5)
    assert frame["targets"][0]["y"] == pytest.approx(.5 - 100 / 1200)

    hass.states.async_set("sensor.radar_target_1_y", "0")
    coordinator._publish_all(force=True)
    frame = coordinator.frames_for_space("floor")[0]
    assert frame["targets"] == []
    assert frame["complete"] is True
    coordinator.teardown()


@pytest.mark.asyncio
async def test_generic_cartesian_origin_is_not_treated_as_absence(
    hass: HomeAssistant,
) -> None:
    document = _stored("cartesian_v1")
    document["config"]["markers"][0]["radar"]["sources"]["slots"][0]["unit"] = "mm"
    hass.states.async_set("binary_sensor.radar_presence", "on")
    hass.states.async_set("sensor.radar_target_1_x", "0")
    hass.states.async_set("sensor.radar_target_1_y", "0")
    coordinator = await _coordinator(hass, document)
    frame = coordinator.frames_for_space("floor")[0]
    assert [(item["x"], item["y"]) for item in frame["targets"]] == [(.5, .5)]
    coordinator.teardown()


@pytest.mark.asyncio
async def test_room_removal_and_scale_change_suspend_projection(
    hass: HomeAssistant,
) -> None:
    hass.states.async_set("binary_sensor.radar_presence", "on")
    hass.states.async_set("sensor.radar_target_1_x", "100")
    hass.states.async_set("sensor.radar_target_1_y", "1000")
    document = _stored()
    coordinator = await _coordinator(hass, document)
    marker = coordinator.radars["radar"]
    marker["radar"]["room_id"] = "removed"
    assert coordinator._build_frame("radar", marker, frame_now := coordinator._frames["radar"]["reported_at"])["health"] == "needs_setup"
    marker["radar"]["room_id"] = "living"
    coordinator.config["spaces"][0]["cell_cm"] = 10
    assert coordinator._build_frame("radar", marker, frame_now)["health"] == "needs_setup"
    coordinator.teardown()


@pytest.mark.asyncio
async def test_smoothing_is_bounded_and_does_not_bridge_a_gap(
    hass: HomeAssistant,
) -> None:
    hass.states.async_set("binary_sensor.radar_presence", "on")
    hass.states.async_set("sensor.radar_target_1_x", "0")
    hass.states.async_set("sensor.radar_target_1_y", "1000")
    coordinator = await _coordinator(hass, _stored())
    previous = coordinator._frames["radar"]

    nearby = copy.deepcopy(previous)
    nearby["targets"][0]["x"] += 50 / (240 * 5)
    nearby["targets"][0]["reported_at"] += .5
    coordinator._annotate_smoothing("radar", coordinator.radars["radar"], nearby)
    assert nearby["targets"][0]["smooth"] is True

    jump = copy.deepcopy(previous)
    jump["targets"][0]["x"] += 101 / (240 * 5)
    jump["targets"][0]["reported_at"] += .5
    coordinator._annotate_smoothing("radar", coordinator.radars["radar"], jump)
    assert "smooth" not in jump["targets"][0]

    after_gap = copy.deepcopy(previous)
    after_gap["targets"][0]["reported_at"] = previous["targets"][0]["expires_at"] + .1
    coordinator._annotate_smoothing("radar", coordinator.radars["radar"], after_gap)
    assert "smooth" not in after_gap["targets"][0]
    coordinator.teardown()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("availability", "health"),
    [("off", "off"), ("unavailable", "unavailable")],
)
async def test_availability_blocks_radar_geometry(
    hass: HomeAssistant, availability: str, health: str,
) -> None:
    document = _stored()
    sources = document["config"]["markers"][0]["radar"]["sources"]
    sources["availability_entity"] = "binary_sensor.radar_available"
    hass.states.async_set("binary_sensor.radar_available", availability)
    hass.states.async_set("binary_sensor.radar_presence", "on")
    hass.states.async_set("sensor.radar_target_1_x", "100")
    hass.states.async_set("sensor.radar_target_1_y", "1000")

    coordinator = await _coordinator(hass, document)
    frame = coordinator.frames_for_space("floor")[0]
    assert frame["health"] == health
    assert frame["targets"] == []
    coordinator.teardown()


@pytest.mark.asyncio
async def test_occupancy_off_clears_geometry_without_waiting_for_coordinates(
    hass: HomeAssistant,
) -> None:
    hass.states.async_set("binary_sensor.radar_presence", "off")
    coordinator = await _coordinator(hass, _stored())
    frame = coordinator.frames_for_space("floor")[0]

    assert frame["reported_presence"] is False
    assert frame["health"] == "off"
    assert frame["complete"] is True
    assert frame["targets"] == []
    assert frame["expires_at"] > frame["reported_at"]
    coordinator.teardown()


@pytest.mark.asyncio
async def test_outside_room_target_is_retained_privately_but_not_published(
    hass: HomeAssistant,
) -> None:
    hass.states.async_set("binary_sensor.radar_presence", "on")
    hass.states.async_set("sensor.radar_target_1_x", "5000")
    hass.states.async_set("sensor.radar_target_1_y", "0")
    coordinator = await _coordinator(hass, _stored())

    private = coordinator.frame("radar")
    assert private is not None
    assert private["targets"][0]["included"] is False
    assert private["targets"][0]["reason"] == "outside_room"
    assert coordinator.public_frame(private)["targets"] == []
    coordinator.teardown()


@pytest.mark.asyncio
async def test_count_zero_marks_reported_target_inconsistent(
    hass: HomeAssistant,
) -> None:
    document = _stored()
    document["config"]["markers"][0]["radar"]["sources"]["count_entity"] = \
        "sensor.radar_target_count"
    hass.states.async_set("binary_sensor.radar_presence", "on")
    hass.states.async_set("sensor.radar_target_count", "0")
    hass.states.async_set("sensor.radar_target_1_x", "100")
    hass.states.async_set("sensor.radar_target_1_y", "1000")

    coordinator = await _coordinator(hass, document)
    frame = coordinator.frames_for_space("floor")[0]
    assert frame["health"] == "inconsistent"
    assert frame["complete"] is False
    assert len(frame["targets"]) == 1
    coordinator.teardown()


@pytest.mark.asyncio
async def test_count_zero_confirms_empty_scene(
    hass: HomeAssistant,
) -> None:
    document = _stored()
    document["config"]["markers"][0]["radar"]["sources"]["count_entity"] = \
        "sensor.radar_target_count"
    hass.states.async_set("binary_sensor.radar_presence", "on")
    hass.states.async_set("sensor.radar_target_count", "0")
    hass.states.async_set("sensor.radar_target_1_x", "0")
    hass.states.async_set("sensor.radar_target_1_y", "0")

    coordinator = await _coordinator(hass, document)
    frame = coordinator.frames_for_space("floor")[0]
    assert frame["health"] == "off"
    assert frame["complete"] is True
    assert frame["targets"] == []
    coordinator.teardown()


@pytest.mark.asyncio
async def test_invalid_coordinate_state_reports_position_unavailable(
    hass: HomeAssistant,
) -> None:
    hass.states.async_set("binary_sensor.radar_presence", "on")
    hass.states.async_set("sensor.radar_target_1_x", "unknown")
    hass.states.async_set("sensor.radar_target_1_y", "1000")
    coordinator = await _coordinator(hass, _stored())
    frame = coordinator.frames_for_space("floor")[0]

    assert frame["health"] == "position_unavailable"
    assert frame["complete"] is False
    assert frame["targets"] == []
    coordinator.teardown()


@pytest.mark.asyncio
async def test_teardown_releases_frames_and_subscriptions(
    hass: HomeAssistant,
) -> None:
    hass.states.async_set("binary_sensor.radar_presence", "off")
    coordinator = await _coordinator(hass, _stored())
    assert coordinator.frames_for_space("floor")
    assert coordinator._unsub_sources

    coordinator.teardown()

    assert coordinator.closed is True
    assert coordinator.frames_for_space("floor") == []
    assert coordinator._unsub_sources == []


@pytest.mark.asyncio
async def test_presence_only_profile_reports_without_geometry(
    hass: HomeAssistant,
) -> None:
    document = _stored("presence_v1")
    radar = document["config"]["markers"][0]["radar"]
    radar["sources"] = {"occupancy_entity": "binary_sensor.radar_presence"}
    hass.states.async_set("binary_sensor.radar_presence", "on")

    coordinator = await _coordinator(hass, document)
    frame = coordinator.frame("radar")
    assert frame is not None
    assert frame["health"] == "ok"
    assert frame["reported_presence"] is True
    assert frame["complete"] is True
    assert frame["expires_at"] is None
    assert coordinator.inspect("radar")["capabilities"] == ["reported_presence"]
    coordinator.teardown()


@pytest.mark.asyncio
async def test_zone_profile_normalizes_occupancy_and_count(
    hass: HomeAssistant,
) -> None:
    document = _stored("zones_v1")
    radar = document["config"]["markers"][0]["radar"]
    radar["sources"] = {"zones": [
        {"id": "desk", "entity_id": "binary_sensor.desk", "kind": "occupancy"},
        {"id": "people", "entity_id": "sensor.people", "kind": "count"},
    ]}
    hass.states.async_set("binary_sensor.desk", "on")
    hass.states.async_set("sensor.people", "2")

    coordinator = await _coordinator(hass, document)
    frame = coordinator.frame("radar")
    assert frame is not None
    assert frame["health"] == "ok"
    assert frame["complete"] is True
    assert frame["zones"] == [
        {"id": "desk", "state": True}, {"id": "people", "state": 2.0},
    ]
    assert coordinator.inspect("radar")["capabilities"] == ["zone_state"]
    coordinator.teardown()


@pytest.mark.asyncio
async def test_range_profile_clips_arc_to_owner_room(
    hass: HomeAssistant,
) -> None:
    document = _stored("range_v1")
    radar = document["config"]["markers"][0]["radar"]
    radar["sources"] = {"ranges": [{
        "id": "distance", "entity_id": "sensor.radar_distance", "unit": "m",
        "presence_entity": "binary_sensor.radar_presence",
    }]}
    hass.states.async_set("binary_sensor.radar_presence", "on")
    hass.states.async_set("sensor.radar_distance", "2")

    coordinator = await _coordinator(hass, document)
    frame = coordinator.frame("radar")
    assert frame is not None
    assert frame["health"] == "ok"
    assert frame["complete"] is True
    assert frame["ranges"][0]["radius"] == pytest.approx(200 / 1200)
    assert frame["ranges"][0]["segments"]
    assert coordinator.inspect("radar")["capabilities"] == ["range"]
    coordinator.teardown()


@pytest.mark.asyncio
async def test_polar_profile_projects_explicit_bearing(
    hass: HomeAssistant,
) -> None:
    document = _stored("polar_v1")
    radar = document["config"]["markers"][0]["radar"]
    radar["sources"] = {"slots": [{
        "id": "target_1", "distance_entity": "sensor.radar_distance",
        "angle_entity": "sensor.radar_angle", "unit": "cm",
        "angle_unit": "degrees", "angle_zero": "forward",
        "angle_clockwise": True,
    }]}
    hass.states.async_set("sensor.radar_distance", "100")
    hass.states.async_set("sensor.radar_angle", "90")

    coordinator = await _coordinator(hass, document)
    frame = coordinator.frame("radar")
    assert frame is not None
    assert frame["health"] == "ok"
    assert frame["targets"][0]["x"] == pytest.approx(.5 + 100 / 1200)
    assert frame["targets"][0]["y"] == pytest.approx(.5)
    coordinator.teardown()


@pytest.mark.asyncio
async def test_coordinator_query_and_listener_lifecycle(
    hass: HomeAssistant,
) -> None:
    hass.states.async_set("binary_sensor.radar_presence", "off")
    coordinator = await _coordinator(hass, _stored())
    public_events = []
    internal_events = []
    remove_public = coordinator.add_listener(
        lambda marker_id, frame: public_events.append((marker_id, frame)),
    )
    remove_internal = coordinator.add_internal_listener(
        lambda marker_id, frame: internal_events.append((marker_id, frame)),
    )
    assert public_events[0][0] == "radar"
    assert coordinator.has_space("floor") is True
    assert coordinator.has_space("missing") is False
    assert coordinator.space_for_marker("missing") is None
    assert coordinator.marker_config("radar")["id"] == "radar"
    assert coordinator.marker_config("missing") is None
    assert coordinator.source_ids("missing") == set()
    assert coordinator.inspect("missing")["health"] == "not_configured"

    coordinator._publish_all(force=True)
    assert internal_events[-1][0] == "radar"
    remove_public()
    remove_internal()
    assert coordinator._unsub_tick is None
    coordinator.teardown()
