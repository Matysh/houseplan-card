/**
 * Wall thickness — pure geometry (docs/WALL-THICKNESS.md).
 *
 * Thickness is a rendering layer keyed by a segment identity that survives
 * resize. Wall bodies grow ±½ from the centreline; fills, glow, sun and
 * displayed m² use the inner (inset) contour. Wall-length rulers stay on the
 * centreline.
 */
import { union, difference, intersection } from 'polyclip-ts';
import { polygonArea, roomPoly, roomEdges, sharedBoundary, paperRoomShapes } from './logic';
import { NEAR_AXIS_MAX_DEGREES } from './near-axis';
import { LATTICE_NOISE_STEPS } from './coordinate-canonicalization';

export interface WallEntry {
  key: string;
  cm: number;
  /** Optional exact interval endpoints in config coordinates (new writes). */
  a?: number[];
  b?: number[];
}

export type WallGeometryStatus =
  | 'ok'
  | 'degraded-extra'
  | 'failed-core'
  | 'not-applicable';

/** One independently drawable/physical polygon-clipping component. */
export interface WallGeometryComponent {
  id: string;
  geom: any;
}

export interface WallBodiesGeometryResult {
  status: WallGeometryStatus;
  /** Last successful primary union. Isolated fallback components stay separate. */
  geom: any;
  components: readonly WallGeometryComponent[];
  /** Canonical room masonry before independent bodies. */
  roomGeom: any;
  paperGeom: any;
  depthUnits: number;
  openingIndex: OpeningWallIndex | null;
  /** Canonical junction topology reused by per-room inner contours. */
  multiWallNodes: MultiWallNodeMap | null;
  degradedExtraCount: number;
}

export interface WallGeometryOperations {
  /** Test seam around the transaction which may fail for one independent body. */
  mergeExtra?: (primary: any, extra: any, index: number) => any;
  /** Bounded diagnostic seam; never receives coordinates, ids or exceptions. */
  onCoreFailure?: (phase: string) => void;
}

export const WALL_MIN_CM = 1;
export const WALL_MAX_CM = 100;
/** Default thickness offered in the Draw toolbar (docs/WALL-THICKNESS.md §6). */
export const DRAW_WALL_DEFAULT_CM = 15;
/** Below this screen depth the diagonal hatch becomes visual noise. */
export const WALL_HATCH_MIN_PX = 3;

/**
 * Hatch density is a physical quantity, not a coordinate one (#230).
 *
 * The pattern step used to be a constant 8 units while wall thickness converts
 * through `cell_cm`, so the same 15 cm wall carried 7.8 stripes on a 1 cm grid
 * and 0.3 on a 25 cm one — a 25× spread for identical data. The step now
 * follows the plan's centimetres: 8 units at the reference `cell_cm: 5`, which
 * is 9.6 cm, and that distance holds at every grid scale.
 */
export const HATCH_REFERENCE_CELL_CM = 5;
export const HATCH_BASE_STEP_UNITS = 8;
/** Below this the stripes fuse into a fill even at maximum zoom (cell ≈ 80). */
export const HATCH_MIN_STEP_UNITS = 0.5;
/** Above this further thickening no longer reads (cell ≈ 0.5). */
export const HATCH_MAX_STEP_UNITS = 80;
/** A step thinner than this on screen is noise, not hatching. */
export const HATCH_MIN_STEP_PX = 2;

/** Mitre spikes longer than this × thickness fall back to a bevel. */
export const MITRE_LIMIT = 4;

/**
 * Visual mitre limit (#309, owner decision 2026-08-25). A mitre apex may
 * protrude at most this many maximal half-depths from the node; anything
 * longer is closed with a flat chamfer perpendicular to the apex direction.
 * A square corner of equal depths peaks at ~1.41·h, so 1.5 keeps every
 * right and obtuse corner byte-identical and only trims acute spikes.
 * MITRE_LIMIT above stays as the sanity bound for candidate construction.
 */
export const VISUAL_MITRE_LIMIT = 1.5;

/**
 * Flat chamfer of an over-long mitre apex (#309). Returns the clipped
 * polygon [node, pA, cA, cB, pB] where cA/cB sit on the fan edges at the
 * visual limit along the apex direction, or null when the apex is within
 * the limit (keep the mitre) or the cut degenerates (fall back to the
 * caller's bevel/chord).
 */
function chamferApex(
  node: number[], pA: number[], apex: number[], pB: number[], limit: number,
): number[][] | null {
  const ux = apex[0] - node[0], uy = apex[1] - node[1];
  const d = Math.hypot(ux, uy);
  if (!(d > 0) || d <= limit + 1e-9) return null;
  const nx = ux / d, ny = uy / d;
  const cut = (from: number[]): number[] | null => {
    const f = (from[0] - node[0]) * nx + (from[1] - node[1]) * ny;
    const t = (limit - f) / (d - f);
    if (!Number.isFinite(t) || t < -1e-9 || t > 1 + 1e-9) return null;
    return [from[0] + (apex[0] - from[0]) * t, from[1] + (apex[1] - from[1]) * t];
  };
  const cA = cut(pA), cB = cut(pB);
  if (!cA || !cB) return null;
  return [[node[0], node[1]], pA, cA, cB, pB];
}

/** Multi-ray joins stay inside this × the largest incident half-depth (#249). */
export const MULTI_WALL_JOIN_LIMIT = 1.25;

/** Maximum drafting deviation still rendered as a physical T/X junction (#279). */
export const MULTI_WALL_NEAR_ORTHOGONAL_MAX_DEGREES = NEAR_AXIS_MAX_DEGREES;

/** Normalized dot-product tolerance for a physically near-orthogonal ray pair. */
export const MULTI_WALL_ORTHOGONAL_DOT_EPSILON = Math.sin(
  MULTI_WALL_NEAR_ORTHOGONAL_MAX_DEGREES * Math.PI / 180,
);

export interface MultiWallNodeRaySupport {
  /** Physical half-depth owned by this finite co-directional interval. */
  halfDepth: number;
  /** Distance from the canonical node to the interval's real endpoint. */
  length: number;
}

/** A finite shared strip attached to an incident support's far endpoint. */
export interface MultiWallNodeRayContinuation extends MultiWallNodeRaySupport {
  /** Real near endpoint; it may turn instead of continuing co-directionally. */
  start: [number, number];
  /** Unit direction from `start` to the continuation's real far endpoint. */
  u: [number, number];
}

export interface MultiWallNodeRay {
  /** Unit direction from the canonical node toward the interval's other end. */
  u: [number, number];
  /** Largest incident half-depth at the node; used by the join formula. */
  halfDepth: number;
  /** Furthest real endpoint in this direction. */
  length: number;
  /** Non-dominated finite strips whose union is the physical ray support. */
  supports: MultiWallNodeRaySupport[];
  /** Shared finite strips attached at a support's far endpoint (#288). */
  continuations: MultiWallNodeRayContinuation[];
}

export interface MultiWallNode {
  point: [number, number];
  rays: MultiWallNodeRay[];
  halfDepth: number;
  limit: number;
}

/** Scale-relative lookup shared by every contour producer in one structural pass. */
export interface MultiWallNodeMap {
  epsilon: number;
  coordinateScale: number;
  nodes: MultiWallNode[];
  /** Spatial buckets keep vertex lookup linear instead of scanning all nodes. */
  index: Map<string, MultiWallNode[]>;
}

/** One finite physical wall centreline with its already-converted half depth. */
export interface LinearWallSegment {
  a: number[];
  b: number[];
  halfDepth: number;
}

// ------------------------------- units --------------------------------------

/** Shared full/static render policy for the thin-on-screen fallback. */
export function wallBodyNeedsSolid(depthUnits: number, pxPerUnit: number): boolean {
  return Number.isFinite(depthUnits) && depthUnits > 0
    && Number.isFinite(pxPerUnit) && pxPerUnit > 0
    && depthUnits * pxPerUnit < WALL_HATCH_MIN_PX;
}

/**
 * Pattern step in plan units for a given grid scale (#230, spec §8.1).
 *
 * At the reference scale this returns exactly the historical 8, so plans on
 * `cell_cm: 5` — every golden fixture among them — render byte for byte as
 * before.
 */
export function wallHatchStepUnits(cellCm: number): number {
  const c = Number(cellCm) > 0 ? Number(cellCm) : HATCH_REFERENCE_CELL_CM;
  if (c === HATCH_REFERENCE_CELL_CM) return HATCH_BASE_STEP_UNITS;
  const step = HATCH_BASE_STEP_UNITS * (HATCH_REFERENCE_CELL_CM / c);
  return Math.min(HATCH_MAX_STEP_UNITS, Math.max(HATCH_MIN_STEP_UNITS, step));
}

/**
 * Stripes too close together on screen: fill the body instead (#230, §8.4).
 *
 * Companion to `wallBodyNeedsSolid`, which watches the body's depth. Now that
 * the step is physical it no longer shrinks with zoom, so the far end of the
 * zoom range needs its own guard.
 */
export function wallHatchNeedsSolid(stepUnits: number, pxPerUnit: number): boolean {
  return Number.isFinite(stepUnits) && stepUnits > 0
    && Number.isFinite(pxPerUnit) && pxPerUnit > 0
    && stepUnits * pxPerUnit < HATCH_MIN_STEP_PX;
}

export function clampWallCm(cm: number): number {
  if (!Number.isFinite(cm)) return WALL_MIN_CM;
  return Math.max(WALL_MIN_CM, Math.min(WALL_MAX_CM, cm));
}

/** Config cm → the thickness field (cm, or inches when HA is imperial). */
export function cmToField(cm: number, imperial: boolean): string {
  if (!Number.isFinite(cm) || cm < 0) return '';
  if (imperial) return String(Math.round((cm / 2.54) * 100) / 100);
  return String(Math.round(cm * 100) / 100);
}

/**
 * Field value → cm. Empty / non-finite / ≤0 means "remove thickness"
 * (returns null). Imperial field is inches.
 */
export function fieldToCm(raw: string | number, imperial: boolean): number | null {
  const v = typeof raw === 'number' ? raw : parseFloat(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) return null;
  const cm = imperial ? v * 2.54 : v;
  return clampWallCm(cm);
}

/** Real cm → length in the same units as the room polygon (via cell_cm). */
export function wallCmToUnits(cm: number, cellCm: number, gridPitch: number): number {
  if (!Number.isFinite(cm) || cm <= 0) return 0;
  const c = Number(cellCm) > 0 ? Number(cellCm) : 5;
  return (clampWallCm(cm) / c) * gridPitch;
}

// ------------------------------- segment key --------------------------------

function q(v: number, pitch: number): number {
  if (!(pitch > 0) || !Number.isFinite(v)) return v;
  return Math.round(v / pitch) * pitch;
}

/** Storage-noise tolerance used only to stabilise wall identity near a node. */
function keyEpsilon(pitch: number): number {
  return Math.max(Math.abs(pitch) * 1e-6, 1e-9);
}

/**
 * Treat a coordinate already within storage precision of a grid node as that
 * exact node. Arbitrary off-grid geometry remains off-grid: this is identity
 * canonicalisation, not an implicit geometry snap.
 */
function canonicalKeyCoordinate(v: number, pitch: number): number {
  if (!(pitch > 0) || !Number.isFinite(v)) return v;
  const snapped = q(v, pitch);
  return Math.abs(snapped - v) <= keyEpsilon(pitch) ? snapped : v;
}

/**
 * Direction of a wall, modulo 180° (a wall is the same from either end),
 * as a unit vector with a stable sign (prefer +x, then +y).
 */
export function wallDir(a: number[], b: number[]): [number, number] {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-12) return [1, 0];
  dx /= L; dy /= L;
  if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) {
    dx = -dx; dy = -dy;
  }
  return [dx, dy];
}

/**
 * Segment key: quantised midpoint + direction. Same wall from either end,
 * survives whole-grid moves when re-keyed by the resize commit.
 */
export function wallKey(a: number[], b: number[], pitch: number): string {
  const ca = [canonicalKeyCoordinate(a[0], pitch), canonicalKeyCoordinate(a[1], pitch)];
  const cb = [canonicalKeyCoordinate(b[0], pitch), canonicalKeyCoordinate(b[1], pitch)];
  const mx = q((ca[0] + cb[0]) / 2, pitch);
  const my = q((ca[1] + cb[1]) / 2, pitch);
  const [dx, dy] = wallDir(ca, cb);
  // angle bucket: round to ~0.1° so float noise does not fork keys
  let ang = Math.atan2(dy, dx);
  if (ang < 0) ang += Math.PI;
  const aq = Math.round(ang * 1800) / 1800; // π rad ≈ 3.14 → 0.1° steps
  const prec = pitch > 0 && pitch < 0.01 ? 6 : pitch < 1 ? 4 : 2;
  return `${mx.toFixed(prec)},${my.toFixed(prec)}@${aq.toFixed(4)}`;
}

/**
 * Scale applied to endpoints before keying. Render-space edges use
 * `coordScale = NORM_W` with `pitch = GRID_STEP_N` so keys match the
 * normalised config; config-space edges use `coordScale = 1`.
 */
function keyOf(a: number[], b: number[], pitch: number, scale: number): string {
  if (scale === 1) return wallKey(a, b, pitch);
  return wallKey([a[0] / scale, a[1] / scale], [b[0] / scale, b[1] / scale], pitch);
}

/** Exact stored interval in the caller's coordinate space, when available. */
function entrySpan(w: WallEntry, coordScale: number): [number[], number[]] | null {
  if (!Array.isArray(w.a) || !Array.isArray(w.b) || w.a.length < 2 || w.b.length < 2) return null;
  const nums = [Number(w.a[0]), Number(w.a[1]), Number(w.b[0]), Number(w.b[1])];
  if (!nums.every(Number.isFinite)) return null;
  const scale = coordScale > 0 ? coordScale : 1;
  return [[nums[0] * scale, nums[1] * scale], [nums[2] * scale, nums[3] * scale]];
}

/** Persist an interval with both its compatible key and lossless endpoints. */
function wallEntry(a: number[], b: number[], cm: number, pitch: number, coordScale: number): WallEntry {
  const scale = coordScale > 0 ? coordScale : 1;
  return {
    key: keyOf(a, b, pitch, scale),
    cm: clampWallCm(cm),
    a: [a[0] / scale, a[1] / scale],
    b: [b[0] / scale, b[1] / scale],
  };
}

/** One parsed key: midpoint in the caller's coordinate space + angle bucket. */
interface ParsedKey {
  w: WallEntry;
  x: number;
  y: number;
  ang: number;
}

function parseKeys(walls: WallEntry[], coordScale: number): ParsedKey[] {
  const scale = coordScale > 0 ? coordScale : 1;
  const out: ParsedKey[] = [];
  for (const w of walls) {
    const at = w.key.lastIndexOf('@');
    if (at < 0) continue;
    const [sx, sy] = w.key.slice(0, at).split(',').map(Number);
    const aq = Number(w.key.slice(at + 1));
    if (![sx, sy, aq].every(Number.isFinite)) continue;
    out.push({ w, x: sx * scale, y: sy * scale, ang: aq });
  }
  return out;
}

/** Direction of a segment as a 0..π bucket, matching the key's angle field. */
function segAngle(a: number[], b: number[]): number {
  const [dx, dy] = wallDir(a, b);
  let ang = Math.atan2(dy, dx);
  if (ang < 0) ang += Math.PI;
  return ang;
}

function angleClose(x: number, y: number): boolean {
  let d = Math.abs(x - y);
  if (d > Math.PI / 2) d = Math.PI - d;
  return d < 0.02; // ~1°
}

/**
 * Match within half a grid step on the midpoint (direction must agree).
 *
 * AUD-159B6-01: this used to also accept a key whose midpoint merely LAY
 * SOMEWHERE on the queried segment, so 30 cm set on a 4-unit shared stretch
 * was reported for the whole 10-unit edge that contains it and the thickness
 * visibly leaked past the physical wall. A key now identifies ONE stretch;
 * callers query atomic intervals (see wallIntervals) and old whole-edge keys
 * are resolved separately, per parent edge, in cmsForPoly().
 */
export function lookupWall(
  walls: WallEntry[] | null | undefined,
  a: number[], b: number[],
  pitch: number,
  coordScale = 1,
): WallEntry | null {
  if (!walls?.length) return null;
  const want = keyOf(a, b, pitch, coordScale);
  const hit = walls.find((w) => w.key === want);
  if (hit) return hit;
  // A lossless entry can prove that it names this exact physical stretch even
  // when an older midpoint key landed on the other side of a rounding tie.
  // This is deliberately same-span only: parent containment remains the
  // separate exactCoveringWall/cmsForPoly compatibility contract.
  const scale = coordScale > 0 ? coordScale : 1;
  const exactEps = keyEpsilon(pitch) * scale;
  const closePoint = (x: number[], y: number[]): boolean => (
    Math.abs(x[0] - y[0]) <= exactEps && Math.abs(x[1] - y[1]) <= exactEps
  );
  for (const wall of walls) {
    const span = entrySpan(wall, scale);
    if (!span) continue;
    if ((closePoint(span[0], a) && closePoint(span[1], b))
        || (closePoint(span[0], b) && closePoint(span[1], a))) return wall;
  }
  // tolerant fallback: same direction bucket, midpoint within half pitch (norm)
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const ang = segAngle(a, b);
  const tol = Math.max(pitch * 0.5, 1e-9) * scale;
  for (const e of parseKeys(walls, scale)) {
    if (!angleClose(e.ang, ang)) continue;
    if (Math.hypot(e.x - mx, e.y - my) <= tol) return e.w;
  }
  return null;
}

export function thicknessCmAt(
  walls: WallEntry[] | null | undefined,
  a: number[], b: number[],
  pitch: number,
  coordScale = 1,
): number {
  const e = lookupWall(walls, a, b, pitch, coordScale);
  if (e && e.cm > 0) return clampWallCm(e.cm);
  const exact = exactCoveringWall(walls, a, b, pitch, coordScale);
  return exact ? clampWallCm(exact.cm) : 0;
}

/**
 * Lossless parent-run fallback for an atomic child query.
 *
 * `lookupWall` intentionally keeps the narrow "one key = one stretch"
 * contract (AUD-159B6-01).  Closing a virtual span, however, asks about the
 * atomic solid children around it while persisted exact endpoints may describe
 * their longer parent run.  Exact endpoints can prove containment without
 * broadening the ambiguous legacy key-only fallback.
 */
function exactCoveringWall(
  walls: WallEntry[] | null | undefined,
  a: number[], b: number[],
  pitch: number,
  coordScale: number,
): WallEntry | null {
  if (!walls?.length) return null;
  const scale = coordScale > 0 ? coordScale : 1;
  const queryLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (queryLen < 1e-12) return null;
  const queryAngle = segAngle(a, b);
  const tol = Math.max(pitch * 0.5, 1e-9) * scale;
  let best: { wall: WallEntry; extra: number; stable: string } | null = null;
  for (const wall of walls) {
    if (!(wall.cm > 0)) continue;
    const span = entrySpan(wall, scale);
    if (!span) continue;
    const spanLen = Math.hypot(span[1][0] - span[0][0], span[1][1] - span[0][1]);
    if (spanLen < 1e-12 || !angleClose(segAngle(span[0], span[1]), queryAngle)) continue;
    if (distToSeg(a[0], a[1], span[0][0], span[0][1], span[1][0], span[1][1]) > tol
        || distToSeg(b[0], b[1], span[0][0], span[0][1], span[1][0], span[1][1]) > tol) continue;
    // A shorter span may sit within endpoint tolerance but cannot prove that
    // it covers the query.  Keep that tolerance scale-relative, like lookup.
    if (spanLen + tol < queryLen) continue;
    const extra = Math.max(0, spanLen - queryLen);
    const stable = `${wall.key}|${clampWallCm(wall.cm)}|${span.flat().join(',')}`;
    if (!best || extra < best.extra - 1e-12
        || (Math.abs(extra - best.extra) <= 1e-12 && stable < best.stable)) {
      best = { wall, extra, stable };
    }
  }
  return best?.wall || null;
}

/**
 * Drop entries whose key matches no current wall stretch.
 *
 * "Stretch" means an ATOMIC interval (AUD-159B6-01): whole polygon edges,
 * shared overlaps AND the pieces an open span cuts an edge into — the last of
 * which is where a legitimately split thickness lives, so leaving them out
 * would delete the solid remainder of a partially opened wall on the next save.
 */
export function degradeWalls(
  walls: WallEntry[] | null | undefined,
  rooms: any[],
  pitch: number,
  coordScale = 1,
  openCuts: number[][] = [],
): WallEntry[] {
  if (!walls?.length) return [];
  const live = new Set<string>();
  const edges = roomEdges(rooms);
  for (const seg of edges) {
    live.add(keyOf([seg[0], seg[1]], [seg[2], seg[3]], pitch, coordScale));
  }
  // partial shared overlaps are keyed by their own mid — keep those too
  const list = rooms || [];
  const eps = Math.max(pitch * coordScale * 0.02, 1e-9);
  for (let i = 0; i < list.length; i++) {
    const pa = roomPoly(list[i]);
    if (!pa) continue;
    for (let j = i + 1; j < list.length; j++) {
      const pb = roomPoly(list[j]);
      if (!pb) continue;
      for (const sg of sharedBoundary(pa, pb, eps)) {
        live.add(keyOf([sg[0], sg[1]], [sg[2], sg[3]], pitch, coordScale));
      }
    }
  }
  for (const room of list) {
    if (!room?.id) continue;
    const at = atomicPolyForRoom(list, room.id, openCuts, pitch, coordScale, walls);
    if (!at) continue;
    for (let i = 0; i < at.poly.length; i++) {
      live.add(keyOf(at.poly[i], at.poly[(i + 1) % at.poly.length], pitch, coordScale));
    }
  }
  const exactStillLive = (w: WallEntry): boolean => {
    const span = entrySpan(w, coordScale);
    if (!span) return false;
    const [a, b] = span;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L <= eps) return false;
    const onCurrentEdge = edges.some((sg) => {
      const ea = [sg[0], sg[1]], eb = [sg[2], sg[3]];
      return angleClose(segAngle(a, b), segAngle(ea, eb))
        && distToSeg(a[0], a[1], ea[0], ea[1], eb[0], eb[1]) <= eps
        && distToSeg(b[0], b[1], ea[0], ea[1], eb[0], eb[1]) <= eps;
    });
    if (!onCurrentEdge) return false;
    // A stored solid interval must not straddle a newly virtual piece.
    const overlapsCut = (openCuts || []).some((c) => {
      const ca = [c[0], c[1]], cb = [c[2], c[3]];
      if (!angleClose(segAngle(a, b), segAngle(ca, cb))) return false;
      const lineDist = (p: number[]) => Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L;
      if (lineDist(ca) > eps || lineDist(cb) > eps) return false;
      const L2 = L * L;
      const t0 = ((ca[0] - a[0]) * dx + (ca[1] - a[1]) * dy) / L2;
      const t1 = ((cb[0] - a[0]) * dx + (cb[1] - a[1]) * dy) / L2;
      return Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > eps / L;
    });
    return !overlapsCut;
  };
  return walls.filter((w) => (live.has(w.key) || exactStillLive(w))
    && w.cm >= WALL_MIN_CM && w.cm <= WALL_MAX_CM);
}

