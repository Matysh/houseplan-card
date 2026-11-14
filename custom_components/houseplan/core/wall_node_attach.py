"""Named dangling-end attach, independently replayed from the locked stored graph."""
from __future__ import annotations

import copy as copy
import math as math
import re as re

from .coordinate_canonicalization import canonicalize_number as canonicalize_number
from .opening_orientation import opening_axis_rotation as opening_axis_rotation
from .opening_orientation import (
    transport_opening_orientations as transport_opening_orientations,
)
from .plan_graph import edge_key as edge_key
from .plan_graph import project_graph_space as project_graph_space
from .plan_graph import propagate_dependencies as propagate_dependencies
from .plan_graph import validate_graph as validate_graph
from .plan_graph_exact import GraphError as GraphError
from .plan_graph_exact import cross as cross
from .plan_graph_exact import decode_point as decode_point
from .plan_graph_exact import decode_rational as decode_rational
from .plan_graph_exact import encode_point as encode_point
from .plan_graph_exact import encode_rational as encode_rational
from .plan_graph_exact import parse_decimal as parse_decimal
from .plan_graph_exact import point_at as point_at
from .plan_graph_exact import project_parameter as project_parameter
from .plan_graph_exact import to_numbers as to_numbers
from .wall_node_merge import _contacts as _contacts
from .wall_node_merge import _on as _on
from .wall_node_move import NodeMoveError as NodeMoveError
from .wall_node_move import _length as _length
from .wall_node_move import _point as _point

_ID = re.compile(r"node-attach-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")
EPS = 1e-9


def _fail(reason="topology"):
    # Same human safety explanations as the existing explicit junction command.
    raise NodeMoveError("merge_" + reason)


