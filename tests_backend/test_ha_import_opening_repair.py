"""#1238: transfer repairs openings while keeping current graph authority."""
from copy import deepcopy
import json
from types import SimpleNamespace

import pytest

from custom_components.houseplan.import_export import (
    ImportFailure, create_export, create_preview, get_candidate, parse_document,
    prepare_apply, revalidate_candidate,
)
from custom_components.houseplan.plan_graph import project_graph_space, verify_projection
from custom_components.houseplan.validation import CONFIG_SCHEMA
from custom_components.houseplan.wall_segment_model import _wall_key, commit_wall_segment_model


@pytest.fixture(autouse=True)
def _enable_integrations(enable_custom_integrations):
    yield


def _document(tmp_path, model=11, *, kind="full", exact=True):
    poly = [[.2, .2], [.8, .2], [.8, .8], [.2, .8]]
    config, _ = commit_wall_segment_model({
        "model_version": 9, "spaces": [{
            "id": "floor", "title": "Imported floor", "view_box": [0, 0, 1, 1],
            "rooms": [{"id": "room", "name": "Room", "poly": poly}],
            "walls": [{"key": _wall_key(poly[i], poly[(i + 1) % 4]),
                       "a": poly[i], "b": poly[(i + 1) % 4], "cm": 15} for i in range(4)],
            "openings": [{"id": "door", "type": "door", "x": .4, "y": .2,
                          "angle": 0, "length": .08, "lock": "lock.front",
                          "contact": "binary_sensor.front"}],
        }], "markers": [], "settings": {},
    })
    document, _ = create_export(SimpleNamespace(instance_id="source"), {"config": config},
        {"layout": {}}, kind=kind, space_id="floor" if kind == "space" else None,
        card_version="review", config_root=tmp_path)
    assert _door(document)["host"]["tq"]
    document["model_version"] = model
    if model == 10:
        for space in document["payload"]["config"]["spaces"]:
            space.pop("plan_graph")
    if not exact:
        _door(document)["host"].pop("tq")
    return document


def _door(document):
    return document["payload"]["config"]["spaces"][0]["openings"][0]


def _preview(tmp_path, document, current=None):
    runtime = SimpleNamespace(instance_id="target", import_previews={})
    data = {"config": current or {"spaces": [], "markers": [], "settings": {}}, "rev": 4}
    layout = {"layout": {}, "rev": 6}
    before = deepcopy((data, layout))
    response = create_preview(runtime, json.dumps(document).encode(), owner_id="owner",
        duplicate_policy="skip", current_config_data=data, current_layout_data=layout,
        config_root=tmp_path)
    assert (data, layout) == before  # Preview has no persistent write boundary.
    candidate = get_candidate(runtime, response["token"], "owner")
    return response, candidate, data, layout


@pytest.mark.parametrize("model,exact", [(11, True), (10, True), (10, False)])
def test_intact_exact_and_legacy_openings_do_not_need_repair(tmp_path, model, exact):
    document = _document(tmp_path, model, exact=exact)
    before = deepcopy(document)
    response, candidate, _, _ = _preview(tmp_path, document)
    assert response["preview"]["opening_repairs"]["detached"] == 0
    assert response["preview"]["opening_repairs"]["rehosted"] == 0
    assert document == before
    assert candidate["target_config"]["spaces"][0]["openings"][0]["host"]


@pytest.mark.parametrize("model,exact", [(11, True), (10, True), (10, False)])
@pytest.mark.parametrize("kind", ["full", "space"])
def test_offwall_opening_is_reported_confirmed_and_roundtrips(tmp_path, model, exact, kind):
    document = _document(tmp_path, model, kind=kind, exact=exact)
    opening = _door(document)
    opening.update(x=.95, y=.95)
    expected = {key: value for key, value in opening.items() if key != "host"}
    graph = deepcopy(document["payload"]["config"]["spaces"][0].get("plan_graph"))
    response, candidate, data, layout = _preview(tmp_path, document)
    preview = response["preview"]
    assert preview["opening_repairs"]["detached"] == 1
    assert preview["opening_repairs"]["rehosted"] == 0
    assert preview["confirmation_required"] and "openings_detached" in preview["warnings"]
    with pytest.raises(ImportFailure) as blocked:
        prepare_apply(candidate, data["config"], layout["layout"], confirm_missing_content=False)
    assert blocked.value.code == "content_confirmation_required"
    again = revalidate_candidate(candidate, data, layout, duplicate_policy="skip", config_root=tmp_path)
    assert again["preview"]["opening_repairs"]["detached"] == 1
    config, positions, _ = prepare_apply(candidate, data["config"], {}, confirm_missing_content=True)
    imported = config["spaces"][0]["openings"][0]
    assert {k: v for k, v in imported.items() if k != "id"} == {k: v for k, v in expected.items() if k != "id"}
    verify_projection(config["spaces"][0])
    if graph and kind == "full":
        assert config["spaces"][0]["plan_graph"] == graph
    exported, _ = create_export(SimpleNamespace(instance_id="target"), {"config": config},
        {"layout": positions}, kind="full", space_id=None, card_version="review", config_root=tmp_path)
    reloaded = parse_document(json.dumps(exported).encode())
    assert _door(reloaded) == imported
    assert reloaded["transfer"]["opening_repairs"]["detached"] == 0


