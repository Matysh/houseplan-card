"""Strict, change-aware validation for the optional #485 radar namespace.

Radar data is deliberately kept outside the plan geometry model.  Old plans
without this namespace remain byte-for-byte valid, while a client that creates
or changes a known version-1 block must satisfy the complete contract before
the config transaction can commit.
"""
from __future__ import annotations

import copy
import math
import re
from typing import Any

import voluptuous as vol

from .radar_geometry import solve_two_point

RADAR_PROFILES = frozenset({
    "esphome_ld2450_v1", "cartesian_v1", "polar_v1", "range_v1",
    "zones_v1", "presence_v1",
})
LENGTH_UNITS = frozenset({"mm", "cm", "m", "in", "ft"})
ANGLE_UNITS = frozenset({"degrees", "radians"})
ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
ENTITY_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")
MAX_RADARS = 32
CANVAS_LIMIT = 5000.0


class RadarValidationError(vol.Invalid):
    """Stable client-visible radar validation failure."""

    code = "invalid_radar"


def _invalid(message: str) -> None:
    raise RadarValidationError(message)


def _finite(value: Any, name: str, minimum: float | None = None,
            maximum: float | None = None) -> float:
    if isinstance(value, bool):
        _invalid(f"{name} must be finite")
    try:
        number = float(value)
    except (TypeError, ValueError):
        _invalid(f"{name} must be finite")
    if not math.isfinite(number):
        _invalid(f"{name} must be finite")
    if minimum is not None and number < minimum:
        _invalid(f"{name} is below its minimum")
    if maximum is not None and number > maximum:
        _invalid(f"{name} is above its maximum")
    return number


