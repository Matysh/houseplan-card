import { CANVAS_LIMIT } from '../../canvas-constants';
import { normalizeHexColor } from '../../color-picker';
import type { DecorShape } from '../decor/types';
import { styleDecorSelection, type DecorGroupStylePatch } from '../decor/group-edit';
import type { PropertiesSpace, PropertiesTarget } from './catalog';
import { cmPerNorm, patchBackdropProperties, patchDecorProperties, patchStairProperties, type GeometryField } from './transforms';
import { openingPropertiesCore, patchOpeningProperties, patchPartitionEndpoint } from './physical';
import type { OpeningDimension } from '../../opening-dimensions';
import type { WallColumnCfg } from '../../types';

export interface PropertiesColor { color: string; opacity: number; noFill?: boolean }
export const propertiesColor = (value: unknown): value is PropertiesColor => {
  const pair = value as PropertiesColor | null;
  return !!pair && typeof pair === 'object' && typeof pair.color === 'string'
    && !!normalizeHexColor(pair.color) && typeof pair.opacity === 'number'
    && Number.isFinite(pair.opacity) && pair.opacity >= 0 && pair.opacity <= 1
    && (pair.noFill === undefined || typeof pair.noFill === 'boolean');
};
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const geometries = new Set(['x', 'y', 'w', 'h', 'length', 'radius', 'angle']);

/**
 * A targeted candidate edit only. The caller owns production validation,
 * canonicalization, persistence/rollback and publishing one accepted history step.
 */
