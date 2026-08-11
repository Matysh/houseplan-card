"""Portable backup and authenticated endpoint contract tests (#50).

The file intentionally carries the ``test_ha_`` prefix: importing the custom
component executes its Home Assistant package initializer even when an
individual test exercises an otherwise pure helper.
"""
from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
import voluptuous as vol
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.houseplan.import_export import (
    ImportFailure,
    build_space_merge,
    create_export,
    create_preview,
    get_candidate,
    parse_document,
    prepare_apply,
    revalidate_candidate,
)
from custom_components.houseplan import websocket_api as wsapi
from custom_components.houseplan.const import (
    DOMAIN,
    MAX_IMPORT_PREVIEWS_TOTAL,
    PLAN_MODEL_VERSION,
    PLANS_DIR,
)
from custom_components.houseplan.store import (
    async_save_layout_state,
    get_data,
    layout_store_payload,
)
from custom_components.houseplan.validation import MAX_LAYOUT


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the HA harness."""
    yield


def _config() -> dict:
    return {
        "model_version": 6,
        "spaces": [{
            "id": "ground", "title": "Ground", "view_box": [0, 0, 1, 1],
            "rooms": [{"id": "living", "name": "Living", "poly": [[0, 0], [1, 0], [1, 1]]}],
            "plan_url": None,
        }],
        "markers": [{
            "id": "lamp", "binding": "entity:light.living", "space": "ground",
            "room_id": "living", "controls": ["switch.wall"],
        }],
        "settings": {"known_devices": ["old-device"], "new_device_ids": ["new-device"]},
    }


def _document(tmp_path: Path, kind: str = "full") -> dict:
    runtime = SimpleNamespace(instance_id="instance-a")
    document, _filename = create_export(
        runtime,
        {"config": _config(), "rev": 2},
        {"layout": {"lamp": {"x": 0.4, "y": 0.5, "s": "ground"}}, "rev": 3},
        kind=kind,
        space_id="ground" if kind == "space" else None,
        card_version="1.61.0",
        config_root=tmp_path,
    )
    return document


def test_strict_parser_rejects_duplicate_proto_and_future_model(tmp_path: Path) -> None:
    with pytest.raises(ImportFailure, match="Duplicate") as duplicate:
        parse_document(b'{"format":"houseplan-export","format":"houseplan-export"}')
    assert duplicate.value.code == "invalid_json"
    with pytest.raises(ImportFailure) as proto:
        parse_document(b'{"__proto__":{},"format":"houseplan-export"}')
    assert proto.value.code == "invalid_json"
    document = _document(tmp_path)
    document["model_version"] = 999
    with pytest.raises(ImportFailure) as future:
        parse_document(json.dumps(document).encode())
    assert future.value.code == "future_model"
    document = _document(tmp_path)
    document["model_version"] = True
    with pytest.raises(ImportFailure) as boolean:
        parse_document(json.dumps(document).encode())
    assert boolean.value.code == "invalid_format"


@pytest.mark.parametrize("value", ["abc", {"bad": 1}, -1, 10**20, True])
def test_parser_rejects_invalid_dropped_marker_link_counter(tmp_path: Path, value: Any) -> None:
    document = _document(tmp_path)
    document["transfer"]["dropped_marker_links"] = value
    with pytest.raises(ImportFailure) as invalid:
        parse_document(json.dumps(document).encode())
    assert invalid.value.code == "invalid_format"


def test_full_preview_drops_dormant_broken_and_duplicate_links(tmp_path: Path) -> None:
    document = _document(tmp_path)
    markers = document["payload"]["config"]["markers"]
    markers.extend([
        {"id": "plain", "binding": "virtual", "is_light": False},
        {"id": "dumb", "binding": "virtual", "is_light": True},
        {
            "id": "controller", "binding": "virtual",
            "controls": [
                "marker:missing", "marker:plain", "marker:dumb", "marker:dumb",
                "switch.keep",
            ],
        },
    ])
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    response = create_preview(
        runtime, json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": _config(), "rev": 1},
        current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
    )
    assert response["preview"]["dropped_marker_links"] == 3
    candidate = get_candidate(runtime, response["token"], "alice")
    imported = candidate["document"]["payload"]["config"]
    controller = next(marker for marker in imported["markers"] if marker["id"] == "controller")
    assert controller["controls"] == ["marker:dumb", "switch.keep"]


@pytest.mark.parametrize("kind", ["self", "cycle"])
def test_full_preview_still_rejects_self_and_cycle(kind: str, tmp_path: Path) -> None:
    document = _document(tmp_path)
    markers = document["payload"]["config"]["markers"]
    if kind == "self":
        markers.append({
            "id": "self", "binding": "virtual", "is_light": True,
            "controls": ["marker:self"],
        })
        expected = "marker_control_self"
    else:
        markers.extend([
            {"id": "a", "binding": "virtual", "is_light": True, "controls": ["marker:b"]},
            {"id": "b", "binding": "virtual", "is_light": True, "controls": ["marker:a"]},
        ])
        expected = "marker_control_cycle"
    with pytest.raises(ImportFailure) as invalid:
        create_preview(
            SimpleNamespace(instance_id="instance-a", import_previews={}),
            json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
            current_config_data={"config": _config(), "rev": 1},
            current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
        )
    assert invalid.value.code == expected


def test_backend_model_version_matches_frontend_constant() -> None:
    source = Path("src/plan-optimizer.ts").read_text(encoding="utf-8")
    assert f"PLAN_MODEL_VERSION = {PLAN_MODEL_VERSION}" in source


def test_layout_writer_preserves_unrelated_metadata_and_removes_only_named_keys() -> None:
    stored = {
        "layout": {"old": {"x": 0, "y": 0}}, "rev": 4,
        "repair_backup": {"space": "ground"}, "optimize_pending": {"target": True},
        "future_metadata": {"kept": True},
    }
    result = layout_store_payload(
        stored, {"new": {"x": 1, "y": 1}}, 5, remove=("optimize_pending",)
    )
    assert result["repair_backup"] == {"space": "ground"}
    assert result["future_metadata"] == {"kept": True}
    assert "optimize_pending" not in result
    assert result["layout"] == {"new": {"x": 1, "y": 1}}
    assert result["rev"] == 5


def test_full_export_has_versioned_envelope_and_live_layout(tmp_path: Path) -> None:
    config = _config()
    config["markers"].append({"id": "gone", "binding": "virtual", "removed": True})
    runtime = SimpleNamespace(instance_id="instance-a")
    document, filename = create_export(
        runtime,
        {"config": config, "rev": 1},
        {"layout": {
            "lamp": {"x": 0.4, "y": 0.5, "s": "ground"},
            "gone": {"x": 0.1, "y": 0.2, "s": "ground"},
        }},
        kind="full", space_id=None, card_version="1.61.0", config_root=tmp_path,
    )
    assert document["format"] == "houseplan-export"
    assert document["export_version"] == 1
    assert document["model_version"] == 6
    assert "model_version" not in document["payload"]["config"]
    assert document["source_fingerprint"].startswith("sha256:")
    assert set(document["payload"]["layout"]) == {"lamp"}
    assert document["placement_manifest"][0]["layout_id"] == "lamp"
    assert filename.startswith("houseplan-full-") and filename.endswith(".json")


@pytest.mark.parametrize(("stored", "envelope"), [(None, 0), (0, 0), (3, 3), (9, 9)])
def test_export_preserves_actual_model_only_in_the_envelope(
    tmp_path: Path, stored: int | None, envelope: int,
) -> None:
    config = _config()
    if stored is None:
        config.pop("model_version", None)
    else:
        config["model_version"] = stored
    document, _ = create_export(
        SimpleNamespace(instance_id="instance-a"),
        {"config": config}, {"layout": {}}, kind="full", space_id=None,
        card_version="1.61.0", config_root=tmp_path,
    )
    assert document["model_version"] == envelope
    assert "model_version" not in document["payload"]["config"]
    if envelope > PLAN_MODEL_VERSION:
        with pytest.raises(ImportFailure) as future:
            parse_document(json.dumps(document).encode())
        assert future.value.code == "future_model"


def test_export_rejects_boolean_stored_model_before_schema_coercion(tmp_path: Path) -> None:
    config = _config()
    config["model_version"] = True
    with pytest.raises(ImportFailure) as invalid:
        create_export(
            SimpleNamespace(instance_id="instance-a"), {"config": config}, {"layout": {}},
            kind="full", space_id=None, card_version="1.61.0", config_root=tmp_path,
        )
    assert invalid.value.code == "invalid_config"


def test_space_import_remaps_owned_ids_and_duplicate_policy(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    current = _config()
    current["spaces"][0]["id"] = "existing"
    current["spaces"][0]["title"] = "Ground"
    current["markers"][0]["space"] = "existing"
    merged, layout, details = build_space_merge(
        document, current, {"lamp": {"x": 0.1, "y": 0.1, "s": "existing"}}, "skip"
    )
    assert len(merged["spaces"]) == 2
    assert merged["spaces"][-1]["id"] != "ground"
    assert merged["spaces"][-1]["title"] == "Ground (2)"
    assert details["duplicates"] >= 1 and details["skipped"] == 1
    assert all(position["s"] == details["space_id"] for key, position in layout.items() if key != "lamp")

    virtual, _layout, vdetails = build_space_merge(document, current, {}, "virtual")
    copied = virtual["markers"][-1]
    assert copied["binding"] == "virtual"
    assert copied["display"] == "static_icon"
    assert "controls" not in copied and vdetails["virtualized"] == 1


def test_preview_is_owner_bound_and_foreign_full_drops_discovery_lists(tmp_path: Path) -> None:
    document = _document(tmp_path)
    document["source_fingerprint"] = "sha256:foreign"
    raw = json.dumps(document).encode()
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    response = create_preview(
        runtime, raw, owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": _config(), "rev": 4},
        current_layout_data={"layout": {}, "rev": 5}, config_root=tmp_path,
    )
    with pytest.raises(ImportFailure) as owner:
        get_candidate(runtime, response["token"], "bob")
    assert owner.value.code == "preview_owner_mismatch"
    candidate = get_candidate(runtime, response["token"], "alice")
    config, _layout, _details = prepare_apply(
        candidate, _config(), {}, confirm_missing_content=True,
    )
    assert "known_devices" not in config["settings"]
    assert "new_device_ids" not in config["settings"]


def test_preview_candidate_digest_and_global_memory_cap_are_enforced(tmp_path: Path) -> None:
    document = _document(tmp_path)
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    tokens = []
    for owner in range(MAX_IMPORT_PREVIEWS_TOTAL + 1):
        response = create_preview(
            runtime, json.dumps(document).encode(), owner_id=f"owner-{owner}",
            duplicate_policy="skip", current_config_data={"config": _config(), "rev": 1},
            current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
        )
        tokens.append(response["token"])
    assert len(runtime.import_previews) == MAX_IMPORT_PREVIEWS_TOTAL
    assert tokens[0] not in runtime.import_previews

    candidate = runtime.import_previews[tokens[-1]]
    candidate["document"]["payload"]["config"]["settings"]["mutated"] = True
    with pytest.raises(ImportFailure) as changed:
        get_candidate(runtime, tokens[-1], f"owner-{MAX_IMPORT_PREVIEWS_TOTAL}")
    assert changed.value.code == "invalid_format"


def test_preview_counts_only_stored_wall_entries(tmp_path: Path) -> None:
    document = _document(tmp_path)
    document["payload"]["config"].pop("model_version", None)
    response = create_preview(
        SimpleNamespace(instance_id="instance-a", import_previews={}),
        json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": _config(), "rev": 1},
        current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
    )
    assert response["preview"]["counts"]["walls"] == 0


def test_parser_caps_placement_manifest_rows(tmp_path: Path) -> None:
    document = _document(tmp_path)
    document["placement_manifest"] = [
        {"layout_id": f"row-{index}"} for index in range(MAX_LAYOUT + 1)
    ]
    with pytest.raises(ImportFailure) as oversized:
        parse_document(json.dumps(document).encode())
    assert oversized.value.code == "too_large"


def test_preview_rejects_manifest_that_omits_a_payload_reference(tmp_path: Path) -> None:
    config = _config()
    config["spaces"][0]["plan_url"] = "/api/houseplan/content/plans/_/plan.svg"
    runtime = SimpleNamespace(instance_id="instance-a")
    document, _ = create_export(
        runtime, {"config": config}, {"layout": {}}, kind="full", space_id=None,
        card_version="1.61.0", config_root=tmp_path,
    )
    document["content_manifest"] = []
    with pytest.raises(ImportFailure) as invalid:
        create_preview(
            SimpleNamespace(instance_id="instance-a", import_previews={}),
            json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
            current_config_data={"config": _config(), "rev": 1},
            current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
        )
    assert invalid.value.code == "invalid_content"


def test_revalidate_full_refreshes_revisions_and_registry_summary(tmp_path: Path) -> None:
    document = _document(tmp_path)
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    response = create_preview(
        runtime, json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": _config(), "rev": 1},
        current_layout_data={"layout": {}, "rev": 2}, config_root=tmp_path,
    )
    candidate = get_candidate(runtime, response["token"], "alice")
    refreshed = revalidate_candidate(
        candidate, {"config": _config(), "rev": 7}, {"layout": {}, "rev": 8},
        duplicate_policy="skip", config_root=tmp_path,
        registry_snapshot={
            "active_device": set(), "disabled_device": set(),
            "active_entity": {"light.living"}, "disabled_entity": set(), "areas": set(),
        },
    )
    assert refreshed["expected_config_rev"] == 7
    assert refreshed["expected_layout_rev"] == 8
    assert refreshed["preview"]["bindings"]["active"] == 1


def test_space_remap_covers_marker_id_layout_and_vacuum_segment_map(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    document["payload"]["config"]["markers"][0]["vacuum"] = {
        "segment_map": {"12": "living"},
    }
    merged, layout, details = build_space_merge(
        document, {"spaces": [], "markers": [], "settings": {}}, {}, "skip",
    )
    imported = next(space for space in merged["spaces"] if space["id"] == details["space_id"])
    imported_room = imported["rooms"][0]["id"]
    marker = next(marker for marker in merged["markers"] if marker.get("space") == details["space_id"])
    assert marker["id"] != "lamp"
    assert marker["vacuum"]["segment_map"] == {"12": imported_room}
    assert marker["id"] in layout and "lamp" not in layout


def test_space_merge_remaps_internal_marker_light_links(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    markers = document["payload"]["config"]["markers"]
    markers[0]["name"] = "Living lamp"
    markers[0]["controls"] = ["marker:dumb", "light.external"]
    markers.append({
        "id": "dumb", "binding": "virtual", "space": "ground",
        "room_id": "living", "name": "Dumb lamp", "is_light": True,
    })
    merged, _layout, details = build_space_merge(
        document, {"spaces": [], "markers": [], "settings": {}}, {}, "skip",
    )
    imported = [m for m in merged["markers"] if m.get("space") == details["space_id"]]
    by_name = {m.get("name"): m for m in imported}
    assert by_name["Living lamp"]["controls"] == [
        "marker:" + by_name["Dumb lamp"]["id"], "light.external",
    ]
    assert details["dropped_marker_links"] == 0


def test_space_export_drops_marker_links_outside_selection(tmp_path: Path) -> None:
    config = _config()
    config["markers"][0]["controls"] = ["marker:outside", "light.keep"]
    config["markers"].append({
        "id": "outside", "binding": "virtual", "space": "other",
        "name": "Other lamp", "is_light": True,
    })
    document, _ = create_export(
        SimpleNamespace(instance_id="instance-a"), {"config": config},
        {"layout": {"lamp": {"s": "ground", "x": 0.5, "y": 0.5}}},
        kind="space", space_id="ground", card_version="1.61.0", config_root=tmp_path,
    )
    marker = document["payload"]["config"]["markers"][0]
    assert marker["controls"] == ["light.keep"]
    assert document["transfer"]["dropped_marker_links"] == 1


def test_space_merge_drops_link_when_target_is_virtualized_duplicate(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    controller = document["payload"]["config"]["markers"][0]
    controller["controls"] = ["marker:smart", "light.keep"]
    document["payload"]["config"]["markers"].append({
        "id": "smart", "binding": "device:shared-target", "space": "ground",
        "room_id": "living", "name": "Smart target", "is_light": True,
    })
    current = {
        "spaces": [], "settings": {},
        "markers": [{"id": "existing", "binding": "device:shared-target"}],
    }
    merged, _layout, details = build_space_merge(document, current, {}, "virtual")
    imported_controller = next(
        marker for marker in merged["markers"]
        if marker.get("binding") == controller.get("binding")
    )
    assert imported_controller["controls"] == ["light.keep"]
    assert details["dropped_marker_links"] == 1


def test_space_merge_drops_dormant_link_and_counts_virtualized_controller_links(
    tmp_path: Path,
) -> None:
    dormant = _document(tmp_path, "space")
    controller = dormant["payload"]["config"]["markers"][0]
    controller["controls"] = ["marker:plain", "switch.keep"]
    dormant["payload"]["config"]["markers"].append({
        "id": "plain", "binding": "virtual", "space": "ground", "is_light": False,
    })
    merged, _layout, details = build_space_merge(dormant, {"spaces": [], "markers": []}, {}, "skip")
    imported_controller = next(
        marker for marker in merged["markers"] if marker.get("binding") == controller["binding"]
    )
    assert imported_controller["controls"] == ["switch.keep"]
    assert details["dropped_marker_links"] == 1

    virtualized = _document(tmp_path, "space")
    controller = virtualized["payload"]["config"]["markers"][0]
    controller["name"] = "Controller"
    controller["controls"] = ["marker:dumb"]
    virtualized["payload"]["config"]["markers"].append({
        "id": "dumb", "binding": "virtual", "space": "ground", "is_light": True,
    })
    current = {
        "spaces": [], "markers": [{"id": "existing", "binding": controller["binding"]}],
    }
    merged, _layout, details = build_space_merge(virtualized, current, {}, "virtual")
    imported_controller = next(
        marker for marker in merged["markers"]
        if marker.get("name") == controller.get("name") and marker.get("binding") == "virtual"
    )
    assert "controls" not in imported_controller
    assert details["dropped_marker_links"] == 1


@pytest.mark.asyncio
async def test_async_layout_writer_preserves_and_can_replace_metadata() -> None:
    class _Store:
        saved: dict[str, Any] | None = None

        async def async_save(self, value: dict[str, Any]) -> None:
            self.saved = value

    store = _Store()
    runtime = SimpleNamespace(store=store)
    stored = {
        "layout": {"old": {"x": 0}}, "rev": 2,
        "geom_pending": {"s": 1}, "repair_backup": {"kept": True},
    }
    await async_save_layout_state(runtime, stored, {"new": {"x": 1}}, 3)
    assert store.saved["geom_pending"] == {"s": 1}
    assert store.saved["repair_backup"] == {"kept": True}
    await async_save_layout_state(
        runtime, store.saved, {}, 4, metadata={"only": True}, replace_metadata=True,
    )
    assert store.saved == {"only": True, "layout": {}, "rev": 4}


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


class _Connection:
    def __init__(self) -> None:
        self.user = SimpleNamespace(id="review-owner", is_admin=True)
        self.result: dict[str, Any] | None = None
        self.error: tuple[str, str] | None = None

    def send_result(self, _msg_id: int, result: dict[str, Any]) -> None:
        self.result = result

    def send_error(self, _msg_id: int, code: str, message: str) -> None:
        self.error = (code, message)


async def _candidate(
    hass: HomeAssistant,
    _tmp_path: Path,
    *,
    target_config: dict[str, Any] | None = None,
    kind: str = "full",
    duplicate_policy: str = "skip",
) -> tuple[Any, dict[str, Any], dict[str, Any]]:
    rt = get_data(hass)
    assert rt is not None
    current_config = _config()
    current_layout = {"lamp": {"x": 0.1, "y": 0.2, "s": "ground"}}
    await rt.config_store.async_save({"config": current_config, "rev": 1})
    await rt.store.async_save({
        "layout": current_layout, "rev": 1,
        "repair_backup": {"must": "survive-failure"},
    })
    incoming = json.loads(json.dumps(target_config or current_config))
    incoming["spaces"][0]["title"] = "Imported"
    config_root = Path(hass.config.path(""))
    document, _ = create_export(
        rt, {"config": incoming, "rev": 7},
        {"layout": {"lamp": {"x": 0.7, "y": 0.8, "s": "ground"}}, "rev": 9},
        kind=kind, space_id="ground" if kind == "space" else None,
        card_version="1.61.0", config_root=config_root,
    )
    response = create_preview(
        rt, json.dumps(document).encode(), owner_id="review-owner",
        duplicate_policy=duplicate_policy,
        current_config_data={"config": current_config, "rev": 1},
        current_layout_data={"layout": current_layout, "rev": 1}, config_root=config_root,
    )
    return rt, response, document


async def _apply(hass: HomeAssistant, response: dict[str, Any], *, confirm: bool = False) -> _Connection:
    connection = _Connection()
    await wsapi.ws_import_apply.__wrapped__(hass, connection, {
        "id": 42,
        "type": "houseplan/import/apply",
        "token": response["token"],
        "expected_config_rev": response["expected_config_rev"],
        "expected_layout_rev": response["expected_layout_rev"],
        "confirm_missing_content": confirm,
    })
    return connection


async def test_export_and_revalidate_ws_endpoints_use_server_owned_state(
    hass: HomeAssistant, tmp_path: Path,
) -> None:
    """The WS boundary must never accept an export payload or revalidate one."""
    await _setup(hass)
    _rt, response, _document_value = await _candidate(hass, tmp_path, kind="space")

    exported = _Connection()
    await wsapi.ws_export_create.__wrapped__(hass, exported, {
        "id": 40, "type": "houseplan/export/create", "kind": "full",
        "card_version": "review",
    })
    assert exported.error is None and exported.result
    document = exported.result["document"]
    assert document["model_version"] == PLAN_MODEL_VERSION
    assert "model_version" not in document["payload"]["config"]

    refreshed = _Connection()
    await wsapi.ws_import_revalidate.__wrapped__(hass, refreshed, {
        "id": 41, "type": "houseplan/import/revalidate",
        "token": response["token"], "duplicate_policy": "skip",
    })
    assert refreshed.error is None and refreshed.result
    assert refreshed.result["token"] == response["token"]
    assert refreshed.result["expected_config_rev"] == response["expected_config_rev"]
    assert refreshed.result["expected_layout_rev"] == response["expected_layout_rev"]


async def test_apply_confirmed_detach_does_not_collect_files_and_commits_pair(
    hass: HomeAssistant, tmp_path: Path, monkeypatch,
) -> None:
    await _setup(hass)
    config = _config()
    config["spaces"][0]["plan_url"] = "/api/houseplan/content/plans/_/missing.svg"
    rt, response, _ = await _candidate(hass, tmp_path, target_config=config)
    assert response["preview"]["confirmation_required"] is True
    monkeypatch.setattr(wsapi, "collect_plans", lambda *_args, **_kwargs: (_ for _ in ()).throw(
        AssertionError("import apply must not collect plans")
    ))
    monkeypatch.setattr(wsapi, "collect_attachments", lambda *_args, **_kwargs: (_ for _ in ()).throw(
        AssertionError("import apply must not collect attachments")
    ))
    connection = await _apply(hass, response, confirm=True)
    assert connection.error is None and connection.result and connection.result["ok"]
    stored_config = await rt.config_store.async_load()
    stored_layout = await rt.store.async_load()
    assert stored_config["config"]["spaces"][0].get("plan_url") is None
    assert stored_config["rev"] == stored_layout["rev"] == 2
    assert "optimize_pending" not in stored_layout
    assert stored_layout["optimize_backup"]["kind"] == "import"


async def test_apply_rechecks_plan_file_under_the_write_lock(
    hass: HomeAssistant, tmp_path: Path,
) -> None:
    await _setup(hass)
    plans = Path(hass.config.path(PLANS_DIR))
    plans.mkdir(parents=True, exist_ok=True)
    plan = plans / "race.svg"
    plan.write_text("<svg/>", encoding="utf-8")
    config = _config()
    config["spaces"][0]["plan_url"] = "/api/houseplan/content/plans/_/race.svg"
    _rt, response, _ = await _candidate(hass, tmp_path, target_config=config)
    assert response["preview"]["confirmation_required"] is False
    plan.unlink()
    connection = await _apply(hass, response)
    assert connection.result is None
    assert connection.error and connection.error[0] == "missing_plan"


async def test_space_apply_commits_remapped_config_and_layout_as_one_pair(
    hass: HomeAssistant, tmp_path: Path,
) -> None:
    await _setup(hass)
    rt, response, _ = await _candidate(
        hass, tmp_path, kind="space", duplicate_policy="virtual",
    )
    connection = await _apply(hass, response)
    assert connection.error is None and connection.result
    assert connection.result["kind"] == "space" and connection.result["can_undo"] is False
    config_data = await rt.config_store.async_load()
    layout_data = await rt.store.async_load()
    assert len(config_data["config"]["spaces"]) == 2
    assert config_data["rev"] == layout_data["rev"] == 2
    assert len(layout_data["layout"]) == 2
    assert "optimize_pending" not in layout_data


async def test_pair_retries_a_fail_after_layout_write_before_success(
    hass: HomeAssistant, tmp_path: Path, monkeypatch,
) -> None:
    await _setup(hass)
    rt, response, _ = await _candidate(hass, tmp_path)
    real_save = rt.store.async_save
    state = {"calls": 0}

    async def fail_after_target_write(value: dict[str, Any]) -> None:
        state["calls"] += 1
        await real_save(value)
        if state["calls"] == 2:
            raise OSError("fail after durable target layout write")

    monkeypatch.setattr(rt.store, "async_save", fail_after_target_write)
    connection = await _apply(hass, response)
    assert connection.error is None and connection.result and connection.result["ok"]
    config_data = await rt.config_store.async_load()
    layout_data = await rt.store.async_load()
    assert config_data["config"]["spaces"][0]["title"] == "Imported"
    assert layout_data["layout"]["lamp"]["x"] == 0.7
    assert "optimize_pending" not in layout_data


async def test_success_events_are_emitted_only_after_both_target_writes(
    hass: HomeAssistant, tmp_path: Path, monkeypatch,
) -> None:
    await _setup(hass)
    rt, response, _ = await _candidate(hass, tmp_path)
    real_config_save = rt.config_store.async_save
    real_layout_save = rt.store.async_save
    durable = {"config": False, "layout": False}
    observed: list[tuple[str, bool, bool]] = []

    async def config_save(value: dict[str, Any]) -> None:
        await real_config_save(value)
        if value.get("rev") == 2:
            durable["config"] = True

    async def layout_save(value: dict[str, Any]) -> None:
        await real_layout_save(value)
        if value.get("rev") == 2 and "optimize_pending" not in value:
            durable["layout"] = True

    def fire(
        _bus: Any,
        event_type: str,
        _event_data: dict[str, Any] | None = None,
        **_kwargs: Any,
    ) -> None:
        if event_type in {"houseplan_config_updated", "houseplan_layout_updated"}:
            observed.append((event_type, durable["config"], durable["layout"]))

    monkeypatch.setattr(rt.config_store, "async_save", config_save)
    monkeypatch.setattr(rt.store, "async_save", layout_save)
    # EventBus uses slots, so patch the class rather than trying to attach a
    # replacement callable to this particular Home Assistant instance.
    monkeypatch.setattr(type(hass.bus), "async_fire", fire)
    connection = await _apply(hass, response)
    assert connection.error is None and connection.result
    assert [item[0] for item in observed] == [
        "houseplan_config_updated", "houseplan_layout_updated",
    ]
    assert all(config_done and layout_done for _event, config_done, layout_done in observed)


async def test_pair_rolls_back_before_reporting_a_persistent_target_failure(
    hass: HomeAssistant, tmp_path: Path, monkeypatch,
) -> None:
    entry = await _setup(hass)
    rt, response, _ = await _candidate(hass, tmp_path)
    real_save = rt.config_store.async_save

    async def refuse_target(value: dict[str, Any]) -> None:
        if value.get("rev") == 2:
            raise OSError("target config cannot be saved")
        await real_save(value)

    monkeypatch.setattr(rt.config_store, "async_save", refuse_target)
    connection = await _apply(hass, response)
    assert connection.result is None
    assert connection.error and connection.error[0] == "commit_failed"
    config_data = await rt.config_store.async_load()
    layout_data = await rt.store.async_load()
    assert config_data["rev"] == layout_data["rev"] == 1
    assert config_data["config"]["spaces"][0]["title"] == "Ground"
    assert layout_data["layout"]["lamp"]["x"] == 0.1
    assert layout_data["repair_backup"] == {"must": "survive-failure"}
    assert "optimize_pending" not in layout_data

    monkeypatch.setattr(rt.config_store, "async_save", real_save)
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    rt = get_data(hass)
    assert rt is not None
    assert (await rt.config_store.async_load())["config"]["spaces"][0]["title"] == "Ground"


def test_apply_schema_accepts_only_an_opaque_preview_token() -> None:
    with pytest.raises(vol.Invalid):
        wsapi.ws_import_apply._ws_schema({
            "id": 1,
            "type": "houseplan/import/apply",
            "payload": _config(),
            "expected_config_rev": 1,
            "expected_layout_rev": 1,
        })
