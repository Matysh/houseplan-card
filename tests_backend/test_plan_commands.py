"""Independent expected command results, not HA-vs-demo self-comparison."""
import copy

import pytest

from custom_components.houseplan.core.command_ports import (
    CommandEnvironment,
    CommandError,
    CommandPolicy,
    HostIdentity,
)
from custom_components.houseplan.core.memory_host import (
    MemoryAuthority,
    MemoryEffects,
    MemoryPlanStorage,
    ThreadCpuExecutor,
)
from custom_components.houseplan.core.plan_commands import PlanCommands
from custom_components.houseplan.core.room_appearance import normalize_room_appearance
from custom_components.houseplan.core.validation import CONFIG_SCHEMA
from custom_components.houseplan.core.wall_segment_model import (
    commit_wall_segment_model,
)


class NoFiles:
    async def existing_plans(self, names):
        return set()

    async def collect(self, previous, config, pinned):
        return None


class NoEntities:
    def readable_entity_ids(self, selected):
        return set()

    def radar_registry(self):
        return None

    async def configuration_extras(self, config, rev):
        return {}


def environment():
    return CommandEnvironment(NoFiles(), NoEntities(), CommandPolicy.PLAN_ONLY,
                              HostIdentity("reference-plan", "1.85.3-beta.1", "a" * 64))


def service():
    config = {"rev": 4, "config": {"spaces": [{"id": "floor", "rooms": [{"id": "room"}]}],
                                    "markers": []}}
    layout = {"rev": 7, "layout": {"rl_room": {"s": "floor", "x": .2, "y": .3}},
              "optimize_backup": {"kind": "optimize", "after_config_rev": 4, "after_layout_rev": 7},
              "unknown_metadata": {"keep": True}}
    storage, authority, effects = MemoryPlanStorage(config, layout), MemoryAuthority(), MemoryEffects()
    return PlanCommands(storage, ThreadCpuExecutor(), authority, effects, environment())


async def test_layout_noop_keeps_revision_events_and_undo_but_stale_noop_refused():
    commands = service()
    before = commands.storage.snapshot()
    message = {"type": "houseplan/layout/set", "layout": copy.deepcopy(before.layout_data["layout"]),
               "expected_rev": 7, "expected_config_rev": 4}
    assert await commands.execute(message) == {"ok": True, "rev": 7}
    assert commands.storage.snapshot() == before
    assert commands.effects.events == []
    with pytest.raises(CommandError, match="Layout changed elsewhere") as error:
        await commands.execute({**message, "expected_rev": 6})
    assert error.value.code == "conflict"
    assert commands.storage.snapshot() == before


async def test_layout_write_preserves_unknown_metadata_and_invalidates_undo():
    commands = service()
    changed = {"rl_room": {"s": "floor", "x": .4, "y": .6}}
    assert await commands.execute({"type": "houseplan/layout/set", "layout": changed,
                                   "expected_rev": 7}) == {"ok": True, "rev": 8}
    pair = commands.storage.snapshot()
    assert pair.layout_data == {"layout": changed, "rev": 8, "unknown_metadata": {"keep": True}}
    assert pair.config_data["rev"] == 4
    assert commands.effects.events == [("houseplan_layout_updated", {"rev": 8})]
    assert await commands.execute({"type": "houseplan/layout/get", "space_id": "other"}) == {
        "layout": {}, "rev": 8, "can_optimize_undo": False, "undo_kind": None}


async def test_layout_missing_revision_and_authority_loss_do_not_change_storage():
    commands = service()
    before = commands.storage.snapshot()
    message = {"type": "houseplan/layout/set", "layout": {}}
    with pytest.raises(CommandError) as error:
        await commands.execute(message)
    assert error.value.code == "conflict"
    assert commands.effects.missing_revisions == [("layout/set", 7)]
    commands.authority.current_scope = "different-plan"
    with pytest.raises(CommandError) as error:
        await commands.execute({**message, "expected_rev": 7})
    assert error.value.code == "unauthorized"
    assert commands.storage.snapshot() == before
    assert commands.effects.events == []


async def test_port_repeats_pair_cas_before_durable_commit():
    commands = service()
    async with commands.storage.transaction() as transaction:
        pair = await transaction.load()
        commands.storage.config_data["rev"] += 1
        with pytest.raises(CommandError) as error:
            await transaction.save_layout(pair.layout_data, {}, 8, authorize=commands.authority.ensure)
        assert error.value.code == "conflict"
    assert commands.storage.layout_data == pair.layout_data


def valid_service():
    commands = service()
    source, _ = commit_wall_segment_model({"spaces": [{"id": "floor", "title": "Floor",
        "view_box": [0, 0, 1, 1], "rooms": [{"id": "room", "name": "Room",
            "poly": [[0, 0], [1, 0], [1, 1], [0, 1]]}]}], "markers": [], "settings": {}})
    commands.storage.config_data["config"] = normalize_room_appearance(CONFIG_SCHEMA(source))
    return commands


async def test_config_noop_has_independent_unchanged_pair_and_no_events():
    commands = valid_service()
    before = commands.storage.snapshot()
    result = await commands.execute({"type": "houseplan/config/set", "expected_rev": 4,
                                     "opening_features_api": 1, "config": copy.deepcopy(before.config_data["config"])})
    assert result == {"ok": True, "rev": 4}
    assert commands.storage.snapshot() == before
    assert commands.effects.events == []


async def test_explicit_null_room_label_changes_only_layout_and_removes_position():
    commands = valid_service()
    before = commands.storage.snapshot()
    result = await commands.execute({"type": "houseplan/config/set", "expected_rev": 4,
        "expected_layout_rev": 7, "room_label_layout": {"rl_room": None}, "opening_features_api": 1,
        "config": copy.deepcopy(before.config_data["config"])})
    pair = commands.storage.snapshot()
    assert pair.config_data == before.config_data
    assert pair.layout_data == {"layout": {}, "rev": 8, "unknown_metadata": {"keep": True}}
    assert result["rev"] == 4 and result["layout_rev"] == 8
    assert result["layout_changes"] == {"rl_room": None}
    assert commands.effects.events[-1] == ("houseplan_layout_updated", {"rev": 8})


async def test_changed_config_does_not_forget_existing_label_or_raise_layout_revision():
    commands = valid_service()
    before = commands.storage.snapshot()
    changed = copy.deepcopy(before.config_data["config"])
    changed["spaces"][0]["title"] = "Renamed"
    result = await commands.execute({"type": "houseplan/config/set", "expected_rev": 4,
                                     "opening_features_api": 1, "config": changed})
    pair = commands.storage.snapshot()
    assert pair.config_data == {"config": changed, "rev": 5}
    assert pair.layout_data == {"layout": before.layout_data["layout"], "rev": 7,
                                "unknown_metadata": {"keep": True}}
    assert result["rev"] == 5
    assert [name for name, _data in commands.effects.events] == ["houseplan_config_updated"]
