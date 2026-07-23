/**
 * Pure functions with no Lit/DOM dependencies — easy to cover with unit tests.
 */
import { union } from 'polyclip-ts';

/** Zigbee LQI color: ≤40 — red, ≥180 — green, in between — an hsl gradient. */
export function lqiColor(lqi: number): string {
  const hue = Math.max(0, Math.min(120, ((lqi - 40) / 140) * 120));
  return `hsl(${Math.round(hue)}, 85%, 55%)`;
}

/** Snap a coordinate to the nearest grid node with step pitch. */
export function snapToGrid(v: number, pitch: number): number {
  return Math.round(v / pitch) * pitch;
}

/** Real-world length (cm) of a segment given the grid pitch (render units per cell) and cm per cell. */
export function segmentCm(a: number[], b: number[], gridPitch: number, cellCm: number): number {
  const cells = Math.hypot(b[0] - a[0], b[1] - a[1]) / gridPitch;
  return cells * cellCm;
}

/** Format a length (cm) for display: metric metres ("1.25 m") or imperial feet+inches ("4′ 1″"). */
export function formatLength(cm: number, imperial: boolean): string {
  if (imperial) {
    const totalIn = cm / 2.54;
    let ft = Math.floor(totalIn / 12);
    let inch = Math.round(totalIn - ft * 12);
    if (inch === 12) { ft += 1; inch = 0; }
    return `${ft}′ ${inch}″`;
  }
  return `${(cm / 100).toFixed(2)} m`;
}

/**
 * Canonical key of a segment (independent of direction).
 * `prec` = decimals used to compare coordinates: the default 1 suits render units,
 * normalized (0..1) coordinates need more (see roomEdges).
 */
export function segKey(a: number[], b: number[], prec = 1): string {
  const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a];
  return `${p[0].toFixed(prec)},${p[1].toFixed(prec)}-${q[0].toFixed(prec)},${q[1].toFixed(prec)}`;
}

/**
 * Wall segments derived from room outlines (normalized coordinates in and out).
 *
 * A line has no independent existence on the plan: it can only be an edge of a closed
 * room. Shared walls are emitted once, which is what makes deleting a room keep the
 * borders its neighbours still contribute — the neighbour's polygon still yields them.
 */
export function roomPoly(r: any): number[][] | null {
  if (r?.poly?.length >= 3) return r.poly;
  if (r && r.x != null && r.y != null && r.w != null && r.h != null)
    return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  return null;
}

export function roomEdges(rooms: any[]): number[][] {
  const out: number[][] = [];
  const seen = new Set<string>();
  for (const r of rooms || []) {
    const pts = roomPoly(r);
    if (!pts) continue;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const k = segKey(a, b, 5);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push([a[0], a[1], b[0], b[1]]);
    }
  }
  return out;
}

/**
 * Snap a point onto the nearest wall of any room, returning the snapped point and
 * the wall's angle (degrees), or null when no wall is within maxDist. Walls are the
 * DERIVED room edges (a line has no independent existence on the plan), so an opening
 * placed with this stays valid however rooms are later edited — it keeps absolute
 * coordinates and is not tied to a room id or edge index.
 */
export function snapToWall(
  p: number[], rooms: any[], maxDist: number,
): { x: number; y: number; angle: number } | null {
  let best: { x: number; y: number; angle: number } | null = null;
  let bestD = maxDist;
  for (const e of roomEdges(rooms)) {
    const [x1, y1, x2, y2] = e;
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (!len2) continue;
    let t = ((p[0] - x1) * dx + (p[1] - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const q = [x1 + t * dx, y1 + t * dy];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < bestD) {
      bestD = d;
      // normalize to [-90, 90): two rooms sharing a wall yield the same edge in
      // OPPOSITE directions — without this, dragging an opening across segment
      // boundaries would flip its hinge side back and forth
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle >= 90) angle -= 180;
      else if (angle < -90) angle += 180;
      best = { x: q[0], y: q[1], angle };
    }
  }
  return best;
}

/**
 * How far open an opening is drawn, 0..1, from its contact sensor state.
 * No sensor bound → doors default to open (the familiar swing symbol), windows to
 * closed (intact glass) — same convention as a static architectural plan.
 * `unavailable`/`unknown` freeze the default too: an outage must not fake motion.
 */
export function openingAmount(
  type: 'door' | 'window', state: string | null | undefined, invert = false,
): number {
  if (state == null || state === 'unavailable' || state === 'unknown')
    return type === 'door' ? 1 : 0;
  const open = isActiveState(state) !== !!invert;
  return open ? 1 : 0;
}

/**
 * Is an entity "active / detected"? Used by presence ripples, which are opted into per
 * device and therefore must not depend on the card-wide live_states toggle.
 * Anything unknown — including `unavailable` — counts as idle: a sensor outage should
 * calm the plan down, never leave a ring pulsing forever.
 */
export function isActiveState(state?: string | null): boolean {
  return ['on', 'open', 'home', 'detected', 'playing', 'cleaning'].includes(String(state));
}

/** Point equality within a tolerance. */
export function samePoint(a: number[], b: number[], eps = 0.001): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

