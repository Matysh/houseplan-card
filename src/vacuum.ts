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
export type VacPath = Pt[][];

export type VacPathCommand =
  | { kind: 'move'; point: Pt }
  | { kind: 'line'; point: Pt }
  | { kind: 'quadratic'; control: Pt; point: Pt };

export const VAC_TRAIL_SMOOTH_RADIUS_CM = 17.5;

export const VAC_PATH_MAX_SEGMENTS = 64;
export const VAC_PATH_MAX_POINTS = 4000;

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

export interface VacRoom { id: string; name: string; cx: number; cy: number;
  x0?: number; y0?: number; x1?: number; y1?: number }
export interface VacTelemetry {
  pos: { x: number; y: number; a: number | null } | null;
  path: VacPath;          // integration-provided drawable subpaths, vacuum coords
  rooms: VacRoom[];       // for auto-calibration; empty when unknown
  mapId: string;          // multi-floor robots: one calibration per map
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pointOf = (value: unknown): Pt | null => {
  const candidate = value as any;
  const x = num(Array.isArray(candidate) ? candidate[0] : candidate?.x);
  const y = num(Array.isArray(candidate) ? candidate[1] : candidate?.y);
  return x == null || y == null ? null : [x, y];
};

const looksLikePoint = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length >= 2 && !Array.isArray(value[0])
      && (typeof value[0] !== 'object' || value[0] == null);
  }
  return !!value && typeof value === 'object'
    && ('x' in (value as object) || 'y' in (value as object));
};

/** Shoelace area centroid. A zero-area outline deterministically falls back
 * to its vertex average; invalid/non-finite outlines have no centroid. */
export function areaCentroid(raw: unknown): Pt | null {
  if (!Array.isArray(raw)) return null;
  const points: Pt[] = [];
  for (const value of raw) {
    const point = pointOf(value);
    if (!point) return null;
    points.push(point);
  }
  if (points.length > 1) {
    const first = points[0], last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) points.pop();
  }
  if (points.length < 3) return null;
  let crossSum = 0, cx = 0, cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const cross = a[0] * b[1] - b[0] * a[1];
    crossSum += cross;
    cx += (a[0] + b[0]) * cross;
    cy += (a[1] + b[1]) * cross;
  }
  if (Math.abs(crossSum) < 1e-12) {
    return [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ];
  }
  return [cx / (3 * crossSum), cy / (3 * crossSum)];
}

