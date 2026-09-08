"""Authoritative presence-radar coordinator (#485).

The coordinator is deliberately the only component which interprets radar
entities.  Browsers, recordings and room outputs consume the same normalized
frame so freshness and coordinate semantics cannot drift between features.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import math
import secrets
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import voluptuous as vol
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_state_report_event,
)

from .radar_geometry import (
    clipped_arc_segments,
    length_cm,
    point_in_polygon,
    polar_to_cartesian,
    polygon_is_convex,
    project_local,
)
from .radar_validation import radar_source_entity_ids, validate_radar_draft
from .store import HouseplanData

MAX_FRAME_HZ = 4
PAIR_MAX_AGE_S = 3.0
PAIR_MAX_SKEW_S = 1.5
_EXPLICIT_ABSENT = object()


def _fingerprint(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(payload.encode()).hexdigest()[:24]


def _reported_timestamp(state: Any) -> float:
    value = getattr(state, "last_reported", None) or getattr(state, "last_updated", None)
    if value is None:
        return 0.0
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.timestamp()


def _numeric_state(state: Any) -> float | None:
    if state is None or str(state.state).strip().lower() in {"", "unknown", "unavailable"}:
        return None
    try:
        value = float(state.state)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def _binary_state(state: Any) -> bool | None:
    if state is None:
        return None
    value = str(state.state).lower()
    if value == "on":
        return True
    if value == "off":
        return False
    return None


class RadarCoordinator:
    """One bounded state-report listener graph for the whole integration."""

    def __init__(self, hass: HomeAssistant, runtime: HouseplanData) -> None:
        self.hass = hass
        self.runtime = runtime
        self.server_session_id = secrets.token_hex(12)
        self.closed = False
        self.config_rev = 0
        self.config: dict[str, Any] = {}
        self.radars: dict[str, dict[str, Any]] = {}
        self._seq: dict[str, int] = {}
        self._frames: dict[str, dict[str, Any]] = {}
        self._last_signature: dict[str, str] = {}
        self._listeners: set[Callable[[str, dict[str, Any]], None]] = set()
        self._internal_listeners: set[Callable[[str, dict[str, Any]], None]] = set()
        self._external_cleanups: set[Callable[[], None]] = set()
        self._unsub_sources: list[Callable[[], None]] = []
        self._unsub_config: Callable[[], None] | None = None
        self._unsub_tick: Callable[[], None] | None = None
        self._pending: asyncio.TimerHandle | None = None
        self._last_publish_monotonic = 0.0
        self._immediate_source_ids: set[str] = set()
        self._last_acl_epoch = -1
        self._lock = asyncio.Lock()

    async def async_setup(self) -> None:
        await self.async_refresh()

        @callback
        def config_updated(_event: Event) -> None:
            self.hass.async_create_task(self.async_refresh())

        self._unsub_config = self.hass.bus.async_listen(
            "houseplan_config_updated", config_updated
        )

    async def async_refresh(self) -> None:
        async with self._lock:
            if self.closed:
                return
            stored = await self.runtime.config_store.async_load() or {}
            config = stored.get("config") or {}
            self.config = config
            self.config_rev = int(stored.get("rev", 0))
            self.radars = {}
            for marker in config.get("markers") or []:
                if not isinstance(marker, dict) or not isinstance(marker.get("radar"), dict) \
                        or marker["radar"].get("version") != 1 \
                        or marker["radar"].get("enabled") is not True \
                        or marker.get("removed") is True:
                    continue
                marker_id = str(marker.get("id"))
                try:
                    validate_radar_draft(config, marker_id, marker["radar"])
                except vol.Invalid:
                    # Change-aware config compatibility may retain an old or
                    # future-invalid block. It stays lossless but never runs.
                    continue
                self.radars[marker_id] = marker
            self._resubscribe_sources()
            self._publish_all(force=True)

    def teardown(self) -> None:
        self.closed = True
        if self._pending:
            self._pending.cancel()
            self._pending = None
        if self._unsub_tick:
            self._unsub_tick()
            self._unsub_tick = None
        if self._unsub_config:
            self._unsub_config()
            self._unsub_config = None
        for unsub in self._unsub_sources:
            unsub()
        self._unsub_sources.clear()
        # Setup subscriptions own draft-specific HA listeners which are not
        # part of the saved source graph.  Closing the config entry must tear
        # those down too, even if the browser WebSocket stays connected.
        for cleanup in tuple(self._external_cleanups):
            cleanup()
        self._external_cleanups.clear()
        self._listeners.clear()
        self._internal_listeners.clear()
        self._frames.clear()

    @callback
    def add_external_cleanup(self, cleanup: Callable[[], None]) -> Callable[[], None]:
        """Own a setup listener for the lifetime of this coordinator."""
        self._external_cleanups.add(cleanup)

        @callback
        def unregister() -> None:
            self._external_cleanups.discard(cleanup)

        return unregister

    def _resubscribe_sources(self) -> None:
        for unsub in self._unsub_sources:
            unsub()
        self._unsub_sources.clear()
        entity_ids = sorted({
            entity_id
            for marker in self.radars.values()
            for entity_id in radar_source_entity_ids(marker.get("radar"))
        })
        if not entity_ids:
            self._immediate_source_ids.clear()
            return
        immediate: set[str] = set()
        for marker in self.radars.values():
            sources = marker.get("radar", {}).get("sources") or {}
            immediate.update(
                value for key in ("occupancy_entity", "count_entity", "availability_entity")
                if isinstance((value := sources.get(key)), str)
            )
            for group in ("slots", "ranges"):
                immediate.update(
                    item["presence_entity"]
                    for item in sources.get(group) or []
                    if isinstance(item, dict) and isinstance(item.get("presence_entity"), str)
                )
            immediate.update(
                item["entity_id"] for item in sources.get("zones") or []
                if isinstance(item, dict) and isinstance(item.get("entity_id"), str)
            )
        self._immediate_source_ids = immediate

        @callback
        def source_reported(event: Event) -> None:
            entity_id = str(event.data.get("entity_id") or "")
            state = event.data.get("new_state")
            immediate_transition = entity_id in self._immediate_source_ids \
                or state is None or str(getattr(state, "state", "")).lower() \
                in {"", "unknown", "unavailable"}
            self._schedule_publish(immediate=immediate_transition)

        # state_reported catches repeated coordinate values. state_changed is
        # retained for HA versions/integrations which do not emit a report event
        # for every change; one 250 ms coalescer deduplicates the overlap and
        # enforces the public four-frames-per-second ceiling.
        self._unsub_sources.append(async_track_state_report_event(
            self.hass, entity_ids, source_reported
        ))
        self._unsub_sources.append(async_track_state_change_event(
            self.hass, entity_ids, source_reported
        ))

    @callback
    def _schedule_publish(self, *, immediate: bool = False) -> None:
        if self.closed:
            return
        if self._pending is not None:
            if not immediate:
                return
            # Availability and occupancy edges must not wait behind an already
            # queued coordinate batch.  Replacing that handle remains bounded:
            # the two HA event streams still collapse into this one callback.
            self._pending.cancel()
            self._pending = None
        elapsed = self.hass.loop.time() - self._last_publish_monotonic
        delay = 0 if immediate else max(0.1, 1 / MAX_FRAME_HZ - elapsed)
        self._pending = self.hass.loop.call_later(delay, self._flush_pending)

    @callback
    def _flush_pending(self) -> None:
        self._pending = None
        self._last_publish_monotonic = self.hass.loop.time()
        self._publish_all()

    def _ensure_tick(self) -> None:
        if self._unsub_tick or not (self._listeners or self._internal_listeners):
            return

        @callback
        def tick(_now: datetime) -> None:
            self._unsub_tick = None
            self._publish_all()
            self._ensure_tick()

        self._unsub_tick = async_call_later(self.hass, 1.0, tick)

    def add_listener(
        self,
        listener: Callable[[str, dict[str, Any]], None],
        *,
        publish_initial: bool = True,
    ) -> Callable[[], None]:
        self._listeners.add(listener)
        self._ensure_tick()
        if publish_initial:
            for marker_id, frame in self._frames.items():
                listener(marker_id, self.public_frame(frame))

        @callback
        def remove() -> None:
            self._listeners.discard(listener)
            self._stop_tick_if_idle()
        return remove

    def add_internal_listener(self, listener: Callable[[str, dict[str, Any]], None]) -> Callable[[], None]:
        self._internal_listeners.add(listener)
        self._ensure_tick()

        @callback
        def remove() -> None:
            self._internal_listeners.discard(listener)
            self._stop_tick_if_idle()
        return remove

    def _stop_tick_if_idle(self) -> None:
        if not (self._listeners or self._internal_listeners) and self._unsub_tick:
            self._unsub_tick()
            self._unsub_tick = None

    def space_for_marker(self, marker_id: str) -> str | None:
        marker = self.radars.get(marker_id)
        return str(marker.get("space")) if marker and marker.get("space") else None

    def has_space(self, space_id: str) -> bool:
        return any(str(space.get("id")) == space_id for space in self.config.get("spaces") or [])

    def marker_config(self, marker_id: str) -> dict[str, Any] | None:
        return next(
            (marker for marker in self.config.get("markers") or []
             if isinstance(marker, dict) and str(marker.get("id")) == marker_id),
            None,
        )

    def source_ids(self, marker_id: str) -> set[str]:
        marker = self.radars.get(marker_id)
        return radar_source_entity_ids(marker.get("radar")) if marker else set()

    def frame(self, marker_id: str) -> dict[str, Any] | None:
        return self._frames.get(marker_id)

    def frames_for_space(self, space_id: str) -> list[dict[str, Any]]:
        return [frame for marker_id, frame in self._frames.items()
                if self.space_for_marker(marker_id) == space_id][:32]

    def _publish_all(self, force: bool = False) -> None:
        now = datetime.now(UTC).timestamp()
        acl_epoch = int(now // 60)
        force = force or acl_epoch != self._last_acl_epoch
        self._last_acl_epoch = acl_epoch
        live_ids = set(self.radars)
        for stale_id in set(self._frames) - live_ids:
            self._frames.pop(stale_id, None)
            self._last_signature.pop(stale_id, None)
            clear = self._base_frame(stale_id, now, "disabled")
            self._deliver(stale_id, clear)
        for marker_id, marker in self.radars.items():
            frame = self._build_frame(marker_id, marker, now)
            self._annotate_smoothing(marker_id, marker, frame)
            signature = _fingerprint({key: value for key, value in frame.items()
                                      if key not in {"seq", "reported_at", "expires_at"}})
            if not force and signature == self._last_signature.get(marker_id):
                continue
            self._last_signature[marker_id] = signature
            self._frames[marker_id] = frame
            self._deliver(marker_id, frame)

    def _annotate_smoothing(
        self, marker_id: str, marker: dict[str, Any], frame: dict[str, Any],
    ) -> None:
        """Permit a cosmetic transition only where it cannot invent travel."""
        previous = self._frames.get(marker_id)
        if not previous or previous.get("health") not in {"ok", "stale"} \
                or frame.get("health") not in {"ok", "stale"} \
                or previous.get("source_generation") != frame.get("source_generation") \
                or previous.get("calibration_revision") != frame.get("calibration_revision") \
                or previous.get("_filter_revision") != frame.get("_filter_revision"):
            return
        room_exists, room_poly = self._room_polygon(marker, marker["radar"])
        if not room_exists or room_poly is not None and not polygon_is_convex(room_poly):
            return
        cell_cm = self._space_cell_cm(marker)
        if cell_cm is None:
            return
        old_targets = {
            target.get("slot"): target for target in previous.get("targets") or []
            if target.get("included") is True
        }
        for target in frame.get("targets") or []:
            old = old_targets.get(target.get("slot"))
            if not old or target.get("included") is not True \
                    or float(target.get("reported_at", 0)) <= float(old.get("reported_at", 0)) \
                    or float(target.get("reported_at", 0)) > float(old.get("expires_at", 0)):
                continue
            distance_cm = math.hypot(
                float(target["x"]) - float(old["x"]),
                float(target["y"]) - float(old["y"]),
            ) * 240 * cell_cm
            if distance_cm <= 100:
                target["smooth"] = True

    def _deliver(self, marker_id: str, frame: dict[str, Any]) -> None:
        for listener in tuple(self._internal_listeners):
            listener(marker_id, frame)
        public = self.public_frame(frame)
        for listener in tuple(self._listeners):
            listener(marker_id, public)

    def _base_frame(self, marker_id: str, now: float, health: str) -> dict[str, Any]:
        self._seq[marker_id] = self._seq.get(marker_id, 0) + 1
        return {
            "server_session_id": self.server_session_id,
            "marker_id": marker_id,
            "source_generation": "",
            "calibration_revision": "",
            "seq": self._seq[marker_id],
            "reported_at": now,
            "expires_at": now,
            "health": health,
            "reported_presence": None,
            "complete": False,
            "targets": [], "ranges": [], "zones": [],
        }

    def _build_frame(self, marker_id: str, marker: dict[str, Any], now: float) -> dict[str, Any]:
        radar = marker["radar"]
        frame = self._base_frame(marker_id, now, "ok")
        source_material = {
            "installation_id": radar.get("mount", {}).get("installation_id"),
            "mount": {key: radar.get("mount", {}).get(key) for key in ("x", "y")},
            "profile": radar.get("profile"), "sources": radar.get("sources"),
            "space": marker.get("space"),
        }
        calibration_material = {
            "heading_deg": radar.get("mount", {}).get("heading_deg"),
            "calibration": radar.get("calibration"),
        }
        frame["source_generation"] = _fingerprint(source_material)
        frame["calibration_revision"] = _fingerprint(calibration_material)
        profile = radar.get("profile")
        room_exists, room_poly = self._room_polygon(marker, radar)
        frame["_filter_revision"] = _fingerprint({
            "room_id": radar.get("room_id"), "polygon": room_poly,
        })
        if not room_exists:
            frame["health"] = "needs_setup"
            return frame
        current_cell_cm = self._space_cell_cm(marker)
        projects_geometry = profile in {
            "esphome_ld2450_v1", "cartesian_v1", "polar_v1", "range_v1",
        }
        if projects_geometry and (current_cell_cm is None or not math.isclose(
            float(radar.get("calibration", {}).get("cell_cm", -1)), current_cell_cm,
            rel_tol=0, abs_tol=1e-9,
        )):
            frame["health"] = "needs_setup"
            return frame
        sources = radar.get("sources") or {}
        availability = _binary_state(self.hass.states.get(sources.get("availability_entity"))) \
            if sources.get("availability_entity") else True
        occupancy = _binary_state(self.hass.states.get(sources.get("occupancy_entity"))) \
            if sources.get("occupancy_entity") else None
        frame["reported_presence"] = occupancy
        if availability is not True:
            frame["health"] = "unavailable" if availability is None else "off"
            return frame
        if occupancy is False:
            frame["complete"] = True
            frame["expires_at"] = now + 60
            frame["health"] = "off"
            return frame

        any_stale = False
        explicit_slots = 0
        for slot in sources.get("slots") or []:
            try:
                local = self._slot_local(profile, slot, now)
            except (TypeError, ValueError):
                local = None
            if local is _EXPLICIT_ABSENT:
                explicit_slots += 1
                continue
            if local is None:
                gate = _binary_state(self.hass.states.get(slot.get("presence_entity"))) \
                    if slot.get("presence_entity") else None
                if gate is False:
                    explicit_slots += 1
                else:
                    any_stale = True
                continue
            x_cm, y_cm, t1, t2, quality = local
            gate = _binary_state(self.hass.states.get(slot.get("presence_entity"))) \
                if slot.get("presence_entity") else True
            if gate is not True:
                if gate is False:
                    explicit_slots += 1
                else:
                    any_stale = True
                continue
            try:
                point = project_local(radar["mount"], radar["calibration"], x_cm, y_cm)
            except (TypeError, ValueError):
                any_stale = True
                continue
            tolerance = 0.1 / (240 * current_cell_cm) if current_cell_cm else 1e-6
            included = room_poly is None or point_in_polygon(point, room_poly, tolerance)
            frame["targets"].append({
                "slot": str(slot.get("id")), "x": point[0], "y": point[1],
                "reported_at": max(t1, t2), "expires_at": min(t1, t2) + PAIR_MAX_AGE_S,
                "pair_quality": quality, "included": included,
                "reason": None if included else "outside_room",
                # Private values are removed by public_frame and consumed only
                # by the bounded local recording/analysis services.
                "_local_x_cm": x_cm, "_local_y_cm": y_cm,
                "_component_times": [t1, t2],
            })
            explicit_slots += 1

        for source in sources.get("ranges") or []:
            state = self.hass.states.get(source.get("entity_id"))
            value = _numeric_state(state)
            reported = _reported_timestamp(state)
            gate = _binary_state(self.hass.states.get(source.get("presence_entity"))) \
                if source.get("presence_entity") else True
            if value is None or now - reported > PAIR_MAX_AGE_S or gate is not True:
                any_stale = any_stale or gate is not False
                continue
            try:
                radius_cm = length_cm(value, source.get("unit"))
            except (TypeError, ValueError):
                any_stale = True
                continue
            radius = radius_cm / (240 * radar["calibration"]["cell_cm"])
            segments = clipped_arc_segments(
                (radar["mount"]["x"], radar["mount"]["y"]), radius,
                radar["mount"].get("heading_deg", 0), radar["mount"].get("fov_deg"),
                room_poly,
            )
            frame["ranges"].append({
                "id": str(source.get("id")), "x": radar["mount"]["x"],
                "y": radar["mount"]["y"], "radius": radius,
                "heading_deg": radar["mount"].get("heading_deg", 0),
                "fov_deg": radar["mount"].get("fov_deg"),
                "segments": segments,
                "reported_at": reported, "expires_at": reported + PAIR_MAX_AGE_S,
            })

        for source in sources.get("zones") or []:
            state = self.hass.states.get(source.get("entity_id"))
            value = _binary_state(state) if source.get("kind") == "occupancy" else _numeric_state(state)
            frame["zones"].append({"id": str(source.get("id")), "state": value})

        if profile == "presence_v1":
            frame["complete"] = occupancy is not None
            frame["health"] = "ok" if occupancy is not None else "unknown"
            frame["expires_at"] = None
            return frame
        if profile == "zones_v1":
            frame["complete"] = all(zone["state"] is not None for zone in frame["zones"])
            frame["health"] = "ok" if frame["complete"] else "unknown"
            frame["expires_at"] = None
            return frame
        if profile == "range_v1":
            frame["complete"] = bool(frame["ranges"]) and not any_stale
        else:
            frame["complete"] = explicit_slots == len(sources.get("slots") or []) and not any_stale
        if occupancy is True and not frame["targets"] and not frame["ranges"]:
            frame["health"] = "position_unavailable"
        elif any_stale:
            frame["health"] = "stale"
        expires = [item["expires_at"] for item in [*frame["targets"], *frame["ranges"]]]
        frame["expires_at"] = min(expires) if expires else now
        count = _numeric_state(self.hass.states.get(sources.get("count_entity"))) \
            if sources.get("count_entity") else None
        count_state = self.hass.states.get(sources.get("count_entity")) \
            if sources.get("count_entity") else None
        count_reported = _reported_timestamp(count_state)
        count_fresh = count is not None and now - count_reported <= PAIR_MAX_AGE_S
        if count_fresh and count == 0:
            if frame["targets"]:
                frame["health"] = "inconsistent"
                frame["complete"] = False
            elif not frame["ranges"]:
                frame["health"] = "off"
                frame["complete"] = True
                frame["expires_at"] = count_reported + PAIR_MAX_AGE_S
        return frame

    def _slot_local(self, profile: str, slot: dict[str, Any], now: float):
        if profile == "polar_v1":
            first = self.hass.states.get(slot.get("distance_entity"))
            second = self.hass.states.get(slot.get("angle_entity"))
            a, b = _numeric_state(first), _numeric_state(second)
            t1, t2 = _reported_timestamp(first), _reported_timestamp(second)
            if a is None or b is None or now - min(t1, t2) > PAIR_MAX_AGE_S or abs(t1 - t2) > PAIR_MAX_SKEW_S:
                return None
            x, y = polar_to_cartesian(a, b, unit=slot["unit"],
                                      angle_unit=slot["angle_unit"],
                                      zero=slot["angle_zero"],
                                      clockwise=slot["angle_clockwise"])
            return x, y, t1, t2, "bounded_latest"
        first = self.hass.states.get(slot.get("x_entity"))
        second = self.hass.states.get(slot.get("y_entity"))
        a, b = _numeric_state(first), _numeric_state(second)
        t1, t2 = _reported_timestamp(first), _reported_timestamp(second)
        if a is None or b is None or now - min(t1, t2) > PAIR_MAX_AGE_S or abs(t1 - t2) > PAIR_MAX_SKEW_S:
            return None
        unit = "mm" if profile == "esphome_ld2450_v1" else slot["unit"]
        # The reference ESPHome LD2450 connection reports both axes as zero
        # for an unused slot. A single zero remains a legal coordinate; only
        # the verified pair is negative evidence. Generic profiles keep (0,0)
        # legal because they have no adapter-specific absence contract.
        if profile == "esphome_ld2450_v1" and a == 0 and b == 0:
            return _EXPLICIT_ABSENT
        x, y = length_cm(a, unit), length_cm(b, unit)
        if slot.get("swap_xy"):
            x, y = y, x
        return x * slot.get("x_sign", 1), y * slot.get("y_sign", 1), t1, t2, "bounded_latest"

    def _room_polygon(
        self, marker: dict[str, Any], radar: dict[str, Any],
    ) -> tuple[bool, list[Any] | None]:
        space_id = str(marker.get("space") or "")
        room_id = str(radar.get("room_id") or "")
        for space in self.config.get("spaces") or []:
            if str(space.get("id")) != space_id:
                continue
            for room in space.get("rooms") or []:
                if str(room.get("id")) == room_id:
                    poly = room.get("poly")
                    return True, poly if isinstance(poly, list) and len(poly) >= 3 else None
        return False, None

    def _space_cell_cm(self, marker: dict[str, Any]) -> float | None:
        space_id = str(marker.get("space") or "")
        for space in self.config.get("spaces") or []:
            if str(space.get("id")) != space_id:
                continue
            value = space.get("cell_cm", 5)
            try:
                result = float(value)
            except (TypeError, ValueError):
                return None
            return result if math.isfinite(result) and result > 0 else None
        return None

    @staticmethod
    def public_frame(frame: dict[str, Any]) -> dict[str, Any]:
        """Projection safe for View: no raw coordinates, ids or private times."""
        public: dict[str, Any] = {}
        for key, value in frame.items():
            if key.startswith("_"):
                continue
            if key not in {"targets", "ranges", "zones"}:
                public[key] = value
                continue
            items = value
            if key == "targets":
                items = [entry for entry in value if entry.get("included")]
            public[key] = [
                {item_key: item_value for item_key, item_value in item.items()
                 if not item_key.startswith("_")}
                for item in items
            ]
        return public

    def inspect(self, marker_id: str) -> dict[str, Any]:
        marker = self.radars.get(marker_id)
        if marker is None:
            return {"marker_id": marker_id, "health": "not_configured", "config_rev": self.config_rev}
        frame = self._frames.get(marker_id) or self._build_frame(
            marker_id, marker, datetime.now(UTC).timestamp()
        )
        radar = marker["radar"]
        return {
            "marker_id": marker_id, "config_rev": self.config_rev,
            "profile": radar.get("profile"),
            "capabilities": self._capabilities(radar),
            "frame": self.public_frame(frame),
            "sources": [
                {"entity_id": entity_id,
                 "state": str(self.hass.states.get(entity_id).state)
                    if self.hass.states.get(entity_id) else None,
                 "reported_at": _reported_timestamp(self.hass.states.get(entity_id))}
                for entity_id in sorted(radar_source_entity_ids(radar))
            ],
        }

    def inspect_draft(self, marker: dict[str, Any], radar: dict[str, Any]) -> dict[str, Any]:
        """Return one permission-gated setup snapshot for an unsaved draft."""
        marker_id = str(marker.get("id"))
        candidate = {**marker, "radar": radar}
        frame = self._build_frame(marker_id, candidate, datetime.now(UTC).timestamp())
        result = {
            "marker_id": marker_id,
            "config_rev": self.config_rev,
            "profile": radar.get("profile"),
            "capabilities": self._capabilities(radar),
            "frame": self.public_frame(frame),
            "local_targets": [
                {
                    "slot": target.get("slot"),
                    "x_cm": target.get("_local_x_cm"),
                    "y_cm": target.get("_local_y_cm"),
                    "reported_at": target.get("reported_at"),
                    "pair_quality": target.get("pair_quality"),
                }
                for target in frame.get("targets") or []
            ],
            "sources": [
                {"entity_id": entity_id,
                 "state": str(self.hass.states.get(entity_id).state)
                    if self.hass.states.get(entity_id) else None,
                 "reported_at": _reported_timestamp(self.hass.states.get(entity_id))}
                for entity_id in sorted(radar_source_entity_ids(radar))
            ],
        }
        return result

    @staticmethod
    def _capabilities(radar: dict[str, Any]) -> list[str]:
        profile = radar.get("profile")
        out = []
        if profile in {"esphome_ld2450_v1", "cartesian_v1", "polar_v1"}:
            out.append("coordinates")
        if profile == "range_v1":
            out.append("range")
        if profile == "zones_v1":
            out.append("zone_state")
        if (radar.get("sources") or {}).get("occupancy_entity"):
            out.append("reported_presence")
        if ((radar.get("zones") or {}).get("hardware") or {}).get("adapter") == "esphome_ld2450_numbers_v1":
            out.append("hardware_zones")
        return out
