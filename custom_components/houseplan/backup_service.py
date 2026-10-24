"""Entry-owned, bounded, cancellable archive sessions; never a public blob store."""
from __future__ import annotations

import asyncio
import copy
import hashlib
import os
import re
import secrets
import shutil
import stat
import threading
import time
from dataclasses import dataclass, field
from datetime import timedelta
from functools import partial
from pathlib import Path
from typing import Any, Callable
from uuid import uuid4

from homeassistant.helpers.event import async_track_time_interval

from .backup_archive import (
    CHUNK,
    MAX_ARCHIVE_BYTES,
    build_archive,
    digest,
    expanded_size,
    fail,
    json_bytes,
    read_archive,
    strip_transport_credentials,
)
from .backup_files import (
    STAGING_DIR,
    cleanup_stage,
    directory_fd,
    new_stage,
    plan_files,
    stage_folder,
)
from .const import (
    IMPORT_PREVIEW_TTL_S,
    MAX_EXPORT_BYTES,
    MIN_FREE_BYTES,
    OPTIMIZE_PENDING,
)
from .import_export import (
    ImportFailure,
    _candidate_digest,
    content_manifest,
    create_export,
    create_preview,
)
from .registry_snapshot import import_registry_snapshot
from .store import async_resolve_pending_pair
from .zigbee_topology import _enabled


@dataclass
class ArchiveSession:
    owner: str
    kind: str
    operation_id: str = ""
    session: str = field(default_factory=lambda: uuid4().hex)
    token: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    expires: float = field(default_factory=lambda: time.time() + IMPORT_PREVIEW_TTL_S)
    cancelled: threading.Event = field(default_factory=threading.Event)
    budget: int = 0
    filename: str = ""
    manifest: dict[str, Any] = field(default_factory=dict)
    topics: dict[str, Any] = field(default_factory=dict)
    files: list[dict[str, Any]] = field(default_factory=list)
    preview_token: str = ""
    busy: bool = True
    archive_hash: str = ""
    recovery: dict[str, Any] | None = None
    workers: set[asyncio.Future] = field(default_factory=set)


