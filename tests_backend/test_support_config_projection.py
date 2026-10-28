"""Typed additions preserve identity, not private config text (#942)."""

import copy
import json

from custom_components.houseplan.support_config_projection import (
    extend_config_projection,
)
from custom_components.houseplan.support_diagnostic_values import DiagnosticIds
from custom_components.houseplan.support_package import (
    _global_settings,
    _project_marker,
    _project_space,
)


def project(config):
    ids = DiagnosticIds("case")
    result = {
        "settings": _global_settings(config.get("settings")),
        "spaces": [
            _project_space(ids, row, i)
            for i, row in enumerate(config.get("spaces", []), 1)
        ],
        "markers": [_project_marker(ids, row) for row in config.get("markers", [])],
    }
    extend_config_projection(config, result, ids)
    return result, ids


def test_issue1037_caption_and_wall_colors_survive_closed_support_projection():
    from custom_components.houseplan.support_wire_schema import CONFIG, validate
    color = {"c": "#123456", "a": 0, "private": "must disappear"}
    source = {"spaces": [{"id": "s", "title": "Private", "settings": {"name_color": color, "wall_fill": color},
                          "rooms": [{"id": "r", "name": "Private", "settings": {"name_color": color}}]}]}
    result, _ = project(source)
    result["model_version"] = 10
    validate(result, CONFIG)
    space = result["spaces"][0]
    assert space["settings"]["name_color"] == {"c": "#123456", "a": 0}
    assert space["settings"]["wall_fill"] == {"c": "#123456", "a": 0}
    assert space["rooms"][0]["settings"]["name_color"] == {"c": "#123456", "a": 0}


def test_issue_920_co2_source_is_pseudonymized_and_fits_the_closed_wire_schema():
    from custom_components.houseplan.support_wire_schema import CONFIG, validate

    private = "sensor.owner_private_co2"
    config = {
        "model_version": 10,
        "spaces": [{"id": "s", "settings": {"label_co2": True}, "rooms": [
            {"id": "r", "name": "Private room", "settings": {"co2_source": f"entity:{private}"}},
            {"id": "r2", "name": "Other", "settings": {"co2_source": None}},
        ]}],
        "markers": [{"id": "m", "binding": f"entity:{private}", "space": "s"}],
    }
    result, _ids = project(config)
    result["model_version"] = 10
    validate(result, CONFIG)
    assert result["spaces"][0]["settings"]["label_co2"] is True
    settings = result["spaces"][0]["rooms"][0]["settings"]
    assert settings["co2_source"] == result["markers"][0]["binding"]
    assert settings["co2_source_kind"] == "entity"
    assert result["spaces"][0]["rooms"][1]["settings"]["co2_source"] is None
    assert private not in json.dumps(result)


def test_config_minimum_joins_value_route_area_summary_led_and_radar_references():
    config = {
        "settings": {
            "summary_panel": {
                "version": 1,
                "title": "private heading",
                "show_on_mobile": False,
                "blocks": [
                    {
                        "id": "private-block",
                        "title": "private title",
                        "visible": True,
                        "scope": {"type": "space", "space_id": "private-space"},
                        "values": [
                            {
                                "id": "private-value",
                                "label": "private label",
                                "source": {
                                    "type": "entity",
                                    "entity_id": "camera.private",
                                },
                            }
                        ],
                    }
                ],
            }
        },
        "spaces": [
            {
                "id": "private-space",
                "title": "private house",
                "rooms": [
                    {
                        "id": "private-room",
                        "name": "private room name",
                        "area": "private-area",
                        "settings": {
                            "temp_min": None,
                            "temp_max": 24,
                            "temp_source": None,
                        },
                    }
                ],
                "led_strips": [
                    {
                        "id": "private-led",
                        "marker": "private-marker",
                        "active": False,
                        "points": [[0.123456789012, 0], [1, 1]],
                    }
                ],
                "decor": [
                    {
                        "id": "private-decor",
                        "kind": "image",
                        "asset_id": "private-asset",
                        "x": 0.1,
                        "y": 0.2,
                        "w": 0.3,
                        "h": 0.4,
                        "url": "https://private.example/image",
                    }
                ],
            }
        ],
        "markers": [
            {
                "id": "private-marker",
                "binding": "entity:camera.private",
                "area": "private-area",
                "space": "private-space",
                "room_id": "private-room",
                "controls": ["camera.private"],
                "value_source": {
                    "kind": "entity_attribute",
                    "entity_id": "camera.private",
                    "attribute": "private attribute",
                },
                "value_badge": {
                    "enabled": True,
                    "position": "bottom",
                    "source": {
                        "kind": "derived_marker_state",
                        "ref": "marker:private-marker",
                    },
                },
                "vacuum": {
                    "live": None,
                    "trail": False,
                    "source": "camera.private",
                    "calibration": {"0": [1, 0, 0, 1, 0, 0], "": [0, 0, 0, 0, 0, 0]},
                    "map_routes": [
                        {
                            "id": "private-route",
                            "source": "camera.private",
                            "map_id": "0",
                            "space": "private-space",
                            "calibration": [1, 0, 0, 1, 0, 0],
                        }
                    ],
                },
                "radar": {
                    "version": 1,
                    "profile": "cartesian_v1",
                    "enabled": True,
                    "room_id": "private-room",
                    "sources": {
                        "slots": [
                            {
                                "id": "private-slot",
                                "x_entity": "sensor.private_x",
                                "y_entity": "sensor.private_y",
                                "unit": "mm",
                                "x_sign": -1,
                            }
                        ]
                    },
                    "mount": {
                        "installation_id": "private-installation",
                        "x": 0,
                        "y": 0,
                        "heading_deg": 0,
                    },
                    "calibration": {
                        "method": "two_point",
                        "mirror": False,
                        "cell_cm": 100,
                        "refs": [
                            {"plan": {"x": 1, "y": 1}, "local_cm": {"x": 10, "y": 10}}
                        ],
                    },
                    "tracking": "private live history",
                },
            }
        ],
    }
    before = copy.deepcopy(config)
    result, ids = project(config)
    assert config == before
    text = json.dumps(result)
    for forbidden in ("private", "https://", "tracking"):
        assert forbidden not in text
    space, marker = result["spaces"][0], result["markers"][0]
    room = space["rooms"][0]
    assert marker["area"] == room["area"]
    assert room["settings"] == {"temp_min": None, "temp_max": 24, "temp_source": None}
    source = marker["value_source"]
    assert marker["binding"] == "entity:" + source["entity_id"]
    assert source["attribute"] == ids.get("attribute", "private attribute")
    assert source["entity_id"] == marker["vacuum"]["source"] == marker["controls"][0]
    block = result["settings"]["summary_panel"]["blocks"][0]
    assert block["scope"]["space_id"] == space["id"]
    assert block["values"][0]["source"]["entity_id"] == source["entity_id"]
    route = marker["vacuum"]["map_routes"][0]
    assert route["map_id"] == ids.get("map", "0")
    assert marker["vacuum"]["calibration"][ids.get("map", "")] == [0] * 6
    assert marker["vacuum"]["live"] is None and marker["vacuum"]["trail"] is False
    assert marker["radar"]["room_id"] == room["id"]
    assert marker["radar"]["mount"]["installation_id"] == ids.get(
        "installation", "private-installation"
    )
    assert space["led_strips"][0]["marker"] == marker["id"]
    assert space["led_strips"][0]["points"][0] == [0.123456789012, 0]
    assert space["led_strips"][0]["active"] is False
    assert space["decor"][0]["asset_id"] == ids.get("asset", "private-asset")
    assert space["decor"][0]["has_resource"] is True


