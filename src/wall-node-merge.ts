/** One named Select contraction. No coordinate-based graph reconstruction or writer. */
import { applyGraphOperation, edgeKey, graphIndex, prepareGraph, projectGraphSpace,
  type GraphEdge, type PlanGraph } from './plan-graph';
import * as Q from './plan-exact';
import { openingAxisRotation, transportOpeningOrientations } from './opening-orientation';
import { NodeMoveDependencies } from './wall-node-dependencies';
import { applyNodeDelete } from './wall-node-delete';
import { graphSeamCrossedByOpening } from './graph-seam-opening';
import { compareCodePoints } from './codepoint-order';
import { jsonValueEqual } from './json-value-equal';
import { canonicalizeNumber } from './coordinate-canonicalization';
import type { NodeMovePlan, NodeMoveResult, NodeMoveSpace, NodePoint, WallNode } from './wall-node-move';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cross = (a: readonly number[], b: readonly number[]) => a[0] * b[1] - a[1] * b[0];
const delta = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1];
const EPS = 1e-9;
type MergeReason = 'merge_target' | 'merge_topology' | 'merge_dependency' | 'merge_opening';
class MergeError extends Error { constructor(readonly reason: MergeReason) { super(reason); } }
function refuse(reason: MergeReason): never { throw new MergeError(reason); }

/** Cheap admission only. Physical safety still belongs to release and the server. */
export function nodeMergeAxisAllowed(plan: NodeMovePlan, target: WallNode, axis: string | null): boolean {
  const n = plan.node;
  if (!n.passing) return true;
  const carrier = n.axes.find(a => a.passing && a.key === axis);
  if (!carrier) return false;
  const d = delta(target.point, n.point);
  if (Math.abs(cross(d, carrier.direction)) > EPS) return false;
  const positions = carrier.walls.flatMap(w => [w.a, w.b]).filter(p => distance(p, n.point) > EPS)
    .map(p => dot(delta(p, n.point), carrier.direction));
  const wanted = dot(d, carrier.direction);
  const lo = Math.max(...positions.filter(v => v < -EPS)), hi = Math.min(...positions.filter(v => v > EPS));
  if (wanted < lo - EPS || wanted > hi + EPS) return false;
  return !plan.nodes.some(other => other.key !== n.key && other.key !== target.key
    && Math.abs(cross(delta(other.point, n.point), carrier.direction)) <= EPS
    && dot(delta(other.point, n.point), carrier.direction) * wanted > 0
    && Math.abs(dot(delta(other.point, n.point), carrier.direction)) < Math.abs(wanted) - EPS);
}

export function pickNodeMergeTarget(plan: NodeMovePlan, raw: NodePoint, units: number,
  axis: string | null, down: NodePoint): WallNode | null {
  if (!(units > 0) || distance(raw, down) <= 3 * units) return null;
  return plan.nodes.filter(n => n.nodeId && n.nodeId !== plan.node.nodeId && n.walls.length
    && distance(raw, n.point) <= 12 * units && distance(raw, n.point) < distance(raw, plan.node.point)
    && nodeMergeAxisAllowed(plan, n, axis))
    .sort((a, b) => distance(raw, a.point) - distance(raw, b.point) || compareCodePoints(a.key, b.key))[0] || null;
}

const on = (p: Q.ExactPoint, a: Q.ExactPoint, b: Q.ExactPoint): boolean => {
  if (Q.pointEq(a, b)) return Q.pointEq(p, a);
  const t = Q.projectParameter(p, a, b);
  return !Q.orientation(a, b, p).n && Q.cmp(t, Q.ZERO) >= 0 && Q.cmp(t, Q.ONE) <= 0;
};
const touches = (a: Q.ExactPoint, b: Q.ExactPoint, c: Q.ExactPoint, d: Q.ExactPoint): Q.ExactPoint[] => {
  const hit = Q.intersection(a, b, c, d);
  if (hit && Q.cmp(hit.t, Q.ZERO) >= 0 && Q.cmp(hit.t, Q.ONE) <= 0
      && Q.cmp(hit.u, Q.ZERO) >= 0 && Q.cmp(hit.u, Q.ONE) <= 0) return [hit.p];
  return [a, b, c, d].filter(p => on(p, a, b) && on(p, c, d));
};

