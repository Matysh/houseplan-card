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
import time
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_state_change_event
from homeassistant.helpers.storage import Store

from .const import DOMAIN

import logging
_LOGGER = logging.getLogger(__name__)

TRAIL_CAP = 2000          # raw points per run before decimation
SAVE_DELAY_S = 10         # debounce store writes — flash wear over precision
FIRE_THROTTLE_S = 2.0     # event-bus updates for live cards
MOVING_STATES = {"cleaning", "returning", "on"}


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
        if not cur or cur.get("ended") or cur.get("map_id") != map_id:
            # a new run begins: the old one becomes "previous" (and the one
            # before it is forgotten — we keep exactly two, per the owner)
            if cur:
                rec["previous"] = cur
            cur = {"map_id": map_id, "started": now, "ended": None, "points": []}
            rec["current"] = cur
        pts: list[list[float]] = cur["points"]
        if pts and pts[-1][0] == x and pts[-1][1] == y:
            return False
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
        if cur and not cur.get("ended"):
            cur["ended"] = now
            return True
        return False


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
            for m in cfg.get("markers") or []:
                v = m.get("vacuum") or {}
                src = v.get("source")
                if not src or v.get("live") is False:
                    continue
                vac = self._vacuum_entity(m)
                if vac:
                    # HP-1540-03: append, never overwrite — every floor's
                    # marker records its own copy of the run
                    pairs.setdefault(src, []).append((str(m.get("id")), vac))
            self.pairs = pairs
            if self._unsub_track:
                self._unsub_track()
                self._unsub_track = None
            # deduplicated: two markers of one robot share source AND vacuum
            ents = set(self.pairs) | {vac for ps in self.pairs.values() for _, vac in ps}
            _LOGGER.info("Trail recorder: tracking %s", sorted(ents))
            if ents:
                self._unsub_track = async_track_state_change_event(
                    self.hass, sorted(ents), self._on_state
                )
            # A run already in progress (HA restarted mid-cleanup, or the user
            # just finished calibrating) must start recording NOW, not at the
            # next state change — otherwise the first seconds of the path are
            # lost.
            for src in self.pairs:
                self._sample(src, time.time())

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
