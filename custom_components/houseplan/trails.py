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
import logging
import math
import time
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_state_change_event
from homeassistant.helpers.storage import Store

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

TRAIL_CAP = 2000          # raw points per run before decimation
TRAIL_RESUME_GRACE_S = 30 * 60  # same-map stop/pause belongs to one cleanup
SAVE_DELAY_S = 10         # debounce store writes — flash wear over precision
FIRE_THROTTLE_S = 2.0     # event-bus updates for live cards
MOVING_STATES = {"cleaning", "returning", "on"}


def can_resume_trail_run(run: Any, map_id: str, now: float) -> bool:
    """Whether an ended current run may be reopened for this point.

    Store timestamps are untrusted persisted data. Only finite JSON-number
    timestamps and a non-negative inclusive grace interval are accepted;
    malformed values and wall-clock rollback fail closed into a new run.
    """
    if not isinstance(run, dict) or run.get("map_id") != map_id:
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

    def on_point(self, marker: str, map_id: str, x: float, y: float, now: float) -> bool:
        rec = self.data.setdefault(marker, {})
        cur = rec.get("current")
        resumed = bool(cur and can_resume_trail_run(cur, map_id, now))
        if resumed:
            cur["ended"] = None
        if not cur or cur.get("ended") is not None or cur.get("map_id") != map_id:
            # a new run begins: the old one becomes "previous" (and the one
            # before it is forgotten — we keep exactly two, per the owner)
            if cur:
                rec["previous"] = cur
            cur = {"map_id": map_id, "started": now, "ended": None, "points": []}
            rec["current"] = cur
        pts: list[list[float]] = cur["points"]
        if pts and pts[-1][0] == x and pts[-1][1] == y:
            # Clearing ended is observable state even if the source repeats
            # the dock point: it must still reach Store and live cards.
            return resumed
        pts.append([x, y])
        if len(pts) > TRAIL_CAP:
            # decimate by two but never lose the freshest point
            half = pts[0::2]
            if half[-1] != pts[-1]:
                half.append(pts[-1])
            cur["points"] = half
        return True

    def end_run(self, marker: str, now: float) -> bool:
        cur = (self.data.get(marker) or {}).get("current")
        if cur and cur.get("ended") is None:
            cur["ended"] = now
            return True
        return False

    def delete(self, marker: str) -> bool:
        """Forget every stored run of one plan marker."""
        return self.data.pop(marker, None) is not None


