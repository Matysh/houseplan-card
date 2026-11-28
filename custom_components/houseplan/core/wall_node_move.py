"""#803: server-owned local node-move proof, independent of browser claims.

No arbitrary candidate, allow-rehost flag or persisted node graph is accepted.
Undo proves the same forward operation from its proposed baseline to the exact
current space before allowing the inverse (including a transverse X split).
"""
from __future__ import annotations

import copy as copy
import math as math
from typing import Any as Any

from .coordinate_canonicalization import (
    canonicalize_config_geometry as canonicalize_config_geometry,
)
from .input_policy import charge_work
from .opening_orientation import opening_axis_rotation as opening_axis_rotation
from .opening_orientation import (
    transport_opening_orientations as transport_opening_orientations,
)
from .wall_segment_model import _wall_key as _wall_key
from .wall_segment_model import commit_wall_segment_model as commit_wall_segment_model

EPS = 1e-9
DIRECTION_EPS = math.sqrt(2 * EPS - EPS * EPS)
GRID = 1 / 240


class NodeMoveError(ValueError):
    """Stable fail-closed protocol error."""

    def __init__(self, reason: str = "invalid") -> None:
        self.code = f"node_move_{reason}"
        super().__init__(self.code)


def _sub(a, b):
    return [a[0] - b[0], a[1] - b[1]]


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def _cross(a, b):
    charge_work()
    return a[0] * b[1] - a[1] * b[0]


def _parallel(a, b):
    """Shared angular predicate, never the positional EPS."""
    return abs(_cross(a, b)) <= DIRECTION_EPS


def _length(a, b):
    charge_work()
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _same(a, b):
    return _length(a, b) <= EPS


def _unit(a):
    span = math.hypot(*a)
    return [a[0] / span, a[1] / span]


def _fraction(p, a, b):
    charge_work()
    d = _sub(b, a)
    return _dot(_sub(p, a), d) / _dot(d, d)


def _at(a, b, t):
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]


def _on(p, w):
    d = _sub(w["b"], w["a"])
    t = _fraction(p, w["a"], w["b"])
    return abs(_cross(_sub(p, w["a"]), d)) <= EPS * math.hypot(*d) and -EPS <= t <= 1 + EPS


def _ref(w):
    return f'{w["kind"]}:{w["id"]}'


def _walls(space):
    return [dict(w, kind=kind) for collection, kind in [("wall_segments", "wall"), ("partitions", "partition")]
            for w in space.get(collection, []) if _length(w["a"], w["b"]) > EPS]


def _intersection(a, b):
    da, db = _sub(a["b"], a["a"]), _sub(b["b"], b["a"])
    den = _cross(da, db)
    if abs(den) <= EPS * math.hypot(*da) * math.hypot(*db):
        return None
    t, u = _cross(_sub(b["a"], a["a"]), db) / den, _cross(_sub(b["a"], a["a"]), da) / den
    return _at(a["a"], a["b"], t) if -EPS <= t <= 1 + EPS and -EPS <= u <= 1 + EPS else None


def _nodes(walls):
    points = [p for w in walls for p in [w["a"], w["b"]]]
    for i, a in enumerate(walls):
        for b in walls[i + 1:]:
            p = _intersection(a, b)
            if p is not None:
                points.append(p)
    unique = {}
    for p in points:
        unique[(round(p[0], 9), round(p[1], 9))] = p
    return list(unique.values())


