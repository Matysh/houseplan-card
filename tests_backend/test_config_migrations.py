"""#1015: lossless versioned decoders, including deliberately retained forms."""
from copy import deepcopy
from pathlib import Path

import pytest
from pure_imports import load_pure

ROOT = Path(__file__).resolve().parents[1]
m = load_pure("custom_components.houseplan.config_migrations",
              ROOT / "custom_components/houseplan/config_migrations.py")


def old_config():
    return {
        "spaces": [{"id": "floor", "view_box": [0, 0, 1, 1], "rooms": [],
                    "plan_scale": 2, "plan_scale_x": 3,
                    "settings": {"fill_mode": "glow", "glow_enabled": False},
                    "decor": [{"id": "line", "kind": "line", "x1": 0, "y1": 0,
                               "x2": 0.1, "y2": 0.1, "width": 2},
                              {"id": "text", "kind": "text", "x": 0.2, "y": 0.3,
                               "text": "Room", "size": "s", "scale": 1.5}]}],
        "markers": [{"id": "lamp", "display": "ripple", "tap_action": "toggle",
                     "vacuum": {"trail": False, "future": [1, 2]}}],
        "settings": {"future": {"keep": True}}, "future": ["opaque"],
    }


def test_v1_chain_preserves_effective_geometry_style_action_and_unknown_data():
    source = old_config()
    before = deepcopy(source)
    pair = m.migrate_pair(source, {"lamp": {"s": "floor", "x": 0.2, "y": 0.4}})
    space = pair.config["spaces"][0]
    assert (space["plan_scale_x"], space["plan_scale_y"]) == (3, 2)
    assert "plan_scale" not in space
    assert space["settings"] == {"fill_mode": "none", "glow_enabled": False}
    assert space["decor"][0]["width_cm"] / 5 * (1000 / 240) == pytest.approx(2)
    assert space["decor"][1]["size_cm"] / 5 * (1000 / 240) == pytest.approx(30)
    assert "scale" not in space["decor"][1] and "size" not in space["decor"][1]
    marker = pair.config["markers"][0]
    assert marker["display"] == "icon_ripple" and marker["tap_action"] == "toggle"
    assert marker["vacuum"] == {"trail_mode": "never", "future": [1, 2]}
    assert pair.config["future"] == source["future"]
    assert pair.config["settings"] == source["settings"]
    assert source == before
    again = m.migrate_pair(pair.config, pair.layout, passport={"version": 1})
    assert again.config == pair.config and again.layout == pair.layout and again.steps == ()


@pytest.mark.parametrize("trail,mode,expected", [(False, None, "never"),
    (True, None, "cleaning"), (None, None, "cleaning"), (False, "always", "always")])
def test_vacuum_explicit_current_mode_wins(trail, mode, expected):
    config = {"spaces": [], "markers": [{"id": "v", "vacuum": {"trail": trail}}]}
    if mode:
        config["markers"][0]["vacuum"]["trail_mode"] = mode
    assert m.migrate_pair(config, {}).config["markers"][0]["vacuum"] == {"trail_mode": expected}


def test_square_precedes_physical_units_and_supports_the_old_half_written_intent():
    config = old_config()
    space = config["spaces"][0]
    space["aspect"] = 0.5
    space["cell_cm"] = 5
    source_layout = {"lamp": {"s": "floor", "x": 0.2, "y": 0.4}}
    pair = m.migrate_pair(config, source_layout)
    assert pair.steps[0] == "square-canvas"
    assert pair.layout["lamp"] == {"s": "floor", "x": 0.35, "y": 0.4}
    assert pair.config["spaces"][0]["cell_cm"] == 10
    assert pair.config["spaces"][0]["decor"][0]["width_cm"] == pytest.approx(4.8)
    half_config = deepcopy(config)
    m.migrate_config(half_config)
    half = m.migrate_pair(half_config, source_layout, square_pending={"floor": 0.5})
    assert half.config == pair.config and half.layout == pair.layout


def test_unrepresentable_physical_styles_and_live_links_are_retained_exactly():
    config = {"spaces": [{"id": "s", "cell_cm": 1000, "rooms": [], "decor": [
        {"id": "w", "kind": "line", "width": 30},
        {"id": "t", "kind": "text", "scale": 20, "size": "l", "text": "{}",
         "entity": "sensor.temp", "attr": "state", "unit": "Kelvin"}]}]}
    result = m.migrate_pair(config, {})
    assert result.config == config and not result.steps


def test_current_omission_and_unknown_fields_are_identity():
    config = {"model_version": 10, "spaces": [], "future": {"x": [1, 2]}, "settings": {}}
    assert m.migrate_pair(config, {}).config == config
    assert m.migrate_pair(config, {}).steps == ()


@pytest.mark.parametrize("passport", [{"version": 2}, {"version": True}, {}, [], "1"])
def test_unknown_or_corrupt_migration_passport_refuses_without_touching_source(passport):
    source = old_config()
    before = deepcopy(source)
    with pytest.raises(ValueError):
        m.migrate_pair(source, {}, passport=passport)
    assert source == before


@pytest.mark.parametrize("version", [11, True, "10", -1])
def test_unknown_model_is_not_treated_as_current(version):
    with pytest.raises(ValueError):
        m.migrate_pair({"model_version": version, "spaces": []}, {})
