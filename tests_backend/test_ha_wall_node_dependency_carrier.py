"""#1303: real authenticated node endpoint, atomic store, history and reload."""
import copy
import json
from pathlib import Path

import pytest
from test_ha_wall_node_delete import setup
from custom_components.houseplan.plan_graph import project_graph_space
from custom_components.houseplan.store import get_data


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


async def test_bent_carrier_node_move_keeps_far_nodes_through_store_undo_redo_reload(hass, hass_ws_client):
    graph = json.loads((Path(__file__).resolve().parents[1] / "test/fixtures/1303-bent-carrier.json").read_text())
    space = project_graph_space({"id": "floor", "title": "Floor", "cell_cm": 1,
                                 "rooms": [], "openings": []}, graph)["space"]
    entry, client, before = await setup(hass, hass_ws_client,
        source={"model_version": 11, "spaces": [space], "markers": [], "settings": {}})
    old = {n["id"]: n["p"] for n in before["config"]["spaces"][0]["plan_graph"]["nodes"]}
    intent = {"node_id": "drag-end", "point": [726 / 240, 451 / 240],
              "target": [727 / 240, 451 / 240], "target_p": ["l", "727", "451"], "axis": None, "split_ids": {}}
    events = []
    unsubscribe = hass.bus.async_listen("houseplan_config_updated", lambda event: events.append(copy.deepcopy(event.data)))
    try:
        await client.send_json_auto_id({"type": "houseplan/wall/node_move", "space_id": "floor",
                                       "expected_rev": before["rev"], "intent": intent})
        response = await client.receive_json()
        assert response["success"], response
        accepted = response["result"]
        assert accepted["rev"] == before["rev"] + 1
        actual = accepted["config"]["spaces"][0]["plan_graph"]
        assert all(n["p"] == old[n["id"]] for n in actual["nodes"] if n["id"] != "drag-end")
        assert not any(d["node"] == "junction" for d in actual["dependencies"])
        runtime = get_data(hass)
        assert (await runtime.config_store.async_load())["config"] == accepted["config"]
        await client.send_json_auto_id({"type": "houseplan/wall/node_move", "space_id": "floor",
            "expected_rev": accepted["rev"], "intent": intent, "direction": "undo", "before_space": before["config"]["spaces"][0]})
        undone = await client.receive_json()
        assert undone["success"], undone
        assert undone["result"]["config"] == before["config"]
        await client.send_json_auto_id({"type": "houseplan/wall/node_move", "space_id": "floor",
                                       "expected_rev": undone["result"]["rev"], "intent": intent})
        redone = await client.receive_json()
        assert redone["success"] and redone["result"]["config"] == accepted["config"]
        await hass.async_block_till_done()
        assert [e["rev"] for e in events] == [before["rev"] + n for n in (1, 2, 3)]
        assert await hass.config_entries.async_reload(entry.entry_id)
        await hass.async_block_till_done()
        await client.send_json_auto_id({"type": "houseplan/config/get"})
        reloaded = (await client.receive_json())["result"]
        assert reloaded["config"] == accepted["config"]
        assert reloaded["rev"] == redone["result"]["rev"]
    finally:
        unsubscribe()
