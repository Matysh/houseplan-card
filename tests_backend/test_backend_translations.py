"""Backend translation topology for the House Plan panel contract (#486)."""

from __future__ import annotations

import json
from pathlib import Path

_ROOT = Path(__file__).parents[1] / "custom_components" / "houseplan"
_REQUIRED_PANEL_KEYS = {
    "config.create_entry.panel_ready",
    "issues.frontend_reload_notice.title",
    "issues.frontend_reload_notice.description",
    "system_health.info.panel_file",
    "system_health.info.panel_static_path",
    "system_health.info.panel_status",
    "system_health.info.panel_url",
    "system_health.info.panel_module_url",
    "system_health.info.panel_error",
}


def _flatten(value: dict, prefix: str = "") -> dict[str, object]:
    result: dict[str, object] = {}
    for key, child in value.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(child, dict):
            result.update(_flatten(child, path))
        else:
            result[path] = child
    return result


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_panel_backend_keys_match_source_and_all_shipped_locales() -> None:
    source = _flatten(_load(_ROOT / "strings.json"))
    assert _REQUIRED_PANEL_KEYS <= source.keys()

    for locale in ("en", "ru", "de", "fr"):
        translated = _flatten(_load(_ROOT / "translations" / f"{locale}.json"))
        assert translated.keys() == source.keys(), f"{locale} backend key set differs"
        for key in _REQUIRED_PANEL_KEYS:
            assert isinstance(translated[key], str)
            assert translated[key].strip()


def test_completion_and_reload_notice_keep_fail_soft_guidance() -> None:
    english = _flatten(_load(_ROOT / "translations" / "en.json"))
    completion = str(english["config.create_entry.panel_ready"])
    notice = str(english["issues.frontend_reload_notice.description"])

    assert "sidebar" in completion
    assert "desktop" in completion.lower()
    assert "dashboard card" in completion.lower()
    assert "System Health" in completion
    assert "sidebar" in notice
    assert "reload" in notice
    assert "dashboard card" in notice.lower()
    assert "Resources" in notice


def test_manifest_loads_the_public_panel_custom_dependency() -> None:
    manifest = _load(_ROOT / "manifest.json")
    assert "panel_custom" in manifest["dependencies"]
