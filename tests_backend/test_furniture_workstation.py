"""#1451 persisted workstation links, portable versions and old-client barriers."""
import copy
import hashlib
import json
import zipfile
from types import SimpleNamespace

import pytest
import voluptuous as vol

from custom_components.houseplan.core import house_archive, house_document
from custom_components.houseplan.core.furniture_workstation import (
    WorkstationWriterRequired,
    guard_workstation_write,
    repair_workstations,
    standalone_workstation,
)
from custom_components.houseplan.core.import_export import (
    ImportFailure,
    build_space_merge,
    create_export,
    create_migration_source_export,
    parse_document,
    prepare_preview,
)
from custom_components.houseplan.core.space_copy import space_copy_candidate
from custom_components.houseplan.core.validation import CONFIG_SCHEMA

IDENTITY = SimpleNamespace(instance_id="workstation-test", integration_version="test")


def pair():
    return [{"id": "desk", "kind": "furniture", "symbol": "desk", "x": .2, "y": .2,
             "w": .3, "h": .2, "angle": 37, "workstation": "mounted", "workstation_tower_id": "tower"},
            {"id": "tower", "kind": "furniture", "symbol": "computer", "x": .6, "y": .7,
             "w": .025, "h": .06, "angle": 23, "flip_h": True, "workstation": "tower"}]


def source():
    return {"spaces": [{"id": "floor", "title": "Floor", "view_box": [0, 0, 1, 1],
                        "rooms": [], "wall_segments": [], "decor": pair()}], "markers": [], "settings": {}}


def exported(tmp_path, *, kind="space", plan_only=True):
    return create_export(IDENTITY, {"config": source(), "rev": 4}, {"layout": {}, "rev": 7},
                         kind=kind, space_id="floor" if kind == "space" else None,
                         plan_only=plan_only, card_version="test", config_root=tmp_path)[0]


def house_exported():
    return house_document.export_document(IDENTITY, {"config": source()}, {"layout": {}}, "test")[0]


def test_old_plans_are_unchanged_and_optional_relationship_validates():
    config = source()
    before = copy.deepcopy(config)
    checked = CONFIG_SCHEMA(config)
    assert checked["spaces"][0]["decor"] == before["spaces"][0]["decor"]
    assert config == before
    for item in config["spaces"][0]["decor"]:
        item.pop("workstation", None)
        item.pop("workstation_tower_id", None)
    assert CONFIG_SCHEMA(config)["spaces"][0]["decor"] == config["spaces"][0]["decor"]


@pytest.mark.parametrize("damage", [
    lambda rows: rows[0].update(workstation=True),
    lambda rows: rows[0].update(symbol="dining_table"),
    lambda rows: rows[0].update(workstation_tower_id=""),
    lambda rows: rows[0].update(workstation_tower_id="not-on-this-floor"),
    lambda rows: rows[1].pop("workstation"),
    lambda rows: rows[1].update(symbol="sofa"),
    lambda rows: rows[1].update(workstation_tower_id="desk"),
    lambda rows: rows.append({**rows[0], "id": "second-desk"}),
    lambda rows: rows.pop(0),
])
def test_new_invalid_or_cross_floor_links_are_refused_without_mutating_input(damage):
    config = source()
    damage(config["spaces"][0]["decor"])
    before = copy.deepcopy(config)
    with pytest.raises(vol.Invalid):
        CONFIG_SCHEMA(config)
    assert config == before


@pytest.mark.parametrize("writer", [None, True, "1", 0, 2])
def test_old_writer_can_change_style_and_coordinates_but_not_relationship(writer):
    config = source()
    changed = copy.deepcopy(config)
    changed["spaces"][0]["decor"][0].update(x=.5, color="#123456")
    guard_workstation_write(changed, config, writer)
    for transform in [
        lambda rows: rows[0].pop("workstation"),
        lambda rows: rows[0].update(workstation_tower_id="other"),
        lambda rows: rows[0].update(symbol="sofa"),
        lambda rows: rows.pop(1),
    ]:
        candidate = copy.deepcopy(config)
        transform(candidate["spaces"][0]["decor"])
        with pytest.raises(WorkstationWriterRequired):
            guard_workstation_write(candidate, config, writer)
        guard_workstation_write(candidate, config, 1)


@pytest.mark.parametrize("kind,plan_only", [("full", False), ("space", False), ("space", True)])
def test_json_v4_keeps_links_and_old_version_selection_stays_when_feature_absent(tmp_path, kind, plan_only):
    document = exported(tmp_path, kind=kind, plan_only=plan_only)
    assert document["export_version"] == 4
    read = parse_document(json.dumps(document).encode())
    assert read["payload"]["config"]["spaces"][0]["decor"] == pair()
    too_old = copy.deepcopy(document)
    too_old["export_version"] = 3
    with pytest.raises(ImportFailure) as error:
        parse_document(json.dumps(too_old).encode())
    assert error.value.code == "unsupported_export_version"
    without = source()
    without["spaces"][0]["decor"] = []
    old, _ = create_export(IDENTITY, {"config": without}, {"layout": {}}, kind=kind,
                          space_id="floor" if kind == "space" else None,
                          plan_only=plan_only, card_version="test", config_root=tmp_path)
    assert old["export_version"] == 2


