"""#996: frontend deletion/promotion candidates cross the actual server guard."""
import copy
import json
from pathlib import Path

import pytest

from custom_components.houseplan.validation import (
    CONFIG_SCHEMA,
    PartitionOpeningHostError,
    validate_partition_opening_hosts,
    validate_wall_model_transition,
)


CASES = json.loads((Path(__file__).parents[1] / "test/fixtures/996-room-opening-host-candidates.json").read_text())


@pytest.fixture(scope="module", params=CASES, ids=lambda case: f"{case['type']}-reverse-{case['reverse']}")
def room_host_candidates(request):
    return request.param


def test_issue_996_frontend_room_restoration_and_recreation(room_host_candidates):
    cases = room_host_candidates
    frozen = copy.deepcopy(cases)
    for before, after in (
        (cases["before"], cases["deleted"]),
        (cases["deleted"], cases["before"]),  # actual Undo target
        (cases["before"], cases["deleted"]),  # Redo
        (cases["deleted"], cases["recreated"]),
    ):
        checked = CONFIG_SCHEMA(after)
        validate_wall_model_transition(checked, before)
        validate_partition_opening_hosts(checked, before, allow_room_wall_promotion=True)
    assert cases == frozen


@pytest.mark.parametrize("change", [
    "carrier-id", "missing-carrier", "surviving-partition", "unowned-wall", "shift-axis",
    "short-axis", "thin", "thick", "zero", "scale", "t", "x", "angle", "length", "type",
    "contact", "extra-opening-field", "future-partition-field", "future-wall-field",
    "foreign-space", "missing-old-carrier", "bad-axis", "partial-carrier",
])
def test_issue_996_ordinary_promotion_rejects_changed_carrier_or_opening(room_host_candidates, change):
    before = copy.deepcopy(room_host_candidates["deleted"])
    after = copy.deepcopy(room_host_candidates["recreated"])
    space, old_space = after["spaces"][0], before["spaces"][0]
    opening = space["openings"][0]
    carrier_id = opening["host"]["id"]
    wall = next(wall for wall in space["wall_segments"] if wall["id"] == carrier_id)
    old_wall = next(wall for wall in old_space["partitions"] if wall["id"] == carrier_id)
    if change == "carrier-id":
        wall["id"] = opening["host"]["id"] = "unrelated-carrier"
    elif change == "missing-carrier":
        space["wall_segments"].remove(wall)
    elif change == "surviving-partition":
        space.setdefault("partitions", []).append(copy.deepcopy(old_wall))
    elif change == "unowned-wall":
        space["rooms"] = []
    elif change == "shift-axis":
        wall["a"][1] += 0.01
        wall["b"][1] += 0.01
    elif change == "short-axis":
        wall["b"][0] -= 0.05
    elif change in ("thin", "thick", "zero"):
        wall["cm"] = {"thin": 10, "thick": 20, "zero": 0}[change]
    elif change == "scale":
        space["cell_cm"] = 6
    elif change == "t":
        opening["host"]["t"] = 1 - opening["host"]["t"]
    elif change in ("x", "angle", "length"):
        opening[change] += 0.01
    elif change == "type":
        opening["type"] = "window" if opening["type"] == "door" else "door"
    elif change == "contact":
        opening["contact"] = "binary_sensor.other"
    elif change == "extra-opening-field":
        opening["future_semantics"] = True
    elif change == "future-wall-field":
        wall["future_semantics"] = True
    elif change == "foreign-space":
        space["wall_segments"].remove(wall)
        after["spaces"].append({"id": "other-floor", "rooms": [], "wall_segments": [wall]})
    elif change == "missing-old-carrier":
        old_space["partitions"].remove(old_wall)
    elif change == "bad-axis":
        wall["a"][0] = None
    elif change == "partial-carrier":
        old_wall["a"][0] -= 0.1
        old_wall["b"][0] += 0.1
        old_space["openings"][0]["host"]["t"] = (
            (opening["x"] - old_wall["a"][0]) / (old_wall["b"][0] - old_wall["a"][0])
        )
    else:
        old_wall["future_semantics"] = True
    frozen_before, frozen_after = copy.deepcopy(before), copy.deepcopy(after)
    # Deliberately bypass schema normalization here: the guard itself must
    # refuse, even when x/y and a surviving host ID look superficially valid.
    with pytest.raises(PartitionOpeningHostError, match="host changed"):
        validate_partition_opening_hosts(after, before, allow_room_wall_promotion=True)
    assert before == frozen_before and after == frozen_after


def test_issue_996_unrelated_write_and_deletion_keep_previous_policy(room_host_candidates):
    before = room_host_candidates["deleted"]
    unrelated = copy.deepcopy(before)
    unrelated["spaces"][0]["title"] = "New title"
    validate_partition_opening_hosts(CONFIG_SCHEMA(unrelated), before)
    # A direct edit on a surviving independent wall is still the old path.
    moved = copy.deepcopy(before)
    moved["spaces"][0]["openings"][0]["host"]["t"] = 0.5
    validate_partition_opening_hosts(CONFIG_SCHEMA(moved), before)
    removed = copy.deepcopy(before)
    removed["spaces"][0]["openings"] = []
    validate_partition_opening_hosts(CONFIG_SCHEMA(removed), before)


def test_issue_996_promotion_does_not_grant_import_or_optimize_new_capabilities(room_host_candidates):
    # Only the server's ordinary config/set path opts into the exact proof.
    # Import and existing callers retain their default policy, not a user flag.
    with pytest.raises(PartitionOpeningHostError, match="host changed"):
        validate_partition_opening_hosts(room_host_candidates["recreated"], room_host_candidates["deleted"])
    validate_partition_opening_hosts(room_host_candidates["recreated"], room_host_candidates["deleted"],
                                     allow_optimize_rehost=True)


@pytest.mark.parametrize("old_meta,new_meta", [
    ({"enabled": True}, {"enabled": 1}),
    ({"nested": [{"enabled": False}]}, {"nested": [{"enabled": 0}]}),
    ({"nested": [1]}, {"nested": [True]}),
])
def test_issue_996_promotion_compares_unknown_metadata_as_json_types(room_host_candidates, old_meta, new_meta):
    before = copy.deepcopy(room_host_candidates["deleted"])
    after = copy.deepcopy(room_host_candidates["recreated"])
    before["spaces"][0]["openings"][0]["future_metadata"] = old_meta
    after["spaces"][0]["openings"][0]["future_metadata"] = new_meta
    with pytest.raises(PartitionOpeningHostError, match="host changed"):
        validate_partition_opening_hosts(CONFIG_SCHEMA(after), CONFIG_SCHEMA(before), allow_room_wall_promotion=True)
    after["spaces"][0]["openings"][0]["future_metadata"] = copy.deepcopy(old_meta)
    # JSON number 1.0 legitimately becomes 1 through a browser round-trip;
    # preserve that existing contract, but not a boolean disguised as a number.
    before["spaces"][0]["openings"][0]["precision_metadata"] = 1.0
    after["spaces"][0]["openings"][0]["precision_metadata"] = 1
    validate_partition_opening_hosts(CONFIG_SCHEMA(after), CONFIG_SCHEMA(before), allow_room_wall_promotion=True)
