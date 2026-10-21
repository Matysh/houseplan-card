"""#1002: exercise the actual JSON/ZIP full and space backup boundaries."""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from custom_components.houseplan.backup_archive import build_archive, read_archive
from custom_components.houseplan.import_export import create_export, parse_document
from tests_backend.test_ha_import_export import _config


@pytest.mark.parametrize("kind", ["full", "space"])
@pytest.mark.parametrize("opacity", [0, 0.7, 1])
def test_vacuum_appearance_survives_json_and_full_zip(tmp_path: Path, kind: str, opacity: float):
    config = _config()
    style = {"trail_color": "#64B5F6", "trail_opacity": opacity}
    config["markers"][0]["vacuum"] = style
    document, _ = create_export(SimpleNamespace(instance_id="ink"), {"config": config},
        {"layout": {}}, kind=kind, space_id="ground" if kind == "space" else None,
        card_version="review", config_root=tmp_path)
    parsed = parse_document(json.dumps(document).encode())
    assert parsed["payload"]["config"]["markers"][0]["vacuum"] == style
    if kind != "full":  # Only full backups use ZIP; space backups remain JSON.
        return
    archive = tmp_path / "ink.zip"
    build_archive(archive, document, tmp_path, {})
    restored = read_archive(archive, tmp_path / "restored").document
    assert restored["payload"]["config"]["markers"][0]["vacuum"] == style
