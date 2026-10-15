"""#876: optional shared LQI boolean and explicit local mode, strict writes."""
import copy

import pytest
import voluptuous as vol

from pure_imports import HOUSEPLAN_ROOT, load_pure

validation = load_pure("hp_validation_signal_visibility", HOUSEPLAN_ROOT / "validation.py")
support = load_pure("custom_components.houseplan.support_package", HOUSEPLAN_ROOT / "support_package.py")


def config(global_value=False, mode="on"):
    return {"spaces": [{"id": "floor", "title": "Floor", "view_box": [0, 0, 1, 1], "rooms": [], "settings": {
        "show_lqi_mode": mode, "show_lqi": mode == "on", "label_lqi": True,
        "future_namespace": {"kept": 1},
    }}], "settings": {"show_lqi": global_value, "future_namespace": {"kept": 2}}}


@pytest.mark.parametrize("global_value", [False, True])
@pytest.mark.parametrize("mode", ["inherit", "on", "off"])
def test_signal_visibility_preserves_explicit_values_and_extensions(global_value, mode):
    before = config(global_value, mode)
    after = validation.CONFIG_SCHEMA(copy.deepcopy(before))
    assert after["settings"] == before["settings"]
    assert after["spaces"][0]["settings"] == before["spaces"][0]["settings"]
    assert type(after["settings"]["show_lqi"]) is bool


@pytest.mark.parametrize("bad", ["false", "true", 0, 1, None, [], {}])
def test_signal_visibility_rejects_invalid_new_global_writes(bad):
    with pytest.raises(vol.Invalid):
        validation.CONFIG_SCHEMA(config(bad))


@pytest.mark.parametrize("bad", ["ON", "false", "on ", True, False, 0, 1, None, [], {}])
def test_signal_visibility_rejects_invalid_new_mode_writes(bad):
    with pytest.raises(vol.Invalid):
        validation.CONFIG_SCHEMA(config(mode=bad))


def test_signal_visibility_absence_is_not_materialized():
    after = validation.CONFIG_SCHEMA({"spaces": [], "settings": {}})
    assert "show_lqi" not in after["settings"]


def test_signal_visibility_support_projection_is_validated_and_contains_no_radio_data():
    for value in (False, True):
        assert support._global_settings({"show_lqi": value, "radio": {"secret": 1}}) == {"show_lqi": value}
    for value in ("false", 0, 1, None, [], {}):
        assert "show_lqi" not in support._global_settings({"show_lqi": value})
    for mode in ("inherit", "on", "off"):
        assert support._space_settings({"show_lqi_mode": mode, "radio": {"secret": 1}}) == {"show_lqi_mode": mode}
    for mode in ("ON", False, 0, None, [], {}):
        assert "show_lqi_mode" not in support._space_settings({"show_lqi_mode": mode})