def attach_graph_node_space(space, intent):
    """Only source + one named receiving edge may change topology; no candidate grant."""
    from .graph_node_write import _has_node_carrier

    if not isinstance(intent, dict) or set(intent) != {"point", "target", "axis", "split_ids", "node_id", "target_p", "attach_edge"}:
        _fail("target")
    attach = intent["attach_edge"]
    if not isinstance(attach, dict) or set(attach) != {"kind", "id", "tq", "new_edge_id"} \
            or attach["kind"] not in ("wall", "partition") or not isinstance(attach["id"], str) \
            or not isinstance(attach["new_edge_id"], str) or not _ID.fullmatch(attach["new_edge_id"]):
        _fail("target")
    before = space["plan_graph"]
    old = validate_graph(before)
    source = intent["node_id"]
    if not isinstance(source, str) or source not in old.nodes or len(old.incident[source]) != 1 \
            or intent["axis"] is not None or intent["split_ids"] != {}:
        _fail("target")
    arm = old.edges[old.incident[source][0]]
    far = arm["to"] if arm["from"] == source else arm["from"]
    host = old.edges.get((attach["kind"], attach["id"]))
    if not host or source in (host["from"], host["to"]) or far in (host["from"], host["to"]) \
            or any(e["id"] == attach["new_edge_id"] for e in before["edges"]):
        _fail("target")
    try:
        t = decode_rational(attach["tq"])
        a, b = old.points[host["from"]], old.points[host["to"]]
        target = point_at(a, b, t)
        if not 0 < t < 1 or target == old.points[source] or not cross(a, b, old.points[far]) \
                or decode_point(intent["target_p"]) != target or _point(intent["target"]) != to_numbers(target) \
                or _point(intent["point"]) != to_numbers(old.points[source]):
            _fail("target")
    except (GraphError, TypeError, ValueError) as error:
        if isinstance(error, NodeMoveError):
            raise
        _fail("target")
    base, graph = copy.deepcopy(space), copy.deepcopy(before)
    for node in graph["nodes"]:
        if node["id"] == source:
            node["p"] = encode_point(target)
    dependencies = []
    for dependency in graph["dependencies"]:
        if dependency["node"] == source:
            continue
        affected = any(source in (r["from"], r["to"]) or _has_node_carrier(old, source, r, source) for r in dependency["refs"])
        if affected:
            if not all(_has_node_carrier(old, source, r, dependency["node"], target) for r in dependency["refs"]):
                continue
            def point(node):
                return target if node == source else old.points[node]
            dependency["parameters"] = [encode_rational(project_parameter(point(dependency["node"]), point(r["from"]), point(r["to"]))) for r in dependency["refs"]]
        dependencies.append(dependency)
    dependencies.append({"node": source, "kind": "on-edge", "refs": [{"from": host["from"], "to": host["to"]}], "parameters": [encode_rational(t)]})
    graph["dependencies"] = dependencies
    first = next(e for e in graph["edges"] if edge_key(e) == edge_key(host))
    second = {**copy.deepcopy(first), "id": attach["new_edge_id"], "from": source}
    first["to"] = source
    graph["edges"].append(second)
    for room in graph["rooms"]:
        steps = []
        for step in room["edges"]:
            if edge_key(step) != edge_key(host):
                steps.append(step)
            else:
                children = (second, first) if step["reverse"] else (first, second)
                steps.extend({"kind": e["kind"], "id": e["id"], "reverse": step["reverse"]} for e in children)
        room["edges"] = steps
    span = _length(to_numbers(a), to_numbers(b))
    # Global junction limits measure a whole collinear run, not a split child.
    # The named attach promises two valid children without broadening Move.
    min_child = max(20, host["cm"]) / ((base.get("cell_cm") or 5) * 240)
    if float(t) * span < min_child - EPS or (1 - float(t)) * span < min_child - EPS:
        _fail()
    opening_rotations = {}
    for opening in base.get("openings", []):
        ref = opening.get("host")
        if not ref:
            from .plan_graph_exact import read_source_point
            if _on(read_source_point([opening["x"], opening["y"]]), old.points[arm["from"]], old.points[arm["to"]]):
                _fail("opening")
            continue
        ot = decode_rational(ref["tq"]) if ref.get("tq") else parse_decimal(ref["t"])
        if edge_key(ref) == edge_key(host):
            center, split = float(ot) * span, float(t) * span
            jamb = host["cm"] / (base.get("cell_cm") or 5) / 480
            if center - opening["length"] / 2 < split + jamb - EPS and center + opening["length"] / 2 > split - jamb + EPS:
                _fail("opening")
            child, nt = (first, ot / t) if ot <= t else (second, (ot - t) / (1 - t))
            opening["host"] = {**ref, "id": child["id"], "tq": encode_rational(nt), "t": float(nt)}
        elif edge_key(ref) == edge_key(arm):
            oa, ob = old.points[arm["from"]], old.points[arm["to"]]
            na, nb = (target if arm["from"] == source else oa), (target if arm["to"] == source else ob)
            center = point_at(oa, ob, ot)
            nt = project_parameter(center, na, nb)
            length = _length(to_numbers(na), to_numbers(nb))
            if point_at(na, nb, nt) != center:
                old_length = _length(to_numbers(oa), to_numbers(ob))
                value = 1 - (1 - float(ot)) * old_length / length if arm["from"] == source else float(ot) * old_length / length
                nt = parse_decimal(canonicalize_number(value))
            along, jamb = float(nt) * length, arm["cm"] / (base.get("cell_cm") or 5) / 480
            if along - opening["length"] / 2 < jamb - EPS or along + opening["length"] / 2 > length - jamb + EPS:
                _fail("opening")
            opening["host"] = {**ref, "tq": encode_rational(nt), "t": float(nt)}
            start, end = to_numbers(na), to_numbers(nb)
            opening_rotations[opening["id"]] = opening_axis_rotation(to_numbers(oa), to_numbers(ob), start, end)
            angle = math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / math.pi
            if angle >= 90:
                angle -= 180
            elif angle < -90:
                angle += 180
            opening["angle"] = canonicalize_number(angle)
    # New identities need not sort after existing user IDs. TS operations
    # canonicalize the batch; reproduce that order before server validation.
    graph["edges"].sort(key=edge_key)
    graph["dependencies"].sort(key=lambda d: d["node"])
    try:
        graph = propagate_dependencies(graph)
        index = validate_graph(graph, {"room_ids": [r["id"] for r in base.get("rooms", [])]})
        for node, point in index.points.items():
            if node != source and point != old.points[node]:
                _fail("dependency")
        # The exception names only this source and these two proven children.
        moved = index.edges[edge_key(arm)]
        pa, pb = index.points[moved["from"]], index.points[moved["to"]]
        for edge in graph["edges"]:
            if edge_key(edge) == edge_key(arm):
                continue
            pc, pd = index.points[edge["from"]], index.points[edge["to"]]
            hits = _contacts(pa, pb, pc, pd)
            if not hits:
                continue
            if not cross(pa, pb, pc) and not cross(pa, pb, pd) and any(p != q for p in hits for q in hits):
                _fail()
            receiver = edge["kind"] == host["kind"] and edge["id"] in (host["id"], attach["new_edge_id"])
            previous = host if receiver else old.edges[edge_key(edge)]
            old_hits = _contacts(old.points[arm["from"]], old.points[arm["to"]], old.points[previous["from"]], old.points[previous["to"]])
            for p in hits:
                if not (receiver and p == target and source in (edge["from"], edge["to"])) and p not in old_hits:
                    _fail()
        return transport_opening_orientations(space, project_graph_space(base, graph)["space"], opening_rotations)
    except GraphError as error:
        _fail("dependency" if "dependenc" in str(error) else "topology")
