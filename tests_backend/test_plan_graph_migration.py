"""Shared exact-wire and legacy migration corpus, independent Python reader."""
import json
import struct
import copy
from pathlib import Path
from urllib.parse import quote

import pytest

from custom_components.houseplan.plan_graph_exact import decode_rational, encode_point, read_source_point
from custom_components.houseplan.plan_graph_migration import migrate_graph_space


CORPUS = json.loads((Path(__file__).parents[1] / "test/fixtures/plan-graph-corpus.json").read_text())


@pytest.mark.parametrize("angle", [0, 45, 137])
def test_1380_overlay_index_preserves_complete_exhaustive_result_and_order(monkeypatch, angle):
    import math

    import custom_components.houseplan.plan_graph_migration as migration

    cosine, sine = math.cos(math.radians(angle)), math.sin(math.radians(angle))

    def point(x, y):
        return [x * cosine - y * sine, x * sine + y * cosine]

    rooms, walls = [], []
    for i in range(12):
        poly = [point(i * 2 + x, y) for x, y in [(0, 0), (1, 0), (1, 1), (0, 1)]]
        rooms.append({"id": f"r{i}", "poly": poly})
        for j, a in enumerate(poly):
            b = poly[(j + 1) % 4]
            walls.append({"key": migration._wall_key(a, b), "a": b if j % 2 else a,
                          "b": a if j % 2 else b, "cm": 10})
    source = {"id": "floor", "cell_cm": 5, "rooms": rooms, "walls": walls}
    frozen = copy.deepcopy(source)
    original_tree = migration._Tree

    def run(exhaustive):
        examined = []

        class QueryTree(original_tree):
            def __init__(self, items, depth=0):
                self.overlay_rows = items if items and "order" in items[0] else None
                self.root = depth == 0
                super().__init__(items, depth)

            def query(self, lo, hi):
                rows = self.overlay_rows if exhaustive and self.overlay_rows is not None else super().query(lo, hi)
                if self.root and self.overlay_rows is not None:
                    examined.append(len(rows))
                return rows

        monkeypatch.setattr(migration, "_Tree", QueryTree)
        return migration.migrate_graph_space(source), sum(examined)

    indexed, fast_count = run(False)
    exhaustive, full_count = run(True)
    assert indexed == exhaustive
    assert source == frozen
    assert fast_count < full_count / 2


def test_1380_legacy_overlay_key_index_keeps_the_first_duplicate():
    import custom_components.houseplan.plan_graph_migration as migration

    a, b = [0, 0], [1, 0]
    key = migration._wall_key(a, b)
    sources, _, _ = migration._collect({"id": "f", "rooms": [{"id": "r", "poly": [a, b, [0, 1]]}],
        "walls": [{"key": key, "cm": 10}, {"key": key, "cm": 20}]})
    edge = next(s for s in sources if s["a"] == migration.read_source_point(a) and s["b"] == migration.read_source_point(b))
    assert edge["cm"] == 10


def test_1282_decimal_lattice_alias_retains_optional_grid_anchor_through_contacts():
    from custom_components.houseplan.plan_graph import validate_graph
    source = {"id": "floor", "cell_cm": 5, "rooms": [{"id": "r", "name": "R",
        "poly": [[0, 0], [72 / 240, 44 / 240], [72 / 240, 120 / 240], [0, 120 / 240]]}]}
    original = copy.deepcopy(source)
    result = migrate_graph_space(source, {"source_model_version": 10})
    assert all(node["p"][0] == "l" for node in result["graph"]["nodes"])
    assert source == original
    validate_graph(result["graph"])


@pytest.mark.parametrize("case", CORPUS["exact"], ids=lambda c: c["id"])
def test_correct_binary64(case):
    assert struct.pack(">d", float(decode_rational(case["q"]))).hex() == case["hex"]


@pytest.mark.parametrize("case", CORPUS["points"])
def test_canonical_exact_point(case):
    assert encode_point(read_source_point(case["source"])) == case["wire"]


@pytest.mark.parametrize("case", CORPUS["migrations"], ids=lambda c: c["id"])
def test_shared_legacy_migration(case):
    original = json.dumps(case["space"], sort_keys=True)
    result = migrate_graph_space(case["space"])
    for key, expected in case["expected"].items():
        assert len(result["graph"][key]) == expected
    assert json.dumps(case["space"], sort_keys=True) == original
    assert result["migrationReport"]["maxDisplacementCm"] <= .001000001


