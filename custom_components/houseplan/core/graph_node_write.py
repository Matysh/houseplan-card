"""Existing node intents adapted to explicit current graph edits by identity."""
from __future__ import annotations

import copy as copy
import math as math

from .coordinate_canonicalization import canonicalize_number as canonicalize_number
from .plan_graph import edge_key as edge_key
from .plan_graph import project_graph_space as project_graph_space
from .plan_graph import propagate_dependencies as propagate_dependencies
from .plan_graph import validate_graph as validate_graph
from .plan_graph_exact import GraphError as GraphError
from .plan_graph_exact import decode_point as decode_point
from .plan_graph_exact import decode_rational as decode_rational
from .plan_graph_exact import encode_point as encode_point
from .plan_graph_exact import encode_rational as encode_rational
from .plan_graph_exact import parse_decimal as parse_decimal
from .plan_graph_exact import point_at as point_at
from .plan_graph_exact import project_parameter as project_parameter
from .plan_graph_exact import read_authored_point as read_authored_point
from .plan_graph_exact import read_source_point as read_source_point
from .plan_graph_exact import squared_distance as squared_distance
from .plan_graph_exact import to_numbers as to_numbers


def node_identity(space, intent):
    index = validate_graph(space["plan_graph"])
    identity = intent.get("node_id")
    if identity is None:
        point = read_source_point(intent.get("point"))
        matches = [key for key, value in index.points.items() if value == point]
        if len(matches) != 1:
            raise GraphError("ambiguous_legacy_node")
        identity = matches[0]
    if not isinstance(identity, str) or identity not in index.nodes:
        raise GraphError("missing_node_identity")
    return identity, index


def _has_node_carrier(index, moved, support, via, target=None):
    """A finite named straight run through via, including split carriers.

    Native Select fixes every other vertex. A discarded affine constraint
    must not move a remote vertex through a bend or a detached identity.
    """
    def point(node):
        return target if node == moved and target is not None else index.points[node]

    a, b = point(support["from"]), point(support["to"])
    if a == b:
        return False
    parameters = {}

    def parameter(node):
        if node not in parameters:
            p = point(node)
            t = project_parameter(p, a, b)
            parameters[node] = t if 0 <= t <= 1 and point_at(a, b, t) == p else None
        return parameters[node]

    def reaches(start, end):
        first, last = parameter(start), parameter(end)
        if first is None or last is None or first > last:
            return False
        pending, seen = [start], set()
        while pending:
            node = pending.pop()
            if node == end:
                return True
            if node in seen:
                continue
            seen.add(node)
            t = parameter(node)
            for key in index.incident.get(node, []):
                edge = index.edges[key]
                other = edge["to"] if edge["from"] == node else edge["from"]
                nt = parameter(other)
                if nt is not None and t < nt <= last:
                    pending.append(other)
        return False

    return reaches(support["from"], via) and reaches(via, support["to"])


def move_graph_node_space(space, intent):
    from .wall_node_move import NodeMoveError, _point, move_node_space

    if "attach_edge" in intent:
        from .wall_node_attach import attach_graph_node_space
        return attach_graph_node_space(space, intent)

    if "merge_node_id" in intent:
        from .wall_node_merge import merge_graph_node_space
        try:
            return merge_graph_node_space(space, intent)
        except GraphError as error:
            raise NodeMoveError("merge_dependency" if "dependenc" in str(error) else "merge_topology") from error

    if not set(intent) <= {"point", "target", "axis", "split_ids", "node_id", "target_p"}:
        raise NodeMoveError()
    identity, index = node_identity(space, intent)
    if not index.incident[identity]:
        raise NodeMoveError()
    # Numeric editor intents keep the same invalid-input contract as the TS
    # and legacy preflight, before exact decoding can report a graph fault.
    target = decode_point(intent["target_p"]) if "target_p" in intent else read_authored_point(_point(intent.get("target")))
    legacy_intent = {"point": to_numbers(index.points[identity]), "target": to_numbers(target),
                     "axis": intent.get("axis"), "split_ids": intent.get("split_ids", {})}
    # The old operation remains an independent physical preflight. Its
    # projected endpoints never become graph-authoritative coordinates.
    physical = move_node_space(space, legacy_intent, graph_index=index)
    graph = copy.deepcopy(space["plan_graph"])
    for node in graph["nodes"]:
        if node["id"] == identity:
            node["p"] = encode_point(target)
    dependencies = []
    for dependency in graph["dependencies"]:
        if dependency["node"] != identity:
            affected = any(identity in {s["from"], s["to"]}
                           or _has_node_carrier(index, identity, s, identity)
                           for s in dependency["refs"])
            if affected:
                if not all(_has_node_carrier(index, identity, s, dependency["node"], target)
                           for s in dependency["refs"]):
                    continue
                def point(node):
                    return target if node == identity else index.points[node]
                dependency["parameters"] = [encode_rational(project_parameter(
                    point(dependency["node"]), point(s["from"]), point(s["to"])))
                    for s in dependency["refs"]]
            dependencies.append(dependency)
            continue
        # A deliberate move retargets a retained support or detaches it.
        for support in dependency["refs"]:
            if not _has_node_carrier(index, identity, support, identity, target):
                continue
            a, b = index.points[support["from"]], index.points[support["to"]]
            t = project_parameter(target, a, b)
            if 0 <= t <= 1 and point_at(a, b, t) == target:
                dependencies.append({"node": identity, "kind": "on-edge", "refs": [support], "parameters": [encode_rational(t)]})
                break
    graph["dependencies"] = dependencies
    graph = propagate_dependencies(graph)
    after_index = validate_graph(graph, {"room_ids": [r["id"] for r in space.get("rooms", [])]})
    base = copy.deepcopy(space)
    proposed_openings = {row["id"]: row for row in physical.get("openings", [])}
    incident = set(index.incident[identity])
    for opening in base.get("openings", []):
        host = opening.get("host")
        if not host or edge_key(host) not in incident:
            continue
        proposed = proposed_openings[opening["id"]]
        # Split-free graph movement retains each host edge ID. Only its
        # parameter/angle are explicitly changed by the proven host policy.
        if edge_key(proposed["host"]) != edge_key(host):
            raise NodeMoveError("opening_blocked")
        old = index.edges[edge_key(host)]
        before_t = decode_rational(host["tq"])
        centre = point_at(index.points[old["from"]], index.points[old["to"]], before_t)
        a, b = after_index.points[old["from"]], after_index.points[old["to"]]
        projected_t = project_parameter(centre, a, b)
        old_collinear = point_at(a, b, projected_t) == centre
        # One correctly-rounded squared-length ratio and one IEEE sqrt in both
        # mirrors; language-specific hypot rounding must not alter exact tq.
        t = projected_t
        if not old_collinear:
            ratio = parse_decimal(math.sqrt(float(squared_distance(index.points[old["from"]], index.points[old["to"]])
                                                  / squared_distance(a, b))))
            t = 1 - (1 - before_t) * ratio if old["from"] == identity else before_t * ratio
        opening["host"] = {**host, "tq": encode_rational(t), "t": float(t)}
        opening["angle"] = canonicalize_number(proposed["angle"])
        if "opening_features" in proposed:
            # The independent physical phase already carried the v1 basis.
            # Preserve its whole orientation alongside angle; never reverse twice.
            opening["opening_features"] = copy.deepcopy(proposed["opening_features"])
            if "flip_v" in proposed:
                opening["flip_v"] = proposed["flip_v"]
            else:
                opening.pop("flip_v", None)
    return project_graph_space(base, graph)["space"]


