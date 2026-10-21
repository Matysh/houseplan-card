"""#1002: optional path ink, strict scalar validation and lossless plan transfer."""
import json
from pathlib import Path

import pytest
import voluptuous as vol
from pure_imports import load_pure

validation = load_pure("hp_validation_trail_style_1002", Path(__file__).resolve().parents[1] / "custom_components/houseplan/validation.py")


def config(vacuum):
    return {"spaces": [], "markers": [{"id": "vac", "binding": "device:vac", "vacuum": vacuum}]}


@pytest.mark.parametrize("vacuum", [
    {}, {"trail_color": None, "trail_opacity": None},
    {"trail_color": "#64B5F6", "trail_opacity": 0.7},
    {"trail_color": "#abcdef", "trail_opacity": 0},
    {"trail_opacity": 1},
])
def test_optional_fields_round_trip(vacuum):
    result = validation.CONFIG_SCHEMA(json.loads(json.dumps(config(vacuum))))
    assert result["markers"][0]["vacuum"] == vacuum


@pytest.mark.parametrize("value", [True, False, "0.7", -0.01, 1.01, float("nan"), float("inf")])
def test_invalid_alpha_rejected(value):
    with pytest.raises(vol.Invalid):
        validation.CONFIG_SCHEMA(config({"trail_opacity": value}))


@pytest.mark.parametrize("value", [True, 9, "red", "#abc", "#123456;opacity:0", "url(x)", "#123456\n"])
def test_invalid_color_rejected(value):
    with pytest.raises(vol.Invalid):
        validation.CONFIG_SCHEMA(config({"trail_color": value}))


def test_vacuum_siblings_remain_unchanged():
    vacuum = {"source": "camera.actual", "live": False, "trail_mode": "always", "calibration": {"m": [1, 0, 0, 1, 0, 0]},
              "trail_color": "#123456", "trail_opacity": 0.2}
    assert validation.CONFIG_SCHEMA(config(vacuum))["markers"][0]["vacuum"] == vacuum


def test_unrecognized_vacuum_key_keeps_existing_strict_schema_policy():
    with pytest.raises(vol.Invalid):
        validation.CONFIG_SCHEMA(config({"future": {"v": 4}}))