def _classify(walls, p):
    incident = sorted((w for w in walls if _on(p, w)), key=_ref)
    axes = []
    for w in incident:
        d = _unit(_sub(w["b"], w["a"]))
        if d[0] < -EPS or (abs(d[0]) <= EPS and d[1] < 0):
            d = [-d[0], -d[1]]
        axis = next((a for a in axes if _parallel(a["direction"], d)), None)
        if axis is None:
            axis = {"direction": d, "walls": [], "rays": []}
            axes.append(axis)
        axis["walls"].append(w)
        for end in [w["a"], w["b"]]:
            if not _same(end, p):
                ray = _unit(_sub(end, p))
                if not any(_parallel(r, ray) and _dot(r, ray) > 0 for r in axis["rays"]):
                    axis["rays"].append(ray)
    for a in axes:
        a["walls"].sort(key=_ref)
        a["key"] = _ref(a["walls"][0])
        # An axis cannot borrow an opposite ray from a different axis.
        a["passing"] = any(_dot(r, a["direction"]) > 0 for r in a["rays"]) \
            and any(_dot(r, a["direction"]) < 0 for r in a["rays"])
    valence = sum(len(a["rays"]) for a in axes)
    passing = sum(a["passing"] for a in axes)
    branches = valence - 2 * passing
    if not (valence <= 6 and ((passing == 0 and branches >= 1)
                              or (passing == 1 and branches <= 1) or (passing == 2 and branches == 0))):
        raise NodeMoveError("unsupported_junction")
    return incident, axes, passing


def _point(value):
    if not isinstance(value, list) or len(value) != 2 \
            or any(isinstance(v, bool) or not isinstance(v, (int, float))
                   or not math.isfinite(v) or abs(v) > 5000 for v in value):
        raise NodeMoveError()
    return value


