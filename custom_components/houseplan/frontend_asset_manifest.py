"""Pure manifest/path resolver for generated frontend assets."""
from __future__ import annotations

import json
from pathlib import Path

_MANIFEST = "houseplan-assets.json"
_ASSET_DIR = "houseplan-assets"

# Content-hashed chunk bodies never change under their URL (#353 К4). The
# stable entry `houseplan-card.js` is served elsewhere and stays uncached.
ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable"


def _asset_and_manifest(frontend_root: Path, filename: object) -> tuple[Path | None, dict]:
    if not isinstance(filename, str) or not filename or filename != Path(filename).name:
        return None, {}
    if "/" in filename or "\\" in filename or filename in {".", ".."}:
        return None, {}
    if not filename.endswith(".js"):
        return None, {}
    try:
        manifest = json.loads((frontend_root / _MANIFEST).read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return None, {}
    if not isinstance(manifest, dict) or manifest.get("schema") != 1:
        return None, {}
    expected = f"{_ASSET_DIR}/{filename}"
    if not isinstance(manifest.get("files"), list):
        return None, {}
    listed = {
        item.get("path")
        for item in (manifest.get("files") or [])
        if isinstance(item, dict)
    }
    if expected not in listed:
        return None, {}
    return _safe_file(frontend_root, expected), manifest


def _safe_file(root: Path, relative: str) -> Path | None:
    try:
        expected = root.resolve() / relative
        candidate = expected.resolve()
        if candidate != expected or not candidate.is_file():
            return None
    except (OSError, ValueError, RuntimeError):
        return None
    return candidate


def resolve_frontend_asset(frontend_root: Path, filename: object) -> Path | None:
    """Resolve one generated JS asset only when the current manifest lists it."""
    return _asset_and_manifest(frontend_root, filename)[0]


class NoAcceptableEncoding(ValueError):
    """The client refused every available representation."""


def _qualities(header: str) -> dict[str, float]:
    qualities = {}
    for part in header.lower().split(","):
        name, *parameters = part.strip().split(";")
        if not name:
            continue
        quality = 1.0
        for parameter in parameters:
            if parameter.strip().startswith("q="):
                try:
                    quality = float(parameter.strip()[2:])
                except ValueError:
                    quality = 0.0
        if not 0 <= quality <= 1:
            quality = 0.0
        qualities[name] = max(quality, qualities.get(name, 0.0))
    return qualities


def resolve_frontend_representation(
    frontend_root: Path, filename: str, accept_encoding: str,
) -> tuple[Path | None, str | None]:
    """Negotiate only build-generated variants; no compression in HA requests."""
    raw, manifest = _asset_and_manifest(frontend_root, filename)
    if raw is None:
        return None, None
    qualities = _qualities(accept_encoding)
    identity = qualities.get("identity", 0.0 if qualities.get("*") == 0 else 1.0)
    inventory = manifest.get("encodings", [])
    if not isinstance(inventory, list):
        inventory = []
    choices = []
    for encoding in ("gzip",):
        quality = qualities.get(encoding, qualities.get("*", 0.0))
        if quality <= 0 or ("identity" in qualities and identity > quality):
            continue
        expected = f"houseplan-encoded/{encoding}/{filename}"
        if not any(isinstance(item, dict) and item.get("source") == f"{_ASSET_DIR}/{filename}"
                   and item.get("encoding") == encoding and item.get("path") == expected
                   for item in inventory):
            continue
        path = _safe_file(frontend_root, expected)
        if path is not None:
            choices.append((quality, path, encoding))
    if choices:
        _, path, encoding = max(choices, key=lambda choice: choice[0])
        return path, encoding
    if identity > 0:
        return raw, None
    raise NoAcceptableEncoding()
