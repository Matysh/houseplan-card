/** Geometry shared by independent partitions, saved room drafts and columns. */
import { difference, intersection, union } from 'polyclip-ts';
import { polygonArea } from './logic';
import { wallCmToUnits } from './wall-thickness';
import type {
  PartitionCfg, RoomDraftCfg, SpaceModel, WallColumnCfg,
} from './types';

export const COLUMN_MIN_CM = 1;
export const COLUMN_MAX_CM = 150;

export function clampColumnCm(cm: number): number {
  if (!Number.isFinite(cm)) return COLUMN_MIN_CM;
  return Math.max(COLUMN_MIN_CM, Math.min(COLUMN_MAX_CM, cm));
}

/** Square columns are symmetric every quarter turn. */
export function canonicalColumnAngle(angle: number | null | undefined): number {
  const a = Number.isFinite(Number(angle)) ? Number(angle) : 0;
  return ((a % 90) + 90) % 90;
}

const closedRing = (poly: number[][]): number[][][] => {
  const ring = poly.map((p) => [p[0], p[1]]);
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0]
      || ring[0][1] !== ring[ring.length - 1][1])) ring.push([...ring[0]]);
  return [ring];
};

export function polyclipPathD(geom: any): string {
  const out: string[] = [];
  for (const poly of geom || []) for (const ring of poly || []) {
    const pts = (ring || []).filter((p: any) => Array.isArray(p) && p.length >= 2);
    if (pts.length < 4) continue;
    out.push(`M ${pts.slice(0, -1).map((p: number[]) => `${p[0]} ${p[1]}`).join(' L ')} Z`);
  }
  return out.join(' ');
}

/** A wall segment has flat ends. Joining is delegated to polygon union. */
export function partitionBody(
  a: number[], b: number[], cm: number, cellCm: number, gridPitch: number,
): number[][] | null {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-9)) return null;
  const half = wallCmToUnits(cm, cellCm, gridPitch) / 2;
  const nx = (-dy / len) * half, ny = (dx / len) * half;
  return [
    [a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny],
  ];
}

export function columnBody(
  column: WallColumnCfg, cellCm: number, gridPitch: number,
): number[][] {
  const cell = Number(cellCm) > 0 ? Number(cellCm) : 5;
  const size = (clampColumnCm(column.cm) / cell) * gridPitch;
  const cx = column.center[0], cy = column.center[1];
  if (column.shape === 'circle') {
    const r = size / 2;
    return Array.from({ length: 96 }, (_, i) => {
      const a = (i / 96) * Math.PI * 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
  }
  const h = size / 2;
  const angle = canonicalColumnAngle(column.angle) * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) =>
    [cx + x * c - y * s, cy + x * s + y * c]);
}

export function draftBodies(
  draft: RoomDraftCfg, cellCm: number, gridPitch: number,
): number[][][] {
  const out: number[][][] = [];
  for (let i = 0; i + 1 < draft.points.length; i++) {
    const body = partitionBody(
      draft.points[i], draft.points[i + 1], draft.segments[i]?.cm || 15,
      cellCm, gridPitch,
    );
    if (body) out.push(body);
  }
  return out;
}

export function physicalBodies(
  space: Pick<SpaceModel, 'partitions' | 'room_drafts' | 'wall_columns'>,
  cellCm: number,
  gridPitch: number,
): number[][][] {
  const out: number[][][] = [];
  for (const p of space.partitions || []) {
    const body = partitionBody(p.a, p.b, p.cm, cellCm, gridPitch);
    if (body) out.push(body);
  }
  for (const d of space.room_drafts || []) out.push(...draftBodies(d, cellCm, gridPitch));
  for (const c of space.wall_columns || []) out.push(columnBody(c, cellCm, gridPitch));
  return out;
}

export function unionBodies(bodies: number[][][]): any | null {
  try {
    const polygons = bodies.filter((body) => body.length >= 3).map((body) => closedRing(body));
    return polygons.length ? union(polygons[0] as any, ...polygons.slice(1) as any[]) : null;
  } catch {
    return null;
  }
}

