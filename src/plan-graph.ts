/** Persisted structural graph; current mutations are explicit ID operations. */
import { wallKey, thicknessCmAt, wallAngleMatches } from './wall-thickness';
import { resolveOpenCuts, sanitizeOpenSpans } from './open-spans';
import { storedWallContact } from './stored-wall-contact';
import { compareCodePoints } from './codepoint-order';
import {
  type Exact, type ExactPoint, type ExactRational, type GraphPoint,
  PlanExactError, ZERO, ONE, exact, parseDecimal, decodePoint, encodePoint, readSourcePoint,
  decodeRational, encodeRational, add, sub, mul, div, cmp, eq, min, max, floor,
  nearestInteger, pointEq, pointCmp, pointAdd, pointSub, squaredDistance, withinRadius,
  pointAt, projectParameter, intersection, orientation, microRadius, pointToNumbers, toNumber,
} from './plan-exact.js';
export type { ExactRational, GraphPoint } from './plan-exact.js';
export type EdgeKind = 'wall' | 'partition';
export interface EdgeRef { kind: EdgeKind; id: string }
export type GraphEdgeRef = EdgeRef;
export interface GraphNode { id: string; p: GraphPoint }
export interface GraphEdge extends EdgeRef {
  from: string; to: string; cm: number; props?: Record<string, unknown>;
}
export interface GraphRoomCycle { room: string; edges: Array<EdgeRef & { reverse: boolean }> }
export interface GraphDependency {
  node: string; kind: 'on-edge' | 'intersection'; refs: Array<{ from: string; to: string }>; parameters: ExactRational[];
}
export interface PlanGraph {
  version: 1; nodes: GraphNode[]; edges: GraphEdge[]; rooms: GraphRoomCycle[]; dependencies: GraphDependency[];
}
export interface GraphIssue { code: string; subject?: string }
export class PlanGraphError extends Error {
  constructor(public readonly code: string, public readonly subject = '') {
    super('plan-graph:' + code + (subject ? ':' + subject : ''));
    this.name = 'PlanGraphError';
  }
}
export interface GraphLimits { edges: number; rooms: number; nodes: number }
export const GRAPH_LIMITS: GraphLimits = { edges: 202000, rooms: 400, nodes: 404000 };
export const edgeKey = (r: EdgeRef): string => r.kind + ':' + r.id;
const order = compareCodePoints;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function fail(code: string, subject = ''): never { throw new PlanGraphError(code, subject); }
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const idValid = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 4096;
const between = (t: Exact): boolean => cmp(t, ZERO) >= 0 && cmp(t, ONE) <= 0;
const pointKey = (p: ExactPoint): string => JSON.stringify(encodePoint(p));
const hostParameter=(host:any):Exact=>host.tq ? decodeRational(host.tq)
  : Array.isArray(host.t) ? decodeRational(host.t) : parseDecimal(host.t);
const canonicalHost=(host:any,q:Exact):any=>({...host,tq:encodeRational(q),t:toNumber(q)});
export interface GraphIndex {
  nodes: Map<string, GraphNode>; points: Map<string, ExactPoint>; edges: Map<string, GraphEdge>;
  incident: Map<string, GraphEdge[]>; owners: Map<string, string[]>;
  edgeTree?: Tree<GraphEdge>|null; dirtyEdges?: Set<string>;
}
export interface ValidationContext {
  roomIds?: readonly string[]; limits?: Partial<GraphLimits>; hosts?: readonly any[];
  projection?: Record<string, any>;
}
export function graphIndex(graph: PlanGraph): GraphIndex {
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  const points = new Map(graph.nodes.map(n => [n.id, decodePoint(n.p)]));
  const edges = new Map(graph.edges.map(e => [edgeKey(e), e]));
  const incident = new Map<string, GraphEdge[]>(), owners = new Map<string, string[]>();
  for (const e of graph.edges) for (const n of [e.from, e.to]) {
    const list = incident.get(n) || []; list.push(e); incident.set(n, list);
  }
  for (const room of graph.rooms) for (const r of room.edges) {
    const list = owners.get(edgeKey(r)) || []; list.push(room.room); owners.set(edgeKey(r), list);
  }
  return { nodes, points, edges, incident, owners };
}
function canonicalGraph(graph: PlanGraph): PlanGraph {
  return { version: 1,
    nodes: graph.nodes.map(n => ({ id: n.id, p: encodePoint(decodePoint(n.p)) })).sort((a, b) => order(a.id, b.id)),
    edges: graph.edges.map(e => ({ id: e.id, from: e.from, to: e.to, kind: e.kind, cm: e.cm,
      ...(e.props && Object.keys(e.props).length ? { props: clone(e.props) } : {}) }))
      .sort((a, b) => order(edgeKey(a), edgeKey(b))),
    rooms: graph.rooms.map(r => ({ room: r.room, edges: r.edges.map(e => ({ kind: e.kind, id: e.id, reverse: e.reverse })) }))
      .sort((a, b) => order(a.room, b.room)),
    dependencies: graph.dependencies.map(d => ({ node: d.node, kind: d.kind,
      refs: d.refs.map(r => ({ from: r.from, to: r.to })), parameters: d.parameters.map(p => encodeRational(decodeRational(p))) }))
      .sort((a, b) => order(a.node, b.node)) };
}
export function validateGraph(input: unknown, context: ValidationContext = {}):
  { ok: boolean; issues: GraphIssue[]; index?: GraphIndex } {
  try {
    if (!record(input) || input.version !== 1 || !['nodes', 'edges', 'rooms', 'dependencies'].every(k => Array.isArray(input[k])))
      fail('format');
    const graph = input as unknown as PlanGraph, limits = { ...GRAPH_LIMITS, ...context.limits };
    if (graph.edges.length > limits.edges || graph.rooms.length > limits.rooms || graph.nodes.length > limits.nodes)
      fail('resource');
    const nodeIds = new Set<string>(), edgeIds = new Set<string>(), roomIds = new Set<string>();
    for (const n of graph.nodes) {
      if (!record(n) || !idValid(n.id) || nodeIds.has(n.id)) fail('node-id');
      nodeIds.add(n.id); decodePoint(n.p);
    }
    const index = graphIndex(graph);
    for (const e of graph.edges) {
      if (!record(e) || (!idValid(e.id) || e.id.length>64) || !['wall', 'partition'].includes(e.kind) || edgeIds.has(edgeKey(e))) fail('edge-id');
      edgeIds.add(edgeKey(e));
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to) || e.from === e.to
          || pointEq(index.points.get(e.from)!, index.points.get(e.to)!)) fail('zero-length', edgeKey(e));
      if (typeof e.cm !== 'number' || !Number.isFinite(e.cm) || e.cm < 0 || e.cm > 100) fail('thickness', edgeKey(e));
      if (e.props !== undefined && (!record(e.props) || ['id', 'a', 'b', 'cm', 'from', 'to', 'kind'].some(k => k in e.props!)))
        fail('props', edgeKey(e));
    }
    const allowed = context.roomIds && new Set(context.roomIds);
    for (const room of graph.rooms) {
      if (!idValid(room.room) || roomIds.has(room.room) || allowed && !allowed.has(room.room)
          || !Array.isArray(room.edges) || room.edges.length < 3) fail('room');
      roomIds.add(room.room);
      const starts: string[] = [], ends: string[] = [], own = new Set<string>();
      for (const ref of room.edges) {
        const e = index.edges.get(edgeKey(ref));
        if (!e || typeof ref.reverse !== 'boolean' || own.has(edgeKey(ref))) fail('room-edge', room.room);
        own.add(edgeKey(ref)); starts.push(ref.reverse ? e.to : e.from); ends.push(ref.reverse ? e.from : e.to);
      }
      if (ends.some((v, i) => v !== starts[(i + 1) % starts.length])) fail('open-cycle', room.room);
      let area = ZERO;
      for (let i = 0; i < starts.length; i++) {
        const a = index.points.get(starts[i])!, b = index.points.get(ends[i])!;
        area = add(area, sub(mul(a[0], b[1]), mul(a[1], b[0])));
      }
      if (!area.n) fail('room-area', room.room);
      for (let i = 0; i < starts.length; i++) for (let j = i + 1; j < starts.length; j++) {
        if (j === i + 1 || i === 0 && j === starts.length - 1) continue;
        const a = index.points.get(starts[i])!, b = index.points.get(ends[i])!;
        const c = index.points.get(starts[j])!, d = index.points.get(ends[j])!;
        const hit = intersection(a, b, c, d);
        if (hit && between(hit.t) && between(hit.u)) fail('self-intersection', room.room);
      }
    }
    index.edgeTree=makeTree([...graph.edges],e=>boxPoints(index.points.get(e.from)!,index.points.get(e.to)!));
    const positions=new Map(graph.edges.map((e,i)=>[edgeKey(e),i]));
    for(const edge of graph.edges){
      const box=boxPoints(index.points.get(edge.from)!,index.points.get(edge.to)!);
      for(const other of queryTree(index.edgeTree,box,[])){
        if(positions.get(edgeKey(other))!<=positions.get(edgeKey(edge))!)continue;
        if(properCross(edge,other,index.points))fail('unsplit-crossing',edgeKey(edge));
      }
    }
    for (const [key, owners] of index.owners) if (index.edges.get(key)?.kind === 'wall' && owners.length > 2) fail('third-owner', key);
    const dependent = new Set<string>();
    for (const dep of graph.dependencies) {
      if (!nodeIds.has(dep.node) || dependent.has(dep.node)
          || !['on-edge', 'intersection'].includes(dep.kind)
          || dep.refs.length !== (dep.kind === 'on-edge' ? 1 : 2)
          || dep.parameters.length !== dep.refs.length) fail('dependency');
      dependent.add(dep.node);
      dep.refs.forEach((ref, i) => {
        if (!nodeIds.has(ref.from) || !nodeIds.has(ref.to) || ref.from === ref.to) fail('dependency-support');
        const t = decodeRational(dep.parameters[i]); if (!between(t)) fail('dependency-parameter');
        if (!pointEq(index.points.get(dep.node)!, pointAt(index.points.get(ref.from)!, index.points.get(ref.to)!, t)))
          fail('dependency-value', dep.node);
      });
    }
    dependencyOrder(graph);
    for (const item of context.hosts || []) {
      const host = item && 'host' in item ? item.host : item;
      if (!host) continue;
      const e = index.edges.get(edgeKey(host)); if (!e) fail('host');
      const t = hostParameter(host);
      if(host.tq && host.t !== toNumber(t)) fail('host-projection');
      if (!between(t)) fail('host-parameter');
    }
    if (context.projection) verifyGraphProjection(context.projection, graph);
    return { ok: true, issues: [], index };
  } catch (error) {
    return { ok: false, issues: [{ code: error instanceof PlanGraphError ? error.code
      : error instanceof PlanExactError ? error.code : 'format',
    ...(error instanceof PlanGraphError && error.subject ? { subject: error.subject } : {}) }] };
  }
}
const preparedGraphs=new WeakMap<PlanGraph,GraphIndex>();
function assertGraph(graph: PlanGraph, context: ValidationContext = {}): GraphIndex {
  const prepared=preparedGraphs.get(graph);
  if(prepared && !context.projection && !context.hosts?.length && !context.roomIds && !context.limits)return prepared;
  const result = validateGraph(graph, context); if (!result.ok) fail(result.issues[0].code, result.issues[0].subject);
  return result.index!;
}
export interface EdgeRange { ref: EdgeRef; sourceInterval: [ExactRational, ExactRational]; reverse: boolean }
export interface GraphMapping {
  nodes: Record<string, string[]>; edges: Record<string, EdgeRange[]>; hosts: Record<string, any>;
}
export interface GraphResult {
  graph: PlanGraph; changed: boolean; mapping: GraphMapping;
  touched: { nodes: string[]; edges: EdgeRef[]; rooms: string[]; hosts: string[] };
  diagnostics: GraphIssue[];
}
export interface GraphBindings {
  vertices: Record<string, string>; edges: Record<string, EdgeRef>;
}
const emptyMapping = (): GraphMapping => ({ nodes: Object.create(null), edges: Object.create(null), hosts: Object.create(null) });
function metadataProps(entry: any, omitted: string[]): Record<string, unknown> | undefined {
  const pairs = Object.entries(entry).filter(([k]) => !omitted.includes(k));
  return pairs.length ? Object.fromEntries(pairs.filter(([,v])=>v!==undefined).map(([k, v]) => [k, clone(v)])) : undefined;
}
/** Project only structural fields. Metadata stays owned by its original object. */
export function projectGraphSpace<T extends Record<string, any>>(base: T, graph: PlanGraph):
  { space: T; bindings: GraphBindings } {
  const index = assertGraph(graph), space: any = clone(base);
  const bindings: GraphBindings = { vertices: {}, edges: {} };
  const roomMetadata = new Map((space.rooms || []).map((r: any) => [String(r.id), r]));
  space.rooms = graph.rooms.map(cycle => {
    const meta: any = roomMetadata.get(cycle.room) || { id: cycle.room };
    const poly = cycle.edges.map((ref, i) => {
      const e = index.edges.get(edgeKey(ref))!, n = ref.reverse ? e.to : e.from;
      bindings.vertices[JSON.stringify([cycle.room, i])] = n;
      bindings.edges[JSON.stringify([cycle.room, i])] = { kind: e.kind, id: e.id };
      return pointToNumbers(index.points.get(n)!);
    });
    const { x: _x, y: _y, w: _w, h: _h, poly: _p, wall_ids: _ids, open_to:_open, ...rest } = meta;
    return { ...rest, poly, wall_ids: cycle.edges.map(r => r.id) };
  });
  const projected = (e: GraphEdge): any => ({ ...(e.props || {}), id: e.id,
    a: pointToNumbers(index.points.get(e.from)!), b: pointToNumbers(index.points.get(e.to)!), cm: e.cm });
  space.wall_segments = graph.edges.filter(e => e.kind === 'wall').map(projected);
  space.partitions = graph.edges.filter(e => e.kind === 'partition').map(projected);
  // Compatibility key is a cache key only; structural identity always uses (kind,id).
  space.walls = space.wall_segments.filter((e: any) => e.cm > 0).map((e: any) => ({
    a: e.a.slice(), b: e.b.slice(), cm: e.cm,
    key: wallKey(e.a, e.b, 1 / 240),
  }));
  const openings = space.openings || [];
  for (const opening of openings) if (opening.host) {
    const e = index.edges.get(edgeKey(opening.host)); if (!e) fail('host', opening.id);
    const t = hostParameter(opening.host);
    opening.host=canonicalHost(opening.host,t);
    if (!between(t)) fail('host-parameter', opening.id);
    const p = pointToNumbers(pointAt(index.points.get(e.from)!, index.points.get(e.to)!, t));
    opening.x = p[0]; opening.y = p[1];
  }
  space.plan_graph = clone(graph);
  delete space.open_spans;
  return { space, bindings };
}
export function verifyGraphProjection(space: Record<string, any>, graph: PlanGraph): void {
  const { space: projected } = projectGraphSpace(space, graph);
  for (const key of ['rooms', 'wall_segments', 'partitions', 'walls', 'openings']) {
    if (JSON.stringify(space[key] || []) !== JSON.stringify(projected[key] || [])) fail('projection', key);
  }
}
export type TargetPointRef =
  | { kind: 'existing-node'; node: string }
  | { kind: 'independent'; node: string; p: GraphPoint }
  | { kind: 'on-edge'; node: string; edge: EdgeRef; t: ExactRational; splitIds: string[] }
  | { kind: 'intersection'; node: string; refs: [EdgeRef, EdgeRef]; splitIds: [string[], string[]] };
