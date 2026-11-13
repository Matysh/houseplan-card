"""#1391: exercise the real package entry outside pytest's import namespace."""
from pathlib import Path
import ast
import importlib.util
import shutil
import subprocess
import sys

import pytest


ROOT = Path(__file__).resolve().parents[1]


def _isolated(code: str) -> None:
    result = subprocess.run(
        [sys.executable, "-I", "-c", code, str(ROOT)],
        capture_output=True, text=True, timeout=30, check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_real_parent_and_core_import_without_loading_ha():
    _isolated('''
import importlib.abc
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
class NoHomeAssistant(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == "homeassistant" or fullname.startswith("homeassistant."):
            raise AssertionError("eager HA import: " + fullname)
sys.meta_path.insert(0, NoHomeAssistant())
import custom_components.houseplan as parent
import custom_components.houseplan.core as core
assert Path(parent.__file__).resolve() == Path(sys.argv[1], "custom_components/houseplan/__init__.py").resolve()
assert callable(parent.async_setup) and callable(parent.async_setup_entry)
assert "custom_components.houseplan.ha_integration" not in sys.modules
assert not any(name == "homeassistant" or name.startswith("homeassistant.") for name in sys.modules)
assert core.__file__
''')


def test_first_load_uses_executor_and_shutdown_reuses_the_completed_adapter():
    _isolated('''
import asyncio
import importlib
import sys
from types import SimpleNamespace
sys.path.insert(0, sys.argv[1])
import custom_components.houseplan as parent
async def run():
    calls=[]
    class Host:
        closed = False
        async def async_add_import_executor_job(self, target, name):
            assert not self.closed, "executor already stopped"
            assert target is importlib.import_module
            assert name == "custom_components.houseplan.ha_integration"
            calls.append("import")
            async def yes(*args):
                calls.append(args)
                return True
            return SimpleNamespace(async_setup=yes, async_setup_entry=yes,
                async_unload_entry=yes, async_remove_entry=yes, _async_flush_runtime=yes)
    hass, entry=Host(), object()
    assert await parent.async_setup(hass, {}) is True
    assert await parent.async_setup_entry(hass, entry) is True
    hass.closed = True
    assert await parent.async_unload_entry(hass, entry) is True
    await parent.async_remove_entry(hass, entry)
    await parent._async_flush_runtime(hass, entry)
    assert len(calls)==6 and calls.count("import")==1
    assert calls[2]==(hass, entry)
    assert "custom_components.houseplan.ha_integration" not in sys.modules
asyncio.run(run())
''')


def test_old_host_uses_executor_not_blocking_direct_import():
    _isolated('''
import asyncio
import importlib
import sys
sys.path.insert(0, sys.argv[1])
import custom_components.houseplan as parent
class OldHost:
    async def async_add_executor_job(self, target, name):
        assert target is importlib.import_module
        assert name == "custom_components.houseplan.ha_integration"
        return "through-executor"
assert asyncio.run(parent._adapter(OldHost())) == "through-executor"
''')


def test_failed_cold_import_is_not_cached():
    _isolated('''
import asyncio
import sys
sys.path.insert(0, sys.argv[1])
import custom_components.houseplan as parent
class Host:
    calls = 0
    async def async_add_import_executor_job(self, target, name):
        self.calls += 1
        if self.calls == 1:
            raise ImportError("cold import failed")
        return self
async def run():
    host = Host()
    try:
        await parent._adapter(host)
    except ImportError as error:
        assert str(error) == "cold import failed"
    else:
        raise AssertionError("failed import must propagate")
    assert parent._HA_ADAPTER is None
    assert await parent._adapter(host) is host
    assert await parent._adapter(host) is host
    assert host.calls == 2
asyncio.run(run())
''')


def _import_problems(source: str, module: str) -> list[str]:
    """Inspect function-local imports too; every core owner is scanned."""
    prefix = "custom_components.houseplan.core"
    tree = ast.parse(source)
    problems = []

    def check(name):
        if name != prefix and not name.startswith(prefix + "."):
            if name.split(".")[0] not in sys.stdlib_module_names | {"voluptuous", "PIL", "__future__"}:
                problems.append(name)

    dynamic_names = {"__import__"}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                check(alias.name)
        elif isinstance(node, ast.ImportFrom):
            name = node.module or ""
            if node.level:
                try:
                    name = importlib.util.resolve_name("." * node.level + name, module.rpartition(".")[0])
                except ImportError:
                    problems.append("relative escape")
                    continue
            check(name)
            if name == "importlib":
                dynamic_names.update(alias.asname or alias.name for alias in node.names if alias.name == "import_module")
        elif isinstance(node, ast.Call):
            function = node.func
            name = function.id if isinstance(function, ast.Name) else function.attr if isinstance(function, ast.Attribute) else ""
            if name in {"eval", "exec"}:
                problems.append("dynamic code")
            if name in dynamic_names | {"import_module", "__import__"}:
                if not node.args or not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str):
                    problems.append("nonliteral dynamic import")
                elif node.args[0].value.startswith("."):
                    # No dynamic relative loader is needed by this core. Reject
                    # rather than pretending an unknown package is safe.
                    problems.append("dynamic relative import")
                else:
                    check(node.args[0].value)
    return problems


def test_core_has_no_static_or_dynamic_adapter_dependencies():
    core = ROOT / "custom_components/houseplan/core"
    files = sorted(core.rglob("*.py"))
    assert len(files) >= 45
    for path in files:
        module = ".".join(path.relative_to(ROOT).with_suffix("").parts)
        assert not _import_problems(path.read_text(), module), str(path)


