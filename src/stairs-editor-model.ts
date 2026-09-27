import { GRID_N, NORM_W } from './canvas-constants';
import { stairVisualFields, type Stair, type StairVisualStyle } from './stairs';

// Eager module: the View runtime imports `stairTargetState` from here, so this
// file must stay small. The editor-only box transforms live in
// `stairs-box.ts`, which only the lazy editor chunk imports (#676).

const finite = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const cmToNorm = (cm: number, cellCm: number): number => (
  Number(cm) / ((Number(cellCm) > 0 ? Number(cellCm) : 5) * GRID_N)
);

const normToCm = (value: number, cellCm: number): number => (
  Number(value) * (Number(cellCm) > 0 ? Number(cellCm) : 5) * GRID_N
);

export function normalizeStairAngle(value: unknown): number {
  const number = finite(value) ?? 0;
  const normalized = ((number % 360) + 360) % 360;
  return Number(normalized.toFixed(6));
}

export function defaultStair(
  kind: Stair['kind'], x: number, y: number, cellCm: number, id: string,
  visual?: StairVisualStyle,
): Stair {
  const style = visual ? stairVisualFields(visual) : {};
  if (kind === 'spiral') return {
    id, kind, x: x / NORM_W, y: y / NORM_W, angle: 0,
    direction: 'clockwise', radius: cmToNorm(90, cellCm), target_space_id: null,
    ...style,
  };
  return {
    id, kind, x: x / NORM_W, y: y / NORM_W, angle: 0,
    direction: 'forward', length: cmToNorm(240, cellCm), width: cmToNorm(100, cellCm),
    target_space_id: null,
    ...style,
  };
}

export function convertStairKind(stair: Stair, kind: Stair['kind']): Stair {
  if (stair.kind === kind) return { ...stair };
  if (stair.kind === 'straight') {
    const { kind: _kind, direction: _direction, length, width, ...common } = stair;
    return {
      ...common, kind: 'spiral',
      direction: stair.direction === 'backward' ? 'counterclockwise' : 'clockwise',
      radius: Math.max(length, width) / 2,
      target_space_id: common.target_space_id ?? null,
    };
  }
  const { kind: _kind, direction: _direction, radius, ...common } = stair;
  return {
    ...common, kind: 'straight',
    direction: stair.direction === 'counterclockwise' ? 'backward' : 'forward',
    length: radius * 2, width: radius * 2,
    target_space_id: common.target_space_id ?? null,
  };
}

const supportAlong = (stair: Stair, dx: number, dy: number, scale: number): number => {
  if (stair.kind === 'spiral') return stair.radius * scale;
  const bearing = stair.angle * Math.PI / 180;
  const ux = Math.cos(bearing), uy = Math.sin(bearing);
  const vx = -uy, vy = ux;
  return Math.abs(dx * ux + dy * uy) * stair.length * scale / 2
    + Math.abs(dx * vx + dy * vy) * stair.width * scale / 2;
};

/** Snap one independently movable footprint flush to the nearest other stair. */
export function snapStairToStairs(
  stair: Stair,
  center: readonly number[],
  others: readonly Stair[],
  reach: number,
  scale = NORM_W,
): [number, number] {
  let best: { x: number; y: number; gap: number } | null = null;
  const moved = { ...stair, x: center[0] / scale, y: center[1] / scale } as Stair;
  for (const other of others) {
    if (other.id === stair.id) continue;
    const ox = other.x * scale, oy = other.y * scale;
    const dx0 = center[0] - ox, dy0 = center[1] - oy;
    const distance = Math.hypot(dx0, dy0);
    if (!(distance > 1e-8)) continue;
    const dx = dx0 / distance, dy = dy0 / distance;
    const target = supportAlong(moved, dx, dy, scale)
      + supportAlong(other, dx, dy, scale);
    const gap = Math.abs(distance - target);
    if (gap <= reach && (!best || gap < best.gap)) {
      best = { x: ox + dx * target, y: oy + dy * target, gap };
    }
  }
  return best ? [best.x, best.y] : [center[0], center[1]];
}

export function stairPhysicalSizeCm(stair: Stair, cellCm: number): number[] {
  return stair.kind === 'straight'
    ? [normToCm(stair.length, cellCm), normToCm(stair.width, cellCm)]
    : [normToCm(stair.radius, cellCm)];
}

export function stairTargetState(
  stair: Stair, currentSpaceId: string, spaceIds: ReadonlySet<string>, fixedFloor: boolean,
): 'active' | 'missing' | 'self' | 'deleted' | 'fixed' {
  if (fixedFloor) return 'fixed';
  if (!stair.target_space_id) return 'missing';
  if (stair.target_space_id === currentSpaceId) return 'self';
  return spaceIds.has(stair.target_space_id) ? 'active' : 'deleted';
}
