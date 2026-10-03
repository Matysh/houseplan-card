/**
 * Pure geometry of an LED strip (#780): anchor, derived visible path,
 * placement against physical bodies, emitter samples and hit-testing.
 *
 * The stored points are the single source. Everything here is a derivation
 * that never writes back: the anchor (half the polyline length), the visible
 * path (offset `t/2` from a thick wall face into free floor, ТЗ §3), the light
 * emitters (on a face, `epsilonGeom` outward, ТЗ §6) and the screen hit path.
 *
 * Units are plan units unless a name says otherwise. The module knows neither
 * the card nor the editor, so the unit suite exercises every rule directly.
 */

export type Pt = readonly [number, number];

export interface LedStripCfg {
  id: string;
  points: Array<[number, number]>;
  marker: string | null;
  /** Absent/true — the strip is the marker's representation; false — hidden shape. */
  active?: boolean;
}

export const LED_MAX_STRIPS = 50;
export const LED_MAX_POINTS = 50;
/** Geometric tolerance for "lies on a face": 0.001 cm, never a screen magnet. */
export const LED_EPSILON_CM = 0.001;
/** Default linear field radius (#784): 30 cm, independent of the shared one. */
export const LED_DEFAULT_RADIUS_CM = 30;
/** Total stripe thickness in base device diameters (#785): physical geometry is state-invariant. */
export const LED_THICKNESS_D = 0.12;
/** Minimum touch radius across the visible stripe (ТЗ §7). */
export const LED_HIT_MIN_CSS_PX = 22;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function isPoint(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1]);
}

const same = (a: Pt, b: Pt): boolean => a[0] === b[0] && a[1] === b[1];
const dist = (a: Pt, b: Pt): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** True when the repeated first point closes the strip (≥3 distinct vertices). */
export function isClosedStrip(points: readonly Pt[]): boolean {
  return points.length >= 4 && same(points[0], points[points.length - 1]);
}

/** Drop zero-length steps; keeps the closing point of a closed strip. */
export function compactPoints(points: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const point of points) {
    if (!isPoint(point)) continue;
    if (out.length && same(out[out.length - 1], point)) continue;
    out.push([point[0], point[1]]);
  }
  return out;
}

export function polylineLength(points: readonly Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/**
 * The anchor of a strip: the point at half its total length — not the mean of
 * the vertices, not the bounding-box centre (ТЗ §5). `[[0,0],[10,0],[10,10]]`
 * gives `[10,0]`; `[[0,0],[4,0]]` gives `[2,0]`.
 */
export function stripAnchor(points: readonly Pt[]): [number, number] | null {
  const path = compactPoints(points);
  if (path.length < 2) return path.length ? [path[0][0], path[0][1]] : null;
  const half = polylineLength(path) / 2;
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const step = dist(path[i - 1], path[i]);
    if (walked + step >= half) {
      const t = step > 0 ? (half - walked) / step : 0;
      return [
        path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
        path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t,
      ];
    }
    walked += step;
  }
  const last = path[path.length - 1];
  return [last[0], last[1]];
}

