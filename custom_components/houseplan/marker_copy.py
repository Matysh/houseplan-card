"""Narrow, lossless copy delta. Never rebind a source or run plan maintenance."""
from __future__ import annotations

import copy
import hashlib
import math
import re
from typing import Any

import voluptuous as vol

from .core.led_strips import CANVAS_LIMIT, polyline_length


def _translated_strip(strip: dict[str, Any], marker_id: str, x: float, y: float) -> dict[str, Any]:
    """Place the same polyline at the requested half-length anchor."""
    points = strip["points"]
    remaining = polyline_length(points) / 2
    for a, b in zip(points[:-1], points[1:], strict=True):
        length = math.dist(a, b)
        if length and remaining <= length:
            t = remaining / length
            dx = x - (a[0] + (b[0] - a[0]) * t)
            dy = y - (a[1] + (b[1] - a[1]) * t)
            break
        remaining -= length
    else:
        raise vol.Invalid("LED strip needs at least two distinct points")
    suffix = hashlib.sha256(marker_id.encode()).hexdigest()[:32]
    return {**strip, "id": f"led-copy-{suffix}", "marker": marker_id,
            "points": [[point[0] + dx, point[1] + dy] for point in points]}


def marker_copy_candidate(
    config: dict[str, Any], layout: dict[str, Any], source_id: str,
    binding: str, marker: dict[str, Any], position: dict[str, Any],
    own_entities: set[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build only one new marker/position and append its reverse control edges."""
    marker_id = marker.get("id")
    markers = config.get("markers") or []
    source = next((m for m in markers if m.get("id") == source_id), None)
    if source and (source.get("removed") or source.get("binding") != binding):
        raise vol.Invalid("Source is no longer available")
    if source is None and (binding == "virtual" or source_id != (
        binding[7:] if binding.startswith("device:") else "lg_" + binding[7:]
    )):
        raise vol.Invalid("Source identity does not match its binding")
    if (not isinstance(marker_id, str) or not re.fullmatch(r"v_[A-Za-z0-9_-]{1,80}", marker_id)
            or marker_id == source_id or marker_id in layout
            or any(m.get("id") == marker_id for m in markers)
            or marker.get("binding") != "virtual"
            or marker.get("hidden") or marker.get("removed")):
        raise vol.Invalid("Copy must be a new visible virtual marker")
    space = marker.get("space")
    if (position.get("s") != space or not space
            or not any(s.get("id") == space for s in config.get("spaces") or [])
            or (source and source.get("space") and source["space"] != space)):
        raise vol.Invalid("Copy must stay on its source plan")
    target = copy.deepcopy(config)
    target["markers"] = copy.deepcopy(markers)
    for controller in target["markers"]:
        if controller.get("id") == source_id or controller.get("removed"):
            continue
        refs = controller.get("controls") or []
        if any(ref == "marker:" + source_id or ref in own_entities for ref in refs):
            if marker.get("is_light") is not True:
                raise vol.Invalid("A copy with incoming controls must be a light source")
            controller["controls"] = [*refs, "marker:" + marker_id]
    copied = copy.deepcopy(marker)
    if source and "height_cm" in source:
        copied["height_cm"] = source["height_cm"]
    target["markers"].append(copied)
    for destination in target.get("spaces") or []:
        if destination.get("id") != space:
            continue
        strips = destination.get("led_strips") or []
        strip = next((item for item in strips if item.get("marker") == source_id
                      and item.get("active") is not False), None)
        if strip is not None:
            x, y = position.get("x"), position.get("y")
            if any(type(value) not in (int, float) or not -CANVAS_LIMIT <= value <= CANVAS_LIMIT
                   for value in (x, y)):
                raise vol.Invalid("Copy LED strip needs a valid position")
            translated = _translated_strip(strip, marker_id, x, y)
            if any(item["id"] == translated["id"] for item in strips):
                raise vol.Invalid("Copy LED strip id already exists")
            destination["led_strips"].append(translated)
        break
    target_layout = copy.deepcopy(layout)
    target_layout[marker_id] = copy.deepcopy(position)
    return target, target_layout
