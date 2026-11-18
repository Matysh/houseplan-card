"""Independent additive house outcomes through the shared public command port."""
import asyncio
import copy
import threading
from dataclasses import replace

import pytest
from test_house_archive import archive
from test_plan_commands import valid_service

from custom_components.houseplan.core import house_files
from custom_components.houseplan.core.command_ports import CommandError
from custom_components.houseplan.core.house_resources import FilesystemHouseResources
from custom_components.houseplan.core.reference_host import ReferencePlanHost


def host(root):
    root.mkdir(exist_ok=True)
    config = valid_service().storage.config_data["config"]
    result = ReferencePlanHost(config, None, "test", root)
    # Durable target data intentionally includes an unresolved binding, precision
    # and unrelated metadata that a normalizing one-space importer would change.
    result.config["markers"].append({"id": "orphan", "binding": "virtual", "room_id": "room", "space": "absent"})
    result.storage.layout_data.update(layout={"orphan": {"s": "absent", "x": .1234567891234, "y": .7}},
        optimize_backup={"kind": "optimize", "after_config_rev": 1, "after_layout_rev": 1},
        unknown_metadata={"keep": True})
    return result


async def preview(target, raw, operation="test-import"):
    async def blocks():
        for index in range(0, len(raw), 77):
            yield raw[index:index + 77]

    return await target.commands.house_preview(blocks(), len(raw), operation)


def apply_message(reply):
    return {"type": "houseplan/import/apply", "transfer_kind": "house", "token": reply["token"],
            "expected_config_rev": reply["config_rev"], "expected_layout_rev": reply["layout_rev"]}


async def test_shared_house_is_one_additive_commit_no_target_repair_and_repeat_independent(tmp_path):
    raw = archive(tmp_path)[0].read_bytes()
    target = host(tmp_path / "target")
    before = target.storage.snapshot()
    reply = await preview(target, raw)
    assert target.storage.snapshot() == before
    assert reply["kind"] == "house" and reply["counts"]["spaces"] == 3 and reply["counts"]["images"] == 1
    applied = await target.request(apply_message(reply))
    assert applied["ok"] and applied["can_undo"] is False
    assert (applied["config_rev"], applied["layout_rev"]) == (2, 2)
    pair = target.storage.snapshot()
    assert pair.config_data["config"]["spaces"][:1] == before.config_data["config"]["spaces"]
    assert pair.config_data["config"]["markers"] == before.config_data["config"]["markers"]
    assert pair.config_data["config"]["settings"] == before.config_data["config"]["settings"]
    assert pair.layout_data["layout"]["orphan"] == before.layout_data["layout"]["orphan"]
    assert pair.layout_data["unknown_metadata"] == {"keep": True}
    assert "optimize_backup" not in pair.layout_data
    added = target.config["spaces"][1:]
    for index, space in enumerate(added):
        assert space["stairs"][0]["target_space_id"] == added[(index + 1) % 3]["id"]
    assert len(list((target.root / "houseplan/plans").iterdir())) == 1
    assert len(list((target.root / "houseplan/assets").iterdir())) == 2
    assert not target.house.tokens and not target.house.active
    second = await preview(target, raw, "second")
    await target.request(apply_message(second))
    assert len({s["id"] for s in target.config["spaces"]}) == 7
    assert len(list((target.root / "houseplan/plans").iterdir())) == 1
    assert target.config["spaces"][:4] == pair.config_data["config"]["spaces"]


async def test_empty_install_import_has_no_fabricated_floor(tmp_path):
    raw = archive(tmp_path)[0].read_bytes()
    root = tmp_path / "target"
    root.mkdir()
    target = ReferencePlanHost({"spaces": [], "markers": [], "settings": {}}, None, "test", root)
    reply = await preview(target, raw)
    await target.request(apply_message(reply))
    assert len(target.config["spaces"]) == 3 and target.config["model_version"] == 11


async def test_revalidate_retains_ids_on_same_base_and_rebuilds_after_conflict(tmp_path):
    raw = archive(tmp_path)[0].read_bytes()
    target = host(tmp_path / "target")
    reply = await preview(target, raw)
    lease = target.house.tokens[reply["token"]]
    candidate = copy.deepcopy(lease["record"]["candidate"])
    request = {"type": "houseplan/import/revalidate", "transfer_kind": "house", "token": reply["token"]}
    checked = await target.request(request)
    assert checked["token"] == reply["token"] and lease["record"]["candidate"] == candidate
    target.config_rev += 1
    target.config["settings"]["moon"] = not target.config["settings"].get("moon", False)
    with pytest.raises(CommandError) as error:
        await target.request(apply_message(reply))
    assert error.value.code == "conflict"
    checked = await target.request(request)
    assert checked["config_rev"] == 2 and lease["record"]["candidate"]["settings"] == target.config["settings"]
    await target.request(apply_message(checked))


