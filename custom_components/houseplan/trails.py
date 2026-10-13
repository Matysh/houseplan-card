"""Server-side vacuum trails.

The integration records the robot's path ITSELF by watching the source
entity's state changes — no card involvement. This removes every client-side
race (N open tabs would fight over writes), survives page reloads by
construction, and keeps recording while no card is open at all. Stored: the
current run and one previous run per marker (owner call 2026-07-31 — users
want to see where the cleanup has already been).
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import time
import uuid
from collections.abc import Callable
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_state_change_event
from homeassistant.helpers.storage import Store

from .const import DOMAIN
from .vacuum_path_collector import PathCollector, PathContext
from .vacuum_paths import (
    MAX_ENTRY_BYTES,
    MAX_JSON_BYTES,
    MAX_POINTS,
    MAX_SEGMENTS,
    PathRejected,
    PathSnapshot,
    normalize_paths,
    number,
)
from .vacuum_routes import effective_routes

_LOGGER = logging.getLogger(__name__)

TRAIL_CAP = MAX_POINTS    # stop honestly at the budget; never decimate history
TRAIL_RESUME_GRACE_S = 30 * 60  # same-map stop/pause belongs to one cleanup
SAVE_DELAY_S = 10         # debounce store writes — flash wear over precision
FIRE_THROTTLE_S = 2.0     # event-bus updates for live cards
MOVING_STATES = {"cleaning", "returning", "on"}


def same_run_identity(run: Any, route_id: str, map_id: str) -> bool:
    """Whether a stored run and a fresh point belong to the same cleanup.

    Route identity wins when both sides have one: two maps of one robot may
    share a map id only across different sources, and a route change (new
    source, map or target space) is a new run by definition (#162). A run
    written before #162 carries no route id, so it is still matched by map id
    and keeps resuming exactly as it used to.
    """
    if not isinstance(run, dict):
        return False
    stored_route = run.get("route_id")
    if route_id and isinstance(stored_route, str) and stored_route:
        return stored_route == route_id
    return run.get("map_id") == map_id


def can_resume_trail_run(run: Any, map_id: str, now: float, route_id: str = "") -> bool:
    """Whether an ended current run may be reopened for this point.

    Store timestamps are untrusted persisted data. Only finite JSON-number
    timestamps and a non-negative inclusive grace interval are accepted;
    malformed values and wall-clock rollback fail closed into a new run.
    """
    if not same_run_identity(run, route_id, map_id):
        return False
    ended = run.get("ended")
    if (
        isinstance(ended, bool)
        or not isinstance(ended, (int, float))
        or isinstance(now, bool)
        or not isinstance(now, (int, float))
    ):
        return False
    elapsed = now - ended
    return math.isfinite(elapsed) and 0 <= elapsed <= TRAIL_RESUME_GRACE_S


def resolve_map_id(src_attrs: Any, vac_attrs: Any) -> str:
    """Map-id normalisation contract, shared with the frontend.

    Mirrors src/vacuum.ts vacMapIdFromAttrs (source attrs, `??`-chain) plus the
    card's _vacMapId fallback to the vacuum entity's selected_map. The FIRST
    value that is not None wins — truthiness is wrong here: a zero-based
    `map_index: 0` is a valid first map and an empty string is still an id.
    The old `or`-chain dropped the zero, so the server stored trails under a
    key the renderer never looked up (HP-1540-02).
    """
    for v in (
        src_attrs.get("map_name"),
        src_attrs.get("current_map"),
        src_attrs.get("map_index"),
        src_attrs.get("selected_map"),
        vac_attrs.get("selected_map"),
    ):
        if v is not None:
            return str(v)
    return "default"


class TrailBook:
    """Pure run bookkeeping: {marker: {current: run, previous: run}}.

    A run is {"map_id", "started", "ended", "points": [[x, y], …]} in RAW
    robot coordinates — recalibration never invalidates a stored trail.
    """

    def __init__(self, data: dict[str, Any] | None = None) -> None:
        self.data: dict[str, Any] = data if isinstance(data, dict) else {}
        # Retain the actual list alongside its count: recycled object ids must
        # not reuse another run's quota. Prune on rotation/delete, never by a
        # per-point traversal of all geometry.
        self._counts: dict[int, tuple[list[Any], int]] = {}
        self._opaque_sizes: dict[int, int] = {}
        for marker, record in list(self.data.items()):
            if not isinstance(record, dict):
                self.data.pop(marker)
                continue
            for slot in ("current", "previous"):
                run = record.get(slot)
                if not isinstance(run, dict):
                    record.pop(slot, None)
                    continue
                if isinstance(run.get("path_format"), bool) or run.get("path_format", 1) not in (1, 2):
                    # Constructor runs on the executor. Future values are
                    # preserved, but their REAL bytes still consume quota.
                    self._opaque_sizes[id(run)] = len(json.dumps(run, separators=(",", ":")).encode())
                    continue  # preserve unknown future values, do not write them
                try:
                    paths = normalize_paths(run.get("paths") if run.get("path_format") == 2
                                            else run.get("points", []))
                    if run.get("path_format") == 2:
                        run["paths"] = paths
                        quality = run.get("quality")
                        if not isinstance(quality, dict):
                            quality = {"source": "positions", "reason": "sampled"}
                            run["quality"] = quality
                        if quality.get("source") not in ("positions", "native"):
                            quality.update(source="positions", reason="sampled")
                        if quality.get("source") == "positions":
                            run["_position_paths"] = paths
                        else:
                            run["_position_paths"] = normalize_paths(run.get("_position_paths", []))
                        run["points"] = paths[-1] if paths else []
                    else:
                        run["points"] = paths[-1] if paths else []
                    if slot == "current" and paths and run.get("ended") is None:
                        # A restart is an unobserved period even when the run
                        # continues. Preserve history, never bridge its gap.
                        run["_gap_pending"] = True
                except PathRejected:
                    record.pop(slot)  # isolate only the malformed run

    def _count(self, paths: list[Any]) -> int:
        cached = self._counts.get(id(paths))
        if cached is None or cached[0] is not paths:
            cached = (paths, sum(len(p) for p in paths if isinstance(p, list)))
            self._counts[id(paths)] = cached
        return cached[1]

    def _prune_counts(self) -> None:
        alive = set()
        runs = set()
        for record in self.data.values():
            if not isinstance(record, dict):
                continue
            for slot in ("current", "previous"):
                run = record.get(slot)
                if isinstance(run, dict):
                    runs.add(id(run))
                    for key in ("paths", "_position_paths"):
                        if isinstance(run.get(key), list):
                            alive.add(id(run[key]))
        self._counts = {key: value for key, value in self._counts.items() if key in alive}
        self._opaque_sizes = {key: value for key, value in self._opaque_sizes.items() if key in runs}

    def _entry_bytes(self, replaced: dict[str, Any] | None = None,
                     replacement_count: int = 0) -> int:
        # Upper bound of serialized doubles plus list punctuation. Account for
        # the one-fragment legacy projection and private positional reserve;
        # aliases in memory still serialize twice in the version-1 Store.
        total = 0
        for record in self.data.values():
            if not isinstance(record, dict):
                continue
            for slot in ("current", "previous"):
                run = record.get(slot)
                if not isinstance(run, dict):
                    continue
                if id(run) in self._opaque_sizes:
                    total += self._opaque_sizes[id(run)]
                    continue
                if run is replaced:
                    total += replacement_count * 2 * 54 + 4096
                    continue
                count = sum(self._count(run[k]) for k in ("paths", "_position_paths")
                            if isinstance(run.get(k), list))
                count += len(run.get("points", [])) if isinstance(run.get("points"), list) else 0
                total += count * 54 + 4096
        return total

    def ensure_run(self, marker: str, map_id: str, now: float,
                   route_id: str = "", source: str = "", job_id: str | None = None) -> tuple[dict[str, Any], bool]:
        """Position and full-path providers share the same lifecycle authority."""
        rec = self.data.get(marker)
        if not isinstance(rec, dict):
            rec = {}
            self.data[marker] = rec
        cur = rec.get("current")
        if not isinstance(cur, dict):
            cur = None
        if isinstance(cur, dict) and (isinstance(cur.get("path_format"), bool)
                                     or cur.get("path_format", 1) not in (1, 2)):
            # Reading unknown future history may not destructively migrate it.
            return cur, False
        same_job = bool(job_id and cur and cur.get("_job_id") == job_id)
        changed_job = bool(job_id and cur and cur.get("_job_id") not in (None, job_id))
        resumed = bool(cur and not changed_job and same_run_identity(cur, route_id, map_id)
                       and (same_job or can_resume_trail_run(cur, map_id, now, route_id)))
        if resumed and cur is not None:
            cur["ended"] = None
            cur["_gap_pending"] = True
        if not cur or changed_job or (cur.get("ended") is not None and not resumed) \
                or not same_run_identity(cur, route_id, map_id):
            if cur:
                rec["previous"] = cur
            cur = {"map_id": map_id, "started": now, "ended": None, "points": [],
                   "path_format": 2, "paths": [], "quality": {"source": "positions", "reason": "sampled"},
                   "_generation": uuid.uuid4().hex}
            if route_id:
                cur["route_id"] = route_id
            if source:
                cur["source"] = source
            rec["current"] = cur
            self._prune_counts()
        assert isinstance(cur, dict)
        if cur.get("path_format") != 2:
            cur.update(path_format=2, paths=[cur.get("points", [])],
                       quality={"source": "positions", "reason": "sampled"},
                       _generation=uuid.uuid4().hex)
        if not isinstance(cur.get("_generation"), str) or not cur["_generation"]:
            cur["_generation"] = uuid.uuid4().hex
            cur.pop("_native_identity", None)
        if job_id:
            cur["_job_id"] = job_id
        return cur, resumed

    def on_point(
        self, marker: str, map_id: str, x: float, y: float, now: float,
        route_id: str = "", source: str = "",
        gap: bool = False, physical_cm: tuple[float, float] | None = None,
    ) -> bool:
        if any(number(value) is None for value in (x, y, now)):
            self.mark_gap(marker)
            return False
        cur, resumed = self.ensure_run(marker, map_id, now, route_id, source)
        if isinstance(cur.get("path_format"), bool) or cur.get("path_format", 1) not in (1, 2):
            return False
        # Legacy values keep their exact points; additions opt into the new
        # format without claiming the lost historical samples were recovered.
        if cur.get("path_format") != 2:
            cur.update(path_format=2, paths=[cur.get("points", [])],
                       quality={"source": "positions", "reason": "sampled"},
                       _generation=uuid.uuid4().hex)
        positions = cur.setdefault("_position_paths", cur["paths"] if cur["quality"]["source"] == "positions" else [])
        last_sample = cur.get("_last_sample")
        if isinstance(last_sample, list) and len(last_sample) == 3 and physical_cm is not None:
            dt = now - last_sample[2]
            gap |= not math.isfinite(dt) or dt <= 0 or math.hypot(
                physical_cm[0] - last_sample[0], physical_cm[1] - last_sample[1],
            ) > max(100, 200 * dt)
        if physical_cm is not None:
            cur["_last_sample"] = [*physical_cm, now]
        gap |= bool(cur.pop("_gap_pending", False))
        if gap and positions and positions[-1]:
            if len(positions) >= MAX_SEGMENTS:
                cur["quality"]["reason"] = "limited"
                return True
            positions.append([])
        if not positions:
            positions.append([] if cur["quality"]["source"] == "native" else cur["points"])
        pts: list[list[float]] = positions[-1]
        if cur["quality"]["source"] == "positions":
            cur["points"] = pts  # downgrade sees ONE contiguous fragment only
        if pts and pts[-1][0] == x and pts[-1][1] == y:
            # Clearing ended is observable state even if the source repeats
            # the dock point: it must still reach Store and live cards.
            return resumed
        count = self._count(positions)
        # Conservative runtime allowance includes Python point/list overhead;
        # payload budget is also bounded (each finite double <= 25 JSON bytes).
        native_count = self._count(cur["paths"]) if cur["quality"]["source"] == "native" else 0
        if count + native_count >= TRAIL_CAP or (count + native_count + 1) * 54 > MAX_JSON_BYTES \
                or self._entry_bytes() + 3 * 54 > MAX_ENTRY_BYTES:
            changed = cur["quality"].get("reason") != "limited"
            cur["quality"]["reason"] = "limited"
            return changed or resumed
        pts.append([x, y])
        self._counts[id(positions)] = (positions, count + 1)
        if cur["quality"]["source"] == "positions":
            cur["paths"] = positions
            cur["quality"]["raw_points"] = count + 1
            cur["received_at"] = now
        return True

    def mark_gap(self, marker: str) -> None:
        cur = (self.data.get(marker) or {}).get("current")
        if isinstance(cur, dict) and not isinstance(cur.get("path_format"), bool) and cur.get("path_format", 1) in (1, 2):
            cur["_gap_pending"] = True

    def on_snapshot(self, marker: str, snap: PathSnapshot, now: float,
                    route_id: str, map_id: str, generation: str, proven: bool) -> bool:
        """Replace a whole, proven snapshot; never append one or resurrect a run."""
        cur = (self.data.get(marker) or {}).get("current")
        if not isinstance(cur, dict) or cur.get("path_format") != 2 \
                or cur.get("_generation") != generation \
                or not same_run_identity(cur, route_id, map_id) or not snap.paths:
            return False
        identity = (snap.provider, snap.map_key)
        prior = cur.get("_native_identity")
        if not proven and prior != list(identity):
            return self.path_reason(marker, "run_unverified")
        if prior is not None and prior != list(identity):
            return self.path_reason(marker, "coordinates_unverified")
        previous_revision = cur.get("_native_revision")
        if snap.revision is not None and isinstance(previous_revision, int) \
                and snap.revision < previous_revision:
            return False
        if cur.get("_native_digest") == snap.digest:
            changed = cur["quality"].get("reason") != "ok" \
                or cur.get("_native_revision") != snap.revision \
                or (snap.final and cur.get("final_status") != "confirmed")
            if changed:
                cur["quality"]["reason"] = "ok"
                cur["received_at"] = now
                cur["_native_revision"] = snap.revision
                if snap.final:
                    cur["final_status"] = "confirmed"
            return changed
        native_count = sum(len(p) for p in snap.paths)
        if native_count > MAX_POINTS or len(snap.paths) > MAX_SEGMENTS \
                or self._entry_bytes(cur, native_count) > MAX_ENTRY_BYTES:
            return self.path_reason(marker, "limited")
        self._counts[id(snap.paths)] = (snap.paths, native_count)
        # A proven full snapshot supersedes the sampled reserve; do not keep
        # a second unbounded copy of a now-complete run. The legacy projection
        # remains one contiguous native fragment, never flattened gaps.
        cur.update(_position_paths=[], points=snap.paths[-1])
        cur.update(paths=snap.paths, quality={"source": "native", "reason": "ok", "raw_points": native_count},
                   provenance={"provider": snap.provider, "schema": snap.schema},
                   received_at=now, _native_identity=list(identity), _native_digest=snap.digest,
                   _native_revision=snap.revision, final_status="confirmed" if snap.final else "unconfirmed")
        cur["revision"] = snap.digest  # opaque geometry cache key, not vendor identity
        self._prune_counts()
        return True

    def path_reason(self, marker: str, reason: str) -> bool:
        cur = (self.data.get(marker) or {}).get("current")
        if not isinstance(cur, dict) or isinstance(cur.get("path_format"), bool) or cur.get("path_format", 1) not in (1, 2):
            return False
        quality = cur.setdefault("quality", {"source": "positions"})
        if quality.get("reason") == reason:
            return False
        quality["reason"] = reason
        return True

    def end_run(self, marker: str, now: float) -> bool:
        cur = (self.data.get(marker) or {}).get("current")
        if isinstance(cur, dict) and not isinstance(cur.get("path_format"), bool) and cur.get("path_format", 1) in (1, 2) and cur.get("ended") is None:
            cur["ended"] = now
            return True
        return False

    def delete(self, marker: str) -> bool:
        """Forget every stored run of one plan marker."""
        changed = self.data.pop(marker, None) is not None
        self._prune_counts()
        return changed

    def drop_unknown_routes(self, marker: str, route_ids: set[str]) -> bool:
        """Forget runs whose route no longer exists (deleted or re-targeted).

        Only runs that name a route are touched. A pre-#162 run names none and
        is adopted by the card instead — deleting it here would destroy history
        the user can still legitimately see.
        """
        rec = self.data.get(marker)
        if not isinstance(rec, dict):
            return False
        changed = False
        for slot in ("current", "previous"):
            run = rec.get(slot)
            if not isinstance(run, dict):
                continue
            stored = run.get("route_id")
            if isinstance(stored, str) and stored and stored not in route_ids:
                rec.pop(slot)
                changed = True
        self._prune_counts()
        return changed


class TrailRecorder:
    """HA wiring: watch the tracked entities, feed the book, persist, notify."""

    def __init__(self, hass: HomeAssistant, rt: Any) -> None:
        self.routes_by_marker: dict[str, list[dict[str, Any]]] = {}
        self.hass = hass
        self.rt = rt
        self.store: Store[dict[str, Any]] = Store(hass, 1, f"{DOMAIN}.trails")
        self.book = TrailBook()
        # HP-1540-03: one source may feed SEVERAL markers — the same robot
        # placed on two floors is the documented multi-floor case, and a plain
        # source → (marker, vacuum) dict silently kept only the last one
        self.pairs: dict[str, list[tuple[str, str]]] = {}  # source → [(marker, vacuum), …]
        self._unsub_track: Callable[[], None] | None = None
        self._unsub_save: Callable[[], None] | None = None
        self._last_fire = 0.0
        # One active incident per saved marker/source. `reason` is mutable so
        # missing↔disabled changes do not create warning storms.
        self._source_health: dict[tuple[str, str], str] = {}
        # HP-1540-05: config/set fires refresh as a detached task; two of them
        # interleaving across the awaited load both subscribed and the loser's
        # unsub handle was overwritten — a leak until HA restart
        self._refresh_lock = asyncio.Lock()
        self._closed = False
        self._unsub_fire: Callable[[], None] | None = None
        self._spaces: dict[str, dict[str, Any]] = {}
        self.collector = PathCollector(hass, self._accept_path, self._path_reason)

    async def async_setup(self) -> None:
        stored = await self.store.async_load() or {}
        self.book = await self.hass.async_add_executor_job(TrailBook, stored)
        await self.async_refresh()

    async def async_refresh(self) -> None:
        """(Re)subscribe after any config change — markers may come and go.

        Serialised (HP-1540-05): the lock makes unsubscribe-then-resubscribe
        atomic across the awaited config load, so overlapping refresh tasks can
        no longer both subscribe and strand one callback forever. The _closed
        check covers teardown() racing a refresh that is parked on its await.
        """
        async with self._refresh_lock:
            stored = await self.rt.config_store.async_load() or {}
            if self._closed:
                return
            cfg = stored.get("config") or {}
            self._spaces = {str(s.get("id")): s for s in cfg.get("spaces") or [] if isinstance(s, dict)}
            pairs: dict[str, list[tuple[str, str]]] = {}
            health_pairs: set[tuple[str, str]] = set()
            routes_by_marker: dict[str, list[dict[str, Any]]] = {}
            for m in cfg.get("markers") or []:
                if m.get("removed") is True:
                    continue
                v = m.get("vacuum") or {}
                src = v.get("source")
                if v.get("live") is False:
                    continue
                marker_id = str(m.get("id"))
                # #162: a multi-floor robot may publish each map through its own
                # camera, so every route source is watched — not only the root
                # discovery source, which is now just one of them.
                routes = effective_routes(marker_id, v, str(m.get("space") or ""), src)
                routes_by_marker[marker_id] = routes
                sources = {str(route["source"]) for route in routes if route.get("source")}
                if src:
                    sources.add(str(src))
                if not sources:
                    continue
                vac = self._vacuum_entity(m)
                for source in sorted(sources):
                    health_pairs.add((marker_id, source))
                    if vac:
                        # HP-1540-03: append, never overwrite — every floor's
                        # marker records its own copy of the run
                        pairs.setdefault(source, []).append((marker_id, vac))
            self._refresh_source_health(health_pairs)
            self.pairs = pairs
            self.routes_by_marker = routes_by_marker
            self._resubscribe()
            # A run already in progress (HA restarted mid-cleanup, or the user
            # just finished calibrating) must start recording NOW, not at the
            # next state change — otherwise the first seconds of the path are
            # lost.
            now = time.time()
            changed = False
            for src in self.pairs:
                changed |= self._sample(src, now)
            contexts = self._path_contexts()
            self.collector.refresh(contexts)
            for context in contexts:
                state = self.hass.states.get(context.source)
                if state and "path" in state.attributes:
                    self.collector.observe(context, event=False, attribute_path=state.attributes["path"])
            self._handle_sample_change(changed, now)

    def _source_failure_reason(self, source: str) -> str | None:
        """Classify only refresh-time health evidence.

        A registry row or exact live state proves existence. No registry access
        is neutral: it can neither create a loss incident nor recover one.
        """
        registry = er.async_get(self.hass)
        state = self.hass.states.get(source)
        if registry is None or not hasattr(registry, "async_get"):
            return None if state is not None else "unverified"
        entry = registry.async_get(source)
        if entry is not None and getattr(entry, "disabled_by", None) is not None:
            return "disabled"
        # Registry-less YAML entities are valid: exact live state is stronger
        # evidence than a missing registry row.
        if entry is not None or state is not None:
            return None
        return "missing"

    def _refresh_source_health(self, expected: set[tuple[str, str]]) -> None:
        """Refresh deduplicated source incidents during config refresh/restart.

        `unavailable` and unsupported-but-existing states count as proven
        recovery. There is intentionally no registry subscription in Stage 1;
        the next config refresh or restart observes a later transition.
        """
        for key in list(self._source_health):
            if key not in expected:
                del self._source_health[key]
        for marker_id, source in sorted(expected):
            key = (marker_id, source)
            reason = self._source_failure_reason(source)
            previous = self._source_health.get(key)
            # Limited/unavailable registry evidence is neutral: keep an
            # existing incident as-is, and never create or recover one.
            if reason == "unverified":
                continue
            if reason is None:
                if previous is not None:
                    _LOGGER.info(
                        "Vacuum source recovered: marker=%s source=%s (was %s)",
                        marker_id, source, previous,
                    )
                    del self._source_health[key]
                continue
            if previous is None:
                _LOGGER.warning(
                    "Vacuum source %s: marker=%s source=%s",
                    reason, marker_id, source,
                )
            self._source_health[key] = reason

    async def async_delete(self, marker: str) -> bool:
        """Stop and erase one marker without racing subscription refresh/save."""
        return bool(await self._async_delete_many({marker}))

    async def async_purge_orphans(self, config: dict[str, Any]) -> int:
        """Erase trails whose marker is absent or a removal tombstone.

        A tombstone deliberately stays in config so discovery cannot resurrect
        a deleted device.  For live tracking and trail ownership it is absent:
        this is the same boundary used by ``async_refresh`` above.

        Returns the number of erased markers. Runs dropped because their route
        vanished (#162) are not counted, but they are just as durable (#495):
        they leave with the orphan transaction, or with a write of their own.
        """
        live_marker_ids = {
            str(marker.get("id"))
            for marker in config.get("markers") or []
            if marker.get("id") is not None and marker.get("removed") is not True
        }
        fire = False
        try:
            async with self._refresh_lock:
                # #162: a route that vanished (deleted, or re-targeted to
                # another space, which is a new identity) takes its own runs
                # with it, while the marker and its other routes stay untouched.
                dropped = self._drop_unknown_routes(config)
                orphan_ids = set(self.book.data) - live_marker_ids
                if not orphan_ids and not dropped:
                    return 0
                try:
                    if orphan_ids:
                        removed = await self._delete_many_locked(orphan_ids)
                    else:
                        removed = 0
                        await self._save_now_locked()
                except Exception:
                    # The store is the durable authority (#335): a drop that
                    # never reached it must not survive only in memory, or a
                    # restart brings the runs back while the card believed
                    # them gone. Put them back so the next commit retries.
                    self._restore_dropped(dropped)
                    raise
                fire = True
                return removed
        except Exception:  # noqa: BLE001 — config commit already succeeded
            _LOGGER.exception(
                "House Plan: reconciling vacuum trails after a config commit failed",
            )
            return 0
        finally:
            if fire:
                self.hass.bus.async_fire("houseplan_trail_updated", {})

    def _drop_unknown_routes(self, config: dict[str, Any]) -> dict[str, dict[str, Any]]:
        """Forget runs of routes the config no longer has; return what was dropped."""
        dropped: dict[str, dict[str, Any]] = {}
        for marker in config.get("markers") or []:
            marker_id = str(marker.get("id"))
            if marker.get("removed") is True or marker_id not in self.book.data:
                continue
            vacuum = marker.get("vacuum") or {}
            routes = effective_routes(
                marker_id, vacuum, str(marker.get("space") or ""), vacuum.get("source"))
            before = {
                slot: run for slot, run in (self.book.data.get(marker_id) or {}).items()
                if slot in ("current", "previous")
            }
            if self.book.drop_unknown_routes(marker_id, {str(r.get("id")) for r in routes}):
                after = self.book.data.get(marker_id) or {}
                dropped[marker_id] = {
                    slot: run for slot, run in before.items() if slot not in after
                }
        return dropped

    def _restore_dropped(self, dropped: dict[str, dict[str, Any]]) -> None:
        for marker_id, runs in dropped.items():
            self.book.data.setdefault(marker_id, {}).update(runs)

    async def _save_now_locked(self) -> None:
        """Write the book immediately, superseding a pending debounced write.

        A failed write puts the debounce back: the points it was going to
        persist are still only in memory.
        """
        had_pending_save = self._unsub_save is not None
        if self._unsub_save:
            self._unsub_save()
            self._unsub_save = None
        try:
            await self.store.async_save(self.book.data)
        except Exception:
            if had_pending_save:
                self._schedule_save()
            raise

    async def _async_delete_many(self, markers: set[str]) -> int:
        """Delete one or more books with one subscription/store transaction."""
        async with self._refresh_lock:
            removed = await self._delete_many_locked(markers)
        if removed:
            self.hass.bus.async_fire("houseplan_trail_updated", {})
        return removed

    async def _delete_many_locked(self, markers: set[str]) -> int:
        """The transaction of ``_async_delete_many``; the caller holds the lock."""
        # The trail book owns deletion. When it has no such marker, this
        # is a no-op and must not silently damage the live tracking graph.
        removed = {
            marker: self.book.data.pop(marker)
            for marker in markers
            if marker in self.book.data
        }
        if not removed:
            return 0
        self.book._prune_counts()
        previous_pairs = {src: list(pairs) for src, pairs in self.pairs.items()}
        try:
            for src in list(self.pairs):
                kept = [pair for pair in self.pairs[src] if pair[0] not in removed]
                if kept:
                    self.pairs[src] = kept
                else:
                    del self.pairs[src]
            self._resubscribe()
            self.collector.refresh(self._path_contexts())
            await self._save_now_locked()
        except Exception:
            # The store is the durable authority. Restore the in-memory
            # owner graph so the next successful config sync can retry
            # instead of leaving an orphan on disk forever (#335).
            self.book.data.update(removed)
            self.pairs = previous_pairs
            self._resubscribe()
            self.collector.refresh(self._path_contexts())
            raise
        return len(removed)

    def _resubscribe(self) -> None:
        """Replace the state subscription for the current pair graph."""
        if self._unsub_track:
            self._unsub_track()
            self._unsub_track = None
        # deduplicated: two markers of one robot share source AND vacuum
        ents = set(self.pairs) | {vac for ps in self.pairs.values() for _, vac in ps}
        _LOGGER.info("Trail recorder: tracking %s", sorted(ents))
        if ents and not self._closed:
            self._unsub_track = async_track_state_change_event(
                self.hass, sorted(ents), self._on_state
            )

    def _close_subscriptions(self) -> bool:
        """Stop callbacks/timers and report whether a save was pending."""
        # HP-1540-05: flag FIRST — a refresh parked on its awaited load must
        # not re-subscribe after this cleanup has already run.
        self._closed = True
        self.collector.close()
        if self._unsub_fire:
            self._unsub_fire()
            self._unsub_fire = None
        if self._unsub_track:
            self._unsub_track()
            self._unsub_track = None
        pending = self._unsub_save is not None
        if self._unsub_save:
            self._unsub_save()
            self._unsub_save = None
        return pending

    async def async_teardown(self) -> None:
        """Stop the recorder and durably flush a pending debounced save."""
        async with self._refresh_lock:
            pending = self._close_subscriptions()
            if pending:
                await self.store.async_save(self.book.data)

    def teardown(self) -> None:
        """Synchronous emergency cleanup for already-closing event loops."""
        self._close_subscriptions()

    def _vacuum_entity(self, m: dict[str, Any]) -> str | None:
        b = str(m.get("binding") or "")
        if b.startswith("entity:vacuum."):
            return b[len("entity:"):]
        if b.startswith("device:"):
            reg = er.async_get(self.hass)
            for e in er.async_entries_for_device(reg, b[len("device:"):]):
                if e.entity_id.startswith("vacuum."):
                    return e.entity_id
        return None

    def _sample(self, src: str, now: float) -> bool:
        """Record one point (or end the run) for EVERY marker fed by src.

        HP-1540-03: the same source serves one marker per floor — all of them
        must receive the point, not just whichever survived the dict.
        """
        changed = False
        for marker, vac in self.pairs.get(src) or ():
            st_vac = self.hass.states.get(vac)
            # "no state yet" is NOT "stopped": during HA boot the vacuum reads
            # unavailable and ending the run here would split one cleanup into
            # current+previous on every restart (observed live: 21 points
            # became previous, the same run restarted at 5)
            if not st_vac or st_vac.state in ("unavailable", "unknown"):
                self.book.mark_gap(marker)
                continue
            if st_vac.state not in MOVING_STATES:
                changed |= self.book.end_run(marker, now)
                continue
            st_src = self.hass.states.get(src)
            if self._source_failure_reason(src) is not None or not st_src \
                    or st_src.state in ("unknown", "unavailable"):
                self.book.mark_gap(marker)
                continue
            attrs = st_src.attributes if st_src else {}
            map_id = resolve_map_id(attrs, st_vac.attributes)
            route_id = self._route_id(marker, src, map_id)
            if route_id:
                before = (self.book.data.get(marker) or {}).get("current")
                cur, resumed = self.book.ensure_run(marker, map_id, now, route_id, src)
                changed |= before is not cur or resumed
            raw = attrs.get("vacuum_position") or attrs.get("robot_position")
            # Server-side these attributes are often OBJECTS (Tasshack keeps a
            # Point dataclass in memory — it only becomes a dict when
            # serialised to the frontend). Caught live on the owner's X50: the
            # recorder saw every state change and rejected every single one.
            if isinstance(raw, dict):
                px, py = raw.get("x"), raw.get("y")
            else:
                px, py = getattr(raw, "x", None), getattr(raw, "y", None)
            if isinstance(px, bool) or isinstance(py, bool):
                self.book.mark_gap(marker)
                continue
            try:
                x, y = float(px), float(py)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                self.book.mark_gap(marker)
                continue
            changed |= self.book.on_point(
                marker, map_id, x, y, now, route_id=route_id,
                source=src if route_id else "",
                physical_cm=self._physical_point(marker, route_id, x, y),
            )
        return changed

    def _physical_point(self, marker: str, route_id: str, x: float, y: float) -> tuple[float, float] | None:
        for route in self.routes_by_marker.get(marker, []):
            if route["id"] != route_id:
                continue
            matrix = route.get("calibration")
            cell_cm = number((self._spaces.get(route["space"]) or {}).get("cell_cm", 5))
            if not isinstance(matrix, list) or len(matrix) != 6 or cell_cm is None or cell_cm <= 0:
                return None
            if any(number(v) is None for v in matrix):
                return None
            if abs(matrix[0] * matrix[4] - matrix[1] * matrix[3]) < 1e-12:
                return None
            factor = cell_cm * 240 / 1000
            return ((matrix[0] * x + matrix[1] * y + matrix[2]) * factor,
                    (matrix[3] * x + matrix[4] * y + matrix[5]) * factor)
        return None

    def _path_contexts(self) -> list[PathContext]:
        contexts: list[PathContext] = []
        registry = er.async_get(self.hass)
        for src, pairs in self.pairs.items():
            st_src = self.hass.states.get(src)
            entry = registry.async_get(src) if registry is not None and hasattr(registry, "async_get") else None
            platform = getattr(entry, "platform", None)
            for vac in sorted({v for _, v in pairs}):
                st_vac = self.hass.states.get(vac)
                vac_entry = registry.async_get(vac) if registry is not None and hasattr(registry, "async_get") else None
                available = bool(st_src and st_src.state not in ("unknown", "unavailable")
                                 and st_vac and st_vac.state not in ("unknown", "unavailable")
                                 and self._source_failure_reason(src) is None
                                 and getattr(vac_entry, "disabled_by", None) is None)
                map_id = resolve_map_id(st_src.attributes if st_src else {}, st_vac.attributes if st_vac else {})
                markers = []
                routing = []
                for marker, vacuum in pairs:
                    run = (self.book.data.get(marker) or {}).get("current")
                    route = self._route_id(marker, src, map_id)
                    if vacuum == vac and route and isinstance(run, dict) and run.get("_generation") \
                            and same_run_identity(run, route, map_id):
                        markers.append((marker, route, run["_generation"]))
                        definition = next(r for r in self.routes_by_marker[marker] if r["id"] == route)
                        routing.append((marker, route, definition.get("space"), definition.get("calibration")))
                if markers:
                    contexts.append(PathContext(src, vac, map_id, tuple(sorted(markers)),
                                                bool(st_vac and st_vac.state in MOVING_STATES), available, platform,
                                                repr(routing)))
        return contexts

    def _accept_path(self, context: PathContext, snap: PathSnapshot, proven: bool) -> None:
        # Recheck live registry AND saved route/run after every await, including
        # an underlying executor read finishing after its ten-second timeout.
        if context not in self._path_contexts() or self._closed:
            return
        now = time.time()
        changed = False
        for marker, route, generation in context.markers:
            changed |= self.book.on_snapshot(marker, snap, now, route, context.map_id, generation, proven)
        self._handle_sample_change(changed, now)

    def _path_reason(self, context: PathContext, reason: str) -> None:
        if context not in self._path_contexts() or self._closed:
            return
        changed = False
        for marker, _route, _generation in context.markers:
            changed |= self.book.path_reason(marker, reason)
        self._handle_sample_change(changed, time.time())

    def _route_id(self, marker: str, source: str, map_id: str) -> str:
        """The route this point belongs to, or "" when routing cannot say.

        Validation keeps (source, map_id) unique inside one marker, so at most
        one route can match. No match means the map is unmapped: the point is
        still recorded — raw history is valuable — but it is not filed under a
        route that does not own it.
        """
        for route in getattr(self, "routes_by_marker", {}).get(marker) or ():
            if route.get("source") == source and route.get("map_id") == map_id:
                return str(route.get("id") or "")
        return ""

    @callback
    def _on_state(self, event: Any) -> None:
        eid = event.data.get("entity_id")
        now = time.time()
        changed = False
        for src, pair_list in self.pairs.items():
            if eid == src or any(eid == vac for _, vac in pair_list):
                changed |= self._sample(src, now)
        for context in self._path_contexts():
            if eid == context.source or eid == context.vacuum:
                state = self.hass.states.get(context.source)
                attrs = state.attributes if state else {}
                raw_path = attrs.get("path") if "path" in attrs else None
                self.collector.observe(context, attribute_path=raw_path)
        self._handle_sample_change(changed, now)

    def _handle_sample_change(self, changed: bool, now: float) -> None:
        """Persist and announce one logical sampling pass when it changed."""
        if changed:
            self._schedule_save()
            if now - self._last_fire >= FIRE_THROTTLE_S:
                if self._unsub_fire:
                    self._unsub_fire()
                    self._unsub_fire = None
                self._last_fire = now
                self.hass.bus.async_fire("houseplan_trail_updated", {})
            elif self._unsub_fire is None:
                @callback
                def publish(_now: Any) -> None:
                    self._unsub_fire = None
                    if not self._closed:
                        self._last_fire = time.time()
                        self.hass.bus.async_fire("houseplan_trail_updated", {})
                self._unsub_fire = async_call_later(self.hass, FIRE_THROTTLE_S - (now - self._last_fire), publish)

    def _schedule_save(self) -> None:
        if self._unsub_save:
            return

        async def _save(_now: Any) -> None:
            self._unsub_save = None
            await self.store.async_save(self.book.data)

        self._unsub_save = async_call_later(self.hass, SAVE_DELAY_S, _save)
