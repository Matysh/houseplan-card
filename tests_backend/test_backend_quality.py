"""#42: backend quality contracts — error codes, mypy allowlist, noqa hygiene.

Pure tests: no homeassistant import, runnable in any environment.
"""
from __future__ import annotations

import importlib
import importlib.util
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BACKEND = REPO / "custom_components" / "houseplan"


def _const():
    return importlib.import_module("custom_components.houseplan.const")


def _emitted_codes() -> tuple[set[str], set[str]]:
    """All fixed codes and family prefixes actually emitted by the sources.

    #42 AC5 (spec rev 4-6): BOTH emission paths — send_error literals and the
    err.code sources (class attrs, MarkerControlError literals, the
    conditional source_error/attribute_error assignments, the literal tuple
    codes, the f-string families) — fail-closed for anything else.
    """
    api = (BACKEND / "websocket_api.py").read_text(encoding="utf-8")
    validation = (BACKEND / "core" / "validation.py").read_text(encoding="utf-8")
    junction = (BACKEND / "core" / "junction_limits.py").read_text(encoding="utf-8")

    fixed: set[str] = set()
    fixed |= set(re.findall(r'send_error\(\s*[^,]+,\s*"([a-z0-9_]+)"', api))
    fixed |= set(re.findall(r'^\s+code = "([a-z0-9_]+)"', validation, re.M))
    fixed |= set(re.findall(r'MarkerControlError\(\s*\n?\s*"([a-z0-9_]+)"', validation))
    for pair in re.findall(
            r'(?:source_error|attribute_error)\s*=\s*"([a-z0-9_]+)"\s*if[^\n]*\\\s*\n\s*else\s*"([a-z0-9_]+)"',
            validation):
        fixed |= set(pair)
    # The literal-tuple path (field, code, message) is parsed STRUCTURALLY,
    # not by naming the two known codes: a third tuple entry with a brand-new
    # code must land in `fixed` (and so fail the registry test if the code is
    # unregistered). Fail-closed: a tuple block whose string count is not a
    # multiple of three means the shape changed — refuse instead of guessing.
    for block in re.findall(
            r'for field, code, message in \(\n(.*?)\n\s*\):', validation, re.S):
        strings = re.findall(r'"([^"]*)"', block)
        if not strings or len(strings) % 3:
            raise AssertionError(
                "unrecognized (field, code, message) tuple shape in validation.py: "
                f"{len(strings)} string literals — update the AC5 scanner")
        fixed |= set(strings[1::3])

    families: set[str] = set()
    families |= {match + "_" if not match.endswith("_") else match
                 for match in re.findall(r'MarkerControlError\(\s*f"\{prefix\}_', validation)
                 and {"value_badge", "value_source"} or set()}
    if re.search(r'MarkerControlError\(\s*f"\{prefix\}', validation):
        families |= {"value_badge_", "value_source_"}
    if re.search(r'f"junction_limit_\{', junction):
        families.add("junction_limit_")
    node_move = (BACKEND / "core" / "wall_node_move.py").read_text(encoding="utf-8")
    if re.search(r'f"node_move_\{', node_move):
        families.add("node_move_")

    # fail-closed: a MarkerControlError call whose first argument is neither a
    # literal, a known variable, nor a known f-string pattern is a hole.
    for call in re.findall(r'(?<!class )MarkerControlError\(\s*\n?\s*([^",\s][^,\)]*)', validation):
        head = call.strip()
        assert head in {"source_error", "attribute_error", "code"} or head.startswith('f"{prefix}'), (
            f"MarkerControlError emits a code the scanner cannot prove: {head!r} — "
            "extend the scanner or use a literal")
    return fixed, families


