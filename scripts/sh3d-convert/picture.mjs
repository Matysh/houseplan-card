/**
 * Home Assistant `picture-elements` card -> one current House Plan space (#1022).
 *
 * The source carries a background image and elements placed by CSS
 * percentages of that image. There is no geometry, scale or Area: the result is
 * the backdrop (a reference, as for Easy Floorplan) plus devices and live text
 * at the same points. Rooms, walls and the scale are drawn afterwards in the
 * editor, exactly as when a plan starts from an image.
 *
 * Percentages are relative to the image box, so the converter needs the image
 * aspect ratio: the caller passes the natural size in pixels (measured
 * locally) or an explicit aspect. Nothing is guessed; without it the
 * conversion refuses, because every vertical coordinate would drift.
 */
import { EasyInputError, readCard } from './easy-read.mjs';
import { frameForEasy, makeIds } from './easy-geometry.mjs';
import { colorResolver, literalCaption, markerTap, readingSource, readingToken, stringAt, validEntity } from './easy-style.mjs';
import { backgroundFields, noteFields, reportRemainder } from './easy-content.mjs';
import { MIN_CURRENT_HOUSEPLAN, modernDocument } from './output.mjs';
import { TOOL_VERSION } from './easy.mjs';

export const MAX_PICTURE_ELEMENTS = 2000;
const PERCENT = /^(-?\d+(?:\.\d+)?)%$/;
const CENTERED = /^translate\(\s*-50%\s*,\s*-50%\s*\)$/;
const ELEMENT_FIELDS = {
  'state-icon': ['type', 'entity', 'icon', 'title', 'style', 'tap_action', 'hold_action', 'double_tap_action', 'state_color'],
  'state-badge': ['type', 'entity', 'title', 'style', 'tap_action', 'hold_action', 'double_tap_action'],
  'state-label': ['type', 'entity', 'attribute', 'prefix', 'suffix', 'title', 'style', 'tap_action', 'hold_action', 'double_tap_action'],
  icon: ['type', 'entity', 'icon', 'title', 'style', 'tap_action', 'hold_action', 'double_tap_action'],
};
const fail = (code, path) => { throw new EasyInputError(code, path); };
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Validate ONE picture-elements card; never a dashboard or a stack. */
export function readPicture(text) {
  const config = readCard(text);
  if (config.type !== 'picture-elements') fail('picture_not_card', '$.type');
  if (typeof config.image !== 'string' || !config.image.trim()) fail('picture_no_image', '$.image');
  if (!Array.isArray(config.elements)) fail('picture_no_elements', '$.elements');
  if (config.elements.length > MAX_PICTURE_ELEMENTS) fail('easy_too_complex', '$.elements');
  for (const [index, element] of config.elements.entries()) {
    if (!record(element)) fail('picture_invalid_element', `$.elements[${index}]`);
    if (element.style !== undefined && !record(element.style)) fail('picture_invalid_element', `$.elements[${index}].style`);
  }
  return config;
}

/** The image box in source units: natural pixels when measured, else a 1000-wide box of the given aspect. */
export function pictureCanvas(options) {
  const width = options.imageWidth, height = options.imageHeight, aspect = options.aspect;
  if (width !== undefined || height !== undefined) {
    if (!(typeof width === 'number' && width > 0 && Number.isFinite(width))
        || !(typeof height === 'number' && height > 0 && Number.isFinite(height))) fail('picture_invalid_aspect', 'imageWidth/imageHeight');
    if (!(width / height >= 0.05 && width / height <= 20)) fail('picture_invalid_aspect', 'imageWidth/imageHeight');
    return { width, height, measured: true };
  }
  if (aspect === undefined) fail('picture_aspect_required', 'aspect');
  if (!(typeof aspect === 'number' && Number.isFinite(aspect) && aspect >= 0.05 && aspect <= 20)) fail('picture_invalid_aspect', 'aspect');
  return { width: 1000, height: 1000 / aspect, measured: false };
}

