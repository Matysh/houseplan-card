"""#1045 clean-runner equality of complete TS/Python local deletion documents."""
import copy
import json
import math
from pathlib import Path

from pure_imports import load_pure
from wall_node_parity import ROOT, commit, frontend, same

MODULE = load_pure("custom_components.houseplan.wall_node_delete",
                   ROOT / "custom_components/houseplan/wall_node_delete.py")


def run(build_dir):
    if not (Path(build_dir) / "wall-node-delete.js").is_file():
        raise FileNotFoundError("node deletion parity prerequisites are missing; compile tsconfig.junction-parity.json")
    vectors = json.loads((ROOT / "test/fixtures/1045-wall-node-delete.json").read_text())
    cases = [{"name": c["name"], "mode": "pure", "input": {"spaces": [c["space"]]}, "point": c["point"], "expected": c}
             for c in vectors]
    for name, rooms in [
        ("corner", [{"id": "r", "poly": [[0, 0], [1, 0], [1, 1], [0, 1]], "future": {"keep": True}}]),
        ("collinear", [{"id": "r", "poly": [[0, 0], [1, 0], [2, 0], [2, 1], [0, 1]]}]),
        ("shared", [{"id": "r", "poly": [[0, 0], [1, 0], [2, 0], [2, 1], [0, 1]]},
                    {"id": "s", "poly": [[2, 0], [1, 0], [0, 0], [0, -1], [2, -1]]}]),
    ]:
        cases.append({"name": name, "input": {"spaces": [{"id": "f", "rooms": rooms}], "markers": [], "settings": {}}, "point": [1, 0]})
    originals = list(cases)
    for angle in (45, 90, 135, 180, 225, 270, 315):
        radians = math.radians(angle)
        c, s = math.cos(radians), math.sin(radians)
        def transform(point, cosine=c, sine=s):
            return [point[0] * cosine - point[1] * sine + .125, point[0] * sine + point[1] * cosine - .25]
        for original in originals:
            case = copy.deepcopy(original)
            case["name"] += f"-rotated-{angle}"
            case["point"] = transform(case["point"])
            for space in case["input"]["spaces"]:
                for wall in space.get("partitions", []) + space.get("wall_segments", []):
                    wall["a"], wall["b"] = transform(wall["a"]), transform(wall["b"])
                for room in space.get("rooms", []):
                    room["poly"] = [transform(p) for p in room["poly"]]
                for opening in space.get("openings", []):
                    opening["x"], opening["y"] = transform([opening["x"], opening["y"]])
                    opening["angle"] = (opening["angle"] + angle + 90) % 180 - 90
            cases.append(case)
    rows = frontend({"action": "delete", "cases": cases}, build_dir)
    assert len(rows) == len(cases)
    accepted = 0
    for case, row in zip(cases, rows, strict=True):
        frozen = copy.deepcopy(case["input"])
        base = case["input"] if case.get("mode") == "pure" else commit(case["input"])
        same(base, row["before"], case["name"] + ": original canonical snapshot")
        intent = {"point": case["point"]}
        try:
            result = MODULE.delete_node_space(base["spaces"][0], intent)
        except MODULE.NodeDeleteError as error:
            assert not row["ok"] and error.code == "node_delete_" + row["reason"], case["name"]
        else:
            assert row["ok"], case["name"]
            same(result, row["space"], case["name"] + ": complete local delta")
            after = commit({**base, "spaces": [result]})
            same(after, row["after"], case["name"] + ": complete canonical candidate")
            canonical = commit(base)
            proved = MODULE.node_delete_candidate(canonical, "f", intent)
            same(proved, after, case["name"] + ": real server forward proof")
            restored = MODULE.node_delete_candidate(after, "f", intent, "undo", canonical["spaces"][0])
            same(restored, canonical, case["name"] + ": exact browser-baseline Undo")
            same(MODULE.node_delete_candidate(restored, "f", intent), after, case["name"] + ": exact Redo")
            accepted += 1
        assert case["input"] == frozen
        if "expected" in case:
            assert row["ok"] == case["expected"]["ok"], case["name"]
    print(f"wall-node deletion parity: {len(cases)} scenarios; {accepted} accepted, exact complete candidates/Undo/Redo and refusals identical")
    return accepted