def test_issue_42_every_emitted_code_is_registered_and_localized():
    const = _const()
    fixed, families = _emitted_codes()
    assert fixed, "the scanner must find codes — an empty set means it broke"
    unregistered = fixed - const.ERROR_CODES
    assert not unregistered, (
        f"codes emitted but missing from ERROR_CODES: {sorted(unregistered)}")
    for family in families:
        assert family in const.ERROR_CODE_FAMILIES, (
            f"family prefix {family!r} missing from ERROR_CODE_FAMILIES")
    # the two flagship structured-details codes are proven present by name
    assert "invalid_passage_fields" in fixed
    assert "invalid_partition_opening_jamb_margin" in fixed
    # variable-passed subfamily is proven (spec rev6 м1c target)
    assert "invalid_light_entity" in fixed and "invalid_value_source" in fixed
    en = json.loads((REPO / "src" / "i18n" / "en.json").read_text(encoding="utf-8"))
    # Backup errors resolve through toolsT first, then the original core
    # dictionary. Rare ZIP-only copy must not inflate every View download.
    tools = json.loads((REPO / "src" / "i18n" / "tools" / "en.json").read_text(encoding="utf-8"))
    missing = {code for code in const.ERROR_CODES
               if f"backup.error.{code}" not in en and f"backup.error.{code}" not in tools}
    assert not missing, f"ERROR_CODES without an en message: {sorted(missing)}"


def test_issue_42_mypy_strict_allowlist_only_grows():
    committed = {
        "custom_components.houseplan.const",
        "custom_components.houseplan.projection",
        "custom_components.houseplan.coordinate_canonicalization",
        "custom_components.houseplan.frontend_asset_manifest",
        "custom_components.houseplan.junction_limits",
        "custom_components.houseplan.plans",
        "custom_components.houseplan.core.constants",
        "custom_components.houseplan.core.coordinate_canonicalization",
        "custom_components.houseplan.core.contact_basis",
        "custom_components.houseplan.core.junction_limits",
        "custom_components.houseplan.core.file_usage",
        "custom_components.houseplan.core.led_strips",
        "custom_components.houseplan.core.opening_repair",
    }
    pyproject = (REPO / "pyproject.toml").read_text(encoding="utf-8")
    section = pyproject.split("[[tool.mypy.overrides]]", 1)[1]
    listed = set(re.findall(r'"(custom_components\.houseplan\.[a-z_.]+)"', section))
    removed = committed - listed
    assert not removed, (
        f"strict modules were REMOVED from the mypy allowlist: {sorted(removed)} — "
        "the list only ever grows (#42)")


def test_issue_42_every_noqa_carries_a_reason():
    for path in sorted(BACKEND.rglob("*.py")):
        for index, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "# noqa" not in line:
                continue
            tail = line.split("# noqa", 1)[1]
            comment = tail.split(":", 1)[1] if ":" in tail else tail
            explanation = comment.split(" ", 1)[1] if " " in comment.strip() else ""
            assert len(explanation.strip()) >= 10, (
                f"{path.name}:{index}: a bare noqa hides a decision — add the reason")


def test_issue_398_pure_imports_preserves_real_module_identity():
    """Ordinary imports may cache modules, but never replace existing owners."""
    import sys
    from tests_backend.pure_imports import HOUSEPLAN_ROOT, load_pure
    before = dict(sys.modules)
    one = load_pure("quality_junction_alias", HOUSEPLAN_ROOT / "junction_limits.py")
    two = load_pure("quality_junction_alias", HOUSEPLAN_ROOT / "junction_limits.py")
    canonical = importlib.import_module("custom_components.houseplan.core.junction_limits")
    assert one is two is canonical
    assert one.JunctionLimitError is canonical.JunctionLimitError
    assert "quality_junction_alias" not in sys.modules
    assert all(sys.modules.get(k) is v for k, v in before.items())
    parent = importlib.import_module("custom_components.houseplan")
    assert parent.__file__ and callable(parent.async_setup)