function verifyContacts(before: PlanGraph, graph: PlanGraph, source: string, target: string): void {
  const old = graphIndex(before), next = graphIndex(graph);
  const sourceEdges = new Set((old.incident.get(source) || []).map(edgeKey));
  const targetEdges = new Set((old.incident.get(target) || []).map(edgeKey));
  const seen = new Set<string>();
  for (const a of graph.edges.filter(e => sourceEdges.has(edgeKey(e)))) for (const b of graph.edges) {
    if (a === b) continue;
    const pair = [edgeKey(a), edgeKey(b)].sort(compareCodePoints).join('|');
    if (seen.has(pair)) continue; seen.add(pair);
    const pa = next.points.get(a.from)!, pb = next.points.get(a.to)!;
    const pc = next.points.get(b.from)!, pd = next.points.get(b.to)!;
    if ((a.from === b.from && a.to === b.to) || (a.from === b.to && a.to === b.from)) refuse('merge_topology');
    const hits = touches(pa, pb, pc, pd);
    if (!hits.length) continue;
    // A positive-length overlap is never permission to deduplicate material.
    if (!Q.orientation(pa, pb, pc).n && !Q.orientation(pa, pb, pd).n
        && hits.some(p => hits.some(q => !Q.pointEq(p, q)))) refuse('merge_topology');
    const oldA = old.edges.get(edgeKey(a))!, oldB = old.edges.get(edgeKey(b))!;
    const previous = touches(old.points.get(oldA.from)!, old.points.get(oldA.to)!,
      old.points.get(oldB.from)!, old.points.get(oldB.to)!);
    for (const p of hits) {
      const named = Q.pointEq(p, next.points.get(target)!) && [a.from, a.to].includes(target)
        && [b.from, b.to].includes(target)
        && (sourceEdges.has(edgeKey(b)) || targetEdges.has(edgeKey(b)));
      if (!named && !previous.some(q => Q.pointEq(q, p))) refuse('merge_topology');
    }
  }
}

