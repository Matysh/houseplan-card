/** Explicit content projection. Source objects never become HP config blobs. */
import { EasyInputError } from './easy-read.mjs';
import { numberAt } from './easy-geometry.mjs';
import { EASY_APPROXIMATE_FURNITURE, easyFurnitureSymbol } from './easy-catalog.mjs';
import { angleOf, booleanAt, literalCaption, readingSource, readingToken, safeImageReference, stringAt, validEntity } from './easy-style.mjs';

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const noteFields = (source, fields, code, id, notes) => {
  const present = fields.filter(key => source[key] !== undefined);
  if (present.length) notes.push({ code, id, fields: present.join(', ') });
};
export { noteFields };
export function reportRemainder(source, handled, id, notes) {
  noteFields(source, Object.keys(source).filter(key => !handled.includes(key)), 'source_fields_unsupported', id, notes);
}

export function textDecor(source, context, extra = {}) {
  const { ids, frame, cmPerUnit, color, notes } = context;
  const id = ids('text', source.id);
  const prefix = literalCaption(stringAt(source.text, `${id}.text`), id, notes);
  const reading = readingSource(source.entity, source.attribute);
  if (source.entity && !reading) notes.push({ code: 'text_reading_skipped', id });
  const text = [prefix, reading ? readingToken(reading) : ''].filter(Boolean).join(' ');
  if (!text) { notes.push({ code: 'empty_text_skipped', id }); return null; }
  if (text.length > 200) throw new EasyInputError('easy_text_too_long', id);
  const [x, y] = frame.point([numberAt(source.x, `${id}.x`), numberAt(source.y, `${id}.y`)]);
  const requested = numberAt(source.size, `${id}.size`, 16) * cmPerUnit;
  const size_cm = clamp(requested, 0.1, 2000);
  if (requested !== size_cm) notes.push({ code: 'text_size_clamped', id });
  const c = source.color === undefined ? '#808080' : color(source.color);
  if (!c) notes.push({ code: 'color_fallback', id });
  noteFields(source, ['locked'], 'editor_lock_skipped', id, notes);
  reportRemainder(source, ['id', 'x', 'y', 'text', 'entity', 'attribute', 'size', 'angle', 'color', 'locked'], id, notes);
  notes.push({ code: 'text_metrics_approximate', id });
  return { id, kind: 'text', x, y, text, size_cm,
    angle: angleOf(numberAt(source.angle, `${id}.angle`, 0)), color: c || '#808080', ...extra };
}

export function furnitureDecor(source, context) {
  const { ids, frame, color, notes } = context;
  const id = ids('furniture', source.id);
  const [cx, cy] = frame.point([numberAt(source.x, `${id}.x`), numberAt(source.y, `${id}.y`)]);
  const w = frame.size(numberAt(source.w, `${id}.w`)), h = frame.size(numberAt(source.h, `${id}.h`));
  if (!(w > 0 && h > 0)) throw new EasyInputError('easy_invalid_size', id);
  const requested = stringAt(source.type, `${id}.type`);
  const symbol = easyFurnitureSymbol(requested);
  const c = source.color === undefined ? '#808080' : color(source.color);
  if (!c) notes.push({ code: 'color_fallback', id });
  const box = { id, x: cx - w / 2, y: cy - h / 2, w, h,
    angle: angleOf(numberAt(source.angle, `${id}.angle`, 0)), color: c || '#808080' };
  noteFields(source, ['goToFloor', 'tap_action', 'hold_action', 'double_tap_action', 'entity', 'stateColor', 'activeColor'],
    'furniture_behavior_skipped', id, notes);
  noteFields(source, ['locked'], 'editor_lock_skipped', id, notes);
  reportRemainder(source, ['id', 'type', 'x', 'y', 'w', 'h', 'angle', 'color', 'hand', 'goToFloor', 'tap_action',
    'hold_action', 'double_tap_action', 'entity', 'stateColor', 'activeColor', 'locked'], id, notes);
  if (symbol) {
    if (EASY_APPROXIMATE_FURNITURE.has(requested)) notes.push({ code: 'furniture_approximate', id, type: requested });
    return [{ ...box, kind: 'furniture', symbol,
      ...(requested === 'sectional' && source.hand === 'left' ? { flip_h: true } : {}) }];
  }
  if (w < 0.001 || h < 0.001) throw new EasyInputError('easy_invalid_size', id);
  const label = literalCaption(requested || 'Furniture', id, notes);
  if (label.length > 200) throw new EasyInputError('easy_text_too_long', id);
  notes.push({ code: 'furniture_placeholder', id, type: requested });
  return [{ ...box, kind: 'rect', fill: false }, {
    id: ids('text', source.id), kind: 'text', x: cx, y: cy, text: label, size_cm: 12, color: box.color,
  }];
}

