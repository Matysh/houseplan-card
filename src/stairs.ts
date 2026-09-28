import { difference, type Geom } from 'polyclip-ts';
import { geometryArea } from './physical-geometry';
import { CANVAS_LIMIT, GRID_N, NORM_W } from './canvas-constants';
import { safeStoredColor } from './color';

export const STAIR_TREAD_CM = 30;
/** One physical line weight for every visible part of either stair symbol (#688). */
export const STAIR_STROKE_CM = 3.6;
export const MAX_STAIRS_PER_SPACE = 250;

const STAIR_REFERENCE_CELL_CM = 5;
const STAIR_REFERENCE_GRID_PITCH = NORM_W / GRID_N;

/** Physical stair line weight expressed in the current plan coordinate system. */
export function stairStrokeUnits(
  cellCm: unknown,
  gridPitch: unknown = STAIR_REFERENCE_GRID_PITCH,
): number {
  const rawCell = Number(cellCm);
  const cell = Number.isFinite(rawCell) && rawCell > 0 ? rawCell : STAIR_REFERENCE_CELL_CM;
  const rawPitch = Number(gridPitch);
  const pitch = Number.isFinite(rawPitch) && rawPitch > 0
    ? rawPitch : STAIR_REFERENCE_GRID_PITCH;
  return (STAIR_STROKE_CM / cell) * pitch;
}

/** Physical stair line weight on paper, in millimetres, at a 1:N scale. */
export function stairStrokePrintMm(printScale: unknown): number {
  const rawScale = Number(printScale);
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
  return (STAIR_STROKE_CM * 10) / scale;
}

export type StraightStairDirection = 'forward' | 'backward';
export type SpiralStairDirection = 'clockwise' | 'counterclockwise';

interface StairCommon {
  id: string;
  x: number;
  y: number;
  angle: number;
  target_space_id?: string | null;
  color?: string;
  opacity?: number;
  fill_color?: string;
  fill_opacity?: number;
}

export interface StairVisualStyle {
  color: string;
  opacity: number;
  fillColor: string;
  fillOpacity: number;
}

export type StairVisualFields = Pick<
  StairCommon, 'color' | 'opacity' | 'fill_color' | 'fill_opacity'
>;

export const DEFAULT_STAIR_VISUAL_STYLE: StairVisualStyle = {
  color: '#607d8b',
  opacity: 1,
  fillColor: '#607d8b',
  fillOpacity: 0,
};

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
  trapezoid: StairLine[];
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

const clamp01 = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
};

/** Resolve optional persisted colours without mutating a legacy stair record. */
export function stairVisualStyle(
  stair: StairVisualFields,
  fallback: Pick<StairVisualStyle, 'color' | 'opacity'> = DEFAULT_STAIR_VISUAL_STYLE,
): StairVisualStyle {
  const fallbackColor = safeStoredColor(fallback.color, DEFAULT_STAIR_VISUAL_STYLE.color);
  const color = safeStoredColor(stair.color, fallbackColor);
  return {
    color,
    opacity: clamp01(stair.opacity, clamp01(fallback.opacity, 1)),
    fillColor: safeStoredColor(stair.fill_color, color),
    fillOpacity: clamp01(stair.fill_opacity, 0),
  };
}

export function stairVisualFields(style: StairVisualStyle): StairVisualFields {
  const resolved = stairVisualStyle({
    color: style.color,
    opacity: style.opacity,
    fill_color: style.fillColor,
    fill_opacity: style.fillOpacity,
  });
  return {
    color: resolved.color,
    opacity: resolved.opacity,
    fill_color: resolved.fillColor,
    fill_opacity: resolved.fillOpacity,
  };
}

export function stairStyleVars(
  stair: Stair,
  cellCm: unknown,
  gridPitch: unknown,
  fallback: Pick<StairVisualStyle, 'color' | 'opacity'> = DEFAULT_STAIR_VISUAL_STYLE,
): string {
  const style = stairVisualStyle(stair, fallback);
  return `--hp-stair-line:${style.color};--hp-stair-line-opacity:${style.opacity};`
    + `--hp-stair-fill:${style.fillColor};--hp-stair-fill-opacity:${style.fillOpacity};`
    + `--hp-stair-stroke:${stairStrokeUnits(cellCm, gridPitch)}`;
}

