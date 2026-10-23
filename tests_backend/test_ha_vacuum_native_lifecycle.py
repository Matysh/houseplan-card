"""#1048: current native values must not inherit permanent transport fences."""
from __future__ import annotations

import copy
import json
from types import SimpleNamespace

import pytest

from custom_components.houseplan.trails import TrailBook, TrailRecorder
from custom_components.houseplan.vacuum_paths import dreame_snapshot, public_trails


def native(map_id=1, saved_map_id=36, map_index=1, frame_id=900, path=None):
    return dreame_snapshot(json.dumps({
        "version": 2, "map_id": map_id, "saved_map_id": saved_map_id,
        "map_index": map_index, "frame_id": frame_id,
        "path": [[1, 0, 0, 100, 0, 100, 100]] if path is None else path,
    }))


def seeded(old=None):
    book = TrailBook()
    run, _ = book.ensure_run("m", "floor", 1, "route", "camera.map")
    value = old or native()
    assert book.on_snapshot("m", value, 2, "route", "floor", run["_generation"], True, moving=True)
    return book


@pytest.mark.parametrize("restart", [False, True], ids=["live", "json-store-restart"])
@pytest.mark.parametrize("old_fields,new_fields", [
    ({}, {"map_id": 2}),
    ({"map_id": 36, "saved_map_id": None}, {}),
    ({}, {"frame_id": 1}),
])
@pytest.mark.parametrize("paths", [[], [[1, 50, 50]], [[1, 50, 50, 60, 50], [2, 90, 90, 90, 100]]],
                         ids=["empty", "singleton", "new-fragments"])
def test_same_coordinate_map_accepts_fresh_full_values(restart, old_fields, new_fields, paths):
    book = seeded(native(**old_fields))
    old = book.data["m"]["current"]
    generation = old["_generation"]
    book.end_run("m", 3)
    if restart:
        book = TrailBook(json.loads(json.dumps(book.data)))
    current, _ = book.ensure_run("m", "floor", 7200, "route", "camera.map")
    assert current["_generation"] == generation
    fresh = native(path=paths, **new_fields)
    book.on_snapshot("m", fresh, 7210, "route", "floor", generation, True, moving=True)
    assert current["paths"] == fresh.paths, "a fresh full camera value must replace the old native geometry"
    assert current["received_at"] == 7210
    assert current["quality"]["reason"] == ("ok" if paths else "empty_integration")
    assert "previous" not in book.data["m"], "provider metadata is not a new cleaning job"
    assert not current.get("_position_paths")
    public = public_trails(book.data)["m"]["current"]
    assert not {"source", "_generation", "_native_identity", "_native_revision"} & public.keys()


@pytest.mark.parametrize("fields", [
    {"saved_map_id": 77}, {"map_index": 2}, {"saved_map_id": "36"}, {"map_index": "1"},
])
def test_foreign_coordinate_map_stays_rejected(fields):
    book = seeded()
    current = book.data["m"]["current"]
    before = copy.deepcopy(current["paths"])
    book.on_snapshot("m", native(frame_id=901, path=[[1, 900, 900, 999, 999]], **fields),
                     3, "route", "floor", current["_generation"], True, moving=True)
    assert current["paths"] == before
    assert current["received_at"] == 2
    assert current["quality"]["reason"] == "coordinates_unverified"


def test_lower_frame_current_value_without_stop_still_obeys_source_first():
    book = seeded()
    current = book.data["m"]["current"]
    value = native(frame_id=1, path=[[1, 50, 50, 80, 50]])
    book.on_snapshot("m", value, 3, "route", "floor", current["_generation"], True, moving=True)
    assert current["paths"] == value.paths
    assert current["received_at"] == 3
    assert "previous" not in book.data["m"]


def test_unchanged_geometry_moves_identity_and_frame_without_inventing_a_job():
    book = seeded()
    current = book.data["m"]["current"]
    value = native(map_id=2, frame_id=1)
    book.on_snapshot("m", value, 3, "route", "floor", current["_generation"], True, moving=True)
    assert current["_native_identity"] == ["dreame", value.map_key]
    assert current["_native_revision"] == 1
    assert current["received_at"] == 3
    assert "previous" not in book.data["m"] and "_job_id" not in current
    before = copy.deepcopy(book.data)
    assert not book.on_snapshot("m", value, 4, "route", "floor", current["_generation"], True, moving=True)
    assert book.data == before


def test_explicit_empty_error_and_repeated_empty_do_not_resurrect_old_geometry():
    book = seeded()
    current = book.data["m"]["current"]
    value = native(map_id=2, frame_id=1, path=[])
    book.on_snapshot("m", value, 3, "route", "floor", current["_generation"], True, moving=True)
    book.path_reason("m", "stale")
    assert current["paths"] == [] and current["points"] == []
    book.on_snapshot("m", value, 4, "route", "floor", current["_generation"], True, moving=True)
    assert current["quality"]["reason"] == "empty_integration"
    assert "previous" not in book.data["m"]