export type GraphOperation =
  | { kind: 'batch'; operations: GraphOperation[] }
  | { kind: 'set-dependency'; dependency: GraphDependency }
  | { kind: 'retire-dependency'; node: string }
  | { kind: 'collapse-node'; node: string; retained: EdgeRef; removed: EdgeRef; retireDependencies?: string[] }
  | { kind: 'move-node'; node: string; target: GraphPoint; detachDependency?: boolean }
  | { kind: 'detach-node'; node: string; newId: string; target: GraphPoint; edges: EdgeRef[];
      rooms: string[]; edgeIds?: Record<string, string>; hosts?: string[] }
  | { kind: 'translate-edges'; edges: EdgeRef[]; delta: GraphPoint }
  | { kind: 'insert-on-edge'; edge: EdgeRef; t: ExactRational; node: string; newEdgeId: string }
  | { kind: 'insert-intersection'; refs: [EdgeRef, EdgeRef]; node: string; newEdgeIds: [string, string] }
  | { kind: 'create-node'; node: GraphNode }
  | { kind: 'create-edge'; edge: GraphEdge }
  | { kind: 'retarget-edge'; edge: EdgeRef; from: string; to: string }
  | { kind: 'delete-edge'; edge: EdgeRef; removeHosts?: string[] }
  | { kind: 'replace-room-cycle'; room: string; edges: GraphRoomCycle['edges'] }
  | { kind: 'delete-face'; room: string }
  | { kind: 'merge-faces'; room: string; remove: string[]; edges: GraphRoomCycle['edges'] }
  | { kind: 'convert-edge'; edge: EdgeRef; target: EdgeRef; cm?: number }
  | { kind: 'set-thickness'; edges: EdgeRef[]; cm: number }
  | { kind: 'rehost-opening'; opening: string; host: EdgeRef & { t: ExactRational } }
  | { kind: 'normalize-current' }
  | { kind: 'restore-graph'; graph: PlanGraph }
  | { kind: 'import-graph'; graph: PlanGraph; nodes: Record<string, string>; edges: Record<string, string>; rooms: Record<string, string> };
export interface OperationContext extends ValidationContext { hosts?: any[] }

