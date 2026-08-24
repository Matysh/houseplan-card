/**
 * Room resize geometry — pure functions only (docs/RESIZE.md).
 *
 * The production path is the fixed-topology safe resolver/apply/validate
 * pipeline: one horizontal or vertical wall moves along its normal, with at
 * most one exact endpoint-matched neighbour. Historical permissive helpers
 * remain below only for migration regression tests; the card does not import
 * their vertex-insertion or whole-room-scale paths.
 *
 * All coordinates are render units (NORM_W-scaled), same as the card's
 * space model. Nothing here touches Lit or the DOM.
 */
import { intersection } from 'polyclip-ts';
import {
  polygonArea, segmentsProperlyCross, polyContainsPoly, roomsOverlap,
} from './logic';
import { classifyNearAxisSegment } from './near-axis';

/** Minimal room dimension in centimetres (owner: «мин. габарит ~30 см»). */
export const MIN_ROOM_CM = 30;

export interface RoomIn { id: string; poly: number[][] }
/** Opening in render units: centre, wall angle (deg), full length. */
export interface OpeningIn { id: string; x: number; y: number; length: number }

/** Fields relevant to the fixed-topology resize contract. Hosted openings
 * belong to independent walls and therefore never travel with a room edge. */
export interface SafeOpeningIn extends OpeningIn {
  hosted?: boolean;
  angle?: number;
  type?: string;
}

export type SafeResizeReason =
  | 'diagonal'
  | 'side-angle'
  | 'duplicate-physical-wall'
  | 'partial-shared'
  | 'unequal-shared'
  | 'multiple-rooms'
  | 'thickness-conflict'
  | 'opening-conflict'
  | 'invalid-geometry';

export type SafeResizeObstacle =
  | { kind: 'segment'; a: number[]; b: number[]; half?: number }
  | { kind: 'circle'; center: number[]; radius: number };

export interface SafeResizeOptions extends StopOpts {
  /** One snapped editor step; eligibility must permit a non-zero neighbour. */
  step?: number;
  /** Physical half-depth of the moving wall in render units. */
  movingHalf?: number;
  /** Independent walls, drafts and columns. They are immutable hard stops. */
  obstacles?: SafeResizeObstacle[];
  /** The controller found incompatible exact thickness records on this axis. */
  thicknessConflict?: boolean;
}

/** One immutable fixed-topology gesture plan. `edgeByRoom` contains either one
 * room or one exact endpoint-to-endpoint shared pair — never a cascade. */
export interface SafeResizePlan extends EdgeDragPlan {
  roomIds: string[];
  edgeByRoom: Record<string, number>;
  topology: Record<string, number>;
  movingOpeningIds: string[];
  /** Prepared physical-owner profiles for the two side walls of every owner. */
  sideOwnership: SafeResizeSideOwnership[];
}

export interface SafeResizeOwnershipInterval {
  roomId: string;
  edge: number;
  lo: number;
  hi: number;
}

export interface SafeResizeOwnershipRun {
  lo: number;
  hi: number;
  owners: string[];
}

/**
 * One side edge whose moving endpoint follows the selected wall. Intervals are
 * collected once from the immutable gesture snapshot; candidate validation
 * only adjusts intervals belonging to the one/two changed rooms.
 */
export interface SafeResizeSideOwnership {
  roomId: string;
  edge: number;
  movedEndpoint: 0 | 1;
  axis: Axis;
  line: number;
  fixed: number;
  moving: number;
  intervals: SafeResizeOwnershipInterval[];
  baseline: SafeResizeOwnershipRun[];
}

export type SafeResizeResolution =
  | { enabled: true; plan: SafeResizePlan }
  | { enabled: false; reason: SafeResizeReason };

export interface EdgeDragPlan {
  roomId: string;
  edge: number;            // edge index i: v[i] -> v[i+1]
  a: number[];             // edge endpoints BEFORE the drag
  b: number[];
  n: [number, number];     // outward unit normal (d > 0 grows the room)
}

export interface EdgeDragResult {
  /** roomId -> new outline (only rooms that changed). */
  polys: Record<string, number[][]>;
  /** openingId -> new centre (only openings that travelled with the wall). */
  openings: Record<string, [number, number]>;
  /** roomId -> the moved stretches AFTER the move (for clearance/labels). */
  movedSpans: Record<string, [number[], number[]][]>;
}

// ---------------- tiny vector helpers ----------------

const sub = (p: number[], q: number[]) => [p[0] - q[0], p[1] - q[1]];
const add2 = (p: number[], d: number[]) => [p[0] + d[0], p[1] + d[1]];
const dot = (p: number[], q: number[]) => p[0] * q[0] + p[1] * q[1];
const len2d = (p: number[]) => Math.hypot(p[0], p[1]);

function signedArea(poly: number[][]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function pointInPoly(p: number[], poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distPointToSpan(p: number[], a: number[], b: number[]): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-12) return len2d(sub(p, a));
  let t = dot(sub(p, a), ab) / l2;
  t = Math.max(0, Math.min(1, t));
  return len2d(sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]));
}

/**
 * Outward unit normal of edge i. Candidate is the +90° rotation of the edge
 * direction; a probe point decides the sign, so polygon orientation (either
 * winding survives in real configs) does not matter.
 */
export function edgeNormal(poly: number[][], i: number): [number, number] {
  const a = poly[i], b = poly[(i + 1) % poly.length];
  const d = sub(b, a);
  const l = len2d(d) || 1;
  let n: [number, number] = [d[1] / l, -d[0] / l];
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const probe = Math.max(l * 0.01, 1e-4);
  if (pointInPoly([mid[0] + n[0] * probe, mid[1] + n[1] * probe], poly)) n = [-n[0], -n[1]];
  return n;
}

/** Translate BOTH endpoints of edge i by the normal times d (docs/RESIZE.md, mechanism A). */
export function movePolyEdge(poly: number[][], i: number, d: number, n?: [number, number]): number[][] {
  const nn = n || edgeNormal(poly, i);
  const j = (i + 1) % poly.length;
  return poly.map((p, k) => (k === i || k === j ? [p[0] + nn[0] * d, p[1] + nn[1] * d] : [...p]));
}

/** Collinear overlap stretches of `poly`'s edges with segment a-b, as [p,q] pairs (pre-move). */
export function sharedSpansWith(poly: number[][], a: number[], b: number[], eps: number): [number[], number[]][] {
  const out: [number[], number[]][] = [];
  const ab = sub(b, a);
  const L = len2d(ab);
  if (L < eps) return out;
  const u = [ab[0] / L, ab[1] / L];
  for (let j = 0; j < poly.length; j++) {
    const q1 = poly[j], q2 = poly[(j + 1) % poly.length];
    const off1 = Math.abs((q1[0] - a[0]) * u[1] - (q1[1] - a[1]) * u[0]);
    const off2 = Math.abs((q2[0] - a[0]) * u[1] - (q2[1] - a[1]) * u[0]);
    if (off1 > eps || off2 > eps) continue; // not collinear with a-b
    const t1 = dot(sub(q1, a), u);
    const t2 = dot(sub(q2, a), u);
    const lo = Math.max(0, Math.min(t1, t2));
    const hi = Math.min(L, Math.max(t1, t2));
    if (hi - lo > eps) out.push([[a[0] + u[0] * lo, a[1] + u[1] * lo], [a[0] + u[0] * hi, a[1] + u[1] * hi]]);
  }
  return out;
}

