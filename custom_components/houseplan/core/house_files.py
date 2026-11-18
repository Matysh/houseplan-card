"""Filesystem publication for house transfer; policy and plan merge live elsewhere.

The private ZIP is retained for recovery, not extracted at preview. Publication
materializes at most one image at a time. Private hardlinks prove ownership until
the paired stores are durable, so rollback can never delete a reused/foreign file.
Callers serialize this module with the content store's existing upload lock.
"""
from __future__ import annotations

import copy
import json
import os
import re
import shutil
import stat
import zipfile
from pathlib import Path

from .backup_archive import digest, image_refs, json_bytes, ref_key, safe_read
from .backup_files import check_quotas, directory_fd, publish_file, rollback_files
from .constants import (
    ASSETS_DIR,
    CONTENT_URL,
    MAX_DECOR_ASSET_BYTES,
    MAX_PLANS_FILES,
    MIN_FREE_BYTES,
    PLANS_DIR,
)
from .decor_assets import validate_asset
from .house_archive import (
    MAX_ARCHIVE_BYTES,
    MAX_ENTRIES,
    Reader,
    archive_digest,
    check_prefix,
    fail,
    missing_projection,
)
from .house_prefix import PREFIX_BYTES
from .input_policy import checkpoint

STAGING_DIR = "houseplan/.house-staging"
_SESSION = re.compile(r"[a-f0-9]{32}\Z")
_HASH = re.compile(r"[a-f0-9]{64}\Z")
_PLAN = re.compile(r"houseplan/plans/[A-Za-z0-9_.-]+\.(?:png|jpg|svg|webp)\Z")
_ASSET = re.compile(r"houseplan/assets/[a-f0-9]{64}\.(?:png|jpg|svg|webp)\Z")
_META = re.compile(r"houseplan/assets/[a-f0-9]{64}\.json\Z")
_BLOB = re.compile(r"images/[a-f0-9]{64}\.(?:png|jpg|svg|webp)\Z")


def stage_folder(root: Path, session: str) -> Path:
    if not isinstance(session, str) or not _SESSION.fullmatch(session):
        raise fail()
    return root / STAGING_DIR / session


def _marker(session):
    return {"format": "houseplan-house-staging/v1", "session": session}


