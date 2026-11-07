"""Server-chosen copy-on-write image destinations and idempotent publication (#936)."""
from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import stat
from pathlib import Path
from typing import Any

from .backup_archive import (
    ArchivePayload,
    digest,
    fail,
    image_refs,
    json_bytes,
    ref_key,
    safe_read,
)
from .const import (
    ASSETS_DIR,
    CONTENT_URL,
    FILES_DIR,
    MAX_DECOR_ASSETS_BYTES,
    MAX_DECOR_ASSETS_COUNT,
    MAX_FILES_BYTES,
    MAX_FILES_COUNT,
    MAX_PLANS_BYTES,
    MAX_PLANS_FILES,
    MIN_FREE_BYTES,
    PLANS_DIR,
)
from .decor_assets import physical_asset_usage, validate_asset
from .import_export import content_manifest
from .plans import dir_usage
from .validation import sanitize_marker_id

STAGING_DIR = "houseplan/.backup-staging"
_SESSION = re.compile(r"[a-f0-9]{32}\Z")
_DEST = re.compile(r"houseplan/(?:plans/[A-Za-z0-9_.-]+|files/[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+|assets/[a-f0-9]{64}\.(?:json|png|jpg|svg|webp))\Z")


async def durable_file_job(hass, callback, *args):
    """Never release transaction locks while its filesystem worker still writes."""
    future = hass.async_add_executor_job(callback, *args)
    try:
        return await asyncio.shield(future)
    except asyncio.CancelledError:
        try:
            await asyncio.shield(future)
        except Exception:  # noqa: BLE001 - retain cancellation, after own work ended
            pass
        raise


def stage_folder(root: Path, session: str) -> Path:
    if not isinstance(session, str) or not _SESSION.fullmatch(session):
        raise fail()
    return root / STAGING_DIR / session


def directory_fd(root: Path, relative: Path) -> int:
    """Create/open known subdirectories, refusing every symlink component."""
    fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in relative.parts:
            if part in ("", ".", "..") or "/" in part or "\\" in part:
                raise fail()
            try:
                os.mkdir(part, mode=0o700, dir_fd=fd)
                os.fsync(fd)
            except FileExistsError:
                pass
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


def new_stage(root: Path, session: str) -> Path:
    path = stage_folder(root, session)
    parent = directory_fd(root, Path(STAGING_DIR))
    try:
        os.mkdir(session, mode=0o700, dir_fd=parent)
        os.fsync(parent)
    finally:
        os.close(parent)
    marker = path / "owner.json"
    with marker.open("x", encoding="utf8") as output:
        json.dump({"format": "houseplan-backup-staging/v1", "session": session}, output)
        output.flush()
        os.fsync(output.fileno())
    return path


def cleanup_stage(root: Path, session: str) -> None:
    """Only a positively identified private operation directory is removable."""
    path = stage_folder(root, session)
    try:
        marker = json.loads(safe_read(root, path / "owner.json", 256))
    except FileNotFoundError:
        return
    if marker != {"format": "houseplan-backup-staging/v1", "session": session}:
        raise fail()
    # All ancestors, including the operation folder, were opened no-follow.
    fd = directory_fd(root, path.relative_to(root))
    os.close(fd)
    shutil.rmtree(path)


def plan_files(payload: ArchivePayload, root: Path, session: str, reserve=None) -> tuple[dict[str, Any], list[dict[str, Any]], frozenset[tuple[str, ...]]]:
    """Rewrite validated image refs without publishing any user-visible file."""
    document = json.loads(json.dumps(payload.document))
    refs = {ref_key(ref.record()): ref for ref in image_refs(document["payload"]["config"])}
    staged = stage_folder(root, session)
    files, planned, included = [], {}, set()
    for index, row in enumerate(payload.manifest["images"]):
        if "blob" not in row:
            continue
        ref = refs[ref_key(row["ref"])]
        blob = row["blob"]
        source = payload.blobs[blob]
        meta = payload.manifest["blobs"][blob]
        ext = Path(blob).suffix
        if ref.kind == "decor_asset":
            relative = f"{ASSETS_DIR}/{ref.target[ref.key]}{ext}"
            url = ref.target[ref.key]
        elif ref.kind == "plan":
            relative = f"{PLANS_DIR}/backup.{session}-{index}{ext}"
            url = f"{CONTENT_URL}/plans/_/{Path(relative).name}"
        else:
            owner = sanitize_marker_id(ref.owner_id)
            if not owner:
                raise fail()
            relative = f"{FILES_DIR}/{owner}/backup-{session}-{index}{ext}"
            url = f"{CONTENT_URL}/files/{owner}/{Path(relative).name}"
        if relative not in planned:
            item = {"stage": source.name, "dest": relative, "bytes": meta["bytes"],
                    "sha256": meta["sha256"], "reuse": False, "kind": ref.kind}
            dest = root / relative
            if dest.exists() or dest.is_symlink():
                if ref.kind != "decor_asset" or safe_read(root, dest, meta["bytes"]) != safe_read(staged, source, meta["bytes"]):
                    raise fail("zip_collision") from None
                item["reuse"] = True
            files.append(item)
            planned[relative] = item
            if ref.kind == "decor_asset":
                raw = safe_read(staged, source, meta["bytes"])
                image = validate_asset(raw, blob)
                sidecar = {"asset_id": image.asset_id, "name": row["name"], "mime": image.mime,
                           "ext": image.ext, "width": image.width, "height": image.height,
                           "bytes": len(raw)}
                side_raw = json_bytes(sidecar, 4096)
                if reserve is not None:
                    reserve(len(side_raw))
                side_source = staged / f"meta-{index}"
                with side_source.open("xb") as output:
                    output.write(side_raw)
                    output.flush()
                    os.fsync(output.fileno())
                side_dest = f"{ASSETS_DIR}/{image.asset_id}.json"
                side_item = {"stage": side_source.name, "dest": side_dest, "bytes": len(side_raw),
                             "sha256": digest(side_raw), "reuse": False, "kind": "decor_meta"}
                if (root / side_dest).exists() or (root / side_dest).is_symlink():
                    old = safe_read(root, root / side_dest, 4096)
                    try:
                        old_meta = json.loads(old)
                    except ValueError as err:
                        raise fail("zip_collision") from err
                    if any(old_meta.get(key) != sidecar[key] for key in ("asset_id", "mime", "ext", "width", "height", "bytes")):
                        raise fail("zip_collision")
                    side_item.update({"bytes": len(old), "sha256": digest(old), "reuse": True})
                files.append(side_item)
        ref.target[ref.key] = url
        included.add(ref_key(ref.record()))
    document["content_manifest"] = content_manifest(document["payload"]["config"], root)
    fd = directory_fd(root, staged.relative_to(root))
    try:
        os.fsync(fd)
    finally:
        os.close(fd)
    return document, files, frozenset(included)


