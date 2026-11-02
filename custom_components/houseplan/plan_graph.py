"""Model11 graph authority. Projections are derived, never another writer.

The pure facade is mirrored by src/plan-graph.ts. Storage, ACL, revisions and
recovery live at the existing writer boundary, outside this module.
"""
from __future__ import annotations

import copy
import math
from dataclasses import dataclass
from fractions import Fraction
from typing import Any

from .plan_graph_exact import (
    ExactPoint, GraphError, cross, decode_point, decode_rational,
    encode_point, point_at, to_numbers, parse_decimal, intersection,
)

GRAPH_VERSION = 1
MODEL_VERSION = 11
MAX_EDGES = 202000  # existing 200000 contour atoms plus 2000 partitions
MAX_NODES = 2 * MAX_EDGES
_GRAPH_KEYS = {"version", "nodes", "edges", "rooms", "dependencies"}


def _record(value: Any, required: set[str], optional: set[str] = frozenset()) -> dict:
    if not isinstance(value, dict) or not required <= value.keys() or value.keys() - required - optional:
        raise GraphError("invalid_graph_record")
    return value


def _id(value: Any) -> str:
    # Migration node IDs encode stable source references and can exceed old
    # carrier IDs. They are not file paths, HTML IDs or globally unique IDs.
    if not isinstance(value, str) or not value or len(value) > 4096:
        raise GraphError("invalid_graph_id")
    return value


def edge_key(ref: dict) -> tuple[str, str]:
    if ref.get("kind") not in ("wall", "partition"):
        raise GraphError("invalid_edge_kind")
    return ref["kind"], _id(ref.get("id"))


@dataclass(slots=True)
class GraphIndex:
    nodes: dict[str, dict]
    points: dict[str, ExactPoint]
    edges: dict[tuple[str, str], dict]
    rooms: dict[str, list[dict]]
    incident: dict[str, list[tuple[str, str]]]
    dependencies: dict[str, dict]
    dependency_order: list[str]


def _dependency_order(dependencies: dict[str, dict], nodes: dict) -> list[str]:
    # Iterative Kahn traversal avoids recursion limits for valid long chains.
    indegree = {node: 0 for node in dependencies}
    children: dict[str, set[str]] = {}
    for node, dependency in dependencies.items():
        for support in {ref[side] for ref in dependency["refs"] for side in ("from", "to")}:
            if support not in nodes or support == node:
                raise GraphError("invalid_dependency_support")
            if support in dependencies:
                indegree[node] += 1
                children.setdefault(support, set()).add(node)
    ready = sorted(node for node, degree in indegree.items() if not degree)
    order: list[str] = []
    while ready:
        batch, ready = ready, []
        for node in batch:
            order.append(node)
            for child in sorted(children.get(node, ())):
                indegree[child] -= 1
                if not indegree[child]:
                    ready.append(child)
        ready.sort()
    if len(order) != len(dependencies):
        raise GraphError("dependency_cycle")
    return order


