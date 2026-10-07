/** #803: local structural edit in normalized coordinates, never a config writer.
 * The frozen structural graph deliberately ignores opening cuts and room-owner
 * multiplicity. Only the at-most-six incident rays change on pointermove. */
import { GRID_STEP_N } from './canvas-constants';
import { wallKey } from './wall-thickness';
import type { OpeningCfg, PartitionCfg, RoomCfg, WallSegmentEntry, WallEntry } from './types';

export type NodePoint = [number, number];
export interface NodeMoveSpace {
  id: string;
  rooms: RoomCfg[];
  wall_segments?: WallSegmentEntry[];
  partitions?: PartitionCfg[];
  walls?: WallEntry[];
  openings?: OpeningCfg[];
  cell_cm?: number;
  [key: string]: unknown;
}
export interface NodeWall {
  kind: 'wall' | 'partition'; id: string; a: NodePoint; b: NodePoint; cm: number;
}
export interface NodeAxis { key: string; direction: NodePoint; walls: NodeWall[]; passing: boolean }
export interface WallNode {
  key: string; point: NodePoint; walls: NodeWall[]; axes: NodeAxis[];
  passing: number; branches: number; valence: number; supported: boolean;
}
export interface NodeMoveIntent {
  point: NodePoint; target: NodePoint; axis: string | null;
  /** Allocated once at pointerdown; no new identities during move/Redo. */
  split_ids: Record<string, string>;
}
export interface NodeMovePlan {
  source: NodeMoveSpace; node: WallNode; nodes: readonly WallNode[];
  splitIds: Record<string, string>;
}
export type NodeMoveReason = 'unsupported_junction' | 'invalid' | 'opening_blocked';
export type NodeMoveResult = { ok: true; space: NodeMoveSpace; changed: boolean; affected: string[] }
  | { ok: false; reason: NodeMoveReason };