@pytest.mark.parametrize("source", [
    "import homeassistant.core",
    "from custom_components.houseplan.store import HouseplanData",
    "from .. import store",
    "def lazy():\n from ..store import HouseplanData",
    "def lazy():\n import homeassistant.core",
    "import importlib\nimportlib.import_module('custom_components.houseplan.store')",
    "from importlib import import_module as load\nload('homeassistant.core')",
    "__import__('homeassistant.core')",
    "import importlib\nimportlib.import_module(name)",
    "exec(source)",
])
def test_core_dependency_guard_refuses_negative_fixtures(source):
    assert _import_problems(source, "custom_components.houseplan.core.probe")


def test_every_core_module_and_portable_roundtrip_without_ha_or_parent_stubs(tmp_path):
    """A site-free interpreter has real Voluptuous, but no installed HA/Pillow.

    Copy only the actual pure dependency, not a fake HA package. This catches
    missing dependencies independently of whether the main pytest venv has HA.
    """
    dependency = importlib.util.find_spec("voluptuous")
    shutil.copytree(Path(dependency.origin).parent, tmp_path / "voluptuous")
    code = '''
import importlib
import importlib.abc
import importlib.util
import json
import pkgutil
import sys
import tempfile
import threading
from pathlib import Path
from types import SimpleNamespace
sys.path[:0] = [sys.argv[1], sys.argv[2]]
sys.dont_write_bytecode = True
assert importlib.util.find_spec("homeassistant") is None
class NoAdapters(importlib.abc.MetaPathFinder):
    def find_spec(self, name, path=None, target=None):
        if name == "homeassistant" or name.startswith("homeassistant."):
            raise AssertionError(name)
        if name.startswith("custom_components.houseplan.") and not name.startswith("custom_components.houseplan.core"):
            raise AssertionError("adapter dependency: " + name)
sys.meta_path.insert(0, NoAdapters())
importing = True
threads = {id(thread) for thread in threading.enumerate()}
def audit(event, args):
    if not importing:
        return
    if event.startswith("socket.") or event in {"os.mkdir", "os.remove", "os.rename", "os.rmdir", "subprocess.Popen"}:
        raise AssertionError("import side effect: " + event)
    if event == "open":
        mode = args[1]
        flags = args[2]
        if isinstance(mode, str) and any(char in mode for char in "wax+") or flags & 0x3:
            raise AssertionError("import write: " + str(args[0]))
sys.addaudithook(audit)
import custom_components.houseplan as parent
import custom_components.houseplan.core as core
for item in pkgutil.walk_packages(core.__path__, core.__name__ + "."):
    importlib.import_module(item.name)
assert {id(thread) for thread in threading.enumerate()} == threads
importing = False
from custom_components.houseplan.core import validation, import_export, wall_segment_model, backup_archive
config = {"spaces": [{"id": "f", "title": "Floor", "view_box": [0,0,1,1], "rooms": [],
    "partitions": [{"id": "p", "a": [0,0], "b": [1,0], "cm": 10}]}], "markers": [], "settings": {}}
config, _ = wall_segment_model.commit_wall_segment_model(config)
assert validation.CONFIG_SCHEMA(config)["model_version"] == 11
runtime = SimpleNamespace(instance_id="fixture", integration_version="host-fixture", import_previews={})
with tempfile.TemporaryDirectory() as folder:
    root = Path(folder)
    document, _ = import_export.create_export(runtime, {"config": config, "rev": 7}, {"layout": {}, "rev": 3},
        kind="full", space_id=None, card_version="fixture", config_root=root)
    assert document["integration_version"] == "host-fixture"
    parsed = import_export.parse_document(json.dumps(document).encode())
    assert parsed["payload"] == document["payload"]
    archive = root / "backup.zip"
    backup_archive.build_archive(archive, document, root, {})
    staging = root / "staging"
    staging.mkdir()
    restored = backup_archive.read_archive(archive, staging)
    assert restored.document["payload"] == document["payload"]
assert callable(parent.async_setup) and parent.__file__
assert not any(n == "homeassistant" or n.startswith("homeassistant.") for n in sys.modules)
'''
    result = subprocess.run([sys.executable, "-I", "-S", "-c", code, str(ROOT), str(tmp_path)],
                            capture_output=True, text=True, timeout=30, check=False)
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize("name,symbol", [
    ("plan_graph_exact", "GraphError"), ("import_export", "ImportFailure"),
    ("decor_assets", "DecorAssetError"), ("wall_node_move", "NodeMoveError"),
    ("wall_segment_model", "WallSegmentMigrationError"),
])
def test_historical_paths_keep_core_exception_identity(name, symbol):
    import importlib
    historical = importlib.import_module(f"custom_components.houseplan.{name}")
    owner = importlib.import_module(f"custom_components.houseplan.core.{name}")
    assert historical is owner
    assert getattr(historical, symbol) is getattr(owner, symbol)


def test_dependency_guard_checks_transitive_fixture_owners():
    fixtures = {
        "custom_components.houseplan.core.entry": "from .middle import prepare",
        "custom_components.houseplan.core.middle": "from ..store import HouseplanData",
    }
    problems = {name: _import_problems(source, name) for name, source in fixtures.items()}
    assert not problems["custom_components.houseplan.core.entry"]
    assert problems["custom_components.houseplan.core.middle"]
