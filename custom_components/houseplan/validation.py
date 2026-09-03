"""Pure House Plan validation and sanitizers — no Home Assistant dependencies.

Kept separate so it can be covered by unit tests (only voluptuous is needed).
"""
from __future__ import annotations

import copy
import json
import math
import re
from collections import Counter

import voluptuous as vol

from custom_components.houseplan.coordinate_canonicalization import (
    canonicalize_config_geometry,
    canonicalize_layout_geometry,
    canonicalize_position,
)
from custom_components.houseplan.vacuum_routes import validate_marker_routes

# ---------- limits and extension sets ----------
PLAN_EXTENSIONS = {"svg": "image/svg+xml", "png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}
MAX_PLAN_BYTES = 8 * 1024 * 1024
FILE_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "webp", "txt"}
MAX_FILE_BYTES = 50 * 1024 * 1024

SPACE_ID_RE = re.compile(r"^[a-z0-9_-]{1,64}$")
_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
# The name length the content view will accept back in a request. Anything a
# generated name must fit inside, collision tag included (HP-1460-01).
MAX_FILENAME = 120
MARKER_CONTROL_PREFIX = "marker:"
_CONTROL_ENTITY_ID_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+\Z")


class MarkerControlError(ValueError):
    """Semantic marker-link error with a stable public code."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class OpeningPassageError(ValueError):
    """Semantic open-passage error with a stable public code and payload."""

    code = "invalid_passage_fields"

    def __init__(self, space_id: str, opening_id: str, fields: list[str]) -> None:
        self.space_id = space_id
        self.opening_id = opening_id
        self.fields = tuple(sorted(fields))
        # #42: structured details as JSON — the frontend parses this instead
        # of regexing an English sentence; the legacy "space=..;.." format is
        # still accepted there for one beta.
        super().__init__(json.dumps({
            "space": space_id, "opening": opening_id, "fields": list(self.fields),
        }, ensure_ascii=False))


class PartitionOpeningHostError(ValueError):
    """A write tried to strip explicit host identity from a surviving opening."""

    code = "invalid_partition_opening_host"


class PartitionOpeningJambMarginError(ValueError):
    """A direct geometry write leaves no physical jamb at a wall endpoint."""

    code = "invalid_partition_opening_jamb_margin"

    def __init__(
        self, space_id: str, opening_id: str, margin: float, margin_cm: float
    ) -> None:
        self.space_id = space_id
        self.opening_id = opening_id
        self.margin = margin
        self.margin_cm = margin_cm
        # #42: structured details as JSON (see OpeningPassageError).
        super().__init__(json.dumps({
            "space": space_id, "opening": opening_id,
            "margin": round(margin, 12), "margin_cm": round(margin_cm, 12),
        }, ensure_ascii=False))


class WallModelClientOutdatedError(ValueError):
    """A stale client tried to replace an already-migrated v8 document."""

    code = "wall_model_client_outdated"


def _legacy_wall_model_projection(config: dict) -> dict:
    """Structural view an older client can faithfully round-trip."""
    projected = copy.deepcopy(config)
    projected.pop("model_version", None)
    for space in projected.get("spaces") or []:
        space.pop("wall_segments", None)
        for room in space.get("rooms") or []:
            room.pop("wall_ids", None)
        for draft in space.get("room_drafts") or []:
            for segment in draft.get("segments") or []:
                segment.pop("id", None)
        for opening in space.get("openings") or []:
            host = opening.get("host")
            if isinstance(host, dict) and host.get("kind") == "wall":
                opening.pop("host", None)
    return projected


def _catalog_coupled_wall_geometry_projection(config: dict) -> list[dict]:
    """Legacy geometry whose edit must also update the v8 contour catalogue.

    Drafts, partitions and columns carry their own ids. Openings carry an
    explicit v8 host and are checked against it by CONFIG_SCHEMA. None of those
    independent objects requires a different contour wall_segments catalogue.
    """
    result: list[dict] = []
    for space in config.get("spaces") or []:
        rooms = []
        for room in space.get("rooms") or []:
            rooms.append({key: copy.deepcopy(room.get(key)) for key in (
                "id", "poly", "x", "y", "w", "h", "open_to"
            ) if key in room})
        result.append({
            "id": space.get("id"),
            "rooms": rooms,
            "walls": copy.deepcopy(space.get("walls") or []),
            "open_spans": copy.deepcopy(space.get("open_spans") or []),
        })
    return result


def _wall_catalog_projection(config: dict) -> list[dict]:
    """Authoritative part a current v8 structural writer must update."""
    return [{
        "id": space.get("id"),
        "wall_segments": copy.deepcopy(space.get("wall_segments")),
    } for space in config.get("spaces") or []]


def _restore_wall_model_fields(config: dict, previous: dict) -> None:
    """Hydrate only v8 identity fields after an exact legacy round-trip."""
    config["model_version"] = previous["model_version"]
    old_spaces = {str(space.get("id")): space for space in previous.get("spaces") or []}
    for space in config.get("spaces") or []:
        old_space = old_spaces.get(str(space.get("id")))
        if old_space is None:
            continue
        space["wall_segments"] = copy.deepcopy(old_space.get("wall_segments") or [])
        old_rooms = {str(room.get("id")): room for room in old_space.get("rooms") or []}
        for room in space.get("rooms") or []:
            old_room = old_rooms.get(str(room.get("id")))
            if old_room is not None and "wall_ids" in old_room:
                room["wall_ids"] = copy.deepcopy(old_room["wall_ids"])
        old_drafts = {str(draft.get("id")): draft for draft in old_space.get("room_drafts") or []}
        for draft in space.get("room_drafts") or []:
            old_draft = old_drafts.get(str(draft.get("id")))
            if old_draft is None:
                continue
            old_segments = old_draft.get("segments") or []
            for index, segment in enumerate(draft.get("segments") or []):
                if index < len(old_segments) and old_segments[index].get("id"):
                    segment["id"] = old_segments[index]["id"]
        old_openings = {
            str(opening.get("id")): opening for opening in old_space.get("openings") or []
        }
        for opening in space.get("openings") or []:
            old_opening = old_openings.get(str(opening.get("id")))
            old_host = (old_opening or {}).get("host")
            if isinstance(old_host, dict) and old_host.get("kind") == "wall":
                opening["host"] = copy.deepcopy(old_host)


def validate_wall_model_transition(config: dict, previous: dict | None) -> None:
    """Do not let omission of model_version bypass v8 semantic validation."""
    try:
        old_model = int((previous or {}).get("model_version", 0))
        new_model = int(config.get("model_version", 0))
    except (TypeError, ValueError):
        return  # CONFIG_SCHEMA owns malformed values.
    previous = previous or {}
    contour_geometry_changed = (
        _catalog_coupled_wall_geometry_projection(config)
        != _catalog_coupled_wall_geometry_projection(previous)
    )
    if old_model >= 8 and new_model < 8:
        if not contour_geometry_changed:
            _restore_wall_model_fields(config, previous or {})
            # Re-run semantic parity after hydration; previous identity is
            # accepted only when it still matches the submitted projections.
            validated = CONFIG_SCHEMA(config)
            config.clear()
            config.update(validated)
            return
        raise WallModelClientOutdatedError(
            f"stored model={old_model}; submitted model={new_model}"
        )
    if old_model >= 8 and 8 <= new_model <= old_model and contour_geometry_changed:
        # The realistic stale-client case echoes model_version and the unknown
        # catalogue verbatim while changing room/contour geometry. Let the
        # frontend show the dedicated reload guidance instead of a generic
        # schema error. Independent drafts, partitions, columns and explicitly
        # hosted openings are validated by CONFIG_SCHEMA without requiring a
        # contour catalogue change (#314).
        #
        # A submitted model ABOVE the stored one is excluded on purpose (#319):
        # a stale client can only echo the stored version, never raise it. The
        # first write of a newer client legitimately drops legacy projection
        # fields (an orphan open_span/open_to) without touching the catalogue;
        # treating that as "outdated" wedged every structural write forever.
        if _wall_catalog_projection(config) == _wall_catalog_projection(previous):
            raise WallModelClientOutdatedError(
                f"stored model={old_model}; unchanged wall catalogue"
            )


# One normalized canvas width contains this many physical grid cells. Keep in
# sync with GRID_STEP_N/NORM_W in the frontend; it is a geometry scale, not a
# user setting.
NORMALIZED_CANVAS_CELLS = 240.0
_DEFAULT_ROOM_WALL_CM = 15.0
_OPTIMIZE_REHOST_EPSILON = 1e-8


def _room_polygon(room: dict) -> list[list[float]]:
    poly = room.get("poly")
    if isinstance(poly, list) and len(poly) >= 3:
        return poly
    if all(key in room for key in ("x", "y", "w", "h")):
        x, y = float(room["x"]), float(room["y"])
        w, h = float(room["w"]), float(room["h"])
        return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
    return []


def _segment_metrics(a: list, b: list) -> tuple[float, float, float]:
    dx, dy = float(b[0]) - float(a[0]), float(b[1]) - float(a[1])
    return dx, dy, math.hypot(dx, dy)


def _line_distance(point: list, a: list, b: list) -> float:
    dx, dy, length = _segment_metrics(a, b)
    if length <= _OPTIMIZE_REHOST_EPSILON:
        return math.inf
    return abs((float(point[0]) - float(a[0])) * dy
               - (float(point[1]) - float(a[1])) * dx) / length


def _projection(point: list, a: list, b: list) -> float:
    dx, dy, length = _segment_metrics(a, b)
    if length <= _OPTIMIZE_REHOST_EPSILON:
        return math.inf
    return ((float(point[0]) - float(a[0])) * dx
            + (float(point[1]) - float(a[1])) * dy) / length


def _segment_covers(a: list, b: list, target_a: list, target_b: list) -> bool:
    """Return whether one exact collinear segment covers the target."""
    _, _, length = _segment_metrics(a, b)
    if length <= _OPTIMIZE_REHOST_EPSILON:
        return False
    if (_line_distance(target_a, a, b) > _OPTIMIZE_REHOST_EPSILON
            or _line_distance(target_b, a, b) > _OPTIMIZE_REHOST_EPSILON):
        return False
    for point in (target_a, target_b):
        along = _projection(point, a, b)
        if along < -_OPTIMIZE_REHOST_EPSILON or along > length + _OPTIMIZE_REHOST_EPSILON:
            return False
    return True


def _segments_overlap_on_axis(a: list, b: list, other_a: list, other_b: list) -> bool:
    if (_line_distance(other_a, a, b) > _OPTIMIZE_REHOST_EPSILON
            or _line_distance(other_b, a, b) > _OPTIMIZE_REHOST_EPSILON):
        return False
    _, _, length = _segment_metrics(a, b)
    lo, hi = sorted((_projection(other_a, a, b), _projection(other_b, a, b)))
    return min(length, hi) - max(0.0, lo) > _OPTIMIZE_REHOST_EPSILON


def _angle_delta_mod_180(first: float, second: float) -> float:
    return abs((first - second + 90.0) % 180.0 - 90.0)


def _segments_cover_target(segments: list[tuple[list, list]], target_a: list, target_b: list) -> bool:
    """Whether a collinear union covers one complete positive target span."""
    dx, dy, length = _segment_metrics(target_a, target_b)
    if length <= _OPTIMIZE_REHOST_EPSILON:
        return False
    ranges = []
    for a, b in segments:
        if (_line_distance(a, target_a, target_b) > _OPTIMIZE_REHOST_EPSILON
                or _line_distance(b, target_a, target_b) > _OPTIMIZE_REHOST_EPSILON):
            continue
        lo, hi = sorted((_projection(a, target_a, target_b),
                         _projection(b, target_a, target_b)))
        lo, hi = max(0.0, lo), min(length, hi)
        if hi - lo > _OPTIMIZE_REHOST_EPSILON:
            ranges.append((lo, hi))
    reached = 0.0
    for lo, hi in sorted(ranges):
        if lo > reached + _OPTIMIZE_REHOST_EPSILON:
            return False
        reached = max(reached, hi)
        if reached >= length - _OPTIMIZE_REHOST_EPSILON:
            return True
    return False


_OPTIMIZE_PARTITION_KEYS = {"id", "a", "b", "cm"}


def _known_optimize_partition(partition: dict) -> bool:
    return isinstance(partition, dict) and set(partition).issubset(_OPTIMIZE_PARTITION_KEYS)


def _axis_range(a: list, b: list, axis_a: list, axis_b: list) -> tuple[float, float] | None:
    """Project one positive collinear overlap onto ``axis_a -> axis_b``."""
    if not (isinstance(a, list) and len(a) == 2
            and isinstance(b, list) and len(b) == 2):
        return None
    if (_line_distance(a, axis_a, axis_b) > _OPTIMIZE_REHOST_EPSILON
            or _line_distance(b, axis_a, axis_b) > _OPTIMIZE_REHOST_EPSILON):
        return None
    _, _, length = _segment_metrics(axis_a, axis_b)
    lo, hi = sorted((_projection(a, axis_a, axis_b),
                     _projection(b, axis_a, axis_b)))
    lo, hi = max(0.0, lo), min(length, hi)
    return (lo, hi) if hi - lo > _OPTIMIZE_REHOST_EPSILON else None


def _axis_point(a: list, b: list, along: float) -> list[float]:
    dx, dy, length = _segment_metrics(a, b)
    return [float(a[0]) + dx / length * along,
            float(a[1]) + dy / length * along]


def _optimize_partition_needs_proof(old_partition: dict, space: dict) -> bool:
    """Select #296 removal/splitting, not ordinary Optimize grid alignment."""
    partition_id = str(old_partition.get("id", ""))
    current = next((item for item in space.get("partitions") or []
                    if str(item.get("id", "")) == partition_id), None)
    if current == old_partition:
        return False
    if current is None:
        return True
    if not (_known_optimize_partition(old_partition)
            and _known_optimize_partition(current)):
        return False
    try:
        if float(current.get("cm")) != float(old_partition.get("cm")):
            return False
        old_a, old_b = old_partition["a"], old_partition["b"]
        current_range = _axis_range(current["a"], current["b"], old_a, old_b)
        _, _, old_length = _segment_metrics(old_a, old_b)
    except (KeyError, TypeError, ValueError):
        return False
    return current_range is not None and (
        current_range[0] > _OPTIMIZE_REHOST_EPSILON
        or current_range[1] < old_length - _OPTIMIZE_REHOST_EPSILON
    )