/** `left`/`top` as percentages of the image box; anything else is reported, not guessed. */
function positionOf(element, id, canvas, notes, handled = ['left', 'top', 'transform']) {
  const style = element.style || {};
  const axis = (key) => {
    const value = style[key];
    const text = typeof value === 'number' ? `${value}%` : typeof value === 'string' ? value.trim() : '';
    const match = PERCENT.exec(text);
    return match ? Number(match[1]) : null;
  };
  const left = axis('left'), top = axis('top');
  if (left === null || top === null) {
    notes.push({ code: style.left === undefined && style.top === undefined ? 'element_position_missing' : 'element_position_unsupported', id });
    return null;
  }
  if (left < 0 || left > 100 || top < 0 || top > 100) { notes.push({ code: 'element_position_outside', id }); return null; }
  if (typeof style.transform === 'string' && !CENTERED.test(style.transform.trim()))
    notes.push({ code: 'element_transform_ignored', id });
  const other = Object.keys(style).filter(key => !handled.includes(key));
  if (other.length) notes.push({ code: 'element_style_skipped', id, fields: other.join(', ') });
  return [left / 100 * canvas.width, top / 100 * canvas.height];
}

function markerOf(element, id, spaceId, point, notes) {
  const entity = validEntity(element.entity) ? element.entity : null;
  if (!entity) notes.push({ code: 'binding_virtualized', id });
  const marker = { id, binding: entity ? `entity:${entity}` : 'virtual', space: spaceId,
    ...markerTap({ ...element, id, entity }, notes),
    display: 'badge', size: 1, angle: 0, is_light: false,
    value_badge: { enabled: false, position: 'bottom' } };
  const title = stringAt(element.title, `${id}.title`);
  if (title) marker.name = literalCaption(title, id, notes);
  else if (!entity) marker.name = 'Device';
  if (element.icon !== undefined) {
    const icon = stringAt(element.icon, `${id}.icon`);
    if (/^mdi:[a-z0-9-]{1,100}$/.test(icon)) marker.icon = icon;
    else notes.push({ code: 'icon_skipped', id });
  }
  if (element.type === 'state-badge') {
    if (entity) { marker.value_badge.enabled = true; marker.value_badge.source = { kind: 'entity_state', entity_id: entity }; }
    else notes.push({ code: 'badge_source_missing', id });
  }
  if (element.state_color !== undefined) notes.push({ code: 'element_state_color_skipped', id });
  return { marker, layout: { s: spaceId, x: point[0], y: point[1] } };
}

const color = colorResolver();
function labelOf(element, id, point, cmPerUnit, notes) {
  const reading = readingSource(element.entity, element.attribute);
  if (element.entity && !reading) notes.push({ code: 'text_reading_skipped', id });
  const prefix = literalCaption(stringAt(element.prefix, `${id}.prefix`), id, notes);
  const suffix = literalCaption(stringAt(element.suffix, `${id}.suffix`), id, notes);
  const text = `${prefix}${reading ? readingToken(reading) : ''}${suffix}`.trim();
  if (!text) { notes.push({ code: 'empty_text_skipped', id }); return null; }
  if (text.length > 200) fail('easy_text_too_long', id);
  if (element.tap_action || element.hold_action || element.double_tap_action) notes.push({ code: 'label_actions_skipped', id });
  notes.push({ code: 'state_label_as_text', id });
  const wanted = element.style?.color;
  const c = wanted === undefined ? '#808080' : color(wanted);
  if (!c) notes.push({ code: 'color_fallback', id });
  // 16 px is the HA default font size; the converter has no other metric.
  return { id, kind: 'text', x: point[0], y: point[1], text, size_cm: Math.max(0.1, 16 * cmPerUnit), angle: 0, color: c || '#808080' };
}

