/** Ordered path material and physical render bounds; no DOM/Lit/vendor code. */
import type { Affine, Pt, VacPath } from './vacuum';

export const VAC_RAW_MAX_POINTS = 100_000;
export const VAC_RAW_MAX_SEGMENTS = 1024;
export const VAC_RENDER_POINT_BUDGET = 20_000;
export const VAC_SIMPLIFY_CM = 2;

const material = new WeakSet<object>();
const geometryMaterial = new WeakSet<object>();
const normalized = new WeakMap<object, VacPath>();
const ownedInputs = new WeakMap<object, unknown>();
const limitedInputs = new WeakSet<object>();

export function vacuumPathLimited(value: unknown): boolean {
  return !!value && typeof value === 'object' && limitedInputs.has(value);
}

function rejectLimitedPath(raw: object): VacPath {
  const empty = freezeVacuumPath([]);
  limitedInputs.add(raw);
  limitedInputs.add(empty);
  normalized.set(raw, empty);
  return empty;
}

/** Preserve an attribute's public shape, but own/freeze its bounded data once.
 * Weak identity is HA's immutable state value, not a mutable card model row. */
export function ownVacuumPathInput(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (material.has(value)) return value;
  const cached = ownedInputs.get(value);
  if (cached) return cached;
  let nodes = 0, bytes = 0;
  const clone = (input: unknown, depth: number): unknown => {
    if (++nodes > VAC_RAW_MAX_POINTS * 4 || depth > 8) throw new Error('path budget');
    if (input === null || typeof input !== 'object') {
      if (typeof input === 'function') return undefined;
      bytes += typeof input === 'string' ? input.length * 3 : 32;
      if (bytes > 8 * 1024 * 1024) throw new Error('path budget');
      return input;
    }
    if (Array.isArray(input)) {
      // Sparse arrays also allocate by length: reject before Array.map.
      if (input.length > VAC_RAW_MAX_POINTS * 4) throw new Error('path budget');
      return Object.freeze(input.map((v) => clone(v, depth + 1)));
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) result[k] = clone(v, depth + 1);
    return Object.freeze(result);
  };
  try {
    const result = clone(value, 0);
    material.add(result as object);
    ownedInputs.set(value, result);
    return result;
  } catch {
    // Malformed/oversized geometry never starts unbounded snapshot cloning.
    const empty = rejectLimitedPath(value);
    ownedInputs.set(value, empty);
    return empty;
  }
}

export function isVacuumPathMaterial(value: object): boolean {
  return material.has(value);
}

/** Only owned, deeply frozen values may cross an immutable frame by reference. */
export function freezeVacuumPath(path: VacPath): VacPath {
  for (const segment of path) {
    for (const point of segment) Object.freeze(point);
    Object.freeze(segment);
  }
  Object.freeze(path);
  material.add(path);
  geometryMaterial.add(path);
  return path;
}

function pathPoint(value: unknown): Pt | null {
  const obj = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  const x = Array.isArray(value) ? value[0] : obj?.x;
  const y = Array.isArray(value) ? value[1] : obj?.y;
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
    ? [x, y] : null;
}

export function normalizeVacuumGeometry(raw: unknown): VacPath {
  if (!raw || typeof raw !== 'object') return [];
  if (geometryMaterial.has(raw)) return raw as VacPath;
  const cached = normalized.get(raw);
  if (cached) return cached;
  const object = raw as Record<string, unknown>;
  const value = Array.isArray(raw) ? raw : object.path ?? object.points;
  if (!Array.isArray(value)) return [];
  if (value.length > VAC_RAW_MAX_POINTS) return rejectLimitedPath(raw);
  const flat = value.some((v: unknown) => {
    if (Array.isArray(v)) return v.length >= 2 && !Array.isArray(v[0])
      && (v[0] == null || typeof v[0] !== 'object');
    return !!v && typeof v === 'object' && ('x' in v || 'y' in v);
  });
  const source = flat ? [value] : value;
  const out: VacPath = [];
  let count = 0, visited = 0;
  for (const segment of source) {
    if (!Array.isArray(segment)) continue;
    let current: Pt[] = [];
    const flush = (): void => { if (current.length) out.push(current); current = []; };
    for (const candidate of segment) {
      if (++visited > VAC_RAW_MAX_POINTS) return rejectLimitedPath(raw);
      const p = pathPoint(candidate);
      if (!p) { flush(); continue; }
      const prior = current[current.length - 1];
      if (prior && prior[0] === p[0] && prior[1] === p[1]) continue;
      current.push(p);
      if (++count > VAC_RAW_MAX_POINTS) return rejectLimitedPath(raw);
    }
    flush();
    if (out.length > VAC_RAW_MAX_SEGMENTS) return rejectLimitedPath(raw);
  }
  const frozen = freezeVacuumPath(out.filter((segment) => segment.length >= 2));
  normalized.set(raw, frozen);
  return frozen;
}

