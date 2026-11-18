"""Single-process filesystem house pool, shared by HA and the reference lab.

This is a resource adapter, not a second importer. PlanCommands owns permission,
projection, candidates, CAS and paired commit. All expensive work uses the CPU
port, with cancellation settling before any private directory is released.
"""
from __future__ import annotations

import asyncio
import copy
import os
import secrets
import shutil
import stat
import time
from contextlib import asynccontextmanager
from functools import partial
from pathlib import Path

from . import house_archive, house_files
from .backup_archive import CHUNK, _source_image
from .command_ports import CommandError
from .constants import MIN_FREE_BYTES
from .house_prefix import PREFIX_BYTES
from .input_policy import InputLimit

TTL = 600
MAX_STAGING_BYTES = house_archive.MAX_ARCHIVE_BYTES + 8 * 1024**2 + 64 * 1024


class FilesystemHouseResources:
    def __init__(self, root: Path, cpu, *, lock=None, clock=time.time):
        self.root, self.cpu, self.clock = root, cpu, clock
        self.content_lock = lock if lock is not None else asyncio.Lock()
        self.pool_lock = asyncio.Lock()
        self.active = {}
        self.tokens = {}
        self.cancelled_operations = {}
        self.transaction_owner = None

    async def _settle(self, function, *args, on_cancel=None):
        job = asyncio.create_task(self.cpu.run(function, *args))
        cancelled = False
        while True:
            try:
                result = await asyncio.shield(job)
                break
            except asyncio.CancelledError:
                cancelled = True
                if on_cancel is not None:
                    on_cancel()
                if job.cancelled():
                    raise
            except BaseException:
                if cancelled:
                    raise asyncio.CancelledError from None
                raise
        if cancelled:
            raise asyncio.CancelledError
        return result

    @asynccontextmanager
    async def transaction(self):
        if self.transaction_owner is asyncio.current_task():
            yield self
            return
        async with self.content_lock:
            self.transaction_owner = asyncio.current_task()
            try:
                yield self
            finally:
                self.transaction_owner = None

    def _check(self, lease):
        if (self.active.get(lease["scope"]) is not lease or lease["cancelled"].is_set()
                or self.clock() >= lease["expires"]):
            raise CommandError("preview_expired")

    def _worker_check(self, lease, _growth=0):
        if (lease["cancelled"].is_set() or self.clock() >= lease["expires"]
                or self.active.get(lease["scope"]) is not lease):
            raise InputLimit("cancelled", code="zip_cancelled")

    async def _release(self, lease):
        if lease.get("pinned"):
            raise CommandError("zip_busy")
        lease["cancelled"].set()
        async with lease["io"]:
            await self._settle(house_files.cleanup_stage, self.root, lease["session"])
        if self.active.get(lease["scope"]) is lease:
            self.active.pop(lease["scope"], None)
        if lease.get("token"):
            self.tokens.pop(lease["token"], None)

    async def begin(self, scope, owner, operation, kind):
        if (not isinstance(operation, str) or not 1 <= len(operation) <= 128
                or kind not in {"import", "export"}):
            raise CommandError("invalid_format")
        async with self.pool_lock:
            self.cancelled_operations = {key: until for key, until in self.cancelled_operations.items()
                                         if until > self.clock()}
            if (scope, owner, operation) in self.cancelled_operations:
                raise CommandError("preview_expired")
            old = self.active.get(scope)
            if old is not None:
                if old["owner"] != owner and old["expires"] > self.clock() or old.get("pinned"):
                    raise CommandError("zip_busy")
                await self._release(old)
            retained = await self._settle(house_files.prune_stages, self.root,
                self.clock() - TTL, {value["session"] for value in self.active.values()})
            if retained > MAX_STAGING_BYTES:
                raise CommandError("zip_limit")
            lease = {"session": secrets.token_hex(16), "scope": scope, "owner": owner,
                     "operation": operation, "kind": kind, "expires": self.clock() + TTL,
                     "cancelled": asyncio.Event(), "io": asyncio.Lock(), "pinned": False,
                     "retained_bytes": retained}
            self.active[scope] = lease
            try:
                await self._settle(house_files.new_stage, self.root, lease["session"])
            except BaseException:
                await self._release(lease)
                raise
            return lease

    async def _next(self, iterator, lease):
        read = asyncio.create_task(anext(iterator))
        cancelled = asyncio.create_task(lease["cancelled"].wait())
        try:
            await asyncio.wait((read, cancelled), return_when=asyncio.FIRST_COMPLETED)
            self._check(lease)
            return await read
        finally:
            for task in (read, cancelled):
                if not task.done():
                    task.cancel()
            await asyncio.gather(read, cancelled, return_exceptions=True)

    async def upload(self, lease, blocks, declared_size, policy):
        limit = min(house_archive.MAX_ARCHIVE_BYTES, policy.archive_bytes)
        if (declared_size is not None and (type(declared_size) is not int or declared_size < 0
                                          or declared_size > limit)):
            raise CommandError("zip_limit")
        async with lease["io"]:
            self._check(lease)
            folder = await self._settle(house_files.identified_stage, self.root, lease["session"])
            path = folder / "archive.zip"
            stream = await self._settle(partial(path.open, "xb"))
            size, prefix = 0, b""
            iterator = aiter(blocks)
            try:
                while True:
                    try:
                        block = await self._next(iterator, lease)
                    except StopAsyncIteration:
                        break
                    if not isinstance(block, bytes):
                        raise CommandError("invalid_format")
                    size += len(block)
                    if size > limit:
                        raise CommandError("zip_limit")
                    if len(prefix) < PREFIX_BYTES:
                        prefix += block[:PREFIX_BYTES - len(prefix)]
                    # Bounded writes, regardless of a transport's chunk choice.
                    for start in range(0, len(block), CHUNK):
                        self._check(lease)

                        def write_chunk(raw):
                            if (lease["retained_bytes"] + stream.tell() + len(raw) > MAX_STAGING_BYTES
                                    or shutil.disk_usage(self.root).free < MIN_FREE_BYTES + len(raw)):
                                raise CommandError("zip_limit")
                            stream.write(raw)

                        await self._settle(write_chunk, block[start:start + CHUNK])
                if declared_size is not None and size != declared_size:
                    raise CommandError("zip_invalid")
                house_archive.check_prefix(prefix)
                await self._settle(stream.flush)
                await self._settle(os.fsync, stream.fileno())
            finally:
                await self._settle(stream.close)
            self._check(lease)
    
    async def read(self, lease):
        async with lease["io"]:
            self._check(lease)
            folder = await self._settle(house_files.identified_stage, self.root, lease["session"])
            path = folder / "archive.zip"
            payload = await self._settle(house_archive.read_archive, path, partial(self._worker_check, lease),
                                         on_cancel=lease["cancelled"].set)
            self._check(lease)
            return payload

    async def build(self, lease, document):
        async with lease["io"]:
            self._check(lease)
            path = (await self._settle(house_files.identified_stage, self.root, lease["session"])) / "archive.zip"
            reserved = lease["retained_bytes"]

            def reserve(growth):
                nonlocal reserved
                self._worker_check(lease)
                reserved += growth
                if reserved > MAX_STAGING_BYTES or shutil.disk_usage(self.root).free < MIN_FREE_BYTES + growth:
                    raise CommandError("zip_limit")

            result = await self._settle(house_archive.build_archive, path, document,
                                        partial(_source_image, self.root), reserve, on_cancel=lease["cancelled"].set)
            self._check(lease)
            return result

    async def prepare(self, lease, payload, protected_plans):
        self._check(lease)
        if self.transaction_owner is not asyncio.current_task():
            raise RuntimeError("house preparation requires the shared content transaction")
        async with lease["io"]:
            result = await self._settle(partial(house_files.prepare_files, self.root, lease["session"],
                                              payload, protected_plans=protected_plans,
                                              check=partial(self._worker_check, lease)), on_cancel=lease["cancelled"].set)
            self._check(lease)
            return result

    async def publish(self, lease, token, record):
        self._check(lease)
        if lease.get("token") or token in self.tokens:
            raise CommandError("conflict")
        prepared = await self._settle(copy.deepcopy, record)
        self._check(lease)
        lease["token"], lease["record"] = token, prepared
        self.tokens[token] = lease

    async def load(self, scope, owner, token):
        if not isinstance(token, str) or not 1 <= len(token) <= 128:
            raise CommandError("preview_expired")
        lease = self.tokens.get(token)
        if lease is None or lease["scope"] != scope or lease["owner"] != owner:
            raise CommandError("preview_expired")
        if self.clock() >= lease["expires"] and not lease["pinned"]:
            async with self.pool_lock:
                await self._release(lease)
            raise CommandError("preview_expired")
        self._check(lease)
        return lease

    async def update(self, lease, record):
        self._check(lease)
        prepared = await self._settle(copy.deepcopy, record)
        self._check(lease)
        lease["record"] = prepared

    async def pin(self, lease):
        self._check(lease)
        lease["pinned"] = True

    async def complete(self, lease):
        async with self.pool_lock:
            if self.active.get(lease["scope"]) is not lease:
                return
            lease["pinned"] = False
            await self._release(lease)

    async def cancel(self, scope, owner, token, operation):
        if token is None and operation is None:
            raise CommandError("invalid_format")
        if token is not None and (not isinstance(token, str) or not 1 <= len(token) <= 128):
            raise CommandError("invalid_format")
        async with self.pool_lock:
            lease = self.tokens.get(token) if token else self.active.get(scope)
            if lease is not None and (lease["scope"] != scope or lease["owner"] != owner
                                      or operation is not None and lease["operation"] != operation):
                raise CommandError("preview_expired")
            if operation is not None:
                if not isinstance(operation, str) or not 1 <= len(operation) <= 128:
                    raise CommandError("invalid_format")
                if len(self.cancelled_operations) >= 128:
                    self.cancelled_operations.pop(next(iter(self.cancelled_operations)))
                self.cancelled_operations[scope, owner, operation] = self.clock() + TTL
            if lease is not None:
                await self._release(lease)

    async def recover(self, descriptor, action):
        async with self.transaction():
            function = {"publish": house_files.publish_files, "rollback": house_files.rollback_publication}.get(action)
            if function is None:
                raise CommandError("invalid_format")
            await self._settle(function, self.root, descriptor)

    async def recovery_complete(self, descriptor):
        session = descriptor["session"]
        # Used after BOTH stores are durable; a restart has no live lease table.
        for lease in list(self.active.values()):
            if lease["session"] == session:
                await self.complete(lease)
                return
        await self._settle(house_files.cleanup_stage, self.root, session)

    @asynccontextmanager
    async def stream(self, lease):
        try:
            async with lease["io"]:
                self._check(lease)
                folder = await self._settle(house_files.identified_stage, self.root, lease["session"])

                def open_stream():
                    fd = os.open(folder / "archive.zip", os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
                    if not stat.S_ISREG(os.fstat(fd).st_mode):
                        os.close(fd)
                        raise CommandError("zip_invalid")
                    return os.fdopen(fd, "rb")

                stream = await self._settle(open_stream)
                try:
                    async def blocks():
                        while True:
                            self._check(lease)
                            block = await self._settle(stream.read, CHUNK)
                            if not block:
                                break
                            self._check(lease)
                            yield block

                    yield blocks()
                finally:
                    await self._settle(stream.close)
        finally:
            await self.complete(lease)
