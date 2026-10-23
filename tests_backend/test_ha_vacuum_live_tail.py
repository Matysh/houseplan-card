"""#1049: real HA registry/subscriptions/Store and controlled shared reads."""
from __future__ import annotations

import asyncio
import json
from dataclasses import replace
from types import SimpleNamespace

import pytest
from homeassistant.helpers import entity_registry as er

from custom_components.houseplan import vacuum_path_collector as collector_module
from custom_components.houseplan.trails import TrailBook, TrailRecorder
from custom_components.houseplan.vacuum_paths import dreame_snapshot, public_trails


@pytest.fixture(autouse=True)
def custom_integrations(enable_custom_integrations):
    yield


def payload(path=None):
    return json.dumps({"version": 2, "map_id": 1, "saved_map_id": 36, "map_index": 1,
                       "frame_id": 1, "path": [[1, 0, 0, 100, 0]] if path is None else path})


def activity(started=False, **extra):
    return {"started": started, **dict.fromkeys(("paused", "cleaning_paused", "washing", "washing_paused",
            "returning_to_wash", "returning_to_wash_paused"), False), **extra}


async def settle(predicate):
    for _ in range(200):
        if predicate():
            return
        await asyncio.sleep(.001)
    assert predicate()


async def test_proven_start_clears_cached_native_and_store_preserves_consumed_proof(hass, monkeypatch):
    timers = []
    clock = 100.0

    def schedule(_hass, delay, callback):
        item = [clock + delay, callback, True]
        timers.append(item)
        return lambda: item.__setitem__(2, False)

    def tick(seconds):
        nonlocal clock
        clock += seconds
        for item in list(timers):
            if item[2] and item[0] <= clock:
                item[2] = False
                item[1](None)

    monkeypatch.setattr(collector_module, "async_call_later", schedule)
    registry = er.async_get(hass)
    for domain, name in (("camera", "live1049"), ("vacuum", "robot1049")):
        registry.async_get_or_create(domain, "dreame_vacuum", name, suggested_object_id=name)
    hass.states.async_set("vacuum.robot1049", "docked", activity())
    hass.states.async_set("camera.live1049", "idle", {"map_name": "floor", "robot_position": {"x": 100, "y": 0}})
    config = {"spaces": [{"id": "floor", "cell_cm": 1}], "markers": [{"id": "m",
        "binding": "entity:vacuum.robot1049", "space": "floor", "vacuum": {"source": "camera.live1049",
        "map_routes": [{"id": "route", "source": "camera.live1049", "map_id": "floor", "space": "floor",
                        "calibration": [1, 0, 0, 0, 1, 0]}]}}]}

    class Config:
        async def async_load(self):
            return {"config": config}

    book = TrailBook()
    old, _ = book.ensure_run("m", "floor", 1, "route", "camera.live1049")
    old_value = dreame_snapshot(payload())
    book.on_snapshot("m", old_value, 2, "route", "floor", old["_generation"], True)
    book.end_run("m", 3)
    rec = TrailRecorder(hass, SimpleNamespace(config_store=Config()))
    await rec.store.async_save(book.data)
    calls, replies = [], []

    async def read(source):
        calls.append((source, clock))
        future = asyncio.get_running_loop().create_future()
        replies.append(future)
        return await future

    rec.collector.clock = lambda: clock
    rec.collector.has_camera_channel = lambda _: True
    rec.collector.read_camera = read
    await rec.async_setup()
    assert public_trails(rec.book.data)["m"]["current"]["paths"] == [], "stored is not fresh before a current read"
    tick(0)
    await settle(lambda: len(replies) == 1)
    replies[0].set_result(payload())
    await settle(lambda: rec.collector.leases[("camera.live1049", "vacuum.robot1049")].task is None)
    assert rec.book.data["m"]["_task_activity"]["armed"] is True
    # Start a final old-generation read, then start a real new task while it waits.
    tick(10)
    rec.collector._start(rec.collector.leases[("camera.live1049", "vacuum.robot1049")])
    await settle(lambda: len(replies) == 2)
    await asyncio.sleep(.01)  # the cached State predates the observed new-task event
    hass.states.async_set("vacuum.robot1049", "cleaning", activity(True))
    await settle(lambda: rec.book.data["m"]["current"]["_generation"] != old["_generation"])
    current = rec.book.data["m"]["current"]
    assert current["_live_tail"]["paths"] == [], "cached dock position belongs to the previous epoch"
    generation = current["_generation"]
    previous = rec.book.data["m"]["previous"]
    assert previous["paths"] == old_value.paths and current["paths"] == []
    assert not rec.book.on_snapshot("m", old_value, 4, "route", "floor", generation, True)
    assert not rec.book.on_snapshot("m", old_value, 4, "route", "floor", old["_generation"], True)
    replies[1].set_result(payload())
    await settle(lambda: rec.collector.leases[("camera.live1049", "vacuum.robot1049")].task is None)
    assert current["paths"] == [], "late completed-task value cannot return"
    hass.states.async_set("camera.live1049", "idle", {"map_name": "floor", "robot_position": {"x": 100, "y": 10}})
    await settle(lambda: bool(current["_live_tail"]["paths"]))
    fresh = public_trails(rec.book.data)["m"]["current"]["live_tail"]["paths"]
    empty = dreame_snapshot(payload([]))
    rec.book.on_snapshot("m", empty, 5, "route", "floor", generation, True)
    rec.book.on_snapshot("m", empty, 6, "route", "floor", generation, True)
    assert public_trails(rec.book.data)["m"]["current"]["live_tail"]["paths"] == fresh
    assert rec.book.data["m"]["previous"] is previous
    await rec.async_teardown()
    stored = await rec.store.async_load()
    assert stored["m"]["_task_activity"]["armed"] is False
    restored = TrailBook(stored)
    assert restored.data["m"]["current"]["_generation"] == generation
    assert restored.data["m"]["current"]["_live_tail"]["paths"]
    assert len(calls) == 2, "no browser and no per-card reader"


