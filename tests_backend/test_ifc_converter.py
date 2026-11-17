"""#1458 CLI golden documents against the actual schema and import preview."""
import copy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from custom_components.houseplan.const import PLAN_MODEL_VERSION, VERSION
from custom_components.houseplan.import_export import create_preview
from custom_components.houseplan.validation import CONFIG_SCHEMA
from custom_components.houseplan.wall_segment_model import commit_wall_segment_model

GOLDEN = Path(__file__).resolve().parent.parent / "scripts/sh3d-convert/golden"
FILES = ["ifc-synthetic.space-1.json", "ifc-synthetic.space-2.json"]


@pytest.mark.parametrize("filename", FILES)
def test_issue_1458_cli_document_passes_real_import_and_keeps_physical_geometry(filename, tmp_path):
    document = json.loads((GOLDEN / filename).read_text())
    assert document["model_version"] == PLAN_MODEL_VERSION
    assert document["transfer"] == {"plan_only": True}
    assert document["placement_manifest"] == document["content_manifest"] == []
    config = copy.deepcopy(document["payload"]["config"])
    config["model_version"] = document["model_version"]
    validated = CONFIG_SCHEMA(config)
    committed, _ = commit_wall_segment_model(validated)
    space = committed["spaces"][0]
    assert len(space["rooms"]) == 2
    assert len(space["openings"]) == 2
    assert not committed["markers"]
    walls = {w["id"]: w for w in [*space["wall_segments"], *space.get("partitions", [])]}
    for opening in space["openings"]:
        assert opening["host"]["id"] in walls
        width_m = opening["length"] * space["cell_cm"] * 240 / 100
        assert width_m == pytest.approx(.9 if opening["type"] == "door" else 1.2, abs=.001)
    runtime = SimpleNamespace(integration_version=VERSION, instance_id="ifc-target", import_previews={})
    response = create_preview(runtime, json.dumps(document).encode(), owner_id="owner", duplicate_policy="skip",
        current_config_data={"config": {"spaces": [], "markers": []}, "rev": 0},
        current_layout_data={"layout": {}, "rev": 0}, config_root=tmp_path)
    assert response["token"]
    assert response["preview"]["counts"]["rooms"] == 2
    assert response["preview"]["counts"]["markers"] == 0
    assert "full_replaces_current" not in response["preview"]["warnings"]


def test_issue_1458_report_accounts_for_every_source_element():
    report = json.loads((GOLDEN / "ifc-synthetic.report.json").read_text())
    assert report["sourceCounts"] == {"floor": 2, "wall": 18, "room": 4, "door": 2, "window": 2}
    for kind, count in report["sourceCounts"].items():
        assert sum(report["outcomes"][outcome][kind] for outcome in ["transferred", "partial", "skipped"]) == count
    assert report["outcomes"]["skipped"]["room"] == 0