class BackupService:
    def __init__(self, hass, runtime) -> None:
        self.hass, self.runtime = hass, runtime
        self.root = Path(runtime.backup_root)
        self.sessions: dict[str, ArchiveSession] = {}
        self.closed = False
        self._budget_lock = threading.Lock()
        self._abandoned_bytes = 0
        self._workers: set[asyncio.Future] = set()
        self._cancelled_imports: dict[tuple[str, str], float] = {}
        self._unsub = async_track_time_interval(hass, self.sweep, timedelta(seconds=60))

    def reserve_bytes(self, session: ArchiveSession, delta: int) -> None:
        if self.closed or session.cancelled.is_set():
            raise fail("zip_cancelled")
        with self._budget_lock:
            if self._abandoned_bytes + sum(s.budget for s in self.sessions.values()) + delta > 4 * 1024**3:
                raise fail("zip_limit")
            session.budget += delta
        if delta and shutil.disk_usage(self.root).free - delta < MIN_FREE_BYTES:
            raise fail("zip_limit")

    async def run(self, session: ArchiveSession, callback: Callable):
        self.reserve_bytes(session, 0)
        future = self.hass.async_add_executor_job(callback)
        self._workers.add(future)
        session.workers.add(future)
        try:
            return await asyncio.shield(future)
        except asyncio.CancelledError:
            session.cancelled.set()
            try:
                await asyncio.shield(future)
            except Exception:  # noqa: BLE001 - await own worker before deleting its staging
                pass
            raise
        finally:
            self._workers.discard(future)
            session.workers.discard(future)

    @staticmethod
    def validate_operation(operation_id: str) -> None:
        if not isinstance(operation_id, str) or not re.fullmatch(r"[0-9a-f]{32}", operation_id):
            raise fail()

    async def cancel_import(self, owner: str, operation_id: str) -> None:
        """Cancel exactly this user's request, even before its HTTP upload arrives."""
        self.validate_operation(operation_id)
        now = time.time()
        self._cancelled_imports = {key: expiry for key, expiry in self._cancelled_imports.items()
                                   if expiry > now}
        key = (owner, operation_id)
        if key not in self._cancelled_imports:
            if (len(self._cancelled_imports) >= 256
                    or sum(key[0] == owner for key in self._cancelled_imports) >= 64):
                raise fail("zip_limit")
            self._cancelled_imports[key] = now + IMPORT_PREVIEW_TTL_S
        session = next((item for item in self.sessions.values()
                        if item.owner == owner and item.kind == "import" and item.operation_id == operation_id), None)
        if session is not None:
            await self.release(session)

    async def reserve(self, owner: str, kind: str, operation_id: str = "") -> ArchiveSession:
        if operation_id:
            self.validate_operation(operation_id)
        await self.sweep()
        if operation_id and (owner, operation_id) in self._cancelled_imports:
            raise fail("zip_cancelled")
        if self.closed or len(self.sessions) >= 2 or any(s.owner == owner for s in self.sessions.values()):
            raise fail("zip_busy")
        session = ArchiveSession(owner, kind, operation_id=operation_id)
        with self._budget_lock:
            self.sessions[session.token] = session
        try:
            await self.run(session, partial(new_stage, self.root, session.session))
        except BaseException:
            with self._budget_lock:
                self.sessions.pop(session.token, None)
            raise
        return session

    def get(self, token: str, owner: str, kind: str | None = None) -> ArchiveSession:
        session = self.sessions.get(token)
        if (session is None or session.expires <= time.time() or self.closed
                or session.cancelled.is_set()):
            raise ImportFailure("preview_expired")
        if session.owner != owner:
            raise ImportFailure("preview_owner_mismatch")
        if kind is not None and session.kind != kind:
            raise fail()
        return session

    def candidate_session(self, candidate: dict[str, Any], owner: str) -> ArchiveSession:
        archive = candidate.get("archive")
        if not isinstance(archive, dict):
            raise fail()
        found = next((s for s in self.sessions.values() if s.session == archive["session"]), None)
        if found is None:
            raise ImportFailure("preview_expired")
        session = self.get(found.token, owner, "import")
        if digest(json_bytes(session.manifest, 2 * 1024**2)) != archive["manifest_digest"]:
            raise fail()
        if digest(json_bytes(session.files, 2 * 1024**2)) != archive["files_digest"]:
            raise fail()
        return session

    def summary(self, session: ArchiveSession, config: dict | None = None) -> dict[str, Any]:
        return {"complete": session.manifest["complete"],
                "images": sum("blob" in row for row in session.manifest["images"]),
                "missing": [{"name": row["name"], "reason": row["reason"],
                             "kind": row["ref"]["kind"], "owner_id": row["ref"]["owner_id"]}
                            for row in session.manifest["images"] if "reason" in row],
                "snapshot": [{"obtained_at": item["obtained_at"]} for item in session.topics.values()],
                "snapshot_ignored_off": bool(config is not None and not _enabled(config) and session.topics),
                **({"recovery": copy.deepcopy(session.recovery)} if session.recovery else {})}

    def export_stream(self, session: ArchiveSession):
        """Verify the exact prepared bytes and keep the verified inode open."""
        parent = directory_fd(self.root, stage_folder(self.root, session.session).relative_to(self.root))
        try:
            fd = os.open("backup.zip", os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
        finally:
            os.close(parent)
        source = os.fdopen(fd, "rb")
        try:
            before = os.fstat(source.fileno())
            if not stat.S_ISREG(before.st_mode) or before.st_size > MAX_ARCHIVE_BYTES:
                raise fail("zip_limit")
            checksum = hashlib.sha256()
            while block := source.read(CHUNK):
                self.reserve_bytes(session, 0)
                checksum.update(block)
            after = os.fstat(source.fileno())
            if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
                raise fail("zip_changed")
            actual = checksum.hexdigest()
            if session.archive_hash and session.archive_hash != actual:
                raise fail("zip_changed")
            session.archive_hash = actual
            source.seek(0)
            return source
        except BaseException:
            source.close()
            raise

    async def export(self, owner: str, card_version: str, build: dict | None):
        session = await self.reserve(owner, "export")
        try:
            async with self.runtime.write_lock:
                pair = await async_resolve_pending_pair(self.runtime)
                cd, ld = copy.deepcopy(pair.config_data), copy.deepcopy(pair.layout_data)
                snapshot = await self.runtime.zigbee_coordinator.async_backup_snapshot()
            document, filename = await self.run(session, partial(
                create_export, self.runtime, cd, ld, kind="full", space_id=None,
                card_version=card_version, config_root=self.root, build=build,
            ))
            session.recovery = copy.deepcopy(document["transfer"].get("recovery"))
            def prepare():
                strip_transport_credentials(document)
                document["content_manifest"] = content_manifest(document["payload"]["config"], self.root)
                return build_archive(stage_folder(self.root, session.session) / "backup.zip",
                                     document, self.root, snapshot["topics"],
                                     partial(self.reserve_bytes, session))
            session.manifest = await self.run(session, prepare)
            source = await self.run(session, partial(self.export_stream, session))
            source.close()
            session.topics = snapshot["topics"]
            session.filename = filename.removesuffix(".json") + (
                ".zip" if session.manifest["complete"] else "-incomplete.zip")
            session.expires = time.time() + IMPORT_PREVIEW_TTL_S
            session.busy = False
            return {"archive": True, "token": session.token, "filename": session.filename,
                    **self.summary(session)}
        except BaseException:
            await self.release(session)
            raise

    def append_upload(self, session: ArchiveSession, raw: bytes) -> None:
        self.reserve_bytes(session, len(raw))
        parent = directory_fd(self.root, stage_folder(self.root, session.session).relative_to(self.root))
        try:
            fd = os.open("backup.zip", os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW | os.O_NONBLOCK,
                         0o600, dir_fd=parent)
        finally:
            os.close(parent)
        with os.fdopen(fd, "ab") as output:
            if not stat.S_ISREG(os.fstat(output.fileno()).st_mode):
                raise fail()
            output.write(raw)
            output.flush()
            os.fsync(output.fileno())

    async def upload(self, owner: str, content, declared: int | None, *, operation_id: str = ""):
        if declared is not None and declared > MAX_ARCHIVE_BYTES:
            raise fail("zip_limit")
        session = await self.reserve(owner, "import", operation_id)
        path = stage_folder(self.root, session.session) / "backup.zip"
        size = 0
        try:
            buffer = bytearray()
            async for block in content.iter_chunked(CHUNK):
                self.reserve_bytes(session, 0)
                size += len(block)
                if size > MAX_ARCHIVE_BYTES:
                    raise fail("zip_limit")
                buffer.extend(block)
                if len(buffer) >= 1024**2:
                    await self.run(session, partial(self.append_upload, session, bytes(buffer)))
                    buffer.clear()
            if buffer:
                await self.run(session, partial(self.append_upload, session, bytes(buffer)))
            if size == 0:
                raise fail()
            unpacked = await self.run(session, partial(expanded_size, path))
            await self.run(session, partial(self.reserve_bytes, session, unpacked))
            payload = await self.run(session, partial(read_archive, path,
                stage_folder(self.root, session.session), partial(self.reserve_bytes, session)))
            session.manifest, session.topics = payload.manifest, payload.topics
            document, session.files, included = await self.run(session, partial(
                plan_files, payload, self.root, session.session, partial(self.reserve_bytes, session)))
            async with self.runtime.write_lock:
                pair = await async_resolve_pending_pair(self.runtime)
                cd, ld = copy.deepcopy(pair.config_data), copy.deepcopy(pair.layout_data)
                generation = self.runtime.zigbee_coordinator.cache_generation
            try:
                registry = import_registry_snapshot(self.hass)
            except Exception:  # noqa: BLE001 - registry summary cannot invalidate a good archive
                registry = None
            response = await self.run(session, partial(create_preview, self.runtime,
                json_bytes(document, MAX_EXPORT_BYTES), owner_id=owner, duplicate_policy="skip",
                current_config_data=cd, current_layout_data=ld, config_root=self.root,
                registry_snapshot=registry, portable_content=included,
                # #1033: the archive's own parse already repaired the openings;
                # its report is this server's, not the file's.
                opening_repairs=payload.document["transfer"].get("opening_repairs")))
            session.preview_token = response["token"]
            self.reserve_bytes(session, 0)  # A cancelled worker's late result is not a new preview.
            candidate = self.runtime.import_previews[session.preview_token]
            candidate["archive"] = {"session": session.session, "cache_generation": generation,
                                    "manifest_digest": digest(json_bytes(session.manifest, 2 * 1024**2)),
                                    "files_digest": digest(json_bytes(session.files, 2 * 1024**2))}
            candidate["confirmation_required"] = candidate["confirmation_required"] or not session.manifest["complete"]
            candidate["digest"] = _candidate_digest(candidate)
            response["preview"]["confirmation_required"] = candidate["confirmation_required"]
            response["preview"]["archive"] = self.summary(session, candidate["target_config"])
            session.expires = time.time() + IMPORT_PREVIEW_TTL_S
            session.busy = False
            return response
        except BaseException:
            await self.release(session)
            raise

    async def release(self, session: ArchiveSession) -> None:
        async with self.runtime.write_lock:
            ld = await self.runtime.store.async_load() or {}
            pending = ld.get(OPTIMIZE_PENDING)
            archive = pending.get("archive") if isinstance(pending, dict) else None
            if isinstance(archive, dict) and archive.get("session") == session.session:
                return  # Durable recovery, not TTL, owns these bytes now.
            session.cancelled.set()
            if session.workers:
                await asyncio.gather(*session.workers, return_exceptions=True)
            with self._budget_lock:
                self.sessions.pop(session.token, None)
            if session.preview_token:
                self.runtime.import_previews.pop(session.preview_token, None)
            await self.hass.async_add_executor_job(cleanup_stage, self.root, session.session)

    async def sweep(self, _now=None) -> None:
        self._cancelled_imports = {key: expiry for key, expiry in self._cancelled_imports.items()
                                   if expiry > time.time()}
        for session in list(self.sessions.values()):
            if not session.busy and session.expires <= time.time():
                await self.release(session)
        # Previous processes have no in-memory tokens. Keep pending recovery
        # and live sessions; remove only expired, positively marked private dirs.
        ld = await self.runtime.store.async_load() or {}
        pending = ld.get(OPTIMIZE_PENDING)
        archive = pending.get("archive") if isinstance(pending, dict) else None
        keep = {s.session for s in self.sessions.values()}
        if isinstance(archive, dict) and archive.get("session"):
            keep.add(archive["session"])
        def abandoned():
            base = self.root / STAGING_DIR
            if not base.exists() or base.is_symlink():
                return 0
            total = 0
            # The event loop may reserve/release a token while this executor
            # scans disk. Snapshot under the same lock used for byte accounting.
            with self._budget_lock:
                live = {s.session for s in self.sessions.values()}
            for child in base.iterdir():
                if child.name in live or child.is_symlink():
                    continue
                try:
                    if child.name not in keep and child.stat().st_mtime < time.time() - IMPORT_PREVIEW_TTL_S:
                        cleanup_stage(self.root, child.name)
                except (OSError, ImportFailure, ValueError):
                    pass
                if child.is_dir():
                    for directory, _, names in os.walk(child, followlinks=False):
                        for name in names:
                            path = Path(directory) / name
                            if not path.is_symlink():
                                try:
                                    total += path.stat().st_size
                                except OSError:
                                    pass
            return total
        total = await self.hass.async_add_executor_job(abandoned)
        with self._budget_lock:
            self._abandoned_bytes = total

    async def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        self._unsub()
        for session in self.sessions.values():
            session.cancelled.set()
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)
        for session in list(self.sessions.values()):
            await self.release(session)


def get_backup_service(hass, runtime) -> BackupService:
    if runtime.backup_service is None:
        runtime.backup_service = BackupService(hass, runtime)
    return runtime.backup_service