def test_repeated_empty_and_late_native_only_consume_a_witnessed_prefix():
    book = TrailBook()
    current, _ = book.ensure_run("m", "floor", 1, "route", "camera.map")
    generation = current["_generation"]
    native = dreame_snapshot(payload())
    book.on_snapshot("m", native, 2, "route", "floor", generation, True)
    for i, (x, y) in enumerate(((100, 0), (100, 10), (110, 10), (110, 20))):
        book.on_point("m", "floor", x, y, 3 + i, "route", "camera.map", physical_cm=(x, y), sample_ms=1000 * i)
    tail = public_trails(book.data)["m"]["current"]["live_tail"]
    book.on_snapshot("m", replace(native, revision=2), 8, "route", "floor", generation, True, endpoint_cm=(100, 0))
    assert public_trails(book.data)["m"]["current"]["live_tail"] == tail
    caught = replace(dreame_snapshot(payload([[1, 0, 0, 100, 0, 100, 10]])), read_started_ms=1500)
    book.on_snapshot("m", caught, 9, "route", "floor", generation, True, endpoint_cm=(100, 10))
    assert public_trails(book.data)["m"]["current"]["live_tail"]["paths"] == [tail["paths"][0][1:]]
    assert current["quality"]["raw_points"] == 3
    assert current["paths"] == caught.paths, "provisional observations never become raw native"
    empty = dreame_snapshot(payload([]))
    book.on_snapshot("m", empty, 10, "route", "floor", generation, True)
    book.on_snapshot("m", empty, 11, "route", "floor", generation, True)
    assert len(public_trails(book.data)["m"]["current"]["live_tail"]["paths"][0]) == 3


async def test_moving_transition_clears_old_backoff_but_not_physical_minimum(hass, monkeypatch):
    from custom_components.houseplan.vacuum_paths import PathRejected

    clock, timers, calls = 0.0, [], []

    def schedule(_hass, delay, callback):
        item = [clock + delay, callback, True]
        timers.append(item)
        return lambda: item.__setitem__(2, False)

    def tick(seconds):
        nonlocal clock
        clock += seconds
        for item in list(timers):
            if item[2] and item[0] <= clock:
                item[2] = False
                item[1](None)

    async def read(_source):
        calls.append(clock)
        raise PathRejected("stale")

    monkeypatch.setattr(collector_module, "async_call_later", schedule)
    collector = collector_module.PathCollector(hass, lambda *_: None, lambda *_: None,
                                               read_camera=read, clock=lambda: clock)
    stopped = collector_module.PathContext("camera.map", "vacuum.robot", "floor",
                                           (("m", "route", "gen"),), False, True, "dreame_vacuum")
    collector.observe(stopped)
    tick(0)
    lease = collector.leases[(stopped.source, stopped.vacuum)]
    await settle(lambda: lease.task is None and bool(calls))
    assert lease.next_retry == 30
    tick(1)
    moving = replace(stopped, moving=True)
    collector.observe(moving)
    assert lease.next_retry == 0
    assert min(t[0] for t in timers if t[2]) == 10
    tick(9)
    await settle(lambda: lease.task is None and len(calls) == 2)
    assert calls == [0, 10]
    assert lease.next_retry == 40, "subsequent failures resume ordinary backoff"
    collector.observe(moving)
    assert lease.next_retry == 40, "ongoing movement events cannot reset backoff repeatedly"
    collector.close()
