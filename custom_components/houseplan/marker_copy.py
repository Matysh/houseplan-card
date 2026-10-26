"""Narrow, lossless copy delta. Never rebind a source or run plan maintenance."""
from __future__ import annotations

import copy
import re
from typing import Any

import voluptuous as vol


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
    target["markers"].append(copy.deepcopy(marker))
    target_layout = copy.deepcopy(layout)
    target_layout[marker_id] = copy.deepcopy(position)
    return target, target_layout
