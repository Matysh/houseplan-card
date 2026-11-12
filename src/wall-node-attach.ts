/** Select's named dangling-end attach. Generic Move retains its old admission. */
import { applyGraphOperation, edgeKey, graphIndex, projectGraphSpace, type PlanGraph, type GraphEdge, type GraphOperation } from './plan-graph';
import * as Q from './plan-exact';
import { openingAxisRotation, transportOpeningOrientations } from './opening-orientation';
import { NodeMoveDependencies } from './wall-node-dependencies';
import { graphDrawTargetRef } from './graph-draw-binding';
import { quantizedPoint, type PlanSnapSegment } from './plan-snap-overlay';
import { GRID_STEP_N } from './canvas-constants';
import { canonicalizeNumber } from './coordinate-canonicalization';
import { compareCodePoints } from './codepoint-order';
import { jsonValueEqual } from './json-value-equal';
import type { NodeAttachEdge, NodeMovePlan, NodeMoveResult, NodePoint } from './wall-node-move';

const EPS = 1e-9;
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const inside = (t: Q.Exact) => Q.cmp(t, Q.ZERO) > 0 && Q.cmp(t, Q.ONE) < 0;
export const nodeAttachId = /^node-attach-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export interface NodeAttachTarget { edge: NodeAttachEdge; point: NodePoint; p: Q.GraphPoint; a: NodePoint; b: NodePoint }
export type NodeAttachPick = { kind: 'target'; target: NodeAttachTarget } | { kind: 'ambiguous' } | null;
interface Host { graph: PlanGraph; segment: PlanSnapSegment; edge: GraphEdge; carrier: string }

/** Freeze graph identities/index once; held frames only quantize eligible finite lines. */
export function prepareNodeAttach(plan: NodeMovePlan, newEdgeId: string): { pick(raw: NodePoint, units: number, down: NodePoint): NodeAttachPick } {
  const graph = plan.graph || plan.source.plan_graph, source = plan.node.nodeId;
  const hosts: Host[] = [];
  const sourcePoint = graph?.nodes.find(n => n.id === source)?.p;
  if (graph && source && nodeAttachId.test(newEdgeId) && plan.node.supported && !plan.node.passing && plan.node.branches === 1) {
    const index = graphIndex(graph), incident = index.incident.get(source) || [];
    if (incident.length === 1) {
      const arm = incident[0], far = arm.from === source ? arm.to : arm.from;
      for (const edge of graph.edges) {
        if ([edge.from, edge.to].some(id => id === source || id === far)) continue;
        const a = index.points.get(edge.from)!, b = index.points.get(edge.to)!;
        if (!Q.orientation(a, b, index.points.get(far)!).n) continue; // would overlap a child
        const segment: PlanSnapSegment = { a: Q.pointToNumbers(a).map(v => v * 1000) as NodePoint,
          b: Q.pointToNumbers(b).map(v => v * 1000) as NodePoint, key: edgeKey(edge),
          sourceKind: edge.kind === 'wall' ? 'room' : 'partition', sourceId: edge.id,
          graphEdge: { kind: edge.kind, id: edge.id } };
        hosts.push({ edge, segment, carrier: edgeKey(edge), graph: { version: 1,
          nodes: [index.nodes.get(edge.from)!, index.nodes.get(edge.to)!], edges: [edge], rooms: [], dependencies: [] } });
      }
      // Only identity-connected collinear atoms of the same material are one carrier.
      // Coincident independent/material-distinct hosts remain ambiguous.
      const parent = hosts.map((_, i) => i);
      const root = (i: number): number => parent[i] === i ? i : parent[i] = root(parent[i]);
      const atNode = new Map<string, number[]>();
      hosts.forEach((h, i) => { for (const n of [h.edge.from, h.edge.to]) { const list = atNode.get(n) || []; list.push(i); atNode.set(n, list); } });
      for (const list of atNode.values()) for (const i of list) for (const j of list) if (i < j) {
        const a = hosts[i].edge, b = hosts[j].edge;
        if (a.kind !== b.kind || a.cm !== b.cm || !jsonValueEqual(a.props || null, b.props || null)) continue;
        if (!Q.orientation(index.points.get(a.from)!, index.points.get(a.to)!, index.points.get(b.from)!).n
          && !Q.orientation(index.points.get(a.from)!, index.points.get(a.to)!, index.points.get(b.to)!).n) parent[root(j)] = root(i);
      }
      hosts.forEach((h, i) => h.carrier = hosts[root(i)].carrier);
    }
  }
  return { pick(raw, units, down) {
    if (!(units > 0) || distance(raw, down) <= 3 * units) return null;
    const candidates: { host: Host; target: NodeAttachTarget; distance: number }[] = [];
    for (const host of hosts) {
      // Final exact targets remain on this finite axis. Reject remote boxes
      // numerically before paying for a Draw exact projection; no full graph
      // lookup or split/proof occurs on a held frame.
      const x = raw[0] * 1000, y = raw[1] * 1000, radius = 12 * units * 1000;
      if (x < Math.min(host.segment.a[0], host.segment.b[0]) - radius
        || x > Math.max(host.segment.a[0], host.segment.b[0]) + radius
        || y < Math.min(host.segment.a[1], host.segment.b[1]) - radius
        || y > Math.max(host.segment.a[1], host.segment.b[1]) + radius) continue;
      const point = quantizedPoint(host.segment, raw.map(v => v * 1000), GRID_STEP_N * 1000);
      const ref = graphDrawTargetRef(host.graph, { kind: 'line', point, key: host.segment.key, distance: 0, segment: host.segment }, newEdgeId);
      if (ref?.kind !== 'on-edge') continue;
      const a = Q.decodePoint(host.graph.nodes[0].p), b = Q.decodePoint(host.graph.nodes[1].p);
      const exact = Q.pointAt(a, b, Q.decodeRational(ref.t)), p = Q.encodePoint(exact), final = Q.pointToNumbers(exact);
      if (Q.pointEq(exact, Q.decodePoint(sourcePoint!))) continue;
      const d = distance(raw, final);
      if (d <= 12 * units) candidates.push({ host, distance: d, target: { point: final, p,
        edge: { ...ref.edge, tq: ref.t, new_edge_id: newEdgeId }, a: Q.pointToNumbers(a), b: Q.pointToNumbers(b) } });
    }
    candidates.sort((a, b) => a.distance - b.distance || compareCodePoints(a.host.segment.key, b.host.segment.key));
    if (!candidates.length) return null;
    if (candidates.slice(1).some(c => c.host.carrier !== candidates[0].host.carrier && c.distance - candidates[0].distance <= units)) return { kind: 'ambiguous' };
    return { kind: 'target', target: candidates[0].target };
  } };
}

