"""Portable full backups: real HA boundaries, bytes and hostile inputs (#936)."""
from __future__ import annotations

import asyncio
import base64
import copy
import hashlib
import io
import json
import os
import stat
import struct
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest
from homeassistant.auth.const import GROUP_ID_ADMIN, GROUP_ID_USER
from homeassistant.core import HomeAssistant
from PIL import Image
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan import websocket_api as wsapi
from custom_components.houseplan.backup_archive import build_archive, read_archive
from custom_components.houseplan.backup_files import stage_folder
from custom_components.houseplan.backup_service import get_backup_service
from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.import_export import ImportFailure, create_export
from custom_components.houseplan.store import async_save_config_state
from tests_backend import test_ha_zigbee_topology as zigbee_tests

# Reuse the existing offline MQTT boundary, with no copied provider behavior.
transport = zigbee_tests.transport


def sample(root: Path):
    image = io.BytesIO()
    Image.new("RGB", (8, 8), "#334455").save(image, format="PNG")
    raw = image.getvalue()
    aid = hashlib.sha256(raw).hexdigest()
    paths = [root / "houseplan/plans/a.copy.png", root / "houseplan/files/lamp/picture.png",
             root / f"houseplan/assets/{aid}.png"]
    for path in paths:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    (root / f"houseplan/assets/{aid}.json").write_text(json.dumps({"mime": "image/png"}))
    config = {"spaces": [
        {"id": "a", "title": "Ground", "view_box": [0, 0, 1, 1], "rooms": [], "plan_aspect": 1,
         "plan_url": "/api/houseplan/content/plans/_/a.copy.png?v=1",
         "decor": [{"id": "art", "kind": "image", "asset_id": aid, "x": .2, "y": .3,
                    "w": .25, "h": .35, "angle": 23, "opacity": .6, "flip_h": True}]},
        {"id": "b", "title": "Upper", "view_box": [0, 0, 1, 1], "rooms": [], "plan_aspect": 1,
         "plan_url": "/api/houseplan/content/plans/_/a.copy.png"}],
        "markers": [{"id": "lamp", "binding": "virtual", "pdfs": [
            {"url": "/api/houseplan/content/files/lamp/picture.png?v=2", "name": "Picture"}]}],
        "settings": {"filter_seeded": True}}
    document, _ = create_export(SimpleNamespace(instance_id="source"), {"config": config},
        {"layout": {"lamp": {"s": "a", "x": .4, "y": .5}}}, kind="full", space_id=None,
        card_version="review", config_root=root)
    return document, raw


def test_archive_contains_real_deduplicated_images_and_snapshot(tmp_path: Path):
    source, target = tmp_path / "source", tmp_path / "target"
    target.mkdir()
    document, raw = sample(source)
    topics = {"mesh": {"obtained_at": 12345, "map": {"nodes": [], "links": []}}}
    archive = tmp_path / "backup.zip"
    manifest = build_archive(archive, document, source, topics)
    assert manifest["complete"] is True
    assert len(manifest["images"]) == 4
    assert len(manifest["blobs"]) == 1
    result = read_archive(archive, target)
    assert result.topics == topics
    assert result.document["payload"] == document["payload"]
    assert [p.read_bytes() for p in result.blobs.values()] == [raw]


def test_archive_missing_image_is_explicit_and_preserves_geometry(tmp_path: Path):
    source = tmp_path / "source"
    document, _ = sample(source)
    (source / "houseplan/plans/a.copy.png").unlink()
    document["payload"]["config"]["spaces"][1]["plan_url"] = "https://example.org/plan.png"
    # Regenerate the legacy descriptive manifest after a test-owned config edit.
    from custom_components.houseplan.import_export import content_manifest
    document["content_manifest"] = content_manifest(document["payload"]["config"], source)
    archive = tmp_path / "backup.zip"
    manifest = build_archive(archive, document, source, {})
    assert manifest["complete"] is False
    assert [r["reason"] for r in manifest["images"] if "reason" in r] == ["missing", "external"]
    target = tmp_path / "target"
    target.mkdir()
    result = read_archive(archive, target)
    assert result.document["payload"]["config"]["spaces"][0]["decor"][0]["angle"] == 23


@pytest.mark.parametrize("bad_name", ["../escape", "/absolute", "C:/drive", "images/../escape", "images\\escape"])
def test_archive_hostile_names_are_rejected_before_any_target_write(tmp_path: Path, bad_name: str):
    archive = tmp_path / "bad.zip"
    with zipfile.ZipFile(archive, "w") as output:
        output.writestr(bad_name, b"evil")
    target = tmp_path / "target"
    target.mkdir()
    with pytest.raises(ImportFailure):
        read_archive(archive, target)
    assert list(target.iterdir()) == []


