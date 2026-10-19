"""#939 real HA image API, recorder/store and exact-source lifetime fences."""
from __future__ import annotations

import asyncio
import copy
import json
import logging
from types import SimpleNamespace

import pytest
from homeassistant.components.image import ImageEntity, DATA_COMPONENT
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.entity_component import EntityComponent
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan import vacuum_ecovacs_reader as module
from custom_components.houseplan.trails import TrailRecorder
from custom_components.houseplan.vacuum_ecovacs import decode_ecovacs_svg, EcovacsRejected
from ecovacs_fixtures import svg


@pytest.fixture(autouse=True)
def custom_integrations(enable_custom_integrations):
    yield


class Clock:
    def __init__(self):
        self.now = 0.0
        self.timers = []

    def schedule(self, _hass, delay, callback):
        entry = [self.now + delay, callback, True]
        self.timers.append(entry)
        return lambda: entry.__setitem__(2, False)

    def tick(self, seconds=0):
        self.now += seconds
        for entry in list(self.timers):
            if entry[2] and entry[0] <= self.now:
                entry[2] = False
                entry[1](None)


async def settle(predicate):
    for _ in range(300):
        if predicate():
            return
        await asyncio.sleep(.001)
    assert predicate(), "Ecovacs read did not settle"


def register(hass):
    entry = MockConfigEntry(domain="ecovacs", title="Synthetic robot")
    entry.add_to_hass(hass)
    registry = er.async_get(hass)
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id, identifiers={("ecovacs", "robot939")})
    for domain, name in (("vacuum", "robot"), ("image", "map")):
        registry.async_get_or_create(domain, "ecovacs", "939-" + name,
            suggested_object_id=name, device_id=device.id, config_entry=entry)
    hass.states.async_set("image.map", "ready", {"map_name": "floor"})
    hass.states.async_set("vacuum.robot", "cleaning")
    return registry


async def test_public_image_api_reads_svg_not_camera_or_self_http(hass):
    class MapImage(ImageEntity):
        _attr_name = "Map"
        _attr_content_type = "image/svg+xml"

        def __init__(self):
            super().__init__(hass)
            self.calls = 0

        async def async_image(self):
            self.calls += 1
            return svg()

    component = EntityComponent(logging.getLogger(__name__), "image", hass)
    hass.data[DATA_COMPONENT] = component
    image = MapImage()
    await component.async_add_entities([image])
    reader = module.EcovacsReader(hass, lambda _: None)
    value = await reader._read(image.entity_id)
    assert image.calls == 1 and value.position == {"x": 3, "y": -4}
    assert value.paths[1] == [[6, -7], [5, -6]]
    image._attr_content_type = "image/png"
    with pytest.raises(EcovacsRejected, match="unsupported"):
        await reader._read(image.entity_id)
    reader.close()


async def test_registry_pairing_and_automatic_choice_never_adopt_another_robot(hass):
    registry = register(hass)
    assert module.ecovacs_pair(hass, "image.map", "vacuum.robot")
    assert module.automatic_ecovacs_source(hass, "vacuum.robot") == "image.map"
    assert not module.ecovacs_pair(hass, "camera.map", "vacuum.robot")
    assert not module.ecovacs_pair(hass, "image.map", "vacuum.other")
    registry.async_update_entity("image.map", disabled_by=er.RegistryEntryDisabler.USER)
    assert not module.ecovacs_pair(hass, "image.map", "vacuum.robot")
    assert module.automatic_ecovacs_source(hass, "vacuum.robot") is None


async def test_coalescing_native_gaps_poll_and_final_schedule_one_source_two_markers(hass, monkeypatch):
    register(hass)
    clock, calls, accepted = Clock(), [], []
    monkeypatch.setattr(module, "async_call_later", clock.schedule)

    async def read(source):
        calls.append((clock.now, source))
        return decode_ecovacs_svg(svg())

    reader = module.EcovacsReader(hass, accepted.append, read, lambda: clock.now)
    reader.refresh({"image.map": [("a", "vacuum.robot"), ("b", "vacuum.robot"), ("wrong", "vacuum.other")]})
    clock.tick()
    await settle(lambda: len(accepted) == 1)
    for _ in range(100):
        reader.observe("image.map")
    clock.tick(1)
    assert len(calls) == 1
    clock.tick(1)
    await settle(lambda: len(accepted) == 2)
    clock.tick(10)
    await settle(lambda: len(accepted) == 3)
    hass.states.async_set("vacuum.robot", "docked")
    reader.observe("image.map")
    clock.tick(2)
    await settle(lambda: len(accepted) == 4)
    clock.tick(13)
    await settle(lambda: len(accepted) == 5)
    clock.tick(30)
    await settle(lambda: len(accepted) == 6)
    clock.tick(500)
    assert [at for at, _ in calls] == [0, 2, 12, 14, 27, 57]
    assert reader.telemetry("image.map")["path"][1] == [[6, -7], [5, -6]]
    public = json.dumps(reader.public())
    assert "png" not in public and "access_token" not in public and "svg" not in public
    assert reader.preview("image.map")["image"].startswith("data:image/png;base64,")
    reader.close()


