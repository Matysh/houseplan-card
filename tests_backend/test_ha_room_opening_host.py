"""#996: ordinary config/set, durable storage, CAS and read-only boundaries."""
import copy
import json
from pathlib import Path

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY
from test_ha_websocket import _access_token_for_group, _setup

from custom_components.houseplan.store import get_data
from custom_components.houseplan.room_appearance import normalize_room_appearance
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model
from custom_components.houseplan.plan_graph import project_graph_space
from custom_components.houseplan.plan_graph_exact import encode_rational, parse_decimal


CASES = json.loads((Path(__file__).parents[1] / "test/fixtures/996-room-opening-host-candidates.json").read_text())


def current(candidate):
    """Decode the captured model10 snapshots before sending current writes."""
    return normalize_room_appearance(commit_wall_segment_model(candidate)[0])


@pytest.fixture(autouse=True)
def _custom(enable_custom_integrations):
    yield


@pytest.mark.parametrize("case", CASES, ids=lambda case: f"{case['type']}-reverse-{case['reverse']}")
async def test_issue_996_ordinary_history_and_recreation_are_durable(hass, hass_ws_client, case):
    await _setup(hass)
    client = await hass_ws_client(hass)
    rev = 0
    for captured in (case["before"], case["deleted"], case["before"], case["deleted"],
                     case["before"], case["deleted"], case["recreated"]):
        candidate = current(captured)
        await client.send_json_auto_id({"type": "houseplan/config/set", "config": candidate, "expected_rev": rev})
        answer = await client.receive_json()
        assert answer["success"], answer
        rev = answer["result"]["rev"]
        await client.send_json_auto_id({"type": "houseplan/config/get"})
        saved = (await client.receive_json())["result"]
        durable = await get_data(hass).config_store.async_load()
        assert saved["rev"] == rev == durable["rev"]
        assert saved["config"] == durable["config"] == candidate
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": current(case["deleted"]), "expected_rev": rev - 1})
    stale = await client.receive_json()
    assert not stale["success"] and stale["error"]["code"] == "conflict"
    readonly = await hass_ws_client(hass, access_token=await _access_token_for_group(hass, GROUP_ID_READ_ONLY))
    await readonly.send_json_auto_id({"type": "houseplan/config/set", "config": current(case["deleted"]), "expected_rev": rev})
    denied = await readonly.receive_json()
    assert not denied["success"] and denied["error"]["code"] == "unauthorized"
    assert (await get_data(hass).config_store.async_load())["config"] == current(case["recreated"])


@pytest.mark.parametrize("change", ["contact", "length", "thin", "shift", "wrong-carrier", "future-type"])
async def test_issue_996_unsafe_promotion_never_changes_store_or_revision(hass, hass_ws_client, change):
    await _setup(hass)
    client = await hass_ws_client(hass)
    case = CASES[0]
    source = current(case["deleted"])
    if change == "future-type":
        source["spaces"][0]["openings"][0]["future_metadata"] = {"enabled": True}
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": source, "expected_rev": 0})
    assert (await client.receive_json())["success"]
    runtime = get_data(hass)
    before = copy.deepcopy(await runtime.config_store.async_load())
    candidate = current(case["recreated"])
    space = candidate["spaces"][0]
    opening = space["openings"][0]
    wall = next(wall for wall in space["wall_segments"] if wall["id"] == opening["host"]["id"])
    if change == "contact":
        opening["contact"] = "binary_sensor.changed"
    elif change == "length":
        opening["length"] += 0.01
    elif change == "thin":
        next(edge for edge in space["plan_graph"]["edges"] if edge["id"] == wall["id"])["cm"] = 10
        candidate["spaces"][0] = project_graph_space(space, space["plan_graph"])["space"]
    elif change == "shift":
        opening["x"] += 0.01
        opening["host"]["t"] += 0.01 / (wall["b"][0] - wall["a"][0])
        opening["host"]["tq"] = encode_rational(parse_decimal(opening["host"]["t"]))
        candidate["spaces"][0] = project_graph_space(space, space["plan_graph"])["space"]
    elif change == "future-type":
        opening["future_metadata"] = {"enabled": 1}
    else:
        old_id = wall["id"]
        opening["host"]["id"] = "wrong-carrier"
        for edge in space["plan_graph"]["edges"]:
            if edge["id"] == old_id:
                edge["id"] = "wrong-carrier"
        for room in space["plan_graph"]["rooms"]:
            for edge in room["edges"]:
                if edge["id"] == old_id:
                    edge["id"] = "wrong-carrier"
        space["plan_graph"]["edges"].sort(key=lambda edge: f"{edge['kind']}:{edge['id']}")
        candidate["spaces"][0] = project_graph_space(space, space["plan_graph"])["space"]
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": candidate, "expected_rev": before["rev"]})
    refused = await client.receive_json()
    assert not refused["success"] and refused["error"]["code"] == "invalid_partition_opening_host", refused
    assert await runtime.config_store.async_load() == before
