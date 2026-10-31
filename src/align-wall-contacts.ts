import { GRID_STEP_N } from './canvas-constants';
import { canonicalizeNumber, canonicalizeLatticeCoordinate, COORDINATE_FACTOR } from './coordinate-canonicalization';
import { roomPoly } from './logic';
import { storedWallContact } from './stored-wall-contact';
import { atomizeWallSegments, type WallGraphSourceSegment } from './wall-face-graph';
import type { NodeMoveSpace } from './wall-node-move';

type Point = [number, number];
type Group = { point: Point; next: Point; parent: string };
type Source = WallGraphSourceSegment & { a: Point; b: Point };
type Axis = { direction: Point; length: number; sources: Source[] };
type Constraint = { axes: [string, string][] };
const pointKey = (p: readonly number[]): string =>
  `${canonicalizeNumber(p[0])},${canonicalizeNumber(p[1])}`;
const distance = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
const dot = (a: readonly number[], b: readonly number[]): number => a[0] * b[0] + a[1] * b[1];
const cross = (a: readonly number[], b: readonly number[]): number => a[0] * b[1] - a[1] * b[0];
const minus = (a: readonly number[], b: readonly number[]): Point => [a[0] - b[0], a[1] - b[1]];
const ordered = (a: readonly number[], b: readonly number[]): number => a[0] - b[0] || a[1] - b[1];
const stored = (p: readonly number[]): Point => [Number(canonicalizeLatticeCoordinate(p[0])), Number(canonicalizeLatticeCoordinate(p[1]))];

/** One immutable alignment plan per space. The existing graph sweep supplies
 * incident candidates; storage proof, never its epsilon key, authorizes a
 * contact. Collinear split carriers are treated as one finite axis. */