function outlineGeometry(raw: unknown): { centroid: Pt; bbox: [number, number, number, number] } | null {
  if (!Array.isArray(raw)) return null;
  const points: Pt[] = [];
  for (const value of raw) {
    const point = pointOf(value);
    if (!point) return null;
    points.push(point);
  }
  if (points.length > 1) {
    const first = points[0], last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) points.pop();
  }
  const centroid = areaCentroid(points);
  if (!centroid) return null;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return { centroid, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

function thinPathToTarget(points: Pt[], target: number): Pt[] {
  if (target >= points.length) return points.slice();
  if (target <= 2) return [points[0], points[points.length - 1]];
  const out: Pt[] = [];
  for (let i = 0; i < target; i++) {
    const index = Math.round((i * (points.length - 1)) / (target - 1));
    out.push(points[index]);
  }
  return out;
}

/** Normalize legacy flat paths and integration multi-subpaths, then enforce
 * drawable/cap/budget rules without ever joining across a gap. */
export function normalizeVacPath(raw: unknown): VacPath {
  let value: unknown = raw;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as any;
    value = object.path ?? object.points ?? value;
  }
  if (!Array.isArray(value) || !value.length) return [];
  const flat = value.some((entry) => looksLikePoint(entry));
  const rawSegments: unknown[][] = flat ? [value] : value.filter(Array.isArray) as unknown[][];
  let segments = rawSegments
    .map((segment) => segment.map(pointOf).filter((point): point is Pt => point != null))
    .filter((segment) => segment.length >= 2);
  if (segments.length > VAC_PATH_MAX_SEGMENTS) segments = segments.slice(-VAC_PATH_MAX_SEGMENTS);
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (total <= VAC_PATH_MAX_POINTS) return segments.map((segment) => segment.slice());

  const base = segments.length * 2;
  const remaining = VAC_PATH_MAX_POINTS - base;
  const weights = segments.map((segment) => segment.length - 2);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const quotas = weights.map((weight) => remaining * weight / weightTotal);
  const allocations = quotas.map(Math.floor);
  let left = remaining - allocations.reduce((sum, allocation) => sum + allocation, 0);
  const order = quotas.map((quota, index) => ({ index, fraction: quota - Math.floor(quota) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < left; i++) allocations[order[i].index]++;
  return segments.map((segment, index) => thinPathToTarget(segment, 2 + allocations[index]));
}

export type VacCurrentPathSource = 'integration' | 'server' | 'local' | 'none';

/** One authority for the current visible path. Only drawable geometry wins. */
export function resolveCurrentVacPath(
  tele: { path?: unknown } | unknown,
  server: { points?: unknown } | unknown,
  local: unknown,
): { path: VacPath; source: VacCurrentPathSource } {
  const telePath = normalizeVacPath(
    tele && typeof tele === 'object' && !Array.isArray(tele) && 'path' in tele
      ? (tele as { path?: unknown }).path : tele,
  );
  if (telePath.length) return { path: telePath, source: 'integration' };
  const serverPath = normalizeVacPath(
    server && typeof server === 'object' && !Array.isArray(server) && 'points' in server
      ? (server as { points?: unknown }).points : server,
  );
  if (serverPath.length) return { path: serverPath, source: 'server' };
  const localPath = normalizeVacPath(local);
  if (localPath.length) return { path: localPath, source: 'local' };
  return { path: [], source: 'none' };
}

/** Remove the live target from only the final drawable subpath. */
export function trimVacPathTarget(path: VacPath): VacPath {
  const out = path.map((segment) => segment.slice());
  const last = out[out.length - 1];
  if (!last) return [];
  if (last.length > 2) last.pop();
  else out.pop();
  return out;
}

const finitePoint = (point: Pt): boolean => Number.isFinite(point[0]) && Number.isFinite(point[1]);
const samePoint = (a: Pt, b: Pt): boolean => a[0] === b[0] && a[1] === b[1];

/**
 * Turn calibrated plan-space trail points into bounded rounded-corner commands.
 *
 * Each corner is trimmed by at most half of either adjacent segment and by the
 * caller's physical radius. The quadratic lies in the P-B-Q convex hull, so it
 * cannot be farther from the source polyline than that radius. This function
 * deliberately knows nothing about SVG, Lit, scale conversion or flat/iso
 * projection; the renderer serialises and projects the typed commands.
 */
export function smoothVacPath(
  path: VacPath, maxRadius: number,
  warn: (message: string) => void = console.warn,
): VacPathCommand[][] {
  if (!Number.isFinite(maxRadius) || maxRadius <= 0) return [];
  const out: VacPathCommand[][] = [];
  // #369(б): a NaN calibration matrix used to hide the whole trail silently —
  // one warn per call (a file may carry hundreds of segments) names the count.
  let droppedSegments = 0;
  for (const rawSegment of path) {
    if (!rawSegment.every(finitePoint)) { droppedSegments++; continue; }
    const segment = rawSegment.filter((point, index) => index === 0 || !samePoint(point, rawSegment[index - 1]));
    if (segment.length < 2) continue;
    const commands: VacPathCommand[] = [{ kind: 'move', point: segment[0] }];
    if (segment.length === 2) {
      commands.push({ kind: 'line', point: segment[1] });
      out.push(commands);
      continue;
    }

    for (let index = 1; index < segment.length - 1; index++) {
      const a = segment[index - 1], b = segment[index], c = segment[index + 1];
      const inX = b[0] - a[0], inY = b[1] - a[1];
      const outX = c[0] - b[0], outY = c[1] - b[1];
      const inLength = Math.hypot(inX, inY), outLength = Math.hypot(outX, outY);
      const dot = (inX * outX + inY * outY) / (inLength * outLength);
      // An almost exact reversal would fold a quadratic back onto itself. Keep
      // that telemetry cusp literal instead of inventing a loop around it.
      if (!Number.isFinite(dot) || dot <= -0.999) {
        commands.push({ kind: 'line', point: b });
        continue;
      }
      const radius = Math.min(maxRadius, inLength / 2, outLength / 2);
      if (!Number.isFinite(radius) || radius <= 0) {
        commands.push({ kind: 'line', point: b });
        continue;
      }
      const before: Pt = [b[0] - inX * radius / inLength, b[1] - inY * radius / inLength];
      const after: Pt = [b[0] + outX * radius / outLength, b[1] + outY * radius / outLength];
      commands.push({ kind: 'line', point: before });
      commands.push({ kind: 'quadratic', control: b, point: after });
    }
    commands.push({ kind: 'line', point: segment[segment.length - 1] });
    out.push(commands);
  }
  if (droppedSegments > 0) {
    warn(`[houseplan] vacuum trail: ${droppedSegments} segment(s) dropped — non-finite point (check map calibration)`);
  }
  return out;
}

/**
 * Map-id normalisation contract, shared with the backend recorder
 * (custom_components/houseplan/trails.py: resolve_map_id). The FIRST value
 * that is not null/undefined wins — truthiness is wrong here, because a
 * zero-based `map_index: 0` is a perfectly valid first map and an empty
 * string is still an id. The backend used an `or`-chain and dropped the
 * zero, so server trails were stored under a key the renderer never looked
 * up (HP-1540-02).
 */
export function vacMapIdFromAttrs(attrs: Record<string, any>): string {
  return String(attrs.map_name ?? attrs.current_map ?? attrs.map_index ?? attrs.selected_map ?? 'default');
}

/**
 * The card-side fallback half of that contract (HP-1541-01): when source
 * telemetry names no map ('default'), the vacuum entity's own selected_map
 * decides — under the SAME not-nullish rule as above. The old truthiness
 * check in _vacMapId turned `selected_map: 0` into 'default' while the
 * server recorder (trails.py resolve_map_id) stored the trail under '0', so
 * calibration and saved runs lived under a key the renderer never matched.
 */
export function vacMapIdWithFallback(teleMapId: string, selectedMap: unknown): string {
  if (teleMapId !== 'default') return teleMapId;
  return selectedMap != null ? String(selectedMap) : 'default';
}

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
  // path: [{x,y},…], [[x,y],…] or XCME path.path: [[{x,y},…], …]
  const path = normalizeVacPath(attrs.path?.path ?? attrs.path?.points ?? attrs.path);
  // rooms: {id:{name,x0,y0,x1,y1}} | [{id,name,x0..}] | {id:{name,outline}}
  const rooms: VacRoom[] = [];
  const rawRooms = attrs.rooms;
  const entries: Array<[string, any]> = Array.isArray(rawRooms)
    ? rawRooms.map((r: any, i: number) => [String(r?.id ?? i), r])
    : rawRooms && typeof rawRooms === 'object' ? Object.entries(rawRooms) : [];
  for (const [id, r] of entries) {
    if (!r || typeof r !== 'object') continue;
    const name = String(r.name ?? r.label ?? '').trim();
    // Anchor pairs are atomic: never mix cx with center.y (or another tier)
    // when an integration publishes one incomplete spelling.
    const anchorPairs = [
      [num(r.cx), num(r.cy)],
      [num(r.center?.x), num(r.center?.y)],
      // Tasshack dreame-vacuum: the room centre is plain x/y (verified
      // against a live X50 Master; x/y sits within its own x0..x1 bbox).
      [num(r.x), num(r.y)],
    ];
    const anchor = anchorPairs.find(([x, y]) => x != null && y != null);
    let cx = anchor?.[0] ?? null; let cy = anchor?.[1] ?? null;
    const outline = outlineGeometry(r.outline);
    const x0 = num(r.x0), y0 = num(r.y0), x1 = num(r.x1), y1 = num(r.y1);
    const explicitBbox = x0 != null && y0 != null && x1 != null && y1 != null
      ? [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)] as const
      : null;
    const bbox = explicitBbox || outline?.bbox || null;
    if ((cx == null || cy == null) && outline) [cx, cy] = outline.centroid;
    // Owner override after review F6: bbox-only dialects still get a usable
    // ghost/calibration anchor. This is deliberately the LAST tier, after
    // every explicit centre and the area centroid of a real outline.
    if ((cx == null || cy == null) && bbox) {
      cx = (bbox[0] + bbox[2]) / 2;
      cy = (bbox[1] + bbox[3]) / 2;
    }
    if (name && cx != null && cy != null) {
      const room: VacRoom = { id, name, cx, cy };
      if (bbox) [room.x0, room.y0, room.x1, room.y1] = bbox;
      rooms.push(room);
    }
  }
  const mapId = vacMapIdFromAttrs(attrs);
  if (!pos && !rooms.length && !path.length) return null;
  return { pos, path, rooms, mapId };
}

