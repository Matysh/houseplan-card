"""Stored wall identity and frontend/backend migration parity (#282)."""
from __future__ import annotations

import copy
import json
import math
from pathlib import Path

import pytest

from custom_components.houseplan.validation import (
    CONFIG_SCHEMA,
    PartitionOpeningHostError,
    WallModelClientOutdatedError,
    validate_partition_opening_hosts,
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
    assert [segment["id"] for segment in space["partitions"]] \
        == fixture["expected"]["draft_ids"]
    assert "room_drafts" not in space


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


def test_zero_wall_identity_follows_current_carrier_without_phantom_breakpoints() -> None:
    baseline, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
    }))
    candidate = copy.deepcopy(baseline)
    candidate["spaces"][0]["rooms"][0]["poly"] = [
        [0, 0], [1, 0], [1, 1.25], [0, 1.25],
    ]

    migrated, _ = commit_wall_segment_model(candidate)
    space = migrated["spaces"][0]

    assert space["rooms"][0]["poly"] == candidate["spaces"][0]["rooms"][0]["poly"]
    assert len(space["rooms"][0]["poly"]) == 4
    assert len(space["wall_segments"]) == 4
    assert all(float(segment["cm"]) == 0 for segment in space["wall_segments"])


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


def test_corner_opening_on_bodyless_walls_migrates_unhosted() -> None:
    """#316 §3.3/§3.4: the initial migration degrades instead of blocking.

    Since #306 an unconfigured contour is explicitly bodyless (cm 0) and a
    zero wall is never an opening carrier, so the corner door persists
    unhosted; the migration never throws over an opening.
    """
    source = _config({
        "id": "floor", "rooms": [_room("room")],
        "openings": [{
            "id": "door", "type": "door", "x": 0, "y": 0,
            "angle": 0, "length": 0.2,
        }],
    })
    original = copy.deepcopy(source)
    migrated, _ = commit_wall_segment_model(source)
    assert source == original
    assert "host" not in migrated["spaces"][0]["openings"][0]
    assert commit_wall_segment_model(migrated)[0] == migrated


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


def test_promoted_divider_outweighs_stale_room_edge_ordinal() -> None:
    base, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("parent")],
    }))
    old_ids = base["spaces"][0]["rooms"][0]["wall_ids"]
    base["spaces"][0]["rooms"] = [{
        "id": "parent", "name": "parent",
        "poly": [[0, 0], [0.5, 0], [0.5, 1], [0, 1]],
        "wall_ids": old_ids,
    }, {
        "id": "child", "name": "child",
        "poly": [[0.5, 0], [1, 0], [1, 1], [0.5, 1]],
        "wall_ids": ["", "", "", "draft-divider"],
    }]
    result, _ = commit_wall_segment_model(base)
    parent, child = result["spaces"][0]["rooms"]
    assert parent["wall_ids"][1] == "draft-divider"
    assert child["wall_ids"][3] == "draft-divider"


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


def test_stale_client_echoing_v8_catalog_gets_the_named_error() -> None:
    previous, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
    }))
    stale = copy.deepcopy(previous)
    stale["spaces"][0]["rooms"][0]["poly"][0][0] = 0.25
    # A real stale card echoes unknown v8 fields unchanged rather than
    # explicitly downgrading model_version.
    with pytest.raises(WallModelClientOutdatedError, match="unchanged wall catalogue"):
        validate_wall_model_transition(stale, previous)

    non_structural = copy.deepcopy(previous)
    non_structural["settings"]["language"] = "ru"
    validate_wall_model_transition(non_structural, previous)


