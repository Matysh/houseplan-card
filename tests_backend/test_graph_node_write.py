"""Identity-owned node gestures with exact undo and retained host policy."""
import copy
from fractions import Fraction

import pytest

from custom_components.houseplan.graph_write import normalize_graph_config
from custom_components.houseplan.graph_node_write import move_graph_node_space, delete_graph_node_space
from custom_components.houseplan.plan_graph_exact import decode_point, read_source_point
from custom_components.houseplan.wall_node_move import node_move_candidate
from custom_components.houseplan.wall_node_move import NodeMoveError
from custom_components.houseplan.wall_node_delete import node_delete_candidate


def config(edges):
    return normalize_graph_config({"model_version": 10, "spaces": [{"id": "s", "title": "Floor", "view_box": [0, 0, 1, 1], "rooms": [], "partitions": edges}], "markers": [], "settings": {}})


def node_at(space, point):
    return next(n["id"] for n in space["plan_graph"]["nodes"] if decode_point(n["p"]) == read_source_point(point))


def test_endpoint_move_and_exact_current_undo():
    before = config([{"id": "a", "a": [0, 0], "b": [1, 0], "cm": 10}])
    space = before["spaces"][0]
    intent = {"node_id": node_at(space, [0, 0]), "point": [0, 0], "target": [0, .25], "target_p": ["l", "0", "60"], "axis": None, "split_ids": {}}
    after = node_move_candidate(before, "s", intent)
    assert after["spaces"][0]["partitions"][0]["a"] == [0, .25]
    assert after["spaces"][0]["plan_graph"]["edges"] == space["plan_graph"]["edges"]
    assert node_move_candidate(after, "s", intent, "undo", space) == before


@pytest.mark.parametrize("target", [[5001, 0], [True, 0], [float("inf"), 0], [float("nan"), 0]])
def test_1380_invalid_numeric_target_keeps_the_node_preflight_error(target):
    before = config([{"id": "a", "a": [0, 0], "b": [1, 0], "cm": 10}])
    frozen = copy.deepcopy(before)
    with pytest.raises(NodeMoveError, match="node_move_invalid"):
        node_move_candidate(before, "s", {"node_id": node_at(before["spaces"][0], [0, 0]),
            "point": [0, 0], "target": target, "axis": None, "split_ids": {}})
    assert before == frozen


def test_1380_numeric_authored_grid_target_does_not_round_explicit_q():
    before = config([{"id": "a", "a": [0, 0], "b": [1, 0], "cm": 10}])
    identity = node_at(before["spaces"][0], [0, 0])
    intent = {"node_id": identity, "point": [0, 0], "target": [1 / 240, 0], "axis": None, "split_ids": {}}
    authored = node_move_candidate(before, "s", intent)
    assert next(n["p"] for n in authored["spaces"][0]["plan_graph"]["nodes"] if n["id"] == identity) == ["l", "1", "0"]
    exact = ["q", "4166666666666667", "1000000000000000000", "0", "1"]
    explicit = node_move_candidate(before, "s", {**intent, "target_p": exact})
    assert next(n["p"] for n in explicit["spaces"][0]["plan_graph"]["nodes"] if n["id"] == identity) == exact
    from custom_components.houseplan.plan_graph_exact import read_authored_point
    assert read_authored_point([.0042, .103]).x == Fraction(21, 5000)
    assert read_authored_point([1 / 240, .103]).y == Fraction(103, 1000)


def test_1380_collinear_endpoint_move_retains_exact_opening_center_and_undo():
    from custom_components.houseplan.wall_segment_model import commit_wall_segment_model

    before = commit_wall_segment_model({"spaces": [{"id": "s", "rooms": [],
        "partitions": [{"id": "a", "a": [0, 0], "b": [1, 0], "cm": 25}],
        "openings": [{"id": "door", "type": "door", "x": .75, "y": 0, "angle": 0,
                      "length": .1, "flip_h": True, "host": {"kind": "partition", "id": "a", "t": .75}}]}],
        "markers": [], "settings": {}})[0]
    space = before["spaces"][0]
    intent = {"node_id": node_at(space, [0, 0]), "point": [0, 0], "target": [-.5, 0], "axis": None, "split_ids": {}}
    after = node_move_candidate(before, "s", intent)
    opening = after["spaces"][0]["openings"][0]
    assert (opening["x"], opening["y"], opening["host"]["tq"], opening["flip_h"]) == (.75, 0, ["5", "6"], True)
    assert node_move_candidate(after, "s", intent, "undo", space) == before


def test_move_retains_on_edge_constraint_and_propagates_dependents():
    before = config([
        {"id": "a", "a": [0, 0], "b": [1, 0], "cm": 10},
        {"id": "b", "a": [.5, 0], "b": [.5, .5], "cm": 10},
    ])
    space = before["spaces"][0]
    intent = {"node_id": node_at(space, [.5, 0]), "point": [.5, 0], "target": [.75, 0], "target_p": ["l", "180", "0"], "axis": "partition:a", "split_ids": {}}
    after = move_graph_node_space(space, intent)
    dependency = next(d for d in after["plan_graph"]["dependencies"] if d["node"] == intent["node_id"])
    assert dependency["parameters"] == [["3", "4"]]


def test_bend_delete_retains_graph_edge_identity_and_exact_inverse():
    before = config([
        {"id": "a", "a": [0, 0], "b": [.5, .25], "cm": 10},
        {"id": "b", "a": [.5, .25], "b": [1, 0], "cm": 10},
    ])
    space = before["spaces"][0]
    intent = {"node_id": node_at(space, [.5, .25]), "point": [.5, .25]}
    after = node_delete_candidate(before, "s", intent)
    assert len(after["spaces"][0]["plan_graph"]["edges"]) == 1
    assert after["spaces"][0]["partitions"] == [{"id": "a", "a": [0, 0], "b": [1, 0], "cm": 10}]
    assert node_delete_candidate(after, "s", intent, "undo", space) == before


def test_1380_delete_degree_uses_selected_graph_identity_not_nearby_endpoints():
    from custom_components.houseplan.plan_graph import project_graph_space
    from custom_components.houseplan.wall_node_delete import NodeDeleteError

    graph = {"version": 1, "nodes": [{"id": "a", "p": ["l", "0", "0"]},
        {"id": "b", "p": ["l", "120", "0"]},
        {"id": "c", "p": ["q", "5000000001", "10000000000", "0", "1"]},
        {"id": "d", "p": ["l", "240", "0"]}],
        "edges": [{"kind": "partition", "id": "a", "from": "a", "to": "b", "cm": 10},
                  {"kind": "partition", "id": "b", "from": "c", "to": "d", "cm": 20}],
        "rooms": [], "dependencies": []}
    source = project_graph_space({"id": "s", "rooms": []}, graph)["space"]
    before = copy.deepcopy(source)
    with pytest.raises(NodeDeleteError, match="node_delete_degree"):
        delete_graph_node_space(source, {"node_id": "b", "point": [.5, 0]})
    assert source == before
