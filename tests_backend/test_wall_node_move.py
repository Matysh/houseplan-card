"""#803 local delta and inverse proofs, including forged clients."""
import copy
import json
from pathlib import Path

import pytest

from custom_components.houseplan.junction_limits import validate_junction_limits
from custom_components.houseplan.validation import (
    CONFIG_SCHEMA,
    PartitionOpeningHostError,
    validate_partition_opening_hosts,
)
from custom_components.houseplan.wall_node_move import (
    NodeMoveError,
    _classify,
    _walls,
    move_node_space,
    node_move_candidate,
    node_move_host_baseline,
)
from custom_components.houseplan.wall_segment_model import (
    commit_wall_segment_model, decode_legacy_wall_segment_model,
)
from custom_components.houseplan.graph_write import normalize_graph_config
from custom_components.houseplan.plan_graph import project_graph_space
from custom_components.houseplan.plan_graph_exact import (
    GraphError, decode_point, encode_point, read_source_point,
)

_IDENTITY_845 = json.loads((
    Path(__file__).parents[1] / "test/fixtures/845-wall-identity-parity.json"
).read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", [c for c in _IDENTITY_845 if "intent" in c],
                         ids=lambda c: c["name"])
def test_issue_845_product_move_and_browser_baseline_undo(case):
    if case.get("mode") == "pure":
        with pytest.raises(NodeMoveError) as raised:
            move_node_space(case["input"]["spaces"][0], case["intent"])
        assert raised.value.code == "node_move_invalid"
        return
    original = copy.deepcopy(case["input"])
    legacy_before = decode_legacy_wall_segment_model(original)[0]
    moved = move_node_space(legacy_before["spaces"][0], case["intent"])
    legacy_after = decode_legacy_wall_segment_model({
        **legacy_before, "spaces": [moved],
    })[0]
    assert legacy_after == case["expected"]["after"], "frozen v10 physical golden"
    assert CONFIG_SCHEMA(legacy_after) == legacy_after
    before = normalize_graph_config(original)
    operation = current_intent(before, case["intent"])
    after = node_move_candidate(before, "f", operation)
    moved_node = next(n for n in after["spaces"][0]["plan_graph"]["nodes"] if n["id"] == operation["node_id"])
    assert decode_point(moved_node["p"]) == decode_point(operation["target_p"])
    assert [(e["kind"], e["id"]) for e in after["spaces"][0]["plan_graph"]["edges"]] == [
        (e["kind"], e["id"]) for e in before["spaces"][0]["plan_graph"]["edges"]]
    assert CONFIG_SCHEMA(after) == after
    validate_junction_limits(after, before)
    # Browser history's first before is current11, not a stale v10 carrier set.
    restored = node_move_candidate(after, "f", operation, "undo", before["spaces"][0])
    assert restored == before
    assert node_move_candidate(restored, "f", operation) == after
    assert original == case["input"]


def wall(identity, a, b, cm=0):
    return {"id": identity, "a": a, "b": b, "cm": cm}


def raw_fixture():
    cfg = {"spaces": [{"id": "f", "title": "Floor", "view_box": [0, 0, 1, 1], "rooms": [],
        "partitions": [wall("h", [-1, 0], [1, 0]), wall("v", [0, -1], [0, 1], 25)],
        "openings": [{"id": "door", "type": "door", "x": 0, "y": 0.65, "length": 0.1, "angle": -90,
                      "host": {"kind": "partition", "id": "v", "t": 0.825}, "flip_h": True}],
        "future": {"unchanged": "opaque"}}], "markers": [], "settings": {}}
    return cfg


def fixture():
    return normalize_graph_config(raw_fixture())


def current_intent(config, operation, *, select_axis=True):
    """Fixture author selects the actual graph identity, never production fallback."""
    result = copy.deepcopy(operation)
    space = config["spaces"][0]
    point = read_source_point(result["point"])
    result["node_id"] = next(n["id"] for n in space["plan_graph"]["nodes"]
                             if decode_point(n["p"]) == point)
    result["target_p"] = encode_point(read_source_point(result["target"]))
    if select_axis and result.get("axis"):
        _, axes, _ = _classify(_walls(space), result["point"])
        desired = result["axis"]
        matches = [axis for axis in axes if axis["passing"] and any(
            (w["kind"] + ":" + w["id"]) == desired
            or (w["kind"] + ":" + w["id"]).startswith(desired + "~")
            for w in axis["walls"])]
        if not matches:
            matches = [axis for axis in axes if axis["passing"]]
        assert len(matches) == 1, "fixture must select one known current carrier"
        result["axis"] = matches[0]["key"]
    return result


