"""Bounded, entry-owned Zigbee2MQTT requests; never a polling radio scanner."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import re
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from time import monotonic, time
from typing import Any
from uuid import uuid4

from homeassistant.components import mqtt
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

MAX_TOPICS = 8
MAX_LISTENERS = 32
MAX_PAYLOAD_BYTES = 2 * 1024 * 1024
MAX_NODES = 1000
MAX_LINKS = 6000
MAX_CACHE_BYTES = MAX_TOPICS * (MAX_PAYLOAD_BYTES + 1024) + 4096
CANCEL_AFTER_MS = 600_000
TRANSPORT_TIMEOUT = 10.0
INFO_TIMEOUT = 4.0
_LOGGER = logging.getLogger(__name__)


class ZigbeeScanError(Exception):
    """A stable, already localized WebSocket command refusal."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def normalize_base_topic(value: object) -> str:
    """Match the frontend's exact-topic normalization, without a saved-topic gate."""
    if not isinstance(value, str):
        raise ZigbeeScanError("invalid_data")
    topic = re.sub(r"/{2,}", "/", value.strip().strip("/"))
    # JS counts UTF-16 code units; reject lone surrogates as invalid MQTT UTF-8.
    try:
        length = len(topic.encode("utf-16-le")) // 2
        topic.encode("utf-8")
    except UnicodeError as err:
        raise ZigbeeScanError("invalid_data") from err
    if not topic or length > 180 or re.search(r"[#+\x00-\x1f\x7f]", topic):
        raise ZigbeeScanError("invalid_data")
    return topic


def _parse_payload(payload: object) -> dict[str, Any] | None:
    """Bound bytes before decoding; uncorrelatable garbage must not end a job."""
    try:
        if isinstance(payload, str):
            payload = payload.encode("utf-8")
        if not isinstance(payload, bytes) or len(payload) > MAX_PAYLOAD_BYTES:
            return None
        value = json.loads(payload)
        if not isinstance(value, dict):
            return None
        pending = [(value, 0)]
        inspected = 0
        while pending:
            item, depth = pending.pop()
            inspected += 1
            if depth > 32 or inspected > 100_000:
                return None
            if isinstance(item, dict):
                pending.extend((child, depth + 1) for child in item.values())
            elif isinstance(item, list):
                pending.extend((child, depth + 1) for child in item)
            elif isinstance(item, float) and not math.isfinite(item):
                return None
        return value
    except (ValueError, UnicodeError, RecursionError):
        return None


def _valid_map(message: dict[str, Any]) -> bool:
    """Check the raw-map shape, not routing evidence (that remains TypeScript)."""
    data = message.get("data")
    value = data.get("value", data) if isinstance(data, dict) else data
    if value is None:
        value = message.get("value", message)
    if isinstance(value, str):
        value = _parse_payload(value)
    if not isinstance(value, dict):
        return False
    nodes, links = value.get("nodes"), value.get("links")
    if not isinstance(nodes, list) or len(nodes) > MAX_NODES:
        return False
    if not isinstance(links, list) or len(links) > MAX_LINKS:
        return False
    for node in nodes:
        if not isinstance(node, dict):
            return False
        ieee = node.get("ieeeAddr", node.get("ieee_address", node.get("ieee")))
        if not isinstance(ieee, str) or not re.fullmatch(
            r"(?:0x)?[0-9a-fA-F]{16}|(?:[0-9a-fA-F]{2}[:-]){7}[0-9a-fA-F]{2}", ieee,
        ):
            return False
    routes_count = 0
    for link in links:
        if not isinstance(link, dict):
            return False
        for side in ("source", "target"):
            endpoint = link.get(f"{side}IeeeAddr", link.get(side))
            if isinstance(endpoint, bool) or not isinstance(endpoint, (dict, str, int)):
                return False
            if not endpoint and endpoint != 0:
                return False
        routes = link.get("routes", [])
        if not isinstance(routes, list) or any(not isinstance(route, dict) for route in routes):
            return False
        routes_count += len(routes)
        if routes_count > MAX_LINKS:
            return False
    return True


def _raw_map(message: dict[str, Any]) -> dict[str, Any]:
    """Persist the provider map, never its transaction/request envelope."""
    data = message.get("data")
    value = data.get("value", data) if isinstance(data, dict) else data
    if value is None:
        value = message.get("value", message)
    if isinstance(value, str):
        value = json.loads(value)
    return {key: item for key, item in value.items() if key != "transaction"}