def move_node_space(source: dict[str, Any], intent: dict[str, Any], *, graph_index=None) -> dict[str, Any]:
    """Apply only the proven incident edit. Foreign records are copied intact."""
    if set(intent) != {"point", "target", "axis", "split_ids"}:
        raise NodeMoveError()
    p, target = _point(intent["point"]), _point(intent["target"])
    if intent["axis"] is not None and not isinstance(intent["axis"], str):
        raise NodeMoveError()
    split_ids = intent["split_ids"]
    if not isinstance(split_ids, dict) or len(split_ids) > 2 \
            or any(not isinstance(k, str) or not isinstance(v, str) or not v or len(v) > 256
                   for k, v in split_ids.items()):
        raise NodeMoveError()
    walls = _walls(source)
    if graph_index is None:
        nodes = _nodes(walls)
    else:
        from .plan_graph_exact import to_numbers
        # A verified model11 has no unsplit proper crossings. Every legacy
        # endpoint/T/X is represented by an incident graph vertex. Keep this
        # same complete set for BOTH admission and the carrier sweep below.
        nodes = [to_numbers(point) for identity, point in graph_index.points.items()
                 if graph_index.incident[identity]]
    if not any(_same(p, n) for n in nodes):
        raise NodeMoveError()
    incident, axes, passing = _classify(walls, p)
    if _same(p, target):
        return copy.deepcopy(source)
    on_grid = all(abs(v / GRID - math.floor(v / GRID + 0.5)) <= 0.0001 for v in target)
    constrained = any(abs(_cross(_sub(target, p), a["direction"])) <= EPS for a in axes) \
        or any(not _same(end, p) and (abs(end[0] - target[0]) <= EPS or abs(end[1] - target[1]) <= EPS)
               for w in incident for end in [w["a"], w["b"]])
    if not on_grid and not constrained:
        raise NodeMoveError()
    carrier = next((a for a in axes if a["passing"] and a["key"] == intent["axis"]), None) if passing else None
    if passing and carrier is None:
        raise NodeMoveError()
    if carrier:
        d = carrier["direction"]
        if abs(_cross(_sub(target, p), d)) > EPS:
            raise NodeMoveError()
        positions = [_dot(_sub(end, p), d) for w in carrier["walls"] for end in [w["a"], w["b"]] if not _same(end, p)]
        wanted = _dot(_sub(target, p), d)
        lo, hi = max(v for v in positions if v < -EPS), min(v for v in positions if v > EPS)
        if not lo + EPS < wanted < hi - EPS:
            raise NodeMoveError()
        for other in nodes:
            if not _same(p, other) and abs(_cross(_sub(other, p), d)) <= EPS:
                t = _dot(_sub(other, p), d)
                if abs(t) > EPS and t * wanted > 0 and abs(t) <= abs(wanted) + EPS:
                    raise NodeMoveError()
    if carrier:
        swept_lo, swept_hi = min(0, wanted), max(0, wanted)
        for opening in source.get("openings", []):
            host = opening.get("host")
            wall = next((w for w in carrier["walls"] if host and _ref(w) == f'{host["kind"]}:{host["id"]}'), None)
            if wall is None:
                continue
            center = _dot(_sub(_at(wall["a"], wall["b"], host["t"]), p), d)
            margin = opening["length"] / 2 + wall["cm"] / (source.get("cell_cm") or 5) * GRID / 2
            if center + margin >= swept_lo - EPS and center - margin <= swept_hi + EPS:
                raise NodeMoveError("opening_blocked")
    out = copy.deepcopy(source)
    replacements = {}
    used = {item.get("id") for collection in ("rooms", "openings", "decor", "stairs", "wall_columns", "wall_segments", "partitions")
            for item in source.get(collection, [])}
    for old in incident:
        ref = _ref(old)
        stays = carrier and any(_ref(w) == ref for w in carrier["walls"])
        a_moves, b_moves = _same(old["a"], p), _same(old["b"], p)
        if not a_moves and not b_moves and stays:
            replacements[ref] = [old]
        elif a_moves or b_moves:
            replacements[ref] = [dict(old, a=target[:] if a_moves else old["a"], b=target[:] if b_moves else old["b"])]
        else:
            new_id = split_ids.get(ref)
            if new_id is None or new_id in used:
                raise NodeMoveError()
            used.add(new_id)
            first_keeps = _fraction(p, old["a"], old["b"]) >= 0.5 - EPS
            replacements[ref] = [dict(old, id=old["id"] if first_keeps else new_id, b=target[:]),
                                 dict(old, id=new_id if first_keeps else old["id"], a=target[:])]
    if any(_length(w["a"], w["b"]) <= EPS for children in replacements.values() for w in children):
        raise NodeMoveError()
    for collection, kind in [("wall_segments", "wall"), ("partitions", "partition")]:
        if collection in out:
            out[collection] = [{**w, "id": child["id"], "a": child["a"][:], "b": child["b"][:]}
                               for w in out[collection] for child in replacements.get(f'{kind}:{w["id"]}', [w])]
    incident_by_ref = {_ref(w): w for w in incident}
    for room in out.get("rooms", []):
        if not room.get("poly") or len(room.get("wall_ids", [])) != len(room["poly"]):
            raise NodeMoveError()
        poly, ids = [], []
        for i, old_point in enumerate(room["poly"]):
            old_id = room["wall_ids"][i]
            ref = f"wall:{old_id}"
            children = replacements.get(ref)
            if children is None:
                poly.append(old_point)
                ids.append(old_id)
                continue
            forward = _same(old_point, incident_by_ref[ref]["a"])
            for child in children if forward else reversed(children):
                poly.append(child["a"][:] if forward else child["b"][:])
                ids.append(child["id"])
        room["poly"], room["wall_ids"] = poly, ids
    old_by_ref = {_ref(w): w for w in walls}
    after = _walls(out)
    changed_ids = {_ref(w) for children in replacements.values() for w in children}
    parent_refs = {_ref(w): parent for parent, children in replacements.items() for w in children}
    checked = set()
    for a in after:
        if _ref(a) not in changed_ids:
            continue
        for b in after:
            pair = tuple(sorted([_ref(a), _ref(b)]))
            if a is b or pair in checked:
                continue
            checked.add(pair)
            old_a = old_by_ref.get(parent_refs.get(_ref(a), _ref(a)))
            old_b = old_by_ref.get(parent_refs.get(_ref(b), _ref(b)))
            hit = _intersection(a, b)
            if hit is not None and _same(hit, target) and (
                    parent_refs.get(_ref(a), _ref(a)) not in incident_by_ref
                    or parent_refs.get(_ref(b), _ref(b)) not in incident_by_ref):
                raise NodeMoveError()
            if hit is not None and not _same(hit, target):
                # Preserve a parent's fixed junction when its child is new,
                # including a formerly collinear finite common endpoint.
                previous = None
                if old_a and old_b:
                    previous = _intersection(old_a, old_b) or next(
                        (end for end in [old_a["a"], old_a["b"]]
                         if _same(end, hit) and _on(end, old_b)), None)
                if previous is None or not _same(hit, previous):
                    raise NodeMoveError()
            if hit is None and abs(_cross(_sub(a["b"], a["a"]), _sub(b["b"], b["a"]))) <= EPS:
                if any(_same(end, target) and _on(end, b) for end in [a["a"], a["b"]]) and (
                        parent_refs.get(_ref(a), _ref(a)) not in incident_by_ref
                        or parent_refs.get(_ref(b), _ref(b)) not in incident_by_ref):
                    raise NodeMoveError()
                for end in [a["a"], a["b"]]:
                    if _on(end, b) and not _same(end, target) and (not old_a or not old_b
                            or not any(_same(q, end) and _on(q, old_b) for q in [old_a["a"], old_a["b"]])):
                        raise NodeMoveError()
    opening_rotations = {}
    for opening in out.get("openings", []):
        host = opening.get("host")
        if not host:
            if any(_on([opening["x"], opening["y"]], w) for w in incident):
                raise NodeMoveError("opening_blocked")
            continue
        ref = f'{host["kind"]}:{host["id"]}'
        children = replacements.get(ref)
        if children is None:
            continue
        old = incident_by_ref[ref]
        if len(children) == 1 and _same(children[0]["a"], old["a"]) and _same(children[0]["b"], old["b"]):
            continue
        old_span, half, t = _length(old["a"], old["b"]), opening["length"] / 2, host["t"]
        along, split_along = t * old_span, _fraction(p, old["a"], old["b"]) * old_span
        child = children[0]
        if len(children) == 2:
            if along - half < split_along + EPS and along + half > split_along - EPS:
                raise NodeMoveError("opening_blocked")
            first = along + half <= split_along
            child = children[0 if first else 1]
            span = _length(child["a"], child["b"])
            t = along / span if first else 1 - (old_span - along) / span
        elif carrier and any(_ref(w) == ref for w in carrier["walls"]):
            t = _fraction([opening["x"], opening["y"]], child["a"], child["b"])
        else:
            span = _length(child["a"], child["b"])
            if span <= EPS:
                raise NodeMoveError()
            t = 1 - (1 - host["t"]) * old_span / span if _same(old["a"], p) else host["t"] * old_span / span
        span = _length(child["a"], child["b"])
        jamb = child["cm"] / (source.get("cell_cm") or 5) * GRID / 2
        if span <= EPS or t * span - half < jamb - EPS or t * span + half > span - jamb + EPS:
            raise NodeMoveError("opening_blocked")
        opening["x"], opening["y"] = _at(child["a"], child["b"], t)
        opening["host"] = {**host, "id": child["id"], "t": t}
        opening_rotations[opening["id"]] = opening_axis_rotation(old["a"], old["b"], child["a"], child["b"])
        angle = math.degrees(math.atan2(child["b"][1] - child["a"][1], child["b"][0] - child["a"][0]))
        opening["angle"] = angle - 180 if angle >= 90 else angle + 180 if angle < -90 else angle
    if "walls" in source:
        out["walls"] = [{"key": _wall_key(w["a"], w["b"]), "cm": w["cm"], "a": w["a"][:], "b": w["b"][:]}
                        for w in out.get("wall_segments", []) if w["cm"] > 0]
    return transport_opening_orientations(source, out, opening_rotations)


