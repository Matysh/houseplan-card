"""Ordinary negative-input witnesses; no implementation mutations (#942)."""
import math

from custom_components.houseplan.support_diagnostic_values import (
    DiagnosticIds, GeometryBudget, point, relative_time, sample_path,
)


def test_namespace_preserves_reference_equality_and_empty_map_identity():
    ids = DiagnosticIds("first")
    assert ids.get("map", 0) == ids.get("map", "0")
    assert ids.get("map", "") != ids.get("map", None)
    assert ids.get("map", "") != ids.get("map", "0")
    assert ids.get("entity", "camera.private") == ids.get("entity", "camera.private")
    assert ids.get("entity", "camera.private") != ids.get("entity", "camera.other")
    assert ids.get("entity", "camera.private") != DiagnosticIds("second").get("entity", "camera.private")
    assert ids.get("entity", {"private": "text"}) is None
    assert ids.get("map", False) is None


def test_exact_finite_geometry_and_time_never_coerce_unknown_to_zero():
    assert point([0, 0]) == [0, 0]
    assert point({"x": 1.234567890123, "y": -2}) == [1.234567890123, -2]
    for bad in ([False, 1], ["0", 1], [math.inf, 1], [math.nan, 1], [], {}):
        assert point(bad) is None
    assert relative_time(12.25, 10) == {"state": "valid", "age_s": -2.25}
    assert relative_time(0, 10) == {"state": "valid", "age_s": 10}
    assert relative_time(None, 10) == {"state": "null"}
    for value in (False, "123", math.inf, {}):
        assert relative_time(value, 10) == {"state": "invalid"}


def test_samples_keep_literal_gaps_original_ranges_and_one_global_quota():
    budget = GeometryBudget(points=4, fragments=3)
    raw = [[[0, 0], [1, 1], [False, 2], [3, 3]], [[4, 4], [5, 5]]]
    result = sample_path(raw, budget)
    assert result["raw_points"] == 6
    assert result["valid_points"] == 5
    assert result["invalid_points"] == 1
    assert result["truncated"] is True
    assert result["fragments"] == [
        {"fragment": 0, "start": 0, "end": 2, "points": [[0, 0], [1, 1]]},
        {"fragment": 0, "start": 3, "end": 4, "points": [[3, 3]]},
        {"fragment": 1, "start": 0, "end": 1, "points": [[4, 4]]},
    ]
    previous = sample_path([[20, 20], [21, 21]], budget)
    assert previous["kept_points"] == 0
    assert previous["truncated"] is True
    assert previous["fragments"] == []
    assert raw[0][2] == [False, 2], "input remains untouched"


def test_fragment_cap_and_hostile_scan_are_explicit_not_synthetic_chords():
    output = sample_path([[[1, 1]], [[2, 2]]], GeometryBudget(points=5, fragments=1))
    assert output["kept_points"] == 1 and output["truncated"] is True
    output = sample_path([[0, 0]] * 100_001, GeometryBudget())
    assert output["scan_limited"] is True
    assert output["raw_points"] == 100_001
    assert output["valid_points"] == 100_000
    assert output["kept_points"] == 4096
    assert output["fragments"][0]["end"] == 4096
    assert sample_path(None, GeometryBudget())["status"] == "unavailable"
    assert sample_path([], GeometryBudget())["truncated"] is False
