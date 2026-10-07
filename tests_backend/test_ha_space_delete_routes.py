"""#822: the real space/delete writer fulfils the #162 map-route promise."""
import copy

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.websocket_api import _space_delete_candidate


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    yield


def _route(route_id: str, space_id: str) -> dict:
    return {
        "id": route_id, "source": "camera.map", "map_id": route_id,
        "space": space_id, "calibration": [1, 0, 0, 0, 1, 0],
    }


def _config(*, last: bool = False, blocked: bool = False) -> dict:
    spaces = [{"id": "f1", "title": "Deleted", "rooms": [], "plan_url": None}]
    if not last:
        spaces.append({"id": "f2", "title": "Dock", "rooms": [], "plan_url": None})
    for space in spaces:
        space["view_box"] = [0, 0, 1, 1]
    dock = "f1" if last else "f2"
    routes = [_route("drop-a", "f1")]
    if not last:
        routes = [_route("keep-a", "f2"), *routes,
                  _route("keep-b", "f2"), _route("drop-b", "f1")]
    markers = [{
        "id": "robot", "binding": "entity:vacuum.robot", "space": dock,
        "name": "Dock stays", "vacuum": {
            "source": "camera.map", "trail_mode": "always", "map_routes": routes,
            "calibration": {"legacy": [2, 0, 0, 0, 2, 0]},
        },
    }]
    for marker_id, flag in (("hidden", "hidden"), ("removed", "removed")):
        markers.append({
            "id": marker_id, "binding": "virtual", "space": dock, flag: True,
            "vacuum": {"map_routes": [_route(marker_id, "f1")]},
        })
    if blocked:
        markers.append({"id": "blocker", "binding": "virtual", "space": "f1"})
    return {"spaces": spaces, "markers": markers, "settings": {}}


async def _read_pair(client) -> tuple[dict, dict]:
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    config = await client.receive_json()
    assert config["success"]
    await client.send_json_auto_id({"type": "houseplan/layout/get"})
    layout = await client.receive_json()
    assert layout["success"]
    return config["result"], layout["result"]


async def _seed(hass: HomeAssistant, hass_ws_client: WebSocketGenerator, config: dict):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    hass.states.async_set("vacuum.robot", "docked")
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({
        "type": "houseplan/config/set", "config": config, "expected_rev": 0,
    })
    saved = await client.receive_json()
    assert saved["success"], saved
    await client.send_json_auto_id({
        "type": "houseplan/layout/set", "expected_rev": 0,
        "layout": {
            "robot": {"s": config["markers"][0]["space"], "x": 0.2, "y": 0.3},
            "rl_deleted": {"s": "f1", "x": 0.5, "y": 0.5},
        },
    })
    saved = await client.receive_json()
    assert saved["success"], saved
    return client, await _read_pair(client)


async def _delete(client, before: tuple[dict, dict], **overrides) -> dict:
    config, layout = before
    await client.send_json_auto_id({
        "type": "houseplan/space/delete", "space_id": "f1",
        "expected_config_rev": config["rev"], "expected_layout_rev": layout["rev"],
        **overrides,
    })
    return await client.receive_json()


async def test_issue_822_space_delete_commits_only_its_routes(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator,
) -> None:
    client, before = await _seed(hass, hass_ws_client, _config())
    config_events, layout_events = [], []
    hass.bus.async_listen("houseplan_config_updated", lambda event: config_events.append(event.data))
    hass.bus.async_listen("houseplan_layout_updated", lambda event: layout_events.append(event.data))
    deleted = await _delete(client, before)
    assert deleted["success"], deleted
    config, layout = await _read_pair(client)
    expected = copy.deepcopy(before[0]["config"])
    expected["spaces"] = [space for space in expected["spaces"] if space["id"] != "f1"]
    for marker in expected["markers"]:
        marker["vacuum"]["map_routes"] = [
            route for route in marker["vacuum"]["map_routes"] if route["space"] != "f1"
        ]
    assert config["config"] == expected
    assert layout["layout"] == {"robot": before[1]["layout"]["robot"]}
    assert config["rev"] == before[0]["rev"] + 1
    assert layout["rev"] == before[1]["rev"] + 1
    assert config_events == [{"rev": config["rev"]}]
    assert layout_events == [{"rev": layout["rev"]}]
    assert hass.states.get("vacuum.robot").state == "docked"


@pytest.mark.parametrize("refusal", ["space_in_use", "config_conflict", "layout_conflict", "space_not_found"])
async def test_issue_822_refused_delete_preserves_routes_and_revisions(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, refusal: str,
) -> None:
    client, before = await _seed(hass, hass_ws_client, _config(blocked=refusal == "space_in_use"))
    overrides = {}
    if refusal == "config_conflict":
        overrides["expected_config_rev"] = before[0]["rev"] - 1
    elif refusal == "layout_conflict":
        overrides["expected_layout_rev"] = before[1]["rev"] - 1
    elif refusal == "space_not_found":
        overrides["space_id"] = "missing"
    deleted = await _delete(client, before, **overrides)
    assert not deleted["success"]
    expected_code = "conflict" if refusal.endswith("conflict") else refusal
    assert deleted["error"]["code"] == expected_code
    assert await _read_pair(client) == before


async def test_issue_822_last_space_keeps_explicit_empty_routes(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator,
) -> None:
    client, before = await _seed(hass, hass_ws_client, _config(last=True))
    deleted = await _delete(client, before)
    assert deleted["success"], deleted
    config, layout = await _read_pair(client)
    expected = copy.deepcopy(before[0]["config"])
    expected["spaces"] = []
    for marker in expected["markers"]:
        marker.pop("space", None)
        marker.pop("room_id", None)
        marker["vacuum"]["map_routes"] = []
    assert config["config"] == expected
    assert layout["layout"] == {}


@pytest.mark.parametrize("vacuum", [
    {}, {"map_routes": None}, {"map_routes": []},
    {"map_routes": [_route("old-orphan", "already-missing")]},
    {"calibration": {"legacy": [1, 0, 0, 0, 1, 0]}},
])
def test_issue_822_candidate_preserves_unrelated_and_legacy_routes(vacuum: dict) -> None:
    config = _config()
    config["markers"] = [{"id": "other", "binding": "virtual", "space": "f2", "vacuum": vacuum}]
    original = copy.deepcopy(config)
    layout = {"other": {"s": "f2", "x": 0.2, "y": 0.3}}
    candidate, candidate_layout, dependencies, removed_layout = _space_delete_candidate(config, layout, "f1")
    assert candidate["markers"] == config["markers"]
    assert candidate_layout == layout
    assert dependencies == [] and removed_layout == 0
    assert config == original
