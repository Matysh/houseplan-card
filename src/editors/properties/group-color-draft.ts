import { normalizeHexColor } from '../../color-picker';
import type { DecorGroupColorState, DecorGroupChannel, DecorGroupStylePatch } from '../decor/group-edit';
import { parsePropertiesNumber, type PropertiesParse } from './controller';

export interface GroupColorDraft extends DecorGroupColorState {
  group: true;
  hex: string;
  alpha: string;
  touchedColor: boolean;
  touchedOpacity: boolean;
}

/** Raw independent channels, including empty mixed values, belong only to the field session. */
export function groupColorDraft(value: DecorGroupColorState): GroupColorDraft {
  return { ...value, group: true, hex: value.color?.toUpperCase() ?? '',
    alpha: value.opacity === null ? '' : String(Math.round(value.opacity * 100)), touchedColor: false, touchedOpacity: false };
}

export function readGroupColorDraft(raw: string): GroupColorDraft | null {
  try {
    const value = JSON.parse(raw) as GroupColorDraft;
    return value?.group === true && typeof value.hex === 'string' && typeof value.alpha === 'string'
      && typeof value.touchedColor === 'boolean' && typeof value.touchedOpacity === 'boolean'
      && typeof value.alphaOnly === 'boolean' ? value : null;
  } catch { return null; }
}

export function editGroupColor(draft: GroupColorDraft, part: 'hex' | 'opacity', raw: string): string {
  return JSON.stringify(part === 'hex' ? { ...draft, hex: raw, touchedColor: true }
    : { ...draft, alpha: raw, touchedOpacity: true });
}

export function parseGroupColor(raw: string, channel: DecorGroupChannel): PropertiesParse {
  const draft = readGroupColorDraft(raw);
  if (!draft) return { ok: false, error: { key: 'invalid_color' } };
  const patch: DecorGroupStylePatch = { channel };
  if (draft.touchedColor) {
    const color = normalizeHexColor(draft.hex);
    if (!color || draft.alphaOnly) return { ok: false, error: { key: 'invalid_color' } };
    patch.color = color;
  }
  if (draft.touchedOpacity) {
    const alpha = parsePropertiesNumber(draft.alpha, { min: 0, max: 100, unit: '%' });
    if (!alpha.ok) return alpha;
    patch.opacity = (alpha.value as number) / 100;
  }
  return { ok: true, value: patch };
}

/** The picker reports user input causes; its seed/normalization never supplies a channel. */
export function pickerGroupColor(draft: GroupColorDraft, detail: {
  color: string; opacity: number; touched?: { color: boolean; opacity: boolean };
}): string {
  let next = draft;
  if (detail.touched?.color) next = { ...next, hex: detail.color, touchedColor: true };
  if (detail.touched?.opacity) next = { ...next, alpha: String(detail.opacity * 100), touchedOpacity: true };
  return JSON.stringify(next);
}
