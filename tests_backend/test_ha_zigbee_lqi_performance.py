"""#1090: steady-state work stays independent of the represented registry size."""
from __future__ import annotations

import asyncio
import json
from time import perf_counter
from types import SimpleNamespace

import pytest
from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.config_entries import ConfigEntryDisabler
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from custom_components.houseplan import zigbee_lqi as lqi_module
from custom_components.houseplan.zigbee_lqi_z2m import mqtt
from tests_backend.test_ha_zigbee_lqi import (
    _custom_integrations as _custom_integrations,
)
from tests_backend.test_ha_zigbee_lqi import (
    device,
    inventory,
    save,
    setup,
    until,
)
from tests_backend.test_ha_zigbee_lqi import (
    transport as transport,
)


@pytest.mark.parametrize("provider,count", [("z2m", 200), ("zha", 200), ("mixed", 200), ("zha", 1500)])
async def test_steady_values_do_not_revisit_registry_or_full_projection(
    hass, transport, monkeypatch, hass_client, provider, count,
):
    entry, mqtt_entry, zha_entry, coordinator, config = await setup(hass)
    mqtt_count = count if provider == "z2m" else count // 2 if provider == "mixed" else 0
    physical = [device(hass, mqtt_entry if i < mqtt_count else zha_entry, i + 1)
                for i in range(count)]
    radios = [SimpleNamespace(ieee=f"{i+1:016x}", lqi=100) for i in range(mqtt_count, count)]
    if radios:
        hass.data["zha"] = SimpleNamespace(gateway_proxy=SimpleNamespace(
            gateway=SimpleNamespace(devices={row.ieee: row for row in radios}, config_entry=zha_entry),
            config_entry=zha_entry))
    config["markers"] = [{"id": f"m{i}-{alias}", "binding": f"device:{row.id}"}
                         for i, row in enumerate(physical) for alias in range(3)]
    await save(entry, config)
    if mqtt_count:
        transport.emit("zigbee2mqtt/bridge/devices", [item for i in range(mqtt_count)
                       for item in inventory(i + 1, f"d{i}")])
        await until(lambda: coordinator._refresh_task is None)
        for i in range(mqtt_count):
            transport.emit(f"zigbee2mqtt/d{i}", {"linkquality": 100})
    coordinator.flush()
    assert len(coordinator.snapshot()["devices"]) == count
    consumers = [[] for _ in range(4)]
    releases = [coordinator.add_listener(rows.append) for rows in consumers]
    counters = {"registry_reads": 0, "scope_passes": 0, "full_projections": 0}

    def observe(owner, name, counter):
        original = getattr(owner, name)

        def counted(*args, **kwargs):
            counters[counter] += 1
            return original(*args, **kwargs)

        monkeypatch.setattr(owner, name, counted)

    observe(dr, "async_get", "registry_reads")
    observe(lqi_module, "represented_devices", "scope_passes")
    observe(coordinator, "_project", "full_projections")
    class SnapshotView(HomeAssistantView):
        url = "/api/lqi-1090"
        name = "api:lqi-1090"

        async def get(self, _request):
            return web.json_response(coordinator.snapshot())

    hass.http.register_view(SnapshotView())
    client = await hass_client()

    async def probe():
        started = perf_counter()
        response = await client.get("/api/lqi-1090")
        await response.read()
        assert response.status == 200
        return (perf_counter() - started) * 1000

    request = asyncio.create_task(probe())
    await asyncio.sleep(0)
    lag = hass.loop.create_future()
    started = perf_counter()
    hass.loop.call_soon(lambda: lag.set_result((perf_counter() - started) * 1000))
    if mqtt_count:
        for value in range(1000):
            transport.emit("zigbee2mqtt/d0", {"linkquality": value % 256})
    if radios:
        for value in range(10):
            radios[0].lqi = value
            await coordinator.async_refresh()
    elapsed = (perf_counter() - started) * 1000
    lag_ms, ttfb_ms = await lag, await request
    coordinator.flush()
    result = {"provider": provider, "radios": count, "markers": count * 3, "consumers": 4,
              "mqtt_messages": 1000 if mqtt_count else 0, "zha_cycles": 10 if radios else 0,
              "elapsed_ms": elapsed, "event_loop_lag_ms": lag_ms,
              "synthetic_http_ttfb_ms": ttfb_ms, **counters}
    print("LQI_PERFORMANCE " + json.dumps(result, sort_keys=True))
    assert all(len(rows) == 1 for rows in consumers), "one coalesced reset, not one per packet"
    rows = coordinator.snapshot()["devices"]
    if mqtt_count:
        assert rows[physical[0].id]["lqi"] == 999 % 256
        assert all(rows[physical[i].id]["lqi"] == 100 for i in range(1, mqtt_count))
    if radios:
        assert rows[physical[mqtt_count].id]["lqi"] == 9
    assert counters == {"registry_reads": 0, "scope_passes": 0, "full_projections": 0}
    before = coordinator.snapshot()
    if mqtt_count:
        for _ in range(20):
            transport.emit("zigbee2mqtt/d0", {"linkquality": 999 % 256})
    if radios:
        await coordinator.async_refresh()
    assert coordinator.snapshot() == before
    assert coordinator._emit_timer is None
    for release in releases:
        release()
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert not transport.listener_count and not coordinator.listeners


