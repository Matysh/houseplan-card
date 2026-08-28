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

# Loaded under its canonical package name: the module imports the migration
# mirror relatively (`from .wall_segment_model import ...`), which only resolves
# when the module knows the package it belongs to.
_PATH = os.path.join(_HOUSEPLAN_ROOT, "junction_limits.py")
_spec = importlib.util.spec_from_file_location(
    "custom_components.houseplan.junction_limits", _PATH,
)
jl = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = jl
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


def room_space(rooms, walls, space_id="s", cell_cm=CELL, legacy=True):
    """A space in the shape a real document has: rooms plus their walls.

    `legacy=True` stores the walls the pre-catalogue way (`walls`, no
    `wall_segments`) — the state every plan is in before its first structural
    write on a current card, and the state H1 was about.
    """
    space = {
        "id": space_id, "title": "L", "cell_cm": cell_cm, "view_box": [0, 0, 1, 1],
        "rooms": rooms, "openings": [], "room_drafts": [],
        "partitions": [], "wall_columns": [],
    }
    if legacy:
        space["walls"] = walls
    else:
        space["wall_segments"] = walls
    return space


def triangle(apex_x=0.3167, apex_y=0.24):
    """The owner's spike: an apex well under 15°."""
    return [[0.30, 0.70], [apex_x, apex_y], [0.36, 0.68]]


def square(x=0.60, y=0.60, side=0.20):
    return [[x, y], [x + side, y], [x + side, y + side], [x, y + side]]


def walls_of(poly, prefix, cm_value=15):
    return [
        {"key": f"{prefix}{index}", "a": poly[index],
         "b": poly[(index + 1) % len(poly)], "cm": cm_value}
        for index in range(len(poly))
    ]


def test_legacy_baseline_is_judged_after_the_same_migration():
    """H1 (r1): a pre-catalogue baseline must not read as "no violations".

    `limit_segments` reads `wall_segments`, so a legacy space answers "clean"
    whatever its geometry. Comparing that against a candidate the client has
    already migrated counted every inherited violation as new and refused an
    unrelated edit — spec §3 forbids exactly that.
    """
    spike = triangle()
    previous = {"spaces": [room_space(
        [{"id": "r1", "name": "a", "area": None, "poly": spike}],
        walls_of(spike, "w"),
    )]}
    # Raw, the legacy baseline claims to be clean...
    assert rules(previous["spaces"][0]) == []
    # ...while the same document, migrated, carries the inherited apex.
    migrated, _ = jl.commit_wall_segment_model(json.loads(json.dumps(previous)))
    assert "angle" in rules(migrated["spaces"][0])

    # An unrelated edit (renaming the room) on the migrated candidate passes.
    candidate = json.loads(json.dumps(migrated))
    candidate["spaces"][0]["rooms"][0]["name"] = "b"
    jl.validate_junction_limits(candidate, previous)


def test_inherited_violation_does_not_block_an_unrelated_edit():
    spike = triangle()
    previous = {"spaces": [room_space(
        [{"id": "r1", "name": "a", "area": None, "poly": spike}],
        walls_of(spike, "w"),
    )]}
    # Adding a well-formed room next to the broken one is a legal write.
    box = square()
    candidate = json.loads(json.dumps(previous))
    candidate["spaces"][0]["rooms"].append(
        {"id": "r2", "name": "box", "area": None, "poly": box}
    )
    candidate["spaces"][0]["walls"].extend(walls_of(box, "b"))
    jl.validate_junction_limits(candidate, previous)