def validate_graph(graph: Any, context: dict | None = None) -> GraphIndex:
    context = context or {}
    _record(graph, _GRAPH_KEYS)
    if type(graph["version"]) is not int or graph["version"] != GRAPH_VERSION:
        raise GraphError("unsupported_graph_version")
    for field, maximum in (("nodes", MAX_NODES), ("edges", MAX_EDGES), ("rooms", 400), ("dependencies", MAX_NODES)):
        if not isinstance(graph[field], list) or len(graph[field]) > maximum:
            raise GraphError("graph_count_limit", code="plan_graph_resource_limit")
    nodes, points = {}, {}
    for node in graph["nodes"]:
        _record(node, {"id", "p"})
        key = _id(node["id"])
        if key in nodes:
            raise GraphError("duplicate_node")
        nodes[key], points[key] = node, decode_point(node["p"])
    if list(nodes) != sorted(nodes):
        raise GraphError("noncanonical_node_order")
    edges, incident = {}, {node: [] for node in nodes}
    kind_counts = {"wall": 0, "partition": 0}
    for edge in graph["edges"]:
        _record(edge, {"id", "from", "to", "kind", "cm"}, {"props"})
        key = edge_key(edge)
        if key in edges:
            raise GraphError("duplicate_edge")
        start, end = edge["from"], edge["to"]
        if not isinstance(start, str) or not isinstance(end, str) or start not in nodes or end not in nodes:
            raise GraphError("missing_edge_node")
        if start == end or points[start] == points[end]:
            raise GraphError("zero_length_edge")
        cm = edge["cm"]
        if isinstance(cm, bool) or not isinstance(cm, (int, float)) or not math.isfinite(cm) or not 0 <= cm <= 100:
            raise GraphError("invalid_thickness")
        if "props" in edge and (not isinstance(edge["props"], dict) or {"id", "a", "b", "cm", "kind", "from", "to"} & edge["props"].keys()):
            raise GraphError("invalid_edge_properties")
        kind_counts[key[0]] += 1
        edges[key] = edge
        incident[start].append(key)
        incident[end].append(key)
    if kind_counts["wall"] > 200000 or kind_counts["partition"] > 2000:
        raise GraphError("edge_count_limit", code="plan_graph_resource_limit")
    if list(edges) != sorted(edges):
        raise GraphError("noncanonical_edge_order")
    rooms: dict[str, list[dict]] = {}
    uses: dict[tuple[str, str], set[str]] = {}
    allowed_rooms = context.get("room_ids")
    for room in graph["rooms"]:
        _record(room, {"room", "edges"})
        rid = _id(room["room"])
        if rid in rooms or allowed_rooms is not None and rid not in allowed_rooms:
            raise GraphError("invalid_room_owner")
        cycle = room["edges"]
        if not isinstance(cycle, list) or not 3 <= len(cycle) <= 500:
            raise GraphError("invalid_room_cycle")
        starts, ends, cycle_refs = [], [], set()
        for step in cycle:
            _record(step, {"kind", "id", "reverse"})
            key = edge_key(step)
            if type(step["reverse"]) is not bool or key not in edges or key in cycle_refs:
                raise GraphError("invalid_room_edge")
            if key[0] != "wall":
                raise GraphError("partition_room_owner")
            cycle_refs.add(key)
            edge = edges[key]
            starts.append(edge["to"] if step["reverse"] else edge["from"])
            ends.append(edge["from"] if step["reverse"] else edge["to"])
            uses.setdefault(key, set()).add(rid)
            if len(uses[key]) > 2:
                raise GraphError("third_wall_owner")
        if any(ends[i] != starts[(i + 1) % len(starts)] for i in range(len(starts))):
            raise GraphError("open_room_cycle")
        if len(set(starts)) != len(starts):
            raise GraphError("repeated_room_node")
        # A collinear cycle is not a room even if its ID incidence closes.
        area = sum(points[a].x * points[b].y - points[a].y * points[b].x for a, b in zip(starts, ends))
        if not area:
            raise GraphError("zero_area_room")
        for i, a in enumerate(starts):
            for j in range(i + 2, len(starts)):
                if i == 0 and j == len(starts) - 1:
                    continue
                hit = intersection(points[a], points[ends[i]], points[starts[j]], points[ends[j]])
                if hit and 0 <= hit[1] <= 1 and 0 <= hit[2] <= 1:
                    raise GraphError("room_self_intersection")
        rooms[rid] = cycle
    if list(rooms) != sorted(rooms):
        raise GraphError("noncanonical_room_order")
    # Only strict interior/interior crossings require a shared graph node.
    # Coincident detached endpoints/Ts deliberately keep independent IDs.
    from .plan_graph_spatial import SegmentTree
    segments = [{"a": points[e["from"]], "b": points[e["to"]], "key": key} for key, e in edges.items()]
    tree = SegmentTree(segments) if segments else None
    for segment in segments:
        a, b = segment["a"], segment["b"]
        lo, hi = ExactPoint(min(a.x, b.x), min(a.y, b.y)), ExactPoint(max(a.x, b.x), max(a.y, b.y))
        for other in tree.query(lo, hi):
            if other["key"] <= segment["key"]:
                continue
            hit = intersection(a, b, other["a"], other["b"])
            if hit and 0 < hit[1] < 1 and 0 < hit[2] < 1:
                raise GraphError("unsplit_proper_crossing")
    dependencies = {}
    for dependency in graph["dependencies"]:
        _record(dependency, {"node", "kind", "refs", "parameters"})
        node = dependency["node"]
        count = {"on-edge": 1, "intersection": 2}.get(dependency["kind"])
        if not isinstance(node, str) or node not in nodes or node in dependencies or count is None:
            raise GraphError("invalid_dependency")
        refs, parameters = dependency["refs"], dependency["parameters"]
        if not isinstance(refs, list) or not isinstance(parameters, list) or len(refs) != count or len(parameters) != count:
            raise GraphError("invalid_dependency_arity")
        for ref, parameter in zip(refs, parameters, strict=True):
            _record(ref, {"from", "to"})
            a, b = ref["from"], ref["to"]
            if not isinstance(a, str) or not isinstance(b, str) or a not in nodes or b not in nodes or points[a] == points[b]:
                raise GraphError("invalid_dependency_support")
            t = decode_rational(parameter)
            if not 0 <= t <= 1 or point_at(points[a], points[b], t) != points[node]:
                raise GraphError("dependency_point_mismatch")
        if count == 2 and not cross(points[refs[0]["from"]], points[refs[0]["to"]], points[refs[1]["to"]]) and not cross(points[refs[0]["from"]], points[refs[0]["to"]], points[refs[1]["from"]]):
            raise GraphError("collinear_intersection")
        dependencies[node] = dependency
    if list(dependencies) != sorted(dependencies):
        raise GraphError("noncanonical_dependency_order")
    return GraphIndex(nodes, points, edges, rooms, incident, dependencies, _dependency_order(dependencies, nodes))


