"""One bounded full-path collector per saved source/robot, never per card."""
from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_call_later

from .vacuum_paths import (
    PathRejected,
    PathSnapshot,
    dreame_snapshot,
    normalize_paths,
    snapshot,
)

MIN_READ_S = 10.0
ACTIVE_POLL_S = 30.0
TIMEOUT_S = 10.0
BACKOFF_S = (30.0, 60.0, 120.0, 300.0)
FINAL_OFFSETS_S = (0.0, 15.0, 45.0)
FINAL_DEADLINE_S = 60.0
MOVING = frozenset({"cleaning", "returning", "on"})


@dataclass(frozen=True, slots=True)
class PathContext:
    source: str
    vacuum: str
    map_id: str
    markers: tuple[tuple[str, str, str], ...]  # marker, route, opaque run generation
    moving: bool
    available: bool
    platform: str | None
    routing_key: str = ""  # target/calibration fence, not exposed to readers

    @property
    def identity(self) -> tuple[Any, ...]:
        return self.source, self.vacuum, self.map_id, self.markers, self.routing_key


@dataclass(slots=True)
class _Lease:
    context: PathContext
    task: asyncio.Task[PathSnapshot] | None = None
    timer: Callable[[], None] | None = None
    started: float = float("-inf")
    failure_count: int = 0
    next_retry: float = 0.0
    stop_at: float | None = None
    finals: list[float] = field(default_factory=list)
    pending: bool = False
    reset_map: str | None = None
    retired: bool = False
    attribute_value: Any = None


