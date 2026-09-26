import { difference, type Geom } from 'polyclip-ts';
import { geometryArea } from './physical-geometry';
import { CANVAS_LIMIT, GRID_N, NORM_W } from './canvas-constants';

export const STAIR_TREAD_CM = 30;
export const MAX_STAIRS_PER_SPACE = 250;

export type StraightStairDirection = 'forward' | 'backward';
export type SpiralStairDirection = 'clockwise' | 'counterclockwise';

interface StairCommon {
  id: string;
  x: number;
  y: number;
  angle: number;
  target_space_id?: string | null;
}

export interface StraightStair extends StairCommon {
  kind: 'straight';
  direction: StraightStairDirection;
  length: number;
  width: number;
}

export interface SpiralStair extends StairCommon {
  kind: 'spiral';
  direction: SpiralStairDirection;
  radius: number;
}

export type Stair = StraightStair | SpiralStair;

export interface StairLine {
  a: [number, number];
  b: [number, number];
}

export interface StairRenderGeometry {
  outline: number[][];
  treads: StairLine[];
  arrowPath: string;
  center: [number, number];
}

type CachedRenderGeometry = {
  fingerprint: string;
  geometry: StairRenderGeometry;
};

/**
 * Live entity updates repaint the card without changing persisted stairs.
 * Keep the comparatively dense spiral/tread geometry behind an object-scoped
 * cache so those unrelated updates do not rebuild it on every render.
 *
 * The fingerprint also makes the helper safe for the few write paths which
 * temporarily mutate a config record in place before the authoritative model
 * is rebuilt. Weak keys keep deleted spaces/stairs collectible.
 */
const RENDER_GEOMETRY_CACHE = new WeakMap<object, CachedRenderGeometry>();

function renderFingerprint(stair: Stair, cellCm: number, scale: number): string {
  return stair.kind === 'straight'
    ? `${cellCm}|${scale}|${stair.kind}|${stair.x}|${stair.y}|${stair.angle}|${stair.direction}|${stair.length}|${stair.width}`
    : `${cellCm}|${scale}|${stair.kind}|${stair.x}|${stair.y}|${stair.angle}|${stair.direction}|${stair.radius}`;
}

const finite = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const cmToNorm = (cm: number, cellCm: number): number => (
  Number(cm) / ((Number(cellCm) > 0 ? Number(cellCm) : 5) * GRID_N)
);

export function isStair(value: unknown): value is Stair {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || !item.id || (item.kind !== 'straight' && item.kind !== 'spiral')) return false;
  if (![item.x, item.y, item.angle].every((entry) => finite(entry) !== null)) return false;
  if (Math.abs(Number(item.x)) > CANVAS_LIMIT || Math.abs(Number(item.y)) > CANVAS_LIMIT
      || Math.abs(Number(item.angle)) > 360) return false;
  if (item.target_space_id != null && typeof item.target_space_id !== 'string') return false;
  const validSize = (entry: unknown): boolean => {
    const size = finite(entry) ?? 0;
    return size > 0 && size <= CANVAS_LIMIT;
  };
  if (item.kind === 'straight') {
    return item.direction === 'forward' || item.direction === 'backward'
      ? validSize(item.length) && validSize(item.width)
      : false;
  }
  return item.direction === 'clockwise' || item.direction === 'counterclockwise'
    ? validSize(item.radius)
    : false;
}

export function stairList(value: unknown): Stair[] {
  return Array.isArray(value) ? value.filter(isStair).slice(0, MAX_STAIRS_PER_SPACE) : [];
}

const rotate = (x: number, y: number, angle: number): [number, number] => {
  const radians = angle * Math.PI / 180;
  const cosine = Math.cos(radians), sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine];
};

const worldPoint = (stair: Stair, localX: number, localY: number, scale: number): [number, number] => {
  const [dx, dy] = rotate(localX * scale, localY * scale, stair.angle);
  return [stair.x * scale + dx, stair.y * scale + dy];
};

export function stairOutline(stair: Stair, scale = NORM_W, circleSegments = 64): number[][] {
  if (stair.kind === 'straight') {
    const halfLength = stair.length * scale / 2;
    const halfWidth = stair.width * scale / 2;
    return [
      [-halfLength, -halfWidth], [halfLength, -halfWidth],
      [halfLength, halfWidth], [-halfLength, halfWidth],
    ].map(([x, y]) => {
      const [dx, dy] = rotate(x, y, stair.angle);
      return [stair.x * scale + dx, stair.y * scale + dy];
    });
  }
  const count = Math.max(24, Math.round(circleSegments));
  return Array.from({ length: count }, (_, index) => {
    const radians = index * Math.PI * 2 / count;
    return [
      (stair.x + Math.cos(radians) * stair.radius) * scale,
      (stair.y + Math.sin(radians) * stair.radius) * scale,
    ];
  });
}

const arrowHead = (
  tip: [number, number], bearing: number, size: number,
): string => {
  const left = rotate(-size, -size * 0.62, bearing);
  const right = rotate(-size, size * 0.62, bearing);
  return `M ${tip[0]} ${tip[1]} L ${tip[0] + left[0]} ${tip[1] + left[1]} M ${tip[0]} ${tip[1]} L ${tip[0] + right[0]} ${tip[1] + right[1]}`;
};