/**
 * Neighbour sync: translate the stretches of `poly` that coincide with segment
 * a-b by vector D, inserting vertices at partial-contact boundaries (T-junction
 * → the neighbour may become L-shaped). Returns null when nothing coincides.
 */
export function shiftSharedSpans(
  poly: number[][], a: number[], b: number[], D: [number, number], eps: number,
): number[][] | null {
  const spans = sharedSpansWith(poly, a, b, eps);
  if (!spans.length) return null;
  const onSpan = (p: number[]) => spans.some(([p1, p2]) => distPointToSpan(p, p1, p2) <= eps);
  const n = poly.length;
  const out: number[][] = [];
  for (let j = 0; j < n; j++) {
    const q1 = poly[j], q2 = poly[(j + 1) % n];
    out.push(onSpan(q1) ? add2(q1, D) : [...q1]);
    const e = sub(q2, q1);
    const elen = len2d(e);
    if (elen < eps) continue;
    const u = [e[0] / elen, e[1] / elen];
    // collinear with a-b? (both endpoints on the a-b LINE)
    const abL = len2d(sub(b, a)) || 1;
    const uv = [(b[0] - a[0]) / abL, (b[1] - a[1]) / abL];
    const o1 = Math.abs((q1[0] - a[0]) * uv[1] - (q1[1] - a[1]) * uv[0]);
    const o2 = Math.abs((q2[0] - a[0]) * uv[1] - (q2[1] - a[1]) * uv[0]);
    if (o1 > eps || o2 > eps) continue;
    const tA = dot(sub(a, q1), u);
    const tB = dot(sub(b, q1), u);
    const lo = Math.max(0, Math.min(tA, tB));
    const hi = Math.min(elen, Math.max(tA, tB));
    if (hi - lo <= eps) continue;
    // interior boundaries split the edge: entering the overlap emits the static
    // point then its moved copy, leaving it emits the moved copy then the static
    if (lo > eps && lo < elen - eps) {
      const p = [q1[0] + u[0] * lo, q1[1] + u[1] * lo];
      out.push([...p], add2(p, D));
    }
    if (hi > eps && hi < elen - eps) {
      const p = [q1[0] + u[0] * hi, q1[1] + u[1] * hi];
      out.push(add2(p, D), [...p]);
    }
  }
  return out;
}

/** Drop consecutive duplicates and collinear middle vertices (commit-time cleanup). */
export function simplifyPoly(poly: number[][], eps = 1e-6): number[][] {
  let pts = poly.filter((p, i) => len2d(sub(p, poly[(i + 1) % poly.length])) > eps);
  for (let pass = 0; pass < 2; pass++) {
    pts = pts.filter((p, i) => {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const next = pts[(i + 1) % pts.length];
      const cross = (p[0] - prev[0]) * (next[1] - prev[1]) - (p[1] - prev[1]) * (next[0] - prev[0]);
      const span = len2d(sub(next, prev)) || 1;
      return Math.abs(cross) / span > eps; // keep only real corners
    });
  }
  return pts.length >= 3 ? pts : poly;
}

/** Simple polygon: no properly crossing edges (shared walls touching is fine). */
export function polyIsSimple(poly: number[][]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (segmentsProperlyCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return false;
    }
  return true;
}

/**
 * Normal clearance between the moved stretches and every PARALLEL wall of the
 * same room with an overlapping projection — the «opposite wall» distance that
 * enforces the 30 cm minimum. Infinity when no opposite wall exists.
 */
export function minParallelClearance(
  poly: number[][], spans: [number[], number[]][], eps = 1e-6,
): number {
  let best = Infinity;
  for (const [a, b] of spans) {
    const ab = sub(b, a);
    const L = len2d(ab);
    if (L < eps) continue;
    const u = [ab[0] / L, ab[1] / L];
    for (let j = 0; j < poly.length; j++) {
      const q1 = poly[j], q2 = poly[(j + 1) % poly.length];
      const e = sub(q2, q1);
      const elen = len2d(e);
      if (elen < eps) continue;
      const cosang = Math.abs((e[0] * u[0] + e[1] * u[1]) / elen);
      if (cosang < 1 - 1e-4) continue; // not parallel
      // projection overlap along the span direction
      const t1 = dot(sub(q1, a), u);
      const t2 = dot(sub(q2, a), u);
      const lo = Math.max(0, Math.min(t1, t2));
      const hi = Math.min(L, Math.max(t1, t2));
      if (hi - lo <= eps) continue;
      const d1 = Math.abs((q1[0] - a[0]) * u[1] - (q1[1] - a[1]) * u[0]);
      if (d1 <= eps) continue; // the span itself / collinear leftovers
      if (d1 < best) best = d1;
    }
  }
  return best;
}

/**
 * HP-1550-02: orientation-independent clearance of the moved stretches.
 *
 * minParallelClearance only saw PARALLEL opposite walls, so a triangle (no
 * parallel wall at all) reported Infinity and the 30 cm floor was simply off —
 * the base could be dragged to a 5-unit sliver. This measure looks at the whole
 * band the span sweeps along its normal: every vertex strictly inside the band
 * and every edge crossing the band interior counts with its perpendicular
 * distance from the span line. Two exclusions keep it honest:
 *   - anything ON the span line (offset ≤ eps) is the span itself, a collinear
 *     wall remainder or a T-insert — not an opposite obstacle;
 *   - the band ENDS (projection ≤ eps or ≥ L − eps) are excluded, so the
 *     |d|-long step edge a T-junction inserts at the very end of the span does
 *     not read as a paper-thin room on every small drag.
 * Offsets cannot change sign inside the band (that would cross the span —
 * polyIsSimple already rejected it), so an edge's minimum lies at a clip bound.
 * Infinity still means «nothing opposite at all» (e.g. growing outward).
 */