def check_files(root: Path, archive: dict[str, Any], *, publish: bool = False) -> None:
    """Validate every staged/reused byte and aggregate quota before linking anything."""
    staged = stage_folder(root, archive["session"])
    groups: dict[str, list[dict[str, Any]]] = {"plan": [], "attachment": [], "decor_asset": []}
    files = archive["files"]
    if not isinstance(files, list) or len(files) > 1600:
        raise fail()
    seen = set()
    for item in files:
        destination = item["dest"]
        if (not isinstance(destination, str) or not _DEST.fullmatch(destination)
                or ".." in destination.split("/") or destination in seen
                or not re.fullmatch(r"(?:blob|meta)-[0-9]+", item["stage"])
                or type(item["bytes"]) is not int or not 0 < item["bytes"] <= 50 * 1024**2
                or type(item["reuse"]) is not bool):
            raise fail()
        seen.add(destination)
        path = root / destination if item["reuse"] else staged / item["stage"]
        raw = safe_read(root if item["reuse"] else staged, path, item["bytes"])
        if len(raw) != item["bytes"] or digest(raw) != item["sha256"]:
            raise fail()
        if not item["reuse"] and item["kind"] in groups:
            groups[item["kind"]].append(item)
    for kind, subdir, max_bytes, max_count in (
        ("plan", PLANS_DIR, MAX_PLANS_BYTES, MAX_PLANS_FILES),
        ("attachment", FILES_DIR, MAX_FILES_BYTES, MAX_FILES_COUNT),
        ("decor_asset", ASSETS_DIR, MAX_DECOR_ASSETS_BYTES, MAX_DECOR_ASSETS_COUNT),
    ):
        if kind == "decor_asset":
            count, used = physical_asset_usage(root / subdir)
        else:
            used, count = dir_usage(root / subdir)
        # Recovery may have already linked a subset; it must not double-charge them.
        incoming = [item for item in groups[kind] if not (root / item["dest"]).exists()]
        if used + sum(item["bytes"] for item in incoming) > max_bytes or count + len(incoming) > max_count:
            raise fail("zip_limit")
    if shutil.disk_usage(root).free < MIN_FREE_BYTES:
        raise fail("zip_limit")
    if not publish:
        return
    for item in files:
        if item["reuse"]:
            continue
        dest = root / item["dest"]
        parent = directory_fd(root, dest.parent.relative_to(root))
        source_fd = directory_fd(root, staged.relative_to(root))
        try:
            try:
                os.link(item["stage"], dest.name, src_dir_fd=source_fd,
                        dst_dir_fd=parent, follow_symlinks=False)
            except FileExistsError:
                # Idempotent recovery requires the SAME inode, not an equal filename/hash.
                source_stat = os.stat(item["stage"], dir_fd=source_fd, follow_symlinks=False)
                dest_stat = os.stat(dest.name, dir_fd=parent, follow_symlinks=False)
                if not stat.S_ISREG(dest_stat.st_mode) or (source_stat.st_dev, source_stat.st_ino) != (dest_stat.st_dev, dest_stat.st_ino):
                    raise fail("zip_collision") from None
            os.fsync(parent)
            if digest(safe_read(root, dest, item["bytes"])) != item["sha256"]:
                raise fail()
        finally:
            os.close(source_fd)
            os.close(parent)


def rollback_files(root: Path, archive: dict[str, Any]) -> None:
    """Unlink ONLY proven operation-owned hardlinks, never an inferred orphan."""
    staged = stage_folder(root, archive["session"])
    for item in archive["files"]:
        if item["reuse"]:
            continue
        dest = root / item["dest"]
        if not _DEST.fullmatch(item["dest"]) or not re.fullmatch(r"(?:blob|meta)-[0-9]+", item["stage"]):
            raise fail()
        try:
            source_stat = (staged / item["stage"]).lstat()
            target_stat = dest.lstat()
        except FileNotFoundError:
            continue
        if (stat.S_ISREG(target_stat.st_mode)
                and (source_stat.st_dev, source_stat.st_ino) == (target_stat.st_dev, target_stat.st_ino)):
            parent = directory_fd(root, dest.parent.relative_to(root))
            try:
                os.unlink(dest.name, dir_fd=parent)
                os.fsync(parent)
            finally:
                os.close(parent)
