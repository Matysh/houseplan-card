"""#1015 canonical boundary on real HA Stores and ordinary I/O failures."""
import json
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace

import pytest

from custom_components.houseplan.config_migrations import (
    CONFIG_MIGRATION_BACKUP,
    CONFIG_MIGRATION_PASSPORT,
)
from custom_components.houseplan.store import (
    HouseplanStore,
    async_resolve_pending_pair,
    create_data,
)


@pytest.fixture(autouse=True)
def _allow_integration(enable_custom_integrations):
    yield


def source():
    return {"config": {"spaces": [{"id": "s", "title": "Floor", "aspect": 2, "rooms": []}],
                       "markers": [{"id": "lamp", "binding": "virtual", "display": "ripple"}],
                       "settings": {"future": [1, 2], "weather_entity": "weather.home"}}, "rev": 3,
            "future_wrapper": {"keep": True}}


async def seed(hass, runtime=None):
    runtime = runtime or create_data(hass)
    await runtime.config_store.async_save(source())
    await runtime.store.async_save({"layout": {"lamp": {"s": "s", "x": 0.1, "y": 0.2}},
                                    "rev": 7, "future_metadata": {"keep": True}})
    return runtime


async def test_canonical_pair_persists_once_and_retains_original_snapshot(hass):
    runtime = await seed(hass)
    before_config = deepcopy(await runtime.config_store.async_load())
    before_layout = deepcopy(await runtime.store.async_load())
    async with runtime.write_lock:
        first = await async_resolve_pending_pair(runtime)
        second = await async_resolve_pending_pair(runtime)
    assert first.config_data == second.config_data and first.layout_data == second.layout_data
    assert first.config_data["rev"] == 4 and first.layout_data["rev"] == 8
    assert first.config_data["future_wrapper"] == {"keep": True}
    assert first.layout_data["future_metadata"] == {"keep": True}
    assert first.config_data["config"]["markers"][0]["display"] == "icon_ripple"
    assert first.layout_data["layout"]["lamp"]["y"] == 0.35
    backup = first.layout_data[CONFIG_MIGRATION_BACKUP]
    assert backup["config_data"] == before_config and backup["layout_data"] == before_layout
    assert first.layout_data[CONFIG_MIGRATION_PASSPORT]["version"] == 1
    assert "optimize_pending" not in first.layout_data


@pytest.mark.parametrize("half", ["intent", "config", "layout"])
async def test_failed_half_keeps_recoverable_original_and_next_load_finishes(hass, monkeypatch, half):
    runtime = await seed(hass)
    before = deepcopy(await runtime.config_store.async_load())
    real_save = HouseplanStore.async_save
    failed = False

    async def disk_failure(store, data):
        nonlocal failed
        match = ((half == "intent" and store.key == "houseplan.layout" and "optimize_pending" in data)
                 or (half == "config" and store.key == "houseplan.config")
                 or (half == "layout" and store.key == "houseplan.layout" and "optimize_pending" not in data))
        if match and not failed:
            failed = True
            raise OSError("ordinary disk failure")
        await real_save(store, data)

    monkeypatch.setattr(HouseplanStore, "async_save", disk_failure)
    async with runtime.write_lock:
        with pytest.raises(OSError):
            await async_resolve_pending_pair(runtime)
    if half != "layout":
        assert await runtime.config_store.async_load() == before
    if half != "intent":
        pending = (await runtime.store.async_load())["optimize_pending"]
        assert pending["final_metadata"][CONFIG_MIGRATION_BACKUP]["config_data"] == before
    async with runtime.write_lock:
        recovered = await async_resolve_pending_pair(runtime)
    assert recovered.config_data["rev"] == 4 and recovered.layout_data["rev"] == 8
    assert "optimize_pending" not in recovered.layout_data
    async with runtime.write_lock:
        again = await async_resolve_pending_pair(runtime)
    assert again.config_data == recovered.config_data and again.layout_data == recovered.layout_data


async def test_unknown_passport_keeps_durable_pair_unchanged(hass):
    runtime = await seed(hass)
    layout = await runtime.store.async_load()
    layout[CONFIG_MIGRATION_PASSPORT] = {"version": 999}
    await runtime.store.async_save(layout)
    before = deepcopy(await runtime.config_store.async_load()), deepcopy(await runtime.store.async_load())
    async with runtime.write_lock:
        with pytest.raises(ValueError, match="unsupported"):
            await async_resolve_pending_pair(runtime)
    assert (await runtime.config_store.async_load(), await runtime.store.async_load()) == before


