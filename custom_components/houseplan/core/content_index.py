"""Logical content references and immutable observations for portable commands.

A database host supplies ContentSnapshot after a bounded batch lookup. It
does not emulate a HA config directory. FilesystemContentIndex is the legacy
trusted-root adapter, never a pathname accepted from a command payload.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Mapping, Protocol
from urllib.parse import urlsplit

from .constants import (
    ASSETS_DIR,
    CONTENT_URL,
    FILES_DIR,
    FILES_URL,
    PLANS_DIR,
    PLANS_URL,
)
from .decor_assets import MIME_BY_EXT
from .plans import plan_basename
from .validation import sanitize_filename, sanitize_marker_id


@dataclass(frozen=True, slots=True)
class ContentRef:
    kind: str
    key: str


@dataclass(frozen=True, slots=True)
class ContentInfo:
    exists: bool
    mime: str | None = None


class ContentIndex(Protocol):
    def lookup(self, reference: ContentRef) -> ContentInfo: ...


class ContentSnapshot:
    def __init__(self, values: Mapping[ContentRef, ContentInfo]):
        self.values = MappingProxyType(dict(values))

    def lookup(self, reference: ContentRef) -> ContentInfo:
        return self.values.get(reference, ContentInfo(False))


def internal_reference(url: str) -> ContentRef | None:
    # Only relative same-document URLs name local bytes. Query/fragment are
    # transport, while every pathname segment keeps its original validation.
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc:
        return None
    path = parsed.path
    content_plan = CONTENT_URL + "/plans/_/"
    if path.startswith(content_plan) or path.startswith(PLANS_URL + "/"):
        prefix = content_plan if path.startswith(content_plan) else PLANS_URL + "/"
        name = path[len(prefix):]
        if not name or "/" in name or sanitize_filename(name) != name:
            return None
        return ContentRef("plan", name)
    assets = CONTENT_URL + "/assets/_/"
    if path.startswith(assets):
        name = path[len(assets):]
        return ContentRef("asset_file", name) if re.fullmatch(r"[0-9a-f]{64}\.(?:png|jpg|webp|svg)", name) else None
    for prefix in (CONTENT_URL + "/files/", FILES_URL + "/"):
        if path.startswith(prefix):
            parts = path[len(prefix):].split("/")
            if len(parts) != 2 or sanitize_marker_id(parts[0]) != parts[0] or sanitize_filename(parts[1]) != parts[1]:
                return None
            return ContentRef("attachment", "/".join(parts))
    return None


def content_references(config: dict) -> set[ContentRef]:
    references = set()
    for space in config.get("spaces") or []:
        url = space.get("plan_url")
        if isinstance(url, str) and (reference := internal_reference(url)) is not None:
            references.add(reference)
        for shape in space.get("decor") or []:
            asset = shape.get("asset_id") if shape.get("kind") == "image" else None
            if isinstance(asset, str) and re.fullmatch(r"[0-9a-f]{64}", asset):
                references.add(ContentRef("decor_asset", asset))
    for marker in config.get("markers") or []:
        for attachment in marker.get("pdfs") or []:
            url = attachment.get("url") if isinstance(attachment, dict) else None
            if isinstance(url, str) and (reference := internal_reference(url)) is not None:
                references.add(reference)
    return references


def internal_plan_names(config: dict | None) -> set[str]:
    names = set()
    for space in (config or {}).get("spaces") or []:
        url = space.get("plan_url")
        if isinstance(url, str) and (url.startswith(CONTENT_URL + "/plans/") or url.startswith(PLANS_URL + "/")):
            name = plan_basename(url)
            if name:
                names.add(name)
    return names


class FilesystemContentIndex:
    def __init__(self, root: Path):
        self.root = root
        self.values: dict[ContentRef, ContentInfo] = {}

    def lookup(self, reference: ContentRef) -> ContentInfo:
        if reference not in self.values:
            self.values[reference] = self._inspect(reference)
        return self.values[reference]

    def _inspect(self, reference: ContentRef) -> ContentInfo:
        prefixes = {"plan": CONTENT_URL + "/plans/_/", "attachment": CONTENT_URL + "/files/",
                    "asset_file": CONTENT_URL + "/assets/_/"}
        if reference.kind == "decor_asset":
            if not re.fullmatch(r"[0-9a-f]{64}", reference.key):
                return ContentInfo(False)
        elif reference.kind not in prefixes or internal_reference(prefixes[reference.kind] + reference.key) != reference:
            return ContentInfo(False)
        if reference.kind == "decor_asset":
            root, aid = self.root / ASSETS_DIR, reference.key
            matches = sorted(root.glob(f"{aid}.*")) if root.is_dir() else []
            blob = next((path for path in matches if path.suffix in {".png", ".jpg", ".webp", ".svg"}), None)
            metadata = {}
            try:
                metadata = json.loads((root / f"{aid}.json").read_text(encoding="utf-8"))
            except (OSError, ValueError, TypeError):
                pass
            exists = False
            if blob and blob.is_file():
                try:
                    exists = hashlib.sha256(blob.read_bytes()).hexdigest() == aid
                except OSError:
                    pass
            return ContentInfo(exists, metadata.get("mime") or MIME_BY_EXT.get(blob.suffix if blob else ""))
        directory = {"plan": PLANS_DIR, "attachment": FILES_DIR, "asset_file": ASSETS_DIR}.get(reference.kind)
        if directory is None:
            return ContentInfo(False)
        return ContentInfo((self.root / directory / reference.key).is_file())

    def snapshot(self, config: dict) -> ContentSnapshot:
        return ContentSnapshot({reference: self.lookup(reference) for reference in content_references(config)})

    def existing(self, references: set[ContentRef]) -> set[ContentRef]:
        return {reference for reference in references if self.lookup(reference).exists}