def _node_current_basis(current, space_id, trusted_current):
    """Only an exact-revision schema stamp permits local current normalization.

    This is an internal writer input, never a WS flag. Cold/legacy documents
    retain full normalization. Every proposed/undo target is still independently
    normalized and the envelope/schema proof remains at the writer boundary.
    """
    if trusted_current and current.get("model_version") == 11:
        baseline = copy.deepcopy(current)
        for i, space in enumerate(baseline.get("spaces", [])):
            if space.get("id") == space_id:
                baseline["spaces"][i] = commit_wall_segment_model({"model_version": 11, "spaces": [space]})[0]["spaces"][0]
        return baseline, True
    return commit_wall_segment_model(current)[0], False


def _node_replace_space(baseline, space_id, space, local):
    out = copy.deepcopy(baseline)
    for i, previous in enumerate(out.get("spaces", [])):
        if previous.get("id") == space_id:
            out["spaces"][i] = commit_wall_segment_model({"model_version": 11, "spaces": [space]})[0]["spaces"][0] if local else copy.deepcopy(space)
    return out if local else commit_wall_segment_model(out)[0]


def node_move_host_baseline(current: dict[str, Any], candidate: dict[str, Any], space_id: str,
                            intent: dict[str, Any], direction: str = "apply",
                            before_space: dict[str, Any] | None = None, *, trusted_current: bool = False) -> dict[str, Any]:
    """Independent identity ledger; candidate host IDs never authorize themselves.

    Only an opening wholly on a transverse whole-X child may change its host ID.
    Derive that child from ORIGINAL interval/midpoint lineage and frozen carrier,
    not from move_node_space's replacements or returned opening. For Undo the
    first proof establishes before_space; this ledger checks the inverse IDs.
    Returning an identity-adjusted baseline leaves strict jamb validation intact.
    """
    # The durable legacy record may not yet contain a structural catalogue.
    # Normalize a COPY with the same read-compatible identity model as the first
    # proof; raw legacy absence is not evidence of a missing node or new host.
    current, _ = _node_current_basis(current, space_id, trusted_current)
    if "attach_edge" in intent:
        return _attach_host_baseline(current, candidate, space_id, intent, direction, before_space)
    if "merge_node_id" in intent:
        return _merge_host_baseline(current, candidate, space_id, intent, direction, before_space)
    if "node_id" in intent or "target_p" in intent:
        intent = {key: value for key, value in intent.items() if key in {"point", "target", "axis", "split_ids"}}
    old_spaces = {s["id"]: s for s in current.get("spaces", [])}
    new_spaces = {s["id"]: s for s in candidate.get("spaces", [])}
    if old_spaces.keys() != new_spaces.keys() or direction not in {"apply", "undo"}:
        raise NodeMoveError()
    source = before_space if direction == "undo" else old_spaces.get(space_id)
    if source is None or source.get("id") != space_id:
        raise NodeMoveError()
    p = intent["point"]
    incident, axes, _ = _classify(_walls(source), p)
    carrier = next((a for a in axes if a["passing"] and a["key"] == intent["axis"]), None)
    carrier_refs = {_ref(w) for w in carrier["walls"]} if carrier else set()
    transverse = {_ref(w): w for w in incident if _ref(w) not in carrier_refs
                  and not _same(w["a"], p) and not _same(w["b"], p)}
    baseline = copy.deepcopy(current)

    def identity(opening):
        host = opening.get("host")
        return (host["kind"], host["id"]) if host else None

    for old_space, adjusted in zip(current.get("spaces", []), baseline.get("spaces", []), strict=True):
        sid = old_space["id"]
        original = source if sid == space_id else old_space
        old = {o["id"]: o for o in old_space.get("openings", [])}
        new = {o["id"]: o for o in new_spaces[sid].get("openings", [])}
        originals = {o["id"]: o for o in original.get("openings", [])}
        if old.keys() != new.keys() or old.keys() != originals.keys():
            raise NodeMoveError()
        adjusted_openings = {o["id"]: o for o in adjusted.get("openings", [])}
        for oid, opening in originals.items():
            initial = identity(opening)
            forward = initial
            wall = transverse.get(f'{initial[0]}:{initial[1]}') if initial and sid == space_id else None
            if wall and not _same(p, intent["target"]):
                span = _length(wall["a"], wall["b"])
                split = _fraction(p, wall["a"], wall["b"])
                along, half = opening["host"]["t"] * span, opening["length"] / 2
                if along - half < split * span + EPS and along + half > split * span - EPS:
                    raise NodeMoveError("opening_blocked")
                first = along + half <= split * span
                keeps_parent = first == (split >= 0.5 - EPS)
                child_id = wall["id"] if keeps_parent else intent["split_ids"].get(_ref(wall))
                if not child_id:
                    raise NodeMoveError()
                forward = (initial[0], child_id)
            expected_old, expected_new = (forward, initial) if direction == "undo" else (initial, forward)
            if identity(old[oid]) != expected_old or identity(new[oid]) != expected_new:
                raise NodeMoveError()
            if expected_new:
                adjusted_openings[oid]["host"]["id"] = expected_new[1]
    return baseline


