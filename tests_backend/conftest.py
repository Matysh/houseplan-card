"""Shared test config. HA-harness tests (test_ha_*.py) are skipped when
homeassistant is not installed: the local sandbox has Python 3.10, CI runs them
on 3.13 with pytest-homeassistant-custom-component."""

try:
    import homeassistant  # noqa: F401
    HAS_HA = True
except ImportError:
    HAS_HA = False

collect_ignore_glob = [] if HAS_HA else ["test_ha_*.py"]

# Пакет интеграции без Home Assistant не импортируется: его __init__.py тянет
# весь HA. Чистым тестам нужны только подмодули, поэтому в окружении БЕЗ HA
# родительские пакеты подменяются пустышками с настоящим __path__ — подмодули
# после этого читаются, а тяжёлый __init__.py не исполняется.
#
# Подмена живёт здесь, а не в тестах, и это главное решение issue #394. Раньше
# её ставили сами тесты, под условием «если ещё не импортирован», и в CI она не
# срабатывала лишь потому, что настоящий пакет успевал импортироваться из файла,
# который идёт раньше по алфавиту. Корректность HA-харнесса держалась на именах
# файлов в каталоге; чем это кончается, показал #389 — 85 тестов упали с голым
# `assert False`, потому что HA получил пустышку вместо интеграции.
#
# Теперь развилка явная и по единственному честному признаку: есть Home
# Assistant — работаем с настоящим пакетом и ничего не подменяем; нет — значит
# HA-тесты и так пропущены, и подменять безопасно, ломать нечего.
if not HAS_HA:
    import sys
    import types
    from pathlib import Path

    _ROOT = Path(__file__).resolve().parent.parent
    for _name, _path in (
        ("custom_components", _ROOT / "custom_components"),
        ("custom_components.houseplan", _ROOT / "custom_components" / "houseplan"),
    ):
        if _name not in sys.modules:
            _module = types.ModuleType(_name)
            _module.__path__ = [str(_path)]
            sys.modules[_name] = _module

if HAS_HA:
    import shutil
    from pathlib import Path

    import pytest

    @pytest.fixture(autouse=True)
    def _clean_persistent_houseplan_test_files(request):
        """Do not let warm HA harness runs exhaust the shared file quota."""
        if "hass" in request.fixturenames:
            hass = request.getfixturevalue("hass")
            for relative in ("houseplan/plans", "houseplan/files"):
                shutil.rmtree(Path(hass.config.path(relative)), ignore_errors=True)
        yield