def test_first_write_of_a_newer_model_is_not_outdated_even_without_catalog_change() -> None:
    """#319: a client can only echo the stored model_version, never raise it.

    The pair fixture is generated by real writers: `stored` by the
    v1.68.0-beta.2 (model v8) writer with one orphan open_span, `sent` by the
    current initial migration — the catalogue is byte-identical, the orphan
    span is dropped. Before the fix this exact pair raised
    WallModelClientOutdatedError and wedged every structural write forever.
    """
    fixture = json.loads((
        Path(__file__).parents[1] / "test" / "fixtures"
        / "319-orphan-span-migration.json"
    ).read_text(encoding="utf-8"))
    stored = fixture["stored"]
    sent, _ = commit_wall_segment_model(fixture["sent"])
    assert stored["model_version"] == 8 and sent["model_version"] == 10
    assert stored["spaces"][0]["wall_segments"] == sent["spaces"][0]["wall_segments"]
    assert "open_spans" in stored["spaces"][0]
    assert "open_spans" not in sent["spaces"][0]

    # AC1: the pure migration write passes.
    validate_wall_model_transition(copy.deepcopy(sent), stored)

    # AC2: the same write with the user's first ordinary wall passes too.
    with_partition = copy.deepcopy(sent)
    with_partition["spaces"][0].setdefault("partitions", []).append({
        "id": "seg-d-319", "a": [0.7, 0.7], "b": [0.8, 0.7], "cm": 20,
    })
    validate_wall_model_transition(with_partition, stored)

    # AC3: the same-version echo (9 → 9) with changed contours and an
    # unchanged catalogue keeps the named refusal.
    echoed = copy.deepcopy(sent)
    echoed["spaces"][0]["rooms"][0]["poly"][0][0] += 0.01
    with pytest.raises(WallModelClientOutdatedError, match="unchanged wall catalogue"):
        validate_wall_model_transition(echoed, copy.deepcopy(sent))


def test_current_wall_model_independent_geometry_does_not_require_contour_catalog_change() -> None:
    """Partitions, columns and hosted openings own their identity (#314/#478)."""
    previous, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
        # #306 makes every unconfigured contour atom explicitly bodyless.
        # The opening branch of this #314 identity test therefore needs one
        # real host; otherwise the v9 validator correctly rejects it.
        "walls": [{"key": "bottom", "a": [0, 0], "b": [1, 0], "cm": 15}],
    }))
    previous_catalog = copy.deepcopy(previous["spaces"][0]["wall_segments"])

    candidates = []

    partition = copy.deepcopy(previous)
    partition["spaces"][0]["partitions"] = [{
        "id": "partition-new", "a": [2, 0], "b": [3, 0], "cm": 15,
    }]
    candidates.append(partition)

    column = copy.deepcopy(previous)
    column["spaces"][0]["wall_columns"] = [{
        "id": "column-new", "shape": "square", "center": [2, 2],
        "cm": 30, "angle": 0,
    }]
    candidates.append(column)

    opening = copy.deepcopy(previous)
    host = next(
        segment for segment in opening["spaces"][0]["wall_segments"]
        if float(segment["cm"]) > 0
    )
    dx = float(host["b"][0]) - float(host["a"][0])
    dy = float(host["b"][1]) - float(host["a"][1])
    opening["spaces"][0]["openings"] = [{
        "id": "opening-new", "type": "door",
        "x": (float(host["a"][0]) + float(host["b"][0])) / 2,
        "y": (float(host["a"][1]) + float(host["b"][1])) / 2,
        "angle": math.degrees(math.atan2(dy, dx)), "length": 0.2,
        "host": {"kind": "wall", "id": host["id"], "t": 0.5},
    }]
    candidates.append(opening)

    for candidate in candidates:
        assert candidate["spaces"][0]["wall_segments"] == previous_catalog
        validate_wall_model_transition(candidate, previous)
        assert CONFIG_SCHEMA(candidate) == candidate

    stale = copy.deepcopy(previous)
    stale["spaces"][0]["room_drafts"] = []
    with pytest.raises(Exception, match="v10 config must not contain room_drafts"):
        CONFIG_SCHEMA(stale)


def test_downgraded_independent_partition_round_trip_is_hydrated() -> None:
    previous, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
    }))
    legacy = copy.deepcopy(previous)
    legacy.pop("model_version")
    legacy["spaces"][0].pop("wall_segments")
    for room in legacy["spaces"][0]["rooms"]:
        room.pop("wall_ids")
    legacy["spaces"][0]["partitions"] = [{
        "id": "partition-legacy", "a": [2, 0], "b": [3, 0], "cm": 15,
    }]

    validate_wall_model_transition(legacy, previous)

    assert legacy["model_version"] == WALL_SEGMENT_MODEL_VERSION
    assert legacy["spaces"][0]["wall_segments"] == previous["spaces"][0]["wall_segments"]
    assert CONFIG_SCHEMA(legacy) == legacy


