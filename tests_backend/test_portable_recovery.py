"""Synthetic portable recovery witnesses; never owner's archive/device ids."""
from __future__ import annotations

import copy

import pytest
import voluptuous as vol

from custom_components.houseplan.portable_recovery import (
    RECOVERY_EXAMPLES,
    recover_portable_references,
)
from custom_components.houseplan.radar_validation import validate_marker_radars
from custom_components.houseplan.validation import (
    MAX_CONTROLS,
    MAX_MARKERS,
    MarkerControlError,
    validate_marker_vacuum_routes,
)


def config():
    return {
        "spaces": [{"id": "floor", "cell_cm": 5, "rooms": [{"id": "living"}]}],
        "markers": [{
            "id": "radar", "binding": "device:synthetic", "space": "floor",
            "radar": {
                "version": 1, "enabled": True, "profile": "presence_v1",
                "room_id": "living", "sources": {"occupancy_entity": "binary_sensor.test"},
                "mount": {"installation_id": "test", "x": .5, "y": .5, "heading_deg": 0},
                "calibration": {"method": "not_required", "mirror": False, "cell_cm": 5},
                "future_sibling": {"keep": [1, 2]},
            },
        }],
    }


def test_valid_config_and_temporarily_absent_entities_remain_literal():
    source = config()
    source["markers"][0].update(
        controls=["switch.temporarily_offline"], light_entity="light.not_installed_yet",
        value_source={"kind": "entity_state", "entity_id": "sensor.not_here"},
    )
    candidate = copy.deepcopy(source)
    report = recover_portable_references(candidate)
    assert candidate == source
    assert report == {"version": 1, "total": 0, "counts": {}, "examples": [], "remaining": 0}


@pytest.mark.parametrize("enabled", [False, True])
@pytest.mark.parametrize("problem", ["no-space", "unknown-space", "room", "allowed", "scale"])
def test_radar_is_inert_without_losing_spatial_setup(enabled, problem):
    source = config()
    marker = source["markers"][0]
    marker["radar"]["enabled"] = enabled
    if problem == "no-space":
        marker.pop("space")
    elif problem == "unknown-space":
        marker["space"] = "deleted"
    elif problem == "room":
        marker["radar"]["room_id"] = "deleted"
    elif problem == "allowed":
        marker["radar"]["allowed_room_ids"] = ["living", "deleted"]
    elif problem == "scale":
        marker["radar"]["calibration"]["cell_cm"] = 10
    candidate = copy.deepcopy(source)
    report = recover_portable_references(candidate)
    expected = copy.deepcopy(source)
    expected["markers"][0]["radar"]["enabled"] = False
    assert candidate == expected
    assert report["counts"] == {"radar": 1}
    assert report["examples"][0]["marker_id"] == "radar"
    again = copy.deepcopy(candidate)
    assert recover_portable_references(again) == report
    assert again == candidate


def test_vacuum_keeps_all_maps_and_matrices_without_guessing_a_floor():
    source = config()
    source["markers"][0]["vacuum"] = {
        "live": True, "source": "camera.synthetic", "calibration": {"old": [1, 0, 0, 1, 4, 5]},
        "map_routes": [
            {"id": "a", "source": "camera.synthetic", "map_id": "1", "space": "floor"},
            {"id": "b", "source": "camera.synthetic", "map_id": "2", "space": "deleted",
             "calibration": [2, 0, 0, 2, 3, 4]},
        ],
    }
    candidate = copy.deepcopy(source)
    assert recover_portable_references(candidate)["counts"] == {"vacuum": 1}
    source["markers"][0]["vacuum"]["live"] = False
    assert candidate == source


def test_controls_retain_document_order_and_break_only_unusable_edges():
    source = {"spaces": [], "markers": [
        {"id": "a", "is_light": True, "controls": [
            "marker:a", "marker:b", "marker:b", "marker:missing", "marker:plain", "switch.test",
        ]},
        {"id": "b", "is_light": True, "controls": ["marker:a"]},
        {"id": "plain"},
    ]}
    report = recover_portable_references(source)
    assert source["markers"][0]["controls"] == ["marker:b", "switch.test"]
    assert source["markers"][1]["controls"] is None
    assert report["counts"] == {"controls": 5}
    before = copy.deepcopy(source)
    assert recover_portable_references(source)["total"] == 0
    assert source == before


def test_dependent_values_use_existing_neutral_formats():
    source = config()
    marker = source["markers"][0]
    marker["value_badge"] = {
        "enabled": True, "position": "right", "future": 3,
        "source": {"kind": "derived_marker_state", "ref": "marker:missing"},
    }
    marker["value_source"] = {"kind": "derived_marker_state", "ref": "marker:radar"}
    report = recover_portable_references(source)
    assert marker["value_badge"] == {"enabled": False, "position": "right", "future": 3, "source": None}
    assert "value_source" not in marker
    assert report["counts"] == {"value": 2}


