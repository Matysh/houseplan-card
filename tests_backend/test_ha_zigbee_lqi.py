"""#1029: real entry/coordinator/adapters/WS with deterministic provider transports."""
from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY, GROUP_ID_USER
from homeassistant.core import is_callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.store import async_save_config_state
from custom_components.houseplan.zigbee_lqi_model import MAX_STATE_BYTES
from custom_components.houseplan.zigbee_lqi_z2m import mqtt


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


async def until(predicate):
    for _ in range(5000):
        if predicate():
            return
        await asyncio.sleep(0)
    assert predicate(), "background subscriptions did not settle"


class Transport:
    def __init__(self):
        self.callbacks = {}
        self.status = set()
        self.connected = True
        self.subscribed = []
        self.published = []
        self.retained_inventory = None

    async def subscribe(self, hass, topic, callback, *, qos, encoding):
        assert qos == 0 and encoding is None
        assert is_callback(callback), "MQTT must execute registry/cache work on HA's event loop"
        self.subscribed.append(topic)
        self.callbacks.setdefault(topic, set()).add(callback)
        if topic.endswith("/bridge/devices") and self.retained_inventory is not None:
            callback(SimpleNamespace(topic=topic, payload=json.dumps(self.retained_inventory).encode(), retain=True))
        return lambda: self.callbacks[topic].discard(callback)

    def subscribe_status(self, hass, callback):
        assert is_callback(callback)
        self.status.add(callback)
        return lambda: self.status.discard(callback)

    def emit(self, topic, payload, retain=False):
        if not isinstance(payload, (str, bytes)):
            payload = json.dumps(payload).encode()
        for callback in tuple(self.callbacks.get(topic, ())):
            callback(SimpleNamespace(topic=topic, payload=payload, retain=retain))

    def connection(self, available):
        self.connected = available
        for callback in tuple(self.status):
            callback(available)

    @property
    def listener_count(self):
        return sum(len(value) for value in self.callbacks.values())


@pytest.fixture
def transport(monkeypatch):
    value = Transport()
    monkeypatch.setattr(mqtt, "mqtt_config_entry_enabled", lambda hass: True)
    monkeypatch.setattr(mqtt, "is_connected", lambda hass: value.connected)
    monkeypatch.setattr(mqtt, "async_subscribe", value.subscribe)
    monkeypatch.setattr(mqtt, "async_subscribe_connection_status", value.subscribe_status)

    async def forbidden(*args, **kwargs):
        value.published.append((args, kwargs))
        raise AssertionError("passive LQI must never publish or scan")

    monkeypatch.setattr(mqtt, "async_publish", forbidden)
    return value


async def setup(hass, *, topics=None):
    mqtt_entry = MockConfigEntry(domain="mqtt", title="MQTT", data={})
    mqtt_entry.add_to_hass(hass)
    zha_entry = MockConfigEntry(domain="zha", title="ZHA", data={})
    zha_entry.add_to_hass(hass)
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    runtime = entry.runtime_data
    config = {"spaces": [], "markers": [], "settings": {
        "zigbee_topology": {"enabled": False, "z2m_base_topics": topics or ["zigbee2mqtt"]}}}
    await async_save_config_state(runtime, config, 1)
    return entry, mqtt_entry, zha_entry, runtime.zigbee_lqi, config


def device(hass, entry, ieee, name="Same name", area=None):
    identifier = f"zigbee2mqtt_0x{ieee:016x}" if entry.domain == "mqtt" else f"{ieee:016x}"
    registry = dr.async_get(hass)
    row = registry.async_get_or_create(config_entry_id=entry.entry_id,
        identifiers={(entry.domain, identifier)}, name=name)
    return registry.async_update_device(row.id, area_id=area) if area else row


async def save(entry, config, revision=2):
    await async_save_config_state(entry.runtime_data, config, revision)
    await until(lambda: entry.runtime_data.zigbee_lqi._refresh_task is None)


