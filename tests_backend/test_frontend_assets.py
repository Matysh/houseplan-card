"""Pure path/manifest guards for public frontend chunks (#337)."""
from __future__ import annotations

import json
import importlib.util
from pathlib import Path

_PATH = Path(__file__).parents[1] / "custom_components" / "houseplan" / "frontend_asset_manifest.py"
_SPEC = importlib.util.spec_from_file_location("hp_frontend_asset_manifest", _PATH)
assert _SPEC and _SPEC.loader
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)
resolve_frontend_asset = _MODULE.resolve_frontend_asset


def _root(tmp_path: Path) -> Path:
    root = tmp_path / "frontend"
    assets = root / "houseplan-assets"
    assets.mkdir(parents=True)
    (assets / "editor-abc.js").write_text("export {};", encoding="utf-8")
    (assets / "stale.js").write_text("export {};", encoding="utf-8")
    (root / "houseplan-assets.json").write_text(json.dumps({
        "schema": 1,
        "files": [{"path": "houseplan-assets/editor-abc.js"}],
    }), encoding="utf-8")
    return root


def test_frontend_asset_requires_current_manifest_entry(tmp_path: Path) -> None:
    root = _root(tmp_path)
    assert resolve_frontend_asset(root, "editor-abc.js") == (
        root / "houseplan-assets" / "editor-abc.js"
    ).resolve()
    assert resolve_frontend_asset(root, "stale.js") is None
    assert resolve_frontend_asset(root, "missing.js") is None
    assert resolve_frontend_asset(root, "houseplan-assets.json") is None


def test_frontend_asset_refuses_traversal_and_malformed_manifest(tmp_path: Path) -> None:
    root = _root(tmp_path)
    for value in (
        "../editor-abc.js", "..\\editor-abc.js", "nested/editor-abc.js",
        "..%2feditor-abc.js", "editor-abc.css", "..", "",
    ):
        assert resolve_frontend_asset(root, value) is None
    (root / "houseplan-assets.json").write_text("not json", encoding="utf-8")
    assert resolve_frontend_asset(root, "editor-abc.js") is None


def test_frontend_asset_refuses_wrong_schema_and_symlink_escape(tmp_path: Path) -> None:
    root = _root(tmp_path)
    manifest = root / "houseplan-assets.json"
    manifest.write_text(json.dumps({
        "schema": 2, "files": [{"path": "houseplan-assets/editor-abc.js"}],
    }), encoding="utf-8")
    assert resolve_frontend_asset(root, "editor-abc.js") is None

    outside = tmp_path / "outside.js"
    outside.write_text("outside", encoding="utf-8")
    link = root / "houseplan-assets" / "linked.js"
    try:
        link.symlink_to(outside)
    except OSError:
        return  # Windows without Developer Mode; containment is covered elsewhere.
    manifest.write_text(json.dumps({
        "schema": 1, "files": [{"path": "houseplan-assets/linked.js"}],
    }), encoding="utf-8")
    assert resolve_frontend_asset(root, "linked.js") is None


def test_hashed_chunks_are_immutably_cacheable() -> None:
    """#353 AC3-в: content-hashed bodies never change under their URL."""
    assert _MODULE.ASSET_CACHE_CONTROL == "public, max-age=31536000, immutable"
    view_source = (_PATH.parent / "frontend_assets.py").read_text(encoding="utf-8")
    assert "ASSET_CACHE_CONTROL" in view_source
    assert '"no-cache"' not in view_source
