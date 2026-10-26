"""Real HA endpoint evidence, including the shared recoverable pair writer."""
import copy
from pathlib import Path

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY

from custom_components.houseplan.const import DOMAIN, FILES_DIR
from custom_components.houseplan.store import get_data
from test_ha_marker_copy import _pair, _request, _seed, _send

SESSION = "history_session_1073_test"


@pytest.fixture(autouse=True)
def _enable(enable_custom_integrations):
    yield


def _action(pair, action, op="operation_1073_delete", **extra):
    return {"type": "houseplan/marker/history", "history_session": SESSION, "operation_id": op,
            "action": action, "expected_config_rev": pair[0]["rev"], "expected_layout_rev": pair[1]["rev"], **extra}


async def test_real_copy_history_undo_redo_and_lost_reply_replay_keep_exact_id_and_edges(hass, hass_ws_client):
    client, before = await _seed(hass, hass_ws_client)
    request = _request(before, history_session=SESSION, operation_id="operation_1073_copy")
    copied = await _send(client, request)
    assert copied["success"], copied
    after = await _pair(client)
    replay = await _send(client, request)
    assert replay["success"] and replay["result"] == copied["result"]
    undo = await _send(client, _action(after, "undo", "operation_1073_undo", token=copied["result"]["history_token"]))
    assert undo["success"], undo
    restored = await _pair(client)
    assert restored[0]["config"] == before[0]["config"]
    assert restored[1]["layout"] == before[1]["layout"]
    redo = await _send(client, _action(restored, "redo", "operation_1073_redo", token=copied["result"]["history_token"]))
    assert redo["success"], redo
    redone = await _pair(client)
    assert redone[0]["config"] == after[0]["config"]
    assert redone[1]["layout"] == after[1]["layout"]


@pytest.mark.parametrize("binding", ["virtual", "entity:switch.source", "device:source"])
async def test_delete_restores_marker_tombstone_layout_snapshot_and_led_as_one_pair(hass, hass_ws_client, binding):
    client, before = await _seed(hass, hass_ws_client)
    config = copy.deepcopy(before[0]["config"])
    config["markers"][0]["binding"] = binding
    config["settings"]["marker_area_snapshot"] = {"source": {"binding": "device:source", "area": "kitchen"}}
    saved = await _send(client, {"type": "houseplan/config/set", "config": config, "expected_rev": before[0]["rev"]})
    assert saved["success"], saved
    before = await _pair(client)
    recorder = hass.data[DOMAIN]["trail_recorder"]
    old_run = {"points": [[11, 12], [21, 22]], "paths": [[[11, 12], [21, 22]]], "revision": "old-cleaning"}
    recorder.book.data["source"] = {"current": copy.deepcopy(old_run)}
    await recorder.store.async_save(copy.deepcopy(recorder.book.data))
    deleted = await _send(client, _action(before, "delete", targets=[{"id": "source", "binding": binding}]))
    assert deleted["success"], deleted
    after = await _pair(client)
    assert "source" not in after[1]["layout"]
    assert after[0]["config"]["spaces"][0]["led_strips"][0]["marker"] is None
    assert "source" not in recorder.book.data
    undo = await _send(client, _action(after, "undo", "operation_1073_undo", token=deleted["result"]["history_token"]))
    assert undo["success"], undo
    restored = await _pair(client)
    assert restored[0]["config"] == before[0]["config"]
    assert restored[1]["layout"] == before[1]["layout"]
    assert "source" not in recorder.book.data, "Undo restores settings, never the previous runtime cleaning"
    empty = await _send(client, {"type": "houseplan/trail/get"})
    assert "source" not in empty["result"]["trails"]
    # A later current integration value is read as itself, not replaced by history.
    current_run = {**old_run, "points": [[51, 52], [61, 62]], "paths": [[[51, 52], [61, 62]]], "revision": "current-cleaning"}
    recorder.book.data["source"] = {"current": current_run}
    current = await _send(client, {"type": "houseplan/trail/get"})
    assert current["result"]["trails"]["source"]["current"]["points"] == [[51, 52], [61, 62]]


