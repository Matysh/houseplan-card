/**
 * Wall thickness — pure geometry (docs/WALL-THICKNESS.md).
 *
 * Thickness is a rendering layer keyed by a segment identity that survives
 * resize. Wall bodies grow ±½ from the centreline; fills, glow, sun and
 * displayed m² use the inner (inset) contour. Wall-length rulers stay on the
 * centreline.
 */
import { union, difference } from 'polyclip-ts';
import { roomPoly, roomEdges, sharedBoundary } from './logic';

export interface WallEntry {
  key: string;
  cm: number;
}

export const WALL_MIN_CM = 1;
export const WALL_MAX_CM = 100;
/** Default thickness offered in the Draw toolbar (docs/WALL-THICKNESS.md §6). */
export const DRAW_WALL_DEFAULT_CM = 15;

/** Mitre spikes longer than this × thickness fall back to a bevel. */
export const MITRE_LIMIT = 4;

// ------------------------------- units --------------------------------------

export function clampWallCm(cm: number): number {
  if (!Number.isFinite(cm)) return WALL_MIN_CM;
  return Math.max(WALL_MIN_CM, Math.min(WALL_MAX_CM, cm));
}

/** Config cm → the thickness field (cm, or inches when HA is imperial). */
export function cmToField(cm: number, imperial: boolean): string {
  if (!Number.isFinite(cm) || cm <= 0) return '';
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
  const c = Number(cellCm) > 0 ? Number(cellCm) : 5;
  return (clampWallCm(cm) / c) * gridPitch;
}

// ------------------------------- segment key --------------------------------

function q(v: number, pitch: number): number {
  if (!(pitch > 0) || !Number.isFinite(v)) return v;
  return Math.round(v / pitch) * pitch;
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
  const mx = q((a[0] + b[0]) / 2, pitch);
  const my = q((a[1] + b[1]) / 2, pitch);
  const [dx, dy] = wallDir(a, b);
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

/** Match within half a grid step on the midpoint (direction must agree). */
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
  // tolerant fallback: same direction bucket, midpoint within half pitch (norm)
  const mx = ((a[0] + b[0]) / 2) / coordScale, my = ((a[1] + b[1]) / 2) / coordScale;
  const [dx, dy] = wallDir(
    [a[0] / coordScale, a[1] / coordScale],
    [b[0] / coordScale, b[1] / coordScale],
  );
  let ang = Math.atan2(dy, dx);
  if (ang < 0) ang += Math.PI;
  const tol = Math.max(pitch * 0.5, 1e-9);
  const scale = coordScale > 0 ? coordScale : 1;
  let best: { w: WallEntry; d: number } | null = null;
  for (const w of walls) {
    const at = w.key.lastIndexOf('@');
    if (at < 0) continue;
    const [sx, sy] = w.key.slice(0, at).split(',').map(Number);
    const aq = Number(w.key.slice(at + 1));
    if (![sx, sy, aq].every(Number.isFinite)) continue;
    let dAng = Math.abs(aq - ang);
    if (dAng > Math.PI / 2) dAng = Math.PI - dAng;
    if (dAng >= 0.02) continue; // ~1°
    const midDist = Math.hypot(sx - mx, sy - my);
    if (midDist <= tol) return w;
    // atomic shared span: wall mid lies on this edge (partial overlap)
    const dist = distToSeg(sx * scale, sy * scale, a[0], a[1], b[0], b[1]);
    if (dist <= tol * scale) {
      if (!best || midDist < best.d) best = { w, d: midDist };
    }
  }
  return best?.w || null;
}

export function thicknessCmAt(
  walls: WallEntry[] | null | undefined,
  a: number[], b: number[],
  pitch: number,
  coordScale = 1,
): number {
  const e = lookupWall(walls, a, b, pitch, coordScale);
  return e && e.cm > 0 ? clampWallCm(e.cm) : 0;
}

