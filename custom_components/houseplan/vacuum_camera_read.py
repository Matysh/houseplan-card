"""One HA-lifetime physical camera lease, shared by live and explicit history."""
from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from homeassistant.core import HomeAssistant

from .vacuum_paths import PathRejected


@dataclass(slots=True)
class PhysicalRead:
    task: asyncio.Task[Any] | None = None
    started: float = float("-inf")
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


async def read_camera(
    hass: HomeAssistant, physical: dict[str, PhysicalRead], source: str,
    read: Callable[[], Any], current: Callable[[], bool],
    clock: Callable[[], float] = time.monotonic, minimum: float = 10.0,
    admit: Callable[[], Awaitable[None]] | None = None,
) -> tuple[Any, float]:
    """Cancellation/timeout never frees an unfinished provider operation.

    The next owner drains the old operation without consuming its result, then
    observes the same minimum start interval. Only the caller owns adoption.
    """
    lease = physical.setdefault(source, PhysicalRead())
    async with lease.lock:
        if lease.task is not None:
            previous = lease.task
            try:
                await asyncio.shield(previous)
            except asyncio.CancelledError:
                caller = asyncio.current_task()
                if not previous.cancelled() or caller is not None and caller.cancelling():
                    raise
            except Exception:
                pass
            finally:
                if previous.done() and lease.task is previous:
                    lease.task = None
        delay = lease.started + minimum - clock()
        if delay > 0:
            await asyncio.sleep(delay)
        if admit is not None:
            await admit()
        if not current():
            raise PathRejected("retired")
        lease.started = clock()
        started_ms = time.time() * 1000
        async def physical_read() -> tuple[bool, Any]:
            try:
                return True, await read()
            except PathRejected as err:
                return False, str(err)
            except Exception:
                # A callerless late provider error must not become an
                # unhandled HA background exception with private details.
                return False, "stale"

        lease.task = hass.async_create_background_task(physical_read(), "houseplan vacuum camera read")
        owned = lease.task

        def release(completed: asyncio.Task[Any]) -> None:
            if lease.task is completed:
                lease.task = None
            # The logical caller may already have timed out. Consume a late
            # error without logging provider details or retaining its payload.
            if not completed.cancelled():
                completed.exception()

        owned.add_done_callback(release)
        try:
            success, payload = await asyncio.shield(owned)
            if not success:
                raise PathRejected(payload)
            return payload, started_ms
        except asyncio.CancelledError:
            caller = asyncio.current_task()
            if caller is not None and caller.cancelling():
                raise
            raise PathRejected("stale") from None
        finally:
            if owned.done() and lease.task is owned:
                lease.task = None