/**
 * Wall direction vs opening angle (both mod 180°). Used so a T-junction
 * opening does not bind to the perpendicular receiving wall.
 */
export function wallAngleMatches(
  a: number[], b: number[],
  openingAngleDeg: number,
  tolDeg = 8,
): boolean {
  const [dx, dy] = wallDir(a, b);
  let wang = Math.atan2(dy, dx);
  if (wang < 0) wang += Math.PI;
  let oang = ((openingAngleDeg * Math.PI) / 180) % Math.PI;
  if (oang < 0) oang += Math.PI;
  let d = Math.abs(wang - oang);
  if (d > Math.PI / 2) d = Math.PI - d;
  return d <= (tolDeg * Math.PI) / 180;
}

/**
 * After an edge drag: rewrite keys whose old span mid/dir map to a moved
 * stretch. `oldSpans` / `newSpans` are parallel lists of [a,b] endpoints.
 *
 * A stored key may name either the whole polygon edge or one atomic remainder
 * left by a partial shared/open stretch. The latter has a different midpoint,
 * so an exact whole-edge key map is insufficient: project every unmatched key
 * onto the old edge and carry that relative point onto the new one.
 */
export type WallRekeyMode = 'affine' | 'fixed-topology';

export interface WallRekeyResult {
  walls: WallEntry[];
  /** Fixed-topology candidate is unsafe and must not reach preview/commit. */
  rejected: boolean;
}

function rekeyWallsAfterMoveInternal(
  walls: WallEntry[] | null | undefined,
  oldSpans: [number[], number[]][],
  newSpans: [number[], number[]][],
  pitch: number,
  coordScale = 1,
  mode: WallRekeyMode = 'affine',
  reject?: () => void,
): WallEntry[] {
  if (!walls?.length) return [];
  if (oldSpans.length !== newSpans.length) {
    if (mode === 'fixed-topology') reject?.();
    return walls.slice();
  }
  const scale = coordScale > 0 ? coordScale : 1;
  const tol = Math.max(pitch * 0.5, 1e-9) * scale;
  const exactEps = Math.max(pitch * scale * 1e-6, 1e-9);
  type Move = {
    oa: number[]; ob: number[]; na: number[]; nb: number[];
    dx: number; dy: number; len2: number;
  };
  const moves: Move[] = [];
  const keyMoves = new Map<string, Set<string>>();
  const wholeEdgeMoves = new Map<string, Set<string>>();
  const addKeyMove = (map: Map<string, Set<string>>, from: string, to: string): void => {
    const targets = map.get(from) || new Set<string>();
    targets.add(to);
    map.set(from, targets);
  };
  for (let i = 0; i < oldSpans.length; i++) {
    const [oa, ob] = oldSpans[i];
    const [na, nb] = newSpans[i];
    if (![oa?.[0], oa?.[1], ob?.[0], ob?.[1], na?.[0], na?.[1], nb?.[0], nb?.[1]]
      .every(Number.isFinite)) continue;
    const dx = ob[0] - oa[0], dy = ob[1] - oa[1];
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-18) continue;
    // Unchanged polygon edges are context, not split points.  Including them
    // would atomise every long wall on every preview even when no part moved.
    if (Math.max(Math.hypot(na[0] - oa[0], na[1] - oa[1]),
      Math.hypot(nb[0] - ob[0], nb[1] - ob[1])) <= exactEps) continue;
    moves.push({ oa, ob, na, nb, dx, dy, len2 });
    const ok = keyOf(oa, ob, pitch, coordScale);
    const nk = keyOf(na, nb, pitch, coordScale);
    // Some pre-normalisation configurations carry render-space legacy keys.
    // They have no endpoints with which to disambiguate storage generations,
    // so recognise only the same whole-edge identity in either historical
    // coordinate convention. Partial midpoint projection remains forbidden.
    addKeyMove(wholeEdgeMoves, ok, nk);
    addKeyMove(wholeEdgeMoves, keyOf(oa, ob, pitch, 1), keyOf(na, nb, pitch, 1));
    if (ok !== nk) {
      addKeyMove(keyMoves, ok, nk);
    }
  }
  if (!moves.length) return walls.slice();

  const pointAt = (a: number[], b: number[], t: number): number[] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
  const closePoint = (a: number[], b: number[]): boolean =>
    Math.hypot(a[0] - b[0], a[1] - b[1]) <= exactEps;
  const mapPoint = (p: number[], move: Move): number[] => {
    if (mode === 'fixed-topology') {
      const adx = move.na[0] - move.oa[0], ady = move.na[1] - move.oa[1];
      const bdx = move.nb[0] - move.ob[0], bdy = move.nb[1] - move.ob[1];
      // Safe Resize has only two legal transforms for one source edge:
      //
      // - the moving wall translates rigidly, so every physical breakpoint
      //   follows by the same vector;
      // - a perpendicular side wall changes length, so only its topology
      //   endpoint moves and interior thickness breakpoints stay put.
      //
      // Reusing the historical affine `t` mapping for the second case is the
      // producer behind #298: it creates a point that belongs to no polygon.
      if (Math.hypot(adx - bdx, ady - bdy) <= exactEps) {
        return [p[0] + adx, p[1] + ady];
      }
      if (closePoint(p, move.oa)) return [...move.na];
      if (closePoint(p, move.ob)) return [...move.nb];
      return [...p];
    }
    const t = Math.max(0, Math.min(1,
      ((p[0] - move.oa[0]) * move.dx + (p[1] - move.oa[1]) * move.dy) / move.len2));
    return pointAt(move.na, move.nb, t);
  };
  const canonicalSpan = (a: number[], b: number[]): [number[], number[]] => {
    const [ux, uy] = wallDir(a, b);
    return (b[0] - a[0]) * ux + (b[1] - a[1]) * uy >= 0
      ? [[...a], [...b]] : [[...b], [...a]];
  };

  const out: WallEntry[] = [];
  const exactOut: { entry: WallEntry; span: [number[], number[]] }[] = [];
  const pushExact = (a: number[], b: number[], cm: number): void => {
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) <= exactEps) return;
    const [ca, cb] = canonicalSpan(a, b);
    const value = clampWallCm(cm);
    const duplicate = exactOut.some((candidate) => candidate.entry.cm === value
      && closePoint(candidate.span[0], ca) && closePoint(candidate.span[1], cb));
    if (duplicate) return;
    const entry = wallEntry(ca, cb, value, pitch, scale);
    out.push(entry);
    exactOut.push({ entry, span: [ca, cb] });
  };

  for (const w of walls) {
    // Exact endpoints are authoritative for new entries. Never move only their
    // compatibility key while leaving a/b behind on the old wall.  A record
    // may be longer than the moved room edge, so partition it at every overlap
    // boundary and transform the covered atoms from this immutable source.
    const exact = entrySpan(w, scale);
    if (exact) {
      const [wa, wb] = canonicalSpan(exact[0], exact[1]);
      const wx = wb[0] - wa[0], wy = wb[1] - wa[1];
      const wallLen2 = wx * wx + wy * wy;
      const wallLen = Math.sqrt(wallLen2);
      if (wallLen <= exactEps) {
        out.push({ ...w, cm: clampWallCm(w.cm) });
        continue;
      }

      type Overlap = { lo: number; hi: number; move: Move };
      const overlaps: Overlap[] = [];
      for (const move of moves) {
        if (!angleClose(segAngle(wa, wb), segAngle(move.oa, move.ob))) continue;
        const lineDistance = (p: number[]): number =>
          Math.abs((p[0] - wa[0]) * wy - (p[1] - wa[1]) * wx) / wallLen;
        if (lineDistance(move.oa) > tol || lineDistance(move.ob) > tol) continue;
        const ta = ((move.oa[0] - wa[0]) * wx + (move.oa[1] - wa[1]) * wy) / wallLen2;
        const tb = ((move.ob[0] - wa[0]) * wx + (move.ob[1] - wa[1]) * wy) / wallLen2;
        const lo = Math.max(0, Math.min(ta, tb));
        const hi = Math.min(1, Math.max(ta, tb));
        if ((hi - lo) * wallLen > exactEps) overlaps.push({ lo, hi, move });
      }

      if (!overlaps.length) {
        // A fixed-topology edit is not allowed to canonicalise an unrelated
        // record as a side effect: its compatibility key and endpoints are
        // observable storage identity. The generic historical transform keeps
        // its previous normalising behaviour for isolated callers/tests.
        if (mode === 'fixed-topology') out.push({ ...w });
        else pushExact(wa, wb, w.cm);
        continue;
      }

      const bounds = [0, 1, ...overlaps.flatMap(({ lo, hi }) => [lo, hi])]
        .sort((a, b) => a - b)
        .filter((value, index, list) => index === 0
          || Math.abs(value - list[index - 1]) * wallLen > exactEps);
      const mappedAtoms: [number[], number[]][] = [];
      for (let i = 0; i + 1 < bounds.length; i++) {
        const lo = bounds[i], hi = bounds[i + 1];
        if ((hi - lo) * wallLen <= exactEps) continue;
        const a = pointAt(wa, wb, lo), b = pointAt(wa, wb, hi);
        const mid = (lo + hi) / 2;
        const candidates = overlaps.filter((overlap) =>
          mid >= overlap.lo - 1e-12 && mid <= overlap.hi + 1e-12);
        if (!candidates.length) {
          mappedAtoms.push([a, b]);
          continue;
        }
        const first: [number[], number[]] = [
          mapPoint(a, candidates[0].move), mapPoint(b, candidates[0].move),
        ];
        const conflict = candidates.slice(1).some((candidate) => {
          const ca = mapPoint(a, candidate.move), cb = mapPoint(b, candidate.move);
          return !closePoint(first[0], ca) || !closePoint(first[1], cb);
        });
        // Conflicting room transforms are invalid planner input.  Preserve the
        // source atom rather than selecting by array order or losing masonry.
        mappedAtoms.push(conflict ? [a, b] : first);
      }

      // Two rooms on opposite sides of one shared seam contribute separate
      // side-edge moves. Moving the seam changes their meeting point, but the
      // physical wall covering both side edges is still one straight,
      // continuous record. Reassemble only atoms that meet exactly and stay
      // collinear; a real partial perpendicular move still leaves disjoint or
      // angled atoms and therefore keeps the lossless split from #253.
      const collinearForward = (left: [number[], number[]], right: [number[], number[]]): boolean => {
        const ldx = left[1][0] - left[0][0], ldy = left[1][1] - left[0][1];
        const rdx = right[1][0] - right[0][0], rdy = right[1][1] - right[0][1];
        const leftLength = Math.hypot(ldx, ldy);
        if (leftLength <= exactEps || ldx * rdx + ldy * rdy <= 0) return false;
        return Math.abs(ldx * rdy - ldy * rdx) / leftLength <= exactEps;
      };
      const coalesced: [number[], number[]][] = [];
      for (const atom of mappedAtoms) {
        const previous = coalesced[coalesced.length - 1];
        if (previous && closePoint(previous[1], atom[0])
            && collinearForward(previous, atom)) {
          previous[1] = atom[1];
        } else {
          coalesced.push([[...atom[0]], [...atom[1]]]);
        }
      }
      if (mode === 'fixed-topology' && coalesced.length === 1) {
        const [nextA, nextB] = coalesced[0];
        const sameSpan = (closePoint(nextA, exact[0]) && closePoint(nextB, exact[1]))
          || (closePoint(nextA, exact[1]) && closePoint(nextB, exact[0]));
        if (sameSpan) {
          out.push({ ...w });
          continue;
        }
      }
      for (const [a, b] of coalesced) {
        pushExact(a, b, w.cm);
      }
      continue;
    }

    // Legacy entries carry only a midpoint/direction key, so they cannot be
    // split without inventing a length. Safe Resize permits only an exact,
    // unambiguous whole-edge identity. A partial/ambiguous affected key rejects
    // the complete candidate; an unrelated key stays byte-equivalent.
    if (mode === 'fixed-topology') {
      const direct = wholeEdgeMoves.get(w.key);
      if (direct?.size === 1) {
        const key = [...direct][0];
        out.push(key === w.key ? { ...w } : { ...w, key });
        continue;
      }
      const parsedVariants = [parseKeys([w], scale)[0]];
      if (scale !== 1) parsedVariants.push(parseKeys([w], 1)[0]);
      const touchesChangedEdge = parsedVariants.filter(Boolean).some((parsed) =>
        moves.some((move) => {
          if (!angleClose(parsed!.ang, segAngle(move.oa, move.ob))) return false;
          const t = ((parsed!.x - move.oa[0]) * move.dx
            + (parsed!.y - move.oa[1]) * move.dy) / move.len2;
          return t >= -1e-6 && t <= 1 + 1e-6
            && distToSeg(parsed!.x, parsed!.y,
              move.oa[0], move.oa[1], move.ob[0], move.ob[1]) <= tol;
        }));
      if ((direct?.size || 0) > 1 || touchesChangedEdge) reject?.();
      out.push({ ...w });
      continue;
    }

    // Historical affine transformations retain their projected-midpoint
    // compatibility behaviour outside production Safe Resize.
    let nk = '';
    const direct = keyMoves.get(w.key);
    if (direct?.size === 1) nk = [...direct][0];
    if (!nk) {
      const parsed = parseKeys([w], scale)[0];
      if (parsed) {
        const targets = new Set<string>();
        for (const move of moves) {
          if (!angleClose(parsed.ang, segAngle(move.oa, move.ob))) continue;
          const t = ((parsed.x - move.oa[0]) * move.dx
            + (parsed.y - move.oa[1]) * move.dy) / move.len2;
          if (t < -1e-6 || t > 1 + 1e-6) continue;
          if (distToSeg(parsed.x, parsed.y,
            move.oa[0], move.oa[1], move.ob[0], move.ob[1]) > tol) continue;
          const at = mapPoint([parsed.x, parsed.y], move);
          const [ux, uy] = wallDir(move.na, move.nb);
          const arm = Math.max(pitch * scale, 1e-6);
          targets.add(keyOf(
            [at[0] - ux * arm, at[1] - uy * arm],
            [at[0] + ux * arm, at[1] + uy * arm],
            pitch, scale,
          ));
        }
        if (targets.size === 1) nk = [...targets][0];
      }
    }
    out.push({ ...w, key: nk || w.key, cm: clampWallCm(w.cm) });
  }
  return out;
}

/** Historical array-only API retained for pure affine callers. */
export function rekeyWallsAfterMove(
  walls: WallEntry[] | null | undefined,
  oldSpans: [number[], number[]][],
  newSpans: [number[], number[]][],
  pitch: number,
  coordScale = 1,
  mode: WallRekeyMode = 'affine',
): WallEntry[] {
  return rekeyWallsAfterMoveInternal(
    walls, oldSpans, newSpans, pitch, coordScale, mode,
  );
}

/** Production result: unsafe legacy correspondence is explicit and atomic. */
export function rekeyWallsAfterMoveChecked(
  walls: WallEntry[] | null | undefined,
  oldSpans: [number[], number[]][],
  newSpans: [number[], number[]][],
  pitch: number,
  coordScale = 1,
  mode: WallRekeyMode = 'fixed-topology',
): WallRekeyResult {
  let rejected = false;
  const next = rekeyWallsAfterMoveInternal(
    walls, oldSpans, newSpans, pitch, coordScale, mode,
    () => { rejected = true; },
  );
  return { walls: rejected ? (walls || []).map((wall) => ({ ...wall })) : next, rejected };
}

/**
 * Fail-closed carrier/lattice proof for exact wall records after Safe Resize.
 *
 * A compact record may cross several collinear room edges, so checking that
 * both endpoints touch one edge is insufficient. Project every collinear
 * room-wall carrier onto the record and require their union to cover its full
 * interval without gaps. Independent partitions are not carriers for
 * `space.walls`. Legacy key-only records have no provable extent and remain a
 * compatibility concern of `rekeyWallsAfterMoveChecked`.
 */
export function wallRecordCarrierViolations(
  walls: WallEntry[] | null | undefined,
  carriers: [number[], number[]][],
  pitch: number,
  coordScale = 1,
  latticeDebt: WallEntry[] | null | undefined = [],
): string[] {
  const scale = coordScale > 0 ? coordScale : 1;
  const latticePitch = Math.abs(pitch);
  const eps = Math.max(latticePitch * scale * LATTICE_NOISE_STEPS, 1e-9);
  const onLattice = (value: number): boolean => {
    if (!(latticePitch > 0)) return true;
    const normalised = value / scale;
    const steps = normalised / latticePitch;
    return Math.abs(steps - Math.round(steps)) < LATTICE_NOISE_STEPS;
  };
  // A Resize may need to rewrite a record whose other endpoint was authored
  // off-grid historically. That coordinate is not newly produced by Resize:
  // allow it only when the exact same physical endpoint already existed in the
  // immutable source snapshot. Carrier coverage is still proved below.
  const oldEndpoints = (latticeDebt || []).flatMap((wall) => {
    const span = entrySpan(wall, scale);
    return span ? span.map((point) => [...point]) : [];
  });
  const pointIsLatticeSafe = (point: number[]): boolean => point.every((value, axis) =>
    onLattice(value) || oldEndpoints.some((old) => Math.abs(value - old[axis]) <= eps));

  const violations: string[] = [];
  const signature = (wall: WallEntry): string => JSON.stringify([
    wall.key, wall.cm, wall.a, wall.b,
  ]);
  for (const wall of walls || []) {
    const span = entrySpan(wall, scale);
    if (!span) continue;
    const [a, b] = span;
    if (![a[0], a[1], b[0], b[1]].every(Number.isFinite)
        || !pointIsLatticeSafe(a) || !pointIsLatticeSafe(b)) {
      violations.push(signature(wall));
      continue;
    }
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length <= eps) {
      violations.push(signature(wall));
      continue;
    }
    const ux = dx / length, uy = dy / length;
    const intervals: [number, number][] = [];
    for (const carrier of carriers) {
      const [ca, cb] = carrier;
      if (![ca?.[0], ca?.[1], cb?.[0], cb?.[1]].every(Number.isFinite)) continue;
      const lineDistance = (point: number[]): number =>
        Math.abs((point[0] - a[0]) * uy - (point[1] - a[1]) * ux);
      if (lineDistance(ca) > eps || lineDistance(cb) > eps) continue;
      const ta = (ca[0] - a[0]) * ux + (ca[1] - a[1]) * uy;
      const tb = (cb[0] - a[0]) * ux + (cb[1] - a[1]) * uy;
      const lo = Math.max(0, Math.min(ta, tb));
      const hi = Math.min(length, Math.max(ta, tb));
      if (hi - lo > eps) intervals.push([lo, hi]);
    }
    intervals.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
    let covered = 0;
    for (const [lo, hi] of intervals) {
      if (lo > covered + eps) break;
      covered = Math.max(covered, hi);
      if (covered >= length - eps) break;
    }
    if (covered < length - eps) violations.push(signature(wall));
  }
  return violations;
}

export function wallRecordsHaveCarrierCoverage(
  walls: WallEntry[] | null | undefined,
  carriers: [number[], number[]][],
  pitch: number,
  coordScale = 1,
  latticeDebt: WallEntry[] | null | undefined = [],
): boolean {
  return wallRecordCarrierViolations(
    walls, carriers, pitch, coordScale, latticeDebt,
  ).length === 0;
}

/** Upsert or remove a wall entry by endpoints. */
export function setWallThickness(
  walls: WallEntry[] | null | undefined,
  a: number[], b: number[],
  cm: number | null,
  pitch: number,
  coordScale = 1,
): WallEntry[] {
  const key = keyOf(a, b, pitch, coordScale);
  const base = (walls || []).filter((w) => w.key !== key);
  if (cm == null || cm < WALL_MIN_CM) return base;
  return [...base, wallEntry(a, b, cm, pitch, coordScale)];
}

/**
 * Every atomic stretch of one room that may carry a thickness (open ones are
 * excluded). The unit of a wall is the interval, not the polygon edge.
 */
export function solidIntervalsForRoom(
  rooms: any[],
  roomId: string,
  openCuts: number[][],
  pitch: number,
  coordScale = 1,
  wallBreaks: WallEntry[] | null | undefined = [],
): Array<{ a: number[]; b: number[] }> {
  const at = atomicPolyForRoom(rooms, roomId, openCuts, pitch, coordScale, wallBreaks);
  if (!at) return [];
  const out: Array<{ a: number[]; b: number[] }> = [];
  for (let i = 0; i < at.poly.length; i++) {
    const a = at.poly[i], b = at.poly[(i + 1) % at.poly.length];
    if (edgeIsOpen(a, b, openCuts, pitch, coordScale)) continue;
    out.push({ a, b });
  }
  return out;
}

/**
 * Apply one thickness to every atomic stretch of a room that is allowed to
 * carry one (skips open-boundary stretches listed in `openCuts`).
 */
export function setWallThicknessForRoom(
  walls: WallEntry[] | null | undefined,
  rooms: any[],
  roomId: string,
  cm: number | null,
  pitch: number,
  openCuts: number[][] = [],
  coordScale = 1,
): WallEntry[] {
  let out = walls ? walls.slice() : [];
  for (const iv of solidIntervalsForRoom(rooms, roomId, openCuts, pitch, coordScale, out)) {
    out = setWallThickness(out, iv.a, iv.b, cm, pitch, coordScale);
  }
  return out;
}

/**
 * After drawing a new room: set session thickness on stretches that do not yet
 * have one. Shared stretches that already carry a neighbour's cm are left
 * alone (docs/WALL-THICKNESS.md — one physical wall, one thickness).
 */
export function applyWallThicknessToNewRoom(
  walls: WallEntry[] | null | undefined,
  rooms: any[],
  roomId: string,
  cm: number | null,
  pitch: number,
  openCuts: number[][] = [],
  coordScale = 1,
): WallEntry[] {
  if (cm == null || cm < WALL_MIN_CM) return walls ? walls.slice() : [];
  const at = atomicPolyForRoom(rooms, roomId, openCuts, pitch, coordScale, walls);
  if (!at) return walls ? walls.slice() : [];
  // effective cm per interval — a neighbour's thickness counts even when it is
  // still stored under a pre-atomic whole-edge key
  const cms = cmsForPoly(walls, at, pitch, coordScale);
  let out = walls ? walls.slice() : [];
  for (let i = 0; i < at.poly.length; i++) {
    const a = at.poly[i], b = at.poly[(i + 1) % at.poly.length];
    if (edgeIsOpen(a, b, openCuts, pitch, coordScale)) continue;
    if (cms[i] > 0) continue;
    out = setWallThickness(out, a, b, cm, pitch, coordScale);
  }
  return out;
}

/** A flat-capped body for one already-scaled centreline segment. */
export function linearWallBody(segment: LinearWallSegment): number[][] | null {
  const { a, b, halfDepth } = segment;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2
      || ![a[0], a[1], b[0], b[1]].every(Number.isFinite)) return null;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-9) || !(halfDepth > 0) || !Number.isFinite(halfDepth)) return null;
  const nx = (-dy / len) * halfDepth, ny = (dx / len) * halfDepth;
  return [
    [a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny],
  ];
}

interface JunctionRay {
  u: [number, number];
  halfDepth: number;
}