def _safe_optimize_partition_delta(space: dict, old_partition: dict) -> bool:
    """Independently prove every removed atom of one old partition axis."""
    if not _known_optimize_partition(old_partition):
        return False
    try:
        old_a, old_b = old_partition["a"], old_partition["b"]
        old_cm = float(old_partition["cm"])
        _, _, length = _segment_metrics(old_a, old_b)
    except (KeyError, TypeError, ValueError):
        return False
    if length <= _OPTIMIZE_REHOST_EPSILON or old_cm <= 0:
        return False

    rooms: list[tuple[str, list[tuple[list, list]]]] = []
    for room in space.get("rooms") or []:
        poly = _room_polygon(room)
        if len(poly) < 3:
            return False
        rooms.append((str(room.get("id", "")), [
            (poly[index], poly[(index + 1) % len(poly)])
            for index in range(len(poly))
        ]))

    candidate_partitions = space.get("partitions") or []
    retained: list[tuple[float, float]] = []
    breakpoints = [0.0, length]

    def note_segment(a: list, b: list) -> tuple[float, float] | None:
        projected = _axis_range(a, b, old_a, old_b)
        if projected:
            breakpoints.extend(projected)
        return projected

    for partition in candidate_partitions:
        try:
            projected = note_segment(partition["a"], partition["b"])
            candidate_cm = float(partition["cm"])
        except (KeyError, TypeError, ValueError):
            return False
        if projected and _known_optimize_partition(partition) and candidate_cm == old_cm:
            retained.append(projected)
    for _, edges in rooms:
        for edge_a, edge_b in edges:
            note_segment(edge_a, edge_b)
    for collection in (space.get("walls") or [], space.get("open_spans") or []):
        for segment in collection:
            try:
                note_segment(segment["a"], segment["b"])
            except (KeyError, TypeError, ValueError):
                return False

    points = sorted(set(round(point, 12) for point in breakpoints
                        if -_OPTIMIZE_REHOST_EPSILON <= point
                        <= length + _OPTIMIZE_REHOST_EPSILON))
    for lo, hi in zip(points, points[1:], strict=False):  # #42 B905: adjacent pairs, unequal length is the point
        if hi - lo <= _OPTIMIZE_REHOST_EPSILON:
            continue
        if any(start <= lo + _OPTIMIZE_REHOST_EPSILON
               and end >= hi - _OPTIMIZE_REHOST_EPSILON
               for start, end in retained):
            continue
        target_a, target_b = _axis_point(old_a, old_b, lo), _axis_point(old_a, old_b, hi)
        owners = {room_id for room_id, edges in rooms
                  if _segments_cover_target(edges, target_a, target_b)}
        collinear = {room_id for room_id, edges in rooms
                     if any(_segments_overlap_on_axis(
                         target_a, target_b, edge_a, edge_b
                     ) for edge_a, edge_b in edges)}
        if len(owners) not in (1, 2) or collinear != owners:
            return False
        if any(_segments_overlap_on_axis(
                target_a, target_b, span["a"], span["b"]
        ) for span in space.get("open_spans") or []):
            return False
        if any(_segments_overlap_on_axis(
                target_a, target_b, partition["a"], partition["b"]
        ) for partition in candidate_partitions):
            return False

        covering_walls = []
        for wall in space.get("walls") or []:
            try:
                wall_a, wall_b = wall["a"], wall["b"]
                if _segment_covers(wall_a, wall_b, target_a, target_b):
                    covering_walls.append((
                        _segment_metrics(wall_a, wall_b)[2], float(wall["cm"]),
                    ))
            except (KeyError, TypeError, ValueError):
                return False
        effective_cm = (min(covering_walls, key=lambda item: item[0])[1]
                        if covering_walls else _DEFAULT_ROOM_WALL_CM)
        if effective_cm + _OPTIMIZE_REHOST_EPSILON < old_cm:
            return False
    return True


def _hosted_opening_geometry(opening: dict, partition: dict) -> tuple[float, float, float, float] | None:
    host = opening.get("host")
    try:
        if not isinstance(host, dict) or host.get("kind") != "partition":
            return None
        t = float(host["t"])
        a, b = partition["a"], partition["b"]
        dx, dy, length = _segment_metrics(a, b)
        opening_length = float(opening["length"])
    except (KeyError, TypeError, ValueError):
        return None
    if not 0 <= t <= 1 or length <= _OPTIMIZE_REHOST_EPSILON or opening_length <= 0:
        return None
    angle = math.degrees(math.atan2(dy, dx))
    if angle >= 90:
        angle -= 180
    elif angle < -90:
        angle += 180
    return float(a[0]) + dx * t, float(a[1]) + dy * t, angle, opening_length


def _safe_optimize_residual_rehost(
    space: dict, old_space: dict, opening: dict, old_opening: dict,
) -> bool:
    """Prove a hosted opening rebound to a newly-created residual id."""
    old_host, new_host = old_opening.get("host"), opening.get("host")
    if not (isinstance(old_host, dict) and isinstance(new_host, dict)
            and old_host.get("kind") == new_host.get("kind") == "partition"):
        return False
    old_partition = next((item for item in old_space.get("partitions") or []
                          if str(item.get("id", "")) == str(old_host.get("id", ""))), None)
    new_partition = next((item for item in space.get("partitions") or []
                          if str(item.get("id", "")) == str(new_host.get("id", ""))), None)
    if old_partition is None or new_partition is None:
        return False
    if not _safe_optimize_partition_delta(space, old_partition):
        return False
    ignored = {"host", "x", "y", "angle"}
    if ({key: value for key, value in old_opening.items() if key not in ignored}
            != {key: value for key, value in opening.items() if key not in ignored}):
        return False
    old_geometry = _hosted_opening_geometry(old_opening, old_partition)
    new_geometry = _hosted_opening_geometry(opening, new_partition)
    if old_geometry is None or new_geometry is None:
        return False
    old_x, old_y, old_angle, old_length = old_geometry
    new_x, new_y, new_angle, new_length = new_geometry
    try:
        explicit_x, explicit_y = float(opening["x"]), float(opening["y"])
        explicit_angle = float(opening["angle"])
    except (KeyError, TypeError, ValueError):
        return False
    return (
        abs(old_x - new_x) <= _OPTIMIZE_REHOST_EPSILON
        and abs(old_y - new_y) <= _OPTIMIZE_REHOST_EPSILON
        and abs(old_length - new_length) <= _OPTIMIZE_REHOST_EPSILON
        and _angle_delta_mod_180(old_angle, new_angle) <= 1e-7
        and abs(explicit_x - new_x) <= _OPTIMIZE_REHOST_EPSILON
        and abs(explicit_y - new_y) <= _OPTIMIZE_REHOST_EPSILON
        and _angle_delta_mod_180(explicit_angle, new_angle) <= 1e-7
    )


