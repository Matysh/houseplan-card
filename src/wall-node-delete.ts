/** #1045: one local structural deletion, independent of render fragments and writers. */
import { GRID_STEP_N } from './canvas-constants';
import { compareCodePoints } from './codepoint-order';
import { polygonArea, roomsOverlap, polyIsSimple } from './logic';
import { sameNodePoint, structuralNodeWalls, structuralWallNodes,
  type NodeMoveSpace, type NodePoint, type NodeWall } from './wall-node-move';
import { wallKey } from './wall-thickness';

export interface NodeDeleteIntent { point: NodePoint }
export type NodeDeleteReason = 'degree' | 'unsafe' | 'opening';
export type NodeDeleteResult = { ok: true; space: NodeMoveSpace; retained: string; removed: string }
  | { ok: false; reason: NodeDeleteReason };
const EPS = 1e-9;
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const sub = (a: number[], b: number[]): NodePoint => [a[0] - b[0], a[1] - b[1]];
const cross = (a: number[], b: number[]): number => a[0] * b[1] - a[1] * b[0];
const dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1];
const distance = (a: number[], b: number[]): number => Math.hypot(...sub(a, b));
const bounded = (p: unknown): p is NodePoint => Array.isArray(p) && p.length === 2
  && p.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 5000);
const fraction = (p: number[], w: Pick<NodeWall, 'a' | 'b'>): number => {
  const d = sub(w.b, w.a); return dot(sub(p, w.a), d) / dot(d, d);
};
const on = (p: number[], w: Pick<NodeWall, 'a' | 'b'>): boolean => {
  const d = sub(w.b, w.a), t = fraction(p, w);
  return Math.abs(cross(sub(p, w.a), d)) <= EPS * Math.hypot(...d) && t >= -EPS && t <= 1 + EPS;
};
const signedArea = (poly: number[][]): number => poly.reduce((a, p, i) => a + cross(p, poly[(i + 1) % poly.length]), 0) / 2;
// Key order is irrelevant; JSON types and every future attribute remain significant.
const ordered = (v: unknown): unknown => Array.isArray(v) ? v.map(ordered) : v && typeof v === 'object'
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => compareCodePoints(a, b)).map(([k, value]) => [k, ordered(value)])) : v;
const attrs = (wall: object): string => JSON.stringify(ordered(Object.fromEntries(
  Object.entries(wall).filter(([k]) => !['id', 'a', 'b'].includes(k)))));

/** All finite contacts, including collinear end contacts; positive overlap is separate. */
function contacts(a: Pick<NodeWall, 'a' | 'b'>, b: Pick<NodeWall, 'a' | 'b'>): NodePoint[] {
  const da = sub(a.b, a.a), db = sub(b.b, b.a), den = cross(da, db);
  if (Math.abs(den) <= EPS * Math.hypot(...da) * Math.hypot(...db))
    return [a.a, a.b, b.a, b.b].filter(p => on(p, a) && on(p, b));
  const t = cross(sub(b.a, a.a), db) / den, u = cross(sub(b.a, a.a), da) / den;
  return t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS
    ? [[a.a[0] + t * da[0], a.a[1] + t * da[1]]] : [];
}
function positiveOverlap(a: Pick<NodeWall, 'a' | 'b'>, b: Pick<NodeWall, 'a' | 'b'>): boolean {
  const d = sub(a.b, a.a), span = Math.hypot(...d);
  if (Math.abs(cross(sub(b.a, a.a), d)) > EPS * span
      || Math.abs(cross(sub(b.b, a.a), d)) > EPS * span) return false;
  const range = [fraction(b.a, a), fraction(b.b, a)].sort((x, y) => x - y);
  return (Math.min(1, range[1]) - Math.max(0, range[0])) * span > EPS;
}
function simple(poly: number[][]): boolean {
  if (poly.length < 3 || !poly.every(bounded) || !polyIsSimple(poly) || polygonArea(poly) <= EPS * EPS) return false;
  const edges = poly.map((a, i) => ({ a: a as NodePoint, b: poly[(i + 1) % poly.length] as NodePoint }));
  if (edges.some(w => distance(w.a, w.b) <= EPS)) return false;
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const adjacent = j === i + 1 || (i === 0 && j === edges.length - 1);
    if (positiveOverlap(edges[i], edges[j]) || (!adjacent && contacts(edges[i], edges[j]).length)) return false;
  }
  return true;
}