/** Certification against ORIGINAL contiguous samples, bounded look-ahead.
 * No accumulated RDP error, no infinite line and no backwards projection. */
export function simplifyOrderedPath(points: Pt[], tolerance: number): Pt[] {
  if (points.length < 3 || !Number.isFinite(tolerance) || tolerance <= 0) return points.slice();
  const protectedTurn = new Uint8Array(points.length);
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    if ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0) protectedTurn[i] = 1;
  }
  const accepted: Pt[] = [points[0]];
  let start = 0;
  const squared = tolerance * tolerance;
  while (start < points.length - 1) {
    let best = start + 1;
    for (let end = start + 2; end < Math.min(points.length, start + 65); end++) {
      if (protectedTurn[end - 1]) break;
      const a = points[start], b = points[end], dx = b[0] - a[0], dy = b[1] - a[1];
      const lengthSquared = dx * dx + dy * dy;
      if (!lengthSquared) break;
      let projection = 0, valid = true;
      for (let index = start + 1; index < end; index++) {
        const p = points[index];
        const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared;
        const ex = p[0] - (a[0] + t * dx), ey = p[1] - (a[1] + t * dy);
        if (t < projection || t > 1 || ex * ex + ey * ey > squared) { valid = false; break; }
        projection = t;
      }
      if (!valid) break;
      best = end;
    }
    accepted.push(points[best]);
    start = best;
  }
  return accepted;
}

export interface VacuumRenderGeometry {
  path: VacPath;
  rawPoints: number;
  renderedPoints: number;
  limited: boolean;
  physicalVerified: boolean;
}

export class VacuumPathGeometryCache {
  private values = new WeakMap<object, Map<string, VacuumRenderGeometry>>();
  computations = 0;

  resolve(raw: VacPath, matrix: Affine, cmPerUnit: number, budget: number): VacuumRenderGeometry {
    const key = `${matrix.join(',')}|${cmPerUnit}|${budget}`;
    const cached = this.values.get(raw)?.get(key);
    if (cached) return cached;
    this.computations++;
    const matrixValid = matrix.length === 6 && matrix.every(Number.isFinite);
    const valid = matrixValid && Number.isFinite(cmPerUnit) && cmPerUnit > 0
      && Math.abs(matrix[0] * matrix[4] - matrix[1] * matrix[3]) > 1e-12;
    const calibrated: VacPath = matrixValid ? raw.map((segment) => segment.map(([x, y]): Pt => [
      matrix[0] * x + matrix[1] * y + matrix[2], matrix[3] * x + matrix[4] * y + matrix[5],
    ])).filter((segment) => segment.every((point) => point.every(Number.isFinite))) : [];
    const rawPoints = raw.reduce((sum, segment) => sum + segment.length, 0);
    const reduced = valid ? calibrated.map((p) => simplifyOrderedPath(p, VAC_SIMPLIFY_CM / cmPerUnit)) : calibrated;
    const capacity = Number.isFinite(budget) ? Math.max(0, Math.floor(budget)) : 0;
    const limited = reduced.reduce((sum, p) => sum + p.length, 0) > capacity;
    // Reserve one point for the real latest endpoint, isolated from the prefix.
    // A zero remaining scene quota can only report limited in diagnostics.
    let available = Math.max(0, capacity - (limited ? 1 : 0));
    const path: VacPath = [];
    for (const segment of reduced) {
      if (segment.length > available) {
        // Honest contiguous original prefix, NEVER a chord over omitted data.
        if (available >= 2) path.push(segment.slice(0, available));
        break;
      }
      path.push(segment);
      available -= segment.length;
    }
    if (limited && capacity > 0) {
      let latest: Pt | undefined;
      for (let i = reduced.length - 1; i >= 0 && !latest; i--) {
        const segment = reduced[i]; latest = segment[segment.length - 1];
      }
      if (latest) path.push([latest]);
    }
    const result = { path: freezeVacuumPath(path), rawPoints,
      renderedPoints: path.reduce((sum, p) => sum + p.length, 0), limited, physicalVerified: valid };
    const entries = this.values.get(raw) ?? new Map<string, VacuumRenderGeometry>();
    // Changing calibration is not an unbounded history of render copies.
    if (entries.size >= 4) entries.delete(entries.keys().next().value!);
    entries.set(key, result);
    this.values.set(raw, entries);
    return result;
  }
}
