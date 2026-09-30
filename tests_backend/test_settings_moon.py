"""#661 AC9: `settings.moon`, the moon on the "Follow the Sun" background.

Pure subset (no Home Assistant, runs on Windows): the schema takes a strict
boolean, the support package copies only a boolean, new installations get the
moon switched on. The export/import round trip needs the integration package
and lives in test_ha_import_export.py.
"""
import pytest
import voluptuous as vol

from pure_imports import HOUSEPLAN_ROOT, load_pure

v = load_pure("hp_validation_moon", HOUSEPLAN_ROOT / "validation.py")
const = load_pure("custom_components.houseplan.const", HOUSEPLAN_ROOT / "const.py")
support = load_pure(
    "custom_components.houseplan.support_package", HOUSEPLAN_ROOT / "support_package.py",
)


@pytest.mark.parametrize("value", [True, False])
def test_moon_accepts_a_boolean_and_keeps_it(value):
    out = v.CONFIG_SCHEMA({"spaces": [], "settings": {"moon": value}})
    assert out["settings"]["moon"] is value


@pytest.mark.parametrize("bad", ["yes", 1, 0, None, "true", [], {}])
def test_moon_rejects_everything_but_a_boolean(bad):
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [], "settings": {"moon": bad}})


def test_support_package_copies_only_a_boolean_moon():
    assert support._global_settings({"moon": True}) == {"moon": True}
    assert support._global_settings({"moon": False}) == {"moon": False}
    for bad in ("true", 1, None):
        assert "moon" not in support._global_settings({"moon": bad})


def test_new_installations_get_the_moon():
    assert const.DEFAULT_CONFIG["settings"]["moon"] is True
    assert v.CONFIG_SCHEMA(const.DEFAULT_CONFIG)["settings"]["moon"] is True
