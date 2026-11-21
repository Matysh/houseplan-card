"""Host-independent large-command staging and one-shot token resolution."""
from __future__ import annotations

from contextlib import asynccontextmanager

from .command_execution import begin_preparation
from .command_ports import CommandError, CommandPolicy
from .portable_commands import environment
from .structural_upload import UploadError, prepare_finish, prepare_resolution


class DictionaryStructuralStaging:
    """Single-loop ephemeral reference/HA repository, never a distributed lock."""

    def __init__(self, scope, manager):
        self.scope, self.manager = scope, manager

    @asynccontextmanager
    async def transaction(self, scope):
        if scope != self.scope:
            raise CommandError("unauthorized")
        # Kernel calls below contain no await. Returning the same event-loop
        # object also keeps HA's legacy device/history resolver interoperable.
        yield self.manager


def _repository(session):
    env = environment(session)
    if env.staging is None:
        raise CommandError("not_ready")
    return env.staging


def _purpose(session, purpose):
    if (environment(session).policy is CommandPolicy.PLAN_ONLY
            and purpose not in {"houseplan/config/set", "houseplan/layout/set", "houseplan/plan/optimize",
                                "houseplan/plan/optimize_undo", "houseplan/wall/node_move",
                                "houseplan/wall/node_delete"}):
        raise UploadError("upload_purpose")


async def stage(session, blocks, declared_size=None):
    session.authority.ensure()
    repo, scope, owner = _repository(session), session.authority.scope_id, session.authority.owner_id
    token, retained = None, False
    try:
        async with repo.transaction(scope) as manager:
            token = manager.begin(owner, declared_size)
        async for block in blocks:
            session.authority.ensure()
            async with repo.transaction(scope) as manager:
                manager.append(token, owner, block)
        async with repo.transaction(scope) as manager:
            snapshot = manager.snapshot(token, owner)
        begin_preparation()
        prepared = await session.cpu.run(prepare_finish, snapshot)
        _purpose(session, prepared[2])
        session.before_commit()
        async with repo.transaction(scope) as manager:
            # Repository acquisition may await network I/O. Recheck immediately
            # before changing the canonical lease, not just before acquiring it.
            session.authority.ensure()
            result = manager.complete_finish(snapshot, prepared)
            retained = True
        return result
    finally:
        if token is not None and not retained:
            async with repo.transaction(scope) as manager:
                manager.cancel(token, owner)


async def resolve(session, compact, schema=None):
    session.authority.ensure()
    repo, scope, owner = _repository(session), session.authority.scope_id, session.authority.owner_id
    _purpose(session, compact.get("type"))
    async with repo.transaction(scope) as manager:
        snapshot, message = manager.resolution_snapshot(compact, owner)
    begin_preparation()
    expanded = await session.cpu.run(prepare_resolution, snapshot, message)
    if schema is not None:
        # The transport may retain its existing declarative input schema. It
        # does not get a command/transaction callback or validation authority.
        expanded = await session.cpu.run(schema, expanded)
    session.before_commit()
    async with repo.transaction(scope) as manager:
        session.authority.ensure()
        manager.consume(compact["upload_token"], owner, snapshot)
    return expanded