async def test_foreign_and_expired_lease_never_apply_and_cancel_is_immediate(tmp_path):
    raw = archive(tmp_path)[0].read_bytes()
    target = host(tmp_path / "target")
    reply = await preview(target, raw)
    before = target.storage.snapshot()
    target.authority.current_owner = target.authority.owner_id = "foreign"
    with pytest.raises(CommandError):
        await target.request(apply_message(reply))
    assert target.storage.snapshot() == before
    target.authority.current_owner = target.authority.owner_id = "reference-owner"
    await target.request({"type": "houseplan/backup/cancel", "transfer_kind": "house", "token": reply["token"]})
    assert not target.house.active
    retry = await preview(target, raw, "retry")
    target.house.clock = lambda: 10**12
    with pytest.raises(CommandError) as error:
        await target.request(apply_message(retry))
    assert error.value.code == "preview_expired" and not target.house.active
    assert target.storage.snapshot() == before


async def test_failed_file_publication_restores_pair_and_removes_only_its_files(tmp_path, monkeypatch):
    raw = archive(tmp_path)[0].read_bytes()
    target = host(tmp_path / "target")
    reply = await preview(target, raw)
    before = target.storage.snapshot()
    original = house_files.publish_file
    count = 0

    def fail_after_first(root, folder, item):
        nonlocal count
        count += 1
        if count == 2:
            raise OSError("publication failure")
        original(root, folder, item)

    monkeypatch.setattr(house_files, "publish_file", fail_after_first)
    with pytest.raises(CommandError) as error:
        await target.request(apply_message(reply))
    assert error.value.code == "commit_failed"
    assert target.storage.snapshot() == before
    assert not target.house.active
    assert not list((target.root / "houseplan/plans").glob("*.png"))
    assert not list((target.root / "houseplan/assets").glob("*.png"))


async def test_house_capability_is_optional_and_legacy_json_cancel_unchanged(tmp_path):
    target = host(tmp_path / "target")
    result = await target.request({"type": "houseplan/config/get"})
    assert result["house_transfer_api"] == 1
    target.commands.environment = replace(target.environment, house=None)
    result = await target.request({"type": "houseplan/config/get"})
    assert "house_transfer_api" not in result
    with pytest.raises(CommandError) as error:
        await target.request({"type": "houseplan/export/create", "kind": "house", "plan_only": True})
    assert error.value.code == "unsupported-transfer"
    with pytest.raises(CommandError) as error:
        await target.request({"type": "houseplan/backup/cancel", "token": "unknown"})
    assert error.value.code == "unauthorized"


async def test_cancel_interrupts_stalled_body_and_never_resurrects_early_operation(tmp_path):
    target = host(tmp_path / "target")
    entered = asyncio.Event()

    async def stalled():
        entered.set()
        await asyncio.Event().wait()
        yield b"not reached"

    upload = asyncio.create_task(target.commands.house_preview(stalled(), None, "slow-upload"))
    await asyncio.wait_for(entered.wait(), 5)
    await asyncio.wait_for(target.request({"type": "houseplan/backup/cancel", "transfer_kind": "house",
                                          "operation_id": "slow-upload"}), 5)
    with pytest.raises(CommandError):
        await upload
    assert not target.house.active
    await target.request({"type": "houseplan/backup/cancel", "transfer_kind": "house", "operation_id": "early"})
    with pytest.raises(CommandError):
        await target.house.begin("reference-plan", "reference-owner", "early", "import")
    assert not target.house.active


async def test_house_pool_does_not_occupy_full_backup_or_other_scope(tmp_path):
    root = tmp_path / "pool"
    root.mkdir()
    target = host(tmp_path / "target")
    pool = FilesystemHouseResources(root, target.cpu)
    first = await pool.begin("tenant-a", "owner-a", "one", "import")
    other = await pool.begin("tenant-b", "owner-b", "two", "export")
    with pytest.raises(CommandError) as error:
        await pool.begin("tenant-a", "foreign", "three", "import")
    assert error.value.code == "zip_busy"
    assert pool.active["tenant-a"] is first and pool.active["tenant-b"] is other
    await pool.complete(first)
    await pool.complete(other)