export function patchPropertiesTarget(
  space: PropertiesSpace, target: PropertiesTarget, field: string, value: unknown,
  context: { cellCm: number; ratio: number | null; openingReference: OpeningDimension | null },
): boolean {
  const { cellCm } = context, factor = cmPerNorm(cellCm);
  if (target.kind === 'decor-group') {
    if (field !== 'stroke' && field !== 'fill') return false;
    const result = styleDecorSelection(space.decor ?? [], target.value.map(item => item.id), value as DecorGroupStylePatch, cellCm);
    if (!result.ok) return false;
    if (result.changed) space.decor = result.decor;
    return true;
  }
  if (target.kind === 'device' || target.kind === 'led' || target.kind === 'contour') return false;
  if (target.kind === 'backdrop') {
    if (!finite(value) || (!geometries.has(field) && field !== 'opacity')) return false;
    const patch = patchBackdropProperties(space, field as GeometryField | 'opacity', value, cellCm);
    if (!patch) return false;
    Object.assign(space, patch); return true;
  }
  if (target.kind === 'partition') {
    if (!finite(value)) return false;
    if (field === 'cm') {
      if (value < 0 || value > 100 || value === 0 && space.openings?.some(o => o.host?.kind === 'partition' && o.host.id === target.value.id)) return false;
      space.partitions = space.partitions?.map(w => w.id === target.value.id ? { ...w, cm: value } : w); return true;
    }
    if (!/^[ab][01]$/.test(field)) return false;
    const patch = patchPartitionEndpoint(target.value, field[0] as 'a' | 'b', Number(field[1]) as 0 | 1,
      value / factor, [...(space.partitions ?? []), ...(space.wall_segments ?? [])], space.openings ?? [], cellCm);
    if (!patch) return false;
    space.partitions = space.partitions?.map(w => w.id === patch.wall.id ? patch.wall : w);
    if (space.openings) space.openings = patch.openings;
    return true;
  }
  if (target.kind === 'column') {
    const column = target.value;
    let patch: WallColumnCfg;
    if (field === 'shape' && (value === 'circle' || value === 'square')) {
      patch = value === 'circle' ? { ...column, shape: 'circle' } : { ...column, shape: 'square', angle: 'angle' in column ? column.angle : 0 };
      if (patch.shape === 'circle') delete (patch as { angle?: number }).angle;
    } else if (finite(value) && field === 'cm' && value >= 1 && value <= 150) patch = { ...column, cm: value };
    else if (finite(value) && (field === 'x' || field === 'y') && Math.abs(value / factor) <= CANVAS_LIMIT) {
      const center = [...column.center]; center[field === 'x' ? 0 : 1] = value / factor;
      patch = { ...column, center };
    } else if (finite(value) && field === 'angle' && column.shape === 'square') patch = { ...column, angle: ((value % 90) + 90) % 90 };
    else return false;
    space.wall_columns = space.wall_columns?.map(c => c.id === patch.id ? patch : c); return true;
  }
  if (target.kind === 'opening') {
    const opening = target.value;
    let patch = opening;
    if ((field === 'flip_h' || field === 'flip_v') && typeof value === 'boolean' && opening.type !== 'passage'
      && !(opening.type === 'gate' && field === 'flip_h')) patch = { ...opening, [field]: value };
    else if (finite(value) && (field === 'length' || field === 'gap')) {
      const core = openingPropertiesCore(opening, space.partitions ?? [], space.wall_segments ?? [], cellCm);
      if (!core) return false;
      const changed = patchOpeningProperties(opening, field, value, core, context.openingReference, space.partitions ?? [], space.wall_segments ?? [], cellCm);
      if (!changed) return false; patch = changed;
    } else return false;
    space.openings = space.openings?.map(o => o.id === patch.id ? patch : o); return true;
  }
  if (target.kind === 'stair') {
    const stair = target.value;
    let patch = stair;
    if (finite(value) && geometries.has(field)) {
      const changed = patchStairProperties(stair, field as GeometryField, value, cellCm); if (!changed) return false; patch = changed;
    } else if ((field === 'stroke' || field === 'fill') && propertiesColor(value)) {
      patch = field === 'stroke' ? { ...stair, color: value.color, opacity: value.opacity }
        : { ...stair, fill_color: value.color, fill_opacity: value.opacity };
    } else if (field === 'direction' && typeof value === 'string') {
      if (stair.kind === 'straight' && (value === 'forward' || value === 'backward')) patch = { ...stair, direction: value };
      else if (stair.kind === 'spiral' && (value === 'clockwise' || value === 'counterclockwise')) patch = { ...stair, direction: value };
      else return false;
    } else return false;
    space.stairs = space.stairs?.map(s => s.id === patch.id ? patch : s); return true;
  }
  const shape = target.value;
  let patch: DecorShape = shape;
  if (finite(value) && geometries.has(field)) {
    const changed = patchDecorProperties(shape, field as GeometryField, value, cellCm, context.ratio);
    if (!changed) return false; patch = changed;
  } else if (field === 'stroke' && shape.kind !== 'image' && propertiesColor(value)) patch = { ...shape, color: value.color, opacity: value.opacity };
  else if (field === 'fill' && (shape.kind === 'rect' || shape.kind === 'ellipse') && propertiesColor(value))
    patch = { ...shape, fill: value.noFill !== true, fill_color: value.color, fill_opacity: value.opacity };
  else if (field === 'opacity' && shape.kind === 'image' && finite(value) && value >= 0 && value <= 1) patch = { ...shape, opacity: value };
  else if (field === 'width_cm' && shape.kind !== 'text' && shape.kind !== 'image' && finite(value) && value >= .1 && value <= 100) {
    patch = { ...shape, width_cm: value }; delete patch.width;
  } else if (field === 'size_cm' && shape.kind === 'text' && finite(value) && value >= .1 && value <= 2000) {
    patch = { ...shape, size_cm: value }; delete patch.size; delete patch.scale;
  } else if (field === 'text' && shape.kind === 'text' && typeof value === 'string' && value.trim() && value.length <= 200)
    patch = { ...shape, text: value.replace(/\r\n?/g, '\n') };
  else if (field === 'line_style' && shape.kind === 'line' && (value === 'solid' || value === 'dashed')) patch = { ...shape, line_style: value };
  else if ((field === 'flip_h' || field === 'flip_v') && (shape.kind === 'image' || shape.kind === 'furniture') && typeof value === 'boolean') patch = { ...shape, [field]: value };
  else return false;
  space.decor = space.decor?.map(s => s.id === patch.id ? patch : s); return true;
}