export function minSpanClearance(
  poly: number[][], spans: [number[], number[]][], eps = 1e-6,
): number {
  let best = Infinity;
  for (const [a, b] of spans) {
    const ab = sub(b, a);
    const L = len2d(ab);
    if (L < eps) continue;
    const u = [ab[0] / L, ab[1] / L];
    const soff = (p: number[]) => (p[0] - a[0]) * u[1] - (p[1] - a[1]) * u[0];
    const tOf = (p: number[]) => (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
    const lo = eps, hi = L - eps;
    for (const v of poly) {
      const o = Math.abs(soff(v));
      if (o <= eps) continue;
      const tv = tOf(v);
      if (tv <= lo || tv >= hi) continue;
      if (o < best) best = o;
    }
    for (let j = 0; j < poly.length; j++) {
      const q1 = poly[j], q2 = poly[(j + 1) % poly.length];
      const o1 = soff(q1), o2 = soff(q2);
      if (Math.abs(o1) <= eps || Math.abs(o2) <= eps) continue; // attached to the moving wall
      const t1 = tOf(q1), t2 = tOf(q2);
      const tlo = Math.max(lo, Math.min(t1, t2));
      const thi = Math.min(hi, Math.max(t1, t2));
      if (thi - tlo <= eps) continue; // casts no shadow on the span interior
      const dt = t2 - t1;
      if (Math.abs(dt) < eps) { // perpendicular-ish edge fully inside the band
        best = Math.min(best, Math.abs(o1), Math.abs(o2));
        continue;
      }
      const offAt = (tt: number) => Math.abs(o1 + ((tt - t1) / dt) * (o2 - o1));
      best = Math.min(best, offAt(tlo), offAt(thi));
    }
  }
  return best;
}

/** Convex hull (monotone chain) — only the width measure below needs it. */
function convexHull(pts: number[][]): number[][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: number[][] = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper: number[][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

/**
 * HP-1550-02: the TRUE minimum width of a polygon — rotating calipers over the
 * convex hull (the min over hull edge directions of the perpendicular extent).
 * The axis-aligned bbox lied under rotation: a 500×100 rectangle turned 45° has
 * a ≈424×424 bbox, so a 0.1 scale slid the real 100-side down to 10 unchecked.
 * A similarity scales every distance by k, which makes k·minPolyWidth exact —
 * and a concave room is judged by its overall silhouette, so a small notch
 * that takes no part in the operation cannot veto a legal scale.
 */
export function minPolyWidth(poly: number[][]): number {
  const h = convexHull(poly);
  if (h.length < 3) return 0;
  let best = Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    const e = sub(b, a);
    const L = len2d(e);
    if (L < 1e-12) continue;
    const u = [e[0] / L, e[1] / L];
    let w = 0;
    for (const pt of h) w = Math.max(w, Math.abs((pt[0] - a[0]) * u[1] - (pt[1] - a[1]) * u[0]));
    if (w < best) best = w;
  }
  return Number.isFinite(best) ? best : 0;
}

/**
 * Do two outlines ILLEGALLY share floor area? `roomsOverlap` alone misses the
 * «slide-over» case: equal-height rectangles overlapping horizontally have all
 * their edge intersections on collinear stretches, so nothing «properly
 * crosses» and nothing is strictly inside. A real polygon intersection area
 * settles it; legal full nesting (island rooms) stays legal.
 */
export function illegalOverlap(a: number[][], b: number[][], eps: number): boolean {
  if (roomsOverlap(a, b, eps)) return true;
  if (polyContainsPoly(a, b, eps) || polyContainsPoly(b, a, eps)) return false;
  let area = 0;
  try {
    const res = intersection(
      [[...a.map((p) => [p[0], p[1]]), [a[0][0], a[0][1]]]] as any,
      [[...b.map((p) => [p[0], p[1]]), [b[0][0], b[0][1]]]] as any,
    );
    for (const poly of res as any) if (poly?.[0]) area += polygonArea(poly[0]);
  } catch {
    return false; // a degenerate clip must not block the drag; the other stops still hold
  }
  return area > Math.max(1e-7, eps * eps);
}

// ---------------- mechanism A: the full drag pipeline ----------------

export function planEdgeDrag(rooms: RoomIn[], roomId: string, edge: number): EdgeDragPlan | null {
  const room = rooms.find((r) => r.id === roomId);
  if (!room || !room.poly || room.poly.length < 3) return null;
  if (edge < 0 || edge >= room.poly.length) return null;
  const a = [...room.poly[edge]];
  const b = [...room.poly[(edge + 1) % room.poly.length]];
  return { roomId, edge, a, b, n: edgeNormal(room.poly, edge) };
}

/** Apply the drag at distance d: own edge + every coinciding neighbour stretch. */
export function applyEdgeDrag(
  rooms: RoomIn[], openings: OpeningIn[], plan: EdgeDragPlan, d: number, eps: number,
): EdgeDragResult {
  const D: [number, number] = [plan.n[0] * d, plan.n[1] * d];
  const res: EdgeDragResult = { polys: {}, openings: {}, movedSpans: {} };
  if (Math.abs(d) < 1e-9) return res;
  for (const r of rooms) {
    if (r.id === plan.roomId) {
      res.polys[r.id] = movePolyEdge(r.poly, plan.edge, d, plan.n);
      res.movedSpans[r.id] = [[add2(plan.a, D), add2(plan.b, D)]];
      continue;
    }
    const spans = sharedSpansWith(r.poly, plan.a, plan.b, eps);
    if (!spans.length) continue;
    const shifted = shiftSharedSpans(r.poly, plan.a, plan.b, D, eps);
    if (shifted) {
      res.polys[r.id] = shifted;
      res.movedSpans[r.id] = spans.map(([p, q]) => [add2(p, D), add2(q, D)] as [number[], number[]]);
    }
  }
  // openings ON the moving wall travel with it (docs/RESIZE.md: anchors)
  for (const o of openings) {
    if (distPointToSpan([o.x, o.y], plan.a, plan.b) <= eps) res.openings[o.id] = [o.x + D[0], o.y + D[1]];
  }
  return res;
}

/** An opening must sit fully on ONE wall of some room: centre on the edge, both ends within it. */
function openingFits(o: { x: number; y: number; length: number }, polys: number[][][], eps: number): boolean {
  for (const poly of polys) {
    for (let j = 0; j < poly.length; j++) {
      const q1 = poly[j], q2 = poly[(j + 1) % poly.length];
      const e = sub(q2, q1);
      const elen = len2d(e);
      if (elen < eps) continue;
      const u = [e[0] / elen, e[1] / elen];
      const off = Math.abs((o.x - q1[0]) * u[1] - (o.y - q1[1]) * u[0]);
      if (off > eps) continue;
      const t = (o.x - q1[0]) * u[0] + (o.y - q1[1]) * u[1];
      if (t - o.length / 2 >= -eps && t + o.length / 2 <= elen + eps) return true;
    }
  }
  return false;
}

/** Openings that sit on any wall of any of the given (pre-move) outlines. */
function openingsOnRooms(openings: OpeningIn[], polys: number[][][], eps: number): OpeningIn[] {
  return openings.filter((o) =>
    polys.some((poly) => {
      for (let j = 0; j < poly.length; j++)
        if (distPointToSpan([o.x, o.y], poly[j], poly[(j + 1) % poly.length]) <= eps) return true;
      return false;
    }),
  );
}

export interface StopOpts {
  minDim: number;   // canvas units (≈30 cm through cell_cm)
  eps: number;      // collinearity epsilon (canvas units)
}

/** All the stops of docs/RESIZE.md for one candidate distance. */
export function validateEdgeDrag(
  rooms: RoomIn[], openings: OpeningIn[], plan: EdgeDragPlan, d: number, opts: StopOpts,
): boolean {
  const { minDim, eps } = opts;
  if (!Number.isFinite(d)) return false;
  if (Math.abs(d) < 1e-9) return true;
  const res = applyEdgeDrag(rooms, openings, plan, d, eps);
  const changedIds = Object.keys(res.polys);
  const newPolyOf = (r: RoomIn) => res.polys[r.id] || r.poly;
  for (const id of changedIds) {
    const r = rooms.find((x) => x.id === id)!;
    const np = res.polys[id];
    // simple + orientation preserved + not degenerate
    if (!polyIsSimple(np)) return false;
    const s0 = signedArea(r.poly), s1 = signedArea(np);
    if (Math.abs(s1) < eps || s0 * s1 <= 0) return false;
    // minimum size: orientation-independent clearance of the moved stretches
    // (HP-1550-02 — the parallel-walls-only measure left triangles and other
    // non-parallel geometry without the 30 cm floor); a room already thinner
    // keeps its clearance (improving is allowed, worsening is not)
    const oldSpans: [number[], number[]][] = id === plan.roomId
      ? [[plan.a, plan.b]]
      : sharedSpansWith(r.poly, plan.a, plan.b, eps);
    const cOld = minSpanClearance(r.poly, oldSpans, eps);
    const cNew = minSpanClearance(np, res.movedSpans[id] || [], eps);
    if (cNew < Math.min(minDim, cOld) - eps) return false;
    // every pre-existing room relationship must SURVIVE the drag: an island
    // stays an island (a jump fully past a thin island crosses no edge, so
    // containment is checked explicitly), a nested room stays inside its
    // parent, and unrelated rooms must not start sharing area or nesting
    for (const other of rooms) {
      if (other.id === id) continue;
      const otherNew = newPolyOf(other);
      if (polyContainsPoly(r.poly, other.poly, eps)) {          // our island
        if (!polyContainsPoly(np, otherNew, eps)) return false;
        continue;
      }
      if (polyContainsPoly(other.poly, r.poly, eps)) {          // we are the island
        if (!polyContainsPoly(otherNew, np, eps)) return false;
        continue;
      }
      if (polyContainsPoly(np, otherNew, eps) || polyContainsPoly(otherNew, np, eps)) return false;
      if (illegalOverlap(np, otherNew, eps)) return false;
    }
  }
  // openings: everything that sat on a wall of an affected room must still fit
  const oldPolys = changedIds.map((id) => rooms.find((x) => x.id === id)!.poly);
  const allNew = rooms.map(newPolyOf);
  for (const o of openingsOnRooms(openings, oldPolys, eps * 2)) {
    const c = res.openings[o.id];
    const moved = c ? { ...o, x: c[0], y: c[1] } : o;
    if (!openingFits(moved, allNew, eps * 2)) return false;
  }
  return true;
}

/**
 * Largest valid distance toward dWanted, stepping back by `step` (the grid
 * pitch, so a stopped wall still lands on the grid). 0 = the wall stays put.
 */
export function clampEdgeDrag(
  rooms: RoomIn[], openings: OpeningIn[], plan: EdgeDragPlan, dWanted: number, step: number, opts: StopOpts,
): number {
  if (!Number.isFinite(dWanted) || Math.abs(dWanted) < 1e-9) return 0;
  const sign = Math.sign(dWanted);
  let mag = Math.abs(dWanted);
  const s = Math.max(step, 1e-6);
  for (let guard = 0; guard < 4096 && mag > 1e-9; guard++, mag -= s) {
    const d = sign * mag;
    if (validateEdgeDrag(rooms, openings, plan, d, opts)) return d;
  }
  return 0;
}

// ---------------- safe fixed-topology wall move (#277) ----------------

type Axis = 'h' | 'v';

function axisOf(a: number[], b: number[], eps: number): Axis | null {
  const dx = Math.abs(b[0] - a[0]);
  const dy = Math.abs(b[1] - a[1]);
  if (dx <= eps && dy > eps) return 'v';
  if (dy <= eps && dx > eps) return 'h';
  return null;
}

function samePt(a: number[], b: number[], eps: number): boolean {
  return Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;
}

function sameEndpoints(a: number[], b: number[], c: number[], d: number[], eps: number): boolean {
  return (samePt(a, c, eps) && samePt(b, d, eps))
    || (samePt(a, d, eps) && samePt(b, c, eps));
}

function collinearOverlapLength(
  a: number[], b: number[], c: number[], d: number[], eps: number,
): number {
  const axis = axisOf(a, b, eps);
  if (!axis || axisOf(c, d, eps) !== axis) return 0;
  if (axis === 'h') {
    if (Math.abs(a[1] - c[1]) > eps || Math.abs(a[1] - d[1]) > eps) return 0;
    return Math.max(0, Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0]))
      - Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])));
  }
  if (Math.abs(a[0] - c[0]) > eps || Math.abs(a[0] - d[0]) > eps) return 0;
  return Math.max(0, Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))
    - Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])));
}

