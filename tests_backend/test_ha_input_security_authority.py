"""Live authorization, bounded input and file ownership witnesses (#1605)."""
import asyncio
import inspect
import json
import re
import shutil
from pathlib import Path
from threading import Event
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from aiohttp import FormData
from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.components import websocket_api
from homeassistant.components.http import KEY_HASS
from homeassistant.helpers import service

from custom_components.houseplan import ha_integration
from custom_components.houseplan import websocket_api as ws
from custom_components.houseplan.backup_files import durable_file_job
from custom_components.houseplan.command_adapter import HaWriteAuthority
from custom_components.houseplan.const import CONF_ADMIN_ONLY, DOMAIN, FILES_DIR
from custom_components.houseplan.core.command_ports import CommandError
from custom_components.houseplan.core.constants import PLANS_DIR
from custom_components.houseplan.core.content_files import FilesystemContent
from custom_components.houseplan.core.plans import attachment_directory
from custom_components.houseplan.http_api import HouseplanUploadView
from custom_components.houseplan.marker_history_websocket import (
    ws_marker_history_retain,
)
from custom_components.houseplan.store import get_data
from tests_backend.test_ha_websocket import _setup

REPORT = Path(__file__).resolve().parents[1] / "docs/security/1605-backend-core-audit.md"


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    yield


def connection():
    return SimpleNamespace(user=SimpleNamespace(
        id="editor", is_admin=False, is_active=True,
        groups=[SimpleNamespace(id=GROUP_ID_USER)],
    ), send_result=Mock(), send_error=Mock())


async def test_registered_ha_surfaces_match_audit_report(hass, monkeypatch):
    commands, views, services = [], [], []
    monkeypatch.setattr(websocket_api, "async_register_command",
                        lambda hass, handler: commands.append(handler._ws_command))
    monkeypatch.setattr(service, "async_register_admin_service",
                        lambda hass, domain, name, *_args: services.append(f"{domain}.{name}"))
    monkeypatch.setattr(hass, "http", SimpleNamespace(register_view=views.append), raising=False)
    assert await ha_integration.async_setup(hass, {})

    text = REPORT.read_text(encoding="utf-8")
    for kind, actual in (("WS", commands), ("HTTP", [v.url for v in views]), ("HA", services)):
        declared = re.findall(rf"^\| {kind} \| `([^`]+)` \|", text, re.M)
        assert len(declared) == len(set(declared)), f"duplicate {kind} row"
        assert len(actual) == len(set(actual)), f"duplicate {kind} registration"
        assert set(declared) == set(actual)
    for view in views:
        row = next(line for line in text.splitlines() if line.startswith(f"| HTTP | `{view.url}` |"))
        assert f"auth={str(view.requires_auth).lower()}" in row
        for method in ("get", "post", "put", "delete", "patch"):
            if callable(getattr(view, method, None)):
                assert method.upper() in row


@pytest.mark.parametrize(("handler", "lock", "message"), [
    (ws.ws_layout_update, "write_lock", {"device_id": "lamp", "pos": {"x": .3, "y": .4}}),
    (ws.ws_layout_delete, "write_lock", {"device_id": "lamp"}),
    (ws.ws_files_migrate, "upload_lock", {"from_id": "source", "to_id": "copy"}),
    (ws.ws_files_cleanup, "write_lock", {"marker_id": "source"}),
    (ws_marker_history_retain, "write_lock", {"history_session": "editor-draft", "tokens": []}),
    (ws.ws_trail_delete, "trail_lock", {"marker_id": "lamp"}),
])
async def test_revoked_queued_writer_keeps_storage(hass, monkeypatch, handler, lock, message):
    await _setup(hass, options={CONF_ADMIN_ONLY: False})
    runtime = get_data(hass)
    assert runtime is not None
    layout = {"layout": {"lamp": {"x": .1, "y": .2}}, "rev": 3}
    await runtime.store.async_save(layout)
    config_before = await runtime.config_store.async_load()
    root = Path(hass.config.path(FILES_DIR))
    source = root / "source" / "manual.pdf"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"unrelated attachment")
    client = connection()
    admitted = asyncio.Event()
    real = ws._check_write

    def observe(hass, connection):
        allowed = real(hass, connection)
        admitted.set()
        return allowed

    monkeypatch.setattr(ws, "_check_write", observe)
    if lock == "trail_lock":
        recorder = hass.data[DOMAIN]["trail_recorder"]
        fence = recorder._refresh_lock
        monkeypatch.setattr(recorder, "_delete_many_locked",
                            Mock(side_effect=AssertionError("revoked trail deletion entered")))
    else:
        fence = getattr(runtime, lock)
    async with fence:
        pending = asyncio.create_task(inspect.unwrap(handler)(hass, client, {"id": 17, **message}))
        await asyncio.wait_for(admitted.wait(), 3)
        client.user.is_active = False
    await pending
    assert client.send_error.call_args.args[:2] == (17, "unauthorized")
    client.send_result.assert_not_called()
    assert await runtime.store.async_load() == layout
    assert await runtime.config_store.async_load() == config_before
    assert source.read_bytes() == b"unrelated attachment"
    assert not (root / "copy").exists()


