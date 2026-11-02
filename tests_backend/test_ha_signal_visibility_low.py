"""#1130: actual HA storage/CAS accepts low-only without rewriting legacy values."""
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


async def test_low_signal_real_config_roundtrip_and_stale_cas(hass: HomeAssistant, hass_ws_client: WebSocketGenerator):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    candidate, _ = commit_wall_segment_model({"spaces": [{"id": "f", "title": "Floor", "rooms": [], "view_box": [0, 0, 1, 1],
        "settings": {"show_lqi_mode": "low", "show_lqi": True, "future_1130": 7}}], "settings": {"show_lqi": "low"}})
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": candidate, "expected_rev": 0})
    saved = await client.receive_json()
    assert saved["success"], saved
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    accepted = (await client.receive_json())["result"]
    assert accepted["config"]["settings"]["show_lqi"] == "low"
    assert accepted["config"]["spaces"][0]["settings"]["show_lqi_mode"] == "low"
    assert accepted["config"]["spaces"][0]["settings"]["future_1130"] == 7
    assert (await get_data(hass).config_store.async_load())["config"] == accepted["config"]
    changed = copy.deepcopy(accepted["config"])
    changed["settings"]["show_lqi"] = False
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": changed, "expected_rev": accepted["rev"] - 1})
    rejected = await client.receive_json()
    assert not rejected["success"] and rejected["error"]["code"] == "conflict"
    assert (await get_data(hass).config_store.async_load())["config"]["settings"]["show_lqi"] == "low"
    # Legacy true remains a legacy inheritance marker, not a materialized mode.
    changed["settings"]["show_lqi"] = True
    changed["spaces"][0]["settings"].pop("show_lqi_mode")
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": changed, "expected_rev": accepted["rev"]})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    restored = (await client.receive_json())["result"]["config"]
    assert restored["settings"]["show_lqi"] is True
    assert restored["spaces"][0]["settings"]["show_lqi"] is True
    assert "show_lqi_mode" not in restored["spaces"][0]["settings"]