function closePoint(a: number[], b: number[], epsilon: number): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= epsilon;
}

function pointOnSegmentInterior(
  point: number[], segment: LinearWallSegment, epsilon: number,
): boolean {
  const dx = segment.b[0] - segment.a[0], dy = segment.b[1] - segment.a[1];
  const len2 = dx * dx + dy * dy;
  if (!(len2 > epsilon * epsilon)) return false;
  const t = ((point[0] - segment.a[0]) * dx + (point[1] - segment.a[1]) * dy) / len2;
  if (!(t > 0 && t < 1)) return false;
  const q = [segment.a[0] + dx * t, segment.a[1] + dy * t];
  return Math.hypot(point[0] - q[0], point[1] - q[1]) <= epsilon;
}

function addJunctionRay(rays: JunctionRay[], dx: number, dy: number, halfDepth: number): void {
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-9) || !(halfDepth > 0)) return;
  const u: [number, number] = [dx / len, dy / len];
  const same = rays.find((ray) =>
    Math.abs(ray.u[0] * u[1] - ray.u[1] * u[0]) < 1e-9
      && ray.u[0] * u[0] + ray.u[1] * u[1] > 1 - 1e-9);
  if (same) same.halfDepth = Math.max(same.halfDepth, halfDepth);
  else rays.push({ u, halfDepth });
}

/**
 * Missing node volumes for flat-capped linear wall segments.
 *
 * Endpoints are the only nodes. An endpoint may also land in another segment's
 * interior (the non-persisted T produced by #137); that through segment then
 * contributes two incident rays. Each non-collinear ray pair receives the
 * same bounded mitre/bevel used by room contours. Unioning these patches with
 * the raw bodies removes the tooth without changing caps at degree-one nodes.
 */
/** #310: subtract one butt-end wedge from a simple body (largest ring wins). */
function clipBodyByWedge(body: number[][], wedge: number[][]): number[][] | null {
  try {
    const result: any = difference(
      closedRing(body) as any, closedRing(wedge) as any,
    );
    let best: number[][] | null = null;
    let bestArea = 0;
    for (const polygon of result || []) {
      const ring = (polygon?.[0] || []) as number[][];
      const area = Math.abs(signedArea(ring));
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

/**
 * Butt-end trim of a two-ray node (#310, owner decision). With the full pair
 * mitre restored, the rectangular butt end of the deeper wall can still poke
 * sideways past the outer face of its thinner partner right at the node — the
 * «tooth sticking out of the thin wall» of the owner report. For every
 * two-ray node with an accepted mitre this returns, per input segment, the
 * wedges to subtract: the part of that segment's body OUTSIDE the partner's
 * outer face and within 2·halfDepth of the node along the segment's axis.
 * The rule is symmetric; for the thinner wall the wedge is empty. This is the
 * SECOND addressed subtraction of the junction pipeline, next to the lateral
 * trim of #271 — both strictly local to their node.
 */
export function pairButtEndTrimWedges(
  input: LinearWallSegment[], epsilon = 1e-6,
): { segmentIndex: number; wedge: number[][] }[] {
  const segments = (input || []).map((segment, index) => ({ segment, index }))
    .filter(({ segment }) =>
      segment && Array.isArray(segment.a) && Array.isArray(segment.b)
        && segment.a.length >= 2 && segment.b.length >= 2
        && segment.a.every(Number.isFinite) && segment.b.every(Number.isFinite)
        && Number.isFinite(segment.halfDepth) && segment.halfDepth > 0
        && Math.hypot(segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]) > 1e-9);
  if (segments.length < 2) return [];
  const eps = Math.max(Number.isFinite(epsilon) ? epsilon : 0, 1e-9);
  const endpoints = segments.flatMap(({ segment }) => [segment.a, segment.b])
    .map((point) => [point[0], point[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const nodes: number[][] = [];
  for (const point of endpoints) {
    if (!nodes.some((node) => closePoint(node, point, eps))) nodes.push(point);
  }
  const out: { segmentIndex: number; wedge: number[][] }[] = [];
  for (const node of nodes) {
    // Endpoint rays only: an interior (T) hit makes the node degree-3+ and
    // the fans of the multi-wall machinery own it, not the pair mitre.
    const rays: { u: number[]; halfDepth: number; length: number; index: number }[] = [];
    let interior = false;
    for (const { segment, index } of segments) {
      const length = Math.hypot(segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]);
      if (closePoint(node, segment.a, eps)) {
        rays.push({ u: [(segment.b[0] - segment.a[0]) / length,
          (segment.b[1] - segment.a[1]) / length], halfDepth: segment.halfDepth, length, index });
      } else if (closePoint(node, segment.b, eps)) {
        rays.push({ u: [(segment.a[0] - segment.b[0]) / length,
          (segment.a[1] - segment.b[1]) / length], halfDepth: segment.halfDepth, length, index });
      } else if (pointOnSegmentInterior(node, segment, eps)) {
        interior = true;
      }
    }
    if (interior || rays.length !== 2) continue;
    const [a, b] = rays;
    const cross = a.u[0] * b.u[1] - a.u[1] * b.u[0];
    if (Math.abs(cross) < 1e-9) continue;
    const sign = cross < 0 ? 1 : -1;
    const nA = [-a.u[1], a.u[0]];
    const nB = [-b.u[1], b.u[0]];
    const pA = [node[0] + nA[0] * a.halfDepth * sign, node[1] + nA[1] * a.halfDepth * sign];
    const pB = [node[0] - nB[0] * b.halfDepth * sign, node[1] - nB[1] * b.halfDepth * sign];
    if (!lineIntersect(pA, a.u, pB, b.u)) continue; // no mitre — nothing pokes
    // For each wall: clip its near-node body rectangle by the OUTSIDE
    // half-plane of the partner's outer face (the face owning the apex side).
    const pairs: [typeof a, typeof b, number[], number[]][] = [
      [a, b, pB, [nB[0] * -sign, nB[1] * -sign]],
      [b, a, pA, [nA[0] * sign, nA[1] * sign]],
    ];
    for (const [self, , faceP, faceOut] of pairs) {
      const reach = Math.min(2 * self.halfDepth, self.length);
      const ex = [-self.u[1] * self.halfDepth, self.u[0] * self.halfDepth];
      const rect = [
        [node[0] + ex[0], node[1] + ex[1]],
        [node[0] + self.u[0] * reach + ex[0], node[1] + self.u[1] * reach + ex[1]],
        [node[0] + self.u[0] * reach - ex[0], node[1] + self.u[1] * reach - ex[1]],
        [node[0] - ex[0], node[1] - ex[1]],
      ];
      // Sutherland–Hodgman clip of the rectangle by dot(x - faceP, faceOut) >= 0.
      const side = (point: number[]): number =>
        (point[0] - faceP[0]) * faceOut[0] + (point[1] - faceP[1]) * faceOut[1];
      const clipped: number[][] = [];
      for (let i = 0; i < rect.length; i++) {
        const cur = rect[i], nxt = rect[(i + 1) % rect.length];
        const sc = side(cur), sn = side(nxt);
        if (sc >= -1e-12) clipped.push(cur);
        if ((sc > 1e-12 && sn < -1e-12) || (sc < -1e-12 && sn > 1e-12)) {
          const t = sc / (sc - sn);
          clipped.push([cur[0] + (nxt[0] - cur[0]) * t, cur[1] + (nxt[1] - cur[1]) * t]);
        }
      }
      if (clipped.length >= 3 && Math.abs(signedArea(clipped)) > eps * eps) {
        out.push({ segmentIndex: self.index, wedge: clipped });
      }
    }
  }
  return out;
}

export function linearWallJoinPatches(
  input: LinearWallSegment[], epsilon = 1e-6,
): number[][][] {
  const segments = (input || []).filter((segment) =>
    segment && Array.isArray(segment.a) && Array.isArray(segment.b)
      && segment.a.length >= 2 && segment.b.length >= 2
      && segment.a.every(Number.isFinite) && segment.b.every(Number.isFinite)
      && Number.isFinite(segment.halfDepth) && segment.halfDepth > 0
      && Math.hypot(segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]) > 1e-9);
  if (segments.length < 2) return [];
  const eps = Math.max(Number.isFinite(epsilon) ? epsilon : 0, 1e-9);
  const endpoints = segments.flatMap((segment) => [segment.a, segment.b])
    .map((point) => [point[0], point[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const nodes: number[][] = [];
  for (const point of endpoints) {
    if (!nodes.some((node) => closePoint(node, point, eps))) nodes.push(point);
  }

  const patches: number[][][] = [];
  // #309: a node of three or more canonical rays is closed with the sector
  // fans of the multi-wall junction machinery (visual mitre limit included)
  // instead of pair patches. A pair patch lives in the sector OPPOSITE its
  // pair and, at such a node, paints a step over the thinner strips that own
  // that sector (owner report: the 15/15/30/30 cross).
  const intervals: WallInterval[] = segments.map((segment, i) => ({
    roomId: '', a: [segment.a[0], segment.a[1]], b: [segment.b[0], segment.b[1]],
    key: `join-${i}`, kind: 'outer', cm: 0, open: false,
    half: segment.halfDepth,
  }));
  const multiWallNodes = buildMultiWallNodeMap(intervals, eps);
  for (const fan of junctionNodeGeometry(multiWallNodes).fans) patches.push(fan);
  const coveredByFans = (point: number[]): boolean =>
    !!multiWallNodeAt(multiWallNodes, point);
  for (const node of nodes) {
    if (coveredByFans(node)) continue;
    const rays: JunctionRay[] = [];
    for (const segment of segments) {
      if (closePoint(node, segment.a, eps)) {
        addJunctionRay(
          rays, segment.b[0] - segment.a[0], segment.b[1] - segment.a[1],
          segment.halfDepth,
        );
      } else if (closePoint(node, segment.b, eps)) {
        addJunctionRay(
          rays, segment.a[0] - segment.b[0], segment.a[1] - segment.b[1],
          segment.halfDepth,
        );
      } else if (pointOnSegmentInterior(node, segment, eps)) {
        addJunctionRay(
          rays, segment.a[0] - node[0], segment.a[1] - node[1], segment.halfDepth,
        );
        addJunctionRay(
          rays, segment.b[0] - node[0], segment.b[1] - node[1], segment.halfDepth,
        );
      }
    }
    if (rays.length < 2) continue;
    rays.sort((a, b) => Math.atan2(a.u[1], a.u[0]) - Math.atan2(b.u[1], b.u[0])
      || a.halfDepth - b.halfDepth);
    for (let i = 0; i < rays.length; i++) {
      for (let j = i + 1; j < rays.length; j++) {
        const a = rays[i], b = rays[j];
        const cross = a.u[0] * b.u[1] - a.u[1] * b.u[0];
        if (Math.abs(cross) < 1e-9) continue;
        const nA = [-a.u[1], a.u[0]];
        const nB = [-b.u[1], b.u[0]];
        const sign = cross < 0 ? 1 : -1;
        const pA = [
          node[0] + nA[0] * a.halfDepth * sign,
          node[1] + nA[1] * a.halfDepth * sign,
        ];
        const pB = [
          node[0] - nB[0] * b.halfDepth * sign,
          node[1] - nB[1] * b.halfDepth * sign,
        ];
        const hit = lineIntersect(pA, a.u, pB, b.u);
        // #310 (owner decision): a node of exactly two rays keeps the FULL
        // mitre — two walls meet in a point like on a drawing. The #309
        // chamfer applies only to the fans of >=3-ray nodes above.
        const patch = hit
          ? [node.slice(), pA, hit, pB]
          : [node.slice(), pA, pB];
        if (Math.abs(signedArea(patch)) > eps * eps) patches.push(patch);
      }
    }
  }
  return patches;
}

function unionSimpleBodies(bodies: number[][][]): any | null {
  let geom: any = null;
  try {
    for (const body of bodies) {
      if (body.length < 3) continue;
      const piece: any = closedRing(body);
      // Keep the same MultiPolygon shape for one body and for a union. Returning
      // the bare Polygon made `polyclipToPathD()` see points where it expects
      // rings, so every single-segment preview (including Thickness hover)
      // became an empty path.
      geom = geom ? union(geom, piece) : [piece];
    }
    return geom;
  } catch {
    return null;
  }
}

/**
 * SVG path for the thick-wall preview while drawing a room outline.
 * Closed contours use outset−inset; open polylines use the same bounded joins
 * as persisted independent walls. `segmentHalfDepths` preserves the thickness
 * already committed for each draft segment while the last rubber-band uses the
 * current session value.
 */
export function drawWallPreviewD(
  pts: number[][],
  halfDepth: number,
  closed: boolean,
  segmentHalfDepths?: number[],
): string {
  if (!(halfDepth > 0) || !pts || pts.length < 2) return '';
  if (closed && pts.length >= 3) {
    let poly = pts;
    const last = pts[pts.length - 1];
    if (pts.length >= 4
        && Math.hypot(pts[0][0] - last[0], pts[0][1] - last[1]) < 1e-9) {
      poly = pts.slice(0, -1);
    }
    if (poly.length >= 3) {
      const offs = poly.map((_, i) => segmentHalfDepths?.[i] || halfDepth);
      const outset = outsetContour(poly, offs);
      const inset = insetContour(poly, offs);
      if (outset && inset) {
        return `${polyToPath(outset)} ${polyToPath(reversePoly(inset))}`;
      }
    }
  }
  const segments: LinearWallSegment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const h = segmentHalfDepths?.[i] || halfDepth;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= 1e-9 && h > 0)
      segments.push({ a, b, halfDepth: h });
  }
  // Index-aligned with `segments`: the #310 wedge below addresses its owner
  // body by segment index, so the null filter happens only at the join.
  const bodies = segments.map(linearWallBody);
  // #310: the preview shares the butt-end trim with persisted masonry, so the
  // rubber-band silhouette matches what the click will save.
  for (const { segmentIndex, wedge } of pairButtEndTrimWedges(segments)) {
    const body = bodies[segmentIndex];
    if (!body) continue;
    const trimmed = clipBodyByWedge(body, wedge);
    if (trimmed) bodies[segmentIndex] = trimmed;
  }
  const joined = [
    ...bodies.filter((body): body is number[][] => !!body),
    ...linearWallJoinPatches(segments),
  ];
  const geom = unionSimpleBodies(joined);
  if (geom) return polyclipToPathD(geom);
  return joined.map((body) => polyToPath(body)).join(' ');
}

/**
 * Is this stretch virtual? Interval-exact (AUD-159B6-01): the midpoint must sit
 * ON the cut, not merely near the cut's own midpoint. Atomic intervals never
 * straddle a cut end (they are split there), so the test is unambiguous —
 * a partial open span no longer has to cover the parent edge's midpoint to
 * count, and no longer opens the parts it does not cover.
 */
function edgeIsOpen(a: number[], b: number[], cuts: number[][], pitch: number, coordScale = 1): boolean {
  if (!cuts.length) return false;
  const eps = openEps(pitch, coordScale);
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const [dx, dy] = wallDir(a, b);
  for (const c of cuts) {
    const [ex, ey] = wallDir([c[0], c[1]], [c[2], c[3]]);
    if (Math.abs(dx * ey - dy * ex) > 0.05) continue; // not collinear
    if (distToSeg(mx, my, c[0], c[1], c[2], c[3]) <= eps) return true;
  }
  return false;
}

/** Collinearity / on-segment tolerance for interval work (plan units). */
function openEps(pitch: number, coordScale: number): number {
  return Math.max(pitch * (coordScale > 0 ? coordScale : 1) * 0.04, 1e-9);
}

// ------------------------------- inset / rings ------------------------------

function signedArea(poly: number[][]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

/** Inward unit normal for edge i (into the polygon). */
export function inwardNormal(poly: number[][], i: number): [number, number] {
  const a = poly[i], b = poly[(i + 1) % poly.length];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  // left normal of edge direction; flip if it points outward
  let nx = -dy / L, ny = dx / L;
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const probe = [mid[0] + nx * 1e-3, mid[1] + ny * 1e-3];
  // winding-agnostic: a probe that leaves the poly means we had the outward normal
  if (!pointInPoly(probe, poly)) {
    nx = -nx; ny = -ny;
  }
  // if area is negative (CW), left normal already points inward for standard math —
  // pointInPoly check above handles both.
  void signedArea;
  return [nx, ny];
}

function pointInPoly(p: number[], poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > p[1]) !== (yj > p[1]) &&
        p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 0) + xi) inside = !inside;
  }
  return inside;
}

/** Same direction, no turn: the joint of two pieces of ONE straight wall. */
function collinearJoint(uA: number[], uB: number[]): boolean {
  const cross = uA[0] * uB[1] - uA[1] * uB[0];
  const dot = uA[0] * uB[0] + uA[1] * uB[1];
  return Math.abs(cross) < 1e-9 && dot > 0;
}

function lineIntersect(
  p: number[], r: number[],
  q: number[], s: number[],
): number[] | null {
  // p + t r = q + u s
  const rxs = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(rxs) < 1e-12) return null;
  const qp = [q[0] - p[0], q[1] - p[1]];
  const t = (qp[0] * s[1] - qp[1] * s[0]) / rxs;
  return [p[0] + t * r[0], p[1] + t * r[1]];
}

/**
 * Clear distance between the wall faces along edge `index` (#233).
 *
 * The resize labels used to measure centrelines while the area label already
 * measured the floor, so one bubble carried two conventions: "3.00 x 4.00" from
 * wall centres next to an area from inner faces, and neither number could be
 * checked with a tape measure.
 *
 * Indices of `insetContour` are deliberately NOT used: that function emits one
 * point per corner (mitre), two (bevel, collinear joint, zero-thickness joint)
 * or the original vertex, so inner and centre polygons do not share an index
 * space. The span is obtained by intersecting the inner offset LINES instead,
 * which is exact for any angle, diagonals included.
 *
 * `poly` is the room's own polygon and `offsets` carries one half-depth per its
 * edge — resolved from the atomic profile by the caller, because a whole-edge
 * `thicknessCmAt` lookup returns 0 on a split-thickness edge.
 */
export function innerEdgeSpan(poly: number[][], index: number, offsets: number[]): number {
  const n = poly?.length || 0;
  if (n < 3 || !Array.isArray(offsets) || offsets.length !== n) return 0;
  const i = ((Math.trunc(index) % n) + n) % n;
  const a = poly[i], b = poly[(i + 1) % n];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const centre = Math.hypot(dx, dy);
  if (!(centre > 0)) return 0;
  const own = Math.max(0, Number(offsets[i]) || 0);
  // The zero rule comes first (#233, spec review r1/H1): a passage or a side
  // open to the neighbouring room has no face to measure from, so its label is
  // the full centreline. `insetContour` treats the same joint as a flat cap
  // (#172) and shortens nothing either — otherwise length and area would
  // diverge again, merely at a different boundary.
  if (!(own > 0)) return centre;

  const u: [number, number] = [dx / centre, dy / centre];
  const selfNormal = inwardNormal(poly, i);
  const selfPoint = [a[0] + selfNormal[0] * own, a[1] + selfNormal[1] * own];
  // Distance from `a` measured along the edge; the inner line of a neighbour
  // that has no thickness does not cut this edge at all.
  const cutAt = (edge: number): number | null => {
    const o = Math.max(0, Number(offsets[edge]) || 0);
    if (!(o > 0)) return null;
    const p0 = poly[edge], p1 = poly[(edge + 1) % n];
    const ex = p1[0] - p0[0], ey = p1[1] - p0[1];
    const len = Math.hypot(ex, ey);
    if (!(len > 0)) return null;
    const nrm = inwardNormal(poly, edge);
    const hit = lineIntersect(
      selfPoint, u, [p0[0] + nrm[0] * o, p0[1] + nrm[1] * o], [ex / len, ey / len],
    );
    if (!hit) return null;
    return (hit[0] - a[0]) * u[0] + (hit[1] - a[1]) * u[1];
  };

  const start = cutAt((i - 1 + n) % n) ?? 0;
  const end = cutAt((i + 1) % n) ?? centre;
  const span = end - start;
  // Walls thicker than the room they enclose: report nothing left, never a
  // negative length.
  return span > 0 ? span : 0;
}

/**
 * One half-depth per edge of the room's OWN polygon (#233).
 *
 * The profile is atomic — its polygon is cut at shared boundaries — so an own
 * edge may cover several stretches. The stretch holding the edge midpoint is
 * the representative: the clear distance between the walls at the two ENDS of
 * the edge is what the label reports, and a differently thick stretch in the
 * middle does not change that distance.
 */
export function ownEdgeOffsets(
  rooms: any[],
  roomId: string,
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): number[] | null {
  const room = (rooms || []).find((r) => r?.id === roomId);
  const own = roomPoly(room);
  if (!own || own.length < 3) return null;
  const profile = roomWallProfile(
    rooms, roomId, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
  );
  if (!profile) return own.map(() => 0);
  const eps = openEps(pitch, coordScale) * 4;
  return own.map((a, i) => {
    const b = own[(i + 1) % own.length];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    for (let k = 0; k < profile.poly.length; k++) {
      const p0 = profile.poly[k], p1 = profile.poly[(k + 1) % profile.poly.length];
      // Уже существующая distToSeg принимает координаты, а не точки.
      if (distToSeg(mid[0], mid[1], p0[0], p0[1], p1[0], p1[1]) <= eps) {
        return Math.max(0, profile.offsets[k] || 0);
      }
    }
    return 0;
  });
}


/**
 * Inset a polygon by a per-edge inward distance (same units as poly).
 * Zero-offset edges stay on the original. Mitre joins; bevel when the mitre
 * would spike longer than MITRE_LIMIT × max(adjacent offsets).
 */