function sideEdgesArePerpendicular(poly: number[][], edge: number, moving: Axis, eps: number): boolean {
  const n = poly.length;
  const prev = axisOf(poly[(edge - 1 + n) % n], poly[edge], eps);
  const next = axisOf(poly[(edge + 1) % n], poly[(edge + 2) % n], eps);
  const side = moving === 'h' ? 'v' : 'h';
  return prev === side && next === side;
}

function segmentDistance(a: number[], b: number[], c: number[], d: number[]): number {
  if (segmentsProperlyCross(a, b, c, d)) return 0;
  return Math.min(
    distPointToSpan(a, c, d), distPointToSpan(b, c, d),
    distPointToSpan(c, a, b), distPointToSpan(d, a, b),
  );
}

function bboxOf(poly: number[][]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const point of poly) {
    x0 = Math.min(x0, point[0]); y0 = Math.min(y0, point[1]);
    x1 = Math.max(x1, point[0]); y1 = Math.max(y1, point[1]);
  }
  return [x0, y0, x1, y1];
}

function bboxesDisjoint(a: number[][], b: number[][], eps: number): boolean {
  const aa = bboxOf(a), bb = bboxOf(b);
  return aa[2] < bb[0] - eps || bb[2] < aa[0] - eps
    || aa[3] < bb[1] - eps || bb[3] < aa[1] - eps;
}

function obstacleOverlaysMovingEdge(
  obstacle: SafeResizeObstacle, a: number[], b: number[], opts: SafeResizeOptions,
): boolean {
  const eps = opts.eps;
  if (obstacle.kind === 'circle') {
    return distPointToSpan(obstacle.center, a, b)
      < obstacle.radius + (opts.movingHalf || 0) - eps;
  }
  return collinearOverlapLength(a, b, obstacle.a, obstacle.b, eps) > eps;
}

const axisCoordinate = (point: number[], axis: Axis): number => (
  axis === 'h' ? point[0] : point[1]
);

const lineCoordinate = (point: number[], axis: Axis): number => (
  axis === 'h' ? point[1] : point[0]
);

