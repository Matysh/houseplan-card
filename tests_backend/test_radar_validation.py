"""Radar config compatibility and safety witnesses (#485)."""
from __future__ import annotations

import copy

import pytest
import voluptuous as vol

from custom_components.houseplan.radar_validation import (
    radar_source_entity_ids,
    validate_marker_radars,
    validate_radar_draft,
)


def _config():
    return {
        "spaces": [{"id": "floor", "rooms": [{"id": "living", "poly": [[0, 0], [1, 0], [1, 1]]}]}],
        "markers": [{
            "id": "radar", "binding": "device:abc", "space": "floor",
            "radar": {
                "version": 1, "enabled": True, "show_live": True,
                "profile": "cartesian_v1", "room_id": "living",
                "sources": {"slots": [{"id": "one", "x_entity": "sensor.x",
                                          "y_entity": "sensor.y", "unit": "mm"}]},
                "mount": {"installation_id": "install-1", "x": .5, "y": .5,
                          "heading_deg": 0},
                "calibration": {"method": "manual", "mirror": False, "cell_cm": 5},
            },
        }],
        "settings": {"radar": {"show_live": True}},
    }


def test_valid_stage1_radar_and_absent_namespace():
    validate_marker_radars(_config(), validate_all=True)
    validate_marker_radars({"spaces": [], "markers": [], "settings": {}}, validate_all=True)


def test_explicit_null_removes_radar_configuration():
    config = _config()
    config["markers"][0]["radar"] = None
    validate_marker_radars(config, validate_all=True)


def test_ld2450_requires_mm_and_distinct_axis_entities():
    config = _config()
    radar = config["markers"][0]["radar"]
    radar["profile"] = "esphome_ld2450_v1"
    radar["sources"]["slots"][0]["unit"] = "cm"
    with pytest.raises(vol.Invalid, match="must be mm"):
        validate_marker_radars(config, validate_all=True)


def test_two_point_fit_and_owner_scale_are_revalidated_on_write():
    config = _config()
    radar = config["markers"][0]["radar"]
    radar["calibration"] = {
        "method": "two_point", "mirror": False, "cell_cm": 5, "rms_cm": 0,
        "refs": [
            {"plan": {"x": .5 + 100 / 1200, "y": .5},
             "local_cm": {"x": 100, "y": 0}},
            {"plan": {"x": .5, "y": .5 - 100 / 1200},
             "local_cm": {"x": 0, "y": 100}},
        ],
    }
    validate_marker_radars(config, validate_all=True)
    radar["mount"]["heading_deg"] = 45
    with pytest.raises(vol.Invalid, match="do not match"):
        validate_marker_radars(config, validate_all=True)
    radar["mount"]["heading_deg"] = 0
    config["spaces"][0]["cell_cm"] = 10
    with pytest.raises(vol.Invalid, match="scale"):
        validate_marker_radars(config, validate_all=True)
    radar["sources"]["slots"][0].update(unit="mm", y_entity="sensor.x")
    with pytest.raises(vol.Invalid, match="distinct"):
        validate_marker_radars(config, validate_all=True)


@pytest.mark.parametrize("mutation", [
    lambda r: r["sources"]["slots"][0].update(x_entity="switch.bad"),
    lambda r: r["sources"]["slots"][0].update(unit="guessed"),
    lambda r: r["mount"].update(x=float("nan")),
    lambda r: r.update(room_id="nearest-room"),
])
def test_changed_invalid_radar_is_rejected(mutation):
    config = _config()
    mutation(config["markers"][0]["radar"])
    with pytest.raises(vol.Invalid):
        validate_marker_radars(config, validate_all=True)


def test_untouched_future_radar_round_trips_but_changed_one_fails():
    config = _config()
    config["markers"][0]["radar"] = {"version": 99, "future": {"sentinel": 7}}
    previous = copy.deepcopy(config)
    validate_marker_radars(config, previous)
    changed = copy.deepcopy(config)
    changed["markers"][0]["radar"]["future"]["sentinel"] = 8
    with pytest.raises(vol.Invalid, match="unsupported radar version"):
        validate_marker_radars(changed, previous)