@pytest.mark.parametrize("model", [10, 11])
def test_nearby_exact_opening_rehosts_without_confirmation(tmp_path, model):
    document = _document(tmp_path, model)
    original = deepcopy(_door(document))
    _door(document)["y"] += .00001
    response, candidate, _, _ = _preview(tmp_path, document)
    assert response["preview"]["opening_repairs"]["rehosted"] == 1
    assert not response["preview"]["confirmation_required"]
    restored = candidate["target_config"]["spaces"][0]["openings"][0]
    assert restored["host"]["id"] == original["host"]["id"]
    assert restored["host"]["tq"] == original["host"]["tq"]
    assert restored["x"] == original["x"]
    assert restored["y"] == original["y"]
    assert restored["length"] == original["length"] and restored["lock"] == original["lock"]
    verify_projection(candidate["target_config"]["spaces"][0])
    CONFIG_SCHEMA(deepcopy(candidate["target_config"]))


@pytest.mark.parametrize("fault", ["graph", "room", "wall"])
def test_opening_repair_does_not_hide_corrupt_current_graph_projections(tmp_path, fault):
    document = _document(tmp_path)
    _door(document).update(x=.95, y=.95)
    space = document["payload"]["config"]["spaces"][0]
    if fault == "graph":
        space["plan_graph"]["edges"][0]["from"] = "missing"
    elif fault == "room":
        space["rooms"][0]["poly"][0][0] = .1
    else:
        space["wall_segments"][0]["cm"] += 1
    with pytest.raises(ImportFailure) as rejected:
        parse_document(json.dumps(document).encode())
    assert rejected.value.code == "invalid_config"


@pytest.mark.parametrize("parameter", [["2", "4"], ["1", "0"], ["1", "2"], ["1" + "0" * 1000, "1"]])
def test_malformed_or_inconsistent_exact_host_parameter_is_not_silently_repaired(tmp_path, parameter):
    document = _document(tmp_path)
    _door(document).update(x=.95, y=.95)
    _door(document)["host"]["tq"] = parameter
    with pytest.raises(ImportFailure) as rejected:
        parse_document(json.dumps(document).encode())
    assert rejected.value.code == "invalid_config"


@pytest.mark.parametrize("model", [10, 11])
def test_ambiguous_exact_opening_detaches_instead_of_guessing_a_carrier(tmp_path, model):
    graph = {"version": 1, "nodes": [
        {"id": "a", "p": ["l", "48", "48"]}, {"id": "b", "p": ["l", "192", "48"]},
        {"id": "c", "p": ["q", "1", "5", "4001", "20000"]},
        {"id": "d", "p": ["q", "4", "5", "4001", "20000"]},
    ], "edges": [
        {"kind": "wall", "id": "upper", "from": "a", "to": "b", "cm": 15},
        {"kind": "wall", "id": "lower", "from": "c", "to": "d", "cm": 15},
    ], "rooms": [], "dependencies": []}
    # validate_graph requires canonical edge identity order.
    graph["edges"].sort(key=lambda edge: edge["id"])
    space = project_graph_space({"id": "floor", "title": "Floor", "view_box": [0, 0, 1, 1], "rooms": []}, graph)["space"]
    document, _ = create_export(SimpleNamespace(instance_id="source"), {"config": {
        "model_version": 11, "spaces": [space], "markers": [], "settings": {},
    }}, {"layout": {}}, kind="full", space_id=None, card_version="review", config_root=tmp_path)
    document["model_version"] = model
    if model == 10:
        # Legacy10 contour walls require room owners. Keep the raw fixture
        # from #1228 rather than forging an invalid legacy ordinary wall.
        from tests_backend.test_opening_repair_legacy10 import _two_carriers
        legacy, _ = _two_carriers()
        document["payload"]["config"] = legacy
    document["payload"]["config"]["spaces"][0]["openings"] = [{
        "id": "door", "type": "door", "x": .4, "y": .200025, "angle": 0, "length": .08,
        "lock": "lock.front", "host": {"kind": "wall", "id": "gone", "t": .5, "tq": ["1", "2"]},
    }]
    response, candidate, _, _ = _preview(tmp_path, document)
    assert response["preview"]["opening_repairs"]["detached"] == 1
    opening = candidate["target_config"]["spaces"][0]["openings"][0]
    assert "host" not in opening and opening["length"] == .08 and opening["y"] == .200025
    if model == 11:
        assert candidate["target_config"]["spaces"][0]["plan_graph"] == graph


