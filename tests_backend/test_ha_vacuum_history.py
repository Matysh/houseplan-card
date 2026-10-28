"""Authenticated historical preview, genuine public camera DTOs, no writes."""
import asyncio
import copy
import json
import logging
from pathlib import Path

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY, GROUP_ID_USER
from homeassistant.components.camera import Camera
from homeassistant.components.camera.const import DATA_COMPONENT
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_component import EntityComponent
from pytest_homeassistant_custom_component.common import MockConfigEntry
from test_ha_vacuum_paths import Clock
from test_ha_websocket import _access_token_for_group

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.store import get_data
from custom_components.houseplan.vacuum_history import retire_history
from custom_components.houseplan.vacuum_paths import dreame_snapshot

FIXTURE = json.loads((Path(__file__).resolve().parent.parent / "test/fixtures/vacuum-history/dreame-tasshack-2.0.2.json").read_text())
SOURCE = "camera.synthetic_history"
MARKER = "history999"
ROUTE = {"id": "r999", "source": SOURCE, "map_id": "floor", "space": "f1", "calibration": [.001, 0, 10, 0, .001, 20]}


class HistoryCamera(Camera):
    _attr_name = "Synthetic History"
    _attr_unique_id = "999-synthetic_history"
    _attr_device_info = {"identifiers": {("dreame_vacuum", "999")}}
    map_index = 0

    def __init__(self):
        super().__init__()
        self.entity_id = SOURCE
        self.metadata = copy.deepcopy(FIXTURE["metadata"])
        self.payload = copy.deepcopy(FIXTURE["payload"])
        self.payload_by_index = None
        self.calls = []
        self.pending = None
        self.live_calls = []
        self.live_pending = None
        self.position = {"x": 100, "y": 0}

    @property
    def extra_state_attributes(self):
        return {"cleaning_history_picture": self.metadata, "map_name": "floor", "robot_position": self.position}

    async def history_map_image(self, *args):
        self.calls.append(args)
        if self.pending is not None:
            future, self.pending = self.pending, None
            await future
        return json.dumps(self.payload_by_index[args[0]] if self.payload_by_index is not None else self.payload)

    async def map_data_string(self, *, include_resources):
        self.live_calls.append(include_resources)
        if self.live_pending is not None:
            future, self.live_pending = self.live_pending, None
            await future
        return json.dumps({**self.payload, "history_map": False, "map_id": 1,
                           "path": [[1, 9000, 9000, 10000, 9000]]})


async def prepared(hass, hass_ws_client, *, admin_only=False):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={"admin_only": admin_only})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    vendor = MockConfigEntry(domain="dreame_vacuum", title="Synthetic robot")
    vendor.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(config_entry_id=vendor.entry_id, identifiers={("dreame_vacuum", "999")})
    registry = er.async_get(hass)
    for domain, name in (("camera", "synthetic_history"), ("vacuum", "robot")):
        registry.async_get_or_create(domain, "dreame_vacuum", "999-" + name, suggested_object_id=name,
                                     device_id=device.id, config_entry=vendor)
    component = EntityComponent(logging.getLogger(__name__), "camera", hass)
    hass.data[DATA_COMPONENT] = component
    camera = HistoryCamera()
    platform = component._async_init_entity_platform("dreame_vacuum", None)
    platform.config_entry = vendor
    component._platforms["dreame_vacuum"] = platform
    await platform.async_add_entities([camera])
    assert camera.entity_id == SOURCE
    entry_check = registry.async_get(SOURCE)
    assert entry_check.platform == "dreame_vacuum" and entry_check.device_id == device.id and entry_check.disabled_by is None
    from homeassistant.components.camera.helper import get_camera_from_entity_id
    assert get_camera_from_entity_id(hass, SOURCE) is camera
    hass.states.async_set("vacuum.robot", "docked")
    rt = get_data(hass)
    config = {"spaces": [{"id": "f1", "title": "Floor", "rooms": [], "cell_cm": 5}], "markers": [
        {"id": MARKER, "binding": "entity:vacuum.robot", "space": "f1", "vacuum": {"source": SOURCE, "map_routes": [ROUTE]}}]}
    await rt.config_store.async_save({"config": config, "rev": 1})
    rec = hass.data[DOMAIN]["trail_recorder"]
    live = {**FIXTURE["payload"], "history_map": False, "map_id": 1, "path": [[1, 9000, 9000, 10000, 9000]]}
    run, _ = rec.book.ensure_run(MARKER, "floor", 1, "r999", SOURCE)
    assert rec.book.on_snapshot(MARKER, dreame_snapshot(json.dumps(live)), 2, "r999", "floor", run["_generation"], True)
    await rec.store.async_save(rec.book.data)
    from custom_components.houseplan.vacuum_history_websocket import _owner
    resolved = _owner(hass, config, MARKER)
    assert resolved["camera"] is camera and resolved["vacuum"] == "vacuum.robot"
    return entry, rt, rec, camera, await hass_ws_client(hass)


