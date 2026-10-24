"""#1045: server-owned two-section deletion and an exact, bounded inverse proof."""
from __future__ import annotations

import copy
import math
from typing import Any

from . import wall_node_move as graph
from .coordinate_canonicalization import canonicalize_config_geometry
from .wall_segment_model import _wall_key, commit_wall_segment_model

EPS = 1e-9


class NodeDeleteError(ValueError):
    """Stable operation-specific refusal, never a processing-success fallback."""

    def __init__(self, reason: str = "unsafe") -> None:
        self.code = f"node_delete_{reason}"
        super().__init__(self.code)


def _bounded(point):
    return isinstance(point, list) and len(point) == 2 and all(
        not isinstance(v, bool) and isinstance(v, (int, float)) and math.isfinite(v) and abs(v) <= 5000
        for v in point)


def _equal(a, b):
    """JSON semantic equality, including bool versus number and future fields."""
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a == b
    if type(a) is not type(b):
        return False
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(_equal(value, b[key]) for key, value in a.items())
    if isinstance(a, list):
        return len(a) == len(b) and all(_equal(x, y) for x, y in zip(a, b, strict=True))
    return a == b


def _contacts(a, b):
    hit = graph._intersection(a, b)
    return [hit] if hit is not None else [p for p in (a["a"], a["b"], b["a"], b["b"])
                                          if graph._on(p, a) and graph._on(p, b)]


def _overlap(a, b):
    direction = graph._sub(a["b"], a["a"])
    span = math.hypot(*direction)
    if any(abs(graph._cross(graph._sub(p, a["a"]), direction)) > EPS * span for p in (b["a"], b["b"])):
        return False
    lo, hi = sorted(graph._fraction(p, a["a"], a["b"]) for p in (b["a"], b["b"]))
    return (min(1, hi) - max(0, lo)) * span > EPS


def _area(poly):
    return sum(graph._cross(p, poly[(i + 1) % len(poly)]) for i, p in enumerate(poly)) / 2


def _edges(poly):
    return [{"a": p, "b": poly[(i + 1) % len(poly)]} for i, p in enumerate(poly)]


def _simple(poly):
    if not isinstance(poly, list) or len(poly) < 3 or not all(_bounded(p) for p in poly) or abs(_area(poly)) <= EPS * EPS:
        return False
    edges = _edges(poly)
    if any(graph._length(w["a"], w["b"]) <= EPS for w in edges):
        return False
    for i, a in enumerate(edges):
        for j in range(i + 1, len(edges)):
            adjacent = j == i + 1 or (i == 0 and j == len(edges) - 1)
            if _overlap(a, edges[j]) or (not adjacent and _contacts(a, edges[j])):
                return False
    return True


def _inside(p, poly):
    if any(graph._on(p, edge) for edge in _edges(poly)):
        return False
    result = False
    for edge in _edges(poly):
        a, b = edge["a"], edge["b"]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
            result = not result
    return result


def _rooms_overlap(a, b):
    # A new proper crossing is always forbidden. Full nesting remains legal.
    for x in _edges(a):
        for y in _edges(b):
            hit = graph._intersection(x, y)
            if hit is not None and all(not graph._same(hit, p) for p in (x["a"], x["b"], y["a"], y["b"])):
                return True
    def contains(outer, inner):
        return abs(_area(inner)) < abs(_area(outer)) - EPS and all(
            _inside(p, outer) or any(graph._on(p, edge) for edge in _edges(outer)) for p in inner)
    if contains(a, b) or contains(b, a):
        return False
    for own, other in ((a, b), (b, a)):
        if any(_inside(p, other) for p in own):
            return True
        for edge in _edges(own):
            midpoint = graph._at(edge["a"], edge["b"], .5)
            if _inside(midpoint, other):
                return True
            direction = graph._sub(edge["b"], edge["a"])
            span = math.hypot(*direction)
            offset = min(span * 1e-5, 1e-8) * (1 if _area(own) > 0 else -1)
            probe = [midpoint[0] - direction[1] / span * offset, midpoint[1] + direction[0] / span * offset]
            if _inside(probe, own) and _inside(probe, other):
                return True
    return False