function properCross(a:GraphEdge,b:GraphEdge,points:Map<string,ExactPoint>):boolean{
  const pa=points.get(a.from)!,pb=points.get(a.to)!,pc=points.get(b.from)!,pd=points.get(b.to)!;
  const ba=boxPoints(pa,pb),bb=boxPoints(pc,pd);
  if([0,1].some(i=>cmp(ba.hi[i],bb.lo[i])<0||cmp(bb.hi[i],ba.lo[i])<0))return false;
  const hit=intersection(pa,pb,pc,pd);
  return !!hit&&cmp(hit.t,ZERO)>0&&cmp(hit.t,ONE)<0&&cmp(hit.u,ZERO)>0&&cmp(hit.u,ONE)<0;
}
function dependencyOrder(graph: PlanGraph): GraphDependency[] {
  const byNode = new Map(graph.dependencies.map(d => [d.node, d])), active = new Set<string>();
  const done = new Set<string>(), result: GraphDependency[] = [];
  const visit = (node: string): void => {
    if (done.has(node)) return;
    if (active.has(node)) fail('dependency-cycle', node);
    const d = byNode.get(node); if (!d) return;
    active.add(node);
    for (const ref of d.refs) { visit(ref.from); visit(ref.to); }
    active.delete(node); done.add(node); result.push(d);
  };
  for (const node of byNode.keys()) visit(node);
  return result;
}
function evaluateDependencies(graph: PlanGraph): void {
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  for (const d of dependencyOrder(graph)) {
    if (d.kind === 'intersection') {
      const [a,b]=d.refs;
      const hit=intersection(decodePoint(nodes.get(a.from)!.p),decodePoint(nodes.get(a.to)!.p),
        decodePoint(nodes.get(b.from)!.p),decodePoint(nodes.get(b.to)!.p));
      if(!hit || !between(hit.t) || !between(hit.u)) fail('dependency-intersection',d.node);
      d.parameters=[encodeRational(hit.t),encodeRational(hit.u)];
    }
    let result: ExactPoint | undefined;
    d.refs.forEach((r, i) => {
      const from = nodes.get(r.from), to = nodes.get(r.to);
      if (!from || !to) fail('dependency-support', d.node);
      const p = pointAt(decodePoint(from.p), decodePoint(to.p), decodeRational(d.parameters[i]));
      if (result && !pointEq(result, p)) fail('dependency-intersection', d.node);
      result = p;
    });
    const node = nodes.get(d.node); if (!node || !result) fail('dependency-node');
    node.p = encodePoint(result);
  }
}
function targetRef(ref: EdgeRef): EdgeRef { return { kind: ref.kind, id: ref.id }; }
function freezeGraph(graph:PlanGraph):PlanGraph{
  const freeze=(v:any):void=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const value of Object.values(v))freeze(value);Object.freeze(v);}};
  freeze(graph);return graph;
}
/** Validate once at gesture start; the private index is never trusted for mutable input. */
export function prepareGraph(input:PlanGraph):{graph:PlanGraph;index:GraphIndex}{
  const graph=freezeGraph(clone(input)),index=assertGraph(graph);preparedGraphs.set(graph,index);return{graph,index};
}
function preparedMove(before:PlanGraph,op:Extract<GraphOperation,{kind:'move-node'}>,context:OperationContext):GraphResult|null{
  const index=preparedGraphs.get(before);
  if(!index||context.projection||context.limits)return null;
  const old=index.nodes.get(op.node)||fail('node-missing',op.node),p=decodePoint(op.target);
  if(pointEq(decodePoint(old.p),p)&&!op.detachDependency)
    return{graph:before,changed:false,mapping:emptyMapping(),touched:{nodes:[],edges:[],rooms:[],hosts:[]},diagnostics:[]};
  if(before.dependencies.some(d=>d.node===op.node)&&!op.detachDependency)fail('dependent-move',op.node);
  for(const item of context.hosts||[]){
    const host=item&&'host'in item?item.host:item;if(!host)continue;
    if(!index.edges.has(edgeKey(host))||!between(hostParameter(host)))fail('host');
    if(host.tq&&host.t!==toNumber(hostParameter(host)))fail('host-projection');
  }
  const points=new Map(index.points),nodes=new Map(index.nodes),changed=new Map<string,GraphNode>();
  const first={id:old.id,p:encodePoint(p)};points.set(first.id,p);nodes.set(first.id,first);changed.set(first.id,first);
  const deps=before.dependencies.filter(d=>!op.detachDependency||d.node!==op.node),depChanges=new Map<string,GraphDependency>();
  for(const previous of dependencyOrder({...before,dependencies:deps})){
    if(!previous.refs.some(r=>changed.has(r.from)||changed.has(r.to)))continue;
    const d=clone(previous);let value:ExactPoint;
    if(d.kind==='intersection'){
      const[a,b]=d.refs,hit=intersection(points.get(a.from)!,points.get(a.to)!,points.get(b.from)!,points.get(b.to)!);
      if(!hit||!between(hit.t)||!between(hit.u))fail('dependency-intersection',d.node);
      d.parameters=[encodeRational(hit.t),encodeRational(hit.u)];value=hit.p;
    }else value=pointAt(points.get(d.refs[0].from)!,points.get(d.refs[0].to)!,decodeRational(d.parameters[0]));
    const n={id:d.node,p:encodePoint(value)};points.set(n.id,value);nodes.set(n.id,n);changed.set(n.id,n);depChanges.set(d.node,d);
  }
  const affected=new Map<string,GraphEdge>();
  for(const id of changed.keys())for(const edge of index.incident.get(id)||[])affected.set(edgeKey(edge),edge);
  const affectedRoomIds=new Set([...affected.keys()].flatMap(key=>index.owners.get(key)||[]));
  const dirty=new Set([...(index.dirtyEdges||[]),...affected.keys()]);
  for(const edge of affected.values()){
    const candidates=new Map(queryTree(index.edgeTree,boxPoints(points.get(edge.from)!,points.get(edge.to)!),[]).map(e=>[edgeKey(e),e]));
    for(const key of dirty){const e=index.edges.get(key);if(e)candidates.set(key,e);}
    for(const other of candidates.values())if(edgeKey(other)!==edgeKey(edge)&&properCross(edge,other,points))fail('unsplit-crossing',edgeKey(edge));
  }
  const rooms=before.rooms.filter(room=>affectedRoomIds.has(room.room));
  const edgeIds=new Set([...affected.keys(),...rooms.flatMap(room=>room.edges.map(edgeKey))]);
  const edges=before.edges.filter(e=>edgeIds.has(edgeKey(e))),ids=new Set(edges.flatMap(e=>[e.from,e.to]));
  for(const d of depChanges.values()){ids.add(d.node);for(const ref of d.refs){ids.add(ref.from);ids.add(ref.to);}}
  assertGraph({version:1,nodes:[...ids].map(id=>nodes.get(id)!),edges,rooms,dependencies:[...depChanges.values()]});
  const graph=freezeGraph({...before,nodes:before.nodes.map(n=>changed.get(n.id)||n),
    dependencies:deps.map(d=>depChanges.get(d.node)||d)});
  preparedGraphs.set(graph,{...index,nodes,points,dirtyEdges:dirty});
  return{graph,changed:op.detachDependency===true||[...changed].some(([id,n])=>JSON.stringify(n)!==JSON.stringify(index.nodes.get(id))),mapping:emptyMapping(),
    touched:{nodes:[...changed.keys()],edges:[...affected.values()].map(targetRef),rooms:rooms.map(r=>r.room),hosts:[]},diagnostics:[]};
}
export function applyGraphOperation(before: PlanGraph, operation: GraphOperation,
  context: OperationContext = {}): GraphResult {
  if(operation.kind==='move-node'){const fast=preparedMove(before,operation,context);if(fast)return fast;}
  const originalIndex=assertGraph(before, { ...context, projection: undefined });
  const originalRooms=new Map(before.rooms.map(r=>[r.room,r]));
  let graph = clone(before);
  const mapping = emptyMapping(), hostRecords = (context.hosts || []).map((item, i) => ({
    id: String(item.id ?? i), host: clone(item && 'host' in item ? item.host : item),
  })).filter(item=>item.host);
  const findEdge = (ref: EdgeRef): GraphEdge => graph.edges.find(e => edgeKey(e) === edgeKey(ref)) || fail('edge-missing', edgeKey(ref));
  const findNode = (id: string): GraphNode => graph.nodes.find(n => n.id === id) || fail('node-missing', id);
  const addNode = (node: GraphNode): void => {
    if (graph.nodes.some(n => n.id === node.id)) fail('node-id', node.id);
    decodePoint(node.p); graph.nodes.push(clone(node));
  };
  const addEdge = (edge: GraphEdge): GraphEdge => {
    if (graph.edges.some(e => edgeKey(e) === edgeKey(edge))) fail('edge-id', edgeKey(edge));
    const added=clone(edge);graph.edges.push(added);return added;
  };
  const retire = (node: string): void => { graph.dependencies = graph.dependencies.filter(d => d.node !== node); };
  const setDependency = (dep: GraphDependency): void => { retire(dep.node); graph.dependencies.push(clone(dep)); };
  const remapHosts = (old: EdgeRef, ranges: EdgeRange[]): void => {
    for (const record of hostRecords) if (edgeKey(record.host) === edgeKey(old)) {
      const t = hostParameter(record.host);
      const range = ranges.find(r => cmp(t, decodeRational(r.sourceInterval[0])) >= 0
        && cmp(t, decodeRational(r.sourceInterval[1])) <= 0) || fail('host-remap', record.id);
      const start = decodeRational(range.sourceInterval[0]), end = decodeRational(range.sourceInterval[1]);
      let next = div(sub(t, start), sub(end, start)); if (range.reverse) next = sub(ONE, next);
      record.host = canonicalHost({ ...record.host, ...range.ref },next);
      mapping.hosts[record.id] = clone(record.host);
    }
  };
  const split = (ref: EdgeRef, t: Exact, nodeId: string, newEdgeId: string): void => {
    if (cmp(t, ZERO) <= 0 || cmp(t, ONE) >= 0) fail('split-parameter');
    const edge = findEdge(ref), a = findNode(edge.from), b = findNode(edge.to);
    const point = pointAt(decodePoint(a.p), decodePoint(b.p), t);
    const node = graph.nodes.find(n => n.id === nodeId);
    if (node && !pointEq(decodePoint(node.p), point)) fail('split-point');
    if (!node) addNode({ id: nodeId, p: encodePoint(point) });
    const oldTo = edge.to, next = { ...clone(edge), id: newEdgeId, from: nodeId };
    addEdge(next); edge.to = nodeId;
    const ranges: EdgeRange[] = [
      { ref: targetRef(edge), sourceInterval: [encodeRational(ZERO), encodeRational(t)], reverse: false },
      { ref: targetRef(next), sourceInterval: [encodeRational(t), encodeRational(ONE)], reverse: false },
    ];
    // Compose prior ranges so callers receive mappings from the original graph.
    for (const list of Object.values(mapping.edges)) {
      const i = list.findIndex(r => edgeKey(r.ref) === edgeKey(ref));
      if (i >= 0) {
        const prev = list[i], lo = decodeRational(prev.sourceInterval[0]), hi = decodeRational(prev.sourceInterval[1]);
        const mid = add(lo, mul(sub(hi, lo), prev.reverse ? sub(ONE, t) : t));
        list.splice(i, 1, ...(prev.reverse ? [
          { ref: targetRef(next), sourceInterval: [encodeRational(lo), encodeRational(mid)] as [ExactRational, ExactRational], reverse: true },
          { ref: targetRef(edge), sourceInterval: [encodeRational(mid), encodeRational(hi)] as [ExactRational, ExactRational], reverse: true },
        ] : [
          { ref: targetRef(edge), sourceInterval: [encodeRational(lo), encodeRational(mid)] as [ExactRational, ExactRational], reverse: false },
          { ref: targetRef(next), sourceInterval: [encodeRational(mid), encodeRational(hi)] as [ExactRational, ExactRational], reverse: false },
        ]));
      }
    }
    if (!mapping.edges[edgeKey(ref)]) mapping.edges[edgeKey(ref)] = ranges;
    for (const room of graph.rooms) room.edges = room.edges.flatMap(r =>
      edgeKey(r) !== edgeKey(ref) ? [r] : r.reverse
        ? [{ ...targetRef(next), reverse: true }, { ...targetRef(edge), reverse: true }]
        : [{ ...targetRef(edge), reverse: false }, { ...targetRef(next), reverse: false }]);
    setDependency({ node: nodeId, kind: 'on-edge', refs: [{ from: edge.from, to: oldTo }], parameters: [encodeRational(t)] });
    remapHosts(ref, ranges);
  };
  const apply = (op: GraphOperation): void => {
    switch (op.kind) {
      case 'batch': for (const item of op.operations) apply(item); return;
      case 'create-node': addNode(op.node); return;
      case 'create-edge': addEdge(op.edge); return;
      case 'retarget-edge': { const edge=findEdge(op.edge);findNode(op.from);findNode(op.to);edge.from=op.from;edge.to=op.to;return; }
      case 'set-dependency': findNode(op.dependency.node); setDependency(op.dependency); return;
      case 'retire-dependency': findNode(op.node); retire(op.node); return;
      case 'move-node': {
        const node = findNode(op.node); decodePoint(op.target);
        if (graph.dependencies.some(d => d.node === node.id)) {
          if (!op.detachDependency && !pointEq(decodePoint(node.p), decodePoint(op.target))) fail('dependent-move', node.id);
          if (op.detachDependency) retire(node.id);
        }
        node.p = clone(op.target); return;
      }
      case 'detach-node': {
        const source = findNode(op.node); addNode({ id: op.newId, p: clone(op.target) });
        const selected = new Set(op.rooms);
        for (const ref of op.edges) {
          const edge = findEdge(ref); if (edge.from !== source.id && edge.to !== source.id) fail('detach-incidence');
          const outside = graph.rooms.some(r => !selected.has(r.room) && r.edges.some(e => edgeKey(e) === edgeKey(edge)));
          let target = edge;
          if (outside) {
            const newId = op.edgeIds?.[edgeKey(edge)] || fail('detach-edge-id');
            target = addEdge({ ...clone(edge), id: newId });
            for (const room of graph.rooms) if (selected.has(room.room))
              room.edges = room.edges.map(r => edgeKey(r) === edgeKey(edge) ? { ...r, id: newId } : r);
            for (const host of hostRecords) if (op.hosts?.includes(host.id) && edgeKey(host.host) === edgeKey(edge)) {
              host.host = { ...host.host, id: newId }; mapping.hosts[host.id] = clone(host.host);
            }
          }
          if (target.from === source.id) target.from = op.newId;
          if (target.to === source.id) target.to = op.newId;
        }
        mapping.nodes[source.id] = [source.id, op.newId]; return;
      }
      case 'translate-edges': {
        const ids = new Set(op.edges.flatMap(ref => { const e = findEdge(ref); return [e.from, e.to]; }));
        const delta = decodePoint(op.delta);
        for (const id of ids) {
          if (graph.dependencies.some(d => d.node === id && d.refs.some(r => !ids.has(r.from) || !ids.has(r.to))))
            fail('dependent-move', id);
          const n = findNode(id); n.p = encodePoint(pointAdd(decodePoint(n.p), delta));
        }
        return;
      }
      case 'insert-on-edge': split(op.edge, decodeRational(op.t), op.node, op.newEdgeId); return;
      case 'insert-intersection': {
        const a = findEdge(op.refs[0]), b = findEdge(op.refs[1]);
        const support = [{ from: a.from, to: a.to }, { from: b.from, to: b.to }];
        const hit = intersection(decodePoint(findNode(a.from).p), decodePoint(findNode(a.to).p),
          decodePoint(findNode(b.from).p), decodePoint(findNode(b.to).p));
        if (!hit || !between(hit.t) || !between(hit.u)) fail('intersection');
        split(op.refs[0], hit.t, op.node, op.newEdgeIds[0]);
        split(op.refs[1], hit.u, op.node, op.newEdgeIds[1]);
        setDependency({ node: op.node, kind: 'intersection', refs: support,
          parameters: [encodeRational(hit.t), encodeRational(hit.u)] }); return;
      }
      case 'delete-edge': {
        const e = findEdge(op.edge);
        if (graph.rooms.some(r => r.edges.some(ref => edgeKey(ref) === edgeKey(e)))) fail('edge-owned');
        for (const host of hostRecords) if (edgeKey(host.host) === edgeKey(e) && !op.removeHosts?.includes(host.id)) fail('edge-hosted');
        graph.edges = graph.edges.filter(x => x !== e);
        for (const id of op.removeHosts || []) mapping.hosts[id] = null;
        return;
      }
      case 'replace-room-cycle': {
        const old = graph.rooms.find(r => r.room === op.room);
        if (old) old.edges = clone(op.edges); else graph.rooms.push({ room: op.room, edges: clone(op.edges) });
        return;
      }
      case 'delete-face': graph.rooms = graph.rooms.filter(r => r.room !== op.room); return;
      case 'merge-faces':
        graph.rooms = graph.rooms.filter(r => !op.remove.includes(r.room) && r.room !== op.room);
        graph.rooms.push({ room: op.room, edges: clone(op.edges) }); return;
      case 'convert-edge': {
        const source=findEdge(op.edge),old=targetRef(source);
        if(edgeKey(old)===edgeKey(op.target)){if(op.cm!==undefined)source.cm=op.cm;return;}
        const target=graph.edges.find(e=>edgeKey(e)===edgeKey(op.target));let reverse=false;
        if(target){
          const a=decodePoint(findNode(source.from).p),b=decodePoint(findNode(source.to).p);
          const c=decodePoint(findNode(target.from).p),d=decodePoint(findNode(target.to).p);
          if(pointEq(a,c)&&pointEq(b,d))reverse=false;
          else if(pointEq(a,d)&&pointEq(b,c))reverse=true;
          else fail('convert-geometry');
          for(const[k,value]of Object.entries(source.props||{}))
            if(k in (target.props||{})&&JSON.stringify(target.props![k])!==JSON.stringify(value))fail('props-conflict',k);
          const props={...(source.props||{}),...(target.props||{})};
          if(Object.keys(props).length)target.props=props;
          if(op.cm!==undefined)target.cm=op.cm;
          graph.edges=graph.edges.filter(e=>e!==source);
        }else{
          source.id=op.target.id;source.kind=op.target.kind;if(op.cm!==undefined)source.cm=op.cm;
        }
        for(const room of graph.rooms)room.edges=room.edges.map(ref=>edgeKey(ref)===edgeKey(old)
          ?{...op.target,reverse:ref.reverse!==reverse}:ref);
        const ranges:EdgeRange[]=[{ref:targetRef(op.target),sourceInterval:[['0','1'],['1','1']],reverse}];
        mapping.edges[edgeKey(old)]=ranges;remapHosts(old,ranges);return;
      }
      case 'set-thickness': for (const ref of op.edges) findEdge(ref).cm = op.cm; return;
      case 'rehost-opening': {
        findEdge(op.host); if (!between(decodeRational(op.host.t))) fail('host-parameter');
        const host = hostRecords.find(r => r.id === op.opening);
        const canonical=canonicalHost(op.host,decodeRational(op.host.t));
        if (host) host.host = canonical;
        mapping.hosts[op.opening] = canonical; return;
      }
      case 'collapse-node': {
        const keep = findEdge(op.retained), remove = findEdge(op.removed), p = findNode(op.node);
        if (![keep.from, keep.to].includes(p.id) || ![remove.from, remove.to].includes(p.id)) fail('collapse-incidence');
        const left = keep.from === p.id ? keep.to : keep.from, right = remove.from === p.id ? remove.to : remove.from;
        const affectedDependencies=graph.dependencies.filter(d=>d.node!==p.id&&d.refs.some(r=>r.from===p.id||r.to===p.id));
        if(affectedDependencies.some(d=>!op.retireDependencies?.includes(d.node)))fail('dependency-support');
        if (graph.edges.some(e => e !== keep && e !== remove && [e.from, e.to].includes(p.id))) fail('collapse-degree');
        const oldKeep = clone(keep), oldRemove = clone(remove);
        if (keep.from === p.id) keep.from = right; else keep.to = right;
        for (const room of graph.rooms) {
          room.edges = room.edges.filter(r => edgeKey(r) !== edgeKey(remove));
          for (let i = 0; i < room.edges.length; i++) if (edgeKey(room.edges[i]) === edgeKey(keep)) {
            const prev = room.edges[(i + room.edges.length - 1) % room.edges.length], prevEdge = findEdge(prev);
            const start = prev.reverse ? prevEdge.from : prevEdge.to;
            room.edges[i].reverse = keep.to === start;
          }
        }
        for (const host of hostRecords) if ([edgeKey(keep), edgeKey(remove)].includes(edgeKey(host.host))) {
          const old = edgeKey(host.host) === edgeKey(keep) ? oldKeep : oldRemove;
          const t = hostParameter(host.host);
          const point = pointAt(decodePoint(findNode(old.from).p), decodePoint(findNode(old.to).p), t);
          const next = projectParameter(point, decodePoint(findNode(keep.from).p), decodePoint(findNode(keep.to).p));
          host.host = canonicalHost({ ...host.host, ...targetRef(keep) },next); mapping.hosts[host.id] = clone(host.host);
        }
        graph.edges = graph.edges.filter(e => e !== remove);
        graph.dependencies = graph.dependencies.filter(d => d.node !== p.id && !d.refs.some(r => r.from === p.id || r.to === p.id));
        graph.nodes = graph.nodes.filter(n => n !== p); mapping.nodes[p.id] = [];
        mapping.edges[edgeKey(remove)] = [{ ref: targetRef(keep), sourceInterval: [['0','1'],['1','1']], reverse: false }];
        void left; return;
      }
      case 'normalize-current': return; // Canonical serialization only: preserve intentional detach.
      case 'restore-graph': assertGraph(op.graph, context); graph = clone(op.graph); return;
      case 'import-graph': {
        assertGraph(op.graph);
        const mapNode = (id: string): string => op.nodes[id] || fail('import-node-map', id);
        const mapEdge = (r: EdgeRef): EdgeRef => ({ kind: r.kind, id: op.edges[edgeKey(r)] || fail('import-edge-map') });
        for (const n of op.graph.nodes) addNode({ id: mapNode(n.id), p: clone(n.p) });
        for (const e of op.graph.edges) addEdge({ ...clone(e), ...mapEdge(e), from: mapNode(e.from), to: mapNode(e.to) });
        for (const r of op.graph.rooms) graph.rooms.push({ room: op.rooms[r.room] || fail('import-room-map'),
          edges: r.edges.map(e => ({ ...mapEdge(e), reverse: e.reverse })) });
        for (const d of op.graph.dependencies) graph.dependencies.push({ ...clone(d), node: mapNode(d.node),
          refs: d.refs.map(r => ({ from: mapNode(r.from), to: mapNode(r.to) })) });
        return;
      }
      default: { const exhaustive: never = op; fail('operation', String(exhaustive)); }
    }
  };
  apply(operation); evaluateDependencies(graph); graph = freezeGraph(canonicalGraph(graph));
  const remainingHosts = hostRecords.filter(h => mapping.hosts[h.id] !== null).map(h => h.host);
  const validatedIndex=assertGraph(graph, { ...context, projection: undefined, hosts: remainingHosts, roomIds: undefined });
  preparedGraphs.set(graph,validatedIndex);
  const nextNodeIds=new Set(graph.nodes.map(n=>n.id)),nextEdgeKeys=new Set(graph.edges.map(edgeKey)),nextRoomIds=new Set(graph.rooms.map(r=>r.room));
  const changedNode = [...graph.nodes.filter(n => JSON.stringify(n) !== JSON.stringify(originalIndex.nodes.get(n.id))).map(n => n.id),
    ...before.nodes.filter(n=>!nextNodeIds.has(n.id)).map(n=>n.id)];
  const changedSet=new Set(changedNode);
  const changedEdge = [...graph.edges.filter(e => changedSet.has(e.from)||changedSet.has(e.to)||JSON.stringify(e) !== JSON.stringify(originalIndex.edges.get(edgeKey(e)))).map(targetRef),
    ...before.edges.filter(e=>!nextEdgeKeys.has(edgeKey(e))).map(targetRef)];
  const changedEdgeSet=new Set(changedEdge.map(edgeKey));
  const changedRoom = [...graph.rooms.filter(r => r.edges.some(e=>changedEdgeSet.has(edgeKey(e)))||JSON.stringify(r) !== JSON.stringify(originalRooms.get(r.room))).map(r => r.room),
    ...before.rooms.filter(r=>!nextRoomIds.has(r.room)).map(r=>r.room)];
  return { graph, changed: JSON.stringify(graph) !== JSON.stringify(before), mapping,
    touched: { nodes: changedNode, edges: changedEdge, rooms: changedRoom, hosts: Object.keys(mapping.hosts) }, diagnostics: [] };
}
export interface GraphGesture {
  graph: PlanGraph; bindings: GraphBindings; space: Record<string, any>;
  scope: { rooms: string[]; edges: EdgeRef[]; nodes: string[] }; fingerprint: string;
}
export function createGraphGesture(space: Record<string, any>, scope: GraphGesture['scope']): GraphGesture {
  const graph = space.plan_graph as PlanGraph; assertGraph(graph);
  const projected = projectGraphSpace(space, graph);
  return { graph: clone(graph), space: clone(space), bindings: projected.bindings, scope: clone(scope), fingerprint: JSON.stringify(graph) };
}
/** The caller supplies the operation; carrier differences never decide topology. */
export function adaptGraphDraft(binding: GraphGesture, draft: Record<string, any>, operation: GraphOperation,
  currentGraph: PlanGraph = binding.graph): GraphResult & { space: Record<string, any>; bindings: GraphBindings } {
  if (JSON.stringify(currentGraph) !== binding.fingerprint) fail('stale-binding');
  const result = applyGraphOperation(binding.graph, operation, { hosts: binding.space.openings || [] });
  const allowedNodes = new Set(binding.scope.nodes), allowedEdges = new Set(binding.scope.edges.map(edgeKey));
  if (result.touched.nodes.some(id => binding.graph.nodes.some(n => n.id === id) && !allowedNodes.has(id))
      || result.touched.edges.some(r => binding.graph.edges.some(e => edgeKey(e) === edgeKey(r)) && !allowedEdges.has(edgeKey(r)))
      || result.touched.rooms.some(id => !binding.scope.rooms.includes(id))) fail('operation-scope');
  const base = clone(draft);
  for (const opening of base.openings || []) if (opening.id in result.mapping.hosts) {
    const host = result.mapping.hosts[opening.id]; if (host) opening.host = host; else delete opening.host;
  }
  const projected = projectGraphSpace(base, result.graph);
  // Draft is a numerical carrier only; the explicit command must explain it.
  for (const room of draft.rooms || []) {
    const expected = projected.space.rooms.find((r: any) => r.id === room.id);
    if (expected && JSON.stringify(room.poly) !== JSON.stringify(expected.poly)) fail('unexplained-draft', room.id);
  }
  return { ...result, ...projected };
}

