/** Editor-only placement geometry for the furniture tool (#359, #445). */
import { clampCanvasN } from './space-geometry';
import { clampFurnSize, cmToNorm, furnitureGraphic } from './furniture';
import type { FurnitureWallSurface } from './furniture-wall-surface';

/** How far from a wall the magnet still reaches, in grid cells. */
export const FURN_WALL_CELLS = 6;

export interface FurnitureSnap {
  cx: number;
  cy: number;
  angle: number;
  /** Distance from the unsnapped intent point to the physical surface. */
  dist: number;
}

/** Final normalised box shared by the placement ghost and saved decor record. */
export interface FurniturePlacement {
  symbol: string;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
}

export interface FurniturePlacementInput {
  symbol: string;
  widthCm: number;
  depthCm: number;
  /** Already resolved decor/grid snap point, in render units. */
  point: readonly [number, number];
  /** Raw point before decor/grid snap; it owns surface eligibility and side. */
  intentPoint?: readonly [number, number];
  /** Current local +y direction; exact-axis drag keeps this side. */
  preferredNormal?: readonly [number, number];
  canvasW: number;
  canvasH: number;
  cellCm: number;
  gridPitch: number;
  walls: readonly FurnitureWallSurface[];
  wallReach: number;
  free?: boolean;
}

const norm180 = (angle: number): number => {
  let value = ((angle % 360) + 360) % 360;
  if (value > 180) value -= 360;
  return value;
};

/**
 * Press furniture flat against the nearest finite physical wall face.
 *
 * Room faces are one-sided; independent physical-body faces select their side
 * from the intent point. The back (local y=0) lies on the selected face.
 */
export function snapFurnitureToWall(
  cx: number, cy: number, depth: number,
  surfaces: readonly FurnitureWallSurface[], maxDist: number, step = 0,
  intentPoint: readonly [number, number] = [cx, cy],
  preferredNormal?: readonly [number, number],
): FurnitureSnap | null {
  type Evaluated = FurnitureSnap & { sideScore: number; stableId: string };
  const tieEps = 1e-7;
  const projection = (
    point: readonly [number, number], a: readonly [number, number],
    dx: number, dy: number, len2: number,
  ): { t: number; x: number; y: number } => {
    const t = Math.max(0, Math.min(1,
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len2));
    return { t, x: a[0] + t * dx, y: a[1] + t * dy };
  };
  const unit = (value: readonly number[] | null | undefined): [number, number] | null => {
    if (!value || !Number.isFinite(value[0]) || !Number.isFinite(value[1])) return null;
    const length = Math.hypot(value[0], value[1]);
    return length > 1e-9 ? [value[0] / length, value[1] / length] : null;
  };
  const preferred = unit(preferredNormal);
  let best: Evaluated | null = null;
  for (const surface of surfaces) {
    const x1 = Number(surface?.a?.[0]), y1 = Number(surface?.a?.[1]);
    const x2 = Number(surface?.b?.[0]), y2 = Number(surface?.b?.[1]);
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (!(len2 > 1e-18)) continue;
    const len = Math.sqrt(len2);
    const intent = projection(intentPoint, [x1, y1], dx, dy, len2);
    const distance = Math.hypot(intentPoint[0] - intent.x, intentPoint[1] - intent.y);
    if (!(distance < maxDist)) continue;

    let normal = unit(surface.normal);
    let sideScore = 0;
    if (normal) {
      const axisA = surface.axisA?.length >= 2 ? surface.axisA : surface.a;
      const axisB = surface.axisB?.length >= 2 ? surface.axisB : surface.b;
      const adx = Number(axisB[0]) - Number(axisA[0]);
      const ady = Number(axisB[1]) - Number(axisA[1]);
      const axisLen2 = adx * adx + ady * ady;
      if (axisLen2 > 1e-18 && [axisA[0], axisA[1], axisB[0], axisB[1]].every(Number.isFinite)) {
        const axisPoint = projection(
          intentPoint, axisA as readonly [number, number], adx, ady, axisLen2,
        );
        const side = (intentPoint[0] - axisPoint.x) * normal[0]
          + (intentPoint[1] - axisPoint.y) * normal[1];
        if (side > tieEps) sideScore = 2;
        else if (side < -tieEps) sideScore = -2;
        else if (preferred) sideScore = normal[0] * preferred[0] + normal[1] * preferred[1];
      }
    } else {
      let nx = intentPoint[0] - intent.x, ny = intentPoint[1] - intent.y;
      const normalLength = Math.hypot(nx, ny);
      if (normalLength > tieEps) {
        nx /= normalLength;
        ny /= normalLength;
        sideScore = 2;
      } else if (preferred) {
        [nx, ny] = preferred;
        sideScore = 1;
      } else {
        const forward = x1 < x2 || (x1 === x2 && y1 <= y2);
        const cdx = forward ? dx : -dx, cdy = forward ? dy : -dy;
        nx = -cdy / len;
        ny = cdx / len;
      }
      normal = [nx, ny];
    }

    const placed = projection([cx, cy], [x1, y1], dx, dy, len2);
    let t = placed.t;
    let qx = placed.x, qy = placed.y;
    if (Number.isFinite(step) && step > 0) {
      const along = Math.round((t * len) / step) * step;
      t = Math.max(0, Math.min(1, along / len));
      qx = x1 + t * dx;
      qy = y1 + t * dy;
    }
    const angle = norm180((Math.atan2(-normal[0], normal[1]) * 180) / Math.PI);
    const candidate: Evaluated = {
      cx: qx + normal[0] * (depth / 2),
      cy: qy + normal[1] * (depth / 2),
      angle,
      dist: distance,
      sideScore,
      stableId: typeof surface.stableId === 'string' ? surface.stableId : '',
    };
    if (!best
        || candidate.dist < best.dist - tieEps
        || (Math.abs(candidate.dist - best.dist) <= tieEps
          && (candidate.sideScore > best.sideScore + tieEps
            || (Math.abs(candidate.sideScore - best.sideScore) <= tieEps
              && candidate.stableId.localeCompare(best.stableId) < 0)))) best = candidate;
  }
  return best && { cx: best.cx, cy: best.cy, angle: best.angle, dist: best.dist };
}

/** Resolve the exact geometry shared by hover preview and commit. */
export function resolveFurniturePlacement(input: FurniturePlacementInput): FurniturePlacement | null {
  const {
    symbol, widthCm, depthCm, point, canvasW, canvasH, cellCm, gridPitch,
    walls, wallReach, free = false, intentPoint = point, preferredNormal,
  } = input;
  if (!furnitureGraphic(symbol) || !(canvasW > 0) || !(canvasH > 0)
      || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
  const safeIntent: readonly [number, number] = Number.isFinite(intentPoint[0])
    && Number.isFinite(intentPoint[1]) ? intentPoint : point;
  const w = clampFurnSize(cmToNorm(widthCm, cellCm, gridPitch, canvasW));
  const h = clampFurnSize(cmToNorm(depthCm, cellCm, gridPitch, canvasW));
  let cx = point[0], cy = point[1];
  let angle = 0;
  const snap = free ? null : snapFurnitureToWall(
    cx, cy, h * canvasH, walls, wallReach, gridPitch, safeIntent, preferredNormal,
  );
  if (snap) {
    cx = snap.cx;
    cy = snap.cy;
    angle = snap.angle;
  }
  return {
    symbol,
    x: clampCanvasN(cx / canvasW - w / 2),
    y: clampCanvasN(cy / canvasH - h / 2),
    w,
    h,
    angle: Number(angle.toFixed(2)),
  };
}