export function applyNodeDelete(source: NodeMoveSpace, intent: NodeDeleteIntent): NodeDeleteResult {
  const fail = (reason: NodeDeleteReason = 'unsafe'): NodeDeleteResult => ({ ok: false, reason });
  if (!intent || Object.keys(intent).length !== 1 || !bounded(intent.point)) return fail();
  const raw = [...(source.wall_segments || []), ...(source.partitions || [])];
  if (raw.some(w => !bounded(w.a) || !bounded(w.b) || distance(w.a, w.b) <= EPS)) return fail();
  const walls = structuralNodeWalls(source), nodes = structuralWallNodes(source);
  const node = nodes.find(n => sameNodePoint(n.point, intent.point));
  if (!node || node.valence !== 2 || node.walls.length !== 2
      || node.walls.some(w => !sameNodePoint(w.a, node.point) && !sameNodePoint(w.b, node.point))) return fail('degree');
  const incident = [...node.walls].sort((a, b) => compareCodePoints(a.id, b.id));
  const [keep, drop] = incident;
  if (keep.kind !== drop.kind || keep.id === drop.id) return fail();
  const collection = keep.kind === 'wall' ? source.wall_segments || [] : source.partitions || [];
  const first = collection.find(w => w.id === keep.id), second = collection.find(w => w.id === drop.id);
  if (!first || !second || attrs(first) !== attrs(second)) return fail();
  const outer = incident.map(w => sameNodePoint(w.a, node.point) ? w.b : w.a);
  if (distance(outer[0], outer[1]) <= EPS) return fail();
  // A/C must really be the next structural neighbours: do not erase a crossing
  // in the middle of either old carrier while removing B.
  if (nodes.some(n => ![node.point, ...outer].some(p => sameNodePoint(p, n.point))
      && incident.some(w => on(n.point, w)))) return fail();
  const merged = { ...copy(first), a: copy(sameNodePoint(keep.a, node.point) ? outer[1] : outer[0]),
    b: copy(sameNodePoint(keep.b, node.point) ? outer[1] : outer[0]) };
  for (const wall of walls.filter(w => !incident.some(old => old.kind === w.kind && old.id === w.id))) {
    if (positiveOverlap(merged, wall)) return fail();
    if (contacts(merged, wall).some(p => !outer.some(end => sameNodePoint(end, p)
        && incident.some(old => on(end, old)) && on(end, wall)))) return fail();
  }
  const out = copy(source), ids = new Set(incident.map(w => w.id));
  if (keep.kind === 'wall') out.wall_segments = (out.wall_segments || []).flatMap(w =>
    w.id === keep.id ? [merged] : w.id === drop.id ? [] : [w]);
  else out.partitions = (out.partitions || []).flatMap(w => w.id === keep.id ? [merged] : w.id === drop.id ? [] : [w]);
  const owners = new Set<number>();
  if (keep.kind === 'wall') for (const [roomIndex, room] of out.rooms.entries()) {
    if (!(room.wall_ids || []).some(id => ids.has(id))) continue;
    const poly = room.poly, wallIds = room.wall_ids;
    if (!poly || !wallIds || poly.length !== wallIds.length || !simple(poly)) return fail();
    const matches = poly.flatMap((p, i) => sameNodePoint(p, node.point) ? [i] : []);
    if (matches.length !== 1) return fail();
    const i = matches[0], previous = (i + poly.length - 1) % poly.length;
    if (wallIds.filter(id => ids.has(id)).length !== 2 || wallIds[previous] === wallIds[i]
        || !ids.has(wallIds[previous]) || !ids.has(wallIds[i])
        || !outer.every(end => sameNodePoint(end, poly[previous]) || sameNodePoint(end, poly[(i + 1) % poly.length]))) return fail();
    const winding = signedArea(poly);
    wallIds[previous] = keep.id; wallIds.splice(i, 1); poly.splice(i, 1);
    if (!simple(poly) || winding * signedArea(poly) <= 0) return fail();
    owners.add(roomIndex);
  }
  if (keep.kind === 'wall' && !owners.size) return fail();
  for (let i = 0; i < out.rooms.length; i++) for (let j = i + 1; j < out.rooms.length; j++) {
    if (!owners.has(i) && !owners.has(j)) continue;
    const a = out.rooms[i].poly, b = out.rooms[j].poly, oldA = source.rooms[i].poly, oldB = source.rooms[j].poly;
    if (!a || !b || !oldA || !oldB || (roomsOverlap(a, b, EPS) && !roomsOverlap(oldA, oldB, EPS))) return fail();
  }
  for (const opening of out.openings || []) {
    const host = opening.host;
    if (!host) {
      if (incident.some(w => on([opening.x, opening.y], w))) return fail('opening');
      continue;
    }
    const old = incident.find(w => w.kind === host.kind && w.id === host.id);
    if (!old) continue;
    const center: NodePoint = [opening.x, opening.y];
    if (!bounded(center) || !on(node.point, merged) || !on(center, merged)
        || distance(center, [old.a[0] + (old.b[0] - old.a[0]) * host.t, old.a[1] + (old.b[1] - old.a[1]) * host.t]) > EPS)
      return fail('opening');
    const t = fraction(center, merged), span = distance(merged.a, merged.b);
    const jamb = merged.cm / (Number(source.cell_cm) || 5) * GRID_STEP_N / 2;
    const angle = Math.atan2(merged.b[1] - merged.a[1], merged.b[0] - merged.a[0]) * 180 / Math.PI;
    if (!Number.isFinite(t) || !Number.isFinite(opening.length) || opening.length <= 0
        || Math.abs(((opening.angle - angle) % 180 + 270) % 180 - 90) > 1e-7
        || t * span - opening.length / 2 < jamb - EPS || t * span + opening.length / 2 > span - jamb + EPS) return fail('opening');
    opening.host = { ...host, id: keep.id, t }; // Physical fields remain literal.
  }
  const hosted = (out.openings || []).filter(o => o.host?.kind === keep.kind && o.host.id === keep.id);
  for (let i = 0; i < hosted.length; i++) for (let j = i + 1; j < hosted.length; j++)
    if (distance([hosted[i].x, hosted[i].y], [hosted[j].x, hosted[j].y]) < (hosted[i].length + hosted[j].length) / 2 - EPS) return fail('opening');
  if (source.walls) out.walls = (out.wall_segments || []).filter(w => w.cm > 0).map(w => ({
    key: wallKey(w.a, w.b, GRID_STEP_N), cm: w.cm, a: [...w.a], b: [...w.b],
  }));
  return { ok: true, space: out, retained: keep.id, removed: drop.id };
}
