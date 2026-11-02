"""First-write authority, stale projection echo and exact legacy source."""
import copy

import pytest

from custom_components.houseplan.graph_write import normalize_graph_config, prepare_graph_candidate
from custom_components.houseplan.plan_graph_exact import GraphError


def legacy():
    return {"model_version": 10, "spaces": [{"id": "s", "title": "A", "view_box": [0, 0, 1, 1], "wall_segments": [], "rooms": [], "partitions": [
        {"id": "a", "a": [0, 0], "b": [1, 0], "cm": 10},
        {"id": "b", "a": [.5, .0000002], "b": [.5, .5], "cm": 10},
    ]}], "markers": [], "settings": {}}


def empty_patch():
    return {key: {"set": [], "remove": []} for key in ("nodes", "edges", "rooms", "dependencies")}


def test_metadata_only_legacy_does_not_migrate_but_structural_write_does():
    before = legacy()
    edit = copy.deepcopy(before)
    edit["spaces"][0]["title"] = "B"
    assert prepare_graph_candidate(edit, before) == edit
    edit["spaces"][0]["partitions"][1]["b"] = [.5, .6]
    migrated = prepare_graph_candidate(edit, before)
    assert migrated["model_version"] == 11
    assert len(migrated["spaces"][0]["plan_graph"]["edges"]) == 3
    assert before["spaces"][0]["partitions"][1]["a"] == [.5, .0000002]


def test_first_patch_uses_backend_baseline_not_client_base_coordinates():
    before = legacy()
    normalized = normalize_graph_config(before)
    submitted = copy.deepcopy(normalized)
    graph = submitted["spaces"][0]["plan_graph"]
    forged_base = copy.deepcopy(graph)
    forged_base["nodes"][0]["p"] = ["l", "2", "2"]
    change = {"version": 1, "spaces": [{"space_id": "s", "base": forged_base, "patch": empty_patch()}]}
    assert prepare_graph_candidate(submitted, before, change) == normalized
    with pytest.raises(GraphError, match="missing_first_graph_change"):
        prepare_graph_candidate(submitted, before)


def test_current_projection_echo_and_downgrade_fail_before_store():
    current = normalize_graph_config(legacy())
    edited = copy.deepcopy(current)
    edited["spaces"][0]["partitions"][0]["a"][0] += .1
    with pytest.raises(GraphError):
        prepare_graph_candidate(edited, current)
    with pytest.raises(GraphError) as caught:
        prepare_graph_candidate(legacy(), current)
    assert caught.value.code == "wall_model_client_outdated"
