"""Physical hosting across exact, shared-node atoms of one straight carrier."""
from __future__ import annotations

import math
import json

from .plan_graph import edge_key, validate_graph
from .plan_graph_exact import cross, decode_rational, point_at, project_parameter, squared_distance


class GraphHostContinuity:
    def __init__(self, space):
        self.index = validate_graph(space["plan_graph"])
        self.runs = {}

    def interval(self, host):
        key = edge_key(host)
        edge = self.index.edges.get(key)
        if edge is None or edge["cm"] <= 0:
            return None
        a, b = self.index.points[edge["from"]], self.index.points[edge["to"]]
        if key not in self.runs:
            seen = {key}
            props = json.dumps(edge.get("props", {}), sort_keys=True, separators=(",", ":"))
            for initial, direction in ((edge["from"], -1), (edge["to"], 1)):
                node, previous = initial, key
                while True:
                    at = project_parameter(self.index.points[node], a, b)
                    choices = []
                    for candidate_key in self.index.incident[node]:
                        if candidate_key in seen:
                            continue
                        candidate = self.index.edges[candidate_key]
                        other = candidate["to"] if candidate["from"] == node else candidate["from"]
                        point = self.index.points[other]
                        if (candidate["kind"] != edge["kind"] or candidate["cm"] != edge["cm"]
                                or json.dumps(candidate.get("props", {}), sort_keys=True, separators=(",", ":")) != props
                                or cross(a, b, point)):
                            continue
                        t = project_parameter(point, a, b)
                        if (t-at)*direction > 0:
                            choices.append((candidate_key, other))
                    if len(choices) != 1:
                        break
                    candidate_key, next_node = choices[0]
                    reverse = []
                    for other_key in self.index.incident[node]:
                        other_edge = self.index.edges[other_key]
                        other_node = other_edge["to"] if other_edge["from"] == node else other_edge["from"]
                        point = self.index.points[other_node]
                        if (other_edge["kind"] == edge["kind"] and other_edge["cm"] == edge["cm"]
                                and json.dumps(other_edge.get("props", {}), sort_keys=True, separators=(",", ":")) == props
                                and not cross(a, b, point)
                                and (project_parameter(point, a, b)-at)*direction < 0):
                            reverse.append(other_key)
                    if reverse != [previous]:
                        break
                    seen.add(candidate_key)
                    previous, node = candidate_key, next_node
            points = [self.index.points[self.index.edges[ref][side]] for ref in seen for side in ("from", "to")]
            first = min(points, key=lambda p: (p.x, p.y))
            last = max(points, key=lambda p: (p.x, p.y))
            run = (tuple(sorted(seen)), first, last)
            for member in seen:
                self.runs[member] = run
        identity, first, last = self.runs[key]
        centre = point_at(a, b, decode_rational(host.get("tq")))
        span = math.sqrt(float(squared_distance(first, last)))
        along = float(project_parameter(centre, first, last))*span
        return identity, span, along
