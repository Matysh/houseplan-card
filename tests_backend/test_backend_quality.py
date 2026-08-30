"""#42: backend quality contracts — error codes, mypy allowlist, noqa hygiene.

Pure tests: no homeassistant import, runnable in any environment.
"""
from __future__ import annotations

import json
import re
import sys
import types
import importlib.util
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
BACKEND = REPO / "custom_components" / "houseplan"


def _const():
    for name, path in (
        ("custom_components", REPO / "custom_components"),
        ("custom_components.houseplan", BACKEND),
    ):
        module = types.ModuleType(name)
        module.__path__ = [str(path)]
        sys.modules[name] = module
    spec = importlib.util.spec_from_file_location(
        "custom_components.houseplan.const", BACKEND / "const.py")
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
    fixed |= set(re.findall(r'"(invalid_(?:light|toggle)_entity)"', validation))

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