/** Drop entries whose key matches no current room edge or shared atomic span. */
export function degradeWalls(
  walls: WallEntry[] | null | undefined,
  rooms: any[],
  pitch: number,
  coordScale = 1,
): WallEntry[] {
  if (!walls?.length) return [];
  const live = new Set<string>();
  for (const seg of roomEdges(rooms)) {
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
  return walls.filter((w) => live.has(w.key) && w.cm >= WALL_MIN_CM && w.cm <= WALL_MAX_CM);
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
 */
export function rekeyWallsAfterMove(
  walls: WallEntry[] | null | undefined,
  oldSpans: [number[], number[]][],
  newSpans: [number[], number[]][],
  pitch: number,
  coordScale = 1,
): WallEntry[] {
  if (!walls?.length) return [];
  if (oldSpans.length !== newSpans.length) return walls.slice();
  const map = new Map<string, string>();
  for (let i = 0; i < oldSpans.length; i++) {
    const [oa, ob] = oldSpans[i];
    const [na, nb] = newSpans[i];
    const ok = keyOf(oa, ob, pitch, coordScale);
    const nk = keyOf(na, nb, pitch, coordScale);
    if (ok !== nk) map.set(ok, nk);
  }
  if (!map.size) return walls.slice();
  const used = new Set<string>();
  const out: WallEntry[] = [];
  for (const w of walls) {
    const nk = map.get(w.key) || w.key;
    if (used.has(nk)) continue;
    used.add(nk);
    out.push({ key: nk, cm: w.cm });
  }
  return out;
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
  return [...base, { key, cm: clampWallCm(cm) }];
}

/**
 * Apply one thickness to every edge of a room that is allowed to carry one
 * (skips open-boundary stretches listed in `openCuts` as [x1,y1,x2,y2]).
 */
export function setWallThicknessForRoom(
  walls: WallEntry[] | null | undefined,
  room: any,
  cm: number | null,
  pitch: number,
  openCuts: number[][] = [],
  coordScale = 1,
): WallEntry[] {
  const poly = roomPoly(room);
  if (!poly || poly.length < 3) return walls ? walls.slice() : [];
  let out = walls ? walls.slice() : [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (edgeIsOpen(a, b, openCuts, pitch, coordScale)) continue;
    out = setWallThickness(out, a, b, cm, pitch, coordScale);
  }
  return out;
}

/**
 * After drawing a new room: set session thickness on edges that do not yet
 * have one. Shared stretches that already carry a neighbour's cm are left
 * alone (docs/WALL-THICKNESS.md — one physical wall, one thickness).
 */
export function applyWallThicknessToNewRoom(
  walls: WallEntry[] | null | undefined,
  room: any,
  cm: number | null,
  pitch: number,
  openCuts: number[][] = [],
  coordScale = 1,
): WallEntry[] {
  if (cm == null || cm < WALL_MIN_CM) return walls ? walls.slice() : [];
  const poly = roomPoly(room);
  if (!poly || poly.length < 3) return walls ? walls.slice() : [];
  let out = walls ? walls.slice() : [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (edgeIsOpen(a, b, openCuts, pitch, coordScale)) continue;
    if (thicknessCmAt(out, a, b, pitch, coordScale) > 0) continue;
    out = setWallThickness(out, a, b, cm, pitch, coordScale);
  }
  return out;
}

/**
 * SVG path for the thick-wall preview while drawing a room outline.
 * Closed contours use outset−inset; open polylines use per-segment quads.
 */
export function drawWallPreviewD(
  pts: number[][],
  halfDepth: number,
  closed: boolean,
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
      const offs = poly.map(() => halfDepth);
      const outset = outsetContour(poly, offs);
      const inset = insetContour(poly, offs);
      if (outset && inset) {
        return `${polyToPath(outset)} ${polyToPath(reversePoly(inset))}`;
      }
    }
  }
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-9) continue;
    const ux = dx / L, uy = dy / L;
    const nx = -uy, ny = ux;
    const h = halfDepth;
    const quad = [
      [a[0] + nx * h, a[1] + ny * h],
      [b[0] + nx * h, b[1] + ny * h],
      [b[0] - nx * h, b[1] - ny * h],
      [a[0] - nx * h, a[1] - ny * h],
    ];
    d += (d ? ' ' : '') + polyToPath(quad);
  }
  return d;
}

