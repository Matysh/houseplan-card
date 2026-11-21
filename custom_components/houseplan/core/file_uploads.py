"""Private filesystem staging for the shared upload commands.

Only complete files become visible. Staging never publishes a catalog row or
reserves an empty public name; the caller holds its content transaction until
publication and cleanup have completed, including on task cancellation.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .constants import (
    MAX_DECOR_ASSETS_BYTES,
    MAX_DECOR_ASSETS_COUNT,
    MAX_PLANS_BYTES,
    MAX_PLANS_FILES,
    MIN_FREE_BYTES,
)
from .decor_assets import (
    DecorAssetError,
    ValidatedAsset,
    asset_meta_path,
    physical_asset_usage,
    read_asset,
)
from .plans import check_quota
from .validation import sanitize_filename


@dataclass(slots=True)
class FileStage:
    destination: Path
    temporary: Path | None
    result: dict
    metadata: Path | None = None
    metadata_temporary: Path | None = None

    def release(self):
        for path in (self.temporary, self.metadata_temporary):
            if path is not None:
                path.unlink(missing_ok=True)


def _temporary(root: Path, raw: bytes) -> Path:
    fd, name = tempfile.mkstemp(prefix=".command-upload-", dir=str(root))
    path = Path(name)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        return path
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def stage_plan(root: Path, space_id: str, extension: str, raw: bytes) -> FileStage:
    root.mkdir(parents=True, exist_ok=True)
    check_quota(root, len(raw), MAX_PLANS_BYTES, MAX_PLANS_FILES)
    # No overwrite at publication, even in the extremely unlikely token collision.
    name = f"{space_id}.{secrets.token_hex(4)}.{extension}"
    return FileStage(root / name, _temporary(root, raw), {"name": name})


def stage_asset(root: Path, validated: ValidatedAsset, filename: str) -> FileStage:
    root.mkdir(parents=True, exist_ok=True)
    aid = validated.asset_id
    existing = read_asset(root, aid)
    if existing is not None:
        blob = root / f"{aid}{existing['ext']}"
        if hashlib.sha256(blob.read_bytes()).hexdigest() != aid:
            raise DecorAssetError("invalid_image", "The stored image failed its integrity check")
        return FileStage(blob, None, {"asset": existing, "reused": True})
    blob, meta = root / f"{aid}{validated.ext}", asset_meta_path(root, aid)
    row = {
        "asset_id": aid, "name": sanitize_filename(Path(filename).name) or "image",
        "mime": validated.mime, "ext": validated.ext, "width": validated.width,
        "height": validated.height, "bytes": len(validated.data),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # A previous hard stop can leave a complete hash-verified blob without its
    # sidecar. Repair it without claiming new quota or ever deleting that blob.
    exists = blob.exists()
    if exists:
        if not blob.is_file() or hashlib.sha256(blob.read_bytes()).hexdigest() != aid:
            raise DecorAssetError("invalid_image", "The stored image failed its integrity check")
    else:
        count, used = physical_asset_usage(root)
        if count >= MAX_DECOR_ASSETS_COUNT or used + len(validated.data) > MAX_DECOR_ASSETS_BYTES:
            raise DecorAssetError("capacity_exceeded", "The decor image store is full")
        try:
            if shutil.disk_usage(root).free - len(validated.data) < MIN_FREE_BYTES:
                raise DecorAssetError("capacity_exceeded", "Not enough free disk space")
        except OSError:
            pass
    stage = FileStage(blob, None, {"asset": row, "reused": False}, meta)
    try:
        if not exists:
            stage.temporary = _temporary(root, validated.data)
        stage.metadata_temporary = _temporary(root, json.dumps(row, ensure_ascii=False,
                                                              separators=(",", ":")).encode("utf-8"))
        return stage
    except BaseException:
        stage.release()
        raise


def publish(stage: FileStage) -> dict:
    promoted = False
    try:
        if stage.temporary is not None:
            # A complete, fsynced inode is made public atomically. Never replace
            # a concurrent/preexisting file that this transaction does not own.
            os.link(stage.temporary, stage.destination)
            promoted = True
        if stage.metadata_temporary is not None:
            os.replace(stage.metadata_temporary, stage.metadata)
        return stage.result
    except BaseException:
        if promoted:
            stage.destination.unlink(missing_ok=True)
        raise
