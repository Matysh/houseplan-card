"""Bounded dictionary lease adapter; persistent hosts implement the same port."""
from __future__ import annotations

import time

from .command_ports import CommandError
from .import_export import cache_preview
from .ports import PortableRuntime


class DictionaryImportLeases:
    """Mutation methods have no await: atomic on their owning event loop.

    This is not a multi-process database. A persistent implementation repeats
    capacity/owner/expiry/digest conditions within its actual DB transaction.
    Loaded candidates are observations: the command service copies before edit.
    """

    def __init__(self, runtime: PortableRuntime):
        self.runtime = runtime

    def _scope(self, scope: str):
        if scope != self.runtime.instance_id:
            raise CommandError("unauthorized")

    async def load(self, scope, token):
        self._scope(scope)
        return self.runtime.import_previews.get(token)

    async def publish(self, scope, token, candidate):
        self._scope(scope)
        cache_preview(self.runtime, token, candidate)

    async def update(self, scope, token, expected_digest, candidate):
        self._scope(scope)
        current = self.runtime.import_previews.get(token)
        if not current or current.get("digest") != expected_digest or current.get("expires", 0) <= time.time():
            return False
        self.runtime.import_previews[token] = candidate
        return True

    async def consume(self, scope, token):
        self._scope(scope)
        self.runtime.import_previews.pop(token, None)