async def test_issue_1053_projected_probe_keeps_capability_outside_config(hass, transport, hass_ws_client):
    entry, _, _, _, _ = await setup(hass)
    client = await hass_ws_client(hass)
    before = await entry.runtime_data.config_store.async_load()
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    full = (await client.receive_json())["result"]
    await client.send_json_auto_id({"type": "houseplan/config/get", "fields": ["model_version"]})
    reply = await client.receive_json()
    assert reply["success"], reply
    projected = reply["result"]
    assert projected["config"] == {key: value for key, value in full["config"].items() if key == "model_version"}
    assert set(projected["config"]) <= {"model_version"}
    assert projected["zigbee_lqi_api"] == full["zigbee_lqi_api"] == 1
    assert projected["rev"] == full["rev"] == 1
    assert projected["can_write"] == full["can_write"]
    assert await entry.runtime_data.config_store.async_load() == before


def inventory(ieee=1, name="floor/room/sensor"):
    return [{"ieee_address": f"0x{ieee:016x}", "friendly_name": name}]


async def bind(transport, coordinator, base="zigbee2mqtt", ieee=1, name="floor/room/sensor"):
    await until(lambda: bool(transport.callbacks.get(f"{base}/bridge/devices")))
    transport.emit(f"{base}/bridge/devices", inventory(ieee, name), retain=True)
    await until(lambda: bool(transport.callbacks.get(f"{base}/{name}/linkquality")))
    assert coordinator.bindings


async def test_direct_z2m_no_entity_topology_off_json_attribute_unknown_and_zero(hass, transport):
    entry, mqtt_entry, _, coordinator, config = await setup(hass)
    physical = device(hass, mqtt_entry, 1)
    config["markers"] = [{"id": "own", "binding": f"device:{physical.id}"}]
    await save(entry, config)
    assert coordinator.snapshot()["devices"] == {}
    await bind(transport, coordinator)
    transport.emit("zigbee2mqtt/floor/room/sensor", {"linkquality": 200})
    assert coordinator.snapshot()["devices"][physical.id]["lqi"] == 200
    observed = coordinator.snapshot()["devices"][physical.id]["observed_at"]
    transport.emit("zigbee2mqtt/floor/room/sensor", {"temperature": 20})
    transport.emit("zigbee2mqtt/floor/room/sensor", b"{bad")
    transport.emit("zigbee2mqtt/floor/room/sensor", b" " * (MAX_STATE_BYTES + 1))
    transport.emit("zigbee2mqtt/floor/room/sensor", b'{"linkquality":1,' + b" " * MAX_STATE_BYTES + b'"a":1}')
    for invalid in (True, False, "", "20xx", -1, 256):
        transport.emit("zigbee2mqtt/floor/room/sensor", {"linkquality": invalid})
    assert coordinator.snapshot()["devices"][physical.id]["lqi"] == 200
    assert coordinator.snapshot()["devices"][physical.id]["observed_at"] == observed
    transport.emit("zigbee2mqtt/floor/room/sensor/linkquality", "0")
    assert coordinator.snapshot()["devices"][physical.id]["lqi"] == 0
    transport.emit("zigbee2mqtt/floor/room/sensor", {"linkquality": None})
    assert coordinator.snapshot()["devices"] == {}
    assert transport.published == []


