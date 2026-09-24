"""Shared test config. HA-harness tests (test_ha_*.py) are NOT collected when
homeassistant is not installed (collect_ignore_glob, not a skip); pytest then
prints how many files/tests were left out (#630). The local sandbox has no HA,
CI runs them on 3.13 with pytest-homeassistant-custom-component."""

import re
from pathlib import Path

try:
    import homeassistant  # noqa: F401
    HAS_HA = True
except ImportError:
    HAS_HA = False

collect_ignore_glob = [] if HAS_HA else ["test_ha_*.py"]

# Без Home Assistant файлы test_ha_*.py не собираются вовсе (это не skip: в
# итоговой строке pytest их нет ни в passed, ни в skipped), и зелёный локальный
# прогон выглядел проверкой всего backend (#630). Поэтому число несобранного
# считается здесь же, по тому же glob, и печатается в шапке и в итоге прогона.
# Счёт динамический: новый HA-файл или тест меняет число без правки этого файла.
HA_HARNESS_GLOB = "test_ha_*.py"
_TEST_DEF = re.compile(r"^[ \t]*(?:async[ \t]+)?def[ \t]+test_\w*[ \t]*\(", re.MULTILINE)


def ha_harness_inventory(directory: Path) -> tuple[int, int]:
    """(файлов, тестовых функций) под HA_HARNESS_GLOB в каталоге ``directory``.

    Тест — это объявление ``def test_*``/``async def test_*`` на любом уровне
    вложенности (методы классов тоже); параметризация не размножает число —
    считается то, что написано в исходнике, а не то, что соберёт pytest.
    """
    files = sorted(directory.glob(HA_HARNESS_GLOB))
    tests = sum(len(_TEST_DEF.findall(path.read_text(encoding="utf-8"))) for path in files)
    return len(files), tests


def ha_harness_warning(files: int, tests: int) -> str:
    return (
        f"HA harness NOT collected: {files} test_ha_*.py files ({tests} tests) "
        "were ignored because homeassistant is not importable; a green result "
        "here does not cover them. Canon: Linux CI or WSL "
        "(bash scripts/wsl-setup.sh --verify)."
    )


HA_HARNESS_IGNORED = None if HAS_HA else ha_harness_inventory(Path(__file__).resolve().parent)


def pytest_report_header(config):
    if HA_HARNESS_IGNORED is None:
        return None
    return ha_harness_warning(*HA_HARNESS_IGNORED)


def pytest_terminal_summary(terminalreporter, exitstatus, config):
    # Шапку `-q` не печатает, итог печатается всегда — предупреждение в нём
    # видно и в коротком прогоне `python -m pytest tests_backend -q`.
    if HA_HARNESS_IGNORED is None:
        return
    terminalreporter.write_sep("=", "HA harness not collected", yellow=True, bold=True)
    terminalreporter.write_line(ha_harness_warning(*HA_HARNESS_IGNORED), yellow=True)

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

    import pytest

    @pytest.fixture(autouse=True)
    def _clean_persistent_houseplan_test_files(request):
        """Do not let warm HA harness runs exhaust the shared file quota."""
        if "hass" in request.fixturenames:
            hass = request.getfixturevalue("hass")
            for relative in ("houseplan/plans", "houseplan/files", "houseplan/assets"):
                shutil.rmtree(Path(hass.config.path(relative)), ignore_errors=True)
        yield