export function insetContour(
  poly: number[][],
  offsets: number[],
  multiWallNodes?: MultiWallNodeMap | null,
): number[][] | null {
  const n = poly?.length || 0;
  if (n < 3 || offsets.length !== n) return null;
  if (offsets.every((o) => !(o > 0))) return poly.map((p) => [p[0], p[1]]);

  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const iPrev = (i - 1 + n) % n;
    const a0 = poly[iPrev], a1 = poly[i];
    const b0 = poly[i], b1 = poly[(i + 1) % n];
    const oA = Math.max(0, offsets[iPrev]);
    const oB = Math.max(0, offsets[i]);

    const [nAx, nAy] = inwardNormal(poly, iPrev);
    const [nBx, nBy] = inwardNormal(poly, i);

    const dA = [a1[0] - a0[0], a1[1] - a0[1]];
    const dB = [b1[0] - b0[0], b1[1] - b0[1]];
    const LA = Math.hypot(dA[0], dA[1]) || 1;
    const LB = Math.hypot(dB[0], dB[1]) || 1;
    const uA = [dA[0] / LA, dA[1] / LA];
    const uB = [dB[0] / LB, dB[1] / LB];

    const pA = [a0[0] + nAx * oA, a0[1] + nAy * oA];
    const pB = [b0[0] + nBx * oB, b0[1] + nBy * oB];

    if (!(oA > 0) && !(oB > 0)) {
      out.push([poly[i][0], poly[i][1]]);
      continue;
    }

    // #172: a physical edge meeting a zero-depth divider owns a square cap,
    // not a mitre into the divider.  Keep both sides of that cap explicitly:
    // the offset point of the physical edge and the untouched vertex of the
    // zero edge.  Letting the generic mitre/bevel path handle a near-collinear
    // join drops the untouched vertex and stretches the cap along the complete
    // divider as a triangular wall body.
    if ((oA > 0) !== (oB > 0)) {
      const v = poly[i];
      const pa = oA > 0 ? [v[0] + nAx * oA, v[1] + nAy * oA] : [v[0], v[1]];
      const pb = oB > 0 ? [v[0] + nBx * oB, v[1] + nBy * oB] : [v[0], v[1]];
      out.push(pa);
      if (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > 1e-9) out.push(pb);
      continue;
    }

    // AUD-159B6-01: atomic intervals put COLLINEAR neighbours in one outline.
    // Two parallel offset lines never intersect, so the mitre branch below would
    // fall through to a bevel that skips the zero side and slants the wall face.
    // Equal offsets collapse to one point, different ones step across.
    if (collinearJoint(uA, uB)) {
      const v = poly[i];
      const pa = [v[0] + nAx * oA, v[1] + nAy * oA];
      const pb = [v[0] + nBx * oB, v[1] + nBy * oB];
      out.push(pa);
      if (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > 1e-9) out.push(pb);
      continue;
    }

    const hit = lineIntersect(pA, uA, pB, uB);
    const maxO = Math.max(oA, oB, 1e-9);
    const joinLimit = multiWallNodeAt(multiWallNodes, poly[i])?.limit
      ?? MITRE_LIMIT * maxO;
    if (hit) {
      const dist = Math.hypot(hit[0] - poly[i][0], hit[1] - poly[i][1]);
      if (Number.isFinite(dist) && dist <= joinLimit) {
        out.push(hit);
        continue;
      }
    }
    // bevel: two points, each edge's offset line stopped at the vertex offset
    if (oA > 0) out.push([poly[i][0] + nAx * oA, poly[i][1] + nAy * oA]);
    if (oB > 0) out.push([poly[i][0] + nBx * oB, poly[i][1] + nBy * oB]);
    if (!(oA > 0) && !(oB > 0)) out.push([poly[i][0], poly[i][1]]);
  }
  return out.length >= 3 ? out : null;
}

export type WallKind = 'shared' | 'outer';

export interface WallBodyPath {
  /** SVG path `d` for the wall ring (evenodd: outer + reverse inset). */
  d: string;
  key: string;
  kind: WallKind;
  cm: number;
  /** Screen-thickness hint in plan units (full wall depth). */
  depthUnits: number;
}

function polyToPath(poly: number[][], close = true): string {
  if (!poly.length) return '';
  let d = `M ${poly[0][0]} ${poly[0][1]}`;
  for (let i = 1; i < poly.length; i++) d += ` L ${poly[i][0]} ${poly[i][1]}`;
  if (close) d += ' Z';
  return d;
}

function reversePoly(poly: number[][]): number[][] {
  return poly.slice().reverse();
}

// --------------------------- atomic intervals -------------------------------
//
// docs/WALL-THICKNESS.md §2. A room edge is NOT the unit of a wall: a single
// polygon edge can be shared with a neighbour over part of its length, carry a
// virtual (open) stretch in the middle, and be an outer wall for the rest.
// Every geometry step below therefore works on ATOMIC INTERVALS — the pieces
// an edge is cut into by every shared-boundary end and every open-span end.
// Both the stored key and the rendered ring follow those pieces (AUD-159B6-01).

/** Room outline with every atomic breakpoint inserted as a vertex. */
export interface AtomicPoly {
  /** Subdivided outline (superset of the room polygon's vertices). */
  poly: number[][];
  /** For sub-edge i: index of the original polygon edge it belongs to. */
  parent: number[];
  /** The untouched room polygon. */
  orig: number[][];
}

export function atomicPolyForRoom(
  rooms: any[],
  roomId: string,
  openCuts: number[][],
  pitch: number,
  coordScale = 1,
  wallBreaks: WallEntry[] | null | undefined = [],
): AtomicPoly | null {
  const room = (rooms || []).find((r) => r?.id === roomId);
  const orig = roomPoly(room);
  if (!orig || orig.length < 3) return null;
  const eps = openEps(pitch, coordScale);
  const breaks: number[][] = [];
  for (const other of rooms || []) {
    if (!other || other.id === roomId) continue;
    const op = roomPoly(other);
    if (!op) continue;
    for (const sg of sharedBoundary(orig, op, eps)) {
      breaks.push([sg[0], sg[1]], [sg[2], sg[3]]);
    }
  }
  for (const c of openCuts || []) breaks.push([c[0], c[1]], [c[2], c[3]]);
  // A closed virtual span may have been the only geometric breakpoint between
  // two real intervals of different thickness. New wall entries retain their
  // exact endpoints so deleting that span cannot erase the thickness boundary.
  for (const w of wallBreaks || []) {
    const span = entrySpan(w, coordScale);
    if (span) breaks.push(span[0], span[1]);
  }
  const poly: number[][] = [];
  const parent: number[] = [];
  for (let i = 0; i < orig.length; i++) {
    const a = orig[i], b = orig[(i + 1) % orig.length];
    poly.push([a[0], a[1]]);
    parent.push(i);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < eps * 2 || !breaks.length) continue;
    const gap = Math.min(0.499, (eps * 2) / L);
    const ts: number[] = [];
    for (const p of breaks) {
      if (distToSeg(p[0], p[1], a[0], a[1], b[0], b[1]) > eps) continue;
      const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (L * L);
      if (t <= gap || t >= 1 - gap) continue;
      if (ts.some((u) => Math.abs(u - t) * L <= eps * 2)) continue;
      ts.push(t);
    }
    ts.sort((x, y) => x - y);
    for (const t of ts) {
      poly.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      parent.push(i);
    }
  }
  return { poly, parent, orig };
}

/** Shared-boundary stretches of one room against every other (plan units). */
function sharedSegsOf(rooms: any[], roomId: string, eps: number): number[][] {
  const room = (rooms || []).find((r) => r?.id === roomId);
  const poly = roomPoly(room);
  if (!poly) return [];
  const out: number[][] = [];
  for (const other of rooms || []) {
    if (!other || other.id === roomId) continue;
    const op = roomPoly(other);
    if (!op) continue;
    for (const sg of sharedBoundary(poly, op, eps)) out.push(sg);
  }
  return out;
}

function kindsForPoly(
  poly: number[][],
  shared: number[][],
  openCuts: number[][],
  pitch: number,
  coordScale: number,
): Array<WallKind | null> {
  const eps = openEps(pitch, coordScale);
  const out: Array<WallKind | null> = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (edgeIsOpen(a, b, openCuts, pitch, coordScale)) { out.push(null); continue; }
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const onShared = shared.some((sg) => distToSeg(mx, my, sg[0], sg[1], sg[2], sg[3]) <= eps);
    out.push(onShared ? 'shared' : 'outer');
  }
  return out;
}

/**
 * Classify each ATOMIC interval of a room: shared with a neighbour, or outer.
 * Open (virtual) stretches are reported as kind null (no thickness allowed).
 * Indices align with `atomicPolyForRoom(...).poly`.
 */
export function edgeKinds(
  rooms: any[],
  roomId: string,
  openCuts: number[][],
  pitch: number,
  coordScale = 1,
): Array<WallKind | null> {
  const at = atomicPolyForRoom(rooms, roomId, openCuts, pitch, coordScale);
  if (!at) return [];
  const shared = sharedSegsOf(rooms, roomId, openEps(pitch, coordScale));
  return kindsForPoly(at.poly, shared, openCuts, pitch, coordScale);
}

/**
 * Effective thickness (cm) per atomic interval.
 *
 * An interval first looks for its OWN key. What is left over is matched against
 * keys written before the split — a pre-atomic key describes the whole parent
 * edge, so its cm goes to the intervals of that edge nobody claimed. Without
 * that, an existing plan would silently lose thickness the moment a neighbour
 * or an open span cuts one of its walls in two.
 */
function cmsForPoly(
  walls: WallEntry[] | null | undefined,
  at: AtomicPoly,
  pitch: number,
  coordScale: number,
): number[] {
  const n = at.poly.length;
  const cms = new Array<number>(n).fill(0);
  if (!walls?.length) return cms;
  const claimed = new Set<string>();
  const orphans: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = at.poly[i], b = at.poly[(i + 1) % n];
    const hit = lookupWall(walls, a, b, pitch, coordScale);
    if (hit && hit.cm > 0) {
      cms[i] = clampWallCm(hit.cm);
      claimed.add(hit.key);
    } else {
      orphans.push(i);
    }
  }
  if (!orphans.length) return cms;
  const scale = coordScale > 0 ? coordScale : 1;
  const tol = Math.max(pitch * 0.5, 1e-9) * scale;
  const parsed = parseKeys(walls, scale).filter((e) => e.w.cm > 0);
  // An exact run materialised before Split may cover only part of the new
  // polygon parent edge. Resolve those lossless spans against each orphaned
  // atomic child first: [0..6] must cover new child [4..6], but never [6..10].
  for (let oi = orphans.length - 1; oi >= 0; oi--) {
    const i = orphans[oi];
    const a = at.poly[i], b = at.poly[(i + 1) % n];
    const ang = segAngle(a, b);
    let best: { cm: number; extra: number } | null = null;
    for (const e of parsed) {
      const span = entrySpan(e.w, scale);
      if (!span || !angleClose(segAngle(span[0], span[1]), ang)) continue;
      if (distToSeg(a[0], a[1], span[0][0], span[0][1], span[1][0], span[1][1]) > tol
          || distToSeg(b[0], b[1], span[0][0], span[0][1], span[1][0], span[1][1]) > tol) continue;
      const childLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const spanLen = Math.hypot(span[1][0] - span[0][0], span[1][1] - span[0][1]);
      const extra = Math.max(0, spanLen - childLen);
      if (!best || extra < best.extra) best = { cm: clampWallCm(e.w.cm), extra };
    }
    if (!best) continue;
    cms[i] = best.cm;
    orphans.splice(oi, 1);
  }
  const byParent = new Map<number, number[]>();
  for (const i of orphans) {
    const p = at.parent[i];
    const list = byParent.get(p);
    if (list) list.push(i);
    else byParent.set(p, [i]);
  }
  for (const [pi, idxs] of byParent) {
    const a = at.orig[pi], b = at.orig[(pi + 1) % at.orig.length];
    const ang = segAngle(a, b);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let best: { cm: number; d: number; exact: boolean } | null = null;
    const parentLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const e of parsed) {
      if (claimed.has(e.w.key)) continue;
      if (!angleClose(e.ang, ang)) continue;
      const span = entrySpan(e.w, scale);
      let exact = false;
      let d = 0;
      if (span) {
        // Normalisation may compact one equal-thickness run through several
        // collinear room sides. Its midpoint can then lie outside a shorter
        // child side, but the lossless endpoints still prove that the run
        // covers that side. Require BOTH endpoints so a partial wall cannot
        // leak into the rest of its parent edge (AUD-159B6-01).
        if (!angleClose(segAngle(span[0], span[1]), ang)) continue;
        if (distToSeg(a[0], a[1], span[0][0], span[0][1], span[1][0], span[1][1]) > tol
          || distToSeg(b[0], b[1], span[0][0], span[0][1], span[1][0], span[1][1]) > tol) continue;
        exact = true;
        d = Math.max(0, Math.hypot(span[1][0] - span[0][0], span[1][1] - span[0][1]) - parentLen);
      } else {
        if (distToSeg(e.x, e.y, a[0], a[1], b[0], b[1]) > tol) continue;
        d = Math.hypot(e.x - mx, e.y - my);
      }
      if (!best || (exact && !best.exact) || (exact === best.exact && d < best.d)) {
        best = { cm: clampWallCm(e.w.cm), d, exact };
      }
    }
    if (!best) continue;
    for (const i of idxs) cms[i] = best.cm;
  }
  return cms;
}

/** One atomic wall stretch of one room, with everything a caller may need. */
export interface WallInterval {
  roomId: string;
  a: number[];
  b: number[];
  key: string;
  kind: WallKind | null;
  cm: number;
  open: boolean;
  /** Half depth in plan units (0 when there is no thickness). */
  half: number;
}

/** Per-room atomic geometry: subdivided outline + kinds + cms + half offsets. */
export interface RoomWallProfile extends AtomicPoly {
  kinds: Array<WallKind | null>;
  cms: number[];
  offsets: number[];
}

interface PendingMultiWallNode {
  point: [number, number];
  rays: Array<{
    u: [number, number]; halfDepth: number; length: number; angle: number;
  }>;
}

interface MultiWallEndpoint {
  point: [number, number];
  other: number[];
  halfDepth: number;
  kind: WallKind;
  key: string;
}

function spatialBucket(point: number[], epsilon: number): [number, number] {
  return [Math.floor(point[0] / epsilon), Math.floor(point[1] / epsilon)];
}

function spatialBucketKey(x: number, y: number): string {
  return `${x},${y}`;
}

function nearbyBuckets<T>(
  index: Map<string, T[]>,
  point: number[],
  epsilon: number,
): T[] {
  const [bx, by] = spatialBucket(point, epsilon);
  const out: T[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const values = index.get(spatialBucketKey(bx + dx, by + dy));
      if (values) out.push(...values);
    }
  }
  return out;
}

/**
 * Canonical degree-3+ physical endpoint map (#249).
 *
 * Shared intervals may occur once per owning room. They collapse first by
 * interval key and again by co-directional ray, while opposite directions
 * remain distinct. Sorting makes the representative and ray order independent
 * of room/wall input order and winding.
 */
export function buildMultiWallNodeMap(
  input: WallInterval[],
  epsilon = 1e-6,
  coordinateScale = 1,
): MultiWallNodeMap {
  const eps = Math.max(Number.isFinite(epsilon) ? epsilon : 0, 1e-9);
  const scale = Number.isFinite(coordinateScale) && coordinateScale > 0
    ? coordinateScale : 1;
  const valid = (input || [])
    .filter((iv) => iv && !iv.open && iv.kind !== null && Number.isFinite(iv.half) && iv.half > 0
      && Array.isArray(iv.a) && Array.isArray(iv.b)
      && iv.a.length >= 2 && iv.b.length >= 2
      && [iv.a[0], iv.a[1], iv.b[0], iv.b[1]].every(Number.isFinite)
      && Math.hypot(iv.b[0] - iv.a[0], iv.b[1] - iv.a[1]) > eps)
    .sort((a, b) => a.key.localeCompare(b.key)
      || a.a[0] - b.a[0] || a.a[1] - b.a[1]
      || a.b[0] - b.b[0] || a.b[1] - b.b[1]
      || a.half - b.half);
  const byPhysicalKey = new Map<string, WallInterval>();
  for (const interval of valid) {
    const previous = byPhysicalKey.get(interval.key);
    if (!previous) {
      byPhysicalKey.set(interval.key, interval);
    } else if (interval.half > previous.half) {
      // A shared physical interval may be emitted by both room owners. Keep
      // one deterministic axis and the largest effective physical half-depth.
      byPhysicalKey.set(interval.key, { ...previous, half: interval.half });
    }
  }
  const intervals = [...byPhysicalKey.values()];

  const endpoints: MultiWallEndpoint[] = intervals.flatMap((iv) => [
    {
      point: [iv.a[0], iv.a[1]] as [number, number], other: iv.b, halfDepth: iv.half,
      kind: iv.kind as WallKind, key: iv.key,
    },
    {
      point: [iv.b[0], iv.b[1]] as [number, number], other: iv.a, halfDepth: iv.half,
      kind: iv.kind as WallKind, key: iv.key,
    },
  ]).sort((a, b) => a.point[0] - b.point[0] || a.point[1] - b.point[1]
    || a.other[0] - b.other[0] || a.other[1] - b.other[1]
    || a.halfDepth - b.halfDepth);
  const endpointIndex = new Map<string, MultiWallEndpoint[]>();
  for (const endpoint of endpoints) {
    const [bx, by] = spatialBucket(endpoint.point, eps);
    const key = spatialBucketKey(bx, by);
    const bucket = endpointIndex.get(key) || [];
    bucket.push(endpoint);
    endpointIndex.set(key, bucket);
  }

  const pending: PendingMultiWallNode[] = [];
  const pendingIndex = new Map<string, PendingMultiWallNode[]>();
  for (const endpoint of endpoints) {
    const candidates = nearbyBuckets(pendingIndex, endpoint.point, eps)
      .filter((node) => Math.hypot(
        node.point[0] - endpoint.point[0], node.point[1] - endpoint.point[1],
      ) <= eps)
      .sort((a, b) => Math.hypot(
        a.point[0] - endpoint.point[0], a.point[1] - endpoint.point[1],
      ) - Math.hypot(
        b.point[0] - endpoint.point[0], b.point[1] - endpoint.point[1],
      ) || a.point[0] - b.point[0] || a.point[1] - b.point[1]);
    let node = candidates[0];
    if (!node) {
      node = { point: [...endpoint.point], rays: [] };
      pending.push(node);
      const [bx, by] = spatialBucket(node.point, eps);
      const key = spatialBucketKey(bx, by);
      const bucket = pendingIndex.get(key) || [];
      bucket.push(node);
      pendingIndex.set(key, bucket);
    }
    const dx = endpoint.other[0] - endpoint.point[0];
    const dy = endpoint.other[1] - endpoint.point[1];
    const length = Math.hypot(dx, dy);
    if (!(length > eps)) continue;
    const u: [number, number] = [dx / length, dy / length];
    let angle = Math.atan2(u[1], u[0]);
    if (angle < 0) angle += Math.PI * 2;
    node.rays.push({ u, halfDepth: endpoint.halfDepth, length, angle });
  }

  const nodes: MultiWallNode[] = [];
  const angleEps = 1e-9;
  const canonicalSupports = (
    input: MultiWallNodeRaySupport[],
  ): MultiWallNodeRaySupport[] => {
    // Endpoint clustering uses a deliberately visible plan-space tolerance;
    // dominance between already matched physical strips must not. Otherwise a
    // long thin strip can erase a shorter thick strip merely because their
    // half-depth difference is below the node lookup epsilon.
    const supportEps = 1e-9 * Math.max(1, scale);
    const validSupports = input.filter((support) => Number.isFinite(support.halfDepth)
      && support.halfDepth > 0 && Number.isFinite(support.length) && support.length > eps);
    return validSupports
      .filter((support, index) => !validSupports.some((other, otherIndex) => (
        otherIndex !== index
        && other.halfDepth >= support.halfDepth - supportEps
        && other.length >= support.length - supportEps
        && (other.halfDepth > support.halfDepth + supportEps
          || other.length > support.length + supportEps
          || otherIndex < index)
      )))
      .sort((a, b) => a.length - b.length || a.halfDepth - b.halfDepth)
      .map((support) => ({ ...support }));
  };
  for (const node of pending) {
    const sorted = node.rays.sort((a, b) => a.angle - b.angle
      || a.length - b.length || a.halfDepth - b.halfDepth);
    const rays: Array<{
      u: [number, number]; angle: number; supports: MultiWallNodeRaySupport[];
    }> = [];
    for (const ray of sorted) {
      const previous = rays[rays.length - 1];
      if (previous && Math.abs(ray.angle - previous.angle) <= angleEps) {
        previous.supports.push({ halfDepth: ray.halfDepth, length: ray.length });
      } else {
        rays.push({
          u: [...ray.u], angle: ray.angle,
          supports: [{ halfDepth: ray.halfDepth, length: ray.length }],
        });
      }
    }
    if (rays.length > 1
        && Math.PI * 2 - rays[rays.length - 1].angle + rays[0].angle <= angleEps) {
      const last = rays.pop()!;
      rays[0].supports.push(...last.supports);
    }
    if (rays.length < 3) continue;
    const canonicalRays = rays.map((ray) => {
      const supports = canonicalSupports(ray.supports);
      const continuationKeys = new Set<string>();
      const continuations: MultiWallNodeRayContinuation[] = [];
      for (const support of supports) {
        const end = [
          node.point[0] + ray.u[0] * support.length,
          node.point[1] + ray.u[1] * support.length,
        ];
        for (const candidate of nearbyBuckets(endpointIndex, end, eps)) {
          if (candidate.kind !== 'shared'
              || Math.hypot(candidate.point[0] - end[0], candidate.point[1] - end[1]) > eps)
            continue;
          const dx = candidate.other[0] - candidate.point[0];
          const dy = candidate.other[1] - candidate.point[1];
          const length = Math.hypot(dx, dy);
          if (!(length > eps)) continue;
          const ux = dx / length, uy = dy / length;
          // The interval that supplied this support also has an endpoint here,
          // directed back to the node. It is already rebuilt by `supports`;
          // only a different finite shared strip attached at the far endpoint
          // needs protection (it may continue straight or turn a corner).
          if (Math.hypot(
            candidate.other[0] - node.point[0], candidate.other[1] - node.point[1],
          ) <= eps) continue;
          const key = `${candidate.key}|${candidate.point[0]}|${candidate.point[1]}`
            + `|${candidate.other[0]}|${candidate.other[1]}|${candidate.halfDepth}`;
          if (continuationKeys.has(key)) continue;
          continuationKeys.add(key);
          continuations.push({
            start: [candidate.point[0], candidate.point[1]],
            u: [ux, uy],
            length,
            halfDepth: candidate.halfDepth,
          });
        }
      }
      continuations.sort((a, b) => a.start[0] - b.start[0]
        || a.start[1] - b.start[1] || a.u[0] - b.u[0] || a.u[1] - b.u[1]
        || a.length - b.length || a.halfDepth - b.halfDepth);
      return {
        u: [...ray.u] as [number, number],
        halfDepth: Math.max(...supports.map((support) => support.halfDepth)),
        length: Math.max(...supports.map((support) => support.length)),
        supports,
        continuations,
      };
    }).filter((ray) => Number.isFinite(ray.halfDepth) && ray.halfDepth > 0
      && Number.isFinite(ray.length) && ray.length > eps);
    if (canonicalRays.length < 3) continue;
    const halfDepth = Math.max(...canonicalRays.map((ray) => ray.halfDepth));
    if (!(halfDepth > 0) || !Number.isFinite(halfDepth)) continue;
    nodes.push({
      point: [...node.point],
      rays: canonicalRays,
      halfDepth,
      limit: MULTI_WALL_JOIN_LIMIT * halfDepth,
    });
  }
  nodes.sort((a, b) => a.point[0] - b.point[0] || a.point[1] - b.point[1]);
  const index = new Map<string, MultiWallNode[]>();
  for (const node of nodes) {
    const [bx, by] = spatialBucket(node.point, eps);
    const key = spatialBucketKey(bx, by);
    const bucket = index.get(key) || [];
    bucket.push(node);
    index.set(key, bucket);
  }
  return { epsilon: eps, coordinateScale: scale, nodes, index };
}

/**
 * Corner geometry of one node (#302 + the #249 chamfer, owner 2026-08-25).
 *
 * One angular walk produces both halves of the corner rule:
 *  - a FAN per pair of adjacent rays — additive sector material from the node
 *    out to the mitre point, or to the bevel chord when the mitre runs past
 *    the node's approved join limit;
 *  - a CUT per over-limit pair — the wedge beyond that same chord, which is
 *    how the approved #249 chamfer looks.
 * Fan and cut of one pair meet exactly at the chord and never overlap, and the
 * cut lies strictly between the two strip edges: subtracting it can touch
 * neither strip's interior. That bound is what the old bevel layer kept
 * failing to hold — its cuts reached past the limit with a separate
 * "protection" pass patching the damage after the fact.
 */
