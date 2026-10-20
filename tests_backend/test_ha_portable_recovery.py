"""Real portable document/archive boundaries for #973; all data synthetic."""
from __future__ import annotations

import base64
import copy
import json
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest

from custom_components.houseplan import websocket_api as wsapi
from custom_components.houseplan.backup_archive import build_archive, read_archive
from custom_components.houseplan.backup_files import new_stage, plan_files
from custom_components.houseplan.backup_service import get_backup_service
from custom_components.houseplan.const import DOMAIN
from custom_components.houseplan.import_export import (
    ImportFailure,
    create_export,
    create_preview,
    get_candidate,
    parse_document,
    prepare_apply,
    revalidate_candidate,
)
from custom_components.houseplan.store import async_save_config_state
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model
from tests_backend import test_ha_backup_archive as archive
from tests_backend.test_portable_recovery import config as radar_config

transport = archive.transport


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    yield


def portable_config():
    cfg = radar_config()
    cfg["model_version"] = 9
    cfg["spaces"][0].update(title="Synthetic floor", view_box=[0, 0, 1, 1])
    cfg["spaces"][0]["rooms"][0].update(
        name="Living", poly=[[0, 0], [1, 0], [1, 1], [0, 1]],
    )
    return commit_wall_segment_model(cfg)[0]


def export(cfg, root, kind="full", plan_only=False):
    return create_export(
        SimpleNamespace(instance_id="synthetic-source"), {"config": cfg, "rev": 5},
        {"layout": {"radar": {"x": .3, "y": .4, "s": "floor"}}, "rev": 8},
        kind=kind, space_id="floor" if kind == "space" else None,
        plan_only=plan_only, card_version="test", config_root=root,
    )[0]


def broken_document(root, *, kind="full"):
    document = export(portable_config(), root, kind)
    marker = document["payload"]["config"]["markers"][0]
    marker["name"] = "Synthetic <img data-recovery-injection> " + "x" * 240
    marker.pop("space", None)
    marker["radar"]["room_id"] = "deleted"
    marker["vacuum"] = {"live": True, "map_routes": [{
        "id": "map", "source": "camera.synthetic", "map_id": "66", "space": "deleted-floor",
        "calibration": [1, 0, 0, 1, 3, 4],
    }]}
    return document


def preview(document, root, current=None, duplicate_policy="skip"):
    runtime = SimpleNamespace(instance_id="synthetic-target", import_previews={})
    cd = {"config": current or {"spaces": [], "markers": []}, "rev": 2}
    ld = {"layout": {}, "rev": 3}
    response = create_preview(
        runtime, json.dumps(document).encode(), owner_id="tester", duplicate_policy=duplicate_policy,
        current_config_data=cd, current_layout_data=ld, config_root=root,
    )
    return runtime, response, get_candidate(runtime, response["token"], "tester"), cd, ld


@pytest.mark.parametrize("kind", ["full", "space"])
def test_preview_revalidate_and_apply_use_the_same_recovery_not_source_mutation(tmp_path, kind):
    document = broken_document(tmp_path, kind=kind)
    before = copy.deepcopy(document)
    _, response, candidate, cd, ld = preview(document, tmp_path)
    assert response["preview"]["recovery"]["counts"] == {"radar": 1, "vacuum": 1}
    checked, layout, details = prepare_apply(candidate, cd["config"], {}, confirm_missing_content=True)
    marker = checked["markers"][0]
    assert marker["radar"]["enabled"] is False
    assert marker["radar"]["room_id"] == "deleted"
    assert marker["radar"]["sources"] == before["payload"]["config"]["markers"][0]["radar"]["sources"]
    assert marker["vacuum"]["live"] is False
    assert marker["vacuum"]["map_routes"][0]["calibration"] == [1, 0, 0, 1, 3, 4]
    old_digest = candidate["digest"]
    refreshed = revalidate_candidate(candidate, cd, ld, duplicate_policy="skip", config_root=tmp_path)
    assert refreshed["preview"]["recovery"] == details["recovery"]
    assert prepare_apply(candidate, {}, {}, confirm_missing_content=True) == (checked, layout, details)
    assert candidate["digest"] == old_digest
    assert document == before
    candidate["details"]["recovery"]["total"] += 1
    with pytest.raises(ImportFailure, match="changed"):
        prepare_apply(candidate, {}, {}, confirm_missing_content=True)


def test_export_repairs_only_a_copy_and_the_actual_document_imports_on_empty_setup(tmp_path):
    cfg = portable_config()
    marker = cfg["markers"][0]
    marker.pop("space")
    marker["radar"].update(enabled=False, room_id="deleted")
    marker["is_light"] = True
    marker["controls"] = ["marker:radar"]
    before = copy.deepcopy(cfg)
    document = export(cfg, tmp_path)
    assert cfg == before
    assert document["transfer"]["recovery"]["counts"] == {"radar": 1, "controls": 1}
    assert document["payload"]["config"]["markers"][0]["controls"] is None
    parsed = parse_document(json.dumps(document).encode())
    _, _, candidate, _, _ = preview(parsed, tmp_path)
    prepared, _, _ = prepare_apply(candidate, {}, {}, confirm_missing_content=False)
    assert len(prepared["spaces"]) == len(cfg["spaces"])
    assert len(prepared["markers"]) == len(cfg["markers"])