/** Attribute sets that mark an entity as a live-position source. */
export function isVacSourceState(st: { attributes?: Record<string, any> } | null | undefined): boolean {
  const a = st?.attributes;
  return !!pointOf(a?.vacuum_position ?? a?.robot_position);
}

export type VacSourceCandidateCategory =
  | 'compatible' | 'partial' | 'known_xcme_incomplete' | 'camera';

export interface VacSourceCandidate {
  entityId: string;
  name: string;
  platform: string | null;
  category: VacSourceCandidateCategory;
  hasPosition: boolean;
  hasRooms: boolean;
  hasPath: boolean;
  hasMapId: boolean;
  score: number;
}

export type VacSourceStatus =
  | 'ok' | 'missing' | 'disabled' | 'unavailable' | 'unverified' | 'unsupported' | 'none';

export interface VacSourceResolution {
  entityId: string | null;
  status: VacSourceStatus;
  pinned: boolean;
  candidates: VacSourceCandidate[];
}

/**
 * Resolve one source without depending on entity/registry iteration order.
 * A saved source is sticky even while broken; automatic mode only considers
 * proven-compatible entities attached to the same HA device.
 */
export function resolveVacSource(
  savedSource: string | null | undefined,
  sameDeviceIds: Iterable<string>,
  rawCandidates: Iterable<VacSourceCandidate>,
  statuses: Readonly<Record<string, VacSourceStatus>>,
): VacSourceResolution {
  const pinned = typeof savedSource === 'string' && savedSource.length > 0;
  const sameDevice = new Set(sameDeviceIds);
  const candidates = Array.from(rawCandidates).sort((a, b) => {
    if (pinned && a.entityId === savedSource) return -1;
    if (pinned && b.entityId === savedSource) return 1;
    return b.score - a.score || a.entityId.localeCompare(b.entityId);
  });
  if (pinned) {
    const selected = candidates.find((candidate) => candidate.entityId === savedSource);
    return {
      entityId: savedSource,
      // Missing is an authoritative conclusion supplied by the caller. An
      // absent status is insufficient evidence, so the pure helper stays
      // conservative instead of inventing deletion.
      status: statuses[savedSource] || (selected?.hasPosition ? 'ok' : 'unverified'),
      pinned: true,
      candidates,
    };
  }
  const automatic = candidates.find((candidate) => sameDevice.has(candidate.entityId)
    && candidate.hasPosition && statuses[candidate.entityId] === 'ok');
  return automatic
    ? { entityId: automatic.entityId, status: 'ok', pinned: false, candidates }
    : { entityId: null, status: 'none', pinned: false, candidates };
}

