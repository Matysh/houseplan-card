"""#1033: imported openings that miss their host are repaired, not refused.

Pure: the repair and the schema it answers to, without Home Assistant.
"""
from __future__ import annotations

import copy

import pytest
import voluptuous as vol

from custom_components.houseplan.opening_repair import (
    MAX_REPAIR_EXAMPLES,
    merge_repair_reports,
    repair_imported_openings,
)
from custom_components.houseplan.validation import CONFIG_SCHEMA
from custom_components.houseplan.wall_segment_model import (
    GRID_STEP_N,
    _wall_key,
    commit_wall_segment_model,
)

A, B, C, D = [0.2, 0.2], [0.6, 0.2], [0.6, 0.5], [0.2, 0.5]


def _house(*openings: dict, left_cm: float = 15) -> dict:
    """One room with four walls, one partition, committed to the current model."""
    edges = ((A, B, 15), (B, C, 15), (C, D, 15), (D, A, left_cm))
    legacy = {
        "model_version": 9,
        "spaces": [{
            "id": "ground", "title": "Ground", "view_box": [0, 0, 1, 1],
            "rooms": [{"id": "living", "name": "Living", "poly": [A, B, C, D]}],
            "walls": [{"key": _wall_key(a, b), "a": a, "b": b, "cm": cm}
                      for a, b, cm in edges if cm],
            "partitions": [{"id": "p1", "a": [0.4, 0.25], "b": [0.4, 0.45], "cm": 10}],
            "openings": list(openings),
        }],
        "markers": [], "settings": {},
    }
    config, _ = commit_wall_segment_model(legacy)
    return config


def _door(opening_id: str, x: float, length: float = 0.08, **extra) -> dict:
    return {"id": opening_id, "type": "door", "x": x, "y": 0.2, "angle": 0,
            "length": length, **extra}


def _partition_door(**extra) -> dict:
    return {"id": "pd", "type": "door", "x": 0.4, "y": 0.35, "angle": 90, "length": 0.1,
            "host": {"kind": "partition", "id": "p1", "t": 0.5}, **extra}


def _space(config: dict) -> dict:
    return config["spaces"][0]


def _opening(config: dict, opening_id: str) -> dict:
    return next(o for o in _space(config)["openings"] if o["id"] == opening_id)


def _bottom(config: dict) -> dict:
    return next(s for s in _space(config)["wall_segments"]
                if sorted([s["a"], s["b"]]) == sorted([A, B]))


def _schema(config: dict) -> dict:
    return CONFIG_SCHEMA(copy.deepcopy(config))


def test_an_intact_plan_is_left_exactly_as_it_is():
    config = _house(_door("d1", 0.3, lock="lock.front"), _door("w1", 0.5, 0.06), _partition_door())
    before = copy.deepcopy(config)
    report = repair_imported_openings(config, 10)
    assert report == {"rehosted": 0, "detached": 0, "examples": []}
    assert config == before
    _schema(config)


def test_a_door_far_off_its_wall_is_kept_without_a_host():
    config = _house(_door("d1", 0.3, lock="lock.front", contact="binary_sensor.front"))
    door = _opening(config, "d1")
    door["y"] = 0.3  # inside the room, nowhere near a wall
    with pytest.raises(vol.Invalid, match="must match its host"):
        _schema(config)
    expected = {key: value for key, value in door.items() if key != "host"}
    report = repair_imported_openings(config, 10)
    assert report == {"rehosted": 0, "detached": 1, "examples": [{
        "space_id": "ground", "space_title": "Ground", "opening_id": "d1",
        "type": "door", "result": "detached",
    }]}
    assert _opening(config, "d1") == expected
    validated = _schema(config)
    # The next plan write keeps it unhosted and changes nothing.
    assert commit_wall_segment_model(validated)[0] == commit_wall_segment_model(
        commit_wall_segment_model(validated)[0])[0]
    assert "host" not in _opening(commit_wall_segment_model(validated)[0], "d1")


def test_a_door_slightly_off_its_wall_is_put_back_on_it():
    config = _house(_door("d1", 0.3))
    door = _opening(config, "d1")
    host_id = door["host"]["id"]
    shift = GRID_STEP_N * 0.01
    door["y"] = 0.2 + shift
    door["x"] = 0.3 + shift
    with pytest.raises(vol.Invalid, match="must match its host"):
        _schema(config)
    report = repair_imported_openings(config, 10)
    assert (report["rehosted"], report["detached"]) == (1, 0)
    assert report["examples"][0]["result"] == "rehosted"
    door = _opening(config, "d1")
    assert door["host"]["id"] == host_id == _bottom(config)["id"]
    assert door["y"] == 0.2
    assert abs(door["x"] - (0.3 + shift)) <= GRID_STEP_N * 0.02
    assert door["host"]["t"] == pytest.approx((door["x"] - 0.2) / 0.4, abs=1e-9)
    validated = _schema(config)
    assert commit_wall_segment_model(validated)[0]["spaces"][0]["openings"] == \
        validated["spaces"][0]["openings"]


