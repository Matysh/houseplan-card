"""#803 local delta and inverse proofs, including forged clients."""
import copy

import pytest

from custom_components.houseplan.validation import (
    CONFIG_SCHEMA,
    PartitionOpeningHostError,
    validate_partition_opening_hosts,
)
from custom_components.houseplan.wall_node_move import (
    NodeMoveError,
    node_move_candidate,
)
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model


def wall(identity, a, b, cm=0):
    return {"id": identity, "a": a, "b": b, "cm": cm}


def fixture():
    cfg = {"spaces": [{"id": "f", "title": "Floor", "view_box": [0, 0, 1, 1], "rooms": [],
        "partitions": [wall("h", [-1, 0], [1, 0]), wall("v", [0, -1], [0, 1], 25)],
        "openings": [{"id": "door", "type": "door", "x": 0, "y": 0.65, "length": 0.1, "angle": -90,
                      "host": {"kind": "partition", "id": "v", "t": 0.825}, "flip_h": True}],
        "future": {"unchanged": "opaque"}}], "markers": [], "settings": {}}
    return commit_wall_segment_model(cfg)[0]


def intent():
    return {"point": [0, 0], "target": [0.25, 0], "axis": "partition:h", "split_ids": {"partition:v": "new-v"}}


def test_x_apply_inverse_and_redo_are_exact_and_ordinary_set_remains_strict():
    before = fixture()
    frozen = copy.deepcopy(before)
    after = node_move_candidate(before, "f", intent())
    assert before == frozen
    assert CONFIG_SCHEMA(after) == after
    assert after["spaces"][0]["partitions"][1]["a"] == [0, -1]
    assert after["spaces"][0]["partitions"][2]["b"] == [0, 1]
    assert after["spaces"][0]["openings"][0]["host"]["id"] == "new-v"
    assert after["spaces"][0]["future"] == before["spaces"][0]["future"]
    with pytest.raises(PartitionOpeningHostError):
        validate_partition_opening_hosts(after, before)
    restored = node_move_candidate(after, "f", intent(), "undo", before["spaces"][0])
    assert restored == before
    assert node_move_candidate(restored, "f", intent()) == after


@pytest.mark.parametrize("change", ["far_end", "opening", "metadata", "room", "split_identity"])
def test_forged_inverse_cannot_change_foreign_fields(change):
    before = fixture()
    after = node_move_candidate(before, "f", intent())
    forged = copy.deepcopy(before["spaces"][0])
    operation = intent()
    if change == "far_end":
        forged["partitions"][1]["b"] = [0, 1.2]
    elif change == "opening":
        forged["openings"][0]["length"] = 0.09
    elif change == "metadata":
        forged["future"]["unchanged"] = "forged"
    elif change == "room":
        forged["rooms"].append({"id": "new-room", "name": "New", "poly": [[2, 2], [3, 2], [2, 3]]})
    elif change == "split_identity":
        operation["split_ids"]["partition:v"] = "forged-id"
    with pytest.raises(NodeMoveError):
        node_move_candidate(after, "f", operation, "undo", forged)


@pytest.mark.parametrize("walls", [
    [wall("h", [-1, 0], [1, 0]), wall("b", [0, 0], [0, 1]), wall("c", [0, 0], [1, 1])],
    [wall("h", [-1, 0], [1, 0]), wall("v", [0, -1], [0, 1]), wall("c", [0, 0], [1, 1])],
    [wall("h", [-1, 0], [1, 0]), wall("v", [0, -1], [0, 1]), wall("d", [-1, -1], [1, 1])],
])
def test_backend_refuses_unsupported_junctions_even_when_client_requests_only_one_axis(walls):
    before = fixture()
    before["spaces"][0]["partitions"] = walls
    before["spaces"][0]["openings"] = []
    with pytest.raises(NodeMoveError, match="unsupported_junction"):
        node_move_candidate(before, "f", intent())


def test_node_point_must_exist_and_grid_exemption_must_be_geometrically_proved():
    before = fixture()
    operation = intent()
    operation["point"] = [0.1, 0]
    with pytest.raises(NodeMoveError):
        node_move_candidate(before, "f", operation)

    operation = intent()
    operation["axis"] = None
    operation["target"] = [0.1, 0.17]
    with pytest.raises(NodeMoveError):
        node_move_candidate(before, "f", operation)


@pytest.mark.parametrize("sign", [-1, 1])
def test_whole_carrier_opening_is_a_swept_barrier(sign):
    before = fixture()
    space = before["spaces"][0]
    space["partitions"] = [wall("h", [-1, 0], [1, 0], 25), wall("b", [0, 0], [0, 1])]
    space["openings"] = [{"id": "door", "type": "door", "x": sign * 0.5, "y": 0, "length": 0.1,
                          "angle": 0, "host": {"kind": "partition", "id": "h", "t": (sign * 0.5 + 1) / 2}}]
    operation = {"point": [0, 0], "target": [sign * 0.25, 0], "axis": "partition:h", "split_ids": {}}
    assert node_move_candidate(before, "f", operation)["spaces"][0]["openings"] == space["openings"]
    for magnitude in [0.445, 0.5, 0.75]:
        operation["target"] = [sign * magnitude, 0]
        with pytest.raises(NodeMoveError, match="opening_blocked"):
            node_move_candidate(before, "f", operation)