/** Point inside a polygon (ray casting). */
export function pointInPolygon(p: number[], poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from p to segment ab. */
function distToSeg(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Is p on the outline itself (within eps)? This is the normal case, not an anomaly:
 * neighbouring rooms share walls, so their vertices sit on each other's outlines —
 * including mid-span, since real walls overlap collinearly rather than match exactly.
 */
/**
 * Project a point onto the nearest edge of a polygon and return that point,
 * or null when the polygon has no edges. Used to snap a Split click onto the
 * actual wall (rooms may not be grid-aligned — imported polygons, older configs),
 * so cutting no longer requires hitting a grid node exactly on the outline.
 */
export function closestPointOnBoundary(p: number[], poly: number[][]): number[] | null {
  if (!poly || poly.length < 2) return null;
  let best: number[] | null = null;
  let bestD = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const q = [a[0] + t * dx, a[1] + t * dy];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < bestD) { bestD = d; best = q; }
  }
  return best;
}

export function pointOnBoundary(p: number[], poly: number[][], eps = 1e-6): boolean {
  if (!poly || poly.length < 2) return false;
  for (let i = 0; i < poly.length; i++)
    if (distToSeg(p, poly[i], poly[(i + 1) % poly.length]) <= eps) return true;
  return false;
}

/** Inside the outline AND not on it — a point on a shared wall is not "inside". */
export function pointStrictlyInside(p: number[], poly: number[][], eps = 1e-6): boolean {
  if (!poly || poly.length < 3) return false;
  if (pointOnBoundary(p, poly, eps)) return false;
  return pointInPolygon(p, poly);
}

function cross3(a: number[], b: number[], c: number[]): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/**
 * Do two segments cross transversally? Touching at an endpoint and collinear overlap
 * deliberately do NOT count — that is what sharing a wall looks like.
 */
export function segmentsProperlyCross(
  p1: number[], p2: number[], p3: number[], p4: number[], eps = 1e-9,
): boolean {
  const d1 = cross3(p3, p4, p1);
  const d2 = cross3(p3, p4, p2);
  const d3 = cross3(p1, p2, p3);
  const d4 = cross3(p1, p2, p4);
  return (
    ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) &&
    ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))
  );
}

/** Is any area of outline `a` strictly inside `b`? Also catches nested and duplicate outlines. */
function coversArea(a: number[][], b: number[][], eps: number): boolean {
  let allOnBoundary = true;
  for (const v of a) {
    if (pointStrictlyInside(v, b, eps)) return true;
    if (!pointOnBoundary(v, b, eps)) allOnBoundary = false;
  }
  // every vertex sits on b's outline → a duplicate or traced outline: probe the middle
  if (allOnBoundary) {
    const c = [
      a.reduce((s, p) => s + p[0], 0) / a.length,
      a.reduce((s, p) => s + p[1], 0) / a.length,
    ];
    return pointStrictlyInside(c, b, eps);
  }
  return false;
}

/** Is `inner` fully contained in `outer` (edges may touch, never cross)? */
export function polyContainsPoly(outer: number[][], inner: number[][], eps = 1e-6): boolean {
  if (!outer || !inner || outer.length < 3 || inner.length < 3) return false;
  for (let i = 0; i < inner.length; i++)
    for (let j = 0; j < outer.length; j++)
      if (segmentsProperlyCross(inner[i], inner[(i + 1) % inner.length], outer[j], outer[(j + 1) % outer.length]))
        return false;
  for (const v of inner)
    if (!pointStrictlyInside(v, outer, eps) && !pointOnBoundary(v, outer, eps)) return false;
  // identical/traced outlines are NOT containment — probe the centroid strictness both ways
  const c = [
    inner.reduce((s, p) => s + p[0], 0) / inner.length,
    inner.reduce((s, p) => s + p[1], 0) / inner.length,
  ];
  return pointStrictlyInside(c, outer, eps) && polygonArea(inner) < polygonArea(outer) - eps;
}

/**
 * Do two room outlines ILLEGALLY share floor area? Sharing a wall (fully or
 * partially) and touching at a corner are normal. Since v1.34.0 full nesting is
 * legal too (island rooms: a column inside a ring, an inner room) — only edge
 * crossings and PARTIAL overlaps are rejected.
 */