// Frozen legacy ID codec; kept local to avoid a current-commit -> core import cycle.
const sha256 = (text: string): Uint8Array => {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const size = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(size);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(size - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(size - 4, bitLength >>> 0, false);
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));
  for (let offset = 0; offset < size; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + k[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < h.length; i++) outView.setUint32(i * 4, h[i], false);
  return out;
};

const base32 = (bytes: Uint8Array): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, value = 0, result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
};

export function legacyWallSegmentId(spaceId: string, a: number[], b: number[], owners: string[]): string {
  const key = (p: number[]) => Number(p[0]).toFixed(12) + ',' + Number(p[1]).toFixed(12);
  const ca = key(a) <= key(b) ? a : b, cb = ca === a ? b : a;
  return 'wall-' + base32(sha256(spaceId + '|' + key(ca) + '|' + key(cb) + '|' + [...owners].sort(order).join(','))).slice(0,20);
}

interface SourceEdge extends EdgeRef {
  a: ExactPoint; b: ExactPoint; raw: any; cm: number; reversed: boolean; owners: Set<string>;
}
interface SourcePoint { ref: string; p: ExactPoint; endpoints: string[] }
interface Cut { t: Exact; node: string }
interface SourceBoundary { source: string; start: Exact; end: Exact; startRef: string; endRef: string }
export interface MigrationReport { moved: number; joined: number; maxDisplacementCm: number; bends: number }
export interface MigratedGraphSpace<T = Record<string, any>> extends GraphResult {
  space: T; bindings: GraphBindings; migrationReport: MigrationReport;
}
export interface MigrationOptions { cellCm?: number; limits?: Partial<GraphLimits>; sourceModelVersion?: number }
const sourceNodeId = (ref: string): string => {
  const id='n:'+encodeURIComponent(ref);return id.length<=4096?id:'n:h:'+base32(sha256(ref));
};
export const graphSplitId=(kind:EdgeKind,id:string,index:number,lo:ExactRational,hi:ExactRational):string=>{
  const plain=id+'~'+index;
  return plain.length<=64?plain:'s:'+base32(sha256(JSON.stringify([kind,id,index,lo,hi]))).slice(0,52);
};
interface Box { lo: ExactPoint; hi: ExactPoint }
interface Tree<T> extends Box { left?: Tree<T>; right?: Tree<T>; items?: T[] }
const boxPoints = (a: ExactPoint, b: ExactPoint): Box => ({
  lo: [min(a[0], b[0]), min(a[1], b[1])], hi: [max(a[0], b[0]), max(a[1], b[1])],
});
function makeTree<T>(items: T[], box: (item: T) => Box, depth = 0): Tree<T> | null {
  if (!items.length) return null;
  const boxes = items.map(box), lo: ExactPoint = [boxes[0].lo[0], boxes[0].lo[1]], hi: ExactPoint = [boxes[0].hi[0], boxes[0].hi[1]];
  let x0 = lo[0], y0 = lo[1], x1 = hi[0], y1 = hi[1];
  for (const b of boxes) { x0 = min(x0, b.lo[0]); y0 = min(y0, b.lo[1]); x1 = max(x1, b.hi[0]); y1 = max(y1, b.hi[1]); }
  const result: Tree<T> = { lo: [x0, y0], hi: [x1, y1] };
  if (items.length <= 8) result.items = items;
  else {
    const axis = depth % 2;
    items.sort((a, b) => cmp(add(box(a).lo[axis], box(a).hi[axis]), add(box(b).lo[axis], box(b).hi[axis])));
    const mid = Math.floor(items.length / 2);
    result.left = makeTree(items.slice(0, mid), box, depth + 1)!;
    result.right = makeTree(items.slice(mid), box, depth + 1)!;
  }
  return result;
}
function queryTree<T>(tree: Tree<T> | null | undefined, query: Box, out: T[]): T[] {
  if (!tree || [0, 1].some(i => cmp(tree.hi[i], query.lo[i]) < 0 || cmp(tree.lo[i], query.hi[i]) > 0)) return out;
  if (tree.items) out.push(...tree.items);
  else { queryTree(tree.left, query, out); queryTree(tree.right, query, out); }
  return out;
}
function collectSources(space: Record<string, any>): {
  sources: SourceEdge[]; points: SourcePoint[]; boundaries: Map<string, SourceBoundary[]>;
} {
  const sources = new Map<string, SourceEdge>(), pointTable = new Map<string, SourcePoint>();
  const exactSources=new Map<string,SourceEdge>();
  const boundaries = new Map<string, SourceBoundary[]>(), roomOnly = new Map<string, { a: number[]; b: number[]; owners: string[]; preferred: string[] }>();
  const addSource = (raw: any, kind: EdgeKind, owners: string[] = []): SourceEdge => {
    if (!idValid(raw.id)) fail('source-edge-id');
    const a = readSourcePoint(raw.a), b = readSourcePoint(raw.b), reversed = pointCmp(a, b) > 0;
    if (pointEq(a, b)) fail('zero-length');
    const result: SourceEdge = { kind, id: raw.id, a: reversed ? b : a, b: reversed ? a : b,
      raw: clone(raw), cm: Number(raw.cm ?? 0), reversed, owners: new Set(owners) };
    if (sources.has(edgeKey(result))) fail('duplicate-id', edgeKey(result));
    sources.set(edgeKey(result), result);
    if(kind==='wall')exactSources.set(pointKey(result.a)+'|'+pointKey(result.b),result);return result;
  };
  for (const raw of space.wall_segments || []) addSource(raw, 'wall');
  for (const raw of space.partitions || []) addSource(raw, 'partition');
  const roomPolys = new Map<string, number[][]>();
  for (const room of space.rooms || []) {
    if (!idValid(room.id) || roomPolys.has(room.id)) fail('room');
    const poly: number[][] = room.poly || (['x','y','w','h'].every(k => Number.isFinite(room[k])) ? [
      [room.x,room.y],[room.x+room.w,room.y],[room.x+room.w,room.y+room.h],[room.x,room.y+room.h],
    ] : []);
    if (poly.length < 3) fail('room');
    roomPolys.set(room.id, poly);
    for (let i = 0; i < poly.length; i++) {
      const a = readSourcePoint(poly[i]), b = readSourcePoint(poly[(i + 1) % poly.length]);
      const key = pointCmp(a,b) <= 0 ? pointKey(a) + '|' + pointKey(b) : pointKey(b) + '|' + pointKey(a);
      if (!room.wall_ids?.[i] || !sources.has('wall:' + room.wall_ids[i])) {
        const same = exactSources.get(key);
        if (!same) {
          const value = roomOnly.get(key) || { a: poly[i], b: poly[(i+1)%poly.length], owners: [], preferred: [] };
          value.owners.push(room.id);if(idValid(room.wall_ids?.[i]))value.preferred.push(room.wall_ids[i]); roomOnly.set(key,value);
        }
      }
    }
  }
  const generated = [...roomOnly].sort(([a],[b]) => order(a,b));
  const generatedByKey = new Map<string, SourceEdge>();
  for (const [key, item] of generated) {
    const base = [...item.preferred].sort(order)[0] || legacyWallSegmentId(String(space.id || ''),item.a,item.b,item.owners);
    let id = base;
    for (let suffix=2;sources.has('wall:'+id);suffix++) id=base+'-'+suffix;
    // Legacy wall overlays are decoded by the existing compatibility key.
    const overlay = (space.walls || []).find((w: any) => w.key === wallKey(item.a,item.b,1/240));
    generatedByKey.set(key, addSource({ id,a:item.a,b:item.b,cm:Number(overlay?.cm ?? 0) },'wall',item.owners));
  }
  const all = [...sources.values()].sort((a,b)=>order(edgeKey(a),edgeKey(b)));
  const addPoint = (ref: string,p: ExactPoint,endpoint?:string): void => {
    const old = pointTable.get(ref);
    if (old && !pointEq(old.p,p)) fail('source-reference');
    if (!old) pointTable.set(ref,{ref,p,endpoints:endpoint?[endpoint]:[]});
    else if(endpoint && !old.endpoints.includes(endpoint)) old.endpoints.push(endpoint);
  };
  for(const source of all) {
    addPoint(JSON.stringify([source.kind,source.id,0]),source.a,edgeKey(source)+':0');
    addPoint(JSON.stringify([source.kind,source.id,1]),source.b,edgeKey(source)+':1');
  }
  for(const room of space.rooms || []) {
    const poly=roomPolys.get(room.id)!, result:SourceBoundary[]=[];
    for(let i=0;i<poly.length;i++) {
      const a=readSourcePoint(poly[i]),b=readSourcePoint(poly[(i+1)%poly.length]);
      const low=pointCmp(a,b)<=0?a:b,high=low===a?b:a,key=pointKey(low)+'|'+pointKey(high);
      const source=(room.wall_ids?.[i] && sources.get('wall:'+room.wall_ids[i]))
        || exactSources.get(key) || generatedByKey.get(key);
      if(!source) fail('source-room-edge');
      source.owners.add(room.id);
      const ta=projectParameter(a,source.a,source.b),tb=projectParameter(b,source.a,source.b);
      if(!between(ta)||!between(tb)) fail('source-room-range');
      result.push({source:edgeKey(source),start:ta,end:tb,startRef:JSON.stringify(['room',room.id,pointKey(a)]),endRef:JSON.stringify(['room',room.id,pointKey(b)])});
      // Repeated same-coordinate room owners are source constraints as well.
      addPoint(JSON.stringify(['room',room.id,pointKey(a)]),a);
    }
    boundaries.set(room.id,result);
  }
  return {sources:all,points:[...pointTable.values()].sort((a,b)=>order(a.ref,b.ref)),boundaries};
}
/** Detached v10 -> one exact graph. Current11 never uses this reconstruction. */
export function migrateGraphSpace<T extends Record<string, any>>(space: T, options: MigrationOptions = {}): MigratedGraphSpace<T> {
  if(space.plan_graph) fail('current-migration');
  const source=collectSources(space),sourceByKey=new Map(source.sources.map(s=>[edgeKey(s),s])), radius=microRadius(options.cellCm ?? Number(space.cell_cm || 5));
  const limits={...GRAPH_LIMITS,...options.limits};
  const sourceVersion=options.sourceModelVersion??(Array.isArray(space.wall_segments)&&space.wall_segments.length?10:0);
  if(!Number.isInteger(sourceVersion)||sourceVersion<0||sourceVersion>10)fail('source-version');
  const canonicalSegments=new Set((space.wall_segments||[]).map((e:any)=>e.id));
  if(source.sources.length>limits.edges || (space.rooms||[]).length>limits.rooms) fail('resource');
  const run=(optional:boolean):MigratedGraphSpace<T>=>{
    const graph:PlanGraph={version:1,nodes:[],edges:[],rooms:[],dependencies:[]};
    const nodes=new Map<string,GraphNode>(), origins=new Map<string,SourcePoint[]>(), pointNode=new Map<string,string>();
    const sourcePointNode=new Map<string,string>(), endpointNode=new Map<string,string>(), buckets=new Map<string,Set<string>>();
    const cutMap=new Map<string,Cut[]>(), mapping=emptyMapping();
    const installDependency=(dep:GraphDependency):void=>{
      graph.dependencies=graph.dependencies.filter(d=>d.node!==dep.node);graph.dependencies.push(dep);
      // Reciprocal legacy contacts are incidence, not a cyclic affine program.
      // A deterministic existing source node becomes a free anchor; no point moves.
      while(true){
        try{dependencyOrder(graph);break;}catch(error){
          if(!(error instanceof PlanGraphError)||error.code!=='dependency-cycle')throw error;
          const count=graph.dependencies.length;
          graph.dependencies=graph.dependencies.filter(d=>d.node!==error.subject);
          if(graph.dependencies.length===count)throw error;
        }
      }
    };

    let bends=0;
    const bucket=(p:ExactPoint):[bigint,bigint]=>[floor(div(p[0],radius)),floor(div(p[1],radius))];
    const place=(id:string,p:ExactPoint,owners:SourcePoint[])=>{
      const node=nodes.get(id);
      if(node) { const oldKey=pointKey(decodePoint(node.p));if(pointNode.get(oldKey)===id)pointNode.delete(oldKey);node.p=encodePoint(p); } else {const n={id,p:encodePoint(p)};nodes.set(id,n);graph.nodes.push(n);}
      origins.set(id,owners);
      pointNode.set(pointKey(p),id);
      const b=bucket(p),key=b[0]+','+b[1], list=buckets.get(key)||new Set<string>();list.add(id);buckets.set(key,list);
    };
    const compatible=(owner:SourcePoint,id:string,p:ExactPoint):boolean=>{
      const group=origins.get(id)||[];
      if(![owner,...group].every(s=>withinRadius(s.p,p,radius))) return false;
      const membership=new Set(group.flatMap(s=>s.endpoints));
      return owner.endpoints.every(ref=>!membership.has(ref.slice(0,-1)+(ref.endsWith('0')?'1':'0')));
    };
    for(const owner of source.points) {
      const b=bucket(owner.p),candidates:Array<{id?:string;p:ExactPoint}>=[];
      for(let x=-1n;x<=1n;x++)for(let y=-1n;y<=1n;y++)
        for(const id of buckets.get((b[0]+x)+','+(b[1]+y))||[]) {
          const p=decodePoint(nodes.get(id)!.p);
          if(withinRadius(owner.p,p,radius)&&compatible(owner,id,p)) candidates.push({id,p});
        }
      if(optional) {
        const grid:ExactPoint=[exact(nearestInteger(mul(owner.p[0],exact(240n))),240n),exact(nearestInteger(mul(owner.p[1],exact(240n))),240n)];
        if(withinRadius(owner.p,grid,radius)) {
          const id=pointNode.get(pointKey(grid));
          if(!id || compatible(owner,id,grid)) candidates.push({id,p:grid});
        }
      }
      const exactExisting=pointNode.get(pointKey(owner.p));
      if(exactExisting && compatible(owner,exactExisting,owner.p)) candidates.push({id:exactExisting,p:owner.p});
      const ranked=candidates.filter(c=>optional || pointEq(c.p,owner.p)).sort((a,b)=>
        cmp(squaredDistance(owner.p,a.p),squaredDistance(owner.p,b.p))||pointCmp(a.p,b.p)||order(a.id||'',b.id||''));
      const selected=ranked[0]||{p:owner.p},id=selected.id||sourceNodeId(owner.ref);
      const group=origins.get(id)||[];place(id,selected.p,[...group,owner]);sourcePointNode.set(owner.ref,id);
      for(const endpoint of owner.endpoints) endpointNode.set(endpoint,id);
    }
    const explicitCuts=sourceVersion<9?sanitizeOpenSpans(space.open_spans):[];
    const legacyCuts=explicitCuts.length ? explicitCuts.map(c=>[...c.a,...c.b])
      : sourceVersion<9?resolveOpenCuts(space.rooms||[],null,1,(1/240)*0.04,true):[];
    const zeroIntervals=new Map<string,Array<[Exact,Exact]>>(), openingIntervals=new Map<string,Array<[Exact,Exact]>>();
    for(const s of source.sources) cutMap.set(edgeKey(s),[
      {t:ZERO,node:endpointNode.get(edgeKey(s)+':0')!},{t:ONE,node:endpointNode.get(edgeKey(s)+':1')!}]);
    const tree=makeTree([...source.sources],s=>boxPoints(s.a,s.b));
    const addCut=(s:SourceEdge,t:Exact,id:string):void=>{
      if(!between(t)) return;
      const cuts=cutMap.get(edgeKey(s))!;
      if(!cuts.some(c=>eq(c.t,t)&&c.node===id)) cuts.push({t,node:id});
    };
    const contactCandidates=(p:ExactPoint):SourceEdge[]=>queryTree(tree,{lo:pointSub(p,[radius,radius]),hi:pointAdd(p,[radius,radius])},[])
      .sort((a,b)=>order(edgeKey(a),edgeKey(b)));
    const cutPoint=(host:SourceEdge,t:Exact,tag:string):void=>{
      if(cmp(t,ZERO)<=0||cmp(t,ONE)>=0)return;
      const ends=cutMap.get(edgeKey(host))!,p=pointAt(decodePoint(nodes.get(ends[0].node)!.p),decodePoint(nodes.get(ends[1].node)!.p),t);
      let id=pointNode.get(pointKey(p));if(!id){id=sourceNodeId(JSON.stringify(['cut',edgeKey(host),encodeRational(t)]));place(id,p,[]);}
      addCut(host,t,id);void tag;
    };
    const interval=(host:SourceEdge,a:ExactPoint,b:ExactPoint):[Exact,Exact]|null=>{
      const ta=projectParameter(a,host.a,host.b),tb=projectParameter(b,host.a,host.b);
      if(!withinRadius(a,pointAt(host.a,host.b,ta),radius)||!withinRadius(b,pointAt(host.a,host.b,tb),radius))return null;
      const lo=max(ZERO,min(ta,tb)),hi=min(ONE,max(ta,tb));return cmp(lo,hi)<0?[lo,hi]:null;
    };
    for(const s of source.sources)if(s.kind==='wall'){
      const zeros:Array<[Exact,Exact]>=[],openingRuns:Array<[Exact,Exact]>=[];
      for(const cut of legacyCuts) {
        const run=interval(s,readSourcePoint(cut.slice(0,2)),readSourcePoint(cut.slice(2,4)));
        if(run){zeros.push(run);for(const t of run)cutPoint(s,t,'zero');}
      }
      zeroIntervals.set(edgeKey(s),zeros);
      for(const overlay of space.walls||[])if(Array.isArray(overlay.a)&&Array.isArray(overlay.b)){
        const run=interval(s,readSourcePoint(overlay.a),readSourcePoint(overlay.b));
        if(run)for(const t of run)cutPoint(s,t,'thickness');
      }
      for(const opening of space.openings||[])if(zeros.length && opening.host?.kind!=='partition'
          && Number.isFinite(opening.x)&&Number.isFinite(opening.y)&&Number(opening.length)>0
          && wallAngleMatches(pointToNumbers(s.a),pointToNumbers(s.b),Number(opening.angle))){
        const centre=readSourcePoint([opening.x,opening.y]),t=projectParameter(centre,s.a,s.b);
        if(!between(t)||!withinRadius(centre,pointAt(s.a,s.b,t),radius))continue;
        const length=Math.sqrt(toNumber(squaredDistance(s.a,s.b)));
        const half=div(parseDecimal(Number(opening.length)/2),parseDecimal(length));
        const run:[Exact,Exact]=[max(ZERO,sub(t,half)),min(ONE,add(t,half))];
        if(zeros.some(([lo,hi])=>cmp(t,lo)>=0&&cmp(t,hi)<=0)){
          openingRuns.push(run);for(const end of run)cutPoint(s,end,'opening');
        }
      }
      openingIntervals.set(edgeKey(s),openingRuns);
    }
    // Required old-reader endpoint contacts, evaluated after both host endpoints.
    for(const owner of source.points) {
      let node=sourcePointNode.get(owner.ref)!;
      const p0=owner.p;
      const candidates=contactCandidates(p0).filter(s=>!owner.endpoints.some(e=>e.startsWith(edgeKey(s)+':')));
      for(const host of candidates) {
        const oldT=projectParameter(p0,host.a,host.b);
        if(!between(oldT)) continue;
        const rawContact=pointAt(host.a,host.b,oldT);
        // P4/face-reader envelope. Its shift is still checked against R.
        if(!withinRadius(p0,rawContact,radius)) continue;
        if(!optional&&!storedWallContact(pointToNumbers(p0),pointToNumbers(host.a),pointToNumbers(host.b),1,true))continue;
        const ends=cutMap.get(edgeKey(host))!,a=decodePoint(nodes.get(ends[0].node)!.p),b=decodePoint(nodes.get(ends[1].node)!.p);
        const t=projectParameter(p0,a,b);if(!between(t)) continue;
        let p=pointAt(a,b,t),group=origins.get(node)!;
        if(!group.every(o=>withinRadius(o.p,p,radius))) {
          p=group.map(o=>o.p).find(candidate=>group.every(o=>withinRadius(o.p,candidate,radius))) || p0;
          if(!group.every(o=>withinRadius(o.p,p,radius))) continue;
          bends++;
        }
        // Never collapse the opposite ends of an existing source segment.
        if(group.some(o=>o.endpoints.some(e=>{
          const other=endpointNode.get(e.slice(0,-1)+(e.endsWith('0')?'1':'0'));
          return other!==node && other && pointEq(decodePoint(nodes.get(other)!.p),p);
        }))) continue;
        const existing=pointNode.get(pointKey(p));
        if(existing && existing!==node) {
          const others=origins.get(existing)||[];
          if(![...group,...others].every(o=>withinRadius(o.p,p,radius))) continue;
          const previous=node;
          for(const [key,value]of sourcePointNode)if(value===previous)sourcePointNode.set(key,existing);
          for(const [key,value]of endpointNode)if(value===previous)endpointNode.set(key,existing);
          for(const cuts of cutMap.values())for(const cut of cuts)if(cut.node===previous)cut.node=existing;
          origins.set(existing,[...others,...group]);nodes.delete(previous);graph.nodes=graph.nodes.filter(n=>n.id!==previous);
          for(const [key,value]of pointNode)if(value===previous)pointNode.delete(key);
          for(const ids of buckets.values())ids.delete(previous);
          node=existing;group=origins.get(node)!;
        }
        place(node,p,group); addCut(host,oldT,node);
        if(cmp(oldT,ZERO)>0&&cmp(oldT,ONE)<0 && pointEq(p,pointAt(a,b,t))) {
          graph.dependencies=graph.dependencies.filter(d=>d.node!==node);
          const from=ends[0].node,to=ends[1].node;
          if(node!==from&&node!==to) installDependency({node,kind:'on-edge',refs:[{from,to}],parameters:[encodeRational(t)]});
        }
        break;
      }
    }
    // Exact crossings; broad phase is a bounded tree, never an all-pairs scan.
    const sourcePosition=new Map(source.sources.map((s,i)=>[edgeKey(s),i]));
    for(const s of source.sources) {
      for(const other of queryTree(tree,boxPoints(s.a,s.b),[])) {
        if(sourcePosition.get(edgeKey(other))!<=sourcePosition.get(edgeKey(s))!)continue;
        const hit=intersection(s.a,s.b,other.a,other.b);
        if(!hit||!between(hit.t)||!between(hit.u))continue;
        const a=cutMap.get(edgeKey(s))!,b=cutMap.get(edgeKey(other))!;
        const sa=decodePoint(nodes.get(a[0].node)!.p),sb=decodePoint(nodes.get(a[1].node)!.p);
        const oa=decodePoint(nodes.get(b[0].node)!.p),ob=decodePoint(nodes.get(b[1].node)!.p);
        const current=intersection(sa,sb,oa,ob);
        const p=current&&between(current.t)&&between(current.u)&&withinRadius(current.p,hit.p,radius)?current.p:hit.p;
        let id=pointNode.get(pointKey(p));
        if(!id) { id=sourceNodeId(JSON.stringify(['intersection',edgeKey(s),edgeKey(other)]));place(id,p,[]); }
        addCut(s,hit.t,id);addCut(other,hit.u,id);
        if(current&&pointEq(p,current.p)&&![a[0].node,a[1].node,b[0].node,b[1].node].includes(id)) {
          graph.dependencies=graph.dependencies.filter(d=>d.node!==id);
          installDependency({node:id,kind:'intersection',refs:[{from:a[0].node,to:a[1].node},{from:b[0].node,to:b[1].node}],
            parameters:[encodeRational(current.t),encodeRational(current.u)]});
        } else if(!current||!pointEq(p,current.p)) bends++;
      }
    }
    // Room carrier vertices are explicit cuts on their named catalogue edge.
    for(const room of space.rooms||[]) {
      const poly=room.poly||[];
      for(const boundary of source.boundaries.get(room.id)||[]) {
        const host=sourceByKey.get(boundary.source)!;
        for(const [t,sourceRef] of [[boundary.start,boundary.startRef],[boundary.end,boundary.endRef]] as const) {
          const point=pointAt(host.a,host.b,t);
          let id=sourcePointNode.get(sourceRef)||pointNode.get(pointKey(point));
          if(!id) {
            const near=[...nodes.values()].find(n=>withinRadius(point,decodePoint(n.p),radius));
            id=near?.id;
          }
          if(!id) {id=sourceNodeId(JSON.stringify(['room-point',room.id,pointKey(point)]));place(id,point,[]);}
          addCut(host,t,id);
        }
      }
      void poly;
    }
    const byGeometry=new Map<string,GraphEdge[]>(), usedIds=new Set<string>();
    for(const s of source.sources) {
      const cuts=cutMap.get(edgeKey(s))!.sort((a,b)=>cmp(a.t,b.t)||order(a.node,b.node));
      const unique=cuts.filter((c,i)=>!i||!eq(c.t,cuts[i-1].t)||c.node!==cuts[i-1].node);
      const ranges:EdgeRange[]=[];
      for(let i=0;i+1<unique.length;i++) {
        const a=unique[i],b=unique[i+1];
        if(eq(a.t,b.t)||a.node===b.node||pointEq(decodePoint(nodes.get(a.node)!.p),decodePoint(nodes.get(b.node)!.p)))continue;
        const middle=div(add(a.t,b.t),exact(2n));
        const covered=(runs:Array<[Exact,Exact]>)=>runs.some(([lo,hi])=>cmp(middle,lo)>=0&&cmp(middle,hi)<=0);
        let cm=s.cm;
        if(s.kind==='wall'&&!(sourceVersion>=9&&canonicalSegments.has(s.id))){
          const pa=pointToNumbers(pointAt(s.a,s.b,a.t)),pb=pointToNumbers(pointAt(s.a,s.b,b.t));
          const resolved=thicknessCmAt(space.walls||[],pa,pb,1/240,1);
          const parent=(space.walls||[]).filter((w:any)=>w.key===wallKey(pointToNumbers(s.a),pointToNumbers(s.b),1/240));
          const values=new Set(parent.map((w:any)=>Number(w.cm)).filter((v:number)=>v>0));
          if(values.size>1)fail('thickness-conflict');
          cm=resolved>0?resolved:values.size?Number([...values][0]):s.cm;
          if(s.raw.cm===0&&Array.isArray(space.wall_segments)&&space.wall_segments.some((w:any)=>w.id===s.id))cm=0;
          if(covered(zeroIntervals.get(edgeKey(s))||[])&&!covered(openingIntervals.get(edgeKey(s))||[]))cm=0;
        }
        const pair=order(a.node,b.node)<=0?[a.node,b.node]:[b.node,a.node];
        const gkey=s.kind+':'+pair.join('|'),props=metadataProps(s.raw,['id','a','b','cm']);
        const stable=(v:any):string=>JSON.stringify(v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort(order).map(k=>[k,JSON.parse(stable(v[k]))])):v);
        const existing=(byGeometry.get(gkey)||[]).find(e=>{
          const a=e.props||{},b=props||{};return Object.keys(a).every(k=>!(k in b)||stable(a[k])===stable(b[k]));
        });
        if(!existing&&s.kind==='wall'&&(byGeometry.get(gkey)||[]).length)fail('props-conflict',gkey);
        let edge:GraphEdge,reverse=false;
        if(existing) {
          if(existing.cm!==cm)fail('thickness-conflict');
          edge=existing;edge.props={...(edge.props||{}),...(props||{})};if(!Object.keys(edge.props).length)delete edge.props;reverse=edge.from!==a.node;
        } else {
          const preferred=i===0?s.id:graphSplitId(s.kind,s.id,i,encodeRational(a.t),encodeRational(b.t));
          let id=preferred;for(let suffix=2;usedIds.has(s.kind+':'+id);suffix++)id=preferred.slice(0,64-String(suffix).length-1)+'-'+suffix;
          usedIds.add(s.kind+':'+id);
          edge={id,kind:s.kind,from:a.node,to:b.node,cm,...(props?{props}:{})};
          const list=byGeometry.get(gkey)||[];list.push(edge);byGeometry.set(gkey,list);graph.edges.push(edge);
        }
        ranges.push({ref:targetRef(edge),sourceInterval:[encodeRational(a.t),encodeRational(b.t)],reverse});
      }
      mapping.edges[edgeKey(s)]=ranges;
    }
    for(const [room,boundaries]of source.boundaries) {
      const edges:GraphRoomCycle['edges']=[];
      for(const b of boundaries) {
        const forward=cmp(b.start,b.end)<0,lo=min(b.start,b.end),hi=max(b.start,b.end);
        let ranges=(mapping.edges[b.source]||[]).filter(r=>cmp(decodeRational(r.sourceInterval[0]),lo)>=0&&cmp(decodeRational(r.sourceInterval[1]),hi)<=0);
        if(!forward)ranges=ranges.slice().reverse();
        edges.push(...ranges.map(r=>({...r.ref,reverse:forward?r.reverse:!r.reverse})));
      }
      graph.rooms.push({room,edges:edges.filter((e,i)=>i===0||edgeKey(e)!==edgeKey(edges[i-1]))});
    }
    const retained=new Set(graph.edges.flatMap(e=>[e.from,e.to]));
    graph.dependencies=graph.dependencies.filter(d=>retained.has(d.node)&&d.refs.every(r=>retained.has(r.from)&&retained.has(r.to)));
    graph.nodes=graph.nodes.filter(n=>retained.has(n.id));
    const result=freezeGraph(canonicalGraph(graph));
    const validated=assertGraph(result,{limits,roomIds:(space.rooms||[]).map((r:any)=>r.id)});
    preparedGraphs.set(result,validated);
    const base:any=clone(space);
    const occupied:Array<{id:string;source:string;p:ExactPoint;length:Exact}>=[];
    const positive=(s:SourceEdge,t:Exact)=>(mapping.edges[edgeKey(s)]||[]).some(r=>
      cmp(t,decodeRational(r.sourceInterval[0]))>=0&&cmp(t,decodeRational(r.sourceInterval[1]))<=0
      &&graph.edges.find(e=>edgeKey(e)===edgeKey(r.ref))!.cm>0);
    const eligible=(s:SourceEdge,opening:any):Exact|null=>{
      if(s.kind!=='wall')return null;
      const p=readSourcePoint([opening.x,opening.y]),t=projectParameter(p,s.a,s.b);
      const length=Math.sqrt(toNumber(squaredDistance(s.a,s.b))),along=toNumber(t)*length,half=Number(opening.length)/2;
      if(!between(t)||!withinRadius(p,pointAt(s.a,s.b,t),radius)
          ||!wallAngleMatches(pointToNumbers(s.a),pointToNumbers(s.b),Number(opening.angle))
          ||!Number.isFinite(half)||half<0||along-half < -1e-9||along+half>length+1e-9)return null;
      return t;
    };
    for(const opening of base.openings||[]){
      const s=opening.host&&sourceByKey.get(edgeKey(opening.host));if(!s)continue;
      let t=s.kind==='wall'?eligible(s,opening):hostParameter(opening.host);if(!t)continue;
      if(s.kind==='partition'&&s.reversed)t=sub(ONE,t);
      if(between(t)&&positive(s,t))occupied.push({id:opening.id,source:edgeKey(s),p:pointAt(s.a,s.b,t),length:parseDecimal(Number(opening.length)||0)});
    }
    const free=(s:SourceEdge,t:Exact,opening:any):boolean=>{
      const p=pointAt(s.a,s.b,t);
      return occupied.every(old=>{
        if(old.id===opening.id||old.source!==edgeKey(s))return true;
        const half=sub(div(add(old.length,parseDecimal(Number(opening.length)||0)),exact(2n)),parseDecimal('1e-9'));
        return cmp(half,ZERO)<=0||cmp(squaredDistance(p,old.p),mul(half,half))>=0;
      });
    };
    for(const opening of base.openings||[]){
      const previousHost=opening.host,currentSource=opening.host&&sourceByKey.get(edgeKey(opening.host));
      const staying=currentSource?.kind==='wall'?eligible(currentSource,opening):null;
      if(staying)opening.host=canonicalHost(opening.host,currentSource.reversed?sub(ONE,staying):staying);
      if(!opening.host || !currentSource || currentSource.kind==='wall'&&!staying) {
        const p=readSourcePoint([opening.x,opening.y]);
        const choices=source.sources.map(s=>({s,t:eligible(s,opening)})).filter((v):v is {s:SourceEdge;t:Exact}=>v.t!==null)
          .sort((a,b)=>cmp(squaredDistance(p,pointAt(a.s.a,a.s.b,a.t)),squaredDistance(p,pointAt(b.s.a,b.s.b,b.t)))||b.s.cm-a.s.cm||order(a.s.id,b.s.id));
        const selected=choices.find(({s,t})=>positive(s,t)&&free(s,t,opening));
        if(selected) opening.host={kind:'wall',id:selected.s.id,tq:encodeRational(selected.s.reversed?sub(ONE,selected.t):selected.t),t:toNumber(selected.s.reversed?sub(ONE,selected.t):selected.t)};
        else delete opening.host;
      }
      if(!opening.host)continue;
      void previousHost;
      const sourceEdge=sourceByKey.get(edgeKey(opening.host));if(!sourceEdge)fail('host',opening.id);
      let t=hostParameter(opening.host);if(sourceEdge.reversed)t=sub(ONE,t);
      const range=(mapping.edges[edgeKey(sourceEdge)]||[]).find(r=>cmp(t,decodeRational(r.sourceInterval[0]))>=0&&cmp(t,decodeRational(r.sourceInterval[1]))<=0);
      if(!range)fail('host-range',opening.id);
      let next=div(sub(t,decodeRational(range.sourceInterval[0])),sub(decodeRational(range.sourceInterval[1]),decodeRational(range.sourceInterval[0])));
      if(range.reverse)next=sub(ONE,next);
      if(!occupied.some(o=>o.id===opening.id))occupied.push({id:opening.id,source:edgeKey(sourceEdge),p:pointAt(sourceEdge.a,sourceEdge.b,t),length:parseDecimal(Number(opening.length)||0)});
      opening.host=canonicalHost({...opening.host,...range.ref},next);
      mapping.hosts[opening.id]=clone(opening.host);
    }
    for(const [ref,id]of sourcePointNode)if(retained.has(id))mapping.nodes[ref]=[id];
    const projected=projectGraphSpace(base,result);
    let moved=0,joined=0,maxDistance=0;
    for(const [id,owners]of origins) {
      if(!retained.has(id))continue;
      if(owners.length>1)joined+=owners.length-1;
      const p=decodePoint(nodes.get(id)!.p);
      for(const owner of owners) {
        if(!withinRadius(owner.p,p,radius))fail('displacement');
        if(!pointEq(owner.p,p))moved++;
        maxDistance=Math.max(maxDistance,Math.sqrt(toNumber(squaredDistance(owner.p,p))));
      }
    }
    return {graph:result,space:projected.space as T,bindings:projected.bindings,changed:true,mapping,
      touched:{nodes:result.nodes.map(n=>n.id),edges:result.edges.map(targetRef),rooms:result.rooms.map(r=>r.room),hosts:Object.keys(mapping.hosts)},
      diagnostics:[],migrationReport:{moved,joined,maxDisplacementCm:maxDistance*240*(options.cellCm??Number(space.cell_cm||5)),bends}};
  };
  try{return run(true);}catch(error){
    if(error instanceof PlanGraphError && ['zero-length','self-intersection','room-area','third-owner','open-cycle','dependency-value','dependency-cycle','thickness-conflict'].includes(error.code))
      return run(false);
    throw error;
  }
}

