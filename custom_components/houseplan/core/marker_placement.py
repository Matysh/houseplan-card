"""Room-proved marker space repair, without registry guesses or layout writes."""
from collections import defaultdict


def repair_marker_spaces(config: dict) -> int:
    areas, rooms = defaultdict(list), defaultdict(list)
    for space in config.get("spaces") or []:
        for room in space.get("rooms") or []:
            if room.get("area"):
                areas[room["area"]].append(space["id"])
            rooms[room["id"]].append(space["id"])
    strips = defaultdict(list)
    for space in config.get("spaces") or []:
        for strip in space.get("led_strips") or []:
            if strip.get("marker"):
                strips[strip["marker"]].append(space["id"])
    changed = 0
    for marker in config.get("markers") or []:
        if not isinstance(marker.get("space"), str) or not marker["space"]:
            continue
        candidates = (areas.get(marker["area"], []) if marker.get("area") else
                      rooms.get(marker["room_id"], []) if marker.get("area") is None
                      and "area" in marker and marker.get("room_id") else [])
        if (len(candidates) == 1 and marker["space"] != candidates[0]
                and all(owner == candidates[0] for owner in strips.get(marker.get("id"), []))):
            marker["space"] = candidates[0]
            changed += 1
    return changed
