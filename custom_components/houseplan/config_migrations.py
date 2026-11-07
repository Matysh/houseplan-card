"""Versioned, copy-only decoders for stored plans and portable imports.

Revision, locks and durable recovery belong to store.py. This module never
guesses a structural wall migration or rewrites an unrepresentable old value.
"""
from __future__ import annotations

import math
from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from .const import MAX_CONFIG_TEXT, PLAN_MODEL_VERSION
from .geometry_migration import migrate_config, migrate_layout, pending_from_config

CONFIG_MIGRATION_VERSION = 1
CONFIG_MIGRATION_PASSPORT = "config_migration"
CONFIG_MIGRATION_BACKUP = "config_migration_backup"
_GRID_PITCH = 1000.0 / 240.0


@dataclass(frozen=True)
class MigratedPair:
    config: dict[str, Any]
    layout: dict[str, Any]
    steps: tuple[str, ...]


def migration_version(passport: Any) -> int:
    """Absent is the original decoder; an unknown passport is never current."""
    if passport is None:
        return 0
    if not isinstance(passport, dict):
        raise ValueError("invalid config migration passport")
    version = passport.get("version")
    if isinstance(version, bool) or not isinstance(version, int) or not 0 <= version <= CONFIG_MIGRATION_VERSION:
        raise ValueError("unsupported config migration version")
    return version


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return float(value)


def _scalars_v1(config: dict[str, Any]) -> list[str]:
    steps: list[str] = []
    for marker in config.get("markers") or []:
        if marker.get("display") == "ripple":
            marker["display"] = "icon_ripple"
            steps.append("display-ripple")
        vacuum = marker.get("vacuum")
        if (isinstance(vacuum, dict) and "trail" in vacuum
            and (vacuum["trail"] is None or isinstance(vacuum["trail"], bool))
            and (vacuum.get("trail_mode") is None or vacuum["trail_mode"] in ("never", "cleaning", "always"))):
            if vacuum.get("trail_mode") not in {"never", "cleaning", "always"}:
                vacuum["trail_mode"] = "never" if vacuum["trail"] is False else "cleaning"
            del vacuum["trail"]
            steps.append("vacuum-trail")
    for space in config.get("spaces") or []:
        if "segments" in space:
            del space["segments"]
            steps.append("derived-segments")
        if "plan_scale" in space:
            scale = _number(space["plan_scale"])
            axes = ("plan_scale_x", "plan_scale_y")
            valid = space["plan_scale"] is None or scale is not None and 0.01 <= scale <= 100
            valid = valid and all(space.get(axis) is None or
                _number(space[axis]) is not None and 0.01 <= space[axis] <= 100 for axis in axes)
            if valid:
                for axis in axes:
                    if space.get(axis) is None:
                        space[axis] = scale if scale is not None else 1.0
                del space["plan_scale"]
                steps.append("plan-scale")
        settings = space.get("settings") or {}
        if (settings.get("fill_mode") == "glow"
            and ("glow_enabled" not in settings or isinstance(settings["glow_enabled"], bool))):
            settings.setdefault("glow_enabled", True)
            settings["fill_mode"] = "none"
            steps.append("space-glow")
        for room in space.get("rooms") or []:
            local = room.get("settings") or {}
            if local.get("fill_mode") == "glow" and (local.get("glow") is None or isinstance(local["glow"], bool)):
                if local.get("glow") is None:
                    local["glow"] = True
                del local["fill_mode"]
                steps.append("room-glow")
        cell = _number(space.get("cell_cm")) or 5.0
        for shape in space.get("decor") or []:
            # Only the exact representable subset. In particular width=30 at
            # cell_cm=1000 is legal old data but exceeds width_cm's 100 cm cap.
            if "width" in shape:
                width = _number(shape["width"])
                cm = width / _GRID_PITCH * cell if width is not None else None
                canonical = _number(shape.get("width_cm"))
                valid = width is not None and 0.1 <= width <= 30 and (
                    "width_cm" not in shape or canonical is not None and 0.1 <= canonical <= 100)
                if valid and canonical is not None:
                    del shape["width"]
                    steps.append("decor-width")
                elif valid and cm is not None and 0.1 <= cm <= 100:
                    shape["width_cm"] = cm
                    del shape["width"]
                    steps.append("decor-width")
            if shape.get("kind") == "text" and ("size" in shape or "scale" in shape):
                scale = _number(shape.get("scale"))
                canonical = _number(shape.get("size_cm"))
                valid = ("scale" not in shape or scale is not None and 0.15 <= scale <= 20)
                valid = valid and ("size" not in shape or shape["size"] in ("s", "m", "l"))
                valid = valid and ("size_cm" not in shape or canonical is not None and 0.1 <= canonical <= 2000)
                if not valid:
                    continue
                if scale is None or scale <= 0:
                    scale = {"s": 0.7, "m": 1.0, "l": 1.5}.get(shape.get("size"), 1.0)
                scale = min(20.0, max(0.15, scale))
                cm = 20.0 * scale / _GRID_PITCH * cell
                if canonical is not None or 0.1 <= cm <= 2000:
                    shape.setdefault("size_cm", cm)
                    shape.pop("size", None)
                    shape.pop("scale", None)
                    steps.append("decor-text-size")
    settings = config.get("settings") or {}
    if ("weather_entity" in settings and (settings["weather_entity"] is None
        or isinstance(settings["weather_entity"], str) and len(settings["weather_entity"]) <= MAX_CONFIG_TEXT)):
        del settings["weather_entity"]
        steps.append("weather-option")
    if settings.get("filter_seeded") is True and isinstance(settings.get("show_all"), bool):
        del settings["show_all"]
        steps.append("seeded-show-all")
    return steps


