"""#1287: authenticated config/delete transactions, durable pair failure and Undo."""
import copy
from pathlib import Path

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import DOMAIN, FILES_DIR
from custom_components.houseplan.plan_graph import project_graph_space
from custom_components.houseplan.store import get_data
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model


@pytest.fixture(autouse=True)
def _enable(enable_custom_integrations):
    yield


async def send(client, request):
    await client.send_json_auto_id(request)
    return await client.receive_json()


async def pair(client):
    config = await send(client, {"type": "houseplan/config/get"})
    layout = await send(client, {"type": "houseplan/layout/get"})
    assert config["success"] and layout["success"]
    return config["result"], layout["result"]


async def seed(hass, hass_ws_client):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    config = commit_wall_segment_model({"model_version": 10, "spaces": [
        {"id": "f", "title": "First", "view_box": [0, 0, 1, 1], "rooms": [
            {"id": "a", "name": "A", "poly": [[0, 0], [.5, 0], [.5, 1], [0, 1]]},
            {"id": "b", "name": "B", "poly": [[.5, 0], [1, 0], [1, 1], [.5, 1]]}]},
        {"id": "g", "title": "Second", "view_box": [0, 0, 1, 1], "rooms": []}],
        "markers": [{"id": "m", "binding": "virtual", "space": "f"}], "settings": {}})[0]
    saved = await send(client, {"type": "houseplan/config/set", "config": config, "expected_rev": 0})
    assert saved["success"], saved
    saved = await send(client, {"type": "houseplan/layout/set", "expected_rev": 0, "layout": {
        "rl_a": {"s": "f", "x": .25, "y": .25, "k": 7, "opaque": {"keep": True}},
        "rl_b": {"s": "f", "x": .75, "y": .25}, "m": {"s": "f", "x": .25, "y": .5},
        "lg_sensor.group": {"s": "f", "x": .5, "y": .5}, "unverified": {"s": "g", "x": .25, "y": .5}}})
    assert saved["success"], saved
    return client, entry, await pair(client)


def without_room(config, room="a"):
    """A valid named structural target for exercising the config transport."""
    result = copy.deepcopy(config)
    space = result["spaces"][0]
    graph = space["plan_graph"]
    graph["rooms"] = [cycle for cycle in graph["rooms"] if cycle["room"] != room]
    used = {(edge["kind"], edge["id"]) for cycle in graph["rooms"] for edge in cycle["edges"]}
    graph["edges"] = [edge for edge in graph["edges"] if (edge["kind"], edge["id"]) in used]
    nodes = {key for edge in graph["edges"] for key in (edge["from"], edge["to"])}
    graph["nodes"] = [node for node in graph["nodes"] if node["id"] in nodes]
    space["rooms"] = [item for item in space["rooms"] if item["id"] != room]
    result["spaces"][0] = project_graph_space(space, graph)["space"]
    return result


async def test_room_config_write_cleans_label_as_one_pair_and_label_undo_is_cas_guarded(hass, hass_ws_client):
    client, entry, before = await seed(hass, hass_ws_client)
    target = without_room(before[0]["config"])
    saved = await send(client, {"type": "houseplan/config/set", "config": target, "expected_rev": before[0]["rev"]})
    assert saved["success"], saved
    assert saved["result"]["layout_changes"] == {"rl_a": None}
    after = await pair(client)
    assert "rl_a" not in after[1]["layout"]
    assert after[1]["rev"] == before[1]["rev"] + 1
    for key in ("rl_b", "m", "lg_sensor.group", "unverified"):
        assert after[1]["layout"][key] == before[1]["layout"][key]
    stale = await send(client, {"type": "houseplan/config/set", "config": before[0]["config"],
        "expected_rev": after[0]["rev"], "room_label_layout": {"rl_a": before[1]["layout"]["rl_a"]},
        "expected_layout_rev": before[1]["rev"]})
    assert stale["error"]["code"] == "conflict"
    assert await pair(client) == after
    restored = await send(client, {"type": "houseplan/config/set", "config": before[0]["config"],
        "expected_rev": after[0]["rev"], "room_label_layout": {"rl_a": before[1]["layout"]["rl_a"]},
        "expected_layout_rev": after[1]["rev"]})
    assert restored["success"], restored
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    reloaded = await pair(client)
    assert reloaded[0]["config"] == before[0]["config"]
    assert reloaded[1]["layout"] == before[1]["layout"]