export interface GraphPatch {
  nodes: { set: GraphNode[]; remove: string[] };
  edges: { set: GraphEdge[]; remove: EdgeRef[] };
  rooms: { set: GraphRoomCycle[]; remove: string[] };
  dependencies: { set: GraphDependency[]; remove: string[] };
}
/** An atomic transport delta of already-authored graph records, never a projection diff. */
export function applyGraphPatch(before: PlanGraph, patch: GraphPatch, context: OperationContext = {}): GraphResult {
  assertGraph(before,context);
  const applyRecords = <T>(old:T[], delta:{set:T[];remove:any[]}, key:(v:T)=>string, removeKey:(v:any)=>string):T[]=>{
    if(!record(delta)||!Array.isArray(delta.set)||!Array.isArray(delta.remove))fail('patch');
    const ids=new Set<string>(), map=new Map(old.map(v=>[key(v),clone(v)]));
    for(const value of delta.remove) {
      const id=removeKey(value);if(ids.has(id))fail('patch-duplicate');ids.add(id);
      if(!map.delete(id))fail('patch-missing',id);
    }
    ids.clear();
    for(const value of delta.set) {const id=key(value);if(ids.has(id))fail('patch-duplicate');ids.add(id);map.set(id,clone(value));}
    return [...map.values()];
  };
  const graph:PlanGraph={version:1,
    nodes:applyRecords(before.nodes,patch.nodes,n=>n.id,id=>id),
    edges:applyRecords(before.edges,patch.edges,edgeKey,edgeKey),
    rooms:applyRecords(before.rooms,patch.rooms,r=>r.room,id=>id),
    dependencies:applyRecords(before.dependencies,patch.dependencies,d=>d.node,id=>id)};
  evaluateDependencies(graph);
  return applyGraphOperation(before,{kind:'restore-graph',graph},context);
}
