"""Independent outcomes for shared portable commands, not transport self-comparison."""
import copy
import json
from dataclasses import replace

import pytest

from custom_components.houseplan.core.command_ports import CommandError, CommandPolicy
from custom_components.houseplan.core.import_export import ImportFailure
from custom_components.houseplan.core.memory_host import MemoryPlanTransaction
from test_plan_commands import valid_service


async def exported(commands):
    return await commands.execute({"type": "houseplan/export/create", "kind": "space", "space_id": "floor",
                                   "plan_only": True, "card_version": "1.85.3-beta.1"})


async def preview(commands):
    document = (await exported(commands))["document"]
    return await commands.import_preview(json.dumps(document).encode())


async def test_shared_space_transfer_is_additive_and_preserves_existing_floor():
    commands = valid_service()
    before = commands.storage.snapshot()
    result = await preview(commands)
    assert commands.storage.snapshot() == before
    assert result["preview"]["kind"] == "space" and result["preview"]["plan_only"] is True
    assert (result["expected_config_rev"], result["expected_layout_rev"]) == (4, 7)
    applied = await commands.execute({"type": "houseplan/import/apply", "token": result["token"],
        "expected_config_rev": 4, "expected_layout_rev": 7})
    pair = commands.storage.snapshot()
    assert (applied["config_rev"], applied["layout_rev"], applied["can_undo"]) == (5, 8, False)
    assert pair.config_data["config"]["spaces"][0] == before.config_data["config"]["spaces"][0]
    incoming = pair.config_data["config"]["spaces"][1]
    assert incoming["id"] != "floor" and incoming["title"] == "Floor (2)"
    assert incoming["rooms"][0]["id"] != "room"
    assert incoming["rooms"][0]["poly"] == before.config_data["config"]["spaces"][0]["rooms"][0]["poly"]
    assert pair.layout_data["layout"]["rl_room"] == before.layout_data["layout"]["rl_room"]
    assert pair.layout_data["layout"]["rl_" + incoming["rooms"][0]["id"]] == {"s": incoming["id"], "x": .2, "y": .3}
    assert result["token"] not in commands.environment.leases.runtime.import_previews


async def test_revalidate_retains_prepared_ids_and_token():
    commands = valid_service()
    reply = await preview(commands)
    target = copy.deepcopy(commands.environment.leases.runtime.import_previews[reply["token"]]["target_config"])
    response = await commands.execute({"type": "houseplan/import/revalidate", "token": reply["token"], "duplicate_policy": "skip"})
    assert response["token"] == reply["token"]
    assert commands.environment.leases.runtime.import_previews[reply["token"]]["target_config"] == target
    assert (response["expected_config_rev"], response["expected_layout_rev"]) == (4, 7)


async def test_plan_only_refuses_full_before_allocating_a_lease():
    commands = valid_service()
    commands.environment = replace(commands.environment, policy=CommandPolicy.HA)
    document = (await commands.execute({"type": "houseplan/export/create", "kind": "full"}))["document"]
    commands.environment = replace(commands.environment, policy=CommandPolicy.PLAN_ONLY)
    before = commands.storage.snapshot()
    with pytest.raises(ImportFailure) as error:
        await commands.import_preview(json.dumps(document).encode())
    assert error.value.code == "invalid_format"
    assert commands.environment.leases.runtime.import_previews == {}
    assert commands.storage.snapshot() == before
    with pytest.raises(ImportFailure):
        await commands.execute({"type": "houseplan/export/create", "kind": "space", "space_id": "floor"})


async def test_legacy_cancel_has_writer_refusal_and_admin_noop():
    commands = valid_service()
    reply = await preview(commands)
    message = {"type": "houseplan/backup/cancel", "token": reply["token"]}
    with pytest.raises(CommandError) as error:
        await commands.execute(message)
    assert error.value.code == "unauthorized"
    commands.authority.archive_admin = True
    assert await commands.execute(message) == {"ok": True}
    assert reply["token"] in commands.environment.leases.runtime.import_previews


async def test_post_commit_eviction_and_cleanup_error_are_still_success(monkeypatch):
    commands = valid_service()
    reply = await preview(commands)
    original = MemoryPlanTransaction.commit_pair

    async def committed_then_evicted(self, *args, **kwargs):
        await original(self, *args, **kwargs)
        commands.environment.leases.runtime.import_previews.clear()

    async def unavailable(*args):
        raise OSError("private storage fixture")

    monkeypatch.setattr(MemoryPlanTransaction, "commit_pair", committed_then_evicted)
    monkeypatch.setattr(commands.environment.leases, "consume", unavailable)
    applied = await commands.execute({"type": "houseplan/import/apply", "token": reply["token"],
                                      "expected_config_rev": 4, "expected_layout_rev": 7})
    assert applied["ok"] and applied["config_rev"] == 5
    assert len(commands.storage.config_data["config"]["spaces"]) == 2


async def test_stale_apply_and_other_owner_do_not_change_pair():
    commands = valid_service()
    reply = await preview(commands)
    before = commands.storage.snapshot()
    message = {"type": "houseplan/import/apply", "token": reply["token"], "expected_config_rev": 3, "expected_layout_rev": 7}
    with pytest.raises(ImportFailure) as error:
        await commands.execute(message)
    assert error.value.code == "conflict"
    commands.authority.owner_id = commands.authority.current_owner = "other-owner"
    with pytest.raises(ImportFailure) as error:
        await commands.execute({**message, "expected_config_rev": 4})
    assert error.value.code == "preview_owner_mismatch"
    assert commands.storage.snapshot() == before
    assert reply["token"] in commands.environment.leases.runtime.import_previews
