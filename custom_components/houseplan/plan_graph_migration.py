"""Detached v10 -> exact graph; mirrored by plan-graph.ts migration phases.

No Store, canonical scalar rounding, axis snapping or current-model recovery
is performed here. Every moved source owner is checked against its own point.
"""
from __future__ import annotations

import base64
import copy
import hashlib
import json
import math
from fractions import Fraction as Q
from urllib.parse import quote

from .plan_graph import MAX_EDGES, project_graph_space, validate_graph
from .plan_graph_exact import (
    ExactPoint as P, GraphError, decode_point, decode_rational, encode_point,
    encode_rational, intersection, normalization_radius, parse_decimal,
    point_at, project_parameter, read_source_point, squared_distance, to_numbers,
)
from .wall_segment_model import (
    _angle_matches, _legacy_thickness_at, _shared_boundaries, _wall_key,
    deterministic_wall_segment_id,
)
from .junction_limits import _stored_wall_contact


def _json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _hash(value):
    return base64.b32encode(hashlib.sha256(value.encode()).digest()).decode().lower().rstrip("=")


def source_node_id(ref):
    value = "n:" + quote(ref, safe="~()*!.'-_")
    return value if len(value) <= 4096 else "n:h:" + _hash(ref)


def graph_split_id(kind, identity, index, lo, hi):
    plain = f"{identity}~{index}"
    return plain if len(plain) <= 64 else "s:" + _hash(_json([kind, identity, index, lo, hi]))[:52]


def _pk(p):
    return _json(encode_point(p))


def _xy(p):
    return p.x, p.y


def _key(edge):
    return edge["kind"] + ":" + edge["id"]


def _ref(edge):
    return {"kind": edge["kind"], "id": edge["id"]}


def _near(a, b, radius):
    return squared_distance(a, b) <= radius * radius


def _poly(room):
    if "poly" in room:
        return room["poly"]
    x, y, w, h = (room[key] for key in ("x", "y", "w", "h"))
    return [[x, y], [x+w, y], [x+w, y+h], [x, y+h]]