@pytest.mark.parametrize("handler", [ws.ws_layout_update, ws.ws_layout_delete])
async def test_writer_is_rechecked_after_layout_read(hass, monkeypatch, handler):
    await _setup(hass, options={CONF_ADMIN_ONLY: False})
    runtime = get_data(hass)
    initial = {"layout": {"lamp": {"x": .1, "y": .2}}, "rev": 7}
    await runtime.store.async_save(initial)
    client = connection()
    resolve = ws._resolved_write_pair

    async def lose_right_after_read(*args):
        result = await resolve(*args)
        client.user.is_active = False
        return result

    monkeypatch.setattr(ws, "_resolved_write_pair", lose_right_after_read)
    await inspect.unwrap(handler)(hass, client, {"id": 18, "device_id": "lamp", "pos": {"x": .2, "y": .3}})
    assert client.send_error.call_args.args[:2] == (18, "unauthorized")
    client.send_result.assert_not_called()
    assert await runtime.store.async_load() == initial


async def test_authority_does_not_follow_reloaded_runtime(hass, monkeypatch):
    from custom_components.houseplan import command_adapter

    await _setup(hass, options={CONF_ADMIN_ONLY: False})
    runtime = get_data(hass)
    authority = HaWriteAuthority(hass, connection(), runtime)
    assert authority.can_write
    replacement = SimpleNamespace(instance_id=runtime.instance_id)
    monkeypatch.setattr(command_adapter, "get_data", lambda _hass: replacement)
    assert not authority.can_write
    with pytest.raises(CommandError) as error:
        authority.ensure()
    assert error.value.code == "unauthorized"


async def test_point_layout_shares_capacity_but_existing_points_remain_editable(hass, monkeypatch):
    await _setup(hass, options={CONF_ADMIN_ONLY: False})
    runtime = get_data(hass)
    original = {"layout": {"lamp": {"x": .1, "y": .2}}, "rev": 7}
    await runtime.store.async_save(original)
    client = connection()
    monkeypatch.setattr(ws, "MAX_LAYOUT", 1)
    update = inspect.unwrap(ws.ws_layout_update)
    await update(hass, client, {"id": 17, "device_id": "clock", "pos": {"x": .2, "y": .3}})
    assert client.send_error.call_args.args[:2] == (17, "invalid_format")
    assert await runtime.store.async_load() == original
    await update(hass, client, {"id": 18, "device_id": "lamp", "pos": {"x": .2, "y": .3}})
    assert client.send_result.call_args.args[:2] == (18, {"ok": True, "rev": 8})


@pytest.mark.parametrize(("route", "field"), [
    ("/api/houseplan/upload", "marker_id"),
    ("/api/houseplan/plans/upload", "space_id"),
    ("/api/houseplan/plans/upload", "ext"),
    ("/api/houseplan/plans/upload", "ignored"),
    ("/api/houseplan/assets/upload", "ignored"),
])
async def test_multipart_metadata_budget_applies_before_publication(hass, hass_client, route, field):
    await _setup(hass)
    client = await hass_client()
    form = FormData()
    form.add_field(field, "n" * 1025)
    form.add_field("file", b"fixture", filename="fixture.pdf")
    response = await client.post(route, data=form)
    assert response.status == 413
    assert (await response.json())["error"] == "too_large"
    assert not any(path.is_file() for path in Path(hass.config.path(FILES_DIR)).rglob("*"))


async def test_multipart_part_count_is_bounded(hass, hass_client):
    await _setup(hass)
    client = await hass_client()
    form = FormData()
    form.add_field("file", b"fixture", filename="fixture.pdf")
    for position in range(8):
        form.add_field(f"extra_{position}", "ok")
    response = await client.post("/api/houseplan/upload", data=form)
    assert response.status == 413
    assert (await response.json())["error"] == "too_large"
    assert not any(path.is_file() for path in Path(hass.config.path(FILES_DIR)).rglob("*"))