def _safe_optimize_partition_rehost(
    space: dict, old_space: dict, opening: dict, old_opening: dict,
) -> bool:
    """Independently prove the #276/#296 partition-to-room-wall transition."""
    old_host = old_opening.get("host")
    if not isinstance(old_host, dict) or old_host.get("kind") != "partition":
        return False
    partition_id = str(old_host.get("id", ""))
    old_partition = next((item for item in old_space.get("partitions") or []
                          if str(item.get("id", "")) == partition_id), None)
    if old_partition is None:
        return False
    if not _safe_optimize_partition_delta(space, old_partition):
        return False
    a, b = old_partition.get("a"), old_partition.get("b")
    if not (isinstance(a, list) and len(a) == 2 and isinstance(b, list) and len(b) == 2):
        return False
    dx, dy, length = _segment_metrics(a, b)
    if length <= _OPTIMIZE_REHOST_EPSILON:
        return False

    ignored = {"host", "x", "y", "angle"}
    old_stable = {key: value for key, value in old_opening.items() if key not in ignored}
    new_stable = {key: value for key, value in opening.items() if key not in ignored}
    if old_stable != new_stable:
        return False
    try:
        t = float(old_host["t"])
        x, y = float(opening["x"]), float(opening["y"])
        opening_angle = float(opening["angle"])
        opening_length = float(opening["length"])
    except (KeyError, TypeError, ValueError):
        return False
    if not (0 <= t <= 1 and opening_length > 0):
        return False
    expected_x, expected_y = float(a[0]) + dx * t, float(a[1]) + dy * t
    expected_angle = math.degrees(math.atan2(dy, dx))
    if expected_angle >= 90:
        expected_angle -= 180
    elif expected_angle < -90:
        expected_angle += 180
    if (abs(x - expected_x) > _OPTIMIZE_REHOST_EPSILON
            or abs(y - expected_y) > _OPTIMIZE_REHOST_EPSILON
            or _angle_delta_mod_180(opening_angle, expected_angle) > 1e-7):
        return False
    along = t * length
    if (along - opening_length / 2 < -_OPTIMIZE_REHOST_EPSILON
            or along + opening_length / 2 > length + _OPTIMIZE_REHOST_EPSILON):
        return False

    half_dx, half_dy = dx / length * opening_length / 2, dy / length * opening_length / 2
    target_a = [expected_x - half_dx, expected_y - half_dy]
    target_b = [expected_x + half_dx, expected_y + half_dy]
    owners: set[str] = set()
    collinear_rooms: set[str] = set()
    for room in space.get("rooms") or []:
        poly = _room_polygon(room)
        room_id = str(room.get("id", ""))
        edges = [(poly[index], poly[(index + 1) % len(poly)])
                 for index in range(len(poly))]
        if _segments_cover_target(edges, target_a, target_b):
            owners.add(room_id)
        if any(_segments_overlap_on_axis(target_a, target_b, edge_a, edge_b)
               for edge_a, edge_b in edges):
            collinear_rooms.add(room_id)
    if len(owners) not in (1, 2) or collinear_rooms != owners:
        return False
    if any(_segments_overlap_on_axis(target_a, target_b, span["a"], span["b"])
           for span in space.get("open_spans") or []):
        return False
    if any(_segments_overlap_on_axis(target_a, target_b, item["a"], item["b"])
           for item in space.get("partitions") or []):
        return False

    covering_walls = []
    for wall in space.get("walls") or []:
        wall_a, wall_b = wall.get("a"), wall.get("b")
        if not (isinstance(wall_a, list) and isinstance(wall_b, list)):
            continue
        if _segment_covers(wall_a, wall_b, target_a, target_b):
            covering_walls.append((_segment_metrics(wall_a, wall_b)[2], float(wall["cm"])))
    effective_cm = min(covering_walls, key=lambda item: item[0])[1] \
        if covering_walls else _DEFAULT_ROOM_WALL_CM
    if effective_cm + _OPTIMIZE_REHOST_EPSILON < float(old_partition.get("cm", 0)):
        return False

    for other in space.get("openings") or []:
        if other is opening or str(other.get("id", "")) == str(opening.get("id", "")):
            continue
        try:
            center = [float(other["x"]), float(other["y"])]
            other_angle = float(other["angle"])
            other_length = float(other["length"])
        except (KeyError, TypeError, ValueError):
            continue
        if (_line_distance(center, a, b) > _OPTIMIZE_REHOST_EPSILON
                or _angle_delta_mod_180(other_angle, expected_angle) > 1e-7):
            continue
        other_along = _projection(center, a, b)
        if (min(along + opening_length / 2, other_along + other_length / 2)
                - max(along - opening_length / 2, other_along - other_length / 2)
                > _OPTIMIZE_REHOST_EPSILON):
            return False
    return True


def validate_partition_opening_hosts(
    config: dict, previous: dict | None = None, *, allow_optimize_rehost: bool = False
) -> None:
    """Validate hosted-opening write deltas without rejecting legacy reads.

    Deleting the opening together with its partition remains valid. Surviving
    records keep their host, while new/direct geometry changes reserve half the
    actual wall depth at both endpoints. Rigid host translation and unrelated
    edits round-trip existing near-end records unchanged.
    """
    old_spaces = {
        str(space.get("id")): space for space in (previous or {}).get("spaces") or []
    }
    for space in config.get("spaces") or []:
        space_id = str(space.get("id", ""))
        old_space = old_spaces.get(space_id)
        old_openings = {
            str(opening.get("id")): opening
            for opening in (old_space or {}).get("openings") or []
        }
        partitions = {
            str(partition.get("id")): partition
            for partition in space.get("partitions") or []
        }
        old_partitions = {
            str(partition.get("id")): partition
            for partition in (old_space or {}).get("partitions") or []
        }
        for opening in space.get("openings") or []:
            opening_id = str(opening.get("id", ""))
            old = old_openings.get(opening_id)
            old_host = (old or {}).get("host")
            host = opening.get("host")
            if (old and isinstance(old_host, dict)
                    and old_host.get("kind") == "partition"):
                same_partition = (
                    isinstance(host, dict) and host.get("kind") == "partition"
                    and str(host.get("id", "")) == str(old_host.get("id", ""))
                )
                residual_rehost = (
                    isinstance(host, dict) and host.get("kind") == "partition"
                    and not same_partition
                )
                proved = same_partition or (
                    allow_optimize_rehost and old_space is not None
                    and (_safe_optimize_residual_rehost(
                        space, old_space, opening, old
                    ) if residual_rehost else _safe_optimize_partition_rehost(
                        space, old_space, opening, old
                    ))
                )
                if not proved:
                    raise PartitionOpeningHostError(
                        f"space={space_id}; opening={opening_id}; host changed"
                    )
            if host is None:
                continue
            if host.get("kind") != "partition":
                continue
            partition = partitions.get(str(host.get("id", "")))
            if partition is None:
                # SPACE_SCHEMA owns missing-host diagnostics.
                continue
            old_partition = old_partitions.get(str((old_host or {}).get("id", "")))
            ax, ay = partition["a"]
            bx, by = partition["b"]
            span = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
            old_span = None
            if old_partition is not None:
                old_ax, old_ay = old_partition["a"]
                old_bx, old_by = old_partition["b"]
                old_span = ((old_bx - old_ax) ** 2 + (old_by - old_ay) ** 2) ** 0.5
            strict = (
                old is None
                or old_host is None
                or old_host.get("id") != host.get("id")
                or old_host.get("t") != host.get("t")
                or old.get("length") != opening.get("length")
                or old_partition is None
                or old_partition.get("cm") != partition.get("cm")
                or abs(old_span - span) > 1e-9
            )
            if not strict:
                continue
            cell_cm = float(space.get("cell_cm", 5))
            margin_cm = float(partition["cm"]) / 2
            margin = margin_cm / cell_cm / NORMALIZED_CANVAS_CELLS
            along = float(host["t"]) * span
            half = float(opening["length"]) / 2
            if (along - half < margin - 1e-9
                    or along + half > span - margin + 1e-9):
                raise PartitionOpeningJambMarginError(
                    space_id, opening_id, margin, margin_cm
                )
        if allow_optimize_rehost and old_space:
            for old_partition in old_space.get("partitions") or []:
                if (_optimize_partition_needs_proof(old_partition, space)
                        and not _safe_optimize_partition_delta(space, old_partition)):
                    raise PartitionOpeningHostError(
                        f"space={space_id}; partition={old_partition.get('id', '')}; "
                        "optimize delta unproved"
                    )


PASSAGE_FORBIDDEN_FIELDS = {"contact", "lock", "invert", "flip_h", "flip_v"}


def validate_opening_passages(
    config: dict, previous: dict | None = None, *, validate_all: bool = False
) -> None:
    """Reject new/changed inapplicable fields while preserving dormant bad data.

    A passage read from an older/future writer may already contain door-only
    keys. Unrelated writes must remain possible, but imports and any write that
    introduces or changes such a key are fail-closed.
    """
    old_spaces = {
        str(space.get("id")): space for space in (previous or {}).get("spaces") or []
    }
    for space in config.get("spaces") or []:
        space_id = str(space.get("id", ""))
        old_space = None if validate_all else old_spaces.get(space_id)
        old_openings = {
            str(opening.get("id")): opening
            for opening in (old_space or {}).get("openings") or []
        }
        for opening in space.get("openings") or []:
            if opening.get("type") != "passage":
                continue
            opening_id = str(opening.get("id", ""))
            present = sorted(PASSAGE_FORBIDDEN_FIELDS & set(opening))
            if not present:
                continue
            old_opening = None if validate_all else old_openings.get(opening_id)
            if not old_opening or old_opening.get("type") != "passage":
                raise OpeningPassageError(space_id, opening_id, present)
            changed = [
                field for field in present
                if field not in old_opening or opening[field] != old_opening[field]
            ]
            if changed:
                raise OpeningPassageError(space_id, opening_id, changed)


VALUE_BADGE_ATTRIBUTES = {
    "current_temperature", "temperature", "current_humidity", "humidity",
    "current_position", "percentage", "brightness", "volume_level",
    "battery_level", "fan_speed",
}
VALUE_BADGE_POSITIONS = {"right", "bottom", "left", "top"}
VALUE_BADGE_SOURCE_KINDS = {
    "entity_state", "entity_attribute", "derived_lqi", "derived_marker_state",
}
_LIGHT_ENTITY_RE = re.compile(r"^(?:light|switch)\.[a-z0-9_]+\Z")


def _matching_previous_marker(
    marker: dict, marker_id: str, old_by_id: dict[str, dict], old_markers: list[dict],
    new_ids: set[str], consumed_old_ids: set[str], validate_all: bool,
) -> dict | None:
    """Match the previous marker across the binding-stable id rename path."""
    old_marker = old_by_id.get(marker_id)
    if old_marker is not None:
        consumed_old_ids.add(marker_id)
        return old_marker
    if validate_all:
        return None
    binding = marker.get("binding")
    matches = [
        old for old in old_markers
        if binding not in (None, "virtual")
        and old.get("binding") == binding
        and str(old.get("id")) not in new_ids
        and str(old.get("id")) not in consumed_old_ids
    ]
    if len(matches) == 1:
        consumed_old_ids.add(str(matches[0].get("id")))
        return matches[0]
    return None


