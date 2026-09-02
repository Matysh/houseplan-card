"""Privacy and referential-integrity contract of the #43 support package."""
from __future__ import annotations

import base64
import json
from hashlib import sha256

import pytest

from custom_components.houseplan import support_package
from custom_components.houseplan.support_package import (
    SupportPackageError,
    build_support_package,
    validate_frontend_facts,
)


def _facts() -> dict:
    return {
        "browser_family": "chromium",
        "browser_major": 140,
        "language": "ru",
        "coarse_pointer": False,
        "hover_capable": True,
        "registry_access": "full",
        "registry_age_bucket": "fresh",
    }


def _source() -> tuple[dict, dict, list[str]]:
    forbidden = [
        "sentinel-space-id", "Private upstairs", "sentinel-room-id", "Child room",
        "area.private", "device-secret", "sensor.secret_temperature",
        "https://private.example/plan.png", "C:\\Users\\Private\\floor.png",
        "person@example.test", "<b>private note</b>", "unknown-private-value",
        "value-badge-private-sentinel",
    ]
    config = {
        "model_version": 9,
        "unknown_top": "unknown-private-value",
        "settings": {
            "bg_mode": "daynight",
            "known_devices": ["device-secret"],
            "unknown_nested": "unknown-private-value",
        },
        "spaces": [{
            "id": "sentinel-space-id",
            "title": "Private upstairs",
            "plan_url": "https://private.example/plan.png",
            "view_box": [0, 0, 1, 1],
            "rooms": [{
                "id": "sentinel-room-id",
                "name": "Child room",
                "area": "area.private",
                "poly": [[0, 0], [1, 0], [1, 1], [0, 1]],
                "wall_ids": ["w1", "w2", "w3", "w4"],
                "settings": {"temp_source": "entity:sensor.secret_temperature"},
            }],
            "wall_segments": [
                {"id": "w1", "a": [0, 0], "b": [1, 0], "cm": 10},
                {"id": "w2", "a": [1, 0], "b": [1, 1], "cm": 10},
                {"id": "w3", "a": [1, 1], "b": [0, 1], "cm": 10},
                {"id": "w4", "a": [0, 1], "b": [0, 0], "cm": 10},
            ],
            "openings": [{
                "id": "opening-secret", "type": "door", "x": 0.5, "y": 0,
                "angle": 0, "length": 0.2,
                "contact": "binary_sensor.private_door",
                "host": {"kind": "wall", "id": "w1", "t": 0.5},
            }],
            "decor": [{
                "id": "decor-secret", "kind": "text", "x": 0.4, "y": 0.4,
                "text": "<b>private note</b>", "entity": "sensor.secret_temperature",
                "attr": "person@example.test", "unknown": "unknown-private-value",
            }],
        }],
        "markers": [{
            "id": "marker-secret", "binding": "device:device-secret",
            "space": "sentinel-space-id", "room_id": "sentinel-room-id",
            "area": "area.private", "name": "Private washer", "model": "Secret model",
            "link": "https://private.example/device", "description": "private note",
            "pdfs": [{"name": "manual", "url": "C:\\Users\\Private\\floor.png"}],
            "controls": ["sensor.secret_temperature"],
            "value_badge": {
                "enabled": {"private": "value-badge-private-sentinel"},
                "position": ["value-badge-private-sentinel"],
                "source": {"kind": "private", "payload": "value-badge-private-sentinel"},
                "future": {"private": "value-badge-private-sentinel"},
            },
            "unknown": "unknown-private-value",
        }],
    }
    layout = {
        "marker-secret": {"s": "sentinel-space-id", "x": 0.25, "y": 0.75},
        "rl_sentinel-room-id": {"s": "sentinel-space-id", "x": 0.5, "y": 0.5, "k": 1.2},
        "device-secret": {"s": "sentinel-space-id", "x": 0.1, "y": 0.2},
    }
    return config, layout, forbidden


def _build(namespace: str = "test"):
    config, layout, forbidden = _source()
    raw, summary = build_support_package(
        config,
        layout,
        config_rev=17,
        layout_rev=24,
        card_version="1.70.0-beta.2",
        integration_version="1.70.0-beta.2",
        home_assistant_version="2026.8.0",
        runtime=_facts(),
        repairs=[{"code": "broken_plan", "count": 1}],
        namespace=namespace,
    )
    return raw, summary, forbidden


