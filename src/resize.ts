/**
 * Room resize geometry — pure functions only (docs/RESIZE.md).
 *
 * Mechanism A: dragging a wall along its normal, shared stretches of
 * neighbours move together (T-junctions insert vertices). Mechanism B:
 * uniform scale of one room about a bbox corner. Every stop («упор») is
 * decided here so it can be unit-tested; the card only wires pointers.
 *
 * All coordinates are render units (NORM_W-scaled), same as the card's
 * space model. Nothing here touches Lit or the DOM.
 */
import { intersection } from 'polyclip-ts';
import {
  polygonArea, segmentsProperlyCross, polyContainsPoly, roomsOverlap,
} from './logic';

/** Minimal room dimension in centimetres (owner: «мин. габарит ~30 см»). */
export const MIN_ROOM_CM = 30;

export interface RoomIn { id: string; poly: number[][] }
/** Opening in render units: centre, wall angle (deg), full length. */
export interface OpeningIn { id: string; x: number; y: number; length: number }

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
