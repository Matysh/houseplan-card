/**
 * Partial open (virtual) wall spans — docs/superpowers/specs/2026-08-05-open-spans-delete-design.md
 *
 * Stored on the space as `open_spans: [{ a, b }]` in normalised 0..1 coords.
 * `rooms[].open_to` remains the light-zone connectivity index derived from spans.
 */
import { roomPoly, sharedBoundary, distToSegment, roomEdges } from './logic';
import {
  wallKey, wallDir, wallAngleMatches, thicknessCmAt, setWallThickness,
  DRAW_WALL_DEFAULT_CM, type WallEntry,
} from './wall-thickness';

/** One virtual stretch in config space (normalised 0..1). */
export interface OpenSpanEntry {
  a: number[];
  b: number[];
}

export const OPEN_SPAN_MIN_UNITS = 1e-3;

function qn(v: number, pitch: number): number {
  if (!(pitch > 0) || !Number.isFinite(v)) return v;
  return Math.round(v / pitch) * pitch;
}

/** Render-space segment → normalised entry (pitch = GRID_STEP_N). */
export function spanToEntry(a: number[], b: number[], coordScale: number): OpenSpanEntry {
  const s = coordScale > 0 ? coordScale : 1;
  return {
    a: [a[0] / s, a[1] / s],
    b: [b[0] / s, b[1] / s],
  };
}

export function entryToSeg(e: OpenSpanEntry, coordScale: number): number[] {
  const s = coordScale > 0 ? coordScale : 1;
  return [e.a[0] * s, e.a[1] * s, e.b[0] * s, e.b[1] * s];
}

function finitePoint(p: any): boolean {
  return Array.isArray(p) && p.length >= 2
    && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));
}

/**
 * Fail-soft read of `space.open_spans` (AUD-159B6-03). The field is persisted
 * data: an old client, a hand-edited YAML or a broken import can put anything
 * there, and one malformed entry used to throw inside render and blank the
 * card for every reader. Anything that is not two finite points a minimum
 * length apart is dropped, the rest keeps working.
 */
export function sanitizeOpenSpans(spans: unknown): OpenSpanEntry[] {
  if (!Array.isArray(spans)) return [];
  const out: OpenSpanEntry[] = [];
  for (const e of spans) {
    if (!e || typeof e !== 'object') continue;
    const raw = e as any;
    if (!finitePoint(raw.a) || !finitePoint(raw.b)) continue;
    const a = [Number(raw.a[0]), Number(raw.a[1])];
    const b = [Number(raw.b[0]), Number(raw.b[1])];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < OPEN_SPAN_MIN_UNITS) continue;
    out.push({ a, b });
  }
  return out;
}

export function spanKey(a: number[], b: number[], pitch: number, coordScale = 1): string {
  if (coordScale === 1) return wallKey(a, b, pitch);
  return wallKey([a[0] / coordScale, a[1] / coordScale], [b[0] / coordScale, b[1] / coordScale], pitch);
}

function sameSpan(x: OpenSpanEntry, y: OpenSpanEntry, pitch: number): boolean {
  return spanKey(x.a, x.b, pitch, 1) === spanKey(y.a, y.b, pitch, 1);
}

/** Project point onto segment; return clamped point + param t in [0,1]. */
export function projectOnSeg(p: number[], seg: number[]): { q: number[]; t: number; d: number } {
  const ax = seg[0], ay = seg[1], bx = seg[2], by = seg[3];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-18) {
    const q = [ax, ay];
    return { q, t: 0, d: Math.hypot(p[0] - ax, p[1] - ay) };
  }
  let t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const q = [ax + t * dx, ay + t * dy];
  return { q, t, d: Math.hypot(p[0] - q[0], p[1] - q[1]) };
}

/** Clamp P2 to the edge that holds P1 (nearest corners = edge endpoints). */
export function clampToEdgeEnds(p: number[], edge: number[]): number[] {
  return projectOnSeg(p, edge).q;
}

/**
 * Snap a raw point onto a shared-wall edge: corners / existing joints first,
 * else grid along the wall.
 */