const on = (p: Q.ExactPoint, a: Q.ExactPoint, b: Q.ExactPoint): boolean => Q.pointEq(a, b) ? Q.pointEq(p, a)
  : !Q.orientation(a, b, p).n && Q.cmp(Q.projectParameter(p, a, b), Q.ZERO) >= 0 && Q.cmp(Q.projectParameter(p, a, b), Q.ONE) <= 0;
function touches(a: Q.ExactPoint, b: Q.ExactPoint, c: Q.ExactPoint, d: Q.ExactPoint): Q.ExactPoint[] {
  const hit = Q.intersection(a, b, c, d);
  if (hit && Q.cmp(hit.t, Q.ZERO) >= 0 && Q.cmp(hit.t, Q.ONE) <= 0 && Q.cmp(hit.u, Q.ZERO) >= 0 && Q.cmp(hit.u, Q.ONE) <= 0) return [hit.p];
  return [a, b, c, d].filter(p => on(p, a, b) && on(p, c, d));
}
function verifyContacts(before: PlanGraph, after: PlanGraph, source: string, host: GraphEdge, newId: string): void {
  const old = graphIndex(before), next = graphIndex(after), arm = old.incident.get(source)![0];
  const changed = next.edges.get(edgeKey(arm))!;
  for (const b of after.edges) {
    if (edgeKey(b) === edgeKey(arm)) continue;
    const pa = next.points.get(changed.from)!, pb = next.points.get(changed.to)!, pc = next.points.get(b.from)!, pd = next.points.get(b.to)!;
    const hits = touches(pa, pb, pc, pd);
    if (!hits.length) continue;
    if (!Q.orientation(pa, pb, pc).n && !Q.orientation(pa, pb, pd).n && hits.some(p => hits.some(q => !Q.pointEq(p, q)))) throw Error('contact');
    const receiver = b.kind === host.kind && (b.id === host.id || b.id === newId);
    const previous = old.edges.get(receiver ? edgeKey(host) : edgeKey(b))!;
    const oldHits = touches(old.points.get(arm.from)!, old.points.get(arm.to)!, old.points.get(previous.from)!, old.points.get(previous.to)!);
    for (const p of hits) if (!(receiver && Q.pointEq(p, next.points.get(source)!) && [b.from, b.to].includes(source))
      && !oldHits.some(q => Q.pointEq(q, p))) throw Error('contact');
  }
}

