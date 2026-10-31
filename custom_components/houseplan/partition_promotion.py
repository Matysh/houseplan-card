"""Pure proof of the full same-ID wall promotion used by ordinary writes (#996)."""
from __future__ import annotations

import math

from .coordinate_canonicalization import canonicalize_lattice_coordinate
from .junction_limits import _INCIDENT_EPS, _stored_wall_contact

_EPS = 1e-8  # normalized storage/projection tolerance, as in Optimize rehosting
_WALL_KEYS = {"id", "a", "b", "cm"}


def _point_equal(first: list, second: list) -> bool:
    return all(abs(float(a) - float(b)) <= _EPS for a, b in zip(first, second, strict=True))


def _geometry(opening: dict, axis: dict) -> tuple[float, float, float, float] | None:
    a, b = axis["a"], axis["b"]
    dx, dy = float(b[0]) - float(a[0]), float(b[1]) - float(a[1])
    span = math.hypot(dx, dy)
    t, length = float(opening["host"]["t"]), float(opening["length"])
    if (not all(math.isfinite(value) for value in (*a, *b, t, length, span))
            or span <= _EPS or not 0 <= t <= 1 or length <= 0
            or t * span - length / 2 < -_EPS or t * span + length / 2 > span + _EPS):
        return None
    return float(a[0]) + dx * t, float(a[1]) + dy * t, math.degrees(math.atan2(dy, dx)), length


def _angle_equal(first: float, second: float) -> bool:
    delta = abs(first - second) % 180
    return min(delta, 180 - delta) <= 1e-7


def _same_json_fields(before: dict, after: dict) -> bool:
    """JSON booleans are not numbers; numeric 1/1.0 round-trips remain equal.

    An explicit stack handles nested future fields without a recursion limit.
    Both inputs are already bounded JSON documents at the ordinary writer.
    """
    pending = [(before, after)]
    while pending:
        first, second = pending.pop()
        if (isinstance(first, bool) or isinstance(second, bool)) and type(first) is not type(second):
            return False
        if isinstance(first, dict) and isinstance(second, dict):
            if first.keys() != second.keys():
                return False
            pending.extend((value, second[key]) for key, value in first.items())
        elif isinstance(first, list) and isinstance(second, list):
            if len(first) != len(second):
                return False
            pending.extend(zip(first, second, strict=True))
        elif first != second:
            return False
    return True


def same_partition_wall_promotion(
    old_opening: dict, opening: dict, partition: dict | None, wall: dict | None,
) -> bool:
    """Prove representation change, never grant a new carrier or geometry edit.

    The caller resolves both axes in the SAME space, proves room ownership and
    absence of a surviving partition, and keeps schema/model/CAS checks intact.
    No frontend assertion or Optimize capability participates in this proof.
    """
    old_host, host = old_opening.get("host"), opening.get("host")
    if (not isinstance(old_host, dict) or not isinstance(host, dict)
            or old_host.get("kind") != "partition" or host.get("kind") != "wall"
            or not old_host.get("id") or old_host.get("id") != host.get("id")
            or partition is None or wall is None
            or partition.get("id") != host["id"] or wall.get("id") != host["id"]
            or not set(partition).issubset(_WALL_KEYS) or not set(wall).issubset(_WALL_KEYS)):
        return False
    ignored = {"host", "x", "y", "angle"}
    if not _same_json_fields(
        {key: value for key, value in old_opening.items() if key not in ignored},
        {key: value for key, value in opening.items() if key not in ignored},
    ):
        return False
    try:
        cm = float(partition["cm"])
        if not math.isfinite(cm) or cm <= 0 or cm != float(wall["cm"]):
            return False
        if not all(isinstance(axis.get(key), list) and len(axis[key]) == 2
                   for axis in (partition, wall) for key in ("a", "b")):
            return False
        if not any(_point_equal(partition["a"], wall[first])
                   and _point_equal(partition["b"], wall[second])
                   for first, second in (("a", "b"), ("b", "a"))):
            return False
        old, new = _geometry(old_opening, partition), _geometry(opening, wall)
        if old is None or new is None:
            return False
        x, y, angle = float(opening["x"]), float(opening["y"]), float(opening["angle"])
        return (all(math.isfinite(value) for value in (x, y, angle))
                and _point_equal(old[:2], new[:2]) and old[3] == new[3]
                and _angle_equal(old[2], new[2]) and _angle_equal(angle, new[2])
                and _point_equal([x, y], new[:2]))
    except (KeyError, TypeError, ValueError, OverflowError):
        return False