def _merge_host_baseline(current, candidate, space_id, intent, direction, before_space):
    from .wall_node_merge import merge_graph_node_space
    return _named_host_baseline(current, candidate, space_id, intent, direction, before_space, merge_graph_node_space)


def _attach_host_baseline(current, candidate, space_id, intent, direction, before_space):
    from .wall_node_attach import attach_graph_node_space
    return _named_host_baseline(current, candidate, space_id, intent, direction, before_space, attach_graph_node_space)


def _named_host_baseline(current, candidate, space_id, intent, direction, before_space, replay):
    """Independently replay a named edit and compare the COMPLETE candidate.

    Host IDs come only from the accepted source and proven child intervals.
    Both directions pass this proof, including unchanged foreign fields/floors.
    """

    from .wall_node_delete import _equal

    previous = next((s for s in current.get("spaces", []) if s["id"] == space_id), None)
    source = before_space if direction == "undo" else previous
    if source is None or source.get("id") != space_id or direction not in ("apply", "undo"):
        raise NodeMoveError("merge_target")
    forward = replay(source, intent)
    old, new = (forward, source) if direction == "undo" else (source, forward)
    if not _equal(old, previous):
        raise NodeMoveError("merge_topology")
    if not _equal({k: v for k, v in candidate.items() if k != "spaces"}, {k: v for k, v in current.items() if k != "spaces"}):
        raise NodeMoveError("merge_topology")
    baseline = copy.deepcopy(current)
    accepted_spaces = {s["id"]: s for s in candidate.get("spaces", [])}
    if set(accepted_spaces) != {s["id"] for s in current.get("spaces", [])}:
        raise NodeMoveError("merge_topology")
    for original, adjusted in zip(current.get("spaces", []), baseline.get("spaces", []), strict=True):
        expected = new if original["id"] == space_id else original
        if not _equal(accepted_spaces[original["id"]], expected):
            raise NodeMoveError("merge_topology")
        openings = {o["id"]: o for o in expected.get("openings", [])}
        if set(openings) != {o["id"] for o in adjusted.get("openings", [])}:
            raise NodeMoveError("merge_opening")
        for opening in adjusted.get("openings", []):
            host = openings[opening["id"]].get("host")
            if bool(host) != bool(opening.get("host")):
                raise NodeMoveError("merge_opening")
            if host:
                opening["host"]["kind"], opening["host"]["id"] = host["kind"], host["id"]
    return baseline


