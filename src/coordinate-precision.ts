/** Scalar precision shared by stored geometry and computed wall shells.
 * Keep this dependency-free of wall geometry and document transformations. */
import { LATTICE_NOISE_STEPS } from './canvas-constants';
export const COORDINATE_DECIMALS = 9;
export const COORDINATE_FACTOR = 10 ** COORDINATE_DECIMALS;
export const LATTICE_GRID_N = 240;

export function canonicalizeNumber(value: unknown): unknown {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  const sign = value < 0 || Object.is(value, -0) ? -1 : 1;
  const result = sign * (Math.floor(Math.abs(value) * COORDINATE_FACTOR + 0.5) / COORDINATE_FACTOR);
  return result === 0 ? 0 : result;
}

export function canonicalizeLatticeCoordinate(value: unknown): unknown {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value;
  const scaled = value * LATTICE_GRID_N, nearest = Math.round(scaled);
  if (Math.abs(scaled - nearest) < LATTICE_NOISE_STEPS) {
    const result = nearest / LATTICE_GRID_N;
    return result === 0 ? 0 : result;
  }
  return canonicalizeNumber(value);
}
