/**
 * Derived physical host continuity for graph projections. Nothing here adds a
 * persisted field or infers incidence from equal/near coordinates.
 */
import type { EdgeKind, GraphEdge, PlanGraph } from './plan-graph';
import {
  cmp, decodePoint, decodeRational, orientation, parseDecimal, pointAt,
  pointSub, dot, pointToNumbers, projectParameter, readAuthoredPoint, encodeRational, toNumber, ZERO, ONE, type GraphPoint, type ExactPoint, type ExactRational,
} from './plan-exact';

export interface GraphOpeningRun {
  readonly key: string;
  readonly kind: EdgeKind;
  readonly members: readonly string[];
  /** Physical/render coordinates, directed like the anchor edge. */
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  readonly anchor: {
    readonly id: string;
    readonly a: readonly [number, number];
    readonly b: readonly [number, number];
    readonly exactA: Readonly<GraphPoint>;
    readonly exactB: Readonly<GraphPoint>;
  };
  readonly coordScale: number;
}
const annotatedSpaces = new WeakMap<object, { graph: PlanGraph; walls: unknown; partitions: unknown }>();
/** Selected-floor raw readers share the same derived continuity as scaled
 * models. Symbols stay outside persistence and the graph is never mutated. */
export function annotateSpaceGraphOpeningRuns<T extends Record<string, any>>(space: T): T {
  const graph = space.plan_graph as PlanGraph | undefined;
  if (!graph) return space;
  const known = annotatedSpaces.get(space);
  if (known?.graph === graph && known.walls === space.wall_segments && known.partitions === space.partitions) return space;
  annotateGraphOpeningRuns(graph,space.wall_segments || [],'wall');
  annotateGraphOpeningRuns(graph,space.partitions || [],'partition');
  annotatedSpaces.set(space,{graph,walls:space.wall_segments,partitions:space.partitions});
  return space;
}
interface RunMetadata {
  run: GraphOpeningRun;
  /** Only a carrier must still match the projection that was annotated. */
  checkCarrier: boolean;
}
const RUN = Symbol('houseplan.graph-opening-run');
// Accepted graph reducers replace identity. Projecting the same graph again
// must not rebuild and retain one run descriptor per model/carrier copy.
const runCache = new WeakMap<PlanGraph, Map<string, ReadonlyMap<string, GraphOpeningRun>>>();
function attachRuns(carriers: readonly Record<string, any>[], runs: ReadonlyMap<string, GraphOpeningRun>): void {
  for (const carrier of carriers) {
    if (Object.prototype.hasOwnProperty.call(carrier, RUN)) delete (carrier as any)[RUN];
    const run = runs.get(carrier.id);
    if (run) Object.defineProperty(carrier, RUN, {
      value: { run, checkCarrier: true }, enumerable: true, configurable: true,
    });
  }
}
const canonical = (value: unknown): string => JSON.stringify(value, (_name, item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]]));
});
const physicalPoint = (p: ExactPoint, scale: number): [number, number] => {
  const [x, y] = pointToNumbers(p); return [x * scale, y * scale];
};

/** Symbol metadata survives ordinary object spread; JSON never serializes it. */
export function graphOpeningRun(value: unknown): GraphOpeningRun | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const metadata = (value as any)[RUN] as RunMetadata | undefined;
  if (!metadata) return undefined;
  if (metadata.checkCarrier) {
    const carrier = value as any, anchor = metadata.run.anchor;
    if (carrier.id !== anchor.id || !Array.isArray(carrier.a) || !Array.isArray(carrier.b)
        || carrier.a[0] !== anchor.a[0] || carrier.a[1] !== anchor.a[1]
        || carrier.b[0] !== anchor.b[0] || carrier.b[1] !== anchor.b[1]) return undefined;
  }
  return metadata.run;
}

/** Carry an already validated run onto a derived resolution/cut, not a carrier. */
export function copyGraphOpeningRun<T extends Record<string, any>>(source: unknown, target: T): T {
  const run = graphOpeningRun(source);
  if (run) Object.defineProperty(target, RUN, {
    value: { run, checkCarrier: false }, enumerable: true, configurable: true,
  });
  return target;
}

/**
 * Attach current graph context to newly projected carriers at their own scale.
 * Root projections call with1; rendered space-model carriers call with NORM_W.
 * Run endpoints are discovered by mutual unique, outward continuation only.
 */
