"""Issue #329 — wall junction limits, Python mirror of src/junction-limits.ts.

The card refuses a WRITE that would ADD a junction violation; this module is
the backend half of that contract, so a stale or hostile client cannot post
what the editor refuses. It mirrors П1–П4 exactly, including the two legal
incidences of П4 (a shared node and a T-joint into the middle of a foreign
wall) and the П3 rule that measures the collinear same-thickness WALL RUN
rather than one catalogue atom.

П5 (the room keeps at least 25 cm² of interior) is deliberately NOT mirrored:
it is a statement about the rendered wall bodies, and reproducing the mitre /
inset pipeline in Python would be a second geometry implementation whose drift
is a larger risk than the rule it guards. A document that violates only П5 is
ugly, not corrupt — see docs/specs/329-junction-limits.md §5.
"""

from __future__ import annotations

import math

MIN_JUNCTION_ANGLE_DEG = 15.0
MAX_JUNCTION_VALENCE = 6
MIN_SEGMENT_LENGTH_CM = 20.0
MIN_NODE_DISTANCE_CM = 5.0

GRID_STEP_N = 1 / 240

_EPS = 1e-9
# Below this a node is ON the wall (T-joint), not near it.
_INCIDENT_EPS = 1e-9


class JunctionLimitError(ValueError):
    """A write introduced a wall-junction violation (#329)."""

    def __init__(self, space_id: str, rule: str, subject: str,
                 actual: float, limit: float) -> None:
        self.space_id = space_id
        self.rule = rule
        self.subject = subject
        self.actual = actual
        self.limit = limit
        self.code = f"junction_limit_{rule}"
        super().__init__(
            f"space={space_id}; rule={rule}; subject={subject}; "
            f"actual={actual:.12g}; limit={limit:.12g}"
        )


def _finite_point(point: object) -> bool:
    return (
        isinstance(point, (list, tuple))
        and len(point) >= 2
        and all(isinstance(value, (int, float)) and math.isfinite(value)
                for value in point[:2])
    )


def _key(point) -> str:
    return f"{point[0]:.6f},{point[1]:.6f}"


def _length(a, b) -> float:
    return math.hypot(b[0] - a[0], b[1] - a[1])


def cm_to_units(cm: float, cell_cm: float, grid_pitch: float = GRID_STEP_N) -> float:
    return (cm / (cell_cm or 1)) * grid_pitch


def limit_segments(space: dict) -> list[dict]:
    """Every wall the limits judge: contour atoms, partitions, draft segments."""
    segments: list[dict] = []
    for segment in space.get("wall_segments") or []:
        if _finite_point(segment.get("a")) and _finite_point(segment.get("b")):
            segments.append({
                "id": str(segment.get("id") or ""),
                "a": segment["a"], "b": segment["b"],
                "cm": float(segment.get("cm") or 0),
            })
    for partition in space.get("partitions") or []:
        if _finite_point(partition.get("a")) and _finite_point(partition.get("b")):
            segments.append({
                "id": str(partition.get("id") or ""),
                "a": partition["a"], "b": partition["b"],
                "cm": float(partition.get("cm") or 0),
            })
    for draft in space.get("room_drafts") or []:
        points = draft.get("points") or []
        drafted = draft.get("segments") or []
        for index in range(max(len(points) - 1, 0)):
            if not (_finite_point(points[index]) and _finite_point(points[index + 1])):
                continue
            piece = drafted[index] if index < len(drafted) else {}
            segments.append({
                "id": str((piece or {}).get("id")
                          or f"{draft.get('id') or 'draft'}-{index}"),
                "a": points[index], "b": points[index + 1],
                "cm": float((piece or {}).get("cm") or 0),
            })
    return [segment for segment in segments
            if _length(segment["a"], segment["b"]) > _EPS]


def check_nodes(segments: list[dict]) -> list[tuple[str, str, float, float]]:
    """П1 + П2: valence of a node and the narrowest wedge in it."""
    rays: dict[str, list[float]] = {}
    for segment in segments:
        for start, end in ((segment["a"], segment["b"]), (segment["b"], segment["a"])):
            rays.setdefault(_key(start), []).append(
                math.atan2(end[1] - start[1], end[0] - start[0])
            )
    violations: list[tuple[str, str, float, float]] = []
    for node, angles in rays.items():
        if len(angles) > MAX_JUNCTION_VALENCE:
            violations.append(
                ("valence", node, float(len(angles)), float(MAX_JUNCTION_VALENCE))
            )
        if len(angles) < 2:
            continue
        ordered = sorted(angles)
        smallest = math.inf
        for index, value in enumerate(ordered):
            delta = ordered[(index + 1) % len(ordered)] - value
            if index == len(ordered) - 1:
                delta += math.pi * 2
            degrees = (delta * 180) / math.pi
            # Collinear rays of one straight wall are a 180° pair, not a wedge.
            if _EPS < degrees < smallest:
                smallest = degrees
        if smallest < MIN_JUNCTION_ANGLE_DEG - 1e-9:
            violations.append(("angle", node, smallest, MIN_JUNCTION_ANGLE_DEG))
    return violations


def _axis_degrees(segment: dict) -> float:
    degrees = math.degrees(math.atan2(
        segment["b"][1] - segment["a"][1], segment["b"][0] - segment["a"][0]
    ))
    return (degrees % 180 + 180) % 180


def _collinear(left: dict, right: dict, tolerance_deg: float = 1.0) -> bool:
    delta = abs(_axis_degrees(left) - _axis_degrees(right))
    return min(delta, 180 - delta) <= tolerance_deg