def delete_graph_node_space(space, intent):
    from .wall_node_delete import NodeDeleteError, _deletion, delete_node_space

    if not set(intent) <= {"point", "node_id"}:
        raise NodeDeleteError()
    identity, index = node_identity(space, intent)
    # Degree belongs to the selected graph identity, not to every numerically
    # nearby legacy endpoint. Match the frontend before physical preflight.
    if len(index.incident[identity]) != 2:
        raise NodeDeleteError("degree")
    legacy_intent = {"point": to_numbers(index.points[identity])}
    _, keep, drop, _, _, _ = _deletion(space, legacy_intent)
    physical = delete_node_space(space, legacy_intent)
    keep_key, drop_key = edge_key(keep), edge_key(drop)
    graph = copy.deepcopy(space["plan_graph"])
    kept = next(e for e in graph["edges"] if edge_key(e) == keep_key)
    removed = next(e for e in graph["edges"] if edge_key(e) == drop_key)
    if set(index.incident[identity]) != {keep_key, drop_key}:
        raise NodeDeleteError("degree")
    if any(identity in {ref["from"], ref["to"]} for d in graph["dependencies"] if d["node"] != identity for ref in d["refs"]):
        raise NodeDeleteError("dependent_support")
    outer = removed["to"] if removed["from"] == identity else removed["from"]
    kept["from" if kept["from"] == identity else "to"] = outer
    graph["edges"] = [e for e in graph["edges"] if edge_key(e) != drop_key]
    for room in graph["rooms"]:
        old_edges = room["edges"]
        steps = [step for step in old_edges if edge_key(step) != drop_key]
        for step in steps:
            if edge_key(step) == keep_key:
                old_keep = index.edges[keep_key]
                start = old_keep["to"] if step["reverse"] else old_keep["from"]
                if start == identity:
                    start = outer
                step["reverse"] = kept["to"] == start
        room["edges"] = steps
    graph["nodes"] = [n for n in graph["nodes"] if n["id"] != identity]
    graph["dependencies"] = [d for d in graph["dependencies"] if d["node"] != identity]
    graph = propagate_dependencies(graph)
    validate_graph(graph, {"room_ids": [r["id"] for r in space.get("rooms", [])]})
    base = copy.deepcopy(space)
    a, b = index.points[kept["from"]], index.points[kept["to"]]
    for opening in base.get("openings", []):
        host = opening.get("host")
        if not host or edge_key(host) not in {keep_key, drop_key}:
            continue
        old = index.edges[edge_key(host)]
        centre = point_at(index.points[old["from"]], index.points[old["to"]], decode_rational(host["tq"]))
        t = project_parameter(centre, a, b)
        if point_at(a, b, t) != centre or not 0 <= t <= 1:
            raise NodeDeleteError("opening")
        opening["host"] = {**host, "id": kept["id"], "kind": kept["kind"], "tq": encode_rational(t), "t": float(t)}
    # physical was evaluated for the unchanged angle, clearances and all room
    # overlaps; the graph projection is independently derived afterwards.
    from .opening_orientation import transport_opening_orientations

    del physical
    return transport_opening_orientations(space, project_graph_space(base, graph)["space"])
