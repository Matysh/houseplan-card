"""HA-lifetime bounded physical preview work, including timeout/unload (#942)."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field


@dataclass
class SupportBuildPool:
    leases: dict[tuple[str, str], object] = field(default_factory=dict)

    def acquire(self, owner: str, draft: str) -> object | None:
        key = (owner, draft)
        if key in self.leases or len(self.leases) >= 4:
            return None
        token = object()
        self.leases[key] = token
        return token

    def release(self, owner: str, draft: str, token: object) -> None:
        key = (owner, draft)
        if self.leases.get(key) is token:
            self.leases.pop(key, None)

    async def await_physical(
        self, owner: str, draft: str, token: object, future, *, timeout: float = 10
    ):
        # Never release on timeout/cancellation: the underlying executor cannot
        # be cancelled honestly. Completion, not the HTTP/WS wait, owns release.
        job = asyncio.ensure_future(future)

        def done(completed):
            self.release(owner, draft, token)
            if not completed.cancelled():
                completed.exception()  # retrieve late failures without logging payloads

        job.add_done_callback(done)
        return await asyncio.wait_for(asyncio.shield(job), timeout)