function ownershipIntervalsOnLine(
  rooms: RoomIn[], axis: Axis, line: number, eps: number,
): SafeResizeOwnershipInterval[] {
  const intervals: SafeResizeOwnershipInterval[] = [];
  for (const room of rooms) {
    for (let edge = 0; edge < room.poly.length; edge++) {
      const a = room.poly[edge];
      const b = room.poly[(edge + 1) % room.poly.length];
      if (axisOf(a, b, eps) !== axis
          || Math.abs(lineCoordinate(a, axis) - line) > eps
          || Math.abs(lineCoordinate(b, axis) - line) > eps) continue;
      const ca = axisCoordinate(a, axis);
      const cb = axisCoordinate(b, axis);
      const lo = Math.min(ca, cb), hi = Math.max(ca, cb);
      if (hi - lo > eps) intervals.push({ roomId: room.id, edge, lo, hi });
    }
  }
  return intervals.sort((a, b) => a.lo - b.lo || a.hi - b.hi
    || a.roomId.localeCompare(b.roomId) || a.edge - b.edge);
}

function ownershipRuns(
  intervals: SafeResizeOwnershipInterval[], lo: number, hi: number, eps: number,
): SafeResizeOwnershipRun[] {
  const breaks = [lo, hi];
  for (const interval of intervals) {
    const start = Math.max(lo, interval.lo);
    const end = Math.min(hi, interval.hi);
    if (end - start > eps) breaks.push(start, end);
  }
  const sorted = [...new Set(breaks)].sort((a, b) => a - b);
  const runs: SafeResizeOwnershipRun[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const start = sorted[i], end = sorted[i + 1];
    if (end - start <= eps) continue;
    const mid = (start + end) / 2;
    const owners = [...new Set(intervals.filter((interval) => (
      mid > interval.lo - eps && mid < interval.hi + eps
    )).map((interval) => interval.roomId))].sort();
    runs.push({ lo: start, hi: end, owners });
  }
  return runs;
}

function buildSideOwnership(
  rooms: RoomIn[], roomId: string, edge: number, movedEndpoint: 0 | 1, eps: number,
): SafeResizeSideOwnership | null {
  const room = rooms.find((candidate) => candidate.id === roomId);
  if (!room) return null;
  const a = room.poly[edge];
  const b = room.poly[(edge + 1) % room.poly.length];
  const axis = axisOf(a, b, eps);
  if (!axis) return null;
  const fixedPoint = movedEndpoint === 0 ? b : a;
  const movingPoint = movedEndpoint === 0 ? a : b;
  const fixed = axisCoordinate(fixedPoint, axis);
  const moving = axisCoordinate(movingPoint, axis);
  const line = lineCoordinate(fixedPoint, axis);
  const intervals = ownershipIntervalsOnLine(rooms, axis, line, eps);
  const baseline = ownershipRuns(intervals, Math.min(fixed, moving), Math.max(fixed, moving), eps);
  if (!baseline.length || baseline.some((run) => run.owners.length < 1 || run.owners.length > 2)) {
    return null;
  }
  return { roomId, edge, movedEndpoint, axis, line, fixed, moving, intervals, baseline };
}

function candidateOwnershipIntervals(
  profile: SafeResizeSideOwnership, result: EdgeDragResult, eps: number,
): SafeResizeOwnershipInterval[] {
  const intervals: SafeResizeOwnershipInterval[] = [];
  for (const source of profile.intervals) {
    const poly = result.polys[source.roomId];
    if (!poly) {
      intervals.push(source);
      continue;
    }
    if (source.edge < 0 || source.edge >= poly.length) continue;
    const a = poly[source.edge];
    const b = poly[(source.edge + 1) % poly.length];
    if (axisOf(a, b, eps) !== profile.axis
        || Math.abs(lineCoordinate(a, profile.axis) - profile.line) > eps
        || Math.abs(lineCoordinate(b, profile.axis) - profile.line) > eps) continue;
    const ca = axisCoordinate(a, profile.axis);
    const cb = axisCoordinate(b, profile.axis);
    const lo = Math.min(ca, cb), hi = Math.max(ca, cb);
    if (hi - lo > eps) intervals.push({ ...source, lo, hi });
  }
  return intervals;
}

function ownerCountAt(intervals: SafeResizeOwnershipInterval[], coordinate: number, eps: number): number {
  return new Set(intervals.filter((interval) => (
    coordinate > interval.lo - eps && coordinate < interval.hi + eps
  )).map((interval) => interval.roomId)).size;
}

/**
 * Preserve the physical role (outer/shared) of every atomic side-wall run.
 * Extending a shared run into outer space, or shortening it so the neighbour
 * keeps an outer continuation, is the mixed-role corruption from #289.
 */
function sideOwnershipPreserved(
  result: EdgeDragResult, plan: SafeResizePlan, eps: number,
): boolean {
  for (const profile of plan.sideOwnership) {
    const nextRoom = result.polys[profile.roomId];
    if (!nextRoom) return false;
    const a = nextRoom[profile.edge];
    const b = nextRoom[(profile.edge + 1) % nextRoom.length];
    if (axisOf(a, b, eps) !== profile.axis) return false;
    const nextMoving = axisCoordinate(profile.movedEndpoint === 0 ? a : b, profile.axis);
    const candidate = candidateOwnershipIntervals(profile, result, eps);
    const terminalRun = profile.moving >= profile.fixed
      ? profile.baseline[profile.baseline.length - 1]
      : profile.baseline[0];
    const terminalRole = terminalRun.owners.length;
    if (terminalRole < 1 || terminalRole > 2) return false;

    const lo = Math.min(profile.fixed, profile.moving, nextMoving);
    const hi = Math.max(profile.fixed, profile.moving, nextMoving);
    const breaks = [lo, hi, profile.fixed, profile.moving, nextMoving];
    for (const interval of profile.intervals) breaks.push(interval.lo, interval.hi);
    for (const interval of candidate) breaks.push(interval.lo, interval.hi);
    const sorted = [...new Set(breaks.filter((value) => value >= lo && value <= hi))]
      .sort((x, y) => x - y);
    const oldLo = Math.min(profile.fixed, profile.moving);
    const oldHi = Math.max(profile.fixed, profile.moving);
    const newLo = Math.min(profile.fixed, nextMoving);
    const newHi = Math.max(profile.fixed, nextMoving);
    for (let i = 0; i + 1 < sorted.length; i++) {
      const start = sorted[i], end = sorted[i + 1];
      if (end - start <= eps) continue;
      const mid = (start + end) / 2;
      const oldOwns = mid > oldLo - eps && mid < oldHi + eps;
      const newOwns = mid > newLo - eps && mid < newHi + eps;
      if (!oldOwns && !newOwns) continue;
      const oldRole = ownerCountAt(profile.intervals, mid, eps);
      const nextRole = ownerCountAt(candidate, mid, eps);
      if (oldRole > 2 || nextRole > 2) return false;
      if (oldOwns && newOwns) {
        if (oldRole !== nextRole) return false;
      } else if (!oldOwns && newOwns) {
        // Empty space may receive a new outer continuation. Existing physical
        // material, however, must keep its role: an outer wall cannot become
        // shared merely because this room grows onto it (and vice versa).
        if (nextRole !== terminalRole || (oldRole > 0 && oldRole !== nextRole)) return false;
      } else if (oldRole === 2 ? nextRole !== 2 : nextRole > 1) {
        return false;
      }
    }
  }
  return true;
}