async def test_modern_registry_surface_never_uses_deprecated_mapping_or_entry_set(hass, transport, monkeypatch):
    entry, mqtt_entry, zha_entry, coordinator, config = await setup(hass)
    physical = [device(hass, mqtt_entry, 1), device(hass, zha_entry, 2)]
    config["markers"] = [{"id": row.id, "binding": f"device:{row.id}"} for row in physical]
    hass.data["zha"] = SimpleNamespace(gateway=SimpleNamespace(
        devices={"z": SimpleNamespace(ieee="0000000000000002", lqi=90)}, config_entry=zha_entry))
    await save(entry, config)
    registry = dr.async_get(hass)

    class Entry:
        def __init__(self, original):
            self.original = original

        def __getattr__(self, name):
            assert name != "config_entries", "ordinary modern device must use config_entry_id"
            return getattr(self.original, name)

    class Collection:
        def __iter__(self):
            return iter(Entry(row) for row in registry.devices.values())

        def __getattr__(self, name):
            raise AssertionError(f"deprecated devices.{name}")

        def __contains__(self, value):
            assert not isinstance(value, str), "deprecated membership by device id"
            return any(row.id == value.id for row in self)

    class Registry:
        devices = Collection()

        def async_get(self, device_id):
            row = registry.async_get(device_id)
            return Entry(row) if row is not None else None

        def __getattr__(self, name):
            return getattr(registry, name)

    monkeypatch.setattr(dr, "async_get", lambda _hass: Registry())
    await coordinator.async_config_saved(config)
    await until(lambda: coordinator._refresh_task is None)
    assert coordinator.snapshot()["devices"][physical[1].id]["lqi"] == 90
    transport.emit("zigbee2mqtt/bridge/devices", inventory())
    await until(lambda: bool(transport.callbacks.get("zigbee2mqtt/floor/room/sensor")))
    transport.emit("zigbee2mqtt/floor/room/sensor", {"linkquality": 80})
    assert {row["lqi"] for row in coordinator.snapshot()["devices"].values()} == {80, 90}


@pytest.mark.parametrize("change", ["disable", "remove", "entity-remove", "unrelated-device"])
async def test_registry_retirement_during_held_subscribe_cannot_republish_old_radio(
    hass, transport, monkeypatch, change,
):
    entry, mqtt_entry, _, coordinator, config = await setup(hass)
    first, second = device(hass, mqtt_entry, 1), device(hass, mqtt_entry, 2)
    unrelated = device(hass, mqtt_entry, 3)
    entity = er.async_get(hass).async_get_or_create("sensor", "mqtt", "owner",
        config_entry=mqtt_entry, device_id=first.id)
    config["markers"] = [{"id": "one", "binding": f"entity:{entity.entity_id}"},
                         {"id": "two", "binding": f"device:{second.id}"}]
    await save(entry, config)
    transport.emit("zigbee2mqtt/bridge/devices", inventory(1, "one"))
    await until(lambda: bool(transport.callbacks.get("zigbee2mqtt/one")))
    transport.emit("zigbee2mqtt/one", {"linkquality": 100})
    original = transport.subscribe
    gate, started = hass.loop.create_future(), hass.loop.create_future()

    async def held(hass, topic, callback, *, qos, encoding):
        if topic == "zigbee2mqtt/two":
            started.set_result(True)
            await asyncio.shield(gate)
        return await original(hass, topic, callback, qos=qos, encoding=encoding)

    monkeypatch.setattr(mqtt, "async_subscribe", held)
    transport.emit("zigbee2mqtt/bridge/devices", [*inventory(1, "one"), *inventory(2, "two")])
    await started
    try:
        if change == "disable":
            dr.async_get(hass).async_update_device(first.id, disabled_by=dr.DeviceEntryDisabler.USER)
        elif change == "remove":
            dr.async_get(hass).async_remove_device(first.id)
        elif change == "entity-remove":
            er.async_get(hass).async_remove(entity.entity_id)
        else:
            dr.async_get(hass).async_update_device(unrelated.id, disabled_by=dr.DeviceEntryDisabler.USER)
        await hass.async_block_till_done()
        transport.emit("zigbee2mqtt/one", {"linkquality": 255})
        if change == "unrelated-device":
            assert coordinator.snapshot()["devices"][first.id]["lqi"] == 100, "pending identity proof cannot publish a new reading"
        else:
            assert first.id not in coordinator.snapshot()["devices"], "revoked scope must retire before a slow subscription returns"
    finally:
        gate.set_result(True)
        await until(lambda: coordinator._refresh_task is None)
    if change == "unrelated-device":
        assert coordinator.snapshot()["devices"][first.id]["lqi"] == 255, "the valid update received while dirty must not be lost"
    else:
        transport.emit("zigbee2mqtt/one", {"linkquality": 255})
        assert first.id not in coordinator.snapshot()["devices"]
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert not transport.listener_count