def test_migration_source_uses_v4_for_links_without_rewriting_the_raw_pair(tmp_path):
    snapshot = {"version": 1, "config_data": {"rev": 4, "config": source()},
                "layout_data": {"rev": 7, "layout": {}}}
    before = copy.deepcopy(snapshot)
    document, _ = create_migration_source_export(IDENTITY, snapshot, card_version="test", config_root=tmp_path)
    assert document["export_version"] == 4
    assert document["model_version"] == 0
    assert document["payload"] == {"config": before["config_data"]["config"], "layout": {}}
    assert snapshot == before
    for item in snapshot["config_data"]["config"]["spaces"][0]["decor"]:
        item.pop("workstation", None)
        item.pop("workstation_tower_id", None)
    before = copy.deepcopy(snapshot)
    old, _ = create_migration_source_export(IDENTITY, snapshot, card_version="test", config_root=tmp_path)
    assert old["export_version"] == 1
    assert old["payload"] == {"config": before["config_data"]["config"], "layout": {}}
    assert snapshot == before


def test_all_copy_and_remap_routes_keep_their_own_pair_without_source_aliases(tmp_path):
    document = exported(tmp_path)
    before = copy.deepcopy(document)
    target = {"spaces": [], "markers": [], "settings": {}}
    merged, _, _ = build_space_merge(document, target, {}, "skip", same_source=False)
    desk, tower = merged["spaces"][0]["decor"]
    assert desk["workstation_tower_id"] == tower["id"] != "tower"
    assert document == before
    canonical = copy.deepcopy(document["payload"]["config"])
    canonical["model_version"] = document["model_version"]
    result = space_copy_candidate(canonical, "floor", "Copy", "abc", furniture=True)
    copied_desk, copied_tower = result["spaces"][1]["decor"]
    assert copied_desk["workstation_tower_id"] == copied_tower["id"] != "tower"
    assert result["spaces"][0] == canonical["spaces"][0]
    house = house_exported()
    second = copy.deepcopy(house["payload"]["config"]["spaces"][0])
    second["id"] = "other-floor"
    house["payload"]["config"]["spaces"].append(second)
    house = house_document.parse_document(json.dumps(house).encode())
    merged, _, _ = house_document.build_merge(house, target, {})
    owned = []
    for space in merged["spaces"]:
        desk, tower = space["decor"]
        assert desk["workstation_tower_id"] == tower["id"]
        owned.append(tower["id"])
    assert len(set(owned)) == 2, "same old IDs on different floors use scoped maps"


def test_invalid_optional_json_links_are_repaired_and_file_report_cannot_be_forged(tmp_path):
    document = exported(tmp_path)
    document["payload"]["config"]["spaces"][0]["decor"][0]["workstation_tower_id"] = "missing"
    document["transfer"]["workstation_repairs"] = {"detached": 999, "examples": ["forged"]}
    read = parse_document(json.dumps(document).encode())
    report = read["transfer"]["workstation_repairs"]
    assert report["detached"] == 2 and len(report["examples"]) == 2
    assert not any("workstation" in item for item in read["payload"]["config"]["spaces"][0]["decor"])
    actual = read["payload"]["config"]["spaces"][0]["decor"][1]
    expected = standalone_workstation(pair()[1])
    expected.update(x=pytest.approx(expected["x"], abs=1e-9), y=pytest.approx(expected["y"], abs=1e-9))
    assert actual == expected
    preview, _ = prepare_preview(IDENTITY, json.dumps(document).encode(), owner_id="writer", duplicate_policy="skip",
                                 current_config_data={"rev": 0, "config": {"spaces": [], "markers": []}},
                                 current_layout_data={"rev": 0, "layout": {}}, config_root=tmp_path)
    assert preview["preview"]["workstation_repairs"]["detached"] == 2
    assert "workstations_detached" in preview["preview"]["warnings"]
    # Reparse after archive handling: only explicit trusted report survives.
    reread = parse_document(json.dumps(read).encode(), workstation_repairs=report)
    assert reread["transfer"]["workstation_repairs"] == report


def test_house_required_api_is_optional_without_feature_and_future_versions_refuse_safely():
    document = house_exported()
    assert document["required_api"] == {"house_transfer_api": 1, "furniture_workstation_api": 1}
    for key, value in [("furniture_workstation_api", 2), ("future_api", 1)]:
        future = copy.deepcopy(document)
        future["required_api"][key] = value
        with pytest.raises(ImportFailure) as error:
            house_document.parse_document(json.dumps(future).encode())
        assert error.value.code == "unsupported-transfer"
    malformed = copy.deepcopy(document)
    malformed["required_api"]["furniture_workstation_api"] = True
    with pytest.raises(ImportFailure) as error:
        house_document.parse_document(json.dumps(malformed).encode())
    assert error.value.code == "invalid_format"
    with pytest.raises(ImportFailure):
        parse_document(json.dumps(document).encode())