def test_space_recovery_never_repairs_the_existing_target():
    source = config()
    old = source["markers"][0]
    old["radar"]["room_id"] = "already-broken"
    old["is_light"] = True
    old["controls"] = ["marker:new"]
    source["markers"].append({"id": "new", "is_light": True, "controls": ["marker:radar"]})
    before_old = copy.deepcopy(old)
    report = recover_portable_references(source, marker_ids={"new"})
    assert old == before_old
    assert source["markers"][1]["controls"] is None
    assert report["counts"] == {"controls": 1}


def test_report_is_bounded_and_does_not_embed_config_or_unbounded_names():
    source = config()
    template = source["markers"][0]
    source["markers"] = []
    for i in range(RECOVERY_EXAMPLES + 5):
        marker = copy.deepcopy(template)
        marker.update(id=f"synthetic-{i}", name="<not-html>" * 1000)
        marker["radar"]["room_id"] = "deleted"
        source["markers"].append(marker)
    report = recover_portable_references(source)
    assert len(report["examples"]) == RECOVERY_EXAMPLES
    assert report["remaining"] == 5
    assert report["total"] == RECOVERY_EXAMPLES + 5
    assert all(len(row["name"]) <= 160 for row in report["examples"])
    assert "sources" not in str(report)


@pytest.mark.parametrize("problem", ["owner", "room", "allowed", "scale"])
def test_dormant_radar_reference_tolerance_is_explicit_and_transfer_only(problem):
    candidate = config()
    marker = candidate["markers"][0]
    if problem == "owner":
        marker.pop("space")
    elif problem == "room":
        marker["radar"]["room_id"] = "deleted"
    elif problem == "allowed":
        marker["radar"]["allowed_room_ids"] = ["deleted"]
    else:
        marker["radar"]["calibration"]["cell_cm"] = 10
    with pytest.raises(vol.Invalid):
        validate_marker_radars(candidate, validate_all=True, allow_inactive_spatial_refs=True)
    recover_portable_references(candidate)
    validate_marker_radars(candidate, validate_all=True, allow_inactive_spatial_refs=True)
    with pytest.raises(vol.Invalid):
        validate_marker_radars(candidate, validate_all=True)
    marker["radar"]["enabled"] = True
    with pytest.raises(vol.Invalid):
        validate_marker_radars(candidate, validate_all=True, allow_inactive_spatial_refs=True)


@pytest.mark.parametrize("problem", ["sources", "number", "allowed-type", "allowed-duplicate"])
def test_dormant_radar_does_not_exempt_malformed_or_unsafe_parameters(problem):
    candidate = config()
    radar = candidate["markers"][0]["radar"]
    radar.update(enabled=False, room_id="deleted")
    if problem == "sources":
        radar["sources"]["occupancy_entity"] = "script.do_not_execute"
    elif problem == "number":
        radar["mount"]["x"] = float("nan")
    elif problem == "allowed-type":
        radar["allowed_room_ids"] = [{}]
    else:
        radar["allowed_room_ids"] = ["deleted", "deleted"]
    with pytest.raises(vol.Invalid):
        validate_marker_radars(candidate, validate_all=True, allow_inactive_spatial_refs=True)


def test_only_dormant_vacuum_can_keep_a_missing_space_not_an_invalid_route():
    candidate = config()
    vacuum = {"live": True, "map_routes": [{
        "id": "map", "source": "camera.synthetic", "map_id": "1", "space": "deleted",
    }]}
    candidate["markers"][0]["vacuum"] = vacuum
    with pytest.raises(MarkerControlError):
        validate_marker_vacuum_routes(candidate, validate_all=True, allow_inactive_missing_space=True)
    recover_portable_references(candidate)
    validate_marker_vacuum_routes(candidate, validate_all=True, allow_inactive_missing_space=True)
    with pytest.raises(MarkerControlError):
        validate_marker_vacuum_routes(candidate, validate_all=True)
    vacuum["map_routes"][0]["source"] = "not-an-entity"
    with pytest.raises(MarkerControlError):
        validate_marker_vacuum_routes(candidate, validate_all=True, allow_inactive_missing_space=True)


def test_control_graph_is_bounded_at_current_marker_and_edge_limits():
    markers = [{"id": f"m{i}", "binding": "virtual", "is_light": True,
                "controls": [f"marker:m{j}" for j in range(i + 1, min(MAX_MARKERS, i + 1 + MAX_CONTROLS))]}
               for i in range(MAX_MARKERS)]
    report = recover_portable_references({"spaces": [], "markers": markers})
    assert report["total"] == 0
    assert len(markers) == MAX_MARKERS
    assert markers[0]["controls"] == [f"marker:m{i}" for i in range(1, MAX_CONTROLS + 1)]
