"""LED strips: stored shape, link normalisation and transfer rules (#780).

A strip is optional geometry of a space::

    space.led_strips = [{"id": str, "points": [[x, y], ...],
                         "marker": str | None, "active": bool (optional)}]

``active`` is the representation of the bound marker: absent/``True`` draws
the strip, ``False`` keeps the shape hidden while the same marker is shown as
an ordinary icon. It is neither ``marker.hidden`` nor the power state.

The module is pure (voluptuous only), so the schema, the write-path
normalisation and the import/plan-only projections are exercised by the pure
pytest suite without Home Assistant.

Write-path order (ТЗ #780 §9):

1. structure, types and limits (``LED_STRIPS_SCHEMA`` inside ``SPACE_SCHEMA``);
2. per-space invariants and duplicate links — **before** any normalisation, so
   two strips pointing at the same missing id are still a conflict;
3. normalisation: a link to a marker that is not live in the resulting config
   becomes an unbound strip (``marker: None, active: True``) with its id and
   points intact — a client that does not know about strips may delete a bound
   marker and its save must not fail; a live marker with an empty ``space``
   adopts the strip's space;
4. referential check: a live marker with a non-empty foreign ``space``
   rejects the whole write.
"""
from __future__ import annotations

import copy
import math
from collections.abc import Iterator
from typing import Any

import voluptuous as vol

MAX_LED_STRIPS = 50
MAX_LED_POINTS = 50
LED_ID_MAX = 64
LED_MARKER_MAX = 500
CANVAS_LIMIT = 5000.0

LED_KEY = "led_strips"


