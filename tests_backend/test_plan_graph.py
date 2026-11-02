"""Exact graph authority, independently observable projection and bad writers."""
import copy
from fractions import Fraction

import pytest

from custom_components.houseplan.plan_graph_exact import (
    ExactPoint, GraphError, decode_point, encode_point, intersection,
    normalization_radius, read_source_point, squared_distance, to_numbers,
)
from custom_components.houseplan.plan_graph import project_graph_space, validate_graph, verify_projection


def graph():
    return {"version": 1, "nodes": [
        {"id": "a", "p": ["l", "0", "0"]}, {"id": "b", "p": ["l", "240", "0"]},
        {"id": "c", "p": ["l", "240", "240"]}, {"id": "d", "p": ["l", "0", "240"]}],
        "edges": [{"id": str(i), "kind": "wall", "from": a, "to": b, "cm": 10}
                  for i, (a, b) in enumerate((("a", "b"), ("b", "c"), ("c", "d"), ("d", "a")))],
        "rooms": [{"room": "r", "edges": [{"kind": "wall", "id": str(i), "reverse": False} for i in range(4)]}],
        "dependencies": []}


def test_exact_crossing_and_correct_binary64_projection_survive_100_round_trips():
    # y=x intersects y=(1-x)/2 at (1/3,1/3): rational and also lattice80.
    p, t, u = intersection(read_source_point(0, 0), read_source_point(1, 1),
                           read_source_point(0, .5), read_source_point(1, 0))
    assert p == ExactPoint(Fraction(1, 3), Fraction(1, 3))
    assert t == u == Fraction(1, 3)
    assert to_numbers(p)[0].hex() == "0x1.5555555555555p-2"
    original = encode_point(p)
    for _ in range(100):
        p = decode_point(encode_point(p))
    assert encode_point(p) == original == ["l", "80", "80"]
    off_grid = ExactPoint(Fraction(1, 7), Fraction(-1, 7))
    assert encode_point(off_grid) == ["q", "1", "7", "-1", "7"]
    assert decode_point(encode_point(off_grid)) == off_grid


@pytest.mark.parametrize("bad", [["l", "-0", "0"], ["l", "01", "0"],
    ["q", "2", "6", "1", "3"], ["q", "1", "-3", "1", "3"],
    ["q", "1", "240", "0", "1"], ["l", "1200001", "0"],
    ["l", "1" * 2000, "0"]])
def test_reject_noncanonical_or_unbounded_wire(bad):
    with pytest.raises(GraphError):
        decode_point(bad)


def test_physical_radius_is_euclidean_and_scale_bounded():
    assert normalization_radius(5) == Fraction(1, 1200000)
    radius = normalization_radius(1000)
    assert radius * 240 * 1000 == Fraction(1, 10)  # cm, exactly 1 mm
    assert squared_distance(ExactPoint(radius, radius), read_source_point(0, 0)) > radius ** 2


def test_graph_projection_preserves_metadata_but_rejects_a_stale_poly_writer():
    source = {"id": "floor", "rooms": [{"id": "r", "name": "Kitchen", "custom": {"number": .123456789123}}]}
    projected = project_graph_space(source, graph())["space"]
    assert projected["rooms"][0]["poly"] == [[0., 0.], [1., 0.], [1., 1.], [0., 1.]]
    assert projected["rooms"][0]["custom"] == source["rooms"][0]["custom"]
    verify_projection(projected)
    projected["rooms"][0]["poly"][0][0] = .1
    with pytest.raises(GraphError, match="projection_mismatch"):
        verify_projection(projected)
    assert "plan_graph" not in source


def test_wall_and_partition_ids_are_separate_namespaces():
    value = graph()
    value["edges"].insert(0, {"id": "0", "kind": "partition", "from": "a", "to": "c", "cm": 10})
    assert len(validate_graph(value).edges) == 5


def test_dependent_support_survives_a_topological_edge_split():
    value = graph()
    value["nodes"].append({"id": "p", "p": ["l", "120", "0"]})
    value["edges"][0]["to"] = "p"
    value["edges"].append({"id": "4", "kind": "wall", "from": "p", "to": "b", "cm": 10})
    value["rooms"][0]["edges"].insert(1, {"kind": "wall", "id": "4", "reverse": False})
    value["dependencies"] = [{"node": "p", "kind": "on-edge", "refs": [{"from": "a", "to": "b"}], "parameters": [["1", "2"]]}]
    before = copy.deepcopy(value)
    assert validate_graph(value).dependency_order == ["p"]
    value["nodes"][-1]["p"] = ["l", "121", "0"]
    with pytest.raises(GraphError, match="dependency_point_mismatch"):
        validate_graph(value)
    assert before["nodes"][-1]["p"] == ["l", "120", "0"]


def test_reject_closed_id_cycle_with_zero_area_and_third_owner():
    value = graph()
    value["rooms"] *= 3
    value["rooms"] = [{**room, "room": str(i)} for i, room in enumerate(value["rooms"])]
    with pytest.raises(GraphError, match="third_wall_owner"):
        validate_graph(value)
    value = graph()
    value["nodes"][2]["p"] = ["l", "480", "0"]
    value["nodes"][3]["p"] = ["l", "720", "0"]
    with pytest.raises(GraphError, match="zero_area_room"):
        validate_graph(value)
