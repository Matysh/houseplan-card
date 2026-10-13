"""#872 real HA API/executor/store owners, offline deterministic providers."""
from __future__ import annotations

import asyncio
import copy
import json
from dataclasses import replace
from types import SimpleNamespace

import pytest
from homeassistant.components.camera import Camera
from homeassistant.components.camera.const import DATA_COMPONENT
from homeassistant.helpers.entity_component import EntityComponent

from custom_components.houseplan import vacuum_path_collector as module
from custom_components.houseplan.trails import TrailBook, TrailRecorder
from custom_components.houseplan.vacuum_paths import snapshot


@pytest.fixture(autouse=True)
def custom_integrations(enable_custom_integrations):
    yield


async def settle(predicate):
    for _ in range(200):
        if predicate():
            return
        await asyncio.sleep(0.001)
    assert predicate(), "background provider did not settle"


class Clock:
    def __init__(self):
        self.now = 0.0
        self.timers = []

    def schedule(self, _hass, delay, callback):
        entry = [self.now + delay, callback, True]
        self.timers.append(entry)
        return lambda: entry.__setitem__(2, False)

    def tick(self, seconds):
        self.now += seconds
        for entry in list(self.timers):
            if entry[2] and entry[0] <= self.now:
                entry[2] = False
                entry[1](None)


def context(**patch):
    original = module.PathContext("camera.map", "vacuum.robot", "floor",
                                  (("m", "route", "generation"),), True, True, "dreame_vacuum")
    return replace(original, **patch)


def payload(path=None, **fields):
    return json.dumps({"version": 2, "map_id": 1, "saved_map_id": 36,
                       "map_index": 1, "frame_id": 1,
                       "path": path if path is not None else [[1, 0, 0, 100, 0]], **fields})


async def test_public_camera_bridge_only_exact_current_camera_and_no_resources(hass):
    import logging

    class MapCamera(Camera):
        _attr_name = "Map"
        map_index = 0
        def __init__(self):
            super().__init__()
            self.calls = []

        async def map_data_string(self, *, include_resources):
            self.calls.append(include_resources)
            return payload()

    component = EntityComponent(logging.getLogger(__name__), "camera", hass)
    hass.data[DATA_COMPONENT] = component
    camera = MapCamera()
    await component.async_add_entities([camera])
    collector = module.PathCollector(hass, lambda *_: None, lambda *_: None)
    assert await collector._read_camera(camera.entity_id) == payload()
    assert camera.calls == [False]
    camera.map_index = 1
    with pytest.raises(module.PathRejected, match="unsupported"):
        await collector._read_camera(camera.entity_id)
    assert camera.calls == [False]
    collector.close()


async def test_reset_proof_min_interval_active_poll_and_three_final_attempts(hass, monkeypatch):
    clock, calls, accepted = Clock(), [], []
    monkeypatch.setattr(module, "async_call_later", clock.schedule)
    async def read(_source):
        calls.append(clock.now)
        return payload([]) if len(calls) == 1 else payload(frame_id=len(calls))
    collector = module.PathCollector(hass, lambda *x: accepted.append(x), lambda *_: None,
                                     read, lambda: clock.now)
    collector.refresh([context()])
    clock.tick(0)
    await settle(lambda: len(calls) == 1 and collector.leases[("camera.map", "vacuum.robot")].task is None)
    for _ in range(100):
        collector.observe(context())
    clock.tick(9)
    assert calls == [0]
    clock.tick(1)
    await settle(lambda: len(accepted) == 1)
    assert accepted[0][2] is True
    clock.tick(30)
    await settle(lambda: len(calls) == 3 and len(accepted) == 2)
    collector.observe(context(moving=False))
    clock.tick(10)
    await settle(lambda: len(calls) == 4 and len(accepted) == 3)
    clock.tick(10)
    await settle(lambda: len(calls) == 5 and len(accepted) == 4)
    clock.tick(25)
    await settle(lambda: len(calls) == 6 and len(accepted) == 5)
    clock.tick(500)
    assert calls == [0, 10, 40, 50, 60, 85]
    assert all(b - a >= 10 for a, b in zip(calls, calls[1:]))
    assert not any(value.final for _, value, _ in accepted)
    collector.close()


