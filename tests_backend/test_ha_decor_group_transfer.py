"""#1038: ordinary stored group results retain six-kind data through transfer."""
from __future__ import annotations

import copy
import hashlib
import io
import json
from types import SimpleNamespace

import pytest
from PIL import Image

from custom_components.houseplan.backup_archive import build_archive, read_archive
from custom_components.houseplan.import_export import (
    create_export,
    create_preview,
    get_candidate,
    parse_document,
    prepare_apply,
)
from tests_backend.test_ha_import_export import _config


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    yield


@pytest.mark.parametrize("mode", ["full", "space", "plan-only", "zip"])
def test_six_kind_group_results_round_trip_without_group_schema(tmp_path, mode):
    source, target = tmp_path / "source", tmp_path / "target"
    source.mkdir()
    target.mkdir()
    raw = io.BytesIO()
    Image.new("RGB", (2, 2), "#334455").save(raw, format="PNG")
    image = raw.getvalue()
    aid = hashlib.sha256(image).hexdigest()
    assets = source / "houseplan" / "assets"
    assets.mkdir(parents=True)
    (assets / f"{aid}.png").write_bytes(image)
    (assets / f"{aid}.json").write_text(json.dumps({"mime": "image/png"}))
    # Literal post-move/style records: native and TS units prove the operation;
    # this witness exercises real backend validation/serialization/import.
    decor = [
        {"id": "line", "kind": "line", "x1": .225, "y1": .325, "x2": .525, "y2": .625,
         "color": "#123456", "opacity": .2, "width_cm": 3, "line_style": "dashed"},
        {"id": "rect", "kind": "rect", "x": .325, "y": .425, "w": .2, "h": .1, "angle": 17,
         "fill": False, "fill_color": "#112233", "fill_opacity": .6},
        {"id": "ellipse", "kind": "ellipse", "x": .525, "y": .625, "w": .2, "h": .15,
         "angle": -23, "fill": True, "color": "#abcdef", "opacity": .7},
        {"id": "text", "kind": "text", "x": .625, "y": .725, "text": "Room {sensor.temp}",
         "size_cm": 16, "angle": 31},
        {"id": "furniture", "kind": "furniture", "x": .425, "y": .525, "w": .2, "h": .15,
         "symbol": "sofa", "angle": 19, "flip_h": True, "opacity": .4},
        {"id": "image", "kind": "image", "x": .725, "y": .225, "w": .1, "h": .2,
         "asset_id": aid, "angle": -13, "flip_v": True, "opacity": .3},
    ]
    for i, row in enumerate(decor):
        row["future"] = {"nested": [i, True, {"keep": "complete"}]}
    config = _config()
    config["spaces"][0]["decor"] = decor
    config["markers"] = []
    before = copy.deepcopy(config)
    kind = "space" if mode in {"space", "plan-only"} else "full"
    document, _ = create_export(
        SimpleNamespace(instance_id="source"), {"config": config, "rev": 2}, {"layout": {}, "rev": 3},
        kind=kind, space_id="ground" if kind == "space" else None, plan_only=mode == "plan-only",
        card_version="group-proof", config_root=source,
    )
    expected = copy.deepcopy(decor)
    if mode == "plan-only":
        # #167 is intentionally a closed privacy projection, not a lossless
        # backup: its established contract omits unknown fields/live HA refs.
        for row in expected:
            row.pop("future")
        expected[3]["text"] = "Room —"
    assert document["payload"]["config"]["spaces"][0]["decor"] == expected
    assert config == before
    if mode == "zip":
        archive = tmp_path / "group.zip"
        build_archive(archive, document, source, {})
        portable = read_archive(archive, target)
        assert [path.read_bytes() for path in portable.blobs.values()] == [image]
        decoded = portable.document
    else:
        decoded = parse_document(json.dumps(document).encode())
    runtime = SimpleNamespace(instance_id="target", import_previews={})
    preview = create_preview(
        runtime, json.dumps(decoded).encode(), owner_id="alice", duplicate_policy="skip",
        current_config_data={"config": {"spaces": [], "markers": []}, "rev": 0},
        current_layout_data={"layout": {}, "rev": 0}, config_root=target,
    )
    candidate = get_candidate(runtime, preview["token"], "alice")
    imported, _, _ = prepare_apply(candidate, {"spaces": [], "markers": []}, {}, confirm_missing_content=True)
    actual = imported["spaces"][0]["decor"]
    # One-space import allocates new IDs by its existing contract; all payload
    # fields, relative order, shared asset identity and optional absence survive.
    assert [{k: v for k, v in row.items() if k != "id"} for row in actual] == [
        {k: v for k, v in row.items() if k != "id"} for row in expected
    ]
    assert len({row["id"] for row in actual}) == 6
    assert all("group" not in row and "selected" not in row for row in actual)