async def test_revoked_before_intent_releases_pin_and_does_not_leave_a_busy_slot(tmp_path, monkeypatch):
    raw = archive(tmp_path)[0].read_bytes()
    target = host(tmp_path / "target")
    reply = await preview(target, raw)
    before = target.storage.snapshot()
    original = target.house.pin

    async def revoke(lease):
        await original(lease)
        target.authority.can_write = False

    monkeypatch.setattr(target.house, "pin", revoke)
    with pytest.raises(CommandError) as error:
        await target.request(apply_message(reply))
    assert error.value.code == "unauthorized"
    assert target.storage.snapshot() == before and not target.house.active


async def test_boolean_revision_and_malformed_token_are_stable_atomic_refusals(tmp_path):
    raw = archive(tmp_path)[0].read_bytes()
    target = host(tmp_path / "target")
    reply = await preview(target, raw)
    before = target.storage.snapshot()
    with pytest.raises(CommandError) as error:
        await target.request({**apply_message(reply), "expected_config_rev": True})
    assert error.value.code == "conflict"
    with pytest.raises(CommandError) as error:
        await target.request({**apply_message(reply), "token": {"not": "a token"}})
    assert error.value.code == "preview_expired" and target.storage.snapshot() == before


async def test_house_keeps_one_strict_decode_budget_but_neither_network_wait_nor_durable_commit_inside_it(tmp_path, monkeypatch):
    from custom_components.houseplan.core import (
        house_archive,
        house_commands,
        input_policy,
    )
    from custom_components.houseplan.core.memory_host import MemoryPlanTransaction

    raw = archive(tmp_path)[0].read_bytes()
    target = host(tmp_path / "target")
    budgets = []
    reader, merger, commit = house_archive.read_archive, house_commands.build_merge, MemoryPlanTransaction.commit_pair

    def observed_reader(*args):
        assert input_policy.current_policy().strict
        budgets.append(input_policy._request.get())
        return reader(*args)

    def observed_merge(*args):
        assert input_policy.current_policy().strict
        budgets.append(input_policy._request.get())
        return merger(*args)

    async def observed_commit(self, *args, **kwargs):
        assert not input_policy.has_input_scope(), "a deadline after a durable commit must not report failure"
        return await commit(self, *args, **kwargs)

    monkeypatch.setattr(house_archive, "read_archive", observed_reader)
    monkeypatch.setattr(house_commands, "build_merge", observed_merge)
    monkeypatch.setattr(MemoryPlanTransaction, "commit_pair", observed_commit)

    async def blocks():
        assert not input_policy.has_input_scope(), "upload latency is not decoder CPU work"
        yield raw

    reply = await target.commands.house_preview(blocks(), len(raw), "one-budget")
    assert len(budgets) == 2 and budgets[0] is budgets[1]
    await target.request(apply_message(reply))
    assert not input_policy.has_input_scope()


async def test_house_streaming_cap_uses_explicit_host_policy_before_decode(tmp_path):
    from custom_components.houseplan.core.input_policy import STRICT_INPUT_POLICY

    target = host(tmp_path / "target")
    target.commands.environment = replace(target.environment, input_policy=replace(STRICT_INPUT_POLICY, archive_bytes=80))
    before = target.storage.snapshot()

    async def never_read():
        raise AssertionError("declared cap must precede reading the request")
        yield b""

    with pytest.raises(CommandError) as error:
        await target.commands.house_preview(never_read(), 81, "over-cap")
    assert error.value.code == "zip_limit"
    assert not target.house.active and target.storage.snapshot() == before


async def test_cancel_reaches_image_worker_and_state_locked_preparation_before_waiting_for_cleanup(tmp_path, monkeypatch):
    raw = archive(tmp_path)[0].read_bytes()
    target = host(tmp_path / "target")
    entered, resume = threading.Event(), threading.Event()
    original = house_files.prepare_files

    def blocked(*args, **kwargs):
        entered.set()
        assert resume.wait(5)
        return original(*args, **kwargs)

    monkeypatch.setattr(house_files, "prepare_files", blocked)
    upload = asyncio.create_task(preview(target, raw, "worker-cancel"))
    assert await asyncio.to_thread(entered.wait, 5)
    lease = next(iter(target.house.active.values()))
    cancel = asyncio.create_task(target.request({"type": "houseplan/backup/cancel", "transfer_kind": "house",
                                                 "operation_id": "worker-cancel"}))
    # The worker owns the state lock; cancellation must still reach it now.
    await asyncio.wait_for(lease["cancelled"].wait(), 1)
    assert not cancel.done()
    resume.set()
    with pytest.raises((CommandError, ValueError)) as error:
        await upload
    assert error.value.code in {"zip_cancelled", "preview_expired"}
    assert await asyncio.wait_for(cancel, 5) == {"ok": True}
    assert not target.house.active and len(target.config["spaces"]) == 1
