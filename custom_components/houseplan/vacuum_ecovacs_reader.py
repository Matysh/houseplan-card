"""One HA-lifetime physical lease for an Ecovacs image; no vendor commands."""
from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later

from .vacuum_ecovacs import EcovacsMap, EcovacsRejected, decode_ecovacs_svg

MIN_READ_S = 2.0
POLL_S = 10.0
TIMEOUT_S = 10.0
BACKOFF_S = (30.0, 60.0, 120.0, 300.0)
MOVING = frozenset({"cleaning", "returning", "on"})


@dataclass(slots=True)
class _Physical:
    task: asyncio.Task[EcovacsMap] | None = None
    started: float = float("-inf")
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


@dataclass(slots=True)
class _Source:
    source: str
    vacuum: str
    generation: int
    task: asyncio.Task[EcovacsMap] | None = None
    timer: Callable[[], None] | None = None
    value: EcovacsMap | None = None
    identity: tuple[str, str] | None = None
    reason: str | None = None
    started: float = float("-inf")
    retry: float = 0.0
    failures: int = 0
    attempt: int = 0
    moving: bool = False
    finals: list[float] = field(default_factory=list)
    deadline: float | None = None
    pending: bool = False


def ecovacs_pair(hass: HomeAssistant, source: str, vacuum: str) -> bool:
    """Registry identity, not a file extension or an XML resemblance."""
    if not source.startswith("image.") or not vacuum.startswith("vacuum."):
        return False
    registry = er.async_get(hass)
    if registry is None or not hasattr(registry, "async_get"):
        return False
    image = registry.async_get(source)
    robot = registry.async_get(vacuum)
    return bool(image and robot and getattr(image, "platform", None) == "ecovacs"
                and getattr(robot, "platform", None) == "ecovacs"
                and image.device_id and image.device_id == robot.device_id
                and image.disabled_by is None and robot.disabled_by is None)


def automatic_ecovacs_source(hass: HomeAssistant, vacuum: str) -> str | None:
    registry = er.async_get(hass)
    if registry is None or not hasattr(registry, "async_get"):
        return None
    robot = registry.async_get(vacuum)
    if not robot or getattr(robot, "platform", None) != "ecovacs" or not robot.device_id:
        return None
    candidates = [entry.entity_id for entry in er.async_entries_for_device(registry, robot.device_id)
                  if ecovacs_pair(hass, entry.entity_id, vacuum)]
    return candidates[0] if len(candidates) == 1 else None