def collinear_run_length_units(segment: dict, segments: list[dict]) -> float:
    """Length of the WALL a segment belongs to, not of the atom.

    Atomisation at a thickness step leaves pieces nobody drew — where a 30 cm
    wall meets a 20 cm one, a (30−20)/2 = 5 cm piece continues the same wall.
    They are collinear continuations at the same thickness, so П3 measures the
    maximal collinear chain through the segment's nodes.
    """
    by_node: dict[str, list[dict]] = {}
    for item in segments:
        for point in (item["a"], item["b"]):
            by_node.setdefault(_key(point), []).append(item)
    visited = [segment]
    total = _length(segment["a"], segment["b"])

    def walk(current: dict, node: str) -> None:
        nonlocal total
        for candidate in by_node.get(node, []):
            if any(candidate is seen for seen in visited):
                continue
            if not _collinear(candidate, current):
                continue
            if float(candidate.get("cm") or 0) != float(current.get("cm") or 0):
                continue
            visited.append(candidate)
            total += _length(candidate["a"], candidate["b"])
            walk(candidate, _key(candidate["b"])
                 if _key(candidate["a"]) == node else _key(candidate["a"]))
            return

    walk(segment, _key(segment["a"]))
    walk(segment, _key(segment["b"]))
    return total


def check_segment_lengths(
    segments: list[dict], cell_cm: float, grid_pitch: float = GRID_STEP_N,
) -> list[tuple[str, str, float, float]]:
    """П3: a wall is at least 20 cm and never shorter than its own thickness."""
    violations: list[tuple[str, str, float, float]] = []
    for segment in segments:
        units = collinear_run_length_units(segment, segments)
        cm = (units / grid_pitch) * (cell_cm or 1)
        thickness = float(segment.get("cm") or 0)
        limit = max(MIN_SEGMENT_LENGTH_CM, thickness if thickness > 0 else 0.0)
        if cm < limit - 1e-9:
            violations.append((
                "length", str(segment.get("id") or _key(segment["a"])), cm, limit,
            ))
    return violations


def _distance_to_segment(point, a, b) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    length_sq = dx * dx + dy * dy
    t = 0.0 if length_sq <= _EPS else max(0.0, min(1.0, (
        (point[0] - a[0]) * dx + (point[1] - a[1]) * dy
    ) / length_sq))
    return math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dy * t))


def check_node_distances(
    segments: list[dict], cell_cm: float, grid_pitch: float = GRID_STEP_N,
) -> list[tuple[str, str, float, float]]:
    """П4: non-incident nodes and node-to-foreign-wall clearance."""
    nodes: dict[str, list] = {}
    for segment in segments:
        nodes[_key(segment["a"])] = segment["a"]
        nodes[_key(segment["b"])] = segment["b"]
    min_units = cm_to_units(MIN_NODE_DISTANCE_CM, cell_cm, grid_pitch)
    violations: list[tuple[str, str, float, float]] = []
    entries = list(nodes.items())
    for i in range(len(entries)):
        for j in range(i + 1, len(entries)):
            distance = _length(entries[i][1], entries[j][1])
            if distance < min_units - 1e-9:
                violations.append((
                    "distance", f"{entries[i][0]} ↔ {entries[j][0]}",
                    (distance / grid_pitch) * (cell_cm or 1), MIN_NODE_DISTANCE_CM,
                ))
    for node_key, node in nodes.items():
        for segment in segments:
            # A node that belongs to the wall is a legal corner or T-joint.
            if _key(segment["a"]) == node_key or _key(segment["b"]) == node_key:
                continue
            distance = _distance_to_segment(node, segment["a"], segment["b"])
            # Sitting exactly ON the wall is the other legal incidence.
            if distance <= _INCIDENT_EPS:
                continue
            if distance < min_units - 1e-9:
                violations.append((
                    "distance",
                    f"{node_key} → {segment.get('id') or _key(segment['a'])}",
                    (distance / grid_pitch) * (cell_cm or 1), MIN_NODE_DISTANCE_CM,
                ))
    return violations


def space_violations(space: dict) -> list[tuple[str, str, float, float]]:
    """П1–П4 over one space, in the frontend's order."""
    segments = limit_segments(space)
    cell_cm = float(space.get("cell_cm") or 1)
    return [
        *check_nodes(segments),
        *check_segment_lengths(segments, cell_cm),
        *check_node_distances(segments, cell_cm),
    ]


def validate_junction_limits(config: dict, previous: dict | None = None) -> None:
    """Refuse a write that ADDS a junction violation; inherit the rest.

    Counted per RULE, not per subject: a structural write re-atomises and
    re-keys contour segments, so subject identity is not stable across the
    barrier and matching by it would report an inherited violation as new
    (the mistake that refused legitimate resizes on the frontend). Spec §3:
    a write may keep existing violations, it may never add one.
    """
    old_spaces = {
        str(space.get("id")): space
        for space in (previous or {}).get("spaces") or []
    }
    for space in config.get("spaces") or []:
        space_id = str(space.get("id", ""))
        old_space = old_spaces.get(space_id)
        if old_space is None:
            # A brand-new space has nothing to inherit from — but neither is a
            # first write allowed to arrive already broken.
            before: dict[str, int] = {}
        else:
            before = {}
            for rule, _subject, _actual, _limit in space_violations(old_space):
                before[rule] = before.get(rule, 0) + 1
        after: dict[str, list[tuple[str, str, float, float]]] = {}
        for violation in space_violations(space):
            after.setdefault(violation[0], []).append(violation)
        for rule, items in after.items():
            if len(items) > before.get(rule, 0):
                _, subject, actual, limit = items[0]
                raise JunctionLimitError(space_id, rule, subject, actual, limit)
