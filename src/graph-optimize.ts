/**
 * Optimize's explicit structural plan. Float maintenance passes supply targets;
 * the previous graph supplies every identity, incidence and exact host.
 */
import {
  applyGraphOperation, edgeKey, graphIndex, projectGraphSpace, PlanGraphError,
  type GraphOperation, type GraphResult, type GraphEdge, type PlanGraph,
} from './plan-graph';
import {
  cmp, decodePoint, decodeRational, encodePoint, encodeRational, exact, intersection,
  orientation, parseDecimal, pointAt, pointToNumbers, projectParameter, ZERO, ONE,
  type ExactPoint,
} from './plan-exact';
import { mergeCollinearPartitions, spaceMergeGeometry } from './wall-merge';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const ref = (edge: GraphEdge) => ({ kind: edge.kind, id: edge.id });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const targetPoint = (p: number[]): ExactPoint => [0, 1].map(axis => {
  const n = Math.round(p[axis] * 240);
  return p[axis] === n / 240 ? exact(BigInt(n), 240n) : parseDecimal(p[axis]);
}) as unknown as ExactPoint;

export interface GraphOptimizeResult {
  space: any;
  partitionsMerged: number;
  partitionsReconciled: number;
  wallsMerged: number;
  openingsRehosted: number;
}

