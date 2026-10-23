"""Closed, bounded portable ZIP container. No network or public-file writes (#936)."""
from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import struct
import zipfile
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from xml.parsers import expat

from .const import ASSETS_DIR, MAX_DECOR_ASSET_BYTES, MAX_EXPORT_BYTES
from .decor_assets import DecorAssetError, validate_asset
from .import_export import ImportFailure, _internal_path, _strict_object, parse_document
from .validation import MAX_FILE_BYTES, MAX_PLAN_BYTES, PLAN_EXTENSIONS
from .zigbee_topology import MAX_CACHE_BYTES, validate_saved_topics

FORMAT = "houseplan-full-backup"
VERSION = 1
MAX_ARCHIVE_BYTES = 2 * 1024**3
MAX_EXPANDED_BYTES = 2 * 1024**3
MAX_ENTRIES = 1600
MAX_MANIFEST_BYTES = 2 * 1024**2
CHUNK = 64 * 1024
_HASH = re.compile(r"[0-9a-f]{64}\Z")
_BLOB = re.compile(r"images/([0-9a-f]{64})\.(png|jpg|webp|svg)\Z")
_IMAGE_EXTS = frozenset({".png", ".jpg", ".jpeg", ".webp"})
_REASONS = frozenset({"missing", "external", "invalid", "changed"})
_SVG_NAMESPACE = "http://www.w3.org/2000/svg"


def fail(code: str = "zip_invalid") -> ImportFailure:
    return ImportFailure(code, code)


def json_bytes(value: Any, limit: int) -> bytes:
    try:
        raw = json.dumps(value, ensure_ascii=False, allow_nan=False,
                         separators=(",", ":")).encode()
    except (TypeError, ValueError, RecursionError) as err:
        raise fail() from err
    if len(raw) > limit:
        raise fail("zip_limit")
    return raw


def strict_json(raw: bytes, limit: int) -> dict[str, Any]:
    if len(raw) > limit:
        raise fail("zip_limit")
    try:
        value = json.loads(raw, object_pairs_hook=_strict_object,
                           parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except (ValueError, UnicodeError, RecursionError, ImportFailure) as err:
        raise fail() from err
    if not isinstance(value, dict):
        raise fail()
    return value


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def safe_read(root: Path, path: Path, limit: int) -> bytes:
    """Open every component relative to a trusted directory, never follow a link."""
    relative = path.relative_to(root)
    if not relative.parts or any(p in ("", ".", "..") for p in relative.parts):
        raise fail()
    descriptors: list[int] = []
    try:
        current = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        descriptors.append(current)
        for part in relative.parts[:-1]:
            current = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                              dir_fd=current)
            descriptors.append(current)
        fd = os.open(relative.parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=current)
        descriptors.append(fd)
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_size > limit:
            raise fail("zip_limit")
        blocks = []
        size = 0
        while block := os.read(fd, min(CHUNK, limit - size + 1)):
            size += len(block)
            if size > limit:
                raise fail("zip_limit")
            blocks.append(block)
        after = os.fstat(fd)
        def identity(s):
            return s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns
        if identity(before) != identity(after) or size != before.st_size:
            raise fail("zip_changed")
        return b"".join(blocks)
    finally:
        for fd in reversed(descriptors):
            os.close(fd)


@dataclass
class ImageRef:
    kind: str
    owner: str
    owner_id: str
    field: str
    target: dict[str, Any]
    key: str
    name: str

    def record(self) -> dict[str, str]:
        return {"kind": self.kind, "owner": self.owner, "owner_id": self.owner_id,
                "field": self.field, "url": str(self.target[self.key])}

    @property
    def limit(self) -> int:
        return (MAX_PLAN_BYTES if self.kind == "plan" else MAX_DECOR_ASSET_BYTES
                if self.kind == "decor_asset" else MAX_FILE_BYTES)


