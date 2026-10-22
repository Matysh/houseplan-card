"""#1022 picture-elements output meets the real backend: backdrop, markers, labels, no geometry."""
import json
from pathlib import Path

import pytest

from custom_components.houseplan.const import PLAN_MODEL_VERSION
from custom_components.houseplan.validation import CONFIG_SCHEMA
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model

GOLDEN = Path(__file__).resolve().parent.parent / "scripts/sh3d-convert/golden"
FILES = sorted(GOLDEN.glob("picture-*.space-*.json"))
assert FILES, "picture-elements converter fixtures must not disappear"


@pytest.mark.parametrize("path", FILES, ids=lambda path: path.name)
def test_issue_1022_picture_document_uses_the_actual_current_schema(path):
    doc = json.loads(path.read_text(encoding="utf-8"))
    assert doc["model_version"] == PLAN_MODEL_VERSION
    assert "transfer" not in doc, "an ordinary space with devices, never plan-only"
    config = {**doc["payload"]["config"], "model_version": doc["model_version"]}
    accepted = CONFIG_SCHEMA(config)
    normalized, _ = commit_wall_segment_model(accepted)
    CONFIG_SCHEMA(normalized)
    space = normalized["spaces"][0]
    assert space["rooms"] == [] and space["wall_segments"] == [] and space["partitions"] == [], (
        "picture-elements has no geometry; the converter must not invent any"
    )
    assert space["plan_url"].startswith("/local/"), "the card image becomes the backdrop reference"
    assert space["plan_aspect"] > 0 and space["plan_scale_x"] > 0 and space["plan_scale_y"] > 0
    assert doc["content_manifest"] == [{
        "kind": "plan", "owner": "space", "owner_id": space["id"], "field": "plan_url",
        "url": space["plan_url"], "storage": "external", "exists_at_export": None,
    }]
    markers = accepted["markers"]
    assert len(markers) == len(doc["placement_manifest"]) > 0
    assert all(marker["binding"].startswith("entity:") or marker["binding"] == "virtual" for marker in markers)
    layout = doc["payload"]["layout"]
    assert set(layout) == {marker["id"] for marker in markers}
    assert all(layout[marker["id"]]["s"] == space["id"] for marker in markers)
    assert any(marker.get("value_badge", {}).get("enabled") for marker in markers), "state-badge keeps its value"
    assert any(item["kind"] == "text" and "{" in item["text"] for item in space.get("decor", [])), "state-label is live text"
