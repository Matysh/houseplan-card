"""#1306: real graph proofs are reused by value, never by mutable identity."""
import copy
import json

import pytest

from test_wall_node_merge import CASES, config, intent
from custom_components.houseplan import plan_graph as graph
from custom_components.houseplan import wall_node_move as move
from custom_components.houseplan.graph_node_write import move_graph_node_space
from custom_components.houseplan.graph_validation_scope import graph_validation_scope, current_graph_validation_scope
from custom_components.houseplan.graph_write import normalize_graph_config
from custom_components.houseplan.plan_graph_exact import GraphError


def ordinary(space):
    source = next(n for n in space["plan_graph"]["nodes"] if n["p"] == ["l", "0", "0"])
    return {"point":[0,0],"target":[-.25,.25],"target_p":["l","-60","60"],"node_id":source["id"],"axis":None,"split_ids":{}}


def test_full_graph_pass_is_once_per_value_and_scope(monkeypatch):
    source = config(CASES[0])["spaces"][0]["plan_graph"]
    compute, calls = graph._validate_graph, []
    def record(value, context=None):
        calls.append(json.dumps(value, sort_keys=True))
        return compute(value, context)
    monkeypatch.setattr(graph, "_validate_graph", record)
    with graph_validation_scope() as scope:
        first = graph.validate_graph(source, {"room_ids":set()})
        equal = copy.deepcopy(source)
        second = graph.validate_graph(equal)
        assert first is not second and first.edges is not second.edges
        first.points.clear(); first.incident.clear(); first.dependency_order.append("poison")
        assert graph.validate_graph(source).points and graph.validate_graph(source).incident
        assert graph.validate_graph(source).dependency_order == []
        assert len(calls) == 1
        equal["edges"][0]["cm"] = 101
        with pytest.raises(GraphError, match="invalid_thickness"):
            graph.validate_graph(equal)
        assert len(calls) == 2
    assert not scope.graphs and current_graph_validation_scope() is None
    graph.validate_graph(source)
    assert len(calls) == 3, "no cross-command proof"


def test_cache_does_not_conflate_python_container_types_or_room_context():
    source = config(CASES[0])["spaces"][0]["plan_graph"]
    with graph_validation_scope():
        graph.validate_graph(source)
        invalid = copy.deepcopy(source); invalid["nodes"] = tuple(invalid["nodes"])
        with pytest.raises(GraphError, match="graph_count_limit"):
            graph.validate_graph(invalid)
    room = normalize_graph_config({"spaces":[{"id":"f","rooms":[{"id":"r","poly":[[0,0],[1,0],[0,1]]}]}]})["spaces"][0]
    with graph_validation_scope():
        graph.validate_graph(room["plan_graph"])
        with pytest.raises(GraphError, match="invalid_room_owner"):
            graph.validate_graph(room["plan_graph"], {"room_ids":set()})
        assert graph.validate_graph(room["plan_graph"], {"room_ids":{"r"}}).rooms


def test_projection_proof_is_content_sensitive_and_never_mutates_input():
    space = config(CASES[0])["spaces"][0]
    frozen = copy.deepcopy(space)
    with graph_validation_scope():
        graph.verify_projection(space)
        bad = copy.deepcopy(space); bad["partitions"][0]["a"][0] += .125
        with pytest.raises(GraphError, match="projection_mismatch"):
            graph.verify_projection(bad)
        graph.verify_projection(space)
    assert space == frozen


def test_cold_home_does_not_evict_unchanged_floor_proofs(monkeypatch):
    source=config(CASES[0])["spaces"][0]["plan_graph"]
    floors=[]
    for i in range(20):
        value=copy.deepcopy(source);value["edges"][0]["props"]={"floor":i};floors.append(value)
    compute,calls=graph._validate_graph,[]
    def record(value,context=None):
        calls.append(value["edges"][0]["props"]["floor"]);return compute(value,context)
    monkeypatch.setattr(graph,"_validate_graph",record)
    with graph_validation_scope():
        for value in floors:graph.validate_graph(value)
        for value in copy.deepcopy(floors):graph.validate_graph(value,{"room_ids":set()})
    assert calls==list(range(20))


def test_current_move_does_not_find_all_pairs_but_legacy_and_negative_control_do(monkeypatch):
    before = config(CASES[0]); operation = ordinary(before["spaces"][0])
    def all_pairs(*args):
        raise RuntimeError("all-pairs regression")
    monkeypatch.setattr(move, "_nodes", all_pairs)
    assert move.node_move_candidate(before,"f",operation)["spaces"]
    physical = move.move_node_space
    def regressed(source, legacy, **kwargs):
        return physical(source, legacy)  # deliberately discard the proven index
    monkeypatch.setattr(move, "move_node_space", regressed)
    with pytest.raises(RuntimeError, match="all-pairs regression"):
        move.node_move_candidate(before,"f",operation)


def test_isolated_graph_node_retains_invalid_refusal():
    space = config(CASES[0])["spaces"][0]
    g = copy.deepcopy(space["plan_graph"])
    g["nodes"].append({"id":"unused","p":["l","720","720"]}); g["nodes"].sort(key=lambda n:n["id"])
    space = graph.project_graph_space(space,g)["space"]
    operation = {"node_id":"unused","point":[3,3],"target":[3.25,3.25],"target_p":["l","780","780"],"axis":None,"split_ids":{}}
    with pytest.raises(move.NodeMoveError, match="node_move_invalid"):
        move_graph_node_space(space,operation)


@pytest.mark.parametrize("case", CASES, ids=lambda c:c["name"])
def test_command_cache_preserves_merge_results_and_inverse_authority(case):
    before = config(case); operation = intent(before["spaces"][0],case)
    if not case["ok"]:
        with graph_validation_scope(), pytest.raises(move.NodeMoveError, match=case["reason"]):
            move.node_move_candidate(before,"f",operation)
        return
    expected = move.node_move_candidate(before,"f",operation)
    with graph_validation_scope():
        assert move.node_move_candidate(before,"f",operation) == expected
        assert move.node_move_candidate(expected,"f",operation,"undo",before["spaces"][0]) == before
        forged = copy.deepcopy(before["spaces"][0]); forged["future"]["keep"] = False
        with pytest.raises(move.NodeMoveError):
            move.node_move_candidate(expected,"f",operation,"undo",forged)
