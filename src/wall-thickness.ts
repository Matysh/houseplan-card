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
/** Below this screen depth the diagonal hatch becomes visual noise. */
export const WALL_HATCH_MIN_PX = 3;

/** Mitre spikes longer than this × thickness fall back to a bevel. */
export const MITRE_LIMIT = 4;

// ------------------------------- units --------------------------------------

/** Shared full/static render policy for the thin-on-screen fallback. */
export function wallBodyNeedsSolid(depthUnits: number, pxPerUnit: number): boolean {
  return Number.isFinite(depthUnits) && depthUnits > 0
    && Number.isFinite(pxPerUnit) && pxPerUnit > 0
    && depthUnits * pxPerUnit < WALL_HATCH_MIN_PX;
}

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
  // tolerant fallback: same direction bucket, midpoint within half pitch (norm)
  const scale = coordScale > 0 ? coordScale : 1;
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
  return e && e.cm > 0 ? clampWallCm(e.cm) : 0;
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
  for (const room of list) {
    if (!room?.id) continue;
    const at = atomicPolyForRoom(list, room.id, openCuts, pitch, coordScale);
    if (!at) continue;
    for (let i = 0; i < at.poly.length; i++) {
      live.add(keyOf(at.poly[i], at.poly[(i + 1) % at.poly.length], pitch, coordScale));
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
 *
 * A stored key may name either the whole polygon edge or one atomic remainder
 * left by a partial shared/open stretch. The latter has a different midpoint,
 * so an exact whole-edge key map is insufficient: project every unmatched key
 * onto the old edge and carry that relative point onto the new one.
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
  const scale = coordScale > 0 ? coordScale : 1;
  const tol = Math.max(pitch * 0.5, 1e-9) * scale;
  const used = new Set<string>();
  const out: WallEntry[] = [];
  for (const w of walls) {
    let nk = map.get(w.key) || '';
    if (!nk) {
      const parsed = parseKeys([w], scale)[0];
      if (parsed) {
        for (let i = 0; i < oldSpans.length; i++) {
          const [oa, ob] = oldSpans[i];
          const [na, nb] = newSpans[i];
          if (!angleClose(parsed.ang, segAngle(oa, ob))) continue;
          const dx = ob[0] - oa[0], dy = ob[1] - oa[1];
          const L2 = dx * dx + dy * dy;
          if (L2 < 1e-18) continue;
          const t = ((parsed.x - oa[0]) * dx + (parsed.y - oa[1]) * dy) / L2;
          if (t < -1e-6 || t > 1 + 1e-6) continue;
          if (distToSeg(parsed.x, parsed.y, oa[0], oa[1], ob[0], ob[1]) > tol) continue;
          const mx = na[0] + (nb[0] - na[0]) * Math.max(0, Math.min(1, t));
          const my = na[1] + (nb[1] - na[1]) * Math.max(0, Math.min(1, t));
          const [ux, uy] = wallDir(na, nb);
          const arm = Math.max(pitch * scale, 1e-6);
          nk = keyOf(
            [mx - ux * arm, my - uy * arm],
            [mx + ux * arm, my + uy * arm],
            pitch, scale,
          );
          break;
        }
      }
    }
    if (!nk) nk = w.key;
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
 * Every atomic stretch of one room that may carry a thickness (open ones are
 * excluded). The unit of a wall is the interval, not the polygon edge.
 */
export function solidIntervalsForRoom(
  rooms: any[],
  roomId: string,
  openCuts: number[][],
  pitch: number,
  coordScale = 1,
): Array<{ a: number[]; b: number[] }> {
  const at = atomicPolyForRoom(rooms, roomId, openCuts, pitch, coordScale);
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
  for (const iv of solidIntervalsForRoom(rooms, roomId, openCuts, pitch, coordScale)) {
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
  const at = atomicPolyForRoom(rooms, roomId, openCuts, pitch, coordScale);
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
    let best: { cm: number; d: number } | null = null;
    for (const e of parsed) {
      if (claimed.has(e.w.key)) continue;
      if (!angleClose(e.ang, ang)) continue;
      if (distToSeg(e.x, e.y, a[0], a[1], b[0], b[1]) > tol) continue;
      const d = Math.hypot(e.x - mx, e.y - my);
      if (!best || d < best.d) best = { cm: clampWallCm(e.w.cm), d };
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
  const at = atomicPolyForRoom(rooms, roomId, openCuts, pitch, coordScale);
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
 * Rewrite `walls` so every entry names the smallest necessary interval of the
 * CURRENT geometry, and no entry survives under an open span. Atomic entries
 * are compacted back to the original polygon edge when all of its children
 * are solid and have the same thickness.
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
  const atomic: WallInterval[] = [];
  const atomicKeys = new Set<string>();
  for (const iv of wallIntervals(rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale)) {
    if (iv.open || !(iv.cm > 0) || atomicKeys.has(iv.key)) continue;
    atomicKeys.add(iv.key);
    atomic.push(iv);
  }

  // A partial shared boundary or a former open span may have split one
  // original edge into several storage keys. Once every child is solid and
  // carries the same cm value, the parent key is the canonical representation
  // again. Prefer the longest valid parent first so a room whose edge contains
  // a shorter neighbour edge also removes that redundant shorter key.
  const parents: Array<{ a: number[]; b: number[]; key: string; cm: number; len: number }> = [];
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
      const cm = pr.cms[children[0]];
      if (!(cm > 0) || children.some((i) => pr.kinds[i] === null || pr.cms[i] !== cm)) continue;
      const a = pr.orig[pi], b = pr.orig[(pi + 1) % pr.orig.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len <= 0) continue;
      parents.push({
        a: [a[0], a[1]], b: [b[0], b[1]],
        key: keyOf(a, b, pitch, coordScale), cm, len,
      });
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
      angleClose(segAngle(iv.a, iv.b), segAngle(parent.a, parent.b)) &&
      distToSeg(iv.a[0], iv.a[1], parent.a[0], parent.a[1], parent.b[0], parent.b[1]) <= tol &&
      distToSeg(iv.b[0], iv.b[1], parent.a[0], parent.a[1], parent.b[0], parent.b[1]) <= tol
    ));
    if (!matches.length) continue;
    for (const iv of matches) covered.add(iv.key);
    if (seen.has(parent.key)) continue;
    seen.add(parent.key);
    out.push({ key: parent.key, cm: parent.cm });
  }
  for (const iv of atomic) {
    if (covered.has(iv.key) || seen.has(iv.key)) continue;
    seen.add(iv.key);
    out.push({ key: iv.key, cm: iv.cm });
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
  const pr = roomWallProfile(rooms, roomId, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
  if (!pr || !pr.offsets.some((o) => o > 0)) return poly.map((p) => [p[0], p[1]]);
  return insetContour(pr.poly, pr.offsets) || poly.map((p) => [p[0], p[1]]);
}

function closedRing(poly: number[][]): number[][][] {
  const ring = poly.map((p) => [p[0], p[1]]);
  ring.push([poly[0][0], poly[0][1]]);
  return [ring];
}

function polyclipToPathD(geom: any): string {
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
function virtualJunctionPatches(
  rooms: any[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale: number,
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
        if (Math.hypot(far[0] - v[0], far[1] - v[1]) > MITRE_LIMIT * maxHalf) continue;
        out.push(cross > 0 ? [v.slice(), pa, far, pb] : [v.slice(), pb, far, pa]);
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
  for (const room of rooms || []) {
    if (!room?.id) continue;
    const pr = roomWallProfile(rooms, room.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
    if (!pr || pr.poly.length < 3 || !pr.offsets.some((o) => o > 0)) continue;
    const outset = outsetContour(pr.poly, pr.offsets);
    const inset = insetContour(pr.poly, pr.offsets);
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
    if (!room?.id) continue;
    const pr = roomWallProfile(rooms, room.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
    if (!pr || pr.poly.length < 3 || !pr.offsets.some((o) => o > 0)) continue;
    for (const o of pr.offsets) if (o > 0) maxDepth = Math.max(maxDepth, o * 2);
    const outC = outsetContour(pr.poly, pr.offsets);
    const inC = insetContour(pr.poly, pr.offsets);
    if (outC) outsets.push(outC);
    if (inC) insets.push(inC);
  }
  if (!outsets.length) return null;
  const junctions = virtualJunctionPatches(
    rooms, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
  );
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
    // The room-ring subtraction above cannot infer a mitre between real arms
    // owned by different contours at a virtual T. Add only those missing
    // junction pieces, then let physical openings cut through them as usual.
    for (const patch of junctions) body = union(body, closedRing(patch) as any);
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
      const pr = roomWallProfile(rooms, r.id, walls, openCuts, pitch, cellCm, gridPitch, coordScale);
      const grown = pr && pr.offsets.some((o) => o > 0)
        ? outsetContour(pr.poly, pr.offsets)
        : null;
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
