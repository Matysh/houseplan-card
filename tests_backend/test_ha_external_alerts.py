"""#1001: durable HA actions and the authenticated live View subscription."""
from asyncio import gather, wait_for
from copy import deepcopy
import json

import pytest
import voluptuous as vol
from homeassistant.auth.const import GROUP_ID_READ_ONLY
from homeassistant.core import Context
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.core.wall_segment_model import commit_wall_segment_model
from custom_components.houseplan.diagnostics import async_get_config_entry_diagnostics
from custom_components.houseplan.external_alerts import CHANGED, ExternalAlerts, MAX_PER_TARGET
from custom_components.houseplan.external_alerts_websocket import TYPE
from custom_components.houseplan.services import SET_ALERT_SCHEMA


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


async def _setup(hass):
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id, identifiers={("fixture", "ventilation")},
    )
    entities = er.async_get(hass)
    exact = entities.async_get_or_create(
        "sensor", "fixture", "exact", suggested_object_id="exact", device_id=device.id,
    )
    unplaced = entities.async_get_or_create(
        "sensor", "fixture", "unplaced", suggested_object_id="unplaced",
    )
    hass.states.async_set("input_boolean.signal_helper", "off")
    spaces = [{"id": floor, "title": floor.title(), "view_box": [0, 0, 1, 1],
               "rooms": [], "plan_url": None} for floor in ("ground", "upper")]
    cfg, _ = commit_wall_segment_model({"spaces": spaces, "markers": [
        {"id": "device-face", "binding": f"device:{device.id}", "space": "ground"},
        {"id": "entity-face", "binding": f"entity:{exact.entity_id}", "space": "upper"},
        {"id": "helper", "binding": "entity:input_boolean.signal_helper", "space": "ground"},
        {"id": "virtual", "binding": "virtual", "space": "ground", "controls": [exact.entity_id]},
    ], "settings": {}})
    await entry.runtime_data.config_store.async_save({"rev": 1, "config": cfg})
    await hass.async_block_till_done()
    return entry, device, exact, unplaced


async def _subscribe(client):
    await client.send_json_auto_id({"type": TYPE})
    result = await client.receive_json()
    assert result["success"], result
    return result["id"], (await client.receive_json())["event"]["signals"]


async def _call(hass, action, **data):
    return await hass.services.async_call(DOMAIN, action, data, blocking=True)


@pytest.mark.parametrize("data", [
    {}, {"entity_id": "sensor.a", "device_id": "d"}, {"device_id": ["d"]},
    {"entity_id": "sensor.a", "level": "red"},
    {"entity_id": "sensor.a", "key": "x" * 65},
    {"entity_id": "sensor.a", "message": "字" * 256},
    {"entity_id": "sensor.a", "message": "first\nsecond"},
])
def test_actions_reject_invalid_arguments(data):
    with pytest.raises(vol.Invalid):
        SET_ALERT_SCHEMA(data)


async def test_system_actions_update_read_only_viewer_and_survive_reload(hass, hass_ws_client):
    entry, device, exact, _ = await _setup(hass)
    user = await hass.auth.async_create_user("Wall panel", group_ids=[GROUP_ID_READ_ONLY])
    refresh = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    viewer = await hass_ws_client(hass, access_token=hass.auth.async_create_access_token(refresh))
    _, initial = await _subscribe(viewer)
    assert initial == []
    bus_events = []
    hass.bus.async_listen(CHANGED, lambda event: bus_events.append(event.data))

    with pytest.raises(HomeAssistantError):
        await hass.services.async_call(DOMAIN, "set_alert", {"device_id": device.id},
                                       context=Context(user_id=user.id), blocking=True)
    await _call(hass, "set_alert", device_id=device.id, key=" main ", message="Synthetic reason")
    signals = (await viewer.receive_json())["event"]["signals"]
    assert len(signals) == 1
    assert signals[0]["level"] == "attention"
    assert {owner["id"] for owner in signals[0]["owners"]} == {"entity-face", "device-face"}
    assert signals[0]["message"] == "Synthetic reason"
    assert bus_events == [{}]
    await _call(hass, "set_alert", device_id=device.id, key="main", message="Synthetic reason")
    await hass.async_block_till_done()
    assert bus_events == [{}], "identical repeat does not publish"

    await _call(hass, "set_alert", entity_id=exact.entity_id, level="alarm", key="own")
    signals = (await viewer.receive_json())["event"]["signals"]
    assert len(signals) == 2
    assert [owner["id"] for owner in signals[1]["owners"]] == ["entity-face"]
    assert await hass.config_entries.async_reload(entry.entry_id)
    restarted = ExternalAlerts(hass)
    assert await restarted.snapshot(user) == signals, "fresh instance reads all active signals from storage"

    await _call(hass, "clear_alert", entity_id=exact.entity_id, key="own")
    assert (await viewer.receive_json())["event"]["signals"] == signals[:1]
    await _call(hass, "clear_alert", device_id=device.id)
    assert (await viewer.receive_json())["event"]["signals"] == []
    await _call(hass, "clear_alert", device_id=device.id)


