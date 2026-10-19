"""#940 observable HA events/Store/collector, synthetic sources, no browser."""
from __future__ import annotations

import asyncio
import copy
from dataclasses import replace
from types import SimpleNamespace

import pytest

from custom_components.houseplan import trails
from custom_components.houseplan import vacuum_path_collector as collector_module
from custom_components.houseplan.trails import TrailRecorder
from custom_components.houseplan.vacuum_paths import attribute_snapshot, public_trails
from test_ha_vacuum_paths import context, settle


@pytest.fixture(autouse=True)
def integrations(enable_custom_integrations):
    yield


def config(flag="absent"):
    vacuum = {"source": "camera.map940", "map_routes": [{
        "id": "route", "source": "camera.map940", "map_id": "floor", "space": "floor",
        "calibration": [1, 0, 0, 0, 1, 0]}]}
    if flag != "absent":
        vacuum["new_run_after_dock"] = flag
    return {"spaces": [{"id": "floor", "cell_cm": 5}], "markers": [{
        "id": "robot", "space": "floor", "binding": "entity:vacuum.robot940", "vacuum": vacuum}]}


class Config:
    def __init__(self, value):
        self.value = value

    async def async_load(self):
        return {"config": self.value}


def attrs(path="absent", x=0):
    value = {"map_name": "floor", "robot_position": {"x": x, "y": 0}}
    if path != "absent":
        value["path"] = path
    return value


async def state(hass, entity, value, attributes=None):
    hass.states.async_set(entity, value, attributes or {})
    await hass.async_block_till_done()


@pytest.mark.parametrize("flag", ["absent", None, False, True])
@pytest.mark.parametrize("source_first", [True, False])
async def test_940_report_empty_follows_source_in_both_event_orders_and_survives_store(hass, monkeypatch, flag, source_first):
    now = [1000.0]
    monkeypatch.setattr(trails, "time", SimpleNamespace(time=lambda: now[0]))
    await state(hass, "vacuum.robot940", "cleaning")
    await state(hass, "camera.map940", "idle", attrs([[i * 100, 0] for i in range(10)]))
    runtime = SimpleNamespace(config_store=Config(config(flag)))
    recorder = TrailRecorder(hass, runtime)
    await recorder.async_setup()
    await settle(lambda: recorder.book.data["robot"]["current"]["quality"]["source"] == "native")
    original = copy.deepcopy(recorder.book.data["robot"]["current"])
    now[0] += 3
    await state(hass, "vacuum.robot940", "docked")
    now[0] += 62
    updates = []
    unsubscribe = hass.bus.async_listen("houseplan_trail_updated", lambda event: updates.append(event))
    if source_first:
        await state(hass, "camera.map940", "idle", attrs([]))
        await settle(lambda: recorder.book.data["robot"]["current"]["paths"] == [])
        await state(hass, "vacuum.robot940", "cleaning")
    else:
        await state(hass, "vacuum.robot940", "cleaning")
        await state(hass, "camera.map940", "idle", attrs([]))
    await settle(lambda: recorder.book.data["robot"]["current"]["paths"] == [])
    await hass.async_block_till_done()
    assert updates, "empty itself notifies clients, without a later nonempty snapshot"
    unsubscribe()
    now[0] += 19  # logical quiet interval, no real-time sleep
    public = public_trails(recorder.book.data)["robot"]["current"]
    assert public["paths"] == public["points"] == []
    assert public["quality"] == {"source": "native", "reason": "empty_integration", "raw_points": 0, "stored_points": 0}
    assert public["started"] == original["started"]
    assert recorder.book.data["robot"]["current"]["_generation"] == original["_generation"]
    assert "previous" not in recorder.book.data["robot"]
    await recorder.async_teardown()
    persisted = await recorder.store.async_load()
    assert persisted["robot"]["current"]["paths"] == []
    restarted = TrailRecorder(hass, runtime)
    await restarted.async_setup()
    await settle(lambda: restarted.book.data["robot"]["current"]["quality"]["source"] == "native")
    assert public_trails(restarted.book.data)["robot"]["current"]["points"] == []
    assert restarted.book.data["robot"]["current"]["_generation"] == original["_generation"]
    await restarted.async_teardown()