def validate_marker_value_badges(
    config: dict, previous: dict | None = None, *, validate_all: bool = False
) -> None:
    """Validate changed badge/face sources; dormant future data round-trips."""
    markers = config.get("markers") or []
    by_id = {str(marker.get("id")): marker for marker in markers}
    old_markers = (previous or {}).get("markers") or []
    old_by_id = {str(marker.get("id")): marker for marker in old_markers}
    new_ids = set(by_id)
    consumed_old_ids: set[str] = set()
    known_source_fields = {"kind", "entity_id", "attribute", "ref"}

    def validate_source(source: object, field: str) -> None:
        prefix = "value_badge" if field == "value_badge" else "value_source"
        source_error = "invalid_value_badge_source" if field == "value_badge" \
            else "invalid_value_source"
        attribute_error = "invalid_value_badge_attribute" if field == "value_badge" \
            else "invalid_value_source_attribute"
        if not isinstance(source, dict) or source.get("kind") not in VALUE_BADGE_SOURCE_KINDS:
            raise MarkerControlError(source_error, f"Invalid {field} source")
        kind = source["kind"]
        allowed_fields = {
            "entity_state": {"kind", "entity_id"},
            "entity_attribute": {"kind", "entity_id", "attribute"},
            "derived_lqi": {"kind"},
            "derived_marker_state": {"kind", "ref"},
        }[kind]
        if (known_source_fields & set(source)) - allowed_fields:
            raise MarkerControlError(source_error, f"Inconsistent {field} source")
        if kind in {"entity_state", "entity_attribute"}:
            entity_id = source.get("entity_id")
            if not isinstance(entity_id, str) or not _CONTROL_ENTITY_ID_RE.fullmatch(entity_id):
                raise MarkerControlError(source_error, f"Invalid {field} entity id")
        if kind == "entity_attribute" and source.get("attribute") not in VALUE_BADGE_ATTRIBUTES:
            raise MarkerControlError(attribute_error, f"Invalid {field} attribute")
        if kind == "derived_marker_state":
            ref = source.get("ref")
            if not isinstance(ref, str) or not ref.startswith(MARKER_CONTROL_PREFIX) \
                    or not ref[len(MARKER_CONTROL_PREFIX):]:
                raise MarkerControlError(source_error, f"Invalid {field} target")
            target = by_id.get(ref[len(MARKER_CONTROL_PREFIX):])
            if target is None or target.get("removed") is True:
                raise MarkerControlError(f"{prefix}_marker_missing", f"{field} target does not exist")
            if target.get("is_light") is not True:
                raise MarkerControlError(f"{prefix}_marker_not_light", f"{field} target is not a forced light")

    for marker_id, marker in by_id.items():
        old_marker = _matching_previous_marker(
            marker, marker_id, old_by_id, old_markers, new_ids,
            consumed_old_ids, validate_all,
        )
        badge = marker.get("value_badge")
        old_badge = None if validate_all else (old_marker or {}).get("value_badge")
        if validate_all or badge != old_badge:
            if badge is not None:
                if not isinstance(badge, dict):
                    raise MarkerControlError("invalid_value_badge", "Value badge must be an object")
                if not isinstance(badge.get("enabled"), bool):
                    raise MarkerControlError("invalid_value_badge", "Value badge enabled must be boolean")
                if badge.get("position") not in VALUE_BADGE_POSITIONS:
                    raise MarkerControlError("invalid_value_badge_position", "Invalid value badge position")
                source = badge.get("source")
                if badge["enabled"] and not isinstance(source, dict):
                    raise MarkerControlError(
                        "value_badge_source_required", "Enabled value badge needs a source"
                    )
                if source is not None:
                    validate_source(source, "value_badge")

        source = marker.get("value_source")
        old_source = None if validate_all else (old_marker or {}).get("value_source")
        if (validate_all or source != old_source) and source is not None:
            validate_source(source, "value_source")


def validate_marker_vacuum_routes(
    config: dict, previous: dict | None = None, *, validate_all: bool = False
) -> None:
    """Validate changed vacuum map routes; dormant future data round-trips.

    Change-aware like the badge validator above (#162): an untouched legacy or
    future-shaped block must not block an unrelated save, but any edit to
    routing has to leave the marker in a state the resolver can answer for —
    unique identities, six-number matrices and target spaces that exist.
    """
    markers = config.get("markers") or []
    spaces = config.get("spaces")
    space_ids = None
    if isinstance(spaces, list):
        space_ids = {
            str(space.get("id")) for space in spaces
            if isinstance(space, dict) and isinstance(space.get("id"), str)
        }
    old_markers = (previous or {}).get("markers") or []
    old_by_id = {str(marker.get("id")): marker for marker in old_markers}
    by_id = {str(marker.get("id")): marker for marker in markers}
    new_ids = set(by_id)
    consumed_old_ids: set[str] = set()
    for marker_id, marker in by_id.items():
        old_marker = _matching_previous_marker(
            marker, marker_id, old_by_id, old_markers, new_ids,
            consumed_old_ids, validate_all,
        )
        routes = (marker.get("vacuum") or {}).get("map_routes")
        old_routes = None if validate_all else ((old_marker or {}).get("vacuum") or {}).get("map_routes")
        if not validate_all and routes == old_routes:
            continue
        problems = validate_marker_routes(marker_id, routes, space_ids)
        if problems:
            reasons = ", ".join(sorted({problem["reason"] for problem in problems}))
            # Literal, not the constant: the #42 scanner proves the emitted
            # code against ERROR_CODES by reading the source, and it cannot
            # follow a name. The pair is pinned by a test below.
            raise MarkerControlError(
                "invalid_vacuum_map_route",
                f"Invalid vacuum map routes on {marker_id}: {reasons}",
            )


def validate_marker_light_entities(
    config: dict, previous: dict | None = None, *, validate_all: bool = False
) -> None:
    """Validate new/changed light/switch choices without rejecting dormant data.

    The top-level schema must stay lossless: an old or future literal that the
    current frontend cannot edit may round-trip unchanged. Imports validate the
    whole incoming document because every imported value is new to this plan.
    """
    markers = config.get("markers") or []
    old_markers = (previous or {}).get("markers") or []
    old_by_id = {str(marker.get("id")): marker for marker in old_markers}
    new_ids = {str(marker.get("id")) for marker in markers}
    consumed_old_ids: set[str] = set()
    for marker in markers:
        marker_id = str(marker.get("id"))
        old_marker = _matching_previous_marker(
            marker, marker_id, old_by_id, old_markers, new_ids,
            consumed_old_ids, validate_all,
        )
        for field, code, message in (
            (
                "light_entity",
                "invalid_light_entity",
                "Leading light entity must be light.* or switch.*",
            ),
            (
                "toggle_entity",
                "invalid_toggle_entity",
                "Toggle entity must be light.* or switch.*",
            ),
        ):
            value = marker.get(field)
            old_value = None if validate_all else (old_marker or {}).get(field)
            if not validate_all and value == old_value:
                continue
            if value is None:
                continue
            if not isinstance(value, str) or not _LIGHT_ENTITY_RE.fullmatch(value):
                raise MarkerControlError(code, message)


def validate_marker_controls(
    config: dict, previous: dict | None = None, *, validate_all: bool = False
) -> None:
    """Validate newly introduced marker:* edges without rewriting old data.

    Existing broken refs remain editable and round-trip losslessly. Imports use
    validate_all because their complete candidate graph is new to this plan.
    """
    markers = config.get("markers") or []
    by_id = {str(marker.get("id")): marker for marker in markers}
    old_markers = (previous or {}).get("markers") or []
    old_by_id = {
        str(marker.get("id")): marker for marker in (previous or {}).get("markers") or []
    }
    new_ids = set(by_id)
    consumed_old_ids: set[str] = set()
    graph: dict[str, list[str]] = {}
    added: list[tuple[str, str]] = []
    for marker_id, marker in by_id.items():
        old_marker = _matching_previous_marker(
            marker, marker_id, old_by_id, old_markers, new_ids,
            consumed_old_ids, validate_all,
        )
        raw_controls = [
            ref for ref in marker.get("controls") or [] if isinstance(ref, str)
        ]
        old_controls = [] if validate_all else [
            ref for ref in (old_marker or {}).get("controls") or [] if isinstance(ref, str)
        ]
        refs = [
            ref for ref in raw_controls
            if isinstance(ref, str) and ref.startswith(MARKER_CONTROL_PREFIX)
        ]
        graph[marker_id] = [ref[len(MARKER_CONTROL_PREFIX):] for ref in refs]
        old_refs = [
            ref for ref in old_controls
            if isinstance(ref, str) and ref.startswith(MARKER_CONTROL_PREFIX)
        ]
        remaining = list(old_refs)
        for ref in refs:
            if ref in remaining:
                remaining.remove(ref)
            else:
                added.append((marker_id, ref[len(MARKER_CONTROL_PREFIX):]))
        new_counts, old_counts = Counter(refs), Counter(old_refs)
        if any(count > 1 and count > old_counts[ref] for ref, count in new_counts.items()):
            raise MarkerControlError("duplicate_marker_control", "Duplicate marker light target")
        remaining_controls = list(old_controls)
        for ref in raw_controls:
            if ref in remaining_controls:
                remaining_controls.remove(ref)
            elif not ref.startswith(MARKER_CONTROL_PREFIX) and not _CONTROL_ENTITY_ID_RE.fullmatch(ref):
                raise MarkerControlError("invalid_marker_control", f"Invalid entity target: {ref}")

    def reaches(start: str, wanted: str) -> bool:
        stack, seen = [start], set()
        while stack:
            node = stack.pop()
            if node == wanted:
                return True
            if node in seen:
                continue
            seen.add(node)
            stack.extend(graph.get(node, []))
        return False

    for controller, target in added:
        if not target:
            raise MarkerControlError("invalid_marker_control", "Marker target id is empty")
        if target == controller:
            raise MarkerControlError("marker_control_self", "A marker cannot control itself")
        target_marker = by_id.get(target)
        if target_marker is None or target_marker.get("removed") is True:
            raise MarkerControlError("marker_control_missing", f"Marker target does not exist: {target}")
        if target_marker.get("is_light") is not True:
            raise MarkerControlError("marker_control_not_light", f"Marker target is not a forced light: {target}")
        if reaches(target, controller):
            raise MarkerControlError("marker_control_cycle", "Marker light controls contain a cycle")

# ---------- sanitizers ----------


def sanitize_marker_id(value: str) -> str:
    """Safe marker identifier for a folder name.

    Strips path separators and leading dots to rule out directory traversal
    (e.g. '..', '../x'); an empty/dots-only result → 'misc'.
    """
    cleaned = _SAFE_NAME_RE.sub("_", value).lstrip(".")[:64]
    return cleaned or "misc"


def sanitize_filename(value: str) -> str:
    """Drop the path and leading dots, keep a safe file name."""
    raw = value.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    return _SAFE_NAME_RE.sub("_", raw).lstrip(".")[:MAX_FILENAME] or "file"


def file_ext(filename: str) -> str:
    """Lowercase file extension ('' if none)."""
    raw = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    return raw.rsplit(".", 1)[-1].lower() if "." in raw else ""


def valid_space_id(value: str) -> bool:
    return bool(SPACE_ID_RE.match(value))


# ---------- voluptuous schemas ----------
def _finite(value):
    """Coerce to float and reject NaN/Infinity (audit B5).

    'NaN' and 'Infinity' pass Coerce(float) and serialize to null on write,
    silently corrupting a stored position forever.
    """
    f = float(value)
    if f != f or f in (float("inf"), float("-inf")):
        raise vol.Invalid("coordinate must be a finite number")
    return f


# Persisted colours deliberately use one small, browser-independent format.
# Keep this exact contract in sync with src/color.ts.
# `^...$` accepts a trailing newline in Python. Persisted CSS tokens must
# match the whole string exactly, in parity with the frontend validator.
_COLOR = vol.Match(r"\A#[0-9a-fA-F]{6}\Z")
_CUSTOM_FILL = vol.Schema(
    {
        vol.Required("c"): _COLOR,
        vol.Required("a"): vol.All(_finite, vol.Range(min=0.0, max=1.0)),
    }
)