export function roomsOverlap(a: number[][], b: number[][], eps = 1e-6): boolean {
  if (!a || !b || a.length < 3 || b.length < 3) return false;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      if (segmentsProperlyCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  if (polyContainsPoly(a, b, eps) || polyContainsPoly(b, a, eps)) return false;
  return coversArea(a, b, eps) || coversArea(b, a, eps);
}

/**
 * Direct islands of `poly` among `others`: outlines fully inside it that are not
 * themselves inside a bigger island (those are subtracted by their parent).
 */
export function islandsOf(poly: number[][], others: number[][][], eps = 1e-6): number[][][] {
  const inside = others.filter((o) => polyContainsPoly(poly, o, eps));
  return inside.filter((o) => !inside.some((p) => p !== o && polyContainsPoly(p, o, eps)));
}

/** Shoelace area of an outline (absolute value). */
export function polygonArea(poly: number[][]): number {
  if (!poly || poly.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

function closedRing(poly: number[][]): number[][][] {
  return [[...poly.map((p) => [p[0], p[1]]), [poly[0][0], poly[0][1]]]];
}

/**
 * Union of two room outlines, or null when they may not be merged.
 *
 * "Adjacent" is decided by the result rather than by a separate heuristic: only rooms that
 * genuinely share a wall (fully or partially — real walls overlap collinearly rather than
 * match exactly) collapse into ONE hole-free outline. Rooms that merely touch at a corner,
 * that are apart, or whose union would enclose a hole do not, and are refused.
 */
export function mergeRooms(a: number[][], b: number[][]): number[][] | null {
  if (!a || !b || a.length < 3 || b.length < 3) return null;
  const res = union(closedRing(a) as any, closedRing(b) as any);
  if (res.length !== 1) return null;      // two pieces → not adjacent
  if (res[0].length !== 1) return null;   // a ring plus holes → not a simple room
  const pts = res[0][0].slice(0, -1).map((p: number[]) => [p[0], p[1]]); // drop the closing point
  return pts.length >= 3 ? pts : null;
}

/** Index of the outline edge that p sits on, or -1. */
function edgeIndexOf(poly: number[][], p: number[], eps: number): number {
  for (let i = 0; i < poly.length; i++)
    if (distToSeg(p, poly[i], poly[(i + 1) % poly.length]) <= eps) return i;
  return -1;
}

function dropRepeats(pts: number[][], eps: number): number[][] {
  const out: number[][] = [];
  for (const p of pts) if (!out.length || !samePoint(out[out.length - 1], p, eps)) out.push(p);
  if (out.length > 1 && samePoint(out[0], out[out.length - 1], eps)) out.pop();
  return out;
}

/**
 * Cut a room in two with a straight chord between two points on its walls.
 * Returns the two parts, or null when the cut is not a clean wall-to-wall chord:
 * an end that is not on a wall, a chord that leaves the room (concave outlines) or that
 * runs along a wall and would carve off a zero-area sliver.
 */
export function splitRoom(
  poly: number[][], a: number[], b: number[], eps = 1e-6,
): [number[][], number[][]] | null {
  return splitRoomPath(poly, [a, b], eps);
}

/**
 * Split a room along a polyline: first and last points on walls, intermediate
 * vertices strictly inside the room. A two-point path is the classic straight
 * chord. Returns the two parts, or null when the path is not a clean cut.
 */
export function splitRoomPath(
  poly: number[][], pts: number[][], eps = 1e-6,
): [number[][], number[][]] | null {
  if (!poly || poly.length < 3 || !pts || pts.length < 2) return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  if (samePoint(a, b, eps)) return null;
  const ia = edgeIndexOf(poly, a, eps);
  const ib = edgeIndexOf(poly, b, eps);
  if (ia < 0 || ib < 0) return null;                       // an end is not on a wall
  const mids = pts.slice(1, -1);
  for (const m of mids) if (!pointStrictlyInside(m, poly, eps)) return null;
  // no path segment may cross a wall
  for (let sI = 0; sI < pts.length - 1; sI++)
    for (let i = 0; i < poly.length; i++)
      if (segmentsProperlyCross(pts[sI], pts[sI + 1], poly[i], poly[(i + 1) % poly.length])) return null;
  // the path may not properly self-intersect
  for (let sI = 0; sI < pts.length - 1; sI++)
    for (let t = sI + 2; t < pts.length - 1; t++)
      if (segmentsProperlyCross(pts[sI], pts[sI + 1], pts[t], pts[t + 1])) return null;
  // a straight chord lying along a wall has its midpoint ON the outline, not inside
  if (pts.length === 2 && !pointStrictlyInside([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], poly, eps))
    return null;
  const walk = (from: number[], fromIdx: number, to: number[], toIdx: number): number[][] => {
    const acc: number[][] = [from];
    let i = (fromIdx + 1) % poly.length;
    for (let guard = 0; guard <= poly.length; guard++) {
      acc.push(poly[i]);
      if (i === toIdx) break;
      i = (i + 1) % poly.length;
    }
    acc.push(to);
    return dropRepeats(acc, eps);
  };
  const p1 = dropRepeats([...walk(a, ia, b, ib), ...[...mids].reverse()], eps);
  const p2 = dropRepeats([...walk(b, ib, a, ia), ...mids], eps);
  if (p1.length < 3 || p2.length < 3) return null;
  if (polygonArea(p1) <= eps || polygonArea(p2) <= eps) return null;
  return [p1, p2];
}

/**
 * Marker id by binding: device → device_id, entity → 'lg_'+entity_id,
 * virtual → the passed-in existing (if it is already a v_ marker) or a new one via newId().
 */
export function markerIdForBinding(
  binding: string,
  existingId: string | undefined,
  newId: () => string,
): string {
  const [kind, ref] = binding.split(':');
  if (kind === 'device') return ref;
  if (kind === 'entity') return 'lg_' + ref;
  return existingId && existingId.startsWith('v_') ? existingId : newId();
}

/** Average LQI over a set of values (or null). */
export function averageLqi(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** “Contain” rectangle with the given aspect (w/h) that fits the whole vb [x,y,w,h]. */
export function fitView(vb: number[], aspect: number): { x: number; y: number; w: number; h: number } {
  const planA = vb[2] / vb[3];
  if (aspect > planA) {
    const h = vb[3], w = vb[3] * aspect;
    return { x: vb[0] - (w - vb[2]) / 2, y: vb[1], w, h };
  }
  const w = vb[2], h = vb[2] / aspect;
  return { x: vb[0], y: vb[1] - (h - vb[3]) / 2, w, h };
}

/** Push points apart: no closer than minDist to each other, within rectangle b with padding pad. Mutates pts. */
export function declump(
  pts: { x: number; y: number }[],
  b: { x: number; y: number; w: number; h: number },
  minDist: number,
  pad: number,
): void {
  if (pts.length < 2) return;
  const minX = b.x + pad, maxX = b.x + b.w - pad, minY = b.y + pad, maxY = b.y + b.h - pad;
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist, uy = dy / dist;
          pts[i].x -= ux * push; pts[i].y -= uy * push;
          pts[j].x += ux * push; pts[j].y += uy * push;
          moved = true;
        }
      }
    }
    for (const q of pts) {
      q.x = Math.max(minX, Math.min(maxX, q.x));
      q.y = Math.max(minY, Math.min(maxY, q.y));
    }
    if (!moved) break;
  }
}

