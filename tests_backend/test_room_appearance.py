"""#1037 shared compatibility corpus and actual schema/write boundary."""
from copy import deepcopy
import json
from pathlib import Path

import pytest
import voluptuous as vol
from pure_imports import load_pure

ROOT = Path(__file__).resolve().parents[1]
appearance = load_pure("hp_appearance", ROOT / "custom_components/houseplan/room_appearance.py")
validation = load_pure("hp_appearance_validation", ROOT / "custom_components/houseplan/validation.py")


def test_legacy_parity_copy_only_idempotence_and_unknown_fields():
    fixtures = json.loads((ROOT / "test/fixtures/room-appearance.json").read_text(encoding="utf-8"))
    for fixture in fixtures:
        source = {"spaces": [{"id": "s", **fixture["space"]}], "settings": fixture["general"],
                  "future": {"keep": True}}
        before = deepcopy(source)
        result = appearance.normalize_room_appearance(source)
        assert source == before
        assert appearance.normalize_room_appearance(result) == result
        assert result["spaces"][0]["settings"]["name_color"] == fixture["nameColor"]
        assert result["spaces"][0]["settings"]["wall_fill"] == fixture["wallFill"]
        assert result["future"] == source["future"]


@pytest.mark.parametrize("key", ["name_color", "wall_fill"])
@pytest.mark.parametrize("value", [None, {}, {"c": "#123456", "a": True}, {"c": "#123456", "a": "0"},
                                   {"c": "red", "a": 1}, {"c": "#123456\n", "a": 1},
                                   {"c": "#123456", "a": -0.1}, {"c": "#123456", "a": 1.1},
                                   {"c": "#123456", "a": float("inf")}])
def test_new_space_fields_reject_invalid_ordinary_writes(key, value):
    with pytest.raises(vol.Invalid):
        validation.CONFIG_SCHEMA({"spaces": [{"id": "s", "title": "Floor", "view_box": [0, 0, 1, 1], "rooms": [], "settings": {key: value}}]})


@pytest.mark.parametrize("alpha", [0, 1, 0.45])
def test_valid_schema_keeps_explicit_room_override_and_future_siblings(alpha):
    color = {"c": "#123456", "a": alpha, "future": {"v": 2}}
    source = {"spaces": [{"id": "s", "title": "Floor", "view_box": [0, 0, 1, 1], "rooms": [
        {"id": "r", "name": "Room", "x": 0, "y": 0, "w": 0.5, "h": 0.5, "settings": {"name_color": color}},
    ], "settings": {"name_color": color, "wall_fill": color}}]}
    result = validation.CONFIG_SCHEMA(source)
    assert result["spaces"][0]["settings"]["wall_fill"] == color
    assert result["spaces"][0]["rooms"][0]["settings"]["name_color"] == color


def test_older_writer_and_global_save_preserve_existing_space_but_room_reset_is_real():
    previous = {"spaces": [{"id": "s", "settings": {"room_color": "#123456", "room_opacity": 0.2},
                            "rooms": [{"id": "r", "settings": {"name_color": {"c": "#abcdef", "a": 0}}}]}],
                "settings": {"fill_colors": {"wall_fill": {"c": "#456789", "a": 0}}}}
    before = deepcopy(previous)
    candidate = {"spaces": [{"id": "s", "settings": {}, "rooms": [{"id": "r", "settings": {}}]}],
                 "settings": {"fill_colors": {"wall_fill": {"c": "#ffffff", "a": 1}}}}
    appearance.preserve_space_appearance(candidate, previous)
    assert candidate["spaces"][0]["settings"] == {
        "name_color": {"c": "#123456", "a": 0.45}, "wall_fill": {"c": "#456789", "a": 0}}
    assert "name_color" not in candidate["spaces"][0]["rooms"][0]["settings"]
    assert previous == before


def test_room_null_inherits_but_invalid_explicit_alpha_is_rejected():
    base = {"id": "r", "name": "Room", "x": 0, "y": 0, "w": 0.5, "h": 0.5}
    assert validation.ROOM_SCHEMA({**base, "settings": {"name_color": None}})["settings"]["name_color"] is None
    for value in [True, "0", None, -0.1, 1.1, float("nan")]:
        with pytest.raises(vol.Invalid):
            validation.ROOM_SCHEMA({**base, "settings": {"name_color": {"c": "#123456", "a": value}}})
