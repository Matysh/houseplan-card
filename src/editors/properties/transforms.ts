import { CANVAS_LIMIT, GRID_N, GRID_PITCH, NORM_W } from '../../canvas-constants';
import { fitInSquare, planRect, PLAN_SCALE_MAX, PLAN_SCALE_MIN } from '../../space-geometry';
import { normalizeAngle } from '../decor/geometry';
import { snapToGrid } from '../../logic';
import type { DecorShape } from '../decor/types';
import type { Stair } from '../../stairs';

/** Values are physical cm, not normalized storage or screen pixels. */
export const cmPerNorm = (cellCm: number): number => GRID_N * cellCm;
export const canonicalPropertiesAngle = (angle: number): number => {
  const value = normalizeAngle(angle);
  return value === -180 ? 180 : value;
};

export type GeometryField = 'x' | 'y' | 'w' | 'h' | 'length' | 'radius' | 'angle';
export interface TextExtent { w: number; h: number }

export function decorPropertiesBox(shape: DecorShape, text: TextExtent = { w: 0, h: 0 }): {
  x: number; y: number; w: number; h: number; angle: number;
} {
  if (shape.kind === 'line') return {
    x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2,
    w: Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1), h: 0,
    angle: canonicalPropertiesAngle(Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1) * 180 / Math.PI),
  };
  if (shape.kind === 'text') return { x: shape.x, y: shape.y, ...text, angle: shape.angle ?? 0 };
  return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2,
    w: shape.w, h: shape.h, angle: shape.angle ?? 0 };
}

/** Narrow transform: untouched off-grid axes and legacy presentation stay exact. */
export function patchDecorProperties(
  shape: DecorShape, field: GeometryField, physical: number, cellCm: number,
  ratio: number | null = null,
): DecorShape | null {
  if (!Number.isFinite(physical)) return null;
  const factor = cmPerNorm(cellCm), value = physical / factor;
  if (!(factor > 0)) return null;
  const box = decorPropertiesBox(shape);
  if (field === 'x' || field === 'y') {
    if (Math.abs(value) > CANVAS_LIMIT) return null;
    const delta = value - box[field];
    if (shape.kind === 'line') return field === 'x'
      ? { ...shape, x1: shape.x1 + delta, x2: shape.x2 + delta }
      : { ...shape, y1: shape.y1 + delta, y2: shape.y2 + delta };
    return { ...shape, [field]: shape[field] + delta };
  }
  if (field === 'angle' && shape.kind !== 'line')
    return { ...shape, angle: canonicalPropertiesAngle(physical) };
  if (shape.kind === 'line') {
    if (field !== 'length' && field !== 'angle') return null;
    if (field === 'length' && value * NORM_W < GRID_PITCH) return null;
    const length = field === 'length' ? value : box.w;
    const rad = (field === 'angle' ? canonicalPropertiesAngle(physical) : box.angle) * Math.PI / 180;
    // Native grid canonicalisation of the vector; its centre is the explicit
    // panel constraint and must not jump for an off-grid legacy line.
    const dx = snapToGrid(Math.cos(rad)*length*NORM_W,GRID_PITCH)/NORM_W/2;
    const dy = snapToGrid(Math.sin(rad)*length*NORM_W,GRID_PITCH)/NORM_W/2;
    const coords = [box.x-dx,box.y-dy,box.x+dx,box.y+dy];
    if (Math.hypot(dx,dy)*2*NORM_W<GRID_PITCH || coords.some(n=>Math.abs(n)>CANVAS_LIMIT)) return null;
    return { ...shape, x1: coords[0], y1: coords[1], x2: coords[2], y2: coords[3] };
  }
  if (shape.kind === 'text' || (field !== 'w' && field !== 'h') || !(value > 0)) return null;
  let w = field === 'w' ? value : shape.w, h = field === 'h' ? value : shape.h;
  if (shape.kind === 'image' && ratio !== null) {
    if (!(ratio > 0) || !Number.isFinite(ratio)) return null;
    if (field === 'w') h = w / ratio; else w = h * ratio;
  }
  if (shape.kind === 'rect' || shape.kind === 'ellipse') {
    // Same size lattice as the existing numeric shape editor. The centre is
    // an explicit constraint here: do not re-snap its derived top-left.
    if (field === 'w') w = snapToGrid(w * NORM_W, GRID_PITCH) / NORM_W;
    else h = snapToGrid(h * NORM_W, GRID_PITCH) / NORM_W;
    if (w * NORM_W < GRID_PITCH || h * NORM_W < GRID_PITCH) return null;
  } else if (Math.min(w, h) * factor < 0.1 || Math.max(w, h) * factor > CANVAS_LIMIT * cellCm) return null;
  const x = w === shape.w ? shape.x : box.x - w / 2;
  const y = h === shape.h ? shape.y : box.y - h / 2;
  if ([x, y, x + w, y + h].some(n => Math.abs(n) > CANVAS_LIMIT)) return null;
  return { ...shape, x, y, w, h };
}

/** Stairs use continuous normalized dimensions; target_space_id is never a panel field. */
export function patchStairProperties(stair: Stair, field: GeometryField, physical: number, cellCm: number): Stair | null {
  if (!Number.isFinite(physical)) return null;
  if (field === 'angle') return { ...stair, angle: ((physical % 360) + 360) % 360 };
  const value = physical / cmPerNorm(cellCm);
  if (field === 'x' || field === 'y') return Math.abs(value) <= CANVAS_LIMIT
    ? { ...stair, [field]: value } : null;
  if (physical < 30 || physical > 10000) return null;
  if (stair.kind === 'spiral') return field === 'radius' ? { ...stair, radius: value } : null;
  if (field === 'length') return { ...stair, length: value };
  if (field === 'w') return { ...stair, width: value };
  return null;
}

export interface PropertiesBackdrop {
  plan_aspect?: number; plan_x?: number; plan_y?: number; plan_scale?: number;
  plan_scale_x?: number; plan_scale_y?: number; plan_angle?: number; plan_opacity?: number;
}

/** Per-field backdrop patch; a size edit keeps its transformed centre fixed. */
export function patchBackdropProperties(
  plan: PropertiesBackdrop, field: GeometryField | 'opacity', value: number, cellCm: number,
): Partial<PropertiesBackdrop> | null {
  if (!Number.isFinite(value)) return null;
  if (field === 'opacity') return value >= 0 && value <= 1 ? { plan_opacity: value } : null;
  if (field === 'angle') return { plan_angle: canonicalPropertiesAngle(value) };
  const base = fitInSquare(plan.plan_aspect, NORM_W), rect = planRect(plan);
  const render = value / cmPerNorm(cellCm) * NORM_W;
  if (field === 'x' || field === 'y') {
    const size = field === 'x' ? rect.w : rect.h;
    const offset = (render - size / 2 - base[field]) / NORM_W;
    return Math.abs(offset) <= CANVAS_LIMIT ? { [field === 'x' ? 'plan_x' : 'plan_y']: offset } : null;
  }
  if (field !== 'w' && field !== 'h') return null;
  const scale = render / base[field];
  if (scale < PLAN_SCALE_MIN || scale > PLAN_SCALE_MAX) return null;
  const axis = field === 'w' ? 'x' : 'y';
  const offset = (rect[axis] + rect[field] / 2 - render / 2 - base[axis]) / NORM_W;
  if (Math.abs(offset) > CANVAS_LIMIT) return null;
  return field === 'w' ? { plan_scale_x: scale, plan_x: offset } : { plan_scale_y: scale, plan_y: offset };
}