async def test_map_switch_during_read_and_unavailable_clear_current_not_saved_geometry(hass, monkeypatch):
    register(hass)
    clock, accepted = Clock(), []
    monkeypatch.setattr(module, "async_call_later", clock.schedule)
    pending = asyncio.get_running_loop().create_future()
    calls = []

    async def read(_source):
        calls.append(clock.now)
        return await pending if len(calls) == 1 else decode_ecovacs_svg(svg(position="10 20"))

    reader = module.EcovacsReader(hass, accepted.append, read, lambda: clock.now)
    reader.refresh({"image.map": [("a", "vacuum.robot")]})
    clock.tick()
    await settle(lambda: len(calls) == 1)
    hass.states.async_set("image.map", "ready", {"map_name": "other"})
    reader.observe("image.map")
    pending.set_result(decode_ecovacs_svg(svg()))
    await settle(lambda: reader.sources["image.map"].task is None)
    assert not accepted and reader.telemetry("image.map") is None
    clock.tick(2)
    await settle(lambda: len(accepted) == 1)
    assert reader.telemetry("image.map")["map_name"] == "other"
    assert reader.telemetry("image.map")["vacuum_position"] == {"x": 10, "y": 20}
    hass.states.async_set("image.map", "unavailable", {"map_name": "other"})
    reader.observe("image.map")
    assert reader.public()["image.map"]["position"] is None
    with pytest.raises(EcovacsRejected):
        reader.preview("image.map")
    reader.close()


async def test_read_error_keeps_last_native_value_and_backoff(hass, monkeypatch):
    register(hass)
    clock, calls, accepted = Clock(), [], []
    monkeypatch.setattr(module, "async_call_later", clock.schedule)

    async def read(_source):
        calls.append(clock.now)
        if len(calls) > 1:
            raise EcovacsRejected("unsupported")
        return decode_ecovacs_svg(svg())

    reader = module.EcovacsReader(hass, accepted.append, read, lambda: clock.now)
    reader.refresh({"image.map": [("a", "vacuum.robot")]})
    clock.tick()
    await settle(lambda: len(accepted) == 1)
    original = reader.sources["image.map"].value
    for wait in (10, 30, 60, 120, 300):
        clock.tick(wait)
        await settle(lambda: reader.sources["image.map"].task is None)
    assert calls == [0, 10, 40, 100, 220, 520]
    assert reader.sources["image.map"].value is original
    assert reader.telemetry("image.map") is None
    assert reader.public()["image.map"]["reason"] == "unsupported"
    reader.close()


async def test_real_timeout_reload_never_overlaps_or_publishes_retired_read(hass, monkeypatch):
    register(hass)
    clock, calls, old_values, new_values = Clock(), [], [], []
    monkeypatch.setattr(module, "async_call_later", clock.schedule)
    pending = asyncio.get_running_loop().create_future()

    async def read(_source):
        calls.append(clock.now)
        return await pending if len(calls) == 1 else decode_ecovacs_svg(svg(position="10 20"))

    old = module.EcovacsReader(hass, lambda s: old_values.append(old.telemetry(s)), read, lambda: clock.now)
    old.refresh({"image.map": [("a", "vacuum.robot")]})
    clock.tick()
    await settle(lambda: len(calls) == 1)
    # Exercise the shipped ten-second timeout, never a temporary changed guard.
    await asyncio.sleep(10.05)
    assert old.sources["image.map"].reason == "stale" and not pending.cancelled()
    old.close()
    new = module.EcovacsReader(hass, lambda s: new_values.append(new.telemetry(s)), read, lambda: clock.now)
    new.refresh({"image.map": [("b", "vacuum.robot")]})
    clock.tick(30)
    await asyncio.sleep(.01)
    assert len(calls) == 1 and not new_values
    pending.set_result(decode_ecovacs_svg(svg()))
    await settle(lambda: len(calls) == 2 and bool(new_values))
    assert not any(old_values)
    assert new_values[0]["vacuum_position"] == {"x": 10, "y": 20}
    new.close()


