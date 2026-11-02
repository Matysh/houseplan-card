/**
 * Derived physical host continuity for graph projections. Nothing here adds a
 * persisted field or infers incidence from equal/near coordinates.
 */
import type { EdgeKind, GraphEdge, PlanGraph } from './plan-graph';
import {
  cmp, decodePoint, decodeRational, orientation, parseDecimal, pointAt,
  pointSub, dot, pointToNumbers, ZERO, ONE, type GraphPoint, type ExactPoint,
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
  const points = new Map(graph.nodes.map(node => [node.id, decodePoint(node.p)]));
  const graphPoints = new Map(graph.nodes.map(node => [node.id, node.p]));
  const edges = graph.edges.filter(edge => edge.kind === kind && edge.cm > 0);
  const byId = new Map(edges.map(edge => [edge.id, edge]));
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
  for (const carrier of carriers) {
    if (Object.prototype.hasOwnProperty.call(carrier, RUN)) delete (carrier as any)[RUN];
    const edge = byId.get(carrier.id);
    if (!edge) continue;
    const component = components.get(edge.id)!;
    let [from, to] = component.ends;
    const direction = pointSub(points.get(edge.to)!, points.get(edge.from)!);
    if (cmp(dot(pointSub(points.get(to)!, points.get(from)!), direction), ZERO) < 0) [from, to] = [to, from];
    const run: GraphOpeningRun = Object.freeze({
      key: component.key, kind, members: component.members,
      a: Object.freeze(physicalPoint(points.get(from)!, coordScale)),
      b: Object.freeze(physicalPoint(points.get(to)!, coordScale)),
      anchor: Object.freeze({
        id: edge.id,
        a: Object.freeze(physicalPoint(points.get(edge.from)!, coordScale)),
        b: Object.freeze(physicalPoint(points.get(edge.to)!, coordScale)),
        exactA: Object.freeze(graphPoints.get(edge.from)!.slice()) as Readonly<GraphPoint>,
        exactB: Object.freeze(graphPoints.get(edge.to)!.slice()) as Readonly<GraphPoint>,
      }),
      coordScale,
    });
    Object.defineProperty(carrier, RUN, {
      value: { run, checkCarrier: true }, enumerable: true, configurable: true,
    });
  }
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
