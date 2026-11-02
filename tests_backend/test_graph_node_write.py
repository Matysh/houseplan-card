"""Identity-owned node gestures with exact undo and retained host policy."""
import copy

import pytest

from custom_components.houseplan.graph_write import normalize_graph_config
from custom_components.houseplan.graph_node_write import move_graph_node_space, delete_graph_node_space
from custom_components.houseplan.plan_graph_exact import decode_point, read_source_point
from custom_components.houseplan.wall_node_move import node_move_candidate
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
