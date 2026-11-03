"""#834: the independent server accepts the same formerly intermittent nodes."""
import copy
import json
from pathlib import Path
from fractions import Fraction

import pytest

from custom_components.houseplan.junction_limits import validate_junction_limits
from custom_components.houseplan.validation import CONFIG_SCHEMA, validate_partition_opening_hosts
from custom_components.houseplan.wall_node_move import (
    NodeMoveError,
    node_move_candidate,
    node_move_host_baseline,
)
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model
from custom_components.houseplan.plan_graph_exact import ExactPoint, decode_point, encode_point, to_numbers


def connected_floor():
    legacy = json.loads((Path(__file__).parents[1] / "test/fixtures/834-node-connected.json").read_text())
    return commit_wall_segment_model(legacy)[0]


def connected_intent(before, offset):
    """Resolve the known fixture node once, then address it by exact identity."""
    nodes = before["spaces"][0]["plan_graph"]["nodes"]
    node = next(n for n in nodes if all(abs(a - b) < 1e-9 for a, b in zip(
        to_numbers(decode_point(n["p"])), [-401 / 240, 928 / 240], strict=True)))
    point = decode_point(node["p"])
    target = ExactPoint(point.x, point.y + Fraction(offset, 240))
    return {"node_id": node["id"], "point": to_numbers(point), "target": to_numbers(target),
            "target_p": encode_point(target), "axis": None, "split_ids": {}}


@pytest.mark.parametrize("offset", range(1, 101))
def test_834_connected_floor_safe_neighbours_and_exact_inverse(offset):
    before = connected_floor()
    frozen = copy.deepcopy(before)
    sid = before["spaces"][0]["id"]
    intent = connected_intent(before, offset)
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
        node_move_candidate(before, before["spaces"][0]["id"], connected_intent(before, 725 - 928))
    assert before == frozen