/** Resolve eligibility once at gesture start. Partial shared stretches and a
 * third owner fail closed; the old vertex-insertion cascade is never planned. */
export function resolveSafeResize(
  rooms: RoomIn[], openings: SafeOpeningIn[], roomId: string, edge: number,
  opts: SafeResizeOptions,
): SafeResizeResolution {
  const { eps } = opts;
  const room = rooms.find((candidate) => candidate.id === roomId);
  if (!room || edge < 0 || edge >= (room.poly?.length || 0)
      || room.poly.length < 4 || !polyIsSimple(room.poly)) {
    return { enabled: false, reason: 'invalid-geometry' };
  }
  const a = room.poly[edge];
  const b = room.poly[(edge + 1) % room.poly.length];
  const movingAxis = axisOf(a, b, eps);
  if (!movingAxis) return { enabled: false, reason: 'diagonal' };
  if (!sideEdgesArePerpendicular(room.poly, edge, movingAxis, eps)) {
    return { enabled: false, reason: 'side-angle' };
  }
  if (opts.thicknessConflict) {
    return { enabled: false, reason: 'thickness-conflict' };
  }
  for (const obstacle of opts.obstacles || []) {
    if (obstacleOverlaysMovingEdge(obstacle, a, b, opts)) {
      return { enabled: false, reason: 'duplicate-physical-wall' };
    }
  }

  const targetLength = len2d(sub(b, a));
  const exact: Array<{ room: RoomIn; edge: number }> = [];
  const touchedRooms = new Set<string>();
  let partial = false;
  let unequal = false;
  for (const other of rooms) {
    if (other.id === roomId) continue;
    for (let i = 0; i < other.poly.length; i++) {
      const c = other.poly[i];
      const d = other.poly[(i + 1) % other.poly.length];
      const overlap = collinearOverlapLength(a, b, c, d, eps);
      if (overlap <= eps) continue;
      touchedRooms.add(other.id);
      if (sameEndpoints(a, b, c, d, eps)) exact.push({ room: other, edge: i });
      else if (overlap < targetLength - eps) partial = true;
      else unequal = true;
    }
  }
  if (partial) return { enabled: false, reason: 'partial-shared' };
  if (unequal) return { enabled: false, reason: 'unequal-shared' };
  if (touchedRooms.size > 1 || exact.length > 1) {
    return { enabled: false, reason: 'multiple-rooms' };
  }

  const edgeByRoom: Record<string, number> = { [roomId]: edge };
  const roomIds = [roomId];
  if (exact.length === 1) {
    const neighbour = exact[0];
    if (!polyIsSimple(neighbour.room.poly)) {
      return { enabled: false, reason: 'invalid-geometry' };
    }
    if (!sideEdgesArePerpendicular(neighbour.room.poly, neighbour.edge, movingAxis, eps)) {
      return { enabled: false, reason: 'side-angle' };
    }
    roomIds.push(neighbour.room.id);
    edgeByRoom[neighbour.room.id] = neighbour.edge;
  }

  const movingOpeningIds: string[] = [];
  for (const opening of openings) {
    if (distPointToSpan([opening.x, opening.y], a, b) > eps * 2) continue;
    if (opening.hosted || opening.length > targetLength + eps * 2) {
      return { enabled: false, reason: 'opening-conflict' };
    }
    movingOpeningIds.push(opening.id);
  }
  const topology = Object.fromEntries(roomIds.map((id) => [
    id, rooms.find((candidate) => candidate.id === id)!.poly.length,
  ]));
  const sideOwnership: SafeResizeSideOwnership[] = [];
  for (const id of roomIds) {
    const owner = rooms.find((candidate) => candidate.id === id)!;
    const ownerEdge = edgeByRoom[id];
    const prev = (ownerEdge - 1 + owner.poly.length) % owner.poly.length;
    const next = (ownerEdge + 1) % owner.poly.length;
    const before = buildSideOwnership(rooms, id, prev, 1, eps);
    const after = buildSideOwnership(rooms, id, next, 0, eps);
    if (!before || !after) return { enabled: false, reason: 'partial-shared' };
    sideOwnership.push(before, after);
  }
  const plan: SafeResizePlan = {
    roomId, edge, a: [...a], b: [...b], n: edgeNormal(room.poly, edge),
    roomIds, edgeByRoom, topology, movingOpeningIds, sideOwnership,
  };
  if (!validateSafeResize(rooms, openings, plan, 0, opts)) {
    return { enabled: false, reason: 'invalid-geometry' };
  }
  const step = Math.abs(Number(opts.step));
  if (Number.isFinite(step) && step > eps) {
    const neighbours = [-step, step];
    if (!neighbours.some((delta) => validateSafeResize(
      rooms, openings, plan, delta, opts,
    ))) {
      if (!neighbours.some((delta) => sideOwnershipPreserved(
        applySafeResize(rooms, openings, plan, delta), plan, eps,
      ))) return { enabled: false, reason: 'partial-shared' };
      const withoutObstacles = { ...opts, obstacles: [] };
      if (neighbours.some((delta) => validateSafeResize(
        rooms, openings, plan, delta, withoutObstacles,
      ))) return { enabled: false, reason: 'duplicate-physical-wall' };
      if (openings.length && neighbours.some((delta) => validateSafeResize(
        rooms, [], plan, delta, opts,
      ))) return { enabled: false, reason: 'opening-conflict' };
      return { enabled: false, reason: 'invalid-geometry' };
    }
  }
  return { enabled: true, plan };
}

/** Apply the same vector to the same two vertices in one or two rooms. No
 * insertion, simplification, sorting or ownership inference occurs here. */
export function applySafeResize(
  rooms: RoomIn[], openings: SafeOpeningIn[], plan: SafeResizePlan, d: number,
): EdgeDragResult {
  const D: [number, number] = [plan.n[0] * d, plan.n[1] * d];
  const result: EdgeDragResult = { polys: {}, openings: {}, movedSpans: {} };
  for (const roomId of plan.roomIds) {
    const room = rooms.find((candidate) => candidate.id === roomId);
    const edge = plan.edgeByRoom[roomId];
    if (!room || edge == null) continue;
    const next = (edge + 1) % room.poly.length;
    result.polys[roomId] = room.poly.map((point, index) => (
      index === edge || index === next ? add2(point, D) : [...point]
    ));
    result.movedSpans[roomId] = [[
      add2(room.poly[edge], D), add2(room.poly[next], D),
    ]];
  }
  for (const opening of openings) {
    if (plan.movingOpeningIds.includes(opening.id)) {
      result.openings[opening.id] = [opening.x + D[0], opening.y + D[1]];
    }
  }
  return result;
}

