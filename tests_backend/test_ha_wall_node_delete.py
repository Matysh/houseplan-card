"""#1045 real authenticated WS/store boundary; ordinary inputs, no planner replacement."""
import asyncio
import copy
import json
from functools import partial
from pathlib import Path

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY, GROUP_ID_USER
from pytest_homeassistant_custom_component.common import MockConfigEntry
from test_wall_node_delete import CASES, fixture

from custom_components.houseplan.const import CONF_ADMIN_ONLY, DOMAIN
from custom_components.houseplan.import_export import (
    create_preview,
    get_candidate,
    parse_document,
    prepare_apply,
)
from custom_components.houseplan.store import get_data
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


async def setup(hass, hass_ws_client, *, admin_only=True, source=None):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={CONF_ADMIN_ONLY: admin_only})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": source or fixture(), "expected_rev": 0})
    saved = await client.receive_json()
    assert saved["success"], saved
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    return entry, client, (await client.receive_json())["result"]


def message(snapshot, **extra):
    return {"type": "houseplan/wall/node_delete", "space_id": "f", "intent": {"point": [1, 0]},
            "expected_rev": snapshot["rev"], **extra}


async def test_issue_1045_ws_atomic_concurrency_inverse_store_and_reload(hass, hass_ws_client):
    entry, client, snapshot = await setup(hass, hass_ws_client)
    runtime = get_data(hass)
    unrelated_layout = {"legacy-untouched-device": {"s": "f", "x": .2, "y": .4, "k": 1.3}}
    await runtime.store.async_save({"layout": unrelated_layout, "rev": 7})
    assert snapshot["wall_node_delete_api"] == 1 and snapshot["wall_node_move_api"] == 1
    assert "wall_node_delete_api" not in snapshot["config"]
    events = []
    unsubscribe = hass.bus.async_listen("houseplan_config_updated", lambda event: events.append(event.data))
    contender = await hass_ws_client(hass)
    await asyncio.gather(client.send_json_auto_id(message(snapshot)), contender.send_json_auto_id(message(snapshot)))
    answers = await asyncio.gather(client.receive_json(), contender.receive_json())
    accepted = next(answer["result"] for answer in answers if answer["success"])
    assert next(answer["error"]["code"] for answer in answers if not answer["success"]) == "conflict"
    after = accepted["config"]
    assert accepted["rev"] == snapshot["rev"] + 1
    assert len(after["spaces"][0]["partitions"]) == 1
    assert after["spaces"][0]["partitions"][0]["id"] == "a"
    assert after["spaces"][0]["partitions"][0]["a"] == [0, 0]
    assert after["spaces"][0]["partitions"][0]["b"] == [2, 0]
    assert after["spaces"][0]["openings"][0] == {**snapshot["config"]["spaces"][0]["openings"][0],
        "host": {"kind": "partition", "id": "a", "t": .75}}
    assert after["spaces"][0]["future"] == snapshot["config"]["spaces"][0]["future"]
    assert (await runtime.config_store.async_load())["config"] == after
    assert (await runtime.store.async_load())["layout"] == unrelated_layout
    await client.send_json_auto_id(message(accepted, direction="undo", before_space=snapshot["config"]["spaces"][0]))
    undo = await client.receive_json()
    assert undo["success"], undo
    assert undo["result"]["config"] == snapshot["config"]
    # The ordinary config writer is still strict: this privilege belongs only
    # to the independently proved node operation.
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": after, "expected_rev": undo["result"]["rev"]})
    ordinary = await client.receive_json()
    assert not ordinary["success"] and ordinary["error"]["code"] == "invalid_partition_opening_host"
    await client.send_json_auto_id(message(undo["result"]))
    redo = await client.receive_json()
    assert redo["success"] and redo["result"]["config"] == after
    await hass.async_block_till_done()
    assert [e["rev"] for e in events] == [snapshot["rev"] + i for i in (1, 2, 3)]
    unsubscribe()
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    reloaded = (await client.receive_json())["result"]
    assert reloaded["config"] == after and reloaded["rev"] == redo["result"]["rev"]
    assert (await runtime.store.async_load())["layout"] == unrelated_layout


