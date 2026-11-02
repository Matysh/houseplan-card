"""Actual HA first structural write publishes graph+bounded source reference."""
import copy

import pytest

from custom_components.houseplan.store import get_data
from custom_components.houseplan.plan_graph_source import BACKUP_KEY, PASSPORT_KEY, load_source
from tests_backend.test_ha_structural_upload import _setup, TYPE
from tests_backend.test_graph_write import legacy


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
