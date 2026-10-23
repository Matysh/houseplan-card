import { CANVAS_LIMIT, NORM_W } from '../../canvas-constants';
import { SPACE_COPY_LIMITS } from '../../space-copy';
import { nudgeDecorShape } from './geometry';
import type { DecorShape } from './types';

export type DecorOrder = 'front' | 'back';

/** Array order is both paint and native SVG hit order. Keep no-ops referential. */
export function reorderDecor(items: DecorShape[], id: string, direction: DecorOrder): DecorShape[] {
  const index = items.findIndex(item => item.id === id);
  const edge = direction === 'front' ? items.length - 1 : 0;
  if (index < 0 || index === edge) return items;
  const rest = items.filter((_, i) => i !== index);
  return direction === 'front' ? [...rest, items[index]] : [items[index], ...rest];
}

export type DecorCopyResult = { shape: DecorShape } | { error: 'limit' | 'no_space' };

/** A new instance owns its values; an image continues to reference its asset. */
export function copyDecor(items: DecorShape[], id: string, newId: string, gridPitch: number): DecorCopyResult {
  const source = items.find(item => item.id === id);
  if (items.length >= SPACE_COPY_LIMITS.decor) return { error: 'limit' };
  if (!source || !newId || items.some(item => item.id === newId)
      || !Number.isFinite(gridPitch) || gridPitch <= 0) return { error: 'no_space' };
  // Reverse a blocked axis before reducing the requested one-cell translation.
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const shifted = nudgeDecorShape(source, sx * gridPitch, sy * gridPitch, NORM_W, NORM_W, CANVAS_LIMIT);
    if (!shifted) continue;
    const before = source.kind === 'line' ? [source.x1, source.y1] : [source.x, source.y];
    const after = shifted.kind === 'line' ? [shifted.x1, shifted.y1] : [shifted.x, shifted.y];
    const step = gridPitch / NORM_W;
    if (Math.abs(Math.abs(after[0] - before[0]) - step) > 1e-9
        || Math.abs(Math.abs(after[1] - before[1]) - step) > 1e-9) continue;
    if (items.some(item => item.kind === shifted.kind && (item.kind === 'line' && shifted.kind === 'line'
      ? item.x1 === shifted.x1 && item.y1 === shifted.y1 && item.x2 === shifted.x2 && item.y2 === shifted.y2
      : item.kind !== 'line' && shifted.kind !== 'line' && item.x === shifted.x && item.y === shifted.y))) continue;
    return { shape: { ...structuredClone(shifted), id: newId } };
  }
  return { error: 'no_space' };
}
