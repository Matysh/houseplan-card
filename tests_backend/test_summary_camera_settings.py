"""The optional ordinary View camera setting uses the shared config boundary."""
from pathlib import Path
import json

import pytest
import voluptuous as vol

from pure_imports import load_pure

v = load_pure("hp_summary_camera_validation", Path(__file__).parents[1] / "custom_components/houseplan/validation.py")


def test_old_config_does_not_enable_summary_centering():
    config = v.CONFIG_SCHEMA({"spaces": [], "markers": [], "settings": {}})
    assert "center_summary" not in config["settings"]


@pytest.mark.parametrize("value", [True, False])
def test_summary_centering_boolean_round_trips(value):
    source = {"spaces": [], "markers": [], "settings": {"center_summary": value}}
    config = v.CONFIG_SCHEMA(json.loads(json.dumps(source)))
    assert config["settings"]["center_summary"] is value
    assert v.CONFIG_SCHEMA(json.loads(json.dumps(config))) == source


@pytest.mark.parametrize("value", [None, "true", 1, [], {}])
def test_summary_centering_rejects_non_boolean(value):
    with pytest.raises(vol.Invalid):
        v.CONFIG_SCHEMA({"spaces": [], "markers": [], "settings": {"center_summary": value}})
