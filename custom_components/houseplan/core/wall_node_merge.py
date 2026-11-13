"""Server-owned contraction of one explicitly named pair; no client graph grants."""
from __future__ import annotations

import copy as copy
import math as math
from types import SimpleNamespace as SimpleNamespace

from .coordinate_canonicalization import canonicalize_number as canonicalize_number
from .opening_orientation import opening_axis_rotation as opening_axis_rotation
from .opening_orientation import (
    transport_opening_orientations as transport_opening_orientations,
)
from .plan_graph import edge_key as edge_key
from .plan_graph import project_graph_space as project_graph_space
from .plan_graph import validate_graph as validate_graph
from .plan_graph_exact import GraphError as GraphError
from .plan_graph_exact import cross as cross
from .plan_graph_exact import decode_point as decode_point
from .plan_graph_exact import decode_rational as decode_rational
from .plan_graph_exact import encode_rational as encode_rational
from .plan_graph_exact import intersection as intersection
from .plan_graph_exact import parse_decimal as parse_decimal
from .plan_graph_exact import point_at as point_at
from .plan_graph_exact import project_parameter as project_parameter
from .plan_graph_exact import squared_distance as squared_distance
from .plan_graph_exact import to_numbers as to_numbers
from .wall_node_move import NodeMoveError as NodeMoveError
from .wall_node_move import _classify as _classify
from .wall_node_move import _dot as _dot
from .wall_node_move import _length as _length
from .wall_node_move import _point as _point
from .wall_node_move import _ref as _ref
from .wall_node_move import _same as _same
from .wall_node_move import _sub as _sub
from .wall_node_move import _walls as _walls


def _fail(reason="topology"):
    raise NodeMoveError(f"merge_{reason}")


def _on(p, a, b):
    return p == a if a == b else not cross(a, b, p) and 0 <= project_parameter(p, a, b) <= 1


def _contacts(a, b, c, d):
    hit = intersection(a, b, c, d)
    if hit and 0 <= hit[1] <= 1 and 0 <= hit[2] <= 1:
        return [hit[0]]
    return [p for p in (a, b, c, d) if _on(p, a, b) and _on(p, c, d)]


def _index(graph):
    nodes = {n["id"]: n for n in graph["nodes"]}
    points = {key: decode_point(n["p"]) for key, n in nodes.items()}
    edges = {edge_key(e): e for e in graph["edges"]}
    incident = {key: [] for key in nodes}
    for key, edge in edges.items():
        incident[edge["from"]].append(key)
        incident[edge["to"]].append(key)
    return SimpleNamespace(nodes=nodes, points=points, edges=edges, incident=incident)


def _verify_contacts(before, graph, source, target):
    old, new = _index(before), _index(graph)
    source_edges, target_edges = set(old.incident[source]), set(old.incident[target])
    seen = set()
    for a in graph["edges"]:
        if edge_key(a) not in source_edges:
            continue
        for b in graph["edges"]:
            pair = tuple(sorted((edge_key(a), edge_key(b))))
            if a is b or pair in seen:
                continue
            seen.add(pair)
            pa, pb, pc, pd = (new.points[e[side]] for e, side in ((a, "from"), (a, "to"), (b, "from"), (b, "to")))
            if {a["from"], a["to"]} == {b["from"], b["to"]}:
                _fail()
            hits = _contacts(pa, pb, pc, pd)
            if not hits:
                continue
            if not cross(pa, pb, pc) and not cross(pa, pb, pd) and any(p != q for p in hits for q in hits):
                _fail()
            oa, ob = old.edges[edge_key(a)], old.edges[edge_key(b)]
            previous = _contacts(old.points[oa["from"]], old.points[oa["to"]], old.points[ob["from"]], old.points[ob["to"]])
            for point in hits:
                named = (point == new.points[target] and target in (a["from"], a["to"])
                         and target in (b["from"], b["to"]) and edge_key(b) in source_edges | target_edges)
                if not named and point not in previous:
                    _fail()


