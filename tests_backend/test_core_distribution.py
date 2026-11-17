"""The package staging manifest is exact; full clean installs are author smoke."""
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_distribution_stages_the_canonical_tree_and_real_version(tmp_path):
    spec = importlib.util.spec_from_file_location("build_core_package", ROOT / "tools/build_core_package.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    version, manifest = builder.stage(tmp_path)
    package = tmp_path / "src/houseplan_core"
    owners = ROOT / "custom_components/houseplan/core"
    assert set(manifest) == {path.relative_to(owners).as_posix() for path in owners.rglob("*.py")}
    for name, digest in manifest.items():
        assert (package / name).read_bytes() == (owners / name).read_bytes()
        assert hashlib.sha256((package / name).read_bytes()).hexdigest() == digest
    metadata = json.loads((package / "distribution.json").read_text())
    assert metadata["product_version"] == json.loads((ROOT / "package.json").read_text())["version"]
    assert version == metadata["version"] == str(builder.Version(metadata["product_version"]))
    assert "requires-python = \">=3.14\"" in (tmp_path / "pyproject.toml").read_text()
    assert (tmp_path / "LICENSE").read_bytes() == (ROOT / "LICENSE").read_bytes()
