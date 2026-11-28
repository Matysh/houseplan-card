"""Exact subtraction proof, mirrored by src/wall-removal-proof.ts (#1258)."""
from .plan_graph_exact import GraphError as GraphError
from .plan_graph_exact import cross as cross
from .plan_graph_exact import decode_point as decode_point
from .plan_graph_exact import project_parameter as project_parameter


def _metadata(edge):
    return {key: value for key, value in edge.items() if key not in {"id", "kind", "from", "to"}}


def _same_json(left, right):
    # Python's True == 1 must not treat a changed future property as unchanged.
    if isinstance(left, bool) or isinstance(right, bool):
        return type(left) is type(right) and left == right
    if isinstance(left, dict) and isinstance(right, dict):
        return left.keys() == right.keys() and all(_same_json(value, right[key]) for key, value in left.items())
    if isinstance(left, list) and isinstance(right, list):
        return len(left) == len(right) and all(_same_json(a, b) for a, b in zip(left, right, strict=False))
    return left == right


def graph_only_removes_wall_material(before: dict, after: dict) -> bool:
    """Allow native lossless seam collapse, never new/shifted/extended material.

    Every candidate carrier follows a unique exact straight old chain, keeps
    one chain ID and its metadata, and consumes each old edge only once. All
    intermediate nodes must be gone; at least one old edge must be unused.
    """
    if len(after["edges"]) >= len(before["edges"]):
        return False
    try:
        nodes = {node["id"]: node["p"] for node in before["nodes"]}
        next_nodes = {node["id"]: node["p"] for node in after["nodes"]}
        incident = {}
        for index, edge in enumerate(before["edges"]):
            for node in (edge["from"], edge["to"]):
                incident.setdefault(node, []).append((index, edge))
        points, used = {}, set()

        def point(node):
            if node not in points:
                points[node] = decode_point(nodes[node])
            return points[node]

        for edge in after["edges"]:
            if any(node not in nodes or nodes[node] != next_nodes.get(node)
                   for node in (edge["from"], edge["to"])):
                return False
            start, end, props = point(edge["from"]), point(edge["to"]), _metadata(edge)
            if start == end:
                return False
            cursor, position, retained = edge["from"], 0, False
            while cursor != edge["to"]:
                options = []
                for index, old in incident.get(cursor, []):
                    if index in used or not _same_json(_metadata(old), props):
                        continue
                    node = old["to"] if old["from"] == cursor else old["from"]
                    p = point(node)
                    if cross(start, p, end):
                        continue
                    t = project_parameter(p, start, end)
                    if position < t <= 1:
                        options.append((index, old, node, t))
                if len(options) != 1:
                    return False
                index, old, node, t = options[0]
                if node != edge["to"] and node in next_nodes:
                    return False
                used.add(index)
                retained = retained or old["id"] == edge["id"]
                cursor, position = node, t
            if not retained:
                return False
        return len(used) < len(before["edges"])
    except (GraphError, KeyError, TypeError, ValueError):
        return False