export function annotateGraphOpeningRuns<T extends Record<string, any>>(
  graph: PlanGraph, carriers: readonly T[], kind: EdgeKind, coordScale = 1,
): void {
  if (!(coordScale > 0) || !Number.isFinite(coordScale)) throw new Error('invalid graph opening scale');
  if (!carriers.length) return;
  const cacheKey = kind + ':' + coordScale;
  const cached = runCache.get(graph)?.get(cacheKey);
  if (cached) { attachRuns(carriers, cached); return; }
  const normalized = coordScale !== 1 && runCache.get(graph)?.get(kind + ':1');
  if (normalized) {
    // graphViewSpace already found exact continuity. Rendering only multiplies
    // those same rounded source coordinates; do not solve the graph again.
    const points = new Map<readonly [number, number], Readonly<[number, number]>>();
    const scaled = (point: readonly [number, number]) => {
      let result = points.get(point);
      if (!result) { result = Object.freeze([point[0] * coordScale, point[1] * coordScale] as [number, number]); points.set(point, result); }
      return result;
    };
    const runs = new Map<string, GraphOpeningRun>();
    for (const [id, run] of normalized) runs.set(id, Object.freeze({
      ...run, a: scaled(run.a), b: scaled(run.b), coordScale,
      anchor: Object.freeze({ ...run.anchor, a: scaled(run.anchor.a), b: scaled(run.anchor.b) }),
    }));
    runCache.get(graph)!.set(cacheKey, runs); attachRuns(carriers, runs); return;
  }
  const points = new Map(graph.nodes.map(node => [node.id, decodePoint(node.p)]));
  const graphPoints = new Map(graph.nodes.map(node => [node.id, node.p]));
  const edges = graph.edges.filter(edge => edge.kind === kind && edge.cm > 0);
  const signatures = new Map(edges.map(edge => [edge.id, canonical(edge.props || {})]));
  const incident = new Map<string, GraphEdge[]>();
  for (const edge of edges) for (const node of [edge.from, edge.to]) {
    const list = incident.get(node) || []; list.push(edge); incident.set(node, list);
  }
  const other = (edge: GraphEdge, node: string) => edge.from === node ? edge.to : edge.from;
  const candidates = (edge: GraphEdge, at: string): GraphEdge[] => {
    const p = points.get(at)!, previous = points.get(other(edge, at))!;
    return (incident.get(at) || []).filter(next => next !== edge && next.cm === edge.cm
      && signatures.get(next.id) === signatures.get(edge.id)
      && cmp(orientation(previous, p, points.get(other(next, at))!), ZERO) === 0
      && cmp(dot(pointSub(previous, p), pointSub(points.get(other(next, at))!, p)), ZERO) < 0);
  };
  const continuation = (edge: GraphEdge, at: string): GraphEdge | undefined => {
    const next = candidates(edge, at);
    if (next.length !== 1) return undefined;
    const reverse = candidates(next[0], at);
    return reverse.length === 1 && reverse[0] === edge ? next[0] : undefined;
  };
  // Build each undirected component once, then orient its physical endpoints
  // separately for every anchor. Ambiguous branches cannot get asymmetric runs.
  const components = new Map<string, { members: readonly string[]; ends: [string, string]; key: string }>();
  for (const initial of edges) {
    if (components.has(initial.id)) continue;
    const members = [initial.id], visited = new Set([initial.id]);
    const walk = (edge: GraphEdge, at: string): string => {
      while (true) {
        const next = continuation(edge, at);
        if (!next || visited.has(next.id)) return at;
        members.push(next.id); visited.add(next.id);
        at = other(next, at); edge = next;
      }
    };
    const ends: [string, string] = [walk(initial, initial.from), walk(initial, initial.to)];
    members.sort();
    const component = { members: Object.freeze(members), ends, key: JSON.stringify([kind, members]) };
    for (const id of members) components.set(id, component);
  }
  const physical = new Map<string, Readonly<[number, number]>>();
  const exact = new Map<string, Readonly<GraphPoint>>();
  const numberPoint = (id: string) => {
    let point = physical.get(id);
    if (!point) { point = Object.freeze(physicalPoint(points.get(id)!, coordScale)); physical.set(id, point); }
    return point;
  };
  const exactPoint = (id: string) => {
    let point = exact.get(id);
    if (!point) { point = Object.freeze(graphPoints.get(id)!.slice()) as Readonly<GraphPoint>; exact.set(id, point); }
    return point;
  };
  const runs = new Map<string, GraphOpeningRun>();
  for (const edge of edges) {
    const component = components.get(edge.id)!;
    let [from, to] = component.ends;
    const direction = pointSub(points.get(edge.to)!, points.get(edge.from)!);
    if (cmp(dot(pointSub(points.get(to)!, points.get(from)!), direction), ZERO) < 0) [from, to] = [to, from];
    const run: GraphOpeningRun = Object.freeze({
      key: component.key, kind, members: component.members,
      a: numberPoint(from),
      b: numberPoint(to),
      anchor: Object.freeze({
        id: edge.id,
        a: numberPoint(edge.from),
        b: numberPoint(edge.to),
        exactA: exactPoint(edge.from),
        exactB: exactPoint(edge.to),
      }),
      coordScale,
    });
    runs.set(edge.id, run);
  }
  const cache = runCache.get(graph) || new Map(); cache.set(cacheKey, runs); runCache.set(graph, cache);
  attachRuns(carriers, runs);
}