async def test_area_entity_scope_and_diagnostic_disabled_do_not_expand_to_neighbours(hass, transport):
    entry, mqtt_entry, _, coordinator, config = await setup(hass)
    area = ar.async_get(hass).async_create("Room")
    in_room = device(hass, mqtt_entry, 1, area=area.id)
    parent = device(hass, mqtt_entry, 2)
    foreign = device(hass, mqtt_entry, 3)
    entity = er.async_get(hass).async_get_or_create("sensor", "mqtt", "owned", config_entry=mqtt_entry, device_id=parent.id)
    diagnostic = er.async_get(hass).async_get_or_create("sensor", "mqtt", "diagnostic", config_entry=mqtt_entry,
        device_id=in_room.id, disabled_by=er.RegistryEntryDisabler.INTEGRATION)
    config["spaces"] = [{"id": "f", "rooms": [{"id": "r", "area": area.id}]}]
    config["markers"] = [{"id": "entity", "binding": f"entity:{entity.entity_id}"}]
    await save(entry, config)
    transport.emit("zigbee2mqtt/bridge/devices", [*inventory(1, "room"), *inventory(2, "entity"), *inventory(3, "foreign")])
    await until(lambda: coordinator._refresh_task is None)
    transport.emit("zigbee2mqtt/room", {"linkquality": 100})
    transport.emit("zigbee2mqtt/entity", {"linkquality": 200})
    transport.emit("zigbee2mqtt/foreign", {"linkquality": 250})
    assert set(coordinator.snapshot()["devices"]) == {in_room.id, parent.id}
    assert foreign.id not in coordinator.snapshot()["devices"] and diagnostic.disabled_by is not None
    er.async_get(hass).async_update_entity(entity.entity_id, disabled_by=er.RegistryEntryDisabler.USER)
    await until(lambda: coordinator._refresh_task is None)
    await hass.async_block_till_done()
    assert set(coordinator.snapshot()["devices"]) == {in_room.id}


async def test_200_radios_600_markers_four_consumers_one_cycle_bounded_batch_and_zero_leaks(hass, transport):
    entry, mqtt_entry, _, coordinator, config = await setup(hass)
    physical = [device(hass, mqtt_entry, i + 1) for i in range(200)]
    config["markers"] = [{"id": f"m{i}-{alias}", "binding": f"device:{row.id}"}
                         for i, row in enumerate(physical) for alias in range(3)]
    await save(entry, config)
    transport.emit("zigbee2mqtt/bridge/devices", [*({"ieee_address": f"0x{i+1:016x}", "friendly_name": f"d{i}"} for i in range(200))])
    await until(lambda: coordinator._refresh_task is None)
    snapshots = [[] for _ in range(4)]
    releases = [coordinator.add_listener(results.append) for results in snapshots]
    for i in range(200):
        transport.emit(f"zigbee2mqtt/d{i}", {"linkquality": i})
    assert all(not results for results in snapshots), "a noisy burst is coalesced before client delivery"
    coordinator.flush()
    assert all(len(results) == 1 and len(results[0]["devices"]) == 200 for results in snapshots)
    assert len(transport.subscribed) == 401, "one inventory and two exact output topics per physical device, independent of markers/clients"
    assert all(results[0] is snapshots[0][0] for results in snapshots)
    for release in releases:
        release()
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert transport.listener_count == 0 and not transport.status and not coordinator.listeners
    assert transport.published == []


@pytest.mark.parametrize("modern", [False, True], ids=["HA-2024.6-gateway", "HA-2026.8-gateway-proxy"])
async def test_cached_zha_both_api_generations_exact_entry_and_unchanged_observation(hass, transport, modern):
    entry, _, zha_entry, coordinator, config = await setup(hass)
    physical = device(hass, zha_entry, 2)
    radio = SimpleNamespace(ieee="00:00:00:00:00:00:00:02", lqi=180)
    gateway = SimpleNamespace(devices={radio.ieee: radio}, config_entry=zha_entry)
    hass.data["zha"] = (SimpleNamespace(gateway_proxy=SimpleNamespace(gateway=gateway, config_entry=zha_entry))
                        if modern else SimpleNamespace(gateway=gateway))
    config["markers"] = [{"id": "zha", "binding": f"device:{physical.id}"}]
    await save(entry, config)
    first = coordinator.snapshot()["devices"][physical.id]
    assert first["lqi"] == 180 and first["provider"] == "zha" and first["measurement_at"] is None
    await coordinator.async_refresh()
    assert coordinator.snapshot()["devices"][physical.id] == first, "memory read is not a new measurement"
    radio.lqi = None
    await coordinator.async_refresh()
    assert coordinator.snapshot()["devices"] == {}, "missing cached LQI is never synthesized as zero"
    assert transport.published == []