export function optimizeGraphTargets(before: any, draft: any, movesOnly = false): GraphOptimizeResult {
  const projected = projectGraphSpace(before, before.plan_graph);
  const originalOpenings = new Map<string, any>((before.openings || []).map((o: any) => [o.id, o]));
  let space: any = { ...clone(draft), openings: (draft.openings || []).map((o: any) => {
    const original = originalOpenings.get(o.id), next = { ...o };
    if (original?.host) next.host = clone(original.host);
    else delete next.host;
    return next;
  }) };
  let graph: PlanGraph = clone(before.plan_graph);
  const stats = { partitionsMerged: 0, partitionsReconciled: 0, wallsMerged: 0, openingsRehosted: 0 };
  const apply = (operations: GraphOperation[]): GraphResult | undefined => {
    if (!operations.length) return undefined;
    const result = applyGraphOperation(graph, { kind: 'batch', operations }, { hosts: space.openings || [] });
    graph = result.graph;
    for (const opening of space.openings || []) {
      if (!Object.prototype.hasOwnProperty.call(result.mapping.hosts, opening.id)) continue;
      const host = result.mapping.hosts[opening.id];
      if (host === null) delete opening.host;
      else opening.host = clone(host);
    }
    return result;
  };
  const dependent = new Set(graph.dependencies.map(d => d.node));
  const targets = new Map<string, ExactPoint>();
  const setTarget = (id: string, p: number[]) => {
    if (dependent.has(id)) return; // Core evaluates the exact support DAG.
    if (!p || !p.every(Number.isFinite)) throw new PlanGraphError('optimize-target', id);
    const next = targetPoint(p), old = targets.get(id);
    if (old && !same(encodePoint(old), encodePoint(next))) throw new PlanGraphError('optimize-target-conflict', id);
    targets.set(id, next);
  };
  const rooms = new Map<string, any>((draft.rooms || []).map((room: any) => [room.id, room]));
  for (const cycle of graph.rooms) {
    const room = rooms.get(cycle.room);
    if (!room || room.poly?.length !== cycle.edges.length) throw new PlanGraphError('optimize-cycle', cycle.room);
    cycle.edges.forEach((_edge, i) => setTarget(
      projected.bindings.vertices[JSON.stringify([cycle.room, i])], room.poly[i]));
  }
  const numericalPartitions = new Map<string, any>((draft.partitions || []).map((p: any) => [p.id, p]));
  const alignment = movesOnly ? draft : projectGraphSpace({ ...draft, openings: [] }, draft.plan_graph).space;
  const alignedPartitions = new Map<string, any>((alignment.partitions || []).map((p: any) => [p.id, p]));
  for (const edge of graph.edges) if (edge.kind === 'partition') {
    const p = alignedPartitions.get(edge.id);
    if (p) { setTarget(edge.from, p.a); setTarget(edge.to, p.b); }
  }

  const initialIndex = graphIndex(graph), nodes = initialIndex.nodes;
  const dependencies = new Map(graph.dependencies.map(d => [d.node, d]));
  const supportNodes = new Set(graph.dependencies.flatMap(d => d.refs.flatMap(r => [r.from, r.to])));
  const proposed = (id: string): ExactPoint => {
    const dependency = dependencies.get(id);
    if (!dependency) return targets.get(id) || decodePoint(nodes.get(id)!.p);
    if (dependency.kind === 'on-edge') {
      const r = dependency.refs[0];
      return pointAt(proposed(r.from), proposed(r.to), decodeRational(dependency.parameters[0]));
    }
    const [a, b] = dependency.refs;
    const hit = intersection(proposed(a.from), proposed(a.to), proposed(b.from), proposed(b.to));
    if (!hit) throw new PlanGraphError('dependency-intersection', id);
    return pointAt(proposed(a.from), proposed(a.to), hit.t);
  };
  // Thickness breakpoints are exact parameters on known straight runs, not
  // additional authored grid corners. Independently snapping both ends of a
  // short interval would erase a valid edge before the interval cleanup pass.
  const seams = new Set(graph.nodes.filter(node => {
    const incident = initialIndex.incident.get(node.id) || [];
    if (incident.length !== 2 || incident[0].kind !== incident[1].kind
        || supportNodes.has(node.id) || dependent.has(node.id)) return false;
    const other = (e: GraphEdge) => decodePoint(nodes.get(e.from === node.id ? e.to : e.from)!.p);
    return cmp(orientation(other(incident[0]), decodePoint(node.p), other(incident[1])), ZERO) === 0;
  }).map(n => n.id));
  const visited = new Set<string>();
  for (const first of graph.edges) {
    if (visited.has(edgeKey(first)) || (seams.has(first.from) && seams.has(first.to))) continue;
    const start = seams.has(first.from) ? first.to : first.from;
    let edge = first, at = start;
    const middle: string[] = [];
    while (true) {
      visited.add(edgeKey(edge));
      at = edge.from === at ? edge.to : edge.from;
      if (!seams.has(at)) break;
      middle.push(at);
      const next = initialIndex.incident.get(at)!.find(e => e !== edge)!;
      if (visited.has(edgeKey(next))) throw new PlanGraphError('optimize-seam-cycle', at);
      edge = next;
    }
    if (!middle.length) continue;
    const a = decodePoint(nodes.get(start)!.p), b = decodePoint(nodes.get(at)!.p);
    const nextA = proposed(start), nextB = proposed(at);
    for (const id of middle) {
      targets.set(id, pointAt(nextA, nextB, projectParameter(decodePoint(nodes.get(id)!.p), a, b)));
    }
  }
  apply([...targets].filter(([id, p]) => !same(nodes.get(id)!.p, encodePoint(p)))
    .map(([id, p]): GraphOperation => ({ kind: 'move-node', node: id, target: encodePoint(p) })));
  if (movesOnly) return { space: projectGraphSpace(space, graph).space, ...stats };

  const point = (id: string): ExactPoint => decodePoint(graph.nodes.find(n => n.id === id)!.p);
  const numberPoint = (id: string): number[] => pointToNumbers(point(id));
  const supportedSeam = (id: string) => graph.dependencies.some(d =>
    d.node !== id && d.refs.some(r => r.from === id || r.to === id));
  const canCollapse = (a: GraphEdge, b: GraphEdge, node: string) => (
    a.kind === b.kind && a.cm === b.cm && same(a.props || {}, b.props || {})
    && graph.edges.filter(e => e.from === node || e.to === node).length === 2
    && !supportedSeam(node));
  const shared = (a: GraphEdge, b: GraphEdge) => [a.from, a.to].find(n => n === b.from || n === b.to);
  const covers = (row: any, a: number[], b: number[]) => {
    if (!Array.isArray(row.a) || !Array.isArray(row.b)) return false;
    const dx = row.b[0] - row.a[0], dy = row.b[1] - row.a[1], length2 = dx * dx + dy * dy;
    if (!(length2 > 0)) return false;
    // Bounded lookup of numerical interval targets on an already known edge.
    // This does not infer structural identity or join nearby graph nodes.
    const on = (p: number[]) => {
      const t = ((p[0] - row.a[0]) * dx + (p[1] - row.a[1]) * dy) / length2;
      return t >= -1e-9 && t <= 1 + 1e-9
        && Math.abs((p[0] - row.a[0]) * dy - (p[1] - row.a[1]) * dx) <= Math.sqrt(length2) * 1e-9;
    };
    return on(a) && on(b);
  };
  const thickness: GraphOperation[] = [];
  for (const edge of graph.edges) if (edge.kind === 'wall') {
    const a = numberPoint(edge.from), b = numberPoint(edge.to);
    const rows = (draft.walls || []).filter((row: any) => covers(row, a, b));
    const values = new Set<number>(rows.map((row: any) => Number(row.cm)));
    if (values.size > 1) throw new PlanGraphError('optimize-thickness-conflict', edge.id);
    const cm = values.size ? [...values][0] : 0;
    if (cm !== edge.cm) thickness.push({ kind: 'set-thickness', edges: [ref(edge)], cm });
  }
  apply(thickness);

  const mergeSpace = projectGraphSpace(space, graph).space;
  const merge = mergeCollinearPartitions(mergeSpace.partitions || [], {
    pitch: 1 / 240, geometry: spaceMergeGeometry(mergeSpace),
  });
  const groups = new Map<string, Set<string>>();
  for (const move of merge.openingMoves) {
    const group = groups.get(move.toId) || new Set<string>();
    group.add(move.fromId); groups.set(move.toId, group);
  }
  for (const [retained, ids] of groups) {
    let progress = true;
    while (progress) {
      progress = false;
      const members = graph.edges.filter(e => e.kind === 'partition' && ids.has(e.id));
      for (const a of members) {
        const b = members.find(e => e !== a && shared(a, e) && canCollapse(a, e, shared(a, e)!));
        if (!b) continue;
        const keep = a.id === retained ? a : b.id === retained ? b : a;
        const remove = keep === a ? b : a;
        apply([{ kind: 'collapse-node', node: shared(a, b)!, retained: ref(keep), removed: ref(remove) }]);
        stats.partitionsMerged++; progress = true; break;
      }
    }
  }
  // Transfer the existing reconciliation proof onto exact, known graph edges.
  for (const partition of graph.edges.filter(e => e.kind === 'partition')) {
    if (numericalPartitions.has(partition.id)) continue;
    const a = numberPoint(partition.from), b = numberPoint(partition.to);
    if ((draft.partitions || []).some((p: any) => covers(p, a, b))) continue;
    const wall = graph.edges.find(e => e.kind === 'wall' && (
      (e.from === partition.from && e.to === partition.to)
      || (e.from === partition.to && e.to === partition.from)));
    if (!wall) throw new PlanGraphError('optimize-convert-target', partition.id);
    const hosted = (space.openings || []).filter((o: any) => o.host?.kind === 'partition' && o.host.id === partition.id);
    apply([{ kind: 'convert-edge', edge: ref(partition), target: ref(wall) }]);
    stats.partitionsReconciled++; stats.openingsRehosted += hosted.length;
  }

  let progress = true;
  while (progress) {
    progress = false;
    const index = graphIndex(graph);
    for (const [node, incident] of index.incident) {
      if (incident.length !== 2) continue;
      const [a, b] = incident;
      if (a.kind !== 'wall' || !canCollapse(a, b, node)) continue;
      const left = a.from === node ? a.to : a.from, right = b.from === node ? b.to : b.from;
      if (cmp(orientation(point(left), point(node), point(right)), ZERO) !== 0) continue;
      apply([{ kind: 'collapse-node', node, retained: ref(a), removed: ref(b) }]);
      stats.wallsMerged++; progress = true; break;
    }
  }

  // Partition hosts keep exact collapse/convert maps. Room-hosted openings may
  // align along their known wall; this is an explicit host-parameter operation.
  const hostMoves: GraphOperation[] = [];
  for (const opening of space.openings || []) {
    const original = originalOpenings.get(opening.id);
    if (!original?.host || original.host.kind !== 'wall' || opening.host?.kind !== 'wall') continue;
    const target = (draft.openings || []).find((o: any) => o.id === opening.id);
    const edge = graph.edges.find(e => edgeKey(e) === edgeKey(opening.host));
    if (!target || !edge) continue;
    const p = targetPoint([target.x, target.y]), a = point(edge.from), b = point(edge.to);
    const t = projectParameter(p, a, b);
    if (cmp(t, ZERO) < 0 || cmp(t, ONE) > 0) continue;
    const q = pointToNumbers(pointAt(a, b, t));
    if (Math.hypot(q[0] - target.x, q[1] - target.y) > 1e-9) continue;
    const next = encodeRational(t);
    if (!same(next, opening.host.tq)) hostMoves.push({
      kind: 'rehost-opening', opening: opening.id, host: { ...ref(edge), t: next },
    });
  }
  apply(hostMoves);
  space = projectGraphSpace(space, graph).space;
  for (const opening of space.openings || []) if (opening.host) {
    const edge = graph.edges.find(e => edgeKey(e) === edgeKey(opening.host))!;
    const a = numberPoint(edge.from), b = numberPoint(edge.to);
    let angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    if (angle >= 90) angle -= 180; else if (angle < -90) angle += 180;
    opening.angle = angle;
  }
  return { space, ...stats };
}

