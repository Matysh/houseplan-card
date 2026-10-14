"""Mandatory #803/#845 identity, room-node and browser-baseline Undo parity.

The clean CI job compiles actual TS first. Missing prerequisites fail, never skip.
"""
from __future__ import annotations

import argparse
import contextlib
import copy
import json
import os
import subprocess
import uuid
from pathlib import Path

from pure_imports import load_pure

ROOT = Path(__file__).resolve().parents[1]
MODULE = load_pure("custom_components.houseplan.wall_node_move",
                   ROOT / "custom_components/houseplan/wall_node_move.py")
RUNNER = ROOT / "test/helpers/wall-node-parity-runner.mjs"
CASES = ROOT / "test/fixtures/803-wall-node-parity.json"
IDENTITY = ROOT / "test/fixtures/845-wall-identity-parity.json"


@contextlib.contextmanager
def pinned_test_ids():
    """Pin fresh test UUID entropy for incomplete current-model fixtures only."""
    original = uuid.uuid4
    sequence = 0

    def next_id():
        nonlocal sequence
        sequence += 1
        return uuid.UUID(f"00000000-0000-4000-8000-{sequence:012d}")

    uuid.uuid4 = next_id
    try:
        yield
    finally:
        uuid.uuid4 = original


def commit(config):
    with pinned_test_ids():
        return MODULE.commit_wall_segment_model(config)[0]