def test_stage2_zone_polygon_and_stage3_cross_space_group_fail_closed():
    config = _config()
    config["markers"][0]["radar"]["zones"] = {"local": [{
        "id": "sofa", "name": "Sofa", "poly": [{"x": 0, "y": 0},
        {"x": 1, "y": 0}, {"x": 2, "y": 0}], "state": {"kind": "targets"},
    }]}
    with pytest.raises(vol.Invalid, match="zero area"):
        validate_marker_radars(config, validate_all=True)


@pytest.mark.parametrize("profile", [
    "esphome_ld2450_v1", "cartesian_v1", "polar_v1", "range_v1",
    "zones_v1", "presence_v1",
])
def test_all_stage1_profiles_have_a_valid_explicit_source_contract(profile):
    config = _config()
    radar = config["markers"][0]["radar"]
    radar["profile"] = profile
    if profile == "esphome_ld2450_v1":
        radar["sources"]["slots"][0]["unit"] = "mm"
    elif profile == "polar_v1":
        radar["sources"] = {"slots": [{
            "id": "one", "distance_entity": "sensor.distance",
            "angle_entity": "sensor.angle", "unit": "cm",
            "angle_unit": "degrees", "angle_zero": "forward",
            "angle_clockwise": True,
        }]}
    elif profile == "range_v1":
        radar["sources"] = {"ranges": [{
            "id": "range", "entity_id": "sensor.distance", "unit": "m",
            "presence_entity": "binary_sensor.presence",
        }]}
    elif profile == "zones_v1":
        radar["sources"] = {"zones": [
            {"id": "occupied", "entity_id": "binary_sensor.zone", "kind": "occupancy"},
            {"id": "count", "entity_id": "sensor.zone_count", "kind": "count"},
        ]}
    elif profile == "presence_v1":
        radar["sources"] = {"occupancy_entity": "binary_sensor.presence"}
    validate_marker_radars(config, validate_all=True)


def test_stage2_metadata_and_source_inventory_are_validated_together():
    config = _config()
    radar = config["markers"][0]["radar"]
    radar["sources"].update({
        "occupancy_entity": "binary_sensor.presence",
        "count_entity": "sensor.count",
        "availability_entity": "binary_sensor.available",
    })
    radar["sources"]["slots"][0]["presence_entity"] = "binary_sensor.slot"
    radar["zones"] = {
        "local": [{
            "id": "desk", "name": "Desk", "poly": [
                {"x": 0, "y": 0}, {"x": 100, "y": 0},
                {"x": 100, "y": 100}, {"x": 0, "y": 100},
            ],
            "state": {"kind": "occupancy", "entity_id": "binary_sensor.desk"},
        }],
        "hardware": {
            "adapter": "esphome_ld2450_numbers_v1",
            "mode_entity": "select.zone_mode",
            "slots": [{
                "slot": index,
                "x1_entity": f"number.zone_{index}_x1",
                "y1_entity": f"number.zone_{index}_y1",
                "x2_entity": f"number.zone_{index}_x2",
                "y2_entity": f"number.zone_{index}_y2",
            } for index in range(1, 4)],
        },
    }
    radar["reflectors"] = [{
        "id": "mirror", "name": "Mirror", "enabled": True,
        "a": {"x": 0, "y": 0}, "b": {"x": 100, "y": 0},
    }]
    radar["allowed_room_ids"] = ["living"]
    validate_marker_radars(config, validate_all=True)
    ids = radar_source_entity_ids(radar)
    assert {"sensor.x", "sensor.y", "binary_sensor.desk", "select.zone_mode",
            "number.zone_3_y2"} <= ids
    assert radar_source_entity_ids(None) == set()
    assert radar_source_entity_ids({"sources": []}) == set()


