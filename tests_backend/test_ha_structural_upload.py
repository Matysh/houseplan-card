"""#1167: actual HA HTTP/auth/WS/Stores transport; no Docker or owner instance.

Only the aiohttp *client receive* allowance is raised for reading a >4 MiB
config/get response. HA's inbound websocket ceiling and all product validators
are unchanged. Save observers always delegate to the real Store implementation.
"""
from __future__ import annotations

import asyncio
import copy
import hashlib
import json
import time
import threading
from datetime import datetime

import pytest
from homeassistant.auth.const import GROUP_ID_READ_ONLY, GROUP_ID_USER
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.const import CONF_ADMIN_ONLY, DOMAIN
from custom_components.houseplan.store import get_data
from custom_components.houseplan.structural_upload import uploads

TYPE = "houseplan/config/set"
URL = "/api/houseplan/structural/upload"
PADDING = "synthetic-transport-only:" + "x" * (4 * 1024 * 1024 + 4096)


@pytest.fixture(autouse=True)
def _enable(enable_custom_integrations):
    yield


class _Socket:
    def __init__(self, websocket):
        self.websocket = websocket
        self.sequence = 0

    async def send(self, message):
        self.sequence += 1
        await self.websocket.send_json({**message, "id": self.sequence})
        answer = await self.websocket.receive_json(timeout=30)
        assert answer["id"] == self.sequence, answer
        return answer

    async def pair(self):
        result = []
        for kind in ("config", "layout"):
            answer = await self.send({"type": "houseplan/" + kind + "/get"})
            assert answer["success"], answer
            result.append(answer["result"])
        return result


async def _socket(http, access_token):
    # This is a public aiohttp receive limit, not a change to HA's input limit.
    websocket = await http.ws_connect("/api/websocket", max_msg_size=33 * 1024 * 1024)
    assert (await websocket.receive_json())["type"] == "auth_required"
    await websocket.send_json({"type": "auth", "access_token": access_token})
    assert (await websocket.receive_json())["type"] == "auth_ok"
    return _Socket(websocket)


async def _setup(hass, hass_client, hass_access_token, *, household=False):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={},
                            options={CONF_ADMIN_ONLY: not household})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    assert await async_setup_component(hass, "websocket_api", {})
    await hass.async_block_till_done()
    http = await hass_client()
    socket = await _socket(http, hass_access_token)
    source = {"spaces": [{"id": "f1", "title": "Synthetic", "rooms": [],
                          "view_box": [0, 0, 1, 1]}], "markers": [], "settings": {}}
    saved = await socket.send({"type": TYPE, "config": source, "expected_rev": 0})
    assert saved["success"], saved
    await hass.async_block_till_done()
    return http, socket, await socket.pair()


def _candidate(before):
    config = copy.deepcopy(before[0]["config"])
    config["transport_probe"] = PADDING
    return {"type": TYPE, "config": config, "expected_rev": before[0]["rev"]}


