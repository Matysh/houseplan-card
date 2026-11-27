"""Recreate synthetic archives with the actual pinned stable core exporters.

No HA imports, owner data, current exporter or hand-stamped version is used.
Fetch v1.86.0/v1.86.1 first, then run this script with Python 3.14 and core deps.
The fixture clock is fixed; archives must reproduce byte-for-byte.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import importlib
import io
import json
import subprocess
import sys
import tarfile
import tempfile
import types
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSIONS = {
    "1.86.0": "2725feedd276c5c1c19d9223c99b1adcdefefaa1",
    "1.86.1": "f175b7e00d8535149c61c2d28a922620a3a70928",
}
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


class FixtureClock(datetime):
    @classmethod
    def now(cls, tz=None):
        return cls(2026, 11, 27, tzinfo=UTC).astimezone(tz)


def generate(core, destination, version):
    package = types.ModuleType("fixture_core")
    package.__path__ = [str(core)]
    sys.modules[package.__name__] = package
    house = importlib.import_module("fixture_core.house_document")
    portable = importlib.import_module("fixture_core.import_export")
    house.datetime = portable.datetime = FixtureClock
    house_archive = importlib.import_module("fixture_core.house_archive")
    backup_archive = importlib.import_module("fixture_core.backup_archive")
    config = {"spaces": [], "markers": [
        {"id": "synthetic_marker", "binding": "virtual", "name": "Synthetic device"}],
        "settings": {"north_deg": 25}}
    for index in range(2):
        config["spaces"].append({"id": f"floor{index}", "title": f"Synthetic floor {index}",
            "view_box": [0, 0, 1, 1],
            "plan_url": "/api/houseplan/content/plans/_/compat.png",
            "rooms": [{"id": f"room{index}", "name": f"Synthetic room {index}",
                "poly": [[0, 0], [1, 0], [1, 1], [0, 1]]}],
            "stairs": [{"id": f"stair{index}", "kind": "straight", "x": .5, "y": .5,
                "angle": 0, "direction": "forward", "target_space_id": f"floor{1-index}",
                "length": .3, "width": .2}]})
    positions = {"rl_room0": {"s": "floor0", "x": .2, "y": .3, "k": 1.2},
        "synthetic_marker": {"s": "floor0", "x": .4, "y": .6}}
    identity = types.SimpleNamespace(instance_id="synthetic-core-compatibility",
        integration_version=version)
    config_data, layout_data = {"config": config, "rev": 7}, {"layout": positions, "rev": 3}
    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="hp-compat-content-") as directory:
        root = Path(directory)
        plan = root / "houseplan/plans/compat.png"
        plan.parent.mkdir(parents=True)
        plan.write_bytes(PNG)
        document, _ = house.export_document(identity, config_data, layout_data, version)
        path = destination / "plan-transfer.zip"
        manifest = house_archive.build_archive(path, document, lambda ref: (PNG, ".png"))
        assert manifest["complete"]
        house_archive.read_archive(path)  # producer's own reader must accept it too
        document, _ = portable.create_export(identity, config_data, layout_data,
            kind="full", space_id=None, card_version=version, config_root=root)
        path = destination / "full-backup.zip"
        manifest = backup_archive.build_archive(path, document, root, {})
        assert manifest["complete"]
        stage = root / "private-stage"
        stage.mkdir()
        backup_archive.read_archive(path, stage)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--core", type=Path)
    parser.add_argument("--version", choices=VERSIONS)
    parser.add_argument("--out", type=Path, default=ROOT / "demo/fixtures/core-compatibility")
    args = parser.parse_args()
    if args.core:
        generate(args.core, args.out, args.version)
        return
    records = []
    for version in VERSIONS:
        ref = "v" + version
        commit = subprocess.check_output(["git", "rev-parse", ref + "^{commit}"], cwd=ROOT, text=True).strip()
        assert commit == VERSIONS[version], "Stable tag moved from its pinned producer"
        metadata = json.loads(subprocess.check_output(["git", "show", commit + ":package.json"], cwd=ROOT))
        assert metadata["version"] == version
        with tempfile.TemporaryDirectory(prefix="hp-compat-source-") as directory:
            root = Path(directory)
            raw = subprocess.check_output(["git", "archive", commit, "custom_components/houseplan/core"], cwd=ROOT)
            with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
                archive.extractall(root, filter="data")
            core = root / "custom_components/houseplan/core"
            destination = args.out / ref
            subprocess.run([sys.executable, str(Path(__file__).resolve()), "--core", str(core),
                "--version", version, "--out", str(destination)], check=True)
            for name in ("plan-transfer.zip", "full-backup.zip"):
                path = destination / name
                records.append({"path": f"{ref}/{name}", "producerTag": ref,
                    "producerCommit": commit, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    (args.out / "provenance.json").write_text(json.dumps({
        "schema": 1, "synthetic": True, "clock": "2026-11-27T00:00:00+00:00",
        "generator": "tools/generate_core_compatibility_fixtures.py", "archives": records}, indent=2) + "\n")


if __name__ == "__main__":
    main()
