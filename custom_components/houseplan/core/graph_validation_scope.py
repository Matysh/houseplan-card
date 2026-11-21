"""Successful graph proofs live for one synchronous writer command only.

Keys contain the exact JSON value and validation context, not a caller's
identity/validated flag. A cache hit binds fresh records to immutable proven
points/adjacency, so neither input mutations nor a mutated returned index can
poison a later call. No cache survives the executor invocation.
"""
from __future__ import annotations

import json as json
from contextlib import contextmanager as contextmanager
from contextvars import ContextVar as ContextVar
from dataclasses import dataclass as dataclass

_active: ContextVar[GraphValidationScope | None] = ContextVar("graph_validation_scope", default=None)


def _json_key(value):
    # JSON encoding alone conflates tuples/lists and non-string object keys.
    # Unsupported Python inputs fall back to the real validator, never a hit.
    pending, seen = [value], set()
    while pending:
        item = pending.pop()
        kind = type(item)
        if kind in (dict, list):
            if id(item) in seen:
                continue
            seen.add(id(item))
            if kind is dict:
                if any(type(key) is not str for key in item):
                    return None
                pending.extend(item.values())
            else:
                pending.extend(item)
        elif kind not in (str, int, float, bool, type(None)):
            return None
    try:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)
    except (ValueError, TypeError, RecursionError):
        return None


@dataclass(frozen=True)
class _GraphProof:
    factory: type
    points: tuple
    incident: tuple
    order: tuple

    @classmethod
    def capture(cls, index):
        return cls(type(index), tuple(index.points.items()),
                   tuple((node, tuple(edges)) for node, edges in index.incident.items()),
                   tuple(index.dependency_order))

    def bind(self, graph):
        return self.factory({n["id"]: n for n in graph["nodes"]}, dict(self.points),
                            {(e["kind"], e["id"]): e for e in graph["edges"]},
                            {r["room"]: r["edges"] for r in graph["rooms"]},
                            {n: list(edges) for n, edges in self.incident},
                            {d["node"]: d for d in graph["dependencies"]}, list(self.order))


class GraphValidationScope:
    def __init__(self):
        self.graphs = {}
        self.projections = {}

    def validate(self, graph, context, compute):
        from .plan_graph import MAX_EDGES, MAX_NODES
        # Keep malformed/resource-limit refusals cheap, before serializing a
        # cache key. Valid facts are bounded by this one command's wire input;
        # evicting by floor count would replay all proofs on a large cold home.
        if type(graph) is not dict or any(type(graph.get(field)) is not list or len(graph[field]) > maximum
                for field, maximum in (("nodes",MAX_NODES),("edges",MAX_EDGES),("rooms",400),("dependencies",MAX_NODES))):
            return compute(graph, context)
        context = context or {}
        allowed = context.get("room_ids")
        compatible = not context.keys() - {"room_ids"} and (allowed is None or
            isinstance(allowed, (list, tuple, set, frozenset)) and all(type(r) is str for r in allowed))
        key = _json_key(graph) if compatible else None
        if key is None:
            return compute(graph, context)
        proof = self.graphs.get(key)
        if proof is not None:
            # room_ids adds only membership to the same intrinsic graph
            # proof. Judge that restriction on EVERY call; a broader earlier
            # context cannot authorize an owner missing from this one.
            if allowed is not None and any(room["room"] not in allowed for room in graph["rooms"]):
                from .plan_graph_exact import GraphError
                raise GraphError("invalid_room_owner")
            return proof.bind(graph)
        index = compute(graph, context)
        self.graphs[key] = _GraphProof.capture(index)
        return index

    def projection_key(self, space, graph):
        # The complete space also distinguishes metadata, cell scale, absent
        # fields and host inputs. Conservative misses are safe.
        return _json_key([space, graph])

    def proved_projection(self, key):
        return key is not None and key in self.projections

    def remember_projection(self, key):
        if key is not None:
            self.projections[key] = True


def current_graph_validation_scope():
    return _active.get()


@contextmanager
def graph_validation_scope():
    scope = GraphValidationScope()
    token = _active.set(scope)
    try:
        yield scope
    finally:
        _active.reset(token)
        scope.graphs.clear()
        scope.projections.clear()
