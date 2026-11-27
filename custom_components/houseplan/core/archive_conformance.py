"""Frozen stable producer archives checked by the installed core, without HA."""
from __future__ import annotations

import hashlib
import json
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Callable, cast

from . import backup_archive, house_archive
from .house_document import build_merge

PRODUCERS = {
    "v1.86.0": "2725feedd276c5c1c19d9223c99b1adcdefefaa1",
    "v1.86.1": "f175b7e00d8535149c61c2d28a922620a3a70928",
}
PNG_SHA256 = "431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460"
JsonObject = dict[str, Any]
# The existing pure helper has no annotations. State its data-only signature
# at this typed test boundary without changing the runtime importer.
_merge = cast(
    Callable[[JsonObject, JsonObject, JsonObject], tuple[JsonObject, JsonObject, JsonObject]],
    build_merge,
)


def run_archives(fixtures: Path | None = None) -> list[str]:
    """Read old producer bytes, not an archive rebuilt by the current writer.

    Full backup is a pure parser check here; it never grants a PLAN_ONLY host
    installation-backup authority. Adapter house apply is covered by run_house.
    """
    if fixtures is None:
        fixtures = Path(__file__).with_name("compatibility_fixtures")
        if not fixtures.is_dir():
            fixtures = Path(__file__).resolve().parents[3] / "demo/fixtures/core-compatibility"
    provenance = json.loads((fixtures / "provenance.json").read_text())
    assert provenance["schema"] == 1 and provenance["synthetic"] is True
    expected = {(tag, name) for tag in PRODUCERS for name in ("plan-transfer.zip", "full-backup.zip")}
    assert {(row["producerTag"], Path(row["path"]).name) for row in provenance["archives"]} == expected
    assert len(provenance["archives"]) == len(expected)
    completed = []
    for row in provenance["archives"]:
        tag = row["producerTag"]
        name = Path(row["path"]).name
        assert row["producerCommit"] == PRODUCERS[tag]
        assert row["path"] == f"{tag}/{name}"
        path = fixtures / row["path"]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == row["sha256"]
        with tempfile.TemporaryDirectory(prefix="hp-archive-conformance-") as directory:
            document: JsonObject
            manifest: JsonObject
            if name == "plan-transfer.zip":
                house_payload = house_archive.read_archive(path)
                document, manifest = house_payload.document, house_payload.manifest
            else:
                backup_payload = backup_archive.read_archive(path, Path(directory))
                document, manifest = backup_payload.document, backup_payload.manifest
                assert backup_payload.topics == {}
            assert document["integration_version"] == document["card_version"] == tag[1:]
            assert document["model_version"] == 11
            config = document["payload"]["config"]
            assert [space["title"] for space in config["spaces"]] == [
                "Synthetic floor 0", "Synthetic floor 1"]
            assert config["spaces"][0]["stairs"][0]["target_space_id"] == "floor1"
            assert document["payload"]["layout"]["rl_room0"] == {
                "s": "floor0", "x": .2, "y": .3, "k": 1.2}
            assert manifest["complete"] is True and len(manifest["images"]) == 2
            assert len(manifest["blobs"]) == 1
            with zipfile.ZipFile(path) as archive:
                for blob in manifest["blobs"]:
                    assert hashlib.sha256(archive.read(blob)).hexdigest() == PNG_SHA256
            if name == "plan-transfer.zip":
                assert document["kind"] == "house" and config["markers"] == []
                merged, layout, _ = _merge(document,
                    {"spaces": [{"id": "existing", "title": "Existing"}], "markers": [], "settings": {}}, {})
                assert merged["spaces"][0] == {"id": "existing", "title": "Existing"}
                added = merged["spaces"][1:]
                assert len(added) == 2
                assert added[0]["stairs"][0]["target_space_id"] == added[1]["id"]
                assert layout["rl_" + added[0]["rooms"][0]["id"]]["x"] == .2
            else:
                assert document["kind"] == "full"
                assert config["markers"][0]["id"] == "synthetic_marker"
            completed.append(f"{tag}/{name}: read images, geometry, labels and bindings")
    return completed