async def request(client, command, **extra):
    await client.send_json_auto_id({"type": f"houseplan/vacuum/history/{command}", "marker_id": MARKER, **extra})
    return await client.receive_json()


async def catalog(client):
    answer = await request(client, "list")
    assert answer["success"], answer
    return answer["result"]


async def geometry(client, listing):
    return await request(client, "get", record_id=listing["records"][0]["id"], revision=listing["revision"])


@pytest.mark.parametrize("suppression", ["hidden", "static_icon", "value_static_icon", "live_off"])
async def test_saved_marker_suppression_refuses_old_catalog_without_another_provider_read(hass, hass_ws_client, suppression):
    _, rt, rec, camera, client = await prepared(hass, hass_ws_client)
    listing = await catalog(client)
    assert (await geometry(client, listing))["success"]
    initial = copy.deepcopy(await rt.config_store.async_load())
    changed = copy.deepcopy(initial)
    marker = changed["config"]["markers"][0]
    if suppression == "hidden":
        marker["hidden"] = True
    elif suppression == "live_off":
        marker["vacuum"]["live"] = False
    else:
        marker["display"] = suppression
    changed["rev"] += 1
    await rt.config_store.async_save(changed)
    before = [copy.deepcopy(await store.async_load()) for store in (rt.config_store, rt.store, rec.store)]
    answer = await geometry(client, listing)
    assert answer["error"]["code"] == "suppressed", answer
    assert len(camera.calls) == 1, "suppressed saved authority must refuse before a physical provider read"
    assert [await store.async_load() for store in (rt.config_store, rt.store, rec.store)] == before
    initial["rev"] = changed["rev"] + 1
    await rt.config_store.async_save(initial)
    assert (await catalog(client))["records"] == listing["records"]
    assert hass.data[DOMAIN]["trail_recorder"] is rec


@pytest.mark.parametrize("change,reason", [("unavailable", "unavailable"), ("disabled", "unsupported"), ("rebound", "ambiguous")])
async def test_initial_get_owner_refusal_is_retired_but_list_remains_descriptive(hass, hass_ws_client, change, reason):
    _, rt, rec, camera, client = await prepared(hass, hass_ws_client)
    listing = await catalog(client)
    if change == "unavailable":
        hass.states.async_set(SOURCE, "unavailable")
    elif change == "disabled":
        er.async_get(hass).async_update_entity(SOURCE, disabled_by=er.RegistryEntryDisabler.USER)
    else:
        changed = copy.deepcopy(await rt.config_store.async_load())
        changed["config"]["markers"][0]["binding"] = "entity:vacuum.missing999"
        changed["rev"] += 1
        await rt.config_store.async_save(changed)
    before = [copy.deepcopy(await store.async_load()) for store in (rt.config_store, rt.store, rec.store)]
    descriptive = await request(client, "list")
    assert descriptive["error"]["code"] == reason, descriptive
    refused = await geometry(client, listing)
    assert refused["error"]["code"] == "retired", refused
    assert camera.calls == [], "unproved owner must not start another physical read"
    assert [await store.async_load() for store in (rt.config_store, rt.store, rec.store)] == before


@pytest.mark.parametrize("failure,reason", [("malformed", "unsupported"), ("provider", "stale")])
async def test_valid_owner_record_failure_keeps_its_ordinary_error(hass, hass_ws_client, failure, reason):
    _, _, _, camera, client = await prepared(hass, hass_ws_client)
    listing = await catalog(client)
    if failure == "malformed":
        camera.payload["history_map"] = False
    else:
        camera.pending = asyncio.get_running_loop().create_future()
        camera.pending.set_exception(RuntimeError("synthetic record failure"))
    answer = await geometry(client, listing)
    assert answer["error"]["code"] == reason, answer
    assert len(camera.calls) == 1
    assert (await catalog(client))["records"] == listing["records"]


async def settle(predicate):
    for _ in range(200):
        if predicate():
            return
        await asyncio.sleep(.001)
    assert predicate()