def test_current_partition_opening_off_its_graph_host_is_preserved_detached(tmp_path):
    document = _document(tmp_path)
    # Use a real current wall edge as a partition in an independent graph.
    graph = {"version": 1, "nodes": [
        {"id": "a", "p": ["l", "48", "48"]}, {"id": "b", "p": ["l", "192", "48"]},
    ], "edges": [{"kind": "partition", "id": "part", "from": "a", "to": "b", "cm": 15}],
       "rooms": [], "dependencies": []}
    opening = deepcopy(_door(document))
    opening["host"] = {"kind": "partition", "id": "part", "t": .5, "tq": ["1", "2"]}
    space = project_graph_space({"id": "floor", "title": "Floor", "view_box": [0, 0, 1, 1],
        "rooms": [], "openings": [opening]}, graph)["space"]
    space["openings"][0].update(x=.95, y=.95)
    document["payload"]["config"]["spaces"] = [space]
    response, candidate, _, _ = _preview(tmp_path, document)
    assert response["preview"]["opening_repairs"]["detached"] == 1
    assert "host" not in candidate["target_config"]["spaces"][0]["openings"][0]
    assert candidate["target_config"]["spaces"][0]["plan_graph"] == graph


@pytest.mark.parametrize("model", [10, 11])
async def test_confirmed_full_import_survives_actual_reload_and_undo(hass, tmp_path, model):
    from tests_backend.test_ha_import_export import _setup, _apply, _Connection
    from custom_components.houseplan import websocket_api as wsapi
    from custom_components.houseplan.store import get_data

    entry = await _setup(hass)
    runtime = get_data(hass)
    current = {"model_version": 11, "spaces": [], "markers": [], "settings": {}}
    await runtime.config_store.async_save({"config": current, "rev": 4})
    await runtime.store.async_save({"layout": {}, "rev": 6})
    document = _document(tmp_path, model)
    _door(document).update(x=.95, y=.95)
    before = deepcopy((await runtime.config_store.async_load(), await runtime.store.async_load()))
    response = create_preview(runtime, json.dumps(document).encode(), owner_id="review-owner",
        duplicate_policy="skip", current_config_data=before[0], current_layout_data=before[1],
        config_root=tmp_path)
    assert (await runtime.config_store.async_load(), await runtime.store.async_load()) == before
    refused = await _apply(hass, response, confirm=False)
    assert refused.error and refused.error[0] == "content_confirmation_required"
    assert (await runtime.config_store.async_load(), await runtime.store.async_load()) == before
    applied = await _apply(hass, response, confirm=True)
    assert applied.error is None and applied.result["can_undo"]
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    runtime = get_data(hass)
    saved = await runtime.config_store.async_load()
    opening = saved["config"]["spaces"][0]["openings"][0]
    assert opening["x"] == .95 and opening["y"] == .95 and "host" not in opening
    assert opening["length"] == .08 and opening["lock"] == "lock.front"
    verify_projection(saved["config"]["spaces"][0])
    positions = await runtime.store.async_load()
    undo = _Connection()
    await wsapi.ws_plan_optimize_undo.__wrapped__(hass, undo, {
        "id": 1238, "type": "houseplan/plan/optimize_undo",
        "expected_config_rev": saved["rev"], "expected_layout_rev": positions["rev"],
    })
    assert undo.error is None and undo.result["ok"]
    assert (await runtime.config_store.async_load())["config"] == current
    assert (await runtime.store.async_load())["layout"] == {}