def image_refs(config: dict[str, Any]) -> list[ImageRef]:
    refs = []
    for space in config.get("spaces") or []:
        sid = str(space.get("id", ""))
        name = str(space.get("title") or sid)[:160]
        if space.get("plan_url"):
            refs.append(ImageRef("plan", "space", sid, "plan_url", space, "plan_url", name))
        for shape in space.get("decor") or []:
            if shape.get("kind") == "image" and shape.get("asset_id"):
                refs.append(ImageRef("decor_asset", "decor", f"{sid}:{shape.get('id', '')}",
                                     "asset_id", shape, "asset_id", name))
    for marker in config.get("markers") or []:
        for index, item in enumerate(marker.get("pdfs") or []):
            url = item.get("url") if isinstance(item, dict) else None
            if isinstance(url, str) and Path(urlsplit(url).path).suffix.lower() in _IMAGE_EXTS:
                refs.append(ImageRef("attachment", "marker", str(marker.get("id", "")),
                                     f"pdfs[{index}].url", item, "url",
                                     str(marker.get("name") or marker.get("id") or "")[:160]))
    return refs


def ref_key(ref: dict[str, Any]) -> tuple[str, ...]:
    return tuple(ref.get(key, "") for key in ("kind", "owner", "owner_id", "field", "url"))