export function backgroundFields(config, floor, frame, notes) {
  if (!floor.image) return {};
  const url = safeImageReference(floor.image);
  if (!url) { notes.push({ code: 'image_reference_skipped', id: floor.id }); return {}; }
  const width = config.width ?? 1000, height = config.height ?? 600;
  const aspect = width / height;
  if (!(aspect >= 0.05 && aspect <= 20)) throw new EasyInputError('easy_invalid_size', 'background aspect');
  const baseW = aspect >= 1 ? 1 : aspect, baseH = aspect >= 1 ? 1 / aspect : 1;
  const [x, y] = frame.point([0, 0]);
  const result = { plan_url: url, plan_aspect: aspect,
    plan_x: x - (1 - baseW) / 2, plan_y: y - (1 - baseH) / 2,
    plan_scale_x: frame.size(width) / baseW, plan_scale_y: frame.size(height) / baseH };
  if (![result.plan_scale_x, result.plan_scale_y].every(value => value >= 0.01 && value <= 100))
    throw new EasyInputError('easy_invalid_size', 'background scale');
  notes.push({ code: 'image_external_reference', id: floor.id });
  if (floor.imageFit && floor.imageFit !== 'stretch') notes.push({ code: 'image_fit_stretch', id: floor.id });
  if (floor.imageOpacity !== undefined && numberAt(floor.imageOpacity, 'imageOpacity') !== 1)
    notes.push({ code: 'image_opacity_skipped', id: floor.id });
  return result;
}

export function roomConfig(room, context) {
  const { color, notes } = context, source = room.source, settings = {};
  if (source.color !== undefined) {
    const c = color(source.color);
    if (c) { settings.fill_mode = 'custom'; settings.custom_fill = { c,
      a: clamp(numberAt(source.opacity, `${room.id}.opacity`, 0.12), 0, 1) }; }
    else notes.push({ code: 'color_fallback', id: room.id });
  }
  if (source.haArea !== undefined && typeof source.haArea !== 'string')
    throw new EasyInputError('easy_invalid_text', `${room.id}.haArea`);
  noteFields(source, ['showName', 'labelSize', 'zoom', 'entity', 'attribute', 'stateColor', 'activeColor',
    'activeOpacity', 'outlineColor', 'outlineWidth', 'tap_action', 'hold_action', 'double_tap_action', 'locked'],
  'room_behavior_skipped', room.id, notes);
  reportRemainder(source, ['id', 'name', 'points', 'haArea', 'color', 'opacity', 'sideWalls', 'showName', 'labelSize',
    'zoom', 'entity', 'attribute', 'stateColor', 'activeColor', 'activeOpacity', 'outlineColor', 'outlineWidth',
    'tap_action', 'hold_action', 'double_tap_action', 'locked'], room.id, notes);
  return { id: room.id, name: stringAt(source.name, `${room.id}.name`, 'Room'),
    area: source.haArea || null, poly: room.poly,
    ...(Object.keys(settings).length ? { settings } : {}) };
}

export function openingConfig(source, context) {
  const { ids, frame, notes } = context, id = ids('opening', source.id);
  if (source.type === 'skylight') { notes.push({ code: 'skylight_skipped', id }); return null; }
  if (!['door', 'window', 'passage'].includes(source.type)) throw new EasyInputError('easy_invalid_opening', id);
  const [x, y] = frame.point([numberAt(source.x, `${id}.x`), numberAt(source.y, `${id}.y`)]);
  const length = frame.size(numberAt(source.length, `${id}.length`));
  if (!(length > 0)) throw new EasyInputError('easy_invalid_size', id);
  const result = { id, type: source.type, x, y, length,
    angle: angleOf(numberAt(source.angle, `${id}.angle`, 0)) };
  if (source.type !== 'passage') {
    const domain = validEntity(source.entity) ? source.entity.split('.')[0] : null;
    if (domain === 'binary_sensor' || domain === 'cover') result.contact = source.entity;
    else if (domain === 'lock' && source.type === 'door') result.lock = source.entity;
    else if (source.entity) notes.push({ code: 'opening_binding_skipped', id });
    for (const [key, target] of [['flipH', 'flip_h'], ['flipV', 'flip_v'], ['invert', 'invert']])
      if (source[key] !== undefined) result[target] = booleanAt(source[key], `${id}.${key}`);
  }
  if ((source.motion && source.motion !== 'swing') || source.sash === 'double')
    notes.push({ code: 'opening_shape_approximate', id });
  noteFields(source, ['shutterEntity', 'secondaryEntity', 'shutterSecondaryEntity', 'sunlight', 'glazed',
    'sashSpan', 'showIcon', 'showShutterIcon', 'icon', 'tapTarget', 'tap_action', 'hold_action', 'double_tap_action',
    'activeColor', 'inactiveColor', 'locked'], 'opening_behavior_skipped', id, notes);
  reportRemainder(source, ['id', 'type', 'x', 'y', 'length', 'angle', 'entity', 'flipH', 'flipV', 'invert', 'motion', 'sash',
    'shutterEntity', 'secondaryEntity', 'shutterSecondaryEntity', 'sunlight', 'glazed', 'sashSpan', 'showIcon', 'showShutterIcon',
    'icon', 'tapTarget', 'tap_action', 'hold_action', 'double_tap_action', 'activeColor', 'inactiveColor', 'locked'], id, notes);
  return result;
}