# generous caps: the product targets 20-200 devices and a handful of floors
MAX_SPACES = 50
MAX_ROOMS = 400
MAX_MARKERS = 2000
MAX_OPENINGS = 500
MAX_DECOR = 1000
# v8 atomises room boundaries. The 2 MiB wire cap is the practical bound; this
# structural cap mirrors MAX_ROOMS * MAX_POLY_POINTS without depending on the
# later constant declaration.
MAX_WALLS = 200_000
MAX_WALL_SEGMENTS = 200_000
MAX_ROOM_DRAFTS = 200
MAX_DRAFT_SEGMENTS = 2000
MAX_PARTITIONS = 2000
MAX_WALL_COLUMNS = 500
# Open (virtual) wall stretches, docs/superpowers/specs/2026-08-05-open-spans-delete-design.md.
# Every span is a piece of a shared boundary, so there can never be more of
# them than there are wall segments — the cap is the walls' one (AUD-159B6-03).
MAX_OPEN_SPANS = 500
MAX_LAYOUT = 5000
# Inner limits (HP-1454-05). The outer collections were capped, the collections
# INSIDE them were not: a 150 000-point polygon or a 100 000-entry known_devices
# list passed validation, then made the card build gigantic SVG attributes and
# walk them on every render. Any authenticated writer could store one, and with
# `admin_only` off that is every user. These are product limits, not guesses: a
# hand-drawn room does not need 500 vertices, and no home has 200 lights behind
# one switch.
MAX_POLY_POINTS = 500
MAX_OPEN_TO = 50
MAX_CONTROLS = 200
MAX_PDFS = 50
MAX_KNOWN_DEVICES = 20000
MAX_MARKER_AREA_SNAPSHOT = MAX_KNOWN_DEVICES
MAX_TEXT = 500          # names, models, ids
MAX_DESCRIPTION = 4000
MAX_URL = 2000
# Comfortably below the WebSocket frame limit (aiohttp's default is 4 MB): a
# payload larger than the frame never reaches the handler at all — the socket
# closes with 1009 and the user sees a dropped connection instead of an error
# they can act on. For scale, a real three-floor home with ~200 devices stores
# about 70 KB, so this is ~30x headroom.
MAX_CONFIG_BYTES = 2 * 1024 * 1024
CELL_CM_MIN = 0.1
CELL_CM_MAX = 1000.0

_TEXT = vol.All(str, vol.Length(max=MAX_TEXT))
_NONEMPTY_TEXT = vol.All(str, vol.Length(min=1, max=MAX_TEXT))
_TEXT_OR_NONE = vol.Any(None, _TEXT)
_URL = vol.All(str, vol.Length(max=MAX_URL))

# The canvas is UNBOUNDED (docs/CANVAS.md). Coordinates are still normalised —
# 1.0 is still one canvas width — but there is no frame any more, so a plan may
# legitimately live at 2.7 or -1.4. The range below is GARBAGE INSURANCE, not a
# boundary: at the product's own scale (cell_cm=5, 240 cells across the unit
# width) 5000 is about 60 km of plan, unreachable in a home, while a stored
# 1e100 still cannot stretch every client's view until the plan is invisible
# (HP-1500-03 / HP-1501-01). Widened from +/-4 on 2026-08-03.
CANVAS_LIMIT = 5000.0
_COORD = vol.All(_finite, vol.Range(min=-CANVAS_LIMIT, max=CANVAS_LIMIT))

POS_SCHEMA = vol.All(
    vol.Schema(
        {vol.Required("x"): _COORD, vol.Required("y"): _COORD},
        extra=vol.ALLOW_EXTRA,  # v2 records carry the "s" key (space id)
    ),
    canonicalize_position,
)
LAYOUT_SCHEMA = vol.All(
    vol.Schema({str: POS_SCHEMA}),
    vol.Length(max=MAX_LAYOUT),
    canonicalize_layout_geometry,
)

# Room/opening geometry: same story, same range (docs/CANVAS.md). A vertex at
# 2.5 is a plan that grew past the old square, not corruption; 1e100 is
# corruption (HP-1501-01, the room-geometry twin of HP-1500-03).
_GEOM = vol.All(_finite, vol.Range(min=-CANVAS_LIMIT, max=CANVAS_LIMIT))

# A SIZE is not a coordinate (HP-1502-01): SVG requires positive width/height,
# and the clients divide by these. `view_box: [0,0,0,0]` passed the shared
# validator and serialised into viewBox="0 0 0 0" — a blank plan on every
# client. The floor is one thousandth of the canvas (1 render unit): far below
# any real room, but keeps the maths finite. The CEILING follows the canvas
# (docs/CANVAS.md) — a room on an unbounded plane may legitimately be wider
# than the old unit square — while staying strictly positive.
_EXTENT = vol.All(_finite, vol.Range(min=0.001, max=CANVAS_LIMIT))

# The backdrop's uniform scale (docs/BACKDROP.md). A MULTIPLIER, not a
# coordinate: strictly positive, and bounded by what a person could mean —
# a hundredth of the canvas is already a thumbnail, a hundred canvases is
# already absurd. Mirrored by PLAN_SCALE_MIN/MAX in src/space-geometry.ts.
PLAN_SCALE_MIN = 0.01
PLAN_SCALE_MAX = 100.0


def _view_box(value):
    """[x, y, w, h]: the first two are coordinates, the last two are sizes."""
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        raise vol.Invalid("view_box must be [x, y, w, h]")
    return [_GEOM(value[0]), _GEOM(value[1]), _EXTENT(value[2]), _EXTENT(value[3])]


POINT = vol.All([_GEOM], vol.Length(min=2, max=2))

# A virtual stretch shorter than this is a click, not a span. Mirrors
# OPEN_SPAN_MIN_UNITS in src/open-spans.ts (normalised units).
OPEN_SPAN_MIN_LEN = 1e-3


def _open_span(value):
    """One virtual stretch: exactly two distinct finite points a/b.

    AUD-159B6-03: the field used to ride on `extra=ALLOW_EXTRA` — any shape
    passed the backend and the card crashed reading `e.a[0]` on render, for
    every reader of that space. A degenerate span (a == b) is not a stretch
    either: it can never be hit, closed or drawn, so it is corruption, not data.
    """
    if not isinstance(value, dict):
        raise vol.Invalid("open_span must be an object with a/b points")
    a = POINT(value.get("a"))
    b = POINT(value.get("b"))
    if abs(a[0] - b[0]) < OPEN_SPAN_MIN_LEN and abs(a[1] - b[1]) < OPEN_SPAN_MIN_LEN:
        raise vol.Invalid("open_span: a and b must differ")
    out = {k: v for k, v in value.items() if k not in ("a", "b")}
    out["a"] = a
    out["b"] = b
    return out


def _dedupe_open_spans(value):
    """Drop repeats of the same stretch (either direction) — one wall, one span."""
    seen = set()
    out = []
    for span in value:
        a, b = span["a"], span["b"]
        fwd = (round(a[0], 6), round(a[1], 6), round(b[0], 6), round(b[1], 6))
        key = min(fwd, (fwd[2], fwd[3], fwd[0], fwd[1]))
        if key in seen:
            continue
        seen.add(key)
        out.append(span)
    return out


def _require_geometry(room: dict) -> dict:
    if "poly" in room or all(k in room for k in ("x", "y", "w", "h")):
        return room
    raise vol.Invalid("room: poly or x/y/w/h is required")


ROOM_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Required("id"): _TEXT,
            vol.Required("name"): _TEXT,
            vol.Optional("area"): _TEXT_OR_NONE,
            vol.Optional("open_to"): vol.All([_TEXT], vol.Length(max=MAX_OPEN_TO)),
            vol.Optional("settings"): vol.Any(
                None,
                vol.Schema(
                    {
                        vol.Optional("fill_mode"): vol.Any(None, vol.In(["none", "lqi", "light", "temp", "custom", "glow"])),
                        vol.Optional("custom_fill"): vol.Any(None, _CUSTOM_FILL),
                        vol.Optional("glow"): vol.Any(bool, None),
                        vol.Optional("temp_source"): vol.Any(str, None),
                        vol.Optional("hum_source"): vol.Any(str, None),
                        vol.Optional("name_scale"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0.5, max=3))),
                        vol.Optional("label_scale"): vol.Any(None, vol.All(vol.Coerce(float), vol.Range(min=0.5, max=3))),
                    },
                    extra=vol.ALLOW_EXTRA,
                ),
            ),
            vol.Optional("x"): _GEOM,
            vol.Optional("y"): _GEOM,
            vol.Optional("w"): _EXTENT,
            vol.Optional("h"): _EXTENT,
            vol.Optional("poly"): vol.All([POINT], vol.Length(min=3, max=MAX_POLY_POINTS)),
            vol.Optional("wall_ids"): vol.All(
                [vol.All(str, vol.Length(min=1, max=64))],
                vol.Length(min=3, max=MAX_POLY_POINTS),
            ),
        },
        extra=vol.ALLOW_EXTRA,
    ),
    _require_geometry,
)

def _north_deg(value):
    """Compass (docs/SUN.md): strict integer degrees, 0..359.

    Strict on purpose: Coerce(int) would take "90" and 1.5, and a bool is an
    int in Python — none of those is a compass reading a client stored.
    """
    if isinstance(value, bool) or not isinstance(value, int):
        raise vol.Invalid("north_deg must be an integer in 0..359")
    if not 0 <= value <= 359:
        raise vol.Invalid("north_deg must be an integer in 0..359")
    return value


_BG_MODE = vol.In(["static", "daynight"])