async def test_multiple_instances_foreign_inventory_exact_registry_and_conflict_refusal(hass, transport):
    entry, mqtt_entry, zha_entry, coordinator, config = await setup(hass, topics=["one", "two"])
    a, b, z = device(hass, mqtt_entry, 1), device(hass, mqtt_entry, 2), device(hass, zha_entry, 3)
    config["markers"] = [{"id": d.id, "binding": f"device:{d.id}"} for d in (a, b, z)]
    hass.data["zha"] = SimpleNamespace(gateway=SimpleNamespace(config_entry=zha_entry,
        devices={"z": SimpleNamespace(ieee="0000000000000003", lqi=60)}))
    await save(entry, config)
    await bind(transport, coordinator, "one", 1, "same")
    await bind(transport, coordinator, "two", 2, "same")
    transport.emit("one/same", {"linkquality": 200})
    transport.emit("two/same", {"linkquality": 100})
    assert {key: row["lqi"] for key, row in coordinator.snapshot()["devices"].items()} == {a.id: 200, b.id: 100, z.id: 60}
    transport.emit("two/bridge/devices", inventory(1, "same"))
    await until(lambda: coordinator._refresh_task is None)
    assert set(coordinator.snapshot()["devices"]) == {z.id}, "same IEEE in two instances refuses both; removed b is retired"


async def test_rename_remove_repair_topics_registry_and_old_callbacks_are_fenced(hass, transport):
    entry, mqtt_entry, _, coordinator, config = await setup(hass)
    physical = device(hass, mqtt_entry, 1)
    config["markers"] = [{"id": "own", "binding": f"device:{physical.id}"}]
    await save(entry, config)
    await bind(transport, coordinator)
    old = tuple(transport.callbacks["zigbee2mqtt/floor/room/sensor"])
    transport.emit("zigbee2mqtt/floor/room/sensor", {"linkquality": 100})
    transport.emit("zigbee2mqtt/bridge/devices", inventory(1, "renamed"))
    for callback in old:
        callback(SimpleNamespace(payload=b'{"linkquality":255}'))
    await until(lambda: bool(transport.callbacks.get("zigbee2mqtt/renamed")))
    assert coordinator.snapshot()["devices"][physical.id]["lqi"] == 100
    transport.emit("zigbee2mqtt/renamed", {"linkquality": 180})
    transport.emit("zigbee2mqtt/bridge/devices", [])
    await until(lambda: coordinator._refresh_task is None)
    assert coordinator.snapshot()["devices"] == {}
    for callback in old:
        callback(SimpleNamespace(payload=b'{"linkquality":255}'))
    assert coordinator.snapshot()["devices"] == {}
    transport.emit("zigbee2mqtt/bridge/devices", inventory(1, "renamed"))
    await until(lambda: bool(transport.callbacks.get("zigbee2mqtt/renamed")))
    transport.emit("zigbee2mqtt/renamed", {"linkquality": 80})
    config["settings"]["zigbee_topology"]["z2m_base_topics"] = ["new"]
    await save(entry, config, 3)
    assert coordinator.snapshot()["devices"] == {}
    assert not transport.callbacks["zigbee2mqtt/renamed"]
    assert transport.published == []


async def test_disconnect_retains_truthful_last_known_and_reload_unloads_every_listener(hass, transport):
    entry, mqtt_entry, _, coordinator, config = await setup(hass)
    physical = device(hass, mqtt_entry, 1)
    config["markers"] = [{"id": "own", "binding": f"device:{physical.id}"}]
    await save(entry, config)
    await bind(transport, coordinator)
    transport.emit("zigbee2mqtt/floor/room/sensor", {"linkquality": 0}, retain=True)
    initial = coordinator.snapshot()["devices"][physical.id]
    transport.connection(False)
    await until(lambda: coordinator._refresh_task is None)
    lost = coordinator.snapshot()["devices"][physical.id]
    assert lost["lqi"] == 0 and lost["available"] is False
    assert lost["observed_at"] == initial["observed_at"] and lost["measurement_at"] is None
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert coordinator.closed and not coordinator.values and not coordinator.listeners
    assert transport.listener_count == 0 and not transport.status
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    replacement = entry.runtime_data.zigbee_lqi
    assert replacement.session_id != coordinator.session_id
    assert replacement.snapshot()["devices"] == {}, "volatile values never survive integration reload"


