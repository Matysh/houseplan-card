import type { GraphEdge, PlanGraph } from './plan-graph';
import * as Q from './plan-exact';
import { jsonValueEqual } from './json-value-equal';

const metadata = ({ id: _id, kind: _kind, from: _from, to: _to, ...rest }: GraphEdge) => rest;

/** Exact material subtraction, allowing only the editor's lossless straight
 * seam compaction. No epsilon, new endpoint, gap, extension or new material.
 * Each candidate edge retains an old ID and consumes its old chain once.
 * Node deletion which only joins a chord removes no material and fails here.
 */
export function graphOnlyRemovesWallMaterial(before: PlanGraph, after: PlanGraph): boolean {
  if (after.edges.length >= before.edges.length) return false;
  try {
    const nodes = new Map(before.nodes.map(node => [node.id, node.p]));
    const nextNodes = new Map(after.nodes.map(node => [node.id, node.p]));
    const incident = new Map<string, GraphEdge[]>();
    for (const edge of before.edges) for (const node of [edge.from, edge.to]) {
      const list = incident.get(node) || []; list.push(edge); incident.set(node, list);
    }
    const used = new Set<GraphEdge>();
    const points = new Map<string, Q.ExactPoint>();
    const point = (id: string) => {
      let value = points.get(id);
      if (!value) { value = Q.decodePoint(nodes.get(id)); points.set(id, value); }
      return value;
    };
    for (const edge of after.edges) {
      if (!nodes.has(edge.from) || !nodes.has(edge.to)
        || !jsonValueEqual(nodes.get(edge.from), nextNodes.get(edge.from))
        || !jsonValueEqual(nodes.get(edge.to), nextNodes.get(edge.to))) return false;
      const start = point(edge.from), end = point(edge.to), props = metadata(edge);
      if (Q.pointEq(start, end)) return false;
      let cursor = edge.from, position = Q.ZERO, retained = false;
      const path: GraphEdge[] = [];
      while (cursor !== edge.to) {
        const options: { edge: GraphEdge; node: string; t: Q.Exact }[] = [];
        for (const old of incident.get(cursor) || []) {
          if (used.has(old) || !jsonValueEqual(metadata(old), props)) continue;
          const node = old.from === cursor ? old.to : old.from, p = point(node);
          if (Q.orientation(start, p, end).n) continue;
          const t = Q.projectParameter(p, start, end);
          if (Q.cmp(t, position) > 0 && Q.cmp(t, Q.ONE) <= 0) options.push({ edge: old, node, t });
        }
        if (options.length !== 1) return false; // no gap or ambiguous overlap
        const next = options[0];
        if (next.node !== edge.to && nextNodes.has(next.node)) return false;
        used.add(next.edge); path.push(next.edge);
        retained ||= next.edge.id === edge.id;
        cursor = next.node; position = next.t;
      }
      if (!retained || !path.length) return false;
    }
    return used.size < before.edges.length;
  } catch { return false; }
}