def _collect(space):
    sources, room_only, points, boundaries, room_polys = {}, {}, {}, {}, {}

    def add(raw, kind, owners=()):
        if not isinstance(raw.get("id"), str) or not raw["id"]:
            raise GraphError("source_edge_id")
        a, b = read_source_point(raw["a"]), read_source_point(raw["b"])
        if a == b:
            raise GraphError("zero_length_edge")
        reverse = _xy(a) > _xy(b)
        result = dict(kind=kind, id=raw["id"], a=b if reverse else a,
                      b=a if reverse else b, raw=copy.deepcopy(raw),
                      cm=raw.get("cm", 0), reversed=reverse, owners=set(owners))
        key = _key(result)
        if key in sources:
            raise GraphError("duplicate_edge")
        sources[key] = result
        return result

    for raw in space.get("wall_segments", []):
        add(raw, "wall")
    for raw in space.get("partitions", []):
        add(raw, "partition")
    # Exact geometry lookup is an index, not an all-catalogue scan per room.
    geometry = {(_pk(s["a"]), _pk(s["b"])): s for s in sources.values() if s["kind"] == "wall"}
    for room in space.get("rooms", []):
        rid, poly = room["id"], _poly(room)
        if rid in room_polys or len(poly) < 3:
            raise GraphError("invalid_room_owner")
        room_polys[rid] = poly
        wall_ids = room.get("wall_ids", [])
        for i, raw in enumerate(poly):
            a, b = read_source_point(raw), read_source_point(poly[(i+1) % len(poly)])
            lo, hi = sorted((a, b), key=_xy)
            gid = (_pk(lo), _pk(hi))
            preferred = wall_ids[i] if i < len(wall_ids) else None
            if not preferred or "wall:" + preferred not in sources:
                if gid not in geometry:
                    entry = room_only.setdefault("|".join(gid), dict(a=raw, b=poly[(i+1) % len(poly)], owners=[], preferred=[]))
                    entry["owners"].append(rid)
                    if isinstance(preferred, str) and preferred:
                        entry["preferred"].append(preferred)
    generated = {}
    for key, item in sorted(room_only.items()):
        base = min(item["preferred"]) if item["preferred"] else deterministic_wall_segment_id(str(space.get("id", "")), item["a"], item["b"], item["owners"])
        identity, suffix = base, 2
        while "wall:" + identity in sources:
            identity, suffix = base + "-" + str(suffix), suffix + 1
        overlay = next((w for w in space.get("walls", []) if w.get("key") == _wall_key(item["a"], item["b"])), {})
        generated[key] = add(dict(id=identity, a=item["a"], b=item["b"], cm=overlay.get("cm", 0)), "wall", item["owners"])
    ordered = sorted(sources.values(), key=_key)
    geometry = {(_pk(s["a"]), _pk(s["b"])): s for s in reversed(ordered) if s["kind"] == "wall"}

    def add_point(ref, point, endpoint=None):
        if ref in points and points[ref]["p"] != point:
            raise GraphError("source_reference")
        owner = points.setdefault(ref, dict(ref=ref, p=point, endpoints=[]))
        if endpoint and endpoint not in owner["endpoints"]:
            owner["endpoints"].append(endpoint)

    for source in ordered:
        for side, point in enumerate((source["a"], source["b"])):
            add_point(_json([source["kind"], source["id"], side]), point, _key(source) + ":" + str(side))
    for room in space.get("rooms", []):
        rid, poly, wall_ids, result = room["id"], room_polys[room["id"]], room.get("wall_ids", []), []
        for i, raw in enumerate(poly):
            a, b = read_source_point(raw), read_source_point(poly[(i+1) % len(poly)])
            lo, hi = sorted((a, b), key=_xy)
            gid = (_pk(lo), _pk(hi))
            source = sources.get("wall:" + wall_ids[i]) if i < len(wall_ids) else None
            source = source or geometry.get(gid) or generated.get("|".join(gid))
            if source is None:
                raise GraphError("source_room_edge")
            source["owners"].add(rid)
            ta, tb = (project_parameter(p, source["a"], source["b"]) for p in (a, b))
            if not 0 <= ta <= 1 or not 0 <= tb <= 1:
                raise GraphError("source_room_range")
            ar, br = _json(["room", rid, _pk(a)]), _json(["room", rid, _pk(b)])
            result.append(dict(source=_key(source), start=ta, end=tb, startRef=ar, endRef=br))
            add_point(ar, a)
        boundaries[rid] = result
    return ordered, [points[key] for key in sorted(points)], boundaries


class _Tree:
    """Exact AABB broad phase, same alternating median tree as the TS core."""
    def __init__(self, items, depth=0):
        self.lo = P(min(s["a"].x for s in items), min(min(s["a"].y, s["b"].y) for s in items))
        self.hi = P(max(s["b"].x for s in items), max(max(s["a"].y, s["b"].y) for s in items))
        self.items, self.children = None, None
        if len(items) <= 8:
            self.items = items
        else:
            axis = depth % 2
            ordered = sorted(items, key=lambda s: _xy(s["a"])[axis] + _xy(s["b"])[axis])
            middle = len(ordered) // 2
            self.children = (_Tree(ordered[:middle], depth+1), _Tree(ordered[middle:], depth+1))

    def query(self, lo, hi):
        if self.hi.x < lo.x or self.hi.y < lo.y or self.lo.x > hi.x or self.lo.y > hi.y:
            return []
        if self.items is not None:
            return self.items
        return self.children[0].query(lo, hi) + self.children[1].query(lo, hi)


