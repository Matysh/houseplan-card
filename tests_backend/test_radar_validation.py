"""Radar config compatibility and safety witnesses (#485)."""
from __future__ import annotations

import copy

import pytest
import voluptuous as vol

from custom_components.houseplan.radar_validation import validate_marker_radars


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