export function convertPicture(text, options = {}) {
  const config = readPicture(text);
  const canvas = pictureCanvas(options);
  const cmPerUnit = 1;
  const toolVersion = options.toolVersion || TOOL_VERSION;
  const report = { levels: [], items: [
    { code: 'scale_default', cmPerUnit, count: 0 },
    { code: 'picture_compatibility' },
    { code: canvas.measured ? 'picture_size_measured' : 'picture_size_aspect', width: Math.round(canvas.width), height: Math.round(canvas.height) },
  ], toolVersion, minHouseplan: MIN_CURRENT_HOUSEPLAN };
  const unknownCard = Object.keys(config).filter(key => !['type', 'image', 'elements', 'title', 'camera_image', 'camera_view',
    'dark_mode_image', 'dark_mode_filter', 'state_image', 'state_filter', 'aspect_ratio', 'entity', 'theme'].includes(key));
  if (unknownCard.length) report.items.push({ code: 'source_fields_unsupported', id: 'card', fields: unknownCard.join(', ') });
  noteFields(config, ['camera_image', 'camera_view', 'dark_mode_image', 'dark_mode_filter', 'state_image', 'state_filter', 'entity', 'theme'],
    'picture_card_fields_skipped', 'card', report.items);
  const spaceId = 'picture-1', ids = makeIds(spaceId), notes = [];
  const title = stringAt(config.title, '$.title', 'Plan');
  const record_ = { id: 'main', title, notes };
  report.levels.push(record_);
  const floor = { id: 'main', image: config.image };
  const frame = frameForEasy({ width: canvas.width, height: canvas.height }, [floor], [{ rooms: [], walls: [] }], cmPerUnit);
  const markers = [], layout = {}, decor = [];
  let lights = 0;
  for (const [index, element] of config.elements.entries()) {
    const type = typeof element.type === 'string' ? element.type : '';
    const id = ids('element', element.title || element.entity || type || null, index);
    if (type.startsWith('custom:')) { notes.push({ code: 'element_custom_skipped', id, type }); continue; }
    if (type === 'conditional') {
      notes.push({ code: 'element_conditional_skipped', id, count: Array.isArray(element.elements) ? element.elements.length : 0 });
      continue;
    }
    if (type === 'image') { notes.push({ code: 'element_image_skipped', id }); continue; }
    if (type === 'service-button') { notes.push({ code: 'element_type_skipped', id, type }); continue; }
    if (!ELEMENT_FIELDS[type]) { notes.push({ code: 'element_type_skipped', id, type: type || '?' }); continue; }
    if (type === 'icon' && !validEntity(element.entity)) { notes.push({ code: 'element_type_skipped', id, type }); continue; }
    const point = positionOf(element, id, canvas, notes, type === 'state-label' ? ['left', 'top', 'transform', 'color'] : undefined);
    if (!point) continue;
    const projected = frame.point(point);
    reportRemainder(element, ELEMENT_FIELDS[type], id, notes);
    if (type === 'state-label') {
      const label = labelOf(element, id, projected, cmPerUnit, notes);
      if (label) decor.push(label);
      continue;
    }
    const converted = markerOf(element, id, spaceId, projected, notes);
    if (typeof element.entity === 'string' && element.entity.startsWith('light.')) lights++;
    markers.push(converted.marker); layout[id] = converted.layout;
  }
  if (!markers.length && !decor.length) throw Object.assign(new EasyInputError('picture_nothing_to_convert'), { report });
  if (lights) notes.push({ code: 'picture_lights_hint', count: lights });
  const space = { id: spaceId, title, cell_cm: frame.cellCm, view_box: frame.viewBox,
    rooms: [], walls: [], partitions: [], openings: [], decor, settings: { glow_enabled: true },
    ...backgroundFields({ width: canvas.width, height: canvas.height }, floor, frame, notes) };
  const converted = modernDocument(space, { markers, layout, now: options.now, toolVersion });
  notes.push(...converted.notes);
  Object.assign(record_, { spaceId, cellCm: frame.cellCm, rooms: 0, walls: 0, openings: 0, devices: markers.length, decor: decor.length });
  return { documents: [converted.document], report };
}