async def test_timeout_keeps_physical_lease_across_reload_and_discards_old_owner(hass, monkeypatch):
    clock, calls, old_accept, new_accept = Clock(), [], [], []
    monkeypatch.setattr(module, "async_call_later", clock.schedule)
    monkeypatch.setattr(module, "TIMEOUT_S", 0.01)
    pending = asyncio.get_running_loop().create_future()
    async def read(_source):
        calls.append(clock.now)
        return await pending if len(calls) == 1 else payload()
    old = module.PathCollector(hass, lambda *x: old_accept.append(x), lambda *_: None,
                               read, lambda: clock.now)
    old.refresh([context()])
    clock.tick(0)
    await settle(lambda: len(calls) == 1)
    await asyncio.sleep(0.02)
    old.close()
    new = module.PathCollector(hass, lambda *x: new_accept.append(x), lambda *_: None,
                               read, lambda: clock.now)
    new.refresh([context(markers=(("m", "route", "next-generation"),))])
    clock.tick(30)
    await asyncio.sleep(0.02)
    assert len(calls) == 1, "wrapper timeout/unload must not free an underlying camera operation"
    pending.set_result(payload())
    await settle(lambda: len(calls) == 2 and len(new_accept) == 1)
    assert not old_accept
    assert new_accept[0][0].markers[0][2] == "next-generation"
    assert new_accept[0][2] is False
    new.close()


async def test_attribute_provider_gaps_reset_and_unavailable_late_result(hass, monkeypatch):
    clock, accepted = Clock(), []
    monkeypatch.setattr(module, "async_call_later", clock.schedule)
    collector = module.PathCollector(hass, lambda *x: accepted.append(x), lambda *_: None,
                                     clock=lambda: clock.now)
    current = context(platform="xiaomi_cloud_map_extractor")
    collector.observe(current, attribute_path=[])
    await settle(lambda: collector.leases[(current.source, current.vacuum)].task is None)
    collector.observe(current, attribute_path={"path": [[0, 0], [1, 1], [True, 0], [10, 10], [11, 11]]})
    await settle(lambda: len(accepted) == 1)
    assert accepted[0][1].paths == [[[0, 0], [1, 1]], [[10, 10], [11, 11]]]
    assert accepted[0][2] is True
    collector.observe(current, attribute_path=[[0, 0], [2, 2]])
    collector.observe(replace(current, available=False))
    await settle(lambda: collector.leases[(current.source, current.vacuum)].task is None)
    assert len(accepted) == 1
    collector.close()


def test_full_snapshot_book_lifecycle_budget_restart_and_private_projection():
    from custom_components.houseplan.vacuum_paths import public_trails
    book = TrailBook()
    run, _ = book.ensure_run("m", "floor", 1, "route", "camera.map")
    generation = run["_generation"]
    value = snapshot("dreame", "tasshack-2.0.2", [[[0, 0], [100, 0]], [[100, 10], [0, 10]]], "map", 1)
    assert book.on_snapshot("m", value, 2, "route", "floor", generation, False)
    assert run["quality"]["reason"] == "run_unverified" and run["paths"] == []
    assert book.on_snapshot("m", value, 2, "route", "floor", generation, True)
    assert run["points"] == [[100, 10], [0, 10]]
    assert not book.on_snapshot("m", value, 3, "route", "floor", generation, True)
    book.on_point("m", "floor", 999, 999, 4, "route", "camera.map")
    assert run["paths"] == value.paths, "sampled reserve must never mutate the native endpoint"
    assert run["points"] == value.paths[-1], "downgrade retains a native contiguous fragment"
    assert book.path_reason("m", "stale")
    public = public_trails(book.data)
    assert public["m"]["current"]["quality"]["source"] == "native"
    assert "camera.map" not in json.dumps(public) and "_generation" not in json.dumps(public)
    restarted = TrailBook(copy.deepcopy(book.data))
    fresher = snapshot("dreame", "tasshack-2.0.2", [[[0, 0], [200, 0]]], "map", 2)
    assert restarted.on_snapshot("m", fresher, 5, "route", "floor", generation, False)
    restarted.end_run("m", 6)
    new, resumed = restarted.ensure_run("m", "floor", 7, "route", "camera.map")
    assert resumed and new["_generation"] == generation
    restarted.end_run("m", 8)
    new, _ = restarted.ensure_run("m", "floor", 1810, "route", "camera.map")
    assert not restarted.on_snapshot("m", fresher, 1811, "route", "floor", generation, True)
    assert new["paths"] == []
    restarted.delete("m")
    assert not restarted.on_snapshot("m", fresher, 1812, "route", "floor", new["_generation"], True)
    assert not restarted._counts