@pytest.mark.parametrize("group,admin_only,allowed", [(None, True, True), (GROUP_ID_USER, False, True),
                                                       (GROUP_ID_USER, True, False), (GROUP_ID_READ_ONLY, False, False)])
async def test_original_public_history_through_authenticated_endpoint_without_writes(hass, hass_ws_client, monkeypatch, group, admin_only, allowed):
    _, rt, rec, camera, owner = await prepared(hass, hass_ws_client, admin_only=admin_only)
    client = owner if group is None else await hass_ws_client(hass, access_token=await _access_token_for_group(hass, group))
    before = [copy.deepcopy(await store.async_load()) for store in (rt.config_store, rt.store, rec.store)]
    async def forbidden(*_):
        pytest.fail("history must not write any Store")
    for store in (rt.config_store, rt.store, rec.store):
        monkeypatch.setattr(store, "async_save", forbidden)
    listing = await request(client, "list")
    if not allowed:
        assert listing["error"]["code"] == "unauthorized"
        denied = await request(client, "get", record_id="a"*64, revision="b"*64)
        assert denied["error"]["code"] == "unauthorized" and not camera.calls
    else:
        assert listing["success"], listing
        value = (await geometry(client, listing["result"]))
        assert value["success"], value
        dto = value["result"]
        assert dto["timestamp"] == 1792800000 and dto["completed"] is True
        assert dto["paths"] == [[[0, 0], [1000, 0], [1000, 1000]]] and dto["route"] == ROUTE
        assert camera.calls == [(1, False, False, True, False, False, False)]
        assert "token" not in json.dumps(dto) and "synthetic-cleanup-archive" not in json.dumps(dto)
        assert rec.book.data[MARKER]["current"]["paths"] == [[[9000, 9000], [10000, 9000]]]
    assert [await store.async_load() for store in (rt.config_store, rt.store, rec.store)] == before


async def test_second_original_public_record_uses_its_index_and_geometry(hass, hass_ws_client, monkeypatch):
    fixture = json.loads((Path(__file__).resolve().parent.parent /
                         "test/fixtures/vacuum-history/dreame-tasshack-2.0.2-two-records.json").read_text())
    _, rt, rec, camera, client = await prepared(hass, hass_ws_client)
    camera.metadata = fixture["metadata"]
    camera.payload_by_index = {record["index"]: record["payload"] for record in fixture["records"]}
    camera.async_write_ha_state()
    await hass.async_block_till_done()
    before = [copy.deepcopy(await store.async_load()) for store in (rt.config_store, rt.store, rec.store)]

    async def forbidden(*_):
        pytest.fail("selecting an older cleanup must not write a Store")

    for store in (rt.config_store, rt.store, rec.store):
        monkeypatch.setattr(store, "async_save", forbidden)
    listing = await catalog(client)
    assert [record["timestamp"] for record in listing["records"]] == [1792800000, 1792796400]
    answer = await request(client, "get", record_id=listing["records"][1]["id"], revision=listing["revision"])
    assert answer["success"], answer
    dto = answer["result"]
    assert dto["timestamp"] == 1792796400 and dto["completed"] is False
    assert dto["paths"] == [[[2000, 0], [3000, 0], [3000, 1000]]] and dto["route"] == ROUTE
    assert camera.calls == [(2, False, False, True, False, False, False)]
    assert rec.book.data[MARKER]["current"]["paths"] == [[[9000, 9000], [10000, 9000]]]
    assert [await store.async_load() for store in (rt.config_store, rt.store, rec.store)] == before


@pytest.mark.parametrize("change", ["index_shift", "removed", "source_rebind", "camera_state_aba", "new_cleanup", "config_revision"])
async def test_held_read_cannot_publish_foreign_or_retired_record(hass, hass_ws_client, change):
    _, rt, rec, camera, client = await prepared(hass, hass_ws_client)
    listing = await catalog(client)
    future = camera.pending = asyncio.get_running_loop().create_future()
    pending = asyncio.create_task(geometry(client, listing))
    await settle(lambda: len(camera.calls) == 1)
    if change == "index_shift":
        camera.metadata = {label: url.replace("index=1", "index=2") for label, url in camera.metadata.items()}
    elif change == "removed":
        camera.metadata = {}
    elif change == "source_rebind":
        er.async_get(hass).async_update_entity(SOURCE, device_id=None)
    elif change == "camera_state_aba":
        old = hass.states.get(SOURCE)
        hass.states.async_set(SOURCE, "unavailable")
        hass.states.async_set(SOURCE, old.state, dict(old.attributes), force_update=True)
    elif change == "new_cleanup":
        retire_history(rec, MARKER)
    else:
        stored = await rt.config_store.async_load()
        await rt.config_store.async_save({**stored, "rev": stored["rev"] + 1})
    future.set_result(None)
    result = await pending
    assert not result["success"] and result["error"]["code"] == "retired", result
    assert "paths" not in json.dumps(result)