@pytest.mark.parametrize("kind", ["full", "space"])
@pytest.mark.parametrize("current_state", ["accepted", "undo"])
async def test_issue_1045_accepted_delete_export_import_roundtrip(
    hass, hass_ws_client, hass_admin_user, kind, current_state,
):
    """Restore the accepted result through its real full/copy import owners."""
    entry, client, before = await setup(hass, hass_ws_client)
    runtime = get_data(hass)
    await client.send_json_auto_id(message(before))
    deleted = await client.receive_json()
    assert deleted["success"], deleted
    after = deleted["result"]
    source_space = copy.deepcopy(after["config"]["spaces"][0])
    assert len(source_space["partitions"]) == 1
    assert source_space["openings"][0]["host"] == {"kind": "partition", "id": "a", "t": .75}

    # The public export endpoint reads the accepted server-owned store pair.
    await client.send_json_auto_id({
        "type": "houseplan/export/create", "kind": kind,
        **({"space_id": "f"} if kind == "space" else {}), "card_version": "1045-roundtrip",
    })
    exported = await client.receive_json()
    assert exported["success"], exported
    raw = json.dumps(exported["result"]["document"]).encode()
    parsed = parse_document(raw)
    assert parsed["payload"]["config"]["spaces"][0]["openings"] == source_space["openings"]

    # A full file replaces this installation; a space file always adds an
    # independent copy. Neither is an ordinary config/set replay of lineage.
    if current_state == "undo":
        await client.send_json_auto_id(message(after, direction="undo", before_space=before["config"]["spaces"][0]))
        undone = await client.receive_json()
        assert undone["success"] and undone["result"]["config"] == before["config"]
    config_data = copy.deepcopy(await runtime.config_store.async_load())
    layout_data = copy.deepcopy(await runtime.store.async_load() or {})
    current_space = copy.deepcopy(config_data["config"]["spaces"][0])
    preview = await hass.async_add_executor_job(partial(
        create_preview, runtime, raw, owner_id=hass_admin_user.id, duplicate_policy="skip",
        current_config_data=config_data, current_layout_data=layout_data,
        config_root=Path(hass.config.path("")),
    ))
    assert preview["preview"]["source"] == "same"
    assert not preview["preview"]["confirmation_required"]
    assert preview["preview"]["opening_repairs"]["detached"] == 0
    candidate = get_candidate(runtime, preview["token"], hass_admin_user.id)
    prepared, prepared_layout, _ = prepare_apply(
        candidate, config_data["config"], layout_data.get("layout", {}), confirm_missing_content=False,
    )
    imported_id = "f" if kind == "full" else preview["preview"]["space_id"]
    imported = next(space for space in prepared["spaces"] if space["id"] == imported_id)
    if kind == "space":
        assert imported_id != "f"
        assert next(space for space in prepared["spaces"] if space["id"] == "f") == current_space
        assert imported["partitions"][0]["id"] != "a"
        assert imported["openings"][0]["id"] != source_space["openings"][0]["id"]
    else:
        assert len(prepared["spaces"]) == 1
        assert imported["partitions"] == source_space["partitions"]
        assert imported["wall_segments"] == source_space["wall_segments"]
        assert imported["openings"] == source_space["openings"]
    assert [{key: value for key, value in wall.items() if key != "id"}
            for wall in imported["partitions"]] == [
        {key: value for key, value in wall.items() if key != "id"} for wall in source_space["partitions"]
    ]
    opening = imported["openings"][0]
    assert {key: value for key, value in opening.items() if key not in {"id", "host"}} == {
        key: value for key, value in source_space["openings"][0].items() if key not in {"id", "host"}
    }
    assert opening["host"] == {"kind": "partition", "id": imported["partitions"][0]["id"], "t": .75}
    assert imported["rooms"] == source_space["rooms"]
    assert imported["future"] == source_space["future"]

    apply_message = {
        "type": "houseplan/import/apply", "token": preview["token"],
        "expected_config_rev": preview["expected_config_rev"],
        "expected_layout_rev": preview["expected_layout_rev"],
    }
    # A real stale apply is atomic and leaves this same preview usable.
    await client.send_json_auto_id({**apply_message, "expected_config_rev": config_data["rev"] - 1})
    refused = await client.receive_json()
    assert not refused["success"] and refused["error"]["code"] == "conflict", refused
    assert await runtime.config_store.async_load() == config_data
    assert (await runtime.store.async_load() or {}) == layout_data
    await client.send_json_auto_id(apply_message)
    applied = await client.receive_json()
    assert applied["success"], applied
    assert applied["result"]["config_rev"] == config_data["rev"] + 1
    assert applied["result"]["layout_rev"] == layout_data.get("rev", 0) + 1
    assert applied["result"]["space_id"] == (None if kind == "full" else imported_id)
    assert (await runtime.config_store.async_load())["config"] == prepared
    assert (await runtime.store.async_load())["layout"] == prepared_layout
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    reloaded = await client.receive_json()
    assert reloaded["success"] and reloaded["result"]["config"] == prepared
    assert reloaded["result"]["rev"] == applied["result"]["config_rev"]