def project_graph_space(base_space: dict, graph: dict, context: dict | None = None) -> dict:
    from .wall_segment_model import _wall_key

    index = validate_graph(graph, {**(context or {}), "room_ids": {room["id"] for room in base_space.get("rooms", [])}})
    out = copy.deepcopy(base_space)
    out["plan_graph"] = copy.deepcopy(graph)
    carriers: dict[str, list[dict]] = {"wall": [], "partition": []}
    for edge in index.edges.values():
        carriers[edge["kind"]].append({**copy.deepcopy(edge.get("props", {})), "id": edge["id"],
            "a": to_numbers(index.points[edge["from"]]), "b": to_numbers(index.points[edge["to"]]), "cm": edge["cm"]})
    out["wall_segments"] = carriers["wall"]
    out["partitions"] = carriers["partition"]
    out["walls"] = [{"key": _wall_key(edge["a"], edge["b"]), "a": edge["a"][:], "b": edge["b"][:], "cm": edge["cm"]}
                    for edge in carriers["wall"] if edge["cm"] > 0]
    room_metadata = {room["id"]: room for room in out.get("rooms", [])}
    out["rooms"] = [room_metadata[identity] for identity in index.rooms]
    for room in out["rooms"]:
        cycle = index.rooms.get(room["id"])
        if cycle is None:
            raise GraphError("missing_room_cycle")
        room["poly"] = [to_numbers(index.points[index.edges[edge_key(step)]["to" if step["reverse"] else "from"]]) for step in cycle]
        room["wall_ids"] = [step["id"] for step in cycle]
        for field in ("x", "y", "w", "h", "open_to"):
            room.pop(field, None)
    for opening in out.get("openings", []):
        host = opening.get("host")
        if not host:
            continue
        edge = index.edges.get(edge_key(host))
        if edge is None:
            raise GraphError("opening_host_missing")
        t = decode_rational(host["tq"]) if "tq" in host else parse_decimal(host.get("t"))
        if not 0 <= t <= 1:
            raise GraphError("opening_parameter_range")
        point = point_at(index.points[edge["from"]], index.points[edge["to"]], t)
        opening["x"], opening["y"] = to_numbers(point)
        host["tq"], host["t"] = [str(t.numerator), str(t.denominator)], float(t)
    out.pop("open_spans", None)
    return {"space": out, "bindings": index}


