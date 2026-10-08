"""#834: the independent server accepts the same formerly intermittent nodes."""
import copy
import json
from pathlib import Path

import pytest

from custom_components.houseplan.junction_limits import validate_junction_limits
from custom_components.houseplan.validation import CONFIG_SCHEMA, validate_partition_opening_hosts
from custom_components.houseplan.wall_node_move import (
    NodeMoveError,
    node_move_candidate,
    node_move_host_baseline,
)


def connected_floor():
    return json.loads((Path(__file__).parents[1] / "test/fixtures/834-node-connected.json").read_text())


@pytest.mark.parametrize("offset", range(1, 101))
def test_834_connected_floor_safe_neighbours_and_exact_inverse(offset):
    before = connected_floor()
    frozen = copy.deepcopy(before)
    sid = before["spaces"][0]["id"]
    intent = {
        "point": [-401 / 240, 928 / 240],
        "target": [-401 / 240, (928 + offset) / 240],
        "axis": None,
        "split_ids": {},
    }
    after = node_move_candidate(before, sid, intent)
    CONFIG_SCHEMA(after)
    validate_junction_limits(after, before)
    validate_partition_opening_hosts(after, node_move_host_baseline(before, after, sid, intent))
    assert before == frozen
    assert node_move_candidate(after, sid, intent, "undo", before["spaces"][0]) == before
    assert node_move_candidate(before, sid, intent) == after
    assert [opening["length"] for opening in after["spaces"][0]["openings"]] == [
        opening["length"] for opening in before["spaces"][0]["openings"]
    ]


def test_834_connected_floor_collapsed_last_target_is_still_refused():
    before = connected_floor()
    frozen = copy.deepcopy(before)
    with pytest.raises(NodeMoveError):
        node_move_candidate(before, before["spaces"][0]["id"], {
            "point": [-401 / 240, 928 / 240],
            "target": [-401 / 240, 725 / 240],
            "axis": None,
            "split_ids": {},
        })
    assert before == frozen
