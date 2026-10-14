"""#867 AC3: authenticated config CAS persists and re-reads the optional flag."""
import copy

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.store import get_data
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    yield


@pytest.mark.parametrize("value", [True, False])
async def test_hide_signal_real_config_set_get_and_stale_cas(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, value: bool,
) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    config, _ = commit_wall_segment_model({"spaces": [{"id": "f", "title": "Floor", "rooms": [], "view_box": [0, 0, 1, 1]}],
        "settings": {}, "markers": [{"id": "m", "binding": "virtual", "hide_signal": value, "hide_battery": True}]})
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": config, "expected_rev": 0})
    saved = await client.receive_json()
    assert saved["success"], saved
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    accepted = (await client.receive_json())["result"]
    assert accepted["config"]["markers"][0]["hide_signal"] is value
    assert accepted["config"]["markers"][0]["hide_battery"] is True
    revision = accepted["rev"]
    assert (await get_data(hass).config_store.async_load())["config"]["markers"][0]["hide_signal"] is value
    changed = copy.deepcopy(accepted["config"])
    changed["markers"][0].pop("hide_signal")
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": changed, "expected_rev": revision - 1})
    rejected = await client.receive_json()
    assert not rejected["success"] and rejected["error"]["code"] == "conflict"
    assert (await get_data(hass).config_store.async_load())["config"]["markers"][0]["hide_signal"] is value
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": changed, "expected_rev": revision})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    restored = (await client.receive_json())["result"]
    assert "hide_signal" not in restored["config"]["markers"][0]
    assert restored["config"]["markers"][0]["hide_battery"] is True
