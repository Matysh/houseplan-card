"""#804: actual frontend room candidates obey unchanged backend barriers."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from custom_components.houseplan.junction_limits import validate_junction_limits
from custom_components.houseplan.validation import (
    CONFIG_SCHEMA,
    PartitionOpeningHostError,
    validate_partition_opening_hosts,
    validate_wall_model_transition,
)
from custom_components.houseplan.wall_segment_model import (
    WallSegmentMigrationError,
    commit_wall_segment_model,
)


_CASES = json.loads((
    Path(__file__).parents[1]
    / "test" / "fixtures" / "804-wall-face-lineage-backend.json"
).read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", _CASES, ids=lambda case: case["name"])
def test_frontend_room_face_candidate_and_partition_host_policy(case: dict) -> None:
    before = copy.deepcopy(case["before"])
    after = copy.deepcopy(case["after"])
    original_before, original_after = copy.deepcopy(before), copy.deepcopy(after)

    # This material is emitted by the frontend production-function pipeline,
    # not a Python reconstruction which could miss the original provisional-ID
    # conflict. The Node test replays the same captured cases independently.
    checked = CONFIG_SCHEMA(after)
    committed, _ = commit_wall_segment_model(checked)
    assert committed == checked
    assert commit_wall_segment_model(committed)[0] == committed
    validate_wall_model_transition(committed, before)
    validate_junction_limits(committed, before)

    if case["expectedPartitionHostResult"] == "reject":
        with pytest.raises(PartitionOpeningHostError, match="host changed"):
            validate_partition_opening_hosts(committed, before)
    else:
        assert case["expectedPartitionHostResult"] == "ok"
        validate_partition_opening_hosts(committed, before)

    assert before == original_before
    assert after == original_after


def test_real_duplicate_catalogue_ids_are_still_rejected_without_mutation() -> None:
    source = copy.deepcopy(_CASES[0]["after"])
    space = source["spaces"][0]
    assert len(space["wall_segments"]) >= 2
    space["wall_segments"][1]["id"] = space["wall_segments"][0]["id"]
    original = copy.deepcopy(source)
    with pytest.raises(WallSegmentMigrationError, match="duplicate-id"):
        commit_wall_segment_model(source)
    assert source == original