def _raw(message):
    raw = json.dumps(message, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    assert 4 * 1024 * 1024 < len(raw) < 16 * 1024 * 1024
    return raw


async def _stage(http, message):
    raw = _raw(message)
    response = await http.post(URL, data=raw, headers={"content-type": "application/json"})
    assert response.status == 200, await response.text()
    staged = await response.json()
    assert staged["purpose"] == message["type"]
    assert staged["sha256"] == hashlib.sha256(raw).hexdigest()
    assert isinstance(staged["token"], str) and 16 <= len(staged["token"]) <= 100
    assert datetime.fromisoformat(staged["expires_at"].replace("Z", "+00:00")).timestamp() > time.time() - 1
    return staged


def _compact(message, staged):
    compact = {"type": message["type"], "upload_token": staged["token"],
               "upload_sha256": staged["sha256"]}
    for key in ("expected_rev", "expected_config_rev", "expected_layout_rev",
                "direction", "action", "space_id"):
        if key in message:
            compact[key] = message[key]
    assert len(json.dumps(compact).encode()) < 1024
    return compact


def _observe_saves(hass, monkeypatch):
    runtime = get_data(hass)
    calls = {"config": 0, "layout": 0}
    for key, store in (("config", runtime.config_store), ("layout", runtime.store)):
        original = store.async_save

        async def save(value, *args, _key=key, _original=original, **kwargs):
            calls[_key] += 1
            return await _original(value, *args, **kwargs)

        monkeypatch.setattr(store, "async_save", save)
    return calls


async def _user(hass, hass_client, *, read_only=False):
    user = await hass.auth.async_create_user(
        "Synthetic transport user", group_ids=[GROUP_ID_READ_ONLY if read_only else GROUP_ID_USER])
    refresh = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    access = hass.auth.async_create_access_token(refresh)
    http = await hass_client(access)
    return user, http, await _socket(http, access)


async def _assert_refused(socket, message, code, owner, before, saves):
    answer = await socket.send(message)
    assert not answer["success"], answer
    assert answer["error"]["code"] == code, answer
    assert await owner.pair() == before
    assert saves == {"config": 0, "layout": 0}


async def test_large_http_candidate_commits_via_real_compact_ws_and_replay_cannot_write(
    hass, hass_client, hass_access_token, monkeypatch,
):
    http, socket, before = await _setup(hass, hass_client, hass_access_token)
    message = _candidate(before)
    saves = _observe_saves(hass, monkeypatch)
    staged = await _stage(http, message)
    assert await socket.pair() == before, "HTTP staging cannot change either durable store"
    assert saves == {"config": 0, "layout": 0}
    compact = _compact(message, staged)
    answer = await socket.send(compact)
    assert answer["success"] and answer["result"]["ok"], answer
    assert answer["result"]["rev"] == before[0]["rev"] + 1
    after = await socket.pair()
    assert after[0]["config"] == message["config"]
    assert after[0]["rev"] == answer["result"]["rev"]
    assert after[1] == before[1], "config-only token cannot silently touch layout"
    if "config" in answer["result"]:
        assert answer["result"]["config"] == after[0]["config"]
    assert saves["config"] > 0 and saves["layout"] == 0
    calls = saves.copy()
    replay = await socket.send(compact)
    assert not replay["success"] and replay["error"]["code"] == "upload_expired", replay
    assert await socket.pair() == after
    assert saves == calls, "a replay cannot call a durable writer"


@pytest.mark.parametrize("bad", ["purpose", "digest", "controls", "heavy_mix"])
async def test_token_purpose_digest_and_control_mismatch_preserve_real_source_pair(
    hass, hass_client, hass_access_token, monkeypatch, bad,
):
    http, owner, before = await _setup(hass, hass_client, hass_access_token)
    message = _candidate(before)
    staged = await _stage(http, message)
    compact = _compact(message, staged)
    code = "upload_control_mismatch"
    if bad == "purpose":
        compact["type"] = "houseplan/layout/set"
        code = "upload_purpose"
    elif bad == "digest":
        compact["upload_sha256"] = "0" * 64
        code = "upload_digest_mismatch"
    elif bad == "controls":
        compact["expected_rev"] += 1
    else:
        compact["config"] = message["config"]
        code = "invalid_format"
    saves = _observe_saves(hass, monkeypatch)
    if bad == "heavy_mix":
        # Keep the mixed frame small: domain data must never bypass token resolution.
        compact["config"] = {}
    await _assert_refused(owner, compact, code, owner, before, saves)


async def test_foreign_writer_cannot_adopt_or_consume_another_owners_staged_token(
    hass, hass_client, hass_access_token, monkeypatch,
):
    http, owner, before = await _setup(hass, hass_client, hass_access_token, household=True)
    message = _candidate(before)
    staged = await _stage(http, message)
    _, _, foreign = await _user(hass, hass_client)
    saves = _observe_saves(hass, monkeypatch)
    await _assert_refused(foreign, _compact(message, staged), "upload_owner_mismatch", owner, before, saves)
    accepted = await owner.send(_compact(message, staged))
    assert accepted["success"], accepted
    assert (await owner.pair())[0]["config"] == message["config"]


async def test_expired_token_is_checked_at_real_ws_boundary_without_source_write(
    hass, hass_client, hass_access_token, monkeypatch,
):
    http, owner, before = await _setup(hass, hass_client, hass_access_token)
    now = [time.time()]
    manager = uploads(get_data(hass))
    monkeypatch.setattr(manager, "clock", lambda: now[0])
    message = _candidate(before)
    staged = await _stage(http, message)
    expiry = datetime.fromisoformat(staged["expires_at"].replace("Z", "+00:00")).timestamp()
    assert expiry == pytest.approx(now[0] + 120, abs=0.001)
    now[0] += 121
    saves = _observe_saves(hass, monkeypatch)
    await _assert_refused(owner, _compact(message, staged), "upload_expired", owner, before, saves)


async def test_real_http_auth_and_read_only_ws_cannot_stage_or_use_a_writer_token(
    hass, hass_client, hass_client_no_auth, hass_access_token, monkeypatch,
):
    http, owner, before = await _setup(hass, hass_client, hass_access_token, household=True)
    message = _candidate(before)
    unauth = await hass_client_no_auth()
    denied = await unauth.post(URL, data=_raw(message), headers={"content-type": "application/json"})
    assert denied.status == 401
    _, reader_http, reader_ws = await _user(hass, hass_client, read_only=True)
    denied = await reader_http.post(URL, data=_raw(message), headers={"content-type": "application/json"})
    assert denied.status == 403 and (await denied.json())["error"] == "unauthorized"
    assert not uploads(get_data(hass)).uploads
    staged = await _stage(http, message)
    saves = _observe_saves(hass, monkeypatch)
    await _assert_refused(reader_ws, _compact(message, staged), "unauthorized", owner, before, saves)


async def test_permission_loss_after_upload_is_not_a_token_authorization(
    hass, hass_client, hass_access_token, monkeypatch,
):
    _, owner, before = await _setup(hass, hass_client, hass_access_token, household=True)
    user, http, writer = await _user(hass, hass_client)
    message = _candidate(before)
    staged = await _stage(http, message)
    await hass.auth.async_update_user(user, group_ids=[GROUP_ID_READ_ONLY])
    saves = _observe_saves(hass, monkeypatch)
    await _assert_refused(writer, _compact(message, staged), "unauthorized", owner, before, saves)


async def test_cas_is_rechecked_after_staging_and_stale_candidate_never_overwrites_new_revision(
    hass, hass_client, hass_access_token, monkeypatch,
):
    http, owner, before = await _setup(hass, hass_client, hass_access_token)
    message = _candidate(before)
    staged = await _stage(http, message)
    newer = copy.deepcopy(before[0]["config"])
    newer["transport_other_writer"] = "accepted intervening update"
    accepted = await owner.send({"type": TYPE, "config": newer, "expected_rev": before[0]["rev"]})
    assert accepted["success"], accepted
    current = await owner.pair()
    assert current[0]["rev"] == before[0]["rev"] + 1
    saves = _observe_saves(hass, monkeypatch)
    await _assert_refused(owner, _compact(message, staged), "conflict", owner, current, saves)
    await _assert_refused(owner, _compact(message, staged), "upload_expired", owner, current, saves)


@pytest.mark.parametrize("boundary", ["http_finish", "ws_resolve"])
async def test_real_permission_revocation_during_executor_await_prevents_acceptance(
    hass, hass_client, hass_access_token, monkeypatch, boundary,
):
    _, owner, before = await _setup(hass, hass_client, hass_access_token, household=True)
    user, http, writer = await _user(hass, hass_client)
    message = _candidate(before)
    manager = uploads(get_data(hass))
    staged = await _stage(http, message) if boundary == "ws_resolve" else None
    method = "finish" if boundary == "http_finish" else "resolve"
    original = getattr(manager, method)
    entered = asyncio.Event()
    released = threading.Event()
    loop = asyncio.get_running_loop()

    def pause_after_real_work(*args):
        # Execute real parsing/hash/resolve first. Only pause its executor return.
        result = original(*args)
        loop.call_soon_threadsafe(entered.set)
        assert released.wait(5), "test failed to release the real executor result"
        return result

    monkeypatch.setattr(manager, method, pause_after_real_work)
    saves = _observe_saves(hass, monkeypatch)
    if boundary == "http_finish":
        pending = asyncio.ensure_future(http.post(
            URL, data=_raw(message), headers={"content-type": "application/json"}))
    else:
        pending = asyncio.create_task(writer.send(_compact(message, staged)))
    try:
        await asyncio.wait_for(entered.wait(), timeout=5)
        # Real HA auth mutation, with the HTTP/WS request still awaiting executor.
        await hass.auth.async_update_user(user, group_ids=[GROUP_ID_READ_ONLY])
    finally:
        released.set()
    answer = await pending
    if boundary == "http_finish":
        assert answer.status == 403
        assert (await answer.json())["error"] == "unauthorized"
        assert not manager.uploads, "denied in-flight HTTP upload must be cleaned"
    else:
        assert not answer["success"], answer
        assert answer["error"]["code"] == "unauthorized", answer
        assert staged["token"] in manager.uploads, "rejected ACL cannot consume a token"
    assert await owner.pair() == before
    assert saves == {"config": 0, "layout": 0}