def frontend(request, build_dir):
    build_dir = Path(build_dir).resolve()
    required = [build_dir / f"{name}.js" for name in
                ("wall-segment-model", "wall-node-move", "coordinate-canonicalization")]
    if any(not path.is_file() for path in required):
        raise FileNotFoundError("wall parity prerequisites are missing; compile tsconfig.junction-parity.json")
    env = {**os.environ, "HP_WALL_PARITY_BUILD": str(build_dir)}
    result = subprocess.run(["node", str(RUNNER)], cwd=ROOT, env=env,
                            input=json.dumps(request), text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def error_reason(error):
    return getattr(error, "reason", getattr(error, "code", str(error))).removeprefix("node_move_")


def same(actual, expected, context):
    """Bounded exact mismatch, not a multi-megabyte dump of every candidate."""
    def first(a, b, path="$"):
        if a == b:
            return None
        if isinstance(a, dict) and isinstance(b, dict) and a.keys() == b.keys():
            return next((diff for key in a if (diff := first(a[key], b[key], path + "/" + key))), None)
        if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
            return next((diff for i, (x, y) in enumerate(zip(a, b, strict=True))
                         if (diff := first(x, y, path + "/" + str(i)))), None)
        return f"{path}: Python={str(a)[:300]}, TS={str(b)[:300]}"
    assert actual == expected, context + ": " + str(first(actual, expected))


def partition_cases():
    cases = json.loads(CASES.read_text(encoding="utf-8"))
    for case in cases[:]:
        if not case["name"].startswith("unsupported-"):
            continue
        atoms = []
        for wall in case["walls"]:
            if wall["a"] != [0, 0] and wall["b"] != [0, 0]:
                atoms.extend([{**wall, "b": [0, 0]},
                              {**wall, "id": wall["id"] + "-atom", "a": [0, 0]}])
            else:
                atoms.append(wall)
        cases.append({**case, "name": case["name"] + "-atoms", "walls": atoms})
    return [{
        "name": c["name"],
        "input": {"spaces": [{"id": "f", "rooms": [], "partitions": c["walls"],
                              "openings": c.get("openings", []), "future": {"opaque": True}}],
                  "markers": [], "settings": {}},
        "intent": {"point": c["point"], "target": c["target"], "axis": c["axis"],
                   "split_ids": {f'partition:{w["id"]}':
                       f'partition-00000000-0000-4000-8000-{i + 1:012d}'
                       for i, w in enumerate(c["walls"]) if w["id"] == "v"}},
        "expected": {"ok": c["ok"]},
    } for c in cases]


def room_cases():
    """Six topologies, grid/off-grid, reproducible translation seeds."""
    cases = []
    for seed in (845, 846, 9001):
        for off_grid in (False, True):
            offset = (seed % 11) / 240
            x0, x1, x2 = [v + offset for v in
                          ((0.101, 0.302, 0.704) if off_grid else (24 / 240, 72 / 240, 168 / 240))]
            y0, ym, y1 = (0.103, 0.307, 0.709) if off_grid else (24 / 240, 72 / 240, 168 / 240)

            def rect(rid, left, top, right, bottom):
                return {"id": rid, "name": rid,
                        "poly": [[left, top], [right, top], [right, bottom], [left, bottom]]}

            pair = [rect("a", x0, y0, x1, y1), rect("b", x1, y0, x2, y1)]
            layouts = {
                "pair": pair,
                "T": [pair[0], rect("b", x1, ym, x2, y1)],
                "X": [rect("a", x0, y0, x1, ym), rect("b", x1, y0, x2, ym),
                      rect("c", x0, ym, x1, y1), rect("d", x1, ym, x2, y1)],
                "L": [{"id": "a", "name": "a", "poly":
                       [[x0, y0], [x2, y0], [x2, ym], [x1, ym], [x1, y1], [x0, y1]]}],
                "T-partition": [rect("a", x0, y0, x2, y1)],
                "shared-opening": pair,
            }
            for name, rooms in layouts.items():
                space = {"id": "f", "title": "Floor", "cell_cm": 5,
                         "view_box": [0, 0, 1, 1], "rooms": copy.deepcopy(rooms),
                         "future": {"opaque": {"keep": [seed, off_grid]}}}
                # Exact endpoints exercise inheritance without another wall-key formula.
                space["walls"] = [{"key": "legacy-" + str(i) + "-" + str(j),
                                  "a": a, "b": room["poly"][(j + 1) % len(room["poly"])], "cm": 10}
                                 for i, room in enumerate(rooms) for j, a in enumerate(room["poly"])]
                if name == "T-partition":
                    space["partitions"] = [{"id": "branch", "a": [x1, y0], "b": [x1, ym], "cm": 10}]
                if name == "shared-opening":
                    space["openings"] = [{"id": "door", "type": "door", "x": x1, "y": (y0 + y1) / 2,
                                          "angle": -90, "length": 2 / 240, "future": {"keep": True}}]
                cases.append({"name": f"room-{name}-{seed}-{'offgrid' if off_grid else 'grid'}",
                              "input": {"spaces": [space], "markers": [], "settings": {}}})
    return cases


def compare_rows(rows, build_dir):
    moves = accepted = inverses = 0
    cross_inputs = []
    for row in rows:
        name = row["name"]
        source = copy.deepcopy(row["input"])
        try:
            base = source if row.get("mode") == "pure" else commit(source)
        except Exception as error:
            assert not row["ok"] and row["reason"] == error_reason(error), (name, error)
            continue
        assert row["ok"], name
        same(base, row["base"], name + ": first migration")
        if row.get("mode") != "pure":
            assert commit(base) == base == row["repeat"], f"{name}: repeated commit differs"
            assert commit(row["base"]) == row["base"], f"{name}: Python(TS) differs"
            cross_inputs.append(base)
        for move in row.get("moves", []):
            moves += 1
            intent = move["intent"]
            try:
                with pinned_test_ids():
                    after = MODULE.move_node_space(base["spaces"][0], intent) if row.get("mode") == "pure" \
                        else MODULE.node_move_candidate(source, "f", intent)
            except Exception as error:
                assert not move["ok"] and move["reason"] == error_reason(error), (name, intent, error)
                continue
            assert move["ok"], (name, intent)
            assert row.get("mode") != "pure", "corrupt pure vector must refuse"
            same(after, move["after"], name + ": complete candidate " + str(intent))
            same(after, move["repeat"], name + ": repeated TS candidate")
            assert commit(after) == after, f"{name}: server response not stable"
            accepted += 1
            # Browser before_space is the proof input, not Python's own baseline.
            restored = MODULE.node_move_candidate(after, "f", intent, "undo", row["base"]["spaces"][0])
            assert restored == row["base"], f"{name}: browser-baseline Undo differs"
            assert MODULE.node_move_candidate(restored, "f", intent) == after, f"{name}: Redo differs"
            inverses += 1
        assert source == row["input"], name + ": source mutated"
        if "expected" in row and "intent" in row:
            assert row["moves"][0]["ok"] == row["expected"]["ok"], name
    assert frontend({"action": "cross", "configs": cross_inputs}, build_dir) == cross_inputs, "TS(Python) differs"
    return moves, accepted, inverses


def run(build_dir=ROOT / "test-build"):
    vectors = json.loads(IDENTITY.read_text(encoding="utf-8"))["cases"]
    cases = partition_cases() + vectors + room_cases()
    rows = frontend({"action": "cases", "cases": cases}, build_dir)
    assert len(rows) == len(cases)
    counts = compare_rows(rows, build_dir)
    corpus = frontend({"action": "corpus"}, build_dir)
    compare_rows([{**c, "name": c["label"]} for c in corpus], build_dir)
    print(f"wall-node parity: {len(cases)} scenarios + {len(corpus)} corpus documents; "
          f"{counts[0]} moves, {counts[1]} accepted, {counts[2]} exact browser-baseline Undo/Redo; "
          "TS/Python full candidates, cross-idempotence and refusals identical")
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-dir", type=Path, default=ROOT / "test-build")
    raise SystemExit(0 if run(parser.parse_args().build_dir) else 1)