export function snapOpenPoint(
  raw: number[],
  edge: number[],
  joints: number[][],
  gridPitch: number,
  jointPull: number,
): number[] {
  const on = projectOnSeg(raw, edge).q;
  let best = on;
  let bestD = Infinity;
  for (const j of joints) {
    const d = Math.hypot(on[0] - j[0], on[1] - j[1]);
    if (d <= jointPull && d < bestD) {
      bestD = d;
      best = [j[0], j[1]];
    }
  }
  if (bestD <= jointPull) return best;
  // grid along the edge from the first corner
  const ax = edge[0], ay = edge[1], bx = edge[2], by = edge[3];
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const along = ((on[0] - ax) * dx + (on[1] - ay) * dy) / len;
  const step = gridPitch > 0 ? gridPitch : 1;
  const snapped = Math.round(along / step) * step;
  const u = Math.max(0, Math.min(len, snapped)) / len;
  return [ax + dx * u, ay + dy * u];
}

/** All shared-boundary segments between rooms (render units). */
export function allSharedSegs(rooms: any[], eps: number): number[][] {
  const out: number[][] = [];
  const list = (rooms || []).filter((r) => r?.id);
  for (let i = 0; i < list.length; i++) {
    const pa = roomPoly(list[i]);
    if (!pa) continue;
    for (let j = i + 1; j < list.length; j++) {
      const pb = roomPoly(list[j]);
      if (!pb) continue;
      for (const sg of sharedBoundary(pa, pb, eps)) out.push(sg);
    }
  }
  return out;
}

/** Find shared edge under a point; returns rooms + the atomic shared segment. */
export function hitSharedWall(
  raw: number[],
  rooms: any[],
  pull: number,
  eps: number,
): { a: any; b: any; edge: number[] } | null {
  const list = (rooms || []).filter((r) => r?.id);
  let best: { a: any; b: any; edge: number[]; d: number } | null = null;
  for (let i = 0; i < list.length; i++) {
    const pa = roomPoly(list[i]);
    if (!pa) continue;
    for (let j = i + 1; j < list.length; j++) {
      const pb = roomPoly(list[j]);
      if (!pb) continue;
      for (const sg of sharedBoundary(pa, pb, eps)) {
        const d = distToSegment(raw, sg);
        if (d <= pull && (!best || d < best.d)) best = { a: list[i], b: list[j], edge: sg, d };
      }
    }
  }
  return best ? { a: best.a, b: best.b, edge: best.edge } : null;
}

/** Outer room edge under the cursor (not shared). */
export function hitOuterWall(
  raw: number[],
  rooms: any[],
  pull: number,
  eps: number,
): { room: any; edge: number[] } | null {
  const shared = allSharedSegs(rooms, eps);
  let best: { room: any; edge: number[]; d: number } | null = null;
  for (const room of rooms || []) {
    if (!room?.id) continue;
    const poly = roomPoly(room);
    if (!poly) continue;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const edge = [a[0], a[1], b[0], b[1]];
      const d = distToSegment(raw, edge);
      if (d > pull) continue;
      // skip if this edge coincides with a shared stretch
      let isShared = false;
      for (const sg of shared) {
        if (distToSegment([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], sg) < eps * 2) {
          isShared = true;
          break;
        }
      }
      if (isShared) continue;
      if (!best || d < best.d) best = { room, edge, d };
    }
  }
  return best ? { room: best.room, edge: best.edge } : null;
}

/** Expand legacy open_to (no spans) into full sharedBoundary entries. */
export function expandLegacyOpenSpans(
  rooms: any[],
  spans: OpenSpanEntry[] | null | undefined,
  eps: number,
): OpenSpanEntry[] {
  const clean = sanitizeOpenSpans(spans);
  if (clean.length) return clean;
  const out: OpenSpanEntry[] = [];
  const list = (rooms || []).filter((r) => r?.id);
  const linked = (x: any, y: any) =>
    (x.open_to || []).includes(y.id) || (y.open_to || []).includes(x.id);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (!linked(list[i], list[j])) continue;
      const pa = roomPoly(list[i]), pb = roomPoly(list[j]);
      if (!pa || !pb) continue;
      // roomPoly is already in render units when rooms come from the model;
      // callers that pass config-space polys must pre-scale. We accept both:
      // if coords look normalised (≤2), treat as config and leave as-is.
      for (const sg of sharedBoundary(pa, pb, eps)) {
        const maxC = Math.max(...sg.map(Math.abs));
        if (maxC <= 2) {
          out.push({ a: [sg[0], sg[1]], b: [sg[2], sg[3]] });
        } else {
          // render → will be converted by caller; store raw and let caller scale
          out.push({ a: [sg[0], sg[1]], b: [sg[2], sg[3]] });
        }
      }
    }
  }
  return out;
}

/**
 * Resolve open cuts in RENDER units. `spans` are normalised; `rooms` from
 * spaceModel (render polys). Legacy: empty spans + open_to → full shared segs.
 */