/** Physical calibration error in centimetres; invalid scales cannot pass. */
export function vacCalibrationResidualCm(
  residualPlanUnits: number,
  gridPitch: number,
  cellCm: number,
): number {
  if (![residualPlanUnits, gridPitch, cellCm].every(Number.isFinite)
      || residualPlanUnits < 0 || gridPitch <= 0 || cellCm <= 0) return Number.POSITIVE_INFINITY;
  return (residualPlanUnits / gridPitch) * cellCm;
}

export const VAC_CALIBRATION_WARN_CM = 40;

/** Classify one entity without relying on device/entity array order. */
export function parseVacSourceCandidate(
  entityId: string,
  state: { attributes?: Record<string, any> } | null | undefined,
  registryEntry?: Record<string, any> | null,
): VacSourceCandidate | null {
  if (!entityId || !state) return null;
  const attrs = state.attributes || {};
  const domain = entityId.split('.')[0] || '';
  const platform = registryEntry?.platform != null ? String(registryEntry.platform) : null;
  const hasPosition = !!pointOf(attrs.vacuum_position ?? attrs.robot_position);
  const hasRooms = !!(attrs.rooms && typeof attrs.rooms === 'object');
  const hasPath = normalizeVacPath(attrs.path?.path ?? attrs.path?.points ?? attrs.path).length > 0;
  const hasMapId = [attrs.map_name, attrs.current_map, attrs.map_index, attrs.selected_map]
    .some((value) => value != null);
  const knownXcme = platform === 'xiaomi_cloud_map_extractor';
  const hasVacuumClue = hasRooms || hasPath || hasMapId;
  let category: VacSourceCandidateCategory | null = null;
  if (hasPosition) category = 'compatible';
  else if (knownXcme) category = 'known_xcme_incomplete';
  else if (hasVacuumClue) category = 'partial';
  else if (domain === 'camera') category = 'camera';
  if (!category) return null;
  const score = hasPosition ? (domain === 'camera' ? 300 : 200)
    : knownXcme ? 100 : hasVacuumClue ? 50 : 0;
  return {
    entityId,
    name: String(attrs.friendly_name || entityId),
    platform,
    category,
    hasPosition,
    hasRooms,
    hasPath,
    hasMapId,
    score,
  };
}

// ---------------- auto-calibration by rooms ----------------

