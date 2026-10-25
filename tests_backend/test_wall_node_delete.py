"""#1045 ordinary inputs: local geometry, immutable snapshots and exact inverse."""
import copy
import json
from pathlib import Path

import pytest
import voluptuous as vol

from custom_components.houseplan.junction_limits import validate_junction_limits
from custom_components.houseplan.validation import (
    CONFIG_SCHEMA,
    validate_partition_opening_hosts,
)
from custom_components.houseplan.wall_node_delete import (
    NodeDeleteError,
    delete_node_space,
    node_delete_candidate,
    node_delete_host_baseline,
    prepare_node_delete,
)
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model

CASES = json.loads((Path(__file__).parents[1] / "test/fixtures/1045-wall-node-delete.json").read_text())


def test_issue_1075_current_version_does_not_bypass_complete_schema():
    current = fixture()
    current["spaces"].append({"id": "other", "title": "Other", "view_box": [0, 0, 1, 1],
        "wall_segments": [], "rooms": [{"id": "bad", "name": "Bad", "area": None,
            "poly": [[0, 0], [1, 0], [1, 1], [0, 1]], "wall_ids": ["missing"] * 4}]})
    frozen = copy.deepcopy(current)
    prepared = prepare_node_delete(current, "f", {"point": [1, 0]})
    with pytest.raises(vol.Invalid):
        CONFIG_SCHEMA(prepared.candidate)
    assert current == frozen


@pytest.mark.parametrize("case", CASES, ids=lambda item: item["name"])
def test_issue_1045_shared_physical_cases(case):
    before = copy.deepcopy(case["space"])
    if not case["ok"]:
        with pytest.raises(NodeDeleteError) as raised:
            delete_node_space(case["space"], {"point": case["point"]})
        assert raised.value.code == "node_delete_" + case["reason"]
    else:
        after = delete_node_space(case["space"], {"point": case["point"]})
        assert len(after["partitions"]) == 1
        assert after["partitions"][0]["id"] == "a"
        assert [after["partitions"][0]["a"], after["partitions"][0]["b"]] == case["span"]
        if "hostT" in case:
            assert after["openings"][0] == {**before["openings"][0], "host": {
                **before["openings"][0]["host"], "id": "a", "t": case["hostT"]}}
        if after["partitions"][0].get("future"):
            after["partitions"][0]["future"]["a"] = "changed after return"
            assert before == case["space"], "returned nested attributes must not alias the before snapshot"
    assert before == case["space"]


def fixture():
    return commit_wall_segment_model({"spaces": [{"id": "f", "title": "Floor", "view_box": [0, 0, 2, 1],
        "rooms": [], "partitions": [{"id": "a", "a": [0, 0], "b": [1, 0], "cm": 15},
                                    {"id": "b", "a": [1, 0], "b": [2, 0], "cm": 15}],
        "openings": [{"id": "o", "type": "door", "x": 1.5, "y": 0, "length": .2, "angle": 0,
                      "host": {"kind": "partition", "id": "b", "t": .5}, "flip_h": True}],
        "future": {"untouched": True}}], "markers": [], "settings": {}})[0]


def test_issue_1045_inverse_host_ledger_and_redo_preserve_exact_document():
    before, intent = fixture(), {"point": [1, 0]}
    frozen = copy.deepcopy(before)
    after = node_delete_candidate(before, "f", intent)
    assert CONFIG_SCHEMA(after) == after
    validate_junction_limits(after, before)
    validate_partition_opening_hosts(after, node_delete_host_baseline(before, after, "f", intent))
    restored = node_delete_candidate(after, "f", intent, "undo", before["spaces"][0])
    assert restored == before
    validate_partition_opening_hosts(restored, node_delete_host_baseline(after, restored, "f", intent, "undo", before["spaces"][0]))
    assert node_delete_candidate(restored, "f", intent) == after
    assert before == frozen
    for mutate in [
        lambda space: space.update(future={"forged": True}),
        lambda space: space["partitions"][0].update(a=[-.25, 0]),
        lambda space: space["openings"][0].update(length=.3),
        lambda space: space["openings"][0].update(host={"kind": "partition", "id": "foreign", "t": .5}),
    ]:
        forged = copy.deepcopy(before["spaces"][0])
        mutate(forged)
        with pytest.raises(NodeDeleteError):
            node_delete_candidate(after, "f", intent, "undo", forged)
    malicious = copy.deepcopy(after)
    malicious["spaces"][0]["openings"][0]["host"]["id"] = "foreign"
    with pytest.raises(NodeDeleteError):
        node_delete_host_baseline(before, malicious, "f", intent)