/** Unsplit parent runs for the existing thickness-island proof, not a writer. */
export function graphOptimizeRoomProfile(space: any, modelRooms: any[]): any[] {
  const graph: PlanGraph = space.plan_graph, index = graphIndex(graph);
  return modelRooms.map(room => {
    const cycle = graph.rooms.find(r => r.room === room.id);
    if (!cycle || !room.poly || room.poly.length !== cycle.edges.length) return room;
    const vertices = cycle.edges.map(ref => {
      const e = index.edges.get(edgeKey(ref))!;
      return index.points.get(ref.reverse ? e.to : e.from)!;
    });
    const poly = room.poly.filter((_p: number[], i: number) =>
      cmp(orientation(vertices[(i + vertices.length - 1) % vertices.length],
        vertices[i], vertices[(i + 1) % vertices.length]), ZERO) !== 0);
    return poly.length >= 3 ? { ...room, poly } : room;
  });
}

/** Keep genuine T/intersection/support boundaries in the island safety proof. */
export function graphOptimizeTopologyPoints(space: any, scale: number): number[][] {
  const graph: PlanGraph = space.plan_graph, index = graphIndex(graph);
  const support = new Set(graph.dependencies.flatMap(d => d.refs.flatMap(r => [r.from, r.to])));
  return graph.nodes.filter(n => (index.incident.get(n.id)?.length || 0) !== 2 || support.has(n.id))
    .map(n => pointToNumbers(decodePoint(n.p)).map(value => value * scale));
}
