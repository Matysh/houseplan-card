"""Server-side vacuum trails.

The integration records the robot's path ITSELF by watching the source
entity's state changes — no card involvement. This removes every client-side
race (N open tabs would fight over writes), survives page reloads by
construction, and keeps recording while no card is open at all. Stored: the
current run and one previous run per marker (owner call 2026-07-31 — users
want to see where the cleanup has already been).
"""
from __future__ import annotations

import time
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_call_later, async_track_state_change_event
from homeassistant.helpers.storage import Store

from .const import DOMAIN

TRAIL_CAP = 2000          # raw points per run before decimation
SAVE_DELAY_S = 10         # debounce store writes — flash wear over precision
FIRE_THROTTLE_S = 2.0     # event-bus updates for live cards
MOVING_STATES = {"cleaning", "returning", "on"}


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
        self.pairs: dict[str, tuple[str, str]] = {}  # source → (marker, vacuum)
        self._unsub_track = None
        self._unsub_save = None
        self._last_fire = 0.0

    async def async_setup(self) -> None:
        self.book = TrailBook(await self.store.async_load() or {})
        await self.async_refresh()

    async def async_refresh(self) -> None:
        """(Re)subscribe after any config change — markers may come and go."""
        if self._unsub_track:
            self._unsub_track()
            self._unsub_track = None
        stored = await self.rt.config_store.async_load() or {}
        cfg = stored.get("config") or {}
        self.pairs = {}
        for m in cfg.get("markers") or []:
            v = m.get("vacuum") or {}
            src = v.get("source")
            if not src or v.get("live") is False:
                continue
            vac = self._vacuum_entity(m)
            if vac:
                self.pairs[src] = (str(m.get("id")), vac)
        ents = set(self.pairs) | {vac for _, vac in self.pairs.values()}
        if ents:
            self._unsub_track = async_track_state_change_event(
                self.hass, sorted(ents), self._on_state
            )
        # A run already in progress (HA restarted mid-cleanup, or the user just
        # finished calibrating) must start recording NOW, not at the next
        # state change — otherwise the first seconds of the path are lost.
        for src in self.pairs:
            self._sample(src, time.time())

    def teardown(self) -> None:
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
        """Record one point (or end the run) for a single source entity."""
        pair = self.pairs.get(src)
        if not pair:
            return False
        marker, vac = pair
        st_vac = self.hass.states.get(vac)
        if not st_vac or st_vac.state not in MOVING_STATES:
            return self.book.end_run(marker, now)
        st_src = self.hass.states.get(src)
        attrs = st_src.attributes if st_src else {}
        pos = attrs.get("vacuum_position") or attrs.get("robot_position")
        if not isinstance(pos, dict):
            return False
        try:
            x, y = float(pos["x"]), float(pos["y"])
        except (KeyError, TypeError, ValueError):
            return False
        map_id = str(
            attrs.get("map_name")
            or attrs.get("current_map")
            or attrs.get("map_index")
            or st_vac.attributes.get("selected_map")
            or "default"
        )
        return self.book.on_point(marker, map_id, x, y, now)

    @callback
    def _on_state(self, event: Any) -> None:
        eid = event.data.get("entity_id")
        now = time.time()
        changed = False
        for src, (_marker, vac) in self.pairs.items():
            if eid in (src, vac):
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