def test_native_wire_fixtures_contain_actual_valid_archive_bytes(tmp_path: Path):
    fixture = json.loads((Path(__file__).parents[1] / "demo/fixtures/backup-archive-v1.json").read_text())
    for index, item in enumerate((fixture, fixture["incomplete"])):
        path = tmp_path / f"{index}.zip"
        path.write_bytes(base64.b64decode(item["zip"], validate=True))
        target = tmp_path / str(index)
        target.mkdir()
        parsed = read_archive(path, target)
        assert parsed.manifest["complete"] == item["response"]["preview"]["archive"]["complete"]
        assert len(parsed.manifest["images"]) == 4
        assert len(parsed.document["payload"]["config"]["spaces"]) == 2
        assert len(parsed.blobs) == 1


@pytest.mark.parametrize("case", ["future", "unknown-field", "digest", "duplicate", "extra",
    "symlink", "encrypted", "unsafe-image", "crc", "deflate", "count", "expanded"])
def test_malformed_archive_matrix_never_changes_public_data(tmp_path, case):
    """Ordinary hostile bytes, not changed validation code or reduced limits."""
    document, _ = sample(tmp_path / "source")
    good = tmp_path / "good.zip"
    build_archive(good, document, tmp_path / "source", {})
    with zipfile.ZipFile(good) as archive:
        entries = {info.filename: archive.read(info) for info in archive.infolist()}
    manifest = json.loads(entries["manifest.json"])
    if case == "future":
        manifest["version"] = 999
    elif case == "unknown-field":
        manifest["extra"] = True
    elif case == "digest":
        manifest["document"]["sha256"] = "0" * 64
    elif case == "extra":
        entries["unknown.txt"] = b"unexpected"
    elif case == "unsafe-image":
        blob = next(iter(manifest["blobs"]))
        invalid = b"not an image"
        entries[blob] = invalid
        manifest["blobs"][blob].update(bytes=len(invalid), sha256=hashlib.sha256(invalid).hexdigest())
    entries["manifest.json"] = json.dumps(manifest).encode()
    bad = tmp_path / "bad.zip"
    with zipfile.ZipFile(bad, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, raw in entries.items():
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = ((stat.S_IFLNK if case == "symlink" and name == "document.json"
                                   else stat.S_IFREG) | 0o600) << 16
            archive.writestr(info, raw)
        if case == "duplicate":
            with pytest.warns(UserWarning, match="Duplicate name"):
                archive.writestr("manifest.json", entries["manifest.json"])
        if case == "count":
            for index in range(1601):
                archive.writestr(f"entry-{index}", b"x")
    data = bytearray(bad.read_bytes())
    if case in {"crc", "deflate", "encrypted", "expanded"}:
        central = data.index(b"PK\x01\x02")
        if case == "encrypted":
            struct.pack_into("<H", data, central + 8, struct.unpack_from("<H", data, central + 8)[0] | 1)
        elif case == "expanded":
            struct.pack_into("<I", data, central + 24, 2 * 1024**3 + 1)
        else:
            name_len, extra_len = struct.unpack_from("<HH", data, 26)
            offset = 30 + name_len + extra_len
            if case == "deflate":
                data[offset] = 0xff  # Reserved deflate block type.
            else:
                struct.pack_into("<I", data, central + 16, 0)  # Wrong CRC, otherwise intact bytes.
        bad.write_bytes(data)
    private = tmp_path / "private"
    private.mkdir()
    public_before = {str(p.relative_to(tmp_path / "source")): p.read_bytes()
                     for p in (tmp_path / "source").rglob("*") if p.is_file()}
    with pytest.raises(ImportFailure):
        read_archive(bad, private)
    assert {str(p.relative_to(tmp_path / "source")): p.read_bytes()
            for p in (tmp_path / "source").rglob("*") if p.is_file()} == public_before


def test_export_refuses_symlinked_source_and_strips_only_transport_secret(tmp_path):
    from custom_components.houseplan.backup_archive import strip_transport_credentials
    document, raw = sample(tmp_path / "source")
    path = tmp_path / "source/houseplan/plans/a.copy.png"
    path.unlink()
    secret = tmp_path / "outside.png"
    secret.write_bytes(raw)
    path.symlink_to(secret)
    document["payload"]["config"]["spaces"][0]["plan_url"] += "&authSig=DO-NOT-EXPORT"
    strip_transport_credentials(document)
    assert "authSig" not in document["payload"]["config"]["spaces"][0]["plan_url"]
    assert "v=1" in document["payload"]["config"]["spaces"][0]["plan_url"]
    manifest = build_archive(tmp_path / "safe.zip", document, tmp_path / "source", {})
    assert not manifest["complete"]
    assert [r["reason"] for r in manifest["images"] if "reason" in r] == ["invalid", "invalid"]


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    yield


class Connection:
    def __init__(self, *, admin: bool = True, owner: str = "backup-owner") -> None:
        self.user = SimpleNamespace(id=owner, is_admin=admin)
        self.result = None
        self.error = None

    def send_result(self, _id, value) -> None:
        self.result = value

    def send_error(self, _id, code, message) -> None:
        self.error = (code, message)


async def setup(hass: HomeAssistant):
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry, entry.runtime_data


async def test_full_portable_export_is_zip_not_reference_only_json(hass: HomeAssistant):
    """RED on old code: full export downloads JSON, not a portable ZIP."""
    await setup(hass)
    connection = Connection()
    await wsapi.ws_export_create.__wrapped__(hass, connection, {
        "id": 1, "type": "houseplan/export/create", "kind": "full",
        "card_version": "review", "archive": True,
    })
    assert connection.error is None, connection.error
    assert connection.result["filename"].endswith(".zip"), (
        "Full backup still downloads reference-only JSON instead of image-backed ZIP"
    )
    assert connection.result["archive"] is True
    assert "document" not in connection.result


class Content:
    def __init__(self, raw: bytes):
        self.raw = raw

    async def iter_chunked(self, count):
        for start in range(0, len(self.raw), count):
            yield self.raw[start:start + count]


async def portable_preview(hass, tmp_path):
    entry, runtime = await setup(hass)
    document, raw = sample(tmp_path / "source")
    document["payload"]["config"].setdefault("settings", {})["zigbee_topology"] = {"enabled": True}
    archive = tmp_path / "source.zip"
    topics = {"mesh": {"obtained_at": 12345, "map": {"nodes": [], "links": []}}}
    build_archive(archive, document, tmp_path / "source", topics)
    before = {"spaces": [{"id": "old", "title": "Previous", "view_box": [0, 0, 1, 1], "rooms": []}],
              "markers": [], "settings": {"zigbee_topology": {"enabled": True}}}
    async with runtime.write_lock:
        await async_save_config_state(runtime, before, 1)
        await runtime.store.async_save({"layout": {}, "rev": 1})
    coordinator = runtime.zigbee_coordinator
    old_topics = {"old-mesh": {"obtained_at": 54321, "map": {"nodes": [], "links": []}}}
    async with coordinator._lock:
        await coordinator._save(old_topics)
    service = get_backup_service(hass, runtime)
    response = await service.upload("backup-owner", Content(archive.read_bytes()), archive.stat().st_size)
    return entry, runtime, response, raw, before, old_topics


async def apply(hass, response, *, confirm=False, admin=True):
    connection = Connection(admin=admin)
    await wsapi.ws_import_apply.__wrapped__(hass, connection, {
        "id": 2, "type": "houseplan/import/apply", "token": response["token"],
        "expected_config_rev": response["expected_config_rev"],
        "expected_layout_rev": response["expected_layout_rev"], "confirm_missing_content": confirm,
    })
    return connection


async def test_portable_cross_root_apply_and_one_undo_restore_cache_and_files(hass, tmp_path):
    entry, rt, response, raw, before, old_topics = await portable_preview(hass, tmp_path)
    root = Path(hass.config.path(""))
    assert response["preview"]["archive"]["complete"] is True
    assert response["preview"]["archive"]["images"] == 4
    assert not list((root / "houseplan/plans").iterdir())  # No public writes in preview.
    result = await apply(hass, response)
    assert result.error is None, result.error
    current = await rt.config_store.async_load()
    assert current["config"]["spaces"][0]["title"] == "Ground"
    assert len(list((root / "houseplan/plans").glob("*.png"))) == 2
    assert [p.read_bytes() for p in (root / "houseplan/plans").glob("*.png")] == [raw, raw]
    provider = rt.zigbee_coordinator.snapshot("mesh")["provider"]
    assert provider["stale"] is True and provider["obtained_at"] == 12345
    assert (await rt.zigbee_coordinator._store.async_load())["entry_id"] == entry.entry_id
    assert not rt.import_previews and not rt.backup_service.sessions
    undo = Connection()
    await wsapi.ws_plan_optimize_undo.__wrapped__(hass, undo, {
        "id": 3, "type": "houseplan/plan/optimize_undo",
        "expected_config_rev": result.result["config_rev"],
        "expected_layout_rev": result.result["layout_rev"],
    })
    assert undo.error is None, undo.error
    assert (await rt.config_store.async_load())["config"]["spaces"] == before["spaces"]
    assert rt.zigbee_coordinator._saved == old_topics
    assert len(list((root / "houseplan/plans").glob("*.png"))) == 2  # Undo does not infer deletion.


async def test_archive_apply_rejects_foreign_user_and_changed_cache_without_writes(hass, tmp_path):
    _, rt, response, _, _, _ = await portable_preview(hass, tmp_path)
    before = await rt.config_store.async_load()
    refused = await apply(hass, response, admin=False)
    assert refused.error[0] == "unauthorized"
    async with rt.zigbee_coordinator._lock:
        await rt.zigbee_coordinator._save({})  # A real Update/OFF generation change.
    refused = await apply(hass, response)
    assert refused.error[0] == "conflict", refused.error
    assert await rt.config_store.async_load() == before
    assert not list(Path(hass.config.path("houseplan/plans")).iterdir())


async def http_user(hass, hass_client, *, admin=True):
    user = await hass.auth.async_create_user("Archive tester", group_ids=[GROUP_ID_ADMIN if admin else GROUP_ID_USER])
    token = await hass.auth.async_create_refresh_token(user, client_id="http://houseplan.test")
    client = await hass_client(hass.auth.async_create_access_token(token))
    return user, client


async def test_real_http_export_stream_is_authenticated_and_consumed(hass, hass_client):
    _, runtime = await setup(hass)
    user, client = await http_user(hass, hass_client)
    service = get_backup_service(hass, runtime)
    prepared = await service.export(user.id, "review", None)
    response = await client.post(f"/api/houseplan/backup/export/{prepared['token']}",
                                 json={"confirm_missing_content": False})
    assert response.status == 200, await response.text() if response.status != 200 else ""
    assert response.headers["Content-Type"] == "application/zip"
    raw = await response.read()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        assert json.loads(archive.read("manifest.json"))["format"] == "houseplan-full-backup"
    assert not service.sessions
    response = await client.post(f"/api/houseplan/backup/export/{prepared['token']}",
                                 json={"confirm_missing_content": False})
    assert response.status == 400


async def test_real_http_zip_preview_accepts_bytes_not_mime_and_refuses_ordinary_editor(hass, hass_client, tmp_path):
    entry, runtime = await setup(hass)
    hass.config_entries.async_update_entry(entry, options={"admin_only": False})
    document, _ = sample(tmp_path / "source")
    archive = tmp_path / "source.zip"
    build_archive(archive, document, tmp_path / "source", {})
    ordinary, denied_client = await http_user(hass, hass_client, admin=False)
    response = await denied_client.post("/api/houseplan/backup/import/preview", data=archive.read_bytes())
    assert response.status == 403
    assert not runtime.backup_service.sessions
    _, admin_client = await http_user(hass, hass_client)
    response = await admin_client.post("/api/houseplan/backup/import/preview", data=archive.read_bytes(),
                                       headers={"Content-Type": "application/json"})
    assert response.status == 200, await response.text()
    assert (await response.json())["preview"]["archive"]["complete"] is True


@pytest.mark.parametrize("failed_store", ["config", "layout", "cache", "files"])
async def test_apply_target_write_failure_rolls_back_all_four_surfaces(hass, tmp_path, monkeypatch, failed_store):
    _, runtime, response, _, _, old_topics = await portable_preview(hass, tmp_path)
    before_config = await runtime.config_store.async_load()
    before_layout = await runtime.store.async_load()
    import custom_components.houseplan.backup_files as file_api
    if failed_store == "files":
        original = file_api.os.link
        def fail_link(source, dest, **kwargs):
            if str(dest).endswith("-2.png"):
                raise OSError("disk failure")
            return original(source, dest, **kwargs)
        monkeypatch.setattr(file_api.os, "link", fail_link)
    else:
        store = {"config": runtime.config_store, "layout": runtime.store,
                 "cache": runtime.zigbee_coordinator._store}[failed_store]
        original = store.async_save
        async def fail_target(value):
            target = ((value.get("config", {}).get("spaces") or [{}])[0].get("title") == "Ground"
                      if failed_store == "config" else value.get("rev") == 2 and "optimize_pending" not in value
                      if failed_store == "layout" else "mesh" in value.get("topics", {}))
            if target:
                raise OSError("disk failure")
            await original(value)
        monkeypatch.setattr(store, "async_save", fail_target)
    result = await apply(hass, response)
    assert result.error[0] == "commit_failed", result.error
    assert await runtime.config_store.async_load() == before_config
    assert await runtime.store.async_load() == before_layout
    assert runtime.zigbee_coordinator._saved == old_topics
    assert not list(Path(hass.config.path("houseplan/plans")).iterdir())
    assert not list(Path(hass.config.path("houseplan/assets")).iterdir())


async def test_restart_finishes_interrupted_archive_before_other_writers(hass, tmp_path, monkeypatch):
    entry, runtime, response, _, _, _ = await portable_preview(hass, tmp_path)
    store = runtime.zigbee_coordinator._store
    original = store.async_save
    reached, waiting = asyncio.Event(), asyncio.Event()
    async def pause_after_write(value):
        await original(value)
        if "mesh" in value.get("topics", {}):
            reached.set()
            await waiting.wait()
    monkeypatch.setattr(store, "async_save", pause_after_write)
    task = asyncio.create_task(apply(hass, response))
    await reached.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert "optimize_pending" in await runtime.store.async_load()
    assert runtime.zigbee_coordinator._backup_pending is True
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    replacement = entry.runtime_data
    assert "optimize_pending" not in await replacement.store.async_load()
    assert (await replacement.config_store.async_load())["config"]["spaces"][0]["title"] == "Ground"
    assert replacement.zigbee_coordinator.snapshot("mesh")["provider"]["stale"] is True
    assert len(list(Path(hass.config.path("houseplan/plans")).glob("*.png"))) == 2


async def test_undo_cache_failure_preserves_the_complete_imported_state(hass, tmp_path, monkeypatch):
    _, runtime, response, _, _, _ = await portable_preview(hass, tmp_path)
    applied = await apply(hass, response)
    assert applied.error is None
    cd, ld = await runtime.config_store.async_load(), await runtime.store.async_load()
    current = runtime.zigbee_coordinator._saved
    store = runtime.zigbee_coordinator._store
    original = store.async_save
    async def fail_old(value):
        if "old-mesh" in value.get("topics", {}):
            raise OSError("disk failure")
        await original(value)
    monkeypatch.setattr(store, "async_save", fail_old)
    undo = Connection()
    await wsapi.ws_plan_optimize_undo.__wrapped__(hass, undo, {
        "id": 4, "type": "houseplan/plan/optimize_undo", "expected_config_rev": cd["rev"],
        "expected_layout_rev": ld["rev"],
    })
    assert undo.error[0] == "commit_failed"
    assert await runtime.config_store.async_load() == cd
    assert await runtime.store.async_load() == ld
    assert runtime.zigbee_coordinator._saved == current


@pytest.mark.parametrize("store_name", ["config", "layout", "cache"])
async def test_fail_after_durable_write_converges_without_false_failure(hass, tmp_path, monkeypatch, store_name):
    _, runtime, response, _, _, _ = await portable_preview(hass, tmp_path)
    store = {"config": runtime.config_store, "layout": runtime.store,
             "cache": runtime.zigbee_coordinator._store}[store_name]
    original = store.async_save
    async def fail_after(value):
        await original(value)
        raise OSError("acknowledgement lost after write")
    monkeypatch.setattr(store, "async_save", fail_after)
    result = await apply(hass, response)
    assert result.error is None, result.error
    assert (await runtime.config_store.async_load())["config"]["spaces"][0]["title"] == "Ground"
    assert "optimize_pending" not in await runtime.store.async_load()
    assert "mesh" in runtime.zigbee_coordinator._saved


async def test_incomplete_export_http_requires_exact_prepared_consent(hass, hass_client, tmp_path):
    _, runtime = await setup(hass)
    user, client = await http_user(hass, hass_client)
    document, _ = sample(Path(hass.config.path("")))
    Path(hass.config.path("houseplan/plans/a.copy.png")).unlink()
    async with runtime.write_lock:
        await async_save_config_state(runtime, document["payload"]["config"], 1)
    service = get_backup_service(hass, runtime)
    prepared = await service.export(user.id, "review", None)
    assert prepared["complete"] is False and "incomplete" in prepared["filename"]
    path = f"/api/houseplan/backup/export/{prepared['token']}"
    denied = await client.post(path, json={"confirm_missing_content": False})
    assert denied.status == 400 and (await denied.json())["error"] == "content_confirmation_required"
    assert prepared["token"] in service.sessions
    allowed = await client.post(path, json={"confirm_missing_content": True})
    assert allowed.status == 200
    with zipfile.ZipFile(io.BytesIO(await allowed.read())) as archive:
        assert json.loads(archive.read("manifest.json"))["complete"] is False
    assert not service.sessions


@pytest.mark.parametrize("mode", ["absent", "off", "incomplete"])
async def test_restore_snapshot_absent_off_and_missing_consent(hass, tmp_path, mode):
    _, runtime, response, _, _, _ = await portable_preview(hass, tmp_path)
    service = get_backup_service(hass, runtime)
    session = service.candidate_session(runtime.import_previews[response["token"]], "backup-owner")
    await service.release(session)
    document, _ = sample(tmp_path / "source")
    document["payload"]["config"]["settings"]["zigbee_topology"] = {"enabled": mode != "off"}
    topics = {} if mode == "absent" else {"mesh": {"obtained_at": 12345, "map": {"nodes": [], "links": []}}}
    if mode == "incomplete":
        (tmp_path / "source/houseplan/plans/a.copy.png").unlink()
    path = tmp_path / "variant.zip"
    build_archive(path, document, tmp_path / "source", topics)
    response = await service.upload("backup-owner", Content(path.read_bytes()), None)
    assert bool(response["preview"]["archive"]["snapshot_ignored_off"]) == (mode == "off")
    before = await runtime.config_store.async_load()
    refused = await apply(hass, response)
    if mode == "incomplete":
        assert refused.error[0] == "content_confirmation_required"
        assert await runtime.config_store.async_load() == before
        refused = await apply(hass, response, confirm=True)
    assert refused.error is None, refused.error
    assert bool(runtime.zigbee_coordinator._saved) == (mode == "incomplete")


async def test_token_expiry_owner_revalidation_and_cancel_leave_no_public_writes(hass, tmp_path):
    _, runtime, response, _, _, _ = await portable_preview(hass, tmp_path)
    service = get_backup_service(hass, runtime)
    candidate = runtime.import_previews[response["token"]]
    session = service.candidate_session(candidate, "backup-owner")
    with pytest.raises(ImportFailure, match="preview_owner_mismatch"):
        service.get(session.token, "another-admin")
    connection = Connection(admin=False)
    await wsapi.ws_import_revalidate.__wrapped__(hass, connection, {
        "id": 7, "token": response["token"], "duplicate_policy": "skip"})
    assert connection.error[0] == "unauthorized"
    connection = Connection()
    await wsapi.ws_import_revalidate.__wrapped__(hass, connection, {
        "id": 8, "token": response["token"], "duplicate_policy": "skip"})
    assert connection.error is None
    assert connection.result["preview"]["archive"]["images"] == 4
    session.expires = 0  # Expired input timestamp; implementation clock/TTL stay unchanged.
    with pytest.raises(ImportFailure, match="preview_expired"):
        service.get(session.token, "backup-owner")
    folder = stage_folder(service.root, session.session)
    await service.sweep()
    assert not folder.exists() and not service.sessions and not runtime.import_previews
    assert not list(Path(hass.config.path("houseplan/plans")).iterdir())


async def test_zip_undo_rechecks_admin_and_cache_generation(hass, tmp_path):
    entry, runtime, response, _, _, _ = await portable_preview(hass, tmp_path)
    hass.config_entries.async_update_entry(entry, options={"admin_only": False})
    applied = await apply(hass, response)
    assert applied.error is None
    message = {"id": 9, "expected_config_rev": applied.result["config_rev"],
               "expected_layout_rev": applied.result["layout_rev"]}
    denied = Connection(admin=False)
    await wsapi.ws_plan_optimize_undo.__wrapped__(hass, denied, message)
    assert denied.error[0] == "unauthorized"
    before = await runtime.config_store.async_load()
    async with runtime.zigbee_coordinator._lock:
        await runtime.zigbee_coordinator._save({})
    changed = Connection()
    await wsapi.ws_plan_optimize_undo.__wrapped__(hass, changed, message)
    assert changed.error[0] == "conflict", changed.error
    assert await runtime.config_store.async_load() == before


async def test_restore_fences_live_scan_and_late_callback_without_new_publish(hass, tmp_path, transport):
    _, runtime, response, _, _, _ = await portable_preview(hass, tmp_path)
    coordinator = runtime.zigbee_coordinator
    state = await coordinator.start("other-mesh")
    await zigbee_tests._until(lambda: bool(transport.published))
    callbacks = tuple(transport.callbacks["other-mesh/bridge/response/networkmap"])
    # Update cleared this topic before the preview existed, so revalidate once.
    fresh = Connection()
    await wsapi.ws_import_revalidate.__wrapped__(hass, fresh, {
        "id": 10, "token": response["token"], "duplicate_policy": "skip"})
    assert fresh.error is None
    applied = await apply(hass, response)
    assert applied.error is None, applied.error
    late = json.dumps({"transaction": state["provider"]["job_id"], "status": "ok",
                       "data": {"value": {"nodes": [], "links": []}}}).encode()
    for callback in callbacks:
        callback(SimpleNamespace(topic="other-mesh/bridge/response/networkmap", payload=late, retain=False))
    await hass.async_block_till_done()
    assert set(coordinator._saved) == {"mesh"}
    assert len(transport.published) == 1 and transport.listener_count == 0
    assert set((await coordinator._store.async_load())["topics"]) == {"mesh"}


async def test_export_is_read_only_and_help_does_not_gain_archive_or_mesh(hass, tmp_path):
    from custom_components.houseplan.support_package import build_support_package
    from tests_backend.test_support_package import _facts
    _, runtime, response, _, _, _ = await portable_preview(hass, tmp_path)
    service = get_backup_service(hass, runtime)
    await service.release(service.candidate_session(runtime.import_previews[response["token"]], "backup-owner"))
    document, _ = sample(Path(hass.config.path("")))
    config = document["payload"]["config"]
    config["settings"].update({"zigbee_topology": {"enabled": True}, "future_936": {"keep": [1, 2]}})
    async with runtime.write_lock:
        await async_save_config_state(runtime, config, 2)
    before = copy.deepcopy(await runtime.config_store.async_load())
    layout = copy.deepcopy(await runtime.store.async_load())
    root = Path(hass.config.path(""))
    files = {str(p): p.read_bytes() for p in (root / "houseplan").rglob("*")
             if p.is_file() and ".backup-staging" not in str(p)}
    prepared = await service.export("backup-owner", "review", None)
    session = service.get(prepared["token"], "backup-owner")
    with zipfile.ZipFile(stage_folder(root, session.session) / "backup.zip") as archive:
        saved = json.loads(archive.read("document.json"))
        assert saved["payload"]["config"]["settings"]["future_936"] == {"keep": [1, 2]}
        assert len(json.loads(archive.read("manifest.json"))["images"]) == 4
    assert await runtime.config_store.async_load() == before and await runtime.store.async_load() == layout
    assert {str(p): p.read_bytes() for p in (root / "houseplan").rglob("*")
            if p.is_file() and ".backup-staging" not in str(p)} == files
    raw, _ = build_support_package(before["config"], layout["layout"], config_rev=1,
        layout_rev=1, card_version="review", integration_version="review",
        home_assistant_version="2026.10.0", runtime=_facts())
    assert json.loads(raw)["format"] == "houseplan-support-package"
    for secret in (prepared["token"], "old-mesh", "backup.zip", "zigbee.json", "image/png"):
        assert secret.encode() not in raw


async def test_large_export_yields_ha_loop_and_stream_caps_precede_allocation(hass, tmp_path):
    import random
    _, runtime = await setup(hass)
    root = Path(hass.config.path(""))
    image = Image.frombytes("RGB", (1600, 900), random.Random(936).randbytes(1600 * 900 * 3))
    path = root / "houseplan/plans/large.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    config = {"spaces": [{"id": "large", "title": "Large", "view_box": [0, 0, 1, 1],
              "rooms": [], "plan_url": "/api/houseplan/content/plans/_/large.png"}], "markers": []}
    async with runtime.write_lock:
        await async_save_config_state(runtime, config, 1)
    service = get_backup_service(hass, runtime)
    task = asyncio.create_task(service.export("backup-owner", "review", None))
    ticks = 0
    while not task.done():
        ticks += 1
        await asyncio.sleep(0)
    result = await task
    assert ticks > 10 and result["images"] == 1
    with pytest.raises(ImportFailure, match="zip_limit"):
        await service.upload("oversized", Content(b"not-read"), 2 * 1024**3 + 1)
    with pytest.raises(ImportFailure, match="zip_busy"):
        await service.reserve("backup-owner", "import")
    other = await service.reserve("second-owner", "import")
    with pytest.raises(ImportFailure, match="zip_busy"):
        await service.reserve("third-owner", "import")
    with pytest.raises(ImportFailure, match="zip_limit"):
        await service.run(other, lambda: service.reserve_bytes(other, 4 * 1024**3 + 1))