export interface JunctionNodeGeometry {
  fans: number[][][];
  /** Exact support quads of every ray — the strips the node actually owns. */
  supports: number[][][];
}

export function junctionNodeGeometry(
  map: MultiWallNodeMap | null | undefined,
): JunctionNodeGeometry {
  const out: JunctionNodeGeometry = { fans: [], supports: [] };
  if (!map?.nodes?.length) return out;
  const areaEps = Math.max(map.epsilon, 1e-9) ** 2;
  for (const node of map.nodes) {
    const rays = node.rays
      .filter((ray) => Number.isFinite(ray.halfDepth) && ray.halfDepth > 0)
      .map((ray) => ({
        ...ray,
        // The fan follows the strip that actually exists at the node: the
        // ray's max half-depth is only valid as far as the support that owns
        // it. Walking past a short thick support would paint a phantom beside
        // a thinner continuation (#271).
        thickLength: Math.max(...ray.supports
          .filter((support) => support.halfDepth >= ray.halfDepth - 1e-12)
          .map((support) => support.length), 0),
        angle: (() => {
          const a = Math.atan2(ray.u[1], ray.u[0]);
          return a < 0 ? a + Math.PI * 2 : a;
        })(),
      }))
      .sort((a, b) => a.angle - b.angle);
    if (rays.length < 2) continue;
    const P = node.point;
    // The support quads are the ground truth the chamfer must never eat:
    // each is bounded by its own finite length, so re-adding them can never
    // repaint a lateral phantom beyond a short support (#271).
    for (const ray of rays) {
      for (const support of ray.supports) {
        if (!(support.halfDepth > 0) || !(support.length > 0)) continue;
        const ex = -ray.u[1] * support.halfDepth;
        const ey = ray.u[0] * support.halfDepth;
        const far = [
          P[0] + ray.u[0] * support.length,
          P[1] + ray.u[1] * support.length,
        ];
        out.supports.push([
          [P[0] + ex, P[1] + ey],
          [far[0] + ex, far[1] + ey],
          [far[0] - ex, far[1] - ey],
          [P[0] - ex, P[1] - ey],
        ]);
      }
    }
    for (let i = 0; i < rays.length; i++) {
      const A = rays[i];
      const B = rays[(i + 1) % rays.length];
      const sector = (() => {
        const raw = B.angle - A.angle;
        return raw > 0 ? raw : raw + Math.PI * 2;
      })();
      if (sector < 1e-9) continue;
      const reflex = sector > Math.PI + 1e-9;
      const limit = MITRE_LIMIT * Math.max(A.halfDepth, B.halfDepth);
      // Facing strip edges: A's at angle+90°, B's at angle−90°.
      const EA = [P[0] - A.u[1] * A.halfDepth, P[1] + A.u[0] * A.halfDepth];
      const EB = [P[0] + B.u[1] * B.halfDepth, P[1] - B.u[0] * B.halfDepth];
      const cross = A.u[0] * B.u[1] - A.u[1] * B.u[0];
      const inSector = (point: number[]): boolean => {
        let angle = Math.atan2(point[1] - P[1], point[0] - P[0]) - A.angle;
        while (angle < 0) angle += Math.PI * 2;
        return angle <= sector + 1e-9;
      };
      let mitre: number[] | null = null;
      if (Math.abs(cross) > 1e-9) {
        const tA = ((EB[0] - EA[0]) * B.u[1] - (EB[1] - EA[1]) * B.u[0]) / cross;
        const tB = ((EB[0] - EA[0]) * A.u[1] - (EB[1] - EA[1]) * A.u[0]) / cross;
        const candidate = [EA[0] + A.u[0] * tA, EA[1] + A.u[1] * tA];
        // The mitre is only a corner when it actually sits IN the sector —
        // forward along the rays for an ordinary pair, backward for a reflex
        // outer corner — inside the classic bound, and never past a thick
        // support (#271: overshooting one paints a lateral phantom).
        const directionOk = reflex
          ? tA <= 1e-9 && tB <= 1e-9
          : tA > 1e-9 && tA <= A.thickLength && tB <= B.thickLength;
        if (directionOk
            && Math.hypot(candidate[0] - P[0], candidate[1] - P[1]) <= limit
            && inSector(candidate)) {
          mitre = candidate;
        }
      }
      const push = (poly: number[][]) => {
        if (Math.abs(signedArea(poly)) > areaEps) out.fans.push(poly);
      };
      if (mitre) {
        // #309: the accepted apex may still be visually too long (the classic
        // bound admits 4·h). Past the visual limit the fan is closed with a
        // flat chamfer perpendicular to the apex direction.
        const visual = VISUAL_MITRE_LIMIT * Math.max(A.halfDepth, B.halfDepth);
        push(chamferApex([P[0], P[1]], EA, mitre, EB, visual)
          ?? [[P[0], P[1]], EA, mitre, EB]);
        continue;
      }
      if (reflex) {
        // A degenerate reflex mitre (parallel or out-of-bound edges) closes
        // with the plain chord between the two strip edges.
        push([[P[0], P[1]], EA, EB]);
        continue;
      }
      // Bevel: walk each offset line a LOCAL distance — bounded by the thick
      // support, by the classic limit and by twice the pair's depth, so the
      // chord stays a corner detail and cannot fold across the plan.
      const reach = (half: number, length: number) => Math.min(
        length,
        Math.sqrt(Math.max(limit ** 2 - half ** 2, 0)),
        2 * Math.max(A.halfDepth, B.halfDepth),
      );
      const A2 = [
        EA[0] + A.u[0] * reach(A.halfDepth, A.thickLength),
        EA[1] + A.u[1] * reach(A.halfDepth, A.thickLength),
      ];
      const B2 = [
        EB[0] + B.u[0] * reach(B.halfDepth, B.thickLength),
        EB[1] + B.u[1] * reach(B.halfDepth, B.thickLength),
      ];
      push([[P[0], P[1]], EA, A2, B2, EB]);
    }
  }
  return out;
}

/** The fans alone — kept for callers that only ever add material. */
export function junctionNodeFans(
  map: MultiWallNodeMap | null | undefined,
): number[][][] {
  return junctionNodeGeometry(map).fans;
}

/**
 * The objective no-holes invariant of #302 (spec §8.4).
 *
 * A probe is a HOLE when the contract says the point is masonry — inside one
 * of the node's support strips or sector fans, and inside the approved facade
 * bound — yet the produced geometry does not cover it. Legitimate floor of an
 * acute room corner never trips this (it is outside both strips and fans),
 * which is what the first "surrounded by masonry" formulation got wrong.
 */
export function junctionContractHoles(
  geometry: any,
  map: MultiWallNodeMap | null | undefined,
  options: { step: number; bound?: any },
): { node: [number, number]; holes: number[][] }[] {
  if (!map?.nodes?.length || !(options.step > 0)) return [];
  const corners = junctionNodeGeometry(map);
  const inPolygon = (points: number[][], x: number, y: number): boolean => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  };
  const inGeometry = (geom: any, x: number, y: number): boolean => {
    let inside = false;
    for (const polygon of geom || []) for (const ring of polygon || []) {
      if (inPolygon(ring, x, y)) inside = !inside;
    }
    return inside;
  };
  const reports: { node: [number, number]; holes: number[][] }[] = [];
  for (const node of map.nodes) {
    const radius = MITRE_LIMIT * node.halfDepth + node.halfDepth;
    const holes: number[][] = [];
    for (let dx = -radius; dx <= radius; dx += options.step) {
      for (let dy = -radius; dy <= radius; dy += options.step) {
        const x = node.point[0] + dx;
        const y = node.point[1] + dy;
        const inStrip = node.rays.some((ray) => ray.supports.some((support) => {
          const rx = x - node.point[0];
          const ry = y - node.point[1];
          const along = rx * ray.u[0] + ry * ray.u[1];
          if (along < 0 || along > support.length) return false;
          return Math.abs(rx * ray.u[1] - ry * ray.u[0])
            <= support.halfDepth - options.step * 0.25;
        }));
        const inFan = !inStrip && corners.fans.some((fan) => inPolygon(fan, x, y));
        if (!inStrip && !inFan) continue;
        if (options.bound && !inGeometry(options.bound, x, y)) continue;
        if (!inGeometry(geometry, x, y)) holes.push([x, y]);
      }
    }
    if (holes.length) reports.push({ node: [...node.point], holes });
  }
  return reports;
}

/** Find the canonical degree-3+ node matching a contour vertex. */
export function multiWallNodeAt(
  map: MultiWallNodeMap | null | undefined,
  point: number[],
): MultiWallNode | null {
  if (!map || !Array.isArray(point) || point.length < 2
      || !point.slice(0, 2).every(Number.isFinite)) return null;
  return nearbyBuckets(map.index, point, map.epsilon)
    .filter((node) => Math.hypot(node.point[0] - point[0], node.point[1] - point[1]) <= map.epsilon)
    .sort((a, b) => Math.hypot(a.point[0] - point[0], a.point[1] - point[1])
      - Math.hypot(b.point[0] - point[0], b.point[1] - point[1])
      || a.point[0] - b.point[0] || a.point[1] - b.point[1])[0] || null;
}

export function multiWallNodesForGeometry(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale: number,
): MultiWallNodeMap {
  return buildMultiWallNodeMap(
    wallIntervals(rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale),
    openEps(pitch, coordScale) * 4,
    coordScale,
  );
}

export function roomWallProfile(
  rooms: any[],
  roomId: string,
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): RoomWallProfile | null {
  const at = atomicPolyForRoom(rooms, roomId, openCuts, pitch, coordScale, walls);
  if (!at) return null;
  const shared = sharedSegsOf(rooms, roomId, openEps(pitch, coordScale));
  const kinds = kindsForPoly(at.poly, shared, openCuts, pitch, coordScale);
  const cms = cmsForPoly(walls, at, pitch, coordScale);
  const offsets = cms.map((cm, i) => (
    kinds[i] && cm > 0 ? wallCmToUnits(cm, cellCm, gridPitch) / 2 : 0
  ));
  return { ...at, kinds, cms, offsets };
}

