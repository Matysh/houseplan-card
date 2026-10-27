"""The same persisted JSON contract as TS; runtime HA authority is separate."""
import json
from pathlib import Path

from pure_imports import load_pure

_ROOT = Path(__file__).resolve().parents[1]
alerts = load_pure("hp_marker_alerts", _ROOT / "custom_components/houseplan/marker_alerts.py")
_CONTRACT = json.loads((_ROOT / "test/fixtures/marker-alerts.json").read_text(encoding="utf-8"))


def test_shared_typescript_python_marker_alert_contract():
    for entry in _CONTRACT["cases"]:
        rule = {**_CONTRACT["rule"], **entry["patch"]}
        for key in entry.get("remove", []):
            del rule[key]
        assert alerts.valid_marker_alert(rule) is entry["valid"], entry["name"]
        assert alerts.valid_marker_alerts([rule]) is entry["valid"], entry["name"]
    assert alerts.valid_marker_alerts([])
    assert not alerts.valid_marker_alerts([_CONTRACT["rule"], _CONTRACT["rule"]])
    assert not alerts.valid_marker_alerts([{**_CONTRACT["rule"], "id": f"r{i}"} for i in range(4)])


def test_marker_alert_finite_and_unicode_bounds_are_json_safe():
    for value in (float("nan"), float("inf"), float("-inf"), 10**999):
        assert not alerts.valid_marker_alert({**_CONTRACT["rule"], "value": value})
    for size in (255, 256):
        assert alerts.valid_marker_alert({**_CONTRACT["rule"], "operator": "eq", "value": "🧭" * size}) is (size == 255)


def test_marker_alert_optional_config_is_lossless_and_new_future_data_is_rejected():
    validation = load_pure("hp_alert_validation", _ROOT / "custom_components/houseplan/validation.py")
    old = {"spaces": [], "markers": [{"id": "m", "binding": "device:d"}], "settings": {}}
    assert validation.CONFIG_SCHEMA(old) == old
    for block in ([_CONTRACT["rule"]], [{**_CONTRACT["rule"], "operator": "eq", "value": "unavailable"}]):
        config = {**old, "markers": [{"id": "m", "binding": "device:d", "alert_sources": block}]}
        result = validation.CONFIG_SCHEMA(json.loads(json.dumps(config)))
        validation.validate_marker_value_badges(result, validate_all=True)
        assert result == config
    for block in (None, "opaque future", [{"type": "external", "future": 1}], [_CONTRACT["rule"]] * 4):
        config = {"spaces": [], "markers": [{"id": "m", "binding": "device:d", "alert_sources": block}]}
        result = validation.CONFIG_SCHEMA(config)
        validation.validate_marker_value_badges(result, result)
        try:
            validation.validate_marker_value_badges(result, old)
        except validation.MarkerControlError as error:
            assert error.code == "invalid_alert_sources"
        else:
            raise AssertionError("A new invalid alert block must not pass the writer")
