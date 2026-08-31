"""#42: backend quality contracts — error codes, mypy allowlist, noqa hygiene.

Pure tests: no homeassistant import, runnable in any environment.
"""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BACKEND = REPO / "custom_components" / "houseplan"


# Loading const.py by file path with a standalone module name deliberately
# avoids stubbing "custom_components"/"custom_components.houseplan" in
# sys.modules: leftover ModuleType stand-ins poison the Home Assistant harness
# running later in the same pytest process — HA's loader then sees a package
# without async_setup and every harness test fails with "No setup or config
# entry setup function defined" (the exact #389 incident, caused by the schema
# dump script). const.py imports nothing, so no package context is needed.
def _const():
    spec = importlib.util.spec_from_file_location(
        "houseplan_quality_const", BACKEND / "const.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _emitted_codes() -> tuple[set[str], set[str]]:
    """All fixed codes and family prefixes actually emitted by the sources.

    #42 AC5 (spec rev 4-6): BOTH emission paths — send_error literals and the
    err.code sources (class attrs, MarkerControlError literals, the
    conditional source_error/attribute_error assignments, the literal tuple
    codes, the f-string families) — fail-closed for anything else.
    """
    api = (BACKEND / "websocket_api.py").read_text(encoding="utf-8")
    validation = (BACKEND / "validation.py").read_text(encoding="utf-8")
    junction = (BACKEND / "junction_limits.py").read_text(encoding="utf-8")

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
    missing = {code for code in const.ERROR_CODES
               if f"backup.error.{code}" not in en}
    assert not missing, f"ERROR_CODES without an en message: {sorted(missing)}"


def test_issue_42_mypy_strict_allowlist_only_grows():
    committed = {
        "custom_components.houseplan.const",
        "custom_components.houseplan.projection",
        "custom_components.houseplan.coordinate_canonicalization",
        "custom_components.houseplan.frontend_asset_manifest",
        "custom_components.houseplan.junction_limits",
        "custom_components.houseplan.plans",
    }
    pyproject = (REPO / "pyproject.toml").read_text(encoding="utf-8")
    section = pyproject.split("[[tool.mypy.overrides]]", 1)[1]
    listed = set(re.findall(r'"(custom_components\.houseplan\.[a-z_]+)"', section))
    removed = committed - listed
    assert not removed, (
        f"strict modules were REMOVED from the mypy allowlist: {sorted(removed)} — "
        "the list only ever grows (#42)")


def test_issue_42_mypy_strict_is_actually_executed_by_ci():
    """The typing gate must RUN, not merely be configured (#42 r6 Medium).

    The allowlist test above compares text; without a workflow step that
    invokes mypy, a regression in any of the six modules reaches dev
    unnoticed — measurable quality that nothing measures. Three facts are
    pinned: mypy is pinned in the dependency file the backend job installs
    from, a step actually invokes it, and that step derives the module list
    from pyproject.toml instead of duplicating it (a drifted duplicate is a
    green step checking the wrong thing).
    """
    requirements = (REPO / "tests_backend" / "requirements.txt").read_text(encoding="utf-8")
    assert re.search(r"^mypy==\d+\.\d+", requirements, re.M), (
        "mypy is not pinned in tests_backend/requirements.txt — the typing gate "
        "would not be reproducible from the SHA (#42)")

    workflow = (REPO / ".github" / "workflows" / "validate.yml").read_text(encoding="utf-8")
    steps = [block for block in workflow.split("      - name: ") if "mypy" in block]
    assert steps, "no validate.yml step runs mypy — AC4 has no execution in CI (#42)"
    step = steps[0]
    assert re.search(r"python -m mypy\s", step), (
        "the mypy step must invoke the checker itself, not only mention it")
    assert "tool" in step and "mypy" in step and "pyproject.toml" in step, (
        "the step must read the strict allowlist from pyproject.toml, not repeat it")
    assert "exit 1" in step, "an empty allowlist must fail the step, not pass it silently"


def test_issue_42_every_noqa_carries_a_reason():
    for path in sorted(BACKEND.glob("*.py")):
        for index, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "# noqa" not in line:
                continue
            tail = line.split("# noqa", 1)[1]
            comment = tail.split(":", 1)[1] if ":" in tail else tail
            explanation = comment.split(" ", 1)[1] if " " in comment.strip() else ""
            assert len(explanation.strip()) >= 10, (
                f"{path.name}:{index}: a bare noqa hides a decision — add the reason")


def test_issue_398_pure_imports_leaves_sys_modules_as_it_found_it():
    """`load_pure` не оставляет следов в `sys.modules` (#398 AC4).

    Статический гвард (`test/backend-test-hygiene.test.mjs`) разрешает этому
    файлу писать в `sys.modules`, потому что не видит очистки. Значит очистку
    обязан доказывать исполняемый тест — иначе разрешение стало бы дырой
    ровно того размера, что #389: пустышка переживала свой тест, Home
    Assistant не мог поднять интеграцию, и 85 тестов харнесса падали с голым
    `assert False`.

    Проверяется именно РАЗНИЦА, а не пустота: пустышки родительских пакетов
    ставит conftest, они принадлежат ему и остаются.
    """
    import sys

    from tests_backend.pure_imports import HOUSEPLAN_ROOT, load_pure

    before = sorted(k for k in sys.modules if k.startswith("custom_components"))
    module = load_pure(
        "custom_components.houseplan.junction_limits",
        HOUSEPLAN_ROOT / "junction_limits.py",
    )
    assert dir(module), "модуль обязан быть рабочим после очистки"
    after = sorted(k for k in sys.modules if k.startswith("custom_components"))
    assert after == before, (
        f"load_pure оставил в sys.modules: {sorted(set(after) - set(before))} — "
        "относительные импорты подтягивают соседей, снимать нужно всю разницу"
    )

    # Повторный вызов обязан работать так же: очистка не должна ломать
    # следующий заход (тесты вызывают load_pure по нескольку раз за сессию).
    again = load_pure(
        "custom_components.houseplan.junction_limits",
        HOUSEPLAN_ROOT / "junction_limits.py",
    )
    assert dir(again)
    assert sorted(k for k in sys.modules if k.startswith("custom_components")) == before
