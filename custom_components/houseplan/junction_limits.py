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

import logging

from .wall_segment_model import (
    WALL_SEGMENT_MODEL_VERSION, WallSegmentMigrationError, commit_wall_segment_model,
)

_LOGGER = logging.getLogger(__name__)

MIN_JUNCTION_ANGLE_DEG = 15.0
MAX_JUNCTION_VALENCE = 6
MIN_SEGMENT_LENGTH_CM = 20.0
MIN_NODE_DISTANCE_CM = 5.0

GRID_STEP_N = 1 / 240

_EPS = 1e-9
# #331 §2.1: below this two points are ONE node / a node is ON the wall —
# floating debris of pre-canonicalisation arithmetic, not a near miss.
_INCIDENT_EPS = 2e-7
_KEY_FACTOR = 1e7


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


def _quantize_key_coord(value: float) -> float:
    """#331 §2.1: the canonicalisation formula — sign*floor(|v|*f+0.5)/f.

    Native round() is banker's rounding and parts ways with JS Math-style
    rounding on .5 ticks; coordinate canonicalisation already encodes this
    parity lesson, and node keys must follow it. -0 normalises to 0.
    """
    rounded = math.copysign(
        math.floor(abs(value) * _KEY_FACTOR + 0.5), value,
    ) / _KEY_FACTOR
    return 0.0 if rounded == 0 else rounded


def _key(point) -> str:
    return f"{_quantize_key_coord(point[0])},{_quantize_key_coord(point[1])}"


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
            # #331 §2.2: a ~0° delta IS a violation — same-direction rays are
            # a duplicated or overlaid wall (a butt joint yields 180°, not 0°).
            if degrees < smallest:
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


def _build_node_index(segments: list[dict]) -> dict[str, list[dict]]:
    by_node: dict[str, list[dict]] = {}
    for item in segments:
        for point in (item["a"], item["b"]):
            by_node.setdefault(_key(point), []).append(item)
    return by_node


def collinear_run_length_units(
    segment: dict, segments: list[dict],
    by_node_index: dict[str, list[dict]] | None = None,
) -> float:
    """Length of the WALL a segment belongs to, not of the atom.

    #331 §2.3/§2.4: an iterative edge walk over the collinear component — no
    recursion (a 10 000-atom chain must answer, not overflow), no
    combinatorial DFS (every atom joins at most once, O(E)), no silently
    dropped fork. Collinearity is measured against the BASE segment's axis,
    so an arc of small per-atom turns cannot pose as one straight wall.

    #330 §4.3: the per-check caller builds the node index once.
    """
    by_node = by_node_index if by_node_index is not None else _build_node_index(segments)
    visited = {id(segment)}
    total = _length(segment["a"], segment["b"])
    frontier = [segment["a"], segment["b"]]
    base_cm = float(segment.get("cm") or 0)
    while frontier:
        node = frontier.pop()
        for candidate in by_node.get(_key(node), ()):
            if id(candidate) in visited:
                continue
            if not _collinear(candidate, segment):
                continue
            if float(candidate.get("cm") or 0) != base_cm:
                continue
            visited.add(id(candidate))
            total += _length(candidate["a"], candidate["b"])
            frontier.append(candidate["a"])
            frontier.append(candidate["b"])
    return total