/** Every atomic wall stretch of every room (render/plan units). */
export function wallIntervals(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): WallInterval[] {
  const out: WallInterval[] = [];
  for (const room of rooms || []) {
    if (!room?.id) continue;
    const pr = roomWallProfile(rooms, room.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
    if (!pr) continue;
    for (let i = 0; i < pr.poly.length; i++) {
      const a = pr.poly[i], b = pr.poly[(i + 1) % pr.poly.length];
      out.push({
        roomId: room.id,
        a: [a[0], a[1]],
        b: [b[0], b[1]],
        key: keyOf(a, b, pitch, coordScale),
        kind: pr.kinds[i],
        cm: pr.kinds[i] ? pr.cms[i] : 0,
        open: pr.kinds[i] === null,
        half: pr.offsets[i],
      });
    }
  }
  return out;
}

/**
 * Upgrade the effective current profile to lossless interval endpoints before
 * a room-outline mutation. Legacy entries contain only midpoint + direction,
 * which is enough while the original edge still exists but cannot tell two
 * child edges apart after Split. Materialising first preserves the resolved
 * value without broadening the legacy midpoint fallback to unrelated walls.
 */
export function materializeWallIntervals(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): WallEntry[] {
  // Rebuild from the effective profile instead of retaining midpoint-only
  // legacy rows beside their lossless replacements. Keeping both lets the
  // tolerant lookup match a stale collinear stretch between these two calls.
  let out: WallEntry[] = [];
  const resolved = wallIntervals(
    rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
  );
  for (const iv of resolved) {
    if (iv.open || !(iv.cm > 0)) continue;
    out = setWallThickness(out, iv.a, iv.b, iv.cm, pitch, coordScale);
  }
  return out;
}

/**
 * Rewrite `walls` so every entry names a maximal equal-thickness interval of
 * the CURRENT geometry, and no entry survives under an open span. Atomic
 * entries compact across every consecutive solid run; a thickness change or
 * virtual gap remains an exact stored breakpoint.
 *
 * This is the single place where the spec invariant "an open span and a
 * positive thickness never share a key" is enforced: opening a stretch splits
 * the parent key and drops the piece under the span, closing it merges the
 * pieces back and inherits the cm of whatever stayed solid.
 */
export function normalizeWallIntervals(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): WallEntry[] {
  if (!walls?.length) return [];
  type OwnedInterval = WallInterval & { ownerSignature: string };
  const resolved = wallIntervals(
    rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
  );
  const ownersByKey = new Map<string, Set<string>>();
  for (const interval of resolved) {
    if (interval.open || !interval.kind || !interval.roomId) continue;
    const owners = ownersByKey.get(interval.key) || new Set<string>();
    owners.add(interval.roomId);
    ownersByKey.set(interval.key, owners);
  }
  const ownerSignatureFor = (key: string): string => {
    const owners = [...(ownersByKey.get(key) || [])].sort();
    // A physical wall has one outer owner or two shared owners. Invalid
    // multi-owner geometry is preserved fail-closed, one atom at a time: it
    // must not become the bridge which compacts two otherwise separate roles.
    if (owners.length !== 1 && owners.length !== 2) return `ambiguous:${key}`;
    return `${owners.length === 1 ? 'outer' : 'shared'}:${owners.join('|')}`;
  };
  const atomic: OwnedInterval[] = [];
  const atomicKeys = new Set<string>();
  for (const iv of resolved) {
    if (iv.open || !(iv.cm > 0) || atomicKeys.has(iv.key)) continue;
    atomicKeys.add(iv.key);
    atomic.push({ ...iv, ownerSignature: ownerSignatureFor(iv.key) });
  }

  // Compact every maximal solid run of one thickness AND one physical owner
  // role. Equal centimetres cannot bridge shared(A,B) to outer(A), nor one
  // shared pair to another: that creates a record whose thickness changes
  // meaning halfway through its own span (#299).
  const parents: Array<{
    a: number[]; b: number[]; key: string; cm: number; len: number;
    ownerSignature: string;
  }> = [];
  for (const room of rooms || []) {
    if (!room?.id) continue;
    const pr = roomWallProfile(rooms, room.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
    if (!pr) continue;
    for (let pi = 0; pi < pr.orig.length; pi++) {
      const children: number[] = [];
      for (let i = 0; i < pr.parent.length; i++) {
        if (pr.parent[i] === pi) children.push(i);
      }
      if (!children.length) continue;
      for (let at = 0; at < children.length;) {
        const first = children[at];
        const cm = pr.cms[first];
        if (!(cm > 0) || pr.kinds[first] === null) { at++; continue; }
        const firstKey = keyOf(pr.poly[first], pr.poly[(first + 1) % pr.poly.length], pitch, coordScale);
        const ownerSignature = ownerSignatureFor(firstKey);
        let end = at;
        while (end + 1 < children.length) {
          const next = children[end + 1];
          const nextKey = keyOf(
            pr.poly[next], pr.poly[(next + 1) % pr.poly.length], pitch, coordScale,
          );
          if (pr.kinds[next] === null || pr.cms[next] !== cm
              || ownerSignatureFor(nextKey) !== ownerSignature) break;
          end++;
        }
        const last = children[end];
        const a = pr.poly[first], b = pr.poly[(last + 1) % pr.poly.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > 0) parents.push({
          a: [a[0], a[1]], b: [b[0], b[1]],
          key: keyOf(a, b, pitch, coordScale), cm, len, ownerSignature,
        });
        at = end + 1;
      }
    }
  }
  parents.sort((a, b) => b.len - a.len || a.key.localeCompare(b.key));

  const out: WallEntry[] = [];
  const seen = new Set<string>();
  const covered = new Set<string>();
  const tol = openEps(pitch, coordScale) * 4;
  for (const parent of parents) {
    const matches = atomic.filter((iv) => (
      !covered.has(iv.key) && iv.cm === parent.cm &&
      iv.ownerSignature === parent.ownerSignature &&
      angleClose(segAngle(iv.a, iv.b), segAngle(parent.a, parent.b)) &&
      distToSeg(iv.a[0], iv.a[1], parent.a[0], parent.a[1], parent.b[0], parent.b[1]) <= tol &&
      distToSeg(iv.b[0], iv.b[1], parent.a[0], parent.a[1], parent.b[0], parent.b[1]) <= tol
    ));
    if (!matches.length) continue;
    for (const iv of matches) covered.add(iv.key);
    if (seen.has(parent.key)) continue;
    seen.add(parent.key);
    out.push(wallEntry(parent.a, parent.b, parent.cm, pitch, coordScale));
  }
  for (const iv of atomic) {
    if (covered.has(iv.key) || seen.has(iv.key)) continue;
    seen.add(iv.key);
    out.push(wallEntry(iv.a, iv.b, iv.cm, pitch, coordScale));
  }
  return out;
}

/** Effective thickness of the atomic interval that covers a segment's middle. */
export function intervalCmAt(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  seg: number[],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): number {
  const eps = openEps(pitch, coordScale);
  const mx = (seg[0] + seg[2]) / 2, my = (seg[1] + seg[3]) / 2;
  const ang = segAngle([seg[0], seg[1]], [seg[2], seg[3]]);
  let best: { cm: number; d: number } | null = null;
  for (const iv of wallIntervals(rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale)) {
    if (!angleClose(segAngle(iv.a, iv.b), ang)) continue;
    const d = distToSeg(mx, my, iv.a[0], iv.a[1], iv.b[0], iv.b[1]);
    if (d > eps * 4) continue;
    if (!best || d < best.d) best = { cm: iv.cm, d };
  }
  return best?.cm || 0;
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax, aby = by - ay;
  const L2 = abx * abx + aby * aby;
  if (L2 < 1e-18) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

/**
 * Per-room half-depth offsets (plan units) for inset/outset: every thick edge
 * (shared or outer) → half; open/none → 0. docs/WALL-THICKNESS.md §2.
 */
export function insetOffsetsForRoom(
  rooms: any[],
  roomId: string,
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): number[] {
  const pr = roomWallProfile(rooms, roomId, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
  return pr ? pr.offsets : [];
}

/** Alias — half offsets drive both inset and outset. */
export const halfOffsetsForRoom = insetOffsetsForRoom;

/**
 * A bounded inward bevel may cross a neighbouring source edge when incident
 * wall depths differ sharply. Keep only the part that is physically inside
 * the room and return its largest outer ring; room consumers accept one simple
 * contour and handle nested-room holes separately.
 */
function clipInnerContourToRoom(
  contour: number[][],
  room: number[][],
): number[][] | null {
  try {
    const clipped = intersection(
      closedRing(contour) as any,
      closedRing(room) as any,
    );
    return largestOuterContour(clipped);
  } catch {
    return null;
  }
}

/** Largest simple outer ring from polygon-clipping geometry. */
function largestOuterContour(geometry: any): number[][] | null {
  let best: number[][] | null = null;
  let bestArea = 0;
  for (const polygon of geometry || []) {
    const raw = polygon?.[0];
    if (!Array.isArray(raw) || raw.length < 4) continue;
    const ring = raw.slice(0, -1).map((point: number[]) => [point[0], point[1]]);
    const area = Math.abs(signedArea(ring));
    if (ring.length >= 3 && area > bestArea) {
      best = ring;
      bestArea = area;
    }
  }
  return best;
}

/**
 * Inner (clean-floor) contour of a room: inset by half wall thickness.
 * Returns the original poly when there is no thickness.
 */
export function innerContourForRoom(
  rooms: any[],
  roomId: string,
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
  /** Canonical room-wall masonry before opening cuts; pass the render cache. */
  sharedRoomWallGeometry?: any,
  /** Canonical junction topology from the same wall-geometry pass. */
  sharedMultiWallNodes?: MultiWallNodeMap | null,
): number[][] | null {
  const room = (rooms || []).find((r) => r?.id === roomId);
  const poly = roomPoly(room);
  if (!poly || poly.length < 3) return null;
  if (!walls?.length) return poly.map((p) => [p[0], p[1]]);
  const pr = roomWallProfile(rooms, roomId, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
  if (!pr || !pr.offsets.some((o) => o > 0)) return poly.map((p) => [p[0], p[1]]);
  const multiWallNodes = sharedMultiWallNodes || multiWallNodesForGeometry(
    rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
  );
  const inset = insetContour(pr.poly, pr.offsets, multiWallNodes);
  if (!inset) return poly.map((p) => [p[0], p[1]]);
  if (!multiWallNodes.nodes.length) return inset;
  const computedWallGeometry = sharedRoomWallGeometry === undefined
    ? wallBodiesGeometry(rooms, walls, openCuts, [], pitch, cellCm, gridPitch, coordScale)
    : null;
  const roomWallGeometry = sharedRoomWallGeometry ?? (
    computedWallGeometry?.status === 'ok' || computedWallGeometry?.status === 'degraded-extra'
      ? computedWallGeometry.roomGeom : undefined
  );
  if (roomWallGeometry) {
    try {
      const floor = difference(closedRing(pr.poly) as any, roomWallGeometry);
      const contour = largestOuterContour(floor);
      if (contour) return contour;
    } catch {
      // Fall through to the bounded contour clip; never return an outside tip.
    }
  }
  return clipInnerContourToRoom(inset, pr.poly)
    || poly.map((p) => [p[0], p[1]]);
}

function closedRing(poly: number[][]): number[][][] {
  const ring = poly.map((p) => [p[0], p[1]]);
  ring.push([poly[0][0], poly[0][1]]);
  return [ring];
}

function structurallyValidWallGeometry(geometry: any): boolean {
  if (!Array.isArray(geometry) || !geometry.length) return false;
  return geometry.every((polygon: any) => Array.isArray(polygon) && polygon.length
    && polygon.every((ring: any) => Array.isArray(ring) && ring.length >= 4
      && ring.every((point: any) => Array.isArray(point) && point.length >= 2
        && Number.isFinite(point[0]) && Number.isFinite(point[1])))
    && Math.abs(polygonArea(polygon[0])) > 1e-9);
}

interface MultiWallRoomRing {
  outset: number[][];
  inset: number[][] | null;
}

/** Excess pairwise overlap cuts removed to expose the straight bevel. */
function multiWallBevelCutsAt(
  map: MultiWallNodeMap | null | undefined,
  retainToLimit: boolean,
  connectToExterior = false,
): number[][][] {
  if (!map) return [];
  const cuts: number[][][] = [];
  for (const node of map.nodes) {
    for (let i = 0; i < node.rays.length; i++) {
      const a = node.rays[i], b = node.rays[(i + 1) % node.rays.length];
      const angleA = Math.atan2(a.u[1], a.u[0]);
      let angleB = Math.atan2(b.u[1], b.u[0]);
      while (angleB <= angleA) angleB += Math.PI * 2;
      const gap = angleB - angleA;
      if (!(gap > 1e-9) || gap >= Math.PI - 1e-9) continue;
      const nA = [-a.u[1], a.u[0]];
      const nB = [-b.u[1], b.u[0]];
      const pA = [
        node.point[0] + nA[0] * a.halfDepth,
        node.point[1] + nA[1] * a.halfDepth,
      ];
      const pB = [
        node.point[0] - nB[0] * b.halfDepth,
        node.point[1] - nB[1] * b.halfDepth,
      ];
      const hit = lineIntersect(pA, a.u, pB, b.u);
      if (!hit) continue;
      const distance = Math.hypot(
        hit[0] - node.point[0], hit[1] - node.point[1],
      );
      if (!Number.isFinite(distance) || distance <= node.limit) continue;
      // Canonical masonry and its exterior paper retain pairwise overlap up
      // to R so ordinary right-angle arms stay area-connected. Starting the
      // cut at the offset origins removes valid exterior half-wall material.
      const advanceA = retainToLimit ? Math.sqrt(Math.max(
        0, node.limit * node.limit - a.halfDepth * a.halfDepth,
      )) : 0;
      const advanceB = retainToLimit ? Math.sqrt(Math.max(
        0, node.limit * node.limit - b.halfDepth * b.halfDepth,
      )) : 0;
      const qA = [pA[0] + a.u[0] * advanceA, pA[1] + a.u[1] * advanceA];
      const qB = [pB[0] + b.u[0] * advanceB, pB[1] + b.u[1] * advanceB];
      const cut = stableJunctionPatch([qA, qB, hit], map.coordinateScale);
      if (cut) cuts.push(cut);
      if (connectToExterior) {
        // The two offset faces meet at `hit`, so a cut that ends exactly there
        // only touches the exterior at one mathematical point. Polygon
        // clipping and SVG then quite correctly retain it as an enclosed hole
        // (the white junction triangles from #272). Add a small physical
        // corridor across the tip into the already-empty angular sector so
        // the cut has a finite-width exit without changing the approved R
        // endpoints.
        const dx = hit[0] - node.point[0], dy = hit[1] - node.point[1];
        const length = Math.hypot(dx, dy);
        const clearance = distance - node.limit;
        if (length > map.epsilon && clearance > map.epsilon) {
          const bridge = Math.min(
            Math.max(map.epsilon * 8, node.halfDepth * 0.05),
            clearance * 0.25,
          );
          const ux = dx / length, uy = dy / length;
          const vx = -uy, vy = ux;
          // This tapered connector is a strict subset of the original square
          // corridor: it keeps the same finite cross-section at `hit` and the
          // same exterior reach, but avoids two extra contour corners in every
          // large-plan junction path.
          const connector = stableJunctionPatch([
            [hit[0] - ux * bridge + vx * bridge,
              hit[1] - uy * bridge + vy * bridge],
            [hit[0] - ux * bridge - vx * bridge,
              hit[1] - uy * bridge - vy * bridge],
            [hit[0] + ux * bridge, hit[1] + uy * bridge],
          ], map.coordinateScale);
          if (connector) cuts.push(connector);
        }
      }
    }
  }
  return cuts;
}

export function multiWallBevelTriangles(
  map: MultiWallNodeMap | null | undefined,
): number[][][] {
  return multiWallBevelCutsAt(map, true);
}

/**
 * Collapse local cut patches before subtracting them from a large wall body.
 *
 * `A − p1 − p2 ...` is geometrically identical to `A − union(p1, p2,
 * ...)`, but the latter traverses the large subject only once. The exterior
 * connectors from #272 made the former path repeat that expensive traversal
 * for every bevel sector. Keep malformed patches isolated just like the old
 * per-patch subtraction loop did.
 */
function multiWallCutGeometry(cuts: number[][][]): any {
  let geometry: any = null;
  for (const cut of cuts) {
    const piece: any = closedRing(cut) as any;
    try {
      geometry = geometry ? union(geometry, piece) : piece;
    } catch {
      // One unusable local patch must not discard the remaining valid cuts.
    }
  }
  return geometry;
}

/** Rays whose finite strips must survive every bevel cut at this node (#275). */
export function multiWallProtectedRayIndexes(
  node: MultiWallNode,
  dotEpsilon = MULTI_WALL_ORTHOGONAL_DOT_EPSILON,
): number[] {
  const protectedRays = new Set<number>();
  const epsilon = Number.isFinite(dotEpsilon) && dotEpsilon >= 0
    ? dotEpsilon
    : MULTI_WALL_ORTHOGONAL_DOT_EPSILON;
  for (let i = 0; i < node.rays.length; i++) {
    for (let j = i + 1; j < node.rays.length; j++) {
      const a = node.rays[i].u, b = node.rays[j].u;
      const dot = Math.abs(a[0] * b[0] + a[1] * b[1]);
      if (dot <= epsilon) {
        protectedRays.add(i);
        protectedRays.add(j);
      }
    }
  }
  return [...protectedRays].sort((a, b) => a - b);
}

function multiWallRayStripGeometry(
  node: MultiWallNode,
  map: MultiWallNodeMap,
  extent: number,
  rayIndexes?: readonly number[],
): any {
  const selected = rayIndexes ? new Set(rayIndexes) : null;
  let geometry: any = null;
  for (let rayIndex = 0; rayIndex < node.rays.length; rayIndex++) {
    if (selected && !selected.has(rayIndex)) continue;
    const ray = node.rays[rayIndex];
    const n = [-ray.u[1], ray.u[0]];
    // A canonical direction may be owned by overlapping room intervals with
    // different depth/length pairs. Preserve their exact finite union.
    for (const support of ray.supports) {
      const supportExtent = Math.min(extent, support.length);
      if (!(supportExtent > map.epsilon)) continue;
      const rectangle = stableJunctionPatch([
        [node.point[0] + n[0] * support.halfDepth,
          node.point[1] + n[1] * support.halfDepth],
        [node.point[0] + ray.u[0] * supportExtent + n[0] * support.halfDepth,
          node.point[1] + ray.u[1] * supportExtent + n[1] * support.halfDepth],
        [node.point[0] + ray.u[0] * supportExtent - n[0] * support.halfDepth,
          node.point[1] + ray.u[1] * supportExtent - n[1] * support.halfDepth],
        [node.point[0] - n[0] * support.halfDepth,
          node.point[1] - n[1] * support.halfDepth],
      ], map.coordinateScale);
      if (!rectangle) continue;
      const piece: any = closedRing(rectangle) as any;
      geometry = geometry ? union(geometry, piece) : piece;
    }
  }
  return geometry;
}

/**
 * Shared masonry that begins at the real far endpoint of a short incident ray.
 *
 * It is not one of this node's rays and must never be rebuilt as one, but the
 * node-wide replacement mask may overlap it. Keeping the exact finite
 * continuation here prevents that mask from deleting a neighbouring shared
 * wall while leaving unrelated/crossing room-ring material under the existing
 * bevel rules.
 */
function multiWallContinuationStripGeometry(
  node: MultiWallNode,
  map: MultiWallNodeMap,
  maskGeometry: any,
): any {
  let geometry: any = null;
  for (const ray of node.rays) {
    for (const continuation of ray.continuations) {
      const n = [-continuation.u[1], continuation.u[0]];
      const end = [
        continuation.start[0] + continuation.u[0] * continuation.length,
        continuation.start[1] + continuation.u[1] * continuation.length,
      ];
      const rectangle = stableJunctionPatch([
        [continuation.start[0] + n[0] * continuation.halfDepth,
          continuation.start[1] + n[1] * continuation.halfDepth],
        [end[0] + n[0] * continuation.halfDepth,
          end[1] + n[1] * continuation.halfDepth],
        [end[0] - n[0] * continuation.halfDepth,
          end[1] - n[1] * continuation.halfDepth],
        [continuation.start[0] - n[0] * continuation.halfDepth,
          continuation.start[1] - n[1] * continuation.halfDepth],
      ], map.coordinateScale);
      if (!rectangle) continue;
      const piece = intersection(closedRing(rectangle) as any, maskGeometry);
      if (!Array.isArray(piece) || piece.length === 0) continue;
      geometry = geometry ? union(geometry, piece) : piece;
    }
  }
  return geometry;
}

/** Finite local strips protected by at least one perpendicular partner. */
export function multiWallProtectedStripGeometry(
  node: MultiWallNode,
  map: MultiWallNodeMap,
  extent = (MITRE_LIMIT * node.halfDepth + map.epsilon * 2) * 2,
): any {
  const protectedRays = multiWallProtectedRayIndexes(node);
  return protectedRays.length
    ? multiWallRayStripGeometry(node, map, extent, protectedRays)
    : null;
}

function multiWallProtectedMapGeometry(map: MultiWallNodeMap): any {
  let geometry: any = null;
  for (const node of map.nodes) {
    const protectedStrips = multiWallProtectedStripGeometry(node, map);
    if (protectedStrips) {
      geometry = geometry ? union(geometry, protectedStrips) : protectedStrips;
    }
  }
  return geometry;
}

function multiWallEffectiveCutGeometry(
  node: MultiWallNode,
  map: MultiWallNodeMap,
  retainToLimit: boolean,
  connectToExterior: boolean,
  protectedStrips: any,
): any {
  const nodeMap = { ...map, nodes: [node] };
  const cuts = multiWallCutGeometry(
    multiWallBevelCutsAt(nodeMap, retainToLimit, connectToExterior),
  );
  return cuts && protectedStrips ? difference(cuts, protectedStrips) : cuts;
}

function bevelMultiWallBody(
  body: any,
  map: MultiWallNodeMap,
  centre?: any,
  envelope?: any,
): any {
  if (!body || !map.nodes.length) return body;
  let protectedStrips: any = null;
  try {
    // Node masks may overlap (a short wall can end inside both). Every local
    // pass must therefore preserve the protected strips of neighbouring nodes,
    // not only its own, or the later pass can erase the earlier repair.
    protectedStrips = multiWallProtectedMapGeometry(map);
  } catch {
    // A bevel is optional. If its protection cannot be built, keep the complete
    // pre-bevel body instead of risking another user-visible structural hole.
    return body;
  }
  let current = body;
  for (const node of map.nodes) {
    const radius = MITRE_LIMIT * node.halfDepth + map.epsilon * 2;
    const extent = radius * 2;
    const mask = [
      [node.point[0] - radius, node.point[1] - radius],
      [node.point[0] + radius, node.point[1] - radius],
      [node.point[0] + radius, node.point[1] + radius],
      [node.point[0] - radius, node.point[1] + radius],
    ];
    try {
      let boundedCurrent = current;
      const outerCuts = multiWallEffectiveCutGeometry(
        node, map, false, true, protectedStrips,
      );
      if (outerCuts) boundedCurrent = difference(boundedCurrent, outerCuts);
      let local = multiWallRayStripGeometry(node, map, extent);
      const retainedCuts = multiWallEffectiveCutGeometry(
        node, map, true, true, protectedStrips,
      );
      if (retainedCuts) {
        // Rebuild the physical half-strips first, then remove only their
        // excessive pairwise overlap. Applying this cut to the legacy room
        // ring itself can delete an incident half-strip and strand floor.
        local = difference(local, retainedCuts);
      }
      // The same protected material is restored after subtraction so boolean
      // ordering/rounding cannot turn a right-angle wall into an open notch.
      if (protectedStrips) local = union(local, protectedStrips);
      // Rays share a mathematical endpoint. A tiny physical core turns that
      // point contact into a stable polygon contact for boolean/render paths.
      const coreRadius = Math.min(
        ...node.rays.map((ray) => ray.halfDepth),
      ) * 0.02;
      local = union(local, closedRing([
        [node.point[0] - coreRadius, node.point[1] - coreRadius],
        [node.point[0] + coreRadius, node.point[1] - coreRadius],
        [node.point[0] + coreRadius, node.point[1] + coreRadius],
        [node.point[0] - coreRadius, node.point[1] + coreRadius],
      ]) as any);
      if (!local) continue;
      let localInside = intersection(local, closedRing(mask) as any);
      // `envelope` is the bounded physical paper, including the exterior
      // half-walls. Clipping the repair to the room-centre union first drops
      // exactly the valid T-junction wedge this reconstruction must retain.
      if (envelope) localInside = intersection(localInside, envelope);
      else if (centre) localInside = intersection(localInside, centre);
      const maskGeometry = closedRing(mask) as any;
      const outside = difference(boundedCurrent, maskGeometry);
      const preservedExterior = centre
        ? difference(intersection(boundedCurrent, maskGeometry), centre)
        : null;
      // The square replacement removes legacy mitre/room-ring material before
      // rebuilding this node's finite rays. A short ray can end inside it and
      // hand off to a shared wall that is not incident to this node; preserve
      // that exact continuation, never a global square/radius projection.
      const foreignFinite = multiWallContinuationStripGeometry(node, map, maskGeometry);
      current = union(
        outside,
        ...(preservedExterior ? [preservedExterior] : []),
        ...(foreignFinite ? [foreignFinite] : []),
        localInside,
      );
    } catch {
      // Isolate the failed node. Other valid nodes still receive their repair;
      // mandatory surrounding structural failures remain fail-dark upstream.
    }
  }
  if (protectedStrips) {
    try {
      let protectedInside = protectedStrips;
      if (envelope) protectedInside = intersection(protectedInside, envelope);
      else if (centre) protectedInside = intersection(protectedInside, centre);
      current = union(current, protectedInside);
    } catch {
      // Per-node reconstruction above already retained the same material.
    }
  }
  return current;
}


/**
 * Collapse arithmetic noise on computed junction vertices before polyclip sees
 * them. The quantum is relative to the caller coordinate scale and remains
 * many orders of magnitude below the geometry epsilon: it must never snap a
 * physical half-depth or mitre to the drawing grid.
 */
export function stableJunctionPatch(
  patch: number[][],
  coordScale = 1,
): number[][] | null {
  if (!Array.isArray(patch) || patch.length < 3) return null;
  const scale = Number.isFinite(coordScale) && coordScale > 0 ? coordScale : 1;
  const quantum = Math.max(1, scale) * 1e-12;
  const stable: number[][] = [];
  for (const point of patch) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const x = Number(point[0]), y = Number(point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const sx = Math.round(x / quantum) * quantum;
    const sy = Math.round(y / quantum) * quantum;
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
    stable.push([Object.is(sx, -0) ? 0 : sx, Object.is(sy, -0) ? 0 : sy]);
  }
  return Math.abs(signedArea(stable)) > quantum * quantum ? stable : null;
}

type JunctionUnion = (subject: any, clipping: any) => any;

/**
 * Add optional virtual-junction patches transactionally. A single rejected
 * patch may retain the local pre-patch contour, but it must not discard the
 * already valid masonry for the entire space or prevent later patches.
 */
export function unionJunctionPatches(
  body: any,
  patches: number[][][],
  coordScale = 1,
  unionFn: JunctionUnion = union,
): any {
  let current = body;
  for (const raw of patches || []) {
    const patch = stableJunctionPatch(raw, coordScale);
    if (!patch) continue;
    try {
      const piece = closedRing(patch) as any;
      const next = current ? unionFn(current, piece) : piece;
      current = next;
    } catch {
      // Keep the last valid body and continue. Returning null here would erase
      // every unrelated wall, floor/light barrier and successful later patch.
    }
  }
  return current;
}

interface ExteriorEnvelopeGeometry {
  /** Union of room centrelines. Shared Split edges disappear from this shape. */
  centre: any;
  /** Wall shell generated only from the surviving exterior boundary. */
  shell: any;
}

/** Open every ring of a polyclip MultiPolygon and drop its closing duplicate. */
function geometryRings(geom: any): number[][][] {
  const out: number[][][] = [];
  for (const polygon of Array.isArray(geom) ? geom : []) {
    if (!Array.isArray(polygon)) continue;
    for (const raw of polygon) {
      if (!Array.isArray(raw) || raw.length < 4) continue;
      const ring = raw.slice(0, -1).map((p: number[]) => [p[0], p[1]]);
      if (ring.length >= 3) out.push(ring);
    }
  }
  return out;
}

function pointOnSegment(p: number[], a: number[], b: number[], eps: number): boolean {
  if (distToSeg(p[0], p[1], a[0], a[1], b[0], b[1]) > eps) return false;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const dot = (p[0] - a[0]) * dx + (p[1] - a[1]) * dy;
  const len2 = dx * dx + dy * dy;
  const projectedEps = eps * Math.sqrt(len2);
  return dot >= -projectedEps && dot <= len2 + projectedEps;
}

/**
 * Split a boolean-union boundary at every stored exterior interval endpoint.
 * Polyclip is allowed to collapse a collinear child-room vertex; retaining the
 * interval breakpoints is what preserves unequal wall depths on the two sides.
 */
function exteriorBoundaryProfile(
  ring: number[][],
  outer: WallInterval[],
  eps: number,
): { poly: number[][]; offsets: number[] } | null {
  const poly: number[][] = [];
  const offsets: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (!(len2 > eps * eps)) continue;
    // `t` below is a dimensionless fraction of this edge, while `eps` is a
    // render-space distance. Comparing them directly drops every interior cut
    // on production-scale plans (for example eps ~= 0.67 at coordScale=1000).
    // Convert the shared geometry tolerance to the edge's local 0..1 domain.
    const tEps = eps / Math.sqrt(len2);
    const cuts = [0, 1];
    for (const iv of outer) {
      for (const p of [iv.a, iv.b]) {
        if (!pointOnSegment(p, a, b, eps)) continue;
        const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
        if (t > tEps && t < 1 - tEps) cuts.push(t);
      }
    }
    cuts.sort((x, y) => x - y);
    const unique = cuts.filter(
      (t, at) => at === 0 || Math.abs(t - cuts[at - 1]) > tEps,
    );
    for (let at = 0; at < unique.length - 1; at++) {
      const t0 = unique[at], t1 = unique[at + 1];
      const p = [a[0] + dx * t0, a[1] + dy * t0];
      const mid = [a[0] + dx * (t0 + t1) / 2, a[1] + dy * (t0 + t1) / 2];
      let half = 0;
      for (const iv of outer) {
        if (pointOnSegment(mid, iv.a, iv.b, eps)) half = Math.max(half, iv.half);
      }
      poly.push(p);
      offsets.push(half);
    }
  }
  return poly.length >= 3 && offsets.length === poly.length ? { poly, offsets } : null;
}

/**
 * Exterior masonry is derived from the union of room centrelines, not from
 * each room independently. A Split edge therefore vanishes before mitres are
 * built and cannot turn its artificial child corner into part of the facade.
 */
function exteriorEnvelopeGeometry(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale: number,
  sharedMultiWallNodes?: MultiWallNodeMap | null,
): ExteriorEnvelopeGeometry | null {
  const polys = (rooms || []).map(roomPoly)
    .filter((p): p is number[][] => !!p && p.length >= 3);
  if (!polys.length) return null;
  let centre: any = union(closedRing(polys[0]) as any);
  for (let i = 1; i < polys.length; i++) centre = union(centre, closedRing(polys[i]) as any);

  const intervals = wallIntervals(
    rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
  );
  const outer = intervals.filter((iv) => iv.kind === 'outer' && iv.half > 0);
  const eps = openEps(pitch, coordScale) * 4;
  const multiWallNodes = sharedMultiWallNodes
    || buildMultiWallNodeMap(intervals, eps, coordScale);
  let shell: any = null;
  for (const ring of geometryRings(centre)) {
    const profile = exteriorBoundaryProfile(ring, outer, eps);
    if (!profile || !profile.offsets.some((o) => o > 0)) continue;
    const outset = outsetContour(profile.poly, profile.offsets, multiWallNodes);
    const inset = insetContour(profile.poly, profile.offsets, multiWallNodes);
    if (!outset || !inset) continue;
    const piece = difference(closedRing(outset) as any, closedRing(inset) as any);
    shell = shell ? union(shell, piece) : piece;
  }
  return {
    centre,
    shell: shell || [],
  };
}

/**
 * Canonical Stage floor footprint: room union plus derived exterior masonry.
 * Independent partitions/columns are deliberately not accepted here, so they
 * can never enlarge the slab perimeter. Null is a boolean failure; an empty
 * array is a valid space without room geometry.
 */
export function floorFootprintGeometry(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): any | null {
  try {
    const multiWallNodes = multiWallNodesForGeometry(
      rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
    );
    const exterior = exteriorEnvelopeGeometry(
      rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale, multiWallNodes,
    );
    if (!exterior) return [];
    const paper = exterior.shell?.length
      ? union(exterior.centre, exterior.shell)
      : exterior.centre;
    return paper;
  } catch {
    return null;
  }
}

/**
 * Drop zero-area rings a boolean union leaves where two chords coincide
 * exactly (fan chord over chamfer chord). They paint nothing, but they are
 * topological holes and every downstream ring-counting consumer sees them.
 */
function dropDegenerateRings(geom: any, areaEps: number): any {
  if (!Array.isArray(geom)) return geom;
  const polygons = geom
    .map((polygon: any) => {
      if (!Array.isArray(polygon) || !polygon.length) return polygon;
      const [outer, ...holes] = polygon;
      if (Math.abs(signedArea(outer || [])) <= areaEps) return null;
      return [outer, ...holes.filter(
        (ring: number[][]) => Math.abs(signedArea(ring || [])) > areaEps,
      )];
    })
    .filter((polygon: any) => !!polygon);
  return polygons;
}

/**
 * The approved outer boundary for node pieces: the building footprint plus
 * the exterior wall band with PLAIN corners — the very shape the contour had
 * before any node existed. Fans and support tips are clipped to it, so the
 * node can never grow new facade (the concave-Split contract), while the
 * plain corners — unlike the node-notched envelope — never reopen the sector
 * holes the pieces exist to close.
 */
export function junctionNodeBound(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale: number,
  map: MultiWallNodeMap,
): any | null {
  try {
    const plain: MultiWallNodeMap = {
      epsilon: map.epsilon, coordinateScale: map.coordinateScale,
      nodes: [], index: new Map(),
    };
    const exterior = exteriorEnvelopeGeometry(
      rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale, plain,
    );
    if (!exterior) return null;
    return exterior.shell?.length
      ? union(exterior.centre, exterior.shell)
      : exterior.centre;
  } catch {
    return null;
  }
}


export function polyclipToPathD(geom: any): string {
  if (!geom) return '';
  let d = '';
  // polyclip Geom: MultiPolygon = Polygon[]; Polygon = Ring[] where ring[0]
  // is the outer and ring[1..] are holes. We must emit EVERY ring so evenodd
  // fill punches the floor out of the wall body (otherwise a single-room
  // outset fills solid — the whole room looks like hatch).
  for (const poly of geom as any[]) {
    if (!Array.isArray(poly)) continue;
    for (const ring of poly) {
      if (!Array.isArray(ring) || ring.length < 4) continue;
      const pts = ring.slice(0, ring.length - 1);
      if (pts.length < 3) continue;
      d += (d ? ' ' : '') + polyToPath(pts.map((p: number[]) => [p[0], p[1]]));
    }
  }
  return d;
}

/**
 * Mitre patches at an endpoint where a virtual stretch meets real walls that
 * belong to different room contours.
 *
 * The normal per-room rings can only join adjacent thick edges of ONE room.
 * At a virtual T, the two real arms may be owned by two point-touching rooms;
 * each ring then ends with a butt cap and their union leaves a stair-step at
 * the outer corner. The patch is the missing offset-line parallelogram. It is
 * restricted to open-span endpoints, so ordinary corners keep the existing
 * contour/mitre/bevel implementation unchanged.
 */
export function virtualJunctionPatches(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale: number,
  sharedMultiWallNodes?: MultiWallNodeMap | null,
): number[][][] {
  if (!walls?.length || !openCuts?.length) return [];
  const eps = openEps(pitch, coordScale) * 4;
  const unique = new Map<string, WallInterval>();
  for (const iv of wallIntervals(rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale)) {
    if (iv.open || !(iv.half > 0) || unique.has(iv.key)) continue;
    unique.set(iv.key, iv);
  }
  const intervals = [...unique.values()];
  if (intervals.length < 2) return [];
  const multiWallNodes = sharedMultiWallNodes
    || buildMultiWallNodeMap(intervals, eps);

  const nodes: number[][] = [];
  for (const cut of openCuts) {
    for (const p of [[cut[0], cut[1]], [cut[2], cut[3]]]) {
      if (!nodes.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= eps)) nodes.push(p);
    }
  }
  const out: number[][][] = [];
  const awayFrom = (iv: WallInterval, v: number[]): number[] | null => {
    let dx = 0, dy = 0;
    if (Math.hypot(iv.a[0] - v[0], iv.a[1] - v[1]) <= eps) {
      dx = iv.b[0] - iv.a[0]; dy = iv.b[1] - iv.a[1];
    } else if (Math.hypot(iv.b[0] - v[0], iv.b[1] - v[1]) <= eps) {
      dx = iv.a[0] - iv.b[0]; dy = iv.a[1] - iv.b[1];
    } else {
      return null;
    }
    const L = Math.hypot(dx, dy);
    return L > eps ? [dx / L, dy / L] : null;
  };

  for (const v of nodes) {
    const touching = intervals
      .map((iv) => ({ iv, u: awayFrom(iv, v) }))
      .filter((x): x is { iv: WallInterval; u: number[] } => !!x.u);
    for (let i = 0; i < touching.length; i++) {
      for (let j = i + 1; j < touching.length; j++) {
        const a = touching[i], b = touching[j];
        const cross = a.u[0] * b.u[1] - a.u[1] * b.u[0];
        const sin = Math.abs(cross);
        if (sin < 1e-3) continue; // one straight wall, no corner to fill
        const da = b.iv.half / sin;
        const db = a.iv.half / sin;
        const pa = [v[0] - a.u[0] * da, v[1] - a.u[1] * da];
        const pb = [v[0] - b.u[0] * db, v[1] - b.u[1] * db];
        const far = [pa[0] + pb[0] - v[0], pa[1] + pb[1] - v[1]];
        const maxHalf = Math.max(a.iv.half, b.iv.half, 1e-9);
        const multiNode = multiWallNodeAt(multiWallNodes, v);
        const limit = multiNode?.limit ?? MITRE_LIMIT * maxHalf;
        const farDistance = Math.hypot(far[0] - v[0], far[1] - v[1]);
        let patch: number[][];
        if (farDistance <= limit) {
          patch = cross > 0 ? [v.slice(), pa, far, pb] : [v.slice(), pb, far, pa];
        } else if (multiNode) {
          const nA = [-a.u[1], a.u[0]];
          const nB = [-b.u[1], b.u[0]];
          const sign = cross < 0 ? 1 : -1;
          const edgeA = [
            v[0] + nA[0] * a.iv.half * sign,
            v[1] + nA[1] * a.iv.half * sign,
          ];
          const edgeB = [
            v[0] - nB[0] * b.iv.half * sign,
            v[1] - nB[1] * b.iv.half * sign,
          ];
          patch = cross > 0 ? [v.slice(), edgeA, edgeB] : [v.slice(), edgeB, edgeA];
        } else {
          // Preserve the exact two-ray contract: an over-limit legacy mitre
          // produces no virtual patch, just as before #249.
          continue;
        }
        if (Math.abs(signedArea(patch)) > eps * eps) out.push(patch);
      }
    }
  }
  return out;
}

/**
 * One evenodd ring path per room: outset(half) − inset(half). Shared walls
 * meet as two half-rings; callers may union them via wallBodiesUnionPath.
 */
export function wallBodyRings(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): WallBodyPath[] {
  if (!walls?.length) return [];
  const out: WallBodyPath[] = [];
  const multiWallNodes = multiWallNodesForGeometry(
    rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
  );
  for (const room of rooms || []) {
    if (!room?.id) continue;
    const pr = roomWallProfile(rooms, room.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
    if (!pr || pr.poly.length < 3 || !pr.offsets.some((o) => o > 0)) continue;
    const outset = outsetContour(pr.poly, pr.offsets, multiWallNodes);
    const inset = insetContour(pr.poly, pr.offsets, multiWallNodes);
    if (!outset || !inset) continue;
    const d = `${polyToPath(outset)} ${polyToPath(reversePoly(inset))}`;
    let key = '';
    let kind: WallKind = 'outer';
    let cm = 0;
    let depth = 0;
    for (let i = 0; i < pr.poly.length; i++) {
      if (!(pr.offsets[i] > 0)) continue;
      const a = pr.poly[i], b = pr.poly[(i + 1) % pr.poly.length];
      key = keyOf(a, b, pitch, coordScale);
      kind = pr.kinds[i] || 'outer';
      cm = pr.cms[i];
      depth = wallCmToUnits(cm, cellCm, gridPitch);
      break;
    }
    out.push({ d, key, kind, cm, depthUnits: depth });
  }
  return out;
}

/**
 * Seamless wall hatch: union of each room's own outset-minus-inset wall ring,
 * with opening slots cut as holes. One continuous body across L and T joins.
 *
 * Do not rewrite this as `(union outsets) - (union insets)`: subtraction does
 * not distribute over union. In a nested/complex layout the clean floor of one
 * room would then erase a wall owned by another room, leaving half-depth strips
 * and tiny holes at junctions.
 */
/**
 * The masonry itself, as polygons: room wall rings joined at their mitres,
 * with opening slots cut through. Drawing uses it as one path; the light model
 * uses the same geometry as its occluders, so a wall blocks light exactly
 * where the plan shows a wall — with its real thickness, and with a doorway
 * that is a real gap between two jamb faces. A successful empty operation is
 * returned as an empty typed result. Core failure is `failed-core`; an optional
 * merge failure is `degraded-extra` with every known-valid component retained.
 */
export function wallBodiesGeometry(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  openings: Array<{ x: number; y: number; angle: number; length: number }> = [],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
  extraBodies: number[][][] = [],
  operations: WallGeometryOperations = {},
): WallBodiesGeometryResult {
  if (!walls?.length && !extraBodies.length) return {
    status: 'not-applicable', geom: [], components: [], roomGeom: [], paperGeom: [],
    depthUnits: 0, openingIndex: null, multiWallNodes: null, degradedExtraCount: 0,
  };
  const roomRings: MultiWallRoomRing[] = [];
  const multiWallNodes = multiWallNodesForGeometry(
    rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
  );
  let maxDepth = 0;
  for (const room of rooms || []) {
    if (!room?.id) continue;
    const pr = roomWallProfile(rooms, room.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
    if (!pr || pr.poly.length < 3 || !pr.offsets.some((o) => o > 0)) continue;
    for (const o of pr.offsets) if (o > 0) maxDepth = Math.max(maxDepth, o * 2);
    const outC = outsetContour(pr.poly, pr.offsets, multiWallNodes);
    const inC = insetContour(pr.poly, pr.offsets, multiWallNodes);
    if (!outC) continue;
    roomRings.push({ outset: outC, inset: inC });
  }
  for (const body of extraBodies) {
    const xs = body.map((p) => p[0]), ys = body.map((p) => p[1]);
    if (xs.length) {
      const bboxDepth = Math.min(
        Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      // A 96-gon is a circle and its bbox is the diameter. Four-point bodies
      // are partitions/square columns; their shortest edge is the real depth,
      // whereas a rotated bbox exaggerates it and incorrectly enables hatch.
      const edgeDepth = Math.min(...body.map((p, i) => {
        const q = body[(i + 1) % body.length];
        return Math.hypot(q[0] - p[0], q[1] - p[1]);
      }));
      maxDepth = Math.max(maxDepth, body.length > 16 ? bboxDepth : edgeDepth);
    }
  }
  const junctions = virtualJunctionPatches(
    rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale, multiWallNodes,
  );
  const openingIndex = openings.length
    ? openingWallIndex(rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale)
    : null;
  let corePhase = 'exterior';
  try {
    const exterior = exteriorEnvelopeGeometry(
      rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale, multiWallNodes,
    );
    // Paper and masonry share this one structural pass. Renderers cache the
    // returned pair, so a live HA state update never repeats exterior topology.
    corePhase = 'paper';
    const rawPaperGeom = exterior
      ? (exterior.shell?.length ? union(exterior.centre, exterior.shell) : exterior.centre)
      : [];
    // Paper: the approved chamfer first, then the same additive fans that
    // complete the masonry corner complete the paper beneath it (#302).
    // Paper needs no node pieces: the footprint-plus-shell union already
    // covers every junction (measured on #197 and the owner repro — byte-equal
    // with and without them), and with the subtractive paper bevel gone the
    // #261 white-wedge class is impossible by construction.
    const paperGeom = rawPaperGeom;
    const bodyOf = (ring: typeof roomRings[number]): any => {
      const outset: any = closedRing(ring.outset);
      return ring.inset ? difference(outset, closedRing(ring.inset) as any) : outset;
    };
    corePhase = 'room-rings';
    let body: any = null;
    for (const ring of roomRings) {
      try {
        const piece = bodyOf(ring);
        body = body ? union(body, piece) : piece;
      } catch {
        // An acute child contour may be invalid for boolean subtraction. The
        // interval pass below still supplies its physical wall without letting
        // the artificial mitre back into the exterior envelope.
      }
    }
    // Per-room rings preserve established L/T/nested joins. Atomic quads are
    // also included so a rejected acute child ring cannot remove a divider or
    // an interior half-wall. Clipping them to the centre union gives a hard
    // facade boundary; the canonical exterior shell is added afterwards.
    corePhase = 'edge-bodies';
    if (exterior) {
      for (const edge of wallEdgeBodies(
        rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
      )) {
        try {
          const piece = intersection(closedRing(edge.quad) as any, exterior.centre);
          body = body ? union(body, piece) : piece;
        } catch {
          // A valid per-room ring may already own this interval. If neither
          // representation is usable the final result fails closed below.
        }
      }
    }
    // The room-ring subtraction above cannot infer a mitre between real arms
    // owned by different contours at a virtual T. Add only those missing
    // junction pieces, then let physical openings cut through them as usual.
    corePhase = 'junctions';
    body = unionJunctionPatches(body, junctions, coordScale);
    corePhase = 'facade-clip';
    if (body && exterior) body = intersection(body, exterior.centre);
    corePhase = 'exterior-shell';
    const isolatedCore: WallGeometryComponent[] = [];
    let degradedCoreCount = 0;
    if (exterior?.shell?.length) {
      if (!body) body = exterior.shell;
      else {
        try {
          const merged = union(body, exterior.shell);
          if (!structurallyValidWallGeometry(merged)) throw new Error('invalid shell union');
          body = merged;
        } catch {
          // Both mandatory halves exist; only their boolean merge failed.
          // Preserve them as non-cancelling components for read-only render,
          // while strict writers still reject the degraded structural result.
          if (!structurallyValidWallGeometry(body)
              || !structurallyValidWallGeometry(exterior.shell)) throw new Error('invalid shell');
          isolatedCore.push({ id: 'exterior-shell', geom: exterior.shell });
          degradedCoreCount++;
        }
      }
    }
    // The old bevel layer survives only as a TARGETED lateral trim: it
    // removes the ring material a base contour paints past a degenerately
    // short thick support (#271) — something no additive piece can undo. It
    // runs ONLY on nodes that actually have such a support: everywhere else
    // it used to leave the steps and horns the owner rejected (decision #5),
    // and the node stays purely additive.
    corePhase = 'multi-wall-trim';
    if (body && multiWallNodes.nodes.length) {
      const needsTrim = (node: MultiWallNode): boolean => node.rays.some(
        (ray) => ray.supports.some(
          (support) => support.length < support.halfDepth * 2,
        ),
      );
      const trimNodes = multiWallNodes.nodes.filter(needsTrim);
      if (trimNodes.length) {
        const trimMap: MultiWallNodeMap = {
          ...multiWallNodes, nodes: trimNodes,
        };
        body = bevelMultiWallBody(body, trimMap, exterior?.centre, paperGeom);
      }
    }
    // Then the node gets its additive corners: the exact support quads of its
    // rays — each bounded by its own finite length, so the trimmed lateral
    // phantom cannot come back — and one mitre/bevel fan per pair of
    // angularly adjacent rays, bounded by the classic MITRE_LIMIT.
    corePhase = 'junction-corners';
    if (multiWallNodes.nodes.length) {
      const corners = junctionNodeGeometry(multiWallNodes);
      const bound = junctionNodeBound(
        rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
        multiWallNodes,
      );
      // Fans only: with the trim now TARGETED (it never cuts an ordinary
      // node's strips) the support re-union became dead weight — measured by
      // the full unit suite staying green without it. The support quads stay
      // exported: the detector and the tests use them as the contract truth.
      for (const piece of corners.fans) {
        try {
          let ring: any = [closedRing(piece)];
          if (bound) ring = intersection(ring, bound);
          if (!ring?.length) continue;
          body = body ? union(body, ring) : ring;
        } catch {
          // A degenerate piece must not take the whole node down; the rest
          // still stands on its own.
        }
      }
      body = dropDegenerateRings(body, Math.max(multiWallNodes.epsilon, 1e-9) ** 2);
    }
    const roomGeom = body || [];
    // cut opening tunnels (axis-aligned to opening angle)
    corePhase = 'openings';
    for (const o of openings) {
      if (!(o.length > 0)) continue;
      const association = resolveOpeningWallAssociation(openingIndex!, o, true);
      if (!association.negative && !association.positive) continue;
      const rad = (o.angle * Math.PI) / 180;
      const ux = Math.cos(rad), uy = Math.sin(rad);
      const nx = -uy, ny = ux;
      const half = o.length / 2;
      const pad = Math.max(maxDepth, pitch * coordScale) * 1.25;
      const slot = [
        [o.x - ux * half - nx * pad, o.y - uy * half - ny * pad],
        [o.x + ux * half - nx * pad, o.y + uy * half - ny * pad],
        [o.x + ux * half + nx * pad, o.y + uy * half + ny * pad],
        [o.x - ux * half + nx * pad, o.y - uy * half + ny * pad],
      ];
      if (body) body = difference(body, closedRing(slot) as any);
      for (const component of isolatedCore) {
        component.geom = difference(component.geom, closedRing(slot) as any);
      }
    }
    // Independent bodies are physical but own no openings. Each merge is a
    // transaction: a local boolean failure must not discard the last valid
    // room/extra union. A valid offending body remains an isolated component,
    // which renderers paint separately so coincident evenodd rings never punch
    // a transparent hole in the primary masonry.
    corePhase = 'extras';
    const isolated: WallGeometryComponent[] = [];
    let degradedExtraCount = 0;
    const mergeExtra = operations.mergeExtra
      || ((primary: any, extra: any) => primary ? union(primary, extra) : extra);
    for (let index = 0; index < extraBodies.length; index++) {
      const extra = extraBodies[index];
      if (extra.length < 3 || !extra.every((point) => point.length >= 2
          && Number.isFinite(point[0]) && Number.isFinite(point[1]))
          || Math.abs(polygonArea(extra)) <= 1e-9) {
        degradedExtraCount++;
        continue;
      }
      const standalone: any = [closedRing(extra)];
      try {
        const merged = mergeExtra(body, standalone, index);
        if (!structurallyValidWallGeometry(merged)) throw new Error('invalid extra union');
        body = merged;
      } catch {
        degradedExtraCount++;
        if (structurallyValidWallGeometry(standalone)) {
          isolated.push({ id: `extra-${index}`, geom: standalone });
        }
      }
    }
    isolated.push(...isolatedCore);
    isolated.sort((left, right) => polyclipToPathD(left.geom).localeCompare(polyclipToPathD(right.geom)));
    const primary = body || [];
    const components: WallGeometryComponent[] = [
      ...(structurallyValidWallGeometry(primary) ? [{ id: 'primary', geom: primary }] : []),
      ...isolated.map((component, index) => ({ ...component, id: `isolated-${index}` })),
    ];
    return {
      status: degradedExtraCount || degradedCoreCount ? 'degraded-extra' : 'ok',
      geom: primary, components, roomGeom, paperGeom,
      depthUnits: maxDepth, openingIndex, multiWallNodes,
      degradedExtraCount: degradedExtraCount + degradedCoreCount,
    };
  } catch {
    operations.onCoreFailure?.(corePhase);
    return {
      status: 'failed-core', geom: [], components: [], roomGeom: [], paperGeom: [],
      depthUnits: maxDepth, openingIndex: null, multiWallNodes, degradedExtraCount: 0,
    };
  }
}

export function wallBodiesUnionPath(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  openings: Array<{ x: number; y: number; angle: number; length: number }> = [],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
  /** Independent physical bodies are unioned only after room openings are cut,
   * so a door/window/gate can never punch a coincident partition or column. */
  extraBodies: number[][][] = [],
  operations: WallGeometryOperations = {},
): {
  status: 'ok' | 'degraded-extra';
  d: string;
  paths: readonly { id: string; d: string; fillRule: 'evenodd' }[];
  components: readonly WallGeometryComponent[];
  roomGeom: any;
  multiWallNodes: MultiWallNodeMap | null;
  paperD: string;
  depthUnits: number;
  fillRule: 'evenodd' | 'nonzero';
} | null {
  if (!walls?.length && !extraBodies.length) return null;
  const united = wallBodiesGeometry(
    rooms, walls, openCuts, openings, pitch, cellCm, gridPitch, coordScale, extraBodies,
    operations,
  );
  return wallBodiesGeometryPath(united);
}

/** Project one already validated wall-geometry pass into the SVG payload. */
export function wallBodiesGeometryPath(
  united: WallBodiesGeometryResult,
): {
  status: 'ok' | 'degraded-extra';
  d: string;
  paths: readonly { id: string; d: string; fillRule: 'evenodd' }[];
  components: readonly WallGeometryComponent[];
  roomGeom: any;
  multiWallNodes: MultiWallNodeMap | null;
  paperD: string;
  depthUnits: number;
  fillRule: 'evenodd' | 'nonzero';
} | null {
  if (united.status === 'failed-core' || united.status === 'not-applicable') return null;
  const paths = united.components.map((component) => ({
    id: component.id, d: polyclipToPathD(component.geom), fillRule: 'evenodd' as const,
  })).filter((component) => !!component.d);
  const d = paths[0]?.d || '';
  const paperD = polyclipToPathD(united.paperGeom);
  if (paths.length) return {
    status: united.status, d, paths, components: united.components,
    roomGeom: united.roomGeom, multiWallNodes: united.multiWallNodes, paperD,
    depthUnits: united.depthUnits, fillRule: 'evenodd',
  };
  // successful empty result: do not resurrect raw rings
  // Fail closed. The old raw per-room-ring fallback is the exact algorithm
  // that creates an exterior tooth at a corner Split, so resurrecting it after
  // a boolean failure would make malformed input violate the facade invariant.
  return null;
}

/**
 * Per-edge wall quads for styling hooks and thick-cut suppression — one body
 * per unique wall key. Shared and outer walls both grow ±½ from the
 * centreline (docs/WALL-THICKNESS.md §2). Production hatch uses
 * wallBodiesUnionPath; these quads remain for hooks / stroke cuts.
 */
export interface WallEdgeBody {
  key: string;
  kind: WallKind;
  cm: number;
  /** Quad corners (4 points), CCW. */
  quad: number[][];
  a: number[];
  b: number[];
  depthUnits: number;
}

export function wallEdgeBodies(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): WallEdgeBody[] {
  if (!walls?.length) return [];
  const seen = new Set<string>();
  const out: WallEdgeBody[] = [];
  for (const room of rooms || []) {
    if (!room?.id) continue;
    const pr = roomWallProfile(rooms, room.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
    if (!pr) continue;
    const poly = pr.poly;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const kind = pr.kinds[i];
      if (!kind) continue;
      const cm = pr.cms[i];
      if (!(cm > 0)) continue;
      const key = keyOf(a, b, pitch, coordScale);
      if (seen.has(key)) continue;
      seen.add(key);
      const depth = wallCmToUnits(cm, cellCm, gridPitch);
      const [inx, iny] = inwardNormal(poly, i);
      const ox = -inx, oy = -iny;
      const h = depth / 2;
      const quad: number[][] = [
        [a[0] + ox * h, a[1] + oy * h],
        [b[0] + ox * h, b[1] + oy * h],
        [b[0] + inx * h, b[1] + iny * h],
        [a[0] + inx * h, a[1] + iny * h],
      ];
      out.push({ key, kind, cm, quad, a: [a[0], a[1]], b: [b[0], b[1]], depthUnits: depth });
    }
  }
  return out;
}

/** SVG path for an edge body, with optional opening slots cut (evenodd holes). */
export function wallEdgePathD(
  body: WallEdgeBody,
  openings: Array<{ x: number; y: number; angle: number; length: number }> = [],
): string {
  let d = polyToPath(body.quad);
  const [dx, dy] = wallDir(body.a, body.b);
  const ux = dx, uy = dy;
  // normal across the wall (from a toward inward of first room estimate = perp)
  const nx = -uy, ny = ux;
  for (const o of openings) {
    if (!wallAngleMatches(body.a, body.b, o.angle)) continue;
    // only openings whose centre lies on (or very near) this span's centreline
    const dist = distToSeg(o.x, o.y, body.a[0], body.a[1], body.b[0], body.b[1]);
    if (dist > Math.max(body.depthUnits * 0.55, 1e-3)) continue;
    const half = o.length / 2;
    // slot covers full depth of this quad
    const pad = body.depthUnits; // generous across
    // project opening onto wall direction
    const cx = o.x, cy = o.y;
    const slot = [
      [cx - ux * half - nx * pad, cy - uy * half - ny * pad],
      [cx + ux * half - nx * pad, cy + uy * half - ny * pad],
      [cx + ux * half + nx * pad, cy + uy * half + ny * pad],
      [cx - ux * half + nx * pad, cy - uy * half + ny * pad],
    ];
    d += ` ${polyToPath(reversePoly(slot))}`;
  }
  return d;
}

/**
 * Outward paper growth offsets per edge (plan units): half-thickness under
 * every thick wall (outer and shared) so the scene background never shows
 * through the outer half-out.
 */
export function paperOutwardOffsets(
  rooms: any[],
  roomId: string,
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): number[] {
  const pr = roomWallProfile(rooms, roomId, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
  return pr ? pr.offsets : [];
}

/**
 * Expand a polygon outward by per-edge offsets (mirror of inset with flipped
 * normals). Used for paper under shared thick walls.
 */
export function outsetContour(
  poly: number[][],
  offsets: number[],
  multiWallNodes?: MultiWallNodeMap | null,
): number[][] | null {
  const n = poly?.length || 0;
  if (n < 3 || offsets.length !== n) return null;
  if (offsets.every((o) => !(o > 0))) return poly.map((p) => [p[0], p[1]]);
  // outset = inset of the reversed winding with same offsets, then reverse back
  const rev = reversePoly(poly);
  const revOff = offsets.slice().reverse();
  // shift so revOff[i] applies to edge rev[i]→rev[i+1] which was poly edge
  // after reverse: edge i of rev was edge (n-1-i) of original... careful.
  // Simpler: negate inward normals by using inset on poly with negative? 
  // Build by flipping offset direction manually:
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const iPrev = (i - 1 + n) % n;
    const oA = Math.max(0, offsets[iPrev]);
    const oB = Math.max(0, offsets[i]);
    const [nAx, nAy] = inwardNormal(poly, iPrev);
    const [nBx, nBy] = inwardNormal(poly, i);
    // outward = -inward
    const a0 = poly[iPrev], a1 = poly[i];
    const b0 = poly[i], b1 = poly[(i + 1) % n];
    const dA = [a1[0] - a0[0], a1[1] - a0[1]];
    const dB = [b1[0] - b0[0], b1[1] - b0[1]];
    const LA = Math.hypot(dA[0], dA[1]) || 1;
    const LB = Math.hypot(dB[0], dB[1]) || 1;
    const uA = [dA[0] / LA, dA[1] / LA];
    const uB = [dB[0] / LB, dB[1] / LB];
    const pA = [a0[0] - nAx * oA, a0[1] - nAy * oA];
    const pB = [b0[0] - nBx * oB, b0[1] - nBy * oB];
    if (!(oA > 0) && !(oB > 0)) {
      out.push([poly[i][0], poly[i][1]]);
      continue;
    }
    // Mirror the inset contract above: one physical edge plus one zero-depth
    // edge is a local cap with both endpoints present in traversal order.
    if ((oA > 0) !== (oB > 0)) {
      const v = poly[i];
      const pa = oA > 0 ? [v[0] - nAx * oA, v[1] - nAy * oA] : [v[0], v[1]];
      const pb = oB > 0 ? [v[0] - nBx * oB, v[1] - nBy * oB] : [v[0], v[1]];
      out.push(pa);
      if (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > 1e-9) out.push(pb);
      continue;
    }
    if (collinearJoint(uA, uB)) {
      const v = poly[i];
      const pa = [v[0] - nAx * oA, v[1] - nAy * oA];
      const pb = [v[0] - nBx * oB, v[1] - nBy * oB];
      out.push(pa);
      if (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > 1e-9) out.push(pb);
      continue;
    }
    const hit = lineIntersect(pA, uA, pB, uB);
    const maxO = Math.max(oA, oB, 1e-9);
    const joinLimit = multiWallNodeAt(multiWallNodes, poly[i])?.limit
      ?? MITRE_LIMIT * maxO;
    if (hit) {
      const dist = Math.hypot(hit[0] - poly[i][0], hit[1] - poly[i][1]);
      if (Number.isFinite(dist) && dist <= joinLimit) {
        out.push(hit);
        continue;
      }
    }
    if (oA > 0) out.push([poly[i][0] - nAx * oA, poly[i][1] - nAy * oA]);
    if (oB > 0) out.push([poly[i][0] - nBx * oB, poly[i][1] - nBy * oB]);
  }
  void rev; void revOff;
  return out.length >= 3 ? out : null;
}

/**
 * Paper shapes grown under thick shared walls. Falls back to exact room
 * contours when there is no thickness (byte-compatible with paperRoomShapes).
 */
export function paperRoomShapesWithWalls(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): Array<
  | { path: string }
  | { poly: string }
  | { rect: { x: number; y: number; w: number; h: number; rx: number } }
> {
  if (!walls?.length) return paperRoomShapes(rooms);
  try {
    const exterior = exteriorEnvelopeGeometry(
      rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
    );
    if (exterior) {
      const rawPaper = exterior.shell?.length
        ? union(exterior.centre, exterior.shell)
        : exterior.centre;
      const multiWallNodes = multiWallNodesForGeometry(
        rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
      );
      const paper = rawPaper;
      const path = polyclipToPathD(paper);
      if (path) return [{ path }];
    }
  } catch {
    // Safe fallback below: exact room centrelines never reproduce the known
    // exterior Split spike, even when boolean offsetting rejected bad input.
  }
  return paperRoomShapes(rooms);
}

interface OpeningWallEdge {
  roomId: string;
  a: number[];
  b: number[];
  inward: [number, number];
  cm: number;
  half: number;
  area: number;
  key: string;
}

/**
 * Immutable wall index shared by opening symbols, wall cuts and tunnel fills.
 * Building atomic room profiles is the expensive O(rooms²) part; callers that
 * resolve several openings build this once and reuse it for every opening.
 */
export interface OpeningWallIndex {
  edges: OpeningWallEdge[];
  adjacencyEps: number;
}

export function openingWallIndex(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): OpeningWallIndex {
  const edges: OpeningWallEdge[] = [];
  for (const room of rooms || []) {
    if (!room?.id) continue;
    const pr = roomWallProfile(
      rooms, room.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
    );
    if (!pr) continue;
    const area = Math.abs(polygonArea(pr.poly));
    for (let i = 0; i < pr.poly.length; i++) {
      // A virtual interval has no opening, inner face or physical tunnel.
      if (!pr.kinds[i]) continue;
      const a = pr.poly[i], b = pr.poly[(i + 1) % pr.poly.length];
      edges.push({
        roomId: room.id,
        a, b,
        inward: inwardNormal(pr.poly, i),
        cm: pr.cms[i],
        half: pr.offsets[i],
        area,
        key: keyOf(a, b, pitch, coordScale),
      });
    }
  }
  return { edges, adjacencyEps: openEps(pitch, coordScale) };
}

export interface OpeningWallPiece {
  x0: number;
  x1: number;
  half: number;
  cm: number;
  key: string;
  /** Canonical unit direction of the physical wall, independent of room winding. */
  axis: [number, number];
}

export interface OpeningWallSide {
  roomId: string;
  side: -1 | 1;
  /** First matching room edge in config order. Symbols historically use that
   * order to choose their default face on an inherently ambiguous shared wall;
   * tunnel ownership still uses compareOpeningSides below. */
  order: number;
  pieces: OpeningWallPiece[];
  faceDistance: number;
  area: number;
  coverage: number;
  full: boolean;
}

export interface OpeningWallAssociation {
  negative: OpeningWallSide | null;
  positive: OpeningWallSide | null;
}

function tunnelCoverage(pieces: OpeningWallPiece[], lo: number, hi: number, eps: number): {
  coverage: number; full: boolean;
} {
  const spans = pieces
    .map((p) => [Math.max(lo, p.x0), Math.min(hi, p.x1)] as [number, number])
    .filter((p) => p[1] - p[0] > eps)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!spans.length) return { coverage: 0, full: false };
  let start = spans[0][0], end = spans[0][1], coverage = 0;
  let full = start <= lo + eps;
  for (let i = 1; i < spans.length; i++) {
    const [a, b] = spans[i];
    if (a <= end + eps) {
      end = Math.max(end, b);
      continue;
    }
    coverage += end - start;
    full = false;
    start = a; end = b;
  }
  coverage += end - start;
  full = full && end >= hi - eps;
  return { coverage, full };
}

function compareOpeningSides(a: OpeningWallSide, b: OpeningWallSide): number {
  return Number(b.full) - Number(a.full)
    || a.faceDistance - b.faceDistance
    || a.area - b.area
    || a.roomId.localeCompare(b.roomId);
}

/**
 * Resolve adjacent room sides for one opening against a prebuilt wall index.
 * A candidate must be genuinely collinear/adjacent (4% of one grid pitch), not
 * merely the closest parallel wall within a whole cell. This keeps detached
 * rooms and double-wall air gaps from becoming a phantom second room.
 */
export function resolveOpeningWallAssociation(
  index: OpeningWallIndex,
  opening: { x: number; y: number; angle: number; length: number },
  physicalOnly = false,
): OpeningWallAssociation {
  const x = Number(opening?.x), y = Number(opening?.y);
  const angle = Number(opening?.angle), length = Number(opening?.length);
  if (![x, y, angle, length].every(Number.isFinite) || !(length > 0)) {
    return { negative: null, positive: null };
  }
  const rad = angle * Math.PI / 180;
  const ux = Math.cos(rad), uy = Math.sin(rad);
  const nx = -uy, ny = ux;
  const openingHalf = length / 2;
  const eps = Math.max(1e-9, index.adjacencyEps);
  const candidates = new Map<string, OpeningWallSide>();
  let candidateOrder = 0;

  for (const edge of index.edges) {
    if (physicalOnly && !(edge.half > 0)) continue;
    if (!wallAngleMatches(edge.a, edge.b, angle)) continue;
    const [edgeUx, edgeUy] = wallDir(edge.a, edge.b);
    // Adjacency is perpendicular distance to the wall line. Long legacy
    // openings may have their centre just beyond an endpoint while still
    // overlapping the real span; the projection clip below decides that part.
    const lineDistance = Math.abs((x - edge.a[0]) * edgeUy - (y - edge.a[1]) * edgeUx);
    if (lineDistance > eps) continue;
    const ta = (edge.a[0] - x) * ux + (edge.a[1] - y) * uy;
    const tb = (edge.b[0] - x) * ux + (edge.b[1] - y) * uy;
    const x0 = Math.max(-openingHalf, Math.min(ta, tb));
    const x1 = Math.min(openingHalf, Math.max(ta, tb));
    if (x1 - x0 <= eps) continue;
    const side = (edge.inward[0] * nx + edge.inward[1] * ny >= 0 ? 1 : -1) as -1 | 1;
    // Signed centreline position matters: an edge just across the axis has an
    // inner face closer by that offset, not farther by abs(offset) + half.
    const mx = (edge.a[0] + edge.b[0]) / 2;
    const my = (edge.a[1] + edge.b[1]) / 2;
    const centreY = (mx - x) * nx + (my - y) * ny;
    const faceDistance = Math.abs(centreY + side * edge.half);
    const key = `${side}|${edge.roomId}`;
    const piece: OpeningWallPiece = {
      x0, x1, half: edge.half, cm: edge.cm, key: edge.key, axis: [edgeUx, edgeUy],
    };
    const previous = candidates.get(key);
    if (previous) {
      previous.pieces.push(piece);
      previous.faceDistance = Math.min(previous.faceDistance, faceDistance);
    } else {
      candidates.set(key, {
        roomId: edge.roomId, side, order: candidateOrder++, pieces: [piece], faceDistance,
        area: edge.area, coverage: 0, full: false,
      });
    }
  }

  for (const candidate of candidates.values()) {
    const coverage = tunnelCoverage(candidate.pieces, -openingHalf, openingHalf, eps);
    candidate.coverage = coverage.coverage;
    candidate.full = coverage.full;
  }
  const pick = (side: -1 | 1): OpeningWallSide | null => {
    const list = [...candidates.values()].filter((candidate) => (
      candidate.side === side && candidate.coverage > eps
    ));
    list.sort(compareOpeningSides);
    return list[0] || null;
  };
  return { negative: pick(-1), positive: pick(1) };
}

function centrePiece(side: OpeningWallSide): OpeningWallPiece {
  return [...side.pieces].sort((a, b) => {
    const da = a.x0 <= 0 && a.x1 >= 0 ? 0 : Math.min(Math.abs(a.x0), Math.abs(a.x1));
    const db = b.x0 <= 0 && b.x1 >= 0 ? 0 : Math.min(Math.abs(b.x0), Math.abs(b.x1));
    return da - db || (b.x1 - b.x0) - (a.x1 - a.x0) || a.key.localeCompare(b.key);
  })[0];
}

/**
 * Physical half-depth and direction for an opening. Visible symbol placement
 * is resolved separately and is always centred; flip_v changes only the
 * opening direction (#250).
 */
export function openingInnerFaceOffset(
  rooms: any[],
  opening: { x: number; y: number; angle: number; length: number; flip_v?: boolean },
  walls: WallEntry[] | null | undefined,
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
  openCuts: number[][] = [],
): { ox: number; oy: number; cm: number; side: -1 | 1 } {
  const index = openingWallIndex(rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
  return openingInnerFaceOffsetFromIndex(index, opening);
}

/** Cheap per-opening face resolution against a cached atomic wall index. */
export function openingInnerFaceOffsetFromIndex(
  index: OpeningWallIndex,
  opening: { x: number; y: number; angle: number; length: number; flip_v?: boolean },
): { ox: number; oy: number; cm: number; side: -1 | 1 } {
  const association = resolveOpeningWallAssociation(index, opening);
  const available = [association.negative, association.positive]
    .filter((side): side is OpeningWallSide => !!side);
  if (!available.length) return { ox: 0, oy: 0, cm: 0, side: -1 };
  // An exterior wall keeps its real room-side direction so gates still open
  // outward. A shared wall has no exterior, so use the opening-local negative
  // side instead of the first room in model order.
  const naturalSide = association.negative && association.positive
    ? -1
    : available[0].side;
  const selectedSide = (opening.flip_v ? -naturalSide : naturalSide) as -1 | 1;
  const selected = (selectedSide === -1 ? association.negative : association.positive)
    || available[0];
  const piece = centrePiece(selected);
  if (!(piece.half > 0) || !(piece.cm > 0)) return { ox: 0, oy: 0, cm: 0, side: selectedSide };
  const rad = opening.angle * Math.PI / 180;
  const nx = -Math.sin(rad), ny = Math.cos(rad);
  return {
    ox: nx * selectedSide * piece.half,
    oy: ny * selectedSide * piece.half,
    cm: piece.cm,
    side: selectedSide,
  };
}

/** One half of a room-coloured opening tunnel, in opening-local coordinates. */
export interface OpeningTunnelFace {
  side: -1 | 1;
  roomId: string;
  /** One SVG path containing one contour per disconnected physical span. */
  d: string;
}

/** Pure geometry consumed by the full-card opening-tunnel renderer. */
export interface OpeningTunnelGeometry {
  faces: OpeningTunnelFace[];
  /** Local Y bounds. The wall centreline is always y=0. */
  minY: number;
  maxY: number;
  wallKey: string;
}

/** @internal Exported so the non-overlapping union profile has a direct mutation guard. */
export function tunnelFacePath(side: -1 | 1, pieces: OpeningWallPiece[]): string {
  const eps = 1e-9;
  const valid = pieces.filter((piece) => (
    Number.isFinite(piece.x0) && Number.isFinite(piece.x1)
    && Number.isFinite(piece.half) && piece.x1 > piece.x0 && piece.half > 0
  ));
  if (!valid.length) return '';

  // Turn overlapping atomic wall intervals into a non-overlapping depth
  // profile. A profile slab uses the deepest physical body covering that X;
  // this is the exact union of all candidate rectangles and never extends an
  // opening past either jamb.
  const rawBreaks = valid.flatMap((piece) => [piece.x0, piece.x1]).sort((a, b) => a - b);
  const breaks: number[] = [];
  for (const value of rawBreaks) {
    const tail = breaks[breaks.length - 1];
    if (tail === undefined || value > tail + eps) breaks.push(value);
  }
  const profile: Array<{ x0: number; x1: number; half: number }> = [];
  for (let i = 0; i + 1 < breaks.length; i++) {
    const x0 = breaks[i], x1 = breaks[i + 1];
    if (!(x1 > x0 + eps)) continue;
    const mid = (x0 + x1) / 2;
    const half = valid.reduce((depth, piece) => (
      mid >= piece.x0 - eps && mid <= piece.x1 + eps ? Math.max(depth, piece.half) : depth
    ), 0);
    if (!(half > 0)) continue;
    const tail = profile[profile.length - 1];
    if (tail && x0 <= tail.x1 + eps && Math.abs(half - tail.half) <= eps) {
      tail.x1 = x1;
    } else {
      profile.push({ x0, x1, half });
    }
  }

  // Build one simple outline for every connected span. Thickness changes are
  // vertices on its outer envelope, not shared edges between translucent SVG
  // rectangles, so neither antialiasing seams nor double-alpha bands exist.
  const components: Array<Array<{ x0: number; x1: number; half: number }>> = [];
  for (const slab of profile) {
    const component = components[components.length - 1];
    const tail = component?.[component.length - 1];
    if (tail && slab.x0 <= tail.x1 + eps) {
      slab.x0 = tail.x1;
      component.push(slab);
    } else {
      components.push([slab]);
    }
  }

  return components.map((component) => {
    const first = component[0], last = component[component.length - 1];
    // Both half-faces are subpaths of one nonzero-filled path. Give them a
    // real device-pixel overlap at ordinary wall depths: a 0.1 px overlap was
    // still rasterised as a faint centre seam by Chromium. Because winding is
    // identical this remains one alpha application, not a double-fill band.
    const seam = Math.min(Math.min(...component.map((slab) => slab.half)) * 0.25, 0.75);
    const axisY = -side * seam;
    const commands: string[] = [];
    if (side === 1) {
      commands.push(`M ${first.x0} ${axisY} L ${last.x1} ${axisY}`);
      for (let i = component.length - 1; i >= 0; i--) {
        const slab = component[i];
        commands.push(`L ${slab.x1} ${slab.half} L ${slab.x0} ${slab.half}`);
      }
    } else {
      // Keep the same winding direction as the positive face. The two faces
      // overlap only around y=0; matching winding makes that overlap solid
      // under the nonzero fill rule instead of cancelling into a hairline.
      commands.push(`M ${last.x1} ${axisY} L ${first.x0} ${axisY}`);
      for (const slab of component)
        commands.push(`L ${slab.x0} ${-slab.half} L ${slab.x1} ${-slab.half}`);
    }
    commands.push('Z');
    return commands.join(' ');
  }).join(' ');
}

type TunnelOccupancy = Map<string, Array<[number, number]>>;

function reserveTunnelPieces(
  opening: { x: number; y: number; angle: number },
  side: -1 | 1,
  pieces: OpeningWallPiece[],
  occupied?: TunnelOccupancy,
): OpeningWallPiece[] {
  if (!occupied) return pieces;
  const openingRad = opening.angle * Math.PI / 180;
  const openingUx = Math.cos(openingRad), openingUy = Math.sin(openingRad);
  const out: OpeningWallPiece[] = [];
  const eps = 1e-9;

  for (const piece of pieces) {
    const [ux, uy] = piece.axis;
    const direction = openingUx * ux + openingUy * uy;
    if (Math.abs(direction) <= eps) continue;
    const centre = opening.x * ux + opening.y * uy;
    const g0 = centre + direction * piece.x0;
    const g1 = centre + direction * piece.x1;
    const lo = Math.min(g0, g1), hi = Math.max(g0, g1);
    const occupancyKey = `${piece.key}|${side}`;
    const previous = occupied.get(occupancyKey) || [];
    let fragments: Array<[number, number]> = [[lo, hi]];
    for (const [usedLo, usedHi] of previous) {
      const next: Array<[number, number]> = [];
      for (const [a, b] of fragments) {
        if (usedHi <= a + eps || usedLo >= b - eps) next.push([a, b]);
        else {
          if (usedLo > a + eps) next.push([a, Math.min(b, usedLo)]);
          if (usedHi < b - eps) next.push([Math.max(a, usedHi), b]);
        }
      }
      fragments = next;
      if (!fragments.length) break;
    }
    for (const [a, b] of fragments) {
      const lx0 = (a - centre) / direction;
      const lx1 = (b - centre) / direction;
      out.push({ ...piece, x0: Math.min(lx0, lx1), x1: Math.max(lx0, lx1) });
    }
    const merged = [...previous, [lo, hi] as [number, number]]
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const compact: Array<[number, number]> = [];
    for (const span of merged) {
      const tail = compact[compact.length - 1];
      if (tail && span[0] <= tail[1] + eps) tail[1] = Math.max(tail[1], span[1]);
      else compact.push([span[0], span[1]]);
    }
    occupied.set(occupancyKey, compact);
  }
  return out;
}

function openingTunnelGeometryFromIndex(
  index: OpeningWallIndex,
  opening: { x: number; y: number; angle: number; length: number },
  occupied?: TunnelOccupancy,
): OpeningTunnelGeometry | null {
  const association = resolveOpeningWallAssociation(index, opening, true);
  const negative = association.negative, positive = association.positive;
  if (!negative && !positive) return null;

  let chosen: Array<{ candidate: OpeningWallSide; side: -1 | 1 }>;
  if (negative && positive) {
    chosen = [{ candidate: negative, side: -1 }, { candidate: positive, side: 1 }];
  } else {
    const only = (negative || positive)!;
    chosen = [{ candidate: only, side: -1 }, { candidate: only, side: 1 }];
  }
  const renderedPieces = chosen.map(({ candidate, side }) => ({
    candidate,
    side,
    pieces: reserveTunnelPieces(opening, side, candidate.pieces, occupied),
  }));
  const faces = renderedPieces.map(({ candidate, side, pieces }) => ({
    side, roomId: candidate.roomId, d: tunnelFacePath(side, pieces),
  }));
  const allPieces = renderedPieces.flatMap(({ pieces }) => pieces);
  if (!allPieces.length) return null;
  const maxHalf = Math.max(...allPieces.map((piece) => piece.half));
  const wallKey = [...new Set(allPieces.map((piece) => piece.key))].sort().join('|');
  return { faces, minY: -maxHalf, maxY: maxHalf, wallKey };
}

/**
 * Resolve the physical tunnel and its adjacent rooms without reading card or
 * HA state. The opening-local X axis follows `angle`; local y=0 is the wall
 * centreline. Atomic room-wall profiles provide exact mixed-thickness clips,
 * so a legacy opening near a breakpoint cannot paint beyond the real body.
 *
 * A single adjacent room (outer wall) owns both halves. Two adjacent rooms own
 * one half each. Draft walls, virtual spans and zero-thickness intervals never
 * produce a face because they have no eligible room-wall interval.
 */
export function openingTunnelGeometry(
  rooms: any[],
  opening: { x: number; y: number; angle: number; length: number },
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): OpeningTunnelGeometry | null {
  if (![pitch, cellCm, gridPitch, coordScale].every(Number.isFinite)
      || !(pitch > 0) || !(cellCm > 0) || !(gridPitch > 0) || !(coordScale > 0)
      || !walls?.length) return null;
  const index = openingWallIndex(
    rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
  );
  return openingTunnelGeometryFromIndex(index, opening);
}

/** Resolve every opening while paying the atomic room-profile cost once. */
export function openingTunnelGeometries(
  rooms: any[],
  openings: Array<{ x: number; y: number; angle: number; length: number }>,
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): Array<OpeningTunnelGeometry | null> {
  if (![pitch, cellCm, gridPitch, coordScale].every(Number.isFinite)
      || !(pitch > 0) || !(cellCm > 0) || !(gridPitch > 0) || !(coordScale > 0)
      || !walls?.length) return openings.map(() => null);
  const index = openingWallIndex(
    rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
  );
  return openingTunnelGeometriesFromIndex(index, openings);
}

/** Cheap batch resolution against a cached atomic wall index. */
export function openingTunnelGeometriesFromIndex(
  index: OpeningWallIndex,
  openings: Array<{ x: number; y: number; angle: number; length: number }>,
): Array<OpeningTunnelGeometry | null> {
  const occupied: TunnelOccupancy = new Map();
  return openings.map((opening) => openingTunnelGeometryFromIndex(index, opening, occupied));
}
