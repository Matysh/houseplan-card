"""Single-process reference ports for tests and embedded plan-only examples.

This is not durable storage or a production tenant database. A website supplies
its own transactional storage port; the conformance scenarios do not change.
"""
from __future__ import annotations

import asyncio
import contextvars
import copy
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

from .command_ports import CommandCache, CommandError, PairCommitFailure, PlanPair
from .coordinate_canonicalization import (
    canonicalize_config_geometry,
    canonicalize_layout_geometry,
)


class ThreadCpuExecutor:
    async def run(self, function, *args):
        context = contextvars.copy_context()
        return await asyncio.get_running_loop().run_in_executor(None, context.run, function, *args)


@dataclass(slots=True)
class MemoryAuthority:
    owner_id: str = "reference-owner"
    scope_id: str = "reference-plan"
    can_write: bool = True
    archive_admin: bool = False
    current_owner: str = "reference-owner"
    current_scope: str = "reference-plan"

    def ensure(self):
        if (not self.can_write or self.current_owner != self.owner_id
                or self.current_scope != self.scope_id):
            raise CommandError("unauthorized", "Editing permission was lost")


@dataclass(slots=True)
class MemoryEffects:
    events: list[tuple[str, dict]] = field(default_factory=list)
    missing_revisions: list[tuple[str, int]] = field(default_factory=list)

    def emit(self, name, data):
        self.events.append((name, copy.deepcopy(data)))

    def missing_revision(self, command, current_rev):
        self.missing_revisions.append((command, current_rev))

    async def release_snapshot(self, previous, config, metadata):
        # This host has no HA device-history attachment pins.
        return None

    async def purge_trails(self, config):
        return None

    async def forget_deleted_markers(self, config, marker_ids):
        return None

    def refresh_trails(self):
        return None

    def schedule_repairs(self):
        return None

    def pinned_attachment_refs(self):
        return set()


class MemoryPlanStorage:
    def __init__(self, config_data: dict, layout_data: dict):
        self.config_data = copy.deepcopy(config_data)
        self.layout_data = copy.deepcopy(layout_data)
        self.cache = CommandCache()
        self.lock = asyncio.Lock()

    @asynccontextmanager
    async def transaction(self):
        async with self.lock:
            yield MemoryPlanTransaction(self)

    def snapshot(self):
        return PlanPair(copy.deepcopy(self.config_data), copy.deepcopy(self.layout_data))


class MemoryPlanTransaction:
    def __init__(self, storage):
        self.storage = storage
        self.cache = storage.cache
        self.expected: tuple[int, int] | None = None

    async def load(self):
        pair = self.storage.snapshot()
        self.expected = (int(pair.config_data.get("rev", 0)), int(pair.layout_data.get("rev", 0)))
        return pair

    def _cas(self):
        actual = (int(self.storage.config_data.get("rev", 0)), int(self.storage.layout_data.get("rev", 0)))
        if self.expected is None or actual != self.expected:
            raise CommandError("conflict", "Plan changed elsewhere")

    def _accepted(self):
        self.expected = (int(self.storage.config_data.get("rev", 0)),
                         int(self.storage.layout_data.get("rev", 0)))

    async def save_config(self, config, rev, *, previous, canonical, authorize):
        authorize()
        self._cas()
        self.storage.config_data = {**copy.deepcopy(previous), "config": copy.deepcopy(config) if canonical
                                    else canonicalize_config_geometry(config), "rev": rev}
        self.cache.schema_clean_rev = None
        self._accepted()

    async def save_layout(self, previous, layout, rev, *, metadata=None,
                          remove=(), authorize):
        authorize()
        self._cas()
        data = {key: copy.deepcopy(value) for key, value in previous.items()
                if key not in {"layout", "rev", *remove}}
        data.update(copy.deepcopy(metadata or {}))
        data.update(layout=canonicalize_layout_geometry(layout), rev=rev)
        self.storage.layout_data = data
        self._accepted()

    async def commit_pair(self, target, rollback, *, authorize):
        authorize()
        self._cas()
        # Prepare everything before either assignment; there is no await,
        # serialization or fallible copy between the two publications.
        config = {**copy.deepcopy(self.storage.config_data), "config": copy.deepcopy(target["config"]),
                  "rev": target["config_rev"]}
        house = target.get("house_files")
        layout = {**copy.deepcopy(target.get("final_metadata", {})),
                  "layout": copy.deepcopy(target["layout"]) if house else canonicalize_layout_geometry(target["layout"]),
                  "rev": target["layout_rev"]}
        if house:
            resources = getattr(self.storage, "house", None)
            if resources is None:
                raise CommandError("not_ready")
            try:
                await resources.recover(house["descriptor"], house["action"])
                authorize()
                self._cas()
            except Exception as error:
                await resources.recover(house["descriptor"], "rollback")
                raise PairCommitFailure(recovery_pending=False) from error
        self.storage.config_data, self.storage.layout_data = config, layout
        self.cache.schema_clean_rev = None
        self._accepted()