export function stairRenderGeometry(
  stair: Stair, cellCm: number, scale = NORM_W,
): StairRenderGeometry {
  const center: [number, number] = [stair.x * scale, stair.y * scale];
  const outline = stairOutline(stair, scale);
  const treadN = cmToNorm(STAIR_TREAD_CM, cellCm);
  if (stair.kind === 'straight') {
    const count = Math.max(0, Math.floor(stair.length / treadN));
    const treads: StairLine[] = [];
    for (let index = 1; index <= count; index++) {
      const x = -stair.length / 2 + index * treadN;
      if (x >= stair.length / 2 - 1e-10) break;
      treads.push({
        a: worldPoint(stair, x, -stair.width / 2, scale),
        b: worldPoint(stair, x, stair.width / 2, scale),
      });
    }
    const forward = stair.direction === 'forward';
    const fromX = (forward ? -0.3 : 0.3) * stair.length;
    const toX = (forward ? 0.3 : -0.3) * stair.length;
    const from = worldPoint(stair, fromX, 0, scale);
    const tip = worldPoint(stair, toX, 0, scale);
    const bearing = stair.angle + (forward ? 0 : 180);
    const size = Math.min(stair.width, stair.length) * scale * 0.16;
    return {
      outline, treads, center,
      arrowPath: `M ${from[0]} ${from[1]} L ${tip[0]} ${tip[1]} ${arrowHead(tip, bearing, size)}`,
    };
  }

  const travelRadius = stair.radius * 2 / 3;
  const circumference = Math.PI * 2 * travelRadius;
  const count = Math.max(1, Math.floor(circumference / treadN));
  const sign = stair.direction === 'clockwise' ? 1 : -1;
  const treads: StairLine[] = [];
  for (let index = 0; index < count; index++) {
    const localAngle = index * (treadN / travelRadius) * sign;
    const degrees = stair.angle + localAngle * 180 / Math.PI;
    const inner = rotate(stair.radius * scale * 0.18, 0, degrees);
    const outer = rotate(stair.radius * scale, 0, degrees);
    treads.push({
      a: [center[0] + inner[0], center[1] + inner[1]],
      b: [center[0] + outer[0], center[1] + outer[1]],
    });
  }
  const radius = stair.radius * scale * 0.62;
  const start = stair.angle * Math.PI / 180;
  const sweep = sign * Math.PI * 1.5;
  const end = start + sweep;
  const from: [number, number] = [center[0] + Math.cos(start) * radius, center[1] + Math.sin(start) * radius];
  const tip: [number, number] = [center[0] + Math.cos(end) * radius, center[1] + Math.sin(end) * radius];
  const sweepFlag = sign > 0 ? 1 : 0;
  const tangent = end * 180 / Math.PI + (sign > 0 ? 90 : -90);
  return {
    outline, treads, center,
    arrowPath: `M ${from[0]} ${from[1]} A ${radius} ${radius} 0 1 ${sweepFlag} ${tip[0]} ${tip[1]} ${arrowHead(tip, tangent, stair.radius * scale * 0.16)}`,
  };
}

export function cachedStairRenderGeometry(
  stair: Stair, cellCm: number, scale = NORM_W,
): StairRenderGeometry {
  const fingerprint = renderFingerprint(stair, cellCm, scale);
  const cached = RENDER_GEOMETRY_CACHE.get(stair);
  if (cached?.fingerprint === fingerprint) return cached.geometry;
  const geometry = stairRenderGeometry(stair, cellCm, scale);
  RENDER_GEOMETRY_CACHE.set(stair, { fingerprint, geometry });
  return geometry;
}

export function stairFootprintGeometry(stair: Stair, scale = NORM_W): Geom {
  const ring = stairOutline(stair, scale);
  return (ring.length ? [[[...ring, ring[0]]]] : []) as unknown as Geom;
}

export function floorAreaMinusStairs(
  floor: readonly number[][], stairs: readonly Stair[] | null | undefined, scale = NORM_W,
): number {
  if (floor.length < 3) return 0;
  const geometry = [[[...floor.map((point) => [point[0], point[1]]), [floor[0][0], floor[0][1]]]]] as Geom;
  return geometryAreaMinusStairs(geometry, stairs, scale);
}

export function geometryAreaMinusStairs(
  source: Geom, stairs: readonly Stair[] | null | undefined, scale = NORM_W,
): number {
  return Math.max(0, geometryArea(geometryMinusStairs(source, stairs, scale)));
}

export function geometryMinusStairs(
  source: Geom, stairs: readonly Stair[] | null | undefined, scale = NORM_W,
): Geom {
  const footprints = stairList(stairs).map((stair) => stairFootprintGeometry(stair, scale));
  if (!footprints.length) return source;
  try {
    // A single sweep avoids repeatedly rebuilding the same subject for dense floors.
    return difference(source, ...footprints);
  } catch {
    // Keep a valid room usable if one future record reaches this layer malformed.
    let geometry = source;
    for (const footprint of footprints) {
      try { geometry = difference(geometry, footprint); } catch { /* skip only the bad record */ }
    }
    return geometry;
  }
}
