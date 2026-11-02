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