SPACE_DISPLAY_SCHEMA = vol.Schema(
    {
        vol.Optional("show_borders"): bool,
        vol.Optional("show_names"): bool,
        vol.Optional("room_color"): _COLOR,
        # per-space background around the plan; absent = inherit the global one
        vol.Optional("bg_color"): _COLOR,
        vol.Optional("room_opacity"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
        vol.Optional("fill_mode"): vol.In(["none", "lqi", "light", "temp", "custom", "glow"]),
        vol.Optional("custom_fill"): vol.Any(None, _CUSTOM_FILL),
        vol.Optional("glow_enabled"): bool,
        vol.Optional("temp_min"): vol.Coerce(float),
        vol.Optional("temp_max"): vol.Coerce(float),
        vol.Optional("show_lqi"): bool,
        # "draw less" switches; absent = False = everything is drawn as before
        vol.Optional("hide_decor"): bool,
        vol.Optional("hide_openings"): bool,
        vol.Optional("label_temp"): bool,
        vol.Optional("label_hum"): bool,
        vol.Optional("label_lqi"): bool,
        vol.Optional("label_light"): bool,
        vol.Optional("card_font_scale"): vol.All(vol.Coerce(float), vol.Range(min=0.5, max=3)),
        # sun on the plan (docs/SUN.md): per-space overrides, absent = inherit
        vol.Optional("north_deg"): vol.Any(None, _north_deg),
        vol.Optional("bg_mode"): vol.Any(None, _BG_MODE),
        vol.Optional("sun_rays"): vol.Any(None, bool),
    },
    extra=vol.ALLOW_EXTRA,
)

# Live text on a decor label (docs/LIVE-TEXT.md). An entity id is
# `<domain>.<object_id>`; HA itself allows only lowercase letters, digits and
# underscores in both halves. The bound is a sanity limit, not a policy.
MAX_ENTITY_ID = 255
_ENTITY_ID = vol.All(str, vol.Length(min=3, max=MAX_ENTITY_ID),
                     vol.Match(r"^[a-z0-9_]+\.[a-z0-9_]+$"))
# A caption is a caption: the inline-reference template is bounded. Attribute
# and unit bounds below apply only to legacy beta.9 link fields, which remain
# accepted so an older saved plan can reach the frontend and migrate on edit.
MAX_DECOR_TEXT = 200
MAX_DECOR_ATTR = 64
MAX_DECOR_UNIT = 16
# The text block is scaled by dragging its corners; the range is what a human
# could mean on a 1000-unit canvas, the rest is garbage insurance.
DECOR_TEXT_SCALE_MIN = 0.15
DECOR_TEXT_SCALE_MAX = 20.0
DECOR_TEXT_CM_MAX = 2000.0
# A furniture symbol id (docs/FURNITURE.md). Deliberately NOT the card's list:
# the backend must accept a plan written by a NEWER card, and a card that has
# learnt a new symbol must not have to wait for the integration to be updated
# before the user can save. What is enforced is the shape of the id — a flat
# lowercase name — and its length; an id this backend has never heard of simply
# renders as nothing in an older card.
MAX_FURN_SYMBOL = 32
_FURN_SYMBOL = vol.All(str, vol.Length(min=1, max=MAX_FURN_SYMBOL),
                       vol.Match(r"^[a-z0-9_]+$"))
# …and its size: strictly positive, capped by the same canvas insurance limit
# an opening's length is. A piece of furniture is a SIZE, not a coordinate.
_FURN_SIZE = vol.All(_finite, vol.Range(min=0.0000001, max=CANVAS_LIMIT))
_DECOR_ASSET_ID = vol.All(str, vol.Match(r"^[0-9a-f]{64}$"))

_DECOR_COMMON = {
    vol.Required("id"): str,
    vol.Optional("color"): _COLOR,
    vol.Optional("opacity"): vol.All(_finite, vol.Range(min=0.0, max=1.0)),
    # Physical centimetres are canonical. `width` remains accepted so plans
    # written by older cards keep their exact appearance until edited.
    vol.Optional("width_cm"): vol.All(_finite, vol.Range(min=0.1, max=100)),
    vol.Optional("width"): vol.All(vol.Coerce(float), vol.Range(min=0.1, max=30)),
}
# Decor lives on the same unbounded canvas as everything else (docs/CANVAS.md):
# it used to be pinned to -1..2, i.e. "one canvas of slack around the square".
_NORM = vol.All(_finite, vol.Range(min=-CANVAS_LIMIT, max=CANVAS_LIMIT))
DECOR_SCHEMA = vol.Any(
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): "line",
                vol.Required("x1"): _NORM, vol.Required("y1"): _NORM,
                vol.Required("x2"): _NORM, vol.Required("y2"): _NORM,
                vol.Optional("line_style"): vol.In(["solid", "dashed"])},
               extra=vol.ALLOW_EXTRA),
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): vol.In(["rect", "ellipse"]),
                vol.Required("x"): _NORM, vol.Required("y"): _NORM,
                # sizes are extents — negative/zero is garbage, not "canvas slack"
                vol.Required("w"): vol.All(_finite, vol.Range(min=0.001, max=CANVAS_LIMIT)),
                vol.Required("h"): vol.All(_finite, vol.Range(min=0.001, max=CANVAS_LIMIT)),
                vol.Optional("angle"): vol.All(_finite, vol.Range(min=-360.0, max=360.0)),
                vol.Optional("fill"): bool,
                vol.Optional("fill_color"): _COLOR,
                vol.Optional("fill_opacity"): vol.All(_finite, vol.Range(min=0.0, max=1.0))},
               extra=vol.ALLOW_EXTRA),
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): "text",
                vol.Required("x"): _NORM, vol.Required("y"): _NORM,
                # the template: newlines are the user's own line breaks and are
                # kept verbatim (docs/LIVE-TEXT.md); the label never wraps itself
                vol.Required("text"): vol.All(str, vol.Length(min=1, max=MAX_DECOR_TEXT)),
                # legacy font size ('s'|'m'|'l'). The dialog no longer offers it
                # — the block is scaled by its corner handles — but a plan
                # written before that keeps it, and it is read as the scale it
                # used to render at. Kept in the schema so it stays BOUNDED.
                vol.Optional("size"): vol.In(["s", "m", "l"]),
                # Canonical physical font size plus the legacy scale. Both are
                # accepted so older plans remain pixel-identical until edited
                # or explicitly optimized.
                vol.Optional("size_cm"): vol.All(
                    _finite, vol.Range(min=0.1, max=DECOR_TEXT_CM_MAX)),
                vol.Optional("scale"): vol.All(
                    _finite, vol.Range(min=DECOR_TEXT_SCALE_MIN, max=DECOR_TEXT_SCALE_MAX)),
                vol.Optional("angle"): vol.All(_finite, vol.Range(min=-360.0, max=360.0)),
                # Legacy one-value link (beta.9 and earlier). New labels store
                # every `{entity[:attribute]}` reference directly in `text`;
                # these stay accepted solely for backward compatibility.
                vol.Optional("entity"): vol.Any(None, _ENTITY_ID),
                vol.Optional("attr"): vol.Any(None, vol.All(str, vol.Length(max=MAX_DECOR_ATTR))),
                vol.Optional("unit"): vol.Any(None, vol.All(str, vol.Length(max=MAX_DECOR_UNIT)))},
               extra=vol.ALLOW_EXTRA),
    # A piece of furniture (docs/FURNITURE.md): a symbol id, a normalised box
    # and an optional rotation. It is a NEW kind, so no existing plan carries
    # it, nothing is migrated, and an integration that has this branch reads
    # every older config byte-for-byte as before.
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): "furniture",
                vol.Required("symbol"): _FURN_SYMBOL,
                vol.Required("x"): _NORM, vol.Required("y"): _NORM,
                vol.Required("w"): _FURN_SIZE, vol.Required("h"): _FURN_SIZE,
                vol.Optional("flip_h"): bool, vol.Optional("flip_v"): bool,
                vol.Optional("angle"): vol.All(_finite, vol.Range(min=-360.0, max=360.0))},
               extra=vol.ALLOW_EXTRA),
    vol.Schema({**_DECOR_COMMON, vol.Required("kind"): "image",
                vol.Required("asset_id"): _DECOR_ASSET_ID,
                vol.Required("x"): _NORM, vol.Required("y"): _NORM,
                vol.Required("w"): _FURN_SIZE, vol.Required("h"): _FURN_SIZE,
                vol.Optional("flip_h"): bool, vol.Optional("flip_v"): bool,
                vol.Optional("angle"): vol.All(_finite, vol.Range(min=-360.0, max=360.0))},
               extra=vol.ALLOW_EXTRA),
)


def _wall_endpoints_pair(entry: dict) -> dict:
    """Exact wall endpoints are useful only as a complete a/b pair."""
    if ("a" in entry) != ("b" in entry):
        raise vol.Invalid("wall exact endpoints require both a and b")
    return entry


WALL_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Required("key"): vol.All(str, vol.Length(min=1, max=64)),
            vol.Required("cm"): vol.All(_finite, vol.Range(min=1, max=100)),
            # New writes retain exact normalized interval endpoints. The old
            # key remains the compatibility lookup; endpoints preserve a
            # differing-thickness breakpoint after a virtual span is closed.
            vol.Optional("a"): vol.All([_NORM], vol.Length(min=2, max=2)),
            vol.Optional("b"): vol.All([_NORM], vol.Length(min=2, max=2)),
        },
        extra=vol.ALLOW_EXTRA,
    ),
    _wall_endpoints_pair,
)


def _wall_segment_nonzero(value: dict) -> dict:
    if value["a"] == value["b"]:
        raise vol.Invalid("wall segment endpoints must differ")
    return value


WALL_SEGMENT_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Required("id"): vol.All(str, vol.Length(min=1, max=64)),
            vol.Required("a"): POINT,
            vol.Required("b"): POINT,
            vol.Required("cm"): vol.All(_finite, vol.Range(min=0, max=100)),
        },
        extra=vol.ALLOW_EXTRA,
    ),
    _wall_segment_nonzero,
)


def _room_draft_segments(value: dict) -> dict:
    """An open draft has exactly one thickness per consecutive edge."""
    if len(value.get("segments", [])) != max(0, len(value.get("points", [])) - 1):
        raise vol.Invalid("room draft segments must match consecutive point pairs")
    if any(a == b for a, b in zip(value.get("points", []), value.get("points", [])[1:], strict=False)):  # #42 B905: adjacent pairs
        raise vol.Invalid("room draft consecutive points must differ")
    return value


ROOM_DRAFT_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Required("id"): vol.All(str, vol.Length(min=1, max=64)),
            vol.Required("points"): vol.All([POINT], vol.Length(min=2, max=500)),
            vol.Required("segments"): vol.All(
                [vol.Schema({
                    vol.Optional("id"): vol.All(str, vol.Length(min=1, max=64)),
                    vol.Required("cm"): vol.All(_finite, vol.Range(min=0, max=100)),
                },
                            extra=vol.ALLOW_EXTRA)],
                vol.Length(min=1, max=499),
            ),
        },
        extra=vol.ALLOW_EXTRA,
    ),
    _room_draft_segments,
)

def _partition_nonzero(value: dict) -> dict:
    if value["a"] == value["b"]:
        raise vol.Invalid("partition endpoints must differ")
    return value


PARTITION_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Required("id"): vol.All(str, vol.Length(min=1, max=64)),
            vol.Required("a"): POINT,
            vol.Required("b"): POINT,
            vol.Required("cm"): vol.All(_finite, vol.Range(min=0, max=100)),
        },
        extra=vol.ALLOW_EXTRA,
    ),
    _partition_nonzero,
)

def _strict_wall_column(value: dict) -> dict:
    """Reject shape-inapplicable or non-canonical column fields."""
    if value["shape"] == "circle" and "angle" in value:
        raise vol.Invalid("angle is allowed only for square wall columns")
    if value["shape"] == "square" and value.get("angle", 0) >= 90:
        raise vol.Invalid("square wall column angle must be in [0, 90)")
    return value


WALL_COLUMN_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Required("id"): vol.All(str, vol.Length(min=1, max=64)),
            vol.Required("shape"): vol.In(["square", "circle"]),
            vol.Required("center"): POINT,
            # Outer side for a square, outer diameter for a circle.
            vol.Required("cm"): vol.All(_finite, vol.Range(min=1, max=150)),
            vol.Optional("angle"): vol.All(
                _finite, vol.Range(min=0, max=90)
            ),
        },
        extra=vol.ALLOW_EXTRA,
    ),
    _strict_wall_column,
)

PARTITION_OPENING_HOST_SCHEMA = vol.Schema(
    {
        vol.Required("kind"): vol.Equal("partition"),
        vol.Required("id"): vol.All(str, vol.Length(min=1, max=64)),
        vol.Required("t"): vol.All(_finite, vol.Range(min=0, max=1)),
    },
    extra=vol.PREVENT_EXTRA,
)

WALL_OPENING_HOST_SCHEMA = vol.Schema(
    {
        vol.Required("kind"): vol.Equal("wall"),
        vol.Required("id"): vol.All(str, vol.Length(min=1, max=64)),
        vol.Required("t"): vol.All(_finite, vol.Range(min=0, max=1)),
    },
    extra=vol.PREVENT_EXTRA,
)

