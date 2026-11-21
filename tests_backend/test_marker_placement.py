"""#1512: repair on the actual transactional command, not only the helper."""
import copy
import pytest
from custom_components.houseplan.core.marker_placement import repair_marker_spaces
from tests_backend.test_plan_commands import valid_service as service
from custom_components.houseplan.core.plan_graph_migration import migrate_graph_space


def test_room_proof_handles_hidden_removed_manual_and_ambiguity():
    cfg = {"spaces": [{"id": "current", "rooms": [{"id": "r", "area": "garage"}]}],
           "markers": [{"id": str(i), "space": "old", "area": "garage", **flags}
                       for i, flags in enumerate(({}, {"hidden": True}, {"removed": True}))]}
    cfg["markers"].append({"id": "manual", "space": "old", "area": None, "room_id": "r"})
    before = copy.deepcopy(cfg)
    assert repair_marker_spaces(cfg) == 4
    assert cfg == {**before, "markers": [{**m, "space": "current"} for m in before["markers"]]}
    assert repair_marker_spaces(cfg) == 0
    before["spaces"].append({"id": "other", "rooms": [{"id": "r", "area": "garage"}]})
    assert repair_marker_spaces(before) == 0


@pytest.mark.parametrize("change", [{"tap_action": "more-info"}, {"size": .9}, {"size": .8}])
async def test_config_set_repairs_legacy_space_and_preserves_exact_layout(change):
    commands = service()
    commands.storage.config_data["config"]["spaces"][0]["rooms"][0]["area"] = "garage"
    commands.storage.config_data["config"]["markers"] = [
        {"id": "sensor", "binding": "device:ble", "space": "gone", "area": "garage", "tap_action": "info", "size": 1}]
    commands.storage.layout_data["layout"]["sensor"] = {"s": "floor", "x": .2134, "y": .6735}
    before = commands.storage.snapshot()
    cfg = copy.deepcopy(before.config_data["config"])
    cfg["markers"][0].update(change)
    await commands.execute({"type": "houseplan/config/set", "config": cfg, "expected_rev": 4})
    after = commands.storage.snapshot()
    assert after.config_data["config"]["markers"][0]["space"] == "floor"
    assert all(after.config_data["config"]["markers"][0][k] == v for k, v in change.items())
    assert after.layout_data["layout"] == before.layout_data["layout"]
    assert after.layout_data["rev"] == before.layout_data["rev"]


async def test_room_transfer_repairs_still_existing_old_floor():
    commands = service()
    cfg = copy.deepcopy(commands.storage.snapshot().config_data["config"])
    cfg["spaces"].append(migrate_graph_space({"id": "other", "title": "Other", "view_box": [0, 0, 1, 1], "rooms": [{"id": "garage", "name": "Garage", "area": "garage", "x": .1, "y": .1, "w": .2, "h": .2}]}, {"source_model_version": 10})["space"])
    cfg["markers"] = [{"id": "sensor", "binding": "device:ble", "space": "floor", "area": "garage"}]
    await commands.execute({"type": "houseplan/config/set", "config": cfg, "expected_rev": 4})
    assert commands.storage.snapshot().config_data["config"]["markers"][0]["space"] == "other"

async def test_optimizer_repairs_stale_metadata_without_changing_the_submitted_positions():
    commands = service()
    commands.storage.config_data["config"]["spaces"][0]["rooms"][0]["area"] = "garage"
    commands.storage.config_data["config"]["markers"] = [
        {"id": "sensor", "binding": "device:ble", "space": "gone", "area": "garage"}]
    commands.storage.layout_data["layout"]["sensor"] = {"s": "floor", "x": .2134, "y": .6735}
    before = commands.storage.snapshot()
    reply = await commands.execute({"type": "houseplan/plan/optimize", "expected_config_rev": 4,
        "expected_layout_rev": 7, "opening_features_api": 1,
        "config": copy.deepcopy(before.config_data["config"]), "layout": copy.deepcopy(before.layout_data["layout"])})
    assert reply["ok"]
    after = commands.storage.snapshot()
    assert after.config_data["config"]["markers"][0]["space"] == "floor"
    assert after.layout_data["layout"] == before.layout_data["layout"]

async def test_invalid_hidden_description_is_rejected_without_partial_save():
    from custom_components.houseplan.core.command_ports import CommandError
    commands = service()
    before = commands.storage.snapshot()
    config = copy.deepcopy(before.config_data["config"])
    config["markers"] = [{"id": "sensor", "binding": "device:ble", "description": "x" * 4001,
                          "tap_action": "more-info"}]
    with pytest.raises(CommandError) as error:
        await commands.execute({"type": "houseplan/config/set", "config": config, "expected_rev": 4})
    assert error.value.code == "invalid_format"
    assert commands.storage.snapshot() == before

def test_repair_preserves_a_linked_strip_floor():
    cfg = {"spaces": [{"id": "current", "rooms": [{"id": "r", "area": "garage"}]},
                     {"id": "old", "rooms": [], "led_strips": [{"marker": "sensor"}]}],
           "markers": [{"id": "sensor", "space": "old", "area": "garage"}]}
    assert repair_marker_spaces(cfg) == 0
    assert cfg["markers"][0]["space"] == "old"