def test_restart_sampled_run_retains_history_without_an_unobserved_connector():
    book = TrailBook()
    book.on_point("m", "floor", 0, 0, 1)
    book.on_point("m", "floor", 1, 1, 2)
    restored = TrailBook(json.loads(json.dumps(book.data)))
    restored.on_point("m", "floor", 100, 100, 3)
    restored.on_point("m", "floor", 101, 101, 4)
    assert restored.data["m"]["current"]["paths"] == [[[0, 0], [1, 1]], [[100, 100], [101, 101]]]
    assert "previous" not in restored.data["m"]


def test_snapshot_wrong_map_revision_and_corrupt_run_are_isolated(monkeypatch):
    book = TrailBook({"broken": {"current": "bad"}, "future": {"current": {
        "path_format": 99, "opaque": {"x": "retain"}}}})
    future = copy.deepcopy(book.data["future"])
    assert not book.on_point("future", "floor", 1, 1, 1)
    assert not book.end_run("future", 2)
    assert book.data["future"] == future
    run, _ = book.ensure_run("m", "floor", 1, "route")
    generation = run["_generation"]
    first = snapshot("dreame", "v2", [[[0, 0], [1, 1]]], "floor-a", 10)
    assert book.on_snapshot("m", first, 2, "route", "floor", generation, True)
    old = snapshot("dreame", "v2", [[[0, 0], [10, 10]]], "floor-a", 9)
    assert not book.on_snapshot("m", old, 3, "route", "floor", generation, True)
    foreign = snapshot("dreame", "v2", [[[0, 0], [20, 20]]], "floor-b", 11)
    assert book.on_snapshot("m", foreign, 4, "route", "floor", generation, True)
    assert run["paths"] == first.paths and run["quality"]["reason"] == "coordinates_unverified"
    assert book.on_snapshot("m", first, 5, "route", "floor", generation, True)
    assert run["quality"]["reason"] == "ok", "identical geometry still recovers a stale reason"
    from custom_components.houseplan import trails
    monkeypatch.setattr(trails, "MAX_ENTRY_BYTES", 1)
    assert book.on_snapshot("m", snapshot("dreame", "v2", [[[0, 0], [2, 2]]], "floor-a", 12),
                            6, "route", "floor", generation, True)
    assert run["paths"] == first.paths and run["quality"]["reason"] == "limited"


def test_corrupt_physical_reserve_is_a_gap_not_a_store_or_event_failure():
    for last_sample in (["broken", 1, "time"], [float("nan"), 1, 1], [True, 1, 1]):
        book = TrailBook({"m": {"current": {"map_id": "floor", "started": 1,
            "ended": None, "path_format": 2, "paths": [[[0, 0], [1, 1]]],
            "_last_sample": last_sample}}})
        assert book.on_point("m", "floor", 2, 2, 2, physical_cm=(2, 2))
        assert book.data["m"]["current"]["paths"] == [[[0, 0], [1, 1]], [[2, 2]]]
        assert book.on_point("m", "floor", 3, 3, 3, physical_cm=(float("inf"), 3))
        assert "_last_sample" not in book.data["m"]["current"]
        json.dumps(book.data, allow_nan=False)


def test_four_dense_native_runs_fit_entry_quota_and_do_not_gain_sampled_connectors():
    book = TrailBook()
    geometry = [[[i % 2, i] for i in range(100000)]]
    value = snapshot("dreame", "v2", geometry, "map", 1)
    for index in range(4):
        marker = f"m{index}"
        run, _ = book.ensure_run(marker, "floor", 1, "route-" + marker)
        assert book.on_snapshot(marker, value, 2, "route-" + marker, "floor", run["_generation"], True)
        assert run["quality"]["source"] == "native"
        book.on_point(marker, "floor", 999999, 999999, 3, "route-" + marker)
        assert run["paths"] == geometry
    assert book._entry_bytes() < 64 * 1024 * 1024
    assert len(json.dumps(book.data).encode()) < 64 * 1024 * 1024
    for index in range(4):
        book.delete(f"m{index}")
    assert not book._counts