async def test_record_index_shift_before_get_and_foreign_id_do_not_read_camera(hass, hass_ws_client):
    _, _, _, camera, client = await prepared(hass, hass_ws_client)
    listing = await catalog(client)
    result = await request(client, "get", record_id="a"*64, revision=listing["revision"])
    assert result["error"]["code"] == "stale" and not camera.calls
    camera.metadata = {label: url.replace("index=1", "index=2") for label, url in camera.metadata.items()}
    result = await geometry(client, listing)
    assert result["error"]["code"] == "stale" and not camera.calls


async def test_real_household_user_losing_write_role_retires_held_history(hass, hass_ws_client, monkeypatch):
    _, rt, rec, camera, _ = await prepared(hass, hass_ws_client)
    user = await hass.auth.async_create_user("History household writer", group_ids=[GROUP_ID_USER])
    token = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    client = await hass_ws_client(hass, access_token=hass.auth.async_create_access_token(token))
    listing = await catalog(client)
    before = [copy.deepcopy(await store.async_load()) for store in (rt.config_store, rt.store, rec.store)]

    async def forbidden(*_):
        pytest.fail("a retired history read must not write House Plan stores")

    for store in (rt.config_store, rt.store, rec.store):
        monkeypatch.setattr(store, "async_save", forbidden)
    future = camera.pending = asyncio.get_running_loop().create_future()
    pending = asyncio.create_task(geometry(client, listing))
    await settle(lambda: len(camera.calls) == 1)
    await hass.auth.async_update_user(user, group_ids=[GROUP_ID_READ_ONLY])
    assert [group.id for group in user.groups] == [GROUP_ID_READ_ONLY]
    future.set_result(None)
    answer = await pending
    assert not answer["success"] and answer["error"]["code"] == "retired", answer
    assert "paths" not in json.dumps(answer) and not rec._closed
    assert [await store.async_load() for store in (rt.config_store, rt.store, rec.store)] == before
    denied = await request(client, "list")
    assert denied["error"]["code"] == "unauthorized" and len(camera.calls) == 1


async def test_timeout_retains_physical_lease_and_next_read_drains_it(hass, hass_ws_client, monkeypatch):
    from custom_components.houseplan import vacuum_history_websocket as bridge
    monkeypatch.setattr(bridge, "TIMEOUT_S", .02)
    _, _, rec, camera, client = await prepared(hass, hass_ws_client)
    clock = [0.0]
    rec.collector.clock = lambda: clock[0]
    listing = await catalog(client)
    future = camera.pending = asyncio.get_running_loop().create_future()
    result = await geometry(client, listing)
    assert result["error"]["code"] == "stale" and len(camera.calls) == 1
    physical = hass.data["houseplan_vacuum_path_reads"][SOURCE]
    assert physical.task is not None and not physical.task.done()
    monkeypatch.setattr(bridge, "TIMEOUT_S", 1)
    waiting = asyncio.create_task(geometry(client, listing))
    await asyncio.sleep(.01)
    assert len(camera.calls) == 1
    clock[0] = 10.0
    future.set_result(None)
    result = await waiting
    assert result["success"] and len(camera.calls) == 2
    assert physical.started == 10.0 and physical.task is None


def live_collector(hass, rec, clock, monkeypatch, accepted):
    from custom_components.houseplan import vacuum_path_collector as live
    monkeypatch.setattr(live, "async_call_later", clock.schedule)
    collector = live.PathCollector(hass, lambda *value: accepted.append(value), lambda *_: None, clock=lambda: clock.now)
    run = rec.book.data[MARKER]["current"]
    collector.refresh([live.PathContext(SOURCE, "vacuum.robot", "floor", ((MARKER, ROUTE["id"], run["_generation"]),),
                                       True, True, "dreame_vacuum")])
    clock.tick(0)
    return collector


