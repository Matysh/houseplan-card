"""Actual HA first structural write publishes graph+bounded source reference."""
import copy

import pytest

from custom_components.houseplan.store import get_data
from custom_components.houseplan.plan_graph_source import BACKUP_KEY, PASSPORT_KEY, load_source
from tests_backend.test_ha_structural_upload import _setup, TYPE
from tests_backend.test_graph_write import legacy
from tests_backend.test_graph_node_write import config as graph_config, node_at


@pytest.fixture(autouse=True)
def _enable(enable_custom_integrations):
    yield


@pytest.mark.asyncio
async def test_legacy_read_metadata_and_first_structural_pair(hass, hass_client, hass_access_token):
    _, socket, _ = await _setup(hass, hass_client, hass_access_token)
    runtime = get_data(hass)
    source = legacy()
    await runtime.config_store.async_save({"config": source, "rev": 9})
    await runtime.store.async_save({"layout": {}, "rev": 3})
    pair = await socket.pair()
    assert pair[0]["config"]["model_version"] == 10
    assert BACKUP_KEY not in await runtime.store.async_load()
    metadata = copy.deepcopy(pair[0]["config"])
    metadata["spaces"][0]["title"] = "Metadata only"
    saved = await socket.send({"type": TYPE, "config": metadata, "expected_rev": pair[0]["rev"]})
    assert saved["success"], saved
    pair = await socket.pair()
    assert pair[0]["config"]["model_version"] == 10
    edit = copy.deepcopy(pair[0]["config"])
    edit["spaces"][0]["partitions"][1]["b"] = [.5, .6]
    saved = await socket.send({"type": TYPE, "config": edit, "expected_rev": pair[0]["rev"]})
    assert saved["success"], saved
    accepted = await socket.pair()
    assert accepted[0]["config"]["model_version"] == 11
    assert saved["result"]["config"] == accepted[0]["config"]
    layout_data = await runtime.store.async_load()
    assert layout_data[PASSPORT_KEY]["target_model"] == 11
    original = await load_source(hass, layout_data[BACKUP_KEY])
    assert original["config"] == pair[0]["config"]
    assert len(str(layout_data[BACKUP_KEY])) < 400
    exported = await socket.send({"type": "houseplan/export/create", "kind": "full", "plan_graph_migration_source": True})
    assert exported["success"], exported
    assert exported["result"]["document"]["payload"]["config"] == pair[0]["config"]
    stale = copy.deepcopy(accepted[0]["config"])
    stale["spaces"][0]["partitions"][0]["a"][0] += .1
    refused = await socket.send({"type": TYPE, "config": stale, "expected_rev": accepted[0]["rev"]})
    assert not refused["success"]
    assert await socket.pair() == accepted


@pytest.mark.asyncio
async def test_current_graph_node_ws_and_undo_keep_authoritative_graph(hass, hass_client, hass_access_token):
    _, socket, _ = await _setup(hass, hass_client, hass_access_token)
    runtime = get_data(hass)
    before = graph_config([{"id": "a", "a": [0, 0], "b": [1, 0], "cm": 10}])
    await runtime.config_store.async_save({"config": before, "rev": 20})
    space = before["spaces"][0]
    intent = {"node_id": node_at(space, [0, 0]), "point": [0, 0], "target": [0, .25], "target_p": ["l", "0", "60"], "axis": None, "split_ids": {}}
    moved = await socket.send({"type": "houseplan/wall/node_move", "space_id": "s", "expected_rev": 20, "intent": intent})
    assert moved["success"], moved
    pair = await socket.pair()
    assert pair[0]["config"]["spaces"][0]["partitions"][0]["a"] == [0, .25]
    undone = await socket.send({"type": "houseplan/wall/node_move", "space_id": "s", "expected_rev": pair[0]["rev"], "intent": intent, "direction": "undo", "before_space": space})
    assert undone["success"], undone
    after = await socket.pair()
    assert after[0]["config"]["spaces"][0]["plan_graph"] == space["plan_graph"]