const EPS = 1e-9;
// Positional EPS is not an angular tolerance. Use the same signed angular
// predicate for grouping and ray ownership (the former dot-ray tolerance).
const DIRECTION_EPS = Math.sqrt(2 * EPS - EPS * EPS);
const parallel = (a: NodePoint, b: NodePoint): boolean => Math.abs(cross(a, b)) <= DIRECTION_EPS;
// Match Python's Unicode code-point ordering, not the browser/OS locale.
const compare = (a: string, b: string): number => {
  const left = Array.from(a), right = Array.from(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const d = left[i].codePointAt(0)! - right[i].codePointAt(0)!; if (d) return d;
  }
  return left.length - right.length;
};
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const point = (v: number[]): NodePoint => [v[0], v[1]];
const sub = (a: number[], b: number[]): NodePoint => [a[0] - b[0], a[1] - b[1]];
const dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1];
const cross = (a: number[], b: number[]): number => a[0] * b[1] - a[1] * b[0];
const length = (a: number[], b: number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const sameNodePoint = (a: number[], b: number[]): boolean => length(a, b) <= EPS;
const key = (p: number[]): string => `${p[0].toFixed(9)},${p[1].toFixed(9)}`;
const wallRef = (w: NodeWall): string => `${w.kind}:${w.id}`;
const unit = (a: number[]): NodePoint => {
  const n = Math.hypot(...a); return [a[0] / n, a[1] / n];
};
const axisDirection = (w: NodeWall): NodePoint => {
  const d = unit(sub(w.b, w.a));
  return d[0] < -EPS || (Math.abs(d[0]) <= EPS && d[1] < 0) ? [-d[0], -d[1]] : d;
};
const fraction = (p: number[], a: number[], b: number[]): number => {
  const d = sub(b, a); return dot(sub(p, a), d) / dot(d, d);
};
const onWall = (p: number[], w: NodeWall): boolean => {
  const d = sub(w.b, w.a), t = fraction(p, w.a, w.b);
  return Math.abs(cross(sub(p, w.a), d)) <= EPS * Math.hypot(...d)
    && t >= -EPS && t <= 1 + EPS;
};
const at = (a: number[], b: number[], t: number): NodePoint =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const structuralNodeWalls = (space: NodeMoveSpace): NodeWall[] => [
  ...(space.wall_segments || []).map(w => ({ ...w, kind: 'wall' as const })),
  ...(space.partitions || []).map(w => ({ ...w, kind: 'partition' as const })),
].filter(w => length(w.a, w.b) > EPS).map(w => ({
  kind: w.kind, id: w.id, a: point(w.a), b: point(w.b), cm: w.cm,
}));

/** Non-parallel structural intersection, endpoints included. */
const intersection = (a: NodeWall, b: NodeWall): NodePoint | null => {
  const da = sub(a.b, a.a), db = sub(b.b, b.a), den = cross(da, db);
  if (Math.abs(den) <= EPS * Math.hypot(...da) * Math.hypot(...db)) return null;
  const t = cross(sub(b.a, a.a), db) / den, u = cross(sub(b.a, a.a), da) / den;
  return t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS ? at(a.a, a.b, t) : null;
};

export function structuralWallNodes(space: NodeMoveSpace): WallNode[] {
  const walls = structuralNodeWalls(space), points = new Map<string, NodePoint>();
  const add = (p: NodePoint): void => { points.set(key(p), p); };
  for (const wall of walls) { add(wall.a); add(wall.b); }
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) {
    const p = intersection(walls[i], walls[j]); if (p) add(p);
  }
  return [...points].sort(([a], [b]) => compare(a, b)).map(([id, p]) => {
    const incident = walls.filter(w => onWall(p, w)).sort((a, b) => compare(wallRef(a), wallRef(b)));
    const axes: NodeAxis[] = [];
    const rays = new Map<NodeAxis, NodePoint[]>();
    for (const w of incident) {
      const d = axisDirection(w);
      let axis = axes.find(a => parallel(a.direction, d));
      if (!axis) {
        axis = { key: wallRef(w), direction: d, walls: [], passing: false };
        axes.push(axis); rays.set(axis, []);
      }
      axis.walls.push(w);
      for (const end of [w.a, w.b]) if (!sameNodePoint(end, p)) {
        const ray = unit(sub(end, p));
        const owned = rays.get(axis)!;
        if (!owned.some(r => parallel(r, ray) && dot(r, ray) > 0)) owned.push(ray);
      }
    }
    for (const axis of axes) {
      axis.walls.sort((a, b) => compare(wallRef(a), wallRef(b)));
      axis.key = wallRef(axis.walls[0]);
      const owned = rays.get(axis)!;
      axis.passing = owned.some(r => dot(r, axis.direction) > 0)
        && owned.some(r => dot(r, axis.direction) < 0);
    }
    axes.sort((a, b) => compare(a.key, b.key));
    const valence = [...rays.values()].reduce((count, owned) => count + owned.length, 0);
    const passing = axes.filter(a => a.passing).length, branches = valence - 2 * passing;
    const supported = valence <= 6 && ((passing === 0 && branches >= 1)
      || (passing === 1 && branches <= 1) || (passing === 2 && branches === 0));
    return { key: id, point: p, walls: incident, axes, passing, branches,
      valence, supported };
  });
}

export function prepareNodeMove(
  space: NodeMoveSpace, node: WallNode, nodes: readonly WallNode[],
  splitIds: Record<string, string> = {},
): NodeMovePlan {
  return { source: space, node, nodes, splitIds: { ...splitIds } };
}

/** Screen-space arbitration is kept independent of SVG target stacking. */
export function pickWallNode(nodes: readonly WallNode[], p: NodePoint, unitsPerPx: number):
  { node: WallNode | null; ambiguous: boolean } {
  const hits = nodes.filter(n => length(n.point, p) <= 12 * unitsPerPx)
    .sort((a, b) => length(a.point, p) - length(b.point, p) || compare(a.key, b.key));
  const first = hits[0];
  return first && hits.slice(1).some(n => length(first.point, n.point) < 8 * unitsPerPx)
    ? { node: null, ambiguous: true } : { node: first || null, ambiguous: false };
}