def intent():
    return current_intent(fixture(), {"point": [0, 0], "target": [0.25, 0], "axis": "partition:h", "split_ids": {}})


@pytest.mark.parametrize("reversed_ends", [False, True])
@pytest.mark.parametrize("zero", [False, True])
def test_828_fixed_contacts_and_new_contact_negatives(reversed_ends, zero):
    cases = json.loads((Path(__file__).parents[1] / "test/fixtures/803-wall-node-parity.json").read_text())
    for case in (c for c in cases if c["name"].startswith("828-")):
        walls = copy.deepcopy(case["walls"])
        if zero:
            for w in walls:
                w["cm"] = 0
        if reversed_ends:
            walls.reverse()
            for w in walls:
                w["a"], w["b"] = w["b"], w["a"]
        before = decode_legacy_wall_segment_model({"spaces": [{"id": "f", "title": "Floor", "view_box": [0, 0, 1, 1],
            "rooms": [], "partitions": walls}],
            "markers": [], "settings": {}})[0]
        operation = {"point": case["point"], "target": case["target"], "axis": case["axis"],
                     "split_ids": {"partition:v": "new-v"} if case["axis"] else {}}
        legacy_before = before
        frozen = copy.deepcopy(before)
        if not case["ok"]:
            with pytest.raises(NodeMoveError):
                move_node_space(before["spaces"][0], operation)
        else:
            move_node_space(before["spaces"][0], operation)  # legacy physical acceptance remains required
            before = normalize_graph_config(before)
            current_operation = current_intent(before, operation)
            after = node_move_candidate(before, "f", current_operation)
            assert CONFIG_SCHEMA(after) == after
            for w in before["spaces"][0]["partitions"]:
                if w["id"].startswith("far"):
                    assert next(p for p in after["spaces"][0]["partitions"] if p["id"] == w["id"]) == w
            restored = node_move_candidate(after, "f", current_operation, "undo", before["spaces"][0])
            assert restored == before
            assert node_move_candidate(restored, "f", current_operation) == after
            if case["name"].startswith("828-X"):
                for allocation in [{"partition:v": "far"}, {"partition:far": "new-v"}]:
                    with pytest.raises(NodeMoveError):
                        move_node_space(legacy_before["spaces"][0], {**operation, "split_ids": allocation})
        assert legacy_before == frozen


def test_x_apply_inverse_and_redo_are_exact_and_ordinary_set_remains_strict():
    before = fixture()
    frozen = copy.deepcopy(before)
    after = node_move_candidate(before, "f", intent())
    assert before == frozen
    assert CONFIG_SCHEMA(after) == after
    assert next(p for p in after["spaces"][0]["partitions"] if p["id"] == "v")["a"] == [0, -1]
    assert next(p for p in after["spaces"][0]["partitions"] if p["id"] == "v~1")["b"] == [0, 1]
    assert after["spaces"][0]["openings"][0]["host"]["id"] == before["spaces"][0]["openings"][0]["host"]["id"]
    assert after["spaces"][0]["future"] == before["spaces"][0]["future"]
    validate_partition_opening_hosts(after, before)
    forged = copy.deepcopy(before)
    forged["spaces"][0]["partitions"] = copy.deepcopy(after["spaces"][0]["partitions"])
    with pytest.raises(GraphError, match="projection_mismatch"):
        normalize_graph_config(forged)
    restored = node_move_candidate(after, "f", intent(), "undo", before["spaces"][0])
    assert restored == before
    assert node_move_candidate(restored, "f", intent()) == after


