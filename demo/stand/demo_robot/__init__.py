"""Scripted robot vacuum for the public demo stand.

The real feature (docs/VACUUM.md) targets Tier-A map integrations — Xiaomi
Cloud Map Extractor, Tasshack dreame-vacuum, Valetudo. None of them can run
on the stand (no hardware), so the stand ships this simulator instead: a
`vacuum` entity with start/pause/return_to_base and a `sensor` whose
attributes follow the Tasshack shape (`vacuum_position` as a dict, `rooms`
with names matching the plan rooms, `map_index`). Room names match the demo
house on purpose — that is what makes «Настроить автоматически» demonstrable.

Coordinates are millimetres in 0..8000 with the Y axis flipped versus the
screen (like every real robot map seen so far) so the mirror toggle in the
fit panel has meaning on the stand too.
"""
from __future__ import annotations

import math
from datetime import timedelta
from typing import Any, Callable

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import discovery
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.typing import ConfigType

DOMAIN = "demo_robot"
TICK_S = 2          # telemetry cadence
SPEED_MM = 600      # per tick ≈ 0.3 m/s, a realistic robot pace
DOCK = (6100.0, 3600.0)  # inside Under-Stairs Closet

# Robot-map rooms, mm, Y up (flipped vs screen). Bboxes mirror the plan's
# room polygons; the names MUST equal the plan room names — auto-calibration
# matches by name.
ROOMS: dict[str, tuple[str, float, float, float, float]] = {
    "1": ("Kitchen & Living", 900, 3067, 6300, 6367),
    "2": ("Hallway", 3200, 1033, 4533, 3800),
    "3": ("Guest Bedroom", 4533, 1033, 6300, 3067),
    "4": ("Under-Stairs Closet", 5300, 3067, 6933, 4467),
}
# cleaning order: start at the dock in the hallway, end next to it
CLEAN_ORDER = ("4", "2", "3", "1")
INSET = 350.0       # keep lanes away from walls
LANE_MM = 650.0     # serpentine lane spacing


def _serpentine(x0: float, y0: float, x1: float, y1: float) -> list[tuple[float, float]]:
    """Boustrophedon lanes across a room bbox, like a real vacuum drives."""
    x0, y0, x1, y1 = x0 + INSET, y0 + INSET, x1 - INSET, y1 - INSET
    pts: list[tuple[float, float]] = []
    y = y0
    left_to_right = True
    while y <= y1 + 1:
        xs = (x0, x1) if left_to_right else (x1, x0)
        pts.append((xs[0], y))
        pts.append((xs[1], y))
        left_to_right = not left_to_right
        y += LANE_MM
    return pts


def build_route() -> list[tuple[float, float]]:
    route: list[tuple[float, float]] = [DOCK]
    for rid in CLEAN_ORDER:
        _, x0, y0, x1, y1 = ROOMS[rid]
        route.extend(_serpentine(x0, y0, x1, y1))
    route.append(DOCK)
    return route


class RobotSim:
    """One shared simulation both entities read from."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.route = build_route()
        self.state = "docked"        # docked|cleaning|paused|returning
        self.pos: tuple[float, float] = DOCK
        self.heading = 0.0
        self._seg = 0                # index of the segment being driven
        self._seg_done = 0.0         # mm driven inside the current segment
        self._back: list[tuple[float, float]] | None = None  # manual return path
        self._listeners: list[Callable[[], None]] = []

    # ---- entity plumbing ----
    def add_listener(self, cb: Callable[[], None]) -> Callable[[], None]:
        self._listeners.append(cb)

        def _remove() -> None:
            if cb in self._listeners:
                self._listeners.remove(cb)
        return _remove

    def _notify(self) -> None:
        for cb in list(self._listeners):
            cb()

    # ---- commands (called by the vacuum entity) ----
    def start(self) -> None:
        if self.state == "paused":
            self.state = "returning" if self._back else "cleaning"
        else:
            self.state = "cleaning"
            self._seg = 0
            self._seg_done = 0.0
            self._back = None
            self.pos = DOCK
        self._notify()

    def pause(self) -> None:
        if self.state in ("cleaning", "returning"):
            self.state = "paused"
            self._notify()

    def stop(self) -> None:
        self.pause()

    def return_to_base(self) -> None:
        if self.state == "docked":
            return
        # retrace the visited waypoints backwards — a straight line to the
        # dock would cut through walls
        visited = self.route[: self._seg + 1]
        self._back = [self.pos] + list(reversed(visited))
        self._seg = 0
        self._seg_done = 0.0
        self.state = "returning"
        self._notify()

    # ---- physics ----
    def _polyline(self) -> list[tuple[float, float]]:
        return self._back if self._back is not None else self.route

    def tick(self, _now: Any = None) -> None:
        if self.state not in ("cleaning", "returning"):
            return
        line = self._polyline()
        # manual return drives twice as fast, like the real thing hurrying home
        budget = SPEED_MM * (2 if self._back is not None else 1)
        while budget > 0 and self._seg < len(line) - 1:
            ax, ay = line[self._seg]
            bx, by = line[self._seg + 1]
            seg_len = math.hypot(bx - ax, by - ay)
            left = seg_len - self._seg_done
            if left <= budget:
                budget -= left
                self._seg += 1
                self._seg_done = 0.0
                continue
            self._seg_done += budget
            t = self._seg_done / seg_len
            self.pos = (ax + (bx - ax) * t, ay + (by - ay) * t)
            self.heading = math.degrees(math.atan2(by - ay, bx - ax)) % 360
            budget = 0
        if self._seg >= len(line) - 1:
            # arrived: either the route is finished or the manual return is
            self.pos = line[-1]
            self.state = "docked"
            self._back = None
        elif self._back is None and self._seg >= len(line) - 2:
            # the last route leg is the drive home
            self.state = "returning"
        self._notify()


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    sim = RobotSim(hass)
    hass.data[DOMAIN] = sim

    @callback
    def _tick(now: Any) -> None:
        sim.tick(now)

    async_track_time_interval(hass, _tick, timedelta(seconds=TICK_S))
    hass.async_create_task(
        discovery.async_load_platform(hass, "vacuum", DOMAIN, {}, config)
    )
    hass.async_create_task(
        discovery.async_load_platform(hass, "sensor", DOMAIN, {}, config)
    )
    return True
