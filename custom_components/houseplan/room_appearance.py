"""Copy-only compatibility for independent room captions and space wall fill."""
import math
import re
from copy import deepcopy

APPEARANCE_KEYS = ("name_color", "wall_fill")


def _color(value, fallback):
    raw = value if isinstance(value, dict) else {}
    color = raw.get("c")
    alpha = raw.get("a")
    return {
        "c": color if isinstance(color, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", color) else fallback["c"],
        "a": min(1, max(0, alpha))
        if isinstance(alpha, (int, float)) and not isinstance(alpha, bool) and math.isfinite(alpha)
        else fallback["a"],
    }


def space_appearance_materialized(space: dict) -> bool:
    """A space an ordinary write already materialised (#1037) carries both fields."""
    settings = space.get("settings") if isinstance(space, dict) else None
    return isinstance(settings, dict) and all(key in settings for key in APPEARANCE_KEYS)


def config_appearance_materialized(config: dict) -> bool:
    """Every space carries both fields: resolution is a no-op, no copy needed (#1096)."""
    return all(space_appearance_materialized(space) for space in config.get("spaces") or [])


def resolve_space_appearance(space: dict, general: dict | None) -> dict:
    """The two materialised fields of ONE space, by the single legacy rule.

    `normalize_room_appearance` and `preserve_space_appearance` both consume
    this so a legacy space (saved before #1037, fields absent) resolves to the
    same colours whichever path reads it first (#1096 r2/M1).
    """
    settings = space.get("settings") if isinstance(space.get("settings"), dict) else {}
    palette = (general or {}).get("fill_colors") or {}
    legacy_wall = _color(palette.get("wall_fill"), {"c": "#ffffff", "a": 1})
    opacity = settings.get("room_opacity", 0.55)
    if isinstance(opacity, bool) or not isinstance(opacity, (int, float)) or not math.isfinite(opacity):
        opacity = 0.55
    name = _color({"c": settings.get("room_color"), "a": min(1, min(1, max(0, opacity)) + 0.25)},
                  {"c": "#55606c", "a": 0.8})
    return {
        "name_color": deepcopy(settings["name_color"]) if "name_color" in settings else name,
        "wall_fill": deepcopy(settings["wall_fill"]) if "wall_fill" in settings else legacy_wall,
    }


def materialize_space_appearance(space: dict, general: dict | None) -> None:
    """Write the resolved fields into `space` in place; present fields stay."""
    if space_appearance_materialized(space):
        return
    settings = space.setdefault("settings", {})
    for key, value in resolve_space_appearance(space, general).items():
        settings.setdefault(key, value)


def normalize_room_appearance(config: dict) -> dict:
    """Resolve legacy values on a detached copy, without revisions or writes."""
    result = deepcopy(config)
    general = result.get("settings") or {}
    for space in result.get("spaces", []):
        materialize_space_appearance(space, general)
    return result


def preserve_space_appearance(candidate: dict, previous: dict | None) -> None:
    """An older ordinary writer cannot reintroduce global colour inheritance.

    Room name override absence still means an intentional reset. Only the two
    materialised space fields are protected, not authoritative imports. A
    materialised previous space hands its fields over directly; a legacy one
    (saved before #1037) resolves them by the same rule as
    `normalize_room_appearance`, without copying the whole document (#1096).
    """
    if not previous:
        return
    old = {space.get("id"): space for space in previous.get("spaces") or [] if isinstance(space, dict)}
    general = previous.get("settings") or {}
    for space in candidate.get("spaces", []):
        before = old.get(space.get("id"))
        if before is None:
            continue
        settings = space.setdefault("settings", {})
        if all(key in settings for key in APPEARANCE_KEYS):
            continue
        resolved = resolve_space_appearance(before, general)
        for key in APPEARANCE_KEYS:
            if key not in settings:
                settings[key] = resolved[key]
