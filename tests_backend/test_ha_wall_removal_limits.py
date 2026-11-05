"""#1258: real authenticated config/set, stored baseline cache, reload and inverses."""
import copy

import pytest
from test_ha_wall_node_delete import setup
from custom_components.houseplan.plan_graph import project_graph_space
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


def source():
    return commit_wall_segment_model({"spaces": [{"id": "f", "title": "Floor", "view_box": [0, 0, 1, 1],
        "plan_url": None, "cell_cm": 5, "rooms": [], "partitions": [
        {"id": "long", "a": [24 / 240, 24 / 240], "b": [44 / 240, 24 / 240], "cm": 20},
        {"id": "short", "a": [44 / 240, 24 / 240], "b": [46 / 240, 24 / 240], "cm": 20},
    ]}], "markers": [], "settings": {}})[0]


def remove(config, wall):
    candidate = copy.deepcopy(config)
    space = candidate["spaces"][0]
    graph = copy.deepcopy(space["plan_graph"])
    graph["edges"] = [edge for edge in graph["edges"] if edge["id"] != wall]
    candidate["spaces"][0] = project_graph_space(space, graph)["space"]
    return candidate


@pytest.mark.parametrize("wall", ["long", "short"])
async def test_delete_undo_redo_and_reload(hass, hass_ws_client, wall):
    entry, client, snapshot = await setup(hass, hass_ws_client, source=source())
    original = snapshot["config"]
    candidate = remove(original, wall)
    for expected in [candidate, original, candidate]:
        await client.send_json_auto_id({"type": "houseplan/config/set", "config": expected,
                                       "expected_rev": snapshot["rev"]})
        response = await client.receive_json()
        assert response["success"], response
        snapshot = response["result"]
        assert snapshot["config"] == expected
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    assert (await client.receive_json())["result"]["config"] == candidate
    # CAS still rejects the stale inverse; the durable result remains intact.
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": original,
                                   "expected_rev": snapshot["rev"] - 1})
    assert (await client.receive_json())["error"]["code"] == "conflict"


@pytest.mark.parametrize("change", ["endpoint", "thickness", "grid"])
async def test_deletion_cannot_hide_a_new_short_changed_wall(hass, hass_ws_client, change):
    _entry, client, snapshot = await setup(hass, hass_ws_client, source=source())
    candidate = remove(snapshot["config"], "long")
    space = candidate["spaces"][0]
    if change == "grid":
        space["cell_cm"] = 4
    else:
        graph = copy.deepcopy(space["plan_graph"])
        edge = graph["edges"][0]
        if change == "thickness":
            edge["cm"] = 25
        else:
            node = next(n for n in graph["nodes"] if n["id"] == edge["to"])
            node["p"][0] = ["45", "240"]
        candidate["spaces"][0] = project_graph_space(space, graph)["space"]
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": candidate,
                                   "expected_rev": snapshot["rev"]})
    response = await client.receive_json()
    assert not response["success"], response
    assert response["error"]["code"] == "junction_limit_length", response
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    assert (await client.receive_json())["result"] == snapshot