def test_absent_null_false_empty_routes_and_malformed_matrix_do_not_revive_data():
    marker = {
        "id": "m",
        "binding": "virtual",
        "vacuum": {
            "source": None,
            "live": False,
            "map_routes": [],
            "calibration": {"0": [1, 0, 0, 1, 0, 0]},
        },
    }
    result, ids = project({"markers": [marker]})
    vacuum = result["markers"][0]["vacuum"]
    assert (
        vacuum["map_routes"] == []
        and vacuum["source"] is None
        and vacuum["live"] is False
    )
    marker["vacuum"]["map_routes"] = None
    marker["vacuum"]["calibration"]["0"] = [True, 0, 0, 1, 0, 0]
    result, _ = project({"markers": [marker]})
    assert result["markers"][0]["vacuum"]["map_routes"] is None
    assert result["markers"][0]["vacuum"]["calibration"][ids.get("map", "0")] == {
        "status": "invalid"
    }
    marker["vacuum"] = {}
    result, _ = project({"markers": [marker]})
    assert "map_routes" not in result["markers"][0]["vacuum"]
    assert "source" not in result["markers"][0]["vacuum"]


def test_future_namespaces_are_explicitly_unsupported_not_opaque_serialized():
    config = {
        "settings": {"summary_panel": {"version": 99, "secret": "private"}},
        "markers": [
            {
                "id": "m",
                "binding": "virtual",
                "radar": {"version": 2, "secret": "private"},
            }
        ],
    }
    result, _ = project(config)
    assert result["settings"]["summary_panel"] == {"status": "unsupported_version"}
    assert result["markers"][0]["radar"] == {"status": "unsupported_version"}
    assert "private" not in json.dumps(result)


def test_issue_945_display_settings_fit_the_closed_private_safe_snapshot():
    from custom_components.houseplan.support_wire_schema import CONFIG, validate

    fields = {"card_name_scale": 1.25, "card_label_scale": 0.75}
    for mode in (None, "inherit", "all", "low", "off"):
        settings = {**fields, **({"show_device_battery_mode": mode} if mode is not None else {})}
        result, _ids = project({"spaces": [{"id": "private-floor", "settings": settings}], "markers": []})
        result["model_version"] = 10
        validate(result, CONFIG)
        assert result["spaces"][0]["settings"] == settings
        assert "private-floor" not in json.dumps(result)


def test_external_screens_projection_keeps_only_typed_fields_and_pseudonymizes_space():
    from custom_components.houseplan.support_wire_schema import CONFIG, validate
    source = {"model_version": 10, "spaces": [{"id": "private-home"}], "markers": [], "settings": {
        "external_screens": {"version": 1, "next_id": 2, "private": "secret", "screens": [{
            "id": 1, "space": "private-home", "rotation": 90, "cycle": 30, "idle": 0,
            "summary": "show", "hidden_devices": "local", "controls": False,
            "icon_scale": None, "font_scale": 1.5, "private": "secret",
        }]}}}
    before = copy.deepcopy(source)
    projected, _ = project(source); projected["model_version"] = 10
    validate(projected, CONFIG)
    screens = projected["settings"]["external_screens"]
    assert screens["screens"][0]["space"] == projected["spaces"][0]["id"]
    assert screens["next_id"] == 2 and screens["screens"][0]["controls"] is False
    assert "secret" not in json.dumps(projected) and "private-home" not in json.dumps(projected)
    assert source == before
    source["settings"]["external_screens"] = {"version": 9, "private": "secret"}
    future, _ = project(source)
    assert future["settings"]["external_screens"] == {"status": "unsupported_version"}
