"""#630: без Home Assistant conftest не собирает test_ha_*.py — и обязан сказать
об этом в выводе pytest, с числом файлов и тестов.

Чистый тест: Home Assistant не нужен. Обе ветки conftest (есть HA / нет HA)
проверяются в отдельном процессе pytest над временным каталогом, где
``homeassistant`` подменён модулем-заглушкой на PYTHONPATH; поэтому результат
не зависит от того, установлен ли HA в текущем окружении (CI, WSL, Windows).
"""
from __future__ import annotations

import ast
import importlib.util
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFTEST = HERE / "conftest.py"


def _load_conftest():
    # По пути и под своим именем: модуль `conftest`, уже загруженный pytest,
    # не трогается. Ветка без HA ставит пустышки пакета интеграции только если
    # их ещё нет — повторное исполнение ничего не меняет.
    spec = importlib.util.spec_from_file_location("hp_conftest_under_test", CONFTEST)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _ast_count(paths: list[Path]) -> int:
    """Независимый счёт: те же объявления, но через AST, а не регулярку."""
    total = 0
    for path in paths:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        total += sum(
            1 for node in ast.walk(tree)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and node.name.startswith("test_")
        )
    return total


FAKE_HA_ALPHA = '''\
def test_one():
    pass


async def test_two():
    pass
'''

FAKE_HA_BETA = '''\
class TestGroup:
    def test_three(self):
        pass

    async def test_four(self):
        pass


def helper_test_not_counted():
    pass
'''

PLAIN = '''\
def test_plain():
    assert True
'''


def _project(tmp_path: Path, *, ha_importable: bool) -> tuple[Path, dict[str, str]]:
    project = tmp_path / "project"
    tests = project / "tests_backend"
    tests.mkdir(parents=True)
    shutil.copyfile(CONFTEST, tests / "conftest.py")
    (tests / "test_ha_alpha.py").write_text(FAKE_HA_ALPHA, encoding="utf-8")
    (tests / "test_ha_beta.py").write_text(FAKE_HA_BETA, encoding="utf-8")
    (tests / "test_plain.py").write_text(PLAIN, encoding="utf-8")
    (project / "pytest.ini").write_text("[pytest]\n", encoding="utf-8")
    shim = tmp_path / "shim"
    shim.mkdir()
    # Заглушка стоит на PYTHONPATH раньше site-packages и перекрывает настоящий
    # homeassistant, если он установлен.
    (shim / "homeassistant.py").write_text(
        "" if ha_importable else "raise ImportError('homeassistant hidden by #630 test')\n",
        encoding="utf-8")
    env = dict(os.environ)
    env["PYTHONPATH"] = str(shim)
    env["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
    env.pop("PYTEST_ADDOPTS", None)
    return project, env


def _pytest(project: Path, env: dict[str, str], *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-m", "pytest", "tests_backend", "-p", "no:cacheprovider",
         "--rootdir", str(project), "-c", str(project / "pytest.ini"), *args],
        cwd=project, env=env, capture_output=True, text=True, encoding="utf-8",
        errors="replace", timeout=120, check=False)


def test_inventory_counts_files_and_every_test_declaration(tmp_path):
    conftest = _load_conftest()
    (tmp_path / "test_ha_alpha.py").write_text(FAKE_HA_ALPHA, encoding="utf-8")
    (tmp_path / "test_ha_beta.py").write_text(FAKE_HA_BETA, encoding="utf-8")
    (tmp_path / "test_plain.py").write_text(PLAIN, encoding="utf-8")
    assert conftest.ha_harness_inventory(tmp_path) == (2, 4)


def test_inventory_of_the_real_harness_matches_an_independent_count():
    conftest = _load_conftest()
    files = sorted(HERE.glob("test_ha_*.py"))
    assert files, "в tests_backend нет ни одного test_ha_*.py — glob разошёлся с раскладкой"
    assert conftest.ha_harness_inventory(HERE) == (len(files), _ast_count(files))


def test_without_ha_the_output_names_what_was_not_collected(tmp_path):
    project, env = _project(tmp_path, ha_importable=False)
    result = _pytest(project, env, "-q")
    output = result.stdout + result.stderr
    assert result.returncode == 0, output
    expected = ("HA harness NOT collected: 2 test_ha_*.py files (4 tests) were ignored "
                "because homeassistant is not importable")
    assert expected in output, output
    assert "bash scripts/wsl-setup.sh --verify" in output, output
    # Строка стоит в итоге, а не только в шапке: `-q` шапку не печатает.
    assert "1 passed" in output, output


def test_without_ha_the_header_names_it_too(tmp_path):
    project, env = _project(tmp_path, ha_importable=False)
    result = _pytest(project, env)
    output = result.stdout + result.stderr
    assert "collected 1 item" in output, output
    header = output.split("collected 1 item", 1)[0]
    assert "HA harness NOT collected: 2 test_ha_*.py files (4 tests)" in header, output


def test_with_ha_the_harness_is_collected_and_nothing_is_announced(tmp_path):
    project, env = _project(tmp_path, ha_importable=True)
    result = _pytest(project, env, "-q", "--collect-only")
    output = result.stdout + result.stderr
    assert result.returncode == 0, output
    assert "test_ha_alpha.py::test_one" in output, output
    assert "test_ha_beta.py::TestGroup::test_four" in output, output
    assert "HA harness NOT collected" not in output, output