def test_v8_open_span_migrates_to_zero_atoms_and_removes_legacy_fields() -> None:
    base, _ = commit_wall_segment_model(_config({
        "id": "floor",
        "rooms": [_room("left", 0, 0, 0.5, 1), _room("right", 0.5, 0, 1, 1)],
    }))
    space = base["spaces"][0]
    for segment in space["wall_segments"]:
        segment["cm"] = 15
    space["walls"] = [{
        "key": f"legacy-{index}", "a": copy.deepcopy(segment["a"]),
        "b": copy.deepcopy(segment["b"]), "cm": 15,
    } for index, segment in enumerate(space["wall_segments"])]
    base["model_version"] = 8
    space["open_spans"] = [{"a": [0.5, 0.25], "b": [0.5, 0.75]}]
    for room in space["rooms"]:
        room["open_to"] = ["right" if room["id"] == "left" else "left"]

    migrated, _ = commit_wall_segment_model(base)
    migrated_space = migrated["spaces"][0]
    shared_ids = set(migrated_space["rooms"][0]["wall_ids"]).intersection(
        migrated_space["rooms"][1]["wall_ids"]
    )
    shared = [segment for segment in migrated_space["wall_segments"]
              if segment["id"] in shared_ids]

    assert migrated["model_version"] == 10
    assert "open_spans" not in migrated_space
    assert all("open_to" not in room for room in migrated_space["rooms"])
    assert sorted(segment["cm"] for segment in shared) == [0.0, 15.0, 15.0]
    assert commit_wall_segment_model(migrated)[0] == migrated


def test_v9_room_drafts_migrate_one_for_one_to_partitions() -> None:
    source = {
        "model_version": 9, "markers": [], "settings": {}, "spaces": [{
            "id": "floor", "title": "Floor", "rooms": [], "wall_segments": [],
            "room_drafts": [{
                "id": "draft-a", "points": [[0, 0], [0.25, 0], [0.25, 0.5]],
                "segments": [{"id": "draft-wall-a", "cm": 0}, {"cm": 22}],
            }],
            "partitions": [{
                "id": "partition-old", "a": [1, 0], "b": [1, 1], "cm": 15,
            }],
        }],
    }
    migrated, _ = commit_wall_segment_model(source)
    space = migrated["spaces"][0]
    assert migrated["model_version"] == 10
    assert "room_drafts" not in space
    assert space["partitions"][0] == source["spaces"][0]["partitions"][0]
    assert space["partitions"][1] == {
        "id": "draft-wall-a", "a": [0.0, 0.0], "b": [0.25, 0.0], "cm": 0.0,
    }
    assert space["partitions"][2]["id"].startswith("wall-")
    assert commit_wall_segment_model(migrated)[0] == migrated


def test_v8_open_span_over_an_opening_spares_the_carrying_atom() -> None:
    base, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
    }))
    space = base["spaces"][0]
    bottom_id = space["rooms"][0]["wall_ids"][0]
    for segment in space["wall_segments"]:
        segment["cm"] = 15
    space["walls"] = [{
        "key": f"legacy-{index}", "a": copy.deepcopy(segment["a"]),
        "b": copy.deepcopy(segment["b"]), "cm": 15,
    } for index, segment in enumerate(space["wall_segments"])]
    space["openings"] = [{
        "id": "door", "type": "door", "x": 0.5, "y": 0,
        "angle": 0, "length": 0.2,
        "host": {"kind": "wall", "id": bottom_id, "t": 0.5},
    }]
    space["open_spans"] = [{"a": [0, 0], "b": [1, 0]}]
    base["model_version"] = 8
    before = copy.deepcopy(base)

    # #316 §3.1: the atom carrying the hosted door keeps its thickness while
    # the rest of the span run turns to zero on both sides of the opening.
    migrated, _ = commit_wall_segment_model(base)
    assert base == before
    space = migrated["spaces"][0]
    bottom = sorted(
        (segment for segment in space["wall_segments"]
         if abs(segment["a"][1]) < 1e-9 and abs(segment["b"][1]) < 1e-9),
        key=lambda segment: segment["a"][0],
    )
    assert [segment["cm"] for segment in bottom] == [0.0, 15.0, 0.0]
    host = space["openings"][0]["host"]
    assert host["kind"] == "wall" and host["id"] == bottom[1]["id"]
    assert "open_spans" not in space
    assert commit_wall_segment_model(migrated)[0] == migrated


