"""Cross-cutting radar coordinate and calibration witnesses (#485)."""
from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from custom_components.houseplan.radar_geometry import (
    clipped_arc_segments,
    length_cm,
    point_in_polygon,
    polar_to_cartesian,
    polygon_is_convex,
    project_local,
    solve_two_point,
)


@pytest.mark.parametrize(("unit", "value", "expected"), [
    ("mm", 10, 1), ("cm", 1, 1), ("m", .01, 1),
    ("in", 1, 2.54), ("ft", 1, 30.48),
])
def test_length_units_are_explicit_and_exact(unit, value, expected):
    assert length_cm(value, unit) == pytest.approx(expected)


def test_shared_synthetic_source_boundaries_project_identically():
    fixture = json.loads((Path(__file__).parents[1] / "test" / "fixtures" /
                          "radar-source-boundaries.json").read_text(encoding="utf-8"))
    for item in fixture["projection"]:
        local = [length_cm(value, item["unit"]) for value in item["local"]]
        actual = project_local(
            {"x": item["mount"][0], "y": item["mount"][1],
             "heading_deg": item["heading_deg"]},
            {"cell_cm": item["cell_cm"], "mirror": item["mirror"]},
            *local,
        )
        assert actual == pytest.approx(item["expected"]), item["name"]


def test_zero_and_negative_cartesian_axes_remain_legal():
    assert project_local(
        {"x": .5, "y": .5, "heading_deg": 0},
        {"cell_cm": 5, "mirror": False},
        0, 120,
    ) == pytest.approx((.5, .4))
    assert project_local(
        {"x": .5, "y": .5, "heading_deg": 90},
        {"cell_cm": 5, "mirror": False},
        -120, 0,
    ) == pytest.approx((.5, .4))


def test_polar_never_invents_bearing():
    assert polar_to_cartesian(2, 90, unit="m", angle_unit="degrees",
                              zero="forward", clockwise=True) == pytest.approx((200, 0))
    with pytest.raises(ValueError):
        polar_to_cartesian(2, 0, unit="yards", angle_unit="degrees",
                           zero="forward", clockwise=True)


def test_concave_room_has_no_bbox_fallback():
    polygon = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]]
    assert point_in_polygon((.5, 3), polygon)
    assert not point_in_polygon((3, 3), polygon)  # inside bbox, outside room
    assert point_in_polygon((1, 2), polygon)  # boundary inclusive
    assert not polygon_is_convex(polygon)
    assert polygon_is_convex([[0, 0], [4, 0], [4, 4], [0, 4]])


def test_two_point_fit_is_rigid_and_rejects_collinear_references():
    fit = solve_two_point((.5, .5), [(100, 0), (0, 100)],
                          [(.5, .5 - 100 / 1200),
                           (.5 + 100 / 1200, .5)], 5)
    assert fit.rms_cm == pytest.approx(0, abs=1e-8)
    assert fit.heading_deg == pytest.approx(90)
    assert fit.mirror is True
    with pytest.raises(ValueError, match="invalid_selection"):
        solve_two_point((.5, .5), [(100, 0), (200, 0)],
                        [(.5, .4), (.5, .3)], 5)


def test_two_point_fit_enforces_reference_distance_and_rms_guards():
    mount = (.5, .5)

    def plan(x, y):
        return .5 + x / 1200, .5 - y / 1200

    with pytest.raises(ValueError, match="invalid_selection"):
        solve_two_point(mount, [(49, 0), (0, 100)],
                        [plan(49, 0), plan(0, 100)], 5)
    with pytest.raises(ValueError, match="invalid_selection"):
        solve_two_point(mount, [(100, 0), (0, 100)],
                        [plan(100, 0), plan(-50, 86.603)], 5)


def test_two_point_fit_rejects_ambiguous_mirror_candidates():
    def plan(x, y):
        return .5 + x / 1200, .5 - y / 1200

    with pytest.raises(ValueError, match="ambiguous_sources"):
        solve_two_point((.5, .5), [(-20, 80), (20, 80)],
                        [plan(0, 80), plan(0, 80)], 5)


def test_projection_rejects_nonfinite_and_over_100m():
    mount = {"x": .5, "y": .5, "heading_deg": 0}
    calibration = {"cell_cm": 5, "mirror": False}
    for point in ((math.nan, 0), (10001, 0)):
        with pytest.raises(ValueError):
            project_local(mount, calibration, *point)


def test_range_arc_is_clipped_to_concave_room_in_contiguous_segments():
    room = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]]
    segments = clipped_arc_segments((2, 2), 5, 180, 180, room)
    assert segments
    assert all(point_in_polygon(point, room, 1e-6)
               for segment in segments for point in segment)
    assert clipped_arc_segments((2, 2), 5, 0, None, room) == []