@pytest.mark.parametrize("provenance", [None, "corrupt", ["unexpected"], {"schema": "future"}])
def test_unverified_stored_passport_never_guesses_a_changed_coordinate_identity(provenance):
    book = seeded()
    current = book.data["m"]["current"]
    current["provenance"] = provenance
    old = copy.deepcopy(current["paths"])
    book.on_snapshot("m", native(map_id=2, frame_id=1, path=[]), 3,
                     "route", "floor", current["_generation"], True, moving=True)
    assert current["paths"] == old and current["received_at"] == 2
    assert current["quality"]["reason"] == "coordinates_unverified"


@pytest.fixture(autouse=True)
def custom_integrations(enable_custom_integrations):
    yield


@pytest.mark.parametrize("stopped", [False, True])
async def test_current_camera_read_recovers_real_ha_store_without_any_browser(hass, monkeypatch, stopped):
    """Real registry/state subscription/Store/collector, synthetic camera data."""
    import asyncio

    from homeassistant.helpers import entity_registry as er

    from custom_components.houseplan import vacuum_path_collector as collector_module

    timers = []
    now = 100.0

    def schedule(_hass, delay, callback):
        entry = [now + delay, callback, True]
        timers.append(entry)
        return lambda: entry.__setitem__(2, False)

    def tick(seconds):
        nonlocal now
        now += seconds
        for entry in list(timers):
            if entry[2] and entry[0] <= now:
                entry[2] = False
                entry[1](None)

    monkeypatch.setattr(collector_module, "async_call_later", schedule)
    registry = er.async_get(hass)
    registry.async_get_or_create("camera", "dreame_vacuum", "map1048", suggested_object_id="map1048")
    hass.states.async_set("camera.map1048", "idle", {"map_index": 1, "map_id": 2,
                                                      "saved_map_id": 36, "vacuum_position": {"x": 50, "y": 50}})
    hass.states.async_set("vacuum.robot1048", "cleaning")
    config = {"spaces": [{"id": "floor", "cell_cm": 5}], "markers": [{
        "id": "m", "binding": "entity:vacuum.robot1048", "space": "floor", "vacuum": {
            "source": "camera.map1048", "map_routes": [{"id": "route", "source": "camera.map1048",
                "map_id": "1", "space": "floor", "calibration": [1, 0, 0, 0, 1, 0]}]}}]}

    class Config:
        async def async_load(self):
            return {"config": config}

    old_book = TrailBook()
    old, _ = old_book.ensure_run("m", "1", 1, "route", "camera.map1048")
    old_book.on_snapshot("m", native(), 2, "route", "1", old["_generation"], True)
    if stopped:
        old_book.end_run("m", 3)
    recorder = TrailRecorder(hass, SimpleNamespace(config_store=Config()))
    await recorder.store.async_save(old_book.data)
    values = [native(map_id=2, frame_id=1, path=[[1, 50, 50, 60, 50]]),
              native(map_id=2, frame_id=2, path=[])]
    calls = []

    async def read(source):
        calls.append((source, now))
        value = values[len(calls) - 1]
        return json.dumps({"version": 2, "map_id": 2, "saved_map_id": 36, "map_index": 1,
                           "frame_id": value.revision,
                           "path": [[1, 50, 50, 60, 50]] if value.paths else []})

    recorder.collector.clock = lambda: now
    recorder.collector.has_camera_channel = lambda _source: True
    recorder.collector.read_camera = read
    events = []
    unsubscribe = hass.bus.async_listen("houseplan_trail_updated", events.append)
    await recorder.async_setup()
    tick(0)
    for _ in range(200):
        if len(calls) == 1 and recorder.collector.leases[("camera.map1048", "vacuum.robot1048")].task is None:
            break
        await asyncio.sleep(0.001)
    current = recorder.book.data["m"]["current"]
    assert current["paths"] == values[0].paths
    assert current["quality"]["reason"] == "ok"
    assert current["_generation"] == old["_generation"]
    tick(30)
    for _ in range(200):
        if len(calls) == 2 and recorder.collector.leases[("camera.map1048", "vacuum.robot1048")].task is None:
            break
        await asyncio.sleep(0.001)
    assert current["paths"] == [] and current["quality"]["reason"] == "empty_integration"
    assert calls == [("camera.map1048", 100), ("camera.map1048", 130)]
    await hass.async_block_till_done()
    assert events, "the ordinary subscription event delivers the accepted value"
    await recorder.async_teardown()
    unsubscribe()
    stored = await recorder.store.async_load()
    assert stored["m"]["current"]["paths"] == []
    assert config["markers"][0]["vacuum"]["map_routes"][0]["calibration"] == [1, 0, 0, 0, 1, 0]
