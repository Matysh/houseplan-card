import { canonicalizeNumber, canonicalizeLatticeCoordinate, COORDINATE_FACTOR, LATTICE_GRID_N } from './coordinate-canonicalization';
import { WALL_INCIDENT_EPS } from './wall-incidence';

/** Compare a stored endpoint with its derived carrier projection at the
 * existing nine-decimal storage boundary. Never use this to merge two
 * independently authored endpoints or to replace their original coordinates. */
export function sameStoredWallPoint(
  stored: readonly number[], derived: readonly number[], coordinateScale = 1,
): boolean {
  return Number.isFinite(coordinateScale) && coordinateScale > 0
    && stored.length >= 2 && derived.length >= 2
    && [0, 1].every(axis => Number.isFinite(stored[axis])
      && Number.isFinite(derived[axis])
      && canonicalizeNumber(stored[axis] / coordinateScale)
        === canonicalizeNumber(derived[axis] / coordinateScale));
}

const storageUncertainty = (value: number): number => {
  const steps = value * LATTICE_GRID_N;
  const roundoff = Number.EPSILON * 16 * Math.max(1, Math.abs(steps));
  // The storage boundary retains exact lattice fractions, rather than
  // rounding them to nine decimals. Only off-lattice scalars lose precision.
  return Math.abs(steps - Math.round(steps)) <= roundoff ? 0 : .5 / COORDINATE_FACTOR;
};

/** Prove a stored endpoint can lie on the finite carrier within the existing
 * scalar quantization envelopes. The cross-product bound accounts for both
 * the endpoint and the two stored carrier ends, not the topology epsilon.
 * Existing interior T incidences also retain the unchanged P4 quantum. It
 * is not permission to merge two distinct authored endpoints. */
export function storedWallContact(
  point: readonly number[], a: readonly number[], b: readonly number[], coordinateScale = 1,
  allowExistingIncidence = true,
): boolean {
  if (!(Number.isFinite(coordinateScale) && coordinateScale > 0)) return false;
  const p = point.map(value => value / coordinateScale);
  const left = a.map(value => value / coordinateScale);
  const right = b.map(value => value / coordinateScale);
  if (![...p, ...left, ...right].every(Number.isFinite)) return false;
  const dx = right[0] - left[0], dy = right[1] - left[1];
  const length2 = dx * dx + dy * dy;
  if (!(length2 > 0)) return false;
  const ex = storageUncertainty(p[0])
    + Math.max(storageUncertainty(left[0]), storageUncertainty(right[0]));
  const ey = storageUncertainty(p[1])
    + Math.max(storageUncertainty(left[1]), storageUncertainty(right[1]));
  const roundoff = Number.EPSILON * 16 * Math.max(1, ...p.map(Math.abs),
    ...left.map(Math.abs), ...right.map(Math.abs)) ** 2;
  const cross = Math.abs(dx * (p[1] - left[1]) - dy * (p[0] - left[0]));
  const t = ((p[0] - left[0]) * dx + (p[1] - left[1]) * dy) / length2;
  if (cross > Math.abs(dy) * ex + Math.abs(dx) * ey + roundoff)
    return allowExistingIncidence && t > 0 && t < 1
      && cross / Math.sqrt(length2) <= WALL_INCIDENT_EPS;
  const along = (Math.abs(dx) * ex + Math.abs(dy) * ey + roundoff) / length2;
  return t >= -along && t <= 1 + along;
}

/** Grants only exact accepted vertices from a freshly proved source graph,
 * including intersections on an existing contour. Arbitrary dialog points
 * cannot enlarge the off-grid baseline. Inputs are normalized coordinates. */
export function wallFaceProvenPoints(
  accepted: readonly (readonly (readonly number[])[])[],
  proven: readonly (readonly (readonly number[])[])[],
): number[][] {
  return proven.flatMap(ring => ring)
    .filter(point => accepted.some(ring => ring.some(vertex => sameStoredWallPoint(point, vertex))))
    .map(point => [Number(canonicalizeLatticeCoordinate(point[0])), Number(canonicalizeLatticeCoordinate(point[1]))]);
}
