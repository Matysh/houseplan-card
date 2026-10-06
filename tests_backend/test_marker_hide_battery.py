"""#806 AC2/AC3: strict optional marker opt-out and support projection."""
import copy

import pytest
import voluptuous as vol

from pure_imports import HOUSEPLAN_ROOT, load_pure

validation = load_pure("hp_validation_marker_hide_battery", HOUSEPLAN_ROOT / "validation.py")
support = load_pure(
    "custom_components.houseplan.support_package", HOUSEPLAN_ROOT / "support_package.py",
)


def _config(marker):
    return {
        "spaces": [],
        "settings": {},
        "markers": [{"id": "m1", "binding": "virtual", **marker}],
    }


@pytest.mark.parametrize("value", [True, False])
def test_marker_hide_battery_preserves_explicit_booleans(value):
    out = validation.CONFIG_SCHEMA(copy.deepcopy(_config({"hide_battery": value})))
    assert out["markers"][0]["hide_battery"] is value


@pytest.mark.parametrize("bad", ["false", "true", "yes", 0, 1, None, [], {}])
def test_marker_hide_battery_rejects_non_booleans(bad):
    with pytest.raises(vol.Invalid):
        validation.CONFIG_SCHEMA(_config({"hide_battery": bad}))


def test_marker_hide_battery_omission_stays_absent_without_migration():
    out = validation.CONFIG_SCHEMA(_config({"name": "Virtual"}))
    assert "hide_battery" not in out["markers"][0]


def test_support_projection_carries_the_boolean_without_private_marker_data():
    for value in (True, False):
        out = support._project_marker(
            support._Pseudonyms("battery"),
            {"id": "m1", "binding": "virtual", "hide_battery": value, "private": "drop"},
        )
        assert out["hide_battery"] is value
        assert "private" not in out


@pytest.mark.parametrize("bad", ["true", 1, None, [], {}])
def test_support_projection_omits_malformed_hide_battery(bad):
    out = support._project_marker(
        support._Pseudonyms("battery"),
        {"id": "m1", "binding": "virtual", "hide_battery": bad},
    )
    assert "hide_battery" not in out
