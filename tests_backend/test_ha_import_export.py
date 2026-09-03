"""Portable backup and authenticated endpoint contract tests (#50).

The file intentionally carries the ``test_ha_`` prefix: importing the custom
component executes its Home Assistant package initializer even when an
individual test exercises an otherwise pure helper.
"""
from __future__ import annotations

import asyncio
import copy
import hashlib
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
    canonical_import_root,
    create_export,
    create_preview,
    get_candidate,
    parse_document,
    prepare_apply,
    revalidate_candidate,
)
from custom_components.houseplan import import_export as import_export_api
from custom_components.houseplan import websocket_api as wsapi
from custom_components.houseplan.http_api import HouseplanImportPreviewView, KEY_HASS
from custom_components.houseplan.const import (
    DEFAULT_CONFIG,
    DOMAIN,
    MAX_IMPORT_PREVIEWS_PER_USER,
    MAX_IMPORT_PREVIEWS_TOTAL,
    PLAN_MODEL_VERSION,
    FILES_DIR, PLANS_DIR,
    CONTENT_URL, FILES_URL, PLANS_URL,
)
from custom_components.houseplan.store import (
    async_save_layout_state,
    get_data,
    layout_store_payload,
    migrate_config_background_mode,
)
from custom_components.houseplan.validation import MAX_LAYOUT, MAX_MARKERS
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model


