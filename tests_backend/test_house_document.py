"""Whole-house privacy and independent scoped identity expectations."""
import copy
import json
from types import SimpleNamespace

import pytest

from custom_components.houseplan.core.house_document import (
    build_merge,
    export_document,
    parse_document,
)
from custom_components.houseplan.core.import_export import ImportFailure
from custom_components.houseplan.core.import_export import (
    parse_document as old_json_reader,
)


def source():
    spaces = []
    for index in range(3):
        spaces.append({"id": f"floor{index}", "title": "Floor", "view_box": [0, 0, 2, 2],
            "rooms": [{"id": "room", "name": f"Room {index}", "area": "private-ha-area",
                       "poly": [[0, 0], [2, 0], [2, 2], [0, 2]]}],
            "walls": [{"key": "240:0:0", "cm": 30, "a": [0, 0], "b": [2, 0]}],
            "openings": [{"id": "door", "type": "door", "x": .5, "y": 0, "angle": 0, "length": .2,
                          "swing_position": "center", "contact": "binary_sensor.hall"}],
            "stairs": [{"id": "stair", "kind": "straight", "x": .5, "y": .5,
                        "angle": 0, "direction": "forward",
                        "target_space_id": f"floor{(index + 1) % 3}", "length": .3, "width": .2}],
            "decor": [{"id": "label", "kind": "text", "x": .2, "y": .3,
                       "text": "Static {sensor.private} text", "size_cm": 12}],
            "led_strips": [{"id": "strip", "points": [[.1, .1], [.6, .1]], "marker": "secret", "active": True}],
            "settings": {
                "bg_color": "#abcdef", "opening_accent_3d": {"c": "#e08030", "a": .35},
            } if index == 1 else {}})
    return {"spaces": spaces, "markers": [{"id": "secret", "binding": "device:private"}],
            "settings": {"bg_mode": "daynight", "bg_color": "#123456", "north_deg": 45,
                         "sun_rays": True, "moon": False, "volumetric_view": True,
                         "fill_colors": {"wall_fill": {"c": "#334455", "a": .7}}}}


def exported():
    config = source()
    layout = {"secret": {"s": "floor0", "x": .1, "y": .2},
              "rl_room": {"s": "floor1", "x": .3, "y": .4, "k": 1.2}}
    return export_document(SimpleNamespace(instance_id="test-house", integration_version="test"),
        {"config": config, "rev": 7}, {"layout": layout, "rev": 3}, "test")


def test_projection_keeps_every_floor_and_scoped_stairs_without_ha_or_globals():
    document, filename = exported()
    payload = document["payload"]
    assert filename.startswith("houseplan-house-") and filename.endswith(".zip")
    assert document["export_version"] == 4 and document["kind"] == "house"
    assert document["required_api"] == {"house_transfer_api": 1}
    assert payload["config"]["markers"] == [] and payload["config"].get("settings", {}) == {}
    assert [space["id"] for space in payload["config"]["spaces"]] == ["floor0", "floor1", "floor2"]
    for index, space in enumerate(payload["config"]["spaces"]):
        assert space["rooms"][0].get("area") is None
        assert space["openings"][0]["swing_position"] == "center"
        assert "contact" not in space["openings"][0]
        assert space["stairs"][0]["target_space_id"] == f"floor{(index + 1) % 3}"
        assert space["led_strips"][0].get("marker") is None
        assert "sensor.private" not in space["decor"][0]["text"]
        settings = space["settings"]
        assert settings["bg_mode"] == "daynight" and settings["north_deg"] == 45 and settings["sun_rays"] is True
        assert settings["bg_color"] == ("#abcdef" if index == 1 else "#123456")
        assert settings["wall_fill"] == {"c": "#334455", "a": .7}
        if index == 1:
            assert settings["opening_accent_3d"] == {"c": "#e08030", "a": .35}
        else:
            assert "opening_accent_3d" not in settings
    assert payload["layout"] == {"rl_room": {"s": "floor1", "x": .3, "y": .4, "k": 1.2}}
    assert parse_document(json.dumps(document).encode()) == document
    with pytest.raises(ImportFailure):
        old_json_reader(json.dumps(document).encode())


def test_additive_merge_scopes_duplicate_local_ids_and_does_not_repair_target_orphans():
    document, _ = exported()
    target = {"model_version": 11, "spaces": [{"id": "existing", "title": "Floor", "future": "untouched"}],
              "markers": [{"id": "orphan", "binding": "virtual", "room_id": "room", "space": "missing"}],
              "settings": {"moon": True, "private": "untouched"}}
    layout = {"orphan": {"s": "missing", "x": .123456789123, "y": .3}}
    before = copy.deepcopy(target)
    result, positions, detail = build_merge(document, target, layout)
    assert target == before
    assert result["spaces"][:1] == before["spaces"]
    assert result["markers"] == before["markers"] and result["settings"] == before["settings"]
    assert positions["orphan"] == layout["orphan"]
    added = result["spaces"][1:]
    assert [space["title"] for space in added] == ["Floor (2)", "Floor (3)", "Floor (4)"]
    assert len({space["id"] for space in added}) == 3
    assert len({space["rooms"][0]["id"] for space in added}) == 3
    for index, space in enumerate(added):
        assert space["stairs"][0]["target_space_id"] == added[(index + 1) % 3]["id"]
        assert space["openings"][0]["swing_position"] == "center"
        assert space["rooms"][0]["name"] == f"Room {index}"
    room = added[1]["rooms"][0]["id"]
    assert positions["rl_" + room] == {"s": added[1]["id"], "x": .3, "y": .4, "k": 1.2}
    assert detail["warnings"] == []


def test_minting_excludes_target_orphan_destinations_and_layout_only_owners(monkeypatch):
    from custom_components.houseplan.core import house_document

    document, _ = exported()
    config = {"model_version": 11, "spaces": [], "markers": [{"id": "orphan", "binding": "virtual",
        "room_id": "orphan-room", "space": "orphan-floor", "future": {"destination": "unknown-owner"}}], "settings": {}}
    layout = {"rl_layout-only-room": {"s": "orphan-floor", "x": .1, "y": .2}}
    fresh = house_document._fresh

    def checked(namespace, old, used):
        assert {"orphan-room", "orphan-floor", "unknown-owner", "layout-only-room"} <= used
        return fresh(namespace, old, used)

    monkeypatch.setattr(house_document, "_fresh", checked)
    candidate, positions, _ = build_merge(document, config, layout)
    assert candidate["markers"] == config["markers"]
    assert positions["rl_layout-only-room"] == layout["rl_layout-only-room"]


@pytest.mark.parametrize("mutation", [
    lambda document: document.update(export_version=True),
    lambda document: document.update(model_version=True),
    lambda document: document.update(required_api={"house_transfer_api": True}),
    lambda document: document.update(transfer={"plan_only": 1}),
    lambda document: document.update(build={"private_binding": "device:secret"}),
    lambda document: document["payload"]["config"].update(markers=[{"id": "private"}]),
    lambda document: document["payload"]["config"].update(settings={"sun_ray_origin": "outer"}),
    lambda document: document["payload"]["config"]["spaces"][0]["rooms"][0].update(area="private"),
    lambda document: document["payload"]["config"]["spaces"][0]["rooms"].append(copy.deepcopy(document["payload"]["config"]["spaces"][0]["rooms"][0])),
])
def test_house_privacy_and_new_field_types_refuse_injection(mutation):
    document, _ = exported()
    mutation(document)
    with pytest.raises(ImportFailure):
        parse_document(json.dumps(document).encode())
