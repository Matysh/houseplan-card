"""Existing node intents adapted to explicit current graph edits by identity."""
from __future__ import annotations

import copy

from .plan_graph import validate_graph, project_graph_space, propagate_dependencies, edge_key
from .plan_graph_exact import (
    GraphError, decode_point, decode_rational, encode_point, encode_rational,
    parse_decimal, point_at, project_parameter, read_source_point, to_numbers,
)


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


def move_graph_node_space(space, intent):
    from .wall_node_move import move_node_space, NodeMoveError

    if not set(intent) <= {"point", "target", "axis", "split_ids", "node_id", "target_p"}:
        raise NodeMoveError()
    identity, index = node_identity(space, intent)
    target = decode_point(intent["target_p"]) if "target_p" in intent else read_source_point(intent.get("target"))
    legacy_intent = {"point": to_numbers(index.points[identity]), "target": to_numbers(target),
                     "axis": intent.get("axis"), "split_ids": intent.get("split_ids", {})}
    # The old operation remains an independent physical preflight. Its
    # projected endpoints never become graph-authoritative coordinates.
    physical = move_node_space(space, legacy_intent)
    graph = copy.deepcopy(space["plan_graph"])
    for node in graph["nodes"]:
        if node["id"] == identity:
            node["p"] = encode_point(target)
    dependencies = []
    for dependency in graph["dependencies"]:
        if dependency["node"] != identity:
            dependencies.append(dependency)
            continue
        # A deliberate move retargets a retained support or detaches it.
        for support in dependency["refs"]:
            a, b = index.points[support["from"]], index.points[support["to"]]
            t = project_parameter(target, a, b)
            if 0 <= t <= 1 and point_at(a, b, t) == target:
                dependencies.append({"node": identity, "kind": "on-edge", "refs": [support], "parameters": [encode_rational(t)]})
                break
    graph["dependencies"] = dependencies
    graph = propagate_dependencies(graph)
    validate_graph(graph, {"room_ids": [r["id"] for r in space.get("rooms", [])]})
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
        after_index = validate_graph(graph)
        a, b = after_index.points[old["from"]], after_index.points[old["to"]]
        projected_t = project_parameter(centre, a, b)
        old_collinear = point_at(a, b, projected_t) == centre
        t = projected_t if old_collinear else parse_decimal(proposed["host"]["t"])
        opening["host"] = {**host, "tq": encode_rational(t), "t": float(t)}
        opening["angle"] = proposed["angle"]
    return project_graph_space(base, graph)["space"]


def delete_graph_node_space(space, intent):
    from .wall_node_delete import _deletion, delete_node_space, NodeDeleteError

    if not set(intent) <= {"point", "node_id"}:
        raise NodeDeleteError()
    identity, index = node_identity(space, intent)
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
    del physical
    return project_graph_space(base, graph)["space"]