def verify_projection(space: dict, graph: dict | None = None) -> None:
    graph = graph if graph is not None else space.get("plan_graph")
    # project_graph_space also validates room ownership. Classify a bad
    # projection before that context can turn missing IDs into a graph error.
    if isinstance(graph, dict) and isinstance(graph.get("rooms"), list):
        graph_rooms = graph["rooms"]
        actual_rooms = space.get("rooms", [])
        if all(isinstance(r, dict) and isinstance(r.get("room"), str) for r in graph_rooms):
            if not isinstance(actual_rooms, list) or [r.get("id") if isinstance(r, dict) else None for r in actual_rooms] != [r["room"] for r in graph_rooms]:
                raise GraphError("projection_mismatch", code="plan_graph_projection_mismatch")
    expected = project_graph_space(space, graph)["space"]
    for field in ("wall_segments", "walls", "partitions"):
        if space.get(field, []) != expected.get(field, []):
            raise GraphError("projection_mismatch", code="plan_graph_projection_mismatch")
    rooms, projected_rooms = space.get("rooms", []), expected.get("rooms", [])
    if len(rooms) != len(projected_rooms):
        raise GraphError("projection_mismatch", code="plan_graph_projection_mismatch")
    for actual, derived in zip(rooms, projected_rooms, strict=True):
        if actual.get("id") != derived["id"] or actual.get("poly") != derived["poly"] or actual.get("wall_ids") != derived["wall_ids"]:
            raise GraphError("projection_mismatch", code="plan_graph_projection_mismatch")
    if space.get("openings", []) != expected.get("openings", []):
        raise GraphError("opening_projection_mismatch", code="plan_graph_projection_mismatch")


def propagate_dependencies(graph: dict) -> dict:
    """Evaluate retained support constraints after an atomic graph edit."""
    out = copy.deepcopy(graph)
    nodes = {node["id"]: node for node in out["nodes"]}
    points = {key: decode_point(node["p"]) for key, node in nodes.items()}
    dependencies = {dep["node"]: dep for dep in out["dependencies"]}
    for node in _dependency_order(dependencies, nodes):
        dependency = dependencies[node]
        refs = dependency["refs"]
        if dependency["kind"] == "on-edge" and len(refs) == 1:
            t = decode_rational(dependency["parameters"][0])
            p = point_at(points[refs[0]["from"]], points[refs[0]["to"]], t)
        elif dependency["kind"] == "intersection" and len(refs) == 2:
            hit = intersection(points[refs[0]["from"]], points[refs[0]["to"]], points[refs[1]["from"]], points[refs[1]["to"]])
            if hit is None or not 0 <= hit[1] <= 1 or not 0 <= hit[2] <= 1:
                raise GraphError("dependency_intersection_lost")
            p, t, u = hit
            dependency["parameters"] = [[str(t.numerator), str(t.denominator)], [str(u.numerator), str(u.denominator)]]
        else:
            raise GraphError("invalid_dependency")
        nodes[node]["p"] = encode_point(p)
        points[node] = p
    return out


def apply_graph_patch(before: dict, patch: dict, context: dict | None = None) -> dict:
    """Replay explicit ID-record edits on the authoritative migration baseline.

    A client preview baseline is never a replacement for this baseline. In
    particular unchanged preview coordinates do not overwrite server choices.
    """
    validate_graph(before, context)
    _record(patch, {"nodes", "edges", "rooms", "dependencies"})
    out = copy.deepcopy(before)
    keys = {"nodes": lambda row: _id(row.get("id")), "edges": edge_key,
            "rooms": lambda row: _id(row.get("room")), "dependencies": lambda row: _id(row.get("node"))}
    touched = {}
    for name, key in keys.items():
        delta = _record(patch[name], {"set", "remove"})
        if not isinstance(delta["set"], list) or not isinstance(delta["remove"], list):
            raise GraphError("invalid_graph_patch")
        existing = {key(row): row for row in out[name]}
        removing = [edge_key(row) if name == "edges" else _id(row) for row in delta["remove"]]
        setting = [key(row) if isinstance(row, dict) else None for row in delta["set"]]
        if None in setting or len(set(removing)) != len(removing) or len(set(setting)) != len(setting) or set(removing) & set(setting):
            raise GraphError("ambiguous_graph_patch")
        for item in removing:
            if item not in existing:
                raise GraphError("graph_patch_missing_source")
            del existing[item]
        for item in delta["set"]:
            existing[key(item)] = copy.deepcopy(item)
        out[name] = [existing[item] for item in sorted(existing)]
        touched[name] = sorted(set(removing) | set(setting))
    try:
        out = propagate_dependencies(out)
    except (KeyError, TypeError, IndexError) as err:
        raise GraphError("invalid_dependency") from err
    validate_graph(out, context)
    return {"graph": out, "changed": out != before, "mapping": {"nodes": {}, "edges": {}, "hosts": {}},
            "touched": touched, "diagnostics": []}
