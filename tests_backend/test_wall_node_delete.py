"""#1045 ordinary inputs: local geometry, immutable snapshots and exact inverse."""
import copy
import json
from pathlib import Path

import pytest

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
)
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model

CASES = json.loads((Path(__file__).parents[1] / "test/fixtures/1045-wall-node-delete.json").read_text())


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