OPENING_HOST_SCHEMA = vol.Any(PARTITION_OPENING_HOST_SCHEMA, WALL_OPENING_HOST_SCHEMA)


def _space_geometry_invariants(value: dict) -> dict:
    """All stored geometry shares ids; draft segments also have a space cap."""
    seen: set[str] = set()
    for key in ("rooms", "openings", "decor", "room_drafts", "partitions", "wall_columns", "wall_segments"):
        for item in value.get(key, []):
            item_id = item.get("id")
            if not item_id:
                continue
            if item_id in seen:
                raise vol.Invalid("geometry object ids must be unique within a space")
            seen.add(item_id)
    draft_segments = sum(
        len(item.get("segments", [])) for item in value.get("room_drafts", [])
    )
    if draft_segments > MAX_DRAFT_SEGMENTS:
        raise vol.Invalid("too many saved room-draft segments")
    for draft in value.get("room_drafts", []):
        for segment in draft.get("segments", []):
            segment_id = segment.get("id")
            if not segment_id:
                continue
            if segment_id in seen:
                raise vol.Invalid("geometry object ids must be unique within a space")
            seen.add(segment_id)
    partitions = {
        item.get("id"): item for item in value.get("partitions", []) if item.get("id")
    }
    hosted_intervals: dict[str, list[tuple[float, float]]] = {}
    for opening in value.get("openings", []):
        host = opening.get("host")
        if host is None:
            continue
        if host["kind"] != "partition":
            continue
        partition = partitions.get(host["id"])
        if partition is None:
            raise vol.Invalid("partition opening host must exist in the same space")
        ax, ay = partition["a"]
        bx, by = partition["b"]
        span = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
        length = float(opening["length"])
        along = float(host["t"]) * span
        if length > span or along - length / 2 < -1e-9 or along + length / 2 > span + 1e-9:
            raise vol.Invalid("partition opening must fit inside its host")
        lo, hi = along - length / 2, along + length / 2
        occupied = hosted_intervals.setdefault(host["id"], [])
        if any(max(lo, old_lo) < min(hi, old_hi) - 1e-9 for old_lo, old_hi in occupied):
            raise vol.Invalid("partition openings must not overlap")
        occupied.append((lo, hi))
    return value


SPACE_SCHEMA = vol.All(vol.Schema(
    {
        vol.Required("id"): vol.All(str, vol.Match(SPACE_ID_RE.pattern)),
        vol.Required("title"): str,
        # Physical grid scale. It feeds every px/cell -> centimetres migration,
        # so NaN/Infinity or an absurd value must not be allowed to manufacture
        # invalid decor sizes later.
        vol.Optional("cell_cm"): vol.All(
            _finite, vol.Range(min=CELL_CM_MIN, max=CELL_CM_MAX)
        ),
        vol.Optional("settings"): SPACE_DISPLAY_SCHEMA,
        vol.Optional("plan_url"): vol.Any(str, None),
        # The canvas is square since v1.48.0. What used to be the space's own
        # `aspect` is gone; the background image keeps its own proportions and
        # is centred, so only the IMAGE's ratio is stored. A stale tab may still
        # send the old field — it is dropped rather than trusted, because the
        # coordinates it comes with were normalised against a different box.
        vol.Remove("aspect"): object,
        vol.Optional("plan_aspect"): vol.Any(
            None, vol.All(vol.Coerce(float), vol.Range(min=0.05, max=20))
        ),
        # Backdrop placement (docs/BACKDROP.md): the picture may be moved,
        # resized per axis and rotated. Every transform field is optional; its
        # complete absence is the pre-v1.58.0 behaviour exactly, and an old
        # config validates unchanged. The offset is a normalised
        # coordinate like every other one (the ±CANVAS_LIMIT garbage guard);
        # the scale is a positive multiplier in a range a human could mean.
        vol.Optional("plan_x"): vol.Any(None, _COORD),
        vol.Optional("plan_y"): vol.Any(None, _COORD),
        vol.Optional("plan_scale"): vol.Any(
            None, vol.All(_finite, vol.Range(min=PLAN_SCALE_MIN, max=PLAN_SCALE_MAX))
        ),
        # New writes may stretch each axis independently and rotate. The old
        # uniform field remains a read-compatible fallback for both axes.
        vol.Optional("plan_scale_x"): vol.Any(
            None, vol.All(_finite, vol.Range(min=PLAN_SCALE_MIN, max=PLAN_SCALE_MAX))
        ),
        vol.Optional("plan_scale_y"): vol.Any(
            None, vol.All(_finite, vol.Range(min=PLAN_SCALE_MIN, max=PLAN_SCALE_MAX))
        ),
        vol.Optional("plan_angle"): vol.Any(
            None, vol.All(_finite, vol.Range(min=-360.0, max=360.0))
        ),
        vol.Required("view_box"): _view_box,
        vol.Required("rooms"): vol.All([ROOM_SCHEMA], vol.Length(max=MAX_ROOMS)),
        vol.Optional("decor"): vol.All([DECOR_SCHEMA], vol.Length(max=MAX_DECOR)),
        vol.Optional("openings"): vol.All([
            vol.Schema(
                {
                    vol.Required("id"): str,
                    vol.Required("type"): vol.Any("door", "window", "gate", "passage"),
                    vol.Required("x"): _GEOM,
                    vol.Required("y"): _GEOM,
                    vol.Required("angle"): vol.All(_finite, vol.Range(min=-360.0, max=360.0)),
                    # a SIZE: strictly positive, capped by the canvas insurance
                    # limit rather than by the old unit square (docs/CANVAS.md)
                    vol.Required("length"): vol.All(_finite, vol.Range(min=0.001, max=CANVAS_LIMIT)),
                    vol.Optional("contact"): vol.Any(str, None),
                    vol.Optional("lock"): vol.Any(str, None),
                    vol.Optional("invert"): bool,
                    vol.Optional("flip_h"): bool,
                    vol.Optional("flip_v"): bool,
                    vol.Optional("host"): OPENING_HOST_SCHEMA,
                },
                extra=vol.ALLOW_EXTRA,
            )
        ], vol.Length(max=MAX_OPENINGS)),
        # Wall thickness (docs/WALL-THICKNESS.md): keyed by a segment identity
        # (midpoint + direction), thickness always in centimetres. Optional —
        # a space without `walls` validates and renders exactly as before.
        vol.Optional("walls"): vol.All([WALL_SCHEMA], vol.Length(max=MAX_WALLS)),
        vol.Optional("wall_segments"): vol.All(
            [WALL_SEGMENT_SCHEMA], vol.Length(max=MAX_WALL_SEGMENTS)
        ),
        vol.Optional("zero_wall_style"): vol.In(["dashed", "solid"]),
        vol.Optional("room_drafts"): vol.All(
            [ROOM_DRAFT_SCHEMA], vol.Length(max=MAX_ROOM_DRAFTS)
        ),
        vol.Optional("partitions"): vol.All(
            [PARTITION_SCHEMA], vol.Length(max=MAX_PARTITIONS)
        ),
        vol.Optional("wall_columns"): vol.All(
            [WALL_COLUMN_SCHEMA], vol.Length(max=MAX_WALL_COLUMNS)
        ),
        # Open (virtual) wall stretches: a piece of a shared boundary that the
        # user opened. Optional and bounded — a space without `open_spans`
        # validates exactly as before, and the legacy `rooms[].open_to` index
        # keeps working on its own (AUD-159B6-03).
        vol.Optional("open_spans"): vol.All(
            vol.Length(max=MAX_OPEN_SPANS), [_open_span], _dedupe_open_spans,
        ),
        # Legacy: walls are derived from room outlines since v1.19.0 — a line has no
        # independent existence. Still accepted so a stale browser tab cannot fail a save;
        # the card strips the field on every write.
        # Accepted so a stale browser tab cannot fail a save, then DROPPED here
        # (HP-1454-05): relying on a modern client to strip an unbounded legacy
        # list is not a limit, it is a hope. `Remove` returns the key stripped.
        vol.Remove("segments"): object,
    },
    extra=vol.ALLOW_EXTRA,
), _space_geometry_invariants)
MARKER_SCHEMA = vol.Schema(
    {
        vol.Required("id"): str,
        # 'device:<device_id>' | 'entity:<entity_id>' | 'virtual'
        vol.Required("binding"): vol.All(
            str,
            vol.Length(min=1, max=MAX_TEXT),
            vol.Match(r"^(device:.+|entity:.+|virtual)$"),
        ),
        vol.Optional("space"): vol.Any(str, None),
        vol.Optional("area"): vol.Any(str, None),
        vol.Optional("hidden"): bool,
        # A binding-level tombstone: not rendered or aggregated, but retained
        # so automatic discovery does not put a deleted device straight back.
        vol.Optional("removed"): bool,
        vol.Optional("name"): _TEXT_OR_NONE,
        vol.Optional("icon"): _TEXT_OR_NONE,
        vol.Optional("model"): _TEXT_OR_NONE,
        vol.Optional("link"): vol.Any(None, _URL),
        vol.Optional("description"): vol.Any(None, vol.All(str, vol.Length(max=MAX_DESCRIPTION))),
        vol.Optional("tap_action"): vol.Any("info", "more-info", "toggle", "run", "none", "cover", None),
        # the 'run' target: only the runnable domains, nothing else is callable
        vol.Optional("tap_target"): vol.Any(
            None, vol.All(str, vol.Length(max=MAX_TEXT), vol.Match(r"^(automation|script|scene)\.[A-Za-z0-9_]+$"))
        ),
        vol.Optional("tap_confirm"): vol.Any(bool, None),
        # live robot vacuums (docs/VACUUM.md): everything optional so configs
        # from older versions stay valid untouched
        vol.Optional("vacuum"): vol.Any(
            None,
            vol.Schema({
                vol.Optional("live"): vol.Any(bool, None),
                vol.Optional("trail"): vol.Any(bool, None),
                vol.Optional("trail_mode"): vol.Any(
                    None, vol.In(["never", "cleaning", "always"])
                ),
                vol.Optional("room_highlight"): vol.Any(bool, None),
                vol.Optional("source"): vol.Any(str, None),
                # one 6-number affine per robot map; numbers must be finite
                vol.Optional("calibration"): vol.Schema(
                    {str: vol.All([_finite], vol.Length(min=6, max=6))}
                ),
                vol.Optional("segment_map"): vol.Schema({str: str}),
                # #162: canonical map -> space routing. The schema checks the
                # shape only; identity uniqueness and the referential space
                # check live in validate_marker_vacuum_routes, which is
                # change-aware and must not reject untouched legacy data.
                vol.Optional("map_routes"): vol.Any(
                    None,
                    vol.All([vol.Schema({
                        vol.Required("id"): vol.All(str, vol.Length(min=1, max=128)),
                        vol.Required("source"): vol.All(str, vol.Length(min=1, max=255)),
                        vol.Required("map_id"): vol.All(str, vol.Length(max=255)),
                        vol.Required("space"): vol.All(str, vol.Length(min=1, max=64)),
                        vol.Optional("calibration"): vol.Any(
                            None, vol.All([_finite], vol.Length(min=6, max=6)),
                        ),
                    }, extra=vol.ALLOW_EXTRA)], vol.Length(max=32)),
                ),
            }),
        ),
        vol.Optional("controls"): vol.Any(None, vol.All([_TEXT], vol.Length(max=MAX_CONTROLS))),
        vol.Optional("glow_radius_cm"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=10, max=10000)), None),
        vol.Optional("glow_color"): vol.Any(
            None,
            vol.Schema(
                {
                    vol.Required("c"): _COLOR,
                    vol.Optional("bri"): vol.Any(
                        None,
                        vol.All(_finite, vol.Range(min=0.01, max=1.0)),
                    ),
                }
            ),
        ),
        vol.Optional("is_light"): vol.Any(bool, None),
        # Explicit leading entity for composite Always sources. It is kept
        # literally when temporarily absent; runtime falls back without
        # deleting the user's choice.
        # Semantic delta validation below the schema preserves unknown/future
        # literals until that exact field is edited (lossless config doctrine).
        vol.Optional("light_entity"): object,
        # Exact own entity selected for Toggle. Delta validation preserves an
        # untouched future literal while bounding every new/changed value.
        vol.Optional("toggle_entity"): object,
        vol.Optional("value_badge"): vol.Any(
            None,
            vol.Schema(
                {
                    # Required semantically for changed/new data. Optional here
                    # keeps old/future configs readable until the user edits it.
                    vol.Optional("enabled"): object,
                    vol.Optional("position"): object,
                    vol.Optional("source"): vol.Any(
                        None,
                        vol.Schema({}, extra=vol.ALLOW_EXTRA),
                    ),
                },
                extra=vol.ALLOW_EXTRA,
            ),
        ),
        # Explicit source for display:value. Semantic delta validation shares
        # the badge source contract while keeping untouched future literals.
        vol.Optional("value_source"): vol.Any(
            None,
            vol.Schema({}, extra=vol.ALLOW_EXTRA),
        ),
        # climate current_temperature: badge + room-average vote (off unless True)
        vol.Optional("use_climate_temp"): vol.Any(bool, None),
        vol.Optional("room_id"): vol.Any(str, None),
        # Keep in sync with DISPLAY_MODES in src/logic.ts. `ripple` is no longer
        # offered, but remains accepted while old stores migrate to icon_ripple.
        vol.Optional("display"): vol.Any("badge", "ripple", "icon_ripple", "value", "static_icon", None),
        vol.Optional("ripple_color"): vol.Any(None, _COLOR),
        vol.Optional("ripple_size"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=1, max=20)), None),
        vol.Optional("size"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=0.2, max=6)), None),
        vol.Optional("angle"): vol.Any(vol.All(vol.Coerce(float), vol.Range(min=-360, max=360)), None),
        vol.Optional("pdfs"): vol.All(
            [vol.Schema({vol.Required("name"): _TEXT, vol.Required("url"): _URL}, extra=vol.ALLOW_EXTRA)],
            vol.Length(max=MAX_PDFS),
        ),
    },
    extra=vol.ALLOW_EXTRA,
)