def test_space_export_does_not_validate_excluded_devices_and_plan_only_stays_private(tmp_path):
    cfg = portable_config()
    cfg["markers"].append({"id": "outside", "binding": "virtual", "space": "unselected",
                           "radar": {"version": 999, "private": "do-not-export"}})
    document = export(cfg, tmp_path, "space")
    assert len(document["payload"]["config"]["markers"]) == 1
    assert "do-not-export" not in json.dumps(document)
    private_free = export(cfg, tmp_path, "space", plan_only=True)
    assert private_free["payload"]["config"]["markers"] == []
    assert "recovery" not in private_free["transfer"]


def test_forged_report_cannot_authorize_active_broken_radar(tmp_path):
    document = broken_document(tmp_path)
    document["transfer"]["recovery"] = {"total": 0, "all_valid": True}
    _, response, candidate, _, _ = preview(document, tmp_path)
    assert response["preview"]["recovery"]["total"] == 2
    assert candidate["target_config"]["markers"][0]["radar"]["enabled"] is False
    assert "recovery" not in candidate["document"]["transfer"]


@pytest.mark.parametrize("policy", ["skip", "virtual"])
def test_space_duplicate_policy_does_not_repair_existing_target_or_report_removed_radars(tmp_path, policy):
    document = broken_document(tmp_path, kind="space")
    target = portable_config()
    target["markers"][0].update(id="existing", radar={"version": 999, "unknown": "keep"})
    old_marker = copy.deepcopy(target["markers"][0])
    _, response, candidate, _, _ = preview(document, tmp_path, target, policy)
    assert response["preview"]["recovery"]["total"] == 0
    markers = candidate["target_config"]["markers"]
    assert markers[0] == old_marker
    assert len(markers) == (1 if policy == "skip" else 2)
    if policy == "virtual":
        assert markers[1]["binding"] == "virtual"
        assert "radar" not in markers[1] and "vacuum" not in markers[1]


async def test_real_archive_export_report_apply_inert_runtime_and_undo(hass, tmp_path):
    _, rt = await archive.setup(hass)
    cfg = portable_config()
    cfg["markers"][0]["radar"]["room_id"] = "deleted"
    async with rt.write_lock:
        await async_save_config_state(rt, cfg, 1)
        await rt.store.async_save({"layout": {}, "rev": 1})
    before_cd = copy.deepcopy(await rt.config_store.async_load())
    before_ld = copy.deepcopy(await rt.store.async_load())
    service = get_backup_service(hass, rt)
    prepared_export = await service.export("backup-owner", "test", None)
    assert prepared_export["recovery"]["counts"] == {"radar": 1}
    assert await rt.config_store.async_load() == before_cd
    assert await rt.store.async_load() == before_ld
    await service.release(service.get(prepared_export["token"], "backup-owner"))
    raw_document = broken_document(tmp_path)
    path = tmp_path / "synthetic.zip"
    build_archive(path, raw_document, tmp_path, {})
    response = await service.upload("backup-owner", archive.Content(path.read_bytes()), path.stat().st_size)
    assert response["preview"]["recovery"]["counts"] == {"radar": 1, "vacuum": 1}
    assert await rt.config_store.async_load() == before_cd
    assert await rt.store.async_load() == before_ld
    result = await archive.apply(hass, response)
    assert result.error is None, result.error
    stored = (await rt.config_store.async_load())["config"]
    assert stored["markers"][0]["radar"]["enabled"] is False
    await rt.radar_coordinator.async_refresh()
    assert rt.radar_coordinator.radars == {}
    assert not rt.radar_coordinator._unsub_sources
    recorder = hass.data[DOMAIN]["trail_recorder"]
    await recorder.async_refresh()
    assert recorder.pairs == {}
    assert recorder.routes_by_marker == {}
    undo = archive.Connection()
    await wsapi.ws_plan_optimize_undo.__wrapped__(hass, undo, {
        "id": 3, "type": "houseplan/plan/optimize_undo",
        "expected_config_rev": result.result["config_rev"],
        "expected_layout_rev": result.result["layout_rev"],
    })
    assert undo.error is None, undo.error
    restored = (await rt.config_store.async_load())["config"]
    assert restored["markers"][0]["radar"] == cfg["markers"][0]["radar"]
    assert not rt.import_previews and not service.sessions


def test_native_wire_fixture_is_real_backend_recovery_not_an_invented_success(tmp_path):
    fixture = json.loads((Path(__file__).parents[1] / "demo/fixtures/portable-recovery-v1.json").read_text())
    root = tmp_path / "target"
    root.mkdir()
    for name, key in (("source.zip", "zip"), ("repaired.zip", "exportZip")):
        path = tmp_path / name
        path.write_bytes(base64.b64decode(fixture[key], validate=True))
        session = uuid4().hex
        payload = read_archive(path, new_stage(root, session))
        document, _, included = plan_files(payload, root, session)
        runtime = SimpleNamespace(instance_id="synthetic-target", import_previews={})
        response = create_preview(
            runtime, json.dumps(document).encode(), owner_id="test", duplicate_policy="skip",
            current_config_data={"config": {"spaces": [], "markers": []}, "rev": 0},
            current_layout_data={"layout": {}, "rev": 0}, config_root=root,
            portable_content=included,
        )
        candidate = get_candidate(runtime, response["token"], "test")
        assert response["preview"]["counts"] == fixture["response"]["preview"]["counts"]
        assert response["preview"]["recovery"] == fixture["response"]["preview"]["recovery"]
        assert candidate["target_config"] == fixture["config"]
        assert candidate["target_layout"] == fixture["layout"]