class EcovacsReader:
    """Cached SVG reads feed both View telemetry and the existing recorder."""

    def __init__(self, hass: HomeAssistant, changed: Callable[[str], None],
                 read: Callable[[str], Any] | None = None,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self.hass = hass
        self.changed = changed
        self.read = read or self._read
        self.clock = clock
        self.sources: dict[str, _Source] = {}
        self.physical: dict[str, _Physical] = hass.data.setdefault("houseplan_ecovacs_reads", {})
        self.closed = False
        self.generation = 0

    async def _read(self, source: str) -> EcovacsMap:
        from homeassistant.components.image import async_get_image

        image = await async_get_image(self.hass, source, timeout=10)
        if image.content_type != "image/svg+xml":
            raise EcovacsRejected("unsupported")
        return await self.hass.async_add_executor_job(decode_ecovacs_svg, image.content)

    def _identity(self, source: _Source) -> tuple[str, str] | None:
        if not ecovacs_pair(self.hass, source.source, source.vacuum):
            return None
        image = self.hass.states.get(source.source)
        robot = self.hass.states.get(source.vacuum)
        if not image or not robot or image.state in ("unknown", "unavailable") \
                or robot.state in ("unknown", "unavailable"):
            return None
        map_id = image.attributes.get("map_name")
        if map_id is None:
            map_id = robot.attributes.get("selected_map", "default")
        if isinstance(map_id, bool) or not isinstance(map_id, (str, int)) or len(str(map_id)) > 256:
            return None
        return str(map_id), image.last_updated.isoformat()

    def refresh(self, pairs: dict[str, list[tuple[str, str]]]) -> None:
        self.generation += 1
        expected = {}
        for source, markers in pairs.items():
            vacuums = {vacuum for _, vacuum in markers if ecovacs_pair(self.hass, source, vacuum)}
            if len(vacuums) == 1:
                vacuum = next(iter(vacuums))
                if ecovacs_pair(self.hass, source, vacuum):
                    expected[source] = vacuum
        for source, lease in list(self.sources.items()):
            if expected.get(source) != lease.vacuum:
                self._cancel(lease)
                del self.sources[source]
                self.changed(source)
        for source, vacuum in expected.items():
            lease = self.sources.get(source)
            if lease is None:
                lease = _Source(source, vacuum, self.generation)
                self.sources[source] = lease
            lease.generation = self.generation
            lease.attempt += 1
            self.observe(source)

    def _cancel(self, lease: _Source) -> None:
        if lease.timer:
            lease.timer()
            lease.timer = None

    def close(self) -> None:
        self.closed = True
        for lease in self.sources.values():
            self._cancel(lease)
        # Reads may own executor work: neither timeout nor reload cancels it.

    def observe(self, source: str) -> None:
        lease = self.sources.get(source)
        if self.closed or lease is None:
            return
        identity = self._identity(lease)
        if identity is None:
            lease.attempt += 1
            lease.pending = False
            self._cancel(lease)
            self._fail(lease, "unavailable")
            return
        if lease.identity and lease.identity[0] != identity[0]:
            lease.value = None
            lease.identity = None
            lease.attempt += 1
            self.changed(source)
        moving = self.hass.states.get(lease.vacuum).state in MOVING
        if lease.moving and not moving:
            now = self.clock()
            lease.finals = [now, now + 15, now + 45]
            lease.deadline = now + 60
        if moving:
            lease.finals.clear()
            lease.deadline = None
        lease.moving = moving
        lease.pending = True
        self._schedule(lease)

    def _schedule(self, lease: _Source) -> None:
        if self.closed or self.sources.get(lease.source) is not lease or lease.task is not None:
            return
        self._cancel(lease)
        if self._identity(lease) is None:
            return
        now = self.clock()
        if lease.deadline is not None and now > lease.deadline:
            lease.finals.clear()
        if lease.pending:
            due = now
        elif lease.finals:
            due = lease.finals[0]
        elif lease.moving:
            due = lease.started + POLL_S
        else:
            return
        due = max(due, lease.started + MIN_READ_S, lease.retry,
                  self.physical.get(lease.source, _Physical()).started + MIN_READ_S)
        if not lease.moving and not lease.pending and lease.deadline is not None and due > lease.deadline:
            lease.finals.clear()
            return

        @callback
        def fire(_now: Any) -> None:
            lease.timer = None
            if lease.finals and lease.finals[0] <= self.clock():
                lease.finals.pop(0)
            self._start(lease)

        lease.timer = async_call_later(self.hass, max(0, due - now), fire)

    def _current(self, lease: _Source, generation: int, attempt: int,
                 identity: tuple[str, str]) -> bool:
        return not self.closed and self.sources.get(lease.source) is lease \
            and lease.generation == generation and lease.attempt == attempt \
            and self._identity(lease) == identity

    def _start(self, lease: _Source) -> None:
        identity = self._identity(lease)
        if self.closed or identity is None or lease.task is not None \
                or self.sources.get(lease.source) is not lease:
            return
        lease.started = self.clock()
        lease.pending = False
        generation, attempt = lease.generation, lease.attempt

        async def perform() -> EcovacsMap:
            physical = self.physical.setdefault(lease.source, _Physical())
            async with physical.lock:
                if physical.task:
                    try:
                        await asyncio.shield(physical.task)
                    except (Exception, asyncio.CancelledError):
                        pass
                delay = physical.started + MIN_READ_S - self.clock()
                if delay > 0:
                    await asyncio.sleep(delay)
                if not self._current(lease, generation, attempt, identity):
                    raise EcovacsRejected("retired")
                physical.started = self.clock()
                physical.task = self.hass.async_create_background_task(
                    self.read(lease.source), "House Plan Ecovacs image read")
                owned = physical.task
                try:
                    return await asyncio.shield(owned)
                finally:
                    if owned.done() and physical.task is owned:
                        physical.task = None

        task = self.hass.async_create_background_task(perform(), "House Plan Ecovacs source")
        lease.task = task

        async def timeout_notice() -> None:
            try:
                await asyncio.wait_for(asyncio.shield(task), TIMEOUT_S)
            except TimeoutError:
                if self._current(lease, generation, attempt, identity):
                    lease.attempt += 1
                    lease.pending = True
                    self._fail(lease, "stale")
                    self._backoff(lease)
            except (Exception, asyncio.CancelledError):
                pass

        self.hass.async_create_background_task(timeout_notice(), "House Plan Ecovacs timeout")

        @callback
        def done(completed: asyncio.Task[EcovacsMap]) -> None:
            lease.task = None
            current = self._current(lease, generation, attempt, identity)
            try:
                value = completed.result()
            except (Exception, asyncio.CancelledError) as err:
                if current:
                    self._fail(lease, str(err) if isinstance(err, EcovacsRejected) else "stale")
                    self._backoff(lease)
            else:
                if current:
                    lease.value = value
                    lease.identity = identity
                    lease.reason = None
                    lease.retry = 0
                    lease.failures = 0
                    self.changed(lease.source)
            if not current and not self.closed and self.sources.get(lease.source) is lease:
                lease.pending = True
            self._schedule(lease)

        task.add_done_callback(done)

    def _fail(self, lease: _Source, reason: str) -> None:
        if lease.reason != reason:
            lease.reason = reason
            self.changed(lease.source)

    def _backoff(self, lease: _Source) -> None:
        lease.retry = self.clock() + BACKOFF_S[min(lease.failures, len(BACKOFF_S) - 1)]
        lease.failures += 1

    def telemetry(self, source: str) -> dict[str, Any] | None:
        lease = self.sources.get(source)
        if not lease or lease.reason or not lease.value or self._identity(lease) != lease.identity:
            return None
        return {"vacuum_position": lease.value.position, "map_name": lease.identity[0],
                "path": lease.value.paths, "houseplan_map_bounds": list(lease.value.bounds)}

    def public(self) -> dict[str, Any]:
        out = {}
        for source, lease in self.sources.items():
            identity = self._identity(lease)
            good = bool(identity and identity == lease.identity and lease.value and not lease.reason)
            out[source] = {"vacuum": lease.vacuum, "map_id": identity[0] if identity else None,
                           "state_revision": identity[1] if identity else None,
                           "position": lease.value.position if good else None,
                           "bounds": list(lease.value.bounds) if good else None,
                           "native_path": good,
                           "reason": lease.reason if identity else "unavailable"}
        return out

    def preview(self, source: str) -> dict[str, Any]:
        lease = self.sources.get(source)
        if not lease or lease.reason or not lease.value or self._identity(lease) != lease.identity:
            raise EcovacsRejected("stale")
        if not lease.value.png:
            raise EcovacsRejected(lease.value.preview_reason or "preview_unsupported")
        return {"source": source, "map_id": lease.identity[0], "revision": lease.value.digest,
                "bounds": list(lease.value.bounds), "image": lease.value.png}
