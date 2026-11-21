"""Install both distribution paths into clean environments and run conformance.

Use after build_core_package.py; no HA, repository namespace or test stubs may
be imported by either installed artifact. This is an author/packaging check.
"""
from __future__ import annotations

import argparse
import os
import shutil
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
    parser.add_argument("--wheel-only", action="store_true")
    parser.add_argument("--external-adapter", action="store_true")
    arguments = parser.parse_args()
    wheel, = arguments.dist.resolve().glob("*.whl")
    distributions = [("wheel", wheel)]
    if not arguments.wheel_only:
        sdist, = arguments.dist.resolve().glob("*.tar.gz")
        distributions.append(("sdist", sdist))
    with tempfile.TemporaryDirectory(prefix="houseplan-core-install-") as temporary:
        root = Path(temporary)
        for name, artifact in distributions:
            environment = root / name
            venv.EnvBuilder(with_pip=True).create(environment)
            python = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
            subprocess.run([str(python), "-m", "pip", "install", "--disable-pip-version-check", str(artifact)],
                           cwd=root, check=True)
            subprocess.run([str(python), "-I", "-c", CHECK], cwd=root, check=True)
            if name == "wheel" and arguments.external_adapter:
                fixture = Path(__file__).with_name("core_external_conformance_fixture.py")
                shutil.copyfile(fixture, root / fixture.name)
                conformance = [str(python), "-m", "houseplan_core.conformance", "--factory",
                               f"{fixture.stem}:create_adapter"]
                env = {key: value for key, value in os.environ.items()
                       if key not in {"PYTHONPATH", "PYTHONHOME", "HP_TEST_WRONG_EXTERNAL_REPLY"}}
                subprocess.run(conformance, cwd=root, env=env, check=True, timeout=90)
                wrong = subprocess.run(conformance, cwd=root, capture_output=True, text=True, timeout=90,
                                       env={**env, "HP_TEST_WRONG_EXTERNAL_REPLY": "1"})
                if wrong.returncode == 0 or "TypeError: 'NoneType' object is not subscriptable" not in wrong.stderr:
                    raise RuntimeError("External bad-reply control did not reach conformance")


if __name__ == "__main__":
    main()
