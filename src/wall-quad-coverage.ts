/** Conservative containment proof for a wall's convex strip. A covered strip
 * cannot add masonry to the accumulated body, so neither its clipping pass nor
 * its union is needed. Any numerically ambiguous predicate takes the ordinary
 * boolean path; this is not a geometry tolerance or a simplified wall model. */
type Point = readonly number[];
type Ring = readonly Point[];
type Geometry = readonly (readonly Ring[])[];
type Sign = -1 | 0 | 1 | null;

const same = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1];
const orientation = (a: Point, b: Point, p: Point): Sign => {
  const dx = b[0] - a[0], dy = b[1] - a[1], px = p[0] - a[0], py = p[1] - a[1];
  const left = dx * py, right = dy * px;
  // Relative-error bounds do not apply to underflowed or subnormal products.
  // Extreme-but-finite input must take clipping, not look exactly collinear.
  const minNormal = 2 ** -1022;
  if ((left === 0 && dx !== 0 && py !== 0) || (right === 0 && dy !== 0 && px !== 0)
      || (left !== 0 && Math.abs(left) < minNormal) || (right !== 0 && Math.abs(right) < minNormal)) return null;
  if (left === 0 && right === 0) return 0;
  const determinant = left - right;
  // A floating zero formed by cancellation is not an exact collinearity proof.
  if (!Number.isFinite(determinant)
      || Math.abs(determinant) <= Number.EPSILON * 8 * (Math.abs(left) + Math.abs(right))) return null;
  return determinant < 0 ? -1 : 1;
};
const between = (p: Point, a: Point, b: Point): boolean =>
  p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
    && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);

/** -1 outside, 0 on an exactly proved edge, 1 inside, null unproved. */
const location = (point: Point, ring: Ring): Sign => {
  let winding = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    if (same(a, b)) continue;
    const sign = orientation(a, b, point);
    if (sign === 0 && between(point, a, b)) return 0;
    const up = a[1] <= point[1] && b[1] > point[1];
    const down = b[1] <= point[1] && a[1] > point[1];
    if (sign === null && (up || down || between(point, a, b))) return null;
    if (up && sign === 1) winding++;
    if (down && sign === -1) winding--;
  }
  return winding ? 1 : -1;
};

export function wallQuadCovered(quad: Ring, geometry: Geometry): boolean {
  if (quad.length !== 4 || !quad.every(p => p.length === 2 && p.every(Number.isFinite))) return false;
  const directions = quad.map((a, i) => orientation(a, quad[(i + 1) % 4], quad[(i + 2) % 4]));
  if (!directions[0] || directions.some(sign => sign !== directions[0])) return false;
  const outward = directions[0] === 1 ? -1 : 1;
  const center = [quad.reduce((sum, p) => sum + p[0], 0) / 4,
    quad.reduce((sum, p) => sum + p[1], 0) / 4];
  return geometry.some(polygon => {
    if (!polygon.length || polygon.some(ring => ring.length < 4 || !same(ring[0], ring[ring.length - 1])
        || !ring.every(point => point.length === 2 && point.every(Number.isFinite)))) return false;
    if (location(center, polygon[0]) !== 1 || polygon.slice(1).some(hole => location(center, hole) !== -1)) return false;
    for (const point of quad) {
      const outer = location(point, polygon[0]);
      if (outer === null || outer < 0) return false;
      for (const hole of polygon.slice(1)) {
        const inside = location(point, hole);
        if (inside === null || inside > 0) return false;
      }
    }
    for (const ring of polygon) {
      // Every boundary segment must be separated from the open convex quad
      // by one of its supporting lines. Testing both endpoints proves this
      // for the whole segment, including long edges through quad vertices.
      // No separator (or an ambiguous orientation) means ordinary clipping.
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i], b = ring[i + 1];
        let separated = false;
        for (let q = 0; q < 4; q++) {
          const sideA = orientation(quad[q], quad[(q + 1) % 4], a);
          const sideB = orientation(quad[q], quad[(q + 1) % 4], b);
          if ((sideA === 0 || sideA === outward) && (sideB === 0 || sideB === outward)) {
            separated = true;
            break;
          }
        }
        if (!separated) return false;
      }
    }
    return true;
  });
}