@pytest.mark.parametrize("point", [[float("nan"), 0], [float("inf"), 0], [5001, 0], [True, 0], [1], None])
def test_issue_1045_protocol_points_are_finite_and_bounded(point):
    with pytest.raises(NodeDeleteError):
        delete_node_space(fixture()["spaces"][0], {"point": point})


def test_issue_1045_room_corner_and_shared_ownership_inverse():
    for rooms in [
        [{"id": "r", "name": "Room", "poly": [[0, 0], [1, 0], [1, 1], [0, 1]]}],
        [{"id": "r", "name": "Room", "poly": [[0, 0], [1, 0], [2, 0], [2, 1], [0, 1]]},
         {"id": "s", "name": "Other", "poly": [[2, 0], [1, 0], [0, 0], [0, -1], [2, -1]]}],
    ]:
        before = commit_wall_segment_model({"spaces": [{"id": "f", "title": "Floor", "view_box": [0, 0, 2, 2],
            "rooms": rooms}], "markers": [], "settings": {}})[0]
        after = node_delete_candidate(before, "f", {"point": [1, 0]})
        assert CONFIG_SCHEMA(after) == after
        validate_junction_limits(after, before)
        assert len(after["spaces"][0]["wall_segments"]) == len(before["spaces"][0]["wall_segments"]) - 1
        assert node_delete_candidate(after, "f", {"point": [1, 0]}, "undo", before["spaces"][0]) == before
        for old, new in zip(before["spaces"][0]["rooms"], after["spaces"][0]["rooms"], strict=True):
            assert len(new["poly"]) == len(old["poly"]) - 1
            assert [1, 0] not in new["poly"]


def test_issue_1075_current_target_proof_never_materializes_an_unchanged_other_floor(monkeypatch):
    from custom_components.houseplan import wall_node_delete as kernel

    current = fixture()
    remote = commit_wall_segment_model({"spaces": [{"id": "other", "title": "Other", "view_box": [0, 0, 1, 1], "rooms": [
        {"id": "untouched", "name": "Untouched", "area": None,
         "poly": [[0, 0], [1, 0], [1, 1], [0, 1]], "future": {"keep": True}}
    ]}]})[0]["spaces"][0]
    current["spaces"].append(remote)
    original = copy.deepcopy(current)
    materialized = []
    commit = kernel.commit_wall_segment_model

    def observe(config, **kwargs):
        materialized.append([space["id"] for space in config.get("spaces", [])])
        return commit(config, **kwargs)

    monkeypatch.setattr(kernel, "commit_wall_segment_model", observe)
    prepared = prepare_node_delete(current, "f", {"point": [1, 0]})
    candidate = CONFIG_SCHEMA(prepared.candidate)
    calls_before_host = copy.deepcopy(materialized)
    validate_partition_opening_hosts(candidate, prepared.host_baseline(candidate))
    assert materialized == calls_before_host, "host lineage shares the already prepared source"
    assert len(materialized) == 2 and all(ids == ["f"] for ids in materialized)
    inverse = prepare_node_delete(candidate, "f", {"point": [1, 0]}, "undo", current["spaces"][0])
    validate_partition_opening_hosts(inverse.candidate, inverse.host_baseline(inverse.candidate))
    assert inverse.candidate == original
    assert all(ids == ["f"] for ids in materialized)
    assert current == original and candidate["spaces"][1] == remote


def test_issue_1075_legacy_basis_still_materializes_the_full_document(monkeypatch):
    from custom_components.houseplan import wall_node_delete as kernel

    current = fixture()
    current["model_version"] = 7
    current["spaces"].append({"id": "legacy-other", "rooms": [{"id": "r", "poly": [[0, 0], [1, 0], [0, 1]]}]})
    calls = []
    commit = kernel.commit_wall_segment_model

    def observe(config, **kwargs):
        calls.append([space["id"] for space in config.get("spaces", [])])
        return commit(config, **kwargs)

    monkeypatch.setattr(kernel, "commit_wall_segment_model", observe)
    prepared = prepare_node_delete(current, "f", {"point": [1, 0]})
    assert calls[0] == ["f", "legacy-other"]
    assert prepared.candidate["model_version"] == 10
    assert prepared.candidate["spaces"][1]["wall_segments"]