/** Number of equal intervals whose physical size is closest to 30 cm. */
export function stairIntervalCount(pathCm: number): number {
  const length = Number(pathCm);
  if (!(length > 0) || !Number.isFinite(length)) return 1;
  const quotient = length / STAIR_TREAD_CM;
  const lower = Math.max(1, Math.floor(quotient));
  const upper = Math.max(1, Math.ceil(quotient));
  const error = (count: number): number => Math.abs(length / count - STAIR_TREAD_CM);
  return error(upper) <= error(lower) ? upper : lower;
}

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
  if (stair.kind === 'straight') {
    const count = stairIntervalCount(stair.length * cellCm * GRID_N);
    const startHalfWidth = stair.width * (stair.direction === 'forward' ? 0.4 : 0.5);
    const endHalfWidth = stair.width * (stair.direction === 'forward' ? 0.5 : 0.4);
    const startX = -stair.length / 2;
    const endX = stair.length / 2;
    const startTop = worldPoint(stair, startX, -startHalfWidth, scale);
    const startBottom = worldPoint(stair, startX, startHalfWidth, scale);
    const endTop = worldPoint(stair, endX, -endHalfWidth, scale);
    const endBottom = worldPoint(stair, endX, endHalfWidth, scale);
    // The 100% base is already the matching short side of the outer outline.
    // Draw it only once; the trapezoid contributes its two legs and 80% base.
    const trapezoid: StairLine[] = [
      { a: startTop, b: endTop },
      { a: startBottom, b: endBottom },
      stair.direction === 'forward'
        ? { a: startTop, b: startBottom }
        : { a: endTop, b: endBottom },
    ];
    const treads: StairLine[] = [];
    for (let index = 1; index < count; index++) {
      const fraction = index / count;
      const x = startX + stair.length * fraction;
      const halfWidth = startHalfWidth + (endHalfWidth - startHalfWidth) * fraction;
      treads.push({
        a: worldPoint(stair, x, -halfWidth, scale),
        b: worldPoint(stair, x, halfWidth, scale),
      });
    }
    const from = worldPoint(stair, -0.3 * stair.length, 0, scale);
    const tip = worldPoint(stair, 0.3 * stair.length, 0, scale);
    const bearing = stair.angle;
    const size = Math.min(stair.width, stair.length) * scale * 0.16;
    return {
      outline, trapezoid, treads, center,
      arrowPath: `M ${from[0]} ${from[1]} L ${tip[0]} ${tip[1]} ${arrowHead(tip, bearing, size)}`,
    };
  }

  const travelRadius = stair.radius * 2 / 3;
  const circumference = Math.PI * 2 * travelRadius;
  const count = stairIntervalCount(circumference * cellCm * GRID_N);
  const sign = stair.direction === 'clockwise' ? 1 : -1;
  const treads: StairLine[] = [];
  for (let index = 0; index < count; index++) {
    const localAngle = index * (Math.PI * 2 / count) * sign;
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
    outline, trapezoid: [], treads, center,
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
  const footprints = stairFootprintsTouching(source, stairs, scale);
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

type Bounds = readonly [number, number, number, number];

function geometryBounds(geometry: Geom): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number') {
      const x = value[0];
      const y = value[1] as number;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return;
    }
    for (const item of value) visit(item);
  };
  visit(geometry);
  return minX <= maxX && minY <= maxY ? [minX, minY, maxX, maxY] : null;
}

const boundsOverlap = (a: Bounds, b: Bounds | null): boolean => !!b
  && a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/**
 * #669: only a footprint whose bounds overlap the subject can change the
 * difference. A room on a maximum-size floor otherwise sends all 250 stair
 * footprints into one polyclip sweep, and the room count multiplies it.
 */
export function stairFootprintsTouching(
  source: Geom, stairs: readonly Stair[] | null | undefined, scale = NORM_W,
): Geom[] {
  const bounds = geometryBounds(source);
  if (!bounds) return [];
  return stairList(stairs)
    .map((stair) => stairFootprintGeometry(stair, scale))
    .filter((footprint) => boundsOverlap(bounds, geometryBounds(footprint)));
}

/**
 * The summary panel calculates floor area after the first paint. A maximum
 * size space may contain 250 stairs; clipping all their footprints in one
 * polyclip call is observably one long main-thread task on slower clients.
 * Keep the synchronous helper above for ordinary room-sized callers, while
 * this iterator bounds each background slice and lets the scheduler yield.
 */
export function* geometryMinusStairsSteps(
  source: Geom,
  stairs: readonly Stair[] | null | undefined,
  scale = NORM_W,
  batchSize = 24,
): Generator<void, Geom, void> {
  const footprints = stairList(stairs).map((stair) => stairFootprintGeometry(stair, scale));
  const size = Math.max(1, Math.floor(batchSize));
  let geometry = source;
  for (let index = 0; index < footprints.length; index += size) {
    const batch = footprints.slice(index, index + size);
    try {
      geometry = difference(geometry, ...batch);
    } catch {
      for (const footprint of batch) {
        try { geometry = difference(geometry, footprint); } catch { /* skip only the bad record */ }
      }
    }
    yield;
  }
  return geometry;
}