function openingOnEdge(opening: SafeOpeningIn, a: number[], b: number[], eps: number): boolean {
  if (distPointToSpan([opening.x, opening.y], a, b) > eps * 2) return false;
  const edgeLength = len2d(sub(b, a));
  if (edgeLength <= eps) return false;
  const u = [(b[0] - a[0]) / edgeLength, (b[1] - a[1]) / edgeLength];
  const t = (opening.x - a[0]) * u[0] + (opening.y - a[1]) * u[1];
  return t >= -eps && t <= edgeLength + eps;
}

function sideOpeningFits(
  opening: SafeOpeningIn, oldA: number[], oldB: number[], newA: number[], newB: number[],
  movedEndpoint: 0 | 1, movingHalf: number, eps: number,
): boolean {
  if (!openingOnEdge(opening, oldA, oldB, eps)) return true;
  if (distPointToSpan([opening.x, opening.y], newA, newB) > eps * 2) return false;
  const moved = movedEndpoint === 0 ? newA : newB;
  return len2d(sub([opening.x, opening.y], moved))
    >= opening.length / 2 + movingHalf - eps;
}

function obstacleBlocksCandidate(
  obstacle: SafeResizeObstacle, a: number[], b: number[], opts: SafeResizeOptions,
): boolean {
  const half = opts.movingHalf || 0;
  if (obstacle.kind === 'circle') {
    return distPointToSpan(obstacle.center, a, b) < obstacle.radius + half - opts.eps;
  }
  return segmentDistance(a, b, obstacle.a, obstacle.b)
    < (obstacle.half || 0) + half - opts.eps;
}

/** Exact candidate check used by preview and pointerup. The check is deliberately
 * stricter than the historical polygon-only validator: changed-room identity,
 * topology and shared endpoints are part of validity. */
export function validateSafeResize(
  rooms: RoomIn[], openings: SafeOpeningIn[], plan: SafeResizePlan, d: number,
  opts: SafeResizeOptions,
): boolean {
  const { eps, minDim } = opts;
  if (!Number.isFinite(d) || plan.roomIds.length < 1 || plan.roomIds.length > 2) return false;
  const result = applySafeResize(rooms, openings, plan, d);
  if (Object.keys(result.polys).length !== plan.roomIds.length) return false;
  if (!sideOwnershipPreserved(result, plan, eps)) return false;
  const changed = new Set(plan.roomIds);
  const polyOf = (room: RoomIn) => result.polys[room.id] || room.poly;

  for (const roomId of plan.roomIds) {
    const original = rooms.find((room) => room.id === roomId);
    const next = result.polys[roomId];
    const edge = plan.edgeByRoom[roomId];
    if (!original || !next || next.length !== plan.topology[roomId]
        || next.length !== original.poly.length || !polyIsSimple(next)) return false;
    const n = original.poly.length;
    const prev = (edge - 1 + n) % n;
    const involvedEdges = [prev, edge, (edge + 1) % n];
    for (const index of involvedEdges) {
      if (classifyNearAxisSegment(next[index], next[(index + 1) % n])) return false;
    }
    const s0 = signedArea(original.poly);
    const s1 = signedArea(next);
    if (Math.abs(s1) < eps || s0 * s1 <= 0) return false;
    const oldSpan: [number[], number[]] = [
      original.poly[edge], original.poly[(edge + 1) % original.poly.length],
    ];
    const newSpan = result.movedSpans[roomId];
    const oldClearance = minSpanClearance(original.poly, [oldSpan], eps);
    const newClearance = minSpanClearance(next, newSpan, eps);
    if (newClearance < Math.min(minDim, oldClearance) - eps) return false;

    const sideAOld: [number[], number[]] = [original.poly[prev], original.poly[edge]];
    const sideANew: [number[], number[]] = [next[prev], next[edge]];
    const sideBOld: [number[], number[]] = [original.poly[(edge + 1) % n], original.poly[(edge + 2) % n]];
    const sideBNew: [number[], number[]] = [next[(edge + 1) % n], next[(edge + 2) % n]];
    const movingAxis = axisOf(next[edge], next[(edge + 1) % n], eps);
    const sideAxis = movingAxis === 'h' ? 'v' : movingAxis === 'v' ? 'h' : null;
    if (!sideAxis || axisOf(...sideANew, eps) !== sideAxis
        || axisOf(...sideBNew, eps) !== sideAxis) return false;
    for (const opening of openings) {
      if (plan.movingOpeningIds.includes(opening.id)) continue;
      if (!sideOpeningFits(opening, ...sideAOld, ...sideANew, 1, opts.movingHalf || 0, eps)) return false;
      if (!sideOpeningFits(opening, ...sideBOld, ...sideBNew, 0, opts.movingHalf || 0, eps)) return false;
    }
  }

  if (plan.roomIds.length === 2) {
    const [leftId, rightId] = plan.roomIds;
    const left = result.polys[leftId];
    const right = result.polys[rightId];
    const li = plan.edgeByRoom[leftId];
    const ri = plan.edgeByRoom[rightId];
    if (!sameEndpoints(
      left[li], left[(li + 1) % left.length],
      right[ri], right[(ri + 1) % right.length], eps,
    )) return false;
  }

  for (const roomId of plan.roomIds) {
    const original = rooms.find((room) => room.id === roomId)!;
    const next = result.polys[roomId];
    for (const other of rooms) {
      if (other.id === roomId || changed.has(other.id)) continue;
      const otherNext = polyOf(other);
      if (bboxesDisjoint(original.poly, other.poly, eps)
          && bboxesDisjoint(next, otherNext, eps)) continue;
      if (polyContainsPoly(original.poly, other.poly, eps)) {
        if (!polyContainsPoly(next, otherNext, eps)) return false;
      } else if (polyContainsPoly(other.poly, original.poly, eps)) {
        if (!polyContainsPoly(otherNext, next, eps)) return false;
      } else if (polyContainsPoly(next, otherNext, eps)
          || polyContainsPoly(otherNext, next, eps)
          || illegalOverlap(next, otherNext, eps)) return false;
    }
  }

  const movingRoom = rooms.find((room) => room.id === plan.roomId)!;
  const movingPoly = result.polys[plan.roomId];
  const movingEdge = plan.edgeByRoom[plan.roomId];
  const ma = movingPoly[movingEdge];
  const mb = movingPoly[(movingEdge + 1) % movingPoly.length];
  if (Math.abs(d) > eps) {
    for (const obstacle of opts.obstacles || []) {
      if (obstacleBlocksCandidate(obstacle, ma, mb, opts)) return false;
    }
  }

  for (const opening of openings) {
    if (!plan.movingOpeningIds.includes(opening.id)) continue;
    const center = result.openings[opening.id];
    if (!center || opening.hosted) return false;
    if (!openingFits({ ...opening, x: center[0], y: center[1] }, [ma, mb].length ? [movingPoly] : [], eps * 2)) {
      return false;
    }
  }
  return true;
}

