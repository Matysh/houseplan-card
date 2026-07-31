/**
 * Live robot vacuums: coordinate math and integration adapters.
 *
 * Pure logic, no Lit — everything here is unit-tested directly. The renderer
 * consumes three things: a solved affine matrix (vacuum mm → plan canvas
 * units), normalised telemetry from whatever integration the user happens to
 * run, and a thinned trail. See docs/VACUUM.md for the approved contract.
 */

export type Affine = [number, number, number, number, number, number];
export type Pt = [number, number];

/** target = [a b; d e]·source + [c f] */
export function applyAffine(m: Affine, x: number, y: number): Pt {
  return [m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]];
}

/**
 * Least-squares affine over point pairs (≥3). Solves two independent 3-unknown
 * systems via normal equations; returns null for degenerate input (collinear
 * points make the normal matrix singular — the wizard asks for a spread).
 */
export function solveAffine(pairs: Array<[Pt, Pt]>): Affine | null {
  if (pairs.length < 3) return null;
  // normal matrix A^T A (3x3) and right-hand sides for tx and ty
  let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = 0;
  let bx0 = 0, bx1 = 0, bx2 = 0, by0 = 0, by1 = 0, by2 = 0;
  for (const [[x, y], [tx, ty]] of pairs) {
    if (![x, y, tx, ty].every(Number.isFinite)) return null;
    sxx += x * x; sxy += x * y; sx += x; syy += y * y; sy += y; n += 1;
    bx0 += x * tx; bx1 += y * tx; bx2 += tx;
    by0 += x * ty; by1 += y * ty; by2 += ty;
  }
  const A = [sxx, sxy, sx, sxy, syy, sy, sx, sy, n];
  const solve3 = (b: number[]): number[] | null => {
    // Cramer via explicit inverse of the symmetric 3x3
    const [a, b1, c, d, e, f, g, h, i] = A;
    const det = a * (e * i - f * h) - b1 * (d * i - f * g) + c * (d * h - e * g);
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;
    const inv = [
      (e * i - f * h) / det, (c * h - b1 * i) / det, (b1 * f - c * e) / det,
      (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
      (d * h - e * g) / det, (b1 * g - a * h) / det, (a * e - b1 * d) / det,
    ];
    return [
      inv[0] * b[0] + inv[1] * b[1] + inv[2] * b[2],
      inv[3] * b[0] + inv[4] * b[1] + inv[5] * b[2],
      inv[6] * b[0] + inv[7] * b[1] + inv[8] * b[2],
    ];
  };
  const rx = solve3([bx0, bx1, bx2]);
  const ry = solve3([by0, by1, by2]);
  if (!rx || !ry) return null;
  const m: Affine = [rx[0], rx[1], rx[2], ry[0], ry[1], ry[2]];
  return m.every(Number.isFinite) ? m : null;
}

/** Worst residual in target units — the wizard warns above a threshold. */
export function affineResidual(m: Affine, pairs: Array<[Pt, Pt]>): number {
  let worst = 0;
  for (const [s, t] of pairs) {
    const p = applyAffine(m, s[0], s[1]);
    worst = Math.max(worst, Math.hypot(p[0] - t[0], p[1] - t[1]));
  }
  return worst;
}

// ---------------- telemetry adapters ----------------

export interface VacRoom { id: string; name: string; cx: number; cy: number }
export interface VacTelemetry {
  pos: { x: number; y: number; a: number | null } | null;
  path: Pt[] | null;      // integration-provided full path, vacuum coords
  rooms: VacRoom[];       // for auto-calibration; empty when unknown
  mapId: string;          // multi-floor robots: one calibration per map
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Normalise the attribute zoo. One parser instead of per-brand classes: the
 * three Tier-A integrations (Xiaomi Cloud Map Extractor, Tasshack
 * dreame-vacuum, Valetudo camera) all descend from the map-card conventions
 * and differ only in field spellings.
 */
export function readVacTelemetry(attrs: Record<string, any> | null | undefined): VacTelemetry | null {
  if (!attrs) return null;
  const p = attrs.vacuum_position || attrs.robot_position || null;
  const pos = p && num(p.x) != null && num(p.y) != null
    ? { x: num(p.x)!, y: num(p.y)!, a: num(p.a ?? p.angle ?? p.theta) }
    : null;
  // path: [{x,y},…] (Map Extractor) or [[x,y],…]
  let path: Pt[] | null = null;
  const rawPath = attrs.path?.points ?? attrs.path;
  if (Array.isArray(rawPath) && rawPath.length) {
    path = [];
    for (const q of rawPath) {
      const x = num(Array.isArray(q) ? q[0] : q?.x);
      const y = num(Array.isArray(q) ? q[1] : q?.y);
      if (x != null && y != null) path.push([x, y]);
    }
    if (!path.length) path = null;
  }
  // rooms: {id:{name,x0,y0,x1,y1}} | [{id,name,x0..}] | {id:{name,outline}}
  const rooms: VacRoom[] = [];
  const rawRooms = attrs.rooms;
  const entries: Array<[string, any]> = Array.isArray(rawRooms)
    ? rawRooms.map((r: any, i: number) => [String(r?.id ?? i), r])
    : rawRooms && typeof rawRooms === 'object' ? Object.entries(rawRooms) : [];
  for (const [id, r] of entries) {
    if (!r || typeof r !== 'object') continue;
    const name = String(r.name ?? r.label ?? '').trim();
    let cx = num(r.cx ?? r.center?.x); let cy = num(r.cy ?? r.center?.y);
    if (cx == null || cy == null) {
      const x0 = num(r.x0), y0 = num(r.y0), x1 = num(r.x1), y1 = num(r.y1);
      if (x0 != null && y0 != null && x1 != null && y1 != null) {
        cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
      }
    }
    // Tasshack dreame-vacuum: the room centre is plain x/y (verified against
    // a live X50 Master; x/y sits within its own x0..x1 bbox)
    if (cx == null || cy == null) { cx = num(r.x); cy = num(r.y); }
    if (name && cx != null && cy != null) rooms.push({ id, name, cx, cy });
  }
  const mapId = String(attrs.map_name ?? attrs.current_map ?? attrs.map_index ?? attrs.selected_map ?? 'default');
  if (!pos && !rooms.length && !path) return null;
  return { pos, path, rooms, mapId };
}

/** Attribute sets that mark an entity as a live-position source. */
export function isVacSourceState(st: { attributes?: Record<string, any> } | null | undefined): boolean {
  const a = st?.attributes;
  return !!(a && (a.vacuum_position || a.robot_position));
}

// ---------------- auto-calibration by rooms ----------------

const canonName = (s: string): string => s.toLowerCase().replace(/[\s_\-.,]+/g, '');

/**
 * Match the robot's room list against plan rooms by name and solve the
 * transform over centroids. Room centroids are coarse anchors, which is fine:
 * the residual check below rejects a bad fit, and the user always sees a live
 * preview before accepting.
 */
export function autoCalibrate(
  vacRooms: VacRoom[],
  planRooms: Array<{ name: string; cx: number; cy: number }>,
): { matrix: Affine; matched: string[]; residual: number } | null {
  const byName = new Map(planRooms.map((r) => [canonName(r.name), r]));
  const pairs: Array<[Pt, Pt]> = [];
  const matched: string[] = [];
  for (const vr of vacRooms) {
    const pr = byName.get(canonName(vr.name));
    if (!pr) continue;
    pairs.push([[vr.cx, vr.cy], [pr.cx, pr.cy]]);
    matched.push(vr.name);
  }
  if (pairs.length < 3) return null;
  const matrix = solveAffine(pairs);
  if (!matrix) return null;
  return { matrix, matched, residual: affineResidual(matrix, pairs) };
}

// ---------------- trail ----------------

export const TRAIL_MAX = 600;
export const VAC_TELEPORT_GAP_MS = 10000;
export const VAC_STALE_MS = 60000;
export const VAC_TRAIL_LINGER_MS = 10 * 60000;

/** Ramer–Douglas–Peucker; keeps ends, drops points under eps deviation. */
export function thinPath(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a]; const [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    let worst = 0, wi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > worst) { worst = d; wi = i; }
    }
    if (wi > 0 && worst > eps) {
      keep[wi] = 1;
      stack.push([a, wi], [wi, b]);
    }
  }
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

/** Append a point; over the cap → thin, and if thinning was not enough, decimate. */
export function pushTrailPoint(buf: Pt[], p: Pt, epsHint: number): Pt[] {
  const last = buf[buf.length - 1];
  if (last && last[0] === p[0] && last[1] === p[1]) return buf;
  buf.push(p);
  if (buf.length <= TRAIL_MAX) return buf;
  let thinned = thinPath(buf, epsHint);
  if (thinned.length > TRAIL_MAX) thinned = thinned.filter((_, i) => i % 2 === 0 || i === thinned.length - 1);
  return thinned;
}

/** true → the robot is actively driving (a puck should exist). */
export function isVacMoving(state: string | undefined): boolean {
  return state === 'cleaning' || state === 'returning' || state === 'on';
}