def _coordinate(value: Any) -> float:
    """A stored coordinate: a real finite number, never a string or a bool."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise vol.Invalid("LED strip coordinate must be a number")
    number = float(value)
    if not math.isfinite(number):
        raise vol.Invalid("LED strip coordinate must be finite")
    if abs(number) > CANVAS_LIMIT:
        raise vol.Invalid("LED strip coordinate is outside the canvas")
    return number


def _strict_bool(value: Any) -> bool:
    if not isinstance(value, bool):
        raise vol.Invalid("LED strip active must be a boolean")
    return value


def _marker_ref(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not value or len(value) > LED_MARKER_MAX:
        raise vol.Invalid("LED strip marker must be a non-empty string or null")
    return value


def _strip_id(value: Any) -> str:
    if not isinstance(value, str) or not value or len(value) > LED_ID_MAX:
        raise vol.Invalid("LED strip id must be a non-empty string")
    return value


_POINT = vol.All([_coordinate], vol.Length(min=2, max=2))

LED_STRIP_SCHEMA = vol.Schema(
    {
        vol.Required("id"): _strip_id,
        vol.Required("points"): vol.All(
            list, vol.Length(min=2, max=MAX_LED_POINTS), [_POINT],
        ),
        vol.Optional("marker", default=None): _marker_ref,
        vol.Optional("active"): _strict_bool,
    },
    extra=vol.ALLOW_EXTRA,
)

LED_STRIPS_SCHEMA = vol.All(list, vol.Length(max=MAX_LED_STRIPS), [LED_STRIP_SCHEMA])


def _same(a: list[Any], b: list[Any]) -> bool:
    return float(a[0]) == float(b[0]) and float(a[1]) == float(b[1])


def strip_is_closed(points: list[Any]) -> bool:
    return len(points) >= 4 and _same(points[0], points[-1])


def polyline_length(points: list[Any]) -> float:
    total = 0.0
    for index in range(1, len(points)):
        ax, ay = points[index - 1]
        bx, by = points[index]
        total += math.hypot(float(bx) - float(ax), float(by) - float(ay))
    return total


def _distinct_vertices(points: list[Any]) -> int:
    seen: set[tuple[float, float]] = set()
    for point in points:
        seen.add((float(point[0]), float(point[1])))
    return len(seen)


def validate_strip_shape(strip: dict[str, Any]) -> None:
    """Geometry invariants that the type schema cannot express."""
    points = strip["points"]
    if _distinct_vertices(points) < 2 or not polyline_length(points) > 0:
        raise vol.Invalid("LED strip needs at least two distinct points")
    if _same(points[0], points[-1]) and len(points) > 2:
        # A repeated first point closes the strip: three distinct vertices.
        if _distinct_vertices(points[:-1]) < 3:
            raise vol.Invalid("a closed LED strip needs three distinct vertices")
    if strip.get("active") is False and not isinstance(strip.get("marker"), str):
        raise vol.Invalid("a hidden LED strip shape must belong to a marker")


class LedStripLinkError(ValueError):
    """A write that cannot be normalised: duplicate or foreign link."""

    code = "invalid_led_strip"

    def __init__(self, reason: str) -> None:
        # Marker ids may carry user-controlled HA identifiers: a stable
        # message without the value, like DuplicateMarkerIdError.
        super().__init__(reason)
        self.reason = reason


def _live_markers(config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    live: dict[str, dict[str, Any]] = {}
    for marker in config.get("markers") or []:
        if not isinstance(marker, dict) or marker.get("removed") is True:
            continue
        marker_id = marker.get("id")
        if isinstance(marker_id, str) and marker_id and marker_id not in live:
            live[marker_id] = marker
    return live


def _strips(config: dict[str, Any]) -> Iterator[tuple[dict[str, Any], dict[str, Any]]]:
    for space in config.get("spaces") or []:
        if not isinstance(space, dict):
            continue
        for strip in space.get(LED_KEY) or []:
            if isinstance(strip, dict):
                yield space, strip


def preserve_led_strips(config: dict[str, Any], previous: dict[str, Any] | None) -> int:
    """An ordinary writer that omits ``led_strips`` keeps the stored shapes (#780 r1 H1).

    A previous frontend does not know the field and sends every space without
    it; the omission is not a deletion. A new client deletes shapes by sending
    an explicit list (``[]`` removes all of them). Applies to spaces that keep
    their id; a space the writer removed takes its strips with it. Runs on the
    ordinary write path before normalisation, so a preserved link to a marker
    the same write deleted becomes an unbound strip by the usual rule.
    Returns how many spaces received their stored shapes back.
    """
    stored = {
        space.get("id"): space[LED_KEY]
        for space in (previous or {}).get("spaces") or []
        if isinstance(space, dict) and isinstance(space.get(LED_KEY), list) and space[LED_KEY]
    }
    restored = 0
    for space in config.get("spaces") or []:
        if not isinstance(space, dict) or LED_KEY in space:
            continue
        shapes = stored.get(space.get("id"))
        if shapes:
            space[LED_KEY] = copy.deepcopy(shapes)
            restored += 1
    return restored


def led_strip_link_report(config: dict[str, Any]) -> dict[str, int]:
    """What the normaliser would change, without changing anything.

    The write path answers the client with these counters so a new client
    knows to re-read; an old client ignores the extra keys.
    """
    live = _live_markers(config)
    unbound = adopted = 0
    for _space, strip in _strips(config):
        ref = strip.get("marker")
        if not isinstance(ref, str) or not ref:
            continue
        marker = live.get(ref)
        if marker is None:
            unbound += 1
        elif marker.get("space") in (None, ""):
            adopted += 1
    return {"unbound": unbound, "space_adopted": adopted}


def normalize_led_strip_links(config: dict[str, Any]) -> dict[str, Any]:
    """Validate and normalise every strip of a whole configuration in place.

    Runs after the type schema and the coordinate canonicalisation, so the
    shape invariants judge the stored numbers.
    """
    taken: set[str] = set()
    for space in config.get("spaces") or []:
        if not isinstance(space, dict):
            continue
        ids: set[str] = set()
        for strip in space.get(LED_KEY) or []:
            if strip["id"] in ids:
                raise vol.Invalid("LED strip ids must be unique within a space")
            ids.add(strip["id"])
            validate_strip_shape(strip)
            ref = strip.get("marker")
            if isinstance(ref, str):
                if ref in taken:
                    raise LedStripLinkError("a marker is bound to more than one LED strip")
                taken.add(ref)
    live = _live_markers(config)
    for space, strip in _strips(config):
        ref = strip.get("marker")
        if not isinstance(ref, str):
            strip["marker"] = None
            continue
        marker = live.get(ref)
        if marker is None:
            strip["marker"] = None
            strip["active"] = True
            continue
        owner = marker.get("space")
        if owner in (None, ""):
            marker["space"] = space["id"]
        elif owner != space["id"]:
            raise LedStripLinkError("an LED strip is bound to a marker of another space")
    return config


def config_led_strip_links(config: dict[str, Any]) -> dict[str, Any]:
    """voluptuous step for CONFIG_SCHEMA: ``LedStripLinkError`` → ``vol.Invalid``."""
    try:
        return normalize_led_strip_links(config)
    except LedStripLinkError as err:
        raise vol.Invalid(f"{LedStripLinkError.code}: {err.reason}") from err


def unbind_strips(space: dict[str, Any], keep: set[str] | None = None,
                  remap: dict[str, str] | None = None) -> int:
    """Transfer rule for imports/copies: remap a link or make the strip unbound.

    ``remap`` maps the source marker id to the id it received in the target;
    a marker that was not transferred (skipped duplicate, plan-only, dropped)
    leaves an unbound strip with ``active: True``. Returns how many strips
    became unbound, for the import summary.
    """
    unbound = 0
    for strip in space.get(LED_KEY) or []:
        if not isinstance(strip, dict):
            continue
        ref = strip.get("marker")
        if not isinstance(ref, str) or not ref:
            strip["marker"] = None
            continue
        target = (remap or {}).get(ref)
        if target is None and keep is not None and ref in keep:
            target = ref
        if target is None:
            strip["marker"] = None
            strip["active"] = True
            unbound += 1
        else:
            strip["marker"] = target
    return unbound


def plan_only_strips(space: dict[str, Any]) -> list[dict[str, Any]] | None:
    """Plan-only export: geometry stays, device links never leak."""
    if LED_KEY not in space:
        return None
    projected = []
    for strip in space.get(LED_KEY) or []:
        if not isinstance(strip, dict):
            continue
        projected.append({
            "id": strip.get("id"),
            "points": [list(point) for point in strip.get("points") or []],
            "marker": None,
            "active": True,
        })
    return projected


def led_strip_counts(config: dict[str, Any]) -> dict[str, int]:
    """Support-package counters: no coordinates, names or HA identifiers."""
    total = unbound = hidden = 0
    for _space, strip in _strips(config):
        total += 1
        if not isinstance(strip.get("marker"), str):
            unbound += 1
        elif strip.get("active") is False:
            hidden += 1
    return {"led_strips": total, "led_strips_unbound": unbound, "led_strips_hidden": hidden}