/** Exact host tq chooses the centre; the anchor ID/parameter are never changed. */
export function graphOpeningRunCenter(
  run: GraphOpeningRun, host: { t: number; tq?: unknown },
): [number, number] | undefined {
  try {
    const t = host.tq === undefined ? parseDecimal(host.t) : decodeRational(host.tq);
    if (cmp(t, ZERO) < 0 || cmp(t, ONE) > 0) return undefined;
    return physicalPoint(pointAt(decodePoint(run.anchor.exactA), decodePoint(run.anchor.exactB), t), run.coordScale);
  } catch { return undefined; }
}

export interface GraphOpeningRunTarget {
  host: { kind: EdgeKind; id: string; tq: ExactRational; t: number };
  center: [number, number];
  normalized: [number, number];
}

/** Explicit movement within an already proven physical run. The full run
 * clamps the point; the containing graph child owns the exact persisted tq.
 * A shared boundary retains the anchor ID. No coordinate-only host discovery. */
export function graphOpeningRunTarget(
  carriers: readonly unknown[], anchorId: string, physical: readonly [number, number],
): GraphOpeningRunTarget | undefined {
  if (!physical.every(Number.isFinite)) return undefined;
  const runs = carriers.map(graphOpeningRun).filter((r): r is GraphOpeningRun => !!r);
  const anchor = runs.find(r => r.anchor.id === anchorId);
  if (!anchor) return undefined;
  const children = runs.filter(r => r.key === anchor.key && r.coordScale === anchor.coordScale);
  const byId = new Map(children.map(r => [r.anchor.id, r]));
  if (anchor.members.some(id => !byId.has(id))) return undefined;
  try {
    const a = decodePoint(anchor.anchor.exactA), b = decodePoint(anchor.anchor.exactB);
    let t = projectParameter(readAuthoredPoint(physical.map(v => v / anchor.coordScale)), a, b);
    const ends = [...byId.values()].flatMap(r => [decodePoint(r.anchor.exactA), decodePoint(r.anchor.exactB)]);
    const parameters = ends.map(p => projectParameter(p, a, b)).sort(cmp);
    if (cmp(t, parameters[0]) < 0) t = parameters[0];
    if (cmp(t, parameters[parameters.length - 1]) > 0) t = parameters[parameters.length - 1];
    const point = pointAt(a, b, t);
    const ordered = [anchor, ...[...byId.values()].filter(r => r.anchor.id !== anchorId)
      .sort((a,b) => a.anchor.id < b.anchor.id ? -1 : a.anchor.id > b.anchor.id ? 1 : 0)];
    for (const child of ordered) {
      const ca = decodePoint(child.anchor.exactA), cb = decodePoint(child.anchor.exactB);
      const tq = projectParameter(point, ca, cb);
      if (cmp(tq, ZERO) < 0 || cmp(tq, ONE) > 0) continue;
      return { host: { kind: child.kind, id: child.anchor.id, tq: encodeRational(tq), t: toNumber(tq) },
        center: physicalPoint(point, anchor.coordScale), normalized: pointToNumbers(point) };
    }
  } catch { /* Invalid/stale derived context cannot authorize a host change. */ }
  return undefined;
}