def test_478_independent_zero_and_positive_material_have_the_complete_ts_target():
    from custom_components.houseplan.wall_segment_model import commit_wall_segment_model
    from custom_components.houseplan.plan_graph import validate_graph

    case = json.loads((Path(__file__).parents[1] / "test/fixtures/478-room-draft-migration-vectors.json").read_text())["accepted"]
    frozen = copy.deepcopy(case["input"])
    existing, free, zero, reverse = case["expected_partitions"]

    def node(identity, side):
        return "n:" + quote(json.dumps(["partition", identity, side], separators=(",", ":")), safe="~()*!.'-_")

    start, end = node(zero["id"], 0), node(zero["id"], 1)
    graph = dict(version=1, nodes=[
        dict(id=node(existing["id"], 0), p=["l", "480", "0"]),
        dict(id=node(existing["id"], 1), p=["l", "720", "0"]),
        dict(id=start, p=["l", "60", "0"]), dict(id=end, p=["l", "120", "0"]),
        dict(id=node(free["id"], 0), p=["l", "0", "0"]),
    ], edges=[
        dict(id=existing["id"], kind="partition", **{"from": node(existing["id"], 0), "to": node(existing["id"], 1)}, cm=10),
        dict(id=zero["id"], kind="partition", **{"from": start, "to": end}, cm=0),
        dict(id=free["id"], kind="partition", **{"from": node(free["id"], 0), "to": start}, cm=15),
        dict(id=reverse["id"], kind="partition", **{"from": start, "to": end}, cm=22),
    ], rooms=[], dependencies=[])
    graph["nodes"].sort(key=lambda n: n["id"])
    graph["edges"].sort(key=lambda e: e["id"])
    partitions = [dict(p, a=min(p["a"], p["b"]), b=max(p["a"], p["b"])) for p in case["expected_partitions"]]
    partitions.sort(key=lambda p: p["id"])
    target = dict(model_version=11, markers=[], settings={}, spaces=[dict(
        id="floor", title="Floor", rooms=[], wall_segments=[], partitions=partitions, walls=[], plan_graph=graph)])
    validate_graph(graph)
    actual, _ = commit_wall_segment_model(case["input"])
    assert actual == target
    assert case["input"] == frozen
    assert commit_wall_segment_model(target)[0] == target


def test_real_plan_contact_constraints_have_finite_free_anchors():
    from custom_components.houseplan.plan_graph import validate_graph
    fixture = json.loads((Path(__file__).parents[1] / "test/fixtures/real-plan-first-floor.json").read_text())
    result = migrate_graph_space(fixture["space"], {"source_model_version": 10})
    validate_graph(result["graph"])
    assert result["migrationReport"]["maxDisplacementCm"] <= .001000000001


def test_existing_opening_occupancy_contract():
    from custom_components.houseplan.plan_graph import validate_graph, edge_key
    from custom_components.houseplan.plan_graph_exact import to_numbers
    cases = json.loads((Path(__file__).parents[1] / "test/fixtures/1033-opening-overlap-guard.json").read_text())["cases"]
    for case in cases:
        result = migrate_graph_space(case["input"]["spaces"][0], {"source_model_version": case["input"].get("model_version", 0)})
        index = validate_graph(result["graph"])
        observed = {}
        for opening in result["space"]["openings"]:
            host = opening.get("host")
            edge = index.edges[edge_key(host)] if host else None
            observed[opening["id"]] = dict(a=to_numbers(index.points[edge["from"]]), b=to_numbers(index.points[edge["to"]]), t=host["t"]) if host else None
        assert observed == case["expect"], case["name"]


def test_connected_834_contacts_do_not_feed_previous_projection_rounds():
    """Ordinary connected decimal/lattice input must fit the unchanged exact budget."""
    from custom_components.houseplan.plan_graph import validate_graph, verify_projection
    from custom_components.houseplan.plan_graph_exact import MAX_BITS, decode_point
    source = json.loads((Path(__file__).parents[1] / "test/fixtures/834-node-connected.json").read_text())
    before = json.dumps(source, sort_keys=True)
    space = source["spaces"][0]
    result = migrate_graph_space(space, {"source_model_version": source["model_version"]})
    validate_graph(result["graph"])
    verify_projection(result["space"])
    assert {room["room"] for room in result["graph"]["rooms"]} == {room["id"] for room in space["rooms"]}
    assert result["migrationReport"]["maxDisplacementCm"] <= .001000000001
    for node in result["graph"]["nodes"]:
        point = decode_point(node["p"])
        assert max(abs(q.numerator).bit_length() for q in (point.x, point.y)) <= MAX_BITS
        assert max(q.denominator.bit_length() for q in (point.x, point.y)) <= MAX_BITS
    assert json.dumps(source, sort_keys=True) == before


def test_1216_witnessed_contacts_match_ts_canonical_digest():
    from custom_components.houseplan.graph_digest import graph_digest
    from custom_components.houseplan.plan_graph import validate_graph
    cases = json.loads((Path(__file__).parents[1] / "test/fixtures/1216-contact-corpus.json").read_text())["cases"]
    for case in cases:
        source = case["space"]
        witness = case["witness"]
        # Independent witness is checked before either implementation runs.
        assert len(source["partitions"]) <= 32
        assert sum((a-b)**2 for a,b in zip(witness["owner"],witness["host"])) <= witness["radius"]**2
        result = migrate_graph_space(source, {"source_model_version":10})
        assert graph_digest(result["graph"]) == case["expected_digest"], case["seed"]
        validate_graph(result["graph"])
        assert result["migrationReport"]["maxDisplacementCm"] <= .001000000001


def test_1216_room_owner_witness_preserves_closed_cycles_and_ts_parity():
    from custom_components.houseplan.graph_digest import graph_digest
    from custom_components.houseplan.plan_graph import validate_graph
    corpus = json.loads((Path(__file__).parents[1] / "test/fixtures/1216-contact-corpus.json").read_text())
    for case in corpus["room_cases"]:
        source = case["space"]
        owners = [p for r in source["rooms"] for p in r["poly"]] + [e[side] for e in source["wall_segments"] for side in ("a","b")]
        assert all(any(sum((a-b)**2 for a,b in zip(p,q)) <= (1/1200000)**2 for q in case["witness"]) for p in owners)
        result = migrate_graph_space(source,{"source_model_version":10})
        validate_graph(result["graph"])
        assert graph_digest(result["graph"]) == case["expected_digest"]
        assert result["migrationReport"]["maxDisplacementCm"] <= .001000000001
