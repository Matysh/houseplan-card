"""Real authenticated HA WS, Store, ACL, CAS and reload for the named attach."""
import copy
import pytest
from test_ha_wall_node_delete import setup
from test_wall_node_attach import CASES, ID, config, intent
from custom_components.houseplan import websocket_api as endpoint
from custom_components.houseplan.store import get_data


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


def message(snapshot, operation, **extra):
    return {"type": "houseplan/wall/node_move", "space_id": "f", "expected_rev": snapshot["rev"], "intent": operation, **extra}


@pytest.mark.parametrize("name", ["horizontal wall", "vertical reversed host", "diagonal exact q", "zero partition", "mixed thickness", "receiver opening first child", "receiver opening second child reversed", "branch opening fixed far center", "receiver 1 room owners", "receiver 2 room owners", "remote split dependency reparameterizes fixed point", "remote split dependency retires at bend", "foreign exact q fixed end", "bent branch opening retains fixed-far distance"])
async def test_attach_ack_exact_store_inverse_redo_cas_reload(hass, hass_ws_client, name):
    case = next(c for c in CASES if c["name"] == name)
    entry, client, before = await setup(hass, hass_ws_client, source=config(case))
    assert before["wall_node_attach_api"] == 1
    original = copy.deepcopy(before["config"]["spaces"][0])
    operation = intent(original, case)
    events = []
    unsub = hass.bus.async_listen("houseplan_config_updated", lambda event: events.append(event.data))
    await client.send_json_auto_id(message(before, operation))
    response = await client.receive_json()
    assert response["success"], response
    after = response["result"]
    assert after["rev"] == before["rev"] + 1
    graph = after["config"]["spaces"][0]["plan_graph"]
    assert len([e for e in graph["edges"] if "s" in (e["from"], e["to"])]) == 3
    assert any(e["id"] == ID for e in graph["edges"])
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


@pytest.mark.parametrize("name", ["corner source is excluded", "passing source is excluded", "positive collinear overlap", "new foreign crossing", "receiver opening footprint", "receiver opening jamb"])
async def test_attach_refusal_leaves_store_and_events_untouched(hass, hass_ws_client, name):
    case = next(c for c in CASES if c["name"] == name)
    _, client, before = await setup(hass, hass_ws_client, source=config(case))
    events = []
    unsub = hass.bus.async_listen("houseplan_config_updated", lambda event: events.append(event.data))
    await client.send_json_auto_id(message(before, intent(before["config"]["spaces"][0], case)))
    response = await client.receive_json()
    assert not response["success"] and response["error"]["code"] == "node_move_" + case["reason"], response
    saved = await get_data(hass).config_store.async_load()
    assert saved["config"] == before["config"] and saved["rev"] == before["rev"] and events == []
    unsub()


async def test_attach_save_failure_and_revoked_acl_do_not_mutate(hass, hass_ws_client, monkeypatch):
    _, client, before = await setup(hass, hass_ws_client, source=config(CASES[0]))
    operation = intent(before["config"]["spaces"][0], CASES[0])
    original = endpoint.async_save_config_state
    async def failure(*args, **kwargs):
        from custom_components.houseplan.import_export import ImportFailure
        raise ImportFailure("commit_failed")
    monkeypatch.setattr(endpoint, "async_save_config_state", failure)
    await client.send_json_auto_id(message(before, operation))
    assert not (await client.receive_json())["success"]
    saved = await get_data(hass).config_store.async_load()
    assert saved["config"] == before["config"] and saved["rev"] == before["rev"]
    monkeypatch.setattr(endpoint, "async_save_config_state", original)
    monkeypatch.setattr(endpoint, "_check_write", lambda *args: False)
    await client.send_json_auto_id(message(before, operation))
    response = await client.receive_json()
    assert not response["success"] and response["error"]["code"] == "unauthorized", response
    assert (await get_data(hass).config_store.async_load()) == saved


@pytest.mark.parametrize("rule,tq,far", [("length", ["1", "120"], [120, 180]), ("distance", ["1", "400"], [120, 180]), ("angle", ["1", "2"], [230, 1])])
async def test_attach_preserves_late_physical_limits(hass, hass_ws_client, rule, tq, far):
    case = copy.deepcopy(CASES[0])
    case["tq"] = tq
    # The original branch is already valid; the new nearly horizontal arm is not.
    if rule == "angle":
        next(n for n in case["graph"]["nodes"] if n["id"] == "f")["p"] = ["l", str(far[0]), str(far[1])]
        next(n for n in case["graph"]["nodes"] if n["id"] == "s")["p"] = ["l", "120", "120"]
    _, client, before = await setup(hass, hass_ws_client, source=config(case))
    await client.send_json_auto_id(message(before, intent(before["config"]["spaces"][0], case)))
    response = await client.receive_json()
    expected = "junction_limit_angle" if rule == "angle" else "node_move_merge_topology"
    assert not response["success"] and response["error"]["code"] == expected, response
    saved = await get_data(hass).config_store.async_load()
    assert saved["config"] == before["config"] and saved["rev"] == before["rev"]