/**
 * Safe URL for <a href>: only http(s) and relative paths are allowed.
 * Rejects javascript:, data: and other dangerous schemes (XSS via config).
 */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  if (/^(https?:)?\/\//i.test(u) || u.startsWith('/') || /^[\w./#?=&%~-]+$/i.test(u)) {
    if (/^[a-z][\w+.-]*:/i.test(u) && !/^https?:/i.test(u)) return null;
    return u;
  }
  return null;
}

// ---------------- tap actions ----------------

export type TapAction = 'info' | 'more-info' | 'toggle';

/** Domains a card-wide `tap_action: toggle` may toggle (accidental-tap safe). */
export const TOGGLE_SAFE_DOMAINS = new Set(['light', 'switch', 'fan', 'humidifier']);

/**
 * Domains that must NEVER toggle from a plan tap, even with an explicit
 * per-device override: an accidental tap unlocking a door or disarming an
 * alarm is a security incident, not a UX shortcut.
 */
export const TOGGLE_FORBIDDEN_DOMAINS = new Set(['lock', 'alarm_control_panel']);

/**
 * Resolve the effective tap action for a device icon.
 *
 * Order: per-device override → card-wide default → 'info'.
 * 'toggle' is applied conservatively: a card-wide toggle only affects
 * TOGGLE_SAFE_DOMAINS; an explicit per-device toggle affects any domain
 * except TOGGLE_FORBIDDEN_DOMAINS. Everything else falls back to 'info'.
 */
export function resolveTapAction(
  explicit: string | null | undefined,
  cardDefault: string | null | undefined,
  domain: string | null | undefined,
): TapAction {
  const want = explicit || cardDefault || 'info';
  if (want === 'more-info') return 'more-info';
  if (want !== 'toggle') return 'info';
  if (!domain || TOGGLE_FORBIDDEN_DOMAINS.has(domain)) return 'info';
  if (explicit === 'toggle') return 'toggle';
  return TOGGLE_SAFE_DOMAINS.has(domain) ? 'toggle' : 'info';
}

// ---------------- floors import ----------------

export interface FloorInfo {
  id: string;
  name: string;
  level: number | null;
}

/** HA floor registry → a list ordered by level (unknown levels last), then name. */
export function floorsOf(hass: any): FloorInfo[] {
  const reg = hass?.floors;
  if (!reg || typeof reg !== 'object') return [];
  const list: FloorInfo[] = [];
  for (const f of Object.values<any>(reg)) {
    if (!f || !f.floor_id) continue;
    list.push({ id: f.floor_id, name: f.name || f.floor_id, level: f.level ?? null });
  }
  list.sort((a, b) => {
    const la = a.level ?? 1e9;
    const lb = b.level ?? 1e9;
    return la !== lb ? la - lb : a.name.localeCompare(b.name);
  });
  return list;
}

/** Substitute every occurrence of {name} placeholders in a template string. */
export function subst(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) out = out.split('{' + k + '}').join(String(v));
  return out;
}

// ---------------- room fills & colors ----------------

export type RoomFillMode = 'none' | 'lqi' | 'light' | 'temp' | 'glow';

/** Per-space display settings with their defaults resolved. */
export interface SpaceDisplay {
  showBorders: boolean;
  showNames: boolean;
  color: string;    // hex like #3ea6ff
  opacity: number;  // 0..1 — applied to borders, names and fills
  fill: RoomFillMode;
  tempMin: number; // comfort range lower bound, °C
  tempMax: number; // comfort range upper bound, °C
  /** Per-space LQI badges near zigbee devices; null = follow the card option. */
  showLqi: boolean | null;
  /** Room-card metrics under the room name (all default off). */
  labelTemp: boolean;
  labelHum: boolean;
  labelLqi: boolean;
  labelLight: boolean;
}

