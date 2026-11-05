"""Named node contraction, independent server reconstruction and inverse proof."""
import copy
import json
from pathlib import Path

import pytest

from custom_components.houseplan.graph_write import normalize_graph_config
from custom_components.houseplan.plan_graph import project_graph_space, validate_graph
from custom_components.houseplan.plan_graph_exact import decode_point, read_source_point
from custom_components.houseplan.wall_node_move import NodeMoveError, node_move_candidate, node_move_host_baseline
from custom_components.houseplan.wall_node_merge import merge_graph_node_space

CASES = json.loads((Path(__file__).parents[1] / "test/fixtures/1305-node-merge.json").read_text())
DEPENDENCIES = json.loads((Path(__file__).parents[1] / "test/fixtures/1305-node-merge-dependencies.json").read_text())


@pytest.mark.parametrize("case", DEPENDENCIES, ids=lambda c: c["name"])
def test_source_support_is_rewritten_before_dependency_traversal(case):
    def node(i,x,y):
        return {"id":i,"p":["l",str(x*240),str(y*240)]}
    def edge(i,a,b):
        return {"id":i,"kind":"partition","from":a,"to":b,"cm":10}
    tx,ty=case["target"]
    graph={"version":1,"nodes":[node("s",0,0),node("c",1,0),node("b",2,0),node("f",1,-1),node("t",tx,ty),node("u",tx,ty+1)],
           "edges":[edge("sc","s","c"),edge("cb","c","b"),edge("fc","f","c"),edge("tu","t","u")],"rooms":[],"dependencies":[case["support"]]}
    graph["nodes"].sort(key=lambda n:n["id"]);graph["edges"].sort(key=lambda e:e["id"])
    space=project_graph_space({"id":"f","rooms":[],"openings":[],"cell_cm":5},graph)["space"]
    frozen=copy.deepcopy(space)
    result=merge_graph_node_space(space,{"node_id":"s","merge_node_id":"t","point":[0,0],"target":case["target"],"target_p":["l",str(tx*240),str(ty*240)],"axis":None,"split_ids":{}})
    assert result["plan_graph"]["dependencies"]==case["expected"]
    assert space==frozen
    assert {n["id"]:n["p"] for n in result["plan_graph"]["nodes"]}=={n["id"]:n["p"] for n in graph["nodes"] if n["id"]!="s"}


def config(case):
    return normalize_graph_config({"model_version": 10, "spaces": [{"id": "f", "title": "Floor", "view_box": [0, 0, 1, 1], "cell_cm": 5,
        "rooms": [], "partitions": case["walls"], "openings": case.get("openings", []), "future": {"keep": True}}], "markers": [], "settings": {}})


def intent(space, case):
    def node(point):
        return next(n for n in space["plan_graph"]["nodes"] if decode_point(n["p"]) == read_source_point(point))
    target = node(case["target"])
    return {"point": case["point"], "target": case["target"], "node_id": node(case["point"])["id"], "merge_node_id": target["id"],
            "target_p": target["p"], "axis": case.get("axis"), "split_ids": {}}


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["name"])
def test_named_merge_forward_inverse_and_original_host_authority(case):
    before = config(case)
    space = before["spaces"][0]
    operation = intent(space, case)
    frozen = copy.deepcopy(before)
    if not case["ok"]:
        with pytest.raises(NodeMoveError) as error:
            node_move_candidate(before, "f", operation)
        assert error.value.code == "node_move_" + case["reason"]
    else:
        after = node_move_candidate(before, "f", operation)
        graph = after["spaces"][0]["plan_graph"]
        validate_graph(graph)
        assert operation["node_id"] not in {n["id"] for n in graph["nodes"]}
        assert node_move_candidate(after, "f", operation, "undo", space) == before
        node_move_host_baseline(before, after, "f", operation)
        node_move_host_baseline(after, before, "f", operation, "undo", space)
        forged = copy.deepcopy(space)
        forged["future"]["keep"] = False
        with pytest.raises(NodeMoveError):
            node_move_candidate(after, "f", operation, "undo", forged)
    assert before == frozen