@pytest.mark.parametrize("next_owner", ["history", "live"])
async def test_cancelled_provider_after_wrapper_timeout_allows_next_real_owner(hass, hass_ws_client, monkeypatch, next_owner):
    from custom_components.houseplan import vacuum_history_websocket as bridge
    monkeypatch.setattr(bridge, "TIMEOUT_S", .02)
    _, _, rec, camera, client = await prepared(hass, hass_ws_client)
    clock = Clock()
    rec.collector.clock = lambda: clock.now
    listing = await catalog(client)
    future = camera.pending = asyncio.get_running_loop().create_future()
    result = await geometry(client, listing)
    assert result["error"]["code"] == "stale" and len(camera.calls) == 1
    physical = hass.data["houseplan_vacuum_path_reads"][SOURCE]
    owned = physical.task
    future.cancel()
    await settle(owned.cancelled)
    clock.now = 10.0
    monkeypatch.setattr(bridge, "TIMEOUT_S", 1)
    if next_owner == "history":
        result = await asyncio.wait_for(geometry(client, listing), .3)
        assert result["success"] and len(camera.calls) == 2
    else:
        accepted = []
        collector = live_collector(hass, rec, clock, monkeypatch, accepted)
        try:
            await settle(lambda: bool(accepted))
            assert camera.live_calls == [False] and accepted[0][1].paths == [[[9000, 9000], [10000, 9000]]]
        finally:
            collector.close()
        clock.now = 20.0
        result = await geometry(client, listing)
        assert result["success"] and len(camera.calls) == 2
    assert physical.task is None and physical.started == clock.now


async def test_queued_config_retirement_does_not_start_history_provider(hass, hass_ws_client, monkeypatch):
    _, rt, rec, camera, client = await prepared(hass, hass_ws_client)
    clock = Clock()
    rec.collector.clock = lambda: clock.now
    listing = await catalog(client)
    live_reply = camera.live_pending = asyncio.get_running_loop().create_future()
    accepted = []
    collector = live_collector(hass, rec, clock, monkeypatch, accepted)
    await settle(lambda: camera.live_calls == [False])
    real_load = rt.config_store.async_load
    entered = asyncio.Event()
    async def observed_load():
        result = await real_load()
        entered.set()
        return result
    monkeypatch.setattr(rt.config_store, "async_load", observed_load)
    pending = asyncio.create_task(geometry(client, listing))
    await entered.wait()
    before = await real_load()
    await rt.config_store.async_save({"config": {**before["config"], "markers": []}, "rev": 2})
    clock.now = 10.0
    live_reply.set_result(None)
    try:
        result = await pending
        assert not result["success"], result
        assert camera.calls == [], "retired queued history must not start a new physical provider operation"
        assert "paths" not in json.dumps(result)
    finally:
        collector.close()
    await rt.config_store.async_save({**before, "rev": 3})
    clock.now = 20.0
    result = await geometry(client, await catalog(client))
    assert result["success"] and len(camera.calls) == 1


@pytest.mark.parametrize("change,allowed", [("position", True), ("token_rotation", True), ("catalog_aba", False)])
async def test_public_source_ticks_keep_record_identity_but_catalog_aba_retires_it(hass, hass_ws_client, monkeypatch, change, allowed):
    from custom_components.houseplan import vacuum_path_collector as live
    _, _, rec, camera, client = await prepared(hass, hass_ws_client)
    clock = Clock()
    monkeypatch.setattr(live, "async_call_later", clock.schedule)
    rec.collector.clock = lambda: clock.now
    await rec.async_refresh()  # the real recorder owns its existing state subscription
    listing = await catalog(client)
    future = camera.pending = asyncio.get_running_loop().create_future()
    pending = asyncio.create_task(geometry(client, listing))
    await settle(lambda: len(camera.calls) == 1)
    original = copy.deepcopy(camera.metadata)
    if change == "position":
        camera.position = {"x": 120, "y": 0}
    elif change == "token_rotation":
        camera.metadata = {label: url.replace("token=synthetic", "token=rotated-synthetic") for label, url in original.items()}
    else:
        camera.metadata = {label: url.replace("index=1", "index=2") for label, url in original.items()}
    camera.async_write_ha_state()
    await asyncio.sleep(.01)
    if change == "catalog_aba":
        camera.metadata = original
        camera.async_write_ha_state()
        await asyncio.sleep(.01)
    future.set_result(None)
    result = await pending
    assert result["success"] is allowed, result
    assert len(camera.calls) == 1 and camera.live_calls == [], "ordinary source ticks must not bypass the shared read schedule"