def check_segment_lengths(
    segments: list[dict], cell_cm: float, grid_pitch: float = GRID_STEP_N,
) -> list[tuple[str, str, float, float]]:
    """П3: a wall is at least 20 cm and never shorter than its own thickness."""
    violations: list[tuple[str, str, float, float]] = []
    by_node = _build_node_index(segments)
    for segment in segments:
        units = collinear_run_length_units(segment, segments, by_node)
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
    """П4: non-incident nodes and node-to-foreign-wall clearance.

    #330 §4.5: the all-pairs form cost 372 ms on 576 atoms. Nodes and padded
    segment bounding boxes are hashed into a grid with the threshold as cell
    size; each node is compared only against its 9-cell neighbourhood.
    Verdicts are identical — pinned by the equivalence unit and the parity
    suite. Pair order inside the subject follows the lexicographic key order,
    which replaces the i<j of the all-pairs loop.
    """
    nodes: dict[str, list] = {}
    for segment in segments:
        nodes[_key(segment["a"])] = segment["a"]
        nodes[_key(segment["b"])] = segment["b"]
    min_units = cm_to_units(MIN_NODE_DISTANCE_CM, cell_cm, grid_pitch)
    size = min_units if min_units > _EPS else 1.0

    node_grid: dict[tuple[int, int], list] = {}
    for node_key, point in nodes.items():
        node_grid.setdefault(
            (int(point[0] // size), int(point[1] // size)), []
        ).append((node_key, point))
    segment_grid: dict[tuple[int, int], list] = {}
    for segment in segments:
        x0 = min(segment["a"][0], segment["b"][0]) - min_units
        x1 = max(segment["a"][0], segment["b"][0]) + min_units
        y0 = min(segment["a"][1], segment["b"][1]) - min_units
        y1 = max(segment["a"][1], segment["b"][1]) + min_units
        for cx in range(int(x0 // size), int(x1 // size) + 1):
            for cy in range(int(y0 // size), int(y1 // size) + 1):
                segment_grid.setdefault((cx, cy), []).append(segment)

    violations: list[tuple[str, str, float, float]] = []
    for node_key, point in nodes.items():
        cx, cy = int(point[0] // size), int(point[1] // size)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for other_key, other in node_grid.get((cx + dx, cy + dy), ()):
                    if node_key >= other_key:
                        continue
                    distance = _length(point, other)
                    # #331 §2.1: raw debris within the incidence quantum is ONE
                    # node on two neighbouring keys — never a near miss.
                    if distance <= _INCIDENT_EPS:
                        continue
                    if distance < min_units - 1e-9:
                        violations.append((
                            "distance", f"{node_key} ↔ {other_key}",
                            (distance / grid_pitch) * (cell_cm or 1),
                            MIN_NODE_DISTANCE_CM,
                        ))
        for segment in segment_grid.get((cx, cy), ()):
            # A node that belongs to the wall is a legal corner or T-joint.
            if _key(segment["a"]) == node_key or _key(segment["b"]) == node_key:
                continue
            distance = _distance_to_segment(point, segment["a"], segment["b"])
            # Sitting exactly ON the wall is the other legal incidence.
            if distance <= _INCIDENT_EPS:
                continue
            if distance < min_units - 1e-9:
                violations.append((
                    "distance",
                    f"{node_key} → {segment.get('id') or _key(segment['a'])}",
                    (distance / grid_pitch) * (cell_cm or 1),
                    MIN_NODE_DISTANCE_CM,
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


def _migrated_spaces(config: dict | None, *, side: str = "previous") -> dict[str, dict]:
    """Spaces of one document AFTER the wall-segment migration, by id.

    The limits read `wall_segments`, so a document that predates the catalogue
    reports NO walls at all — a legacy space would answer "no violations"
    regardless of its geometry. Comparing such a baseline against a candidate
    the client already migrated counts every inherited violation as new and
    refuses an unrelated edit (spec §3 forbids exactly that). Both sides are
    therefore judged after the SAME migration, mirroring the frontend barrier.

    A document that cannot be migrated is not a reason to refuse the write:
    the wall-model barrier owns that verdict and reports it with its own code.
    Here it simply means there is no baseline to inherit from.
    """
    if not isinstance(config, dict):
        return {}
    # #330 §4.6: a document that already carries the current catalogue is
    # used as-is. The migration's purpose here is to never compare a
    # catalogue-less legacy baseline against a migrated candidate; a
    # current-version document has the catalogue, so the purpose is met with
    # zero work — while a no-op re-migration costs 0.8 s of _atomize on a
    # 576-atom plan. Equivalence "as-is == migrated" for current-version
    # documents is pinned by a parity case.
    if int(config.get("model_version") or 0) >= WALL_SEGMENT_MODEL_VERSION:
        migrated = config
    else:
        try:
            migrated, _ = commit_wall_segment_model(config)
        except (WallSegmentMigrationError, ValueError) as error:
            # The wall-model barrier owns this verdict and reports it with its
            # own code; here it merely means "no catalogue to read".
            _LOGGER.debug("junction limits: %s migration fell back: %s", side, error)
            migrated = config
        except Exception:
            # #331 §2.6 (AC6): a genuine migration bug on the CANDIDATE side
            # must surface as an honest WS error, not a silent "no
            # violations". The PREVIOUS side keeps the wide fallback — an
            # unprovable inheritance is no reason to block an unrelated write
            # (the exact P1 symptom this task fixes).
            if side == "candidate":
                raise
            _LOGGER.debug("junction limits: previous-side migration bug swallowed by design")
            migrated = config
    return {
        str(space.get("id")): space
        for space in (migrated or {}).get("spaces") or []
        if isinstance(space, dict)
    }


def space_violation_counts(spaces: dict[str, dict]) -> dict[str, dict[str, int]]:
    """Violation counts per space per rule — the shape the barrier consumes
    and the rev cache (#330 §4.2) stores. Documents are NOT retained."""
    result: dict[str, dict[str, int]] = {}
    for space_id, space in spaces.items():
        counts: dict[str, int] = {}
        for rule, _subject, _actual, _limit in space_violations(space):
            counts[rule] = counts.get(rule, 0) + 1
        result[space_id] = counts
    return result


def validate_junction_limits(
    config: dict, previous: dict | None = None, *,
    baseline_counts: dict[str, dict[str, int]] | None = None,
) -> dict[str, dict[str, int]]:
    """Refuse a write that ADDS a junction violation; inherit the rest.

    Counted per RULE, not per subject: a structural write re-atomises and
    re-keys contour segments, so subject identity is not stable across the
    barrier and matching by it would report an inherited violation as new
    (the mistake that refused legitimate resizes on the frontend). Spec §3:
    a write may keep existing violations, it may never add one.

    A LEGACY document still goes through `commit_wall_segment_model` first,
    so a catalogue-less baseline is compared in the same terms as the
    candidate; a current-version document is used as-is (#330 §4.6).

    `baseline_counts` (#330 §4.2) replaces the previous document entirely:
    the caller caches the counts of the stored document by config_rev, so a
    repeated write does not even touch `previous`. Returns the candidate's
    counts — the value to cache after a successful write.
    """
    if baseline_counts is not None:
        old_counts = baseline_counts
    else:
        old_counts = space_violation_counts(_migrated_spaces(previous))
    new_spaces = _migrated_spaces(config, side="candidate")
    candidate_counts: dict[str, dict[str, int]] = {}
    for space_id, space in new_spaces.items():
        # A brand-new space has nothing to inherit from — but neither is a
        # first write allowed to arrive already broken.
        before = old_counts.get(space_id) or {}
        after: dict[str, list[tuple[str, str, float, float]]] = {}
        for violation in space_violations(space):
            after.setdefault(violation[0], []).append(violation)
        candidate_counts[space_id] = {
            rule: len(items) for rule, items in after.items()
        }
        for rule, items in after.items():
            if len(items) > before.get(rule, 0):
                _, subject, actual, limit = items[0]
                raise JunctionLimitError(space_id, rule, subject, actual, limit)
    return candidate_counts