@pytest.mark.parametrize(("group", "admin_only", "allowed"), [
    (GROUP_ID_READ_ONLY, False, False), (GROUP_ID_USER, True, False), (GROUP_ID_USER, False, True),
])
async def test_issue_1045_ws_real_acl_and_projected_capability(hass, hass_ws_client, group, admin_only, allowed):
    _, owner, snapshot = await setup(hass, hass_ws_client, admin_only=admin_only)
    user = await hass.auth.async_create_user("Node editor", group_ids=[group])
    refresh = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    client = await hass_ws_client(hass, access_token=hass.auth.async_create_access_token(refresh))
    await client.send_json_auto_id({"type": "houseplan/config/get", "fields": ["model_version"]})
    projection = (await client.receive_json())["result"]
    assert projection["wall_node_delete_api"] == 1
    assert set(projection["config"]) == {"model_version"}
    await client.send_json_auto_id(message(snapshot))
    answer = await client.receive_json()
    assert answer["success"] is allowed, answer
    await owner.send_json_auto_id({"type": "houseplan/config/get"})
    current = (await owner.receive_json())["result"]
    if not allowed:
        assert answer["error"]["code"] == "unauthorized"
        assert current["config"] == snapshot["config"] and current["rev"] == snapshot["rev"]
    else:
        assert current["config"] == answer["result"]["config"] and current["rev"] == snapshot["rev"] + 1


@pytest.mark.parametrize("bad", [
    {"space_id": "foreign"}, {"intent": {"point": [0, 0]}}, {"intent": {"point": [5001, 0]}},
    {"intent": {"point": [True, 0]}}, {"intent": {"point": [1, 0], "candidate": {}}},
    {"expected_rev": 0}, {"candidate": {}}, {"direction": "undo", "before_space": {"id": "foreign"}},
])
async def test_issue_1045_ws_negative_input_never_advances_storage_or_revision(hass, hass_ws_client, bad):
    _, client, snapshot = await setup(hass, hass_ws_client)
    frozen = copy.deepcopy(await get_data(hass).config_store.async_load())
    await client.send_json_auto_id(message(snapshot, **bad))
    answer = await client.receive_json()
    assert not answer["success"], answer
    assert answer["error"]["code"] in {"node_delete_unsafe", "node_delete_degree", "conflict", "invalid_format"}
    assert await get_data(hass).config_store.async_load() == frozen


@pytest.mark.parametrize("field", ["future", "endpoint", "opening"])
async def test_issue_1045_ws_forged_inverse_cannot_modify_foreign_data(hass, hass_ws_client, field):
    _, client, snapshot = await setup(hass, hass_ws_client)
    await client.send_json_auto_id(message(snapshot))
    accepted = await client.receive_json()
    assert accepted["success"], accepted
    frozen = copy.deepcopy(await get_data(hass).config_store.async_load())
    before = copy.deepcopy(snapshot["config"]["spaces"][0])
    if field == "future":
        before["future"] = {"forged": True}
    elif field == "endpoint":
        before["partitions"][0]["a"] = [-.5, 0]
    else:
        before["openings"][0]["length"] = .4
    await client.send_json_auto_id(message(accepted["result"], direction="undo", before_space=before))
    refused = await client.receive_json()
    assert not refused["success"] and refused["error"]["code"] == "node_delete_unsafe", refused
    assert await get_data(hass).config_store.async_load() == frozen


@pytest.mark.parametrize("case", [c for c in CASES if c["name"] in {
    "thickness-mismatch", "future-attribute-mismatch", "chord-crossing", "new-contact", "chord-overlap", "angled-opening",
}], ids=lambda case: case["name"])
async def test_issue_1045_ws_independent_geometry_refusal_on_ordinary_accepted_source(hass, hass_ws_client, case):
    space = {**copy.deepcopy(case["space"]), "title": "Floor", "view_box": [0, 0, 2, 2]}
    for opening in space.get("openings", []):
        opening["type"] = "door"
    source = commit_wall_segment_model({"spaces": [space], "markers": [], "settings": {}})[0]
    _, client, snapshot = await setup(hass, hass_ws_client, source=source)
    frozen = copy.deepcopy(await get_data(hass).config_store.async_load())
    await client.send_json_auto_id(message(snapshot, intent={"point": case["point"]}))
    refused = await client.receive_json()
    assert not refused["success"], refused
    assert refused["error"]["code"] == "node_delete_" + case["reason"], refused
    assert await get_data(hass).config_store.async_load() == frozen