def test_a_write_that_adds_a_violation_is_refused_with_a_stable_code():
    box = square()
    previous = {"spaces": [room_space(
        [{"id": "r1", "name": "box", "area": None, "poly": box}],
        walls_of(box, "b"),
    )]}
    jl.validate_junction_limits(json.loads(json.dumps(previous)), previous)

    spike = triangle()
    candidate = json.loads(json.dumps(previous))
    candidate["spaces"][0]["rooms"].append(
        {"id": "r2", "name": "spike", "area": None, "poly": spike}
    )
    candidate["spaces"][0]["walls"].extend(walls_of(spike, "w"))
    with pytest.raises(jl.JunctionLimitError) as excinfo:
        jl.validate_junction_limits(candidate, previous)
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
        # #330 M2: границы из плана тестов §7 — их вердикт обязан совпадать
        # у зеркал и не зависеть от пути §4.6 (as-is или через миграцию).
        "angle-15-exact": [(*ray(0), 15), (*ray(15.0), 15)],
        "length-20-exact": [([0.0, 0.0], [cm(20), 0.0], 15)],
        "filler-run": [([0.0, 0.0], [cm(349), 0.0], 30),
                       ([cm(349), 0.0], [cm(354), 0.0], 30),
                       ([cm(354), 0.0], [cm(554), 0.0], 20)],
        "distance-5-exact": [([0.0, 0.0], [cm(300), 0.0], 15),
                             ([0.0, cm(5)], [cm(300), cm(5)], 15)],
        # #331: пограничные классы точности — вердикт зеркал обязан совпасть.
        "debris-node": [([-1e-8, 0.0], [cm(300), 0.0], 15),
                        ([0.0, 0.0], [0.0, cm(300)], 15)],
        "duplicate-wall": [([0.0, 0.0], [cm(300), 0.0], 15),
                           ([0.0, 0.0], [cm(300), 0.0], 15)],
        "collinear-fork": [([0.0, 0.0], [cm(100), 0.0], 15),
                           ([cm(100), 0.0], [cm(160), 0.0], 15),
                           ([cm(100), 0.0], [cm(220), 1e-9], 15)],
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


# --- #330: производительность без смены вердиктов ---

def test_330_current_version_document_is_judged_as_is():
    """AC5: v9-документ «как есть» и «через миграцию» дают один вердикт."""
    spike = triangle()
    legacy = {"spaces": [room_space(
        [{"id": "r1", "name": "a", "area": None, "poly": spike}],
        walls_of(spike, "w"),
    )]}
    migrated, _ = jl.commit_wall_segment_model(json.loads(json.dumps(legacy)))
    as_is = jl.space_violation_counts(jl._migrated_spaces(migrated))
    forced, _ = jl.commit_wall_segment_model(json.loads(json.dumps(migrated)))
    through = jl.space_violation_counts(jl._migrated_spaces(forced))
    assert as_is == through
    # Как есть — значит БЕЗ вызова миграции: подмена должна не выполниться.
    calls = []
    original = jl.commit_wall_segment_model
    jl.commit_wall_segment_model = lambda cfg: calls.append(1) or original(cfg)
    try:
        jl._migrated_spaces(migrated)
    finally:
        jl.commit_wall_segment_model = original
    assert calls == [], "v9-документ не должен мигрироваться повторно"


def test_330_baseline_counts_replace_the_previous_document():
    """AC3: с baseline_counts вердикт идентичен пути с previous, а сам
    previous не читается вовсе."""
    spike = triangle()
    previous = {"spaces": [room_space(
        [{"id": "r1", "name": "a", "area": None, "poly": spike}],
        walls_of(spike, "w"),
    )]}
    candidate = json.loads(json.dumps(previous))
    candidate["spaces"][0]["rooms"][0]["name"] = "b"
    counts = jl.validate_junction_limits(
        json.loads(json.dumps(previous)), json.loads(json.dumps(previous)),
    )
    # Эквивалентность: унаследованное нарушение проходит обоими путями.
    jl.validate_junction_limits(candidate, json.loads(json.dumps(previous)))
    jl.validate_junction_limits(candidate, None, baseline_counts=counts)
    # Новое нарушение отклоняется обоими путями.
    box = square()
    clean = {"spaces": [room_space(
        [{"id": "r1", "name": "box", "area": None, "poly": box}],
        walls_of(box, "b"),
    )]}
    clean_counts = jl.validate_junction_limits(
        json.loads(json.dumps(clean)), json.loads(json.dumps(clean)),
    )
    broken = json.loads(json.dumps(clean))
    broken["spaces"][0]["rooms"].append(
        {"id": "r2", "name": "spike", "area": None, "poly": spike}
    )
    broken["spaces"][0]["walls"].extend(walls_of(spike, "w"))
    for kwargs in ({"previous": json.loads(json.dumps(clean))},
                   {"baseline_counts": clean_counts}):
        with pytest.raises(jl.JunctionLimitError):
            jl.validate_junction_limits(json.loads(json.dumps(broken)), **kwargs)
    # baseline_counts действительно замещает previous: считаем обращения.
    calls = []
    original = jl._migrated_spaces
    def spy(config, **kwargs):
        calls.append(config)
        return original(config, **kwargs)
    jl._migrated_spaces = spy
    try:
        jl.validate_junction_limits(
            json.loads(json.dumps(candidate)), None, baseline_counts=counts,
        )
    finally:
        jl._migrated_spaces = original
    assert len(calls) == 1, "мигрируется только кандидат"