def strip_transport_credentials(document: dict[str, Any]) -> None:
    """Signed content URLs belong to a browser request, never to a portable file."""
    config = document["payload"]["config"]
    for ref in image_refs(config):
        if ref.kind == "decor_asset":
            continue
        parsed = urlsplit(str(ref.target[ref.key]))
        query = urlencode([(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
                           if k.lower() != "authsig"])
        ref.target[ref.key] = urlunsplit(parsed._replace(query=query))
    # Regenerated by the caller after this projection; no stale URL identity.


def _check_plan_svg(raw: bytes) -> None:
    """Well-formed XML with an ``svg`` root; no entity can be declared.

    A plain ``<!DOCTYPE svg PUBLIC …>`` is how Sweet Home 3D, LibreOffice and
    other plan editors write SVG, so it passes; an internal subset, an entity
    declaration or an external entity does not. Nothing is expanded or loaded.
    """
    parser = expat.ParserCreate(namespace_separator=" ")
    root: list[str] = []

    def reject(*_args: Any) -> None:
        raise fail()

    def doctype(_name: str, _system: str | None, _public: str | None, internal: int) -> None:
        if internal:
            raise fail()

    def start(name: str, _attrs: Any) -> None:
        if not root:
            root.append(name)

    parser.StartDoctypeDeclHandler = doctype
    parser.EntityDeclHandler = reject
    parser.UnparsedEntityDeclHandler = reject
    parser.NotationDeclHandler = reject
    parser.ExternalEntityRefHandler = reject
    parser.StartElementHandler = start
    try:
        parser.Parse(raw, True)
    except (expat.ExpatError, UnicodeError, ValueError) as err:
        raise fail() from err
    if root not in (["svg"], [f"{_SVG_NAMESPACE} svg"]):
        raise fail()


_PLAN_SIGNATURES = {
    ".png": lambda raw: raw.startswith(b"\x89PNG\r\n\x1a\n"),
    ".jpg": lambda raw: raw.startswith(b"\xff\xd8\xff"),
    ".webp": lambda raw: raw[:4] == b"RIFF" and raw[8:12] == b"WEBP",
}


def plan_image_ext(raw: bytes, name: str, limit: int = MAX_PLAN_BYTES) -> str:
    """#1033: a backdrop travels under the backdrop upload rule.

    Upload accepts a backdrop by extension, size and quota, and the card shows
    it only through ``<image>`` under a sandbox CSP. The decor whitelist (no
    ``<text>``, at most 32 Mpx) dropped real backdrops from the archive. Here
    the bytes must still be what the name says; the SVG check is stricter than
    upload, never looser.
    """
    ext = Path(name).suffix.lower()
    ext = ".jpg" if ext == ".jpeg" else ext
    if ext[1:] not in PLAN_EXTENSIONS or not raw or len(raw) > limit:
        raise fail()
    if ext == ".svg":
        _check_plan_svg(raw)
    elif not _PLAN_SIGNATURES[ext](raw):
        raise fail()
    return ext


def _source_image(root: Path, ref: ImageRef) -> tuple[bytes, str]:
    value = str(ref.target[ref.key])
    if ref.kind == "decor_asset":
        if not _HASH.fullmatch(value):
            raise fail()
        candidates = [root / ASSETS_DIR / f"{value}{ext}"
                      for ext in (".jpg", ".png", ".svg", ".webp")]
        path = next((p for p in candidates if p.exists() or p.is_symlink()), None)
        if path is None:
            raise FileNotFoundError
    else:
        internal = _internal_path(root, value)
        if internal is None:
            raise fail("zip_external")
        path = internal[1]
    raw = safe_read(root, path, ref.limit)
    if ref.kind == "plan":
        return raw, plan_image_ext(raw, path.name, ref.limit)
    image = validate_asset(raw, path.name, max_bytes=ref.limit)
    if ref.kind == "decor_asset" and (digest(raw) != value or image.data != raw):
        raise fail()
    return raw, image.ext


def _entry(raw: bytes, name: str) -> dict[str, Any]:
    return {"entry": name, "bytes": len(raw), "sha256": digest(raw)}


def build_archive(path: Path, document: dict[str, Any], root: Path,
                  topics: dict[str, Any], reserve: Callable[[int], None] | None = None) -> dict[str, Any]:
    """Write a private ZIP incrementally; missing images become explicit metadata."""
    if document.get("kind") != "full":
        raise fail()
    topics = validate_saved_topics(topics)
    images, blobs = [], {}
    expanded = 0
    with zipfile.ZipFile(path, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
        def add(name: str, raw: bytes) -> dict[str, Any]:
            nonlocal expanded
            expanded += len(raw)
            if expanded > MAX_EXPANDED_BYTES or len(archive.filelist) >= MAX_ENTRIES:
                raise fail("zip_limit")
            if reserve is not None:
                reserve(len(raw) + 256)
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o600) << 16
            archive.writestr(info, raw, compresslevel=1)
            if archive.fp.tell() > MAX_ARCHIVE_BYTES:
                raise fail("zip_limit")
            return _entry(raw, name)

        for ref in image_refs(document["payload"]["config"]):
            if reserve is not None:
                reserve(0)
            row: dict[str, Any] = {"ref": ref.record(), "name": ref.name}
            try:
                raw, ext = _source_image(root, ref)
            except (OSError, ValueError, DecorAssetError, ImportFailure) as err:
                code = getattr(err, "code", "")
                row["reason"] = ("external" if code == "zip_external" else "changed"
                                 if code == "zip_changed" else "missing"
                                 if isinstance(err, FileNotFoundError) else "invalid")
            else:
                blob = f"images/{digest(raw)}{ext}"
                if blob not in blobs:
                    blobs[blob] = add(blob, raw)
                row["blob"] = blob
            images.append(row)
        doc = add("document.json", json_bytes(document, MAX_EXPORT_BYTES))
        snapshot = add("zigbee.json", json_bytes({"topics": topics}, MAX_CACHE_BYTES)) if topics else None
        missing = [row for row in images if "reason" in row]
        manifest = {"format": FORMAT, "version": VERSION, "complete": not missing,
                    "document": doc, "snapshot": snapshot, "images": images,
                    "blobs": blobs}
        add("manifest.json", json_bytes(manifest, MAX_MANIFEST_BYTES))
    if path.stat().st_size > MAX_ARCHIVE_BYTES:
        raise fail("zip_limit")
    return manifest


def _check_directory(path: Path) -> None:
    """Bound directory allocations BEFORE ZipFile constructs ZipInfo objects."""
    size = path.stat().st_size
    if size > MAX_ARCHIVE_BYTES or size < 22:
        raise fail("zip_limit" if size > MAX_ARCHIVE_BYTES else "zip_invalid")
    with path.open("rb") as source:
        source.seek(max(0, size - 65557))
        tail = source.read(65557)
    pos = tail.rfind(b"PK\x05\x06")
    if pos < 0 or pos + 22 > len(tail):
        raise fail()
    fields = struct.unpack("<4s4H2IH", tail[pos:pos + 22])
    _, disk, central_disk, count_disk, count, central_size, offset, comment_len = fields
    if (disk or central_disk or count != count_disk or not 1 <= count <= MAX_ENTRIES
            or central_size > MAX_MANIFEST_BYTES or pos + 22 + comment_len != len(tail)
            or offset + central_size != size - len(tail) + pos):
        raise fail()


def _validate_info(info: zipfile.ZipInfo) -> None:
    if (info.orig_filename != info.filename or not re.fullmatch(r"[A-Za-z0-9./_-]{1,96}", info.filename)
            or info.filename.startswith("/") or any(p in ("", ".", "..") for p in info.filename.split("/"))
            or info.flag_bits & 1 or info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
            or stat.S_IFMT(info.external_attr >> 16) not in (0, stat.S_IFREG)
            or len(info.extra) > 1024 or len(info.comment) > 256
            or info.file_size < 0 or info.compress_size < 0):
        raise fail()


def _descriptor(value: Any, name: str, limit: int) -> dict[str, Any]:
    if (not isinstance(value, dict) or set(value) != {"entry", "bytes", "sha256"}
            or value["entry"] != name or type(value["bytes"]) is not int
            or not 0 < value["bytes"] <= limit
            or not isinstance(value["sha256"], str) or not _HASH.fullmatch(value["sha256"])):
        raise fail()
    return value


@dataclass
class ArchivePayload:
    document: dict[str, Any]
    manifest: dict[str, Any]
    topics: dict[str, Any]
    blobs: dict[str, Path]


def expanded_size(path: Path) -> int:
    _check_directory(path)
    try:
        with zipfile.ZipFile(path) as archive:
            size = sum(info.file_size for info in archive.infolist())
        if size > MAX_EXPANDED_BYTES:
            raise fail("zip_limit")
        return size
    except (OSError, zipfile.BadZipFile) as err:
        raise fail() from err


def read_archive(path: Path, staging: Path, check: Callable[[int], None] | None = None) -> ArchivePayload:
    """Only caller-owned private staging is written; archive names never select paths."""
    _check_directory(path)
    expanded = 0
    try:
        with zipfile.ZipFile(path) as archive:
            infos = archive.infolist()
            names = [info.filename for info in infos]
            if len(names) != len(set(names)) or len(names) > MAX_ENTRIES:
                raise fail()
            for info in infos:
                _validate_info(info)
            if "manifest.json" not in names:
                raise fail()

            def read(name: str, limit: int, dest: Path | None = None) -> bytes:
                nonlocal expanded
                info = archive.getinfo(name)
                if info.file_size > limit or expanded + info.file_size > MAX_EXPANDED_BYTES:
                    raise fail("zip_limit")
                size, blocks = 0, []
                output = dest.open("xb") if dest else None
                try:
                    with archive.open(info) as source:
                        while block := source.read(CHUNK):
                            if check is not None:
                                check(0)
                            size += len(block)
                            expanded += len(block)
                            if size > limit or expanded > MAX_EXPANDED_BYTES:
                                raise fail("zip_limit")
                            if output:
                                output.write(block)
                            else:
                                blocks.append(block)
                    if size != info.file_size:
                        raise fail()
                    if output:
                        output.flush()
                        os.fsync(output.fileno())
                finally:
                    if output:
                        output.close()
                return b"".join(blocks)

            manifest = strict_json(read("manifest.json", MAX_MANIFEST_BYTES), MAX_MANIFEST_BYTES)
            if (set(manifest) != {"format", "version", "complete", "document", "snapshot", "images", "blobs"}
                    or manifest["format"] != FORMAT or type(manifest["version"]) is not int
                    or manifest["version"] != VERSION or type(manifest["complete"]) is not bool
                    or not isinstance(manifest["images"], list) or not isinstance(manifest["blobs"], dict)):
                raise fail()
            doc_meta = _descriptor(manifest["document"], "document.json", MAX_EXPORT_BYTES)
            expected = {"manifest.json", "document.json"}
            for name, meta in manifest["blobs"].items():
                if not _BLOB.fullmatch(name):
                    raise fail()
                _descriptor(meta, name, MAX_FILE_BYTES)
                expected.add(name)
            snapshot_meta = manifest["snapshot"]
            if snapshot_meta is not None:
                _descriptor(snapshot_meta, "zigbee.json", MAX_CACHE_BYTES)
                expected.add("zigbee.json")
            if set(names) != expected:
                raise fail()

            def checked(name: str, meta: dict[str, Any], limit: int) -> bytes:
                raw = read(name, limit)
                if len(raw) != meta["bytes"] or digest(raw) != meta["sha256"]:
                    raise fail()
                return raw

            document = parse_document(checked("document.json", doc_meta, MAX_EXPORT_BYTES))
            if document["kind"] != "full":
                raise fail()
            refs = image_refs(document["payload"]["config"])
            by_key = {ref_key(ref.record()): ref for ref in refs}
            seen, used = set(), set()
            for row in manifest["images"]:
                if not isinstance(row, dict) or set(row) not in ({"ref", "name", "blob"}, {"ref", "name", "reason"}):
                    raise fail()
                reference = row["ref"]
                if (not isinstance(reference, dict)
                        or set(reference) != {"kind", "owner", "owner_id", "field", "url"}
                        or not all(isinstance(v, str) for v in reference.values())
                        or not isinstance(row["name"], str) or len(row["name"]) > 160):
                    raise fail()
                key = ref_key(reference)
                if key not in by_key or key in seen:
                    raise fail()
                seen.add(key)
                if "reason" in row:
                    if row["reason"] not in _REASONS:
                        raise fail()
                else:
                    blob = row["blob"]
                    if not isinstance(blob, str) or blob not in manifest["blobs"]:
                        raise fail()
                    used.add(blob)
                    if manifest["blobs"][blob]["bytes"] > by_key[key].limit:
                        raise fail("zip_limit")
            if (seen != set(by_key) or used != set(manifest["blobs"])
                    or manifest["complete"] != all("blob" in row for row in manifest["images"])):
                raise fail()
            topics = {}
            if snapshot_meta is not None:
                snapshot = strict_json(checked("zigbee.json", snapshot_meta, MAX_CACHE_BYTES), MAX_CACHE_BYTES)
                if set(snapshot) != {"topics"}:
                    raise fail()
                topics = validate_saved_topics(snapshot["topics"])
            blobs = {}
            for index, (name, meta) in enumerate(manifest["blobs"].items()):
                dest = staging / f"blob-{index}"
                read(name, min(MAX_FILE_BYTES, meta["bytes"]), dest)
                raw = safe_read(staging, dest, meta["bytes"])
                if len(raw) != meta["bytes"] or digest(raw) != meta["sha256"]:
                    raise fail()
                rows = [row for row in manifest["images"] if row.get("blob") == name]
                if all(row["ref"]["kind"] == "plan" for row in rows):
                    # #1033: only backdrops use these bytes — the backdrop rule.
                    ext = plan_image_ext(raw, name, MAX_PLAN_BYTES)
                else:
                    image = validate_asset(raw, name, max_bytes=MAX_FILE_BYTES)
                    ext = image.ext
                    for row in rows:
                        if row["ref"]["kind"] == "decor_asset" and (
                                digest(raw) != row["ref"]["url"] or image.data != raw):
                            raise fail()
                if name != f"images/{digest(raw)}{ext}":
                    raise fail()
                blobs[name] = dest
            return ArchivePayload(document, manifest, topics, blobs)
    except (OSError, EOFError, ValueError, KeyError, TypeError, zipfile.BadZipFile, zlib.error,
            NotImplementedError, RuntimeError, DecorAssetError) as err:
        raise fail() from err
