"""#996: ordinary config/set, durable storage, CAS and read-only boundaries."""
import copy
import json
from pathlib import Path

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY
from test_ha_websocket import _access_token_for_group, _setup

from custom_components.houseplan.store import get_data


CASES = json.loads((Path(__file__).parents[1] / "test/fixtures/996-room-opening-host-candidates.json").read_text())


@pytest.fixture(autouse=True)
def _custom(enable_custom_integrations):
    yield


@pytest.mark.parametrize("case", CASES, ids=lambda case: f"{case['type']}-reverse-{case['reverse']}")
async def test_issue_996_ordinary_history_and_recreation_are_durable(hass, hass_ws_client, case):
    await _setup(hass)
    client = await hass_ws_client(hass)
    rev = 0
    for candidate in (case["before"], case["deleted"], case["before"], case["deleted"],
                      case["before"], case["deleted"], case["recreated"]):
        await client.send_json_auto_id({"type": "houseplan/config/set", "config": candidate, "expected_rev": rev})
        answer = await client.receive_json()
        assert answer["success"], answer
        rev = answer["result"]["rev"]
        await client.send_json_auto_id({"type": "houseplan/config/get"})
        saved = (await client.receive_json())["result"]
        durable = await get_data(hass).config_store.async_load()
        assert saved["rev"] == rev == durable["rev"]
        assert saved["config"] == durable["config"] == candidate
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": case["deleted"], "expected_rev": rev - 1})
    stale = await client.receive_json()
    assert not stale["success"] and stale["error"]["code"] == "conflict"
    readonly = await hass_ws_client(hass, access_token=await _access_token_for_group(hass, GROUP_ID_READ_ONLY))
    await readonly.send_json_auto_id({"type": "houseplan/config/set", "config": case["deleted"], "expected_rev": rev})
    denied = await readonly.receive_json()
    assert not denied["success"] and denied["error"]["code"] == "unauthorized"
    assert (await get_data(hass).config_store.async_load())["config"] == case["recreated"]


@pytest.mark.parametrize("change", ["contact", "length", "thin", "shift", "wrong-carrier", "future-type"])
async def test_issue_996_unsafe_promotion_never_changes_store_or_revision(hass, hass_ws_client, change):
    await _setup(hass)
    client = await hass_ws_client(hass)
    case = CASES[0]
    source = copy.deepcopy(case["deleted"])
    if change == "future-type":
        source["spaces"][0]["openings"][0]["future_metadata"] = {"enabled": True}
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": source, "expected_rev": 0})
    assert (await client.receive_json())["success"]
    runtime = get_data(hass)
    before = copy.deepcopy(await runtime.config_store.async_load())
    candidate = copy.deepcopy(case["recreated"])
    space = candidate["spaces"][0]
    opening = space["openings"][0]
    wall = next(wall for wall in space["wall_segments"] if wall["id"] == opening["host"]["id"])
    if change == "contact":
        opening["contact"] = "binary_sensor.changed"
    elif change == "length":
        opening["length"] += 0.01
    elif change == "thin":
        wall["cm"] = 10
        for item in space["walls"]:
            if item["a"] == wall["a"] and item["b"] == wall["b"]:
                item["cm"] = 10
    elif change == "shift":
        opening["x"] += 0.01
        opening["host"]["t"] += 0.01 / (wall["b"][0] - wall["a"][0])
    elif change == "future-type":
        opening["future_metadata"] = {"enabled": 1}
    else:
        old_id = wall["id"]
        wall["id"] = opening["host"]["id"] = "wrong-carrier"
        for room in space["rooms"]:
            room["wall_ids"] = ["wrong-carrier" if value == old_id else value for value in room["wall_ids"]]
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": candidate, "expected_rev": before["rev"]})
    refused = await client.receive_json()
    assert not refused["success"] and refused["error"]["code"] == "invalid_partition_opening_host", refused
    assert await runtime.config_store.async_load() == before
