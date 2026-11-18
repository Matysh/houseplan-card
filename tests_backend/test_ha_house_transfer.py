"""Real HA Store/authority boundaries for independent plan-only house commits."""
import copy
import io
import json
import zipfile

import pytest
from test_house_archive import archive
from test_plan_commands import valid_service

from custom_components.houseplan import websocket_api as wsapi
from custom_components.houseplan.command_adapter import plan_commands
from custom_components.houseplan.core.command_ports import CommandError
from custom_components.houseplan.store import (
    async_resolve_pending_pair,
    async_save_config_state,
)
from tests_backend.test_ha_backup_archive import (  # noqa: F401
    Connection,
    http_user,
    setup,
    transport,
)


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    yield


async def staged(hass, tmp_path):
    _, runtime = await setup(hass)
    config = valid_service().storage.config_data["config"]
    async with runtime.write_lock:
        await async_save_config_state(runtime, config, 4, canonical=True)
        await runtime.store.async_save({"rev": 7, "layout": {}, "unrelated": {"keep": True}})
    commands = plan_commands(hass, Connection(), runtime)
    # Settle existing versioned migration before taking the transfer's base pair.
    await commands.execute({"type": "houseplan/config/get"})
    raw = archive(tmp_path)[0].read_bytes()

    async def blocks():
        yield raw

    reply = await commands.house_preview(blocks(), len(raw), "ha-import")
    return runtime, commands, reply


def apply_request(reply):
    return {"type": "houseplan/import/apply", "transfer_kind": "house", "token": reply["token"],
            "expected_config_rev": reply["config_rev"], "expected_layout_rev": reply["layout_rev"]}


async def test_native_house_commit_without_zigbee_preserves_existing_pair_and_metadata(hass, tmp_path):
    runtime, commands, reply = await staged(hass, tmp_path)
    before_config = copy.deepcopy(await runtime.config_store.async_load())
    before_layout = copy.deepcopy(await runtime.store.async_load())
    coordinator, runtime.zigbee_coordinator = runtime.zigbee_coordinator, None
    try:
        result = await commands.execute(apply_request(reply))
        config, layout = await runtime.config_store.async_load(), await runtime.store.async_load()
        assert result["ok"] and not result["can_undo"]
        assert (config["rev"], layout["rev"]) == (reply["config_rev"] + 1, reply["layout_rev"] + 1)
        assert config["config"]["spaces"][:1] == before_config["config"]["spaces"]
        assert config["config"]["markers"] == before_config["config"]["markers"]
        assert config["config"]["settings"] == before_config["config"]["settings"]
        assert layout["unrelated"] == before_layout["unrelated"]
        assert "optimize_pending" not in layout and not runtime.house_resources.active
    finally:
        runtime.zigbee_coordinator = coordinator


@pytest.mark.parametrize("after_write", [False, True])
async def test_native_failed_config_half_rolls_back_or_accepts_lost_ack(hass, tmp_path, monkeypatch, after_write):
    runtime, commands, reply = await staged(hass, tmp_path)
    before_config = copy.deepcopy(await runtime.config_store.async_load())
    before_layout = copy.deepcopy(await runtime.store.async_load())
    original = runtime.config_store.async_save

    async def unavailable(data):
        if data["rev"] > before_config["rev"]:
            if after_write:
                await original(data)
            raise OSError("synthetic store failure")
        await original(data)

    monkeypatch.setattr(runtime.config_store, "async_save", unavailable)
    if after_write:
        result = await commands.execute(apply_request(reply))
        assert result["ok"]
        assert len((await runtime.config_store.async_load())["config"]["spaces"]) == 4
    else:
        with pytest.raises(CommandError) as error:
            await commands.execute(apply_request(reply))
        assert error.value.code == "commit_failed"
        assert await runtime.config_store.async_load() == before_config
        assert await runtime.store.async_load() == before_layout
    assert not runtime.house_resources.active


async def test_native_restart_recovers_typed_house_intent_before_cas_without_backup_cache(hass, tmp_path):
    runtime, commands, reply = await staged(hass, tmp_path)
    lease = runtime.house_resources.tokens[reply["token"]]
    record = lease["record"]
    pending = {"kind": "house_import", "config": record["candidate"], "layout": record["layout"],
        "config_rev": reply["config_rev"] + 1, "layout_rev": reply["layout_rev"] + 1,
        "final_metadata": {"unrelated": {"keep": True}},
        "house_files": {"action": "publish", "descriptor": record["files"]}}
    async with runtime.write_lock:
        await wsapi._persist_pair_intent(runtime, pending)
        await runtime.house_resources.recover(record["files"], "publish")
        # Files + the first Store reached disk; process-local leases disappear.
        await runtime.config_store.async_save({"config": pending["config"], "rev": pending["config_rev"]})
        runtime.house_resources = None
        coordinator, runtime.zigbee_coordinator = runtime.zigbee_coordinator, None
        try:
            resolved = await async_resolve_pending_pair(runtime)
        finally:
            runtime.zigbee_coordinator = coordinator
    assert resolved.recovered_kind == "house_import"
    assert resolved.config_data["config"] == pending["config"]
    assert resolved.layout_data == {"rev": pending["layout_rev"], "layout": pending["layout"],
                                    "unrelated": {"keep": True}}
    folder = commands.environment.house.root / "houseplan/.house-staging" / lease["session"]
    assert not folder.exists()


