"""Operational effects cannot reject an already durable plan command."""
from __future__ import annotations

import logging

_LOGGER = logging.getLogger(__name__)


class BestEffortEffects:
    def __init__(self, delegate):
        self.delegate = delegate

    def __getattr__(self, name):
        return getattr(self.delegate, name)

    def _sync(self, name, *args, default=None):
        try:
            return getattr(self.delegate, name)(*args)
        except Exception:  # noqa: BLE001 - no exception text enters the protocol
            _LOGGER.exception("House Plan operational effect failed: %s", name)
            return default

    async def _async(self, name, *args):
        try:
            return await getattr(self.delegate, name)(*args)
        except Exception:  # noqa: BLE001 - the accepted durable write stands
            _LOGGER.exception("House Plan operational effect failed: %s", name)

    def emit(self, name, data):
        self._sync("emit", name, data)

    def missing_revision(self, command, rev):
        self._sync("missing_revision", command, rev)

    async def release_snapshot(self, previous, config, metadata):
        await self._async("release_snapshot", previous, config, metadata)

    async def purge_trails(self, config):
        await self._async("purge_trails", config)

    async def forget_deleted_markers(self, config, ids):
        await self._async("forget_deleted_markers", config, ids)

    def refresh_trails(self):
        self._sync("refresh_trails")

    def schedule_repairs(self):
        self._sync("schedule_repairs")

    def pinned_attachment_refs(self):
        # Failure to read pins must not authorize deletion. Let the surrounding
        # best-effort cleanup skip the entire retirement in that case.
        return self.delegate.pinned_attachment_refs()
