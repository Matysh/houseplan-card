"""#1024 physical-face and whole-record TS/Python basis parity."""
from __future__ import annotations

import copy
import json
import math
import subprocess
from pathlib import Path

import pytest

from custom_components.houseplan.opening_orientation import (
    opening_face_normal,
    transport_opening_orientations,
)
from custom_components.houseplan.wall_segment_model import _wall_key

ROOT = Path(__file__).resolve().parents[1]


def node_transfer(before, after, rotation=None):
    script = """import {transportOpeningOrientations} from './test-build/opening-orientation.js';
    let data='';for await(const chunk of process.stdin)data+=chunk;
    const {before,after,rotation}=JSON.parse(data);
    console.log(JSON.stringify(transportOpeningOrientations(before,after,
      rotation===null?undefined:new Map([['opening',rotation]]))));"""
    reply = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT,
        input=json.dumps({"before": before, "after": after, "rotation": rotation}),
        text=True, capture_output=True, check=True)
    return json.loads(reply.stdout)


def space(angle, kind, type_, flip=False):
    radians = math.radians(angle)
    u = [math.cos(radians), math.sin(radians)]
    v = [-u[1], u[0]]
    a, b = [[.5 + sign * .4 * value for value in u] for sign in (-1, 1)]
    rooms = []
    if kind != "partition":
        for sign in ([1, -1] if kind == "shared" else [1]):
            rooms.append({"id": f"r{sign}", "poly": [a, b,
                [b[i] + v[i] * .3 * sign for i in (0, 1)],
                [a[i] + v[i] * .3 * sign for i in (0, 1)]]})
    carrier = {"id": "wall", "a": a, "b": b, "cm": 20}
    walls = [{"a": p, "b": room["poly"][(i + 1) % 4], "cm": 20,
              "key": _wall_key(p, room["poly"][(i + 1) % 4])}
             for room in rooms for i, p in enumerate(room["poly"])]
    canonical = angle - 180 * math.floor((angle + 90) / 180)
    opening = {"id": "opening", "type": type_, "x": .5, "y": .5, "angle": canonical, "length": .2,
               "host": {"kind": "partition" if kind == "partition" else "wall", "id": "wall", "t": .5}}
    if type_ == "window":
        opening["opening_features"] = {"version": 1, "side": "negative", "leaves": [
            {"id": "left", "hinge": "start", "contact": "binary_sensor.a"},
            {"id": "upper", "hinge": "top", "shade": {"enabled": False, "contact": "cover.b"}},
            {"id": "right", "hinge": "end"},
        ]}
    else:
        opening["opening_features"] = {"version": 1, "mechanism": "slide", "slide_direction": "start"}
        if flip:
            opening["flip_v"] = True
    return {"cell_cm": 5, "rooms": rooms, "walls": walls,
            "partitions" if kind == "partition" else "wall_segments": [carrier], "openings": [opening]}


@pytest.mark.parametrize("kind", ["outer", "shared", "partition"])
@pytest.mark.parametrize("type_", ["door", "gate", "window"])
@pytest.mark.parametrize("flip", [False, True])
def test_half_turn_preserves_physical_parts_and_type_specific_face_in_both_runtimes(kind, type_, flip):
    before, after = space(89, kind, type_, flip), space(91, kind, type_, flip)
    old_face = opening_face_normal(before, before["openings"][0])
    expected = transport_opening_orientations(before, copy.deepcopy(after), {"opening": 2})
    script = """import {transportOpeningOrientations} from './test-build/opening-orientation.js';
    let data='';for await(const chunk of process.stdin)data+=chunk;
    const {before,after}=JSON.parse(data);
    console.log(JSON.stringify(transportOpeningOrientations(before,after,new Map([['opening',2]]))));"""
    reply = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT,
                           input=json.dumps({"before": before, "after": after}), text=True, capture_output=True, check=True)
    actual = json.loads(reply.stdout)
    assert actual == expected
    result = expected["openings"][0]
    assert result["angle"] == -89
    features = result["opening_features"]
    if type_ == "window":
        assert [leaf["id"] for leaf in features["leaves"]] == ["right", "upper", "left"]
        assert [leaf["hinge"] for leaf in features["leaves"]] == ["start", "top", "end"]
        assert features["side"] == "positive"
    else:
        assert features["slide_direction"] == "end"
        assert bool(result.get("flip_v")) == (not flip if kind == "shared" else flip)
        radians = math.radians(2)
        desired = [old_face[0] * math.cos(radians) - old_face[1] * math.sin(radians),
                   old_face[0] * math.sin(radians) + old_face[1] * math.cos(radians)]
        face = opening_face_normal(expected, result)
        assert sum(a * b for a, b in zip(face, desired, strict=True)) > .999999
    assert transport_opening_orientations(before, copy.deepcopy(expected), {"opening": 2}) == expected


@pytest.mark.parametrize("angles", [(89, 90), (90, 91), (91, 90), (90, 89), (20, 140), (140, 20)])
@pytest.mark.parametrize("kind", ["outer", "shared", "partition"])
@pytest.mark.parametrize("type_", ["window", "door", "gate"])
def test_exact_boundary_reverse_and_large_real_rotation_have_physical_oracle(angles, kind, type_):
    first, last = angles
    before, after = space(first, kind, type_), space(last, kind, type_)
    original = copy.deepcopy(before)
    delta = last - first
    result = transport_opening_orientations(before, after, {"opening": delta})
    assert node_transfer(before, space(last, kind, type_), delta) == result
    old, new = before["openings"][0], result["openings"][0]
    assert -90 <= new["angle"] < 90
    if type_ == "window":
        # A contact identifies a physical part; its centre and opening normal
        # rotate with the real operation, not with canonical endpoint order.
        for opening in (old, new):
            assert len({leaf["id"] for leaf in opening["opening_features"]["leaves"]}) == 3
        turns = math.floor((old["angle"] + delta + 90) / 180)
        expected = copy.deepcopy(old["opening_features"]["leaves"])
        if turns % 2:
            expected.reverse()
            for leaf in expected:
                if leaf["hinge"] != "top":
                    leaf["hinge"] = "end" if leaf["hinge"] == "start" else "start"
        assert new["opening_features"]["leaves"] == expected
        assert new["opening_features"]["side"] == ("positive" if turns % 2 else "negative")
    else:
        old_face, new_face = opening_face_normal(before, old), opening_face_normal(result, new)
        radians = math.radians(delta)
        desired = [old_face[0] * math.cos(radians) - old_face[1] * math.sin(radians),
                   old_face[0] * math.sin(radians) + old_face[1] * math.cos(radians)]
        assert sum(a * b for a, b in zip(desired, new_face, strict=True)) > .999999
    assert before == original


@pytest.mark.parametrize("type_", ["window", "door", "gate"])
def test_scalar_cleanup_across_positive_boundary_is_once_only_and_matches_ts(type_):
    from custom_components.houseplan.coordinate_canonicalization import (
        canonicalize_config_geometry,
    )
    cfg = {"model_version": 10, "spaces": [space(89.9999999996, "partition", type_)]}
    result = canonicalize_config_geometry(cfg)
    assert result["spaces"][0]["openings"][0]["angle"] == -90
    assert canonicalize_config_geometry(result) == result
    script = """import {canonicalizeConfigGeometry} from './test-build/coordinate-canonicalization.js';
    let data='';for await(const chunk of process.stdin)data+=chunk;
    console.log(JSON.stringify(canonicalizeConfigGeometry(JSON.parse(data))));"""
    reply = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT,
                           input=json.dumps(cfg), text=True, capture_output=True, check=True)
    assert json.loads(reply.stdout) == result