/** Is the stored shape valid for a write (mirror of led_strips.py)? */
export function validStripPoints(points: unknown): points is Array<[number, number]> {
  if (!Array.isArray(points) || points.length < 2 || points.length > LED_MAX_POINTS) return false;
  if (!points.every(isPoint)) return false;
  const distinct = new Set(points.map((p) => `${p[0]},${p[1]}`));
  if (distinct.size < 2 || !(polylineLength(points) > 0)) return false;
  if (points.length > 2 && same(points[0], points[points.length - 1])) {
    const open = new Set(points.slice(0, -1).map((p) => `${p[0]},${p[1]}`));
    if (open.size < 3) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Physical faces: where a strip lies on a thick body, its visible stripe and
// its light move to the free side.

/** A straight edge of an opaque physical body (masonry, partition, column). */
export interface BodyFace {
  a: Pt;
  b: Pt;
}

export interface FaceContext {
  faces: readonly BodyFace[];
  /** Is a point strictly inside an opaque body? */
  inside: (point: Pt) => boolean;
  /** `LED_EPSILON_CM` in plan units. */
  epsilon: number;
  /** Optional spatial index: the faces whose box meets `[minX, minY, maxX, maxY]`. */
  near?: (box: readonly number[]) => readonly BodyFace[];
}

/** One piece of a stored segment: on a face (side = unit normal into free floor) or free. */
export interface StripPiece {
  a: [number, number];
  b: [number, number];
  /** Unit normal into the free floor for a face piece; null on free floor or a zero wall. */
  free: [number, number] | null;
}

const sub = (a: Pt, b: Pt): [number, number] => [a[0] - b[0], a[1] - b[1]];
const lerp = (a: Pt, b: Pt, t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function pointSegmentDistance(p: Pt, a: Pt, b: Pt): number {
  const [dx, dy] = sub(b, a);
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Parameter interval of AB that lies on face F (both within `eps` of F's
 * line and inside F's extent), or null. Collinearity is judged by distance,
 * not by the screen magnet (ТЗ §3, §13.4).
 */
function overlapOnFace(a: Pt, b: Pt, face: BodyFace, eps: number): [number, number] | null {
  const len = dist(a, b);
  if (len === 0) return null;
  const fLen = dist(face.a, face.b);
  if (fLen === 0) return null;
  // AB must be parallel to the face within eps over its length.
  const ux = (face.b[0] - face.a[0]) / fLen, uy = (face.b[1] - face.a[1]) / fLen;
  const offA = Math.abs((a[0] - face.a[0]) * -uy + (a[1] - face.a[1]) * ux);
  const offB = Math.abs((b[0] - face.a[0]) * -uy + (b[1] - face.a[1]) * ux);
  if (offA > eps || offB > eps) return null;
  const proj = (p: Pt) => (p[0] - face.a[0]) * ux + (p[1] - face.a[1]) * uy;
  const pa = proj(a), pb = proj(b);
  const lo = Math.max(Math.min(pa, pb), 0), hi = Math.min(Math.max(pa, pb), fLen);
  if (hi - lo <= eps) return null;
  const toT = (s: number) => (pb === pa ? 0 : (s - pa) / (pb - pa));
  const t0 = Math.max(0, Math.min(1, toT(lo))), t1 = Math.max(0, Math.min(1, toT(hi)));
  return t0 < t1 ? [t0, t1] : [t1, t0];
}

/** Unit normal of AB pointing to the free side, or null when neither/both sides are free. */
function freeNormal(a: Pt, b: Pt, at: Pt, ctx: FaceContext): [number, number] | null {
  const len = dist(a, b);
  const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
  const probe = Math.max(ctx.epsilon * 50, 1e-6);
  const plusInside = ctx.inside([at[0] + nx * probe, at[1] + ny * probe]);
  const minusInside = ctx.inside([at[0] - nx * probe, at[1] - ny * probe]);
  if (plusInside === minusInside) return null;
  // `+ 0` turns -0 into 0: a normal is data, not a sign artefact.
  return plusInside ? [-nx + 0, -ny + 0] : [nx + 0, ny + 0];
}

/**
 * Split every stored segment into face pieces and free pieces (ТЗ §3).
 * An internal opening between collinear pieces of the same body face inherits
 * their free side: a door is optically open, but it does not bend the strip.
 */
export function stripPieces(points: readonly Pt[], ctx: FaceContext | null): StripPiece[] {
  const path = compactPoints(points);
  const pieces: StripPiece[] = [];
  let faces = ctx?.faces ?? [];
  if (ctx?.near && path.length) {
    const xs = path.map((p) => p[0]), ys = path.map((p) => p[1]), e = ctx.epsilon * 2;
    faces = ctx.near([Math.min(...xs) - e, Math.min(...ys) - e, Math.max(...xs) + e, Math.max(...ys) + e]);
  }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const local: Array<StripPiece & { matched: boolean }> = [];
    const intervals: Array<[number, number]> = [];
    if (ctx) {
      for (const face of faces) {
        const hit = overlapOnFace(a, b, face, ctx.epsilon);
        if (hit) intervals.push(hit);
      }
    }
    intervals.sort((x, y) => x[0] - y[0]);
    const merged: Array<[number, number]> = [];
    for (const interval of intervals) {
      const last = merged[merged.length - 1];
      if (last && interval[0] <= last[1] + 1e-12) last[1] = Math.max(last[1], interval[1]);
      else merged.push([interval[0], interval[1]]);
    }
    let cursor = 0;
    for (const [t0, t1] of merged) {
      if (t0 > cursor) local.push({ a: lerp(a, b, cursor), b: lerp(a, b, t0), free: null, matched: false });
      const pa = lerp(a, b, t0), pb = lerp(a, b, t1);
      const mid = lerp(a, b, (t0 + t1) / 2);
      local.push({ a: pa, b: pb, free: ctx ? freeNormal(a, b, mid, ctx) : null, matched: true });
      cursor = t1;
    }
    if (cursor < 1) local.push({ a: lerp(a, b, cursor), b: [b[0], b[1]], free: null, matched: false });

    // A door/gate/passage cuts a gap out of a physical face. The stored strip
    // still follows one straight wall side through that gap, so keep the free
    // side selected by the two flanking face pieces. Leading/trailing free
    // pieces are deliberately not inherited: a strip that actually leaves a
    // wall must still return to its stored path.
    for (let j = 1; j + 1 < local.length; j++) {
      const prev = local[j - 1], gap = local[j], next = local[j + 1];
      if (gap.matched || !prev.matched || !next.matched || !prev.free || !next.free) continue;
      if (Math.hypot(prev.free[0] - next.free[0], prev.free[1] - next.free[1]) <= 1e-9) {
        gap.free = [prev.free[0], prev.free[1]];
      }
    }
    pieces.push(...local.map(({ a: pa, b: pb, free }) => ({ a: pa, b: pb, free })));
  }
  return pieces.filter((piece) => dist(piece.a, piece.b) > 0);
}

function shiftedLineIntersection(
  prev: StripPiece, next: StripPiece, offset: number,
): [number, number] | null {
  if (!prev.free || !next.free || !same(prev.b, next.a)) return null;
  const pa: [number, number] = [prev.a[0] + prev.free[0] * offset, prev.a[1] + prev.free[1] * offset];
  const pb: [number, number] = [prev.b[0] + prev.free[0] * offset, prev.b[1] + prev.free[1] * offset];
  const qa: [number, number] = [next.a[0] + next.free[0] * offset, next.a[1] + next.free[1] * offset];
  const qb: [number, number] = [next.b[0] + next.free[0] * offset, next.b[1] + next.free[1] * offset];
  const r = sub(pb, pa), s = sub(qb, qa);
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) <= 1e-12) return null;
  const qmp = sub(qa, pa);
  const t = (qmp[0] * s[1] - qmp[1] * s[0]) / den;
  const hit: [number, number] = [pa[0] + r[0] * t, pa[1] + r[1] * t];
  // Acute angles can put an infinite-line intersection far away. Keep the
  // existing short connector there instead of producing a long miter spike.
  const maxMiter = Math.max(Math.abs(offset) * 4, 1e-9);
  return dist(hit, pb) <= maxMiter && dist(hit, qa) <= maxMiter ? hit : null;
}

function redundantCollinear(a: Pt, b: Pt, c: Pt): boolean {
  const ab = sub(b, a), bc = sub(c, b);
  const scale = Math.max(1, Math.hypot(...ab) * Math.hypot(...bc));
  const cross = ab[0] * bc[1] - ab[1] * bc[0];
  const forward = ab[0] * bc[0] + ab[1] * bc[1];
  return Math.abs(cross) <= 1e-12 * scale && forward >= -1e-12;
}

function simplifyVisiblePoints(points: Array<[number, number]>, closed: boolean): Array<[number, number]> {
  const out = [...points];
  let changed = true;
  while (changed && out.length > (closed ? 3 : 2)) {
    changed = false;
    const first = closed ? 0 : 1, last = closed ? out.length : out.length - 1;
    for (let i = first; i < last; i++) {
      const prev = out[(i - 1 + out.length) % out.length];
      const next = out[(i + 1) % out.length];
      if (!redundantCollinear(prev, out[i], next)) continue;
      out.splice(i, 1);
      changed = true;
      break;
    }
  }
  return out;
}

/**
 * The derived visible path (ТЗ §3): a face piece shifted `offset` along its
 * free normal, a free piece unshifted. Shifted sides meeting at a real corner
 * meet at their bounded line intersection; wall/free transitions and unsafe
 * acute angles retain the short connector — no gap and no long miter spike.
 * Closed strips close through the same rule. Shared by both strokes, the hit
 * path, focus and 2.5D: one derivation, never a stored position.
 */
export function visibleStripPath(
  points: readonly Pt[], ctx: FaceContext | null, offset: number,
): { points: Array<[number, number]>; closed: boolean } {
  const closed = isClosedStrip(compactPoints(points));
  const pieces = stripPieces(points, ctx);
  const shifted = pieces.map((piece) => {
    const shift = piece.free ? [piece.free[0] * offset, piece.free[1] * offset] : [0, 0];
    return {
      a: [piece.a[0] + shift[0], piece.a[1] + shift[1]] as [number, number],
      b: [piece.b[0] + shift[0], piece.b[1] + shift[1]] as [number, number],
    };
  });
  const joins: Array<[number, number] | null> = pieces.map(() => null);
  for (let i = 0; i + 1 < pieces.length; i++) {
    joins[i] = shiftedLineIntersection(pieces[i], pieces[i + 1], offset);
  }
  if (closed && pieces.length > 1) {
    joins[pieces.length - 1] = shiftedLineIntersection(pieces[pieces.length - 1], pieces[0], offset);
  }
  const out: Array<[number, number]> = [];
  const push = (p: [number, number]) => {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-12) out.push(p);
  };
  for (let i = 0; i < pieces.length; i++) {
    const previousJoin = i > 0 ? joins[i - 1] : closed ? joins[pieces.length - 1] : null;
    push(previousJoin ?? shifted[i].a);
    push(joins[i] ?? shifted[i].b);
  }
  if (closed && out.length > 2) {
    const first = out[0], last = out[out.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-12) out.pop();
  }
  return { points: simplifyVisiblePoints(out, closed), closed };
}

export function pathD(path: { points: ReadonlyArray<Pt>; closed: boolean }): string {
  if (!path.points.length) return '';
  const body = path.points.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  return path.closed ? `${body} Z` : body;
}

/**
 * Light emitters along the strip (ТЗ §6): every vertex and evenly spaced
 * points no farther apart than `spacing`. On a face piece the emitter sits
 * `epsilon` outward into free floor — never inside the masonry and never the
 * visual `t/2`. Emitters strictly inside an opaque body are dropped: a buried
 * part does not glow.
 */
export function emitterSamples(
  points: readonly Pt[], ctx: FaceContext | null, spacing: number,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const step = spacing > 0 ? spacing : Infinity;
  for (const piece of stripPieces(points, ctx)) {
    const len = dist(piece.a, piece.b);
    const n = Math.max(1, Math.ceil(len / step));
    const shift = piece.free && ctx ? [piece.free[0] * ctx.epsilon, piece.free[1] * ctx.epsilon] : [0, 0];
    for (let k = 0; k <= n; k++) {
      const p = lerp(piece.a, piece.b, k / n);
      const s: [number, number] = [p[0] + shift[0], p[1] + shift[1]];
      if (ctx && ctx.inside(s)) continue;
      const last = out[out.length - 1];
      if (!last || Math.hypot(last[0] - s[0], last[1] - s[1]) > 1e-12) out.push(s);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Placement: a strip may touch and follow a face but never pass through a body.

export interface PlacementBodies {
  /** Opaque bodies for placement: masonry with doors/gates/passages cut, windows NOT cut. */
  rings: ReadonlyArray<ReadonlyArray<Pt>>;
  inside: (point: Pt) => boolean;
}

function segmentParams(a: Pt, b: Pt, c: Pt, d: Pt): number | null {
  const r = sub(b, a), s = sub(d, c);
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-15) return null;
  const q = sub(c, a);
  const t = (q[0] * s[1] - q[1] * s[0]) / den;
  const u = (q[0] * r[1] - q[1] * r[0]) / den;
  if (t < -1e-12 || t > 1 + 1e-12 || u < -1e-12 || u > 1 + 1e-12) return null;
  return Math.max(0, Math.min(1, t));
}

/**
 * The farthest safe point on `from → to` (ТЗ §6): the walk stops at the first
 * face it would cross into a body's interior. Touching or sliding along a face
 * is allowed. Returns `{ point, stopped }`; `null` when `from` is inside a body.
 */
export function clampToBodies(
  from: Pt, to: Pt, bodies: PlacementBodies,
): { point: [number, number]; stopped: boolean } | null {
  if (bodies.inside(from)) return null;
  const params = [0, 1];
  for (const ring of bodies.rings) {
    for (let i = 0; i < ring.length; i++) {
      const c = ring[i], d = ring[(i + 1) % ring.length];
      const t = segmentParams(from, to, c, d);
      if (t != null) params.push(t);
    }
  }
  const sorted = [...new Set(params.map((t) => Math.round(t * 1e12) / 1e12))].sort((x, y) => x - y);
  for (let i = 1; i < sorted.length; i++) {
    const mid = lerp(from, to, (sorted[i - 1] + sorted[i]) / 2);
    if (bodies.inside(mid)) {
      return { point: lerp(from, to, sorted[i - 1]), stopped: true };
    }
  }
  return { point: [to[0], to[1]], stopped: false };
}

/**
 * A moved vertex: both neighbouring segments and the drag path itself must
 * stay clear (ТЗ §6). Returns the last safe position along `previous → wanted`.
 */
export function clampVertexMove(
  points: readonly Pt[], index: number, wanted: Pt, bodies: PlacementBodies,
): [number, number] {
  const previous = points[index];
  if (!previous) return [wanted[0], wanted[1]];
  const closed = isClosedStrip(points);
  const last = points.length - 1;
  const isEnd = closed && (index === 0 || index === last);
  const prev: Pt | null = isEnd ? points[last - 1] : index > 0 ? points[index - 1] : null;
  const next: Pt | null = isEnd ? points[1] : index < last ? points[index + 1] : null;
  const clear = (p: Pt) => !bodies.inside(p)
    && (!prev || !clampToBodies(prev, p, bodies)?.stopped)
    && (!next || !clampToBodies(next, p, bodies)?.stopped);
  const path = clampToBodies(previous, wanted, bodies);
  let candidate: [number, number] = path ? path.point : [previous[0], previous[1]];
  if (clear(candidate)) return candidate;
  // Binary search back towards the last known-clear position.
  let lo = 0, hi = 1;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (clear(lerp(previous, candidate, mid))) lo = mid;
    else hi = mid;
  }
  candidate = lerp(previous, candidate, lo);
  return candidate;
}

// ---------------------------------------------------------------------------
// Hit-testing in screen space (ТЗ §7).

export interface ScreenStrip {
  id: string;
  /** The derived visible path already projected to screen pixels. */
  points: ReadonlyArray<Pt>;
  closed: boolean;
  /** Visible stripe thickness on screen, CSS px. */
  thicknessPx: number;
}

export function stripHitRadiusPx(thicknessPx: number): number {
  return Math.max(LED_HIT_MIN_CSS_PX, thicknessPx / 2);
}

export function distanceToScreenStrip(p: Pt, strip: ScreenStrip): number {
  const pts = strip.points;
  if (!pts.length) return Infinity;
  if (pts.length === 1) return dist(p, pts[0]);
  let best = Infinity;
  const count = strip.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i++) {
    best = Math.min(best, pointSegmentDistance(p, pts[i], pts[(i + 1) % pts.length]));
  }
  return best;
}

/**
 * The strip that owns a pointer (ТЗ §7): nearest visible stripe within its own
 * hit radius; ties go to the stable id. Icons win over strips — the caller
 * asks the icon owner first and only falls back to this.
 */
export function stripHitOwner(p: Pt, strips: readonly ScreenStrip[]): string | null {
  let owner: string | null = null;
  let best = Infinity;
  for (const strip of strips) {
    const d = distanceToScreenStrip(p, strip);
    if (d > stripHitRadiusPx(strip.thicknessPx)) continue;
    if (d < best || (d === best && owner != null && strip.id < owner)) {
      best = d;
      owner = strip.id;
    }
  }
  return owner;
}
