"""Independent named-attach proof, original host lineage and exact inverse."""
import copy
import json
from pathlib import Path
import pytest
from custom_components.houseplan.plan_graph import project_graph_space, validate_graph
from custom_components.houseplan.plan_graph_exact import point_at, decode_rational, encode_point, to_numbers
from custom_components.houseplan.wall_node_move import node_move_candidate, node_move_host_baseline, NodeMoveError

CASES = json.loads((Path(__file__).parents[1] / "test/fixtures/1330-node-attach.json").read_text())
ID = "node-attach-00000000-0000-4000-8000-000000000001"


def config(case):
    space = project_graph_space({"id": "f", "title": "Attach", "rooms": case["rooms"], "openings": case["openings"],
                                 "cell_cm": 5, "view_box": [-.1, -.1, 1.2, 1.2], "future": {"keep": True}}, case["graph"])["space"]
    return {"model_version": 11, "spaces": [space], "markers": [], "settings": {}}


def intent(space, case):
    index = validate_graph(space["plan_graph"])
    host = next(e for e in space["plan_graph"]["edges"] if e["id"] == "host")
    p = point_at(index.points[host["from"]], index.points[host["to"]], decode_rational(case["tq"]))
    return {"node_id": "s", "point": to_numbers(index.points["s"]), "target": to_numbers(p), "target_p": encode_point(p),
            "axis": None, "split_ids": {}, "attach_edge": {"kind": host["kind"], "id": "host", "tq": case["tq"], "new_edge_id": ID}}


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["name"])
def test_named_attach_source_and_inverse_proof(case):
    before = config(case)
    source = before["spaces"][0]
    operation = intent(source, case)
    frozen = copy.deepcopy(before)
    if not case["ok"]:
        with pytest.raises(NodeMoveError, match=case["reason"]):
            node_move_candidate(before, "f", operation)
    else:
        after = node_move_candidate(before, "f", operation)
        index = validate_graph(after["spaces"][0]["plan_graph"])
        assert len(index.incident["s"]) == 3
        assert node_move_candidate(after, "f", operation, "undo", source) == before
        node_move_host_baseline(before, after, "f", operation)
        node_move_host_baseline(after, before, "f", operation, "undo", source)
        forged = copy.deepcopy(source)
        forged["future"]["keep"] = 1
        with pytest.raises(NodeMoveError):
            node_move_candidate(after, "f", operation, "undo", forged)
    assert before == frozen


@pytest.mark.parametrize("tamper", ["degree2", "merge", "unknown", "extra-attach", "tq-unreduced", "tq-bound", "target", "source", "id-collision", "source-host", "axis"])
def test_forged_attach_has_no_broader_admission(tamper):
    case = CASES[10] if tamper == "degree2" else CASES[0]
    before = config(case)
    operation = intent(before["spaces"][0], case)
    if tamper == "merge":
        operation["merge_node_id"] = "a"
    elif tamper == "unknown":
        operation["allow_contact"] = True
    elif tamper == "extra-attach":
        operation["attach_edge"]["allow_contact"] = True
    elif tamper == "tq-unreduced":
        operation["attach_edge"]["tq"] = ["2", "4"]
    elif tamper == "tq-bound":
        operation["attach_edge"]["tq"] = ["0", "1"]
    elif tamper == "target":
        operation["target_p"] = ["l", "121", "0"]
    elif tamper == "source":
        operation["point"] = [0, 0]
    elif tamper == "id-collision":
        operation["attach_edge"]["new_edge_id"] = "branch"
    elif tamper == "source-host":
        operation["attach_edge"]["id"] = "branch"
    elif tamper == "axis":
        operation["axis"] = "wall:branch"
    with pytest.raises(NodeMoveError, match="merge_target"):
        node_move_candidate(before, "f", operation)


@pytest.mark.parametrize("tamper", ["host", "metadata", "metadata-bool-number", "foreign-floor", "opening-settings", "root-settings", "root-markers"])
def test_attach_host_ledger_compares_complete_forward_candidate(tamper):
    case = next(c for c in CASES if c["name"] == "receiver opening first child")
    before = config(case)
    before["spaces"].append(project_graph_space({"id": "other", "rooms": [], "future": "fixed"}, {"version": 1, "nodes": [], "edges": [], "rooms": [], "dependencies": []})["space"])
    operation = intent(before["spaces"][0], case)
    after = node_move_candidate(before, "f", operation)
    if tamper == "host":
        after["spaces"][0]["openings"][0]["host"]["id"] = "branch"
    elif tamper == "metadata":
        after["spaces"][0]["future"]["keep"] = False
    elif tamper == "metadata-bool-number":
        after["spaces"][0]["future"]["keep"] = 1
    elif tamper == "foreign-floor":
        after["spaces"][1]["future"] = "changed"
    elif tamper == "root-settings":
        after["settings"]["extra"] = True
    elif tamper == "root-markers":
        after["markers"].append({"id": "forged"})
    else:
        after["spaces"][0]["openings"][0]["flip_h"] = False
    with pytest.raises(NodeMoveError):
        node_move_host_baseline(before, after, "f", operation)