def test_330_p4_bucket_matches_bruteforce_on_cell_borders():
    """П4-решётка обязана совпасть с перебором и через границы ячеек."""
    def brute_count(space):
        segs = jl.limit_segments(space)
        nodes = {}
        for seg in segs:
            nodes[jl._key(seg["a"])] = seg["a"]
            nodes[jl._key(seg["b"])] = seg["b"]
        mu = jl.cm_to_units(jl.MIN_NODE_DISTANCE_CM, space["cell_cm"])
        count = 0
        entries = list(nodes.items())
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                if jl._length(entries[i][1], entries[j][1]) < mu - 1e-9:
                    count += 1
        for node_key, point in nodes.items():
            for seg in segs:
                if jl._key(seg["a"]) == node_key or jl._key(seg["b"]) == node_key:
                    continue
                d = jl._distance_to_segment(point, seg["a"], seg["b"])
                if d > 1e-9 and d < mu - 1e-9:
                    count += 1
        return count

    def sp(pairs):
        return room_space([], [
            {"key": f"w{i}", "a": a, "b": b, "cm": 15}
            for i, (a, b) in enumerate(pairs)
        ], legacy=False)

    cases = [
        sp([(( 0.0, 0.0), (cm(300), 0.0)), ((0.0, cm(5)), (cm(300), cm(5)))]),
        sp([(( 0.0, 0.0), (cm(300), 0.0)), ((0.0, cm(4)), (cm(300), cm(4)))]),
        sp([(( 0.0, 0.0), (cm(300), 0.0)), ((cm(150), 0.0), (cm(150), cm(300)))]),
        sp([((cm(4.9), 0.0), (cm(304.9), 0.0)),
            ((cm(9.7), cm(0.5)), (cm(309.7), cm(0.5)))]),
    ]
    for index, space in enumerate(cases):
        segs = jl.limit_segments(space)
        grid = len(jl.check_node_distances(segs, CELL))
        assert grid == brute_count(space), f"кейс {index}: решётка != перебор"


def test_330_ac1_validator_chain_is_cheap_without_documents():
    """AC1 (модульная половина): с baseline_counts и v9-кандидатом validate
    не выполняет ни одной миграции — время линейно от проверок, не от
    _atomize. Полный loop-замер живёт в ws_config_set (executor), где HA
    недоступен этому набору; здесь пинится сама причина дороговизны."""
    import time as _time
    box = square()
    doc = {"spaces": [room_space(
        [{"id": "r1", "name": "box", "area": None, "poly": box}],
        walls_of(box, "b"),
    )]}
    migrated, _ = jl.commit_wall_segment_model(json.loads(json.dumps(doc)))
    counts = jl.validate_junction_limits(
        json.loads(json.dumps(migrated)), json.loads(json.dumps(migrated)),
    )
    calls = []
    original = jl.commit_wall_segment_model
    jl.commit_wall_segment_model = lambda cfg: calls.append(1) or original(cfg)
    try:
        start = _time.perf_counter()
        jl.validate_junction_limits(
            json.loads(json.dumps(migrated)), None, baseline_counts=counts,
        )
        elapsed = _time.perf_counter() - start
    finally:
        jl.commit_wall_segment_model = original
    assert calls == [], "тёплый путь не мигрирует ни один документ"
    assert elapsed < 0.5, f"тёплый validate неожиданно дорог: {elapsed:.3f}s"


