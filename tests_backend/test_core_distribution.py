"""The package staging manifest is exact; full clean installs are author smoke."""
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Run in an isolated interpreter, outside the source checkout. The same probe
# can point at a real installed wheel (passing the extra no-HA assertion).
CORE_IMPORT_PROBE = r"""
import importlib
import importlib.util
import json
import os
import sys
from pathlib import Path

package_parent = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(package_parent))
if "--no-ha" in sys.argv:
    assert importlib.util.find_spec("homeassistant") is None
manifest = json.loads((package_parent / "houseplan_core/distribution.json").read_text())
modules = set()
for relative in manifest["sources_sha256"]:
    parts = Path(relative).with_suffix("").parts
    modules.add(".".join(("houseplan_core", *(parts[:-1] if parts[-1] == "__init__" else parts))))

def read_only_imports(event, args):
    if event == "import" and args[0].partition(".")[0] in {"homeassistant", "custom_components"}:
        raise RuntimeError("core import crossed into HA")
    if event == "open" and args[2] & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND):
        raise RuntimeError("core import attempted a file write")
    if event.startswith(("socket.", "subprocess.")) or event in {
        "os.mkdir", "os.remove", "os.rename", "os.rmdir", "os.link",
        "os.symlink", "os.chmod", "os.truncate", "os.utime", "os.system",
    }:
        raise RuntimeError(f"core import attempted an external effect: {event}")

sys.addaudithook(read_only_imports)
for module in sorted(modules):
    imported = importlib.import_module(module)
    assert Path(imported.__file__).resolve().is_relative_to(package_parent)
assert not any(name.partition(".")[0] in {"homeassistant", "custom_components"} for name in sys.modules)
print(f"{len(modules)} core modules imported without external effects")
"""


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


def test_distribution_imports_all_modules_without_ha_or_external_effects(tmp_path):
    spec = importlib.util.spec_from_file_location("build_core_package", ROOT / "tools/build_core_package.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    builder.stage(tmp_path)
    subprocess.run(
        [sys.executable, "-I", "-B", "-c", CORE_IMPORT_PROBE, str(tmp_path / "src")],
        check=True,
        cwd=tmp_path,
        capture_output=True,
        text=True,
        timeout=30,
    )