function edgeIsOpen(a: number[], b: number[], cuts: number[][], pitch: number, coordScale = 1): boolean {
  if (!cuts.length) return false;
  const key = keyOf(a, b, pitch, coordScale);
  for (const c of cuts) {
    if (keyOf([c[0], c[1]], [c[2], c[3]], pitch, coordScale) === key) return true;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const cx = (c[0] + c[2]) / 2, cy = (c[1] + c[3]) / 2;
    if (Math.hypot(mx - cx, my - cy) < pitch * coordScale) {
      const [dx, dy] = wallDir(a, b);
      const [ex, ey] = wallDir([c[0], c[1]], [c[2], c[3]]);
      if (Math.abs(dx * ey - dy * ex) < 0.05) return true;
    }
  }
  return false;
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
 * Inset a polygon by a per-edge inward distance (same units as poly).
 * Zero-offset edges stay on the original. Mitre joins; bevel when the mitre
 * would spike longer than MITRE_LIMIT × max(adjacent offsets).
 */
export function insetContour(poly: number[][], offsets: number[]): number[][] | null {
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

    const hit = lineIntersect(pA, uA, pB, uB);
    const maxO = Math.max(oA, oB, 1e-9);
    if (hit) {
      const dist = Math.hypot(hit[0] - poly[i][0], hit[1] - poly[i][1]);
      if (dist <= MITRE_LIMIT * maxO) {
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

/**
 * Classify each edge of a room: shared with a neighbour, or outer.
 * Open-boundary stretches are reported as kind null (no thickness allowed).
 */
export function edgeKinds(
  rooms: any[],
  roomId: string,
  openCuts: number[][],
  pitch: number,
  coordScale = 1,
): Array<WallKind | null> {
  const room = (rooms || []).find((r) => r?.id === roomId);
  const poly = roomPoly(room);
  if (!poly) return [];
  const kinds: Array<WallKind | null> = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (edgeIsOpen(a, b, openCuts, pitch, coordScale)) {
      kinds.push(null);
      continue;
    }
    let shared = false;
    const myKey = keyOf(a, b, pitch, coordScale);
    for (const other of rooms || []) {
      if (other?.id === roomId) continue;
      const op = roomPoly(other);
      if (!op) continue;
      for (let j = 0; j < op.length; j++) {
        const c = op[j], d = op[(j + 1) % op.length];
        if (keyOf(c, d, pitch, coordScale) === myKey) {
          shared = true;
          break;
        }
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const dist = distToSeg(mx, my, c[0], c[1], d[0], d[1]);
        if (dist <= pitch * coordScale * 0.5) {
          const [dx, dy] = wallDir(a, b);
          const [ex, ey] = wallDir(c, d);
          if (Math.abs(dx * ey - dy * ex) < 0.08) { shared = true; break; }
        }
      }
      if (shared) break;
    }
    kinds.push(shared ? 'shared' : 'outer');
  }
  return kinds;
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
  const room = (rooms || []).find((r) => r?.id === roomId);
  const poly = roomPoly(room);
  if (!poly) return [];
  const kinds = edgeKinds(rooms, roomId, openCuts, pitch, coordScale);
  const out: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const kind = kinds[i];
    if (!kind) { out.push(0); continue; }
    const cm = thicknessCmAt(walls, a, b, pitch, coordScale);
    if (!(cm > 0)) { out.push(0); continue; }
    out.push(wallCmToUnits(cm, cellCm, gridPitch) / 2);
  }
  return out;
}

/** Alias — half offsets drive both inset and outset. */
export const halfOffsetsForRoom = insetOffsetsForRoom;

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
): number[][] | null {
  const room = (rooms || []).find((r) => r?.id === roomId);
  const poly = roomPoly(room);
  if (!poly || poly.length < 3) return null;
  if (!walls?.length) return poly.map((p) => [p[0], p[1]]);
  const offsets = insetOffsetsForRoom(
    rooms, roomId, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
  );
  if (!offsets.some((o) => o > 0)) return poly.map((p) => [p[0], p[1]]);
  return insetContour(poly, offsets) || poly.map((p) => [p[0], p[1]]);
}

function closedRing(poly: number[][]): number[][][] {
  const ring = poly.map((p) => [p[0], p[1]]);
  ring.push([poly[0][0], poly[0][1]]);
  return [ring];
}

function polyclipToPathD(geom: any): string {
  if (!geom) return '';
  let d = '';
  for (const poly of geom as any[]) {
    const ring = poly?.[0];
    if (!Array.isArray(ring) || ring.length < 4) continue;
    const pts = ring.slice(0, ring.length - 1);
    if (pts.length < 3) continue;
    d += (d ? ' ' : '') + polyToPath(pts.map((p: number[]) => [p[0], p[1]]));
  }
  return d;
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
  for (const room of rooms || []) {
    const poly = roomPoly(room);
    if (!poly || poly.length < 3) continue;
    const offsets = insetOffsetsForRoom(rooms, room.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
    if (!offsets.some((o) => o > 0)) continue;
    const outset = outsetContour(poly, offsets);
    const inset = insetContour(poly, offsets);
    if (!outset || !inset) continue;
    const d = `${polyToPath(outset)} ${polyToPath(reversePoly(inset))}`;
    let key = '';
    let kind: WallKind = 'outer';
    let cm = 0;
    let depth = 0;
    const kinds = edgeKinds(rooms, room.id, openCuts, pitch, coordScale);
    for (let i = 0; i < poly.length; i++) {
      if (!(offsets[i] > 0)) continue;
      const a = poly[i], b = poly[(i + 1) % poly.length];
      key = keyOf(a, b, pitch, coordScale);
      kind = kinds[i] || 'outer';
      cm = thicknessCmAt(walls, a, b, pitch, coordScale);
      depth = wallCmToUnits(cm, cellCm, gridPitch);
      break;
    }
    out.push({ d, key, kind, cm, depthUnits: depth });
  }
  return out;
}

/**
 * Seamless wall hatch: union of all half-outsets minus union of all half-insets,
 * with opening slots cut as holes. One continuous body across L and T joins.
 */
export function wallBodiesUnionPath(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  openings: Array<{ x: number; y: number; angle: number; length: number }> = [],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): { d: string; depthUnits: number } | null {
  if (!walls?.length) return null;
  const outsets: number[][][] = [];
  const insets: number[][][] = [];
  let maxDepth = 0;
  for (const room of rooms || []) {
    const poly = roomPoly(room);
    if (!poly || poly.length < 3) continue;
    const offsets = insetOffsetsForRoom(
      rooms, room.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
    );
    if (!offsets.some((o) => o > 0)) continue;
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] > 0) maxDepth = Math.max(maxDepth, offsets[i] * 2);
    }
    const outC = outsetContour(poly, offsets);
    const inC = insetContour(poly, offsets);
    if (outC) outsets.push(outC);
    if (inC) insets.push(inC);
  }
  if (!outsets.length) return null;
  try {
    let Uout: any = closedRing(outsets[0]);
    for (let i = 1; i < outsets.length; i++) {
      Uout = union(Uout, closedRing(outsets[i]) as any);
    }
    let body: any = Uout;
    if (insets.length) {
      let Uin: any = closedRing(insets[0]);
      for (let i = 1; i < insets.length; i++) {
        Uin = union(Uin, closedRing(insets[i]) as any);
      }
      body = difference(Uout, Uin);
    }
    // cut opening tunnels (axis-aligned to opening angle)
    for (const o of openings) {
      if (!(o.length > 0)) continue;
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
      body = difference(body, closedRing(slot) as any);
    }
    const d = polyclipToPathD(body);
    if (!d) return null;
    return { d, depthUnits: maxDepth };
  } catch {
    // fall back to evenodd rings concatenated
    const rings = wallBodyRings(rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
    if (!rings.length) return null;
    return { d: rings.map((r) => r.d).join(' '), depthUnits: maxDepth };
  }
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
    const poly = roomPoly(room);
    if (!poly) continue;
    const kinds = edgeKinds(rooms, room.id, openCuts, pitch, coordScale);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const kind = kinds[i];
      if (!kind) continue;
      const cm = thicknessCmAt(walls, a, b, pitch, coordScale);
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
  const room = (rooms || []).find((r) => r?.id === roomId);
  const poly = roomPoly(room);
  if (!poly) return [];
  const kinds = edgeKinds(rooms, roomId, openCuts, pitch, coordScale);
  const out: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const kind = kinds[i];
    if (!kind) { out.push(0); continue; }
    const cm = thicknessCmAt(walls, a, b, pitch, coordScale);
    if (!(cm > 0)) { out.push(0); continue; }
    out.push(wallCmToUnits(cm, cellCm, gridPitch) / 2);
  }
  return out;
}