def _write(folder: Path, name: str, raw: bytes):
    fd = os.open(folder, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        output = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                         0o600, dir_fd=fd)
        with os.fdopen(output, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.fsync(fd)
    finally:
        os.close(fd)


def new_stage(root: Path, session: str) -> Path:
    path = stage_folder(root, session)
    parent = directory_fd(root, Path(STAGING_DIR))
    try:
        os.mkdir(session, mode=0o700, dir_fd=parent)
        os.fsync(parent)
    finally:
        os.close(parent)
    _write(path, "owner.json", json_bytes(_marker(session), 256))
    return path


def identified_stage(root: Path, session: str) -> Path:
    path = stage_folder(root, session)
    if json.loads(safe_read(root, path / "owner.json", 256)) != _marker(session):
        raise fail()
    return path


def cleanup_stage(root: Path, session: str):
    """The caller must first prove no durable house intent pins this session."""
    path = stage_folder(root, session)
    if not path.exists() and not path.is_symlink():
        return
    identified_stage(root, session)
    # Never recurse through an unexpected child or touch full-backup staging.
    for child in path.iterdir():
        if (not stat.S_ISREG(child.lstat().st_mode)
                or not re.fullmatch(r"owner\.json|archive\.zip|(?:blob|meta)-[0-9]+", child.name)):
            raise fail()
    shutil.rmtree(path)


def _identity(path):
    value = path.lstat()
    if not stat.S_ISREG(value.st_mode):
        raise fail("zip_collision")
    return [value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns]


def _existing(root, relative, raw):
    path = root / relative
    try:
        before = _identity(path)
    except FileNotFoundError:
        return None
    if safe_read(root, path, len(raw)) != raw or _identity(path) != before:
        raise fail("zip_collision")
    return before


def _item(root, relative, kind, raw, index, **source):
    identity = _existing(root, relative, raw)
    return {"dest": relative, "kind": kind, "stage": f"{'meta' if kind == 'decor_meta' else 'blob'}-{index}",
            "bytes": len(raw), "sha256": digest(raw), "reuse": identity is not None,
            "identity": identity, **source}


def _quotas(root, files):
    check_quotas(root, files, kinds={"plan", "decor_asset"})
    incoming = sum(item["bytes"] for item in files
                   if not item["reuse"] and not (root / item["dest"]).exists())
    if shutil.disk_usage(root).free < MIN_FREE_BYTES + incoming:
        raise fail("zip_limit")


def _check_archive(folder, expected):
    path = folder / "archive.zip"
    if not _HASH.fullmatch(expected) or not stat.S_ISREG(path.lstat().st_mode):
        raise fail()
    with path.open("rb") as source:
        check_prefix(source.read(PREFIX_BYTES))
    # Bound central-directory allocation before hashing or constructing ZipInfo.
    from .backup_archive import _check_directory
    _check_directory(path, entry_limit=MAX_ENTRIES, archive_limit=MAX_ARCHIVE_BYTES)
    if archive_digest(path) != expected:
        raise fail("zip_changed")
    return path


def prepare_files(root: Path, session: str, payload, *, protected_plans=frozenset()):
    """Return a rewritten document and data-only recovery descriptor; publish none."""
    folder = identified_stage(root, session)
    archive_path = _check_archive(folder, payload.archive_sha256)
    document = missing_projection(payload)
    refs = {ref_key(ref.record()): ref for ref in image_refs(document["payload"]["config"])}
    files, destinations, plans = [], {}, {}
    plan_root = root / PLANS_DIR
    if plan_root.exists():
        # The catalog is already physically capped; no recursive/attachment scan.
        fd = directory_fd(root, Path(PLANS_DIR))
        os.close(fd)
        for index, path in enumerate(plan_root.iterdir()):
            if index >= MAX_PLANS_FILES:
                raise fail("zip_limit")
            if _PLAN.fullmatch(f"{PLANS_DIR}/{path.name}") and stat.S_ISREG(path.lstat().st_mode):
                plans.setdefault((path.suffix, path.stat().st_size), []).append(path.name)
    with zipfile.ZipFile(archive_path) as archive:
        reader = Reader(archive)
        for row in payload.manifest["images"]:
            if "blob" not in row:
                continue
            ref = refs[ref_key(row["ref"])]
            blob, kind = row["blob"], ref.kind
            key = (blob, kind)
            if key not in destinations:
                metadata = payload.manifest["blobs"][blob]
                raw = reader.checked(blob, metadata, ref.limit)
                extension, sha = Path(blob).suffix, metadata["sha256"]
                if kind == "plan":
                    name = f"house.{sha}{extension}"
                    for existing in plans.get((extension, len(raw)), []):
                        checkpoint()
                        if safe_read(root, root / PLANS_DIR / existing, len(raw)) == raw:
                            name = existing
                            break
                    else:
                        # Do not give an old target orphan a new meaning accidentally.
                        attempt = 0
                        while (name in protected_plans or (root / PLANS_DIR / name).exists()
                               or (root / PLANS_DIR / name).is_symlink()):
                            attempt += 1
                            name = f"house.{sha}.{session}-{attempt}{extension}"
                    relative = f"{PLANS_DIR}/{name}"
                    url = f"{CONTENT_URL}/plans/_/{name}"
                else:
                    relative, url = f"{ASSETS_DIR}/{sha}{extension}", sha
                item = _item(root, relative, kind, raw, len(files), source=blob)
                files.append(item)
                if kind == "decor_asset":
                    image = validate_asset(raw, blob)
                    sidecar = {"asset_id": sha, "name": row["name"], "mime": image.mime,
                               "ext": image.ext, "width": image.width, "height": image.height,
                               "bytes": len(raw)}
                    side_dest = f"{ASSETS_DIR}/{sha}.json"
                    side_raw = json_bytes(sidecar, 4096)
                    if (root / side_dest).exists() or (root / side_dest).is_symlink():
                        old_raw = safe_read(root, root / side_dest, 4096)
                        old = json.loads(old_raw)
                        if not isinstance(old, dict) or any(old.get(k) != sidecar[k] for k in sidecar if k != "name"):
                            raise fail("zip_collision")
                        side_raw = old_raw
                    files.append(_item(root, side_dest, "decor_meta", side_raw, len(files), metadata=side_raw.decode("utf8")))
                destinations[key] = url
            ref.target[ref.key] = destinations[key]
    _quotas(root, files)
    return document, {"version": 1, "session": session, "archive_sha256": payload.archive_sha256,
                      "files": files}


def _validated_descriptor(descriptor):
    if (not isinstance(descriptor, dict) or set(descriptor) != {"version", "session", "archive_sha256", "files"}
            or type(descriptor["version"]) is not int or descriptor["version"] != 1
            or not isinstance(descriptor["archive_sha256"], str) or not _HASH.fullmatch(descriptor["archive_sha256"])
            or not isinstance(descriptor["files"], list) or len(descriptor["files"]) > 2 * MAX_ENTRIES):
        raise fail()
    seen = set()
    for item in descriptor["files"]:
        if not isinstance(item, dict):
            raise fail()
        meta = item.get("kind") == "decor_meta"
        if (set(item) != {"dest", "kind", "stage", "bytes", "sha256", "reuse", "identity", "metadata" if meta else "source"}
                or not isinstance(item["dest"], str) or item["dest"] in seen
                or item["kind"] not in {"plan", "decor_asset", "decor_meta"}
                or not {"plan": _PLAN, "decor_asset": _ASSET, "decor_meta": _META}[item["kind"]].fullmatch(item["dest"])
                or not isinstance(item["stage"], str) or not re.fullmatch(r"(?:blob|meta)-[0-9]+", item["stage"])
                or type(item["bytes"]) is not int or not 0 < item["bytes"] <= (4096 if meta else 8 * 1024**2)
                or type(item["reuse"]) is not bool or not isinstance(item["sha256"], str) or not _HASH.fullmatch(item["sha256"])
                or (item["reuse"] and (not isinstance(item["identity"], list) or len(item["identity"]) != 4
                                      or any(type(v) is not int for v in item["identity"])))
                or (not item["reuse"] and item["identity"] is not None)
                or (not meta and (not isinstance(item["source"], str) or not _BLOB.fullmatch(item["source"])))):
            raise fail()
        if meta and (not isinstance(item["metadata"], str)
                     or len(item["metadata"].encode()) != item["bytes"]
                     or digest(item["metadata"].encode()) != item["sha256"]):
            raise fail()
        if not meta and (Path(item["source"]).stem != item["sha256"]
                         or Path(item["source"]).suffix != Path(item["dest"]).suffix
                         or item["kind"] == "decor_asset" and (
                             item["bytes"] > MAX_DECOR_ASSET_BYTES or Path(item["dest"]).stem != item["sha256"])):
            raise fail()
        seen.add(item["dest"])
    return descriptor


def publish_files(root: Path, descriptor):
    """Durable intent must already exist. Safe to resume after any linked subset."""
    descriptor = _validated_descriptor(descriptor)
    folder = identified_stage(root, descriptor["session"])
    archive_path = _check_archive(folder, descriptor["archive_sha256"])
    files = descriptor["files"]
    # Refuse changed reuse and collisions BEFORE publishing even the first file.
    for item in files:
        dest, staged = root / item["dest"], folder / item["stage"]
        if item["reuse"]:
            if (_identity(dest) != item["identity"]
                    or digest(safe_read(root, dest, item["bytes"])) != item["sha256"]):
                raise fail("zip_changed")
        elif dest.exists() or dest.is_symlink():
            try:
                dest_identity, source_identity = _identity(dest), _identity(staged)
            except FileNotFoundError as error:
                raise fail("zip_collision") from error
            if source_identity[:2] != dest_identity[:2]:
                raise fail("zip_collision")
    _quotas(root, files)
    with zipfile.ZipFile(archive_path) as archive:
        reader = Reader(archive)
        for item in files:
            checkpoint()
            if item["reuse"]:
                continue
            staged = folder / item["stage"]
            if not staged.exists() and not staged.is_symlink():
                raw = (item["metadata"].encode() if item["kind"] == "decor_meta"
                       else reader.checked(item["source"], item, item["bytes"]))
                _write(folder, item["stage"], raw)
            raw = safe_read(folder, staged, item["bytes"])
            if len(raw) != item["bytes"] or digest(raw) != item["sha256"]:
                raise fail("zip_changed")
            publish_file(root, folder, item)


def rollback_publication(root: Path, descriptor):
    descriptor = _validated_descriptor(copy.deepcopy(descriptor))
    try:
        folder = identified_stage(root, descriptor["session"])
    except FileNotFoundError:
        folder = stage_folder(root, descriptor["session"])
        if folder.exists() or folder.is_symlink():
            raise
        # Lost private inode proofs cannot justify removing public bytes. The
        # old pair can still be restored; retain possible orphans conservatively.
        return
    rollback_files(root, descriptor, private_stage=folder)