@pytest.mark.asyncio
@pytest.mark.parametrize("boundary", ["source_failure", "permission_after_source"])
async def test_source_precedes_pair_intent_and_authority_is_rechecked(
    hass, hass_client, hass_access_token, monkeypatch, boundary,
):
    from homeassistant.auth.const import GROUP_ID_READ_ONLY
    from custom_components.houseplan import plan_graph_source
    from tests_backend.test_ha_structural_upload import _user, _observe_saves
    _, owner, _ = await _setup(hass, hass_client, hass_access_token, household=True)
    user, _, writer = await _user(hass, hass_client)
    runtime = get_data(hass)
    source = legacy()
    await runtime.config_store.async_save({"config": source, "rev": 9})
    await runtime.store.async_save({"layout": {}, "rev": 3, "future_metadata": {"kept": True}})
    before = await owner.pair()
    stored_before = copy.deepcopy(await runtime.store.async_load())
    edit = copy.deepcopy(source)
    edit["spaces"][0]["partitions"][1]["b"] = [.5, .6]
    real_save = plan_graph_source.save_source
    observed = []

    async def boundary_save(hass_arg, logical):
        observed.append(copy.deepcopy(logical))
        if boundary == "source_failure":
            raise OSError("controlled source storage refusal")
        reference = await real_save(hass_arg, logical)
        assert await plan_graph_source.load_source(hass_arg, reference) == logical
        await hass.auth.async_update_user(user, group_ids=[GROUP_ID_READ_ONLY])
        return reference

    monkeypatch.setattr(plan_graph_source, "save_source", boundary_save)
    saves = _observe_saves(hass, monkeypatch)
    refused = await writer.send({"type": TYPE, "config": edit, "expected_rev": 9})
    assert not refused["success"], refused
    assert refused["error"]["code"] == ("migration_source_unavailable" if boundary == "source_failure" else "unauthorized")
    assert len(observed) == 1 and observed[0]["config"] == source
    assert saves == {"config": 0, "layout": 0}
    assert await owner.pair() == before
    assert await runtime.store.async_load() == stored_before


@pytest.mark.asyncio
async def test_first_graph_change_rebases_on_backend_source_and_returns_exact_truth(
    hass, hass_client, hass_access_token,
):
    from custom_components.houseplan.graph_write import normalize_graph_config
    from custom_components.houseplan.plan_graph import apply_graph_patch, project_graph_space
    from custom_components.houseplan.plan_graph_exact import decode_point, read_source_point
    _, socket, _ = await _setup(hass, hass_client, hass_access_token)
    runtime = get_data(hass)
    raw = legacy()
    await runtime.config_store.async_save({"config": raw, "rev": 9})
    await runtime.store.async_save({"layout": {}, "rev": 3})
    baseline = normalize_graph_config(raw)
    before = baseline["spaces"][0]
    leaf = next(node for node in before["plan_graph"]["nodes"] if decode_point(node["p"]) == read_source_point([.5, .5]))
    moved = {**leaf, "p": ["l", "120", "180"]}
    patch = {name: {"set": [], "remove": []} for name in ("nodes", "edges", "rooms", "dependencies")}
    patch["nodes"]["set"] = [moved]
    graph = apply_graph_patch(before["plan_graph"], patch)["graph"]
    candidate = copy.deepcopy(baseline)
    candidate["spaces"][0] = project_graph_space(before, graph)["space"]
    diagnostic = copy.deepcopy(before["plan_graph"])
    untouched = next(node for node in diagnostic["nodes"] if node["id"] != leaf["id"])
    untouched["p"] = ["l", "999", "999"]
    reply = await socket.send({"type": TYPE, "expected_rev": 9, "config": candidate,
        "graph_change": {"version": 1, "spaces": [{"space_id": before["id"], "base": diagnostic, "patch": patch}]}})
    assert reply["success"], reply
    actual = await socket.pair()
    assert actual[0]["config"] == reply["result"]["config"]
    for field in ("plan_graph", "partitions", "walls", "wall_segments", "rooms"):
        assert actual[0]["config"]["spaces"][0][field] == candidate["spaces"][0][field]
    stored = await runtime.store.async_load()
    assert (await load_source(hass, stored[BACKUP_KEY]))["config"] == raw
    stale = await socket.send({"type": TYPE, "expected_rev": actual[0]["rev"], "config": raw})
    assert not stale["success"] and stale["error"]["code"] == "wall_model_client_outdated"
    assert await socket.pair() == actual


@pytest.mark.asyncio
async def test_current_opening_crosses_atomic_host_seam_and_undo_via_real_config_writer(
    hass, hass_client, hass_access_token,
):
    from tests_backend.test_graph_host_continuity import space, _rehost, _config
    _, socket, _ = await _setup(hass, hass_client, hass_access_token)
    runtime = get_data(hass)
    from custom_components.houseplan.room_appearance import normalize_room_appearance
    before = normalize_room_appearance(_config(_rehost(space(), "one", ("1", "2"))))
    await runtime.config_store.async_save({"config": before, "rev": 40, "model_version": 11})
    await runtime.store.async_save({"layout": {}, "rev": 7})
    after = copy.deepcopy(before)
    after["spaces"][0] = _rehost(before["spaces"][0])
    saved = await socket.send({"type": TYPE, "config": after, "expected_rev": 40})
    assert saved["success"], saved
    accepted = await socket.pair()
    assert saved["result"]["config"] == accepted[0]["config"] == after
    assert accepted[0]["rev"] == 41 and accepted[1]["rev"] == 7
    assert after["spaces"][0]["openings"][0]["host"]["id"] == "two"
    undone = await socket.send({"type": TYPE, "config": before, "expected_rev": 41})
    assert undone["success"], undone
    assert (await socket.pair())[0]["config"] == before