def test_of_two_overlapping_doors_the_later_one_loses_its_host():
    config = _house(_door("d1", 0.3), _door("w1", 0.5, 0.06))
    window = _opening(config, "w1")
    window["x"], window["host"]["t"] = 0.32, 0.3  # valid geometry, overlaps d1
    with pytest.raises(vol.Invalid, match="must not overlap"):
        _schema(config)
    report = repair_imported_openings(config, 10)
    assert (report["rehosted"], report["detached"]) == (0, 1)
    assert "host" in _opening(config, "d1") and "host" not in _opening(config, "w1")
    validated = _schema(config)
    # The overlap guard keeps the next write from healing it onto d1's interval.
    committed = commit_wall_segment_model(validated)[0]
    assert "host" not in _opening(committed, "w1")
    _schema(committed)


def test_a_door_that_already_holds_its_wall_is_never_displaced_by_a_repaired_one():
    config = _house(_door("d1", 0.3), _door("w1", 0.5, 0.06))
    door = _opening(config, "d1")
    door["host"]["id"] = "wall-gone"  # broken, though it sits on the wall
    window = _opening(config, "w1")
    window["x"], window["host"]["t"] = 0.32, 0.3  # valid, over d1's place
    report = repair_imported_openings(config, 10)
    assert (report["rehosted"], report["detached"]) == (0, 1)
    assert report["examples"][0]["opening_id"] == "d1"
    assert "host" not in _opening(config, "d1") and "host" in _opening(config, "w1")
    _schema(config)


def test_a_host_id_that_is_gone_is_replaced_by_the_wall_under_the_door():
    config = _house(_door("d1", 0.3))
    door = _opening(config, "d1")
    door["host"]["id"] = "wall-gone"
    report = repair_imported_openings(config, 10)
    assert (report["rehosted"], report["detached"]) == (1, 0)
    assert _opening(config, "d1")["host"]["id"] == _bottom(config)["id"]
    _schema(config)


@pytest.mark.parametrize("change,message", [
    (lambda door: door.update(length=0.5), "fit inside its host"),
    (lambda door: door.update(angle=45), "angle must match"),
])
def test_a_door_that_does_not_fit_or_turned_is_kept_without_a_host(change, message):
    config = _house(_door("d1", 0.3))
    change(_opening(config, "d1"))
    with pytest.raises(vol.Invalid, match=message):
        _schema(config)
    report = repair_imported_openings(config, 10)
    assert (report["rehosted"], report["detached"]) == (0, 1)
    assert "host" not in _opening(config, "d1")
    _schema(config)


def test_a_door_on_a_wall_without_a_body_is_kept_without_a_host():
    config = _house(left_cm=0)
    left = next(s for s in _space(config)["wall_segments"]
                if sorted([s["a"], s["b"]]) == sorted([D, A]))
    assert left["cm"] == 0
    _space(config)["openings"] = [{
        "id": "d1", "type": "door", "x": 0.2, "y": 0.35, "angle": 90, "length": 0.08,
        "host": {"kind": "wall", "id": left["id"], "t": 0.5},
    }]
    with pytest.raises(vol.Invalid, match="positive thickness"):
        _schema(config)
    report = repair_imported_openings(config, 10)
    assert (report["rehosted"], report["detached"]) == (0, 1)
    _schema(config)


@pytest.mark.parametrize("change,message", [
    (lambda door: door.update(length=0.3), "partition opening must fit"),
    (lambda door: door["host"].update(id="p-gone"), "partition opening host must exist"),
])
def test_a_partition_door_that_does_not_fit_or_lost_its_partition_is_kept_without_a_host(
    change, message,
):
    config = _house(_partition_door(lock="lock.inner"))
    change(_opening(config, "pd"))
    with pytest.raises(vol.Invalid, match=message):
        _schema(config)
    expected = {key: value for key, value in _opening(config, "pd").items() if key != "host"}
    report = repair_imported_openings(config, 10)
    assert (report["rehosted"], report["detached"]) == (0, 1)
    assert _opening(config, "pd") == expected
    _schema(config)


