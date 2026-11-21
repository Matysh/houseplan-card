"""Canonical space deletion candidates; no host or storage dependency."""
from __future__ import annotations

import json
from typing import Any


def _space_marker_dependencies(
    config: dict[str, Any], layout: dict[str, Any], space_id: str,
) -> list[str]:
    """Active marker ids that make deleting a space unsafe (deduplicated)."""
    space = next(
        (item for item in config.get("spaces") or [] if item.get("id") == space_id),
        None,
    )
    room_ids = {
        str(room.get("id")) for room in (space or {}).get("rooms") or []
        if room.get("id") is not None
    }
    dependencies = {
        str(marker.get("id"))
        for marker in config.get("markers") or []
        if marker.get("removed") is not True
        and marker.get("id") is not None
        and (
            marker.get("space") == space_id
            or (
                marker.get("room_id") is not None
                and str(marker.get("room_id")) in room_ids
            )
            or (layout.get(str(marker.get("id"))) or {}).get("s") == space_id
        )
    }
    return sorted(dependencies)


def _space_delete_candidate(
    config: dict[str, Any], layout: dict[str, Any], space_id: str,
) -> tuple[dict[str, Any], dict[str, Any], list[str], int]:
    """Return a pure exact pair; blockers leave both inputs unchanged."""
    candidate_config = json.loads(json.dumps(config))
    candidate_layout = json.loads(json.dumps(layout))
    dependencies = _space_marker_dependencies(candidate_config, candidate_layout, space_id)
    spaces = candidate_config.get("spaces") or []
    deleting_last_space = len(spaces) == 1 and spaces[0].get("id") == space_id
    if dependencies and not deleting_last_space:
        return candidate_config, candidate_layout, dependencies, 0
    space = next(
        (item for item in candidate_config.get("spaces") or []
         if item.get("id") == space_id),
        None,
    )
    room_ids = {
        str(room.get("id")) for room in (space or {}).get("rooms") or []
        if room.get("id") is not None
    }
    candidate_config["spaces"] = [
        item for item in candidate_config.get("spaces") or []
        if item.get("id") != space_id
    ]
    for remaining_space in candidate_config["spaces"]:
        for stair in remaining_space.get("stairs") or []:
            if isinstance(stair, dict) and stair.get("target_space_id") == space_id:
                stair["target_space_id"] = None
    for marker in candidate_config.get("markers") or []:
        # #162/#822: fulfil the confirmation in the same authoritative pair.
        vacuum = marker.get("vacuum")
        routes = vacuum.get("map_routes") if isinstance(vacuum, dict) else None
        if isinstance(routes, list):
            kept_routes = [
                route for route in routes
                if not isinstance(route, dict) or route.get("space") != space_id
            ]
            if len(kept_routes) != len(routes):
                vacuum["map_routes"] = kept_routes
        marker_id = str(marker.get("id")) if marker.get("id") is not None else None
        marker_position = candidate_layout.get(marker_id) if marker_id is not None else None
        references_deleted_space = (
            marker.get("space") == space_id
            or (
                marker.get("room_id") is not None
                and str(marker.get("room_id")) in room_ids
            )
            or (
                isinstance(marker_position, dict)
                and marker_position.get("s") == space_id
            )
        )
        if deleting_last_space and references_deleted_space:
            marker.pop("space", None)
            marker.pop("room_id", None)
            continue
        if marker.get("removed") is not True:
            continue
        if marker.get("space") == space_id:
            marker.pop("space", None)
        if (marker.get("room_id") is not None
                and str(marker.get("room_id")) in room_ids):
            marker.pop("room_id", None)
    removed_layout = 0
    for key in list(candidate_layout):
        position = candidate_layout.get(key)
        if isinstance(position, dict) and position.get("s") == space_id:
            del candidate_layout[key]
            removed_layout += 1
    return candidate_config, candidate_layout, dependencies, removed_layout


def _delete_plan_markers(
    config: dict[str, Any], layout: dict[str, Any], marker_ids: list[str],
) -> list[str]:
    """Delete markers the way the device dialog's «Delete» does (#819).

    Mirror of the card's ``deletePlanMarkerRecords`` and the cleanup around
    it (``src/space-deletion.ts`` ``deletePlanMarkers``; the shared fixture
    ``test/fixtures/space-delete-with-markers.json`` pins both): a real binding
    drops every marker of that binding and leaves a hidden tombstone of the
    exact binding, a virtual marker simply goes; links to the dropped ids in
    other markers' ``controls``, LED strips and area snapshots go with them,
    and so do their layout positions. Mutates the given (already copied)
    pair; returns the dropped ids, sorted.
    """
    dropped: set[str] = set()
    for marker_id in sorted(marker_ids):
        markers = config.get("markers") or []
        target = next(
            (marker for marker in markers
             if marker.get("id") == marker_id and marker.get("removed") is not True),
            None,
        )
        if target is None:
            continue
        binding = target.get("binding")
        virtual = binding == "virtual"
        kept = []
        for marker in markers:
            if marker.get("id") == marker_id or (not virtual and marker.get("binding") == binding):
                dropped.add(str(marker.get("id")))
            else:
                kept.append(marker)
        if not virtual:
            kept.append({"id": marker_id, "binding": binding, "removed": True, "hidden": True})
        config["markers"] = kept
    if not dropped:
        return []
    for marker in config.get("markers") or []:
        controls = marker.get("controls")
        if not isinstance(controls, list):
            continue
        links = [
            ref for ref in controls
            if not (isinstance(ref, str) and ref.startswith("marker:")
                    and ref[len("marker:"):] in dropped)
        ]
        if len(links) != len(controls):
            marker["controls"] = links or None
    for space in config.get("spaces") or []:
        for strip in space.get("led_strips") or []:
            if isinstance(strip, dict) and strip.get("marker") in dropped:
                strip["marker"] = None
                strip["active"] = True
    snapshot = (config.get("settings") or {}).get("marker_area_snapshot")
    if isinstance(snapshot, dict):
        for marker_id in dropped:
            snapshot.pop(marker_id, None)
    for marker_id in dropped:
        layout.pop(marker_id, None)
    return sorted(dropped)


def _space_delete_target(
    config: dict[str, Any], layout: dict[str, Any], space_id: str,
    *, remove_markers: bool = False,
) -> tuple[dict[str, Any], dict[str, Any], list[str], int, list[str]]:
    """The exact pair ``space/delete`` commits, and the markers it deleted.

    Without ``remove_markers`` this is the #244 candidate unchanged. With it
    (#819) every active marker that blocks the delete first goes the way
    ``_delete_plan_markers`` sends it, so the space is no longer in use. The
    last space keeps its own rule: its markers are detached, never deleted.
    """
    source_config, source_layout = config, layout
    removed_markers: list[str] = []
    spaces = config.get("spaces") or []
    if remove_markers and not (len(spaces) == 1 and spaces[0].get("id") == space_id):
        source_config = json.loads(json.dumps(config))
        source_layout = json.loads(json.dumps(layout))
        removed_markers = _delete_plan_markers(
            source_config, source_layout,
            _space_marker_dependencies(source_config, source_layout, space_id),
        )
    target_config, target_layout, dependencies, removed_layout = _space_delete_candidate(
        source_config, source_layout, space_id,
    )
    removed_layout += len(layout) - len(source_layout)
    return target_config, target_layout, dependencies, removed_layout, removed_markers