/**
 * Expand a polygon outward by per-edge offsets (mirror of inset with flipped
 * normals). Used for paper under shared thick walls.
 */
export function outsetContour(poly: number[][], offsets: number[]): number[][] | null {
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
    const hit = lineIntersect(pA, uA, pB, uB);
    const maxO = Math.max(oA, oB, 1e-9);
    if (hit) {
      const dist = Math.hypot(hit[0] - poly[i][0], hit[1] - poly[i][1]);
      if (dist <= MITRE_LIMIT * maxO) {
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
): Array<{ poly: string } | { rect: { x: number; y: number; w: number; h: number; rx: number } }> {
  const out: Array<{ poly: string } | { rect: { x: number; y: number; w: number; h: number; rx: number } }> = [];
  for (const r of rooms || []) {
    const poly = roomPoly(r);
    if (poly && poly.length >= 3) {
      const offs = paperOutwardOffsets(rooms, r.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
      const grown = offs.some((o) => o > 0) ? outsetContour(poly, offs) : null;
      const use = grown || poly;
      out.push({ poly: use.map((p) => p.join(',')).join(' ') });
    } else if (r && r.x != null && r.y != null && r.w != null && r.h != null) {
      out.push({ rect: { x: r.x, y: r.y, w: r.w, h: r.h, rx: Math.min(r.w, r.h) * 0.03 } });
    }
  }
  return out;
}

/**
 * Half-depth from the centreline toward the door's inner face (the room the
 * leaf swings into). Association prefers a wall whose direction matches the
 * opening angle (T-junctions must not bind to the perpendicular receiver).
 */
export function openingInnerFaceOffset(
  rooms: any[],
  opening: { x: number; y: number; angle: number; length: number; flip_v?: boolean },
  walls: WallEntry[] | null | undefined,
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): { ox: number; oy: number; cm: number } {
  let best: { a: number[]; b: number[]; room: any; edge: number; dist: number; angled: boolean } | null = null;
  for (const room of rooms || []) {
    const poly = roomPoly(room);
    if (!poly) continue;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const d = distToSeg(opening.x, opening.y, a[0], a[1], b[0], b[1]);
      const angled = wallAngleMatches(a, b, opening.angle);
      if (!best) {
        best = { a, b, room, edge: i, dist: d, angled };
        continue;
      }
      // prefer angle-matching edges; among equals, nearer centreline
      if (angled && !best.angled) {
        best = { a, b, room, edge: i, dist: d, angled };
      } else if (angled === best.angled && d < best.dist) {
        best = { a, b, room, edge: i, dist: d, angled };
      }
    }
  }
  if (!best || best.dist > pitch * coordScale) return { ox: 0, oy: 0, cm: 0 };
  const cm = thicknessCmAt(walls, best.a, best.b, pitch, coordScale);
  if (!(cm > 0)) return { ox: 0, oy: 0, cm: 0 };
  const depth = wallCmToUnits(cm, cellCm, gridPitch);
  const poly = roomPoly(best.room)!;
  const [inx, iny] = inwardNormal(poly, best.edge);
  const s = opening.flip_v ? -1 : 1;
  // ±½ growth: the inner face is always half-depth from the centreline
  const along = depth / 2;
  return { ox: inx * along * s, oy: iny * along * s, cm };
}
