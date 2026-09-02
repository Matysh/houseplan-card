"""Content-addressed custom images for the decorative layer (#51).

Upload plumbing hands this module untrusted bytes. It either returns one fully
validated canonical asset or rejects the whole file; SVG is never repaired or
partially stripped.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import struct
import xml.etree.ElementTree as ET
from xml.parsers import expat
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .const import CONTENT_URL, MAX_DECOR_ASSET_BYTES

ASSET_ID_RE = re.compile(r"^[0-9a-f]{64}$")
ASSET_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg", ".webp", ".svg"})
MIME_BY_EXT = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".svg": "image/svg+xml",
}
EXT_BY_MIME = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
    "image/svg+xml": ".svg",
}
MAX_RASTER_DIMENSION = 16_384
MAX_RASTER_PIXELS = (128 * 1024 * 1024) // 4
MAX_SVG_ELEMENTS = 5_000
MAX_SVG_DEPTH = 64
MAX_SVG_ATTR_CHARS = 512_000
MAX_SVG_ATTR_VALUE_CHARS = 65_536
_SVG_TAGS = frozenset({
    "svg", "g", "defs", "title", "desc", "path", "rect", "circle", "ellipse",
    "line", "polyline", "polygon", "clipPath", "mask", "linearGradient",
    "radialGradient", "stop",
})
_SVG_ATTRS = frozenset({
    "xmlns", "viewBox", "width", "height", "x", "y", "x1", "y1", "x2", "y2",
    "cx", "cy", "r", "rx", "ry", "d", "points", "transform", "fill", "fill-rule",
    "fill-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
    "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "opacity", "offset",
    "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "id",
    "clip-path", "mask", "preserveAspectRatio", "href",
})
_LOCAL_REF = re.compile(r"^url\(#[A-Za-z_][A-Za-z0-9_.:-]*\)$")
_LENGTH = re.compile(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*(?:px)?\s*$", re.I)
_SVG_NAMESPACE = "http://www.w3.org/2000/svg"
_SVG_UNIT_INTERVAL_ATTRS = frozenset({
    "opacity", "fill-opacity", "stroke-opacity", "stop-opacity", "offset",
})


class DecorAssetError(ValueError):
    """Stable validation failure suitable for an API error response."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ValidatedAsset:
    data: bytes
    mime: str
    ext: str
    width: int
    height: int

    @property
    def asset_id(self) -> str:
        return hashlib.sha256(self.data).hexdigest()


def _check_size(data: bytes) -> None:
    if not data:
        raise DecorAssetError("invalid_image", "The image is empty")
    if len(data) > MAX_DECOR_ASSET_BYTES:
        raise DecorAssetError("too_large", "The image exceeds the 2 MiB limit")


def _raster_dimensions(data: bytes, ext: str) -> tuple[int, int]:
    try:
        if ext == ".png":
            if (len(data) < 45 or data[:8] != b"\x89PNG\r\n\x1a\n"
                    or data[12:16] != b"IHDR" or b"IDAT" not in data
                    or data[-8:-4] != b"IEND"):
                raise ValueError
            return struct.unpack(">II", data[16:24])
        if ext in (".jpg", ".jpeg"):
            if len(data) < 4 or data[:2] != b"\xff\xd8":
                raise ValueError
            pos = 2
            while pos + 4 <= len(data):
                if data[pos] != 0xFF:
                    pos += 1
                    continue
                marker = data[pos + 1]
                pos += 2
                if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                    continue
                length = int.from_bytes(data[pos:pos + 2], "big")
                if length < 2 or pos + length > len(data):
                    raise ValueError
                if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                    if length < 7:
                        raise ValueError
                    return (
                        int.from_bytes(data[pos + 5:pos + 7], "big"),
                        int.from_bytes(data[pos + 3:pos + 5], "big"),
                    )
                pos += length
            raise ValueError
        if ext == ".webp":
            if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
                raise ValueError
            kind = data[12:16]
            if kind == b"VP8X":
                return (
                    1 + int.from_bytes(data[24:27], "little"),
                    1 + int.from_bytes(data[27:30], "little"),
                )
            if kind == b"VP8 ":
                idx = data.find(b"\x9d\x01\x2a", 20)
                if idx < 0 or idx + 7 > len(data):
                    raise ValueError
                return (
                    int.from_bytes(data[idx + 3:idx + 5], "little") & 0x3FFF,
                    int.from_bytes(data[idx + 5:idx + 7], "little") & 0x3FFF,
                )
            if kind == b"VP8L" and data[20] == 0x2F:
                bits = int.from_bytes(data[21:25], "little")
                return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
            raise ValueError
    except (IndexError, struct.error, ValueError) as err:
        raise DecorAssetError(
            "invalid_image", "The raster image is corrupt or has the wrong type",
        ) from err
    raise DecorAssetError("unsupported_image", "Unsupported image type")