def _mapping(value: Any, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        _invalid(f"{name} must be an object")
    return value


def _array(value: Any, name: str, maximum: int) -> list[Any]:
    if not isinstance(value, list) or len(value) > maximum:
        _invalid(f"{name} must be an array with at most {maximum} entries")
    return value


def _identifier(value: Any, name: str) -> str:
    if not isinstance(value, str) or ID_RE.fullmatch(value) is None:
        _invalid(f"{name} must be a bounded identifier")
    return value


def _entity(value: Any, name: str, domains: set[str]) -> str:
    if not isinstance(value, str) or len(value) > 255 or ENTITY_RE.fullmatch(value) is None:
        _invalid(f"{name} must be an entity id")
    if value.split(".", 1)[0] not in domains:
        _invalid(f"{name} has an unsupported entity domain")
    return value


def _point(value: Any, name: str) -> tuple[float, float]:
    obj = _mapping(value, name)
    return (
        _finite(obj.get("x"), f"{name}.x", -CANVAS_LIMIT, CANVAS_LIMIT),
        _finite(obj.get("y"), f"{name}.y", -CANVAS_LIMIT, CANVAS_LIMIT),
    )


def _source_ids(sources: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for key in ("occupancy_entity", "count_entity", "availability_entity"):
        value = sources.get(key)
        if isinstance(value, str):
            out.add(value)
    for group in ("slots", "ranges", "zones"):
        for item in sources.get(group) or []:
            if not isinstance(item, dict):
                continue
            for key, value in item.items():
                if key.endswith("_entity") and isinstance(value, str):
                    out.add(value)
    return out


def radar_source_entity_ids(radar: Any) -> set[str]:
    """Return exact source ids from one already validated radar block."""
    if not isinstance(radar, dict):
        return set()
    sources = radar.get("sources")
    out = _source_ids(sources) if isinstance(sources, dict) else set()
    zones = radar.get("zones")
    if isinstance(zones, dict):
        for item in zones.get("local") or []:
            state = item.get("state") if isinstance(item, dict) else None
            if isinstance(state, dict) and isinstance(state.get("entity_id"), str):
                out.add(state["entity_id"])
        hardware = zones.get("hardware")
        if isinstance(hardware, dict):
            for value in hardware.values():
                if isinstance(value, str) and "." in value:
                    out.add(value)
            for slot in hardware.get("slots") or []:
                if isinstance(slot, dict):
                    out.update(value for key, value in slot.items()
                               if key.endswith("_entity") and isinstance(value, str))
    return out


def _validate_sources(profile: str, sources: Any) -> None:
    obj = _mapping(sources, "radar.sources")
    slots = _array(obj.get("slots", []), "radar.sources.slots", 8)
    ranges = _array(obj.get("ranges", []), "radar.sources.ranges", 2)
    zones = _array(obj.get("zones", []), "radar.sources.zones", 32)
    seen: set[str] = set()
    role_entities: set[str] = set()

    def unique_role(entity_id: str, name: str, domains: set[str]) -> str:
        value = _entity(entity_id, name, domains)
        if value in role_entities:
            _invalid("radar coordinate/range role entities must be distinct")
        role_entities.add(value)
        return value

    if profile in {"esphome_ld2450_v1", "cartesian_v1", "polar_v1"} and not slots:
        _invalid("coordinate radar requires at least one slot")
    if profile == "esphome_ld2450_v1" and len(slots) > 3:
        _invalid("LD2450 supports at most three slots")
    if profile == "range_v1" and not ranges:
        _invalid("range radar requires at least one range")
    if profile == "zones_v1" and not zones:
        _invalid("zone radar requires at least one zone source")
    if profile == "presence_v1" and not obj.get("occupancy_entity"):
        _invalid("presence radar requires occupancy_entity")

    for index, slot in enumerate(slots):
        item = _mapping(slot, f"radar.sources.slots[{index}]")
        ident = _identifier(item.get("id"), "slot.id")
        if ident in seen:
            _invalid("radar source ids must be unique")
        seen.add(ident)
        if profile == "polar_v1":
            unique_role(item.get("distance_entity"), "slot.distance_entity", {"sensor"})
            unique_role(item.get("angle_entity"), "slot.angle_entity", {"sensor"})
            if item.get("unit") not in LENGTH_UNITS or item.get("angle_unit") not in ANGLE_UNITS:
                _invalid("polar units must be explicit")
            if item.get("angle_zero") not in {"forward", "right"}:
                _invalid("polar angle_zero is invalid")
            if not isinstance(item.get("angle_clockwise"), bool):
                _invalid("polar angle_clockwise must be boolean")
        else:
            unique_role(item.get("x_entity"), "slot.x_entity", {"sensor"})
            unique_role(item.get("y_entity"), "slot.y_entity", {"sensor"})
            if profile == "esphome_ld2450_v1" and item.get("unit") != "mm":
                _invalid("LD2450 Cartesian unit must be mm")
            if profile != "esphome_ld2450_v1" and item.get("unit") not in LENGTH_UNITS:
                _invalid("cartesian unit must be explicit")
            if item.get("x_sign", 1) not in {-1, 1} or item.get("y_sign", 1) not in {-1, 1}:
                _invalid("axis signs must be +1 or -1")
            if "swap_xy" in item and not isinstance(item["swap_xy"], bool):
                _invalid("swap_xy must be boolean")
        if item.get("presence_entity") is not None:
            _entity(item["presence_entity"], "slot.presence_entity", {"binary_sensor"})

    for index, source in enumerate(ranges):
        item = _mapping(source, f"radar.sources.ranges[{index}]")
        ident = _identifier(item.get("id"), "range.id")
        if ident in seen:
            _invalid("radar source ids must be unique")
        seen.add(ident)
        unique_role(item.get("entity_id"), "range.entity_id", {"sensor"})
        if item.get("unit") not in LENGTH_UNITS:
            _invalid("range unit must be explicit")
        if item.get("presence_entity") is not None:
            _entity(item["presence_entity"], "range.presence_entity", {"binary_sensor"})

    for index, source in enumerate(zones):
        item = _mapping(source, f"radar.sources.zones[{index}]")
        ident = _identifier(item.get("id"), "zone source id")
        if ident in seen:
            _invalid("radar source ids must be unique")
        seen.add(ident)
        kind = item.get("kind")
        if kind not in {"occupancy", "count"}:
            _invalid("zone source kind is invalid")
        _entity(item.get("entity_id"), "zone source entity", {"binary_sensor"} if kind == "occupancy" else {"sensor"})

    if obj.get("occupancy_entity") is not None:
        _entity(obj["occupancy_entity"], "radar.sources.occupancy_entity", {"binary_sensor"})
    if obj.get("count_entity") is not None:
        _entity(obj["count_entity"], "radar.sources.count_entity", {"sensor"})
    if obj.get("availability_entity") is not None:
        _entity(obj["availability_entity"], "radar.sources.availability_entity", {"binary_sensor"})


def _polygon(points: Any, name: str) -> None:
    items = _array(points, name, 64)
    if len(items) < 3:
        _invalid(f"{name} requires at least three points")
    parsed = [_point(point, name) for point in items]
    if any(parsed[index] == parsed[(index + 1) % len(parsed)] for index in range(len(parsed))):
        _invalid(f"{name} contains duplicate adjacent points")
    area = sum(parsed[i][0] * parsed[(i + 1) % len(parsed)][1]
               - parsed[(i + 1) % len(parsed)][0] * parsed[i][1]
               for i in range(len(parsed))) / 2
    if abs(area) <= 1e-9:
        _invalid(f"{name} has zero area")


def _validate_stage2(radar: dict[str, Any]) -> None:
    zones = radar.get("zones")
    if zones is not None:
        obj = _mapping(zones, "radar.zones")
        local = _array(obj.get("local", []), "radar.zones.local", 32)
        seen: set[str] = set()
        for index, zone in enumerate(local):
            item = _mapping(zone, f"radar.zones.local[{index}]")
            ident = _identifier(item.get("id"), "radar zone id")
            if ident in seen:
                _invalid("radar zone ids must be unique")
            seen.add(ident)
            if not isinstance(item.get("name"), str) or not 1 <= len(item["name"].strip()) <= 80:
                _invalid("radar zone name is invalid")
            _polygon(item.get("poly"), "radar zone polygon")
            state = _mapping(item.get("state"), "radar zone state")
            kind = state.get("kind")
            if kind not in {"targets", "occupancy", "count"}:
                _invalid("radar zone state kind is invalid")
            if kind != "targets":
                _entity(state.get("entity_id"), "radar zone state entity",
                        {"binary_sensor"} if kind == "occupancy" else {"sensor"})
        hardware = obj.get("hardware")
        if hardware is not None:
            item = _mapping(hardware, "radar.zones.hardware")
            if item.get("adapter") != "esphome_ld2450_numbers_v1":
                _invalid("unsupported radar hardware adapter")
            _entity(item.get("mode_entity"), "radar hardware mode", {"select"})
            slots = _array(item.get("slots"), "radar hardware slots", 3)
            if len(slots) != 3:
                _invalid("radar hardware requires three slots")
            entity_ids: set[str] = {item["mode_entity"]}
            for expected, slot in enumerate(slots, 1):
                entry = _mapping(slot, "radar hardware slot")
                if entry.get("slot") != expected:
                    _invalid("radar hardware slots must be ordered 1..3")
                for key in ("x1_entity", "y1_entity", "x2_entity", "y2_entity"):
                    entity_id = _entity(entry.get(key), f"radar hardware {key}", {"number"})
                    if entity_id in entity_ids:
                        _invalid("radar hardware entities must be distinct")
                    entity_ids.add(entity_id)

    reflectors = _array(radar.get("reflectors", []), "radar.reflectors", 8)
    seen_reflectors: set[str] = set()
    for item in reflectors:
        line = _mapping(item, "radar reflector")
        ident = _identifier(line.get("id"), "radar reflector id")
        if ident in seen_reflectors:
            _invalid("radar reflector ids must be unique")
        seen_reflectors.add(ident)
        if not isinstance(line.get("name"), str) or not 1 <= len(line["name"].strip()) <= 80:
            _invalid("radar reflector name is invalid")
        if not isinstance(line.get("enabled"), bool):
            _invalid("radar reflector enabled must be boolean")
        a = _point(line.get("a"), "radar reflector a")
        b = _point(line.get("b"), "radar reflector b")
        if a == b:
            _invalid("radar reflector has zero length")


def _validate_radar(radar: Any, spaces: dict[str, dict[str, Any]], marker: dict[str, Any]) -> None:
    obj = _mapping(radar, "marker.radar")
    if obj.get("version") != 1:
        _invalid("unsupported radar version")
    if not isinstance(obj.get("enabled"), bool):
        _invalid("radar.enabled must be boolean")
    if obj.get("show_live") is not None and not isinstance(obj.get("show_live"), bool):
        _invalid("radar.show_live must be boolean")
    profile = obj.get("profile")
    if profile not in RADAR_PROFILES:
        _invalid("unsupported radar profile")
    _validate_sources(profile, obj.get("sources"))
    room_id = obj.get("room_id")
    if not isinstance(room_id, str) or not room_id:
        _invalid("radar.room_id is required")
    owner_space = str(marker.get("space") or "")
    space = spaces.get(owner_space)
    if space is None or room_id not in {str(room.get("id")) for room in space.get("rooms") or []}:
        _invalid("radar room must exist in the marker space")
    mount = _mapping(obj.get("mount"), "radar.mount")
    _identifier(mount.get("installation_id"), "radar installation id")
    _finite(mount.get("x"), "radar.mount.x", -CANVAS_LIMIT, CANVAS_LIMIT)
    _finite(mount.get("y"), "radar.mount.y", -CANVAS_LIMIT, CANVAS_LIMIT)
    _finite(mount.get("heading_deg"), "radar.mount.heading_deg", 0, 359.999999999)
    if mount.get("range_cm") is not None:
        _finite(mount["range_cm"], "radar.mount.range_cm", 0.000001, 10000)
    if mount.get("fov_deg") is not None:
        _finite(mount["fov_deg"], "radar.mount.fov_deg", 0.000001, 360)
    calibration = _mapping(obj.get("calibration"), "radar.calibration")
    if calibration.get("method") not in {"manual", "two_point", "not_required"}:
        _invalid("radar calibration method is invalid")
    if not isinstance(calibration.get("mirror"), bool):
        _invalid("radar calibration mirror must be boolean")
    calibration_cell_cm = _finite(
        calibration.get("cell_cm"), "radar calibration cell_cm", 0.01, 1000,
    )
    try:
        space_cell_cm = float(space.get("cell_cm", 5))
    except (TypeError, ValueError):
        _invalid("radar owner space scale is invalid")
    if not math.isfinite(space_cell_cm) or space_cell_cm <= 0 \
            or not math.isclose(calibration_cell_cm, space_cell_cm, abs_tol=1e-9):
        _invalid("radar calibration scale does not match the owner space")
    refs = calibration.get("refs")
    if calibration["method"] == "two_point":
        if not isinstance(refs, list) or len(refs) != 2:
            _invalid("two-point calibration requires exactly two references")
        local_points: list[tuple[float, float]] = []
        plan_points: list[tuple[float, float]] = []
        for ref in refs:
            entry = _mapping(ref, "radar calibration reference")
            plan_points.append(_point(entry.get("plan"), "radar calibration plan point"))
            local = _point(entry.get("local_cm"), "radar calibration local point")
            local_points.append(local)
            if math.hypot(*local) < 50:
                _invalid("radar calibration reference is too close to the mount")
        try:
            fit = solve_two_point(
                (_finite(mount.get("x"), "radar.mount.x"),
                 _finite(mount.get("y"), "radar.mount.y")),
                local_points, plan_points,
                _finite(calibration.get("cell_cm"), "radar calibration cell_cm", 0.01, 1000),
            )
        except ValueError as err:
            _invalid(str(err))
        if not math.isclose(float(mount["heading_deg"]), fit.heading_deg, abs_tol=1e-6) \
                or calibration["mirror"] is not fit.mirror:
            _invalid("radar two-point calibration parameters do not match its references")
        if calibration.get("rms_cm") is None \
                or not math.isclose(float(calibration["rms_cm"]), fit.rms_cm, abs_tol=1e-6):
            _invalid("radar two-point calibration rms does not match its references")
    elif refs not in (None, []):
        _invalid("manual calibration cannot contain captured references")
    if calibration.get("rms_cm") is not None:
        _finite(calibration["rms_cm"], "radar calibration rms_cm", 0, 30)
    _validate_stage2(obj)
    allowed = obj.get("allowed_room_ids")
    if allowed is not None:
        room_ids = _array(allowed, "radar.allowed_room_ids", 32)
        known = {str(room.get("id")) for room in space.get("rooms") or []}
        if len(set(room_ids)) != len(room_ids) or any(value not in known for value in room_ids):
            _invalid("radar allowed rooms must be unique rooms in the marker space")


def _validate_settings(settings: Any, spaces: dict[str, dict[str, Any]],
                       markers: dict[str, dict[str, Any]]) -> None:
    obj = _mapping(settings, "settings.radar")
    if obj.get("version") not in (None, 1):
        _invalid("unsupported radar settings version")
    if obj.get("show_live") is not None and not isinstance(obj.get("show_live"), bool):
        _invalid("settings.radar.show_live must be boolean")
    groups = _array(obj.get("fusion_groups", []), "settings.radar.fusion_groups", 32)
    group_ids: set[str] = set()
    used_markers: set[str] = set()
    for group in groups:
        item = _mapping(group, "radar fusion group")
        ident = _identifier(item.get("id"), "radar fusion group id")
        if ident in group_ids:
            _invalid("radar fusion group ids must be unique")
        group_ids.add(ident)
        if not isinstance(item.get("enabled"), bool):
            _invalid("radar fusion group enabled must be boolean")
        space_id = item.get("space_id")
        if space_id not in spaces:
            _invalid("radar fusion group space is invalid")
        marker_ids = _array(item.get("marker_ids"), "radar fusion marker_ids", 8)
        if len(marker_ids) < 2 or len(set(marker_ids)) != len(marker_ids):
            _invalid("radar fusion group requires 2..8 unique markers")
        for marker_id in marker_ids:
            marker = markers.get(str(marker_id))
            if marker is None or marker.get("space") != space_id or marker_id in used_markers:
                _invalid("radar fusion marker ownership is invalid")
            used_markers.add(str(marker_id))
    outputs = _array(obj.get("room_outputs", []), "settings.radar.room_outputs", 64)
    output_ids: set[str] = set()
    for output in outputs:
        item = _mapping(output, "radar room output")
        ident = _identifier(item.get("id"), "radar room output id")
        if ident in output_ids:
            _invalid("radar room output ids must be unique")
        output_ids.add(ident)
        space = spaces.get(str(item.get("space_id")))
        if space is None or str(item.get("room_id")) not in {
            str(room.get("id")) for room in space.get("rooms") or []
        }:
            _invalid("radar room output owner is invalid")
        if item.get("presence") not in (None, True, False) or item.get("estimated_count") not in (None, True, False):
            _invalid("radar room output flags must be boolean")


def validate_marker_radars(config: dict[str, Any], previous: dict[str, Any] | None = None,
                           *, validate_all: bool = False) -> None:
    """Validate only newly created/changed known radar namespaces.

    This mirrors the project's lossless compatibility doctrine: untouched
    future or malformed blocks stay inert and round-trip through unrelated
    edits, but the editor cannot create or modify invalid known data.
    """
    spaces = {str(space.get("id")): space for space in config.get("spaces") or []}
    markers = {str(marker.get("id")): marker for marker in config.get("markers") or []}
    previous_markers = {
        str(marker.get("id")): marker for marker in (previous or {}).get("markers") or []
    }
    configured = 0
    for marker_id, marker in markers.items():
        if "radar" not in marker:
            continue
        radar = marker.get("radar")
        if radar is None:
            continue
        configured += 1
        old = previous_markers.get(marker_id, {}).get("radar", object())
        if validate_all or radar != old:
            _validate_radar(radar, spaces, marker)
    if configured > MAX_RADARS:
        _invalid("at most 32 radars may be configured")

    missing = object()
    settings = (config.get("settings") or {}).get("radar", missing)
    previous_settings = ((previous or {}).get("settings") or {}).get("radar", missing)
    if settings is not missing and (validate_all or settings != previous_settings):
        _validate_settings(settings, spaces, markers)


def validate_radar_draft(
    config: dict[str, Any], marker_id: str, radar: Any,
) -> tuple[dict[str, Any], set[str]]:
    """Validate an unsaved setup block against its exact stored marker owner."""
    marker = next(
        (item for item in config.get("markers") or []
         if isinstance(item, dict) and str(item.get("id")) == marker_id),
        None,
    )
    if marker is None or marker.get("removed") is True or marker.get("binding") == "virtual":
        _invalid("radar setup marker is invalid")
    candidate = copy.deepcopy(marker)
    candidate["radar"] = copy.deepcopy(radar)
    spaces = {str(space.get("id")): space for space in config.get("spaces") or []}
    _validate_radar(candidate["radar"], spaces, candidate)
    return candidate, radar_source_entity_ids(candidate["radar"])