/** Contract the explicit pair, preserving other exact points and host lineage. */
export function applyNodeMerge(plan: NodeMovePlan, targetId: string, axis: string | null): NodeMoveResult {
  try {
    const sourceId = plan.node.nodeId, before = plan.graph || plan.source.plan_graph;
    const target = plan.nodes.find(n => n.nodeId === targetId);
    if (!before || !sourceId || sourceId === targetId || !target?.walls.length || !plan.node.supported
        || !nodeMergeAxisAllowed(plan, target, axis)) refuse('merge_target');
    const old = prepareGraph(before).index, targetPoint = old.points.get(targetId)!;
    if (plan.node.passing) {
      const carrier = plan.node.axes.find(a => a.key === axis)!;
      const edge = old.edges.get(edgeKey(carrier.walls[0]))!;
      if (Q.orientation(old.points.get(edge.from)!, old.points.get(edge.to)!, targetPoint).n) refuse('merge_target');
      const origin = old.points.get(sourceId)!;
      for (const [id, point] of old.points) {
        if (id === sourceId || id === targetId || !old.incident.get(id)?.length || Q.orientation(origin, targetPoint, point).n) continue;
        const t = Q.projectParameter(point, origin, targetPoint);
        if (Q.cmp(t, Q.ZERO) > 0 && Q.cmp(t, Q.ONE) < 0) refuse('merge_target');
      }
    }
    const removed = new Set(before.edges.filter(e => [e.from, e.to].includes(sourceId)
      && [e.from, e.to].includes(targetId)).map(edgeKey));
    const base = clone(plan.source), graph = clone(before);
    const openingRotations = new Map<string, number>();
    for (const opening of base.openings || []) if (opening.host && removed.has(edgeKey(opening.host))) refuse('merge_opening');
    // Preserve the original carrier's swept opening guard even if its atom disappears.
    if (plan.node.passing) {
      const carrier = plan.node.axes.find(a => a.key === axis)!;
      const wanted = dot(delta(target.point, plan.node.point), carrier.direction);
      for (const opening of base.openings || []) {
        const wall = opening.host && carrier.walls.find(w => edgeKey(w) === edgeKey(opening.host!));
        if (!wall) continue;
        const center = dot(delta([opening.x, opening.y], plan.node.point), carrier.direction);
        const margin = opening.length / 2 + wall.cm / (Number(base.cell_cm) || 5) / 480;
        if (center + margin >= Math.min(0, wanted) - EPS && center - margin <= Math.max(0, wanted) + EPS) refuse('merge_opening');
      }
    }
    graph.edges = graph.edges.filter(e => !removed.has(edgeKey(e))).map(e => ({ ...e,
      from: e.from === sourceId ? targetId : e.from, to: e.to === sourceId ? targetId : e.to }));
    graph.nodes = graph.nodes.filter(n => n.id !== sourceId);
    for (const room of graph.rooms) room.edges = room.edges.filter(e => !removed.has(edgeKey(e)));
    verifyContacts(before, graph, sourceId, targetId);
    // Rewritten edges already omit source, but the old constraints still name
    // it. Carrier reachability needs only this topology; do not let the helper
    // constructor inspect stale supports before we explicitly rewrite them.
    const next = graphIndex(graph), carriers = new NodeMoveDependencies({ ...graph, dependencies: [] }, next, targetId);
    const previousCarrier = new NodeMoveDependencies(before, old, sourceId);
    graph.dependencies = before.dependencies.filter(d => d.node !== sourceId).flatMap(d => {
      const affected = d.refs.some(r => r.from === sourceId || r.to === sourceId || previousCarrier.hasCarrier(r, sourceId));
      if (!affected) return [clone(d)];
      const rewritten = d.refs.map(r => ({ from: r.from === sourceId ? targetId : r.from, to: r.to === sourceId ? targetId : r.to }));
      const refs = rewritten.filter(r => r.from !== r.to && r.from !== d.node && r.to !== d.node && carriers.hasCarrier(r, d.node));
      if (!refs.length || d.node !== targetId && refs.length !== rewritten.length) return [];
      const p = next.points.get(d.node)!;
      return [{ ...clone(d), kind: refs.length === 1 ? 'on-edge' : d.kind, refs, parameters: refs.map(r => Q.encodeRational(Q.projectParameter(p,
        next.points.get(r.from)!, next.points.get(r.to)!))) }];
    });
    for (const opening of base.openings || []) {
      const host = opening.host;
      if (!host) continue;
      const edge = old.edges.get(edgeKey(host));
      if (!edge || ![edge.from, edge.to].includes(sourceId) || removed.has(edgeKey(edge))) continue;
      const a = old.points.get(edge.from)!, b = old.points.get(edge.to)!;
      const na = edge.from === sourceId ? targetPoint : a, nb = edge.to === sourceId ? targetPoint : b;
      if (Q.pointEq(na, nb)) refuse('merge_topology');
      const t = host.tq ? Q.decodeRational(host.tq) : Q.parseDecimal(host.t), center = Q.pointAt(a, b, t);
      let nt = Q.projectParameter(center, na, nb);
      if (!Q.pointEq(Q.pointAt(na, nb, nt), center)) {
        const oldLength = distance(Q.pointToNumbers(a), Q.pointToNumbers(b)), span = distance(Q.pointToNumbers(na), Q.pointToNumbers(nb));
        const value = edge.from === sourceId ? 1 - (1 - Q.toNumber(t)) * oldLength / span : Q.toNumber(t) * oldLength / span;
        nt = Q.parseDecimal(value);
      }
      const span = distance(Q.pointToNumbers(na), Q.pointToNumbers(nb)), along = Q.toNumber(nt) * span;
      const jamb = edge.cm / (Number(base.cell_cm) || 5) / 480;
      if (along - opening.length / 2 < jamb - EPS || along + opening.length / 2 > span - jamb + EPS) refuse('merge_opening');
      opening.host = { ...host, tq: Q.encodeRational(nt), t: Q.toNumber(nt) };
      opening.angle = canonicalizeNumber(Q.projectedAxisAngle(na, nb)) as number;
      openingRotations.set(opening.id, openingAxisRotation(Q.pointToNumbers(a), Q.pointToNumbers(b), Q.pointToNumbers(na), Q.pointToNumbers(nb)));
    }
    let result;
    try { result = applyGraphOperation(before, { kind: 'restore-graph', graph }, { hosts: base.openings || [] }); }
    catch (error) { refuse(String((error as Error).message).includes('dependency') ? 'merge_dependency' : 'merge_topology'); }
    let space = projectGraphSpace(base, result!.graph).space as NodeMoveSpace;
    const index = graphIndex(result!.graph), incident = index.incident.get(targetId) || [];
    if (!incident.length && !result!.graph.dependencies.some(d => d.node === targetId || d.refs.some(r => r.from === targetId || r.to === targetId))) {
      const clean = clone(result!.graph); clean.nodes = clean.nodes.filter(n => n.id !== targetId);
      space = projectGraphSpace(space, clean).space;
    } else if (incident.length === 2) {
      const [a, b] = incident, p = index.points.get(targetId)!;
      const left = index.points.get(a.from === targetId ? a.to : a.from)!, right = index.points.get(b.from === targetId ? b.to : b.from)!;
      const owners = (e: GraphEdge) => (index.owners.get(edgeKey(e)) || []).slice().sort(compareCodePoints);
      const keep = a.kind === b.kind && a.cm === b.cm && jsonValueEqual(a.props || null, b.props || null)
        && jsonValueEqual(owners(a), owners(b)) && !Q.pointEq(left, right) && !Q.orientation(left, p, right).n
        && Q.cmp(Q.projectParameter(p, left, right), Q.ZERO) > 0 && Q.cmp(Q.projectParameter(p, left, right), Q.ONE) < 0
        && !result!.graph.dependencies.some(d => d.node !== targetId && d.refs.some(r => r.from === targetId || r.to === targetId))
        && !graphSeamCrossedByOpening(targetId, [a, b], index, space.openings || [])
        && !result!.graph.edges.some(e => e !== a && e !== b && on(p, index.points.get(e.from)!, index.points.get(e.to)!));
      if (keep) {
        const compact = applyNodeDelete(space, { node_id: targetId, point: target.point });
        if (!compact.ok) refuse(compact.reason === 'opening' ? 'merge_opening' : 'merge_topology');
        space = compact.space;
      }
    }
    return { ok: true, space: transportOpeningOrientations(plan.source, space, openingRotations), changed: true, affected: [...new Set([...(old.incident.get(sourceId) || []),
      ...(old.incident.get(targetId) || [])].map(edgeKey))] };
  } catch (error) {
    return { ok: false, reason: error instanceof MergeError ? error.reason : 'merge_topology' };
  }
}