async def test_kiosk_subscribes_before_setup_and_recovers_without_another_action(hass, hass_ws_client):
    entry, _, _, _ = await _setup(hass)
    helper_id = "input_boolean.signal_helper"
    await _call(hass, "set_alert", entity_id=helper_id, level="alarm", message="Persisted reason")
    assert await hass.config_entries.async_unload(entry.entry_id)
    hass.states.async_remove(helper_id)

    viewer = await hass_ws_client(hass)
    await viewer.send_json_auto_id({"type": TYPE})
    result = await wait_for(viewer.receive_json(), 5)
    assert result["success"], result
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)

    frame = await wait_for(viewer.receive_json(), 5)
    assert frame["id"] == result["id"]
    signals = frame["event"]["signals"]
    assert len(signals) == 1
    assert signals[0]["level"] == "alarm"
    assert signals[0]["message"] == "Persisted reason"
    assert signals[0]["owners"] == [{"id": "helper", "binding": f"entity:{helper_id}"}]
    assert hass.states.get(helper_id) is None

    assert await hass.config_entries.async_unload(entry.entry_id)
    hass.bus.async_fire("houseplan_config_updated")
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    await viewer.send_json_auto_id({"type": "ping"})
    assert (await wait_for(viewer.receive_json(), 5))["type"] == "pong", "reload does not publish an empty snapshot"
    await _call(hass, "clear_alert", entity_id=helper_id)
    assert (await wait_for(viewer.receive_json(), 5))["event"]["signals"] == []


async def test_rename_falls_back_to_device_and_helper_uses_exact_binding(hass, hass_ws_client):
    _, device, exact, unplaced = await _setup(hass)
    admin = await hass_ws_client(hass)
    _, _ = await _subscribe(admin)
    with pytest.raises(ServiceValidationError):
        await _call(hass, "set_alert", entity_id=unplaced.entity_id)
    with pytest.raises(ServiceValidationError):
        await _call(hass, "set_alert", device_id="virtual")
    await _call(hass, "set_alert", entity_id=exact.entity_id)
    original = (await admin.receive_json())["event"]["signals"][0]
    er.async_get(hass).async_update_entity(exact.entity_id, new_entity_id="sensor.renamed")
    moved = (await admin.receive_json())["event"]["signals"][0]
    assert moved["id"] == original["id"]
    assert moved["owners"] == [{"id": "device-face", "binding": f"device:{device.id}"}]
    await _call(hass, "clear_alert", entity_id="sensor.renamed")
    assert (await admin.receive_json())["event"]["signals"] == []
    await _call(hass, "set_alert", entity_id="input_boolean.signal_helper")
    helper = (await admin.receive_json())["event"]["signals"][0]
    assert helper["owners"] == [{"id": "helper", "binding": "entity:input_boolean.signal_helper"}]


async def test_limit_keeps_existing_signals_and_allows_update(hass, hass_admin_user):
    entry, device, _, _ = await _setup(hass)
    alerts = hass.data[DOMAIN]["external_alerts"]
    config = deepcopy(await entry.runtime_data.config_store.async_load())
    config["config"]["markers"] = [m for m in config["config"]["markers"] if m["id"] != "device-face"]
    await entry.runtime_data.config_store.async_save(config)
    for i in range(MAX_PER_TARGET):
        await _call(hass, "set_alert", device_id=device.id, key=f"signal-{i}")
    before = await alerts.snapshot(hass_admin_user)
    assert len(before) == MAX_PER_TARGET
    assert all([o["id"] for o in row["owners"]] == ["entity-face"] for row in before)
    with pytest.raises(ServiceValidationError):
        await _call(hass, "set_alert", device_id=device.id, key="overflow")
    assert await alerts.snapshot(hass_admin_user) == before
    await _call(hass, "set_alert", device_id=device.id, key="signal-0", level="alarm")
    assert (await alerts.snapshot(hass_admin_user))[0]["level"] == "alarm"
    await _call(hass, "clear_alert", device_id=device.id, key=" ")
    assert await alerts.snapshot(hass_admin_user) == []


