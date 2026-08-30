"""#33: the committed schema manifest must stay fresh, and the lifecycle
fixtures must pass the real schema losslessly.

The dump script stubs the package parents itself, so this module runs both in
the sandbox (no homeassistant) and in CI.
"""
from __future__ import annotations

import copy
import importlib.util
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def _load_dump_module():
    spec = importlib.util.spec_from_file_location(
        "houseplan_dump_config_schema", REPO / "scripts" / "dump-config-schema.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules["houseplan_dump_config_schema"] = module
    spec.loader.exec_module(module)
    return module


def _validation():
    # Модуль берётся возвращённым значением, а не из sys.modules: подмена
    # пакетов теперь обратима и после загрузки ключей там не остаётся (#389).
    return _load_dump_module()._load_validation()


def test_issue_33_manifest_is_fresh_and_deterministic():
    dump = _load_dump_module()
    first = dump.build_manifest()
    second = dump.build_manifest()
    assert first == second, "the walker must be deterministic"
    rendered = json.dumps(first, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    committed = (REPO / "scripts" / "config-schema.json").read_text(encoding="utf-8")
    assert rendered == committed, (
        "scripts/config-schema.json is stale — the schema changed; "
        "run python3 scripts/dump-config-schema.py and commit the diff"
    )
    # AC1: the manifest is not a stub — it must cover the whole persisted shape.
    assert len(first["fields"]) > 200


def _collect_paths(node, prefix=""):
    paths = set()
    if isinstance(node, dict):
        for key, value in node.items():
            paths |= _collect_paths(value, f"{prefix}.{key}" if prefix else key)
    elif isinstance(node, list):
        for item in node:
            paths |= _collect_paths(item, f"{prefix}[]")
    else:
        paths.add(prefix)
    return paths


def test_issue_33_lifecycle_fixtures_pass_the_schema_losslessly():
    validation = _validation()
    fixtures = REPO / "test" / "fixtures" / "config-lifecycle"
    dropped_by_design = {"spaces[].aspect", "spaces[].segments"}  # vol.Remove
    for name in ("oldest-supported", "current", "future-fields"):
        raw = json.loads((fixtures / f"{name}.json").read_text(encoding="utf-8"))
        validated = validation.CONFIG_SCHEMA(copy.deepcopy(raw))
        before = _collect_paths(raw)
        after = _collect_paths(validated)
        lost = before - after - dropped_by_design
        assert not lost, f"{name}: validation silently dropped {sorted(lost)}"


def test_issue_33_future_fields_round_trip_exactly():
    validation = _validation()
    fixtures = REPO / "test" / "fixtures" / "config-lifecycle"
    raw = json.loads((fixtures / "future-fields.json").read_text(encoding="utf-8"))
    validated = validation.CONFIG_SCHEMA(copy.deepcopy(raw))
    assert validated["future_root_field"] == {"kept": True}
    assert validated["settings"]["future_setting"] == [1, 2, 3]
    assert validated["spaces"][0]["future_space_field"] == "kept"
    assert validated["spaces"][0]["settings"]["future_display"] is True
    assert validated["markers"][0]["future_marker_field"] == {"nested": "kept"}


def test_issue_389_the_dump_leaves_sys_modules_as_it_found_it():
    """Подмена пакетов обязана быть обратимой.

    Скрипт дампа подменяет `custom_components` и `custom_components.houseplan`
    пустышками, чтобы прочитать схему без Home Assistant. Пока подмена
    оставалась в `sys.modules`, HA получал пакет без `async_setup` и отказывался
    поднимать интеграцию — 85 тестов харнесса падали с «assert False», и ни
    один не указывал на причину. Тест держит именно обратимость, а не факт
    подмены: без неё скрипт свою работу не сделает.
    """
    keys = (
        "custom_components",
        "custom_components.houseplan",
        "custom_components.houseplan.validation",
        "custom_components.houseplan.coordinate_canonicalization",
    )
    missing = object()
    before = {name: sys.modules.get(name, missing) for name in keys}

    _validation()

    for name in keys:
        after = sys.modules.get(name, missing)
        assert after is before[name], f"{name}: подмена не возвращена на место"
