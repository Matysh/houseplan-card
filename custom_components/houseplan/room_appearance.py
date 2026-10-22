"""Copy-only compatibility for independent room captions and space wall fill."""
import math
import re
from copy import deepcopy


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


def normalize_room_appearance(config: dict) -> dict:
    """Resolve legacy values on a detached copy, without revisions or writes."""
    result = deepcopy(config)
    general = result.get("settings") or {}
    palette = general.get("fill_colors") or {}
    legacy_wall = _color(palette.get("wall_fill"), {"c": "#ffffff", "a": 1})
    for space in result.get("spaces", []):
        settings = space.setdefault("settings", {})
        opacity = settings.get("room_opacity", 0.55)
        if isinstance(opacity, bool) or not isinstance(opacity, (int, float)) or not math.isfinite(opacity):
            opacity = 0.55
        name = _color({"c": settings.get("room_color"), "a": min(1, min(1, max(0, opacity)) + 0.25)},
                      {"c": "#55606c", "a": 0.8})
        settings.setdefault("name_color", name)
        settings.setdefault("wall_fill", deepcopy(legacy_wall))
    return result


def preserve_space_appearance(candidate: dict, previous: dict | None) -> None:
    """An older ordinary writer cannot reintroduce global colour inheritance.

    Room name override absence still means an intentional reset. Only the two
    materialised space fields are protected, not authoritative imports.
    """
    if not previous:
        return
    old = {space.get("id"): space for space in normalize_room_appearance(previous).get("spaces", [])}
    for space in candidate.get("spaces", []):
        before = old.get(space.get("id"))
        if before is None:
            continue
        settings = space.setdefault("settings", {})
        for key in ("name_color", "wall_fill"):
            if key not in settings:
                settings[key] = deepcopy(before["settings"][key])
