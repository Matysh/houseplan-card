/** #885: an exact H/V wall end aligned with the line through a parallel wall end.
 * Editor-only (Walls drawing, wall-node move): kept out of the startup graph. */
import { roomEdges } from './logic';
import type { SpaceModel } from './types';

/**
 * #885 magnet. A placed end of an exact horizontal (`along` 0) or vertical
 * (`along` 1) wall takes coordinate `along` of the nearest end of a PARALLEL
 * exact H/V wall when the probe (cursor) is within `radius` of the
 * perpendicular line through it; the cross coordinate is the caller's and is
 * never touched. Values in `avoid` (the wall's own fixed ends) would collapse
 * it. Off-grid ends are exact targets. `d` lets the caller arbitrate a tie.
 */
export function alignWallEnd(
  probe: readonly number[], along: 0 | 1, walls: readonly (readonly number[])[][],
  radius: number, avoid: readonly number[], eps: number,
): { at: number; d: number } | null {
  let best: { at: number; d: number } | null = null;
  for (const [a, b] of walls) {
    if (Math.abs(a[1 - along] - b[1 - along]) > eps || Math.abs(a[along] - b[along]) <= eps) continue;
    for (const end of [a[along], b[along]]) {
      const d = Math.abs(end - probe[along]);
      if (d <= radius && (!best || d < best.d) && !avoid.some((v) => Math.abs(v - end) <= eps)) best = { at: end, d };
    }
  }
  return best;
}

const planWallCache = new WeakMap<object, number[][][]>();
/** #885: room edges and independent walls (zero thickness included) as [a, b], cached per `key`. */
export function planWalls(
  key: object, space: Pick<SpaceModel, 'rooms' | 'partitions'>,
): number[][][] {
  let walls = planWallCache.get(key);
  if (!walls) planWallCache.set(key, walls = [
    ...roomEdges(space.rooms).map((e) => [[e[0], e[1]], [e[2], e[3]]]),
    ...(space.partitions || []).map((p) => [p.a, p.b]),
  ]);
  return walls;
}

/** #885: the free end of an exact H/V Walls segment, aligned; diagonals and a zero length are left. */
export function alignDrawnWallEnd(
  anchor: readonly number[], point: number[], probe: readonly number[],
  walls: readonly (readonly number[])[][], radius: number, eps: number,
): number[] {
  const h = Math.abs(point[1] - anchor[1]) <= eps;
  if (h === Math.abs(point[0] - anchor[0]) <= eps) return point;
  const along = h ? 0 : 1, hit = alignWallEnd(probe, along, walls, radius, [anchor[along]], eps);
  return hit ? (h ? [hit.at, point[1]] : [point[0], hit.at]) : point;
}