async def test_new_migration_after_legacy_edit_keeps_fresh_source_and_exportable_history(hass,hass_client,hass_access_token):
    from custom_components.houseplan.plan_graph_source import PREVIOUS_BACKUP_KEY
    _, socket, _ = await _setup(hass,hass_client,hass_access_token)
    runtime=get_data(hass)
    original=legacy()
    await runtime.config_store.async_save({"config":original,"rev":1})
    await runtime.store.async_save({"layout":{},"rev":1})
    edit=copy.deepcopy(original);edit["spaces"][0]["partitions"][1]["b"]=[.5,.6]
    assert (await socket.send({"type":TYPE,"config":edit,"expected_rev":1}))["success"]
    saved=await runtime.store.async_load();first=saved[BACKUP_KEY]
    first_source=await load_source(hass,first)
    # An older backend can author legacy geometry/layout after a downgrade.
    later=legacy();later["spaces"][0]["title"]="Changed on old version"
    await runtime.config_store.async_save({"config":later,"rev":20})
    await runtime.store.async_save({**saved,"layout":{"independent":{"s":"s","x":.1,"y":.2}},"rev":21})
    before=await socket.pair();edit=copy.deepcopy(before[0]["config"])
    edit["spaces"][0]["partitions"][1]["b"]=[.5,.7]
    reply=await socket.send({"type":TYPE,"config":edit,"expected_rev":20})
    assert reply["success"],reply
    current=await runtime.store.async_load();second=current[BACKUP_KEY]
    assert second["sha256"]!=first["sha256"]
    source=await load_source(hass,second)
    assert source["config"]==later and source["layout"]==before[1]["layout"]
    assert source["config_rev"]==20 and source["layout_rev"]==21
    assert source["passports"][PREVIOUS_BACKUP_KEY]==first
    assert await load_source(hass,first)==first_source
    exported=await socket.send({"type":"houseplan/export/create","kind":"full","plan_graph_migration_source":True,"migration_source_sha256":first["sha256"]})
    assert exported["success"],exported
    assert exported["result"]["document"]["payload"]["config"]==first_source["config"]


async def test_real_v2_first_write_adopts_server_pair_even_with_diagnostic_mismatch(hass,hass_client,hass_access_token):
    from custom_components.houseplan.graph_write import normalize_graph_config
    from custom_components.houseplan.plan_graph import project_graph_space
    from custom_components.houseplan.plan_graph_exact import decode_point,to_numbers
    from tests_backend.test_graph_write import empty_patch
    _,socket,_=await _setup(hass,hass_client,hass_access_token)
    runtime=get_data(hass);before=legacy()
    await runtime.config_store.async_save({"config":before,"rev":30})
    capabilities=await socket.send({"type":"houseplan/config/get"})
    assert capabilities["result"]["graph_change_api"]==2
    candidate=normalize_graph_config(before);space=candidate["spaces"][0]
    graph=copy.deepcopy(space["plan_graph"])
    node=next(n for n in graph["nodes"] if to_numbers(decode_point(n["p"]))==[.5,.5])
    node["p"]=["l","120","168"]
    candidate["spaces"][0]=project_graph_space(space,graph)["space"]
    patch=empty_patch();patch["nodes"]["set"]=[node]
    response=await socket.send({"type":TYPE,"config":candidate,"expected_rev":30,
        "graph_change":{"version":2,"spaces":[{"space_id":"s","base_digest":"0"*64,"patch":patch}]}})
    assert response["success"],response
    accepted=await socket.pair()
    assert response["result"]["config"]==accepted[0]["config"]
    assert accepted[0]["rev"]==31
    assert next(n for n in accepted[0]["config"]["spaces"][0]["plan_graph"]["nodes"] if n["id"]==node["id"])["p"]==node["p"]


async def test_real_projection_room_count_refusal_is_atomic_and_public(hass,hass_client,hass_access_token):
    from custom_components.houseplan.graph_write import normalize_graph_config
    _,socket,_=await _setup(hass,hass_client,hass_access_token)
    runtime=get_data(hass);source=legacy()
    source["spaces"][0]["rooms"]=[{"id":"r","poly":[[0,0],[1,0],[1,1],[0,1]]}]
    current=normalize_graph_config(source)
    await runtime.config_store.async_save({"config":current,"rev":50})
    before=await socket.pair();candidate=copy.deepcopy(before[0]["config"])
    candidate["spaces"][0]["rooms"]=[]
    refused=await socket.send({"type":TYPE,"config":candidate,"expected_rev":50})
    assert not refused["success"] and refused["error"]["code"]=="plan_graph_projection_mismatch",refused
    assert await socket.pair()==before
