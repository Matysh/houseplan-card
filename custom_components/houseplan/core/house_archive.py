"""Closed house-only ZIP, bounded before ZipInfo allocation, never a backup.

Readers retain the verified private ZIP rather than a second complete extracted
image tree. Images are validated one at a time; publication rereads exact entries
against their hashes. A data-only source port supplies bytes, never network URLs.
"""
from __future__ import annotations

import copy
import hashlib
import re
import stat
import zipfile
import zlib
from dataclasses import dataclass
from pathlib import Path

from .backup_archive import (
    CHUNK,
    MAX_MANIFEST_BYTES,
    _check_directory,
    _descriptor,
    _entry,
    _validate_info,
    image_refs,
    json_bytes,
    plan_image_ext,
    ref_key,
    strict_json,
)
from .constants import MAX_EXPORT_BYTES
from .content_index import internal_reference
from .decor_assets import DecorAssetError, validate_asset
from .house_document import parse_document, sanitize_image_urls
from .house_prefix import MIMETYPE, PREFIX_BYTES, canonical_prefix, classify_prefix
from .import_export import ImportFailure
from .input_policy import InputLimit, checkpoint, current_policy
from .validation import MAX_PLAN_BYTES

FORMAT = "houseplan-plan-transfer"
ARCHIVE_VERSION = 1
MAX_ARCHIVE_BYTES = 576 * 1024**2
MAX_EXPANDED_BYTES = 576 * 1024**2
MAX_ENTRIES = 512
_BLOB = re.compile(r"images/([0-9a-f]{64})\.(png|jpg|webp|svg)\Z")
_REASONS = frozenset({"missing", "external", "invalid", "changed"})


def fail(code="zip_invalid"):
    return ImportFailure(code)


def check_prefix(raw):
    kind = classify_prefix(raw)
    if kind != "house":
        raise fail("unsupported-transfer" if kind == "unsupported" else "not_plan_transfer")


def _validated_image(raw, extension, refs):
    if not isinstance(raw, bytes) or extension not in {".png", ".jpg", ".jpeg", ".svg", ".webp"}:
        raise fail()
    if any(len(raw) > ref.limit for ref in refs):
        raise fail("zip_limit")
    if all(ref.kind == "plan" for ref in refs):
        extension = plan_image_ext(raw, f"image{extension}")
        mime = {".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp"}[extension]
    else:
        image = validate_asset(raw, f"image{extension}", max_bytes=max(ref.limit for ref in refs))
        extension, mime = image.ext, image.mime
        for ref in refs:
            if ref.kind == "decor_asset" and (hashlib.sha256(raw).hexdigest() != ref.target[ref.key] or image.data != raw):
                raise fail()
    return extension, mime