async def test_940_empty_singleton_errors_and_same_list_object_follow_native(hass):
    await state(hass, "vacuum.robot940", "docked")
    raw = [[0, 0], [100, 0]]
    await state(hass, "camera.map940", "idle", attrs(raw))
    recorder = TrailRecorder(hass, SimpleNamespace(config_store=Config(config(True))))
    await recorder.async_setup()
    await settle(lambda: recorder.book.data["robot"]["current"]["quality"]["source"] == "native")
    run = recorder.book.data["robot"]["current"]
    generation = run["_generation"]
    raw.clear()  # same list identity, observed through the next vacuum event
    await state(hass, "vacuum.robot940", "cleaning")
    await settle(lambda: run["paths"] == [])
    for value in ([[[20, 20]]], [], [[[30, 30]]], [[[30, 30], [40, 40]]], []):
        await state(hass, "camera.map940", "idle", attrs(value))
        await settle(lambda: run["paths"] == value)
        assert run["_generation"] == generation and "previous" not in recorder.book.data["robot"]
    for invalid in (None, [[True, 0]], {"bad": []}, "not-a-path"):
        await state(hass, "camera.map940", "idle", attrs(invalid))
        await settle(lambda: all(lease.task is None for lease in recorder.collector.leases.values()))
        assert run["paths"] == [] and run["quality"]["source"] == "native"
    await state(hass, "camera.map940", "unavailable", attrs([[900, 900], [999, 999]]))
    assert run["paths"] == []
    await recorder.async_teardown()


async def test_940_delayed_attribute_executor_cannot_publish_older_value_in_same_generation(hass, monkeypatch):
    accepted, reasons = [], []
    release = asyncio.get_running_loop().create_future()
    started = asyncio.Event()
    execute = hass.async_add_executor_job
    first = True

    async def delayed(function, *arguments):
        nonlocal first
        if function is collector_module.attribute_snapshot and first:
            first = False
            started.set()
            await release
        return await execute(function, *arguments)

    monkeypatch.setattr(hass, "async_add_executor_job", delayed)
    collector = collector_module.PathCollector(hass, lambda *value: accepted.append(value),
                                                lambda *value: reasons.append(value))
    current = context(platform=None)
    collector.observe(current, attribute_path=[[0, 0], [999, 999]])
    await started.wait()
    collector.observe(current, attribute_path=[])
    release.set_result(None)
    await settle(lambda: len(accepted) == 1)
    assert accepted[0][1].paths == []
    assert accepted[0][0].markers == current.markers, "not a run-generation fence"
    collector.observe(current, attribute_path=[[10, 10]])
    await settle(lambda: len(accepted) == 2)
    assert accepted[1][1].paths == [[[10.0, 10.0]]]
    collector.observe(replace(current, available=False), attribute_path=[])
    assert len(accepted) == 2
    collector.close()