def test_828_room_wall_fixed_collinear_contact_preserves_foreign_room():
    before = decode_legacy_wall_segment_model({"spaces": [{"id": "f", "title": "Floor", "view_box": [0, 0, 1, 1], "rooms": [
        {"id": "one", "name": "One", "poly": [[0, 0], [1, 0], [1, 1], [0, 1]]},
        {"id": "foreign", "name": "Foreign", "poly": [[1, 1], [2, 1], [2, 2], [1, 2]]},
    ]}], "markers": [], "settings": {}})[0]
    for w in before["spaces"][0]["wall_segments"]:
        w["cm"] = 25
    before = normalize_graph_config(before)
    operation = {"point": [0, 1], "target": [-0.25, 0.75], "axis": None, "split_ids": {}}
    operation = current_intent(before, operation)
    after = node_move_candidate(before, "f", operation)
    assert CONFIG_SCHEMA(after) == after
    assert next(r for r in after["spaces"][0]["rooms"] if r["id"] == "foreign") == next(r for r in before["spaces"][0]["rooms"] if r["id"] == "foreign")
    assert node_move_candidate(after, "f", operation, "undo", before["spaces"][0]) == before


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
        operation["node_id"] = "forged-node"
    error = GraphError if change == "split_identity" else NodeMoveError
    with pytest.raises(error) as rejected:
        node_move_candidate(after, "f", operation, "undo", forged)
    if change == "split_identity":
        assert rejected.value.reason == "missing_node_identity"


@pytest.mark.parametrize("walls", [
    [wall("h", [-1, 0], [1, 0]), wall("b", [0, 0], [0, 1]), wall("c", [0, 0], [1, 1])],
    [wall("h", [-1, 0], [1, 0]), wall("v", [0, -1], [0, 1]), wall("c", [0, 0], [1, 1])],
    [wall("h", [-1, 0], [1, 0]), wall("v", [0, -1], [0, 1]), wall("d", [-1, -1], [1, 1])],
])
def test_backend_refuses_unsupported_junctions_even_when_client_requests_only_one_axis(walls):
    before = raw_fixture()
    before["spaces"][0]["partitions"] = walls
    before["spaces"][0]["openings"] = []
    before = normalize_graph_config(before)
    operation = current_intent(before, {"point": [0, 0], "target": [.25, 0],
        "axis": "partition:h", "split_ids": {}}, select_axis=False)
    with pytest.raises(NodeMoveError, match="unsupported_junction"):
        node_move_candidate(before, "f", operation)


def test_node_point_must_exist_and_grid_exemption_must_be_geometrically_proved():
    before = fixture()
    operation = intent()
    operation["node_id"] = "missing-node"
    with pytest.raises(GraphError, match="missing_node_identity"):
        node_move_candidate(before, "f", operation)

    operation = intent()
    operation["axis"] = None
    operation["target"] = [0.1, 0.17]
    operation["target_p"] = encode_point(read_source_point(operation["target"]))
    with pytest.raises(NodeMoveError):
        node_move_candidate(before, "f", operation)


@pytest.mark.parametrize("sign", [-1, 1])
def test_whole_carrier_opening_is_a_swept_barrier(sign):
    before = raw_fixture()
    space = before["spaces"][0]
    space["partitions"] = [wall("h", [-1, 0], [1, 0], 25), wall("b", [0, 0], [0, 1])]
    space["openings"] = [{"id": "door", "type": "door", "x": sign * 0.5, "y": 0, "length": 0.1,
                          "angle": 0, "host": {"kind": "partition", "id": "h", "t": (sign * 0.5 + 1) / 2}}]
    operation = {"point": [0, 0], "target": [sign * 0.25, 0], "axis": "partition:h", "split_ids": {}}
    before = normalize_graph_config(before)
    operation = current_intent(before, operation)
    opening = before["spaces"][0]["openings"][0]
    expected_t = ["2", "3"] if sign < 0 else ["1", "3"]
    expected = {**opening, "host": {**opening["host"], "tq": expected_t,
        "t": int(expected_t[0]) / int(expected_t[1])}}
    assert node_move_candidate(before, "f", operation)["spaces"][0]["openings"] == [expected]
    for magnitude in [0.445, 0.5, 0.75]:
        operation["target"] = [sign * magnitude, 0]
        operation["target_p"] = encode_point(read_source_point(operation["target"]))
        with pytest.raises(NodeMoveError, match="opening_blocked"):
            node_move_candidate(before, "f", operation)


@pytest.mark.parametrize("x", [False, True])
@pytest.mark.parametrize("reverse", [False, True])
def test_noisy_atomized_t_x_classification_and_exact_inverse(x, reverse):
    before = raw_fixture()
    walls = [wall("h-a", [-0.012772885, -0.004954131], [0, 0]),
             wall("h-b", [0, 0], [0.014078099, 0.005460506])]
    if x:
        walls.append(wall("v-a", [0.003709279, -0.009286616], [0, 0]))
    walls.append(wall("v-b", [0, 0], [-0.003709205, 0.009286646]))
    if reverse:
        walls = [dict(w, a=w["b"], b=w["a"]) for w in reversed(walls)]
    before["spaces"][0].update(partitions=walls, openings=[])
    before = normalize_graph_config(before)
    frozen = copy.deepcopy(before)
    operation = {"point": [0, 0], "target": [0.00319322125, 0.00123853275],
                 "axis": "partition:h-a", "split_ids": {}}
    operation = current_intent(before, operation)
    after = node_move_candidate(before, "f", operation)
    assert before == frozen
    assert node_move_candidate(after, "f", operation, "undo", before["spaces"][0]) == before