def test_issue_51_missing_decor_asset_stays_as_repairable_geometry(tmp_path: Path) -> None:
    data = b"one custom image"
    aid = hashlib.sha256(data).hexdigest()
    source = tmp_path / "source"
    target = tmp_path / "target"
    assets = source / "houseplan" / "assets"
    assets.mkdir(parents=True)
    (assets / f"{aid}.png").write_bytes(data)
    (assets / f"{aid}.json").write_text(json.dumps({
        "asset_id": aid, "name": "picture.png", "mime": "image/png",
        "ext": ".png", "width": 10, "height": 20, "bytes": len(data),
    }), encoding="utf-8")
    shape = {
        "id": "picture", "kind": "image", "asset_id": aid,
        "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4,
    }
    config = {"spaces": [{"id": "one", "decor": [shape]}]}
    manifest = import_export_api.content_manifest(config, source)
    assert manifest[0]["exists_at_export"] is True
    assert "bytes" not in manifest[0]
    document = {"payload": {"config": config}, "content_manifest": manifest}
    rows, confirmation = import_export_api._content_state(document, False, target)
    assert confirmation is True
    assert rows[0]["state"] == "missing_preserved"
    import_export_api._detach_missing(config, rows)
    assert config["spaces"][0]["decor"][0] == shape


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the HA harness."""
    yield


def _config() -> dict:
    legacy = {
        "model_version": PLAN_MODEL_VERSION - 1,
        "spaces": [{
            "id": "ground", "title": "Ground", "view_box": [0, 0, 1, 1],
            "rooms": [{"id": "living", "name": "Living", "poly": [[0, 0], [1, 0], [1, 1]]}],
            "plan_url": None,
        }],
        "markers": [{
            "id": "lamp", "binding": "entity:light.living", "space": "ground",
            "room_id": "living", "controls": ["switch.wall"],
        }],
        "settings": {
            "bg_mode": "static",
            "known_devices": ["old-device"],
            "new_device_ids": ["new-device"],
        },
    }
    return commit_wall_segment_model(legacy)[0]


def _config_with_decor_image(asset_id: str) -> tuple[dict, dict]:
    config = _config()
    shape = {
        "id": "custom-picture", "kind": "image", "asset_id": asset_id,
        "x": 0.12, "y": 0.23, "w": 0.34, "h": 0.45,
        "angle": 12.5, "opacity": 0.6, "flip_h": True, "flip_v": False,
    }
    config["spaces"][0]["decor"] = [shape]
    return config, shape


def _missing_decor_export(
    source: Path, *, kind: str = "full", plan_only: bool = False,
    asset_id: str = "a" * 64,
) -> tuple[dict, dict]:
    config, shape = _config_with_decor_image(asset_id)
    document, _filename = create_export(
        SimpleNamespace(instance_id="source-instance"),
        {"config": config, "rev": 2},
        {"layout": {}, "rev": 3},
        kind=kind,
        space_id="ground" if kind == "space" else None,
        plan_only=plan_only,
        card_version="review",
        config_root=source,
    )
    return document, shape


@pytest.mark.parametrize(
    ("kind", "plan_only"),
    [("full", False), ("space", False), ("space", True)],
    ids=["full", "space", "plan-only"],
)
def test_issue_428_missing_decor_asset_round_trips_in_every_export_mode(
    tmp_path: Path, kind: str, plan_only: bool,
) -> None:
    document, shape = _missing_decor_export(
        tmp_path / "source", kind=kind, plan_only=plan_only,
    )
    assert document["content_manifest"] == [{
        "kind": "decor_asset",
        "owner": "decor",
        "owner_id": "ground:custom-picture",
        "field": "asset_id",
        "url": shape["asset_id"],
        "asset_id": shape["asset_id"],
        "storage": "internal",
        "mime": None,
        "hash": shape["asset_id"],
        "exists_at_export": False,
    }]

    runtime = SimpleNamespace(instance_id="target-instance", import_previews={})
    response = create_preview(
        runtime,
        json.dumps(document).encode(),
        owner_id="alice",
        duplicate_policy="skip",
        current_config_data={"config": {"spaces": [], "markers": []}, "rev": 0},
        current_layout_data={"layout": {}, "rev": 0},
        config_root=tmp_path / "target",
    )
    assert response["preview"]["confirmation_required"] is True
    assert response["preview"]["content"][0]["state"] == "missing_preserved"
    candidate = get_candidate(runtime, response["token"], "alice")
    with pytest.raises(ImportFailure) as unconfirmed:
        prepare_apply(
            candidate, {"spaces": [], "markers": []}, {},
            confirm_missing_content=False,
        )
    assert unconfirmed.value.code == "content_confirmation_required"

    imported, _layout, _details = prepare_apply(
        candidate, {"spaces": [], "markers": []}, {},
        confirm_missing_content=True,
    )
    imported_images = [
        item
        for space in imported["spaces"]
        for item in space.get("decor") or []
        if item.get("kind") == "image"
    ]
    assert imported_images == [shape]


@pytest.mark.parametrize(
    ("mime", "omit_mime"),
    [(None, False), (None, True), ("image/png", False)],
    ids=["null", "omitted", "supported"],
)
def test_issue_428_explicitly_missing_asset_accepts_bounded_mime(
    tmp_path: Path, mime: str | None, omit_mime: bool,
) -> None:
    document, _shape = _missing_decor_export(tmp_path / "source")
    if omit_mime:
        document["content_manifest"][0].pop("mime")
    else:
        document["content_manifest"][0]["mime"] = mime
    rows, confirmation = import_export_api._content_state(
        document, False, tmp_path / "target",
    )
    assert rows[0]["mime"] == mime
    assert rows[0]["state"] == "missing_preserved"
    assert confirmation is True


@pytest.mark.parametrize(
    ("exists_at_export", "mime", "remove_exists"),
    [
        (True, None, False),
        (False, "", False),
        (False, "text/plain", False),
        (False, 0, False),
        (False, [], False),
        (False, {}, False),
        (None, "image/png", True),
        (None, "image/png", False),
        (0, "image/png", False),
        (1, "image/png", False),
        ("false", "image/png", False),
        ([], "image/png", False),
        ({}, "image/png", False),
    ],
    ids=[
        "present-null-mime", "empty-mime", "unsupported-mime", "numeric-mime",
        "list-mime", "object-mime", "missing-flag", "null-flag", "zero-flag",
        "one-flag", "string-flag", "list-flag", "object-flag",
    ],
)
def test_issue_428_missing_mime_exception_remains_fail_closed(
    tmp_path: Path, exists_at_export: Any, mime: Any, remove_exists: bool,
) -> None:
    document, _shape = _missing_decor_export(tmp_path / "source")
    row = document["content_manifest"][0]
    row["exists_at_export"] = exists_at_export
    row["mime"] = mime
    if remove_exists:
        row.pop("exists_at_export")
    with pytest.raises(ImportFailure) as invalid:
        import_export_api._content_state(document, False, tmp_path / "target")
    assert invalid.value.code == "invalid_content"


@pytest.mark.parametrize("field", ["asset_id", "hash"])
def test_issue_428_missing_asset_keeps_hash_identity_strict(
    tmp_path: Path, field: str,
) -> None:
    document, _shape = _missing_decor_export(tmp_path / "source")
    document["content_manifest"][0][field] = "b" * 64
    with pytest.raises(ImportFailure) as invalid:
        import_export_api._content_state(document, False, tmp_path / "target")
    assert invalid.value.code == "invalid_content"


def test_issue_428_missing_source_reuses_only_exact_target_blob(tmp_path: Path) -> None:
    data = b"target already has the canonical custom image"
    asset_id = hashlib.sha256(data).hexdigest()
    document, _shape = _missing_decor_export(
        tmp_path / "source", asset_id=asset_id,
    )
    target_assets = tmp_path / "target" / "houseplan" / "assets"
    target_assets.mkdir(parents=True)
    blob = target_assets / f"{asset_id}.png"
    blob.write_bytes(data)

    rows, confirmation = import_export_api._content_state(
        document, False, tmp_path / "target",
    )
    assert rows[0]["mime"] is None
    assert rows[0]["exists_at_export"] is False
    assert rows[0]["exists_on_target"] is True
    assert rows[0]["state"] == "available"
    assert confirmation is False

    blob.write_bytes(b"different bytes")
    rows, confirmation = import_export_api._content_state(
        document, False, tmp_path / "target",
    )
    assert rows[0]["exists_on_target"] is False
    assert rows[0]["state"] == "missing_preserved"
    assert confirmation is True


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


def _downgrade_document_to_v7(document: dict) -> dict:
    """Turn a current export into the exact accepted pre-v8 carrier."""
    document["model_version"] = 7
    for space in document["payload"]["config"].get("spaces") or []:
        space.pop("wall_segments", None)
        for room in space.get("rooms") or []:
            room.pop("wall_ids", None)
        for opening in space.get("openings") or []:
            if (opening.get("host") or {}).get("kind") == "wall":
                opening.pop("host", None)
        for draft in space.get("room_drafts") or []:
            for segment in draft.get("segments") or []:
                segment.pop("id", None)
        # The import tests below place a passage on the top room edge. In v9
        # an omitted thickness is a real zero wall and therefore cannot host
        # an opening; keep this legacy carrier explicitly physical instead of
        # relying on the pre-v9 ambiguity of a missing `walls` entry.
        space["walls"] = [{
            "key": "0.500000,0.000000@0.0000",
            "a": [0, 0], "b": [1, 0], "cm": 15,
        }]
    return document


def test_issue_265_python_lineage_matches_shared_fixture() -> None:
    fixture = json.loads(
        (Path(__file__).parents[1] / "test" / "fixtures" / "import-id-lineage.json").read_text()
    )
    for item in fixture["cases"]:
        root, layers, bounded = canonical_import_root(item["prefix"], item["value"])
        assert root == item["root"]
        assert layers == item["layers"]
        assert bounded is item["bounded"]
    for item in fixture["generated"]:
        value = item["seed"]
        for _index in range(item["wraps"]):
            value = f"{item['prefix']}_{value}_deadbeef"
        root, layers, bounded = canonical_import_root(item["prefix"], value)
        assert root == item["root"]
        assert layers == item["layers"]
        assert bounded is item["bounded"]


def test_import_document_canonicalizes_external_coordinates(tmp_path: Path) -> None:
    document = _document(tmp_path)
    space = document["payload"]["config"]["spaces"][0]
    room = space["rooms"][0]
    room["poly"][0][0] = 0.1234567896
    # A v8 external document is one structural transaction: compatibility
    # geometry must accompany the edited room projection. Stable IDs do not
    # change merely because their carrier moved.
    by_id = {segment["id"]: segment for segment in space["wall_segments"]}
    for index, segment_id in enumerate(room["wall_ids"]):
        by_id[segment_id]["a"] = room["poly"][index]
        by_id[segment_id]["b"] = room["poly"][(index + 1) % len(room["poly"])]
    document["payload"]["layout"]["lamp"]["x"] = -0.1234567896

    parsed = parse_document(json.dumps(document).encode("utf-8"))

    assert parsed["payload"]["config"]["spaces"][0]["rooms"][0]["poly"][0][0] == 0.12345679
    assert parsed["payload"]["layout"]["lamp"]["x"] == -0.12345679


# --- issue #225: an attachment url carries a cache-buster ---------------------
#
# Legacy references look like "/houseplan_files/files/m1/doc.pdf?v=1783170649".
# The resolver used to compare the raw tail with its sanitized form, so the
# query made the name differ from itself: the reference read as internal (by
# prefix) yet non-canonical (by name), and _content_state refused the whole
# document. Every backup holding one attachment was impossible to import back.


@pytest.mark.parametrize("url, expected_tail", [
    (f"{FILES_URL}/m1/doc.pdf?v=1783170649", ("m1", "doc.pdf")),
    (f"{CONTENT_URL}/files/m1/doc.pdf?v=1783170649", ("m1", "doc.pdf")),
    (f"{FILES_URL}/m1/doc.pdf#page=2", ("m1", "doc.pdf")),
    (f"{FILES_URL}/m1/doc.pdf?v=1#page=2", ("m1", "doc.pdf")),
    (f"{FILES_URL}/m1/doc.pdf", ("m1", "doc.pdf")),
])
def test_issue_225_attachment_url_resolves_regardless_of_query(
    tmp_path: Path, url: str, expected_tail: tuple[str, str],
) -> None:
    """AC1: query and fragment address the transfer, never the file."""
    resolved = import_export_api._internal_path(tmp_path, url)
    assert resolved is not None, url
    kind, path = resolved
    assert kind == "attachment"
    assert path == tmp_path / FILES_DIR / expected_tail[0] / expected_tail[1]


@pytest.mark.parametrize("url", [
    f"{PLANS_URL}/f1.svg?v=1",
    f"{CONTENT_URL}/plans/_/f1.svg?v=1#page=2",
    f"{PLANS_URL}/f1.svg",
])
def test_issue_225_plan_url_resolves_regardless_of_query(tmp_path: Path, url: str) -> None:
    """AC1: the plan branch of the same resolver behaves identically."""
    resolved = import_export_api._internal_path(tmp_path, url)
    assert resolved == ("plan", tmp_path / PLANS_DIR / "f1.svg")


@pytest.mark.parametrize("url", [
    f"{FILES_URL}/../../secret.pdf?v=1",
    f"{FILES_URL}/m1/../../secret.pdf",
    f"{CONTENT_URL}/plans/_/../x.svg?v=1",
    f"{PLANS_URL}/../x.svg",
])
def test_issue_225_traversal_stays_closed_with_a_query(tmp_path: Path, url: str) -> None:
    """AC4: dropping the query must not widen what a path segment may be."""
    assert import_export_api._internal_path(tmp_path, url) is None


@pytest.mark.parametrize("url", [
    f"{FILES_URL}/m1/doc.pdf?x=/../../etc",
    f"{FILES_URL}/m1/doc.pdf#/../..",
])
def test_issue_225_hostile_looking_query_does_not_reject_a_valid_path(
    tmp_path: Path, url: str,
) -> None:
    """AC4a: the guard is the path split, not string filtering.

    A query may contain anything at all — slashes and dot-dots included — and
    still address the very same file. Rejecting on the sight of ".." would fail
    a legitimate reference while adding no protection: the path segments are
    what the resolver validates.
    """
    assert import_export_api._internal_path(tmp_path, url) == (
        "attachment", tmp_path / FILES_DIR / "m1" / "doc.pdf",
    )


def test_issue_225_external_url_is_still_external(tmp_path: Path) -> None:
    """AC5: nothing outside the internal namespaces became internal."""
    assert import_export_api._internal_path(
        tmp_path, "https://example.invalid/floor.svg?v=1",
    ) is None
    assert import_export_api._looks_internal("https://example.invalid/floor.svg?v=1") is False


@pytest.mark.parametrize("url", [
    f"https://evil.example{FILES_URL}/m1/doc.pdf",
    f"https://evil.example{CONTENT_URL}/files/m1/doc.pdf?v=1",
    f"//evil.example{FILES_URL}/m1/doc.pdf",
    f"https://evil.example{PLANS_URL}/f1.svg",
])
def test_issue_225_absolute_url_never_resolves_onto_a_local_file(
    tmp_path: Path, url: str,
) -> None:
    """AC5: only a same-document reference may be resolved by its path.

    A scheme or an authority means the path belongs to another host. Taking it
    would let a crafted document describe an outside link as a local file —
    the same inconsistency the resolver is meant to prevent, mirrored
    (review CODE-REVIEW-225-r1, M1).
    """
    assert import_export_api._internal_path(tmp_path, url) is None
    assert import_export_api._looks_internal(url) is False


@pytest.mark.parametrize("same_source, expected_state, expected_confirmation", [
    (True, "available", False),
    (False, "detach_required", True),
])
def test_issue_225_content_state_accepts_a_cache_busted_attachment(
    tmp_path: Path, same_source: bool, expected_state: str, expected_confirmation: bool,
) -> None:
    """AC2: both branches of the ownership question, neither an outright refusal."""
    url = f"{FILES_URL}/lamp/manual.pdf?v=1783170649"
    attachment = tmp_path / FILES_DIR / "lamp" / "manual.pdf"
    attachment.parent.mkdir(parents=True, exist_ok=True)
    attachment.write_bytes(b"%PDF-1.4\n")
    config = _config()
    config["markers"][0]["pdfs"] = [{"name": "Manual", "url": url}]
    runtime = SimpleNamespace(instance_id="instance-a")
    document, _ = create_export(
        runtime, {"config": config}, {"layout": {}}, kind="full", space_id=None,
        card_version="1.61.0", config_root=tmp_path,
    )
    rows, confirmation = import_export_api._content_state(document, same_source, tmp_path)
    assert [row["state"] for row in rows] == [expected_state]
    assert confirmation is expected_confirmation
    assert rows[0]["url"] == url, "the stored reference is preserved, cache-buster included"


def test_issue_225_backup_with_an_attachment_survives_a_full_round_trip(
    tmp_path: Path,
) -> None:
    """AC3: export then import the same document back, no manual edits."""
    url = f"{FILES_URL}/lamp/manual.pdf?v=1783170649"
    attachment = tmp_path / FILES_DIR / "lamp" / "manual.pdf"
    attachment.parent.mkdir(parents=True, exist_ok=True)
    attachment.write_bytes(b"%PDF-1.4\n")
    config = _config()
    config["markers"][0]["pdfs"] = [{"name": "Manual", "url": url}]
    runtime = SimpleNamespace(instance_id="instance-a")
    document, _ = create_export(
        runtime, {"config": config}, {"layout": {}}, kind="full", space_id=None,
        card_version="1.61.0", config_root=tmp_path,
    )
    response = create_preview(
        SimpleNamespace(instance_id="instance-a", import_previews={}),
        json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": _config(), "rev": 1},
        current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
    )
    content = response["preview"]["content"]
    assert [row["state"] for row in content] == ["available"]
    assert response["preview"]["confirmation_required"] is False


def test_background_defaults_and_store_migration_preserve_legacy_view() -> None:
    assert DEFAULT_CONFIG["settings"]["bg_mode"] == "daynight"

    legacy = {
        "config": {
            "spaces": [{
                "id": "ground",
                "settings": {"bg_mode": "daynight", "future_space": 1},
            }],
            "markers": [],
            "settings": {"future_global": {"kept": True}},
            "future_root": "kept",
        },
        "rev": 17,
        "future_store": [1, 2],
    }
    migrated = migrate_config_background_mode(legacy)
    assert migrated["config"]["settings"] == {
        "future_global": {"kept": True}, "bg_mode": "static",
    }
    assert migrated["config"]["spaces"][0]["settings"] == {
        "bg_mode": "daynight", "future_space": 1,
    }
    assert migrated["rev"] == 17 and migrated["future_store"] == [1, 2]
    assert "bg_mode" not in legacy["config"]["settings"]
    assert migrate_config_background_mode(migrated) is migrated

    layout = {"layout": {}, "rev": 4}
    assert migrate_config_background_mode(layout) is layout


def test_background_mode_is_materialized_across_export_and_legacy_import(tmp_path: Path) -> None:
    runtime = SimpleNamespace(instance_id="instance-a")
    inherited = _config()
    inherited["settings"]["bg_mode"] = "daynight"
    inherited["spaces"][0].setdefault("settings", {}).pop("bg_mode", None)

    space_document, _ = create_export(
        runtime, {"config": inherited}, {"layout": {}},
        kind="space", space_id="ground", card_version="1.64.0", config_root=tmp_path,
    )
    exported_space = space_document["payload"]["config"]["spaces"][0]
    assert exported_space["settings"]["bg_mode"] == "daynight"

    full_document, _ = create_export(
        runtime, {"config": {**_config(), "settings": {}}}, {"layout": {}},
        kind="full", space_id=None, card_version="1.64.0", config_root=tmp_path,
    )
    assert full_document["payload"]["config"]["settings"]["bg_mode"] == "static"

    full_document["payload"]["config"]["settings"].pop("bg_mode")
    parsed_full = parse_document(json.dumps(full_document).encode())
    assert parsed_full["payload"]["config"]["settings"]["bg_mode"] == "static"

    space_document["payload"]["config"]["spaces"][0]["settings"].pop("bg_mode")
    parsed_space = parse_document(json.dumps(space_document).encode())
    assert parsed_space["payload"]["config"]["spaces"][0]["settings"]["bg_mode"] == "static"
    target = _config()
    target["settings"]["bg_mode"] = "daynight"
    merged, _layout, _details = build_space_merge(parsed_space, target, {}, "skip")
    assert merged["spaces"][-1]["settings"]["bg_mode"] == "static"


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


@pytest.mark.parametrize("kind", ["full", "space"])
def test_invalid_passage_import_is_rejected_before_preview(kind: str, tmp_path: Path) -> None:
    document = _document(tmp_path, kind)
    document["payload"]["config"]["spaces"][0]["openings"] = [{
        "id": "forged-passage", "type": "passage", "x": 0.5, "y": 0.5,
        "angle": 0, "length": 0.09, "lock": "lock.private",
    }]
    _downgrade_document_to_v7(document)
    with pytest.raises(ImportFailure) as invalid:
        create_preview(
            SimpleNamespace(instance_id="instance-a", import_previews={}),
            json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
            current_config_data={"config": _config(), "rev": 1},
            current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
        )
    assert invalid.value.code == "invalid_passage_fields"
    assert "lock.private" not in str(invalid.value)


def test_canonical_passage_import_survives_space_id_remap(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    document["payload"]["config"]["spaces"][0]["openings"] = [{
        "id": "passage", "type": "passage", "x": 0.5, "y": 0,
        "angle": 0, "length": 0.09, "future": {"kept": True},
    }]
    _downgrade_document_to_v7(document)
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    response = create_preview(
        runtime, json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": _config(), "rev": 1},
        current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
    )
    candidate = get_candidate(runtime, response["token"], "alice")
    # create_preview owns the v7→current-model materialization before the merge. Calling
    # build_space_merge again with the untouched v7 source would deliberately
    # bypass that production boundary and mix model versions.
    merged = candidate["target_config"]
    passage = merged["spaces"][-1]["openings"][0]
    assert passage["type"] == "passage"
    assert passage["id"] != "passage"
    assert passage["future"] == {"kept": True}


def test_canonical_passage_full_preview_preserves_geometry_and_extensions(tmp_path: Path) -> None:
    document = _document(tmp_path, "full")
    document["payload"]["config"]["spaces"][0]["openings"] = [{
        "id": "passage", "type": "passage", "x": 0.4, "y": 0,
        "angle": 0, "length": 0.12, "future": {"kept": True},
    }]
    _downgrade_document_to_v7(document)
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    response = create_preview(
        runtime, json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": _config(), "rev": 1},
        current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
    )
    candidate = get_candidate(runtime, response["token"], "alice")
    assert candidate["document"]["payload"]["config"]["spaces"][0]["openings"] == [{
        "id": "passage", "type": "passage", "x": 0.4, "y": 0,
        "angle": 0, "length": 0.12, "future": {"kept": True},
    }]


@pytest.mark.parametrize("current_kind", ["empty", "other"])
def test_full_preview_preserves_legacy_near_end_partition_opening(
    tmp_path: Path, current_kind: str,
) -> None:
    document = _document(tmp_path, "full")
    space = document["payload"]["config"]["spaces"][0]
    space["partitions"] = [{
        "id": "wall", "a": [0, 0], "b": [1, 0], "cm": 100,
    }]
    space["openings"] = [{
        "id": "legacy-door", "type": "door", "x": 0.1, "y": 0,
        "angle": 0, "length": 0.2,
        "host": {"kind": "partition", "id": "wall", "t": 0.1},
    }]
    current = (
        {"spaces": [], "markers": [], "settings": {}}
        if current_kind == "empty" else _config()
    )
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    response = create_preview(
        runtime, json.dumps(document).encode(), owner_id="alice",
        duplicate_policy="skip", current_config_data={"config": current, "rev": 1},
        current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
    )
    candidate = get_candidate(runtime, response["token"], "alice")
    restored = candidate["document"]["payload"]["config"]["spaces"][0]
    assert restored["openings"][0]["host"]["t"] == 0.1


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
    assert document["export_version"] == 2
    assert document["model_version"] == PLAN_MODEL_VERSION
    assert "model_version" not in document["payload"]["config"]
    assert document["source_fingerprint"].startswith("sha256:")
    assert set(document["payload"]["layout"]) == {"lamp"}
    assert document["placement_manifest"][0]["layout_id"] == "lamp"
    assert filename.startswith("houseplan-full-") and filename.endswith(".json")


def _plan_only_source() -> tuple[dict[str, Any], dict[str, Any]]:
    config = _config()
    space = config["spaces"][0]
    space.update({
        "cell_cm": 5,
        "plan_url": "https://example.invalid/floor.svg",
        "plan_x": 0.1,
        "plan_y": -0.2,
        "plan_scale_x": 1.2,
        "plan_scale_y": 0.8,
        "plan_angle": 15,
        "settings": {
            "show_names": True, "north_deg": 90, "sun_rays": True,
            "future_binding": "sensor.secret",
        },
        "future_space": {"entity": "sensor.secret"},
        "openings": [{
            "id": "window", "type": "window", "x": 0.5, "y": 0.5,
            "angle": 0, "length": 0.2, "contact": "binary_sensor.window",
            "lock": "lock.window", "invert": True, "flip_h": True,
            "host": {"kind": "partition", "id": "partition", "t": 0.5},
            "future_opening": "sensor.secret",
        }],
        # The current v8 fixture must retain the catalogue's exact compatibility
        # projection; legacy key-only walls are covered by the v7 import cases.
        "walls": [],
        "room_drafts": [{
            "id": "draft", "points": [[0, 0], [0.2, 0]],
            "segments": [{
                "id": "draft-segment", "cm": 10,
                "future_segment": "sensor.secret",
            }],
        }],
        "partitions": [{"id": "partition", "a": [0, 0.5], "b": [1, 0.5], "cm": 12}],
        "wall_columns": [{"id": "column", "shape": "circle", "center": [0.2, 0.2], "cm": 30}],
        "decor": [
            {
                "id": "modern", "kind": "text", "x": 0.2, "y": 0.2,
                "text": "Temp {sensor.kitchen} / {climate.hall.current_temperature} °C",
                "future_decor": "sensor.secret",
            },
            {
                "id": "legacy", "kind": "text", "x": 0.3, "y": 0.3,
                "text": "Tank {} / {}", "entity": "sensor.tank",
                "attr": "level", "unit": "%",
            },
            {
                "id": "static", "kind": "text", "x": 0.4, "y": 0.4,
                "text": "Literal {not a reference} and sensor.user_text",
            },
            {
                "id": "furniture", "kind": "furniture", "symbol": "sofa",
                "x": 0.5, "y": 0.5, "w": 0.2, "h": 0.1, "angle": 10,
                "flip_h": True, "flip_v": False,
            },
        ],
    })
    room = space["rooms"][0]
    room.update({
        "area": "living-area",
        "settings": {
            "fill_mode": "custom", "custom_fill": {"c": "#123456", "a": 0.4},
            "temp_source": "sensor.room_temp", "hum_source": "sensor.room_humidity",
            "future_room_binding": "sensor.secret",
        },
        "future_room": "sensor.secret",
    })
    config["markers"].append({
        "id": "note", "binding": "virtual", "space": "ground",
        "room_id": "living", "name": "Boiler", "icon": "mdi:fire",
    })
    layout = {
        "lamp": {"x": 0.4, "y": 0.5, "s": "ground"},
        "note": {"x": 0.2, "y": 0.3, "s": "ground"},
        "lg_light.group": {"x": 0.1, "y": 0.1, "s": "ground"},
        "auto-device": {"x": 0.8, "y": 0.8, "s": "ground"},
        "rl_living": {
            "x": 0.45, "y": 0.55, "s": "ground", "k": 1.4,
            "future": "drop",
        },
        "rl_other": {"x": 0.1, "y": 0.1, "s": "other"},
    }
    return config, layout


def test_plan_only_export_projects_geometry_and_round_trips_room_labels(tmp_path: Path) -> None:
    config, layout = _plan_only_source()
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    document, _ = create_export(
        runtime, {"config": config}, {"layout": layout}, kind="space",
        space_id="ground", plan_only=True, card_version="review", config_root=tmp_path,
    )
    payload = document["payload"]
    exported = payload["config"]["spaces"][0]
    assert document["transfer"] == {"dropped_marker_links": 0, "plan_only": True}
    assert payload["config"]["markers"] == []
    assert payload["layout"] == {
        "rl_living": {"x": 0.45, "y": 0.55, "s": "ground", "k": 1.4},
    }
    assert document["placement_manifest"] == [{
        "layout_id": "rl_living", "space_id": "ground", "owner": "room_label",
        "owner_id": "living", "binding": None, "label": None, "icon": None,
    }]
    assert document["content_manifest"][0]["url"] == "https://example.invalid/floor.svg"
    assert all(item.get("owner") != "marker" for item in document["content_manifest"])

    assert "future_space" not in exported
    assert exported["settings"] == {
        "show_names": True, "north_deg": 90, "sun_rays": True, "bg_mode": "static",
    }
    room = exported["rooms"][0]
    assert "area" not in room and "future_room" not in room
    assert room["settings"] == {
        "fill_mode": "custom", "custom_fill": {"c": "#123456", "a": 0.4},
    }
    opening = exported["openings"][0]
    assert opening["flip_h"] is True
    assert opening["host"] == {"kind": "partition", "id": "partition", "t": 0.5}
    assert not {"contact", "lock", "invert", "future_opening"} & set(opening)
    by_id = {item["id"]: item for item in exported["decor"]}
    assert by_id["modern"]["text"] == "Temp — / — °C"
    assert by_id["legacy"]["text"] == "Tank — / —"
    assert not {"entity", "attr", "unit"} & set(by_id["legacy"])
    assert by_id["static"]["text"] == "Literal {not a reference} and sensor.user_text"
    assert by_id["furniture"]["symbol"] == "sofa"
    assert by_id["furniture"]["flip_h"] is True
    assert by_id["furniture"]["flip_v"] is False

    parsed = parse_document(json.dumps(document).encode())
    preview = create_preview(
        runtime, json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": {"spaces": [], "markers": []}, "rev": 0},
        current_layout_data={"layout": {}, "rev": 0}, config_root=tmp_path,
        registry_snapshot={"areas": set()},
    )
    assert preview["preview"]["plan_only"] is True
    assert preview["preview"]["counts"]["markers"] == 0
    assert preview["preview"]["counts"]["layout"] == 1
    assert preview["preview"]["duplicates"] == 0
    assert preview["preview"]["missing_areas"] == []
    assert preview["preview"]["bindings"] == {
        "device": 0, "entity": 0, "virtual": 0,
        "active": 0, "disabled": 0, "missing": 0,
    }
    candidate = get_candidate(runtime, preview["token"], "alice")
    refreshed = revalidate_candidate(
        candidate, {"config": {"spaces": [], "markers": []}, "rev": 2},
        {"layout": {}, "rev": 3}, duplicate_policy="skip", config_root=tmp_path,
    )
    assert refreshed["preview"]["plan_only"] is True
    merged, merged_layout, details = prepare_apply(
        candidate, {"spaces": [], "markers": []}, {}, confirm_missing_content=False,
    )
    assert merged["markers"] == []
    imported_room = merged["spaces"][0]["rooms"][0]
    assert imported_room.get("area") is None
    assert merged_layout == {
        "rl_" + imported_room["id"]: {
            "x": 0.45, "y": 0.55, "s": details["space_id"], "k": 1.4,
        },
    }
    assert parsed["transfer"]["plan_only"] is True


def test_ordinary_space_export_is_unchanged_when_plan_only_is_false(tmp_path: Path) -> None:
    config, layout = _plan_only_source()
    runtime = SimpleNamespace(instance_id="instance-a")
    implicit, _implicit_name = create_export(
        runtime, {"config": config}, {"layout": layout}, kind="space",
        space_id="ground", card_version="review", config_root=tmp_path,
    )
    explicit, _explicit_name = create_export(
        runtime, {"config": config}, {"layout": layout}, kind="space",
        space_id="ground", plan_only=False, card_version="review", config_root=tmp_path,
    )
    for value in (implicit, explicit):
        value.pop("created_at")
    assert implicit == explicit
    assert "plan_only" not in implicit["transfer"]
    assert implicit["payload"]["config"]["markers"]
    assert set(implicit["payload"]["layout"]) == {
        key for key, pos in layout.items() if pos.get("s") == "ground"
    }


@pytest.mark.parametrize(
    "mutation",
    [
        "marker", "layout", "area", "temperature", "opening", "legacy_decor",
        "live_token", "unknown", "placement", "layout_scale",
        "marker_content", "invalid_content",
    ],
)
def test_parser_rejects_forged_plan_only_privacy_claim(
    tmp_path: Path, mutation: str,
) -> None:
    config, layout = _plan_only_source()
    document, _ = create_export(
        SimpleNamespace(instance_id="instance-a"), {"config": config}, {"layout": layout},
        kind="space", space_id="ground", plan_only=True,
        card_version="review", config_root=tmp_path,
    )
    space = document["payload"]["config"]["spaces"][0]
    if mutation == "marker":
        document["payload"]["config"]["markers"].append({
            "id": "forged", "binding": "virtual", "name": "Forged",
        })
    elif mutation == "layout":
        document["payload"]["layout"]["sensor.secret"] = {
            "x": 0.1, "y": 0.2, "s": "ground",
        }
        document["placement_manifest"].append({
            "layout_id": "sensor.secret", "space_id": "ground",
            "owner": "auto_device", "owner_id": "sensor.secret",
            "binding": "device:sensor.secret", "label": None, "icon": None,
        })
    elif mutation == "area":
        space["rooms"][0]["area"] = "secret-area"
    elif mutation == "temperature":
        space["rooms"][0].setdefault("settings", {})["temp_source"] = "sensor.secret"
    elif mutation == "opening":
        space["openings"][0]["contact"] = "binary_sensor.secret"
    elif mutation == "legacy_decor":
        space["decor"][0]["entity"] = "sensor.secret"
    elif mutation == "live_token":
        space["decor"][0]["text"] = "Leaked {sensor.secret}"
    elif mutation == "unknown":
        space["future_binding"] = "sensor.secret"
    elif mutation == "placement":
        document["placement_manifest"][0]["owner"] = "auto_device"
    elif mutation == "layout_scale":
        document["payload"]["layout"]["rl_living"]["k"] = "sensor.secret"
    elif mutation == "marker_content":
        document["content_manifest"].append({"owner": "marker"})
    elif mutation == "invalid_content":
        document["content_manifest"].append("sensor.secret")
    with pytest.raises(ImportFailure) as invalid:
        parse_document(json.dumps(document).encode())
    assert invalid.value.code == "invalid_format"


@pytest.mark.parametrize("value", [1, "true", None, {}, []])
def test_parser_requires_strict_plan_only_boolean(tmp_path: Path, value: Any) -> None:
    document = _document(tmp_path, "space")
    document["transfer"]["plan_only"] = value
    with pytest.raises(ImportFailure) as invalid:
        parse_document(json.dumps(document).encode())
    assert invalid.value.code == "invalid_format"


def test_plan_only_cannot_be_requested_for_full_export(tmp_path: Path) -> None:
    with pytest.raises(ImportFailure) as invalid:
        create_export(
            SimpleNamespace(instance_id="instance-a"), {"config": _config()}, {"layout": {}},
            kind="full", space_id=None, plan_only=True,
            card_version="review", config_root=tmp_path,
        )
    assert invalid.value.code == "invalid_format"


def test_full_export_import_round_trip_restores_model_version(tmp_path: Path) -> None:
    """The portable envelope version must return to the persisted config."""
    document = _document(tmp_path)
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    response = create_preview(
        runtime, json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": {"spaces": [], "markers": []}, "rev": 0},
        current_layout_data={"layout": {}, "rev": 0}, config_root=tmp_path,
    )
    candidate = get_candidate(runtime, response["token"], "alice")
    config, _layout, _details = prepare_apply(
        candidate, {"spaces": [], "markers": []}, {}, confirm_missing_content=False,
    )
    assert config["model_version"] == document["model_version"] == PLAN_MODEL_VERSION
    assert config == _config()


@pytest.mark.parametrize("kind", ["full", "space"])
@pytest.mark.parametrize(
    ("target_current", "expected_model"),
    [(False, 7), (True, PLAN_MODEL_VERSION)],
)
def test_v7_import_materializes_only_when_target_requires_current_model(
    tmp_path: Path, kind: str, target_current: bool, expected_model: int,
) -> None:
    legacy = _config()
    legacy["model_version"] = 7
    for space in legacy["spaces"]:
        space.pop("wall_segments", None)
        for room in space.get("rooms") or []:
            room.pop("wall_ids", None)
        for opening in space.get("openings") or []:
            if (opening.get("host") or {}).get("kind") == "wall":
                opening.pop("host", None)
        for draft in space.get("room_drafts") or []:
            for segment in draft.get("segments") or []:
                segment.pop("id", None)
    document, _ = create_export(
        SimpleNamespace(instance_id="instance-a"),
        {"config": legacy}, {"layout": {}}, kind=kind,
        space_id="ground" if kind == "space" else None,
        card_version="review", config_root=tmp_path,
    )
    target = _config() if target_current else copy.deepcopy(legacy)
    if kind == "space":
        target["spaces"] = []
        target["markers"] = []
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    response = create_preview(
        runtime, json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": target, "rev": 0},
        current_layout_data={"layout": {}, "rev": 0}, config_root=tmp_path,
    )
    candidate = get_candidate(runtime, response["token"], "alice")
    result = candidate["target_config"]
    assert result.get("model_version", 0) == expected_model
    if expected_model == PLAN_MODEL_VERSION:
        assert all("wall_segments" in space for space in result["spaces"])
    else:
        assert all("wall_segments" not in space for space in result["spaces"])


def test_preview_tokens_are_bounded_owned_expiring_and_single_use(
    tmp_path: Path, monkeypatch,
) -> None:
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    raw = json.dumps(_document(tmp_path)).encode()
    # Separate the two equal production limits so this assertion still kills a
    # mutant that accidentally removes only the per-user eviction branch.
    monkeypatch.setattr(
        import_export_api, "MAX_IMPORT_PREVIEWS_TOTAL", MAX_IMPORT_PREVIEWS_PER_USER + 5,
    )
    tokens = []
    for _index in range(MAX_IMPORT_PREVIEWS_PER_USER + 1):
        response = create_preview(
            runtime, raw, owner_id="alice", duplicate_policy="skip",
            current_config_data={"config": _config(), "rev": 1},
            current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
        )
        tokens.append(response["token"])
    assert len(runtime.import_previews) == MAX_IMPORT_PREVIEWS_PER_USER
    assert tokens[0] not in runtime.import_previews

    live = tokens[-1]
    with pytest.raises(ImportFailure) as wrong_owner:
        get_candidate(runtime, live, "bob")
    assert wrong_owner.value.code == "preview_owner_mismatch"
    get_candidate(runtime, live, "alice", consume=True)
    with pytest.raises(ImportFailure) as consumed:
        get_candidate(runtime, live, "alice")
    assert consumed.value.code == "preview_expired"

    expiring = create_preview(
        runtime, raw, owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": _config(), "rev": 1},
        current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
    )["token"]
    runtime.import_previews[expiring]["expires"] = 0
    with pytest.raises(ImportFailure) as expired:
        get_candidate(runtime, expiring, "alice")
    assert expired.value.code == "preview_expired"
    assert expiring not in runtime.import_previews

    monkeypatch.setattr(import_export_api, "MAX_IMPORT_PREVIEWS_TOTAL", MAX_IMPORT_PREVIEWS_TOTAL)
    global_runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    global_tokens = [
        create_preview(
            global_runtime, raw, owner_id=f"owner-{index}", duplicate_policy="skip",
            current_config_data={"config": _config(), "rev": 1},
            current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
        )["token"]
        for index in range(MAX_IMPORT_PREVIEWS_TOTAL + 1)
    ]
    assert len(global_runtime.import_previews) == MAX_IMPORT_PREVIEWS_TOTAL
    assert global_tokens[0] not in global_runtime.import_previews


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


@pytest.mark.parametrize("kind", ["full", "space"])
def test_export_copies_toggle_entity_literal(tmp_path: Path, kind: str) -> None:
    config = _config()
    config["markers"][0]["toggle_entity"] = "switch.channel_2"
    document, _ = create_export(
        SimpleNamespace(instance_id="instance-a"),
        {"config": config}, {"layout": {}}, kind=kind,
        space_id="ground" if kind == "space" else None,
        card_version="1.65.0", config_root=tmp_path,
    )
    marker = document["payload"]["config"]["markers"][0]
    assert marker["toggle_entity"] == "switch.channel_2"


def test_space_import_remaps_owned_ids_and_duplicate_policy(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    document["payload"]["config"]["markers"][0]["toggle_entity"] = "switch.channel_2"
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
    assert "controls" not in copied
    assert "toggle_entity" not in copied
    assert vdetails["virtualized"] == 1


def test_preview_is_owner_bound_and_foreign_full_drops_discovery_lists(tmp_path: Path) -> None:
    document = _document(tmp_path)
    document["payload"]["config"]["settings"]["marker_area_snapshot"] = {
        "lamp": {"binding": "entity:light.living", "area": "living"},
    }
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
    assert "marker_area_snapshot" not in config["settings"]


def test_same_source_full_import_preserves_marker_area_snapshot(tmp_path: Path) -> None:
    document = _document(tmp_path)
    snapshot = {"lamp": {"binding": "entity:light.living", "area": "living"}}
    document["payload"]["config"]["settings"]["marker_area_snapshot"] = snapshot
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    response = create_preview(
        runtime, json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": _config(), "rev": 4},
        current_layout_data={"layout": {}, "rev": 5}, config_root=tmp_path,
    )
    candidate = get_candidate(runtime, response["token"], "alice")
    config, _layout, _details = prepare_apply(
        candidate, _config(), {}, confirm_missing_content=True,
    )
    assert config["settings"]["marker_area_snapshot"] == snapshot


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


def test_foreign_content_never_binds_to_same_named_local_file(tmp_path: Path) -> None:
    plans = tmp_path / PLANS_DIR
    plans.mkdir(parents=True, exist_ok=True)
    (plans / "portable.svg").write_text("<svg/>", encoding="utf-8")
    config = _config()
    config["spaces"][0]["plan_url"] = "/api/houseplan/content/plans/_/portable.svg"
    document, _ = create_export(
        SimpleNamespace(instance_id="source-instance"), {"config": config}, {"layout": {}},
        kind="full", space_id=None, card_version="review", config_root=tmp_path,
    )
    runtime = SimpleNamespace(instance_id="target-instance", import_previews={})
    response = create_preview(
        runtime, json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": _config(), "rev": 1},
        current_layout_data={"layout": {}, "rev": 1}, config_root=tmp_path,
    )
    row = response["preview"]["content"][0]
    assert row["exists_on_target"] is True
    assert row["state"] == "detach_required"
    assert response["preview"]["confirmation_required"] is True
    candidate = get_candidate(runtime, response["token"], "alice")
    with pytest.raises(ImportFailure) as unconfirmed:
        prepare_apply(candidate, _config(), {}, confirm_missing_content=False)
    assert unconfirmed.value.code == "content_confirmation_required"


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


def test_issue_244_space_import_repairs_existing_target_refs_with_exact_map(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    current = {
        "spaces": [],
        "markers": [{
            "id": "target-vac", "binding": "virtual", "space": "ground",
            "room_id": "living", "vacuum": {"segment_map": {"12": "living"}},
        }],
        "settings": {},
    }
    current_layout = {
        "target-vac": {"s": "ground", "x": 0.2, "y": 0.3},
        "rl_living": {"s": "ground", "x": 0.6, "y": 0.7},
    }

    merged, layout, details = build_space_merge(
        document, current, current_layout, "skip",
    )
    imported = next(space for space in merged["spaces"] if space["id"] == details["space_id"])
    imported_room = imported["rooms"][0]["id"]
    marker = next(marker for marker in merged["markers"] if marker["id"] == "target-vac")

    assert marker["space"] == details["space_id"]
    assert marker["room_id"] == imported_room
    assert marker["vacuum"]["segment_map"] == {"12": imported_room}
    assert layout["target-vac"] == {
        "s": details["space_id"], "x": 0.2, "y": 0.3,
    }
    assert "rl_living" not in layout
    assert layout["rl_" + imported_room]["s"] == details["space_id"]
    assert details["repaired_target_refs"] == 6


def test_issue_265_space_import_repairs_unique_previous_generation_lineage(
    tmp_path: Path,
) -> None:
    document = _document(tmp_path, "space")
    current = {
        "spaces": [],
        "markers": [{
            "id": "target-vac", "binding": "virtual",
            "space": "space_ground_aaaaaaaa",
            "room_id": "room_living_bbbbbbbb",
            "vacuum": {"segment_map": {"12": "room_living_cccccccc"}},
        }],
        "settings": {},
    }
    current_layout = {
        "target-vac": {
            "s": "space_ground_dddddddd", "x": 0.2, "y": 0.3,
        },
        "rl_room_living_eeeeeeee": {
            "s": "space_ground_ffffffff", "x": 0.6, "y": 0.7,
        },
    }

    merged, layout, details = build_space_merge(
        document, current, current_layout, "skip",
    )
    imported = next(space for space in merged["spaces"] if space["id"] == details["space_id"])
    imported_room = imported["rooms"][0]["id"]
    marker = next(item for item in merged["markers"] if item["id"] == "target-vac")

    assert marker["space"] == details["space_id"]
    assert marker["room_id"] == imported_room
    assert marker["vacuum"]["segment_map"] == {"12": imported_room}
    assert layout["target-vac"] == {
        "s": details["space_id"], "x": 0.2, "y": 0.3,
    }
    assert "rl_room_living_eeeeeeee" not in layout
    assert layout["rl_" + imported_room]["s"] == details["space_id"]
    assert details["repaired_target_refs"] == 6
    assert details["reference_report"]["remapped"]["target"] == {
        "marker.space": 1,
        "marker.room_id": 1,
        "marker.vacuum.segment_map": 1,
        "layout.space": 2,
        "layout.room_label": 1,
    }
    assert details["preserved_unresolved_refs"] == 0


def test_issue_244_space_import_does_not_repair_target_while_source_exists(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    current = _config()
    current_layout = {"lamp": {"s": "ground", "x": 0.2, "y": 0.3}}

    merged, layout, details = build_space_merge(
        document, current, current_layout, "skip",
    )

    marker = next(marker for marker in merged["markers"] if marker["id"] == "lamp")
    assert marker["space"] == "ground"
    assert marker["room_id"] == "living"
    assert layout["lamp"]["s"] == "ground"
    assert details["repaired_target_refs"] == 0


def test_issue_265_import_of_import_flattens_every_owned_namespace(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    space = document["payload"]["config"]["spaces"][0]
    space["partitions"] = [{
        "id": "part", "a": [0, 0.5], "b": [1, 0.5], "cm": 15,
    }]
    space["openings"] = [{
        "id": "door", "type": "door", "x": 0.5, "y": 0.5,
        "angle": 0, "length": 0.2,
        "host": {"kind": "partition", "id": "part", "t": 0.5},
    }]
    first, _layout, first_details = build_space_merge(
        document, {"spaces": [], "markers": [], "settings": {}}, {}, "skip",
    )
    imported = first["spaces"][0]
    document["payload"]["config"]["spaces"] = [imported]
    document["payload"]["config"]["markers"] = []
    document["payload"]["layout"] = {}
    document["placement_manifest"] = []
    second, _layout, second_details = build_space_merge(
        document, {"spaces": [], "markers": [], "settings": {}}, {}, "skip",
    )
    copied = second["spaces"][0]

    assert first_details["space_id"].startswith("space_ground_")
    assert second_details["space_id"].startswith("space_ground_")
    assert "space_space_" not in second_details["space_id"]
    for collection, nested_prefix in (
        ("rooms", "room_room_"),
        ("partitions", "partition_partition_"),
        ("openings", "opening_opening_"),
    ):
        assert all(nested_prefix not in item["id"] for item in copied[collection])


def test_issue_265_cross_generation_target_repair_fails_closed_when_ambiguous(
    tmp_path: Path,
) -> None:
    document = _document(tmp_path, "space")
    current = {
        "spaces": [{
            "id": "space_ground_aaaaaaaa", "title": "Existing",
            "view_box": [0, 0, 1, 1], "rooms": [],
        }],
        "markers": [{
            "id": "orphan", "binding": "virtual", "space": "space_ground_bbbbbbbb",
        }],
        "settings": {},
    }
    merged, _layout, details = build_space_merge(document, current, {}, "skip")
    marker = next(item for item in merged["markers"] if item["id"] == "orphan")

    assert marker["space"] == "space_ground_bbbbbbbb"
    assert details["repaired_target_refs"] == 0
    assert details["preserved_unresolved_refs"] == 1
    assert details["reference_report"]["preservedUnresolved"] == {
        "marker.space": 1,
    }


def test_issue_265_target_marker_links_require_an_imported_light_target(
    tmp_path: Path,
) -> None:
    document = _document(tmp_path, "space")
    # The copied owner is still a marker/layout target, but cannot become a
    # marker:* light target after the transfer policy removes light semantics.
    document["payload"]["config"]["markers"][0]["is_light"] = False
    current = {
        "spaces": [],
        "markers": [{
            "id": "controller", "binding": "virtual", "space": "ground",
            "controls": ["marker:lamp"],
        }],
        "settings": {},
    }

    merged, _layout, details = build_space_merge(document, current, {}, "skip")
    controller = next(item for item in merged["markers"] if item["id"] == "controller")

    assert controller["controls"] == ["marker:lamp"]
    assert details["reference_report"]["preservedUnresolved"] == {
        "marker.controls": 1,
    }


def test_issue_265_bounded_lineage_report_counts_unique_ids_once(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    nested = "ground"
    for _index in range(17):
        nested = f"space_{nested}_deadbeef"
    document["payload"]["config"]["spaces"][0]["id"] = nested
    document["payload"]["config"]["markers"][0]["space"] = nested
    document["payload"]["layout"]["lamp"]["s"] = nested

    _merged, _layout, details = build_space_merge(
        document, {"spaces": [], "markers": [], "settings": {}}, {}, "skip",
    )

    assert details["reference_report"]["boundedLineages"] == 1


def test_issue_265_maximum_marker_candidate_keeps_report_bounded(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    current = {
        "spaces": [],
        "markers": [
            {
                "id": f"legacy-{index}",
                "binding": "virtual",
                "space": "space_ground_aaaaaaaa",
            }
            for index in range(MAX_MARKERS - 1)
        ],
        "settings": {},
    }

    merged, _layout, details = build_space_merge(document, current, {}, "skip")

    assert len(merged["markers"]) == MAX_MARKERS
    assert details["repaired_target_refs"] == MAX_MARKERS - 1
    assert details["reference_report"]["remapped"]["target"] == {
        "marker.space": MAX_MARKERS - 1,
    }
    assert len(details["reference_report"]["examples"]) == 24
    assert all(
        marker["space"] == details["space_id"]
        for marker in merged["markers"]
    )


def test_issue_265_apply_uses_the_exact_materialized_preview_candidate(
    tmp_path: Path, monkeypatch,
) -> None:
    document = _document(tmp_path, "space")
    runtime = SimpleNamespace(instance_id="instance-a", import_previews={})
    response = create_preview(
        runtime, json.dumps(document).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": {"spaces": [], "markers": []}, "rev": 2},
        current_layout_data={"layout": {}, "rev": 3}, config_root=tmp_path,
    )
    candidate = get_candidate(runtime, response["token"], "alice")
    preview_space = candidate["details"]["space_id"]

    def fail_if_rebuilt(*_args, **_kwargs):
        raise AssertionError("Apply must not allocate another import id")

    monkeypatch.setattr(import_export_api, "_fresh", fail_if_rebuilt)
    config, layout, details = prepare_apply(
        candidate, {"spaces": [], "markers": []}, {}, confirm_missing_content=False,
    )
    assert config == candidate["target_config"]
    assert layout == candidate["target_layout"]
    assert details == candidate["details"]
    assert details["space_id"] == preview_space


def test_space_merge_remaps_every_space_owned_id_and_room_link(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    space = document["payload"]["config"]["spaces"][0]
    space["rooms"] = [
        {"id": "living", "name": "Living", "poly": [[0, 0], [1, 0], [1, 0.5]],
         "open_to": ["kitchen"]},
        {"id": "kitchen", "name": "Kitchen", "poly": [[0, 0.5], [1, 0.5], [1, 1]]},
    ]
    space["openings"] = [
        {
            "id": "op1", "type": "door", "x": 0.5, "y": 0.25,
            "angle": 0, "length": 0.1,
            "host": {"kind": "partition", "id": "part1", "t": 0.5},
        },
    ]
    space["decor"] = [
        {"id": "dec1", "kind": "line", "x1": 0, "y1": 0, "x2": 1, "y2": 1,
         "color": "#ffffff", "opacity": 1, "width_cm": 1},
    ]
    space["partitions"] = [{"id": "part1", "a": [0, 0.25], "b": [1, 0.25], "cm": 15}]
    space["wall_columns"] = [
        {"id": "column1", "shape": "square", "center": [0.2, 0.2], "cm": 30},
    ]
    space["room_drafts"] = [{
        "id": "draft1", "points": [[0, 0], [0.2, 0], [0.2, 0.2]],
        "segments": [{"cm": 10}, {"cm": 10}],
    }]
    merged, _layout, details = build_space_merge(
        document, {"spaces": [], "markers": [], "settings": {}}, {}, "skip",
    )
    imported = next(item for item in merged["spaces"] if item["id"] == details["space_id"])
    old_ids = {"ground", "living", "kitchen", "op1", "dec1", "part1", "column1", "draft1"}
    imported_ids = {imported["id"]}
    for collection in ("rooms", "openings", "decor", "partitions", "wall_columns", "room_drafts"):
        imported_ids.update(str(item["id"]) for item in imported.get(collection) or [])
    assert not old_ids & imported_ids
    room_ids = {room["id"] for room in imported["rooms"]}
    assert set(imported["rooms"][0]["open_to"]) <= room_ids
    imported_partition = imported["partitions"][0]["id"]
    assert imported["openings"][0]["host"] == {
        "kind": "partition", "id": imported_partition, "t": 0.5,
    }


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


def test_issue_90_space_merge_remaps_internal_badge_marker_link(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    markers = document["payload"]["config"]["markers"]
    markers[0]["name"] = "Controller"
    markers[0]["value_badge"] = {
        "enabled": True,
        "source": {"kind": "derived_marker_state", "ref": "marker:dumb"},
        "position": "bottom",
    }
    markers.append({
        "id": "dumb", "binding": "virtual", "space": "ground",
        "room_id": "living", "name": "Dumb lamp", "is_light": True,
    })
    merged, _layout, details = build_space_merge(
        document, {"spaces": [], "markers": [], "settings": {}}, {}, "skip",
    )
    imported = [m for m in merged["markers"] if m.get("space") == details["space_id"]]
    by_name = {m.get("name"): m for m in imported}
    assert by_name["Controller"]["value_badge"]["source"]["ref"] == \
        "marker:" + by_name["Dumb lamp"]["id"]
    assert details["dropped_marker_links"] == 0


def test_issue_378_space_merge_remaps_internal_value_face_marker_link(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    markers = document["payload"]["config"]["markers"]
    markers[0]["name"] = "Controller"
    markers[0]["value_source"] = {
        "kind": "derived_marker_state", "ref": "marker:dumb",
    }
    markers.append({
        "id": "dumb", "binding": "virtual", "space": "ground",
        "room_id": "living", "name": "Dumb lamp", "is_light": True,
    })
    merged, _layout, details = build_space_merge(
        document, {"spaces": [], "markers": [], "settings": {}}, {}, "skip",
    )
    imported = [m for m in merged["markers"] if m.get("space") == details["space_id"]]
    by_name = {m.get("name"): m for m in imported}
    assert by_name["Controller"]["value_source"]["ref"] == \
        "marker:" + by_name["Dumb lamp"]["id"]
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


def test_issue_90_space_export_disables_badge_link_outside_selection(tmp_path: Path) -> None:
    config = _config()
    config["markers"][0]["value_badge"] = {
        "enabled": True,
        "source": {"kind": "derived_marker_state", "ref": "marker:outside"},
        "position": "left",
    }
    config["markers"].append({
        "id": "outside", "binding": "virtual", "space": "other",
        "name": "Other lamp", "is_light": True,
    })
    document, _ = create_export(
        SimpleNamespace(instance_id="instance-a"), {"config": config},
        {"layout": {"lamp": {"s": "ground", "x": 0.5, "y": 0.5}}},
        kind="space", space_id="ground", card_version="1.61.0", config_root=tmp_path,
    )
    badge = document["payload"]["config"]["markers"][0]["value_badge"]
    assert badge == {"enabled": False, "source": None, "position": "left"}
    assert document["transfer"]["dropped_marker_links"] == 1


def test_issue_378_space_export_drops_value_face_link_outside_selection(tmp_path: Path) -> None:
    config = _config()
    config["markers"][0]["value_source"] = {
        "kind": "derived_marker_state", "ref": "marker:outside",
    }
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
    assert "value_source" not in marker
    assert document["transfer"]["dropped_marker_links"] == 1


def test_issue_385_space_export_drops_badge_and_value_face_links_together(tmp_path: Path) -> None:
    """#385(г) AC5: the PAIRED neutralisation formats, both at once.

    An external value_badge ref is disarmed by fields (enabled=False,
    source=None — enabled is part of the badge model) while an external
    value_source ref is disarmed by dropping the key (absence IS auto).
    Both count in dropped_marker_links; the asymmetry is intentional and
    round-trip-safe for existing exports.
    """
    config = _config()
    config["markers"][0]["value_badge"] = {
        "enabled": True, "position": "right",
        "source": {"kind": "derived_marker_state", "ref": "marker:outside"},
    }
    config["markers"][0]["value_source"] = {
        "kind": "derived_marker_state", "ref": "marker:outside",
    }
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
    assert marker["value_badge"]["enabled"] is False
    assert marker["value_badge"]["source"] is None
    assert "value_source" not in marker
    assert document["transfer"]["dropped_marker_links"] == 2


def test_issue_378_virtualized_duplicate_drops_value_face_link(tmp_path: Path) -> None:
    document = _document(tmp_path, "space")
    controller = document["payload"]["config"]["markers"][0]
    controller["name"] = "Controller"
    controller["value_source"] = {
        "kind": "derived_marker_state", "ref": "marker:dumb",
    }
    document["payload"]["config"]["markers"].append({
        "id": "dumb", "binding": "virtual", "space": "ground", "is_light": True,
    })
    current = {
        "spaces": [], "markers": [{"id": "existing", "binding": controller["binding"]}],
    }
    merged, _layout, details = build_space_merge(document, current, {}, "virtual")
    imported_controller = next(
        marker for marker in merged["markers"]
        if marker.get("name") == controller.get("name") and marker.get("binding") == "virtual"
    )
    assert "value_source" not in imported_controller
    assert details["dropped_marker_links"] == 1


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
    def __init__(self, *, is_admin: bool = True) -> None:
        self.user = SimpleNamespace(id="review-owner", is_admin=is_admin)
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
        # The durable geometry-migration intent is ``space_id -> old aspect``.
        # Keep a valid intent here so rollback preservation can also be proven
        # safe across the subsequent integration reload.
        "geom_pending": {"ground": 1.5},
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

    plan_exported = _Connection()
    await wsapi.ws_export_create.__wrapped__(hass, plan_exported, {
        "id": 44, "type": "houseplan/export/create", "kind": "space",
        "space_id": "ground", "plan_only": True, "card_version": "review",
    })
    assert plan_exported.error is None and plan_exported.result
    plan_document = plan_exported.result["document"]
    assert plan_document["transfer"]["plan_only"] is True
    assert plan_document["payload"]["config"]["markers"] == []
    assert plan_document["payload"]["layout"] == {}

    refreshed = _Connection()
    await wsapi.ws_import_revalidate.__wrapped__(hass, refreshed, {
        "id": 41, "type": "houseplan/import/revalidate",
        "token": response["token"], "duplicate_policy": "skip",
    })
    assert refreshed.error is None and refreshed.result
    assert refreshed.result["token"] == response["token"]
    assert refreshed.result["expected_config_rev"] == response["expected_config_rev"]
    assert refreshed.result["expected_layout_rev"] == response["expected_layout_rev"]


async def test_full_export_waits_for_a_concurrent_paired_write(
    hass: HomeAssistant,
) -> None:
    """An export sees either complete pair, never config from mid-commit."""
    await _setup(hass)
    rt = get_data(hass)
    assert rt is not None
    old_config = _config()
    old_layout = {"lamp": {"x": 0.1, "y": 0.2, "s": "ground"}}
    await rt.config_store.async_save({"config": old_config, "rev": 1})
    await rt.store.async_save({"layout": old_layout, "rev": 1})

    config_written = asyncio.Event()
    finish_pair = asyncio.Event()
    new_config = json.loads(json.dumps(old_config))
    new_config["spaces"][0]["title"] = "Concurrent target"
    new_layout = {"lamp": {"x": 0.8, "y": 0.9, "s": "ground"}}

    async def write_pair() -> None:
        async with rt.write_lock:
            await rt.config_store.async_save({"config": new_config, "rev": 2})
            config_written.set()
            await finish_pair.wait()
            await rt.store.async_save({"layout": new_layout, "rev": 2})

    writer = asyncio.create_task(write_pair())
    await config_written.wait()
    exported = _Connection()
    export = asyncio.create_task(wsapi.ws_export_create.__wrapped__(hass, exported, {
        "id": 43, "type": "houseplan/export/create", "kind": "full",
        "card_version": "review",
    }))
    await asyncio.sleep(0)
    assert not export.done(), "export must wait while the paired writer owns the lock"
    finish_pair.set()
    await writer
    await export

    assert exported.error is None and exported.result
    payload = exported.result["document"]["payload"]
    assert payload["config"]["spaces"][0]["title"] == "Concurrent target"
    assert payload["layout"] == new_layout


@pytest.mark.parametrize(("endpoint", "message"), [
    (wsapi.ws_export_create, {
        "id": 50, "type": "houseplan/export/create", "kind": "full", "card_version": "review",
    }),
    (wsapi.ws_import_revalidate, {
        "id": 51, "type": "houseplan/import/revalidate", "token": "opaque",
        "duplicate_policy": "skip",
    }),
    (wsapi.ws_import_apply, {
        "id": 52, "type": "houseplan/import/apply", "token": "opaque",
        "expected_config_rev": 0, "expected_layout_rev": 0,
        "confirm_missing_content": False,
    }),
])
async def test_portable_backup_ws_endpoints_reject_non_editors(
    hass: HomeAssistant, endpoint, message: dict[str, Any],
) -> None:
    connection = _Connection(is_admin=False)
    await endpoint.__wrapped__(hass, connection, message)
    assert connection.result is None
    assert connection.error and connection.error[0] == "unauthorized"


class _ImportPreviewRequest:
    def __init__(self, hass: HomeAssistant, *, is_admin: bool) -> None:
        self.app = {KEY_HASS: hass}
        self.query: dict[str, str] = {}
        self.content_length = 0
        self._user = SimpleNamespace(id="http-review", is_admin=is_admin)

    def get(self, key: str, default=None):
        return self._user if key == "hass_user" else default


async def test_import_preview_http_rejects_non_editor_and_reports_not_ready(
    hass: HomeAssistant,
) -> None:
    view = HouseplanImportPreviewView()
    forbidden = await view.post(_ImportPreviewRequest(hass, is_admin=False))
    assert forbidden.status == 403
    unavailable = await view.post(_ImportPreviewRequest(hass, is_admin=True))
    assert unavailable.status == 503


async def test_import_apply_conflict_preserves_state_and_preview_token(
    hass: HomeAssistant, tmp_path: Path,
) -> None:
    await _setup(hass)
    rt, response, _document_value = await _candidate(hass, tmp_path)
    current = await rt.config_store.async_load()
    await rt.config_store.async_save({**current, "rev": 2})
    connection = await _apply(hass, response)
    assert connection.result is None
    assert connection.error and connection.error[0] == "conflict"
    assert response["token"] in rt.import_previews
    assert (await rt.config_store.async_load())["config"]["spaces"][0]["title"] == "Ground"
    assert (await rt.store.async_load())["layout"]["lamp"]["x"] == 0.1


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
    assert "repair_backup" not in stored_layout
    assert "geom_pending" not in stored_layout
    assert stored_layout["optimize_backup"]["kind"] == "import"


async def test_full_import_undo_is_one_shot_and_reports_its_kind(
    hass: HomeAssistant, tmp_path: Path,
) -> None:
    await _setup(hass)
    rt, response, _ = await _candidate(hass, tmp_path)
    applied = await _apply(hass, response)
    assert applied.result and applied.result["can_undo"] is True

    status = _Connection()
    await wsapi.ws_config_get.__wrapped__(hass, status, {
        "id": 60, "type": "houseplan/config/get",
    })
    assert status.result and status.result["undo_kind"] == "import"

    undone = _Connection()
    await wsapi.ws_plan_optimize_undo.__wrapped__(hass, undone, {
        "id": 61, "type": "houseplan/plan/optimize_undo",
        "expected_config_rev": 2, "expected_layout_rev": 2,
    })
    assert undone.error is None and undone.result and undone.result["can_undo"] is False
    assert (await rt.config_store.async_load())["config"]["spaces"][0]["title"] == "Ground"
    assert (await rt.store.async_load())["layout"]["lamp"]["x"] == 0.1

    repeated = _Connection()
    await wsapi.ws_plan_optimize_undo.__wrapped__(hass, repeated, {
        "id": 62, "type": "houseplan/plan/optimize_undo",
        "expected_config_rev": 3, "expected_layout_rev": 3,
    })
    assert repeated.error and repeated.error[0] == "no_backup"


@pytest.mark.parametrize("kind", ["import", "import_rollback"])
async def test_setup_recovers_durable_import_pair(
    hass: HomeAssistant, kind: str,
) -> None:
    entry = await _setup(hass)
    rt = get_data(hass)
    assert rt is not None
    current = _config()
    target = json.loads(json.dumps(current))
    target["spaces"][0]["title"] = f"Recovered {kind}"
    target_layout = {"lamp": {"x": 0.8, "y": 0.7, "s": "ground"}}
    await rt.config_store.async_save({"config": current, "rev": 1})
    await rt.store.async_save({
        "layout": {"lamp": {"x": 0.1, "y": 0.2, "s": "ground"}},
        "rev": 1,
        "stale_metadata": True,
        "optimize_pending": {
            "kind": kind,
            "config": target,
            "layout": target_layout,
            "config_rev": 2,
            "layout_rev": 2,
            "final_metadata": {"future_metadata": {"kept": True}},
        },
    })

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    recovered = get_data(hass)
    assert recovered is not None
    config_data = await recovered.config_store.async_load()
    layout_data = await recovered.store.async_load()
    assert config_data == {"config": target, "rev": 2}
    assert layout_data["layout"] == target_layout
    assert layout_data["rev"] == 2
    assert layout_data["future_metadata"] == {"kept": True}
    assert "stale_metadata" not in layout_data
    assert "optimize_pending" not in layout_data


async def test_setup_recovers_exact_optimize_storage_roundtrip_pair(
    hass: HomeAssistant,
) -> None:
    """#248: startup recovery converges on the same shared canonical target."""
    fixture = json.loads((
        Path(__file__).parents[1]
        / "test"
        / "fixtures"
        / "optimize-storage-roundtrip.json"
    ).read_text(encoding="utf-8"))
    expected = fixture["expected"]

    entry = await _setup(hass)
    rt = get_data(hass)
    assert rt is not None
    await rt.config_store.async_save({"config": DEFAULT_CONFIG, "rev": 1})
    await rt.store.async_save({
        "layout": {},
        "rev": 1,
        "optimize_backup": {"sentinel": True},
        "optimize_pending": {
            "kind": "optimize",
            "config": expected["config"],
            "layout": expected["layout"],
            "config_rev": 2,
            "layout_rev": 2,
            "clear_backup": False,
        },
    })

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    recovered = get_data(hass)
    assert recovered is not None
    config_data = await recovered.config_store.async_load()
    layout_data = await recovered.store.async_load()
    assert config_data == {"config": expected["config"], "rev": 2}
    assert layout_data["layout"] == expected["layout"]
    assert layout_data["rev"] == 2
    assert layout_data["optimize_backup"] == {"sentinel": True}
    assert "optimize_pending" not in layout_data


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


async def test_apply_rechecks_attachment_under_the_write_lock(
    hass: HomeAssistant, tmp_path: Path,
) -> None:
    await _setup(hass)
    attachment_dir = Path(hass.config.path(FILES_DIR)) / "lamp"
    attachment_dir.mkdir(parents=True, exist_ok=True)
    attachment = attachment_dir / "manual.pdf"
    attachment.write_bytes(b"%PDF-1.4\n")
    config = _config()
    config["markers"][0]["pdfs"] = [{
        "name": "Manual", "url": "/api/houseplan/content/files/lamp/manual.pdf",
    }]
    _rt, response, _ = await _candidate(hass, tmp_path, target_config=config)
    assert response["preview"]["confirmation_required"] is False
    attachment.unlink()
    connection = await _apply(hass, response)
    assert connection.result is None
    assert connection.error and connection.error[0] == "missing_content"


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
    assert layout_data["geom_pending"] == {"ground": 1.5}
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