def merge_graph_node_space(space, intent):
    """Reproduce the entire contraction from the locked stored graph and IDs."""
    from .graph_node_write import _has_node_carrier, delete_graph_node_space

    if not isinstance(intent, dict) or set(intent) - {"point", "target", "axis", "split_ids", "node_id", "target_p", "merge_node_id"}:
        _fail("target")
    before = space["plan_graph"]
    old = validate_graph(before)
    source, target = intent.get("node_id"), intent.get("merge_node_id")
    if not isinstance(source, str) or not isinstance(target, str) or source == target \
            or source not in old.nodes or target not in old.nodes or not old.incident[source] or not old.incident[target]:
        _fail("target")
    p, wanted = to_numbers(old.points[source]), to_numbers(old.points[target])
    try:
        if _point(intent.get("point")) != p or _point(intent.get("target")) != wanted \
                or decode_point(intent.get("target_p")) != old.points[target]:
            _fail("target")
        incident, axes, passing = _classify(_walls(space), p)
    except (GraphError, NodeMoveError, TypeError, ValueError):
        _fail("target")
    if intent.get("axis") is not None and not isinstance(intent["axis"], str):
        _fail("target")
    carrier = next((a for a in axes if a["passing"] and a["key"] == intent.get("axis")), None) if passing else None
    if passing:
        if carrier is None:
            _fail("target")
        direction = carrier["direction"]
        # IDs select the support, exact arithmetic judges membership of its line.
        first = old.edges[(carrier["walls"][0]["kind"], carrier["walls"][0]["id"])]
        if cross(old.points[first["from"]], old.points[first["to"]], old.points[target]):
            _fail("target")
        positions = [_dot(_sub(end, p), direction) for w in carrier["walls"] for end in (w["a"], w["b"]) if not _same(end, p)]
        amount = _dot(_sub(wanted, p), direction)
        lo, hi = max(v for v in positions if v < -1e-9), min(v for v in positions if v > 1e-9)
        if amount < lo - 1e-9 or amount > hi + 1e-9:
            _fail("target")
        for node, point in old.points.items():
            if node in (source, target) or not old.incident[node] or cross(old.points[source], old.points[target], point):
                continue
            t = project_parameter(point, old.points[source], old.points[target])
            if 0 < t < 1:
                _fail("target")
    removed = {edge_key(e) for e in before["edges"] if source in (e["from"], e["to"]) and target in (e["from"], e["to"])}
    base, graph = copy.deepcopy(space), copy.deepcopy(before)
    for opening in base.get("openings", []):
        host = opening.get("host")
        if host and edge_key(host) in removed:
            _fail("opening")
        if carrier and host:
            wall = next((w for w in carrier["walls"] if _ref(w) == f'{host["kind"]}:{host["id"]}'), None)
            if wall:
                center = _dot(_sub([opening["x"], opening["y"]], p), carrier["direction"])
                margin = opening["length"] / 2 + wall["cm"] / (space.get("cell_cm") or 5) / 480
                if center + margin >= min(0, amount) - 1e-9 and center - margin <= max(0, amount) + 1e-9:
                    _fail("opening")
    graph["nodes"] = [n for n in graph["nodes"] if n["id"] != source]
    graph["edges"] = [{**e, "from": target if e["from"] == source else e["from"], "to": target if e["to"] == source else e["to"]}
                      for e in graph["edges"] if edge_key(e) not in removed]
    for room in graph["rooms"]:
        room["edges"] = [e for e in room["edges"] if edge_key(e) not in removed]
    _verify_contacts(before, graph, source, target)
    new = _index(graph)
    dependencies = []
    for d in before["dependencies"]:
        if d["node"] == source:
            continue
        affected = any(source in (r["from"], r["to"]) or _has_node_carrier(old, source, r, source) for r in d["refs"])
        if not affected:
            dependencies.append(copy.deepcopy(d))
            continue
        rewritten = [{"from": target if r["from"] == source else r["from"], "to": target if r["to"] == source else r["to"]} for r in d["refs"]]
        refs = [r for r in rewritten if r["from"] != r["to"] and d["node"] not in (r["from"], r["to"])
                and _has_node_carrier(new, target, r, d["node"])]
        if not refs or d["node"] != target and len(refs) != len(rewritten):
            continue
        dependencies.append({**copy.deepcopy(d), "kind": "on-edge" if len(refs) == 1 else d["kind"], "refs": refs, "parameters": [encode_rational(project_parameter(
            new.points[d["node"]], new.points[r["from"]], new.points[r["to"]])) for r in refs]})
    graph["dependencies"] = dependencies
    opening_rotations = {}
    for opening in base.get("openings", []):
        host = opening.get("host")
        edge = old.edges.get(edge_key(host)) if host else None
        if not edge or source not in (edge["from"], edge["to"]) or edge_key(edge) in removed:
            continue
        a, b = old.points[edge["from"]], old.points[edge["to"]]
        na = old.points[target] if edge["from"] == source else a
        nb = old.points[target] if edge["to"] == source else b
        if na == nb:
            _fail()
        t = decode_rational(host["tq"]) if host.get("tq") else parse_decimal(host["t"])
        center = point_at(a, b, t)
        nt = project_parameter(center, na, nb)
        span = _length(to_numbers(na), to_numbers(nb))
        if point_at(na, nb, nt) != center:
            old_length = _length(to_numbers(a), to_numbers(b))
            value = 1 - (1 - float(t)) * old_length / span if edge["from"] == source else float(t) * old_length / span
            nt = parse_decimal(value)
        along, jamb = float(nt) * span, edge["cm"] / (space.get("cell_cm") or 5) / 480
        if along - opening["length"] / 2 < jamb - 1e-9 or along + opening["length"] / 2 > span - jamb + 1e-9:
            _fail("opening")
        opening["host"] = {**host, "tq": encode_rational(nt), "t": float(nt)}
        start, end = to_numbers(na), to_numbers(nb)
        opening_rotations[opening["id"]] = opening_axis_rotation(to_numbers(a), to_numbers(b), start, end)
        angle = math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / math.pi
        if angle >= 90:
            angle -= 180
        elif angle < -90:
            angle += 180
        opening["angle"] = canonicalize_number(angle)
    try:
        index = validate_graph(graph)
        result = project_graph_space(base, graph)["space"]
    except GraphError as error:
        _fail("dependency" if "dependenc" in str(error) else "topology")
    incident = index.incident.get(target, [])
    if not incident and not any(d["node"] == target or any(target in (r["from"], r["to"]) for r in d["refs"]) for d in graph["dependencies"]):
        graph["nodes"] = [n for n in graph["nodes"] if n["id"] != target]
        result = project_graph_space(result, graph)["space"]
    elif len(incident) == 2:
        a, b = (index.edges[key] for key in incident)
        point = index.points[target]
        left, right = (index.points[e["to"] if e["from"] == target else e["from"]] for e in (a, b))
        def owners(edge):
            return sorted(room for room, cycle in index.rooms.items()
                          if any(edge_key(step) == edge_key(edge) for step in cycle))
        protected = any(d["node"] != target and any(target in (r["from"], r["to"]) for r in d["refs"]) for d in graph["dependencies"])
        for opening in result.get("openings", []):
            host = opening.get("host")
            if not host or edge_key(host) not in incident:
                continue
            edge = index.edges[edge_key(host)]
            center = point_at(index.points[edge["from"]], index.points[edge["to"]], decode_rational(host["tq"]))
            half = parse_decimal(opening["length"]) / 2
            protected |= squared_distance(center, point) < half * half
        protected |= any(e is not a and e is not b and _on(point, index.points[e["from"]], index.points[e["to"]]) for e in graph["edges"])
        compact = (a["kind"] == b["kind"] and a["cm"] == b["cm"] and a.get("props") == b.get("props")
                   and owners(a) == owners(b) and left != right and not cross(left, point, right)
                   and 0 < project_parameter(point, left, right) < 1 and not protected)
        if compact:
            try:
                result = delete_graph_node_space(result, {"node_id": target, "point": wanted})
            except (GraphError, ValueError):
                _fail()
    return transport_opening_orientations(space, result, opening_rotations)