async def test_failed_room_pair_commit_restores_config_and_label(hass, hass_ws_client, monkeypatch):
    client, _, before = await seed(hass, hass_ws_client)
    rt = get_data(hass)
    original = rt.config_store.async_save
    failed = False

    async def save(value):
        nonlocal failed
        if value.get("rev") == before[0]["rev"] + 1:
            failed = True
            raise OSError("addressed config-side disk failure")
        await original(value)

    monkeypatch.setattr(rt.config_store, "async_save", save)
    saved = await send(client, {"type": "houseplan/config/set", "config": without_room(before[0]["config"]),
        "expected_rev": before[0]["rev"]})
    assert saved["error"]["code"] == "commit_failed"
    assert failed
    assert await pair(client) == before


@pytest.mark.parametrize("with_devices", [False, True])
async def test_space_delete_and_one_deep_undo_restore_all_owned_positions_and_attachments(hass, hass_ws_client, with_devices):
    client, _, before = await seed(hass, hass_ws_client)
    if not with_devices:
        # The normal precondition: remove a live marker's placement/reference,
        # then retry Delete without devices. Opaque records do not block it.
        config = copy.deepcopy(before[0]["config"])
        config["markers"][0]["space"] = "g"
        saved = await send(client, {"type": "houseplan/config/set", "config": config, "expected_rev": before[0]["rev"]})
        assert saved["success"], saved
        layout = copy.deepcopy(before[1]["layout"]); layout["m"]["s"] = "g"
        saved = await send(client, {"type": "houseplan/layout/set", "layout": layout, "expected_rev": before[1]["rev"]})
        assert saved["success"], saved
    else:
        file = Path(hass.config.path(FILES_DIR)) / "m" / "manual.pdf"
        file.parent.mkdir(parents=True, exist_ok=True); file.write_bytes(b"keep this manual")
        config = copy.deepcopy(before[0]["config"])
        config["markers"][0]["pdfs"] = [{"name": "Manual", "url": "/api/houseplan/content/files/m/manual.pdf"}]
        saved = await send(client, {"type": "houseplan/config/set", "config": config, "expected_rev": before[0]["rev"]})
        assert saved["success"], saved
    before = await pair(client)
    deleted = await send(client, {"type": "houseplan/space/delete", "space_id": "f", "remove_markers": with_devices,
        "expected_config_rev": before[0]["rev"], "expected_layout_rev": before[1]["rev"]})
    assert deleted["success"], deleted
    after = await pair(client)
    assert after[0]["can_optimize_undo"] and after[0]["undo_kind"] == "space_delete"
    assert all(position.get("s") != "f" for position in after[1]["layout"].values())
    assert after[1]["layout"]["unverified"] == before[1]["layout"]["unverified"]
    if with_devices:
        assert file.read_bytes() == b"keep this manual"
    undone = await send(client, {"type": "houseplan/plan/optimize_undo", "expected_config_rev": after[0]["rev"],
        "expected_layout_rev": after[1]["rev"]})
    assert undone["success"], undone
    restored = await pair(client)
    assert restored[0]["config"] == before[0]["config"]
    assert restored[1]["layout"] == before[1]["layout"]
    if with_devices:
        assert file.read_bytes() == b"keep this manual"


