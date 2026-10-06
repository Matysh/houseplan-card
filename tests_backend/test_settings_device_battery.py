"""#792 AC9 / #807 AC3: optional global battery mode, strict writes and safe support data."""
import copy
import json
from pathlib import Path

import pytest
import voluptuous as vol

from pure_imports import HOUSEPLAN_ROOT, load_pure

validation = load_pure("hp_validation_device_battery", HOUSEPLAN_ROOT / "validation.py")
support = load_pure(
    "custom_components.houseplan.support_package", HOUSEPLAN_ROOT / "support_package.py",
)


@pytest.mark.parametrize("value", [True, False, "low"])
def test_device_battery_preserves_explicit_values(value):
    config = {"spaces": [], "settings": {
        "show_device_battery": value, "show_room_tooltip": False,
        "future_namespace": {"sentinel": "kept"},
    }}
    out = validation.CONFIG_SCHEMA(copy.deepcopy(config))
    assert out["settings"] == config["settings"]
    assert out["settings"]["show_device_battery"] == value
    assert type(out["settings"]["show_device_battery"]) is type(value)


@pytest.mark.parametrize("bad", ["false", "true", "yes", "LOW", "low ", "all", 0, 1, None, [], {}])
def test_device_battery_rejects_other_values(bad):
    with pytest.raises(vol.Invalid):
        validation.CONFIG_SCHEMA({"spaces": [], "settings": {"show_device_battery": bad}})


def test_device_battery_omission_stays_absent_without_a_migration():
    out = validation.CONFIG_SCHEMA({"spaces": [], "settings": {}})
    assert "show_device_battery" not in out["settings"]


def test_support_package_copies_only_valid_battery_values():
    for value in (True, False, "low"):
        assert support._global_settings({"show_device_battery": value}) == {"show_device_battery": value}
    for bad in ("false", "true", "LOW", 0, 1, None, [], {}):
        assert "show_device_battery" not in support._global_settings({"show_device_battery": bad})


def test_current_lifecycle_fixture_retains_the_battery_opt_out():
    fixture = Path(__file__).resolve().parent.parent / "test" / "fixtures" / "config-lifecycle" / "current.json"
    config = json.loads(fixture.read_text(encoding="utf-8"))
    validated = validation.CONFIG_SCHEMA(copy.deepcopy(config))
    assert validated["settings"]["show_device_battery"] is False