export interface NodeSnap { point: NodePoint; axis: string | null; guide: 'axis' | 'horizontal' | 'vertical' | null }
export function resolveNodeMoveSnap(
  plan: NodeMovePlan, raw: NodePoint, unitsPerPx: number, lockedAxis: string | null,
): NodeSnap {
  const n = plan.node, passing = n.axes.filter(a => a.passing);
  let carrier = passing.find(a => a.key === lockedAxis);
  if (passing.length === 1) carrier = passing[0];
  if (passing.length === 2 && !carrier) {
    const delta = sub(raw, n.point);
    const ranked = passing.map(a => ({ a, d: Math.abs(cross(delta, a.direction)) }))
      .sort((a, b) => a.d - b.d || compare(a.a.key, b.a.key));
    if (length(raw, n.point) < unitsPerPx || Math.abs(ranked[0].d - ranked[1].d) <= EPS)
      return { point: point(n.point), axis: null, guide: null };
    carrier = ranked[0].a;
  }
  const goals: Array<{ p: NodePoint; priority: number; id: string; anchor: NodePoint; guide: NodeSnap['guide'] }> = [];
  const project = (origin: NodePoint, d: NodePoint): NodePoint => {
    const t = dot(sub(raw, origin), d);
    return [origin[0] + t * d[0], origin[1] + t * d[1]];
  };
  const fixedEnds = n.walls.flatMap(w => [w.a, w.b].filter(p => !sameNodePoint(p, n.point))
    .map(fixed => ({ fixed, id: wallRef(w) })));
  if (!carrier) for (const a of n.axes) goals.push({
    p: project(n.point, a.direction), priority: 0, id: a.key, anchor: n.point, guide: 'axis',
  });
  fixedEnds.forEach(({ fixed, id }) => {
    for (const [component, priority, guide] of [[1, 1, 'horizontal'], [0, 2, 'vertical']] as const) {
      if (carrier) {
        const d = carrier.direction[component];
        if (Math.abs(d) <= EPS) continue;
        const t = (fixed[component] - n.point[component]) / d;
        const p: NodePoint = [n.point[0] + t * carrier.direction[0], n.point[1] + t * carrier.direction[1]];
        p[component] = fixed[component];
        goals.push({ p, priority, id, anchor: fixed, guide });
      } else {
        const p = point(raw); p[component] = fixed[component];
        goals.push({ p, priority, id, anchor: fixed, guide });
      }
    }
  });
  const eligible = goals.filter(g => length(g.p, raw) <= 12 * unitsPerPx)
    .sort((a, b) => length(a.p, raw) - length(b.p, raw) || a.priority - b.priority || compare(a.id, b.id)
      || a.anchor[0] - b.anchor[0] || a.anchor[1] - b.anchor[1]);
  const goal = eligible[0];
  if (goal && goal.priority > 0) return { point: goal.p, axis: carrier?.key || null, guide: goal.guide };
  const axis = carrier || (goal ? n.axes.find(a => a.key === goal.id) : undefined);
  if (axis) {
    // Preserve a point intersection of compatible constraints, even when the
    // original-axis guide wins the tie. A parallel H/V line is not a point.
    const exact = goal && eligible.find(g => g.priority > 0 && sameNodePoint(g.p, goal.p)
      && Math.abs(axis.direction[g.guide === 'horizontal' ? 1 : 0]) > EPS);
    if (exact) return { point: exact.p, axis: carrier?.key || null, guide: 'axis' };
    const origin = sameNodePoint(axis.walls[0].a, n.point) ? axis.walls[0].b : axis.walls[0].a;
    const t = Math.round(dot(sub(raw, origin), axis.direction) / GRID_STEP_N) * GRID_STEP_N;
    return { point: [origin[0] + t * axis.direction[0], origin[1] + t * axis.direction[1]],
      axis: carrier?.key || null, guide: 'axis' };
  }
  return { point: [Math.round(raw[0] / GRID_STEP_N) * GRID_STEP_N,
    Math.round(raw[1] / GRID_STEP_N) * GRID_STEP_N], axis: null, guide: null };
}