def test_the_rest_of_the_space_is_untouched():
    config = _house(_door("d1", 0.3), _door("w1", 0.5, 0.06), _partition_door())
    _opening(config, "d1")["y"] = 0.3
    before = copy.deepcopy(config)
    repair_imported_openings(config, 10)
    for key in set(_space(before)) - {"openings"}:
        assert _space(config)[key] == _space(before)[key], key
    assert _opening(config, "w1") == _opening(before, "w1")
    assert _opening(config, "pd") == _opening(before, "pd")
    assert {k: v for k, v in config.items() if k != "spaces"} == \
        {k: v for k, v in before.items() if k != "spaces"}


def test_older_wall_models_pick_like_their_initial_migration():
    config = _house(_door("d1", 0.3))
    _opening(config, "d1")["y"] = 0.2 + GRID_STEP_N * 0.01
    report = repair_imported_openings(config, 9)
    assert (report["rehosted"], report["detached"]) == (1, 0)
    config["model_version"] = 9
    _schema(config)


def test_before_the_wall_model_only_a_broken_partition_host_is_dropped_and_not_counted():
    config = _house(_door("d1", 0.3), _partition_door())
    _opening(config, "pd")["length"] = 0.3
    door = _opening(config, "d1")
    door["host"]["id"] = "wall-gone"  # not judged before model 8
    before = copy.deepcopy(door)
    report = repair_imported_openings(config, 7)
    assert report == {"rehosted": 0, "detached": 0, "examples": []}
    assert "host" not in _opening(config, "pd")
    assert _opening(config, "d1") == before


@pytest.mark.parametrize("host", [
    {"kind": "wall", "id": "x", "t": 2},
    {"kind": "wall", "id": "x", "t": 0.5, "extra": 1},
    {"kind": "beam", "id": "x", "t": 0.5},
    {"kind": "wall", "id": "", "t": 0.5},
    "wall",
])
def test_an_unreadable_host_is_left_for_the_schema_to_refuse(host):
    config = _house(_door("d1", 0.3))
    _opening(config, "d1")["host"] = host
    before = copy.deepcopy(config)
    assert repair_imported_openings(config, 10)["detached"] == 0
    assert config == before
    with pytest.raises(vol.Invalid):
        _schema(config)


def test_garbage_never_raises_from_the_repair():
    for config in (None, [], {"spaces": None}, {"spaces": [None, {"openings": [None, 3]}]},
                   {"spaces": [{"openings": [{"host": {"kind": "wall", "id": "a", "t": 0.5}}]}]}):
        assert repair_imported_openings(copy.deepcopy(config), 10)["detached"] == 0


def test_the_repair_is_idempotent_and_the_examples_are_bounded():
    doors = [_door(f"d{i}", 0.21 + i * 0.012, 0.01) for i in range(30)]
    config = _house(*doors)
    for door in _space(config)["openings"]:
        door["y"] = 0.3
    report = repair_imported_openings(config, 10)
    assert report["detached"] == 30 and len(report["examples"]) == MAX_REPAIR_EXAMPLES
    assert repair_imported_openings(config, 10)["detached"] == 0
    merged = merge_repair_reports(report, report, None)
    assert merged["detached"] == 60 and len(merged["examples"]) == MAX_REPAIR_EXAMPLES


@pytest.mark.parametrize("model,result", [(10, "detached"), (9, "rehosted")])
def test_between_two_eligible_walls_the_next_write_decides(model, result):
    """Model 10 heals onto a unique carrier only; 8–9 take the migration tie-break."""
    gap = 0.00005  # two walls closer than 1/50 of a grid step
    upper = [[0.2, 0.1], [0.6, 0.1], [0.6, 0.2], [0.2, 0.2]]
    lower = [[0.2, 0.2 + gap], [0.6, 0.2 + gap], [0.6, 0.4], [0.2, 0.4]]
    walls = [{"key": _wall_key(p[i], p[(i + 1) % 4]), "a": p[i], "b": p[(i + 1) % 4], "cm": 15}
             for p in (upper, lower) for i in range(4)]
    config, _ = commit_wall_segment_model({"model_version": 9, "spaces": [{
        "id": "ground", "title": "Ground", "view_box": [0, 0, 1, 1],
        "rooms": [{"id": "r1", "name": "R1", "poly": upper}, {"id": "r2", "name": "R2", "poly": lower}],
        "walls": walls, "openings": [],
    }], "markers": [], "settings": {}})
    _space(config)["openings"] = [{
        "id": "d1", "type": "door", "x": 0.4, "y": 0.2 + gap / 2, "angle": 0, "length": 0.08,
        "host": {"kind": "wall", "id": "wall-gone", "t": 0.5},
    }]
    report = repair_imported_openings(config, model)
    assert report[result] == 1
    config["model_version"] = model
    validated = _schema(config)
    committed, _ = commit_wall_segment_model(validated)
    assert _opening(committed, "d1").get("host") == _opening(config, "d1").get("host")