@pytest.mark.parametrize("collision", ["different", "equal", "symlink"])
async def test_late_destination_collision_never_overwrites_or_deletes_foreign_file(hass, tmp_path, collision):
    _, runtime, response, png, _, old_topics = await portable_preview(hass, tmp_path)
    service = get_backup_service(hass, runtime)
    candidate = runtime.import_previews[response["token"]]
    session = service.candidate_session(candidate, "backup-owner")
    item = next(row for row in session.files if row["kind"] == "plan")
    destination = service.root / item["dest"]
    foreign = tmp_path / "foreign.png"
    content = png if collision == "equal" else b"owned by another operation"
    if collision == "symlink":
        foreign.write_bytes(content)
        destination.symlink_to(foreign)
    else:
        destination.write_bytes(content)
    original = destination.lstat()
    before = await runtime.config_store.async_load()
    result = await apply(hass, response)
    assert result.error[0] == "commit_failed", result.error
    assert destination.read_bytes() == content
    assert destination.lstat().st_ino == original.st_ino
    assert destination.is_symlink() == (collision == "symlink")
    assert await runtime.config_store.async_load() == before
    assert runtime.zigbee_coordinator._saved == old_topics
    assert list((service.root / "houseplan/plans").iterdir()) == [destination]


async def test_ordinary_writer_retains_full_json_but_direct_zip_export_is_admin_only(hass):
    entry, runtime = await setup(hass)
    hass.config_entries.async_update_entry(entry, options={"admin_only": False})
    # HA makes its first user the owner even with a household group payload.
    await hass.auth.async_create_user("Owner", group_ids=[GROUP_ID_ADMIN])
    writer = Connection(admin=False)
    writer.user = await hass.auth.async_create_user("Writer", group_ids=[GROUP_ID_USER])
    assert not writer.user.is_admin
    message = {"id": 1, "type": "houseplan/export/create", "kind": "full", "card_version": "review"}
    await wsapi.ws_export_create.__wrapped__(hass, writer, message)
    assert writer.error is None
    assert writer.result["filename"].endswith(".json")
    assert writer.result["document"]["kind"] == "full"
    before = await runtime.config_store.async_load()
    await wsapi.ws_export_create.__wrapped__(hass, writer, {**message, "archive": True})
    assert writer.error[0] == "unauthorized"
    assert not runtime.backup_service.sessions
    assert await runtime.config_store.async_load() == before


