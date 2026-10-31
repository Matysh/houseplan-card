"""Read-only projections of the stored plan (#256).

A full configuration is 70 KB on a real installation: three spaces and 139
markers. Every diagnostic question — "which space does this marker point at",
"how many markers are hidden", "what is on the first floor" — used to require
downloading all of it, because `houseplan/config/get` had no way to ask for
less.

The functions here are pure and deliberately unaware of Home Assistant: the
websocket handlers stay thin, and the interesting part is covered by tests that
run without the HA harness.

Two rules shape everything below.

* Absent parameter means *no projection*. The response must stay byte-for-byte
  what it was before this module existed; no existing client may notice it.
* A projection never invents or repairs data. An unknown field name simply adds
  nothing, and an unknown space yields an empty list rather than an error — the
  caller distinguishes "no such thing" from "broken" by content, not by an
  error code.
"""
from __future__ import annotations

from typing import Any, Iterable


def _names(value: Any) -> list[str] | None:
    """Normalise a field list; anything unusable means "no projection"."""
    if not isinstance(value, (list, tuple)):
        return None
    names = [str(item) for item in value if isinstance(item, str) and item]
    return names or None


def project_markers(markers: Any, marker_fields: Iterable[str] | None) -> Any:
    """Keep only the requested marker fields, plus `id`.

    `id` is added unconditionally: a marker without it cannot be matched to
    anything, so a projection that drops it produces an answer nobody can use.
    """
    names = _names(marker_fields)
    if names is None or not isinstance(markers, list):
        return markers
    keep = {"id", *names}
    out = []
    for marker in markers:
        if not isinstance(marker, dict):
            out.append(marker)
            continue
        out.append({key: value for key, value in marker.items() if key in keep})
    return out


def project_config(
    config: Any,
    *,
    space_id: str | None = None,
    fields: Iterable[str] | None = None,
    marker_fields: Iterable[str] | None = None,
) -> Any:
    """Return a narrowed copy of the configuration.

    The original object is never mutated: the caller hands us the store's
    document, and a projection that edited it in place would corrupt the very
    thing it was asked to read.
    """
    if not isinstance(config, dict):
        return config
    field_names = _names(fields)
    if space_id is None and field_names is None and _names(marker_fields) is None:
        return config

    projected: dict[str, Any] = dict(config)
    if space_id is not None:
        spaces = projected.get("spaces")
        projected["spaces"] = [
            space for space in spaces
            if isinstance(space, dict) and str(space.get("id", "")) == str(space_id)
        ] if isinstance(spaces, list) else spaces
    if marker_fields is not None:
        projected["markers"] = project_markers(projected.get("markers"), marker_fields)
    if field_names is not None:
        projected = {key: value for key, value in projected.items() if key in set(field_names)}
    return projected


def project_layout(layout: Any, *, space_id: str | None = None) -> Any:
    """Keep only the positions of one space."""
    if space_id is None or not isinstance(layout, dict):
        return layout
    wanted = str(space_id)
    return {
        key: position for key, position in layout.items()
        if isinstance(position, dict) and str(position.get("s", "")) == wanted
    }
