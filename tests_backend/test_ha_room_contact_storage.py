"""#1166: real frontend room candidates reach HA, reload and Undo/Redo writes."""
import copy
import json
from pathlib import Path

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.store import get_data

CASES = json.loads((Path(__file__).parents[1] / "test/fixtures/1166-room-candidates.json").read_text())


@pytest.fixture(autouse=True)
def _custom_components(enable_custom_integrations):
    yield


@pytest.mark.parametrize("case", CASES, ids=lambda case: f'{case["scenario"]}-{case["optimize"]}-{case["reverse"]}')
async def test_room_creation_then_reload_and_geometry_undo_redo(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, case: dict,
) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    runtime = get_data(hass)
    assert runtime is not None
    initial = case["original"] if case["optimize"] else case["source"]
    await runtime.config_store.async_save({"config": copy.deepcopy(initial), "rev": 7})
    await runtime.store.async_save({"layout": {}, "rev": 4})
    client = await hass_ws_client(hass)
    revision = 7
    if case["optimize"]:
        await client.send_json_auto_id({"type": "houseplan/plan/optimize", "config": case["source"],
                                       "layout": {}, "expected_config_rev": 7, "expected_layout_rev": 4})
        response = await client.receive_json()
        assert response["success"], response
        revision = 8
    # Ordinary config/set is the same durable boundary as the real editor.
    sequence = [*case["candidates"], case["candidates"][-2] if len(case["candidates"])>1 else case["source"], case["candidates"][-1]]
    for index, candidate in enumerate(sequence):
        await client.send_json_auto_id({"type": "houseplan/config/set", "config": candidate,
                                       "expected_rev": revision + index})
        response = await client.receive_json()
        assert response["success"], response
        stored = await runtime.config_store.async_load()
        assert stored["rev"] == revision + index + 1
        for field in ("rooms", "wall_segments", "partitions", "openings"):
            assert stored["config"]["spaces"][0].get(field) == candidate["spaces"][0].get(field)
        assert (await runtime.store.async_load())["layout"] == {}
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    reloaded = get_data(hass)
    assert reloaded is not None
    assert await reloaded.config_store.async_load() == stored
    assert len(stored["config"]["spaces"][0]["rooms"]) == len(case["source"]["spaces"][0]["rooms"])+len(case["candidates"])