export const DEFAULT_ROOM_COLOR = '#3ea6ff';
export const DEFAULT_ROOM_OPACITY = 0.55;
export const DEFAULT_TEMP_MIN = 20;
export const DEFAULT_TEMP_MAX = 25;

/** Resolve a space's display settings; spaces without a plan default to visible markup. */
export function spaceDisplayOf(spaceCfg: any): SpaceDisplay {
  const s = spaceCfg?.settings || {};
  const noPlan = !spaceCfg?.plan_url;
  return {
    showBorders: s.show_borders ?? noPlan,
    showNames: s.show_names ?? noPlan,
    color: typeof s.room_color === 'string' && /^#[0-9a-f]{6}$/i.test(s.room_color) ? s.room_color : DEFAULT_ROOM_COLOR,
    opacity: typeof s.room_opacity === 'number' ? Math.min(1, Math.max(0, s.room_opacity)) : DEFAULT_ROOM_OPACITY,
    fill: ['lqi', 'light', 'temp', 'glow'].includes(s.fill_mode) ? s.fill_mode : 'none',
    tempMin: typeof s.temp_min === 'number' ? s.temp_min : DEFAULT_TEMP_MIN,
    tempMax: typeof s.temp_max === 'number' ? s.temp_max : DEFAULT_TEMP_MAX,
    showLqi: typeof s.show_lqi === 'boolean' ? s.show_lqi : null,
    labelTemp: s.label_temp === true,
    labelHum: s.label_hum === true,
    labelLqi: s.label_lqi === true,
    labelLight: s.label_light === true,
  };
}

// ---------------- global fill colors ----------------

export interface FillColorEntry {
  c: string; // #rrggbb
  a: number; // 0..1 fill opacity
}

/** Global fill palette, grouped by fill mode; stored in config.settings.fill_colors. */
export interface FillColors {
  light_on: FillColorEntry;
  light_off: FillColorEntry;
  /** Rooms with no light sources at all; alpha 0 (default) = no fill, as before. */
  light_none: FillColorEntry;
  temp_cold: FillColorEntry;
  temp_ok: FillColorEntry;
  temp_hot: FillColorEntry;
  lqi_low: FillColorEntry;
  lqi_high: FillColorEntry;
  /** Glow mode: uniform "darkness" over every room + default light color. */
  glow_base: FillColorEntry;
  glow_light: FillColorEntry;
}

export const DEFAULT_FILL_COLORS: FillColors = {
  light_on: { c: '#ffd45c', a: 0.18 },
  light_off: { c: '#9aa0a6', a: 0.14 },
  light_none: { c: '#6b7480', a: 0 },
  temp_cold: { c: '#4fc3f7', a: 0.18 },
  temp_ok: { c: '#66d17a', a: 0.18 },
  temp_hot: { c: '#ffd45c', a: 0.18 },
  lqi_low: { c: '#f25a4a', a: 0.18 },
  lqi_high: { c: '#4bd28f', a: 0.18 },
  glow_base: { c: '#0d1b2a', a: 0.5 },
  glow_light: { c: '#ffd9a0', a: 0.85 },
};

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Merge stored overrides over the defaults, dropping malformed entries. */
export function fillColorsOf(settings: any): FillColors {
  const out: any = {};
  const src = settings?.fill_colors || {};
  for (const k of Object.keys(DEFAULT_FILL_COLORS) as (keyof FillColors)[]) {
    const d = DEFAULT_FILL_COLORS[k];
    const v = src[k];
    out[k] = {
      c: v && typeof v.c === 'string' && HEX_RE.test(v.c) ? v.c : d.c,
      a: v && typeof v.a === 'number' ? Math.min(1, Math.max(0, v.a)) : d.a,
    };
  }
  return out as FillColors;
}