def build_archive(path: Path, document: dict, read_image, reserve=None) -> dict:
    document = copy.deepcopy(document)
    sanitize_image_urls(document)
    document = parse_document(json_bytes(document, MAX_EXPORT_BYTES))
    images, blobs = [], {}
    expanded = 0
    maximum = min(MAX_EXPANDED_BYTES, current_policy().expanded_bytes)
    with zipfile.ZipFile(path, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
        def add(name, raw, *, stored=False):
            nonlocal expanded
            checkpoint()
            expanded += len(raw)
            if expanded > maximum or len(archive.filelist) >= MAX_ENTRIES:
                raise fail("zip_limit")
            if reserve is not None:
                reserve(len(raw) + 256)
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IFREG | 0o600) << 16
            archive.writestr(info, raw, compresslevel=None if stored else 1)
            if archive.fp.tell() > min(MAX_ARCHIVE_BYTES, current_policy().archive_bytes):
                raise fail("zip_limit")
            return _entry(raw, name)

        add("mimetype", MIMETYPE, stored=True)
        for ref in image_refs(document["payload"]["config"]):
            row = {"ref": ref.record(), "name": ref.name}
            logical = internal_reference(str(ref.target[ref.key])) if ref.kind == "plan" else None
            if ref.kind == "plan" and logical is None:
                row["reason"] = "external"
            elif ref.kind == "plan" and logical.kind not in {"plan", "asset_file"}:
                # A House-only transfer never collects device attachments.
                row["reason"] = "invalid"
            else:
                try:
                    raw, extension = read_image(ref)
                    extension, mime = _validated_image(raw, extension, [ref])
                except InputLimit:
                    raise
                except (OSError, ValueError, DecorAssetError, ImportFailure) as error:
                    row["reason"] = ("missing" if isinstance(error, FileNotFoundError) else "changed"
                                     if getattr(error, "code", None) == "zip_changed" else "invalid")
                else:
                    name = f"images/{hashlib.sha256(raw).hexdigest()}{extension}"
                    if name not in blobs:
                        if len(archive.filelist) >= MAX_ENTRIES - 2:
                            raise fail("zip_limit")
                        blobs[name] = {**add(name, raw), "mime": mime}
                    row["blob"] = name
            images.append(row)
        doc = add("document.json", json_bytes(document, MAX_EXPORT_BYTES))
        manifest = {"format": FORMAT, "archive_version": ARCHIVE_VERSION,
                    "complete": all("blob" in row for row in images), "document": doc,
                    "images": images, "blobs": blobs}
        add("manifest.json", json_bytes(manifest, MAX_MANIFEST_BYTES))
    if path.stat().st_size > min(MAX_ARCHIVE_BYTES, current_policy().archive_bytes):
        raise fail("zip_limit")
    with path.open("rb") as source:
        if source.read(len(canonical_prefix())) != canonical_prefix():
            raise fail()
    return manifest


@dataclass(frozen=True, slots=True)
class HousePayload:
    document: dict
    manifest: dict
    archive_sha256: str
    # Computed by our parser, never read from archive metadata.
    workstation_repairs: dict | None = None


def archive_digest(path, check=None):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while block := source.read(CHUNK):
            checkpoint()
            if check is not None:
                check(0)
            digest.update(block)
    return digest.hexdigest()


class Reader:
    def __init__(self, archive, check=None):
        self.archive, self.check, self.expanded = archive, check, 0

    def read(self, name, limit):
        info = self.archive.getinfo(name)
        maximum = min(MAX_EXPANDED_BYTES, current_policy().expanded_bytes)
        if info.file_size > limit or self.expanded + info.file_size > maximum:
            raise fail("zip_limit")
        blocks, size = [], 0
        with self.archive.open(info) as source:
            while block := source.read(CHUNK):
                checkpoint()
                if self.check is not None:
                    self.check(0)
                size += len(block)
                self.expanded += len(block)
                if size > limit or self.expanded > maximum:
                    raise fail("zip_limit")
                blocks.append(block)
        if size != info.file_size:
            raise fail()
        return b"".join(blocks)

    def checked(self, name, descriptor, limit):
        raw = self.read(name, limit)
        if len(raw) != descriptor["bytes"] or hashlib.sha256(raw).hexdigest() != descriptor["sha256"]:
            raise fail()
        return raw