async def test_attachment_checks_authority_before_publishing(hass):
    await _setup(hass, options={CONF_ADMIN_ONLY: False})
    runtime = get_data(hass)
    user = connection().user
    staged = asyncio.Event()

    async def file_chunks():
        staged.set()
        yield b"fixture"
        yield b""

    chunks = file_chunks()
    part = SimpleNamespace(name="file", filename="fixture.pdf", read_chunk=lambda _size: anext(chunks))

    async def multipart():
        async def parts():
            yield part

        return parts()

    request = SimpleNamespace(app={KEY_HASS: hass}, get={"hass_user": user}.get, multipart=multipart)
    async with runtime.upload_lock:
        pending = asyncio.create_task(HouseplanUploadView().post(request))
        await asyncio.wait_for(staged.wait(), 3)
        user.is_active = False
    response = await pending
    assert response.status == 403
    assert json.loads(response.body) == {"error": "unauthorized"}
    assert not any(path.is_file() for path in Path(hass.config.path(FILES_DIR)).rglob("*"))


async def test_content_delete_cancellation_keeps_the_transaction(tmp_path):
    plan = tmp_path / PLANS_DIR / "fixture.png"
    plan.parent.mkdir(parents=True)
    plan.write_bytes(b"synthetic plan")
    started, release, locked_by_next = (asyncio.Event() for _ in range(3))

    class GatedExecutor:
        async def run(self, function, *args):
            started.set()
            await release.wait()
            return function(*args)

    content = FilesystemContent(tmp_path, GatedExecutor())

    async def delete():
        async with content.transaction():
            await content.delete_plan(plan.name)

    async def next_writer():
        async with content.transaction():
            assert not plan.exists()
            locked_by_next.set()

    pending = asyncio.create_task(delete())
    await asyncio.wait_for(started.wait(), 3)
    following = asyncio.create_task(next_writer())
    try:
        pending.cancel()
        await asyncio.sleep(0)
        pending.cancel()
        await asyncio.sleep(0)
        assert plan.exists()
        assert not locked_by_next.is_set()
    finally:
        release.set()
    with pytest.raises(asyncio.CancelledError):
        await pending
    await asyncio.wait_for(following, 3)
    assert locked_by_next.is_set()


def test_attachment_directory_does_not_follow_an_alias(tmp_path):
    base = tmp_path / "files"
    original = base / "original"
    original.mkdir(parents=True)
    document = original / "manual.pdf"
    document.write_bytes(b"owned by original")
    (base / "alias").symlink_to(original, target_is_directory=True)
    assert attachment_directory(base, "original") == original
    with pytest.raises(OSError, match="Invalid attachment directory"):
        attachment_directory(base, "alias")
    assert document.read_bytes() == b"owned by original"


async def test_uncommitted_attachment_copy_rolls_back_its_own_publications(hass, monkeypatch):
    await _setup(hass, options={CONF_ADMIN_ONLY: False})
    root = Path(hass.config.path(FILES_DIR))
    first, second, existing = root / "source" / "a.pdf", root / "source" / "b.pdf", root / "dest" / "a.pdf"
    first.parent.mkdir(parents=True)
    existing.parent.mkdir(parents=True)
    first.write_bytes(b"copy me")
    second.write_bytes(b"second source")
    existing.write_bytes(b"already owned by destination")
    copy2 = shutil.copy2

    def fail_second(src, dst):
        if src == second:
            raise OSError("synthetic write failure")
        return copy2(src, dst)

    monkeypatch.setattr(shutil, "copy2", fail_second)
    client = connection()
    await inspect.unwrap(ws.ws_files_migrate)(hass, client, {"id": 17, "from_id": "source", "to_id": "dest"})
    assert client.send_error.call_args.args[:2] == (17, "io_error")
    assert "synthetic" not in client.send_error.call_args.args[2]
    assert list(existing.parent.iterdir()) == [existing]
    assert existing.read_bytes() == b"already owned by destination"
    assert first.read_bytes() == b"copy me"
    assert second.read_bytes() == b"second source"


async def test_repeated_cancel_settles_private_worker_before_unlock(hass, tmp_path):
    release = Event()
    started = asyncio.Event()
    lock = asyncio.Lock()
    stage = tmp_path / "our-stage.txt"

    def create():
        hass.loop.call_soon_threadsafe(started.set)
        assert release.wait(4), "fixture failed to release worker"
        stage.write_text("complete", encoding="utf-8")
        return stage

    async def own():
        async with lock:
            await durable_file_job(hass, create, discard=Path.unlink)

    pending = asyncio.create_task(own())
    try:
        await asyncio.wait_for(started.wait(), 3)
        for _ in range(2):
            pending.cancel()
            await asyncio.sleep(0)
            assert lock.locked() and not pending.done()
    finally:
        release.set()
    with pytest.raises(asyncio.CancelledError):
        await pending
    assert not lock.locked()
    assert not stage.exists()

