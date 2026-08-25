/** Geometry shared by independent partitions, saved room drafts and columns. */
import { difference, intersection, union } from 'polyclip-ts';
import { polygonArea } from './logic';
import {
  linearWallBody, linearWallJoinPatches, pairButtEndTrimWedges, wallCmToUnits,
  type LinearWallSegment,
} from './wall-thickness';
import type {
  PartitionCfg, RoomDraftCfg, SpaceModel, WallColumnCfg,
} from './types';

export const COLUMN_MIN_CM = 1;
export const COLUMN_MAX_CM = 150;
/** Boolean operations work far below visible/physical plan precision, but raw
 * double tails from split/merge/resize must describe the same shared vertex. */
export const BOOLEAN_COORD_QUANTUM = 1e-6;

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

const samePoint = (a: number[], b: number[]): boolean =>
  a[0] === b[0] && a[1] === b[1];

/**
 * Copy one open outline into the numeric domain used by polyclip.
 *
 * Saved geometry stays untouched. Normalising only at the boolean boundary
 * collapses arithmetic tails without turning the drawing grid into a storage
 * migration or changing what a later editor save writes.
 */
export function normalizeBooleanBody(
  body: number[][], quantum = BOOLEAN_COORD_QUANTUM,
): number[][] | null {
  const step = Number.isFinite(quantum) && quantum > 0
    ? quantum
    : BOOLEAN_COORD_QUANTUM;
  const stable: number[][] = [];
  for (const raw of body || []) {
    if (!Array.isArray(raw) || raw.length < 2) return null;
    const x = Number(raw[0]), y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const qx = Math.round(x / step) * step;
    const qy = Math.round(y / step) * step;
    if (!Number.isFinite(qx) || !Number.isFinite(qy)) return null;
    const point = [Object.is(qx, -0) ? 0 : qx, Object.is(qy, -0) ? 0 : qy];
    if (!stable.length || !samePoint(stable[stable.length - 1], point)) stable.push(point);
  }
  if (stable.length > 1 && samePoint(stable[0], stable[stable.length - 1])) stable.pop();
  if (stable.length < 3) return null;
  if (new Set(stable.map((point) => `${point[0]},${point[1]}`)).size < 3) return null;
  return polygonArea(stable) > step * step ? stable : null;
}

export function polyclipPathD(geom: any): string {
  const out: string[] = [];
  for (const poly of geom || []) for (const ring of poly || []) {
    const pts = (ring || []).filter((p: any) => Array.isArray(p) && p.length >= 2);
    if (pts.length < 4) continue;
    out.push(`M ${pts.slice(0, -1).map((p: number[]) => `${p[0]} ${p[1]}`).join(' L ')} Z`);
  }
  return out.join(' ');
}

/** A wall segment has flat ends. Canonical node joins are added by `physicalBodySet`. */
export function partitionBody(
  a: number[], b: number[], cm: number, cellCm: number, gridPitch: number,
): number[][] | null {
  const half = wallCmToUnits(cm, cellCm, gridPitch) / 2;
  return linearWallBody({ a, b, halfDepth: half });
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
  return physicalBodyParts(space, cellCm, gridPitch).all;
}

export interface PhysicalBodyParts {
  drafts: number[][][];
  partitions: number[][][];
  columns: number[][][];
  /** Bounded mitre/bevel volumes; never persisted or independently editable. */
  patches: number[][][];
  /** Canonical independent volume inputs for boolean render/floor/light consumers. */
  all: number[][][];
}

export interface PhysicalBodySet extends PhysicalBodyParts {
  /** Unioned geometry without raw overlap/butt-face boundaries. */
  geometry: any | null;
}

export interface PartitionOpeningCut {
  hostId: string;
  a: [number, number];
  b: [number, number];
  depth: number;
}

/**
 * Cut only the explicitly hosted independent-wall body. Boolean failure keeps
 * the original body opaque (fail-dark) instead of manufacturing a light leak.
 */
export function cutPartitionBody(
  body: number[][], cuts: readonly PartitionOpeningCut[], epsilon = 1e-9,
): number[][][] {
  if (!cuts.length) return [body];
  let geometry: any = [closedRing(body)];
  try {
    for (const cut of cuts) {
      const dx = cut.b[0] - cut.a[0], dy = cut.b[1] - cut.a[1];
      const length = Math.hypot(dx, dy);
      if (!(length > epsilon)) continue;
      const ux = dx / length, uy = dy / length;
      const nx = -uy, ny = ux;
      const pad = Math.max(Number(cut.depth) || 0, epsilon * 4) * 1.25;
      const longitudinalPad = Math.max(epsilon * 2, length * 1e-9);
      const slot = [
        [cut.a[0] - ux * longitudinalPad - nx * pad,
          cut.a[1] - uy * longitudinalPad - ny * pad],
        [cut.b[0] + ux * longitudinalPad - nx * pad,
          cut.b[1] + uy * longitudinalPad - ny * pad],
        [cut.b[0] + ux * longitudinalPad + nx * pad,
          cut.b[1] + uy * longitudinalPad + ny * pad],
        [cut.a[0] - ux * longitudinalPad + nx * pad,
          cut.a[1] - uy * longitudinalPad + ny * pad],
      ];
      geometry = difference(geometry, closedRing(slot) as any);
    }
    return geometryOuterRings(geometry);
  } catch {
    return [body];
  }
}

