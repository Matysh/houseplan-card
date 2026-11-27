"""Build wheel/sdist from the integration's ONE canonical core tree.

Build tooling is an author dependency (python -m pip install build packaging
setuptools wheel), not a runtime dependency. No import of the integration,
frontend build, publication or tracked source rewrite is performed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from packaging.version import Version

ROOT = Path(__file__).resolve().parents[1]


def stage(destination: Path) -> tuple[str, dict[str, str]]:
    product_version = json.loads((ROOT / "package.json").read_text())["version"]
    version = str(Version(product_version))
    source = ROOT / "custom_components/houseplan/core"
    package = destination / "src/houseplan_core"
    package.mkdir(parents=True)
    manifest = {}
    for item in sorted(source.rglob("*.py")):
        relative = item.relative_to(source)
        target = package / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(item, target)
        manifest[relative.as_posix()] = hashlib.sha256(item.read_bytes()).hexdigest()
    (package / "distribution.json").write_text(json.dumps({
        "product_version": product_version, "version": version, "sources_sha256": manifest,
    }, indent=2) + "\n")
    shutil.copytree(ROOT / "demo/fixtures/core-compatibility", package / "compatibility_fixtures")
    shutil.copyfile(ROOT / "LICENSE", destination / "LICENSE")
    shutil.copyfile(ROOT / "docs/CORE-HOST.md", destination / "README.md")
    (destination / "pyproject.toml").write_text(f'''[build-system]
requires = ["setuptools>=77", "wheel>=0.45"]
build-backend = "setuptools.build_meta"

[project]
name = "houseplan-core"
version = "{version}"
description = "Shared House Plan plan-only commands and host ports"
readme = "README.md"
requires-python = ">=3.14"
license = "MIT"
license-files = ["LICENSE"]
dependencies = ["voluptuous>=0.15.2,<1", "Pillow>=12,<13"]

[project.urls]
Repository = "https://github.com/Matysh/houseplan-card"

[tool.setuptools.packages.find]
where = ["src"]

[tool.setuptools.package-data]
houseplan_core = ["distribution.json", "compatibility_fixtures/provenance.json", "compatibility_fixtures/*/*.zip"]
''')
    return version, manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--no-isolation", action="store_true", help="Use an already prepared build environment")
    arguments = parser.parse_args()
    arguments.out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="houseplan-core-build-") as directory:
        staged = Path(directory)
        version, manifest = stage(staged)
        command = [sys.executable, "-m", "build", "--outdir", str(arguments.out.resolve())]
        if arguments.no_isolation:
            command.append("--no-isolation")
        subprocess.run([*command, str(staged)], check=True)
        print(json.dumps({"version": version, "source_files": len(manifest), "out": str(arguments.out.resolve())}))


if __name__ == "__main__":
    main()
