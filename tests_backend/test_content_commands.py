"""Independent content/staging boundaries through the common service."""
import asyncio
import base64
import copy
import json
import threading
from dataclasses import replace

import pytest
from test_plan_commands import valid_service

from custom_components.houseplan.core import file_uploads
from custom_components.houseplan.core.command_ports import CommandError, CommandPolicy
from custom_components.houseplan.core.constants import ASSETS_DIR, PLANS_DIR
from custom_components.houseplan.core.reference_host import ReferencePlanHost
from custom_components.houseplan.core.structural_upload import UploadError

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


def host(tmp_path):
    return ReferencePlanHost(valid_service().storage.config_data["config"], None, "1.85.3-beta.1", tmp_path)


async def test_plan_delete_is_explicit_in_use_and_missing_files_do_not_publish(tmp_path):
    lab = host(tmp_path)
    upload = await lab.commands.upload_plan(PNG, "floor", "png")
    name = upload["url"].rsplit("/", 1)[-1]
    assert (tmp_path / PLANS_DIR / name).read_bytes() == PNG
    config = copy.deepcopy(lab.config)
    config["spaces"][0]["plan_url"] = upload["url"]
    await lab.request({"type": "houseplan/config/set", "expected_rev": 1, "config": config, "opening_features_api": 1})
    with pytest.raises(CommandError) as error:
        await lab.request({"type": "houseplan/plans/delete", "name": name})
    assert error.value.code == "in_use"
    config["spaces"][0]["plan_url"] = None
    await lab.request({"type": "houseplan/config/set", "expected_rev": 2, "config": config, "opening_features_api": 1})
    assert (tmp_path / PLANS_DIR / name).exists(), "detaching is not deletion authority"
    assert await lab.request({"type": "houseplan/plans/delete", "name": name}) == {"ok": True, "removed": True}


async def test_revoked_after_staging_does_not_publish_and_removes_private_temps(tmp_path, monkeypatch):
    lab = host(tmp_path)
    original = file_uploads.stage_asset

    def prepare(*args):
        result = original(*args)
        lab.authority.can_write = False
        return result

    monkeypatch.setattr(file_uploads, "stage_asset", prepare)
    with pytest.raises(CommandError) as error:
        await lab.commands.upload_asset(PNG, "pixel.png")
    assert error.value.code == "unauthorized"
    assert list((tmp_path / ASSETS_DIR).iterdir()) == []
    assert lab.effects.events == []


@pytest.mark.parametrize("phase", ["stage_plan", "publish"])
async def test_cancelled_worker_keeps_transaction_until_worker_settles(tmp_path, monkeypatch, phase):
    lab = host(tmp_path)
    lab.commands.environment = replace(lab.environment, policy=CommandPolicy.HA)
    entered, released = threading.Event(), threading.Event()
    original = getattr(file_uploads, phase)

    def pause(*args):
        result = original(*args)
        entered.set()
        assert released.wait(5)
        return result

    monkeypatch.setattr(file_uploads, phase, pause)
    task = asyncio.create_task(lab.commands.upload_plan(b"legacy opaque backdrop", "floor", "svg"))
    assert await asyncio.to_thread(entered.wait, 5)
    task.cancel()
    await asyncio.sleep(0)
    assert lab.content.lock.locked() and not task.done()
    released.set()
    with pytest.raises(asyncio.CancelledError):
        await task
    files = list((tmp_path / PLANS_DIR).iterdir())
    assert all(not item.name.startswith(".") for item in files)
    assert len(files) == (1 if phase == "publish" else 0)
    assert not lab.content.lock.locked()


async def test_structural_wrong_owner_replay_and_plan_only_purpose_are_side_effect_free(tmp_path):
    lab = host(tmp_path)
    message = {"type": "houseplan/layout/set", "layout": {}, "expected_rev": 1}
    staged = await lab.stage(json.dumps(message).encode())
    compact = {"type": message["type"], "upload_token": staged["token"], "upload_sha256": staged["sha256"], "expected_rev": 1}
    lab.authority.owner_id = lab.authority.current_owner = "another-owner"
    with pytest.raises(UploadError) as error:
        await lab.request(compact)
    assert error.value.code == "upload_owner_mismatch"
    lab.authority.owner_id = lab.authority.current_owner = "reference-owner"
    assert await lab.request(compact) == {"ok": True, "rev": 1}
    with pytest.raises(UploadError) as error:
        await lab.request(compact)
    assert error.value.code == "upload_expired"
    with pytest.raises(UploadError) as error:
        await lab.stage(json.dumps({"type": "houseplan/marker/history"}).encode())
    assert error.value.code == "upload_purpose"
    assert lab.uploads.uploads == {}
    assert lab.effects.events == []


async def test_cancelled_stream_and_serialized_lease_identity(tmp_path):
    lab = host(tmp_path)
    entered = asyncio.Event()

    async def blocks():
        yield b'{"type":'
        entered.set()
        await asyncio.Event().wait()

    task = asyncio.create_task(lab.commands.stage_structural(blocks()))
    await entered.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert lab.uploads.uploads == {}
    staged = await lab.stage(json.dumps({"type": "houseplan/layout/set", "layout": {}, "expected_rev": 1}).encode())
    lab.uploads.uploads = copy.deepcopy(lab.uploads.uploads)
    assert await lab.request({"type": "houseplan/layout/set", "expected_rev": 1,
        "upload_token": staged["token"], "upload_sha256": staged["sha256"]}) == {"ok": True, "rev": 1}