def test_compaction_host_lineage_is_reconstructed_for_both_directions():
    case = {**CASES[2], "walls": [{**w, "cm": 10} for w in CASES[2]["walls"]], "openings": [
        {"id": "door", "type": "door", "x": .75, "y": 0, "angle": 0, "length": .1, "host": {"kind": "partition", "id": "b", "t": .5}, "flip_h": True}]}
    before = config(case)
    operation = intent(before["spaces"][0], case)
    after = node_move_candidate(before, "f", operation)
    assert after["spaces"][0]["openings"][0]["host"]["id"] == "a"
    assert after["spaces"][0]["openings"][0]["x"] == .75
    baseline = node_move_host_baseline(before, after, "f", operation)
    assert baseline["spaces"][0]["openings"][0]["host"]["id"] == "a"
    inverse = node_move_host_baseline(after, before, "f", operation, "undo", before["spaces"][0])
    assert inverse["spaces"][0]["openings"][0]["host"]["id"] == "b"
    forged = copy.deepcopy(after)
    forged["spaces"][0]["openings"][0]["host"]["id"] = "unrelated"
    with pytest.raises(NodeMoveError):
        node_move_host_baseline(before, forged, "f", operation)


def test_opening_on_removed_section_and_forged_target_are_refused():
    case = {**CASES[1], "walls": [{**w, "cm": 10} for w in CASES[1]["walls"]], "openings": [{"id": "door", "type": "door", "x": 1.5, "y": 0, "angle": 0, "length": .1,
        "host": {"kind": "partition", "id": "b", "t": .5}}]}
    before = config(case)
    with pytest.raises(NodeMoveError, match="merge_opening"):
        node_move_candidate(before, "f", intent(before["spaces"][0], case))
    case = CASES[0]
    before = config(case)
    operation = intent(before["spaces"][0], case)
    operation["target_p"] = ["l", "239", "240"]
    with pytest.raises(NodeMoveError, match="merge_target"):
        node_move_candidate(before, "f", operation)


def test_q_target_remains_exact_and_foreign_values_are_preserved():
    case = CASES[0]
    before = config(case)
    space = before["spaces"][0]
    operation = intent(space, case)
    next(n for n in space["plan_graph"]["nodes"] if n["id"] == operation["merge_node_id"])["p"] = ["q", "1", "7", "1", "1"]
    space = project_graph_space(space, space["plan_graph"])["space"]
    operation["target_p"], operation["target"] = ["q", "1", "7", "1", "1"], [1/7, 1]
    after = merge_graph_node_space(space, operation)
    assert next(n for n in after["plan_graph"]["nodes"] if n["id"] == operation["merge_node_id"])["p"] == ["q", "1", "7", "1", "1"]
    assert after["future"] == space["future"]


def test_target_retains_its_independent_vertical_support():
    def node(i, x, y):
        return {"id": i, "p": ["l", str(x*240), str(y*240)]}
    def edge(i, a, b):
        return {"id": i, "kind": "partition", "from": a, "to": b, "cm": 10}
    graph = {"version": 1, "nodes": [node("s",0,0),node("t",1,0),node("b",2,0),node("d",1,-1),node("e",1,1)],
             "edges": [edge("st","s","t"),edge("tb","t","b"),edge("dt","d","t"),edge("te","t","e")], "rooms": [],
             "dependencies": [{"node":"t","kind":"intersection","refs":[{"from":"s","to":"b"},{"from":"d","to":"e"}],"parameters":[["1","2"],["1","2"]]}]}
    graph["nodes"].sort(key=lambda n: n["id"])
    graph["edges"].sort(key=lambda e: e["id"])
    space = project_graph_space({"id":"f","rooms":[],"openings":[],"cell_cm":5}, graph)["space"]
    result = merge_graph_node_space(space, {"node_id":"s","merge_node_id":"t","point":[0,0],"target":[1,0],"target_p":["l","240","0"],"axis":None,"split_ids":{}})
    assert result["plan_graph"]["dependencies"] == [{"node":"t","kind":"on-edge","refs":[{"from":"d","to":"e"}],"parameters":[["1","2"]]}]
