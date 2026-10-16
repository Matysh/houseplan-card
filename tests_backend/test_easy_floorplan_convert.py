"""#937 current-model output meets the real backend, not a lookalike schema."""
import json
from pathlib import Path

import pytest

from custom_components.houseplan.const import PLAN_MODEL_VERSION
from custom_components.houseplan.validation import CONFIG_SCHEMA
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model

GOLDEN = Path(__file__).resolve().parent.parent / "scripts/sh3d-convert/golden"
FILES = sorted(GOLDEN.glob("easy-*.space-*.json"))
assert FILES, "Easy converter fixtures must not disappear"


@pytest.mark.parametrize("path", FILES, ids=lambda path: path.name)
def test_issue_937_easy_document_uses_the_actual_current_schema(path):
    doc = json.loads(path.read_text())
    assert doc["model_version"] == PLAN_MODEL_VERSION
    assert "transfer" not in doc
    config = {**doc["payload"]["config"], "model_version": doc["model_version"]}
    accepted = CONFIG_SCHEMA(config)
    normalized, _ = commit_wall_segment_model(accepted)
    CONFIG_SCHEMA(normalized)
    assert normalized["spaces"][0]["wall_segments"] == accepted["spaces"][0]["wall_segments"]
    assert len(accepted["markers"]) == len(doc["placement_manifest"]) > 0
    assert all(marker["binding"].startswith("entity:") or marker["binding"] == "virtual" for marker in accepted["markers"])