async def test_delayed_subscribe_after_topic_generation_change_releases_old_transport(hass, transport, monkeypatch):
    entry, mqtt_entry, _, coordinator, config = await setup(hass)
    physical = device(hass, mqtt_entry, 1)
    config["markers"] = [{"id": "own", "binding": f"device:{physical.id}"}]
    await save(entry, config)
    original = transport.subscribe
    gate = hass.loop.create_future()
    started = hass.loop.create_future()

    async def delayed(hass, topic, callback, *, qos, encoding):
        if topic == "zigbee2mqtt/late":
            started.set_result(True)
            await asyncio.shield(gate)
        return await original(hass, topic, callback, qos=qos, encoding=encoding)

    monkeypatch.setattr(mqtt, "async_subscribe", delayed)
    transport.emit("zigbee2mqtt/bridge/devices", inventory(1, "late"))
    await started
    config["settings"]["zigbee_topology"]["z2m_base_topics"] = ["replacement"]
    await async_save_config_state(entry.runtime_data, config, 3)
    gate.set_result(True)
    await until(lambda: coordinator._refresh_task is None)
    assert not transport.callbacks.get("zigbee2mqtt/late")
    assert not transport.callbacks.get("zigbee2mqtt/late/linkquality")
    assert transport.callbacks.get("replacement/bridge/devices")
    assert coordinator.snapshot()["devices"] == {}
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert transport.listener_count == 0 and not transport.status


async def test_synchronous_retained_inventory_joins_one_entry_refresh_owner(hass, transport):
    transport.retained_inventory = inventory(1, "retained")
    entry, mqtt_entry, _, coordinator, config = await setup(hass)
    physical = device(hass, mqtt_entry, 1)
    config["markers"] = [{"id": "own", "binding": f"device:{physical.id}"}]
    await save(entry, config)
    transport.emit("zigbee2mqtt/retained", {"linkquality": 42}, retain=True)
    assert coordinator.snapshot()["devices"][physical.id]["lqi"] == 42
    assert transport.subscribed.count("zigbee2mqtt/bridge/devices") == 1
    assert coordinator._refresh_task is None


@pytest.mark.parametrize("group", [None, GROUP_ID_USER, GROUP_ID_READ_ONLY], ids=["admin", "household", "read-only-kiosk"])
async def test_authenticated_read_only_projection_acl_and_no_raw_or_foreign_data(hass, hass_ws_client, transport, group):
    entry, mqtt_entry, _, coordinator, config = await setup(hass)
    physical = device(hass, mqtt_entry, 1)
    foreign = device(hass, mqtt_entry, 99)
    config["markers"] = [{"id": "own", "binding": f"device:{physical.id}", "hidden": True}]
    await save(entry, config)
    await bind(transport, coordinator)
    transport.emit("zigbee2mqtt/floor/room/sensor", {"linkquality": 180})
    client = await hass_ws_client(hass)
    if group:
        user = await hass.auth.async_create_user("Viewer", group_ids=[group])
        token = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
        client = await hass_ws_client(hass, hass.auth.async_create_access_token(token))
    await client.send_json_auto_id({"type": "houseplan/zigbee_lqi/subscribe"})
    assert (await client.receive_json())["success"]
    event = (await client.receive_json())["event"]
    assert set(event["devices"]) == {physical.id} and foreign.id not in event["devices"]
    assert set(event) == {"kind", "session_id", "revision", "devices"}
    assert set(event["devices"][physical.id]) == {"lqi", "provider", "available", "observed_at", "measurement_at"}
    await client.send_json_auto_id({"type": "houseplan/zigbee_lqi/subscribe", "base_topic": "foreign"})
    assert (await client.receive_json())["success"] is False, "read-only callers cannot select an arbitrary topic"
    if group:
        await client.send_json_auto_id({"type": "houseplan/zigbee/subscribe"})
        assert (await client.receive_json())["error"]["code"] == "unauthorized"
        user.is_active = False
        coordinator.flush()
        assert len(coordinator.listeners) == 0, "revoked user no longer owns the live projection"
    assert transport.published == []
