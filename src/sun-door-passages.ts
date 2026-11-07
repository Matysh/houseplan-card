/** Parallel solar transport through proven glass-door apertures. No new source
 * or reset of distance/gradient: every continuation stays in the original beam. */
import { intersection, difference, union, type Geom } from 'polyclip-ts';
import { pointInPolygon } from './logic';
import { directionalOccluders, geometryOuterRings } from './physical-geometry';
import { interiorGlassDoorPassages } from './interior-window-light';
import { resolveOpeningWallCandidates, openingInnerFaceOffsetFromIndex, wallCmToUnits, type OpeningWallIndex } from './wall-thickness';
import type { GeometryOpeningProjection } from './plan-geometry-preflight';
import type { SpaceModel } from './types';
import type { SunRoom } from './sun-access';
export interface SunDoorPassage {
  id: string;
  rooms: [string, string];
  a: number[];
  b: number[];
  normal: number[];
  depth: number;
}
export interface SolarContinuation {
  roomId: string;
  clip: number[][];
  geometry: Geom;
}
type Range = [number, number];
const EPS = 1e-8;
type Point = [number, number];
// Trig-derived cardinal spans can differ by 1e-14. Normalize only transient
// optical clipping inputs, far below a rendered pixel; never saved graph data.
const shape = (points: number[][]): Geom => {
  const ring = points.map(point => point.map(v => Math.round(v / EPS) * EPS) as Point);
  return [[ring.concat([ring[0]])]];
};
const combine = (geometries: Geom[]): Geom => geometries.reduce((acc, geometry) => acc.length ? union(acc, geometry) : geometry, [] as Geom);
const joined = (polys: number[][][]): Geom => combine(polys.map(shape));
const strip = (a: number[], b: number[], dir: readonly number[], len: number): number[][] => [a, b, [b[0] + dir[0] * len, b[1] + dir[1] * len], [a[0] + dir[0] * len, a[1] + dir[1] * len]];
export function buildSunDoorPassages(openings: readonly GeometryOpeningProjection[], space: SpaceModel, index: OpeningWallIndex, cellCm: number, gridPitch: number): SunDoorPassage[] {
  const out: SunDoorPassage[] = [];
  for (const opening of openings)
    for (const slice of interiorGlassDoorPassages(opening, space, index)) {
      const angle = slice.angle * Math.PI / 180, ux = Math.cos(angle), uy = Math.sin(angle), half = slice.rlen / 2;
      const candidates = resolveOpeningWallCandidates(index, { x: slice.rx, y: slice.ry, angle: slice.angle, length: slice.rlen }, slice.host?.kind !== 'partition');
      const cuts = [...new Set([-half, half, ...candidates.flatMap(c => c.pieces.flatMap(p => [p.x0, p.x1]))])]
        .filter(x => x >= -half && x <= half).sort((a, b) => a - b);
      const cm = openingInnerFaceOffsetFromIndex(index, { x: slice.rx, y: slice.ry, angle: slice.angle, length: slice.rlen }).cm;
      for (let i = 0; i + 1 < cuts.length; i++) {
        const lo = cuts[i], hi = cuts[i + 1], mid = (lo + hi) / 2;
        if (hi - lo <= EPS)
          continue;
        const rooms = (side: number) => [...new Set(candidates.filter(c => c.side === side && c.pieces.some(p => p.x0 < mid && p.x1 > mid)).map(c => c.roomId))];
        const minus = rooms(-1), plus = rooms(1);
        if (minus.length !== 1 || plus.length !== 1 || minus[0] === plus[0])
          continue;
        out.push({ id: slice.id + ':' + i + ':' + slice.rx + ':' + slice.ry, rooms: [minus[0], plus[0]],
          a: [slice.rx + ux * lo, slice.ry + uy * lo], b: [slice.rx + ux * hi, slice.ry + uy * hi], normal: [-uy, ux],
          depth: Math.max(slice.partitionHost?.depth || 0, wallCmToUnits(cm, cellCm, gridPitch)) });
      }
    }
  return out;
}
/** Cross-section of already lit floor just before the entry face. */
function litRanges(a: number[], b: number[], polys: number[][][]): Range[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], cuts = [0, 1];
  for (const poly of polys)
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < EPS)
        continue;
      const px = p[0] - a[0], py = p[1] - a[1], t = (px * ey - py * ex) / den, u = (px * dy - py * dx) / den;
      if (t > 0 && t < 1 && u >= -EPS && u <= 1 + EPS)
        cuts.push(t);
    }
  cuts.sort((x, y) => x - y);
  const out: Range[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const lo = cuts[i], hi = cuts[i + 1], t = (lo + hi) / 2;
    if (hi - lo > EPS && polys.some(p => pointInPolygon([a[0] + dx * t, a[1] + dy * t], p)))
      out.push([lo, hi]);
  }
  return out;
}
function unseen(ranges: Range[], done: Range[]): Range[] {
  let fresh = ranges;
  for (const [a, b] of done)
    fresh = fresh.flatMap(([lo, hi]): Range[] => hi <= a + EPS || lo >= b - EPS ? [[lo, hi]] : [...(lo < a - EPS ? [[lo, a] as Range] : []), ...(hi > b + EPS ? [[b, hi] as Range] : [])]);
  return fresh;
}
export function continueSolarBeam(source: {
  roomId: string;
  polys: number[][][];
  a: readonly number[];
  b: readonly number[];
  dir: readonly number[];
  len: number;
}, rooms: readonly SunRoom[], innerByRoom: Record<string, number[][]> | undefined, doors: readonly SunDoorPassage[], occluders: number[][][]): SolarContinuation[] {
  if (!doors.length || !source.polys.length || !(source.len > 0))
    return [];
  const byRoom = new Map(rooms.map(r => [r.id, r])), queue = [{ roomId: source.roomId, polys: source.polys }];
  const done = new Map<string, Range[]>(), floors = new Map<string, Geom>(), tunnels: SolarContinuation[] = [];
  try {
    const sourceQuad = shape(strip([...source.a], [...source.b], source.dir, source.len));
    const shadows = joined(directionalOccluders(occluders, [source.dir[0], source.dir[1]], source.len));
    const floorShapes = [...byRoom.values()].map(r => shape(innerByRoom?.[r.id] || r.poly));
    const allFloors = combine(floorShapes);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      for (const door of doors) {
        const dot = source.dir[0] * door.normal[0] + source.dir[1] * door.normal[1];
        if (Math.abs(dot) < EPS)
          continue;
        const from = dot > 0 ? door.rooms[0] : door.rooms[1], to = dot > 0 ? door.rooms[1] : door.rooms[0];
        if (current.roomId !== from)
          continue;
        const room = byRoom.get(to);
        if (!room)
          continue;
        const sign = dot > 0 ? 1 : -1, half = door.depth / 2;
        const face = (p: number[], side: number) => [p[0] + door.normal[0] * half * sign * side, p[1] + door.normal[1] * half * sign * side];
        const a = face(door.a, -1), b = face(door.b, -1), exitA = face(door.a, 1), exitB = face(door.b, 1);
        const epsilon = Math.max(1e-7, door.depth * 1e-7);
        const probe = (p: number[]) => [p[0] - source.dir[0] * epsilon, p[1] - source.dir[1] * epsilon];
        const prior = done.get(door.id) || [], fresh = unseen(litRanges(probe(a), probe(b), current.polys), prior);
        if (!fresh.length)
          continue;
        done.set(door.id, [...prior, ...fresh]);
        const clip = innerByRoom?.[to] || room.poly, tunnel = [a, b, exitB, exitA];
        for (const [lo, hi] of fresh) {
          const at = (t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          const back = (p: number[]) => [p[0] - source.dir[0] * source.len, p[1] - source.dir[1] * source.len];
          // The far jamb limits trajectories through the tunnel too,
          // not just the floor beyond its exit face.
          const transmitted = intersection(sourceQuad, shape(strip(at(lo), at(hi), source.dir, source.len)),
            shape(strip(back(exitA), back(exitB), source.dir, 2 * source.len)));
          const lit = shadows.length ? difference(transmitted, shadows) : transmitted;
          const floor = intersection(lit, shape(clip)), polys = geometryOuterRings(floor);
          if (polys.length) {
            queue.push({ roomId: to, polys });
            if (to !== source.roomId && !room.sunTransparent)
              floors.set(to, floors.has(to) ? union(floors.get(to)!, floor) : floor);
          }
          const bridge = difference(intersection(lit, shape(tunnel)), allFloors);
          if (bridge.length && !room.sunTransparent)
            tunnels.push({ roomId: to, clip: tunnel, geometry: bridge });
        }
      }
    }
    return [...floors].map(([roomId, geometry]) => ({ roomId, clip: innerByRoom?.[roomId] || byRoom.get(roomId)!.poly, geometry })).concat(tunnels);
  }
  catch {
    return [];
  } // A failed optical proof never opens a wall.
}