def _validate_dimensions(width: float, height: float) -> tuple[int, int]:
    if not math.isfinite(width) or not math.isfinite(height) or width <= 0 or height <= 0:
        raise DecorAssetError("invalid_image", "The image has no usable dimensions")
    w, h = int(round(width)), int(round(height))
    if w <= 0 or h <= 0:
        raise DecorAssetError("invalid_image", "The image has no usable dimensions")
    if w > MAX_RASTER_DIMENSION or h > MAX_RASTER_DIMENSION or w * h > MAX_RASTER_PIXELS:
        raise DecorAssetError("too_large", "Decoded image dimensions exceed the safety limit")
    return w, h


def _svg_number(value: str | None) -> float | None:
    if value is None:
        return None
    match = _LENGTH.fullmatch(value)
    return float(match.group(1)) if match else None


def _validate_svg_unit_interval(name: str, value: str) -> None:
    """Reject non-finite and out-of-range opacity/gradient values."""
    raw = value.strip()
    percent = raw.endswith("%")
    try:
        number = float(raw[:-1] if percent else raw)
    except ValueError as err:
        raise DecorAssetError("invalid_image", f"The SVG {name} value is invalid") from err
    limit = 100 if percent else 1
    if not math.isfinite(number) or number < 0 or number > limit:
        raise DecorAssetError("invalid_image", f"The SVG {name} value is out of range")


def _reject_svg_declarations(data: bytes) -> None:
    """Parse with encoding-aware expat guards before building an XML tree."""
    parser = expat.ParserCreate()

    def reject(*_args: Any) -> None:
        raise DecorAssetError(
            "invalid_image", "DTD, entities and processing instructions are forbidden",
        )

    parser.StartDoctypeDeclHandler = reject
    parser.EntityDeclHandler = reject
    parser.ExternalEntityRefHandler = reject
    parser.ProcessingInstructionHandler = reject
    try:
        parser.Parse(data, True)
    except DecorAssetError:
        raise
    except (expat.ExpatError, UnicodeError) as err:
        raise DecorAssetError("invalid_image", "The SVG is not valid XML") from err