def test_future_format_is_preserved_but_its_exact_bytes_consume_entry_quota(monkeypatch):
    from custom_components.houseplan import trails
    future = {"current": {"path_format": 99, "opaque": "x" * 20000}}
    book = TrailBook({"future": copy.deepcopy(future)})
    monkeypatch.setattr(trails, "MAX_ENTRY_BYTES", 10000)
    assert book._entry_bytes() >= 20000
    book.on_point("m", "floor", 1, 1, 1)
    assert book.data["m"]["current"]["quality"]["reason"] == "limited"
    assert book.data["m"]["current"]["paths"] == [[]]
    assert book.data["future"] == future
    book.delete("future")
    assert not book._opaque_sizes


async def test_physical_projection_overflow_is_not_persisted(hass):
    recorder = TrailRecorder(hass, SimpleNamespace())
    route = {"id": "r", "space": "floor", "calibration": [2, 0, 0, 0, 2, 0]}
    recorder.routes_by_marker = {"m": [route]}
    recorder._spaces = {"floor": {"cell_cm": 5}}
    assert recorder._physical_point("m", "r", 10, 10) == (24, 24)
    assert recorder._physical_point("m", "r", 1e308, 1e308) is None
    route["calibration"] = [1e308, 0, 0, 0, 1e308, 0]
    assert recorder._physical_point("m", "r", 0, 0) is None
    await recorder.async_teardown()


async def test_recorder_native_without_position_fanout_store_and_stale_delete(hass):
    from homeassistant.helpers import entity_registry as er
    registry = er.async_get(hass)
    registry.async_get_or_create("camera", "dreame_vacuum", "map", suggested_object_id="map")
    hass.states.async_set("camera.map", "idle", {"map_name": "floor"})
    hass.states.async_set("vacuum.robot", "cleaning")
    class Config:
        async def async_load(self):
            return {"config": {"spaces": [{"id": "floor", "cell_cm": 5}], "markers": [
                {"id": marker, "binding": "entity:vacuum.robot", "space": "floor", "vacuum": {
                    "source": "camera.map", "map_routes": [{"id": "route-" + marker,
                        "source": "camera.map", "map_id": "floor", "space": "floor",
                        "calibration": [1, 0, 0, 0, 1, 0]}]}}
                for marker in ("a", "b")]}}
    recorder = TrailRecorder(hass, SimpleNamespace(config_store=Config()))
    # Use generic attributes in this recorder test; camera bridge is witnessed
    # above against HA's actual EntityComponent/public helper.
    recorder.collector.read_camera = lambda _: None
    await recorder.async_setup()
    contexts = recorder._path_contexts()
    assert len(contexts) == 1 and len(contexts[0].markers) == 2
    ctx = contexts[0]
    value = snapshot("dreame", "tasshack-2.0.2", [[[0, 0], [100, 100]]], "provider-map")
    recorder._accept_path(ctx, value, True)
    assert all(recorder.book.data[m]["current"]["paths"] == value.paths for m in ("a", "b"))
    # Saved route id can survive a target/calibration edit. The old read
    # context must not acquire the new target just because its id is equal.
    recorder.routes_by_marker["a"][0]["calibration"] = [2, 0, 0, 0, 2, 0]
    assert recorder._path_contexts()[0].identity != ctx.identity
    recorder._accept_path(ctx, snapshot("dreame", "tasshack-2.0.2", [[[0, 0], [999, 999]]], "provider-map"), True)
    assert all(recorder.book.data[m]["current"]["paths"] == value.paths for m in ("a", "b"))
    await recorder.async_delete("a")
    recorder._accept_path(ctx, snapshot("dreame", "tasshack-2.0.2", [[[0, 0], [200, 200]]], "provider-map"), True)
    assert "a" not in recorder.book.data
    await recorder.async_teardown()
    stored = await recorder.store.async_load()
    assert "a" not in stored and stored["b"]["current"]["paths"] == value.paths