async def test_zha_loss_reload_and_membership_preserve_independent_z2m(hass, transport):
    entry, mqtt_entry, zha_entry, coordinator, config = await setup(hass)
    mqtt_row, zha_row, added = device(hass, mqtt_entry, 1), device(hass, zha_entry, 2), device(hass, zha_entry, 3)
    radio = SimpleNamespace(ieee="0000000000000002", lqi=80)
    gateway = SimpleNamespace(devices={radio.ieee: radio}, config_entry=zha_entry)
    hass.data["zha"] = SimpleNamespace(gateway=gateway)
    config["markers"] = [{"id": row.id, "binding": f"device:{row.id}"} for row in (mqtt_row, zha_row, added)]
    await save(entry, config)
    transport.emit("zigbee2mqtt/bridge/devices", inventory(1, "mqtt"))
    await until(lambda: bool(transport.callbacks.get("zigbee2mqtt/mqtt")))
    transport.emit("zigbee2mqtt/mqtt", {"linkquality": 50})
    first = coordinator.snapshot()["devices"]
    hass.data.pop("zha")
    await coordinator._tick()
    await until(lambda: coordinator._refresh_task is None)
    lost = coordinator.snapshot()["devices"]
    assert lost[zha_row.id] == {**first[zha_row.id], "available": False}
    assert lost[mqtt_row.id] == first[mqtt_row.id]
    radio.lqi = None
    gateway = SimpleNamespace(devices={radio.ieee: radio}, config_entry=zha_entry)
    hass.data["zha"] = SimpleNamespace(gateway_proxy=SimpleNamespace(gateway=gateway, config_entry=zha_entry))
    await coordinator._tick()
    await until(lambda: coordinator._refresh_task is None)
    assert coordinator.snapshot()["devices"] == {mqtt_row.id: first[mqtt_row.id]}
    newcomer = SimpleNamespace(ieee="0000000000000003", lqi=0)
    gateway.devices = {newcomer.ieee: newcomer}
    await coordinator._tick()
    await until(lambda: coordinator._refresh_task is None)
    rows = coordinator.snapshot()["devices"]
    assert set(rows) == {mqtt_row.id, added.id} and rows[added.id]["lqi"] == 0
    assert rows[mqtt_row.id] == first[mqtt_row.id]


async def test_zha_config_entry_disable_invalidates_cached_provider(hass, transport, monkeypatch):
    entry, _, zha_entry, coordinator, config = await setup(hass)
    physical = device(hass, zha_entry, 1)
    radio = SimpleNamespace(ieee="0000000000000001", lqi=80)
    hass.data["zha"] = SimpleNamespace(gateway=SimpleNamespace(
        devices={radio.ieee: radio}, config_entry=zha_entry))
    config["markers"] = [{"id": "zha", "binding": f"device:{physical.id}"}]
    await save(entry, config)
    first = coordinator.snapshot()["devices"][physical.id]
    assert first["available"] is True
    radio.lqi = 70
    hass.config_entries.async_update_entry(zha_entry, title="Renamed ZHA")
    await hass.async_block_till_done()
    await until(lambda: coordinator._refresh_task is None)
    assert coordinator.snapshot()["devices"][physical.id]["lqi"] == 70

    async def reload_fake_provider(entry_id):
        assert entry_id == zha_entry.entry_id
        return True

    # Keep the radio fake; native HA still changes entry/device authority.
    monkeypatch.setattr(hass.config_entries, "async_reload", reload_fake_provider)
    await hass.config_entries.async_set_disabled_by(zha_entry.entry_id, ConfigEntryDisabler.USER)
    await hass.async_block_till_done()
    await until(lambda: coordinator._refresh_task is None)
    assert physical.id not in coordinator.snapshot()["devices"]
