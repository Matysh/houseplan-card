"""#1303: one-node Select intent, independently replayed by TS and Python."""
import copy
import json
from pathlib import Path

from custom_components.houseplan.plan_graph import project_graph_space
from custom_components.houseplan.plan_graph_exact import decode_point, to_numbers
from custom_components.houseplan.wall_node_move import node_move_candidate
from wall_node_parity import commit, frontend

ROOT = Path(__file__).resolve().parents[1]


def test_saved_bent_carrier_exact_server_frontend_and_history():
    graph = json.loads((ROOT / "test/fixtures/1303-bent-carrier.json").read_text())
    space = project_graph_space({"id": "floor", "title": "Floor", "view_box": [0, 0, 1, 1], "cell_cm": 1,
                                 "rooms": [], "openings": []}, graph)["space"]
    before = commit({"model_version": 11, "spaces": [space], "markers": [], "settings": {}})
    space = before["spaces"][0]
    points = {n["id"]: n["p"] for n in space["plan_graph"]["nodes"]}
    start = to_numbers(decode_point(points["drag-end"]))
    intents = [{"node_id": "drag-end", "point": start,
                "target": [start[0] + dx / 240, start[1] + dy / 240],
                "target_p": ["l", str(726 + dx), str(451 + dy)], "axis": None, "split_ids": {}}
               for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1), (12, 0), (0, 12), (267, 173)]]
    replies = frontend({"action": "cases", "cases": [{"name": "1303", "mode": "pure",
                        "input": before, "intents": intents}]}, ROOT / "test-build")[0]["moves"]
    frozen = copy.deepcopy(before)
    for intent, reply in zip(intents, replies, strict=True):
        assert reply["ok"], reply
        after = node_move_candidate(before, "floor", intent)
        assert after == reply["after"]
        for node in after["spaces"][0]["plan_graph"]["nodes"]:
            if node["id"] != "drag-end":
                assert node["p"] == points[node["id"]]
        deps = after["spaces"][0]["plan_graph"]["dependencies"]
        assert not any(d["node"] == "junction" for d in deps)
        restored = node_move_candidate(after, "floor", intent, "undo", space)
        assert restored == before
        assert node_move_candidate(restored, "floor", intent) == after
    assert before == frozen


def test_new_x_bend_retires_far_support_but_keeps_its_real_vertical_carrier():
    def node(identity, x, y):
        return {"id": identity, "p": ["l", str(x * 240), str(y * 240)]}

    def edge(identity, start, end):
        return {"id": identity, "kind": "partition", "from": start, "to": end, "cm": 15}

    graph = {"version": 1, "nodes": [node("p", 0, 0), node("c", 1, 0), node("a", 2, 0),
             node("b", 3, 0), node("d", 2, -2), node("e", 2, 2), node("f", 1, -1)],
             "edges": [edge("pc", "p", "c"), edge("ca", "c", "a"), edge("ab", "a", "b"),
                       edge("da", "d", "a"), edge("ae", "a", "e"), edge("fc", "f", "c")], "rooms": [],
             "dependencies": [
                 {"node": "c", "kind": "on-edge", "refs": [{"from": "p", "to": "b"}], "parameters": [["1", "3"]]},
                 {"node": "a", "kind": "intersection", "refs": [{"from": "p", "to": "b"}, {"from": "d", "to": "e"}],
                  "parameters": [["2", "3"], ["1", "2"]]}]}
    for key, identity in [("nodes", "id"), ("edges", "id"), ("dependencies", "node")]:
        graph[key].sort(key=lambda item: item[identity])
    space = project_graph_space({"id": "floor", "title": "Floor", "view_box": [0, 0, 1, 1], "cell_cm": 1, "rooms": [], "openings": []}, graph)["space"]
    before = commit({"model_version": 11, "spaces": [space], "markers": [], "settings": {}})
    intent = {"node_id": "a", "point": [2, 0], "target": [2, .25], "target_p": ["l", "480", "60"],
              "axis": "partition:ae", "split_ids": {}}
    after = node_move_candidate(before, "floor", intent)
    reply = frontend({"action": "cases", "cases": [{"name": "1303-bend", "mode": "pure",
                      "input": before, "intent": intent}]}, ROOT / "test-build")[0]["moves"][0]
    assert reply["ok"], reply
    assert after == reply["after"]
    dependencies = after["spaces"][0]["plan_graph"]["dependencies"]
    assert not any(d["node"] == "c" for d in dependencies)
    assert next(d for d in dependencies if d["node"] == "a")["refs"] == [{"from": "d", "to": "e"}]
    old = {n["id"]: n["p"] for n in before["spaces"][0]["plan_graph"]["nodes"]}
    assert all(n["p"] == old[n["id"]] for n in after["spaces"][0]["plan_graph"]["nodes"] if n["id"] != "a")