export function alignedWallPoints(
  space: NodeMoveSpace, snap: (value: number) => number,
): (point: readonly number[]) => Point {
  const groups = new Map<string, Group>();
  const sources = new Map<string, Source>();
  const addPoint = (p: readonly number[]): string => {
    const key = pointKey(p), old = groups.get(key);
    if (!old) groups.set(key, { point: [p[0], p[1]], next: [snap(p[0]), snap(p[1])], parent: key });
    else if (ordered(p, old.point) < 0) old.point = [p[0], p[1]];
    return key;
  };
  const addSource = (key: string, a: readonly number[], b: readonly number[]): void => {
    if (![...a, ...b].every(Number.isFinite) || distance(a, b) === 0) return;
    addPoint(a); addPoint(b);
    sources.set(key, { key, a: [a[0], a[1]], b: [b[0], b[1]] });
  };
  for (const room of space.rooms || []) {
    const poly = roomPoly(room) || [];
    poly.forEach((p, i) => addSource(`room:${room.id}:${i}`, p, poly[(i + 1) % poly.length]));
  }
  for (const [kind, walls] of [['wall', space.wall_segments], ['partition', space.partitions]] as const)
    for (const wall of walls || []) addSource(`${kind}:${wall.id}`, wall.a, wall.b);
  const root = (key: string): string => {
    const group = groups.get(key)!;
    if (group.parent !== key) group.parent = root(group.parent);
    return group.parent;
  };
  const join = (left: string, right: string): void => {
    const a = root(left), b = root(right);
    if (a !== b) groups.get(b)!.parent = a;
  };
  for (const source of sources.values()) join(pointKey(source.a), pointKey(source.b));
  const epsilon = GRID_STEP_N * .0002;
  const topologyKey = (p: readonly number[]): string => `${Math.round(p[0] / epsilon)},${Math.round(p[1] / epsilon)}`;
  const incident = new Map<string, Set<string>>();
  for (const atom of atomizeWallSegments([...sources.values()], epsilon)) {
    for (const p of [atom.a, atom.b]) {
      const key = topologyKey(p), owners = incident.get(key) || new Set<string>();
      for (const sourceKey of atom.sourceKeys) owners.add(sourceKey);
      incident.set(key, owners);
    }
  }
  const constraints = new Map<string, Constraint>();
  const frozen = new Set<string>();
  const parallel = (axis: Axis, source: Source): boolean => {
    const delta = minus(source.b, source.a), length = Math.hypot(...delta);
    return Math.abs(cross(axis.direction, [delta[0] / length, delta[1] / length]))
      <= Math.SQRT2 / COORDINATE_FACTOR * (1 / axis.length + 1 / length) + Number.EPSILON * 16;
  };
  const runs = new Map<string, [string, string]>();
  const axisRun = (axis: Axis): [string, string] => {
    const cached = runs.get(axis.sources[0].key);
    if (cached) return cached;
    const owners = new Set(axis.sources.map(source => source.key));
    const queue = [...axis.sources];
    for (let index = 0; index < queue.length; index++) {
      for (const point of [queue[index].a, queue[index].b]) {
        for (const id of incident.get(topologyKey(point)) || []) {
          const source = sources.get(id)!;
          if (owners.has(id) || !parallel(axis, source)
            || !storedWallContact(point, source.a, source.b, 1, false)) continue;
          owners.add(id); queue.push(source);
        }
      }
    }
    const ends = [...new Set([...owners].flatMap(id => {
      const source = sources.get(id)!;
      return [pointKey(source.a), pointKey(source.b)];
    }))].map(key => ({ key, along: dot(groups.get(key)!.point, axis.direction) }))
      .sort((a, b) => a.along - b.along || a.key.localeCompare(b.key));
    const result: [string, string] = [ends[0].key, ends[ends.length - 1].key];
    for (const id of owners) runs.set(id, result);
    return result;
  };
  for (const [key, group] of groups) {
    const axes: Axis[] = [];
    const candidates = [...(incident.get(topologyKey(group.point)) || [])].sort();
    for (const id of candidates) {
      const source = sources.get(id)!;
      if (!storedWallContact(group.point, source.a, source.b)) continue;
      const delta = minus(source.b, source.a), length = Math.hypot(...delta);
      const direction: Point = [delta[0] / length, delta[1] / length];
      const axis = axes.find(item => parallel(item, source));
      if (axis) axis.sources.push(source);
      else axes.push({ direction, length, sources: [source] });
    }
    const passing: [string, string][] = [];
    for (const axis of axes) {
      const ends = axisRun(axis);
      const along = ends.map(end => dot(minus(groups.get(end)!.point, group.point), axis.direction));
      if (along[0] * along[1] < 0) passing.push(ends);
    }
    if (!passing.length) continue;
    for (const axis of passing) for (const end of axis) join(key, end);
    if (axes.length > 2 || passing.length > 2) frozen.add(key);
    else constraints.set(key, { axes: passing });
  }
  // Freeze only a connected structural component when constraints cannot be
  // proved. Independent geometry/markers retain ordinary grid alignment.
  const frozenRoots = new Set([...frozen].map(root));
  const state = new Map<string, number>();
  const solve = (key: string): Point => {
    const group = groups.get(key)!;
    if (frozenRoots.has(root(key))) return group.point;
    if (state.get(key) === 2) return group.next;
    if (state.get(key) === 1) { frozenRoots.add(root(key)); return group.point; }
    state.set(key, 1);
    const constraint = constraints.get(key);
    if (constraint) {
      const axes = constraint.axes.map(axis => axis.map(solve).sort(ordered));
      const [a, b] = axes[0];
      const d = minus(b, a), length = Math.hypot(...d);
      let candidate: Point | null = null;
      if (length > 0 && axes.length === 1) {
        // Same longitudinal grid as Select node movement. Rounding the two
        // Cartesian components would move this endpoint off an inclined wall.
        const gridPoint: Point = [snap(group.point[0]), snap(group.point[1])];
        const along = Math.round(dot(minus(group.point, a), d) / length / GRID_STEP_N) * GRID_STEP_N;
        if (storedWallContact(gridPoint, a, b)) candidate = gridPoint;
        else if (along > 0 && along < length)
          candidate = stored([a[0] + d[0] * along / length, a[1] + d[1] * along / length]);
      } else if (length > 0 && axes.length === 2) {
        const [c, e] = axes[1], other = minus(e, c), denominator = cross(d, other);
        if (denominator !== 0) {
          const t = cross(minus(c, a), other) / denominator;
          const u = cross(minus(c, a), d) / denominator;
          if (t > 0 && t < 1 && u > 0 && u < 1)
            candidate = stored([a[0] + t * d[0], a[1] + t * d[1]]);
        }
      }
      if (candidate && axes.every(([left, right]) => storedWallContact(candidate!, left, right)))
        group.next = candidate;
      else frozenRoots.add(root(key));
    }
    state.set(key, 2);
    return frozenRoots.has(root(key)) ? group.point : group.next;
  };
  for (const key of groups.keys()) solve(key);
  const result = (p: readonly number[]): Point => {
    const key = pointKey(p), group = groups.get(key);
    if (!group) return [snap(p[0]), snap(p[1])];
    const value = frozenRoots.has(root(key)) ? group.point : group.next;
    return value.map(v => {
      const canonical = Number(canonicalizeLatticeCoordinate(v));
      return Math.abs(canonical-v) <= Number.EPSILON*16*Math.max(1,Math.abs(v)) ? canonical : v;
    }) as Point;
  };
  for (const partition of space.partitions || []) {
    const length = distance(result(partition.a), result(partition.b));
    const hosted = (space.openings || []).filter(opening => opening.host?.kind === 'partition'
      && opening.host.id === partition.id);
    const intervals = hosted.map(opening => [opening.host!.t * length - opening.length / 2,
      opening.host!.t * length + opening.length / 2]).sort((a, b) => a[0] - b[0]);
    const disjoint = intervals.every((interval, index) => index === 0
      || interval[0] >= intervals[index - 1][1] - 1e-9);
    const fits = disjoint && hosted.every(opening => {
        const t = opening.host!.t, along = t * length;
        return Number.isFinite(t) && t >= 0 && t <= 1 && Number.isFinite(opening.length)
          && opening.length > 0 && along - opening.length / 2 >= -GRID_STEP_N * 1e-6
          && along + opening.length / 2 <= length + GRID_STEP_N * 1e-6;
      });
    if (!(length > GRID_STEP_N * 1e-6) || !fits) frozenRoots.add(root(pointKey(partition.a)));
  }
  for (const room of space.rooms || []) if (!room.poly) {
    const corners = (roomPoly(room) || []).map(result);
    if (corners.length === 4 && (corners[0][1] !== corners[1][1]
      || corners[1][0] !== corners[2][0] || corners[2][1] !== corners[3][1]
      || corners[3][0] !== corners[0][0])) frozenRoots.add(root(pointKey((roomPoly(room) || [])[0])));
  }
  return result;
}
