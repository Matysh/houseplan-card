"""#867 AC3: optional marker signal flag is strict, lossless and migration-free."""
import copy

import pytest
import voluptuous as vol

from pure_imports import HOUSEPLAN_ROOT, load_pure

validation = load_pure("hp_validation_marker_hide_signal", HOUSEPLAN_ROOT / "validation.py")
support = load_pure("custom_components.houseplan.support_package", HOUSEPLAN_ROOT / "support_package.py")


def _config(marker):
    return {"spaces": [], "settings": {}, "markers": [{"id": "m1", "binding": "virtual", **marker}]}


@pytest.mark.parametrize("value", [True, False])
def test_hide_signal_round_trip_preserves_boolean_and_sibling_fields(value):
    source = _config({"hide_signal": value, "hide_battery": True, "display": "static_icon"})
    out = validation.CONFIG_SCHEMA(copy.deepcopy(source))
    assert out["markers"][0]["hide_signal"] is value
    assert out["markers"][0]["hide_battery"] is True
    assert out["markers"][0]["display"] == "static_icon"
    assert validation.CONFIG_SCHEMA(copy.deepcopy(out)) == out
    projected = support._project_marker(support._Pseudonyms("signal"), {**source["markers"][0], "private": "drop"})
    assert projected["hide_signal"] is value
    assert "private" not in projected


@pytest.mark.parametrize("bad", [None, "true", "false", "yes", 0, 1, [], {}])
def test_hide_signal_rejects_non_boolean_and_support_does_not_coerce(bad):
    with pytest.raises(vol.Invalid):
        validation.CONFIG_SCHEMA(_config({"hide_signal": bad}))
    projected = support._project_marker(support._Pseudonyms("signal"), _config({"hide_signal": bad})["markers"][0])
    assert "hide_signal" not in projected


def test_old_marker_is_read_without_materialising_the_new_default():
    assert "hide_signal" not in validation.CONFIG_SCHEMA(_config({}))["markers"][0]