def test_issue_1380_scoped_pure_module_keeps_lazy_imports_and_restores_identity():
    import sys
    from tests_backend.pure_imports import HOUSEPLAN_ROOT, pure_module
    from wall_node_parity import commit
    parent = importlib.import_module("custom_components.houseplan")
    existing = dict(sys.modules)
    config = {"spaces": [{"id": "f", "rooms": [], "partitions": [
        {"id": "p", "a": [0, 0], "b": [1, 0], "cm": 10}]}], "markers": [], "settings": {}}
    for fail in (False, True):
        try:
            with pure_module("quality_move_alias", HOUSEPLAN_ROOT / "wall_node_move.py") as module:
                actual, _ = module.commit_wall_segment_model(config)
                assert actual["model_version"] == 11
                assert sys.modules["quality_move_alias"] is module
                canonical = importlib.import_module("custom_components.houseplan.core.wall_node_move")
                assert module is canonical
                with pure_module("quality_move_alias", HOUSEPLAN_ROOT / "const.py") as const:
                    assert const.DOMAIN == "houseplan"
                assert sys.modules["quality_move_alias"] is canonical
                if fail:
                    raise RuntimeError("scope exit probe")
        except RuntimeError as error:
            assert fail and str(error) == "scope exit probe"
        assert "quality_move_alias" not in sys.modules
        assert sys.modules["custom_components.houseplan"] is parent
        assert all(sys.modules.get(k) is v for k, v in existing.items())
    assert commit(config) == actual


def test_issue_465_pure_imports_is_order_independent():
    """Cold imports use the real parent without loading HA lifecycle."""
    import subprocess
    import sys
    probe = """
import importlib.abc
import sys
from tests_backend.pure_imports import HOUSEPLAN_ROOT, load_pure
class BlockHA(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == 'homeassistant' or fullname.startswith('homeassistant.'):
            raise AssertionError(fullname)
sys.meta_path.insert(0, BlockHA())
one = load_pure('isolated_alias', HOUSEPLAN_ROOT / 'junction_limits.py')
import custom_components.houseplan as parent
from custom_components.houseplan.core import junction_limits as owner
assert parent.__file__ and callable(parent.async_setup)
assert 'custom_components.houseplan.ha_integration' not in sys.modules
two = load_pure('isolated_alias', HOUSEPLAN_ROOT / 'junction_limits.py')
assert one is two is owner
assert 'isolated_alias' not in sys.modules
assert not any(k == 'homeassistant' or k.startswith('homeassistant.') for k in sys.modules)
"""
    result = subprocess.run([sys.executable, "-c", probe], cwd=REPO,
                            capture_output=True, text=True, timeout=30, check=False)
    assert result.returncode == 0, result.stdout + result.stderr

# --- #436: файл, которому нужен Home Assistant, обязан это объявить ---------


def _toplevel_imports(path: Path) -> set[str]:
    """Модули, импортируемые на уровне модуля — то есть при сборке pytest.

    Тела функций и классов не считаются: их импорты исполняются при вызове и
    сборку не ломают. `if TYPE_CHECKING:` тоже не считается — этот блок не
    исполняется никогда (`virtual_lights` так тянет `store` и остаётся чистым).
    """
    import ast

    names: set[str] = set()

    def visit(body: list) -> None:
        for node in body:
            if isinstance(node, ast.Import):
                names.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                base = node.module or ""
                if node.level:  # from . import store / from .store import x
                    base = "." * node.level + base
                names.add(base)
                names.update(f"{base}.{alias.name}".replace("..", ".", 1)
                             if base == "." else f"{base}.{alias.name}"
                             for alias in node.names)
            elif isinstance(node, ast.If):
                if "TYPE_CHECKING" in ast.unparse(node.test):
                    continue
                visit(node.body)
                visit(node.orelse)
            elif isinstance(node, ast.Try):
                visit(node.body)
                for handler in node.handlers:
                    visit(handler.body)
                visit(node.orelse)
                visit(node.finalbody)

    visit(ast.parse(path.read_text(encoding="utf-8")).body)
    return names