async def test_batch_invalid_member_and_foreign_connection_token_cannot_change_either_half(hass, hass_ws_client):
    client, before = await _seed(hass, hass_ws_client)
    bad = _action(before, "delete", targets=[{"id": "source", "binding": "virtual"}, {"id": "missing", "binding": "virtual"}])
    refused = await _send(client, bad)
    assert refused["error"]["code"] == "device_history_conflict"
    assert await _pair(client) == before
    accepted = await _send(client, _action(before, "delete", "operation_1073_good", targets=[{"id": "source", "binding": "virtual"}]))
    assert accepted["success"], accepted
    after = await _pair(client)
    foreign = await hass_ws_client(hass)
    refused = await _send(foreign, _action(after, "undo", "operation_1073_foreign", token=accepted["result"]["history_token"]))
    assert refused["error"]["code"] == "device_history_unavailable"
    assert await _pair(client) == after


async def test_structural_history_and_retention_require_current_writer_permission(hass, hass_ws_client):
    client, before = await _seed(hass, hass_ws_client)
    user = await hass.auth.async_create_user("Reader", group_ids=[GROUP_ID_READ_ONLY])
    refresh = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    reader = await hass_ws_client(hass, access_token=hass.auth.async_create_access_token(refresh))
    for request in [_action(before, "delete", targets=[{"id": "source", "binding": "virtual"}]),
                    {"type": "houseplan/marker/history/retain", "history_session": SESSION, "tokens": []}]:
        refused = await _send(reader, request)
        assert refused["error"]["code"] == "unauthorized"
        assert await _pair(client) == before


async def test_legacy_cleanup_respects_pin_release_does_not_delete_live_or_new_files(hass, hass_ws_client):
    client, before = await _seed(hass, hass_ws_client)
    folder = Path(hass.config.path(FILES_DIR)) / "source"
    folder.mkdir(parents=True, exist_ok=True)
    file = folder / "manual.pdf"
    file.write_bytes(b"original manual")
    config = copy.deepcopy(before[0]["config"])
    config["markers"][0]["pdfs"] = [{"name": "Manual", "url": "/api/houseplan/content/files/source/manual.pdf"}]
    saved = await _send(client, {"type": "houseplan/config/set", "config": config, "expected_rev": before[0]["rev"]})
    assert saved["success"], saved
    before = await _pair(client)
    deleted = await _send(client, _action(before, "delete", targets=[{"id": "source", "binding": "virtual"}]))
    assert deleted["success"], deleted
    cleanup = await _send(client, {"type": "houseplan/files/cleanup", "marker_id": "source"})
    assert cleanup["success"], cleanup
    assert file.read_bytes() == b"original manual"
    undo = await _send(client, _action(await _pair(client), "undo", "operation_1073_undo", token=deleted["result"]["history_token"]))
    assert undo["success"], undo
    released = await _send(client, {"type": "houseplan/marker/history/retain", "history_session": SESSION, "tokens": []})
    assert released["success"], released
    assert file.read_bytes() == b"original manual"


@pytest.mark.parametrize("phase", ["after_config", "persistent"])
async def test_structural_commit_failure_is_complete_or_restored_before_receipt(hass, hass_ws_client, monkeypatch, phase):
    client, before = await _seed(hass, hass_ws_client)
    rt = get_data(hass)
    original = rt.config_store.async_save
    failed = False

    async def save(value):
        nonlocal failed
        target = value.get("rev") == before[0]["rev"] + 1
        if target and phase == "persistent":
            failed = True
            raise OSError("bounded injected disk refusal")
        await original(value)
        if target and not failed:
            failed = True
            raise OSError("lost acknowledgment after durable config")

    monkeypatch.setattr(rt.config_store, "async_save", save)
    answer = await _send(client, _action(before, "delete", targets=[{"id": "source", "binding": "virtual"}]))
    monkeypatch.setattr(rt.config_store, "async_save", original)
    assert failed
    if phase == "persistent":
        assert answer["error"]["code"] == "commit_failed"
        assert await _pair(client) == before
        assert not rt.marker_history.sessions[SESSION].receipts
    else:
        assert answer["success"], answer
        after = await _pair(client)
        assert after[0]["rev"] == before[0]["rev"] + 1
        assert after[1]["rev"] == before[1]["rev"] + 1