@pytest.mark.parametrize("binding", ["virtual", "entity:sensor.synthetic"])
async def test_marker_config_delete_removes_position_atomically_for_drop_and_tombstone(hass, hass_ws_client, binding):
    client, _, before = await seed(hass, hass_ws_client)
    config = copy.deepcopy(before[0]["config"]); config["markers"][0]["binding"] = binding
    saved = await send(client, {"type": "houseplan/config/set", "config": config, "expected_rev": before[0]["rev"]})
    assert saved["success"], saved
    before = await pair(client)
    target = copy.deepcopy(before[0]["config"])
    target["markers"] = [] if binding == "virtual" else [{"id": "m", "binding": binding, "removed": True, "hidden": True}]
    saved = await send(client, {"type": "houseplan/config/set", "config": target, "expected_rev": before[0]["rev"]})
    assert saved["success"], saved
    assert saved["result"]["layout_changes"] == {"m": None}
    after = await pair(client)
    assert "m" not in after[1]["layout"]
    assert after[1]["layout"]["rl_a"] == before[1]["layout"]["rl_a"]


@pytest.mark.parametrize("next_edit", ["config", "config_shared", "layout", "point", "layout_delete", "optimize", "optimize_failed"])
async def test_expired_space_delete_undo_releases_its_attachment_pins(hass, hass_ws_client, monkeypatch, next_edit):
    client, _, before = await seed(hass, hass_ws_client)
    file = Path(hass.config.path(FILES_DIR)) / "m" / "manual.pdf"
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_bytes(b"held only while space deletion can be undone")
    config = copy.deepcopy(before[0]["config"])
    config["markers"][0]["pdfs"] = [{"name": "Manual", "url": "/api/houseplan/content/files/m/manual.pdf"}]
    if next_edit == "config_shared":
        config["markers"].append({"id": "other", "binding": "virtual", "space": "g",
                                  "pdfs": copy.deepcopy(config["markers"][0]["pdfs"])})
    assert (await send(client, {"type": "houseplan/config/set", "config": config,
                              "expected_rev": before[0]["rev"]}))["success"]
    before = await pair(client)
    assert (await send(client, {"type": "houseplan/space/delete", "space_id": "f", "remove_markers": True,
        "expected_config_rev": before[0]["rev"], "expected_layout_rev": before[1]["rev"]}))["success"]
    after = await pair(client)
    assert after[0]["undo_kind"] == "space_delete"
    assert file.is_file(), "the live Undo snapshot must still own the attachment"
    if next_edit in ("config", "config_shared", "optimize", "optimize_failed"):
        config = copy.deepcopy(after[0]["config"])
        config["spaces"][0]["title"] += " edited"
        request = {"type": "houseplan/config/set", "config": config, "expected_rev": after[0]["rev"]}
        if next_edit.startswith("optimize"):
            request = {"type": "houseplan/plan/optimize", "config": config, "layout": after[1]["layout"],
                "expected_config_rev": after[0]["rev"], "expected_layout_rev": after[1]["rev"]}
        if next_edit == "optimize_failed":
            store = get_data(hass).config_store
            save = store.async_save

            async def fail_target(value):
                if value.get("rev") == after[0]["rev"] + 1:
                    raise OSError("replacement target cannot become durable")
                await save(value)

            monkeypatch.setattr(store, "async_save", fail_target)
    elif next_edit == "layout":
        layout = copy.deepcopy(after[1]["layout"])
        layout["unverified"]["x"] = .3
        request = {"type": "houseplan/layout/set", "layout": layout, "expected_rev": after[1]["rev"]}
    elif next_edit == "point":
        request = {"type": "houseplan/layout/update", "device_id": "unverified",
                   "pos": {"s": "g", "x": .3, "y": .5}}
    else:
        request = {"type": "houseplan/layout/delete", "device_id": "unverified"}
    saved = await send(client, request)
    if next_edit == "optimize_failed":
        assert saved["error"]["code"] == "commit_failed"
        assert await pair(client) == after
        assert file.is_file(), "a rolled-back replacement must not release the still-current Undo pin"
        return
    assert saved["success"], saved
    assert file.exists() == (next_edit == "config_shared"), "expired Undo releases only unreferenced files"
    current = await pair(client)
    assert current[0]["undo_kind"] != "space_delete"