/** Linear RGB interpolation between two hex colors, t clamped to 0..1. */
export function lerpColor(a: string, b: string, t: number): string {
  const tt = Math.min(1, Math.max(0, t));
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mix = pa.map((v, i) => Math.round(v + (pb[i] - v) * tt));
  return '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Room fill (color + opacity) for the selected mode, or null for "no fill",
 * using the global palette. The LQI gradient interpolates lqi_low → lqi_high
 * over the 40..180 LQI window (same thresholds as the badge color).
 */
export function roomFillStyle(
  mode: RoomFillMode,
  lqi: number | null,
  lights: 'on' | 'off' | 'none',
  temp: number | null | undefined,
  tempMin: number,
  tempMax: number,
  colors: FillColors,
): FillColorEntry | null {
  if (mode === 'lqi') {
    if (lqi == null) return null;
    const t = (lqi - 40) / 140;
    return { c: lerpColor(colors.lqi_low.c, colors.lqi_high.c, t),
             a: colors.lqi_low.a + (colors.lqi_high.a - colors.lqi_low.a) * Math.min(1, Math.max(0, t)) };
  }
  if (mode === 'light') {
    if (lights === 'none') {
      // configurable "no light sources" color; alpha 0 keeps the historical
      // no-fill behavior (and the unfilled hover), so nothing changes until
      // the user assigns an opacity
      return colors.light_none.a > 0 ? colors.light_none : null;
    }
    return lights === 'on' ? colors.light_on : colors.light_off;
  }
  if (mode === 'temp') {
    if (temp == null) return null;
    const lo = Math.min(tempMin, tempMax);
    const hi = Math.max(tempMin, tempMax);
    if (temp < lo) return colors.temp_cold;
    if (temp > hi) return colors.temp_hot;
    return colors.temp_ok;
  }
  return null;
}

/**
 * Room fill color for the selected mode, or null for "no fill".
 * - lqi: red→green gradient by the room's average zigbee signal (null LQI → no fill)
 * - light: warm yellow when any light in the room is on, grey when all known
 *   lights are off; rooms without lights get no fill (a bathroom without smart
 *   bulbs should not look permanently "off").
 */
export function roomFillColor(
  mode: RoomFillMode,
  lqi: number | null,
  lights: 'on' | 'off' | 'none',
  temp?: number | null,
  tempMin: number = DEFAULT_TEMP_MIN,
  tempMax: number = DEFAULT_TEMP_MAX,
): string | null {
  if (mode === 'lqi') return lqi == null ? null : lqiColor(lqi);
  if (mode === 'light') {
    if (lights === 'none') return null;
    return lights === 'on' ? '#ffd45c' : '#9aa0a6';
  }
  if (mode === 'temp') {
    // blue below the comfort range, green inside, yellow above; no reading → no fill.
    // Bounds are swapped automatically if entered in the wrong order.
    if (temp == null) return null;
    const lo = Math.min(tempMin, tempMax);
    const hi = Math.max(tempMin, tempMax);
    if (temp < lo) return '#4fc3f7';
    if (temp > hi) return '#ffd45c';
    return '#66d17a';
  }
  return null;
}

// ---------------- state-reflecting icons ----------------

/**
 * Swap the auto icon for a state variant (open door, unlocked lock…), like core
 * HA does. Conservative: only well-known pairs, only when the user has NOT set
 * a custom icon, and unknown/unavailable states keep the base icon.
 */
export function stateIcon(
  base: string,
  domain: string | null | undefined,
  deviceClass: string | null | undefined,
  state: string | null | undefined,
  hasCustomIcon: boolean,
): string {
  if (hasCustomIcon || !state || state === 'unavailable' || state === 'unknown') return base;
  if (domain === 'binary_sensor') {
    if (deviceClass === 'door') return state === 'on' ? 'mdi:door-open' : 'mdi:door-closed';
    if (deviceClass === 'window') return state === 'on' ? 'mdi:window-open' : 'mdi:window-closed';
    if (deviceClass === 'garage_door') return state === 'on' ? 'mdi:garage-open-variant' : 'mdi:garage-variant';
  }
  if (domain === 'lock') return state === 'locked' ? 'mdi:lock' : 'mdi:lock-open-variant';
  if (domain === 'light' && base === 'mdi:lightbulb') return state === 'on' ? 'mdi:lightbulb-on' : base;
  return base;
}

// ---------------- light color & alarm states ----------------

/**
 * The current color of a light entity as a CSS color, or null when it is off,
 * unavailable or reports no usable color. rgb_color is the source of truth
 * (HA normalizes hs/xy into it); brightness is deliberately ignored — a dim
 * red bulb should still read as red on the plan.
 */
export function lightColorOf(state: any): string | null {
  if (!state || state.state !== 'on') return null;
  const rgb = state.attributes?.rgb_color;
  if (Array.isArray(rgb) && rgb.length >= 3 && rgb.every((v: any) => Number.isFinite(v))) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }
  return null;
}

// ---------------- glow fill (light sources) ----------------

/** Blackbody color temperature → RGB (Tanner Helland approximation). */
export function kelvinToRgb(kelvin: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66
    ? 99.4708025861 * Math.log(t) - 161.1195681661
    : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const cl = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return [cl(r), cl(g), cl(b)];
}

/**
 * Color and relative brightness of a light's glow: rgb_color as is, else the
 * color temperature via blackbody, else the configured fallback. Off → null.
 */