export function resolveOpenCuts(
  rooms: any[],
  spans: OpenSpanEntry[] | null | undefined,
  coordScale: number,
  eps: number,
  allowLegacy = true,
): number[][] {
  const list = (rooms || []).filter((r) => r?.id);
  const clean = sanitizeOpenSpans(spans);
  if (clean.length) return clean.map((e) => entryToSeg(e, coordScale));
  // Legacy `open_to`-only configuration. NEVER read in the middle of a geometry
  // transaction (AUD-159B6-02): once explicit spans have been removed the index
  // is stale by construction and would resurrect a different stretch.
  if (!allowLegacy) return [];
  const out: number[][] = [];
  const linked = (x: any, y: any) =>
    (x.open_to || []).includes(y.id) || (y.open_to || []).includes(x.id);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (!linked(list[i], list[j])) continue;
      const pa = roomPoly(list[i]), pb = roomPoly(list[j]);
      if (!pa || !pb) continue;
      for (const sg of sharedBoundary(pa, pb, eps)) out.push(sg);
    }
  }
  return out;
}

/** Persistable spans from current cuts (normalised). */
export function cutsToSpanEntries(cuts: number[][], coordScale: number): OpenSpanEntry[] {
  return cuts.map((sg) => spanToEntry([sg[0], sg[1]], [sg[2], sg[3]], coordScale));
}

/** Sync open_to from geometric spans (render cuts + rooms with render polys). */
export function syncOpenToFromCuts(roomsCfg: any[], roomsModel: any[], cuts: number[][], eps: number): void {
  // clear all open_to first
  for (const r of roomsCfg || []) {
    if (r.open_to) delete r.open_to;
  }
  if (!cuts.length) return;
  const model = (roomsModel || []).filter((r) => r?.id);
  const byId = new Map(model.map((r) => [r.id, r]));
  const cfgById = new Map((roomsCfg || []).filter((r) => r?.id).map((r) => [r.id, r]));
  const link = (ia: string, ib: string) => {
    const a = cfgById.get(ia), b = cfgById.get(ib);
    if (!a || !b) return;
    if (!(a.open_to || []).includes(ib)) a.open_to = [...(a.open_to || []), ib];
    if (!(b.open_to || []).includes(ia)) b.open_to = [...(b.open_to || []), ia];
  };
  for (let i = 0; i < model.length; i++) {
    for (let j = i + 1; j < model.length; j++) {
      const pa = roomPoly(model[i]), pb = roomPoly(model[j]);
      if (!pa || !pb) continue;
      const shared = sharedBoundary(pa, pb, eps);
      if (!shared.length) continue;
      for (const cut of cuts) {
        const mid = [(cut[0] + cut[2]) / 2, (cut[1] + cut[3]) / 2];
        if (shared.some((sg) => distToSegment(mid, sg) < eps * 4)) {
          link(model[i].id!, model[j].id!);
          break;
        }
      }
    }
  }
  for (const r of roomsCfg || []) {
    if (r.open_to && !r.open_to.length) delete r.open_to;
  }
  void byId;
}

export function hitOpenSpan(
  raw: number[],
  cuts: number[][],
  pull: number,
): number[] | null {
  let best: { sg: number[]; d: number } | null = null;
  for (const sg of cuts) {
    const d = distToSegment(raw, sg);
    if (d <= pull && (!best || d < best.d)) best = { sg, d };
  }
  return best ? best.sg : null;
}

/** Remove wall thickness entries whose midpoint lies on the open span. */
export function clearThicknessUnderSpan(
  walls: WallEntry[] | null | undefined,
  a: number[], b: number[],
  pitch: number,
  coordScale = 1,
): WallEntry[] {
  if (!walls?.length) return [];
  const tol = Math.max(pitch * 0.5, 1e-9) * (coordScale > 0 ? coordScale : 1);
  const [dx, dy] = wallDir(
    [a[0] / coordScale, a[1] / coordScale],
    [b[0] / coordScale, b[1] / coordScale],
  );
  let wang = Math.atan2(dy, dx);
  if (wang < 0) wang += Math.PI;
  return walls.filter((w) => {
    const at = w.key.lastIndexOf('@');
    if (at < 0) return true;
    const [sx, sy] = w.key.slice(0, at).split(',').map(Number);
    const aq = Number(w.key.slice(at + 1));
    if (![sx, sy, aq].every(Number.isFinite)) return true;
    let dAng = Math.abs(aq - wang);
    if (dAng > Math.PI / 2) dAng = Math.PI - dAng;
    if (dAng >= 0.02) return true;
    const dist = distToSegment(
      [sx * coordScale, sy * coordScale],
      [a[0], a[1], b[0], b[1]],
    );
    return dist > tol;
  });
}