/**
 * Raw editable bodies plus their computed, order-independent junction volumes.
 * Most runtime consumers need these polygons directly and must not pay for an
 * additional polygon union which they never read.
 */
/**
 * Subtract one #310 butt-end wedge from a simple wall body. The wedge sits at
 * a body corner, so the difference is expected to stay one simple ring; on
 * any degenerate polygon-clipping outcome the body is left untouched.
 */
function subtractWedgeFromBody(
  body: number[][], wedge: number[][],
): number[][] | null {
  try {
    const result: any = difference(
      [[...body.map((point) => [point[0], point[1]]), [body[0][0], body[0][1]]]] as any,
      [[...wedge.map((point) => [point[0], point[1]]), [wedge[0][0], wedge[0][1]]]] as any,
    );
    let best: number[][] | null = null;
    let bestArea = 0;
    for (const polygon of result || []) {
      const ring = (polygon?.[0] || []) as number[][];
      const area = Math.abs(polygonArea(ring));
      if (ring.length >= 4 && area > bestArea) {
        bestArea = area;
        best = ring.slice(0, -1).map((point) => [point[0], point[1]]);
      }
    }
    return best;
  } catch {
    return null;
  }
}

export function physicalBodyParts(
  space: Pick<SpaceModel, 'partitions' | 'room_drafts' | 'wall_columns'>,
  cellCm: number,
  gridPitch: number,
  epsilon = Math.max(gridPitch * 0.0002, 1e-9),
  partitionCuts: readonly PartitionOpeningCut[] = [],
): PhysicalBodyParts {
  const draftSegments: LinearWallSegment[] = [];
  const partitionSegments: LinearWallSegment[] = [];
  const cutsByPartition = new Map<string, PartitionOpeningCut[]>();
  for (const cut of partitionCuts) {
    const list = cutsByPartition.get(cut.hostId) || [];
    list.push(cut);
    cutsByPartition.set(cut.hostId, list);
  }
  const drafts: number[][][] = [];
  const partitions: number[][][] = [];
  const presentedPartitions: number[][][] = [];
  for (const draft of space.room_drafts || []) {
    for (let i = 0; i + 1 < draft.points.length; i++) {
      const halfDepth = wallCmToUnits(
        draft.segments[i]?.cm || 15, cellCm, gridPitch,
      ) / 2;
      const segment = { a: draft.points[i], b: draft.points[i + 1], halfDepth };
      const body = linearWallBody(segment);
      if (!body) continue;
      draftSegments.push(segment);
      drafts.push(body);
    }
  }
  const partitionMeta: { id: string; body: number[][] }[] = [];
  for (const partition of space.partitions || []) {
    const segment = {
      a: partition.a,
      b: partition.b,
      halfDepth: wallCmToUnits(partition.cm, cellCm, gridPitch) / 2,
    };
    const body = linearWallBody(segment);
    if (!body) continue;
    partitionSegments.push(segment);
    partitions.push(body);
    partitionMeta.push({ id: partition.id, body });
  }
  // #310: at a two-ray node the deeper wall's rectangular butt end may poke
  // past its thin partner's outer face; subtract the addressed wedge from the
  // owning body BEFORE opening cuts, so jambs inherit the clean silhouette.
  const allSegments = [...draftSegments, ...partitionSegments];
  for (const { segmentIndex, wedge } of pairButtEndTrimWedges(allSegments, epsilon)) {
    const target = segmentIndex < draftSegments.length
      ? { list: drafts, at: segmentIndex }
      : { list: partitions, at: segmentIndex - draftSegments.length };
    const trimmed = subtractWedgeFromBody(target.list[target.at], wedge);
    if (trimmed) {
      target.list[target.at] = trimmed;
      if (segmentIndex >= draftSegments.length) {
        partitionMeta[target.at].body = trimmed;
      }
    }
  }
  for (const meta of partitionMeta) {
    presentedPartitions.push(...cutPartitionBody(
      meta.body, cutsByPartition.get(meta.id) || [], epsilon,
    ));
  }
  const columns = (space.wall_columns || []).map((column) =>
    columnBody(column, cellCm, gridPitch));
  // Join volumes are presentation masonry too. Leaving them uncut can bridge
  // an opening placed close to a T/endpoint even though its raw host body was
  // correctly split. Other crossing walls remain opaque through their own raw
  // bodies; only the extra shared mitre/bevel volume is trimmed here.
  const patches = linearWallJoinPatches(
    [...draftSegments, ...partitionSegments], epsilon,
  ).flatMap((body) => cutPartitionBody(body, partitionCuts, epsilon));
  const all = [...drafts, ...presentedPartitions, ...patches, ...columns];
  return { drafts, partitions, columns, patches, all };
}