@dataclass(slots=True)
class _PhysicalRead:
    task: asyncio.Task[Any] | None = None
    started: float = float("-inf")
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class PathCollector:
    """Physical read leases survive wrapper timeouts, context changes/unload.

    A retired in-flight lease remains in the source table until the underlying
    call completes. No replacement task can double-read that same camera.
    """

    def __init__(self, hass: HomeAssistant,
                 accept: Callable[[PathContext, PathSnapshot, bool], None],
                 reason: Callable[[PathContext, str], None],
                 read_camera: Callable[[str], Any] | None = None,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self.hass = hass
        self.accept = accept
        self.reason = reason
        self.read_camera = read_camera or self._read_camera
        self.clock = clock
        self.leases: dict[tuple[str, str], _Lease] = {}
        # HA lifetime, not integration lifetime: a reload may not release an
        # executor read owned by the old recorder. Values contain no tokens.
        self.physical: dict[str, _PhysicalRead] = hass.data.setdefault("houseplan_vacuum_path_reads", {})
        self.closed = False

    async def _read_camera(self, source: str) -> str:
        # Public HA camera registry, imported lazily: position-only installations
        # must not require optional camera codecs. Never reach into a vendor's
        # device/coordinator or make a token-bearing self-HTTP request.
        from homeassistant.components.camera.helper import get_camera_from_entity_id

        camera = get_camera_from_entity_id(self.hass, source)
        method = getattr(camera, "map_data_string", None)
        map_index = getattr(camera, "map_index", None)
        if not callable(method) or isinstance(map_index, bool) or map_index != 0:
            raise PathRejected("unsupported")
        payload = await method(include_resources=False)
        if not isinstance(payload, str):
            raise PathRejected("unsupported")
        return payload

    def refresh(self, contexts: list[PathContext]) -> None:
        expected = {(c.source, c.vacuum) for c in contexts}
        for key, lease in list(self.leases.items()):
            if key not in expected:
                self._retire(lease)
                if lease.task is None:
                    del self.leases[key]
        for context in contexts:
            self.observe(context, event=False)

    def observe(self, context: PathContext, *, event: bool = True,
                attribute_path: Any = None) -> None:
        if self.closed:
            return
        key = (context.source, context.vacuum)
        lease = self.leases.get(key)
        now = self.clock()
        if lease is None:
            lease = _Lease(context)
            self.leases[key] = lease
        previous = lease.context
        identity_changed = previous.identity != context.identity or lease.retired
        if identity_changed:
            lease.reset_map = None
            lease.finals.clear()
            lease.stop_at = None
            lease.attribute_value = None
        lease.context = context
        lease.retired = False
        if not context.available:
            self._cancel_timer(lease)
            lease.pending = False
            return
        if context.moving:
            lease.finals.clear()
            lease.stop_at = None
        elif previous.moving and not identity_changed:
            lease.stop_at = now
            lease.finals = [now + offset for offset in FINAL_OFFSETS_S]
        if attribute_path is not None and attribute_path is not lease.attribute_value:
            lease.attribute_value = attribute_path
            if lease.task is None:
                self._start(lease, attribute_path)
            else:
                lease.pending = True
            return
        if context.platform != "dreame_vacuum":
            return
        if context.moving or lease.finals:
            lease.pending |= event or identity_changed or lease.started == float("-inf")
            self._schedule(lease)
        else:
            self._cancel_timer(lease)

    def _cancel_timer(self, lease: _Lease) -> None:
        if lease.timer is not None:
            lease.timer()
            lease.timer = None

    def _retire(self, lease: _Lease) -> None:
        lease.retired = True
        lease.pending = False
        lease.finals.clear()
        self._cancel_timer(lease)

    def close(self) -> None:
        self.closed = True
        for lease in self.leases.values():
            self._retire(lease)
        # Do not cancel tasks: camera coroutines may already own executor work.

    def _schedule(self, lease: _Lease) -> None:
        if self.closed or lease.retired or lease.task is not None:
            return
        context = lease.context
        if not context.available or context.platform != "dreame_vacuum":
            return
        now = self.clock()
        if lease.stop_at is not None and now > lease.stop_at + FINAL_DEADLINE_S:
            lease.finals.clear()
        if not context.moving and not lease.finals:
            self._cancel_timer(lease)
            return
        desired = now if lease.pending else lease.started + ACTIVE_POLL_S
        if not context.moving:
            desired = lease.finals[0]
        due = max(desired, lease.started + MIN_READ_S, lease.next_retry)
        if lease.stop_at is not None and due > lease.stop_at + FINAL_DEADLINE_S:
            lease.finals.clear()
            return
        self._cancel_timer(lease)

        @callback
        def fire(_now: Any) -> None:
            lease.timer = None
            if not self.closed and not lease.retired and lease.context.available:
                if not lease.context.moving and lease.finals:
                    lease.finals.pop(0)
                self._start(lease)

        lease.timer = async_call_later(self.hass, max(0, due - now), fire)

    def _start(self, lease: _Lease, attribute_path: Any = None) -> None:
        if lease.task is not None or self.closed or lease.retired or not lease.context.available:
            return
        context = lease.context
        self._cancel_timer(lease)
        lease.pending = False
        if attribute_path is None:
            lease.started = self.clock()

        async def perform() -> PathSnapshot:
            if attribute_path is not None:
                paths = await self.hass.async_add_executor_job(normalize_paths, attribute_path)
                return await self.hass.async_add_executor_job(
                    snapshot, "attributes", "full-path-v1", paths, context.map_id,
                )
            physical = self.physical.setdefault(context.source, _PhysicalRead())
            async with physical.lock:
                # If an owner was cancelled externally, drain its physical
                # operation as well. A new context never consumes that value.
                if physical.task is not None:
                    try:
                        await asyncio.shield(physical.task)
                    except Exception:
                        pass
                delay = physical.started + MIN_READ_S - self.clock()
                if delay > 0:
                    await asyncio.sleep(delay)
                if self.closed or lease.retired or not lease.context.available \
                        or lease.context.platform != "dreame_vacuum" \
                        or lease.context.identity != context.identity \
                        or (not lease.context.moving and lease.stop_at is not None
                            and self.clock() > lease.stop_at + FINAL_DEADLINE_S):
                    raise PathRejected("retired")
                async def physical_read() -> Any:
                    return await self.read_camera(context.source)
                physical.started = self.clock()
                physical.task = self.hass.async_create_background_task(physical_read(), "houseplan vacuum camera read")
                owned = physical.task
                try:
                    payload = await asyncio.shield(owned)
                finally:
                    if owned.done() and physical.task is owned:
                        physical.task = None
            return await self.hass.async_add_executor_job(dreame_snapshot, payload)

        task = self.hass.async_create_background_task(perform(), "houseplan vacuum native path")
        lease.task = task

        timed_out = False
        async def timeout_notice() -> None:
            nonlocal timed_out
            try:
                await asyncio.wait_for(asyncio.shield(task), TIMEOUT_S)
            except TimeoutError:
                if not self.closed and not lease.retired and lease.context.identity == context.identity:
                    self.reason(context, "stale")
                    timed_out = True
                    self._backoff(lease)
            except (Exception, asyncio.CancelledError):  # result handled by done
                pass

        self.hass.async_create_background_task(timeout_notice(), "houseplan vacuum path timeout")

        @callback
        def done(completed: asyncio.Task[PathSnapshot]) -> None:
            lease.task = None
            current = not self.closed and not lease.retired and lease.context.available \
                and lease.context.identity == context.identity
            try:
                result = completed.result()
            except (Exception, asyncio.CancelledError) as err:
                if current:
                    self.reason(context, str(err) if isinstance(err, PathRejected) else "stale")
                    if not timed_out:
                        self._backoff(lease)
            else:
                if current:
                    lease.failure_count = 0
                    lease.next_retry = 0
                    if not result.paths:
                        # A schema-validated reset is a run signal. Missing or
                        # malformed path data must never arm this proof.
                        lease.reset_map = result.map_key if context.moving else None
                    else:
                        proven = lease.reset_map == result.map_key
                        self.accept(context, result, proven)
                    if result.final:
                        lease.finals.clear()
            if lease.retired and lease.task is None:
                self.leases.pop((context.source, context.vacuum), None)
            elif lease.attribute_value is not None and lease.pending:
                self._start(lease, lease.attribute_value)
            else:
                self._schedule(lease)

        task.add_done_callback(done)

    def _backoff(self, lease: _Lease) -> None:
        delay = BACKOFF_S[min(lease.failure_count, len(BACKOFF_S) - 1)]
        lease.failure_count += 1
        lease.next_retry = self.clock() + delay