def test_valid_fusion_and_room_output_settings():
    config = _config()
    second = copy.deepcopy(config["markers"][0])
    second["id"] = "radar-two"
    second["binding"] = "device:def"
    second["radar"]["mount"]["installation_id"] = "install-2"
    second["radar"]["sources"]["slots"][0].update(
        id="two", x_entity="sensor.x2", y_entity="sensor.y2",
    )
    config["markers"].append(second)
    config["settings"]["radar"] = {
        "version": 1, "show_live": False,
        "fusion_groups": [{
            "id": "living-pair", "enabled": True, "space_id": "floor",
            "marker_ids": ["radar", "radar-two"],
        }],
        "room_outputs": [{
            "id": "living-output", "space_id": "floor", "room_id": "living",
            "presence": True, "estimated_count": False,
        }],
    }
    validate_marker_radars(config, validate_all=True)


@pytest.mark.parametrize("mutation", [
    lambda r: r.update(enabled="yes"),
    lambda r: r.update(show_live="yes"),
    lambda r: r.update(profile="magic_v1"),
    lambda r: r.update(room_id="missing"),
    lambda r: r["mount"].update(installation_id="bad id"),
    lambda r: r["mount"].update(heading_deg=360),
    lambda r: r["mount"].update(range_cm=0),
    lambda r: r["mount"].update(fov_deg=361),
    lambda r: r["calibration"].update(method="guess"),
    lambda r: r["calibration"].update(mirror=1),
    lambda r: r["calibration"].update(refs=[{}]),
    lambda r: r["calibration"].update(rms_cm=31),
    lambda r: r.update(allowed_room_ids=["living", "living"]),
])
def test_invalid_core_mount_and_calibration_contracts_are_rejected(mutation):
    config = _config()
    mutation(config["markers"][0]["radar"])
    with pytest.raises(vol.Invalid):
        validate_marker_radars(config, validate_all=True)


@pytest.mark.parametrize("sources", [
    {},
    {"slots": [{"id": "one", "x_entity": "sensor.x", "y_entity": "sensor.y",
                 "unit": "mm", "x_sign": 0}]},
    {"slots": [{"id": "one", "x_entity": "sensor.x", "y_entity": "sensor.y",
                 "unit": "mm", "swap_xy": "yes"}]},
    {"slots": [{"id": "one", "x_entity": "sensor.x", "y_entity": "sensor.y",
                 "unit": "mm", "presence_entity": "sensor.wrong"}]},
])
def test_invalid_cartesian_sources_are_rejected(sources):
    config = _config()
    config["markers"][0]["radar"]["sources"] = sources
    with pytest.raises(vol.Invalid):
        validate_marker_radars(config, validate_all=True)


@pytest.mark.parametrize("change", [
    {"unit": "yards"}, {"angle_unit": "turns"}, {"angle_zero": "north"},
    {"angle_clockwise": 1}, {"angle_entity": "sensor.distance"},
])
def test_invalid_polar_sources_are_rejected(change):
    config = _config()
    radar = config["markers"][0]["radar"]
    radar["profile"] = "polar_v1"
    slot = {
        "id": "one", "distance_entity": "sensor.distance", "angle_entity": "sensor.angle",
        "unit": "cm", "angle_unit": "degrees", "angle_zero": "forward",
        "angle_clockwise": True,
    }
    slot.update(change)
    radar["sources"] = {"slots": [slot]}
    with pytest.raises(vol.Invalid):
        validate_marker_radars(config, validate_all=True)


def test_draft_rejects_missing_removed_and_virtual_marker():
    config = _config()
    radar = config["markers"][0]["radar"]
    candidate, source_ids = validate_radar_draft(config, "radar", radar)
    assert candidate["id"] == "radar" and source_ids == {"sensor.x", "sensor.y"}
    for marker_id in ("missing",):
        with pytest.raises(vol.Invalid, match="setup marker"):
            validate_radar_draft(config, marker_id, radar)
    config["markers"][0]["removed"] = True
    with pytest.raises(vol.Invalid, match="setup marker"):
        validate_radar_draft(config, "radar", radar)
    config["markers"][0].update(removed=False, binding="virtual")
    with pytest.raises(vol.Invalid, match="setup marker"):
        validate_radar_draft(config, "radar", radar)
