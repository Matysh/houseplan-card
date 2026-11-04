/** Numeric editor arithmetic only. Raw source decoding and exact graph reads
 * never pass through these helpers. `scale` is 1 for storage or NORM_W for UI. */
import { GRID_N, LATTICE_NOISE_STEPS } from './canvas-constants';

export function authoredLatticeIndex(value: number, scale = 1): number | undefined {
  if (!Number.isFinite(value) || !(scale > 0) || !Number.isFinite(scale)) return undefined;
  const steps = value / scale * GRID_N, index = Math.round(steps);
  return Number.isSafeInteger(index) && Math.abs(steps - index) < LATTICE_NOISE_STEPS ? index : undefined;
}

/** Translate proven lattice origins/offsets as integers; retain deliberate
 * off-grid geometry and non-grid clamps without rounding them. */
export function translateAuthoredCoordinate(value: number, offset: number, scale = 1): number {
  if (offset === 0) return value;
  const origin = authoredLatticeIndex(value, scale), delta = authoredLatticeIndex(offset, scale);
  return origin !== undefined && delta !== undefined && Number.isSafeInteger(origin + delta)
    ? (origin + delta) * scale / GRID_N : value + offset;
}