def _canonical_segment_key(a: list, b: list) -> tuple:
    """Endpoint-order-independent exact key after the shared canonicalizer."""
    pa = (round(float(a[0]), 12), round(float(a[1]), 12))
    pb = (round(float(b[0]), 12), round(float(b[1]), 12))
    return (pa, pb) if pa <= pb else (pb, pa)


def _config_wall_segment_invariants(value: dict) -> dict:
    """Fail closed when a v8+ writer sends stale ids or wall projections."""
    try:
        model = int(value.get("model_version", 0))
    except (TypeError, ValueError):
        raise vol.Invalid("model_version must be an integer") from None
    if model < 8:
        return value

    for space in value.get("spaces", []):
        if model >= 9:
            if "open_spans" in space or any("open_to" in room for room in space.get("rooms", [])):
                raise vol.Invalid("v9 config must not contain legacy open boundaries")
        segments = space.get("wall_segments")
        if segments is None:
            raise vol.Invalid("v8+ space requires wall_segments")
        by_id = {segment["id"]: segment for segment in segments}
        if len(by_id) != len(segments):
            raise vol.Invalid("wall segment ids must be unique")

        owners: dict[str, set[str]] = {segment_id: set() for segment_id in by_id}
        for room in space.get("rooms", []):
            poly = room.get("poly")
            wall_ids = room.get("wall_ids")
            if not poly or not wall_ids or len(poly) != len(wall_ids):
                raise vol.Invalid("v8+ room wall_ids must match poly edges")
            room_id = room["id"]
            for index, segment_id in enumerate(wall_ids):
                segment = by_id.get(segment_id)
                if segment is None:
                    raise vol.Invalid("room wall id must reference the same space")
                edge_key = _canonical_segment_key(poly[index], poly[(index + 1) % len(poly)])
                if edge_key != _canonical_segment_key(segment["a"], segment["b"]):
                    raise vol.Invalid("room wall reference geometry must match its edge")
                owners[segment_id].add(room_id)
        if any(len(room_ids) not in (1, 2) for room_ids in owners.values()):
            raise vol.Invalid("wall segment must have one or two room owners")

        expected_walls = {
            _canonical_segment_key(segment["a"], segment["b"]): float(segment["cm"])
            for segment in segments if float(segment["cm"]) > 0
        }
        actual_walls: dict[tuple, float] = {}
        for wall in space.get("walls", []):
            if "a" not in wall or "b" not in wall:
                raise vol.Invalid("wall compatibility projection requires exact endpoints")
            key = _canonical_segment_key(wall["a"], wall["b"])
            if key in actual_walls:
                raise vol.Invalid("wall compatibility projection must be unique")
            actual_walls[key] = float(wall["cm"])
        if actual_walls != expected_walls:
            raise vol.Invalid("wall compatibility projection must match wall_segments")

        for draft in space.get("room_drafts", []):
            if any(not segment.get("id") for segment in draft.get("segments", [])):
                raise vol.Invalid("v8+ draft wall segments require ids")

        partitions = {item["id"]: item for item in space.get("partitions", [])}
        wall_opening_intervals: dict[str, list[tuple[float, float]]] = {}
        for opening in space.get("openings", []):
            host = opening.get("host")
            if host is None:
                # #316 §3.3: a degraded migration may leave a contour opening
                # unhosted. It is inert (no body/tunnel/cut) and excluded from
                # the interval checks; a later edit can re-place it.
                continue
            if host["kind"] == "partition":
                if host["id"] not in partitions:
                    raise vol.Invalid("partition opening host must exist in the same space")
                if float(partitions[host["id"]]["cm"]) <= 0:
                    raise vol.Invalid("opening host must have positive thickness")
                continue
            segment = by_id.get(host["id"])
            if segment is None:
                raise vol.Invalid("wall opening host must exist in the same space")
            if float(segment["cm"]) <= 0:
                raise vol.Invalid("opening host must have positive thickness")
            t = float(host["t"])
            x = float(segment["a"][0]) + (float(segment["b"][0]) - float(segment["a"][0])) * t
            y = float(segment["a"][1]) + (float(segment["b"][1]) - float(segment["a"][1])) * t
            if abs(x - float(opening["x"])) > 2e-8 or abs(y - float(opening["y"])) > 2e-8:
                raise vol.Invalid("wall opening geometry must match its host")
            expected_angle = math.degrees(math.atan2(
                float(segment["b"][1]) - float(segment["a"][1]),
                float(segment["b"][0]) - float(segment["a"][0]),
            ))
            if _angle_delta_mod_180(float(opening["angle"]), expected_angle) > 8:
                raise vol.Invalid("wall opening angle must match its host")
            span = ((segment["b"][0] - segment["a"][0]) ** 2
                    + (segment["b"][1] - segment["a"][1]) ** 2) ** 0.5
            along = t * span
            length = float(opening["length"])
            if length > span or along - length / 2 < -1e-9 or along + length / 2 > span + 1e-9:
                raise vol.Invalid("wall opening must fit inside its host")
            lo, hi = along - length / 2, along + length / 2
            occupied = wall_opening_intervals.setdefault(host["id"], [])
            if any(max(lo, old_lo) < min(hi, old_hi) - 1e-9
                   for old_lo, old_hi in occupied):
                raise vol.Invalid("wall openings must not overlap")
            occupied.append((lo, hi))
    return value


CONFIG_SCHEMA = vol.All(
    vol.Schema(
        {
            vol.Optional("model_version"): vol.All(
                vol.Coerce(int), vol.Range(min=0, max=1_000_000)
            ),
            vol.Required("spaces"): vol.All([SPACE_SCHEMA], vol.Length(max=MAX_SPACES)),
            vol.Optional("markers", default=list): vol.All([MARKER_SCHEMA], vol.Length(max=MAX_MARKERS)),
            vol.Optional("settings", default=dict): vol.Schema(
                {
                    vol.Optional("glow_radius_cm"): vol.All(vol.Coerce(float), vol.Range(min=10, max=10000)),
                    # background around the plan, all spaces (a space may override)
                    vol.Optional("bg_color"): _COLOR,
                    # #377: the Background editor's default style for new decor
                    # objects; absence of the key means the built-in default
                    vol.Optional("decor_default_style"): vol.Schema(
                        {
                            vol.Optional("color"): _COLOR,
                            vol.Optional("opacity"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
                            vol.Optional("width_cm"): vol.All(vol.Coerce(float), vol.Range(min=0.1, max=100)),
                            vol.Optional("fill"): bool,
                            vol.Optional("fill_color"): _COLOR,
                            vol.Optional("fill_opacity"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
                        }
                    ),
                    # sun on the plan (docs/SUN.md): global defaults
                    vol.Optional("north_deg"): _north_deg,
                    vol.Optional("bg_mode"): _BG_MODE,
                    vol.Optional("sun_rays"): bool,
                    vol.Optional("show_room_tooltip"): bool,
                    # Removed from the UI/runtime in 2026-08-08. Keep accepting the
                    # legacy field so an existing stored config can still load; the
                    # frontend ignores it and removes it on the next settings save.
                    vol.Optional("weather_entity"): vol.Any(None, _TEXT),
                    vol.Optional("known_devices"): vol.All([_TEXT], vol.Length(max=MAX_KNOWN_DEVICES)),
                    vol.Optional("new_device_ids"): vol.All([_TEXT], vol.Length(max=MAX_KNOWN_DEVICES)),
                    vol.Optional("marker_area_snapshot"): vol.All(
                        vol.Schema({
                            _NONEMPTY_TEXT: vol.Schema({
                                vol.Required("binding"): vol.All(
                                    _NONEMPTY_TEXT,
                                    vol.Match(r"^(?:device|entity):.+$"),
                                ),
                                vol.Required("area"): _NONEMPTY_TEXT,
                            }),
                        }),
                        vol.Length(max=MAX_MARKER_AREA_SNAPSHOT),
                    ),
                    vol.Optional("fill_colors"): vol.Schema(
                        {
                            str: vol.Schema(
                                {
                                    vol.Required("c"): _COLOR,
                                    vol.Required("a"): vol.All(vol.Coerce(float), vol.Range(min=0, max=1)),
                                }
                            )
                        }
                    ),
                },
                extra=vol.ALLOW_EXTRA,
            ),
        },
        extra=vol.ALLOW_EXTRA,  # unknown (legacy) keys do not break loading
    ),
    canonicalize_config_geometry,
    _config_wall_segment_invariants,
)
