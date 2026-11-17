"""Trusted-root filesystem implementation of logical content ports.

The command layer, not this adapter, decides permissions and live references.
HA supplies its existing upload lock and integrity cache. A database host
implements the same transactional operations without constructing this class.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from . import file_uploads
from .asset_integrity import AssetIntegrityVerifier
from .command_ports import CommandError, CpuExecutor
from .constants import ASSETS_DIR, FILES_DIR, PLANS_DIR
from .content_index import ContentRef, FilesystemContentIndex
from .decor_assets import (
    ASSET_EXTENSIONS,
    ASSET_ID_RE,
    asset_meta_path,
    read_asset,
    read_catalog,
)
from .plans import is_plan_file, retire_attachments, retire_plans
from .validation import sanitize_filename

_LOGGER = logging.getLogger(__name__)


class FilesystemContent:
    def __init__(self, root: Path, cpu: CpuExecutor, *, lock=None, verifier=None):
        self.root, self.cpu = root, cpu
        self.lock = lock if lock is not None else asyncio.Lock()
        self.verifier = verifier if verifier is not None else AssetIntegrityVerifier()

    @asynccontextmanager
    async def transaction(self):
        async with self.lock:
            yield self

    async def _settle(self, function, *args, discard=None):
        # CPU jobs cannot be cancelled by cancelling their awaiting coroutine.
        # Keep the lock until the actual worker has settled, including repeated
        # cancellations; otherwise a second writer can race a late promotion.
        job = asyncio.create_task(self.cpu.run(function, *args))
        cancelled = False
        while True:
            try:
                result = await asyncio.shield(job)
                break
            except asyncio.CancelledError:
                cancelled = True
                if job.cancelled():
                    raise
            except BaseException:
                if cancelled:
                    raise asyncio.CancelledError from None
                raise
        if cancelled:
            if discard is not None:
                await self._settle(discard, result)
            raise asyncio.CancelledError
        return result

    @asynccontextmanager
    async def _stage(self, prepare, *args):
        stage = await self._settle(prepare, *args, discard=file_uploads.FileStage.release)
        try:
            yield stage
        finally:
            try:
                await self._settle(file_uploads.FileStage.release, stage)
            except OSError:
                # Cleanup cannot turn an already committed upload into failure.
                _LOGGER.warning("House Plan: upload staging cleanup failed", exc_info=True)

    def stage_plan(self, space_id, extension, raw):
        return self._stage(file_uploads.stage_plan, self.root / PLANS_DIR, space_id, extension, raw)

    def stage_asset(self, validated, filename):
        return self._stage(file_uploads.stage_asset, self.root / ASSETS_DIR, validated, filename)

    async def publish_upload(self, stage):
        return await self._settle(file_uploads.publish, stage)

    async def existing_plans(self, names):
        if not names:
            return set()
        index = FilesystemContentIndex(self.root)
        found = await self.cpu.run(index.existing, {ContentRef("plan", name) for name in names})
        return {reference.key for reference in found}

    async def existing_content(self, references):
        return await self.cpu.run(FilesystemContentIndex(self.root).existing, references)

    async def inspect(self, config):
        return await self.cpu.run(FilesystemContentIndex(self.root).snapshot, config)

    async def retire(self, intent):
        def collect():
            retire_plans(self.root / PLANS_DIR, intent.plans)
            retire_attachments(self.root / FILES_DIR, intent.attachments, intent.protected_attachments,
                               sweep_staging=intent.sweep_staging)

        await self.cpu.run(collect)

    async def plan_catalog(self):
        def scan():
            rows = []
            root = self.root / PLANS_DIR
            if not root.is_dir():
                return rows
            for item in sorted(root.iterdir()):
                if not item.is_file() or not is_plan_file(item.name):
                    continue
                try:
                    stat = item.stat()
                except OSError:
                    continue
                rows.append({"name": item.name, "size": stat.st_size, "modified": int(stat.st_mtime)})
            return rows

        return await self.cpu.run(scan)

    async def delete_plan(self, name):
        if not isinstance(name, str) or sanitize_filename(name) != name or not is_plan_file(name):
            raise CommandError("invalid_name", "Not a plan file")

        def remove():
            path = self.root / PLANS_DIR / name
            try:
                path.unlink()
                return True
            except FileNotFoundError:
                return False
            except OSError as error:
                _LOGGER.warning("House Plan: could not delete %s: %s", path, error)
                return False

        return await self.cpu.run(remove)

    async def asset_catalog(self):
        return await self.cpu.run(read_catalog, self.root / ASSETS_DIR)

    async def resolve_assets(self, asset_ids):
        if any(not isinstance(aid, str) or not ASSET_ID_RE.fullmatch(aid) for aid in asset_ids):
            raise CommandError("invalid_format", "Invalid asset id")

        def resolve():
            rows = []
            for aid in sorted(asset_ids):
                row = read_asset(self.root / ASSETS_DIR, aid)
                if row is not None and self.verifier.verify(self.root / ASSETS_DIR / f"{aid}{row['ext']}", aid):
                    rows.append(row)
            return rows

        return await self.cpu.run(resolve)

    async def delete_asset(self, aid):
        if not isinstance(aid, str) or not ASSET_ID_RE.fullmatch(aid):
            raise CommandError("invalid_format", "Invalid asset id")

        def remove():
            removed = False
            root = self.root / ASSETS_DIR
            for extension in ASSET_EXTENSIONS:
                path = root / f"{aid}{extension}"
                if not path.is_file():
                    continue
                try:
                    path.unlink()
                    removed = True
                except FileNotFoundError:
                    pass
            meta = asset_meta_path(root, aid)
            if meta.is_file():
                try:
                    meta.unlink()
                    removed = True
                except FileNotFoundError:
                    pass
            return removed

        return await self.cpu.run(remove)
