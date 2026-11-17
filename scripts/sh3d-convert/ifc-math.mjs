import { IfcError } from './ifc-errors.mjs';

export const EPS = 1e-6;
export const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const dot = (a, b) => a.reduce((n, x, i) => n + x * b[i], 0);
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function unit(a) {
  const length = Math.hypot(...a);
  if (!(length > EPS)) throw new IfcError('ifc_invalid_geometry');
  return a.map(x => x / length);
}
export const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** Column-major affine matrices, metres are applied once at the source boundary. */
export function multiply(a, b) {
  const m = Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    for (let k = 0; k < 4; k++) m[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return m;
}
export const transform = (m, p, vector = false) => [0, 1, 2].map(r =>
  m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * (p[2] || 0) + (vector ? 0 : m[12 + r]));
export function inverse(m) {
  const a = [m[0], m[1], m[2]], b = [m[4], m[5], m[6]], c = [m[8], m[9], m[10]];
  const det = dot(a, cross3(b, c));
  if (Math.abs(det) < 1e-12) throw new IfcError('ifc_invalid_geometry');
  const rows = [cross3(b, c), cross3(c, a), cross3(a, b)].map(v => v.map(x => x / det));
  const result = identity(), t = m.slice(12, 15);
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 3; col++) result[col * 4 + r] = rows[r][col];
    result[12 + r] = -dot(rows[r], t);
  }
  return result;
}
export function axes(origin, z = [0, 0, 1], x = [1, 0, 0]) {
  z = unit(z); x = unit(sub(x, z.map(v => v * dot(x, z))));
  const y = cross3(z, x);
  return [...x, 0, ...y, 0, ...z, 0, ...origin, 1];
}
export function horizontal(m) {
  const x = transform(m, [1, 0, 0], true), y = transform(m, [0, 1, 0], true), z = transform(m, [0, 0, 1], true);
  return Math.abs(x[2]) < EPS && Math.abs(y[2]) < EPS && Math.hypot(z[0], z[1]) < EPS
    && Math.abs(dot(x, y)) < EPS && Math.abs(Math.hypot(...x) - Math.hypot(...y)) < EPS;
}
export const segmentLength = w => distance(w.a, w.b);
export function project(p, a, b) {
  const v = sub(b, a), length2 = dot(v, v);
  if (length2 < EPS ** 2) throw new IfcError('ifc_invalid_geometry');
  const t = dot(sub(p, a), v) / length2;
  const q = a.map((x, i) => x + v[i] * t);
  return { t, point: q, distance: distance(p, q) };
}
export function intersectLines(a, b, c, d) {
  const u = sub(b, a), v = sub(d, c), delta = sub(c, a), det = u[0] * v[1] - u[1] * v[0];
  if (Math.abs(det) < EPS * EPS) return null;
  const t = (delta[0] * v[1] - delta[1] * v[0]) / det;
  return [a[0] + t * u[0], a[1] + t * u[1]];
}
export function validPolygon(poly) {
  if (!Array.isArray(poly) || poly.length < 3 || poly.length > 500) return false;
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (a.some(v => !Number.isFinite(v)) || distance(a, b) < EPS) return false;
    area += a[0] * b[1] - a[1] * b[0];
    for (let j = i + 2; j < poly.length; j++) {
      if (i === 0 && j === poly.length - 1) continue;
      const c = poly[j], d = poly[(j + 1) % poly.length], hit = intersectLines(a, b, c, d);
      if (hit && project(hit, a, b).t >= -EPS && project(hit, a, b).t <= 1 + EPS
          && project(hit, c, d).t >= -EPS && project(hit, c, d).t <= 1 + EPS) return false;
      if (!hit && project(c, a, b).distance < EPS && project(d, a, b).distance < EPS) {
        const lo = Math.max(0, Math.min(project(c, a, b).t, project(d, a, b).t));
        const hi = Math.min(1, Math.max(project(c, a, b).t, project(d, a, b).t));
        if (hi >= lo - EPS) return false;
      }
    }
  }
  return Math.abs(area) > EPS ** 2;
}
