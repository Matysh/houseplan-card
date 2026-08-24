"""Lossless, allow-listed canonicalisation of persisted geometry.

The frontend mirrors this module in src/coordinate-canonicalization.ts.
Keep the precision, lattice formula and field allow-list in lockstep; a shared
fixture is exercised by both runtimes.
"""
from __future__ import annotations

import copy
import math
from typing import Any


COORDINATE_DECIMALS = 9
COORDINATE_FACTOR = 10**COORDINATE_DECIMALS
LATTICE_GRID_N = 240
LATTICE_NOISE_STEPS = 1e-4


def canonicalize_number(value: Any) -> Any:
    """Return one stable IEEE-754 representation for an allow-listed scalar."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return value
    number = float(value)
    if not math.isfinite(number):
        return value
    sign = -1.0 if math.copysign(1.0, number) < 0 else 1.0
    result = sign * (
        math.floor(abs(number) * COORDINATE_FACTOR + 0.5)
        / COORDINATE_FACTOR
    )
    if result == 0:
        return 0.0
    return result


def canonicalize_lattice_coordinate(value: Any) -> Any:
    """Collapse near-node noise while preserving authored off-grid values."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return value
    number = float(value)
    if not math.isfinite(number):
        return value
    scaled = number * LATTICE_GRID_N
    # JavaScript Math.round: ties go toward +infinity, unlike Python round().
    nearest = math.floor(scaled + 0.5)
    if abs(scaled - nearest) < LATTICE_NOISE_STEPS:
        result = nearest / LATTICE_GRID_N
        return 0.0 if result == 0 else result
    return canonicalize_number(number)


def _record(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def _records(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _scalar_fields(record: dict[str, Any], names: tuple[str, ...]) -> None:
    for name in names:
        if name in record:
            record[name] = canonicalize_number(record[name])


def _lattice_fields(record: dict[str, Any], names: tuple[str, ...]) -> None:
    for name in names:
        if name in record:
            record[name] = canonicalize_lattice_coordinate(record[name])


def _lattice_point(value: Any) -> None:
    if not isinstance(value, list):
        return
    for index in range(min(2, len(value))):
        value[index] = canonicalize_lattice_coordinate(value[index])


def _lattice_points(value: Any) -> None:
    if not isinstance(value, list):
        return
    for point in value:
        _lattice_point(point)


def canonicalize_position(position: Any) -> Any:
    """Canonicalise lattice x/y in one layout record, preserving metadata."""
    result = copy.deepcopy(position)
    record = _record(result)
    if record is not None:
        _lattice_fields(record, ("x", "y"))
    return result


def canonicalize_layout_geometry(layout: Any) -> Any:
    """Canonicalise lattice x/y in every layout record."""
    result = copy.deepcopy(layout)
    record = _record(result)
    if record is None:
        return result
    for position in record.values():
        item = _record(position)
        if item is not None:
            _lattice_fields(item, ("x", "y"))
    return result


def canonicalize_config_geometry(config: Any) -> Any:
    """Canonicalise only the named persisted geometry fields."""
    result = copy.deepcopy(config)
    root = _record(result)
    if root is None:
        return result

    for space in _records(root.get("spaces")):
        _scalar_fields(
            space,
            (
                "plan_x",
                "plan_y",
                "plan_scale",
                "plan_scale_x",
                "plan_scale_y",
                "plan_angle",
            ),
        )

        for room in _records(space.get("rooms")):
            _lattice_fields(room, ("x", "y", "w", "h"))
            _lattice_points(room.get("poly"))

        for wall in _records(space.get("walls")):
            _lattice_point(wall.get("a"))
            _lattice_point(wall.get("b"))

        for opening in _records(space.get("openings")):
            _lattice_fields(opening, ("x", "y"))
            _scalar_fields(opening, ("angle", "length"))
            host = _record(opening.get("host"))
            if host is not None:
                _scalar_fields(host, ("t",))

        for decor in _records(space.get("decor")):
            kind = decor.get("kind")
            if kind == "line":
                _lattice_fields(decor, ("x1", "y1", "x2", "y2"))
            elif kind in ("rect", "ellipse", "furniture"):
                _lattice_fields(decor, ("x", "y", "w", "h"))
                _scalar_fields(decor, ("angle",))
            elif kind == "text":
                _lattice_fields(decor, ("x", "y"))
                _scalar_fields(decor, ("scale", "angle"))

        for draft in _records(space.get("room_drafts")):
            _lattice_points(draft.get("points"))

        for partition in _records(space.get("partitions")):
            _lattice_point(partition.get("a"))
            _lattice_point(partition.get("b"))

        for column in _records(space.get("wall_columns")):
            _lattice_point(column.get("center"))
            if column.get("shape") == "square":
                _scalar_fields(column, ("angle",))

        for span in _records(space.get("open_spans")):
            _lattice_point(span.get("a"))
            _lattice_point(span.get("b"))

    for marker in _records(root.get("markers")):
        _scalar_fields(marker, ("angle",))

    return result
