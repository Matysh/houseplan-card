"""End-to-end HA WebSocket contracts for persistent virtual lights (#107)."""
import pytest


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the test hass."""
    yield


from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.virtual_lights import EVENT_VIRTUAL_LIGHT_UPDATED


def _config(*markers):
    return {"spaces": [], "markers": list(markers), "settings": {}}


def _manual(marker_id="lamp", **extra):
    return {
        "id": marker_id,
        "binding": "virtual",
        "is_light": True,
        "tap_action": "toggle",
        **extra,
    }


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def _set_config(client, config, expected_rev):
    await client.send_json_auto_id({
        "type": "houseplan/config/set",
        "config": config,
        "expected_rev": expected_rev,
    })
    response = await client.receive_json()
    assert response["success"], response
    return response["result"]


async def _get_config(client):
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    response = await client.receive_json()
    assert response["success"], response
    return response["result"]


async def _toggle(client, marker_id="lamp"):
    await client.send_json_auto_id({
        "type": "houseplan/virtual_light/toggle",
        "marker_id": marker_id,
    })
    return await client.receive_json()


async def test_default_toggle_event_and_restart_persistence(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator,
) -> None:
    entry = await _setup(hass)
    client = await hass_ws_client(hass)
    await _set_config(client, _config(_manual()), 0)

    first = await _get_config(client)
    assert first["virtual_lights"] == {"rev": 0, "config_rev": 1, "off": []}

    events = []
    remove = hass.bus.async_listen(
        EVENT_VIRTUAL_LIGHT_UPDATED,
        lambda event: events.append(event.data),
    )
    response = await _toggle(client)
    assert response["success"]
    assert response["result"] == {"marker_id": "lamp", "on": False, "rev": 1}
    await hass.async_block_till_done()
    assert events == [response["result"]], "event follows and matches the durable reply"
    remove()

    stored = await _get_config(client)
    assert stored["virtual_lights"] == {"rev": 1, "config_rev": 1, "off": ["lamp"]}

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    restarted = await hass_ws_client(hass)
    stored = await _get_config(restarted)
    assert stored["virtual_lights"] == {"rev": 1, "config_rev": 1, "off": ["lamp"]}


async def test_read_only_authenticated_user_can_toggle(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
) -> None:
    await _setup(hass)
    admin = await hass_ws_client(hass)
    await _set_config(admin, _config(_manual()), 0)

    viewer = await hass_ws_client(hass, access_token=hass_read_only_access_token)
    response = await _toggle(viewer)
    assert response["success"]
    assert response["result"]["on"] is False


async def test_lifecycle_preserves_hidden_and_prunes_when_eligibility_ends(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator,
) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await _set_config(client, _config(_manual()), 0)
    assert (await _toggle(client))["result"]["on"] is False

    await _set_config(client, _config(_manual(name="Renamed", hidden=True)), 1)
    hidden = await _get_config(client)
    assert hidden["virtual_lights"]["off"] == ["lamp"]
    assert hidden["virtual_lights"]["config_rev"] == 2

    await _set_config(client, _config(_manual(is_light=False)), 2)
    disabled = await _get_config(client)
    assert disabled["virtual_lights"]["off"] == []

    await _set_config(client, _config(_manual()), 3)
    enabled = await _get_config(client)
    assert enabled["virtual_lights"]["off"] == [], "re-entry starts on"


async def test_invalid_target_and_concurrent_toggles_are_server_atomic(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator,
) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await _set_config(client, _config(_manual()), 0)

    invalid = await _toggle(client, "missing")
    assert not invalid["success"] and invalid["error"]["code"] == "not_toggleable"

    await client.send_json_auto_id({
        "type": "houseplan/virtual_light/toggle", "marker_id": "lamp",
    })
    await client.send_json_auto_id({
        "type": "houseplan/virtual_light/toggle", "marker_id": "lamp",
    })
    answers = [await client.receive_json(), await client.receive_json()]
    assert all(answer["success"] for answer in answers)
    results = sorted((answer["result"] for answer in answers), key=lambda result: result["rev"])
    assert [(result["rev"], result["on"]) for result in results] == [(1, False), (2, True)]
    assert (await _get_config(client))["virtual_lights"]["off"] == []


async def test_failed_durable_save_emits_neither_success_nor_event(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    monkeypatch,
) -> None:
    entry = await _setup(hass)
    client = await hass_ws_client(hass)
    await _set_config(client, _config(_manual()), 0)
    events = []
    remove = hass.bus.async_listen(
        EVENT_VIRTUAL_LIGHT_UPDATED,
        lambda event: events.append(event.data),
    )

    async def fail_save(_data):
        raise OSError("disk full")

    monkeypatch.setattr(entry.runtime_data.virtual_light_store, "async_save", fail_save)
    response = await _toggle(client)
    await hass.async_block_till_done()
    remove()
    assert not response["success"]
    assert events == []
