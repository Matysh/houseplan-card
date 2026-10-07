"""Read-only discovery and reversible archival of a previous installation.

Only the config flow calls this module, in HA's executor. Never use Store here:
loading a Store may migrate/save data before the administrator makes a choice.
"""
from __future__ import annotations

import errno
import json
import logging
import os
import stat
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from .const import (
    ASSETS_DIR,
    DOMAIN,
    FILES_DIR,
    PLANS_DIR,
    STORAGE_CONFIG_KEY,
    STORAGE_KEY,
    STORAGE_MINOR_VERSION,
    STORAGE_VERSION,
    STORAGE_VIRTUAL_LIGHTS_KEY,
)

_LOGGER = logging.getLogger(__name__)
STORE_KEYS = (
    STORAGE_CONFIG_KEY, STORAGE_KEY, STORAGE_VIRTUAL_LIGHTS_KEY, f"{DOMAIN}.trails"
)
DATA_DIRS = (PLANS_DIR, FILES_DIR, ASSETS_DIR)


@dataclass(frozen=True)
class PreviousData:
    """One summary, shared by all menu placeholders."""

    found: bool
    spaces: int | None
    files: int
    modified: float | None
    unsafe: bool = False


@dataclass
class _Inventory:
    sources: list[Path]
    files: list[tuple[Path, os.stat_result]]
    unsafe: bool = False


class ArchiveError(Exception):
    """Archive failed; a partial archive may need manual recovery."""

    def __init__(self, archive_path: Path | None):
        super().__init__(f"Previous data archival failed (archive: {archive_path})")
        self.archive_path = archive_path


def _lstat(path: Path) -> os.stat_result | None:
    try:
        return path.lstat()
    except FileNotFoundError:
        return None


def _inventory(root: Path) -> _Inventory:
    result = _Inventory([], [])
    # Do not even enumerate a linked parent: that would access an external tree.
    for parent in (root / ".storage", root / DOMAIN):
        info = _lstat(parent)
        if info is not None and not stat.S_ISDIR(info.st_mode):
            result.unsafe = True
    if result.unsafe:
        return result

    def visit(path: Path, info: os.stat_result) -> None:
        if stat.S_ISDIR(info.st_mode):
            with os.scandir(path) as children:
                for child in children:
                    visit(Path(child.path), child.stat(follow_symlinks=False))
        else:
            result.files.append((path, info))
            if not stat.S_ISREG(info.st_mode):
                result.unsafe = True

    for key in STORE_KEYS:
        path = root / ".storage" / key
        info = _lstat(path)
        if info is not None:
            result.sources.append(path)
            result.files.append((path, info))
            if not stat.S_ISREG(info.st_mode):
                result.unsafe = True
    for name in DATA_DIRS:
        path = root / name
        info = _lstat(path)
        if info is not None:
            result.sources.append(path)
            visit(path, info)
            if not stat.S_ISDIR(info.st_mode):
                result.unsafe = True
    return result


def _spaces(path: Path) -> int | None:
    if _lstat(path) is None:
        return 0
    try:
        with path.open(encoding="utf-8") as stream:
            envelope = json.load(stream)
        if not isinstance(envelope, dict):
            return None
        version = envelope.get("version")
        minor = envelope.get("minor_version", 1)
        if (type(version) is not int or version != STORAGE_VERSION
                or type(minor) is not int or not 0 <= minor <= STORAGE_MINOR_VERSION):
            return None
        data = envelope.get("data")
        config = data.get("config") if isinstance(data, dict) else None
        spaces = config.get("spaces") if isinstance(config, dict) else None
        if not isinstance(spaces, list) or not all(isinstance(s, dict) for s in spaces):
            return None
        return len(spaces)
    except (OSError, ValueError, UnicodeError):
        return None


def inspect_previous_data(config_dir: str) -> PreviousData:
    """Discover only fixed active paths, without writes or following symlinks."""
    root = Path(config_dir)
    inventory = _inventory(root)
    return PreviousData(
        found=bool(inventory.files) or inventory.unsafe,
        spaces=None if inventory.unsafe else _spaces(root / ".storage" / STORAGE_CONFIG_KEY),
        files=sum(path.parent != root / ".storage" for path, _ in inventory.files),
        modified=max((info.st_mtime for _, info in inventory.files), default=None),
        unsafe=inventory.unsafe,
    )


def _archive_name() -> str:
    return f"{datetime.now(UTC):%Y%m%dT%H%M%S.%fZ}-{uuid4().hex}"


def archive_previous_data(config_dir: str) -> Path | None:
    """Rename the complete old set; rollback handled failures without overwrites.

    This is not a crash-atomic transaction. If rollback itself fails, all bytes
    remain at their original paths or in the logged, retained partial archive.
    """
    root = Path(config_dir)
    created: list[Path] = []
    moved: list[tuple[Path, Path]] = []
    archive: Path | None = None
    try:
        inventory = _inventory(root)
        archive_parent = root / DOMAIN / "archive"
        parent_info = _lstat(archive_parent)
        if inventory.unsafe or (parent_info is not None and not stat.S_ISDIR(parent_info.st_mode)):
            raise OSError(errno.EPERM, "Unsafe previous data paths")
        if not inventory.files:
            return None
        destination_parent = archive_parent
        while _lstat(destination_parent) is None:
            destination_parent = destination_parent.parent
        device = destination_parent.stat().st_dev
        if any(path.lstat().st_dev != device for path in inventory.sources) or any(
            info.st_dev != device for _, info in inventory.files
        ):
            raise OSError(errno.EXDEV, "Archive and previous data must be on one filesystem")

        for directory in (root / DOMAIN, archive_parent):
            if _lstat(directory) is None:
                directory.mkdir()
                created.append(directory)
        # Exclusive creation: never reuse/overwrite an old archive, even on a collision.
        archive = archive_parent / _archive_name()
        archive.mkdir()
        created.append(archive)
        storage = archive / "storage"
        storage.mkdir()
        created.append(storage)
        for source in inventory.sources:
            destination = (storage if source.parent == root / ".storage" else archive) / source.name
            source.rename(destination)
            moved.append((source, destination))
        return archive
    except OSError as error:
        rollback_failed = False
        for source, destination in reversed(moved):
            try:
                if _lstat(source) is not None:
                    raise FileExistsError(source)
                destination.rename(source)
            except OSError:
                rollback_failed = True
                _LOGGER.exception("Cannot restore %s from partial House Plan archive %s", source, archive)
        if not rollback_failed:
            for directory in reversed(created):
                try:
                    directory.rmdir()  # Only our empty directories; never delete user files.
                except OSError:
                    _LOGGER.exception("Cannot remove empty archive directory %s", directory)
        _LOGGER.error("House Plan archival failed; retained archive if any: %s: %s", archive, error)
        raise ArchiveError(archive) from error