async def test_private_upload_refuses_a_symlink_without_touching_its_target(hass, tmp_path):
    _, runtime = await setup(hass)
    service = get_backup_service(hass, runtime)
    session = await service.reserve("backup-owner", "import")
    outside = tmp_path / "foreign.zip"
    outside.write_bytes(b"private foreign bytes")
    (stage_folder(service.root, session.session) / "backup.zip").symlink_to(outside)
    with pytest.raises(OSError):
        await service.run(session, lambda: service.append_upload(session, b"new upload"))
    assert outside.read_bytes() == b"private foreign bytes"
    await service.release(session)
    assert outside.exists() and not service.sessions


async def test_filesystem_fifos_are_rejected_without_waiting_for_a_peer(hass, tmp_path):
    from custom_components.houseplan.backup_archive import safe_read
    fifo = tmp_path / "pipe.png"
    os.mkfifo(fifo)
    with pytest.raises(ImportFailure):
        safe_read(tmp_path, fifo, 1024)
    _, runtime = await setup(hass)
    service = get_backup_service(hass, runtime)
    session = await service.reserve("backup-owner", "import")
    os.mkfifo(stage_folder(service.root, session.session) / "backup.zip")
    with pytest.raises(OSError):
        await service.run(session, lambda: service.append_upload(session, b"upload"))
    with pytest.raises(ImportFailure):
        await service.run(session, lambda: service.export_stream(session))
    await service.release(session)