@pytest.mark.parametrize("completion", ["result", "cancelled", "error"])
async def test_timeout_disposes_finished_physical_value_without_another_request(hass, hass_ws_client, monkeypatch, completion):
    from custom_components.houseplan import vacuum_history_websocket as bridge
    monkeypatch.setattr(bridge, "TIMEOUT_S", .02)
    _, _, _, camera, client = await prepared(hass, hass_ws_client)
    listing = await catalog(client)
    future = camera.pending = asyncio.get_running_loop().create_future()
    answer = await geometry(client, listing)
    assert answer["error"]["code"] == "stale"
    physical = hass.data["houseplan_vacuum_path_reads"][SOURCE]
    owned = physical.task
    assert owned is not None and not owned.done()
    if completion == "cancelled":
        future.cancel()
    elif completion == "error":
        future.set_exception(RuntimeError("synthetic provider failure"))
    else:
        future.set_result(None)
    await settle(owned.done)
    assert physical.task is None, "a retired owner must release the completed result without caching its private payload"
    assert len(camera.calls) == 1


async def test_legacy_cancelled_physical_slot_from_an_older_owner_is_drained(hass, hass_ws_client):
    from custom_components.houseplan.vacuum_camera_read import PhysicalRead, read_camera
    _, _, _, camera, _ = await prepared(hass, hass_ws_client)
    previous = asyncio.create_task(asyncio.sleep(100))
    previous.cancel()
    with pytest.raises(asyncio.CancelledError):
        await previous
    physical = {SOURCE: PhysicalRead(task=previous, started=0)}
    async def read():
        return await camera.map_data_string(include_resources=False)
    value, _ = await read_camera(hass, physical, SOURCE, read, lambda: True, lambda: 10.0)
    assert json.loads(value)["history_map"] is False and camera.live_calls == [False]
    assert physical[SOURCE].task is None and physical[SOURCE].started == 10.0


@pytest.fixture(autouse=True)
def custom_integrations(enable_custom_integrations):
    yield


@pytest.mark.parametrize("command", ["capability", "list", "get"])
async def test_history_capability_and_commands(hass, hass_ws_client, command):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    if command == "capability":
        await client.send_json_auto_id({"type": "houseplan/config/get"})
        result = (await client.receive_json())["result"]
        assert result.get("vacuum_history_api") == 1
        return
    message = {"type": f"houseplan/vacuum/history/{command}", "marker_id": "missing"}
    if command == "get":
        message.update(record_id="a" * 64, revision="b" * 64)
    await client.send_json_auto_id(message)
    answer = await client.receive_json()
    assert answer["error"]["code"] == "not_found", answer

async def test_original_producer_optional_slot_through_registered_ws_preserves_store_and_live(hass, hass_ws_client, monkeypatch):
    fixture = json.loads((Path(__file__).resolve().parent.parent /
                          "test/fixtures/vacuum-history/dreame-tasshack-2.0.2-no-slot.json").read_text())
    _, rt, rec, camera, client = await prepared(hass, hass_ws_client)
    camera.metadata = fixture["metadata"]
    camera.payload_by_index = {row["index"]: row["payload"] for row in fixture["records"]}
    camera.async_write_ha_state()
    await hass.async_block_till_done()
    stores = (rt.config_store, rt.store, rec.store)
    before = [copy.deepcopy(await store.async_load()) for store in stores]
    native = copy.deepcopy(rec.book.data)

    async def forbidden(*_, **__):
        pytest.fail("historical preview must not write stores or call robot services")

    for store in stores:
        monkeypatch.setattr(store, "async_save", forbidden)
    monkeypatch.setattr(type(hass.services), "async_call", forbidden)
    listing = await catalog(client)
    assert camera.calls == [] and camera.live_calls == []
    selected = listing["records"][1]
    assert selected["timestamp"] == fixture["records"][1]["timestamp"]
    answer = await request(client, "get", record_id=selected["id"], revision=listing["revision"])
    assert answer["success"], answer
    dto = answer["result"]
    assert dto["id"] == selected["id"] and dto["timestamp"] == selected["timestamp"]
    assert dto["route"] == ROUTE and dto["completed"] is False
    assert dto["paths"] == [[[2000, 0], [3000, 0], [3000, 1000]]]
    assert camera.calls == [(2, False, False, True, False, False, False)] and camera.live_calls == []
    assert rec.book.data == native
    assert [await store.async_load() for store in stores] == before