def read_archive(path: Path, check=None) -> HousePayload:
    try:
        with path.open("rb") as source:
            check_prefix(source.read(PREFIX_BYTES))
        _check_directory(path, entry_limit=MAX_ENTRIES, archive_limit=MAX_ARCHIVE_BYTES)
        before = archive_digest(path) if check is None else archive_digest(path, check)
        with zipfile.ZipFile(path) as archive:
            infos = archive.infolist()
            names = [info.filename for info in infos]
            if len(set(names)) != len(names) or not names or names[0] != "mimetype":
                raise fail()
            for info in infos:
                _validate_info(info)
            first = infos[0]
            if first.header_offset != 0 or first.extra or first.flag_bits or first.compress_type != zipfile.ZIP_STORED:
                raise fail()
            reader = Reader(archive, check)
            if reader.read("mimetype", PREFIX_BYTES) != MIMETYPE:
                raise fail()
            manifest = strict_json(reader.read("manifest.json", MAX_MANIFEST_BYTES), MAX_MANIFEST_BYTES)
            if (set(manifest) != {"format", "archive_version", "complete", "document", "images", "blobs"}
                    or manifest["format"] != FORMAT or type(manifest["archive_version"]) is not int
                    or manifest["archive_version"] != ARCHIVE_VERSION or type(manifest["complete"]) is not bool
                    or not isinstance(manifest["images"], list) or not isinstance(manifest["blobs"], dict)):
                raise fail()
            document_meta = _descriptor(manifest["document"], "document.json", MAX_EXPORT_BYTES)
            workstation_repairs = {}
            document = parse_document(reader.checked("document.json", document_meta, MAX_EXPORT_BYTES),
                                      workstation_repairs=workstation_repairs)
            refs = {ref_key(ref.record()): ref for ref in image_refs(document["payload"]["config"])}
            expected, seen, used = {"mimetype", "document.json", "manifest.json"}, set(), set()
            for name, metadata in manifest["blobs"].items():
                if not isinstance(name, str) or not _BLOB.fullmatch(name) or not isinstance(metadata, dict) or set(metadata) != {"entry", "bytes", "sha256", "mime"}:
                    raise fail()
                _descriptor({key: value for key, value in metadata.items() if key != "mime"}, name, MAX_PLAN_BYTES)
                if not isinstance(metadata["mime"], str):
                    raise fail()
                expected.add(name)
            if set(names) != expected:
                raise fail()
            for row in manifest["images"]:
                if not isinstance(row, dict) or set(row) not in ({"ref", "name", "blob"}, {"ref", "name", "reason"}):
                    raise fail()
                reference = row["ref"]
                if (not isinstance(reference, dict) or set(reference) != {"kind", "owner", "owner_id", "field", "url"}
                        or not all(isinstance(value, str) for value in reference.values())
                        or not isinstance(row["name"], str) or len(row["name"]) > 160):
                    raise fail()
                key = ref_key(reference)
                if key not in refs or key in seen:
                    raise fail()
                seen.add(key)
                if "reason" in row:
                    if row["reason"] not in _REASONS:
                        raise fail()
                else:
                    name = row["blob"]
                    if not isinstance(name, str) or name not in manifest["blobs"]:
                        raise fail()
                    used.add(name)
                    if manifest["blobs"][name]["bytes"] > refs[key].limit:
                        raise fail("zip_limit")
            if seen != set(refs) or used != set(manifest["blobs"]) or manifest["complete"] != all("blob" in row for row in manifest["images"]):
                raise fail()
            # Decode one image at a time. Do not retain a second expanded tree.
            for name, metadata in manifest["blobs"].items():
                owners = [refs[ref_key(row["ref"])] for row in manifest["images"] if row.get("blob") == name]
                raw = reader.checked(name, metadata, min(ref.limit for ref in owners))
                extension, mime = _validated_image(raw, Path(name).suffix, owners)
                if check is not None:
                    check(0)
                if name != f"images/{hashlib.sha256(raw).hexdigest()}{extension}" or metadata["mime"] != mime:
                    raise fail()
        after = archive_digest(path) if check is None else archive_digest(path, check)
        if after != before:
            raise fail("zip_changed")
        return HousePayload(document, manifest, before,
                            workstation_repairs if workstation_repairs.get("detached") else None)
    except InputLimit as error:
        raise ImportFailure(error.code, reason=error.reason) from error
    except DecorAssetError as error:
        raise fail(error.code if current_policy().strict else "zip_invalid") from error
    except (OSError, EOFError, ValueError, KeyError, TypeError, zipfile.BadZipFile, zlib.error,
            NotImplementedError, RuntimeError) as error:
        raise fail() from error


def missing_projection(payload: HousePayload):
    """Only declared missing source images may be detached, after confirmation."""
    document = copy.deepcopy(payload.document)
    refs = {ref_key(ref.record()): ref for ref in image_refs(document["payload"]["config"])}
    for row in payload.manifest["images"]:
        if row.get("reason") in {"missing", "invalid", "changed"}:
            ref = refs[ref_key(row["ref"])]
            if ref.kind == "plan":
                ref.target[ref.key] = None
            # Image decor retains its hash/geometry as a repairable placeholder.
    return document