def test_house_optional_link_repair_precedes_privacy_but_never_removes_private_fields():
    document = house_exported()
    document["payload"]["config"]["spaces"][0]["decor"][0]["workstation_tower_id"] = "missing"
    report = {}
    read = house_document.parse_document(json.dumps(document).encode(), workstation_repairs=report)
    assert report["detached"] == 2
    assert not any("workstation" in item for item in read["payload"]["config"]["spaces"][0]["decor"])
    document["payload"]["config"]["spaces"][0]["decor"][0]["entity"] = "sensor.private"
    with pytest.raises(ImportFailure):
        house_document.parse_document(json.dumps(document).encode())


def test_house_archive_reports_computed_repairs_outside_closed_wire_metadata(tmp_path):
    path = tmp_path / "house.zip"
    house_archive.build_archive(path, house_exported(), lambda _: pytest.fail("no images"))
    changed = tmp_path / "damaged-link.zip"
    with zipfile.ZipFile(path) as archive:
        entries = {entry.filename: (entry, archive.read(entry.filename)) for entry in archive.infolist()}
    document = json.loads(entries["document.json"][1])
    document["payload"]["config"]["spaces"][0]["decor"][0]["workstation_tower_id"] = "missing"
    raw = json.dumps(document, separators=(",", ":")).encode()
    manifest = json.loads(entries["manifest.json"][1])
    manifest["document"].update(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    with zipfile.ZipFile(changed, "w") as archive:
        for name, (entry, data) in entries.items():
            if name == "document.json":
                data = raw
            elif name == "manifest.json":
                data = json.dumps(manifest, separators=(",", ":")).encode()
            archive.writestr(entry, data)
    payload = house_archive.read_archive(changed)
    assert payload.workstation_repairs["detached"] == 2
    assert payload.document["transfer"] == {"plan_only": True}, "report is not accepted from the document"


def test_repair_duplicate_claims_does_not_guess_an_owner_or_cross_spaces():
    config = source()
    config["spaces"][0]["decor"].append({**pair()[0], "id": "second-desk"})
    config["spaces"].append({"id": "elsewhere", "decor": [{**pair()[0], "id": "third-desk"}]})
    report = repair_workstations(config)
    assert report["detached"] == 4
    assert all("workstation" not in item for space in config["spaces"] for item in space["decor"])


@pytest.mark.parametrize("operation", ["config/set", "plan/optimize", "space/delete"])
async def test_common_writers_reject_old_client_before_storage_and_advertise_optional_api(operation):
    from test_plan_commands import valid_service

    from custom_components.houseplan.core.command_ports import CommandError

    commands = valid_service()
    config = commands.storage.config_data["config"]
    config["spaces"][0]["decor"] = pair()
    response = await commands.execute({"type": "houseplan/config/get"})
    assert response["furniture_workstation_api"] == 1
    before = commands.storage.snapshot()
    candidate = copy.deepcopy(before.config_data["config"])
    for item in candidate["spaces"][0]["decor"]:
        item.pop("workstation", None)
        item.pop("workstation_tower_id", None)
    message = {"type": "houseplan/" + operation, "config": candidate, "expected_rev": before.config_data["rev"],
               "expected_config_rev": before.config_data["rev"], "expected_layout_rev": before.layout_data["rev"], "layout": before.layout_data["layout"],
               "space_id": "floor", "opening_features_api": 1}
    if operation == "config/set":
        message.pop("expected_layout_rev")
    with pytest.raises(CommandError) as error:
        await commands.execute(message)
    assert error.value.code == "furniture_workstation_client_outdated"
    assert commands.storage.snapshot() == before
    assert commands.effects.events == []


async def test_capability_never_grants_write_permission_and_new_writer_commits_whole_pair():
    from test_plan_commands import valid_service

    from custom_components.houseplan.core.command_ports import CommandError

    commands = valid_service()
    before = commands.storage.snapshot()
    candidate = copy.deepcopy(before.config_data["config"])
    candidate["spaces"][0]["decor"] = pair()
    message = {"type": "houseplan/config/set", "config": candidate, "expected_rev": 4,
               "opening_features_api": 1, "furniture_workstation_api": 1}
    commands.authority.can_write = False
    with pytest.raises(CommandError) as error:
        await commands.execute(message)
    assert error.value.code == "unauthorized"
    assert commands.storage.snapshot() == before
    commands.authority.can_write = True
    assert (await commands.execute(message))["rev"] == 5
    assert commands.storage.config_data["config"]["spaces"][0]["decor"] == pair()