async def test_940_positional_dock_proof_survives_real_store_and_live_off_cancels_it(hass, monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(trails, "time", SimpleNamespace(time=lambda: now[0]))
    await state(hass, "vacuum.robot940", "cleaning")
    await state(hass, "camera.map940", "idle", attrs())
    cfg = config(True)
    runtime = SimpleNamespace(config_store=Config(cfg))
    recorder = TrailRecorder(hass, runtime)
    await recorder.async_setup()
    generation = recorder.book.data["robot"]["current"]["_generation"]
    now[0] += 3
    await state(hass, "vacuum.robot940", "docked")
    await recorder.async_teardown()
    await state(hass, "vacuum.robot940", "unknown")
    restarted = TrailRecorder(hass, runtime)
    await restarted.async_setup()
    assert restarted.book.data["robot"]["_policy"]["armed"] is True
    await state(hass, "vacuum.robot940", "returning")
    assert restarted.book.data["robot"]["current"]["_generation"] == generation
    await state(hass, "vacuum.robot940", "cleaning")
    current = restarted.book.data["robot"]["current"]
    assert current["_generation"] != generation
    assert restarted.book.data["robot"]["previous"]["_generation"] == generation
    await state(hass, "vacuum.robot940", "docked")
    cfg["markers"][0]["vacuum"]["live"] = False
    await restarted.async_refresh()
    assert "_policy" not in restarted.book.data["robot"]
    await state(hass, "vacuum.robot940", "cleaning")
    cfg["markers"][0]["vacuum"]["live"] = True
    await restarted.async_refresh()
    assert restarted.book.data["robot"]["current"] is current
    await restarted.async_teardown()


@pytest.mark.parametrize("raw", [None, [[True, 0]], [["bad", 1]], {"path": [[float("inf"), 0]]}, [[]]])
def test_940_invalid_nonempty_attribute_is_not_an_explicit_clear(raw):
    from custom_components.houseplan.vacuum_paths import PathRejected
    with pytest.raises(PathRejected):
        attribute_snapshot(raw, "floor")


async def test_940_foreign_root_native_channel_does_not_cancel_position_owner_dock_proof(hass):
    cfg = config(True)
    cfg["markers"][0]["vacuum"]["source"] = "camera.aaa_foreign"
    await state(hass, "vacuum.robot940", "cleaning")
    await state(hass, "camera.aaa_foreign", "idle", attrs([]))
    await state(hass, "camera.map940", "idle", attrs())
    recorder = TrailRecorder(hass, SimpleNamespace(config_store=Config(cfg)))
    await recorder.async_setup()
    original = recorder.book.data["robot"]["current"]
    await state(hass, "vacuum.robot940", "docked")
    await state(hass, "vacuum.robot940", "cleaning")
    assert recorder.book.data["robot"]["current"] is not original
    assert recorder.book.data["robot"]["previous"] is original
    await recorder.async_teardown()


@pytest.mark.parametrize("native_valid", [False, True])
async def test_940_first_channel_classification_does_not_consume_dock_or_grace_proof_early(hass, monkeypatch, native_valid):
    monkeypatch.setattr(trails, "time", SimpleNamespace(time=lambda: 5000.0))
    await state(hass, "vacuum.robot940", "cleaning")
    await state(hass, "camera.map940", "idle", attrs([[50, 0], [60, 0]] if native_valid else [[True, 0]], x=55))
    recorder = TrailRecorder(hass, SimpleNamespace(config_store=Config(config(True))))
    recorder.book.configure_policy("robot", "vacuum.robot940", True)
    recorder.book.on_point("robot", "floor", 1, 0, 1, "route", "camera.map940")
    original = copy.deepcopy(recorder.book.data["robot"]["current"])
    recorder.book.end_run("robot", 2)
    recorder.book.observe_policy("robot", "docked")
    recorder.book.observe_policy("robot", "cleaning")
    await recorder.store.async_save(recorder.book.data)
    await recorder.async_setup()
    await settle(lambda: all(lease.task is None for lease in recorder.collector.leases.values()))
    current = recorder.book.data["robot"]["current"]
    if native_valid:
        assert current["_generation"] == original["_generation"]
        assert current["paths"] == [[[50, 0], [60, 0]]]
        assert "previous" not in recorder.book.data["robot"]
    else:
        assert current["_generation"] != original["_generation"]
        assert current["quality"]["source"] == "positions"
        assert current["paths"] == [[[55, 0]]]
        assert recorder.book.data["robot"]["previous"]["_generation"] == original["_generation"]
    await recorder.async_teardown()
