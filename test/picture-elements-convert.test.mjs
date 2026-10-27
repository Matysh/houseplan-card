/**
 * #1022: Home Assistant picture-elements card -> House Plan space.
 *
 * The card has no geometry: what must hold is that every element lands at the
 * same point of the backdrop it had on the image, whatever the frame; that
 * nothing is guessed about the image proportions; and that every element the
 * converter cannot carry is named in the report instead of vanishing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { convertPicture, pictureCanvas, readPicture } from '../scripts/sh3d-convert/picture.mjs';
import { TEXT } from '../scripts/sh3d-convert/page/app.mjs';

const base = new URL('../scripts/sh3d-convert/', import.meta.url);
const fixed = { now: '1970-01-01T00:00:00Z', toolVersion: 'plan-convert 0.2' };
const measured = { ...fixed, imageWidth: 1600, imageHeight: 1000 };
const card = (elements, extra = {}) => JSON.stringify({ type: 'picture-elements', image: '/local/plan.png', elements, ...extra });
const at = (left, top) => ({ style: { left: `${left}%`, top: `${top}%` } });
/** Where a point sits inside the backdrop box, as fractions of the image: what the card meant. */
const relative = (document, id) => {
  const space = document.payload.config.spaces[0], point = document.payload.layout[id];
  const aspect = space.plan_aspect, baseW = aspect >= 1 ? 1 : aspect, baseH = aspect >= 1 ? 1 / aspect : 1;
  const x0 = space.plan_x + (1 - baseW) / 2, y0 = space.plan_y + (1 - baseH) / 2;
  return [(point.x - x0) / (space.plan_scale_x * baseW), (point.y - y0) / (space.plan_scale_y * baseH)];
};