def test_unhosted_contour_opening_is_a_valid_degraded_v9_state() -> None:
    """#316 AC4: schema and repeat writes keep the unhosted opening."""
    source = _config({
        "id": "floor", "rooms": [_room("room")],
        "openings": [{
            "id": "orphan", "type": "door", "x": 0.9, "y": 0.65,
            "angle": 90, "length": 0.05,
        }],
    })
    migrated, _ = commit_wall_segment_model(source)
    opening = migrated["spaces"][0]["openings"][0]
    assert "host" not in opening
    validated = CONFIG_SCHEMA(copy.deepcopy(migrated))
    assert "host" not in validated["spaces"][0]["openings"][0]
    assert commit_wall_segment_model(migrated)[0] == migrated


def test_post_v9_write_that_lost_its_carrier_keeps_the_refusal() -> None:
    """#316 AC5: only the INITIAL migration degrades; a v9 write fails closed."""
    base, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
    }))
    space = base["spaces"][0]
    space["openings"] = [{
        "id": "door", "type": "door", "x": 0.9, "y": 0.65,
        "angle": 90, "length": 0.05,
        "host": {"kind": "wall", "id": "wall-gone", "t": 0.5},
    }]
    with pytest.raises(WallSegmentMigrationError, match="opening-host"):
        commit_wall_segment_model(base)


def test_far_same_angle_wall_is_not_a_degraded_carrier() -> None:
    """CODE-REVIEW-316-r1 H1: a distant host would break the schema invariant
    «wall opening geometry must match its host» and wedge the write again.
    The opening must migrate unhosted and the migrated document must pass
    CONFIG_SCHEMA."""
    base, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
    }))
    space = base["spaces"][0]
    for segment in space["wall_segments"]:
        segment["cm"] = 15
    space["walls"] = [{
        "key": f"legacy-{index}", "a": copy.deepcopy(segment["a"]),
        "b": copy.deepcopy(segment["b"]), "cm": 15,
    } for index, segment in enumerate(space["wall_segments"])]
    # Same angle as the bottom wall (y=0), but far away from every wall.
    space["openings"] = [{
        "id": "far", "type": "door", "x": 0.5, "y": 0.5,
        "angle": 0, "length": 0.2,
    }]
    base["model_version"] = 8
    migrated, _ = commit_wall_segment_model(base)
    opening = migrated["spaces"][0]["openings"][0]
    assert "host" not in opening
    validated = CONFIG_SCHEMA(copy.deepcopy(migrated))
    assert "host" not in validated["spaces"][0]["openings"][0]
    assert commit_wall_segment_model(migrated)[0] == migrated


def test_dropping_a_partition_host_is_still_rejected_after_the_unhosted_relaxation() -> None:
    """CODE-REVIEW-316-r2 M2: the schema now tolerates a missing host (the
    unhosted contour state of #316 §3.3), so the #132 protection against a
    stale writer silently dropping a PARTITION host must keep holding on the
    semantic layer — pinned here so a future relaxation cannot slip through.
    """
    base, _ = commit_wall_segment_model(_config({
        "id": "floor", "rooms": [_room("room")],
        "partitions": [{"id": "p1", "a": [0.2, 0.5], "b": [0.8, 0.5], "cm": 10}],
        "openings": [{
            "id": "pdoor", "type": "door", "x": 0.5, "y": 0.5,
            "angle": 0, "length": 0.2,
            "host": {"kind": "partition", "id": "p1", "t": 0.5},
        }],
    }))
    stale = copy.deepcopy(base)
    del stale["spaces"][0]["openings"][0]["host"]
    with pytest.raises(PartitionOpeningHostError):
        validate_partition_opening_hosts(stale, base)