def test_foreign_infinite_carrier_point_is_allowed_but_connectivity_exchange_is_not():
    before = raw_fixture()
    before["spaces"][0].update(openings=[], partitions=[wall("h", [-1, 0], [1, 0]),
        wall("b", [0, 0], [0, 1]), wall("foreign", [2, 0], [2, 1])])
    operation = {"point": [0, 0], "target": [0.25, 0], "axis": "partition:h", "split_ids": {}}
    before = normalize_graph_config(before)
    operation = current_intent(before, operation)
    after = node_move_candidate(before, "f", operation)
    assert next(p for p in after["spaces"][0]["partitions"] if p["id"] == "foreign") == next(p for p in before["spaces"][0]["partitions"] if p["id"] == "foreign")
    before = raw_fixture()
    before["spaces"][0]["openings"] = []
    before["spaces"][0]["partitions"] = [wall("a", [0, 0], [1, 0]),
        wall("b", [0, 0], [0, 1]), wall("foreign", [0.5, 0], [0.5, -0.25])]
    before = normalize_graph_config(before)
    operation = current_intent(before, {"point": [0, 0], "target": [1, -1], "axis": None, "split_ids": {}})
    frozen = copy.deepcopy(before)
    with pytest.raises(NodeMoveError):
        node_move_candidate(before, "f", operation)
    assert before == frozen


@pytest.mark.parametrize("angle, expected", [(0.00004, (2, 1)), (0.00005, (3, 0))])
def test_shared_angular_boundary_does_not_borrow_rays(angle, expected):
    import math
    walls = [dict(w, kind="partition") for w in [wall("a", [-1, 0], [0, 0]),
        wall("b", [0, 0], [math.cos(angle), math.sin(angle)]), wall("v", [0, 0], [0, 1])]]
    for variant in [walls, [dict(w, a=w["b"], b=w["a"]) for w in reversed(walls)]]:
        _, axes, passing = _classify(variant, [0, 0])
        assert (len(axes), passing) == expected


@pytest.mark.parametrize("reverse", [False, True])
def test_independent_host_ledger_accepts_only_original_interval_child_and_inverse(reverse):
    before = raw_fixture()
    if reverse:
        w = before["spaces"][0]["partitions"][1]
        w["a"], w["b"] = w["b"], w["a"]
        before["spaces"][0]["openings"][0]["host"]["t"] = 0.175
    # Extra preallocated carrier child ID must not authorize a carrier rehost.
    operation = {"point": [0, 0], "target": [.25, 0], "axis": "partition:h", "split_ids": {"partition:v": "new-v", "partition:h": "new-h"}}
    before["spaces"][0]["openings"].append({"id": "carrier", "type": "door", "x": -.65,
        "y": 0, "angle": 0, "length": .1, "host": {"kind": "partition", "id": "h", "t": .175}})
    before = normalize_graph_config(before)
    operation = current_intent(before, operation)
    after = node_move_candidate(before, "f", operation)
    adjusted = node_move_host_baseline(before, after, "f", operation)
    validate_partition_opening_hosts(after, adjusted)
    inverse = node_move_host_baseline(after, before, "f", operation, "undo", before["spaces"][0])
    validate_partition_opening_hosts(before, inverse)
    for oid, identity in [("door", "v" if after["spaces"][0]["openings"][0]["host"]["id"] == "new-v" else "new-v"),
                          ("carrier", "new-h")]:
        tampered = copy.deepcopy(after)
        next(o for o in tampered["spaces"][0]["openings"] if o["id"] == oid)["host"]["id"] = identity
        with pytest.raises(NodeMoveError):
            node_move_host_baseline(before, tampered, "f", operation)
    tampered = copy.deepcopy(before)
    tampered["spaces"][0]["openings"][0]["host"]["id"] = "h"
    with pytest.raises(NodeMoveError):
        node_move_host_baseline(after, tampered, "f", operation, "undo", before["spaces"][0])


