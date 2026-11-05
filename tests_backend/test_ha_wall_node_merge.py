"""Real authenticated HA WS/Store path; no replacement geometry planner."""
import copy

import pytest

from test_ha_wall_node_delete import setup
from test_wall_node_merge import CASES, config, intent
from custom_components.houseplan import websocket_api as endpoint
from custom_components.houseplan.store import get_data


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


def message(snapshot, operation, **extra):
    return {"type": "houseplan/wall/node_move", "space_id": "f", "expected_rev": snapshot["rev"], "intent": operation, **extra}


@pytest.mark.parametrize("kind", ["independent", "adjacent", "compact-opening", "last-edge"])
async def test_merge_ack_store_reload_inverse_and_cas(hass, hass_ws_client, kind):
    case = copy.deepcopy(CASES[{"independent": 0, "adjacent": 1, "compact-opening": 2, "last-edge": 3}[kind]])
    if kind == "compact-opening":
        case["walls"] = [{**w, "cm": 10} for w in case["walls"]]
        case["openings"] = [{"id": "door", "type": "door", "x": .75, "y": 0, "angle": 0, "length": .1,
                             "host": {"kind": "partition", "id": "b", "t": .5}, "flip_h": True}]
    entry, client, before = await setup(hass, hass_ws_client, source=config(case))
    assert before["wall_node_merge_api"] == 1 and before["wall_node_move_api"] == 1
    original = copy.deepcopy(before["config"]["spaces"][0])
    operation = intent(original, case)
    events = []
    unsub = hass.bus.async_listen("houseplan_config_updated", lambda event: events.append(event.data))
    await client.send_json_auto_id(message(before, operation))
    response = await client.receive_json()
    assert response["success"], response
    after = response["result"]
    assert after["rev"] == before["rev"] + 1
    assert operation["node_id"] not in {n["id"] for n in after["config"]["spaces"][0]["plan_graph"]["nodes"]}
    assert (await get_data(hass).config_store.async_load())["config"] == after["config"]
    await client.send_json_auto_id(message(before, operation))
    assert (await client.receive_json())["error"]["code"] == "conflict"
    await client.send_json_auto_id(message(after, operation, direction="undo", before_space=original))
    undone = await client.receive_json()
    assert undone["success"], undone
    assert undone["result"]["config"] == before["config"]
    await client.send_json_auto_id(message(undone["result"], operation))
    redone = await client.receive_json()
    assert redone["success"], redone
    assert redone["result"]["config"] == after["config"]
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    reread = (await client.receive_json())["result"]
    assert reread["config"] == after["config"] and reread["rev"] == redone["result"]["rev"]
    assert len(events) == 3
    unsub()


@pytest.mark.parametrize("reason", ["opening", "target", "topology"])
async def test_invalid_merge_does_not_mutate_or_emit(hass, hass_ws_client, reason):
    case = copy.deepcopy(CASES[1 if reason == "opening" else 4 if reason == "topology" else 0])
    if reason == "opening":
        case["walls"] = [{**w, "cm": 10} for w in case["walls"]]
        case["openings"] = [{"id": "door", "type": "door", "x": 1.5, "y": 0, "angle": 0, "length": .1,
                             "host": {"kind": "partition", "id": "b", "t": .5}}]
    _, client, before = await setup(hass, hass_ws_client, source=config(case))
    operation = intent(before["config"]["spaces"][0], case)
    if reason == "target":
        operation["target_p"] = ["l", "239", "240"]
    events = []
    unsub = hass.bus.async_listen("houseplan_config_updated", lambda event: events.append(event.data))
    await client.send_json_auto_id(message(before, operation))
    response = await client.receive_json()
    assert not response["success"] and response["error"]["code"] == "node_move_merge_" + reason, response
    saved = await get_data(hass).config_store.async_load()
    assert saved["config"] == before["config"] and saved["rev"] == before["rev"]
    assert events == []
    unsub()


async def test_merge_save_failure_and_revoked_write_permission(hass, hass_ws_client, monkeypatch):
    case = CASES[0]
    _, client, before = await setup(hass, hass_ws_client, source=config(case))
    operation = intent(before["config"]["spaces"][0], case)
    original = endpoint.async_save_config_state

    async def failure(*args, **kwargs):
        from custom_components.houseplan.import_export import ImportFailure
        raise ImportFailure("commit_failed")

    monkeypatch.setattr(endpoint, "async_save_config_state", failure)
    await client.send_json_auto_id(message(before, operation))
    response = await client.receive_json()
    assert not response["success"], response
    saved = await get_data(hass).config_store.async_load()
    assert saved["config"] == before["config"] and saved["rev"] == before["rev"]
    monkeypatch.setattr(endpoint, "async_save_config_state", original)
    monkeypatch.setattr(endpoint, "_check_write", lambda *args: False)
    await client.send_json_auto_id(message(before, operation))
    response = await client.receive_json()
    assert not response["success"] and response["error"]["code"] == "unauthorized", response
    assert (await get_data(hass).config_store.async_load()) == saved


async def test_first_legacy_merge_adopts_one_graph_and_undo_uses_normalized_baseline(hass, hass_ws_client):
    from custom_components.houseplan.graph_write import normalize_graph_config

    case = CASES[0]
    _, client, current = await setup(hass, hass_ws_client, source=config(case))
    raw = copy.deepcopy(current["config"])
    raw["model_version"] = 10
    for space in raw["spaces"]:
        space.pop("plan_graph", None)
    runtime = get_data(hass)
    await runtime.config_store.async_save({"config": raw, "rev": current["rev"]})
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    before = (await client.receive_json())["result"]
    assert before["config"]["model_version"] == 10
    assert (await runtime.config_store.async_load())["config"] == raw
    normalized = normalize_graph_config(before["config"])
    operation = intent(normalized["spaces"][0], case)
    await client.send_json_auto_id(message(before, operation))
    accepted = await client.receive_json()
    assert accepted["success"], accepted
    assert accepted["result"]["config"]["model_version"] == 11
    await client.send_json_auto_id(message(accepted["result"], operation, direction="undo", before_space=normalized["spaces"][0]))
    undone = await client.receive_json()
    assert undone["success"], undone
    assert undone["result"]["config"] == normalized


@pytest.mark.parametrize("rule", ["valence", "angle"])
async def test_merge_rechecks_final_junction_limits_on_backend(hass, hass_ws_client, rule):
    if rule == "valence":
        case = {"point": [0, -1], "target": [0, 0], "walls": [
            {"id": name, "a": [0, -1], "b": end, "cm": 0} for name, end in
            zip(("a", "b", "c", "d"), ([-3, -2], [-1, -3], [1, -3], [3, -2]), strict=True)] + [
            {"id": name, "a": [0, 0], "b": end, "cm": 0} for name, end in
            zip(("e", "f", "g"), ([3, 0], [0, 3], [-3, 0]), strict=True)]}
    else:
        case = {"point": [0, 1], "target": [0, 0], "walls": [
            {"id": "a", "a": [0, 1], "b": [3, .1], "cm": 0}, {"id": "b", "a": [0, 0], "b": [3, 0], "cm": 0}]}
    _, client, before = await setup(hass, hass_ws_client, source=config(case))
    operation = intent(before["config"]["spaces"][0], case)
    await client.send_json_auto_id(message(before, operation))
    response = await client.receive_json()
    assert not response["success"] and response["error"]["code"] == "junction_limit_" + rule, response
    saved = await get_data(hass).config_store.async_load()
    assert saved["config"] == before["config"] and saved["rev"] == before["rev"]
