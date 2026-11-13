"""#1391: exercise the real package entry outside pytest's import namespace."""
from pathlib import Path
import subprocess
import sys


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


def test_every_entrypoint_loads_the_adapter_through_import_executor():
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
        async def async_add_import_executor_job(self, target, name):
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
    assert await parent.async_unload_entry(hass, entry) is True
    await parent.async_remove_entry(hass, entry)
    await parent._async_flush_runtime(hass, entry)
    assert len(calls)==10 and calls[::2]==["import"]*5
    assert calls[3]==(hass, entry)
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