/** Contiguous clamp from zero: once a wall reaches the first unsafe grid node,
 * it cannot jump through an opening/corner and become valid again beyond it. */
export function clampSafeResize(
  rooms: RoomIn[], openings: SafeOpeningIn[], plan: SafeResizePlan,
  dWanted: number, step: number, opts: SafeResizeOptions,
): number {
  if (!Number.isFinite(dWanted) || Math.abs(dWanted) < 1e-9) return 0;
  const sign = Math.sign(dWanted);
  const wanted = Math.abs(dWanted);
  const stride = Math.max(Math.abs(step), 1e-6);
  let cached = safeClampValidationCache.get(plan);
  if (!cached || cached.opts !== opts) {
    cached = { opts, values: new Map() };
    safeClampValidationCache.set(plan, cached);
  }
  const cache = cached.values;
  let good = 0;
  for (let magnitude = Math.min(stride, wanted), guard = 0;
    guard < 4096 && magnitude <= wanted + 1e-9;
    guard++, magnitude = Math.min(wanted, magnitude + stride)) {
    const candidate = sign * magnitude;
    const cacheKey = `${candidate.toFixed(9)}|${stride.toFixed(9)}`;
    let valid = cache.get(cacheKey);
    if (valid === undefined) {
      valid = validateSafeResize(rooms, openings, plan, candidate, opts);
      if (cache.size < 4096) cache.set(cacheKey, valid);
    }
    if (!valid) break;
    good = candidate;
    if (Math.abs(magnitude - wanted) <= 1e-9) break;
  }
  return good;
}

const safeClampValidationCache = new WeakMap<
SafeResizePlan, { opts: SafeResizeOptions; values: Map<string, boolean> }
>();

/** Test/benchmark diagnostic; active plans are weakly held and individually bounded. */
export function safeResizeCachedDeltaCount(plan: SafeResizePlan): number {
  return safeClampValidationCache.get(plan)?.values.size || 0;
}

// ---------------- mechanism B: the scale frame ----------------

export interface ScaleResult {
  poly: number[][];
  openings: Record<string, [number, number]>;
}

/** Uniform scale of the room about `fixed`; exclusive openings follow, shared ones stay. */
export function applyRoomScale(
  room: RoomIn, openings: OpeningIn[], otherPolys: number[][][], fixed: [number, number], k: number, eps: number,
): ScaleResult {
  const scalePt = (p: number[]) => [fixed[0] + (p[0] - fixed[0]) * k, fixed[1] + (p[1] - fixed[1]) * k];
  const res: ScaleResult = { poly: room.poly.map(scalePt), openings: {} };
  for (const o of openings) {
    let on = false;
    for (let j = 0; j < room.poly.length; j++)
      if (distPointToSpan([o.x, o.y], room.poly[j], room.poly[(j + 1) % room.poly.length]) <= eps) { on = true; break; }
    if (!on) continue;
    // an opening on a wall shared with a neighbour belongs to the neighbour's
    // wall once the scale detaches ours — it stays put (docs/RESIZE.md)
    const shared = otherPolys.some((poly) => {
      for (let j = 0; j < poly.length; j++)
        if (distPointToSpan([o.x, o.y], poly[j], poly[(j + 1) % poly.length]) <= eps) return true;
      return false;
    });
    if (!shared) {
      const c = scalePt([o.x, o.y]);
      res.openings[o.id] = [c[0], c[1]];
    }
  }
  return res;
}

/** Stops for one candidate scale factor (neighbours are never dragged along). */
export function validateRoomScale(
  rooms: RoomIn[], openings: OpeningIn[], roomId: string, fixed: [number, number], k: number, opts: StopOpts,
): boolean {
  const { minDim, eps } = opts;
  if (!Number.isFinite(k) || k <= 0) return false;
  if (Math.abs(k - 1) < 1e-9) return true;
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return false;
  const otherPolys = rooms.filter((r) => r.id !== roomId).map((r) => r.poly);
  const res = applyRoomScale(room, openings, otherPolys, fixed, k, eps * 2);
  const np = res.poly;
  // minimum size: a similarity scales every distance by exactly k, so the TRUE
  // minimum width of the original scales to k·w0 (HP-1550-02 — the axis-aligned
  // bbox side let a rotated rectangle shrink its real short side unchecked);
  // an already-thin room keeps the improve-only rule
  const w0 = minPolyWidth(room.poly);
  if (w0 * k < Math.min(minDim, w0) - eps) return false;
  // the neighbour is a wall to hit: pre-existing nesting must survive,
  // everything else must not gain shared area or become nested (engulfing a
  // foreign room via scale is a stop, not a new island)
  for (const r of rooms) {
    if (r.id === roomId) continue;
    if (polyContainsPoly(room.poly, r.poly, eps)) {             // our island
      if (!polyContainsPoly(np, r.poly, eps)) return false;
      continue;
    }
    if (polyContainsPoly(r.poly, room.poly, eps)) {             // we are the island
      if (!polyContainsPoly(r.poly, np, eps)) return false;
      continue;
    }
    if (polyContainsPoly(np, r.poly, eps) || polyContainsPoly(r.poly, np, eps)) return false;
    if (illegalOverlap(np, r.poly, eps)) return false;
  }
  // openings of this room (moved or kept) must still fit on some wall
  const allNew = rooms.map((r) => (r.id === roomId ? np : r.poly));
  for (const o of openingsOnRooms(openings, [room.poly], eps * 2)) {
    const c = res.openings[o.id];
    const moved = c ? { ...o, x: c[0], y: c[1] } : o;
    if (!openingFits(moved, allNew, eps * 2)) return false;
  }
  return true;
}

/** Closest valid factor to kWanted (bisecting toward 1, which is always valid). */
export function clampRoomScale(
  rooms: RoomIn[], openings: OpeningIn[], roomId: string, fixed: [number, number], kWanted: number, opts: StopOpts,
): number {
  if (!Number.isFinite(kWanted) || kWanted <= 0) return 1;
  if (validateRoomScale(rooms, openings, roomId, fixed, kWanted, opts)) return kWanted;
  let good = 1, bad = kWanted;
  for (let i = 0; i < 28; i++) {
    const mid = (good + bad) / 2;
    if (validateRoomScale(rooms, openings, roomId, fixed, mid, opts)) good = mid;
    else bad = mid;
  }
  return good;
}

// ---------------- live numbers ----------------

/** Room area in m² from render units via the grid scale. */
export function areaM2(poly: number[][], gridPitch: number, cellCm: number): number {
  const cmPerUnit = cellCm / gridPitch;
  return (polygonArea(poly) * cmPerUnit * cmPerUnit) / 1e4;
}

/** "12.4 m²" or "133 ft²" per the HA unit system. */
export function formatArea(m2: number, imperial: boolean): string {
  if (imperial) return `${Math.round(m2 * 10.7639)} ft²`;
  return `${(Math.round(m2 * 10) / 10).toFixed(1)} m²`;
}
