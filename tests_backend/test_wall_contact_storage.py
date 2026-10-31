"""#1166: canonical derived cuts are one wall identity before publication."""
import copy
import json
from pathlib import Path
import pytest

from custom_components.houseplan.junction_limits import validate_junction_limits, check_nodes
from custom_components.houseplan.partition_promotion import same_partition_wall_chain_promotion
from custom_components.houseplan.validation import (
    CONFIG_SCHEMA, validate_partition_opening_hosts, validate_wall_model_transition,
    PartitionOpeningHostError, WallModelClientOutdatedError,
)
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model


def test_shared_derived_cut_has_one_storage_identity_and_survives_next_write():
    fixture = json.loads((Path(__file__).parents[1] / "test/fixtures/1166-shared-cut.json").read_text())
    candidate = copy.deepcopy(fixture["source"])
    candidate["spaces"][0]["rooms"].append(copy.deepcopy(fixture["room"]))
    first, _ = commit_wall_segment_model(candidate)
    space = first["spaces"][0]
    spans = [json.dumps([wall["a"], wall["b"]]) for wall in space["wall_segments"]]
    assert len(set(spans)) == len(spans)
    assert next(w for w in space["wall_segments"] if w["id"] == "south")["future_wall"] == {"keep": True}
    assert set(space["rooms"][0]["wall_ids"]) & set(space["rooms"][1]["wall_ids"])
    assert commit_wall_segment_model(first)[0] == first


def test_actual_frontend_room_candidates_survive_backend_commit_and_junction_guards():
    cases = json.loads((Path(__file__).parents[1] / "test/fixtures/1166-room-candidates.json").read_text())
    for case in cases:
        previous = copy.deepcopy(case["source"])
        for candidate in case["candidates"]:
            checked = CONFIG_SCHEMA(copy.deepcopy(candidate))
            committed, _ = commit_wall_segment_model(checked)
            assert committed == checked
            validate_junction_limits(committed, previous)
            validate_wall_model_transition(committed, previous)
            validate_partition_opening_hosts(committed, previous, allow_room_wall_promotion=True)
            previous = committed


def test_stored_subray_proof_preserves_real_angle_and_independent_origin_negatives():
    carrier = {"a": [0, 0], "b": [1, .1]}
    assert check_nodes([carrier, {"a": [0, 0], "b": [.333333333, .033333333]}]) == []
    assert any(row[0] == "angle" for row in check_nodes([
        carrier, {"a": [0, 0], "b": [.333333333, .033333343]},
    ]))
    assert any(row[0] == "angle" for row in check_nodes([
        carrier, {"a": [0, 1e-8], "b": [.333333333, .033333333]},
    ]))


def _promotion_case():
    cases = json.loads((Path(__file__).parents[1] / "test/fixtures/1166-room-candidates.json").read_text())
    case = next(row for row in cases if row["scenario"] == "hosted-split" and row["reverse"] and not row["optimize"])
    return copy.deepcopy(case["candidates"][0]), copy.deepcopy(case["candidates"][1])


@pytest.mark.parametrize("corruption", [None, "surviving-source", "gap", "thickness", "moved-opening", "length", "metadata"])
def test_full_carrier_promotion_accepts_only_exact_lossless_chain(corruption):
    before, after = _promotion_case()
    old, new = before["spaces"][0], after["spaces"][0]
    opening = new["openings"][0]
    source = next(p for p in old["partitions"] if p["id"] == old["openings"][0]["host"]["id"])
    if corruption == "surviving-source":
        new.setdefault("partitions", []).append(source)
    elif corruption == "gap":
        next(w for w in new["wall_segments"] if w["id"] == opening["host"]["id"])["a"][0] += .01
    elif corruption == "thickness":
        next(w for w in new["wall_segments"] if w["id"] == opening["host"]["id"])["cm"] += 1
    elif corruption == "moved-opening":
        opening["host"]["t"] += .01
    elif corruption == "length":
        opening["length"] += .01
    elif corruption == "metadata":
        opening["future"] = False
    if corruption:
        with pytest.raises(PartitionOpeningHostError):
            validate_partition_opening_hosts(after, before, allow_room_wall_promotion=True)
    else:
        validate_partition_opening_hosts(after, before, allow_room_wall_promotion=True)
        with pytest.raises(PartitionOpeningHostError):
            validate_partition_opening_hosts(after, before)


@pytest.mark.parametrize("gap,interior,accepted", [(1e-7, True, True), (3e-7, True, False), (1e-7, False, False)])
def test_promotion_endpoint_reuses_only_proved_existing_interior_t(gap, interior, accepted):
    source = {"id": "branch", "a": [.5, gap], "b": [.5, 1], "cm": 15}
    wall = {**source, "a": [.5, 0]}
    old = {"id": "door", "length": .1, "angle": 90, "x": .5, "y": .6,
           "host": {"kind": "partition", "id": "branch", "t": (.6-gap)/(1-gap)}}
    new = {**old, "host": {"kind": "wall", "id": "branch", "t": .6}}
    carrier = {"id": "through", "a": [0 if interior else .5, 0], "b": [1, 0]}
    assert same_partition_wall_chain_promotion(old, new, source, [wall], {"branch"}, [source, carrier]) is accepted


@pytest.mark.parametrize("corruption", [None, "missing-ids", "changed-common-contour", "replaced-room"])
def test_room_ownership_of_existing_catalogue_is_not_a_stale_geometry_edit(corruption):
    cases = json.loads((Path(__file__).parents[1] / "test/fixtures/1166-room-candidates.json").read_text())
    case = next(row for row in cases if row["scenario"] == "existing-wall-cavity" and not row["optimize"])
    before, after = copy.deepcopy(case["source"]), copy.deepcopy(case["candidates"][0])
    assert before["spaces"][0]["wall_segments"] == after["spaces"][0]["wall_segments"]
    rooms = after["spaces"][0]["rooms"]
    if corruption == "missing-ids":
        del rooms[-1]["wall_ids"]
    elif corruption == "changed-common-contour":
        rooms[0]["poly"][0][0] += .01
    elif corruption == "replaced-room":
        del rooms[0]
    if corruption:
        with pytest.raises(WallModelClientOutdatedError):
            validate_wall_model_transition(after, before)
    else:
        validate_wall_model_transition(after, before)
        validate_wall_model_transition(before, after)  # ordinary Undo
