"""Compare the finite test dispatcher with real authenticated HA WS/Stores.

This is separate from the positive no-HA subprocess journey: importing the
dispatcher here does not activate its subprocess-only HA import prohibition.
"""
import copy
import json

import pytest
from demo.standalone.core_process import CoreTestTransport
from test_ha_wall_node_delete import setup
from test_ha_structural_upload import _setup as setup_http, _compact
from test_wall_node_delete import fixture as delete_fixture, graph_intent
from test_wall_node_move import fixture as move_fixture, current_intent
from test_wall_node_merge import CASES as MERGES, config as merge_config, intent as merge_intent
from test_wall_node_attach import CASES as ATTACHES, config as attach_config, intent as attach_intent


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


def local(before, path, layout=None):
    result = CoreTestTransport(before["config"], "a" * 64, before["integration_version"], path)
    result.config_rev = before["rev"]
    if layout is not None:
        result.layout = copy.deepcopy(layout["layout"])
        result.layout_rev = layout["rev"]
    return result


async def send(client, message):
    await client.send_json_auto_id(message)
    return await client.receive_json()


async def test_config_cas_and_paired_optimize_undo_match_real_ha(hass, hass_ws_client, tmp_path):
    _, client, before = await setup(hass, hass_ws_client)
    layout = (await send(client, {"type": "houseplan/layout/get"}))["result"]
    core = local(before, tmp_path, layout)
    candidate = copy.deepcopy(before["config"])
    candidate["spaces"][0]["title"] = "Standalone parity"
    message = {"type": "houseplan/config/set", "config": candidate, "expected_rev": before["rev"], "opening_features_api": 1}
    actual = await send(client, message)
    assert actual["success"], actual
    expected = core.request(message)
    reread = (await send(client, {"type": "houseplan/config/get"}))["result"]
    assert reread["config"] == expected["config"] and reread["rev"] == expected["rev"]
    assert (await send(client, message))["error"]["code"] == "conflict"
    with pytest.raises(ValueError, match="conflict"):
        core.request(message)

    changed = copy.deepcopy(reread["config"])
    changed["spaces"][0]["title"] = "Paired intent"
    optimize = {"type": "houseplan/plan/optimize", "config": changed, "layout": layout["layout"],
                "expected_config_rev": reread["rev"], "expected_layout_rev": layout["rev"], "opening_features_api": 1}
    actual = await send(client, optimize)
    assert actual["success"], actual
    expected = core.request(optimize)
    assert {key: actual["result"][key] for key in expected} == expected
    undo = {"type": "houseplan/plan/optimize_undo", "expected_config_rev": expected["config_rev"], "expected_layout_rev": expected["layout_rev"]}
    actual = await send(client, undo)
    assert actual["success"], actual
    expected = core.request(undo)
    assert {key: actual["result"][key] for key in expected} == expected


@pytest.mark.parametrize("kind", ["move", "delete", "merge", "attach"])
async def test_all_declared_node_apis_match_actual_ha_routes(hass, hass_ws_client, tmp_path, kind):
    if kind == "delete":
        source = delete_fixture()
        operation = graph_intent(source, [1, 0])
    elif kind == "merge":
        source = merge_config(MERGES[0])
        operation = merge_intent(source["spaces"][0], MERGES[0])
    elif kind == "attach":
        source = attach_config(ATTACHES[0])
        operation = attach_intent(source["spaces"][0], ATTACHES[0])
    else:
        source = move_fixture()
        operation = current_intent(source, {"point": [0, 0], "target": [.25, 0], "axis": "partition:h", "split_ids": {}})
    _, client, before = await setup(hass, hass_ws_client, source=source)
    core = local(before, tmp_path)
    assert core.API[f"wall_node_{kind}_api"] == before[f"wall_node_{kind}_api"] == 1
    message = {"type": "houseplan/wall/node_delete" if kind == "delete" else "houseplan/wall/node_move",
               "space_id": "f", "intent": operation, "expected_rev": before["rev"]}
    actual = await send(client, message)
    assert actual["success"], actual
    expected = core.request(message)
    assert actual["result"] == expected
    undo = {**message, "expected_rev": expected["rev"], "direction": "undo", "before_space": before["config"]["spaces"][0]}
    actual = await send(client, undo)
    assert actual["success"], actual
    assert actual["result"] == core.request(undo)


async def test_structural_staging_controls_and_commit_match_actual_http_ws(hass, hass_client, hass_access_token, tmp_path):
    http, socket, pair = await setup_http(hass, hass_client, hass_access_token)
    before, layout = pair
    core = local(before, tmp_path, layout)
    candidate = copy.deepcopy(before["config"])
    candidate["spaces"][0]["title"] = "Structural parity"
    message = {"type": "houseplan/config/set", "expected_rev": before["rev"], "config": candidate, "opening_features_api": 1}
    raw = json.dumps(message, separators=(",", ":")).encode()
    response = await http.post("/api/houseplan/structural/upload", data=raw, headers={"content-type": "application/json"})
    assert response.status == 200, await response.text()
    actual_stage = await response.json()
    expected_stage = core.post("/api/houseplan/structural/upload", message)
    assert actual_stage["purpose"] == expected_stage["purpose"]
    assert actual_stage["sha256"] == expected_stage["sha256"]
    assert await socket.pair() == pair
    actual = await socket.send(_compact(message, actual_stage))
    assert actual["success"], actual
    expected = core.request(_compact(message, expected_stage))
    reread = await socket.pair()
    assert reread[0]["config"] == expected["config"] and reread[0]["rev"] == expected["rev"]
    assert reread[1] == layout