def test_330_as_is_equals_migrated_on_boundary_fixtures():
    """#330 M2: §4.6 на границах — v9-документ «как есть» и «через
    миграцию» дают одинаковые счётчики нарушений на каждой граничной
    фикстуре, а не на одной."""
    boundary_polys = {
        "spike": triangle(),
        "box": square(),
        "narrow": [[0.30, 0.70], [0.32, 0.24], [0.36, 0.68]],
    }
    for name, poly in boundary_polys.items():
        legacy = {"spaces": [room_space(
            [{"id": "r1", "name": name, "area": None, "poly": poly}],
            walls_of(poly, "w"),
        )]}
        migrated, _ = jl.commit_wall_segment_model(json.loads(json.dumps(legacy)))
        as_is = jl.space_violation_counts(jl._migrated_spaces(migrated))
        forced, _ = jl.commit_wall_segment_model(json.loads(json.dumps(migrated)))
        through = jl.space_violation_counts(jl._migrated_spaces(forced))
        assert as_is == through, f"{name}: as-is != migrated"


def test_331_debris_is_one_node_and_duplicate_is_visible():
    """AC1 + AC2 на python-зеркале."""
    debris = space([(([-1e-8, 0.0]), [cm(300), 0.0], 15),
                    ([0.0, 0.0], [0.0, cm(300)], 15)])
    assert "distance" not in rules(debris)
    dup = space([([0.0, 0.0], [cm(300), 0.0], 15),
                 ([0.0, 0.0], [cm(300), 0.0], 15)])
    segs = jl.limit_segments(dup)
    angle = [v for v in jl.check_nodes(segs) if v[0] == "angle"]
    assert angle and angle[0][2] < 0.001
    butt = space([([0.0, 0.0], [cm(150), 0.0], 15),
                  ([cm(150), 0.0], [cm(300), 0.0], 15)])
    assert "angle" not in rules(butt)


def test_331_iterative_run_and_forks():
    """AC3: 10 000 атомов без переполнения, развилка не теряется."""
    chain = space([
        ([cm(i * 25), 0.0], [cm((i + 1) * 25), 0.0], 15) for i in range(10000)
    ])
    segs = jl.limit_segments(chain)
    total = jl.collinear_run_length_units(segs[0], segs)
    assert abs(total - jl.cm_to_units(250000, CELL)) < 1e-6
    fork = space([([0.0, 0.0], [cm(100), 0.0], 15),
                  ([cm(100), 0.0], [cm(160), 0.0], 15),
                  ([cm(100), 0.0], [cm(220), 1e-9], 15)])
    fsegs = jl.limit_segments(fork)
    run = jl.collinear_run_length_units(fsegs[0], fsegs)
    assert run >= jl.cm_to_units(160, CELL) - 1e-9


def test_331_ac6_candidate_bug_raises_previous_bug_falls_back():
    """AC6, два случая (spec r2 M-r2-1): стороны различимы."""
    box = square()
    good = {"spaces": [room_space(
        [{"id": "r1", "name": "box", "area": None, "poly": box}],
        walls_of(box, "b"),
    )]}
    class Boom(TypeError):
        pass
    original = jl.commit_wall_segment_model
    def bomb(cfg):
        raise Boom("migration bug")
    jl.commit_wall_segment_model = bomb
    try:
        # (а) баг на стороне КАНДИДАТА — честная ошибка, не «нарушений нет».
        with pytest.raises(Boom):
            jl.validate_junction_limits(
                json.loads(json.dumps(good)), None, baseline_counts={},
            )
        # (б) баг на стороне PREVIOUS — запись проходит фолбэком «нет базы»:
        # кандидат уже v9 (мигрирован заранее настоящей функцией) и чист.
        migrated, _ = original(json.loads(json.dumps(good)))
        jl.validate_junction_limits(
            json.loads(json.dumps(migrated)), json.loads(json.dumps(good)),
        )
    finally:
        jl.commit_wall_segment_model = original