def _validate_svg(data: bytes) -> ValidatedAsset:
    # Byte-substring checks are bypassable with UTF-16/UTF-32. Expat detects
    # the declared/input encoding first and our handlers reject declarations
    # before entity expansion can allocate an ElementTree.
    _reject_svg_declarations(data)
    try:
        root = ET.fromstring(data)
    except (ET.ParseError, UnicodeError) as err:
        raise DecorAssetError("invalid_image", "The SVG is not valid XML") from err
    if root.tag.rsplit("}", 1)[-1] != "svg":
        raise DecorAssetError("invalid_image", "Only an SVG root is accepted")
    count = attr_chars = 0
    ids: set[str] = set()
    refs: list[str] = []
    ref_graph: dict[str, set[str]] = {}
    stack: list[tuple[ET.Element, int, str | None]] = [(root, 1, None)]
    while stack:
        node, depth, inherited_owner = stack.pop()
        count += 1
        if count > MAX_SVG_ELEMENTS or depth > MAX_SVG_DEPTH:
            raise DecorAssetError("too_large", "The SVG structure exceeds the safety limit")
        if node.tag.startswith("{"):
            namespace, tag = node.tag[1:].split("}", 1)
            if namespace != _SVG_NAMESPACE:
                raise DecorAssetError("unsupported_image", "Unknown SVG namespace")
        else:
            raise DecorAssetError("unsupported_image", "The SVG namespace is required")
        if tag not in _SVG_TAGS:
            raise DecorAssetError("unsupported_image", f"Unsupported SVG element: {tag}")
        node_id = node.attrib.get("id")
        owner = node_id or inherited_owner
        if node.text and node.text.strip():
            if tag not in {"title", "desc"} or len(node.text) > 4096:
                raise DecorAssetError("unsupported_image", "Unsupported or oversized SVG text")
        for raw_name, value in node.attrib.items():
            if len(value) > MAX_SVG_ATTR_VALUE_CHARS:
                raise DecorAssetError("too_large", "An SVG attribute exceeds the safety limit")
            if raw_name.startswith("{"):
                raise DecorAssetError("unsupported_image", "Namespaced SVG attributes are unsupported")
            name = raw_name
            attr_chars += len(raw_name) + len(value)
            if attr_chars > MAX_SVG_ATTR_CHARS:
                raise DecorAssetError("too_large", "The SVG attributes exceed the safety limit")
            if name.lower().startswith("on") or name not in _SVG_ATTRS:
                raise DecorAssetError("unsupported_image", f"Unsupported SVG attribute: {name}")
            if name in _SVG_UNIT_INTERVAL_ATTRS:
                _validate_svg_unit_interval(name, value)
            low = value.strip().lower()
            if any(token in low for token in ("javascript:", "data:", "http:", "https:", "//")):
                raise DecorAssetError("invalid_image", "External SVG resources are forbidden")
            if "url(" in low:
                if not _LOCAL_REF.fullmatch(value.strip()):
                    raise DecorAssetError("invalid_image", "Only local SVG references are allowed")
                ref = value.strip()[5:-1]
                refs.append(ref)
                if owner:
                    ref_graph.setdefault(owner, set()).add(ref)
            if name == "href":
                if not re.fullmatch(r"#[A-Za-z_][A-Za-z0-9_.:-]*", value.strip()):
                    raise DecorAssetError("invalid_image", "Only local SVG references are allowed")
                ref = value.strip()[1:]
                refs.append(ref)
                if owner:
                    ref_graph.setdefault(owner, set()).add(ref)
            if name == "id":
                if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.:-]*", value) or value in ids:
                    raise DecorAssetError("invalid_image", "SVG ids must be unique and well formed")
                ids.add(value)
        stack.extend((child, depth + 1, owner) for child in node)
    if any(ref not in ids for ref in refs):
        raise DecorAssetError("invalid_image", "The SVG contains an unresolved local reference")

    visiting: set[str] = set()
    visited: set[str] = set()

    def _visit(node_id: str) -> None:
        if node_id in visiting:
            raise DecorAssetError("invalid_image", "The SVG contains a cyclic local reference")
        if node_id in visited:
            return
        visiting.add(node_id)
        for ref in ref_graph.get(node_id, ()):
            _visit(ref)
        visiting.remove(node_id)
        visited.add(node_id)

    for node_id in ids:
        _visit(node_id)
    view_box = root.attrib.get("viewBox")
    width = _svg_number(root.attrib.get("width"))
    height = _svg_number(root.attrib.get("height"))
    if view_box:
        try:
            parts = [float(part) for part in re.split(r"[\s,]+", view_box.strip())]
            if len(parts) != 4:
                raise ValueError
            width, height = parts[2], parts[3]
        except ValueError as err:
            raise DecorAssetError("invalid_image", "The SVG viewBox is invalid") from err
    w, h = _validate_dimensions(width or 0, height or 0)
    ET.register_namespace("", _SVG_NAMESPACE)
    canonical = ET.tostring(
        root, encoding="utf-8", xml_declaration=False, short_empty_elements=True,
    )
    _check_size(canonical)
    try:
        ET.fromstring(canonical)
    except ET.ParseError as err:  # pragma: no cover - serializer invariant
        raise DecorAssetError("invalid_image", "Canonical SVG could not be reparsed") from err
    return ValidatedAsset(canonical, "image/svg+xml", ".svg", w, h)