async def ws_request(client, message):
    async with client.ws_connect("/api/websocket") as socket:
        assert (await socket.receive_json())["type"] == "auth_required"
        await socket.send_json({"type": "auth", "access_token": client.session.headers["Authorization"][7:]})
        assert (await socket.receive_json())["type"] == "auth_ok"
        await socket.send_json({"id": 1, **message})
        result = await socket.receive_json()
        assert result["success"] is True, result
        return result["result"]


async def test_real_http_and_websocket_house_is_writer_not_admin_and_full_zip_stays_admin(hass, hass_client, tmp_path):
    entry, runtime = await setup(hass)
    hass.config_entries.async_update_entry(entry, options={"admin_only": False})
    _, client = await http_user(hass, hass_client, admin=False)
    raw = archive(tmp_path)[0].read_bytes()
    response = await client.post("/api/houseplan/transfer/import/preview", data=raw,
                                 headers={"X-Houseplan-Operation": "writer-import", "Content-Type": "application/json"})
    assert response.status == 200, await response.text()
    reply = await response.json()
    assert reply["preview"]["kind"] == "house"
    applied = await ws_request(client, apply_request(reply))
    assert applied["ok"] and len((await runtime.config_store.async_load())["config"]["spaces"]) == 3
    denied = await client.post("/api/houseplan/backup/import/preview", data=raw)
    assert denied.status == 403
    assert not runtime.house_resources.active
    assert runtime.backup_service is None or not runtime.backup_service.sessions


async def test_real_http_refuses_wrong_and_future_prefix_before_private_allocation(hass, hass_client):
    from custom_components.houseplan.core.house_prefix import canonical_prefix

    _, runtime = await setup(hass)
    _, client = await http_user(hass, hass_client)
    for raw, code in ((b"PK\x03\x04ordinary full backup", "not_plan_transfer"),
                      (canonical_prefix(2), "unsupported-transfer")):
        response = await client.post("/api/houseplan/transfer/import/preview", data=raw,
                                     headers={"X-Houseplan-Operation": "wrong-prefix"})
        assert response.status == 400 and (await response.json())["error"] == code
    assert runtime.house_resources is not None and not runtime.house_resources.active
    assert not (runtime.house_resources.root / "houseplan/.house-staging").exists()


async def test_real_house_download_is_owner_bound_get_and_incomplete_requires_explicit_consent(hass, hass_client, tmp_path):
    entry, runtime = await setup(hass)
    hass.config_entries.async_update_entry(entry, options={"admin_only": False})
    _, client = await http_user(hass, hass_client, admin=False)
    _, foreign = await http_user(hass, hass_client, admin=False)
    # House source has no local files: each unavailable image is explicitly listed.
    config = valid_service().storage.config_data["config"]
    config["spaces"][0]["plan_url"] = "/api/houseplan/content/plans/_/missing.png"
    async with runtime.write_lock:
        await async_save_config_state(runtime, config, 1, canonical=True)
    prepared = await ws_request(client, {"type": "houseplan/export/create", "kind": "house", "plan_only": True})
    assert prepared["complete"] is False and prepared["missing_content"]
    denied = await foreign.get(prepared["download_url"])
    assert denied.status == 400 and prepared["token"] in runtime.house_resources.tokens
    needs_consent = await client.get(prepared["download_url"])
    assert needs_consent.status == 400 and (await needs_consent.json())["error"] == "content_confirmation_required"
    response = await client.get(prepared["download_url"] + "?confirm_missing_content=1")
    assert response.status == 200 and response.headers["Content-Type"] == "application/zip"
    raw = await response.read()
    with zipfile.ZipFile(io.BytesIO(raw)) as container:
        assert json.loads(container.read("manifest.json"))["format"] == "houseplan-plan-transfer"
        assert json.loads(container.read("document.json"))["kind"] == "house"
    assert not runtime.house_resources.active
    consumed = await client.get(prepared["download_url"])
    assert consumed.status == 400
