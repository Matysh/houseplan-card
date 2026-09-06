"""Deterministic persisted contour-wall identity (model v10, issues #282/#478).

This is the backend twin of ``src/wall-segment-model.ts``.  Import preview is
a server-side structural writer, so it cannot depend on a browser being open
to upgrade v7 backups before validating/remapping them.
"""
from __future__ import annotations

import base64
import copy
import hashlib
import math
import uuid
from typing import Any

from .coordinate_canonicalization import canonicalize_config_geometry

WALL_SEGMENT_MODEL_VERSION = 10
GRID_STEP_N = 1 / 240
EPS = 1e-9


class WallSegmentMigrationError(ValueError):
    """The candidate cannot be upgraded without guessing ownership."""

    code = "wall_model_migration_blocked"

    def __init__(self, reason: str, detail: str = "") -> None:
        self.reason = reason
        super().__init__(f"{reason}: {detail}" if detail else reason)


def _point_key(point: list[float]) -> str:
    return f"{float(point[0]):.12f},{float(point[1]):.12f}"


def _span_key(a: list[float], b: list[float]) -> str:
    ka, kb = _point_key(a), _point_key(b)
    return f"{ka}|{kb}" if ka < kb else f"{kb}|{ka}"


def _canonical_span(a: list[float], b: list[float]) -> tuple[list[float], list[float]]:
    left, right = ([float(a[0]), float(a[1])], [float(b[0]), float(b[1])])
    return (left, right) if _point_key(left) <= _point_key(right) else (right, left)


def _length(a: list[float], b: list[float]) -> float:
    return math.hypot(float(b[0]) - float(a[0]), float(b[1]) - float(a[1]))


def _project_t(point: list[float], a: list[float], b: list[float]) -> float:
    dx, dy = float(b[0]) - float(a[0]), float(b[1]) - float(a[1])
    denominator = dx * dx + dy * dy
    if denominator <= EPS * EPS:
        return 0
    return ((float(point[0]) - float(a[0])) * dx
            + (float(point[1]) - float(a[1])) * dy) / denominator


def _distance_to_segment(point: list[float], a: list[float], b: list[float]) -> float:
    t = max(0.0, min(1.0, _project_t(point, a, b)))
    return math.hypot(
        float(point[0]) - (float(a[0]) + (float(b[0]) - float(a[0])) * t),
        float(point[1]) - (float(a[1]) + (float(b[1]) - float(a[1])) * t),
    )


def _collinear_overlap(
    a: list[float], b: list[float], c: list[float], d: list[float], epsilon: float = EPS,
) -> float:
    dx, dy = float(b[0]) - float(a[0]), float(b[1]) - float(a[1])
    length = math.hypot(dx, dy)
    if length <= epsilon:
        return 0
    cross_c = abs((float(c[0]) - float(a[0])) * dy
                  - (float(c[1]) - float(a[1])) * dx) / length
    cross_d = abs((float(d[0]) - float(a[0])) * dy
                  - (float(d[1]) - float(a[1])) * dx) / length
    if cross_c > epsilon or cross_d > epsilon:
        return 0
    tc, td = _project_t(c, a, b), _project_t(d, a, b)
    return max(0.0, min(1.0, max(tc, td)) - max(0.0, min(tc, td))) * length


def _room_poly(room: dict[str, Any]) -> list[list[float]]:
    poly = room.get("poly")
    if isinstance(poly, list) and len(poly) >= 3:
        return [[float(point[0]), float(point[1])] for point in poly]
    if all(isinstance(room.get(key), (int, float)) and not isinstance(room.get(key), bool)
           for key in ("x", "y", "w", "h")):
        x, y, width, height = (float(room[key]) for key in ("x", "y", "w", "h"))
        return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]
    return []


