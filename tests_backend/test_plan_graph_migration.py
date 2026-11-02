"""Shared exact-wire and legacy migration corpus, independent Python reader."""
import json
import struct
from pathlib import Path

import pytest

from custom_components.houseplan.plan_graph_exact import decode_rational, encode_point, read_source_point
from custom_components.houseplan.plan_graph_migration import migrate_graph_space


CORPUS = json.loads((Path(__file__).parents[1] / "test/fixtures/plan-graph-corpus.json").read_text())


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