def migrate_graph_space(space, options=None):
    if space.get("plan_graph") is not None:
        raise GraphError("current_graph_reconstruction")
    options = options or {}
    cell = options.get("cell_cm", space.get("cell_cm", 5) or 5)
    radius = normalization_radius(cell)
    sources, owners, boundaries = _collect(space)
    source_version = options.get("source_model_version", 10 if space.get("wall_segments") else 0)
    if type(source_version) is not int or not 0 <= source_version <= 10:
        raise GraphError("invalid_source_model")
    canonical_segments = {row["id"] for row in space.get("wall_segments", [])}
    if len(sources) > MAX_EDGES or len(space.get("rooms", [])) > 400:
        raise GraphError("graph_count_limit", code="plan_graph_resource_limit")
    tree = _Tree(sources) if sources else None
    source_by_key = {_key(s): s for s in sources}

    def run(optional):
        graph = dict(version=1, nodes=[], edges=[], rooms=[], dependencies=[])
        nodes, origins, point_node, source_node, endpoints, buckets, cuts = {}, {}, {}, {}, {}, {}, {}
        mapping, bends = dict(nodes={}, edges={}, hosts={}), 0

        def bucket(p):
            return p.x // radius, p.y // radius

        def place(identity, p, group):
            if identity in nodes:
                old = _pk(decode_point(nodes[identity]["p"]))
                if point_node.get(old) == identity:
                    del point_node[old]
                nodes[identity]["p"] = encode_point(p)
            else:
                nodes[identity] = dict(id=identity, p=encode_point(p))
            origins[identity] = group
            point_node[_pk(p)] = identity
            buckets.setdefault(bucket(p), set()).add(identity)

        def compatible(owner, identity, p):
            group = origins.get(identity, [])
            if not all(_near(s["p"], p, radius) for s in [owner, *group]):
                return False
            membership = {e for s in group for e in s["endpoints"]}
            return all(e[:-1] + ("1" if e.endswith("0") else "0") not in membership for e in owner["endpoints"])

        for owner in owners:
            bx, by = bucket(owner["p"])
            candidates = []
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for identity in sorted(buckets.get((bx+dx, by+dy), ())):
                        p = decode_point(nodes[identity]["p"])
                        if _near(owner["p"], p, radius) and compatible(owner, identity, p):
                            candidates.append((identity, p))
            if optional:
                grid = P(Q(round(owner["p"].x*240), 240), Q(round(owner["p"].y*240), 240))
                identity = point_node.get(_pk(grid))
                if _near(owner["p"], grid, radius) and (identity is None or compatible(owner, identity, grid)):
                    candidates.append((identity, grid))
            identity = point_node.get(_pk(owner["p"]))
            if identity and compatible(owner, identity, owner["p"]):
                candidates.append((identity, owner["p"]))
            candidates = [c for c in candidates if optional or c[1] == owner["p"]]
            candidates.sort(key=lambda c: (squared_distance(owner["p"], c[1]), *_xy(c[1]), c[0] or ""))
            identity, p = candidates[0] if candidates else (None, owner["p"])
            identity = identity or source_node_id(owner["ref"])
            place(identity, p, [*origins.get(identity, []), owner])
            source_node[owner["ref"]] = identity
            for endpoint in owner["endpoints"]:
                endpoints[endpoint] = identity
        for s in sources:
            cuts[_key(s)] = [[Q(0), endpoints[_key(s)+":0"]], [Q(1), endpoints[_key(s)+":1"]]]

        def add_cut(s, t, identity):
            entry = [t, identity]
            if 0 <= t <= 1 and entry not in cuts[_key(s)]:
                cuts[_key(s)].append(entry)

        def cut_point(s, t):
            if not 0 < t < 1:
                return
            ends = cuts[_key(s)]
            p = point_at(decode_point(nodes[ends[0][1]]["p"]), decode_point(nodes[ends[1][1]]["p"]), t)
            identity = point_node.get(_pk(p))
            if identity is None:
                identity = source_node_id(_json(["cut", _key(s), encode_rational(t)]))
                place(identity, p, [])
            add_cut(s, t, identity)

        def interval(s, a, b):
            ta, tb = (project_parameter(p, s["a"], s["b"]) for p in (a, b))
            if not _near(a, point_at(s["a"], s["b"], ta), radius) or not _near(b, point_at(s["a"], s["b"], tb), radius):
                return None
            lo, hi = max(Q(0), min(ta, tb)), min(Q(1), max(ta, tb))
            return (lo, hi) if lo < hi else None

        legacy_cuts = [c["a"] + c["b"] for c in space.get("open_spans", [])] if source_version < 9 else []
        if not legacy_cuts and source_version < 9:
            rooms = space.get("rooms", [])
            for i, first in enumerate(rooms):
                for second in rooms[i+1:]:
                    if second["id"] in first.get("open_to", []) or first["id"] in second.get("open_to", []):
                        legacy_cuts.extend(_shared_boundaries(_poly(first), _poly(second)))
        zero_intervals, opening_intervals = {}, {}
        for s in sources:
            if s["kind"] != "wall":
                continue
            zeros, opening_runs = [], []
            for cut in legacy_cuts:
                span = interval(s, read_source_point(cut[:2]), read_source_point(cut[2:]))
                if span:
                    zeros.append(span)
                    for t in span:
                        cut_point(s, t)
            zero_intervals[_key(s)] = zeros
            for overlay in space.get("walls", []):
                if isinstance(overlay.get("a"), list) and isinstance(overlay.get("b"), list):
                    span = interval(s, read_source_point(overlay["a"]), read_source_point(overlay["b"]))
                    if span:
                        for t in span:
                            cut_point(s, t)
            for opening in space.get("openings", []) if zeros else []:
                if opening.get("host", {}).get("kind") == "partition" or opening.get("length", 0) <= 0:
                    continue
                if not _angle_matches(to_numbers(s["a"]), to_numbers(s["b"]), opening.get("angle", 0)):
                    continue
                centre = read_source_point([opening["x"], opening["y"]])
                t = project_parameter(centre, s["a"], s["b"])
                if not 0 <= t <= 1 or not _near(centre, point_at(s["a"], s["b"], t), radius):
                    continue
                half = parse_decimal(opening["length"]/2) / parse_decimal(math.sqrt(float(squared_distance(s["a"], s["b"]))))
                span = max(Q(0), t-half), min(Q(1), t+half)
                if any(lo <= t <= hi for lo, hi in zeros):
                    opening_runs.append(span)
                    for end in span:
                        cut_point(s, end)
            opening_intervals[_key(s)] = opening_runs

        for owner in owners:
            identity, p0 = source_node[owner["ref"]], owner["p"]
            nearby = tree.query(P(p0.x-radius, p0.y-radius), P(p0.x+radius, p0.y+radius)) if tree else []
            for host in sorted(nearby, key=_key):
                if any(e.startswith(_key(host)+":") for e in owner["endpoints"]):
                    continue
                old_t = project_parameter(p0, host["a"], host["b"])
                if not 0 <= old_t <= 1 or not _near(p0, point_at(host["a"], host["b"], old_t), radius):
                    continue
                if not optional and not (_stored_wall_contact(to_numbers(p0), to_numbers(host["a"]), to_numbers(host["b"])) or 0 < old_t < 1 and squared_distance(p0, point_at(host["a"], host["b"], old_t)) <= Q(1, 5_000_000)**2):
                    continue
                ends = cuts[_key(host)]
                a, b = (decode_point(nodes[e[1]]["p"]) for e in ends[:2])
                t = project_parameter(p0, a, b)
                if not 0 <= t <= 1:
                    continue
                p, group = point_at(a, b, t), origins[identity]
                if not all(_near(o["p"], p, radius) for o in group):
                    p = next((o["p"] for o in group if all(_near(other["p"], o["p"], radius) for other in group)), p0)
                    if not all(_near(o["p"], p, radius) for o in group):
                        continue
                    bends += 1
                opposite = [endpoints.get(e[:-1] + ("1" if e.endswith("0") else "0")) for o in group for e in o["endpoints"]]
                if any(other and other != identity and decode_point(nodes[other]["p"]) == p for other in opposite):
                    continue
                existing = point_node.get(_pk(p))
                if existing and existing != identity:
                    others = origins.get(existing, [])
                    if not all(_near(o["p"], p, radius) for o in [*group, *others]):
                        continue
                    previous = identity
                    for table in (source_node, endpoints):
                        for key, value in list(table.items()):
                            if value == previous:
                                table[key] = existing
                    for entries in cuts.values():
                        for cut in entries:
                            if cut[1] == previous:
                                cut[1] = existing
                    origins[existing] = [*others, *group]
                    del nodes[previous]
                    for key, value in list(point_node.items()):
                        if value == previous:
                            del point_node[key]
                    for identities in buckets.values():
                        identities.discard(previous)
                    identity, group = existing, origins[existing]
                place(identity, p, group)
                add_cut(host, old_t, identity)
                if 0 < old_t < 1 and p == point_at(a, b, t):
                    graph["dependencies"] = [d for d in graph["dependencies"] if d["node"] != identity]
                    start, end = ends[0][1], ends[1][1]
                    if identity not in (start, end):
                        graph["dependencies"].append(dict(node=identity, kind="on-edge", refs=[dict(from_=start, to=end)], parameters=[encode_rational(t)]))
                        graph["dependencies"][-1]["refs"][0]["from"] = graph["dependencies"][-1]["refs"][0].pop("from_")
                break

        position = {_key(s): i for i, s in enumerate(sources)}
        for s in sources:
            lo, hi = P(s["a"].x, min(s["a"].y, s["b"].y)), P(s["b"].x, max(s["a"].y, s["b"].y))
            for other in tree.query(lo, hi) if tree else []:
                if position[_key(other)] <= position[_key(s)]:
                    continue
                hit = intersection(s["a"], s["b"], other["a"], other["b"])
                if hit is None or not 0 <= hit[1] <= 1 or not 0 <= hit[2] <= 1:
                    continue
                left, right = cuts[_key(s)], cuts[_key(other)]
                supports = [left[0][1], left[1][1], right[0][1], right[1][1]]
                current = intersection(*(decode_point(nodes[n]["p"]) for n in supports))
                valid = current and 0 <= current[1] <= 1 and 0 <= current[2] <= 1 and _near(current[0], hit[0], radius)
                p = current[0] if valid else hit[0]
                identity = point_node.get(_pk(p))
                if identity is None:
                    identity = source_node_id(_json(["intersection", _key(s), _key(other)]))
                    place(identity, p, [])
                add_cut(s, hit[1], identity)
                add_cut(other, hit[2], identity)
                if current and p == current[0] and identity not in supports:
                    graph["dependencies"] = [d for d in graph["dependencies"] if d["node"] != identity]
                    graph["dependencies"].append(dict(node=identity, kind="intersection", refs=[{"from": supports[0], "to": supports[1]}, {"from": supports[2], "to": supports[3]}], parameters=[encode_rational(current[1]), encode_rational(current[2])]))
                elif not current or p != current[0]:
                    bends += 1
        for rid, entries in boundaries.items():
            for entry in entries:
                host = source_by_key[entry["source"]]
                for t, ref in ((entry["start"], entry["startRef"]), (entry["end"], entry["endRef"])):
                    p = point_at(host["a"], host["b"], t)
                    identity = source_node.get(ref) or point_node.get(_pk(p))
                    if identity is None:
                        identity = next((n for n, row in nodes.items() if _near(p, decode_point(row["p"]), radius)), None)
                    if identity is None:
                        identity = source_node_id(_json(["room-point", rid, _pk(p)]))
                        place(identity, p, [])
                    add_cut(host, t, identity)
        by_geometry, used_ids = {}, set()
        for s in sources:
            entries = sorted(set((t, n) for t, n in cuts[_key(s)]))
            ranges = []
            for i, (a, b) in enumerate(zip(entries, entries[1:])):
                if a[0] == b[0] or a[1] == b[1] or nodes[a[1]]["p"] == nodes[b[1]]["p"]:
                    continue
                middle, cm = (a[0]+b[0])/2, s["cm"]
                if s["kind"] == "wall" and not (source_version >= 9 and s["id"] in canonical_segments):
                    pa, pb = to_numbers(point_at(s["a"], s["b"], a[0])), to_numbers(point_at(s["a"], s["b"], b[0]))
                    resolved = _legacy_thickness_at(space.get("walls", []), pa, pb)
                    parent_key = _wall_key(to_numbers(s["a"]), to_numbers(s["b"]))
                    values = {w.get("cm", 0) for w in space.get("walls", []) if w.get("key") == parent_key and w.get("cm", 0) > 0}
                    if len(values) > 1:
                        raise GraphError("thickness_conflict")
                    cm = resolved if resolved > 0 else next(iter(values)) if values else cm
                    if s["raw"].get("cm") == 0 and any(w["id"] == s["id"] for w in space.get("wall_segments", [])):
                        cm = 0
                    if any(lo <= middle <= hi for lo, hi in zero_intervals.get(_key(s), [])) and not any(lo <= middle <= hi for lo, hi in opening_intervals.get(_key(s), [])):
                        cm = 0
                gid = (s["kind"], *sorted((a[1], b[1])))
                props = {k: copy.deepcopy(v) for k, v in s["raw"].items() if k not in ("id", "a", "b", "cm")}
                edge = next((e for e in by_geometry.get(gid, []) if all(k not in props or e["props"][k] == props[k] for k in e.get("props", {}))), None)
                if edge is None and s["kind"] == "wall" and by_geometry.get(gid):
                    raise GraphError("props_conflict")
                reverse = False
                if edge:
                    if edge["cm"] != cm:
                        raise GraphError("thickness_conflict")
                    merged_props = {**edge.get("props", {}), **props}
                    if merged_props:
                        edge["props"] = merged_props
                    reverse = edge["from"] != a[1]
                else:
                    preferred = s["id"] if i == 0 else graph_split_id(s["kind"], s["id"], i, encode_rational(a[0]), encode_rational(b[0]))
                    identity, suffix = preferred, 2
                    while (s["kind"], identity) in used_ids:
                        identity = preferred[:64-len(str(suffix))-1] + "-" + str(suffix)
                        suffix += 1
                    used_ids.add((s["kind"], identity))
                    edge = {"id": identity, "kind": s["kind"], "from": a[1], "to": b[1], "cm": cm}
                    if props:
                        edge["props"] = props
                    by_geometry.setdefault(gid, []).append(edge)
                    graph["edges"].append(edge)
                ranges.append(dict(ref=_ref(edge), sourceInterval=[encode_rational(a[0]), encode_rational(b[0])], reverse=reverse))
            mapping["edges"][_key(s)] = ranges
        for rid, entries in boundaries.items():
            edges = []
            for entry in entries:
                forward = entry["start"] < entry["end"]
                lo, hi = sorted((entry["start"], entry["end"]))
                ranges = [r for r in mapping["edges"][entry["source"]] if decode_rational(r["sourceInterval"][0]) >= lo and decode_rational(r["sourceInterval"][1]) <= hi]
                for r in ranges if forward else reversed(ranges):
                    edges.append({**r["ref"], "reverse": r["reverse"] if forward else not r["reverse"]})
            graph["rooms"].append(dict(room=rid, edges=[e for i, e in enumerate(edges) if i == 0 or _key(e) != _key(edges[i-1])]))
        retained = {e[side] for e in graph["edges"] for side in ("from", "to")}
        graph["nodes"] = [nodes[n] for n in sorted(retained)]
        graph["edges"].sort(key=lambda e: (e["kind"], e["id"]))
        graph["rooms"].sort(key=lambda r: r["room"])
        graph["dependencies"] = sorted((d for d in graph["dependencies"] if d["node"] in retained and all(r[side] in retained for r in d["refs"] for side in ("from", "to"))), key=lambda d: d["node"])
        validate_graph(graph, {"room_ids": [r["id"] for r in space.get("rooms", [])]})
        base = copy.deepcopy(space)
        graph_edges = {_key(e): e for e in graph["edges"]}
        for opening in base.get("openings", []):
            host = opening.get("host")
            if not host or _key(host) not in source_by_key:
                p = read_source_point([opening["x"], opening["y"]])
                eligible = []
                for s in sources:
                    if s["kind"] != "wall" or not _angle_matches(to_numbers(s["a"]), to_numbers(s["b"]), opening.get("angle", 0)):
                        continue
                    t = project_parameter(p, s["a"], s["b"])
                    if 0 <= t <= 1 and _near(p, point_at(s["a"], s["b"], t), radius):
                        eligible.append((s, t))
                eligible.sort(key=lambda row: (squared_distance(p, point_at(row[0]["a"], row[0]["b"], row[1])), -row[0]["cm"], row[0]["id"]))
                selected = next(((s, t) for s, t in eligible if any(decode_rational(r["sourceInterval"][0]) <= t <= decode_rational(r["sourceInterval"][1]) and graph_edges[_key(r["ref"])]["cm"] > 0 for r in mapping["edges"][_key(s)])), None)
                if selected:
                    s, t = selected
                    raw_t = 1-t if s["reversed"] else t
                    opening["host"] = {**_ref(s), "tq": encode_rational(raw_t), "t": float(raw_t)}
                else:
                    opening.pop("host", None)
            if "host" not in opening:
                continue
            host = opening["host"]
            s = source_by_key[_key(host)]
            t = decode_rational(host["tq"]) if "tq" in host else parse_decimal(host["t"])
            if s["reversed"]:
                t = 1-t
            span = next((r for r in mapping["edges"][_key(s)] if decode_rational(r["sourceInterval"][0]) <= t <= decode_rational(r["sourceInterval"][1])), None)
            if span is None:
                raise GraphError("host_range")
            lo, hi = map(decode_rational, span["sourceInterval"])
            next_t = (t-lo)/(hi-lo)
            if span["reverse"]:
                next_t = 1-next_t
            opening["host"] = {**host, **span["ref"], "tq": encode_rational(next_t), "t": float(next_t)}
            mapping["hosts"][opening["id"]] = copy.deepcopy(opening["host"])
        mapping["nodes"] = {ref: [identity] for ref, identity in source_node.items() if identity in retained}
        projected = project_graph_space(base, graph)
        moved, joined, max_distance = 0, 0, 0.0
        for identity, group in origins.items():
            if identity not in retained:
                continue
            joined += max(0, len(group)-1)
            p = decode_point(nodes[identity]["p"])
            for owner in group:
                if not _near(owner["p"], p, radius):
                    raise GraphError("source_displacement")
                moved += owner["p"] != p
                max_distance = max(max_distance, math.sqrt(float(squared_distance(owner["p"], p))))
        return dict(graph=graph, space=projected["space"], bindings=projected["bindings"], changed=True, mapping=mapping,
                    touched=dict(nodes=[n["id"] for n in graph["nodes"]], edges=[_ref(e) for e in graph["edges"]], rooms=[r["room"] for r in graph["rooms"]], hosts=list(mapping["hosts"])), diagnostics=[],
                    migrationReport=dict(moved=moved, joined=joined, maxDisplacementCm=max_distance*240*cell, bends=bends))

    try:
        return run(True)
    except GraphError as error:
        if str(error) in {"zero_length_edge", "room_self_intersection", "zero_area_room", "third_wall_owner", "open_room_cycle", "dependency_value_mismatch", "dependency_cycle"}:
            return run(False)
        raise