const ringPath = (poly: number[][]): string =>
  `M ${poly.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;

/**
 * One `d` fragment per resulting polygon (its outer ring plus its holes).
 * Callers may keep the fragments as separate paths or join them into one `d`
 * only with an explicit `evenodd` rule. Relying on default nonzero winding
 * can erase oppositely wound subpaths.
 */
export function geometryPolygonPaths(geom: any): string[] {
  const out: string[] = [];
  for (const poly of geom || []) {
    // Polyclip can leave zero-area needles when a visibility fan merely
    // touches a floor boundary. Rendering those makes an outside source leak
    // a few bright hairlines into the plan; they are not visible floor.
    if (geometryArea([poly]) <= 1e-6) continue;
    const parts: string[] = [];
    for (const ring of poly || []) {
      const pts = (ring || []).filter((p: any) => Array.isArray(p) && p.length >= 2);
      if (pts.length < 4) continue;
      parts.push(ringPath(pts.slice(0, -1)));
    }
    if (parts.length) out.push(parts.join(' '));
  }
  return out;
}

/** `polygons` clipped to `bounds`, as disjoint paths. Empty when they miss. */
export function intersectionPaths(polygons: number[][][], bounds: number[][][]): string[] {
  const base = unionBodies(polygons.filter((poly) => poly.length >= 3));
  const limit = unionBodies(bounds.filter((poly) => poly.length >= 3));
  if (!base) return [];
  if (!limit) return [];
  try {
    return geometryPolygonPaths(intersection(base, limit));
  } catch {
    // The un-clipped visibility fan may cover the backdrop and the area
    // outside the house. A boolean failure must therefore fail dark: returning
    // `base` here turns a numerical polyclip exception into a light leak and
    // then persists it in the per-source clip cache.
    return [];
  }
}

export function physicalBodiesPath(bodies: number[][][]): string {
  const geom = unionBodies(bodies);
  if (geom) return polyclipPathD(geom);
  return bodies.map((body) =>
    `M ${body.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`).join(' ');
}

/** Subtract only the physical bodies which overlap a room's clean floor. */
export function floorMinusBodies(floor: number[][], bodies: number[][][]): any {
  if (!bodies.length) return [closedRing(floor)];
  try {
    const obstacles = unionBodies(bodies);
    if (obstacles) return difference(closedRing(floor) as any, obstacles);
  } catch {
    // Fall through to the lossless sequential path below.
  }
  // A pathological multi-union must not restore the floor under masonry.
  // Sequential difference preserves overlap semantics and lets one malformed
  // body be skipped without discarding every valid neighbour.
  let geom: any = [closedRing(floor)];
  for (const body of bodies) {
    if (body.length < 3) continue;
    try { geom = difference(geom, closedRing(body) as any); } catch { /* skip invalid body */ }
  }
  return geom;
}

export function geometryArea(geom: any): number {
  let area = 0;
  for (const poly of geom || []) {
    if (!poly?.length) continue;
    area += polygonArea(poly[0] || []);
    for (let i = 1; i < poly.length; i++) area -= polygonArea(poly[i] || []);
  }
  return Math.max(0, area);
}

/**
 * Every ring of a geometry, holes included. For an occluder set the holes are
 * the important part: the room-facing faces of a wall ring ARE its holes.
 */
export function geometryAllRings(geom: any): number[][][] {
  const out: number[][][] = [];
  for (const poly of geom || []) {
    for (const ring of poly || []) {
      if (ring?.length >= 4) out.push(ring.slice(0, -1).map((p: number[]) => [p[0], p[1]]));
    }
  }
  return out;
}

export function geometryOuterRings(geom: any): number[][][] {
  const out: number[][][] = [];
  for (const poly of geom || []) {
    const ring = poly?.[0];
    if (ring?.length >= 4) out.push(ring.slice(0, -1).map((p: number[]) => [p[0], p[1]]));
  }
  return out;
}

function convexHull(points: number[][]): number[][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length <= 2) return p;
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: number[][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: number[][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Opaque bodies extruded along parallel light travel (sun shafts). */
export function directionalOccluders(
  bodies: number[][][], dir: number[], length: number,
): number[][][] {
  if (!(length > 0)) return bodies;
  return bodies.map((body) => convexHull([
    ...body,
    ...body.map((p) => [p[0] + dir[0] * length, p[1] + dir[1] * length]),
  ])).filter((p) => p.length >= 3);
}

export function pointInPhysicalBody(point: number[], body: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
    const xi = body[i][0], yi = body[i][1], xj = body[j][0], yj = body[j][1];
    const crosses = ((yi > point[1]) !== (yj > point[1]))
      && point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1e-12) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Test a point against polygon-clipping geometry while respecting holes.
 * `pointInPhysicalBody()` is intentionally a ring primitive; applying it to
 * every ring independently would classify a room floor or an opening cut as
 * solid just because it lies inside a hole ring.
 */
export function pointInPhysicalGeometry(point: number[], geom: any): boolean {
  for (const polygon of geom || []) {
    const outer = polygon?.[0];
    if (!outer?.length || !pointInPhysicalBody(point, outer)) continue;
    let inHole = false;
    for (let i = 1; i < polygon.length; i++) {
      if (polygon[i]?.length && pointInPhysicalBody(point, polygon[i])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

export function sameColumnPlacement(a: WallColumnCfg, b: WallColumnCfg, eps: number): boolean {
  if (Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1]) > eps) return false;
  if (Math.abs(clampColumnCm(a.cm) - clampColumnCm(b.cm)) > 1e-6) return false;
  if (a.shape !== b.shape) return true; // same outer body, different primitive
  if (a.shape === 'circle' || b.shape === 'circle') return true;
  const diff = Math.abs(canonicalColumnAngle(a.angle) - canonicalColumnAngle(b.angle));
  return Math.min(diff, 90 - diff) <= 1e-6;
}