def _shared_boundaries(first: list[list[float]], second: list[list[float]]) -> list[list[float]]:
    result: list[list[float]] = []
    epsilon = GRID_STEP_N * 0.04
    for index, start in enumerate(first):
        end = first[(index + 1) % len(first)]
        dx, dy = end[0] - start[0], end[1] - start[1]
        length = math.hypot(dx, dy)
        if length < epsilon:
            continue
        ux, uy = dx / length, dy / length
        for other_index, other_start in enumerate(second):
            other_end = second[(other_index + 1) % len(second)]
            tolerance = max(epsilon, length * 1e-6)
            distances = [
                abs((point[0] - start[0]) * uy - (point[1] - start[1]) * ux)
                for point in (other_start, other_end)
            ]
            if max(distances) > tolerance:
                continue
            t1 = (other_start[0] - start[0]) * ux + (other_start[1] - start[1]) * uy
            t2 = (other_end[0] - start[0]) * ux + (other_end[1] - start[1]) * uy
            lo, hi = max(0.0, min(t1, t2)), min(length, max(t1, t2))
            if hi - lo > epsilon:
                result.append([
                    start[0] + ux * lo, start[1] + uy * lo,
                    start[0] + ux * hi, start[1] + uy * hi,
                ])
    return result


def _wall_direction(a: list[float], b: list[float]) -> tuple[float, float]:
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    if length < 1e-12:
        return 1.0, 0.0
    dx, dy = dx / length, dy / length
    if dx < -1e-12 or (abs(dx) <= 1e-12 and dy < 0):
        dx, dy = -dx, -dy
    return dx, dy


def _js_round(value: float) -> int:
    return math.floor(value + 0.5)


def _quantize(value: float, pitch: float = GRID_STEP_N) -> float:
    return _js_round(value / pitch) * pitch


def _wall_key(a: list[float], b: list[float]) -> str:
    midpoint_x = _quantize((float(a[0]) + float(b[0])) / 2)
    midpoint_y = _quantize((float(a[1]) + float(b[1])) / 2)
    dx, dy = _wall_direction(a, b)
    angle = math.atan2(dy, dx)
    if angle < 0:
        angle += math.pi
    angle = _js_round(angle * 1800) / 1800
    return f"{midpoint_x:.6f},{midpoint_y:.6f}@{angle:.4f}"


def deterministic_wall_segment_id(
    space_id: str, a: list[float], b: list[float], owners: list[str], salt: str = "",
) -> str:
    ca, cb = _canonical_span(a, b)
    seed = (f"{space_id}|{_point_key(ca)}|{_point_key(cb)}|"
            f"{','.join(sorted(owners))}{salt}")
    encoded = base64.b32encode(hashlib.sha256(seed.encode()).digest()).decode().lower()
    return f"wall-{encoded[:20]}"


def _translated_segment_delta(
    a: list[float], b: list[float], previous: dict[str, Any],
) -> tuple[float, float] | None:
    def matches(pa: list[float], pb: list[float]) -> tuple[float, float] | None:
        dx, dy = a[0] - pa[0], a[1] - pa[1]
        if abs((b[0] - pb[0]) - dx) <= EPS and abs((b[1] - pb[1]) - dy) <= EPS:
            return dx, dy
        return None

    return matches(previous["a"], previous["b"]) or matches(previous["b"], previous["a"])


