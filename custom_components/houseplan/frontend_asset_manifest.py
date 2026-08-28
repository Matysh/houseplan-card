"""Pure manifest/path resolver for generated frontend assets."""
from __future__ import annotations

import json
from pathlib import Path

_MANIFEST = "houseplan-assets.json"
_ASSET_DIR = "houseplan-assets"


def resolve_frontend_asset(frontend_root: Path, filename: object) -> Path | None:
    """Resolve one generated JS asset only when the current manifest lists it."""
    if not isinstance(filename, str) or not filename or filename != Path(filename).name:
        return None
    if "/" in filename or "\\" in filename or filename in {".", ".."}:
        return None
    if not filename.endswith(".js"):
        return None
    try:
        manifest = json.loads((frontend_root / _MANIFEST).read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return None
    if not isinstance(manifest, dict) or manifest.get("schema") != 1:
        return None
    expected = f"{_ASSET_DIR}/{filename}"
    listed = {
        item.get("path")
        for item in manifest.get("files", [])
        if isinstance(item, dict)
    }
    if expected not in listed:
        return None
    asset_root = (frontend_root / _ASSET_DIR).resolve()
    candidate = (asset_root / filename).resolve()
    if candidate.parent != asset_root or not candidate.is_file():
        return None
    return candidate