/** Build a complete candidate from the frozen source, or refuse the entire edit. */
export function applyNodeMove(plan: NodeMovePlan, target: NodePoint, axisKey: string | null): NodeMoveResult {
  const { node: n, source } = plan;
  if (!n.supported) return { ok: false, reason: 'unsupported_junction' };
  if (!target.every(v => Number.isFinite(v) && Math.abs(v) <= 5000)) return { ok: false, reason: 'invalid' };
  if (sameNodePoint(target, n.point)) return { ok: true, space: source, changed: false, affected: [] };
  const onGrid = target.every(v => Math.abs(v / GRID_STEP_N - Math.round(v / GRID_STEP_N)) <= 0.0001);
  const constrained = n.axes.some(a => Math.abs(cross(sub(target, n.point), a.direction)) <= EPS)
    || n.walls.some(w => [w.a, w.b].some(p => !sameNodePoint(p, n.point)
      && (Math.abs(p[0] - target[0]) <= EPS || Math.abs(p[1] - target[1]) <= EPS)));
  if (!onGrid && !constrained) return { ok: false, reason: 'invalid' };
  const carrier = n.passing ? n.axes.find(a => a.passing && a.key === axisKey) : null;
  if (n.passing && !carrier) return { ok: false, reason: 'invalid' };
  if (carrier) {
    if (Math.abs(cross(sub(target, n.point), carrier.direction)) > EPS) return { ok: false, reason: 'invalid' };
    const positions = carrier.walls.flatMap(w => [w.a, w.b]).filter(p => !sameNodePoint(p, n.point))
      .map(p => dot(sub(p, n.point), carrier.direction));
    const wanted = dot(sub(target, n.point), carrier.direction);
    const lo = Math.max(...positions.filter(v => v < -EPS)), hi = Math.min(...positions.filter(v => v > EPS));
    if (!(wanted > lo + EPS && wanted < hi - EPS)) return { ok: false, reason: 'invalid' };
    // Swept order, not just the landing position: no jumping through a foreign
    // junction or a thickness boundary on a whole carrier.
    for (const other of plan.nodes) if (other.key !== n.key
        && Math.abs(cross(sub(other.point, n.point), carrier.direction)) <= EPS) {
      const t = dot(sub(other.point, n.point), carrier.direction);
      if (Math.abs(t) > EPS && t * wanted > 0 && Math.abs(t) <= Math.abs(wanted) + EPS)
        return { ok: false, reason: 'invalid' };
    }
    // A whole carrier is unchanged, but its junction must not cross an
    // opening (including its physical jamb) merely because the landing is clear.
    const sweptLo = Math.min(0, wanted), sweptHi = Math.max(0, wanted);
    for (const opening of source.openings || []) {
      const host = opening.host;
      const wall = host && carrier.walls.find(w => wallRef(w) === `${host.kind}:${host.id}`);
      if (!wall) continue;
      const center = dot(sub(at(wall.a, wall.b, host!.t), n.point), carrier.direction);
      const margin = opening.length / 2 + wall.cm / (Number(source.cell_cm) || 5) * GRID_STEP_N / 2;
      if (center + margin >= sweptLo - EPS && center - margin <= sweptHi + EPS)
        return { ok: false, reason: 'opening_blocked' };
    }
  }
  const out = copy(source), replacements = new Map<string, NodeWall[]>();
  const usedIds = new Set([...structuralNodeWalls(source).map(w => w.id),
    ...source.rooms.map(r => r.id), ...(source.openings || []).map(o => o.id),
    ...['decor', 'stairs', 'wall_columns'].flatMap(collection => {
      const entries = source[collection];
      return Array.isArray(entries) ? entries.flatMap((entry: unknown) => entry && typeof entry === 'object'
        && 'id' in entry && typeof entry.id === 'string' ? [entry.id] : []) : [];
    })]);
  for (const old of n.walls) {
    const ref = wallRef(old), staysStraight = !!carrier?.walls.some(w => wallRef(w) === ref);
    const aMoves = sameNodePoint(old.a, n.point), bMoves = sameNodePoint(old.b, n.point);
    if (!aMoves && !bMoves && staysStraight) { replacements.set(ref, [old]); continue; }
    if (aMoves || bMoves) {
      replacements.set(ref, [{ ...old, a: aMoves ? point(target) : old.a, b: bMoves ? point(target) : old.b }]);
    } else {
      // A pure X bends the transverse whole wall. Choose lineage at ORIGINAL
      // P0, not at the new bend or according to where an opening happened to be.
      const id = plan.splitIds[ref];
      if (!id || usedIds.has(id)) return { ok: false, reason: 'invalid' };
      usedIds.add(id);
      const firstKeeps = fraction(n.point, old.a, old.b) >= 0.5 - EPS;
      replacements.set(ref, [
        { ...old, id: firstKeeps ? old.id : id, b: point(target) },
        { ...old, id: firstKeeps ? id : old.id, a: point(target) },
      ]);
    }
  }
  if ([...replacements.values()].flat().some(w => length(w.a, w.b) <= EPS))
    return { ok: false, reason: 'invalid' };
  const replace = <T extends PartitionCfg>(list: T[], kind: NodeWall['kind']): T[] => list.flatMap(w =>
    (replacements.get(`${kind}:${w.id}`) || [w]).map(next => ({ ...w, id: next.id, a: [...next.a], b: [...next.b] } as T)));
  out.wall_segments = replace(out.wall_segments || [], 'wall');
  if (source.partitions) out.partitions = replace(out.partitions || [], 'partition');
  for (const room of out.rooms) {
    if (!room.poly || !room.wall_ids) return { ok: false, reason: 'invalid' };
    const poly: number[][] = [], ids: string[] = [];
    for (let i = 0; i < room.poly.length; i++) {
      const id = room.wall_ids[i], changed = replacements.get(`wall:${id}`);
      if (!changed) { poly.push(room.poly[i]); ids.push(id); continue; }
      const old = n.walls.find(w => w.kind === 'wall' && w.id === id)!;
      const forward = sameNodePoint(room.poly[i], old.a);
      for (const w of forward ? changed : [...changed].reverse()) {
        poly.push(point(forward ? w.a : w.b)); ids.push(w.id);
      }
    }
    room.poly = poly; room.wall_ids = ids;
  }
  const affected = [...replacements].filter(([ref, ws]) => {
    const old = n.walls.find(w => wallRef(w) === ref)!;
    return ws.length !== 1 || !sameNodePoint(ws[0].a, old.a) || !sameNodePoint(ws[0].b, old.b);
  }).map(([ref]) => ref);
  // Reject new contacts/crossings. The only connection allowed to move is the
  // chosen existing node; identical unrelated historical intersections remain.
  const beforeWalls = structuralNodeWalls(source), afterWalls = structuralNodeWalls(out);
  const changedIds = new Set([...replacements.values()].flat().map(wallRef));
  const checkedPairs = new Set<string>();
  const oldByRef = new Map(beforeWalls.map(w => [wallRef(w), w]));
  const parentRefs = new Map([...replacements].flatMap(([parent, ws]) => ws.map(w => [wallRef(w), parent] as const)));
  const originalIncident = new Set(n.walls.map(wallRef));
  for (const a of afterWalls.filter(w => changedIds.has(wallRef(w)))) for (const b of afterWalls) {
    if (a === b) continue;
    const pair = [wallRef(a), wallRef(b)].sort().join('|');
    if (checkedPairs.has(pair)) continue;
    checkedPairs.add(pair);
    const hit = intersection(a, b);
    if (hit && sameNodePoint(hit, target) && (!originalIncident.has(parentRefs.get(wallRef(a)) || wallRef(a))
        || !originalIncident.has(parentRefs.get(wallRef(b)) || wallRef(b))))
      return { ok: false, reason: 'invalid' };
    if (hit && !sameNodePoint(hit, target)) {
      const oldA = oldByRef.get(wallRef(a));
      const oldB = oldByRef.get(wallRef(b));
      const previous = oldA && oldB ? intersection(oldA, oldB) : null;
      if (!previous || !sameNodePoint(hit, previous)) return { ok: false, reason: 'invalid' };
    }
    // Collinear contact/overlap cannot silently merge or connect nodes either.
    if (!hit && Math.abs(cross(sub(a.b, a.a), sub(b.b, b.a))) <= EPS) {
      if ([a.a, a.b].some(p => sameNodePoint(p, target) && onWall(p, b))
          && (!originalIncident.has(parentRefs.get(wallRef(a)) || wallRef(a))
            || !originalIncident.has(parentRefs.get(wallRef(b)) || wallRef(b))))
        return { ok: false, reason: 'invalid' };
      for (const p of [a.a, a.b]) if (onWall(p, b) && !sameNodePoint(p, target)) {
        const oldA = oldByRef.get(wallRef(a)), oldB = oldByRef.get(wallRef(b));
        if (!oldA || !oldB || ![oldA.a, oldA.b].some(q => sameNodePoint(q, p) && onWall(q, oldB)))
          return { ok: false, reason: 'invalid' };
      }
    }
  }
  for (const opening of out.openings || []) {
    const host = opening.host;
    if (!host) {
      if (n.walls.some(w => onWall([opening.x, opening.y], w))) return { ok: false, reason: 'opening_blocked' };
      continue;
    }
    const ref = `${host.kind}:${host.id}`, children = replacements.get(ref);
    if (!children) continue;
    const old = n.walls.find(w => wallRef(w) === ref)!;
    if (children.length === 1 && sameNodePoint(children[0].a, old.a)
        && sameNodePoint(children[0].b, old.b)) continue;
    const oldLength = length(old.a, old.b), half = opening.length / 2;
    let child = children[0], t = host.t;
    const oldAlong = t * oldLength, splitAlong = fraction(n.point, old.a, old.b) * oldLength;
    if (children.length === 2) {
      if (oldAlong - half < splitAlong + EPS && oldAlong + half > splitAlong - EPS)
        return { ok: false, reason: 'opening_blocked' };
      const first = oldAlong + half <= splitAlong;
      child = children[first ? 0 : 1];
      t = first ? oldAlong / length(child.a, child.b)
        : 1 - (oldLength - oldAlong) / length(child.a, child.b);
    } else if (carrier?.walls.some(w => wallRef(w) === ref)) {
      // Passing-wall openings do not translate with an atom divider.
      t = fraction([opening.x, opening.y], child.a, child.b);
    } else t = sameNodePoint(old.a, n.point)
      ? 1 - (1 - host.t) * oldLength / length(child.a, child.b)
      : host.t * oldLength / length(child.a, child.b);
    const span = length(child.a, child.b);
    const jamb = child.cm / (Number(source.cell_cm) || 5) * GRID_STEP_N / 2;
    if (!(span > EPS) || t * span - half < jamb - EPS || t * span + half > span - jamb + EPS)
      return { ok: false, reason: 'opening_blocked' };
    const center = at(child.a, child.b, t);
    opening.x = center[0]; opening.y = center[1]; opening.host = { ...host, id: child.id, t };
    let angle = Math.atan2(child.b[1] - child.a[1], child.b[0] - child.a[0]) * 180 / Math.PI;
    if (angle >= 90) angle -= 180; else if (angle < -90) angle += 180;
    opening.angle = angle;
  }
  const openingList = out.openings || [];
  for (let i = 0; i < openingList.length; i++) for (let j = i + 1; j < openingList.length; j++) {
    const a = openingList[i], b = openingList[j];
    if (a.host && b.host && a.host.kind === b.host.kind && a.host.id === b.host.id
        && changedIds.has(`${a.host.kind}:${a.host.id}`)
        && length([a.x, a.y], [b.x, b.y]) < (a.length + b.length) / 2 - EPS)
      return { ok: false, reason: 'opening_blocked' };
  }
  if (source.walls) out.walls = (out.wall_segments || []).filter(w => w.cm > 0).map(w => ({
    key: wallKey(w.a, w.b, GRID_STEP_N), cm: w.cm, a: [...w.a], b: [...w.b],
  }));
  return { ok: true, space: out, changed: true, affected };
}
