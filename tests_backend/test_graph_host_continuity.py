"""Host continuity preserves physical spans without joining coincident nodes."""
import copy

import pytest

from custom_components.houseplan.graph_host_continuity import GraphHostContinuity
from custom_components.houseplan.plan_graph import project_graph_space
from custom_components.houseplan.validation import CONFIG_SCHEMA, validate_partition_opening_hosts


def space():
    graph = {"version": 1, "nodes": [
        {"id": "a", "p": ["l", "0", "0"]},
        {"id": "b", "p": ["l", "120", "0"]},
        {"id": "c", "p": ["l", "240", "0"]}],
        "edges": [
            {"id": "one", "kind": "partition", "from": "a", "to": "b", "cm": 12},
            {"id": "two", "kind": "partition", "from": "b", "to": "c", "cm": 12}],
        "rooms": [], "dependencies": []}
    base = {"id": "s", "title": "S", "view_box": [0, 0, 1, 1], "rooms": [],
            "openings": [{"id": "o", "type": "window", "x": .5, "y": 0,
                          "angle": 0, "length": .2,
                          "host": {"kind": "partition", "id": "one", "t": 1, "tq": ["1", "1"]}}]}
    return project_graph_space(base, graph)["space"]


def test_shared_atom_boundary_preserves_fit_jambs_and_namespace():
    current = space()
    config = {"model_version": 11, "spaces": [current], "markers": [], "settings": {}}
    assert CONFIG_SCHEMA(config) == config
    validate_partition_opening_hosts(config)
    index = GraphHostContinuity(current)
    first = index.interval(current["openings"][0]["host"])
    second = index.interval({"kind": "partition", "id": "two", "t": 0, "tq": ["0", "1"]})
    assert first == second
    assert first[1:] == (1, .5)


@pytest.mark.parametrize("change", ["detached", "thickness", "props", "zero", "ambiguous"])
def test_no_implicit_continuity_across_semantic_or_identity_boundaries(change):
    current = space()
    graph = copy.deepcopy(current["plan_graph"])
    if change == "detached":
        graph["nodes"].append({"id": "d", "p": ["l", "120", "0"]})
        graph["edges"][1]["from"] = "d"
    elif change == "thickness":
        graph["edges"][1]["cm"] = 20
    elif change == "zero":
        graph["edges"][1]["cm"] = 0
    elif change == "props":
        graph["edges"][1]["props"] = {"material": "other"}
    else:
        graph["nodes"].append({"id": "d", "p": ["l", "300", "0"]})
        graph["edges"].append({"id": "third", "kind": "partition", "from": "b", "to": "d", "cm": 12})
        graph["edges"].sort(key=lambda e: (e["kind"], e["id"]))
    current["plan_graph"] = graph
    index = GraphHostContinuity(current)
    run = index.interval(current["openings"][0]["host"])
    assert run[1:] == (.5, .5)
    other = index.interval({"kind": "partition", "id": "two", "t": 0, "tq": ["0", "1"]})
    if other is not None:
        assert other[0] != run[0]


def test_overlapping_openings_on_different_children_share_one_interval_ledger():
    import voluptuous as vol
    current = space()
    current["openings"].append({**copy.deepcopy(current["openings"][0]), "id": "other",
                                "host": {"kind": "partition", "id": "two", "t": 0, "tq": ["0", "1"]}})
    with pytest.raises(vol.Invalid, match="must not overlap"):
        CONFIG_SCHEMA({"model_version": 11, "spaces": [current], "markers": [], "settings": {}})