def _enabled(config: dict[str, Any]) -> bool:
    settings = config.get("settings")
    topology = settings.get("zigbee_topology") if isinstance(settings, dict) else None
    return isinstance(topology, dict) and topology.get("enabled") is True


def validate_saved_topics(value: object) -> dict[str, dict[str, Any]]:
    """Validate a portable snapshot without trusting source entry/job metadata."""
    if not isinstance(value, dict) or len(value) > MAX_TOPICS:
        raise ValueError("invalid snapshot")
    encoded = json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
    if len(encoded) > MAX_CACHE_BYTES:
        raise ValueError("oversized snapshot")
    out = {}
    for topic, item in value.items():
        try:
            normalized = normalize_base_topic(topic)
        except ZigbeeScanError as err:
            raise ValueError("invalid snapshot") from err
        if (normalized != topic or not isinstance(item, dict)
                or set(item) != {"map", "obtained_at"}
                or type(item.get("obtained_at")) is not int or item["obtained_at"] < 0):
            raise ValueError("invalid snapshot")
        raw = json.dumps(item["map"], ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
        parsed = _parse_payload(raw)
        if parsed is None or not _valid_map(parsed) or "transaction" in parsed:
            raise ValueError("invalid snapshot")
        out[topic] = {"obtained_at": item["obtained_at"], "map": parsed}
    return out


def _cache_exists(path: str) -> bool:
    file = Path(path)
    if not file.exists():
        return False
    if file.stat().st_size > MAX_CACHE_BYTES:
        raise ValueError("oversized cache")
    return True


@dataclass
class _Job:
    topic: str
    job_id: str
    started_at: int
    started: float
    info: asyncio.Future[None]
    phase: str = "loading"
    stage: str = "connecting"
    finished: float | None = None
    error: str | None = None
    stale: bool = False
    result: dict[str, Any] | None = None
    obtained_at: int | None = None
    response_active: bool = False
    task: asyncio.Task[None] | None = None
    cleanups: list[Callable[[], None]] = field(default_factory=list)
    persistence: str | None = None


class ZigbeeScanCoordinator:
    """Entry-owned radio jobs and a separate durable, bounded map cache."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.session_id = str(uuid4())
        self.revision = 0
        self.closed = False
        self._jobs: dict[str, _Job] = {}
        self._listeners: set[Callable[[dict[str, Any]], None]] = set()
        self._operations: set[asyncio.Task] = set()
        self._store = Store(hass, 1, f"houseplan.zigbee_maps.{entry.entry_id}",
                            private=True, atomic_writes=True)
        self._saved: dict[str, dict[str, Any]] = {}
        self._storage_error: str | None = None
        self._lock = asyncio.Lock()
        self._writes: set[asyncio.Task] = set()
        self._enabled = False
        self.cache_generation = str(uuid4())
        self._backup_owner: asyncio.Task | None = None
        self._backup_pending = False
        self._backup_ready = asyncio.Event()
        self._backup_ready.set()

    async def async_setup(self, config: dict[str, Any]) -> None:
        """Restore successful maps only; loading never subscribes or publishes MQTT."""
        self._enabled = _enabled(config)
        try:
            existed = await self.hass.async_add_executor_job(_cache_exists, self._store.path)
            payload = await self._store.async_load()
            if payload is None:
                if existed:
                    raise ValueError("unreadable cache")
                return
            if (not isinstance(payload, dict) or type(payload.get("schema")) is not int
                    or payload["schema"] != 1
                    or payload.get("entry_id") != self.entry.entry_id
                    or not isinstance(payload.get("topics"), dict)
                    or len(payload["topics"]) > MAX_TOPICS):
                raise ValueError("unsupported cache")
            for topic, item in payload["topics"].items():
                if (normalize_base_topic(topic) != topic or not isinstance(item, dict)
                        or type(item.get("obtained_at")) is not int or item["obtained_at"] < 0
                        or _parse_payload(json.dumps(item.get("map"), ensure_ascii=False,
                                                     separators=(",", ":")).encode()) is None
                        or not _valid_map(item["map"])):
                    raise ValueError("invalid map cache")
            self._saved = payload["topics"]
            self.cache_generation = str(payload.get("generation") or hashlib.sha256(
                json.dumps(self._saved, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest())
            if not self._enabled:
                # A saved OFF decision is authoritative, including after an interrupted shutdown.
                if self._saved:
                    await self._save({})
                return
            for topic, item in self._saved.items():
                now = monotonic()
                job = _Job(topic, f"restored-{uuid4()}", item["obtained_at"], now,
                           self.hass.loop.create_future(), phase="ready", finished=now,
                           stale=True, result={"data": {"value": item["map"]}},
                           obtained_at=item["obtained_at"], persistence="saved")
                job.info.cancel()
                self._jobs[topic] = job
        except Exception:  # noqa: BLE001 - preserve unreadable/future data, never overwrite it automatically
            self._saved = {}
            self._storage_error = "storage_read"
            _LOGGER.error("House Plan: Zigbee map cache cannot be read; existing storage is preserved")

    async def _save(self, topics: dict[str, dict[str, Any]]) -> None:
        """Caller owns _lock; update in-memory durable truth only after successful I/O."""
        try:
            generation = str(uuid4())
            await self._store.async_save({"schema": 1, "entry_id": self.entry.entry_id,
                                          "topics": topics, "generation": generation})
        except Exception as err:  # noqa: BLE001 - stable public error, no provider data in logs
            raise ZigbeeScanError("storage_clear") from err
        self._saved = topics
        self.cache_generation = generation
        # A historical read error diagnoses restore; an explicit successful write repairs it.
        self._storage_error = None

    async def async_save_config(self, config: dict[str, Any], save: Callable[[], Awaitable]) -> None:
        """Serialize saved OFF with start/result writes; draft UI changes never call this."""
        if self._backup_owner is asyncio.current_task():
            # The paired ZIP writer owns the lifecycle lock. It writes cache
            # and emits/reset jobs only at the durable transaction boundary.
            await save()
            return
        async with self._lock:
            enabled = _enabled(config)
            if not enabled and (self._enabled or self._saved or self._storage_error):
                # Durable clear comes first: a failed clear must not acknowledge a saved OFF.
                await self._save({})
            await save()
            self._enabled = enabled
            if not enabled:
                for job in self._jobs.values():
                    self._release(job)
                    if job.task is not None:
                        job.task.cancel()
                self._jobs.clear()
                self.revision += 1
                self._emit({"kind": "reset", "session_id": self.session_id,
                            "revision": self.revision, "topics": []})

    async def async_backup_snapshot(self) -> dict[str, Any]:
        """Caller takes write_lock first, as for config-save and ZIP recovery."""
        if self.backup_owned():
            if self._storage_error:
                raise ZigbeeScanError("storage_read")
            topics = await self.hass.async_add_executor_job(validate_saved_topics, self._saved)
            return {"topics": topics, "generation": self.cache_generation}
        async with self._lock:
            if self.closed or self._backup_pending:
                raise ZigbeeScanError("conflict")
            if self._storage_error:
                raise ZigbeeScanError("storage_read")
            topics = await self.hass.async_add_executor_job(validate_saved_topics, self._saved)
            return {"topics": topics, "generation": self.cache_generation}

    def backup_owned(self) -> bool:
        return self._backup_owner is asyncio.current_task()

    @asynccontextmanager
    async def backup_transaction(self):
        """Fence radio writes until the complete pending pair has converged.

        On failure the fence deliberately remains. Every later writer/startup
        resolves the durable intent before accepting a new operation.
        """
        async with self._lock:
            if self.closed:
                raise ZigbeeScanError("not_ready")
            self._backup_owner = asyncio.current_task()
            self._backup_pending = True
            self._backup_ready.clear()
            try:
                yield
            finally:
                self._backup_owner = None

    async def async_backup_cache(self, config: dict[str, Any], snapshot: dict[str, Any]) -> None:
        """Converge exact cache bytes; a fail-after-write is not a failed write."""
        if self._backup_owner is not asyncio.current_task():
            raise RuntimeError("backup lifecycle lock required")
        topics = await self.hass.async_add_executor_job(validate_saved_topics, snapshot["topics"])
        generation = snapshot["generation"]
        if not isinstance(generation, str) or not re.fullmatch(r"[a-f0-9-]{32,64}", generation):
            raise ValueError("invalid cache generation")
        topics = topics if _enabled(config) else {}
        payload = {"schema": 1, "entry_id": self.entry.entry_id,
                   "topics": topics, "generation": generation}
        try:
            await self._store.async_save(payload)
        except Exception as err:  # noqa: BLE001 - compare exact durable truth
            if await self._store.async_load() != payload:
                raise ZigbeeScanError("storage_clear") from err
        self._saved = topics
        self.cache_generation = generation
        self._storage_error = None
        self._enabled = _enabled(config)

    def finish_backup_transaction(self) -> None:
        """Publish stale maps only AFTER config/layout/cache/files are durable."""
        if self._backup_owner is not asyncio.current_task():
            raise RuntimeError("backup lifecycle lock required")
        for job in self._jobs.values():
            self._release(job)
            if job.task is not None:
                job.task.cancel()
        self._jobs.clear()
        for topic, item in self._saved.items():
            now = monotonic()
            job = _Job(topic, f"restored-{uuid4()}", item["obtained_at"], now,
                       self.hass.loop.create_future(), phase="ready", finished=now,
                       stale=True, result={"data": {"value": item["map"]}},
                       obtained_at=item["obtained_at"], persistence="saved")
            job.info.cancel()
            self._jobs[topic] = job
        self.revision += 1
        self.release_backup_fence()
        for event in self.initial_events():
            self._emit(event)

    def release_backup_fence(self) -> None:
        """A rejected pre-intent candidate must not cancel an existing radio job."""
        if not self.backup_owned():
            raise RuntimeError("backup lifecycle lock required")
        self._backup_pending = False
        self._backup_ready.set()

    async def _persist(self, job: _Job) -> None:
        await self._backup_ready.wait()
        async with self._lock:
            if (self.closed or self._backup_pending or self._jobs.get(job.topic) is not job
                    or not self._enabled or job.result is None):
                return
            try:
                await self._save({**self._saved, job.topic: {
                    "obtained_at": job.obtained_at, "map": _raw_map(job.result),
                }})
                job.persistence = "saved"
            except ZigbeeScanError:
                job.persistence = "failed"
            if not self.closed:
                self._changed(job)

    def _active(self, job: _Job) -> bool:
        return not self.closed and self._jobs.get(job.topic) is job and job.phase == "loading"

    def _state(self, job: _Job) -> dict[str, Any]:
        provider: dict[str, Any] = {
            "topic": job.topic, "job_id": job.job_id, "phase": job.phase,
            "stage": job.stage, "started_at": job.started_at,
            "elapsed_ms": max(0, int(((job.finished if job.finished is not None else monotonic()) - job.started) * 1000)),
            "cancel_after_ms": CANCEL_AFTER_MS,
        }
        if job.error is not None:
            provider["error"] = job.error
        if job.persistence is not None:
            provider["persistence"] = job.persistence
        if job.result is not None:
            provider["result"] = job.result
            provider["obtained_at"] = job.obtained_at
            provider["stale"] = job.stale
        return {"kind": "state", "session_id": self.session_id,
                "revision": self.revision, "provider": provider}

    def snapshot(self, topic: str) -> dict[str, Any]:
        """Current public state; no MQTT work, no timestamp reset."""
        if self.closed:
            raise ZigbeeScanError("not_ready")
        job = self._jobs.get(normalize_base_topic(topic))
        if job is None:
            raise ZigbeeScanError("invalid_data")
        return self._state(job)

    def initial_events(self) -> list[dict[str, Any]]:
        """Bound each event to one map; never aggregate eight maps into one frame."""
        return [{"kind": "reset", "session_id": self.session_id,
                 "revision": self.revision, "topics": list(self._jobs),
                 **({"error": self._storage_error} if self._storage_error else {})},
                *(self._state(job) for job in self._jobs.values())]

    def add_listener(self, listener: Callable[[dict[str, Any]], None]) -> Callable[[], None]:
        if self.closed:
            raise ZigbeeScanError("not_ready")
        if len(self._listeners) >= MAX_LISTENERS:
            raise ZigbeeScanError("capacity_exceeded")
        self._listeners.add(listener)
        return lambda: self._listeners.discard(listener)

    def _emit(self, event: dict[str, Any]) -> None:
        for listener in tuple(self._listeners):
            try:
                listener(event)
            except Exception:  # noqa: BLE001 - one disconnected UI must not interrupt a shared job
                self._listeners.discard(listener)

    def _changed(self, job: _Job) -> None:
        self.revision += 1
        self._emit(self._state(job))

    async def start(self, base_topic: str) -> dict[str, Any]:
        """Join or durably clear a topic before any replacement request is published."""
        async with self._lock:
            return await self._start(base_topic)

    async def _start(self, base_topic: str) -> dict[str, Any]:
        """Reserve before creating any task: concurrent WS clients join one job."""
        if self.closed:
            raise ZigbeeScanError("not_ready")
        if self._backup_pending:
            raise ZigbeeScanError("conflict")
        if not self._enabled:
            raise ZigbeeScanError("disabled")
        topic = normalize_base_topic(base_topic)
        previous = self._jobs.get(topic)
        if previous is not None and previous.phase == "loading":
            return self._state(previous)
        # A transport which acknowledges cancellation late still owns a bounded
        # slot until its cleanup returns; repeated failed starts cannot grow it.
        if len(self._operations) >= MAX_TOPICS:
            raise ZigbeeScanError("capacity_exceeded")
        if previous is None and len(self._jobs) >= MAX_TOPICS:
            candidate = next((item for item in self._jobs.values()
                              if item.phase != "loading" and item.result is None), None)
            if candidate is None:
                raise ZigbeeScanError("capacity_exceeded")
            del self._jobs[candidate.topic]
            self.revision += 1
            self._emit({"kind": "removed", "session_id": self.session_id,
                        "revision": self.revision, "topic": candidate.topic})
        await self._save({key: value for key, value in self._saved.items() if key != topic})
        job = _Job(topic, f"houseplan-{uuid4()}", int(time() * 1000), monotonic(),
                   self.hass.loop.create_future())
        self._jobs.pop(topic, None)
        self._jobs[topic] = job
        job.task = self.entry.async_create_background_task(
            self.hass, self._run(job), "House Plan Zigbee map", eager_start=False,
        )
        self._changed(job)
        return self._state(job)

    def cancel(self, base_topic: str, job_id: str) -> dict[str, Any]:
        if self.closed:
            raise ZigbeeScanError("not_ready")
        topic = normalize_base_topic(base_topic)
        job = self._jobs.get(topic)
        if job is None or job.job_id != job_id:
            raise ZigbeeScanError("conflict")
        # A repeated cancellation or a success/cancel race never rolls back a final state.
        if job.phase != "loading":
            return self._state(job)
        if (monotonic() - job.started) * 1000 < CANCEL_AFTER_MS:
            raise ZigbeeScanError("conflict")
        self._finish(job, "cancelled")
        return self._state(job)

    @staticmethod
    def _cleanup(cleanup: Callable[[], None]) -> None:
        try:
            cleanup()
        except Exception:  # noqa: BLE001 - cleanup remains idempotent across unload and transport failure
            _LOGGER.debug("House Plan Zigbee transport cleanup failed")

    def _add_cleanup(self, job: _Job, cleanup: Callable[[], None]) -> None:
        if self._active(job):
            job.cleanups.append(cleanup)
        else:
            self._cleanup(cleanup)

    def _release(self, job: _Job) -> None:
        job.response_active = False
        cleanups, job.cleanups = job.cleanups, []
        for cleanup in cleanups:
            self._cleanup(cleanup)
        if not job.info.done():
            job.info.cancel()

    def _finish(self, job: _Job, phase: str, error: str | None = None,
                result: dict[str, Any] | None = None) -> None:
        if not self._active(job):
            return
        job.phase, job.error, job.finished = phase, error, monotonic()
        if result is not None:
            job.result, job.obtained_at = result, int(time() * 1000)
            job.stale = False
            job.persistence = "pending"
            write = self.hass.async_create_task(self._persist(job), "House Plan persist Zigbee map")
            self._writes.add(write)
            write.add_done_callback(self._writes.discard)
        elif job.result is not None:
            job.stale = True
        self._release(job)
        # Including when called synchronously inside publish: a terminal provider
        # reply must not wait another ten seconds for the publish acknowledgement.
        if job.task is not None and not job.task.done():
            job.task.cancel()
        self._changed(job)

    async def _operation(self, job: _Job, action: Callable[[], Awaitable],
                         seconds: float, *, subscription: bool = False):
        """Bound transport even if a cancelled subscribe later returns an unsubscribe."""
        async def perform():
            result = await action()
            if subscription and callable(result):
                self._add_cleanup(job, result)
            return result

        task = self.entry.async_create_background_task(
            self.hass, perform(), "House Plan Zigbee transport", eager_start=False,
        )
        self._operations.add(task)

        @callback
        def settled(done: asyncio.Task) -> None:
            self._operations.discard(done)
            if not done.cancelled():
                done.exception()  # consume a late transport exception after the job ended

        task.add_done_callback(settled)
        try:
            done, _pending = await asyncio.wait({task}, timeout=max(0, seconds))
            if not done:
                raise TimeoutError
            return task.result()
        finally:
            if not task.done():
                task.cancel()

    async def _subscribe(self, job: _Job, topic: str, handler: Callable) -> None:
        deadline = self.hass.loop.time() + TRANSPORT_TIMEOUT
        await self._operation(job, lambda: mqtt.async_subscribe(
            self.hass, topic, handler, qos=0, encoding=None,
        ), TRANSPORT_TIMEOUT, subscription=True)
        # Optional on the declared HA floor (2024.6). This acknowledges HA's
        # processing of subscriptions, not provider acceptance or radio progress.
        processed = getattr(mqtt, "async_on_subscribe_done", None)
        if callable(processed) and self._active(job):
            ready = self.hass.loop.create_future()

            @callback
            def on_ready() -> None:
                if not ready.done():
                    ready.set_result(None)

            remove = processed(self.hass, topic, 0, on_ready)
            self._add_cleanup(job, remove)
            async with asyncio.timeout(max(0, deadline - self.hass.loop.time())):
                await ready

    async def _run(self, job: _Job) -> None:
        try:
            if not mqtt.mqtt_config_entry_enabled(self.hass):
                self._finish(job, "error", "unsupported")
                return
            if not mqtt.is_connected(self.hass):
                self._finish(job, "error", "connection")
                return

            @callback
            def connection_changed(connected: bool) -> None:
                if not connected:
                    self._finish(job, "error", "connection")

            self._add_cleanup(job, mqtt.async_subscribe_connection_status(
                self.hass, connection_changed,
            ))
            response_topic = f"{job.topic}/bridge/response/networkmap"
            info_topic = f"{job.topic}/bridge/info"

            @callback
            def receive_response(message) -> None:
                if (not self._active(job) or not job.response_active
                        or message.topic != response_topic or message.retain):
                    return
                value = _parse_payload(message.payload)
                if value is None:
                    return
                data = value.get("data")
                transaction = value.get("transaction", data.get("transaction") if isinstance(data, dict) else None)
                if transaction != job.job_id:
                    return
                if value.get("status") not in (None, "ok"):
                    self._finish(job, "error", "provider")
                elif not _valid_map(value):
                    self._finish(job, "error", "invalid_payload")
                else:
                    self._finish(job, "ready", result=value)

            @callback
            def receive_info(message) -> None:
                if (self._active(job) and message.topic == info_topic and message.retain
                        and not job.info.done() and _parse_payload(message.payload) is not None):
                    job.info.set_result(None)

            # Response first also improves the old-HA retained-info preflight;
            # retained info alone is not claimed to be a strict broker SUBACK.
            await self._subscribe(job, response_topic, receive_response)
            await self._subscribe(job, info_topic, receive_info)
            async with asyncio.timeout(INFO_TIMEOUT):
                await job.info
            if not self._active(job):
                return
            job.response_active = True
            await self._operation(job, lambda: mqtt.async_publish(
                self.hass, f"{job.topic}/bridge/request/networkmap",
                json.dumps({"type": "raw", "routes": True, "transaction": job.job_id}),
                qos=0, retain=False,
            ), TRANSPORT_TIMEOUT)
            if self._active(job):
                job.stage = "waiting"
                self._changed(job)
                # Only MQTT, explicit cancel, transport loss or entry teardown
                # ends this wait. 600 seconds is a cancel threshold, not a deadline.
                await self.hass.loop.create_future()
        except asyncio.CancelledError:
            if self._active(job):
                self._finish(job, "error", "connection")
            raise
        except TimeoutError:
            self._finish(job, "error", "timeout")
        except Exception:  # noqa: BLE001 - contain optional MQTT errors without logging network payloads
            self._finish(job, "error", "connection")
        finally:
            self._release(job)

    async def async_close(self) -> None:
        """Stop entry-owned work, clear volatile maps, never restart a radio scan."""
        if self.closed:
            return
        self.closed = True
        self._backup_ready.set()
        # Reload does not disconnect HA WebSockets. Tell their observers that
        # this session and its volatile cache are gone before dropping them.
        self.revision += 1
        self._emit({"kind": "closed", "session_id": self.session_id,
                    "revision": self.revision})
        tasks = [job.task for job in self._jobs.values() if job.task is not None]
        for job in self._jobs.values():
            self._release(job)
        for task in (*tasks, *self._operations):
            if not task.done():
                task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        if self._writes:
            await asyncio.gather(*self._writes, return_exceptions=True)
        self._jobs.clear()
        self._listeners.clear()