async def test_concurrent_calls_keep_distinct_signals_and_private_reason(hass, hass_ws_client, hass_admin_user):
    entry, device, exact, _ = await _setup(hass)
    config = deepcopy(await entry.runtime_data.config_store.async_load())
    config["config"]["markers"][1]["hidden"] = True
    await entry.runtime_data.config_store.async_save(config)
    admin = await hass_ws_client(hass)

    async def export_payload():
        await admin.send_json_auto_id({"type": "houseplan/export/create", "kind": "full"})
        result = await admin.receive_json()
        assert result["success"], result
        return result["result"]["document"]["payload"]

    before = await export_payload()
    await _call(hass, "set_alert", entity_id=exact.entity_id, key="early")
    await gather(
        _call(hass, "clear_alert", entity_id=exact.entity_id, key="early"),
        _call(hass, "set_alert", entity_id=exact.entity_id, key="hidden", level="alarm"),
        _call(hass, "set_alert", device_id=device.id, key="one", message="Private fixture reason"),
        _call(hass, "set_alert", device_id=device.id, key="two"),
    )
    alerts = hass.data[DOMAIN]["external_alerts"]
    rows = await alerts.snapshot(hass_admin_user)
    assert sorted(row["id"].rsplit("/", 1)[-1] for row in rows) == ["one", "two"]
    assert all([owner["id"] for owner in row["owners"]] == ["device-face"] for row in rows)
    diagnostics = await async_get_config_entry_diagnostics(hass, entry)
    assert diagnostics["external_alerts"] == {"attention": 2, "alarm": 1}
    assert "Private fixture reason" not in json.dumps(diagnostics)
    assert await export_payload() == before


async def test_ha_automation_owns_both_conditions(hass, hass_admin_user):
    _, device, _, _ = await _setup(hass)
    assert await async_setup_component(hass, "automation", {"automation": [
        {
            "id": "houseplan-show-synthetic",
            "alias": "Show synthetic signal",
            "triggers": [{"trigger": "state", "entity_id": "input_boolean.signal_helper", "to": "on"}],
            "actions": [{"action": "houseplan.set_alert", "data": {
                "device_id": device.id, "level": "alarm", "key": "condition",
            }}],
        },
        {
            "id": "houseplan-clear-synthetic",
            "alias": "Clear synthetic signal",
            "triggers": [{"trigger": "state", "entity_id": "input_boolean.signal_helper", "to": "off"}],
            "actions": [{"action": "houseplan.clear_alert", "data": {
                "device_id": device.id, "key": "condition",
            }}],
        },
    ]})
    await hass.async_block_till_done()
    alerts = hass.data[DOMAIN]["external_alerts"]
    hass.states.async_set("input_boolean.signal_helper", "on")
    await hass.async_block_till_done()
    rows = await alerts.snapshot(hass_admin_user)
    assert len(rows) == 1 and rows[0]["level"] == "alarm"
    assert rows[0]["source_name"] == "Show synthetic signal"

    hass.states.async_set("input_boolean.signal_helper", "off")
    await hass.async_block_till_done()
    assert await alerts.snapshot(hass_admin_user) == []


async def test_shared_state_context_does_not_attribute_a_signal_to_another_automation(hass, hass_admin_user):
    _, device, _, _ = await _setup(hass)
    context = Context()
    hass.states.async_set("automation.other", "off", {"friendly_name": "Other"}, context=context)
    await hass.services.async_call(DOMAIN, "set_alert", {"device_id": device.id},
                                   context=context, blocking=True)
    alerts = hass.data[DOMAIN]["external_alerts"]
    assert (await alerts.snapshot(hass_admin_user))[0]["source_name"] is None