def _atomize(
    space: dict[str, Any], old: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rooms = space.get("rooms") or []
    room_polys = {str(room.get("id", "")): _room_poly(room) for room in rooms}
    global_breaks: list[list[float]] = []
    explicit_spans = space.get("open_spans") or []
    legacy_segments: list[list[float]] = []
    for span in explicit_spans:
        if isinstance(span, dict) and isinstance(span.get("a"), list) and isinstance(span.get("b"), list):
            global_breaks.extend((span["a"], span["b"]))
            legacy_segments.append([
                float(span["a"][0]), float(span["a"][1]),
                float(span["b"][0]), float(span["b"][1]),
            ])
    if not legacy_segments:
        def linked(first: dict, second: dict) -> bool:  # #42 E731
            return (
                str(second.get("id", "")) in (first.get("open_to") or [])
                or str(first.get("id", "")) in (second.get("open_to") or [])
            )
        for first_index, first in enumerate(rooms):
            for second in rooms[first_index + 1:]:
                if not linked(first, second):
                    continue
                for shared in _shared_boundaries(
                    room_polys.get(str(first.get("id", "")), []),
                    room_polys.get(str(second.get("id", "")), []),
                ):
                    legacy_segments.append(shared)
                    global_breaks.extend(([shared[0], shared[1]], [shared[2], shared[3]]))
    canonical_zero_segments: list[list[float]] = []
    for room in rooms:
        poly = room_polys.get(str(room.get("id", ""))) or []
        wall_ids = room.get("wall_ids") or []
        if len(wall_ids) != len(poly):
            continue
        for index, segment_id in enumerate(wall_ids):
            previous = old.get(str(segment_id)) if isinstance(segment_id, str) else None
            if previous is None or float(previous.get("cm", 0)) != 0:
                continue
            following = (index + 1) % len(poly)
            canonical_zero_segments.append([
                float(poly[index][0]), float(poly[index][1]),
                float(poly[following][0]), float(poly[following][1]),
            ])
    for segment in canonical_zero_segments:
        global_breaks.extend((segment[:2], segment[2:]))

    # #316 §3.1: a legacy open_spans/open_to cut never zeroes the atom that
    # carries an existing contour opening; its edges become atom boundaries so
    # the zero run continues on both sides of the opening.
    legacy_era_openings: list[dict[str, Any]] = []
    if legacy_segments:
        for opening in space.get("openings") or []:
            if not isinstance(opening, dict):
                continue
            host = opening.get("host")
            if isinstance(host, dict) and host.get("kind") == "partition":
                continue
            try:
                centre = [float(opening["x"]), float(opening["y"])]
                angle = float(opening["angle"])
                half = float(opening["length"]) / 2
            except (KeyError, TypeError, ValueError):
                continue
            if half <= 0:
                continue
            # Only an opening that actually stands on a legacy cut changes the
            # atomization; unrelated openings must not churn the catalogue.
            if not any(
                _distance_to_segment(centre, cut[:2], cut[2:]) <= GRID_STEP_N * 0.04
                for cut in legacy_segments
            ):
                continue
            legacy_era_openings.append(
                {"centre": centre, "angle": angle, "half": half}
            )
            direction = (math.cos(math.radians(angle)), math.sin(math.radians(angle)))
            global_breaks.extend((
                [centre[0] - direction[0] * half, centre[1] - direction[1] * half],
                [centre[0] + direction[0] * half, centre[1] + direction[1] * half],
            ))

    def _atom_carries_opening(a: list[float], b: list[float]) -> bool:
        for entry in legacy_era_openings:
            if not _angle_matches(a, b, entry["angle"]):
                continue
            if _distance_to_segment(entry["centre"], a, b) > GRID_STEP_N * 0.02:
                continue
            span = _length(a, b)
            tc = _project_t(entry["centre"], a, b) * span
            if tc + entry["half"] >= -EPS and tc - entry["half"] <= span + EPS:
                return True
        return False

    for wall in space.get("walls") or []:
        if isinstance(wall, dict) and isinstance(wall.get("a"), list) and isinstance(wall.get("b"), list):
            global_breaks.extend((wall["a"], wall["b"]))

    atoms_by_key: dict[str, dict[str, Any]] = {}
    next_rooms: list[dict[str, Any]] = []
    epsilon = GRID_STEP_N * 0.04
    for raw_room in rooms:
        room_id = str(raw_room.get("id", ""))
        original = room_polys.get(room_id) or []
        if not room_id or len(original) < 3:
            raise WallSegmentMigrationError("invalid-room", room_id)
        breaks = list(global_breaks)
        for other_id, other_poly in room_polys.items():
            if other_id == room_id:
                continue
            for shared in _shared_boundaries(original, other_poly):
                breaks.extend(([shared[0], shared[1]], [shared[2], shared[3]]))

        poly: list[list[float]] = []
        parents: list[int] = []
        for index, a in enumerate(original):
            b = original[(index + 1) % len(original)]
            poly.append(list(a))
            parents.append(index)
            length = _length(a, b)
            if length < epsilon * 2:
                raise WallSegmentMigrationError("zero-length", room_id)
            gap = min(0.499, epsilon * 2 / length)
            positions: list[float] = []
            for breakpoint in breaks:
                if _distance_to_segment(breakpoint, a, b) > epsilon:
                    continue
                t = _project_t(breakpoint, a, b)
                if t <= gap or t >= 1 - gap:
                    continue
                if any(abs(existing - t) * length <= epsilon * 2 for existing in positions):
                    continue
                positions.append(t)
            for t in sorted(positions):
                poly.append([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
                parents.append(index)

        old_ids = raw_room.get("wall_ids") if isinstance(raw_room.get("wall_ids"), list) else []
        indexed_lineage = len(old_ids) == len(original)
        rigid_delta: tuple[float, float] | None = None
        rigid_indexed_lineage = indexed_lineage
        if rigid_indexed_lineage:
            for index, a in enumerate(original):
                previous = old.get(old_ids[index])
                delta = _translated_segment_delta(
                    a, original[(index + 1) % len(original)], previous,
                ) if previous else None
                if delta is None or (rigid_delta is not None and (
                    abs(delta[0] - rigid_delta[0]) > EPS
                    or abs(delta[1] - rigid_delta[1]) > EPS
                )):
                    rigid_indexed_lineage = False
                    break
                rigid_delta = delta
        wall_keys: list[str] = []
        for index, a in enumerate(poly):
            b = poly[(index + 1) % len(poly)]
            key = _span_key(a, b)
            atom = atoms_by_key.setdefault(key, {
                "key": key, "a": _canonical_span(a, b)[0], "b": _canonical_span(a, b)[1],
                "owners": set(), "preferred": set(), "positional": set(),
                "preferred_carriers": {},
                "parent_keys": set(), "zero_wall": False,
            })
            atom["owners"].add(room_id)
            if len(atom["owners"]) > 2:
                raise WallSegmentMigrationError("third-owner", key)
            parent_index = parents[index]
            atom["parent_keys"].add(_wall_key(original[parent_index], original[(parent_index + 1) % len(original)]))
            midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

            # #42 B023/E731: the loop variable is bound as a default — the
            # closure is only called inside this iteration, but the binding
            # makes that safety structural instead of incidental.
            def covered_by(cuts: list[list[float]], *, midpoint: list[float] = midpoint) -> bool:
                return any(
                    _distance_to_segment(midpoint, cut[:2], cut[2:]) <= GRID_STEP_N * 0.04
                    for cut in cuts
                )
            # Canonical cm:0 atoms stay zero; a LEGACY cut spares the atom
            # that carries an opening (#316 §3.1).
            atom["zero_wall"] = atom["zero_wall"] or covered_by(canonical_zero_segments) or (
                covered_by(legacy_segments) and not _atom_carries_opening(a, b)
            )
            if indexed_lineage and isinstance(old_ids[parent_index], str) and old_ids[parent_index]:
                previous = old.get(old_ids[parent_index])
                if rigid_indexed_lineage or previous is None or _collinear_overlap(
                    a, b, previous["a"], previous["b"]
                ) > EPS:
                    atom["preferred"].add(old_ids[parent_index])
                else:
                    atom["positional"].add(old_ids[parent_index])
                atom["preferred_carriers"][old_ids[parent_index]] = {
                    "a": list(original[parent_index]),
                    "b": list(original[(parent_index + 1) % len(original)]),
                }
            wall_keys.append(key)
        next_room = {key: copy.deepcopy(value) for key, value in raw_room.items() if key != "wall_ids"}
        next_room["poly"] = poly
        next_room["wall_ids"] = wall_keys
        next_rooms.append(next_room)
    return sorted(atoms_by_key.values(), key=lambda atom: atom["key"]), next_rooms


def _thickness(space: dict[str, Any], atom: dict[str, Any], previous: dict[str, Any] | None) -> float:
    if atom.get("zero_wall"):
        return 0.0
    candidates: list[float] = []
    query_key = _wall_key(atom["a"], atom["b"])
    query_length = _length(atom["a"], atom["b"])
    for wall in space.get("walls") or []:
        try:
            cm = float(wall.get("cm", 0))
        except (TypeError, ValueError):
            continue
        if cm <= 0:
            continue
        exact_key = wall.get("key") == query_key or wall.get("key") in atom["parent_keys"]
        covers = False
        if isinstance(wall.get("a"), list) and isinstance(wall.get("b"), list):
            overlap = _collinear_overlap(atom["a"], atom["b"], wall["a"], wall["b"])
            covers = overlap >= query_length - EPS
        if exact_key or covers:
            candidates.append(max(1.0, min(100.0, cm)))
    unique = {round(value, 9) for value in candidates}
    if len(unique) > 1:
        raise WallSegmentMigrationError("thickness-conflict", atom["key"])
    if candidates:
        return candidates[0]
    if previous is not None and float(previous.get("cm", 0)) > 0:
        return float(previous["cm"])
    return 0.0


def _non_catalog_ids(space: dict[str, Any]) -> set[str]:
    result: set[str] = set()
    for name in ("rooms", "openings", "decor", "room_drafts", "partitions", "wall_columns"):
        for item in space.get(name) or []:
            if isinstance(item, dict) and isinstance(item.get("id"), str) and item["id"]:
                result.add(item["id"])
    for draft in space.get("room_drafts") or []:
        for segment in draft.get("segments") or []:
            if isinstance(segment, dict) and isinstance(segment.get("id"), str) and segment["id"]:
                result.add(segment["id"])
    return result


def _fresh_wall_segment_id(used: set[str]) -> str:
    for _attempt in range(1000):
        segment_id = f"wall-{uuid.uuid4()}"
        if segment_id not in used:
            return segment_id
    raise WallSegmentMigrationError("duplicate-id", "id factory exhausted")


def _assign_lineage(
    space: dict[str, Any], atoms: list[dict[str, Any]], old: dict[str, dict],
    initial_migration: bool,
) -> None:
    old_by_key = {_span_key(segment["a"], segment["b"]): segment for segment in old.values()}
    host_counts: dict[str, int] = {}
    for opening in space.get("openings") or []:
        host = opening.get("host") if isinstance(opening, dict) else None
        if isinstance(host, dict) and host.get("kind") == "wall":
            host_counts[str(host.get("id"))] = host_counts.get(str(host.get("id")), 0) + 1
    proposals: dict[str, dict[str, Any]] = {}
    for atom in atoms:
        if len(atom["preferred"]) > 1:
            raise WallSegmentMigrationError("duplicate-id", ",".join(sorted(atom["preferred"])))
        preferred_id = next(iter(atom["preferred"]), None)
        preferred = old.get(preferred_id) if preferred_id else None
        if preferred:
            proposals[atom["key"]] = preferred
            continue
        carrier = atom["preferred_carriers"].get(preferred_id) if preferred_id else None
        if preferred_id and carrier:
            proposals[atom["key"]] = {
                "id": preferred_id, "a": carrier["a"], "b": carrier["b"], "cm": 0,
            }
            continue
        if atom["key"] in old_by_key:
            proposals[atom["key"]] = old_by_key[atom["key"]]
            continue
        overlaps = [segment for segment in old.values()
                    if _collinear_overlap(atom["a"], atom["b"], segment["a"], segment["b"]) > EPS]
        overlaps.sort(key=lambda segment: (
            -host_counts.get(str(segment["id"]), 0),
            -_length(segment["a"], segment["b"]), str(segment["id"]),
        ))
        if overlaps:
            proposals[atom["key"]] = overlaps[0]
        elif len(atom["positional"]) == 1:
            positional = old.get(next(iter(atom["positional"])))
            if positional:
                proposals[atom["key"]] = positional

    by_id: dict[str, list[dict[str, Any]]] = {}
    for atom in atoms:
        proposal = proposals.get(atom["key"])
        if proposal:
            by_id.setdefault(str(proposal["id"]), []).append(atom)
    for segment_id, candidates in by_id.items():
        old_segment = old.get(segment_id) or proposals.get(candidates[0]["key"])
        if old_segment is None:
            raise WallSegmentMigrationError("duplicate-id", segment_id)
        midpoint = [
            (old_segment["a"][0] + old_segment["b"][0]) / 2,
            (old_segment["a"][1] + old_segment["b"][1]) / 2,
        ]
        candidates.sort(key=lambda atom: (
            0 if _distance_to_segment(midpoint, atom["a"], atom["b"]) <= EPS else 1,
            0 if _distance_to_segment(old_segment["a"], atom["a"], atom["b"]) <= EPS else 1,
            atom["key"],
        ))
        candidates[0]["id"] = segment_id

    used = _non_catalog_ids(space)
    for atom in atoms:
        if not atom.get("id"):
            continue
        if atom["id"] in used:
            raise WallSegmentMigrationError("duplicate-id", atom["id"])
        used.add(atom["id"])
    unassigned = [atom for atom in atoms if not atom.get("id")]
    if initial_migration:
        seeds: list[tuple[str, str, str, dict[str, Any]]] = []
        for atom in unassigned:
            ca, cb = _canonical_span(atom["a"], atom["b"])
            seed = (f"{space.get('id', '')}|{_point_key(ca)}|{_point_key(cb)}|"
                    f"{','.join(sorted(atom['owners']))}")
            digest = base64.b32encode(hashlib.sha256(seed.encode()).digest()).decode().lower()
            seeds.append((digest, atom["key"], seed, atom))
        full_digests: dict[str, str] = {}
        for digest, _key, seed, atom in sorted(seeds):
            if digest in full_digests and full_digests[digest] != seed:
                raise WallSegmentMigrationError("duplicate-id", digest)
            full_digests[digest] = seed
            base = f"wall-{digest[:20]}"
            suffix, segment_id = 1, base
            while segment_id in used:
                suffix += 1
                segment_id = f"{base}-{suffix}"
            atom["id"] = segment_id
            used.add(segment_id)
    else:
        for atom in unassigned:
            atom["id"] = _fresh_wall_segment_id(used)
            used.add(atom["id"])


def _angle_matches(a: list[float], b: list[float], angle: float) -> bool:
    dx, dy = _wall_direction(a, b)
    wall_angle = math.degrees(math.atan2(dy, dx))
    difference = abs((wall_angle - angle + 90) % 180 - 90)
    return difference <= 8


def _host_openings(
    space: dict[str, Any], segments: list[dict[str, Any]], initial_migration: bool,
) -> None:
    for opening in space.get("openings") or []:
        host = opening.get("host")
        if isinstance(host, dict) and host.get("kind") == "partition":
            continue
        try:
            centre = [float(opening["x"]), float(opening["y"])]
            angle, half = float(opening["angle"]), float(opening["length"]) / 2
        except (KeyError, TypeError, ValueError):
            if initial_migration:
                # #316 §3.4: the initial migration never throws over an opening.
                opening.pop("host", None)
                continue
            raise WallSegmentMigrationError("opening-host", str(opening.get("id", ""))) from None

        # #42 B023: loop variables are bound as defaults (see covered_by).
        def eligible(
            segment: dict[str, Any], *,
            centre: list[float] = centre, angle: float = angle, half: float = half,
        ) -> bool:
            if float(segment.get("cm", 0)) <= 0:
                return False
            t = _project_t(centre, segment["a"], segment["b"])
            span = _length(segment["a"], segment["b"])
            return (-EPS <= t <= 1 + EPS
                    and _distance_to_segment(centre, segment["a"], segment["b"])
                    <= GRID_STEP_N * 0.02
                    and _angle_matches(segment["a"], segment["b"], angle)
                    and half >= 0 and t * span - half >= -EPS
                    and t * span + half <= span + EPS)

        def materialize(
            carrier: dict[str, Any], *,
            opening: dict[str, Any] = opening, centre: list[float] = centre,
        ) -> None:
            opening["host"] = {
                "kind": "wall", "id": carrier["id"],
                "t": max(0.0, min(1.0, _project_t(centre, carrier["a"], carrier["b"]))),
            }

        current = None
        if isinstance(host, dict) and host.get("kind") == "wall":
            current = next((segment for segment in segments if segment["id"] == host.get("id")), None)
        candidates = [current] if current is not None and eligible(current) else [
            segment for segment in segments if eligible(segment)
        ]
        if len(candidates) == 1:
            materialize(candidates[0])
            continue
        # #316 §3.3: an unhosted opening is a valid degraded v9 state. A later
        # write keeps it, may self-heal it, and never fails over it.
        if host is None and not initial_migration:
            continue
        if not initial_migration:
            raise WallSegmentMigrationError("opening-host", str(opening.get("id", "")))

        def pick(
            pool: list[dict[str, Any]], *,
            current: dict[str, Any] | None = current, centre: list[float] = centre,
        ) -> dict[str, Any] | None:
            if not pool:
                return None
            if current is not None and any(item is current for item in pool):
                return current
            return sorted(pool, key=lambda candidate: (
                _distance_to_segment(centre, candidate["a"], candidate["b"]),
                -float(candidate.get("cm", 0)),
                str(candidate.get("id", "")),
            ))[0]

        # #316 §3.2 tie-break. No distant fallback pool (CODE-REVIEW-316-r1
        # H1): a host away from the opening's own x/y would violate the
        # geometry-match invariant of CONFIG_SCHEMA and wedge the write on the
        # schema layer; without an in-place carrier the opening goes straight
        # to the unhosted degraded state.
        carrier = pick([segment for segment in segments if eligible(segment)])
        if carrier is not None:
            materialize(carrier)
        else:
            opening.pop("host", None)


def _migrate_room_drafts_to_partitions(
    space: dict[str, Any], initial_migration: bool,
) -> tuple[int, int]:
    if "room_drafts" not in space:
        return 0, 0
    if not initial_migration:
        raise WallSegmentMigrationError("duplicate-id", "model v10 must not contain room_drafts")
    drafts = space.get("room_drafts") or []
    used = {
        str(item["id"])
        for name in ("rooms", "openings", "decor", "partitions",
                     "wall_columns", "wall_segments")
        for item in space.get(name) or []
        if isinstance(item, dict) and isinstance(item.get("id"), str) and item["id"]
    }
    used.update(
        str(draft["id"]) for draft in drafts
        if isinstance(draft, dict) and isinstance(draft.get("id"), str) and draft["id"]
    )
    partitions = copy.deepcopy(space.get("partitions") or [])
    converted = 0
    for draft in drafts:
        points = draft.get("points") if isinstance(draft.get("points"), list) else []
        segments = draft.get("segments") if isinstance(draft.get("segments"), list) else []
        if len(points) < 2 or len(segments) != len(points) - 1:
            raise WallSegmentMigrationError("zero-length", str(draft.get("id", "")))
        for index, segment in enumerate(segments):
            try:
                a = [float(points[index][0]), float(points[index][1])]
                b = [float(points[index + 1][0]), float(points[index + 1][1])]
                cm = float(segment["cm"])
            except (KeyError, IndexError, TypeError, ValueError):
                raise WallSegmentMigrationError("zero-length", str(draft.get("id", ""))) from None
            if a == b:
                raise WallSegmentMigrationError("zero-length", str(draft.get("id", "")))
            if not math.isfinite(cm) or cm < 0 or cm > 100:
                raise WallSegmentMigrationError("thickness-conflict", str(draft.get("id", "")))
            segment_id = segment.get("id") if isinstance(segment.get("id"), str) else ""
            if segment_id:
                if segment_id in used:
                    raise WallSegmentMigrationError("duplicate-id", segment_id)
            else:
                base = deterministic_wall_segment_id(
                    str(space.get("id", "")), a, b,
                    [f"draft:{draft.get('id', '')}:{index}"],
                )
                segment_id = base
                suffix = 2
                while segment_id in used:
                    segment_id = f"{base}-{suffix}"
                    suffix += 1
            used.add(segment_id)
            partitions.append({"id": segment_id, "a": a, "b": b, "cm": cm})
            converted += 1
    if partitions:
        space["partitions"] = partitions
    else:
        space.pop("partitions", None)
    space.pop("room_drafts", None)
    return len(drafts), converted


def _migrate_space(
    space: dict[str, Any], initial_migration: bool,
) -> tuple[int, int, int]:
    migrated_drafts, migrated_draft_segments = _migrate_room_drafts_to_partitions(
        space, initial_migration,
    )
    old: dict[str, dict[str, Any]] = {}
    for segment in space.get("wall_segments") or []:
        segment_id = str(segment.get("id", ""))
        if not segment_id or segment_id in old:
            raise WallSegmentMigrationError("duplicate-id", segment_id)
        old[segment_id] = segment
    atoms, rooms = _atomize(space, old)
    _assign_lineage(space, atoms, old, initial_migration)
    segments = []
    for atom in atoms:
        previous = old.get(atom["id"])
        segment = copy.deepcopy(previous) if previous else {}
        segment.update({
            "id": atom["id"], "a": list(atom["a"]), "b": list(atom["b"]),
            "cm": _thickness(space, atom, previous),
        })
        segments.append(segment)
    id_by_key = {atom["key"]: atom["id"] for atom in atoms}
    for room in rooms:
        room["wall_ids"] = [id_by_key[key] for key in room["wall_ids"]]
    space["rooms"] = rooms
    space["wall_segments"] = segments
    walls = [{
        "key": _wall_key(segment["a"], segment["b"]),
        "cm": segment["cm"], "a": list(segment["a"]), "b": list(segment["b"]),
    } for segment in segments if float(segment["cm"]) > 0]
    if walls:
        space["walls"] = walls
    else:
        space.pop("walls", None)
    space.pop("open_spans", None)
    for room in space.get("rooms") or []:
        room.pop("open_to", None)
    _host_openings(space, segments, initial_migration)
    return (
        sum(1 for segment in segments if segment["id"] not in old),
        migrated_drafts,
        migrated_draft_segments,
    )


def commit_wall_segment_model(
    config: Any, *, migration_report: dict[str, int] | None = None,
) -> tuple[Any, int]:
    """Return one migrated deep copy and the count of newly assigned wall ids."""
    candidate = canonicalize_config_geometry(copy.deepcopy(config))
    if not isinstance(candidate, dict):
        raise WallSegmentMigrationError("invalid-room")
    migrated = 0
    migrated_drafts = 0
    migrated_draft_segments = 0
    initial_migration = int(candidate.get("model_version", 0) or 0) < WALL_SEGMENT_MODEL_VERSION
    for space in candidate.get("spaces") or []:
        wall_segments, drafts, draft_segments = _migrate_space(space, initial_migration)
        migrated += wall_segments
        migrated_drafts += drafts
        migrated_draft_segments += draft_segments
    candidate["model_version"] = WALL_SEGMENT_MODEL_VERSION
    if migration_report is not None:
        migration_report.clear()
        migration_report.update({
            "room_drafts": migrated_drafts,
            "room_draft_segments": migrated_draft_segments,
        })
    return canonicalize_config_geometry(candidate), migrated
