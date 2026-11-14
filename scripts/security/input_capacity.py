"""Bounded, synthetic #1395 measurements; never reads an installation or URL.

Run from a prepared repository: python scripts/security/input_capacity.py.
--root can point to the pre-fix checkout; --profile ha does not import the new
policy there. The external watchdog protects this experiment, not the core.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import platform
import subprocess
import sys
import tempfile
from contextlib import nullcontext
from pathlib import Path
from time import perf_counter
from types import SimpleNamespace


def worker(profile: str, case: str, count: int) -> None:
    from custom_components.houseplan.core.plan_graph import validate_graph

    nodes, edges, rooms = {}, {}, []

    def node(x, y):
        identity = f"n{x}-{y}"
        nodes[identity] = {"id": identity, "p": ["l", str(x), str(y)]}
        return identity

    def edge(a, b):
        start, end = sorted((a, b))
        identity = f"{start}_{end}"
        edges[identity] = {"id": identity, "kind": "wall", "from": start, "to": end, "cm": 10}
        return {"id": identity, "kind": "wall", "reverse": a != start}

    if case in ("rooms", "import"):
        width, step = (20, 12) if case == "import" else (count, 240)
        for y in range(width):
            for x in range(width):
                points = [node(x * step, y * step), node((x + 1) * step, y * step),
                          node((x + 1) * step, (y + 1) * step), node(x * step, (y + 1) * step)]
                rooms.append({"room": f"r{x}-{y}", "edges": [edge(a, b) for a, b in zip(points, points[1:] + points[:1], strict=True)]})
    else:
        # Overlapping AABBs, distinct parallel lines: a real all-pairs inner
        # intersection workload, not an immediately rejected self-crossing.
        for i in range(count):
            a, b = node(0, i), node(240, count + i)
            edges[str(i)] = {"id": str(i), "kind": "partition", "from": a, "to": b, "cm": 10}
    graph = {"version": 1, "nodes": sorted(nodes.values(), key=lambda row: row["id"]),
             "edges": sorted(edges.values(), key=lambda row: (row["kind"], row["id"])),
             "rooms": sorted(rooms, key=lambda row: row["room"]), "dependencies": []}
    document = None
    if case == "import":
        from custom_components.houseplan.core.import_export import create_export
        from custom_components.houseplan.core.plan_graph import project_graph_space
        spaces = []
        for floor in range(count):
            floor_graph = copy.deepcopy(graph)
            for room in floor_graph["rooms"]:
                room["room"] = f"f{floor}-" + room["room"]
            base = {"id": f"floor{floor}", "title": f"Floor {floor}", "view_box": [0, 0, 1, 1],
                    "rooms": [{"id": room["room"], "name": room["room"]} for room in floor_graph["rooms"]]}
            spaces.append(project_graph_space(base, floor_graph)["space"])
        config = {"model_version": 11, "spaces": spaces, "markers": [], "settings": {}}
        with tempfile.TemporaryDirectory(prefix="houseplan-input-measurement-") as directory:
            try:
                document, _ = create_export(SimpleNamespace(instance_id="synthetic-capacity", integration_version="test"),
                    {"config": config}, {"layout": {}}, kind="full", space_id=None, card_version="test", config_root=Path(directory))
            except Exception as error:
                print(json.dumps({"profile": profile, "fixture": case, "spaces": count, "rooms_per_space": len(rooms),
                    "config_bytes": len(json.dumps(config, separators=(",", ":")).encode()),
                    "outcome": "source-preparation-refused", "code": getattr(error, "code", ""),
                    "reason": getattr(error, "reason", ""), "strict_import_measured": False}))
                return
    encoded = json.dumps(graph, separators=(",", ":")).encode()
    if document is not None:
        encoded = json.dumps(document, separators=(",", ":")).encode()
    before = bytes(encoded)
    scope = nullcontext(None)
    if profile == "strict":
        from custom_components.houseplan.core.input_policy import (
            STRICT_INPUT_POLICY,
            input_scope,
        )
        scope = input_scope(STRICT_INPUT_POLICY)
    started = perf_counter()
    budget = None
    try:
        with scope as budget:
            if document is None:
                validate_graph(graph)
            else:
                from custom_components.houseplan.core.import_export import (
                    parse_document,
                )
                parse_document(encoded)
        outcome = "accepted"
    except Exception as error:
        outcome = type(error).__name__ + ":" + getattr(error, "code", "")
        reason = getattr(error, "reason", "")
    else:
        reason = ""
    elapsed = perf_counter() - started
    assert json.dumps(document if document is not None else graph, separators=(",", ":")).encode() == before
    multiplier = count if case == "import" else 1
    print(json.dumps({"profile": profile, "fixture": case, "spaces": multiplier,
                      "nodes": len(nodes) * multiplier, "edges": len(edges) * multiplier,
                      "rooms": len(rooms) * multiplier, "json_bytes": len(encoded), "work_units": budget.used if budget else None,
                      "elapsed_ms": round(elapsed * 1000, 2), "outcome": outcome, "reason": reason,
                      "python": platform.python_version(), "kernel": platform.release()}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--profile", choices=("ha", "strict"), default="strict")
    parser.add_argument("--worker", nargs=2, metavar=("CASE", "COUNT"))
    parser.add_argument("--full-import", action="store_true", help="Measure complete portable import of 1/10/50 spaces ×400 rooms")
    args = parser.parse_args()
    if args.worker:
        sys.path.insert(0, str(args.root.resolve()))
        worker(args.profile, args.worker[0], int(args.worker[1]))
    else:
        environment = {**os.environ, "PYTHONPATH": str(args.root.resolve())}
        cases = (("import", 1), ("import", 10), ("import", 50)) if args.full_import else (("rooms", 20), ("parallel", 400), ("parallel", 1600))
        for case, count in cases:
            command = [sys.executable, str(Path(__file__).resolve()), "--root", str(args.root.resolve()),
                       "--profile", args.profile, "--worker", case, str(count)]
            try:
                result = subprocess.run(command, env=environment, cwd=args.root, capture_output=True,
                                        text=True, timeout=60 if args.full_import else 12, check=False)
                print(result.stdout, end="", flush=True)
                if result.returncode:
                    print(result.stderr, file=sys.stderr)
                    raise SystemExit(result.returncode)
            except subprocess.TimeoutExpired:
                print(json.dumps({"fixture": case, "count": count, "outcome": "external-watchdog-not-core-protection"}))
