"""Stored wall identity and frontend/backend migration parity (#282)."""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from custom_components.houseplan.validation import (
    CONFIG_SCHEMA,
    WallModelClientOutdatedError,
    validate_wall_model_transition,
)
from custom_components.houseplan.wall_segment_model import (
    WALL_SEGMENT_MODEL_VERSION,
    WallSegmentMigrationError,
    commit_wall_segment_model,
    deterministic_wall_segment_id,
)


def _room(room_id: str, x1=0.0, y1=0.0, x2=1.0, y2=1.0) -> dict:
    return {
        "id": room_id, "name": room_id,
        "poly": [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
    }


def _config(space: dict) -> dict:
    return {"spaces": [{"title": "Floor", "view_box": [0, 0, 1, 1], **space}],
            "markers": [], "settings": {}}


def test_backend_migration_matches_shared_frontend_parity_fixture() -> None:
    fixture = json.loads((
        Path(__file__).parents[1] / "test" / "fixtures" / "282-wall-identity-parity.json"
    ).read_text(encoding="utf-8"))
    migrated, _ = commit_wall_segment_model(fixture["input"])
    space = migrated["spaces"][0]
    assert space["rooms"][0]["wall_ids"] == fixture["expected"]["large_wall_ids"]
    assert space["rooms"][1]["wall_ids"] == fixture["expected"]["small_wall_ids"]
    assert space["openings"][0]["host"] == fixture["expected"]["opening_host"]
    assert [segment["id"] for segment in space["room_drafts"][0]["segments"]] \
        == fixture["expected"]["draft_ids"]


def test_hash_and_endpoint_order_match_frontend_vector() -> None:
    expected = "wall-qweriry5umvd3ywku3iv"
    assert deterministic_wall_segment_id(
        "floor", [0, 0], [1, 0], ["room-b", "room-a"]
    ) == expected
    assert deterministic_wall_segment_id(
        "floor", [1, 0], [0, 0], ["room-a", "room-b"]
    ) == expected


def test_migration_is_pure_complete_idempotent_and_schema_valid() -> None:
    source = _config({"id": "floor", "rooms": [_room("room")]})
    original = copy.deepcopy(source)
    first, count = commit_wall_segment_model(source)
    second, second_count = commit_wall_segment_model(first)
    assert source == original
    assert first["model_version"] == WALL_SEGMENT_MODEL_VERSION
    assert count == 4
    assert len(first["spaces"][0]["wall_segments"]) == 4
    assert len(first["spaces"][0]["rooms"][0]["wall_ids"]) == 4
    assert second_count == 0
    assert second == first
    assert CONFIG_SCHEMA(first) == first


def test_partial_shared_boundary_has_exactly_one_two_owner_atom() -> None:
    migrated, _ = commit_wall_segment_model(_config({
        "id": "floor",
        "rooms": [_room("large"), _room("small", 1, 0.25, 1.5, 0.75)],
    }))
    space = migrated["spaces"][0]
    owners = {segment["id"]: 0 for segment in space["wall_segments"]}
    for room in space["rooms"]:
        for segment_id in room["wall_ids"]:
            owners[segment_id] += 1
    assert set(owners.values()) <= {1, 2}
    assert list(owners.values()).count(2) == 1


def test_ambiguous_opening_blocks_without_mutating_source() -> None:
    source = _config({
        "id": "floor", "rooms": [_room("room")],
        "openings": [{
            "id": "door", "type": "door", "x": 0, "y": 0,
            "angle": 0, "length": 0.2,
        }],
    })
    original = copy.deepcopy(source)
    with pytest.raises(WallSegmentMigrationError, match="opening-host"):
        commit_wall_segment_model(source)
    assert source == original


def test_post_v8_new_atoms_are_random_and_promoted_draft_id_survives() -> None:
    base, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
    }))
    base["spaces"][0]["rooms"].append({
        "id": "promoted", "name": "promoted",
        "poly": [[2, 0], [3, 0], [3, 1], [2, 1]],
        "wall_ids": ["draft-top", "", "", ""],
    })
    migrated, _ = commit_wall_segment_model(base)
    promoted = migrated["spaces"][0]["rooms"][1]
    assert promoted["wall_ids"][0] == "draft-top"
    assert promoted["wall_ids"][1].startswith("wall-")
    assert promoted["wall_ids"][1] != deterministic_wall_segment_id(
        "floor", [3, 0], [3, 1], ["promoted"]
    )


def test_initial_id_collision_uses_documented_suffix() -> None:
    base_id = deterministic_wall_segment_id("floor", [0, 0], [1, 0], ["room"])
    migrated, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
        "partitions": [{"id": base_id, "a": [2, 0], "b": [3, 0], "cm": 15}],
    }))
    assert migrated["spaces"][0]["rooms"][0]["wall_ids"][0] == f"{base_id}-2"


def test_v8_schema_rejects_stale_room_reference_and_projection() -> None:
    migrated, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
    }))
    stale_reference = copy.deepcopy(migrated)
    stale_reference["spaces"][0]["rooms"][0]["wall_ids"][0] = "missing"
    with pytest.raises(Exception, match="wall id"):
        CONFIG_SCHEMA(stale_reference)

    stale_projection = copy.deepcopy(migrated)
    stale_projection["spaces"][0]["walls"] = [{
        "key": "0,0@0", "a": [0, 0], "b": [1, 0], "cm": 15,
    }]
    with pytest.raises(Exception, match="match wall_segments"):
        CONFIG_SCHEMA(stale_projection)


def test_stale_client_round_trip_is_hydrated_but_structural_change_is_rejected() -> None:
    previous, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
    }))
    legacy = copy.deepcopy(previous)
    legacy.pop("model_version")
    legacy["spaces"][0].pop("wall_segments")
    for room in legacy["spaces"][0]["rooms"]:
        room.pop("wall_ids")
    validate_wall_model_transition(legacy, previous)
    assert legacy == previous

    changed = copy.deepcopy(legacy)
    changed.pop("model_version")
    changed["spaces"][0].pop("wall_segments")
    for room in changed["spaces"][0]["rooms"]:
        room.pop("wall_ids")
    changed["spaces"][0]["rooms"][0]["poly"][0][0] = 0.25
    with pytest.raises(WallModelClientOutdatedError):
        validate_wall_model_transition(changed, previous)
    validate_wall_model_transition(
        {"model_version": 8, "spaces": [], "markers": [], "settings": {}},
        {"model_version": 8, "spaces": [], "markers": [], "settings": {}},
    )