def _ha_dependent_backend_modules(root: Path | None = None) -> set[str]:
    """Модули интеграции, которые при импорте тянут Home Assistant.

    Прямые импортёры плюс замыкание по относительным импортам: `store` тянет HA
    сам, а всё, что импортирует `store` на уровне модуля, тянет его через него.
    """
    base_root = root or BACKEND
    deps: dict[str, set[str]] = {}
    for path in sorted(base_root.rglob("*.py")):
        key = ".".join(path.relative_to(base_root).with_suffix("").parts)
        if key.endswith(".__init__"):
            key = key.removesuffix(".__init__")
            package = "custom_components.houseplan." + key
        else:
            package = ".".join(["custom_components", "houseplan", *key.split(".")[:-1]])
        own = set()
        for name in _toplevel_imports(path):
            if name.startswith("."):
                name = importlib.util.resolve_name(name, package)
            if name.startswith("custom_components.houseplan."):
                own.add(name.removeprefix("custom_components.houseplan."))
            if name == "homeassistant" or name.startswith("homeassistant."):
                own.add("homeassistant")
        deps[key] = own
    needs = {name for name, own in deps.items() if "homeassistant" in own}
    changed = True
    while changed:  # обычно один проход; цикл — на случай цепочек длиннее одной
        changed = False
        for name, own in deps.items():
            if name not in needs and own & needs:
                needs.add(name)
                changed = True
    return needs


def _needs_home_assistant(
    path: Path, ha_modules: set[str], *, seen: set[Path] | None = None,
) -> bool:
    """Оборвётся ли импорт файла, включая соседние test/helper-модули, без HA."""
    path = path.resolve()
    seen = set() if seen is None else seen
    if path in seen:
        return False
    seen.add(path)
    imports = _toplevel_imports(path)
    if {name.split(".")[0] for name in imports} & {
        "homeassistant", "pytest_homeassistant_custom_component",
    }:
        return True
    touched = set()
    for name in imports:
        parts = name.split(".")
        if parts[:2] == ["custom_components", "houseplan"] and len(parts) > 2:
            touched.update(".".join(parts[2:index]) for index in range(3, len(parts) + 1))
    if touched & ha_modules:
        return True
    # HA может прийти через общий setup соседнего теста, как в #1258.
    # Имя test_ha_* само по себе зависимостью не считается.
    for name in sorted(imports):
        local = name.removeprefix("tests_backend.").lstrip(".").split(".")[0]
        helper = path.parent / f"{local}.py"
        if helper.is_file() and _needs_home_assistant(helper, ha_modules, seen=seen):
            return True
    return False


def test_issue_436_ha_dependent_test_modules_declare_it():
    """Сборка pytest не имеет права падать из-за отсутствия Home Assistant.

    До #436 `conftest.py` отсекал HA-тесты по шаблону имени `test_ha_*.py`, а
    `test_coordinate_canonicalization.py` тянул HA через `store` и под шаблон
    не попадал: `python3 -m pytest tests_backend/` без HA обрывался на сборке,
    и НИ ОДИН из трёх сотен чистых тестов не выполнялся. Признак «нужен ли
    файлу HA» был подменён признаком «как файл назван» — та же конструкция,
    которая в #389 уронила 85 тестов с голым `assert False`.

    Проверка статическая и работает в любом окружении: она читает импорты, а
    не исполняет их.
    """
    tests_dir = Path(__file__).resolve().parent
    ha_modules = _ha_dependent_backend_modules()
    # Свидетели самого сканера: без них «ничего не нашёл» выглядело бы как
    # «всё в порядке» — ровно тот вид зелёного, против которого заведён #430.
    assert "store" in ha_modules, "сканер не видит прямого импортёра HA"
    assert "coordinate_canonicalization" not in ha_modules, "чистый модуль помечен как HA"
    ha_named = sorted(path for path in tests_dir.glob("test_ha_*.py"))
    assert ha_named, "HA-тесты исчезли — у сканера не осталось положительных примеров"
    for path in ha_named:
        assert _needs_home_assistant(path, ha_modules), (
            f"{path.name}: сканер не распознаёт HA-зависимость там, где она заведомо есть"
        )

    undeclared = [
        path.name for path in sorted(tests_dir.glob("test_*.py"))
        if _needs_home_assistant(path, ha_modules)
        and not path.name.startswith("test_ha_")
        and 'importorskip("homeassistant"' not in path.read_text(encoding="utf-8")
    ]
    assert undeclared == [], (
        "файлам нужен Home Assistant, но они этого не объявляют: "
        f"{undeclared}. Либо имя test_ha_*.py — тогда их отсечёт conftest, — либо "
        'pytest.importorskip("homeassistant") ДО импортов, тянущих HA (#436). '
        "Иначе прогон tests_backend/ без HA оборвётся на сборке, и не выполнится "
        "ни один тест, включая чистые."
    )


