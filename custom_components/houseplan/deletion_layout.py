"""Only layout owners removed by this explicit configuration gesture are cleaned."""
from __future__ import annotations

import copy
from typing import Any

import voluptuous as vol


def _rooms(config: dict) -> dict[str, str]:
    return {"rl_" + room["id"]: space["id"]
            for space in config.get("spaces") or [] for room in space.get("rooms") or []}


def deletion_layout_candidate(
    before: dict, after: dict, layout: dict,
    labels: dict[str, Any] | None = None,
) -> tuple[dict, dict]:
    """Return the current pair's bounded deletion/restoration delta, preserving strangers.

    Labels supplied by local geometry Undo may only name rooms in the source or
    target configuration. Restoring a position requires its live target owner.
    No client can use this field as a general full-layout replacement.
    """
    if not labels and before.get("spaces") == after.get("spaces") and before.get("markers") == after.get("markers"):
        return layout, {}
    positions = copy.deepcopy(layout)
    old_rooms, new_rooms = _rooms(before), _rooms(after)
    old_spaces = {space["id"] for space in before.get("spaces") or []}
    new_spaces = {space["id"] for space in after.get("spaces") or []}
    old_markers = {marker["id"]: marker for marker in before.get("markers") or []}
    new_markers = {marker["id"]: marker for marker in after.get("markers") or []}
    removed_markers = {key for key, marker in old_markers.items()
                       if not marker.get("removed") and (key not in new_markers or new_markers[key].get("removed"))}
    removed_markers.update(key for key, marker in new_markers.items()
                           if marker.get("removed") and key not in old_markers)
    for key, position in list(positions.items()):
        if not isinstance(position, dict):
            continue
        if (key in removed_markers or position.get("s") in old_spaces - new_spaces
                or key in old_rooms and key not in new_rooms
                and position.get("s") in (None, old_rooms[key])):
            del positions[key]
    for key, position in (labels or {}).items():
        if key not in old_rooms and key not in new_rooms:
            raise vol.Invalid("Room label patch has no source or target owner")
        if position is None:
            # A surviving owner's position can be explicitly absent in Undo.
            positions.pop(key, None)
        else:
            if key not in new_rooms or position.get("s") not in (None, new_rooms[key]):
                raise vol.Invalid("Restored room label must name its target space")
            positions[key] = copy.deepcopy(position)
    changes = {key: copy.deepcopy(positions.get(key)) for key in layout.keys() | positions.keys()
               if layout.get(key) != positions.get(key)}
    return positions, changes
