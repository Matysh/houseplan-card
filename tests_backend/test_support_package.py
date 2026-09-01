"""Privacy and referential-integrity contract of the #43 support package."""
from __future__ import annotations

import base64
import json
from hashlib import sha256

import pytest

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
