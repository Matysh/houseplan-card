"""Install both distribution paths into clean environments and run conformance.

Use after build_core_package.py; no HA, repository namespace or test stubs may
be imported by either installed artifact. This is an author/packaging check.
"""
from __future__ import annotations

import argparse
import subprocess
import tempfile
import venv
from pathlib import Path

CHECK = '''
import asyncio, hashlib, importlib, importlib.abc, importlib.resources, importlib.util, json, pkgutil, sys, tempfile
from pathlib import Path
assert importlib.util.find_spec("homeassistant") is None
assert importlib.util.find_spec("custom_components") is None
class NoAdapters(importlib.abc.MetaPathFinder):
    def find_spec(self, name, path=None, target=None):
        if name.split(".")[0] in {"homeassistant", "custom_components"}:
            raise AssertionError("installed package escaped: " + name)
sys.meta_path.insert(0, NoAdapters())
import houseplan_core
root = Path(houseplan_core.__file__).parent
info = json.loads((root / "distribution.json").read_text())
assert info["product_version"] and info["version"]
for name, digest in info["sources_sha256"].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
for module in pkgutil.walk_packages(houseplan_core.__path__, "houseplan_core."):
    importlib.import_module(module.name)
from houseplan_core.conformance import ReferenceAdapter, run, run_house
from houseplan_core.conformance_example import JsonClientAdapter
with tempfile.TemporaryDirectory() as folder:
    for factory in (ReferenceAdapter, JsonClientAdapter):
        assert len(asyncio.run(run(factory, Path(folder)))) == 9
        assert len(asyncio.run(run_house(factory, Path(folder) / "house"))) == 1
assert "homeassistant" not in sys.modules and "custom_components" not in sys.modules
print(json.dumps({"installed": str(root), "version": info["version"], "source_files": len(info["sources_sha256"]), "conformance": 18, "house_conformance": 2}))
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, required=True)
    arguments = parser.parse_args()
    wheel, = arguments.dist.resolve().glob("*.whl")
    sdist, = arguments.dist.resolve().glob("*.tar.gz")
    with tempfile.TemporaryDirectory(prefix="houseplan-core-install-") as temporary:
        root = Path(temporary)
        for name, artifact in (("wheel", wheel), ("sdist", sdist)):
            environment = root / name
            venv.EnvBuilder(with_pip=True).create(environment)
            python = environment / ("Scripts/python.exe" if __import__("os").name == "nt" else "bin/python")
            subprocess.run([str(python), "-m", "pip", "install", "--disable-pip-version-check", str(artifact)],
                           cwd=root, check=True)
            subprocess.run([str(python), "-I", "-c", CHECK], cwd=root, check=True)


if __name__ == "__main__":
    main()