/** One release producer; every foreign exact point is a fixed end. */
export function applyNodeAttach(plan: NodeMovePlan, attach: NodeAttachEdge): NodeMoveResult {
  let reason: 'merge_target' | 'merge_topology' | 'merge_dependency' | 'merge_opening' = 'merge_target';
  try {
    const graph = plan.graph || plan.source.plan_graph, source = plan.node.nodeId;
    if (!graph || !source || !plan.node.supported || plan.node.passing || plan.node.branches !== 1
      || !nodeAttachId.test(attach.new_edge_id)) throw Error('source');
    const index = graphIndex(graph), incident = index.incident.get(source)!;
    const host = index.edges.get(edgeKey(attach)), t = Q.decodeRational(attach.tq);
    if (incident.length !== 1 || !host || !inside(t) || graph.edges.some(e => e.id === attach.new_edge_id)) throw Error('target');
    const arm = incident[0], far = arm.from === source ? arm.to : arm.from;
    if ([host.from, host.to].some(id => id === source || id === far)) throw Error('target');
    const a = index.points.get(host.from)!, b = index.points.get(host.to)!, target = Q.pointAt(a, b, t);
    if (Q.pointEq(target, index.points.get(source)!) || !Q.orientation(a, b, index.points.get(far)!).n) throw Error('target');
    const base = clone(plan.source), span = distance(Q.pointToNumbers(a), Q.pointToNumbers(b)), split = Q.toNumber(t) * span;
    const openingRotations = new Map<string, number>();
    // The global length guard measures a whole collinear run. This named
    // split additionally requires each newly created child to be a valid
    // 20cm/material-length atom; the global Move/Draw rules are unchanged.
    const minChild = Math.max(20, host.cm) / ((Number(base.cell_cm) || 5) * 240);
    if (split < minChild - EPS || span - split < minChild - EPS) { reason = 'merge_topology'; throw Error('short child'); }
    const operations: GraphOperation[] = new NodeMoveDependencies(graph, index, source).operations(target);
    operations.push({ kind: 'move-node', node: source, target: Q.encodePoint(target), detachDependency: true });
    for (const opening of base.openings || []) {
      const ref = opening.host;
      if (!ref) {
        if (on(Q.readSourcePoint([opening.x, opening.y]), index.points.get(arm.from)!, index.points.get(arm.to)!)) { reason = 'merge_opening'; throw Error('unhosted'); }
        continue;
      }
      const ot = ref.tq ? Q.decodeRational(ref.tq) : Q.parseDecimal(ref.t);
      if (edgeKey(ref) === edgeKey(host)) {
        const jamb = host.cm / (Number(base.cell_cm) || 5) / 480, center = Q.toNumber(ot) * span;
        if (center - opening.length / 2 < split + jamb - EPS && center + opening.length / 2 > split - jamb + EPS) { reason = 'merge_opening'; throw Error('split opening'); }
      }
      if (edgeKey(ref) !== edgeKey(arm)) continue;
      const oa = index.points.get(arm.from)!, ob = index.points.get(arm.to)!;
      const na = arm.from === source ? target : oa, nb = arm.to === source ? target : ob;
      const center = Q.pointAt(oa, ob, ot), length = distance(Q.pointToNumbers(na), Q.pointToNumbers(nb));
      let nt = Q.projectParameter(center, na, nb);
      if (!Q.pointEq(Q.pointAt(na, nb, nt), center)) {
        const oldLength = distance(Q.pointToNumbers(oa), Q.pointToNumbers(ob));
        const value = arm.from === source ? 1 - (1 - Q.toNumber(ot)) * oldLength / length : Q.toNumber(ot) * oldLength / length;
        nt = Q.parseDecimal(canonicalizeNumber(value) as number);
      }
      const along = Q.toNumber(nt) * length, jamb = arm.cm / (Number(base.cell_cm) || 5) / 480;
      if (along - opening.length / 2 < jamb - EPS || along + opening.length / 2 > length - jamb + EPS) { reason = 'merge_opening'; throw Error('arm opening'); }
      operations.push({ kind: 'rehost-opening', opening: opening.id, host: { kind: ref.kind, id: ref.id, t: Q.encodeRational(nt) } });
      opening.angle = canonicalizeNumber(Q.projectedAxisAngle(na, nb)) as number;
      openingRotations.set(opening.id, openingAxisRotation(Q.pointToNumbers(oa), Q.pointToNumbers(ob), Q.pointToNumbers(na), Q.pointToNumbers(nb)));
    }
    operations.push({ kind: 'insert-on-edge', edge: { kind: host.kind, id: host.id }, t: attach.tq, node: source, newEdgeId: attach.new_edge_id });
    reason = 'merge_topology';
    const result = applyGraphOperation(graph, { kind: 'batch', operations }, { hosts: base.openings || [] });
    verifyContacts(graph, result.graph, source, host, attach.new_edge_id);
    reason = 'merge_dependency';
    for (const node of result.graph.nodes) if (node.id !== source && !Q.pointEq(Q.decodePoint(node.p), index.points.get(node.id)!)) throw Error('foreign point');
    for (const opening of base.openings || []) if (result.mapping.hosts[opening.id]) opening.host = result.mapping.hosts[opening.id];
    return { ok: true, space: transportOpeningOrientations(plan.source, projectGraphSpace(base, result.graph).space, openingRotations), changed: true,
      affected: [edgeKey(arm), edgeKey(host), `${host.kind}:${attach.new_edge_id}`] };
  } catch (e) {
    if (String(e).includes('dependency')) reason = 'merge_dependency';
    return { ok: false, reason };
  }
}