@pytest.mark.parametrize("topics", [
    {"mesh/+": {"obtained_at": 12345, "map": {"nodes": [], "links": []}}},
    {"mesh": {"obtained_at": -1, "map": {"nodes": [], "links": []}}},
    {"mesh": {"obtained_at": 12345, "map": {"nodes": "wrong", "links": []}}},
    {"mesh": {"obtained_at": 12345, "map": {"nodes": [], "links": []}, "job": "not-portable"}},
])
def test_valid_zip_with_invalid_saved_snapshot_is_rejected(tmp_path, topics):
    document, _ = sample(tmp_path / "source")
    path = tmp_path / "good.zip"
    build_archive(path, document, tmp_path / "source", {})
    with zipfile.ZipFile(path) as source:
        entries = {info.filename: source.read(info) for info in source.infolist()}
    raw = json.dumps({"topics": topics}).encode()
    manifest = json.loads(entries["manifest.json"])
    manifest["snapshot"] = {"entry": "zigbee.json", "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    entries.update({"zigbee.json": raw, "manifest.json": json.dumps(manifest).encode()})
    hostile = tmp_path / "snapshot.zip"
    with zipfile.ZipFile(hostile, "w", compression=zipfile.ZIP_DEFLATED) as output:
        for name, value in entries.items():
            output.writestr(name, value)
    private = tmp_path / "private"
    private.mkdir()
    with pytest.raises(ImportFailure):
        read_archive(hostile, private)
    assert list(private.iterdir()) == []