class Connection:
    def __init__(self, admin=True):
        self.user = SimpleNamespace(id="migration-admin", is_admin=admin, is_owner=False)
        self.result = self.error = None

    def send_result(self, _id, result):
        self.result = result

    def send_error(self, _id, code, message):
        self.error = code, message


async def entry_runtime(hass):
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from custom_components.houseplan.const import DOMAIN

    entry = MockConfigEntry(domain=DOMAIN, data={}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry.runtime_data


async def recovery_export(hass, connection):
    from custom_components.houseplan.websocket_api import ws_export_create
    await ws_export_create.__wrapped__(hass, connection, {
        "id": 1, "kind": "full", "migration_source": True, "card_version": "test",
    })


async def test_original_snapshot_exports_exact_pair_read_only_and_reimports_normally(hass):
    from custom_components.houseplan.import_export import create_preview
    from custom_components.houseplan.websocket_api import ws_import_apply

    runtime = await seed(hass, await entry_runtime(hass))
    original_config = deepcopy(await runtime.config_store.async_load())
    original_layout = deepcopy(await runtime.store.async_load())
    async with runtime.write_lock:
        await async_resolve_pending_pair(runtime)
    before = deepcopy(await runtime.config_store.async_load()), deepcopy(await runtime.store.async_load())
    connection = Connection()
    await recovery_export(hass, connection)
    assert connection.error is None
    document = connection.result["document"]
    assert document["export_version"] == 1 and document["model_version"] == 0
    assert document["payload"] == {"config": original_config["config"], "layout": original_layout["layout"]}
    assert (await runtime.config_store.async_load(), await runtime.store.async_load()) == before
    response = create_preview(runtime, json.dumps(document).encode(), owner_id=connection.user.id,
        duplicate_policy="skip", current_config_data=before[0], current_layout_data=before[1],
        config_root=Path(hass.config.path("")))
    applied = Connection()
    await ws_import_apply.__wrapped__(hass, applied, {
        "id": 2, "token": response["token"], "expected_config_rev": response["expected_config_rev"],
        "expected_layout_rev": response["expected_layout_rev"], "confirm_missing_content": True,
    })
    assert applied.error is None and applied.result["ok"]
    saved = await runtime.config_store.async_load()
    assert saved["config"]["markers"][0]["display"] == "icon_ripple"
    assert "aspect" not in saved["config"]["spaces"][0]
    assert (await runtime.store.async_load())["layout"]["lamp"]["y"] == 0.35


@pytest.mark.parametrize("mixed", [False, True])
async def test_portable_original_completes_old_half_intent_without_double_transform(hass, mixed):
    from custom_components.houseplan.geometry_migration import migrate_space
    from custom_components.houseplan.import_export import create_preview
    from custom_components.houseplan.websocket_api import ws_import_apply

    runtime = await entry_runtime(hass)
    original = source()
    original["config"]["markers"][0]["space"] = "s"
    # The historical writer saved config first, leaving layout + its own
    # geom_pending intent in the old frame. A second floor may still be old.
    migrate_space(original["config"]["spaces"][0])
    layout = {"lamp": {"s": "s", "x": 0.1, "y": 0.2}}
    pending = {"s": 2}
    if mixed:
        original["config"]["spaces"].append({"id": "still", "title": "Still old", "aspect": 0.5,
            "view_box": [0, 0, 1, 1], "rooms": [], "cell_cm": 5})
        original["config"]["markers"].append({"id": "second", "binding": "virtual", "space": "still"})
        layout["second"] = {"s": "still", "x": 0.2, "y": 0.3}
        pending["still"] = 0.5
    original_layout = {"layout": layout, "rev": 7, "geom_pending": pending}
    await runtime.config_store.async_save(original)
    await runtime.store.async_save(original_layout)
    async with runtime.write_lock:
        migrated = await async_resolve_pending_pair(runtime)
    expected_layout = deepcopy(migrated.layout_data["layout"])
    before = deepcopy(await runtime.config_store.async_load()), deepcopy(await runtime.store.async_load())
    exported = Connection()
    await recovery_export(hass, exported)
    assert exported.error is None
    document = exported.result["document"]
    assert document["payload"]["layout"]["lamp"]["y"] == 0.35
    assert "aspect" not in document["payload"]["config"]["spaces"][0]
    if mixed:
        assert document["payload"]["config"]["spaces"][1]["aspect"] == 0.5
        assert document["payload"]["layout"]["second"]["x"] == 0.2
    assert (await runtime.config_store.async_load(), await runtime.store.async_load()) == before
    raw_backup = before[1][CONFIG_MIGRATION_BACKUP]
    assert raw_backup["config_data"] == original and raw_backup["layout_data"] == original_layout
    preview = create_preview(runtime, json.dumps(document).encode(), owner_id=exported.user.id,
        duplicate_policy="skip", current_config_data=before[0], current_layout_data=before[1],
        config_root=Path(hass.config.path("")))
    applied = Connection()
    await ws_import_apply.__wrapped__(hass, applied, {
        "id": 2, "token": preview["token"], "expected_config_rev": preview["expected_config_rev"],
        "expected_layout_rev": preview["expected_layout_rev"], "confirm_missing_content": True,
    })
    assert applied.error is None and applied.result["ok"]
    assert (await runtime.store.async_load())["layout"] == expected_layout


@pytest.mark.parametrize("snapshot", [None, {}, {"version": 2},
    {"version": 1, "config_data": {"config": []}, "layout_data": {}}])
async def test_missing_or_corrupt_source_snapshot_fails_without_store_change(hass, snapshot):
    runtime = await entry_runtime(hass)
    await runtime.store.async_save({"layout": {}, "rev": 1, CONFIG_MIGRATION_BACKUP: snapshot})
    before = deepcopy(await runtime.config_store.async_load()), deepcopy(await runtime.store.async_load())
    connection = Connection()
    await recovery_export(hass, connection)
    assert connection.result is None and connection.error[0] == "invalid_config"
    assert (await runtime.config_store.async_load(), await runtime.store.async_load()) == before


async def test_reader_cannot_export_previous_hidden_source_data(hass):
    await entry_runtime(hass)
    connection = Connection(False)
    await recovery_export(hass, connection)
    assert connection.result is None and connection.error[0] == "unauthorized"


async def test_recovery_export_rechecks_permission_after_worker_await(hass, monkeypatch):
    runtime = await seed(hass, await entry_runtime(hass))
    async with runtime.write_lock:
        await async_resolve_pending_pair(runtime)
    connection = Connection()
    real_job = hass.async_add_executor_job

    async def lose_permission(*args):
        result = await real_job(*args)
        connection.user.is_admin = False
        return result

    monkeypatch.setattr(hass, "async_add_executor_job", lose_permission)
    await recovery_export(hass, connection)
    assert connection.result is None and connection.error[0] == "unauthorized"


async def test_native_load_oracle_is_the_real_durable_store_result(hass):
    fixture = json.loads((Path(__file__).parents[1] / "test/fixtures/config-lifecycle/migration-v1.json").read_text())
    runtime = create_data(hass)
    await runtime.config_store.async_save({"config": fixture["before"]["config"], "rev": 3})
    await runtime.store.async_save({"layout": fixture["before"]["layout"], "rev": 7})
    async with runtime.write_lock:
        pair = await async_resolve_pending_pair(runtime)
    assert pair.config_data["config"] == fixture["expected"]["config"]
    assert pair.layout_data["layout"] == fixture["expected"]["layout"]
    assert pair.config_data["rev"] == 4 and pair.layout_data["rev"] == 8
    async with runtime.write_lock:
        reread = await async_resolve_pending_pair(runtime)
    assert reread.config_data == pair.config_data and reread.layout_data == pair.layout_data


@pytest.mark.parametrize("case", ["canonical-overrides", "unrepresentable-keeps", "glow-enabled"])
async def test_native_scalar_variants_are_the_real_server_result(hass, case):
    fixture = json.loads((Path(__file__).parents[1] / "test/fixtures/config-lifecycle/migration-v1.json").read_text())
    variant = next(item for item in fixture["variants"] if item["id"] == case)
    runtime = create_data(hass)
    await runtime.config_store.async_save({"config": variant["before"]["config"], "rev": 3})
    await runtime.store.async_save({"layout": variant["before"]["layout"], "rev": 7})
    async with runtime.write_lock:
        pair = await async_resolve_pending_pair(runtime)
        reread = await async_resolve_pending_pair(runtime)
    assert pair.config_data["config"] == variant["expected"]["config"]
    assert pair.layout_data["layout"] == variant["expected"]["layout"]
    assert pair.config_data == reread.config_data and pair.layout_data == reread.layout_data


@pytest.mark.parametrize("kind,plan_only,archive", [("full", False, False),
    ("space", False, False), ("space", True, False), ("full", False, True)])
async def test_skipped_releases_json_and_full_zip_follow_same_chain(hass, tmp_path, kind, plan_only, archive):
    from custom_components.houseplan.backup_archive import build_archive, read_archive
    from custom_components.houseplan.import_export import (
        _project_plan_only_space,
        create_export,
        parse_document,
    )

    fixture = json.loads((Path(__file__).parents[1] / "test/fixtures/config-lifecycle/migration-v1.json").read_text())
    runtime = create_data(hass)
    document, _ = create_export(runtime, {"config": fixture["expected"]["config"]},
        {"layout": fixture["expected"]["layout"]}, kind=kind, space_id="f1" if kind == "space" else None,
        plan_only=plan_only, card_version="test", config_root=tmp_path)
    # Genuine old-form input, not a changed implementation. Keep the existing
    # transfer/placement/content manifests while restoring old scalar fields.
    document["model_version"] = 0
    old = deepcopy(fixture["before"]["config"])
    if kind == "space":
        old.pop("settings", None)
    if plan_only:
        projected = _project_plan_only_space(old["spaces"][0])
        projected["aspect"] = 2
        old = {"spaces": [projected], "markers": []}
    document["payload"]["config"] = old
    document["payload"]["layout"] = {} if plan_only else fixture["before"]["layout"]
    if archive:
        path = tmp_path / "old.zip"
        build_archive(path, document, tmp_path, {})
        target = tmp_path / "restored"
        target.mkdir()
        parsed = read_archive(path, target).document
    else:
        parsed = parse_document(json.dumps(document).encode())
    space = parsed["payload"]["config"]["spaces"][0]
    assert "aspect" not in space and "plan_scale" not in space
    assert space["plan_scale_x"] == space["plan_scale_y"] == 2
    assert space["decor"][0]["width_cm"] == 2.4
    assert space["decor"][1]["size_cm"] == 36
    if not plan_only:
        assert parsed["payload"]["config"]["future_root"] == {"keep": True}
    if not plan_only:
        marker = parsed["payload"]["config"]["markers"][0]
        assert marker["display"] == "icon_ripple" and marker["tap_action"] == "toggle"
        assert marker["vacuum"]["trail_mode"] == "never"
        assert parsed["payload"]["layout"]["d_lamp"]["y"] == 0.4
    reparsed = parse_document(json.dumps(parsed).encode())
    assert reparsed["payload"] == parsed["payload"]


@pytest.mark.parametrize("bad", ["width", "width_cm", "size", "scale", "size_cm", "trail", "trail_mode",
    "plan_scale", "plan_scale_x", "glow_enabled", "room_glow", "bg_mode", "weather_type", "weather_bound"])
def test_old_alias_decoder_does_not_bypass_independent_strict_scalar_validation(tmp_path, bad):
    from custom_components.houseplan.import_export import ImportFailure, parse_document

    fixture = json.loads((Path(__file__).parents[1] / "test/fixtures/config-lifecycle/migration-v1.json").read_text())
    config = fixture["before"]["config"]
    space = config["spaces"][0]
    if bad in {"width", "width_cm"}:
        space["decor"][0][bad] = 0
    elif bad in {"size", "scale", "size_cm"}:
        space["decor"][1][bad] = "xxl" if bad == "size" else 0
    elif bad in {"trail", "trail_mode"}:
        config["markers"][0]["vacuum"][bad] = "corrupt"
    elif bad in {"plan_scale", "plan_scale_x"}:
        space[bad] = 0
    elif bad == "glow_enabled":
        space["settings"][bad] = "false"
    elif bad == "room_glow":
        space["rooms"][0]["settings"]["glow"] = "false"
    elif bad.startswith("weather_"):
        config["settings"]["weather_entity"] = 123 if bad == "weather_type" else "x" * 501
    else:
        config["settings"]["bg_mode"] = "corrupt"
    document = {"format": "houseplan-export", "export_version": 1, "kind": "full", "model_version": 0,
                "payload": {"config": config, "layout": fixture["before"]["layout"]},
                "placement_manifest": [], "content_manifest": []}
    with pytest.raises(ImportFailure) as error:
        parse_document(json.dumps(document).encode())
    assert error.value.code == "invalid_config"