def test_independent_host_ledger_accepts_legacy_room_input_without_mutating_it():
    legacy = {"spaces": [{"id": "f", "title": "Floor", "view_box": [0, 0, 1, 1],
        "rooms": [{"id": "room", "name": "Room", "poly": [[0, 0], [1, 0], [1, 1], [0, 1]]}],
        "future": {"exact": "legacy"}}], "markers": [], "settings": {}}
    frozen = copy.deepcopy(legacy)
    operation = {"point": [0, 0], "target": [-.25, 0], "axis": None, "split_ids": {}}
    operation = current_intent(normalize_graph_config(legacy), operation)
    candidate = node_move_candidate(legacy, "f", operation)
    baseline = node_move_host_baseline(legacy, candidate, "f", operation)
    assert legacy == frozen
    assert baseline == commit_wall_segment_model(legacy)[0]
    assert candidate["spaces"][0]["future"] == legacy["spaces"][0]["future"]


def two_floors():
    """#843: current graphs on both floors, including an existing room."""
    cfg = raw_fixture()
    cfg["spaces"][0]["rooms"] = [{"id": "existing", "name": "Room",
        "poly": [[2, 2], [3, 2], [3, 3], [2, 3]]}]
    other = copy.deepcopy(cfg["spaces"][0])
    other["id"], other["title"] = "g", "Other floor"
    other["rooms"][0]["id"] = "g-existing"
    cfg["spaces"].append(other)
    return normalize_graph_config(cfg)


def add_current_partition(space):
    """An explicit current fixture edit; no carrier reconstruction/remigration."""
    graph = copy.deepcopy(space["plan_graph"])
    graph["nodes"].extend([{"id": "extra-a", "p": ["l", "120", "120"]},
                           {"id": "extra-b", "p": ["l", "216", "120"]}])
    graph["edges"].append({"id": "extra", "kind": "partition", "from": "extra-a", "to": "extra-b", "cm": 0})
    graph["nodes"].sort(key=lambda row: row["id"])
    graph["edges"].sort(key=lambda row: row["kind"] + ":" + row["id"])
    return project_graph_space(space, graph)["space"]


@pytest.mark.parametrize("change", ["settings", "other_floor"])
def test_843_undo_after_own_settings_or_other_floor_change_is_proved_and_keeps_it(change):
    before = two_floors()
    after = node_move_candidate(before, "f", intent())
    current = copy.deepcopy(after)
    if change == "settings":
        current["settings"]["theme"] = "dark"
    else:
        current["spaces"][1]["title"] = "Kept"
        current["spaces"][1]["rooms"][0]["name"] = "Kept"
    restored = node_move_candidate(current, "f", intent(), "undo", before["spaces"][0])
    assert restored["spaces"][0] == before["spaces"][0]
    assert restored["settings"] == current["settings"]
    assert restored["spaces"][1] == current["spaces"][1]


@pytest.mark.parametrize("change", ["room_name", "space_title", "another_wall"])
def test_843_any_change_of_the_target_floor_refuses_the_inverse(change):
    before = two_floors()
    current = copy.deepcopy(node_move_candidate(before, "f", intent()))
    space = current["spaces"][0]
    if change == "room_name":
        space["rooms"][0]["name"] = "Renamed"
    elif change == "space_title":
        space["title"] = "Renamed floor"
    else:
        current["spaces"][0] = add_current_partition(space)
    with pytest.raises(NodeMoveError):
        node_move_candidate(current, "f", intent(), "undo", before["spaces"][0])


@pytest.mark.parametrize("change", ["space_title", "another_wall"])
def test_843_apply_is_not_proved_and_lands_over_a_same_floor_change(change):
    """Redo has no server proof: the client must compare the floor before sending it."""
    before = two_floors()
    after = node_move_candidate(before, "f", intent())
    current = copy.deepcopy(node_move_candidate(after, "f", intent(), "undo", before["spaces"][0]))
    if change == "space_title":
        current["spaces"][0]["title"] = "Foreign"
    else:
        current["spaces"][0] = add_current_partition(current["spaces"][0])
    redone = node_move_candidate(current, "f", intent())
    assert redone["spaces"][0] != after["spaces"][0], "not the recorded after state"
    assert next(p for p in redone["spaces"][0]["partitions"] if p["id"] == "v")["a"] == [0, -1], "yet the move is applied on top"