def test_package_is_canonical_and_preview_hash_describes_exact_bytes():
    first, summary, _ = _build()
    second, _, _ = _build()
    assert first == second
    assert first.endswith(b"\n")
    assert summary["size"] == len(first)
    assert summary["sha256"] == sha256(first).hexdigest()
    assert json.dumps(json.loads(first), ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n" == first.decode()


def test_privacy_projection_never_contains_raw_or_encoded_forbidden_values():
    raw, _, forbidden = _build()
    text = raw.decode()
    for value in forbidden:
        assert value not in text
        assert json.dumps(value, ensure_ascii=False)[1:-1] not in text
        assert base64.b64encode(value.encode()).decode() not in text


def test_geometry_and_references_survive_with_package_local_pseudonyms():
    raw, _, _ = _build()
    package = json.loads(raw)
    space = package["plan_backup"]["config"]["spaces"][0]
    room = space["rooms"][0]
    marker = package["plan_backup"]["config"]["markers"][0]
    assert space["id"] == "space-test-1"
    assert space["title"] == "Space 1"
    assert room["id"] == "room-test-1"
    assert room["name"] == "Room 1"
    assert room["poly"] == [[0, 0], [1, 0], [1, 1], [0, 1]]
    assert room["wall_ids"] == ["wall-test-1", "wall-test-2", "wall-test-3", "wall-test-4"]
    assert space["openings"][0]["host"]["id"] == room["wall_ids"][0]
    assert marker["space"] == space["id"]
    assert marker["room_id"] == room["id"]
    assert marker["binding"] == "device:device-test-1"
    assert set(package["plan_backup"]["layout"]) == {"marker-test-1", "rl_room-test-1"}
    assert space["decor"][0]["text"] == "[redacted text]"
    assert package["summary"]["decor"] == {"text": 1}
    assert package["summary"]["markers"] == {
        "total": 1,
        "lifecycle": {"active": 1},
        "binding": {"device": 1},
    }


def test_each_preview_uses_a_new_namespace_and_cannot_be_correlated():
    first, _, _ = _build("one1")
    second, _, _ = _build("two2")
    assert first != second
    assert "space-one1-1" in first.decode()
    assert "space-two2-1" in second.decode()


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("browser_family", "netscape"),
        ("browser_major", -1),
        ("language", "es"),
        ("coarse_pointer", "false"),
        ("registry_access", "raw"),
        ("registry_age_bucket", "yesterday"),
    ],
)
def test_frontend_facts_fail_closed(key, value):
    facts = _facts()
    facts[key] = value
    with pytest.raises(SupportPackageError, match="support_rejected"):
        validate_frontend_facts(facts)


def test_frontend_facts_reject_non_mapping_and_invalid_hover():
    with pytest.raises(SupportPackageError, match="support_rejected"):
        validate_frontend_facts(None)
    facts = _facts()
    facts["hover_capable"] = 1
    with pytest.raises(SupportPackageError, match="support_rejected"):
        validate_frontend_facts(facts)