const canonName = (s: string): string => s.toLowerCase().replace(/[\s_\-.,]+/g, '');

/** Diagnostic name coverage uses the exact same canonicalisation as solve. */
export function vacRoomNameMatchCount(vacRooms: VacRoom[], planRoomNames: string[]): number {
  const plan = new Set(planRoomNames.map(canonName).filter(Boolean));
  const matched = new Set<string>();
  for (const room of vacRooms) {
    const name = canonName(room.name || '');
    if (name && plan.has(name)) matched.add(name);
  }
  return matched.size;
}

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

// ---------------- the fit panel (drag + corner-stretch calibration) ----------------

/** What the user manipulates; folds into the same stored 6-number matrix. */
export interface FitParams {
  ox: number; oy: number;   // translation, canvas units
  s: number;                // uniform scale, canvas units per robot unit
  rot: 0 | 90 | 180 | 270;  // whole-quarter rotation
  mir: boolean;             // mirror (robots' Y usually grows the other way)
}

const ROT_CS: Record<number, [number, number]> = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] };

/** target = S · R(rot) · diag(mir ? −1 : 1, 1) · source + (ox, oy) */
export function fitMatrix(p: FitParams): Affine {
  const [c, s_] = ROT_CS[p.rot] || [1, 0];
  const mx = p.mir ? -1 : 1;
  return [p.s * c * mx, -p.s * s_, p.ox, p.s * s_ * mx, p.s * c, p.oy];
}

/**
 * Decompose a stored matrix back into panel params. Rotation snaps to the
 * nearest quarter — a legacy 3-point matrix reopens as an editable start,
 * not verbatim, and that is fine: the ghost shows the result live.
 */
export function fitFromMatrix(m: Affine): FitParams | null {
  const det = m[0] * m[4] - m[1] * m[3];
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const mir = det < 0;
  const s = Math.sqrt(Math.abs(det));
  // the second column (b, e) = S·(−sin, cos) is mirror-free
  let ang = Math.atan2(-m[1], m[4]) * 180 / Math.PI;
  ang = ((Math.round(ang / 90) * 90) % 360 + 360) % 360;
  return { ox: m[2], oy: m[5], s, rot: ang as FitParams['rot'], mir };
}

/** A sane opening position: the robot map centred over the plan at 60% size. */
export function initialFit(
  rooms: VacRoom[],
  vb: [number, number, number, number],
): FitParams {
  const bx: number[] = [], by: number[] = [];
  for (const r of rooms) {
    if (r.x0 != null) { bx.push(r.x0, r.x1!); by.push(r.y0!, r.y1!); }
    else { bx.push(r.cx); by.push(r.cy); }
  }
  // no rooms at all: an arbitrary honest guess the user will drag anyway
  if (!bx.length) return { ox: vb[0] + vb[2] / 2, oy: vb[1] + vb[3] / 2, s: vb[2] / 10000, rot: 0, mir: true };
  const minX = Math.min(...bx), maxX = Math.max(...bx);
  const minY = Math.min(...by), maxY = Math.max(...by);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const s = (Math.min(vb[2], vb[3]) * 0.6) / span;
  // mirror on by default: every robot map seen so far has Y flipped vs screen
  const p: FitParams = { ox: 0, oy: 0, s, rot: 0, mir: true };
  const m = fitMatrix(p);
  const [ccx, ccy] = applyAffine(m, (minX + maxX) / 2, (minY + maxY) / 2);
  p.ox = vb[0] + vb[2] / 2 - ccx;
  p.oy = vb[1] + vb[3] / 2 - ccy;
  return p;
}

/** Re-anchor params so the source point (sx, sy) stays at the same target spot. */
export function reanchorFit(p: FitParams, prev: FitParams, sx: number, sy: number): FitParams {
  const [px, py] = applyAffine(fitMatrix(prev), sx, sy);
  const trial = fitMatrix({ ...p, ox: 0, oy: 0 });
  const [qx, qy] = applyAffine(trial, sx, sy);
  return { ...p, ox: px - qx, oy: py - qy };
}

export type VacTrailMode = 'never' | 'cleaning' | 'always';

/** marker.vacuum → display mode; legacy bool maps in (false = never). */
export function vacTrailMode(v: { trail?: boolean | null; trail_mode?: string | null } | null | undefined): VacTrailMode {
  const m = v?.trail_mode;
  if (m === 'never' || m === 'cleaning' || m === 'always') return m;
  if (v?.trail === false) return 'never';
  return 'cleaning';
}