export function glowColorOf(state: any, fallback: string): { c: string; bri: number } | null {
  if (!state || state.state !== 'on') return null;
  const a = state.attributes || {};
  const briRaw = Number(a.brightness);
  const bri = Number.isFinite(briRaw) && briRaw > 0 ? Math.max(0.15, Math.min(1, briRaw / 255)) : 1;
  const rgb = a.rgb_color;
  if (Array.isArray(rgb) && rgb.length >= 3 && rgb.every((v: any) => Number.isFinite(v)))
    return { c: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`, bri };
  const kelvin = Number(a.color_temp_kelvin) || (Number(a.color_temp) > 0 ? 1e6 / Number(a.color_temp) : NaN);
  if (Number.isFinite(kelvin) && kelvin > 0) {
    const [r, g, b] = kelvinToRgb(kelvin);
    return { c: `rgb(${r}, ${g}, ${b})`, bri };
  }
  return { c: fallback, bri };
}

/**
 * Light spilling through a doorway: the sector of the glow circle between the
 * rays source→A and source→B (door edge points), out to radius r. This part of
 * the circle is intentionally NOT clipped by the room (owner's spec: no shadow
 * casting — just the unclipped sector). Null when the door is out of reach or
 * the source sits on a door edge; the sweep is clamped to maxDeg.
 */
export function doorSector(
  src: number[], a: number[], b: number[], r: number, maxDeg = 170,
): number[][] | null {
  const la = Math.hypot(a[0] - src[0], a[1] - src[1]);
  const lb = Math.hypot(b[0] - src[0], b[1] - src[1]);
  if (la < 1e-6 || lb < 1e-6 || Math.min(la, lb) >= r) return null;
  let aa = Math.atan2(a[1] - src[1], a[0] - src[0]);
  let sweep = Math.atan2(b[1] - src[1], b[0] - src[0]) - aa;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const max = (maxDeg * Math.PI) / 180;
  if (Math.abs(sweep) > max) {
    const mid = aa + sweep / 2;
    sweep = max * Math.sign(sweep);
    aa = mid - sweep / 2;
  }
  const steps = 8;
  const pts: number[][] = [[src[0], src[1]]];
  for (let i = 0; i <= steps; i++) {
    const ang = aa + (sweep * i) / steps;
    pts.push([src[0] + Math.cos(ang) * r, src[1] + Math.sin(ang) * r]);
  }
  return pts;
}

/**
 * Is there a room on the far side of an opening (relative to the light source)?
 * Entrance doors lead outside — light must not spill there.
 */
export function hasRoomBehind(
  center: number[], angleDeg: number, src: number[], polys: number[][][], probe: number,
): boolean {
  const rad = (angleDeg * Math.PI) / 180;
  const n = [-Math.sin(rad), Math.cos(rad)];
  const toSrc = (src[0] - center[0]) * n[0] + (src[1] - center[1]) * n[1];
  const sgn = toSrc > 0 ? -1 : 1;
  const p = [center[0] + n[0] * probe * sgn, center[1] + n[1] * probe * sgn];
  return polys.some((poly) => pointStrictlyInside(p, poly, 1e-9));
}

/**
 * Group toggle for a switch's controlled entities, HA-group semantics:
 * any target on -> turn everything off; all off -> turn everything on.
 */
export function controlsAction(states: (string | undefined)[]): 'turn_on' | 'turn_off' {
  return states.some((st) => st === 'on') ? 'turn_off' : 'turn_on';
}

/** Only lights and plain switches may be group-controlled from the plan. */
export function isControllable(entityId: string): boolean {
  return entityId.startsWith('light.') || entityId.startsWith('switch.');
}

// ---------------- open (virtual) boundaries ----------------

/**
 * Collinear overlapping stretches of two room outlines — their shared
 * boundary. Handles the real-house case where neighbouring walls only
 * PARTIALLY overlap (collinear, different lengths). Returns segments
 * [x1,y1,x2,y2] with length > eps.
 */
export function sharedBoundary(a: number[][], b: number[][], eps = 1e-6): number[][] {
  const res: number[][] = [];
  if (!a || !b || a.length < 3 || b.length < 3) return res;
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i], p2 = a[(i + 1) % a.length];
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    if (len < eps) continue;
    const ux = dx / len, uy = dy / len;
    for (let j = 0; j < b.length; j++) {
      const q1 = b[j], q2 = b[(j + 1) % b.length];
      // both q endpoints must lie on the line of p1-p2
      const d1 = Math.abs((q1[0] - p1[0]) * uy - (q1[1] - p1[1]) * ux);
      const d2 = Math.abs((q2[0] - p1[0]) * uy - (q2[1] - p1[1]) * ux);
      const tol = Math.max(eps, len * 1e-6);
      if (d1 > tol || d2 > tol) continue;
      // overlap of parameter intervals along the line
      const t1 = (q1[0] - p1[0]) * ux + (q1[1] - p1[1]) * uy;
      const t2 = (q2[0] - p1[0]) * ux + (q2[1] - p1[1]) * uy;
      const lo = Math.max(0, Math.min(t1, t2));
      const hi = Math.min(len, Math.max(t1, t2));
      if (hi - lo > eps) {
        res.push([p1[0] + ux * lo, p1[1] + uy * lo, p1[0] + ux * hi, p1[1] + uy * hi]);
      }
    }
  }
  return res;
}

/**
 * Connected component of rooms joined by open (virtual) boundaries — the
 * "open zone" light flows through. The open_to link counts in either
 * direction. Returns a set of room ids including the start.
 */
export function openZoneOf(roomId: string, rooms: { id?: string; open_to?: string[] | null }[]): Set<string> {
  const zone = new Set<string>([roomId]);
  const linked = (x: any, y: any) =>
    (x.open_to || []).includes(y.id) || (y.open_to || []).includes(x.id);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rooms) {
      if (!r.id || zone.has(r.id)) continue;
      for (const z of rooms) {
        if (!z.id || !zone.has(z.id)) continue;
        if (linked(r, z)) { zone.add(r.id); grew = true; break; }
      }
    }
  }
  return zone;
}

/**
 * Segments with the given collinear stretches removed — the workhorse behind
 * TRUE dashed open boundaries (derived walls and room outlines alike).
 */
export function cutSegments(segs: number[][], cuts: number[][], eps = 1e-6): number[][] {
  const out: number[][] = [];
  for (const seg of segs) {
    const p1 = [seg[0], seg[1]], p2 = [seg[2], seg[3]];
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    if (len < eps) continue;
    const ux = dx / len, uy = dy / len;
    // collect cut intervals on this edge
    const iv: [number, number][] = [];
    for (const c of cuts) {
      const d1 = Math.abs((c[0] - p1[0]) * uy - (c[1] - p1[1]) * ux);
      const d2 = Math.abs((c[2] - p1[0]) * uy - (c[3] - p1[1]) * ux);
      const tol = Math.max(eps, len * 1e-6);
      if (d1 > tol || d2 > tol) continue;
      const t1 = (c[0] - p1[0]) * ux + (c[1] - p1[1]) * uy;
      const t2 = (c[2] - p1[0]) * ux + (c[3] - p1[1]) * uy;
      const lo = Math.max(0, Math.min(t1, t2));
      const hi = Math.min(len, Math.max(t1, t2));
      if (hi - lo > eps) iv.push([lo, hi]);
    }
    if (!iv.length) {
      out.push([p1[0], p1[1], p2[0], p2[1]]);
      continue;
    }
    iv.sort((a, b) => a[0] - b[0]);
    let cur = 0;
    for (const [lo, hi] of iv) {
      if (lo - cur > eps) out.push([p1[0] + ux * cur, p1[1] + uy * cur, p1[0] + ux * lo, p1[1] + uy * lo]);
      cur = Math.max(cur, hi);
    }
    if (len - cur > eps) out.push([p1[0] + ux * cur, p1[1] + uy * cur, p2[0], p2[1]]);
  }
  return out;
}

/** Room outline pieces with the given collinear stretches removed. */
export function outlineWithout(poly: number[][], cuts: number[][], eps = 1e-6): number[][] {
  const edges: number[][] = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
    edges.push([p1[0], p1[1], p2[0], p2[1]]);
  }
  return cutSegments(edges, cuts, eps);
}

/** Distance from a point to a segment [x1,y1,x2,y2]. */
export function distToSegment(p: number[], s: number[]): number {
  const dx = s[2] - s[0], dy = s[3] - s[1];
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(p[0] - s[0], p[1] - s[1]);
  let t = ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (s[0] + t * dx), p[1] - (s[1] + t * dy));
}

/** Device classes whose active state is an emergency, not a status. */
const ALARM_CLASSES = new Set(['smoke', 'gas', 'carbon_monoxide', 'moisture', 'safety', 'tamper', 'problem']);

/**
 * An alarm is firing: leak/smoke/gas/CO/safety binary sensors in `on`, or a
 * siren that is on. Unavailable/unknown never alarm (an outage is not a fire).
 */
export function isAlarmState(
  domain: string | null | undefined,
  deviceClass: string | null | undefined,
  state: string | null | undefined,
): boolean {
  if (state !== 'on') return false;
  if (domain === 'siren') return true;
  return domain === 'binary_sensor' && !!deviceClass && ALARM_CLASSES.has(deviceClass);
}

// ---------------- room references ----------------

/**
 * Parse a marker's room reference. Two shapes:
 * - `space#area`   — a room bound to an HA area (historical form)
 * - `space#@roomId` — a room WITHOUT an area (sub-area rooms, issue #3):
 *   devices are placed into it manually, by room id.
 */
export function parseRoomRef(
  v: string | null | undefined,
): { space: string; area: string | null; roomId: string | null } | null {
  if (!v) return null;
  const i = v.indexOf('#');
  if (i <= 0) return null;
  const space = v.slice(0, i);
  const rest = v.slice(i + 1);
  if (!rest) return null;
  if (rest.startsWith('@')) {
    const roomId = rest.slice(1);
    return roomId ? { space, area: null, roomId } : null;
  }
  return { space, area: rest, roomId: null };
}

// ---------------- new-device detection ----------------

/**
 * Which auto-appearing device ids are NEW against the known baseline.
 * No baseline yet (first run / upgrade) → nothing is new: every current id
 * becomes the baseline silently, so an update never floods the plan with dots.
 */
export function diffNewDevices(
  currentIds: string[],
  known: string[] | null | undefined,
): { fresh: string[]; known: string[] } {
  if (!Array.isArray(known)) return { fresh: [], known: [...currentIds] };
  const knownSet = new Set(known);
  const fresh = currentIds.filter((id) => !knownSet.has(id));
  return { fresh, known: fresh.length ? [...known, ...fresh] : known };
}