def same_partition_wall_chain_promotion(
    old_opening: dict, opening: dict, partition: dict | None,
    walls: list[dict], room_wall_ids: set[str], old_axes: list[dict],
) -> bool:
    """Prove a fully consumed carrier became an exact contiguous wall chain.

    Room creation can atomize a carrier at existing T nodes. Its opening must
    retain all metadata and physical geometry on one of those exact atoms;
    neither a gap nor a changed thickness/carrier grants ordinary rehosting.
    The caller proves the original partition no longer survives in this space.
    """
    if partition is None or not set(partition).issubset(_WALL_KEYS):
        return False
    old_host, host = old_opening.get("host"), opening.get("host")
    if (not isinstance(old_host, dict) or not isinstance(host, dict)
            or old_host.get("kind") != "partition" or host.get("kind") != "wall"
            or old_host.get("id") != partition.get("id") or host.get("id") not in room_wall_ids):
        return False
    ignored = {"host", "x", "y", "angle"}
    if not _same_json_fields(
        {key: value for key, value in old_opening.items() if key not in ignored},
        {key: value for key, value in opening.items() if key not in ignored},
    ):
        return False
    try:
        a, b = partition["a"], partition["b"]
        dx, dy = b[0] - a[0], b[1] - a[1]
        span = math.hypot(dx, dy)
        cm = float(partition["cm"])
        if not math.isfinite(span) or span <= _EPS or not math.isfinite(cm) or cm <= 0:
            return False
        def same_end(old: list, new: list) -> bool:
            if _point_equal(old, new):
                return True
            if math.dist(old, new) > _INCIDENT_EPS:
                return False
            # Reuse the existing P4 incidence only for a proved old interior T.
            # A near authored end or a general geometry move grants nothing.
            for axis in old_axes:
                if axis.get("id") == partition.get("id"):
                    continue
                left, right = axis["a"], axis["b"]
                ux, uy = right[0] - left[0], right[1] - left[1]
                length = math.hypot(ux, uy)
                if length <= _EPS or abs(dx * uy - dy * ux) <= span * length * 1e-7:
                    continue
                t = ((old[0] - left[0]) * ux + (old[1] - left[1]) * uy) / length ** 2
                q = [left[0] + t * ux, left[1] + t * uy]
                if 0 < t < 1 and math.dist(old, q) <= _INCIDENT_EPS and _point_equal(q, new):
                    return True
            return False

        ranges = []
        target = None
        for wall in walls:
            if wall.get("id") not in room_wall_ids:
                continue
            ends = [wall["a"], wall["b"]]
            if not all(math.isfinite(float(value)) for end in ends for value in end):
                return False
            if any(abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / span > _EPS for p in ends):
                continue
            lo, hi = sorted(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / span for p in ends)
            if hi <= _EPS or lo >= span - _EPS:
                continue
            if (lo < -_INCIDENT_EPS or hi > span + _INCIDENT_EPS or float(wall["cm"]) != cm
                    or not set(wall).issubset(_WALL_KEYS)):
                return False
            ordered_ends = sorted(ends, key=lambda p: (p[0] - a[0]) * dx + (p[1] - a[1]) * dy)
            ranges.append((lo, hi, ordered_ends))
            if wall["id"] == host["id"]:
                target = wall
        ranges.sort(key=lambda item: item[0])
        if len(ranges) == 1 and host["id"] != partition["id"]:
            return False  # #996: a single unchanged carrier keeps its identity
        if not ranges or not same_end(a, ranges[0][2][0]) or not same_end(b, ranges[-1][2][1]):
            return False
        covered = ranges[0][0]
        for lo, hi, _ in ranges:
            if abs(lo - covered) > _EPS:
                return False  # a gap or overlapping physical atoms
            covered = hi
        if target is None:
            return False
        old, new = _geometry(old_opening, partition), _geometry(opening, target)
        if old is None or new is None:
            return False
        x, y, angle = float(opening["x"]), float(opening["y"]), float(opening["angle"])
        same_center = _point_equal(old[:2], new[:2]) or (
            math.dist(old[:2], new[:2]) <= _INCIDENT_EPS
            and [canonicalize_lattice_coordinate(value) for value in old[:2]]
            == [canonicalize_lattice_coordinate(value) for value in new[:2]]
        )
        return (all(math.isfinite(value) for value in (x, y, angle))
                and same_center and old[3] == new[3]
                and _stored_wall_contact(target["a"], a, b, finite=False)
                and _stored_wall_contact(target["b"], a, b, finite=False)
                and _angle_equal(angle, old[2])
                and (_point_equal([x, y], new[:2]) or _point_equal(
                    [x, y], [canonicalize_lattice_coordinate(value) for value in new[:2]],
                )))
    except (KeyError, TypeError, ValueError, OverflowError):
        return False
