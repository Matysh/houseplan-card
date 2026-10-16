import { EasyInputError } from './easy-read.mjs';

const ENTITIES = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const ATTRIBUTES = /^[a-zA-Z0-9_.-]+$/;
const COLORS = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000',
  blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080',
  orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', cyan: '#00ffff',
  magenta: '#ff00ff', lime: '#00ff00', teal: '#008080', navy: '#000080', silver: '#c0c0c0' };

export const validEntity = value => typeof value === 'string' && value.length <= 255 && ENTITIES.test(value);
export function stringAt(value, path, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > 500) throw new EasyInputError('easy_invalid_text', path);
  return value;
}
export function booleanAt(value, path, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new EasyInputError('easy_invalid_boolean', path);
  return value;
}
export const angleOf = value => ((value + 180) % 360 + 360) % 360 - 180;

/** Only literal colours and the source card's own declarative palette. No CSS evaluation. */
export function colorResolver(palette = []) {
  const aliases = new Map();
  if (Array.isArray(palette)) for (const row of palette) {
    if (typeof row?.name !== 'string' || typeof row?.color !== 'string') continue;
    const slug = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!aliases.has(slug)) aliases.set(slug, row.color); // Easy keeps the first declaration
  }
  const resolve = (value, depth = 0) => {
    if (typeof value !== 'string' || depth > 8) return null;
    const text = value.trim().toLowerCase();
    const alias = /^var\(--fp-color-([a-z0-9-]+)\)$/.exec(text);
    if (alias) return resolve(aliases.get(alias[1]), depth + 1);
    if (/^#[0-9a-f]{6}$/.test(text)) return text;
    if (/^#[0-9a-f]{3}$/.test(text)) return '#' + [...text.slice(1)].map(ch => ch + ch).join('');
    if (Object.hasOwn(COLORS, text)) return COLORS[text];
    const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(text);
    if (rgb && rgb.slice(1).every(v => Number(v) <= 255))
      return '#' + rgb.slice(1).map(v => Number(v).toString(16).padStart(2, '0')).join('');
    return null;
  };
  return resolve;
}

/** A file reference, not a fetch permission. Credentials are never copied. */
export function safeImageReference(value) {
  if (typeof value !== 'string' || value.length > 2000 || /[\\\s]/.test(value)) return null;
  const relative = value.startsWith('/local/');
  if (!relative && !/^https?:\/\//i.test(value)) return null;
  let url;
  try { url = new URL(value, 'https://houseplan-local.invalid'); } catch { return null; }
  if (url.username || url.password || (relative && !url.pathname.startsWith('/local/'))) return null;
  if ([...url.searchParams.keys()].some(key => /token|password|secret|auth|api[_-]?key/i.test(key))) return null;
  if (/token|password|secret|auth|api[_-]?key/i.test(url.hash)) return null;
  return value;
}

export function readingSource(entity, attribute) {
  if (!validEntity(entity)) return null;
  if (attribute === undefined || attribute === '') return { kind: 'entity_state', entity_id: entity };
  if (typeof attribute !== 'string' || attribute.length > 64 || !ATTRIBUTES.test(attribute)) return null;
  return { kind: 'entity_attribute', entity_id: entity, attribute };
}
export const readingToken = source => source.kind === 'entity_attribute'
  ? `{${source.entity_id}:${source.attribute}}` : `{${source.entity_id}}`;

export function itemReadingPool(item) {
  const result = [];
  const push = (entity, attribute, visible, origin) => {
    const source = readingSource(entity, attribute);
    if (source) result.push({ source, visible, origin });
  };
  push(item.entity, item.attribute, item.showState === true, 'primary');
  if (item.secondaryEntity || item.secondaryAttribute)
    push(item.secondaryEntity || item.entity, item.secondaryAttribute, true, 0);
  const offset = item.secondaryEntity || item.secondaryAttribute ? 1 : 0;
  for (const [index, row] of (item.readings || []).entries())
    push(row.entity || item.entity, row.attribute, row.showState !== false, index + offset);
  return result;
}

/** Braces in literal source text must not accidentally become live HA reads. */
export function literalCaption(text, id, notes) {
  if (/[{}]/.test(text)) {
    notes.push({ code: 'literal_braces_escaped', id });
    return text.replaceAll('{', '❴').replaceAll('}', '❵');
  }
  return text;
}

export function markerTap(item, notes) {
  const action = item.tap_action;
  const domain = typeof item.entity === 'string' ? item.entity.split('.')[0] : '';
  const sourceDefault = ['light', 'switch', 'fan', 'input_boolean'].includes(domain) ? 'toggle' : 'more-info';
  const wanted = action?.action ?? sourceDefault;
  const simple = ['more-info', 'toggle', 'none'].includes(wanted);
  const exactTarget = !action?.entity || action.entity === item.entity;
  const supported = simple && exactTarget && (!action || Object.keys(action)
    .every(key => ['action', 'entity', 'confirmation'].includes(key)));
  if (!supported) notes.push({ code: 'action_fallback_info', id: item.id });
  if (item.hold_action || item.double_tap_action) notes.push({ code: 'secondary_actions_skipped', id: item.id });
  if (wanted === 'toggle' && ['lock', 'alarm_control_panel'].includes(domain))
    notes.push({ code: 'secure_toggle_inert', id: item.id });
  return { tap_action: supported ? (wanted === 'more-info' ? 'info' : wanted) : 'info',
    ...(supported && action?.confirmation ? { tap_confirm: true } : {}) };
}