def validate_asset(
    data: bytes, filename: str, declared_mime: str | None = None,
) -> ValidatedAsset:
    """Validate and canonicalise one complete upload."""
    _check_size(data)
    ext = Path(filename).suffix.lower()
    if ext not in ASSET_EXTENSIONS:
        raise DecorAssetError("unsupported_image", "Use PNG, JPEG, WebP or SVG")
    expected_mime = MIME_BY_EXT[ext]
    claimed = str(declared_mime or "").split(";", 1)[0].strip().lower()
    if claimed and claimed != "application/octet-stream" and claimed != expected_mime:
        raise DecorAssetError("invalid_format", "The filename, MIME type and image bytes disagree")
    if ext == ".svg":
        return _validate_svg(data)
    width, height = _validate_dimensions(*_raster_dimensions(data, ext))
    # Home Assistant ships Pillow. Header parsing above keeps this helper
    # independently testable, while a full decode here catches valid-looking
    # but truncated/corrupt payloads before they enter the authenticated store.
    try:
        from io import BytesIO
        from PIL import Image

        with Image.open(BytesIO(data)) as image:
            image.load()
            if image.size != (width, height):
                raise DecorAssetError("invalid_image", "Image dimensions are inconsistent")
            if getattr(image, "is_animated", False):
                raise DecorAssetError("unsupported_image", "Animated images are unsupported")
    except ImportError:
        # The Home Assistant runtime includes Pillow. Keeping the pure parser
        # usable without the full HA dependency set lets repository-local
        # security tests still exercise signatures, dimensions and SVG.
        pass
    except DecorAssetError:
        raise
    except Exception as err:  # noqa: BLE001 - decoder failures are one public error
        raise DecorAssetError("invalid_image", "The raster image cannot be decoded") from err
    mime = expected_mime
    return ValidatedAsset(data, mime, EXT_BY_MIME[mime], width, height)


def asset_refs(config: dict[str, Any] | None) -> dict[str, list[dict[str, str]]]:
    """Return server-authoritative references grouped by asset id."""
    out: dict[str, list[dict[str, str]]] = {}
    for space in (config or {}).get("spaces") or []:
        if not isinstance(space, dict):
            continue
        sid = str(space.get("id") or "")
        for shape in space.get("decor") or []:
            if not isinstance(shape, dict) or shape.get("kind") != "image":
                continue
            aid = shape.get("asset_id")
            if isinstance(aid, str) and ASSET_ID_RE.fullmatch(aid):
                out.setdefault(aid, []).append({
                    "space_id": sid, "decor_id": str(shape.get("id") or ""),
                })
    return out


def asset_meta_path(root: Path, asset_id: str) -> Path:
    return root / f"{asset_id}.json"


def read_catalog(root: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not root.is_dir():
        return rows
    for path in root.glob("*.json"):
        try:
            row = json.loads(path.read_text(encoding="utf-8"))
            aid = str(row.get("asset_id") or "")
            ext = row.get("ext")
            blob = root / f"{aid}{ext}"
            if ASSET_ID_RE.fullmatch(aid) and ext in ASSET_EXTENSIONS and blob.is_file():
                rows.append(row)
        except (OSError, ValueError, TypeError):
            continue
    return sorted(
        rows,
        key=lambda row: (str(row.get("created_at", "")), str(row["asset_id"])),
        reverse=True,
    )


def public_asset(
    row: dict[str, Any], used_by: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    aid = str(row["asset_id"])
    ext = str(row["ext"])
    return {
        "asset_id": aid,
        "name": row.get("name", "image"),
        "mime": row.get("mime"),
        "width": row.get("width"),
        "height": row.get("height"),
        "bytes": row.get("bytes"),
        "url": f"{CONTENT_URL}/assets/_/{aid}{ext}",
        "used_by": used_by or [],
    }
