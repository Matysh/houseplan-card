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


def _config(current):
    return {"model_version": 11, "spaces": [current], "markers": [], "settings": {}}


def _rehost(current, identity="two", tq=("1", "2")):
    changed = copy.deepcopy(current)
    opening = changed["openings"][0]
    opening["host"] = {"kind": "partition", "id": identity, "t": int(tq[0])/int(tq[1]), "tq": list(tq)}
    return project_graph_space(changed, changed["plan_graph"])["space"]


def test_opening_move_across_unchanged_atomic_host_seam_is_same_carrier():
    before = _rehost(space(), "one", ("1", "2"))
    after = _rehost(before)
    assert after["openings"][0]["x"] == .75
    assert CONFIG_SCHEMA(_config(after)) == _config(after)
    validate_partition_opening_hosts(_config(after), _config(before))


@pytest.mark.parametrize("boundary", ["detached", "thickness", "props", "newly-joined"])
def test_anchor_change_does_not_authorize_a_foreign_or_newly_joined_carrier(boundary):
    from custom_components.houseplan.validation import PartitionOpeningHostError
    before = _rehost(space(), "one", ("1", "2"))
    graph = copy.deepcopy(before["plan_graph"])
    if boundary in {"detached", "newly-joined"}:
        graph["nodes"].append({"id": "d", "p": ["l", "120", "0"]})
        graph["edges"][1]["from"] = "d"
    elif boundary == "thickness":
        graph["edges"][1]["cm"] = 20
    else:
        graph["edges"][1]["props"] = {"material": "foreign"}
    before = project_graph_space(before, graph)["space"]
    after = _rehost(before)
    if boundary == "newly-joined":
        graph = copy.deepcopy(after["plan_graph"])
        graph["edges"][1]["from"] = "b"
        after = project_graph_space(after, graph)["space"]
    assert CONFIG_SCHEMA(_config(after)) == _config(after)
    with pytest.raises(PartitionOpeningHostError):
        validate_partition_opening_hosts(_config(after), _config(before))


def test_same_run_rehost_still_reserves_physical_end_jambs():
    from custom_components.houseplan.validation import PartitionOpeningJambMarginError
    before = _rehost(space(), "one", ("1", "2"))
    after = _rehost(before, "two", ("4", "5"))
    # Its occupied interval fits exactly, but leaves no physical jamb margin.
    assert CONFIG_SCHEMA(_config(after)) == _config(after)
    with pytest.raises(PartitionOpeningJambMarginError):
        validate_partition_opening_hosts(_config(after), _config(before))


def test_current_plan_only_transfer_keeps_exact_host_parameter(tmp_path):
    import json
    from types import SimpleNamespace
    from custom_components.houseplan.import_export import create_export, parse_document, ImportFailure
    graph = {"version": 1, "nodes": [
        {"id": "a", "p": ["l", "0", "0"]}, {"id": "b", "p": ["l", "80", "0"]}],
        "edges": [{"id": "one", "kind": "wall", "from": "a", "to": "b", "cm": 12}],
        "rooms": [], "dependencies": []}
    host = {"kind": "wall", "id": "one", "t": .5125000000000001,
            "tq": ["5125000000000001", "10000000000000000"]}
    current = project_graph_space({"id": "s", "title": "S", "view_box": [0, 0, 1, 1], "rooms": [],
        "openings": [{"id": "o", "type": "window", "x": 0, "y": 0, "angle": 0, "length": .05,
                      "host": host}]}, graph)["space"]
    config = _config(current)
    assert CONFIG_SCHEMA(config) == config
    document, _ = create_export(SimpleNamespace(instance_id="exact-transfer"), {"config": config, "rev": 1},
        {"layout": {}, "rev": 1}, kind="space", space_id="s", plan_only=True, card_version="test", config_root=tmp_path)
    assert document["payload"]["config"]["spaces"][0]["openings"][0]["host"] == host
    decoded = parse_document(json.dumps(document).encode())
    assert decoded["payload"]["config"]["spaces"][0]["openings"][0]["host"] == host
    forged = copy.deepcopy(document)
    forged["payload"]["config"]["spaces"][0]["openings"][0]["host"]["t"] = .5125
    with pytest.raises(ImportFailure) as refused:
        parse_document(json.dumps(forged).encode())
    assert refused.value.code == "invalid_config"
    assert "opening_projection_mismatch" in str(refused.value)
