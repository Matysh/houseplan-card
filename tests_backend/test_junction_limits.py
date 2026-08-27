"""Issue #329: the backend mirror of the wall-junction limits.

Loaded by path, like the other pure backend tests, so Home Assistant is not
needed. The parity test at the bottom is the important one: it feeds the same
fixtures to the TypeScript checks and to this module and demands the same
verdict, because two implementations of one rule are worth nothing if they can
disagree.
"""
import importlib.util
import json
import os
import subprocess
import sys
import types

import pytest

_ROOT = os.path.dirname(os.path.dirname(__file__))
_PACKAGE_ROOT = os.path.join(_ROOT, "custom_components")
_HOUSEPLAN_ROOT = os.path.join(_PACKAGE_ROOT, "houseplan")

if "custom_components" not in sys.modules:
    package = types.ModuleType("custom_components")
    package.__path__ = [_PACKAGE_ROOT]
    sys.modules["custom_components"] = package
if "custom_components.houseplan" not in sys.modules:
    package = types.ModuleType("custom_components.houseplan")
    package.__path__ = [_HOUSEPLAN_ROOT]
    sys.modules["custom_components.houseplan"] = package

_PATH = os.path.join(_HOUSEPLAN_ROOT, "junction_limits.py")
_spec = importlib.util.spec_from_file_location("hp_junction_limits", _PATH)
jl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(jl)

CELL = 5.0


def cm(value):
    return jl.cm_to_units(value, CELL)


def space(segments, space_id="s", cell_cm=CELL):
    return {
        "id": space_id,
        "cell_cm": cell_cm,
        "rooms": [],
        "wall_segments": [
            {"id": f"w{index}", "a": list(a), "b": list(b), "cm": thickness}
            for index, (a, b, thickness) in enumerate(segments)
        ],
        "partitions": [],
        "room_drafts": [],
        "openings": [],
    }


def ray(degrees, length_cm=100.0):
    radians = degrees * 3.141592653589793 / 180
    import math
    return ([0.0, 0.0], [math.cos(radians) * cm(length_cm),
                         math.sin(radians) * cm(length_cm)])


def rules(sp):
    return sorted({item[0] for item in jl.space_violations(sp)})


def test_min_angle_is_a_hard_15_degrees():
    below = space([(*ray(0), 15), (*ray(14), 15)])
    at = space([(*ray(0), 15), (*ray(15), 15)])
    assert "angle" in rules(below)
    assert "angle" not in rules(at)


def test_valence_allows_six_walls_and_refuses_the_seventh():
    six = space([(*ray(degree), 15) for degree in (0, 60, 120, 180, 240, 300)])
    seven = space([(*ray(degree), 15) for degree in (0, 51, 102, 153, 204, 255, 306)])
    assert "valence" not in rules(six)
    assert "valence" in rules(seven)


def test_length_measures_the_wall_run_not_the_atom():
    # Two collinear 15 cm atoms of 10 cm each are ONE 20 cm wall — legal,
    # exactly the thickness-step compensation case from the owner's fixture.
    run = space([
        ([0.0, 0.0], [cm(10), 0.0], 15),
        ([cm(10), 0.0], [cm(20), 0.0], 15),
    ])
    assert "length" not in rules(run)
    # A lone 19 cm wall is not.
    short = space([([0.0, 0.0], [cm(19), 0.0], 15)])
    assert "length" in rules(short)
    # A wall may never be shorter than its own thickness.
    thick = space([([0.0, 0.0], [cm(25), 0.0], 30)])
    assert "length" in rules(thick)


def test_distance_keeps_the_t_joint_legal():
    near = space([
        ([0.0, 0.0], [cm(300), 0.0], 15),
        ([0.0, cm(4)], [cm(300), cm(4)], 15),
    ])
    assert "distance" in rules(near)
    tee = space([
        ([0.0, 0.0], [cm(300), 0.0], 15),
        ([cm(150), 0.0], [cm(150), cm(300)], 15),
    ])
    assert "distance" not in rules(tee)


def test_inherited_violation_does_not_block_an_unrelated_edit():
    broken = space([(*ray(0), 15), (*ray(9), 15)])
    previous = {"spaces": [broken]}
    # The same broken space plus an unrelated, perfectly legal wall.
    edited = json.loads(json.dumps(broken))
    edited["wall_segments"].append({
        "id": "unrelated", "a": [cm(1000), cm(1000)],
        "b": [cm(1000), cm(1300)], "cm": 15,
    })
    jl.validate_junction_limits({"spaces": [edited]}, previous)


def test_a_write_that_adds_a_violation_is_refused_with_a_stable_code():
    clean = space([
        ([0.0, 0.0], [cm(300), 0.0], 15),
        ([cm(300), 0.0], [cm(300), cm(300)], 15),
    ])
    previous = {"spaces": [clean]}
    broken = json.loads(json.dumps(clean))
    broken["wall_segments"].append({
        "id": "spike", "a": [0.0, 0.0],
        "b": [cm(300), cm(300) * 0.15], "cm": 15,
    })
    with pytest.raises(jl.JunctionLimitError) as excinfo:
        jl.validate_junction_limits({"spaces": [broken]}, previous)
    assert excinfo.value.code == "junction_limit_angle"
    assert excinfo.value.space_id == "s"


def test_parity_with_the_frontend_checks():
    """The same fixtures must get the same verdict on both sides."""
    fixtures = {
        "angle-14": [(*ray(0), 15), (*ray(14), 15)],
        "angle-15": [(*ray(0), 15), (*ray(15), 15)],
        "valence-7": [(*ray(degree), 15)
                      for degree in (0, 51, 102, 153, 204, 255, 306)],
        "length-19": [([0.0, 0.0], [cm(19), 0.0], 15)],
        "length-run": [([0.0, 0.0], [cm(10), 0.0], 15),
                       ([cm(10), 0.0], [cm(20), 0.0], 15)],
        "length-thickness": [([0.0, 0.0], [cm(25), 0.0], 30)],
        "distance-4": [([0.0, 0.0], [cm(300), 0.0], 15),
                       ([0.0, cm(4)], [cm(300), cm(4)], 15)],
        "tee": [([0.0, 0.0], [cm(300), 0.0], 15),
                ([cm(150), 0.0], [cm(150), cm(300)], 15)],
    }
    payload = {name: space(segments, space_id=name)
               for name, segments in fixtures.items()}
    mine = {name: rules(sp) for name, sp in payload.items()}

    script = """
import { checkNodes, checkSegmentLengths, checkNodeDistances } from './test-build/junction-limits.js';
import { GRID_STEP_N } from './test-build/space-geometry.js';
let raw = '';
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  const spaces = JSON.parse(raw);
  const out = {};
  for (const [name, space] of Object.entries(spaces)) {
    const segments = space.wall_segments;
    const violations = [
      ...checkNodes(segments),
      ...checkSegmentLengths(segments, space.cell_cm, GRID_STEP_N),
      ...checkNodeDistances(segments, space.cell_cm, GRID_STEP_N),
    ];
    out[name] = [...new Set(violations.map((item) => item.rule))].sort();
  }
  process.stdout.write(JSON.stringify(out));
});
"""
    if not os.path.isdir(os.path.join(_ROOT, "test-build")):
        pytest.skip("test-build/ is not compiled; run npx tsc -p tsconfig.test.json")
    result = subprocess.run(
        ["node", "--input-type=module", "--eval", script],
        cwd=_ROOT, input=json.dumps(payload), capture_output=True, text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == mine
