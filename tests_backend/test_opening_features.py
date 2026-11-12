"""#1024 strict extension and writer barrier, independent of HA/geometry repair."""
from __future__ import annotations

import copy

import pytest
import voluptuous as vol

from custom_components.houseplan.opening_features import (
    OpeningFeaturesWriterRequired,
    clear_opening_bindings,
    guard_opening_features_write,
    reparameterize_opening_features,
    validate_opening_features,
)


def window(count=2):
    return {"id": "window", "type": "window", "x": 0.5, "y": 0, "angle": 0, "length": 0.2,
            "opening_features": {"version": 1, "side": "negative", "leaves": [
                {"id": f"leaf-{i}", "hinge": "end" if i % 2 else "start", "manual": "closed",
                 "contact": f"binary_sensor.leaf_{i}",
                 "shade": {"enabled": True, "manual": "open", "contact": f"cover.shade_{i}"}}
                for i in range(count)]}}


def config(opening=None):
    return {"spaces": [{"id": "floor", "openings": [opening or window()]}], "settings": {}}


def test_old_writer_cannot_smuggle_json_boolean_number_equivalence():
    previous = config()
    candidate = copy.deepcopy(previous)
    candidate["spaces"][0]["openings"][0]["opening_features"]["leaves"][0]["shade"]["enabled"] = 1
    with pytest.raises(OpeningFeaturesWriterRequired):
        guard_opening_features_write(candidate, previous)
    for value in [None, {}, "spaces", 1]:
        with pytest.raises(OpeningFeaturesWriterRequired):
            guard_opening_features_write({"spaces": value}, previous)
    guard_opening_features_write({"spaces": {}}, {"spaces": []})


def test_absent_active_slide_direction_defaults_to_end_and_transfers_on_half_turn():
    opening = {"id": "door", "type": "door", "angle": 89,
               "opening_features": {"version": 1, "mechanism": "slide"}}
    transformed = reparameterize_opening_features(opening, 91)
    assert transformed["opening_features"]["slide_direction"] == "start"
    assert "slide_direction" not in opening["opening_features"]


@pytest.mark.parametrize("count", [1, 2, 3, 4])
def test_v1_window_is_lossless(count):
    original = window(count)
    assert validate_opening_features(copy.deepcopy(original)) == original


@pytest.mark.parametrize("field,value", [("contact", None), ("invert", False), ("flip_h", False), ("flip_v", False)])
def test_mixed_window_rejected(field, value):
    with pytest.raises(vol.Invalid):
        validate_opening_features({**window(), field: value})


@pytest.mark.parametrize("version", [None, True, "1", 0, 2])
def test_future_and_coerced_versions_rejected(version):
    item = window()
    item["opening_features"]["version"] = version
    with pytest.raises(vol.Invalid):
        validate_opening_features(item)


@pytest.mark.parametrize("change", ["add", "remove", "move", "type", "mixed", "delete-space", "strip", "leaf"])
@pytest.mark.parametrize("writer", [None, 0, True, "1", 2])
def test_old_writer_rejects_every_extended_parent_mutation_before_repair(change, writer):
    previous = config()
    candidate = copy.deepcopy(previous)
    opening = candidate["spaces"][0]["openings"][0]
    if change == "add":
        previous = {"spaces": [], "settings": {}}
    elif change == "remove":
        candidate["spaces"][0]["openings"] = []
    elif change == "move":
        opening["x"] = 0.6
    elif change == "type":
        opening["type"] = "door"
    elif change == "mixed":
        opening["contact"] = None
    elif change == "delete-space":
        candidate["spaces"] = []
    elif change == "strip":
        opening.pop("opening_features")
    else:
        opening["opening_features"]["leaves"][0]["manual"] = "open"
    before = copy.deepcopy(candidate)
    with pytest.raises(OpeningFeaturesWriterRequired):
        guard_opening_features_write(candidate, previous, writer)
    assert candidate == before
    # v1 permits explicit edits/deletion, but never substitutes schema validation.
    guard_opening_features_write(candidate, previous, 1)


def test_unrelated_old_writer_roundtrip_and_key_order_are_allowed():
    previous = config()
    candidate = copy.deepcopy(previous)
    candidate["settings"]["north_deg"] = 90
    opening = candidate["spaces"][0]["openings"][0]
    candidate["spaces"][0]["openings"][0] = dict(reversed(list(opening.items())))
    guard_opening_features_write(candidate, previous)


def test_half_turn_moves_whole_leaf_and_retained_disabled_shade_once():
    original = window(3)
    original["opening_features"]["leaves"][1]["hinge"] = "top"
    original["opening_features"]["leaves"][2]["shade"]["enabled"] = False
    transformed = reparameterize_opening_features(original, 91)
    assert transformed["angle"] == -89
    assert transformed["opening_features"]["side"] == "positive"
    assert [(leaf["id"], leaf["hinge"]) for leaf in transformed["opening_features"]["leaves"]] == [
        ("leaf-2", "end"), ("leaf-1", "top"), ("leaf-0", "end")]
    assert transformed["opening_features"]["leaves"][0]["shade"] == {
        "enabled": False, "manual": "open", "contact": "cover.shade_2"}
    assert reparameterize_opening_features(transformed, -89) == transformed
    assert reparameterize_opening_features(transformed, -91)["opening_features"] == original["opening_features"]


def test_copy_preserves_ids_manual_settings_and_removes_all_contacts():
    original = window()
    original["opening_features"]["leaves"][0]["shade"]["enabled"] = False
    before = copy.deepcopy(original)
    copied = clear_opening_bindings(original)
    for leaf in copied["opening_features"]["leaves"]:
        assert "contact" not in leaf and "contact" not in leaf["shade"]
        assert leaf["manual"] == "closed"
    assert copied["opening_features"]["leaves"][0]["shade"]["enabled"] is False
    assert original == before