def _deletion(source, intent):
    if not isinstance(intent, dict) or set(intent) != {"point"} or not _bounded(intent["point"]):
        raise NodeDeleteError()
    raw = source.get("wall_segments", []) + source.get("partitions", [])
    if any(not _bounded(w.get("a")) or not _bounded(w.get("b")) or graph._length(w["a"], w["b"]) <= EPS for w in raw):
        raise NodeDeleteError()
    walls = graph._walls(source)
    p = intent["point"]
    if not any(graph._same(p, n) for n in graph._nodes(walls)):
        raise NodeDeleteError("degree")
    try:
        incident, axes, _ = graph._classify(walls, p)
    except graph.NodeMoveError as error:
        raise NodeDeleteError("degree") from error
    if sum(len(axis["rays"]) for axis in axes) != 2 or len(incident) != 2 or any(
            not graph._same(w["a"], p) and not graph._same(w["b"], p) for w in incident):
        raise NodeDeleteError("degree")
    keep, drop = sorted(incident, key=lambda w: w["id"])
    if keep["kind"] != drop["kind"] or keep["id"] == drop["id"]:
        raise NodeDeleteError()
    collection = "wall_segments" if keep["kind"] == "wall" else "partitions"
    originals = [next(w for w in source.get(collection, []) if w["id"] == old["id"]) for old in (keep, drop)]
    attrs = [{k: v for k, v in w.items() if k not in {"id", "a", "b"}} for w in originals]
    if not _equal(*attrs):
        raise NodeDeleteError()
    outer = [w["b"] if graph._same(w["a"], p) else w["a"] for w in (keep, drop)]
    if graph._length(*outer) <= EPS or any(
            not any(graph._same(n, end) for end in (p, *outer)) and any(graph._on(n, w) for w in incident)
            for n in graph._nodes(walls)):
        raise NodeDeleteError()
    merged = {**copy.deepcopy(originals[0]), "a": copy.deepcopy(outer[1] if graph._same(keep["a"], p) else outer[0]),
              "b": copy.deepcopy(outer[1] if graph._same(keep["b"], p) else outer[0])}
    refs = {graph._ref(w) for w in incident}
    for wall in walls:
        if graph._ref(wall) in refs:
            continue
        if _overlap(merged, wall) or any(not any(graph._same(hit, end) and graph._on(end, wall)
                                                and any(graph._on(end, old) for old in incident) for end in outer)
                                       for hit in _contacts(merged, wall)):
            raise NodeDeleteError()
    return p, keep, drop, merged, incident, outer


def delete_node_space(source: dict[str, Any], intent: dict[str, Any]) -> dict[str, Any]:
    """No mutation, rounding, arbitrary cleanup, or opening-field rewrite."""
    p, keep, drop, merged, incident, outer = _deletion(source, intent)
    collection = "wall_segments" if keep["kind"] == "wall" else "partitions"
    out = copy.deepcopy(source)
    out[collection] = [merged if w["id"] == keep["id"] else w for w in out.get(collection, []) if w["id"] != drop["id"]]
    ids = {keep["id"], drop["id"]}
    owners = set()
    if keep["kind"] == "wall":
        for index, room in enumerate(out.get("rooms", [])):
            if not any(wid in ids for wid in room.get("wall_ids", [])):
                continue
            poly, wall_ids = room.get("poly"), room.get("wall_ids")
            if not _simple(poly) or not isinstance(wall_ids, list) or len(poly) != len(wall_ids):
                raise NodeDeleteError()
            matches = [i for i, point in enumerate(poly) if graph._same(point, p)]
            if len(matches) != 1:
                raise NodeDeleteError()
            i = matches[0]
            previous = (i - 1) % len(poly)
            if sum(wid in ids for wid in wall_ids) != 2 or wall_ids[previous] == wall_ids[i] \
                    or not {wall_ids[previous], wall_ids[i]}.issubset(ids) \
                    or not all(any(graph._same(end, poly[j]) for j in (previous, (i + 1) % len(poly))) for end in outer):
                raise NodeDeleteError()
            winding = _area(poly)
            wall_ids[previous] = keep["id"]
            del wall_ids[i], poly[i]
            if not _simple(poly) or winding * _area(poly) <= 0:
                raise NodeDeleteError()
            owners.add(index)
        if not owners:
            raise NodeDeleteError()
    for i, room in enumerate(out.get("rooms", [])):
        for j in range(i + 1, len(out["rooms"])):
            if i not in owners and j not in owners:
                continue
            a, b = room.get("poly"), out["rooms"][j].get("poly")
            old_a, old_b = source["rooms"][i].get("poly"), source["rooms"][j].get("poly")
            if not all((a, b, old_a, old_b)) or (_rooms_overlap(a, b) and not _rooms_overlap(old_a, old_b)):
                raise NodeDeleteError()
    for opening in out.get("openings", []):
        host = opening.get("host")
        if not host:
            if any(graph._on([opening["x"], opening["y"]], w) for w in incident):
                raise NodeDeleteError("opening")
            continue
        old = next((w for w in incident if graph._ref(w) == f'{host["kind"]}:{host["id"]}'), None)
        if old is None:
            continue
        center = [opening["x"], opening["y"]]
        if not _bounded(center) or not graph._on(p, merged) or not graph._on(center, merged) \
                or graph._length(center, graph._at(old["a"], old["b"], host["t"])) > EPS:
            raise NodeDeleteError("opening")
        t, span = graph._fraction(center, merged["a"], merged["b"]), graph._length(merged["a"], merged["b"])
        jamb = merged["cm"] / (source.get("cell_cm") or 5) * graph.GRID / 2
        angle = math.degrees(math.atan2(merged["b"][1] - merged["a"][1], merged["b"][0] - merged["a"][0]))
        if not math.isfinite(t) or not math.isfinite(opening["length"]) or opening["length"] <= 0 \
                or abs((opening["angle"] - angle + 90) % 180 - 90) > 1e-7 \
                or t * span - opening["length"] / 2 < jamb - EPS or t * span + opening["length"] / 2 > span - jamb + EPS:
            raise NodeDeleteError("opening")
        opening["host"] = {**host, "id": keep["id"], "t": t}
    hosted = [o for o in out.get("openings", []) if o.get("host", {}).get("kind") == keep["kind"]
              and o["host"]["id"] == keep["id"]]
    for i, a in enumerate(hosted):
        for b in hosted[i + 1:]:
            if graph._length([a["x"], a["y"]], [b["x"], b["y"]]) < (a["length"] + b["length"]) / 2 - EPS:
                raise NodeDeleteError("opening")
    if "walls" in source:
        out["walls"] = [{"key": _wall_key(w["a"], w["b"]), "cm": w["cm"], "a": w["a"][:], "b": w["b"][:]}
                        for w in out.get("wall_segments", []) if w["cm"] > 0]
    return out


