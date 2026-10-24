import { normalizeHexColor } from '../../color-picker';
import { parsePropertiesNumber, type PropertiesParse } from './controller';
import { propertiesColor, type PropertiesColor } from './patch';

export interface PropertiesColorDraft {
  value: PropertiesColor;
  hex: string;
  opacity: string;
  hexInvalid: boolean;
  opacityInvalid: boolean;
  inline: boolean;
}

/** Raw strings and the last valid preview pair are field-session state only. */
export function propertiesColorDraft(raw: string): PropertiesColorDraft | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!propertiesColor(parsed)) return null;
  const input = (parsed as PropertiesColor & { inline?: { hex?: unknown; opacity?: unknown } }).inline;
  if (input && (typeof input.hex !== 'string' || typeof input.opacity !== 'string')) return null;
  const hex = typeof input?.hex === 'string' ? input.hex : parsed.color.toUpperCase();
  const opacity = typeof input?.opacity === 'string' ? input.opacity : String(Math.round(parsed.opacity * 100));
  return { value: { color: normalizeHexColor(parsed.color)!, opacity: parsed.opacity,
    ...(parsed.noFill === undefined ? {} : { noFill: parsed.noFill }) },
    hex, opacity, hexInvalid: !normalizeHexColor(hex),
    opacityInvalid: !parsePropertiesNumber(opacity, { min: 0, max: 100, unit: '%' }).ok, inline: !!input };
}

export function editPropertiesColor(draft: PropertiesColorDraft, part: 'hex' | 'opacity', raw: string): string {
  const hex = part === 'hex' ? raw : draft.hex, opacity = part === 'opacity' ? raw : draft.opacity;
  const color = normalizeHexColor(hex), alpha = parsePropertiesNumber(opacity, { min: 0, max: 100, unit: '%' });
  const value = color && alpha.ok ? { ...draft.value, color, opacity: (alpha.value as number) / 100 } : draft.value;
  return JSON.stringify({ ...value, inline: { hex, opacity } });
}

/** Commit contains only the existing atomic pair; partial strings never persist. */
export function parsePropertiesColor(raw: string): PropertiesParse {
  const draft = propertiesColorDraft(raw);
  if (!draft || draft.hexInvalid) return { ok: false, error: { key: 'invalid_color' } };
  if (!draft.inline) return { ok: true, value: draft.value };
  const opacity = parsePropertiesNumber(draft.opacity, { min: 0, max: 100, unit: '%' });
  if (!opacity.ok) return opacity;
  return { ok: true, value: { ...draft.value, color: normalizeHexColor(draft.hex)!, opacity: (opacity.value as number) / 100 } };
}
