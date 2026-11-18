"""Reusable independent adapter contract, runnable without pytest or HA.

Factory contract: factory(work_root: Path) -> adapter. The adapter provides
reset(seed), request, preview, upload_plan, upload_asset, stage, snapshot and
controlled revoke_next_preparation/fail_next_pair hooks. These are local test
hooks, never public server endpoints. See ReferenceAdapter and the example.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import copy
import importlib
import inspect
import io
import json
import tempfile
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path

from .command_ports import PairCommitFailure
from .reference_host import ReferencePlanHost

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


def seed():
    return {"spaces": [{"id": "floor", "title": "Floor", "view_box": [0, 0, 1, 1],
        "rooms": [{"id": "room", "name": "Room", "poly": [[0, 0], [1, 0], [1, 1], [0, 1]]}]},
        {"id": "upper", "title": "Upper", "view_box": [0, 0, 1, 1], "rooms": []}], "markers": [], "settings": {}}


class _FaultCpu:
    def __init__(self, adapter, cpu):
        self.adapter, self.cpu = adapter, cpu

    async def run(self, function, *args):
        result = await self.cpu.run(function, *args)
        if self.adapter.revoke:
            self.adapter.revoke = False
            self.adapter.host.authority.can_write = False
        return result


class _FaultTransaction:
    def __init__(self, adapter, transaction):
        self.adapter, self.transaction = adapter, transaction

    def __getattr__(self, key):
        return getattr(self.transaction, key)

    async def commit_pair(self, *args, **kwargs):
        if self.adapter.fail_pair:
            self.adapter.fail_pair = False
            raise PairCommitFailure(recovery_pending=False)
        return await self.transaction.commit_pair(*args, **kwargs)


class _FaultStorage:
    def __init__(self, adapter, storage):
        self.adapter, self.storage = adapter, storage

    @asynccontextmanager
    async def transaction(self):
        async with self.storage.transaction() as transaction:
            yield _FaultTransaction(self.adapter, transaction)


class ReferenceAdapter:
    """Local ephemeral adapter; replace it for actual service/DB conformance."""

    def __init__(self, root):
        self.root, self.generation = root, 0
        self.host = None
        self.revoke = self.fail_pair = False

    async def reset(self, config):
        self.generation += 1
        self.revoke = self.fail_pair = False
        self.host = ReferencePlanHost(config, None, "1.85.3-beta.1", self.root / str(self.generation))
        self.host.commands.cpu = _FaultCpu(self, self.host.cpu)
        self.host.commands.storage = _FaultStorage(self, self.host.storage)

    async def request(self, message):
        return await self.host.request(message)

    async def preview(self, raw):
        return await self.host.preview(raw)

    async def house_preview(self, raw, operation):
        async def blocks():
            yield raw

        return await self.host.commands.house_preview(blocks(), len(raw), operation)

    async def download_house(self, token):
        from .house_commands import download

        async with download(self.host.commands, token, True) as (filename, blocks):
            raw = b"".join([block async for block in blocks])
        return {"filename": filename, "bytes": base64.b64encode(raw).decode()}

    async def upload_plan(self, raw, space, extension):
        return await self.host.commands.upload_plan(raw, space, extension)

    async def upload_asset(self, raw, filename):
        return await self.host.commands.upload_asset(raw, filename)

    async def stage(self, raw):
        return await self.host.stage(raw)

    async def snapshot(self):
        config, layout = self.host.pair()
        return {"config_data": config, "layout_data": layout,
                "events": copy.deepcopy(self.host.effects.events)}

    async def revoke_next_preparation(self):
        self.revoke = True

    async def fail_next_pair(self):
        self.fail_pair = True


async def _error(awaitable, code):
    try:
        await awaitable
    except Exception as error:
        assert getattr(error, "code", None) == code, (code, type(error).__name__, str(error))
    else:
        raise AssertionError("Expected refusal: " + code)


async def run_house(factory, work_root: Path):
    """Optional house API extension; does not enlarge the base host handshake."""
    adapter = factory(work_root)
    if inspect.isawaitable(adapter):
        adapter = await adapter
    source = seed()
    source["spaces"][0]["stairs"] = [{"id": "stair", "kind": "straight", "x": .5, "y": .5,
        "angle": 0, "direction": "forward", "target_space_id": "upper", "length": .3, "width": .2}]
    await adapter.reset(source)
    read = await adapter.request({"type": "houseplan/config/get"})
    assert read["house_transfer_api"] == 1
    plan = await adapter.upload_plan(PNG, "floor", "png")
    asset = await adapter.upload_asset(PNG, "sample.png")
    candidate = copy.deepcopy(read["config"])
    candidate["spaces"][0]["plan_url"] = plan["url"]
    candidate["spaces"][0].setdefault("decor", []).append({"id": "image", "kind": "image", "asset_id": asset["asset"]["asset_id"],
        "x": .2, "y": .2, "w": .1, "h": .1})
    await adapter.request({"type": "houseplan/config/set", "config": candidate,
        "expected_rev": read["rev"], "opening_features_api": 1})
    before = await adapter.snapshot()
    exported = await adapter.request({"type": "houseplan/export/create", "kind": "house", "plan_only": True})
    assert exported["complete"] and exported["images"] == 1
    file = await adapter.download_house(exported["token"])
    raw = base64.b64decode(file["bytes"])
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        assert archive.read("mimetype") == b"application/vnd.houseplan.plan+zip;version=1"
        manifest = json.loads(archive.read("manifest.json"))
        document = json.loads(archive.read("document.json"))
        assert document["kind"] == "house" and document["export_version"] == 4
        assert archive.read(next(iter(manifest["blobs"]))) == PNG
    reply = await adapter.house_preview(raw, "conformance-house")
    assert (await adapter.snapshot())["config_data"] == before["config_data"]
    result = await adapter.request({"type": "houseplan/import/apply", "transfer_kind": "house", "token": reply["token"],
        "expected_config_rev": reply["expected_config_rev"], "expected_layout_rev": reply["expected_layout_rev"]})
    after = await adapter.snapshot()
    assert result["ok"] and result["can_undo"] is False
    actual = after["config_data"]["config"]
    assert actual["spaces"][:2] == before["config_data"]["config"]["spaces"]
    added = actual["spaces"][2:]
    assert len(added) == 2 and added[0]["stairs"][0]["target_space_id"] == added[1]["id"]
    return ["house_transfer_images_stairs_append"]


async def run(factory, work_root: Path):
    """Return names of completed independent scenarios; assertion failure fails CI."""
    adapter = factory(work_root)
    if inspect.isawaitable(adapter):
        adapter = await adapter
    completed = []
    await adapter.reset(seed())
    before = await adapter.snapshot()
    current = await adapter.request({"type": "houseplan/config/get"})
    assert current["rev"] == 1 and current["can_write"] is True
    assert [space["id"] for space in current["config"]["spaces"]] == ["floor", "upper"]
    layout = await adapter.request({"type": "houseplan/layout/get"})
    assert layout["layout"] == {} and layout["rev"] == 1
    noop = {"type": "houseplan/config/set", "expected_rev": 1,
            "opening_features_api": 1, "config": current["config"]}
    assert await adapter.request(noop) == {"ok": True, "rev": 1}
    assert await adapter.snapshot() == before
    await _error(adapter.request({**noop, "expected_rev": 0}), "conflict")
    assert await adapter.snapshot() == before
    completed.append("no-op checks CAS without revisions/events")

    changed = copy.deepcopy(current["config"])
    changed["spaces"][0]["title"] = "Accepted"
    result = await adapter.request({**noop, "config": changed})
    assert result["rev"] == 2 and result["config"]["spaces"][0]["title"] == "Accepted"
    saved = await adapter.snapshot()
    assert saved["config_data"]["rev"] == 2 and saved["layout_data"]["rev"] == 1
    assert saved["events"] == [("houseplan_config_updated", {"rev": 2})]
    completed.append("config write changes one revision and event")

    await adapter.reset(seed())
    await adapter.request({"type": "houseplan/layout/set", "expected_rev": 1,
        "layout": {"rl_room": {"s": "floor", "x": .2, "y": .3}}})
    config = (await adapter.request({"type": "houseplan/config/get"}))["config"]
    result = await adapter.request({"type": "houseplan/config/set", "config": config, "expected_rev": 1,
        "expected_layout_rev": 2, "room_label_layout": {"rl_room": None}, "opening_features_api": 1})
    saved = await adapter.snapshot()
    assert result["rev"] == 1 and result["layout_rev"] == 3
    assert saved["layout_data"]["layout"] == {} and saved["config_data"]["rev"] == 1
    completed.append("explicit null label only changes layout")

    await adapter.reset(seed())
    await adapter.request({"type": "houseplan/layout/set", "expected_rev": 1,
        "layout": {"rl_room": {"s": "floor", "x": .2, "y": .3}}})
    before = await adapter.snapshot()
    dry = await adapter.request({"type": "houseplan/geometry/repair", "space_id": "floor", "aspect": 2, "dry_run": True})
    assert dry["moved"] == 1 and await adapter.snapshot() == before
    await adapter.request({"type": "houseplan/geometry/repair", "space_id": "floor", "aspect": 2, "expected_rev": 2})
    await adapter.request({"type": "houseplan/geometry/repair", "space_id": "floor", "aspect": 2, "undo": True, "expected_rev": 3})
    restored = await adapter.snapshot()
    assert restored["layout_data"]["layout"] == before["layout_data"]["layout"]
    assert restored["layout_data"]["rev"] == 4
    completed.append("repair dry/apply/undo preserves original coordinates")

    await adapter.reset(seed())
    before = await adapter.snapshot()
    await adapter.fail_next_pair()
    delete = {"type": "houseplan/space/delete", "space_id": "upper", "expected_config_rev": 1,
              "expected_layout_rev": 1, "opening_features_api": 1}
    await _error(adapter.request(delete), "commit_failed")
    assert await adapter.snapshot() == before
    result = await adapter.request(delete)
    assert (result["config_rev"], result["layout_rev"], result["can_undo"]) == (2, 2, True)
    assert [space["id"] for space in result["config"]["spaces"]] == ["floor"]
    await adapter.request({"type": "houseplan/plan/optimize_undo", "expected_config_rev": 2, "expected_layout_rev": 2})
    restored = await adapter.snapshot()
    assert restored["config_data"]["config"] == before["config_data"]["config"]
    assert restored["config_data"]["rev"] == restored["layout_data"]["rev"] == 3
    completed.append("pair failure changes nothing; delete and undo are atomic")

    await adapter.reset(seed())
    before = await adapter.snapshot()
    await adapter.revoke_next_preparation()
    current = before["config_data"]["config"]
    current["spaces"][0]["title"] = "Forbidden"
    await _error(adapter.request({**noop, "config": current}), "unauthorized")
    assert (await adapter.snapshot())["config_data"]["config"]["spaces"][0]["title"] == "Floor"
    assert (await adapter.snapshot())["events"] == []
    completed.append("permission lost during preparation prevents commit")

    await adapter.reset(seed())
    exported = await adapter.request({"type": "houseplan/export/create", "kind": "space", "space_id": "floor", "plan_only": True})
    preview = await adapter.preview(json.dumps(exported["document"]).encode())
    before = await adapter.snapshot()
    apply = {"type": "houseplan/import/apply", "token": preview["token"], "expected_config_rev": 1, "expected_layout_rev": 1}
    result = await adapter.request(apply)
    saved = await adapter.snapshot()
    assert (result["config_rev"], result["layout_rev"], result["can_undo"]) == (2, 2, False)
    spaces = saved["config_data"]["config"]["spaces"]
    assert spaces[:2] == before["config_data"]["config"]["spaces"]
    assert spaces[2]["id"] not in {"floor", "upper"} and spaces[2]["title"] == "Floor (2)"
    await _error(adapter.request({**apply, "expected_config_rev": 2, "expected_layout_rev": 2}), "preview_expired")
    await _error(adapter.request({"type": "houseplan/backup/cancel", "token": preview["token"]}), "unauthorized")
    await _error(adapter.request({"type": "houseplan/export/create", "kind": "full"}), "invalid_format")
    completed.append("space transfer is additive, one-shot and plan-only")

    await adapter.reset(seed())
    uploaded = await adapter.upload_plan(PNG, "floor", "png")
    name = uploaded["url"].rsplit("/", 1)[-1]
    listing = await adapter.request({"type": "houseplan/plans/list"})
    assert listing["total"] == 1 and listing["plans"][0]["name"] == name
    assert listing["plans"][0]["used_by"] == []
    assert await adapter.request({"type": "houseplan/plans/delete", "name": name}) == {"ok": True, "removed": True}
    assert (await adapter.request({"type": "houseplan/plans/list"}))["total"] == 0
    asset = await adapter.upload_asset(PNG, "pixel.png")
    duplicate = await adapter.upload_asset(PNG, "renamed.png")
    assert not asset["reused"] and duplicate["reused"]
    aid = asset["asset"]["asset_id"]
    resolved = await adapter.request({"type": "houseplan/assets/resolve", "asset_ids": [aid]})
    assert resolved["missing"] == [] and resolved["assets"][0]["name"] == "pixel.png"
    assert len((await adapter.request({"type": "houseplan/assets/list"}))["assets"]) == 1
    assert await adapter.request({"type": "houseplan/assets/delete", "asset_id": aid}) == {"ok": True, "removed": True}
    completed.append("plan/asset catalogs and exact explicit deletion")

    await adapter.reset(seed())
    message = {"type": "houseplan/layout/set", "layout": {}, "expected_rev": 1}
    staged = await adapter.stage(json.dumps(message).encode())
    compact = {"type": message["type"], "expected_rev": 1, "upload_token": staged["token"], "upload_sha256": staged["sha256"]}
    await _error(adapter.request({**compact, "expected_rev": 2}), "upload_control_mismatch")
    assert await adapter.request(compact) == {"ok": True, "rev": 1}
    await _error(adapter.request(compact), "upload_expired")
    assert (await adapter.snapshot())["events"] == []
    completed.append("staged request controls and one-shot consumption")
    return completed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--factory", default=__name__ + ":ReferenceAdapter")
    arguments = parser.parse_args()
    module, name = arguments.factory.rsplit(":", 1)
    factory = getattr(importlib.import_module(module), name)
    with tempfile.TemporaryDirectory(prefix="houseplan-conformance-") as directory:
        completed = asyncio.run(run(factory, Path(directory)))
    print(json.dumps({"passed": len(completed), "scenarios": completed}, indent=2))


if __name__ == "__main__":
    main()