/**
 * Thickness to apply when closing a span: neighbour solid on same line, else default.
 */
export function thicknessOnClose(
  walls: WallEntry[] | null | undefined,
  closed: number[],
  solidEdges: number[][],
  pitch: number,
  coordScale = 1,
  fallbackCm = DRAW_WALL_DEFAULT_CM,
): number {
  const [dx, dy] = wallDir([closed[0], closed[1]], [closed[2], closed[3]]);
  let bestCm = 0;
  let bestD = Infinity;
  const mid = [(closed[0] + closed[2]) / 2, (closed[1] + closed[3]) / 2];
  for (const sg of solidEdges) {
    const [ex, ey] = wallDir([sg[0], sg[1]], [sg[2], sg[3]]);
    if (Math.abs(dx * ey - dy * ex) > 0.05) continue;
    // collinear-ish: neighbour mid distance along line
    const cm = thicknessCmAt(walls, [sg[0], sg[1]], [sg[2], sg[3]], pitch, coordScale);
    if (!(cm > 0)) continue;
    const sm = [(sg[0] + sg[2]) / 2, (sg[1] + sg[3]) / 2];
    const d = Math.hypot(sm[0] - mid[0], sm[1] - mid[1]);
    if (d < bestD) {
      bestD = d;
      bestCm = cm;
    }
  }
  return bestCm > 0 ? bestCm : fallbackCm;
}

export function applyThicknessOnClose(
  walls: WallEntry[] | null | undefined,
  closed: number[],
  solidEdges: number[][],
  pitch: number,
  coordScale = 1,
  fallbackCm = DRAW_WALL_DEFAULT_CM,
): WallEntry[] {
  const cm = thicknessOnClose(walls, closed, solidEdges, pitch, coordScale, fallbackCm);
  return setWallThickness(walls, [closed[0], closed[1]], [closed[2], closed[3]], cm, pitch, coordScale);
}

/** Drop openings whose centre lies on the span (angle-aware). */
export function purgeOpeningsOnSpan(
  openings: any[] | null | undefined,
  span: number[],
  coordScale: number,
  pull: number,
): any[] {
  if (!openings?.length) return openings ? openings.slice() : [];
  return openings.filter((o) => {
    const x = Number(o.x) * coordScale;
    const y = Number(o.y) * coordScale;
    if (distToSegment([x, y], span) > pull) return true;
    if (!wallAngleMatches([span[0], span[1]], [span[2], span[3]], Number(o.angle) || 0)) return true;
    return false; // on span → remove
  });
}

/** True if an opening placement point sits on a virtual cut. */
export function pointOnOpenCut(
  x: number, y: number, angle: number,
  cuts: number[][],
  pull: number,
): boolean {
  for (const sg of cuts) {
    if (distToSegment([x, y], sg) > pull) continue;
    if (wallAngleMatches([sg[0], sg[1]], [sg[2], sg[3]], angle)) return true;
  }
  return false;
}

/** Joints for snap: edge ends + open-span ends on the same edge line. */
export function jointsOnEdge(edge: number[], cuts: number[][], eps: number): number[][] {
  const joints: number[][] = [
    [edge[0], edge[1]],
    [edge[2], edge[3]],
  ];
  const mid = [(edge[0] + edge[2]) / 2, (edge[1] + edge[3]) / 2];
  for (const sg of cuts) {
    if (distToSegment(mid, sg) > Math.hypot(edge[2] - edge[0], edge[3] - edge[1]) &&
        distToSegment([sg[0], sg[1]], edge) > eps) continue;
    // endpoints that lie on this edge
    for (const p of [[sg[0], sg[1]], [sg[2], sg[3]]]) {
      if (distToSegment(p, edge) <= eps * 2) joints.push(p);
    }
  }
  return joints;
}

/** Remove a cut matching endpoints (tolerant). */
export function removeCut(cuts: number[][], target: number[], eps: number): number[][] {
  const tMid = [(target[0] + target[2]) / 2, (target[1] + target[3]) / 2];
  return cuts.filter((sg) => {
    const m = [(sg[0] + sg[2]) / 2, (sg[1] + sg[3]) / 2];
    return Math.hypot(m[0] - tMid[0], m[1] - tMid[1]) > eps * 4;
  });
}

