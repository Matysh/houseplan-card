"""Privacy contracts for House Plan diagnostics (#625)."""
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from custom_components.houseplan.diagnostics import async_get_config_entry_diagnostics


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    yield


class _Store:
    def __init__(self, value):
        self.value = value

    async def async_load(self):
        return self.value


async def test_diagnostics_redact_marker_bindings_and_all_settings(hass) -> None:
    config = {
        "spaces": [{
            "id": "floor", "aspect": 1.5, "plan_url": None,
            "rooms": [{"area": "private-area"}],
            "partitions": [], "wall_columns": [],
        }],
        "markers": [{
            "id": "marker", "binding": "device:private-device",
            "name": "Private name", "settings": {"token": "marker-secret"},
        }],
        "settings": {
            "known_devices": ["private-device"],
            "support_contact": "owner@example.invalid",
            "nested": {"entity": "sensor.private"},
        },
    }
    runtime = SimpleNamespace(
        config_store=_Store({"config": config, "rev": 7}),
        store=_Store({"layout": {"marker": {"x": 0.2, "y": 0.3}}}),
    )
    entry = SimpleNamespace(runtime_data=runtime, options={})

    result = await async_get_config_entry_diagnostics(hass, entry)
    wire = json.dumps(result, sort_keys=True)
    for secret in (
        "device:private-device", "Private name", "marker-secret",
        "private-device", "owner@example.invalid", "sensor.private",
    ):
        assert secret not in wire
    assert result["rev"] == 7
    assert result["layout_entries"] == 1
    assert result["spaces"][0]["rooms"] == 1
