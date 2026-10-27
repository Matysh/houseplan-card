"""#1000: real authenticated Store/CAS/copy writers retain definitions only."""
import copy

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY

from custom_components.houseplan.store import get_data
from tests_backend.test_ha_marker_copy import _pair, _request, _seed, _send


@pytest.fixture(autouse=True)
def _enable(enable_custom_integrations):
    yield


def _rules():
    return [{"id": "r1", "type": "threshold", "level": "attention",
             "entity_id": "switch.source", "operator": "eq", "value": "on"}]


async def test_issue1000_real_store_copy_and_rebind_preserve_definitions_without_live_state(hass, hass_ws_client):
    client, before = await _seed(hass, hass_ws_client, real=True)
    config = copy.deepcopy(before[0]["config"])
    config["markers"][0]["alert_sources"] = _rules()
    saved = await _send(client, {"type": "houseplan/config/set", "config": config, "expected_rev": before[0]["rev"]})
    assert saved["success"], saved
    accepted = await _pair(client)
    stored = await get_data(hass).config_store.async_load()
    assert stored["config"]["markers"][0]["alert_sources"] == _rules()
    events = []
    hass.bus.async_listen("call_service", lambda event: events.append(event.data))
    copied = await _send(client, _request(accepted))
    assert copied["success"], copied
    after = await _pair(client)
    markers = {marker["id"]: marker for marker in after[0]["config"]["markers"]}
    assert markers["source"]["alert_sources"] == markers["v_copy"]["alert_sources"] == _rules()
    assert markers["v_copy"]["binding"] == "virtual"
    assert not events
    changed = copy.deepcopy(after[0]["config"])
    changed["markers"][0]["binding"] = "entity:switch.other"
    rebound = await _send(client, {"type": "houseplan/config/set", "config": changed, "expected_rev": after[0]["rev"]})
    assert rebound["success"], rebound
    final = await _pair(client)
    assert final[0]["config"]["markers"][0]["alert_sources"] == _rules()
    stale = await _send(client, {"type": "houseplan/config/set", "config": config, "expected_rev": before[0]["rev"]})
    assert stale["error"]["code"] == "conflict"
    assert await _pair(client) == final


@pytest.mark.parametrize("bad", [None, "opaque", [{"type": "external", "level": "alarm"}],
    [{**_rules()[0], "value": True}], [{**_rules()[0], "id": f"r{i}"} for i in range(4)]])
async def test_issue1000_new_invalid_rules_leave_config_layout_and_revisions_exact(hass, hass_ws_client, bad):
    client, before = await _seed(hass, hass_ws_client, real=True)
    config = copy.deepcopy(before[0]["config"])
    config["markers"][0]["alert_sources"] = bad
    answer = await _send(client, {"type": "houseplan/config/set", "config": config, "expected_rev": before[0]["rev"]})
    assert not answer["success"] and answer["error"]["code"] == "invalid_alert_sources"
    assert await _pair(client) == before


async def test_issue1000_reader_cannot_create_rules_or_change_either_store(hass, hass_ws_client):
    owner, before = await _seed(hass, hass_ws_client, real=True)
    user = await hass.auth.async_create_user("Reader", group_ids=[GROUP_ID_READ_ONLY])
    token = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    reader = await hass_ws_client(hass, access_token=hass.auth.async_create_access_token(token))
    config = copy.deepcopy(before[0]["config"])
    config["markers"][0]["alert_sources"] = _rules()
    answer = await _send(reader, {"type": "houseplan/config/set", "config": config, "expected_rev": before[0]["rev"]})
    assert answer["error"]["code"] == "unauthorized"
    assert await _pair(owner) == before