def test_issue_436_scanner_follows_transitive_ha_dependencies(tmp_path):
    """Замыкание — не украшение: в интеграции есть модуль, зависящий от HA
    только через соседа (`import_export` тянет его через `store`). Без
    замыкания такой модуль считался бы чистым, и тест, импортирующий его,
    снова обрывал бы сборку. Проверяется на синтетическом дереве, чтобы
    свидетель не зависел от того, как перетасуют импорты в самой интеграции.
    """
    (tmp_path / "direct.py").write_text("from homeassistant.core import HomeAssistant\n")
    (tmp_path / "middle.py").write_text("from .direct import HomeAssistant\n")
    (tmp_path / "far.py").write_text("from . import middle\n")
    (tmp_path / "clean.py").write_text("import json\n")
    (tmp_path / "lazy.py").write_text(
        "from typing import TYPE_CHECKING\n"
        "if TYPE_CHECKING:\n    from .direct import HomeAssistant\n"
        "def f():\n    from .direct import HomeAssistant\n    return HomeAssistant\n",
    )
    assert _ha_dependent_backend_modules(tmp_path) == {"direct", "middle", "far"}


def test_issue_1379_scanner_follows_local_test_helpers(tmp_path):
    """Bare, package and relative helper imports preserve collection-time HA needs."""
    (tmp_path / "direct.py").write_text("from homeassistant.core import HomeAssistant\n")
    (tmp_path / "middle.py").write_text("from direct import HomeAssistant\n")
    for name, source in {
        "bare": "from middle import HomeAssistant\n",
        "qualified": "from tests_backend.middle import HomeAssistant\n",
        "relative": "from .middle import HomeAssistant\n",
    }.items():
        entry = tmp_path / f"test_{name}.py"
        entry.write_text(source)
        assert _needs_home_assistant(entry, set()), name

    unrelated = tmp_path / "test_unrelated.py"
    unrelated.write_text("from unrelated_package.direct import HomeAssistant\n")
    assert not _needs_home_assistant(unrelated, set()), "do not resolve another package as a local helper"


def test_issue_1379_scanner_handles_helper_cycles_and_lazy_imports(tmp_path):
    """Cycles terminate; a later HA edge is found without treating lazy imports as eager."""
    entry = tmp_path / "test_cycle.py"
    entry.write_text("from cycle_a import setup\n")
    (tmp_path / "cycle_a.py").write_text("from cycle_b import setup\n")
    cycle_b = tmp_path / "cycle_b.py"
    cycle_b.write_text("from cycle_a import setup\n")
    assert not _needs_home_assistant(entry, {"store"})

    cycle_b.write_text(
        "from cycle_a import setup\n"
        "from custom_components.houseplan.store import get_data\n"
    )
    assert _needs_home_assistant(entry, {"store"})

    (tmp_path / "lazy.py").write_text(
        "from typing import TYPE_CHECKING\n"
        "if TYPE_CHECKING:\n    from homeassistant.core import HomeAssistant\n"
        "def setup():\n    from homeassistant.core import HomeAssistant\n"
    )
    lazy_entry = tmp_path / "test_lazy.py"
    lazy_entry.write_text("from lazy import setup\n")
    assert not _needs_home_assistant(lazy_entry, set())
