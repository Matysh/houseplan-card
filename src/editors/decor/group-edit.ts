import { CANVAS_LIMIT, GRID_PITCH } from '../../canvas-constants';
import { normalizeHexColor } from '../../color-picker';
import { clamp01, decorStyleOf, DEFAULT_DECOR_STYLE } from './geometry';
import { decorSelectionMembers, homogeneousDecorKind } from './selection';
import type { DecorShape } from './types';

export type DecorGroupChannel = 'stroke' | 'fill';
export interface DecorGroupStylePatch {
  channel: DecorGroupChannel;
  /** Presence is the touched-channel mask. An untouched opposite channel is never written. */
  color?: string;
  opacity?: number;
}
export interface DecorGroupColorState {
  color: string | null;
  opacity: number | null;
  mixedColor: boolean;
  mixedOpacity: boolean;
  alphaOnly: boolean;
}
export type DecorGroupResult = { ok: true; decor: DecorShape[]; changed: boolean }
  | { ok: false; reason: 'selection' | 'bounds' | 'kind' | 'value' };

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const coordinate = (value: unknown): value is number => finite(value) && Math.abs(value) <= CANVAS_LIMIT;

/** The same stored axes/extents as native decor bounds, without per-member clamp. */
function withinCanvas(shape: DecorShape): boolean {
  if (shape.kind === 'line') return [shape.x1, shape.y1, shape.x2, shape.y2].every(coordinate);
  if (!coordinate(shape.x) || !coordinate(shape.y)) return false;
  if (shape.kind === 'text') return true;
  return finite(shape.w) && finite(shape.h) && shape.w >= 0 && shape.h >= 0
    && coordinate(shape.x + shape.w) && coordinate(shape.y + shape.h);
}

/** A single already-resolved anchor delta moves every member from the immutable begin state. */
export function translateDecorSelection(
  items: readonly DecorShape[], ids: readonly string[], dx: number, dy: number,
): DecorGroupResult {
  const members = decorSelectionMembers(items, ids);
  if (!members) return { ok: false, reason: 'selection' };
  if (!finite(dx) || !finite(dy) || members.some(item => !withinCanvas(item))) return { ok: false, reason: 'bounds' };
  const selected = new Set(ids), decor = structuredClone(items) as DecorShape[];
  if (!dx && !dy || !members.length) return { ok: true, decor, changed: false };
  for (const item of decor) {
    if (!selected.has(item.id)) continue;
    if (item.kind === 'line') {
      item.x1 += dx; item.y1 += dy; item.x2 += dx; item.y2 += dy;
    } else { item.x += dx; item.y += dy; }
    if (!withinCanvas(item)) return { ok: false, reason: 'bounds' };
  }
  return { ok: true, decor, changed: true };
}

function supports(members: readonly DecorShape[], channel: DecorGroupChannel): boolean {
  const kind = homogeneousDecorKind(members);
  return !!kind && (channel === 'stroke' || channel === 'fill' && (kind === 'rect' || kind === 'ellipse'));
}

/** Group fill properties remain meaningful while individual fill flags stay off. */
function values(shape: DecorShape, channel: DecorGroupChannel, cellCm: number): { color: string | null; opacity: number } {
  if (shape.kind === 'image') return { color: null, opacity: clamp01(shape.opacity) };
  const visual = decorStyleOf(shape, cellCm, GRID_PITCH);
  if (channel === 'stroke') return { color: normalizeHexColor(visual.color)!, opacity: visual.opacity };
  const fillOpacity = shape.kind === 'rect' || shape.kind === 'ellipse'
    ? clamp01(shape.fill_opacity, DEFAULT_DECOR_STYLE.fillOpacity) : DEFAULT_DECOR_STYLE.fillOpacity;
  return { color: normalizeHexColor(visual.fillColor)!, opacity: fillOpacity };
}

/** Mixed channels are null independently; there is no colour/100% seed masquerading as a value. */
export function decorGroupColorState(
  members: readonly DecorShape[], channel: DecorGroupChannel, cellCm: number,
): DecorGroupColorState | null {
  if (!supports(members, channel)) return null;
  const first = values(members[0], channel, cellCm), alphaOnly = members[0].kind === 'image';
  let mixedColor = false, mixedOpacity = false;
  for (const item of members) {
    const current = values(item, channel, cellCm);
    mixedColor ||= current.color !== first.color;
    mixedOpacity ||= current.opacity !== first.opacity;
  }
  return { color: mixedColor ? null : first.color, opacity: mixedOpacity ? null : first.opacity,
    mixedColor, mixedOpacity, alphaOnly };
}

/** Change only explicitly touched channels, preserving optional-key presence and all foreign data. */
export function styleDecorSelection(
  items: readonly DecorShape[], ids: readonly string[], patch: DecorGroupStylePatch, cellCm: number,
): DecorGroupResult {
  const members = decorSelectionMembers(items, ids);
  if (!members) return { ok: false, reason: 'selection' };
  if (!patch || !['stroke', 'fill'].includes(patch.channel) || !supports(members, patch.channel)) return { ok: false, reason: 'kind' };
  const touchedColor = Object.prototype.hasOwnProperty.call(patch, 'color');
  const touchedOpacity = Object.prototype.hasOwnProperty.call(patch, 'opacity');
  const color = touchedColor ? normalizeHexColor(patch.color) : null;
  if (Object.keys(patch).some(key => !['channel', 'color', 'opacity'].includes(key))
    || touchedColor && (!color || members[0].kind === 'image')
    || touchedOpacity && (!finite(patch.opacity) || patch.opacity < 0 || patch.opacity > 1)) return { ok: false, reason: 'value' };
  const selected = new Set(ids), decor = structuredClone(items) as DecorShape[];
  let changed = false;
  for (const item of decor) {
    if (!selected.has(item.id)) continue;
    const current = values(item, patch.channel, cellCm);
    if (touchedColor && current.color !== color) {
      if (patch.channel === 'fill' && (item.kind === 'rect' || item.kind === 'ellipse')) item.fill_color = color!;
      else item.color = color!;
      changed = true;
    }
    if (touchedOpacity && current.opacity !== patch.opacity) {
      if (patch.channel === 'fill' && (item.kind === 'rect' || item.kind === 'ellipse')) item.fill_opacity = patch.opacity!;
      else item.opacity = patch.opacity!;
      changed = true;
    }
  }
  return { ok: true, decor, changed };
}