async def test_preview_ws_real_writer_acl_source_pin_and_no_png_in_view(hass, hass_ws_client, monkeypatch):
    from homeassistant.auth.const import GROUP_ID_READ_ONLY
    from custom_components.houseplan.const import DOMAIN, CONF_ADMIN_ONLY
    from custom_components.houseplan.store import get_data

    register(hass)
    clock = Clock()
    monkeypatch.setattr(module, "async_call_later", clock.schedule)
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={CONF_ADMIN_ONLY: False})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    rt = get_data(hass)
    marker = {"id": "m", "binding": "entity:vacuum.robot", "space": "floor",
              "vacuum": {"source": "image.map"}}
    await rt.config_store.async_save({"config": {"spaces": [{"id": "floor"}], "markers": [marker]}})
    recorder = hass.data[DOMAIN]["trail_recorder"]
    recorder.ecovacs.clock = lambda: clock.now

    async def read(_source):
        return decode_ecovacs_svg(svg())

    recorder.ecovacs.read = read
    await recorder.async_refresh()
    clock.tick()
    await settle(lambda: recorder.ecovacs.telemetry("image.map") is not None)
    owner = await hass_ws_client(hass)
    request = {"type": "houseplan/vacuum/map_preview", "marker_id": "m", "source": "image.map", "map_id": "floor"}
    await owner.send_json_auto_id(request)
    result = await owner.receive_json()
    assert result["success"] and result["result"]["image"].startswith("data:image/png;base64,")
    user = await hass.auth.async_create_user("Read only", group_ids=[GROUP_ID_READ_ONLY])
    refresh = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    viewer = await hass_ws_client(hass, access_token=hass.auth.async_create_access_token(refresh))
    await viewer.send_json_auto_id(request)
    denied = await viewer.receive_json()
    assert not denied["success"] and denied["error"]["code"] == "unauthorized"
    await viewer.send_json_auto_id({"type": "houseplan/trail/get"})
    ordinary = (await viewer.receive_json())["result"]
    assert ordinary["vacuum_source_format"] == 1
    assert ordinary["vacuum_sources"]["image.map"]["position"] == {"x": 3, "y": -4}
    assert "data:image" not in json.dumps(ordinary) and "<svg" not in json.dumps(ordinary)
    for patch in ({"source": "image.other"}, {"map_id": "other"}, {"marker_id": "deleted"}):
        await owner.send_json_auto_id({**request, **patch})
        assert not (await owner.receive_json())["success"]
    marker["vacuum"]["live"] = False
    await rt.config_store.async_save({"config": {"spaces": [{"id": "floor"}], "markers": [marker]}})
    await owner.send_json_auto_id(request)
    assert not (await owner.receive_json())["success"]
    assert await hass.config_entries.async_unload(entry.entry_id)


async def test_recorder_records_without_clients_empty_replaces_and_survives_store_restart(hass, monkeypatch):
    register(hass)
    clock = Clock()
    monkeypatch.setattr(module, "async_call_later", clock.schedule)
    marker = {"id": "m", "binding": "entity:vacuum.robot", "space": "floor", "vacuum": {
        "source": "image.map", "map_routes": [{"id": "route", "source": "image.map",
            "map_id": "floor", "space": "floor", "calibration": [1, 0, 0, 0, 1, 0]}]}}

    class Config:
        async def async_load(self):
            return {"config": {"spaces": [{"id": "floor", "cell_cm": 5}], "markers": [marker]}}

    runtime = SimpleNamespace(config_store=Config())
    recorder = TrailRecorder(hass, runtime)
    recorder.ecovacs.clock = lambda: clock.now
    current = [svg()]

    async def read(_source):
        return decode_ecovacs_svg(current[0])

    recorder.ecovacs.read = read
    await recorder.async_setup()
    clock.tick()
    await settle(lambda: bool(recorder.book.data.get("m", {}).get("current", {}).get("paths")))
    expected = [[[2, -4], [3, -3], [4, -3], [4, -5]], [[6, -7], [5, -6]]]
    await settle(lambda: recorder.book.data["m"]["current"]["paths"] == expected)
    original = copy.deepcopy(recorder.book.data)
    clock.tick(10)
    await settle(lambda: recorder.ecovacs.sources["image.map"].task is None)
    assert recorder.book.data["m"]["current"]["_generation"] == original["m"]["current"]["_generation"]
    assert recorder.book.data["m"]["current"]["paths"] == expected
    assert recorder.book.data["m"].get("previous") == original["m"].get("previous")
    await recorder.async_teardown()
    stored = await recorder.store.async_load()
    assert stored["m"]["current"]["paths"] == expected
    assert "png" not in json.dumps(stored) and "<svg" not in json.dumps(stored)
    restarted = TrailRecorder(hass, runtime)
    restarted.ecovacs.clock = lambda: clock.now
    restarted.ecovacs.read = read
    await restarted.async_setup()
    clock.tick(2)
    await settle(lambda: restarted.ecovacs.sources["image.map"].value is not None)
    assert restarted.book.data["m"]["current"]["paths"] == expected
    current[0] = svg(None)
    clock.tick(10)
    await settle(lambda: restarted.book.data["m"]["current"]["paths"] == [])
    await restarted.async_teardown()