def node_delete_candidate(current: dict[str, Any], space_id: str, intent: dict[str, Any],
                          direction: str = "apply", before_space: dict[str, Any] | None = None) -> dict[str, Any]:
    baseline, _ = commit_wall_segment_model(current)
    source = next((s for s in baseline.get("spaces", []) if s["id"] == space_id), None)
    if source is None or direction not in {"apply", "undo"}:
        raise NodeDeleteError()
    if direction == "undo":
        if before_space is None or before_space.get("id") != space_id:
            raise NodeDeleteError()
        proof = copy.deepcopy(baseline)
        forward = delete_node_space(before_space, intent)
        proof["spaces"] = [forward if s["id"] == space_id else s for s in proof["spaces"]]
        proof, _ = commit_wall_segment_model(proof)
        if not _equal(canonicalize_config_geometry(proof), canonicalize_config_geometry(baseline)):
            raise NodeDeleteError()
        baseline["spaces"] = [copy.deepcopy(before_space) if s["id"] == space_id else s for s in baseline["spaces"]]
    else:
        baseline["spaces"] = [delete_node_space(source, intent) if s["id"] == space_id else s for s in baseline["spaces"]]
    candidate, _ = commit_wall_segment_model(baseline)
    return candidate


def node_delete_host_baseline(current: dict[str, Any], candidate: dict[str, Any], space_id: str,
                              intent: dict[str, Any], direction: str = "apply",
                              before_space: dict[str, Any] | None = None) -> dict[str, Any]:
    """Derive allowed IDs from original carriers, never candidate-supplied IDs."""
    current, _ = commit_wall_segment_model(current)
    old_spaces = {s["id"]: s for s in current.get("spaces", [])}
    new_spaces = {s["id"]: s for s in candidate.get("spaces", [])}
    source = before_space if direction == "undo" else old_spaces.get(space_id)
    if source is None or source.get("id") != space_id or old_spaces.keys() != new_spaces.keys() or direction not in {"apply", "undo"}:
        raise NodeDeleteError()
    _, keep, drop, _, _, _ = _deletion(source, intent)
    baseline = copy.deepcopy(current)
    def identity(opening):
        host = opening.get("host")
        return (host["kind"], host["id"]) if host else None
    for adjusted in baseline.get("spaces", []):
        sid = adjusted["id"]
        old = {o["id"]: o for o in old_spaces[sid].get("openings", [])}
        new = {o["id"]: o for o in new_spaces[sid].get("openings", [])}
        originals = {o["id"]: o for o in (source if sid == space_id else old_spaces[sid]).get("openings", [])}
        if old.keys() != new.keys() or old.keys() != originals.keys():
            raise NodeDeleteError()
        for opening in adjusted.get("openings", []):
            oid = opening["id"]
            initial = identity(originals[oid])
            forward = (keep["kind"], keep["id"]) if sid == space_id and initial in {
                (keep["kind"], keep["id"]), (drop["kind"], drop["id"])} else initial
            expected_old, expected_new = (forward, initial) if direction == "undo" else (initial, forward)
            if identity(old[oid]) != expected_old or identity(new[oid]) != expected_new:
                raise NodeDeleteError("opening")
            if expected_new:
                opening["host"]["id"] = expected_new[1]
    return baseline
