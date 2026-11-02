"""#1174: real authenticated HA WebSocket writes and store reads."""
import copy

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


@pytest.mark.parametrize("endpoint", ["houseplan/config/set", "houseplan/plan/optimize"])
async def test_weather_reference_persists_and_cannot_be_replaced_by_an_unreadable_source(hass, hass_ws_client, endpoint):
    entry = MockConfigEntry(domain="houseplan", title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.states.async_set("weather.home", "cloudy", {"temperature": 8, "temperature_unit": "°C"})
    client = await hass_ws_client(hass)
    config = {"spaces": [], "markers": [], "settings": {"summary_panel": {
        "version": 1, "title": "Home", "show_on_mobile": True, "blocks": [],
        "weather": {"enabled": True, "entity_id": "weather.home"},
    }}}
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": config, "expected_rev": 0})
    assert (await client.receive_json())["success"]
    hass.states.async_remove("weather.home")

    async def write(candidate, rev):
        message = {"type": endpoint, "config": candidate}
        if endpoint == "houseplan/config/set":
            message["expected_rev"] = rev
        else:
            message.update(layout={}, expected_config_rev=rev, expected_layout_rev=0)
        await client.send_json_auto_id(message)
        return await client.receive_json()

    bad = copy.deepcopy(config)
    bad["settings"]["summary_panel"]["weather"]["entity_id"] = "weather.unreadable"
    denied = await write(bad, 1)
    assert not denied["success"] and denied["error"]["code"] == "invalid_format"
    # A normal old-client settings write preserves the saved deleted source.
    omitted = {"spaces": [], "markers": [], "settings": {"show_room_tooltip": False}}
    accepted = await write(omitted, 1)
    assert accepted["success"], accepted
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    stored = (await client.receive_json())["result"]["config"]
    assert stored["settings"]["summary_panel"] == config["settings"]["summary_panel"]