/** Degrade span entries whose segment no longer lies on any shared boundary. */
export function degradeOpenSpans(
  spans: OpenSpanEntry[] | null | undefined,
  roomsModel: any[],
  coordScale: number,
  eps: number,
): OpenSpanEntry[] {
  const clean = sanitizeOpenSpans(spans);
  if (!clean.length) return [];
  const shared = allSharedSegs(roomsModel, eps);
  return clean.filter((e) => {
    const sg = entryToSeg(e, coordScale);
    const mid = [(sg[0] + sg[2]) / 2, (sg[1] + sg[3]) / 2];
    return shared.some((sh) => distToSegment(mid, sh) < eps * 4);
  });
}

/**
 * Project each open span onto the current shared-boundary geometry and clip
 * to the overlap. Spans that no longer overlap any shared stretch are dropped.
 * Prevents "solid outline + dashed open" after resize when a span drifts off
 * the true shared edge.
 */
export function clipOpenSpansToShared(
  spans: OpenSpanEntry[] | null | undefined,
  roomsModel: any[],
  coordScale: number,
  eps: number,
): OpenSpanEntry[] {
  const clean = sanitizeOpenSpans(spans);
  if (!clean.length) return [];
  const shared = allSharedSegs(roomsModel, eps);
  if (!shared.length) return [];
  const out: OpenSpanEntry[] = [];
  const minLen = Math.max(eps * 4, 1e-6);
  for (const e of clean) {
    const sg = entryToSeg(e, coordScale);
    const ax = sg[0], ay = sg[1], bx = sg[2], by = sg[3];
    const adx = bx - ax, ady = by - ay;
    const aLen = Math.hypot(adx, ady);
    if (aLen < minLen) continue;
    const ux = adx / aLen, uy = ady / aLen;
    let best: { lo: number; hi: number } | null = null;
    for (const sh of shared) {
      // both endpoints of `sh` must lie on the line of sg
      const d1 = Math.abs((sh[0] - ax) * uy - (sh[1] - ay) * ux);
      const d2 = Math.abs((sh[2] - ax) * uy - (sh[3] - ay) * ux);
      if (d1 > eps * 4 || d2 > eps * 4) continue;
      const t1 = (sh[0] - ax) * ux + (sh[1] - ay) * uy;
      const t2 = (sh[2] - ax) * ux + (sh[3] - ay) * uy;
      const lo = Math.max(0, Math.min(t1, t2));
      const hi = Math.min(aLen, Math.max(t1, t2));
      if (hi - lo < minLen) continue;
      if (!best || hi - lo > best.hi - best.lo) best = { lo, hi };
    }
    if (!best) continue;
    const na = [ax + ux * best.lo, ay + uy * best.lo];
    const nb = [ax + ux * best.hi, ay + uy * best.hi];
    if (Math.hypot(nb[0] - na[0], nb[1] - na[1]) < minLen) continue;
    out.push(spanToEntry(na, nb, coordScale));
  }
  return out;
}

/** Rekey span endpoints after parallel old→new edge moves (render units). */
export function rekeyOpenSpansAfterMove(
  spans: OpenSpanEntry[] | null | undefined,
  oldSpans: [number[], number[]][],
  newSpans: [number[], number[]][],
  coordScale: number,
): OpenSpanEntry[] {
  const clean = sanitizeOpenSpans(spans);
  if (!clean.length) return [];
  if (oldSpans.length !== newSpans.length) return clean;
  const out: OpenSpanEntry[] = [];
  for (const e of clean) {
    const sg = entryToSeg(e, coordScale);
    const a = [sg[0], sg[1]], b = [sg[2], sg[3]];
    let na = a, nb = b;
    for (let i = 0; i < oldSpans.length; i++) {
      const [oa, ob] = oldSpans[i];
      const [xa, xb] = newSpans[i];
      // map endpoints that sat on the old span
      const mapPt = (p: number[]): number[] => {
        const pr = projectOnSeg(p, [oa[0], oa[1], ob[0], ob[1]]);
        if (pr.d > 1e-3) return p;
        const dx = xb[0] - xa[0], dy = xb[1] - xa[1];
        return [xa[0] + dx * pr.t, xa[1] + dy * pr.t];
      };
      if (projectOnSeg([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [oa[0], oa[1], ob[0], ob[1]]).d < 1e-2) {
        na = mapPt(a);
        nb = mapPt(b);
        break;
      }
    }
    out.push(spanToEntry(na, nb, coordScale));
  }
  return out;
}

export { qn, roomEdges, sameSpan };