def test_rich_plan_projection_preserves_safe_structure_and_drops_unknown_values():
    config = {
        "model_version": 9,
        "settings": {
            "north_deg": 30,
            "fill_colors": {"warm": {"c": "#ffaa00", "a": 0.5, "secret": "drop"}},
            "decor_default_style": {
                "color": "#123456", "width_cm": 2, "secret": "drop",
            },
        },
        "spaces": [{
            "id": "floor",
            "settings": {"show_names": True, "custom_fill": {"c": "#ffffff", "a": 0.4}},
            "rooms": [{
                "id": "kitchen", "x": 1, "y": 2, "w": 3, "h": 4,
                "poly": [[0, 0], [2, 0], [False, 1], "bad"],
                "wall_ids": ["wall-a"], "open_to": ["hall"],
                "settings": {
                    "fill_mode": "custom", "custom_fill": {"c": "#000000", "a": 0.2},
                    "temp_source": "entity:sensor.temperature",
                    "hum_source": "invalid-source",
                },
            }],
            "walls": [
                {"key": "wall-a", "cm": 10, "a": [0, 0], "b": [2, 0]},
                {"key": "wall-b", "cm": 12},
                "bad",
            ],
            "room_drafts": [
                "bad",
                {
                    "id": "draft-a", "points": [[0, 0], [1, 0], [True, 2]],
                    "segments": [{"id": "wall-a", "cm": 10}, {"cm": 12}, "bad"],
                },
            ],
            "partitions": [{"id": "partition-a", "a": [0, 1], "b": [2, 1], "cm": 8}],
            "wall_columns": [{
                "id": "column-a", "shape": "rect", "center": [1, 1], "cm": 20, "angle": 0,
            }],
            "openings": [
                "bad",
                {
                    "id": "door-a", "type": "door", "x": 1, "y": 1, "length": 0.9,
                    "contact": "binary_sensor.door", "lock": "lock.door",
                    "host": {"kind": "partition", "id": "partition-a", "t": 0.5},
                },
                {"id": "window-a", "type": "window", "host": {"kind": "column", "id": "x"}},
            ],
            "decor": [
                {"id": "line-a", "kind": "line", "x1": 0, "y1": 0, "x2": 1, "y2": 1},
                {"id": "text-a", "kind": "text", "text": "private"},
            ],
            "open_spans": [{"a": [0, 0], "b": [0, 1]}, "bad"],
        }],
        "markers": [
            {
                "id": "virtual-a", "binding": "virtual", "icon": "mdi:lightbulb",
                "space": "floor", "room_id": "kitchen", "hidden": True,
                "light_entity": "light.ceiling", "toggle_entity": "switch.ceiling",
                "tap_target": "button.scene", "controls": ["sensor.temperature"],
                "vacuum": {"live": True, "trail": True, "trail_mode": "line", "secret": "drop"},
                "value_source": {"kind": "entity_state", "entity_id": "sensor.temperature"},
                "value_badge": {
                    "enabled": True, "position": "bottom",
                    "source": {"kind": "derived_lqi"},
                },
            },
            {
                "id": "entity-a", "binding": "entity:sensor.temperature", "removed": True,
                "value_source": {"kind": "derived_marker_state", "ref": "marker:virtual-a"},
            },
            {
                "id": "unknown-a", "binding": "secret", "icon": "custom:private",
                "value_source": {"kind": "private", "entity_id": "sensor.private"},
            },
        ],
    }
    layout = {
        "virtual-a": {"s": "floor", "x": 0.25, "y": 0.75},
        "rl_kitchen": {"s": "floor", "x": 0.5, "y": 0.5, "k": 1.1},
        7: {"x": 0},
        "unknown-device": "bad",
    }

    raw, _ = build_support_package(
        config, layout, config_rev=1, layout_rev=2,
        card_version="invalid version!", integration_version="1.0.0",
        home_assistant_version="2026.8.0", runtime=_facts(), namespace="rich",
    )
    package = json.loads(raw)
    plan = package["plan_backup"]["config"]
    space = plan["spaces"][0]

    assert package["versions"]["card"] == "unknown"
    assert plan["settings"]["fill_colors"] == {"warm": {"a": 0.5, "c": "#ffaa00"}}
    assert plan["settings"]["decor_default_style"] == {"color": "#123456", "width_cm": 2}
    assert space["rooms"][0]["poly"] == [[0, 0], [2, 0]]
    assert space["rooms"][0]["settings"]["temp_source_kind"] == "entity"
    assert space["rooms"][0]["settings"]["hum_source_kind"] == "unknown"
    assert len(space["walls"]) == 2
    assert space["walls"][1] == {"cm": 12, "key": "wall-rich-2"}
    assert space["room_drafts"][0]["segments"][1] == {"cm": 12}
    assert space["openings"][0]["host"]["kind"] == "partition"
    assert "host" not in space["openings"][1]
    assert space["decor"][1]["text"] == "[redacted text]"

    virtual, entity, unknown = plan["markers"]
    assert virtual["binding_kind"] == "virtual"
    assert virtual["icon"] == "mdi:lightbulb"
    assert virtual["vacuum"] == {"live": True, "trail": True, "trail_mode": "line"}
    assert virtual["value_source"] == {
        "entity_id": "entity-rich-1", "kind": "entity_state",
    }
    assert virtual["value_badge"] == {
        "enabled": True, "position": "bottom", "source": {"kind": "derived_lqi"},
    }
    assert entity["value_source"] == {
        "kind": "derived_marker_state", "ref": "marker:marker-rich-1",
    }
    assert unknown["binding_kind"] == "unknown"
    assert "icon" not in unknown and "value_source" not in unknown
    assert set(package["plan_backup"]["layout"]) == {"marker-rich-1", "rl_room-rich-1"}
    assert package["summary"]["markers"] == {
        "total": 3,
        "lifecycle": {"active": 1, "hidden": 1, "removed": 1},
        "binding": {"entity": 1, "unknown": 1, "virtual": 1},
    }


def test_projection_helpers_fail_closed_on_malformed_shapes():
    ids = support_package._Pseudonyms("edge")
    assert ids.get("room", None) is None
    assert ids.get("room", "") is None
    assert ids.get("room", "same") == ids.get("room", "same")
    assert support_package._point(None) is None
    assert support_package._point([True, 1]) is None
    assert support_package._points(None) == []
    assert support_package._custom_fill(None) is None
    assert support_package._global_settings(None) == {}
    assert support_package._room_settings(ids, None) == {}
    assert support_package._project_layout(ids, None) == {}
    assert support_package._summary(None, None)["spaces"] == 0
    assert support_package._binding_kind(None) == "unknown"


@pytest.mark.parametrize(
    ("enabled", "position", "expected"),
    [
        ({"private": "sentinel"}, "right", {"position": "right"}),
        (True, {"private": "sentinel"}, {"enabled": True}),
        ([], "sideways", None),
        ("true", ["bottom"], None),
    ],
)
def test_value_badge_projection_drops_malformed_scalar_fields(
    enabled, position, expected,
):
    projected = support_package._project_marker(
        support_package._Pseudonyms("badge"),
        {
            "id": "marker",
            "binding": "virtual",
            "value_badge": {"enabled": enabled, "position": position},
        },
    )
    assert projected.get("value_badge") == expected
    assert "sentinel" not in json.dumps(projected)


def test_value_badge_projection_omits_empty_result():
    projected = support_package._project_marker(
        support_package._Pseudonyms("badge"),
        {
            "id": "marker",
            "binding": "virtual",
            "value_badge": {
                "enabled": [], "position": {}, "source": {"kind": "private"},
            },
        },
    )
    assert "value_badge" not in projected


def test_package_size_limit_is_enforced_after_projection(monkeypatch):
    monkeypatch.setattr(support_package, "MAX_SUPPORT_ATTACHMENT_BYTES", 1)
    with pytest.raises(SupportPackageError, match="support_package_too_large"):
        _build()