class TrailRecorder:
    """HA wiring: watch the tracked entities, feed the book, persist, notify."""

    def __init__(self, hass: HomeAssistant, rt: Any) -> None:
        self.hass = hass
        self.rt = rt
        self.store = Store(hass, 1, f"{DOMAIN}.trails")
        self.book = TrailBook()
        # HP-1540-03: one source may feed SEVERAL markers — the same robot
        # placed on two floors is the documented multi-floor case, and a plain
        # source → (marker, vacuum) dict silently kept only the last one
        self.pairs: dict[str, list[tuple[str, str]]] = {}  # source → [(marker, vacuum), …]
        self._unsub_track = None
        self._unsub_save = None
        self._last_fire = 0.0
        # One active incident per saved marker/source. `reason` is mutable so
        # missing↔disabled changes do not create warning storms.
        self._source_health: dict[tuple[str, str], str] = {}
        # HP-1540-05: config/set fires refresh as a detached task; two of them
        # interleaving across the awaited load both subscribed and the loser's
        # unsub handle was overwritten — a leak until HA restart
        self._refresh_lock = asyncio.Lock()
        self._closed = False

    async def async_setup(self) -> None:
        self.book = TrailBook(await self.store.async_load() or {})
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
            pairs: dict[str, list[tuple[str, str]]] = {}
            health_pairs: set[tuple[str, str]] = set()
            for m in cfg.get("markers") or []:
                if m.get("removed") is True:
                    continue
                v = m.get("vacuum") or {}
                src = v.get("source")
                if not src or v.get("live") is False:
                    continue
                marker_id = str(m.get("id"))
                health_pairs.add((marker_id, str(src)))
                vac = self._vacuum_entity(m)
                if vac:
                    # HP-1540-03: append, never overwrite — every floor's
                    # marker records its own copy of the run
                    pairs.setdefault(src, []).append((marker_id, vac))
            self._refresh_source_health(health_pairs)
            self.pairs = pairs
            self._resubscribe()
            # A run already in progress (HA restarted mid-cleanup, or the user
            # just finished calibrating) must start recording NOW, not at the
            # next state change — otherwise the first seconds of the path are
            # lost.
            now = time.time()
            changed = False
            for src in self.pairs:
                changed |= self._sample(src, now)
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
        """
        live_marker_ids = {
            str(marker.get("id"))
            for marker in config.get("markers") or []
            if marker.get("id") is not None and marker.get("removed") is not True
        }
        orphan_ids = set(self.book.data) - live_marker_ids
        if not orphan_ids:
            return 0
        try:
            return await self._async_delete_many(orphan_ids)
        except Exception:  # noqa: BLE001 — config commit already succeeded
            _LOGGER.exception(
                "House Plan: removing orphan vacuum trails failed: markers=%s",
                sorted(orphan_ids),
            )
            return 0

    async def _async_delete_many(self, markers: set[str]) -> int:
        """Delete one or more books with one subscription/store transaction."""
        async with self._refresh_lock:
            # The trail book owns deletion. When it has no such marker, this
            # is a no-op and must not silently damage the live tracking graph.
            removed = {
                marker: self.book.data.pop(marker)
                for marker in markers
                if marker in self.book.data
            }
            if not removed:
                return 0
            previous_pairs = {src: list(pairs) for src, pairs in self.pairs.items()}
            had_pending_save = self._unsub_save is not None
            try:
                for src in list(self.pairs):
                    kept = [pair for pair in self.pairs[src] if pair[0] not in removed]
                    if kept:
                        self.pairs[src] = kept
                    else:
                        del self.pairs[src]
                self._resubscribe()
                if self._unsub_save:
                    self._unsub_save()
                    self._unsub_save = None
                await self.store.async_save(self.book.data)
            except Exception:
                # The store is the durable authority. Restore the in-memory
                # owner graph so the next successful config sync can retry
                # instead of leaving an orphan on disk forever (#335).
                self.book.data.update(removed)
                self.pairs = previous_pairs
                self._resubscribe()
                if had_pending_save:
                    self._schedule_save()
                raise
        self.hass.bus.async_fire("houseplan_trail_updated", {})
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

    def teardown(self) -> None:
        # HP-1540-05: flag FIRST — a refresh parked on its awaited load must
        # not re-subscribe after this cleanup has already run
        self._closed = True
        if self._unsub_track:
            self._unsub_track()
            self._unsub_track = None
        if self._unsub_save:
            self._unsub_save()
            self._unsub_save = None

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
                continue
            if st_vac.state not in MOVING_STATES:
                changed |= self.book.end_run(marker, now)
                continue
            st_src = self.hass.states.get(src)
            attrs = st_src.attributes if st_src else {}
            raw = attrs.get("vacuum_position") or attrs.get("robot_position")
            # Server-side these attributes are often OBJECTS (Tasshack keeps a
            # Point dataclass in memory — it only becomes a dict when
            # serialised to the frontend). Caught live on the owner's X50: the
            # recorder saw every state change and rejected every single one.
            if isinstance(raw, dict):
                px, py = raw.get("x"), raw.get("y")
            else:
                px, py = getattr(raw, "x", None), getattr(raw, "y", None)
            try:
                x, y = float(px), float(py)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                continue
            map_id = resolve_map_id(attrs, st_vac.attributes)
            changed |= self.book.on_point(marker, map_id, x, y, now)
        return changed

    @callback
    def _on_state(self, event: Any) -> None:
        eid = event.data.get("entity_id")
        now = time.time()
        changed = False
        for src, pair_list in self.pairs.items():
            if eid == src or any(eid == vac for _, vac in pair_list):
                changed |= self._sample(src, now)
        self._handle_sample_change(changed, now)

    def _handle_sample_change(self, changed: bool, now: float) -> None:
        """Persist and announce one logical sampling pass when it changed."""
        if changed:
            self._schedule_save()
            if now - self._last_fire >= FIRE_THROTTLE_S:
                self._last_fire = now
                self.hass.bus.async_fire("houseplan_trail_updated", {})

    def _schedule_save(self) -> None:
        if self._unsub_save:
            return

        async def _save(_now: Any) -> None:
            self._unsub_save = None
            await self.store.async_save(self.book.data)

        self._unsub_save = async_call_later(self.hass, SAVE_DELAY_S, _save)