def canonical_config(config: dict[str, Any]) -> dict[str, Any]:
    """The config-only write decoder, after strict scalar validation.

    Incoming config/set must pass its existing model-downgrade guard first.
    Coordinate-frame migration needs the pair and is deliberately absent here.
    """
    if not _needs_v1(config):
        return config
    result = deepcopy(config)
    _scalars_v1(result)
    return result


def needs_canonical_config(config: dict[str, Any]) -> bool:
    """Public selector scan: True when `canonical_config` would copy and migrate (#1096)."""
    return _needs_v1(config)


def _needs_v1(config: dict[str, Any]) -> bool:
    """Inspect selectors only; current reads never deepcopy plan geometry."""
    settings = config.get("settings") or {}
    if ("weather_entity" in settings and (settings["weather_entity"] is None
        or isinstance(settings["weather_entity"], str) and len(settings["weather_entity"]) <= MAX_CONFIG_TEXT)):
        return True
    if settings.get("filter_seeded") is True and "show_all" in settings:
        return True
    for marker in config.get("markers") or []:
        if marker.get("display") == "ripple" or isinstance(marker.get("vacuum"), dict) and "trail" in marker["vacuum"]:
            return True
    for space in config.get("spaces") or []:
        if any(key in space for key in ("aspect", "plan_scale", "segments")):
            return True
        if (space.get("settings") or {}).get("fill_mode") == "glow":
            return True
        if any((room.get("settings") or {}).get("fill_mode") == "glow" for room in space.get("rooms") or []):
            return True
        if any("width" in shape or shape.get("kind") == "text" and ("size" in shape or "scale" in shape)
               for shape in space.get("decor") or []):
            return True
    return False


def migrate_pair(
    config: dict[str, Any], layout: dict[str, Any], *,
    passport: Any = None, square_pending: dict[str, float] | None = None,
) -> MigratedPair:
    """Decode all supported releases in order, before schema/host proof/use.

    The passport versions the decoder, not geometry or the user's settings.
    Even a v1 writer may receive an old backup again, so selectors remain
    authoritative. A current document is an exact no-op, including omission.
    """
    migration_version(passport)
    if not isinstance(config, dict) or not isinstance(layout, dict):
        raise ValueError("invalid config migration document")
    model = config.get("model_version", 0)
    if isinstance(model, bool) or not isinstance(model, int) or not 0 <= model <= PLAN_MODEL_VERSION:
        raise ValueError("unsupported plan model version")
    if not square_pending and not _needs_v1(config):
        return MigratedPair(config, layout, ())
    result, positions = deepcopy(config), deepcopy(layout)
    factors = {**(square_pending or {}), **pending_from_config(result)}
    steps: list[str] = []
    if factors:
        migrate_config(result)
        migrate_layout(positions, factors)
        steps.append("square-canvas")
    steps.extend(_scalars_v1(result))
    return MigratedPair(result, positions, tuple(dict.fromkeys(steps)))