test('#1022 fixture golden is the actual converter and CLI output, report included', () => {
  const source = readFileSync(new URL('fixtures/picture-elements.yaml', base), 'utf8');
  const result = convertPicture(source, measured);
  assert.equal(result.documents.length, 1);
  assert.deepEqual(result.documents[0], JSON.parse(readFileSync(new URL('golden/picture-elements.space-1.json', base))));
  assert.deepEqual(result.report, JSON.parse(readFileSync(new URL('golden/picture-elements.report.json', base))));
  const cli = spawnSync(process.execPath, ['scripts/sh3d-convert/cli.mjs', '--format', 'picture', '--width', '1600', '--height', '1000',
    'scripts/sh3d-convert/fixtures/picture-elements.yaml'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr); assert.deepEqual(JSON.parse(cli.stdout), result.documents);
  const refused = spawnSync(process.execPath, ['scripts/sh3d-convert/cli.mjs', '--format', 'picture',
    'scripts/sh3d-convert/fixtures/picture-elements.yaml'], { encoding: 'utf8' });
  assert.equal(refused.status, 1); assert.match(refused.stderr, /picture_aspect_required/);
});

test('#1022 percentages of the image become the same fractions of the backdrop, measured or by aspect', () => {
  const text = card([{ type: 'state-icon', entity: 'light.a', ...at(25, 40) }, { type: 'state-icon', entity: 'light.b', ...at(100, 0) }]);
  for (const options of [measured, { ...fixed, aspect: 1.6 }, { ...fixed, imageWidth: 600, imageHeight: 960 }]) {
    const { documents: [document] } = convertPicture(text, options);
    const [a, b] = document.payload.config.markers.map(marker => relative(document, marker.id));
    assert.ok(Math.abs(a[0] - 0.25) < 1e-6 && Math.abs(a[1] - 0.4) < 1e-6, JSON.stringify([options, a]));
    assert.ok(Math.abs(b[0] - 1) < 1e-6 && Math.abs(b[1]) < 1e-6, JSON.stringify([options, b]));
    const space = document.payload.config.spaces[0];
    assert.equal(space.plan_url, '/local/plan.png');
    assert.deepEqual(space.rooms, []); assert.equal(space.wall_segments.length, 0);
    assert.equal(document.content_manifest[0].url, '/local/plan.png');
  }
  const wide = convertPicture(text, measured).documents[0].payload.config.spaces[0];
  assert.equal(wide.plan_aspect, 1.6);
  const tall = convertPicture(text, { ...fixed, imageWidth: 600, imageHeight: 960 }).documents[0].payload.config.spaces[0];
  assert.equal(tall.plan_aspect, 0.625);
});

test('#1022 image proportions are never guessed', () => {
  assert.throws(() => convertPicture(card([{ type: 'state-icon', entity: 'light.a', ...at(1, 1) }]), fixed), error => error.code === 'picture_aspect_required');
  for (const options of [{ imageWidth: 10, imageHeight: 1000 }, { imageWidth: 100 }, { aspect: 0 }, { aspect: 'x' }, { aspect: Infinity },
    { imageWidth: 0, imageHeight: 1000 }, { imageWidth: -1600, imageHeight: 1000 },
    { imageWidth: NaN, imageHeight: 1000 }, { imageWidth: 1600, imageHeight: Infinity }])
    assert.throws(() => pictureCanvas(options), error => error.code === 'picture_invalid_aspect', JSON.stringify(options));
  assert.deepEqual(pictureCanvas({ aspect: 2 }), { width: 1000, height: 500, measured: false });
  assert.deepEqual(pictureCanvas({ imageWidth: 800, imageHeight: 600 }), { width: 800, height: 600, measured: false });
  assert.deepEqual(pictureCanvas({ imageWidth: 800, imageHeight: 600, imageMeasured: true }), { width: 800, height: 600, measured: true });
  const { report } = convertPicture(card([{ type: 'state-icon', entity: 'light.a', ...at(1, 1) }]), { ...fixed, aspect: 2 });
  assert.deepEqual(report.items.find(item => item.code === 'picture_size_aspect'), { code: 'picture_size_aspect', width: 1000, height: 500 });
  assert.ok(report.items.some(item => item.code === 'scale_default' && item.cmPerUnit === 1));
});

test('#1022 element kinds: icons become devices, badges carry the value, labels become live text', () => {
  const { documents: [document], report } = convertPicture(card([
    { type: 'state-icon', entity: 'light.a', title: 'Lamp', icon: 'mdi:ceiling-light', tap_action: { action: 'toggle', confirmation: true }, ...at(10, 10) },
    { type: 'state-icon', entity: 'switch.b', icon: 'hass:bad icon', hold_action: { action: 'more-info' }, ...at(20, 10) },
    { type: 'state-badge', entity: 'sensor.t', ...at(30, 10) },
    { type: 'icon', icon: 'mdi:cctv', entity: 'camera.c', tap_action: { action: 'navigate', navigation_path: '/x' }, ...at(40, 10) },
    { type: 'state-label', entity: 'sensor.out', prefix: 'Out ', suffix: ' °C', style: { left: '50%', top: '10%', color: 'white' } },
    { type: 'state-label', entity: 'climate.h', attribute: 'current_temperature', tap_action: { action: 'more-info' }, style: { left: '60%', top: '10%', color: 'var(--weird)' } },
    { type: 'state-label', prefix: '{plain}', ...at(70, 10) },
  ]), measured);
  const { markers } = document.payload.config, notes = report.levels[0].notes;
  assert.equal(markers.length, 4);
  assert.equal(markers[0].binding, 'entity:light.a'); assert.equal(markers[0].name, 'Lamp'); assert.equal(markers[0].icon, 'mdi:ceiling-light');
  assert.equal(markers[0].tap_action, 'toggle'); assert.equal(markers[0].tap_confirm, true); assert.equal(markers[0].is_light, false);
  assert.equal(markers[1].name, undefined, 'no title: the plan shows the HA friendly name, not the entity id');
  assert.equal(markers[1].icon, undefined); assert.ok(notes.some(note => note.code === 'icon_skipped' && note.id === markers[1].id));
  assert.ok(notes.some(note => note.code === 'secondary_actions_skipped' && note.id === markers[1].id));
  assert.equal(markers[2].value_badge.enabled, true);
  assert.deepEqual(markers[2].value_badge.source, { kind: 'entity_state', entity_id: 'sensor.t' });
  assert.equal(markers[2].tap_action, 'info');
  assert.equal(markers[3].binding, 'entity:camera.c'); assert.equal(markers[3].tap_action, 'info');
  assert.ok(notes.some(note => note.code === 'action_fallback_info' && note.id === markers[3].id));
  const decor = document.payload.config.spaces[0].decor;
  assert.equal(decor.length, 3);
  assert.equal(decor[0].text, 'Out {sensor.out} °C'); assert.equal(decor[0].color, '#ffffff'); assert.equal(decor[0].kind, 'text');
  assert.equal(decor[1].text, '{climate.h:current_temperature}'); assert.equal(decor[1].color, '#808080');
  assert.ok(notes.some(note => note.code === 'color_fallback' && note.id === decor[1].id));
  assert.ok(notes.some(note => note.code === 'label_actions_skipped' && note.id === decor[1].id));
  assert.equal(decor[2].text, '❴plain❵', 'literal braces never become an HA template');
  assert.equal(notes.filter(note => note.code === 'state_label_as_text').length, 3);
  assert.deepEqual(report.levels[0].notes.find(note => note.code === 'picture_lights_hint'), { code: 'picture_lights_hint', count: 1 });
  assert.equal(report.levels[0].devices, 4); assert.equal(report.levels[0].decor, 3); assert.equal(report.levels[0].rooms, 0);
});

test('#1022 every element that cannot be carried is named once in the report, nothing vanishes', () => {
  const { documents: [document], report } = convertPicture(card([
    { type: 'custom:button-card', entity: 'lock.d', ...at(1, 1) },
    { type: 'conditional', conditions: [], elements: [{ type: 'image' }, { type: 'image' }], ...at(1, 1) },
    { type: 'image', entity: 'light.h', state_image: {}, ...at(1, 1) },
    { type: 'service-button', title: 'Scene', service: 'scene.turn_on', ...at(1, 1) },
    { type: 'icon', icon: 'mdi:information', ...at(1, 1) },
    { type: 'state-icon', entity: 'binary_sensor.g', style: { left: '120px', top: '40%' } },
    { type: 'state-icon', entity: 'binary_sensor.h', style: { left: 'calc(10% + 2px)', top: '40%' } },
    { type: 'state-icon', entity: 'binary_sensor.i' },
    { type: 'state-icon', entity: 'light.s', ...at(101, 5) },
    { type: 'state-icon', entity: 'light.m', ...at(5, -1) },
    { type: 'state-icon', entity: 'not an entity', ...at(70, 70) },
    { type: 'state-icon', entity: 'light.ok', state_color: true, style: { left: '10%', top: '10%', transform: 'translate(0, 0)', filter: 'brightness(2)', '--mdc-icon-size': '40px' } },
    { type: 'state-icon', entity: 'light.centered', style: { left: 10, top: 10, transform: 'translate(-50%, -50%)' } },
  ], { camera_image: 'camera.x', dark_mode_image: '/local/dark.png', weird: 1 }), measured);
  const notes = report.levels[0].notes, codes = id => notes.filter(note => note.id === id).map(note => note.code);
  const ids = ['lock-d', 'conditional', 'light-h', 'scene', 'icon', 'binary-sensor-g', 'binary-sensor-h', 'binary-sensor-i', 'light-s', 'light-m', 'not-an-entity', 'light-ok', 'light-centered']
    .map(stem => `picture-1-element-${stem}`);
  assert.deepEqual(codes(ids[0]), ['element_custom_skipped']);
  assert.equal(notes.find(note => note.id === ids[1]).count, 2);
  assert.deepEqual(codes(ids[2]), ['element_image_skipped']);
  assert.deepEqual(codes(ids[3]), ['action_fallback_none']);
  assert.deepEqual(codes(ids[4]), [], 'an entityless icon is a virtual device with explicit none');
  assert.deepEqual(codes(ids[5]), ['element_position_unsupported']);
  assert.deepEqual(codes(ids[6]), ['element_position_unsupported']);
  assert.deepEqual(codes(ids[7]), ['element_position_missing']);
  assert.deepEqual(codes(ids[8]), ['element_position_outside']); assert.deepEqual(codes(ids[9]), ['element_position_outside']);
  assert.deepEqual(codes(ids[10]), ['binding_virtualized']);
  assert.deepEqual(codes(ids[11]).sort(), ['element_state_color_skipped', 'element_style_skipped', 'element_transform_ignored']);
  assert.equal(notes.find(note => note.id === ids[11] && note.code === 'element_style_skipped').fields, 'filter, --mdc-icon-size');
  assert.deepEqual(codes(ids[12]), ['element_position_unsupported'], 'a number is CSS pixels, never implicitly percent');
  const { markers } = document.payload.config;
  assert.deepEqual(markers.map(marker => marker.binding), ['virtual', 'virtual', 'virtual', 'entity:light.ok']);
  assert.equal(markers[0].name, 'Scene');
  assert.equal(markers[0].tap_action, 'none');
  assert.equal(markers[1].tap_action, 'none');
  assert.ok(report.items.some(item => item.code === 'picture_card_fields_skipped' && item.fields === 'camera_image, dark_mode_image'));
  assert.ok(report.items.some(item => item.code === 'source_fields_unsupported' && item.fields === 'weird'));
  assert.throws(() => convertPicture(card([{ type: 'image', ...at(1, 1) }, { type: 'state-icon', entity: 'x.y' }]), measured),
    error => { assert.equal(error.code, 'picture_nothing_to_convert'); assert.equal(error.report.levels[0].notes.length, 2); return true; });
});

test('#1022 only one picture-elements card is read, with the shared bounded YAML rules', () => {
  for (const [text, code] of [
    ['type: picture-glance\nimage: a\nelements: []', 'picture_not_card'],
    ['type: picture-elements\nelements: []', 'picture_no_image'],
    ['type: picture-elements\nimage: " "\nelements: []', 'picture_no_image'],
    ['type: picture-elements\nimage: a', 'picture_no_elements'],
    ['type: picture-elements\nimage: a\nelements: {}', 'picture_no_elements'],
    ['type: picture-elements\nimage: a\nelements: [1]', 'picture_invalid_element'],
    ['type: picture-elements\nimage: a\nelements: [{type: icon, style: 1}]', 'picture_invalid_element'],
    ['type: picture-elements\nimage: a\na: &a [1]\nb: *a\nelements: []', 'easy_unsafe_yaml'],
    ['type: picture-elements\nimage: a\nimage: b\nelements: []', 'easy_invalid_yaml'],
    ['- type: picture-elements', 'easy_not_card'],
    ['', 'easy_empty'],
  ]) assert.throws(() => readPicture(text), error => error.code === code, `${code}: ${text}`);
  assert.equal(readPicture(JSON.stringify({ type: 'picture-elements', image: 'a', elements: [] })).elements.length, 0);
  assert.throws(() => readPicture(JSON.stringify({ type: 'picture-elements', image: 'a', elements: Array.from({ length: 2001 }, () => ({})) })),
    error => error.code === 'easy_too_complex');
});

test('#1022 every report code and refusal has text on the page in both languages', () => {
  for (const code of ['picture_compatibility', 'picture_size_measured', 'picture_size_aspect', 'picture_card_fields_skipped', 'picture_lights_hint',
    'element_position_missing', 'element_position_unsupported', 'element_position_outside', 'element_transform_ignored', 'element_style_skipped',
    'element_state_color_skipped', 'element_type_skipped', 'element_custom_skipped', 'element_conditional_skipped', 'element_image_skipped',
    'state_label_as_text', 'label_actions_skipped', 'picture_counts', 'picture_limits', 'picture_size_manual', 'action_fallback_none',
    'button_tap_action_skipped', 'confirmation_simplified', 'confirmation_inactive', 'action_fields_skipped', 'element_field_skipped', 'element_font_size_skipped'])
    for (const language of ['ru', 'en']) assert.ok(TEXT[language][`note.${code}`], `${language}: note.${code}`);
  for (const code of ['picture_not_card', 'picture_no_image', 'picture_no_elements', 'picture_invalid_element', 'picture_aspect_required',
    'picture_invalid_aspect', 'picture_nothing_to_convert'])
    for (const language of ['ru', 'en']) assert.ok(TEXT[language][`code.${code}`], `${language}: code.${code}`);
  for (const key of ['picture.instructions', 'picture.paste', 'picture.size.why', 'picture.size.measured', 'picture.size.manual', 'picture.size.unreadable', 'drop.picture'])
    for (const language of ['ru', 'en']) assert.ok(TEXT[language][key], `${language}: ${key}`);
});
