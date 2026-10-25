"""#1061: independently generated Align candidates reach the real HA writers."""
import copy
import json
from pathlib import Path

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.store import get_data


@pytest.fixture(autouse=True)
def _custom_components(enable_custom_integrations):
    yield


CASES = json.loads((Path(__file__).parents[1] / "test" / "fixtures"
                    / "1061-align-carrier.json").read_text(encoding="utf-8"))
ROOM_CASES = json.loads((Path(__file__).parents[1] / "test" / "fixtures"
                         / "1061-room-candidates.json").read_text(encoding="utf-8"))


async def _setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    runtime = get_data(hass)
    assert runtime is not None
    return entry, runtime


@pytest.mark.parametrize("case", ROOM_CASES, ids=["first-face", "second-face", "sequential-faces", "on-grid-control"])
async def test_issue_1061_runtime_room_candidates_are_server_accepted(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, case: dict,
) -> None:
    entry, runtime = await _setup(hass)
    await runtime.config_store.async_save({"config": copy.deepcopy(case["source"]), "rev": 7})
    original_layout = {"unrelated": {"s": "remote", "x": 0.875, "y": 0.5}}
    await runtime.store.async_save({"layout": original_layout, "rev": 4})
    client = await hass_ws_client(hass)
    old_room = case["source"]["spaces"][0]["rooms"][0]
    for index, candidate in enumerate(case["candidates"]):
        await client.send_json_auto_id({
            "type": "houseplan/config/set", "config": candidate, "expected_rev": 7 + index,
        })
        accepted = await client.receive_json()
        assert accepted["success"], accepted
        stored = await runtime.config_store.async_load()
        assert stored["rev"] == 8 + index
        space = stored["config"]["spaces"][0]
        assert space["rooms"][0]["poly"] == old_room["poly"]
        assert space["rooms"][0]["wall_ids"] == old_room["wall_ids"]
        assert space["rooms"][0]["future_room"] == old_room["future_room"]
        assert space["openings"] == case["source"]["spaces"][0]["openings"]
        assert stored["config"]["spaces"][1] == candidate["spaces"][1]
        assert stored["config"]["markers"] == candidate["markers"]
        assert len(space["rooms"]) == index + 2
        for field in ("partitions", "wall_segments", "walls"):
            assert space.get(field) == candidate["spaces"][0].get(field)
        assert (await runtime.store.async_load())["layout"] == original_layout
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    reloaded = get_data(hass)
    assert reloaded is not None
    assert await reloaded.config_store.async_load() == stored
    assert (await reloaded.store.async_load())["rev"] == 4


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["name"])
async def test_issue_1061_align_real_writer_and_reload(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, case: dict,
) -> None:
    entry, runtime = await _setup(hass)
    await runtime.config_store.async_save({"config": copy.deepcopy(case["source"]), "rev": 7})
    await runtime.store.async_save({"layout": copy.deepcopy(case["layout"]), "rev": 4})
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({
        "type": "houseplan/plan/optimize", "config": case["candidate"],
        "layout": case["candidateLayout"], "expected_config_rev": 7, "expected_layout_rev": 4,
    })
    response = await client.receive_json()
    assert response["success"], response
    assert response["result"]["config_rev"] == 8
    assert response["result"]["layout_rev"] == 5
    config = await runtime.config_store.async_load()
    layout = await runtime.store.async_load()
    assert config["config"]["spaces"][0]["partitions"] == case["candidate"]["spaces"][0]["partitions"]
    assert config["config"]["spaces"][0]["openings"] == case["candidate"]["spaces"][0]["openings"]
    assert layout["layout"] == case["candidateLayout"]
    assert "optimize_pending" not in layout
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    reloaded = get_data(hass)
    assert reloaded is not None
    assert await reloaded.config_store.async_load() == config
    assert await reloaded.store.async_load() == layout

    # One-deep Optimize Undo is the existing paired transaction, not a new lane.
    restored_client = await hass_ws_client(hass)
    await restored_client.send_json_auto_id({
        "type": "houseplan/plan/optimize_undo", "expected_config_rev": 8, "expected_layout_rev": 5,
    })
    undone = await restored_client.receive_json()
    assert undone["success"], undone
    restored_config = await reloaded.config_store.async_load()
    assert restored_config["config"]["spaces"][0]["partitions"] == case["source"]["spaces"][0]["partitions"]
    assert restored_config["config"]["spaces"][0]["openings"] == case["source"]["spaces"][0]["openings"]
    assert restored_config["rev"] == 9
    assert (await reloaded.store.async_load())["rev"] == 6


@pytest.mark.parametrize("mutation", ["short-a", "narrower", "host-drop", "host-drop-config-set", "foreign-host", "jamb", "stale-config", "stale-layout", "old-host-fit"])
async def test_issue_1061_bad_optimize_is_atomic(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, mutation: str,
) -> None:
    case = copy.deepcopy(CASES[1])
    if mutation == "old-host-fit":
        case["source"]["spaces"][0]["openings"][0]["length"] = 0.5001
        case["candidate"]["spaces"][0]["openings"] = []
    _, runtime = await _setup(hass)
    await runtime.config_store.async_save({"config": case["source"], "rev": 7})
    await runtime.store.async_save({"layout": case["layout"], "rev": 4})
    before = copy.deepcopy((await runtime.config_store.async_load(), await runtime.store.async_load()))
    config_rev, layout_rev = 7, 4
    space = case["candidate"]["spaces"][0]
    if mutation == "short-a":
        space["partitions"][0]["a"][0] += 0.00001
    elif mutation == "narrower":
        space["partitions"][0]["cm"] = 10
    elif mutation in {"host-drop", "host-drop-config-set"}:
        space["openings"][0].pop("host")
    elif mutation == "foreign-host":
        space["openings"][0]["host"]["id"] = "foreign"
    elif mutation == "jamb":
        space["openings"][0]["length"] = 0.49
    elif mutation == "stale-config":
        config_rev -= 1
    elif mutation == "stale-layout":
        layout_rev -= 1
    client = await hass_ws_client(hass)
    message = {
        "type": "houseplan/plan/optimize", "config": case["candidate"],
        "layout": case["candidateLayout"], "expected_config_rev": config_rev, "expected_layout_rev": layout_rev,
    }
    if mutation == "host-drop-config-set":
        message = {"type": "houseplan/config/set", "config": case["candidate"], "expected_rev": config_rev}
    await client.send_json_auto_id(message)
    refused = await client.receive_json()
    assert not refused["success"], refused
    expected = "conflict" if mutation.startswith("stale-") else (
        "invalid_partition_opening_jamb_margin" if mutation == "jamb" else (
            "invalid_format" if mutation == "foreign-host" else "invalid_partition_opening_host"
        )
    )
    assert refused["error"]["code"] == expected, refused
    assert (await runtime.config_store.async_load(), await runtime.store.async_load()) == before