def node_move_candidate(current: dict[str, Any], space_id: str, intent: dict[str, Any],
                        direction: str = "apply", before_space: dict[str, Any] | None = None, *,
                        trusted_current: bool = False) -> dict[str, Any]:
    """Independently prove the forward delta; inverse has no broader authority."""
    baseline, local = _node_current_basis(current, space_id, trusted_current)
    space = next((s for s in baseline.get("spaces", []) if s["id"] == space_id), None)
    if space is None or direction not in {"apply", "undo"}:
        raise NodeMoveError()
    from .graph_node_write import move_graph_node_space
    apply_move = move_graph_node_space if space.get("plan_graph") is not None else move_node_space
    if direction == "undo":
        if before_space is None or before_space.get("id") != space_id:
            raise NodeMoveError()
        # Proof has to reach exactly the current canonical document, including
        # every foreign field. A forged baseline cannot move a distal endpoint,
        # rehost another opening, alter metadata or change another floor.
        forward = apply_move(before_space, intent)
        proof = _node_replace_space(baseline, space_id, forward, local)
        from .wall_node_delete import _equal
        if not _equal(canonicalize_config_geometry(proof), canonicalize_config_geometry(baseline)):
            raise NodeMoveError()
        return _node_replace_space(baseline, space_id, before_space, local)
    moved = apply_move(space, intent)
    return _node_replace_space(baseline, space_id, moved, local)