/** Explicit union consumer retained for geometry queries and pure tests. */
export function physicalBodySet(
  space: Pick<SpaceModel, 'partitions' | 'room_drafts' | 'wall_columns'>,
  cellCm: number,
  gridPitch: number,
  epsilon = Math.max(gridPitch * 0.0002, 1e-9),
): PhysicalBodySet {
  const parts = physicalBodyParts(space, cellCm, gridPitch, epsilon);
  return { ...parts, geometry: unionBodies(parts.all) };
}

export function unionBodies(bodies: number[][][]): any | null {
  try {
    const polygons = bodies
      .map((body) => normalizeBooleanBody(body))
      .filter((body): body is number[][] => !!body)
      .map((body) => closedRing(body));
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

export interface IntersectionBoundsFailure {
  boundIndex: number;
  phase: 'bound-union' | 'bound-intersection' | 'result-union';
}

export interface IntersectionPathsOptions {
  onBoundsFailure?: (failure: IntersectionBoundsFailure) => void;
}

/** A failed all-floor operation degrades one room at a time, never to a raw fan. */
function intersectionPathsByBound(
  base: any, bounds: number[][][], options: IntersectionPathsOptions,
): string[] {
  let combined: any = null;
  for (let i = 0; i < bounds.length; i++) {
    const limit = unionBodies([bounds[i]]);
    if (!limit) {
      options.onBoundsFailure?.({ boundIndex: i, phase: 'bound-union' });
      continue;
    }
    let clipped: any;
    try {
      clipped = intersection(base, limit);
    } catch {
      options.onBoundsFailure?.({ boundIndex: i, phase: 'bound-intersection' });
      continue;
    }
    if (!clipped?.length || geometryArea(clipped) <= BOOLEAN_COORD_QUANTUM ** 2) continue;
    if (!combined) {
      combined = clipped;
      continue;
    }
    try {
      // Keep the normal merged-floor semantics for overlapping legacy rooms.
      // Concatenating overlapping fragments into one evenodd path would punch
      // a transparent hole through their overlap.
      combined = union(combined, clipped);
    } catch {
      options.onBoundsFailure?.({ boundIndex: i, phase: 'result-union' });
    }
  }
  return combined ? geometryPolygonPaths(combined) : [];
}

/** `polygons` clipped to `bounds`, as disjoint paths. Empty when they miss. */
export function intersectionPaths(
  polygons: number[][][], bounds: number[][][], options: IntersectionPathsOptions = {},
): string[] {
  const base = unionBodies(polygons.filter((poly) => poly.length >= 3));
  // Do not let unionBodies' generic "skip an unusable member" behaviour hide
  // a broken room. A rejected ring must enter the room-local fallback so the
  // healthy rooms remain visible and the caller can identify the failed one.
  const hasRejectedBound = bounds.some((bound) => !normalizeBooleanBody(bound));
  const limit = hasRejectedBound ? null : unionBodies(bounds);
  if (!base) return [];
  if (limit) {
    try {
      return geometryPolygonPaths(intersection(base, limit));
    } catch {
      // Continue with the same floor one room at a time. The un-clipped fan may
      // cover the backdrop, so returning `base` is never a legal fallback.
    }
  }
  return intersectionPathsByBound(base, bounds, options);
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

/**
 * True when a light source is embedded in any opaque plan body.
 *
 * Wall masonry is polygon-clipping geometry because openings are represented
 * as holes. Partitions and columns are plain bodies. Keeping this decision in
 * one helper prevents render call sites from accidentally checking only one
 * of the two representations and re-introducing a half-lit wall/opening.
 */
export function pointInOpaquePlanBody(
  point: number[], masonryGeometry: any, bodies: number[][][],
): boolean {
  return pointInPhysicalGeometry(point, masonryGeometry)
    || bodies.some((body) => pointInPhysicalBody(point, body));
}

export function sameColumnPlacement(a: WallColumnCfg, b: WallColumnCfg, eps: number): boolean {
  if (Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1]) > eps) return false;
  if (Math.abs(clampColumnCm(a.cm) - clampColumnCm(b.cm)) > 1e-6) return false;
  if (a.shape !== b.shape) return true; // same outer body, different primitive
  if (a.shape === 'circle' || b.shape === 'circle') return true;
  const diff = Math.abs(canonicalColumnAngle(a.angle) - canonicalColumnAngle(b.angle));
  return Math.min(diff, 90 - diff) <= 1e-6;
}
