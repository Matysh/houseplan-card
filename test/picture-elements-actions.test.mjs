import test from 'node:test';
import assert from 'node:assert/strict';
import { convertPicture } from '../scripts/sh3d-convert/picture.mjs';
import { makeIds } from '../scripts/sh3d-convert/easy-geometry.mjs';

const options = { imageWidth: 1600, imageHeight: 1000, now: '1970-01-01T00:00:00Z' };
const convert = elements => convertPicture(JSON.stringify({ type: 'picture-elements', image: '/local/plan.png',
  elements: elements.map(e => ({ style: { left: '31.125%', top: '72.75%' }, ...e })) }), options);
const icon = tap_action => ({ type: 'icon', icon: 'mdi:play', tap_action });
const call = (service, target, extra = {}) => ({ action: 'perform-action', perform_action: service, target: { entity_id: target }, ...extra });

test('#1022 exact supported service requests and legacy buttons keep the existing run contract', () => {
  const actions = [call('automation.trigger', 'automation.a'), call('script.turn_on', ['script.b']),
    call('scene.turn_on', 'scene.c', { confirmation: true }), { action: 'call-service', service: 'script.movie' },
    { action: 'call-service', perform_action: 'scene.turn_on', data: { entity_id: 'scene.d' }, confirmation: { text: 'Yes?', exemptions: [] } }];
  const result = convert([...actions.map(icon), { type: 'service-button', title: 'Legacy', service: 'script.turn_on',
    service_data: { entity_id: 'script.legacy' } }]);
  const markers = result.documents[0].payload.config.markers;
  assert.deepEqual(markers.map(m => [m.binding, m.tap_action, m.tap_target]),
    ['automation.a', 'script.b', 'scene.c', 'script.movie', 'scene.d', 'script.legacy'].map(id => ['virtual', 'run', id]));
  assert.equal(markers[2].tap_confirm, true); assert.equal(markers[4].tap_confirm, true);
  assert.ok(result.report.levels[0].notes.some(n => n.code === 'confirmation_simplified' && n.sourceIndex === 4));
});

test('#1022 arbitrary payload, ambiguous aliases, broad/foreign targets and reserved script services gain no authority', () => {
  const rejected = [call('light.turn_on', 'light.a'), call('scene.turn_on', ['scene.a', 'scene.b']),
    call('automation.trigger', 'automation.a', { data: { skip_condition: true } }),
    call('script.turn_on', 'script.a', { target: { area_id: 'room' } }),
    call('script.turn_on', 'script.a', { target: { device_id: 'device' } }),
    call('scene.turn_on', 'scene.a', { data: { entity_id: 'scene.b' } }),
    { action: 'call-service', service: 'script.movie', data: { value: 2 } },
    { action: 'call-service', service: 'script.turn_off' }, { action: 'call-service', service: 'script.reload' },
    { action: 'call-service', service: 'script.toggle' }, { action: 'call-service', service: 'script.turn_on' },
    { action: 'call-service', service: 'script.a', perform_action: 'script.b' },
    call('script.turn_on', 'script.a', { data: {}, service_data: {} }),
    call('script.turn_on', '{{ states.script.x }}'),
    { action: 'url', url_path: 'https://example.org' }, { action: 'navigate', navigation_path: '/a' },
    { action: 'toggle', entity: 'light.foreign' }, { action: 'more-info' },
    { action: 'toggle' }, { action: 'call-service', service: 'script.movie', confirmation: 'yes' }];
  for (const bound of [false, true]) {
    const result = convert(rejected.map(action => ({ ...icon(action), ...(bound ? { entity: 'light.own' } : {}) })));
    for (const [i, marker] of result.documents[0].payload.config.markers.entries()) {
      // Own toggle and own more-info are supported only on a bound marker.
      const supported = bound && [17, 18].includes(i);
      assert.equal(marker.tap_action, supported && i === 18 ? 'toggle' : bound ? 'info' : 'none', `${i}: ${JSON.stringify(rejected[i])}`);
      assert.equal(marker.tap_target, undefined);
      if (!supported) assert.ok(result.report.levels[0].notes.some(n => n.sourceIndex === i && n.code.startsWith('action_fallback_')));
    }
  }
});

test('#1022 native default is information even for lights; secure toggles retain the existing runtime no-op', () => {
  const result = convert([{ type: 'state-icon', entity: 'light.a', title: null },
    { type: 'icon', entity: 'lock.door', tap_action: { action: 'toggle', confirmation: true } },
    { type: 'state-icon', entity: 'alarm_control_panel.home', tap_action: { action: 'toggle' } },
    { type: 'service-button', tap_action: { action: 'call-service', service: 'script.unowned' } },
    { type: 'icon' }]);
  assert.deepEqual(result.documents[0].payload.config.markers.map(m => m.tap_action), ['info', 'toggle', 'toggle', 'none', 'none']);
  assert.equal(result.report.levels[0].notes.filter(n => n.code === 'secure_toggle_inert').length, 2);
  assert.ok(result.report.levels[0].notes.some(n => n.code === 'button_tap_action_skipped' && n.sourceIndex === 3));
});

test('#1022 stored confirmation on information/no-op reports the existing runtime limitation', () => {
  const result = convert([{ type: 'icon', entity: 'light.a', tap_action: { action: 'more-info', confirmation: true } },
    { type: 'icon', tap_action: { action: 'none', confirmation: true } }]);
  assert.deepEqual(result.documents[0].payload.config.markers.map(m => [m.tap_action, m.tap_confirm]), [['info', true], ['none', true]]);
  assert.equal(result.report.levels[0].notes.filter(n => n.code === 'confirmation_inactive').length, 2);
});

test('#1022 every static/stateful image variant is skipped with original identity and counts before download', () => {
  const images = [{ image: '/local/a.png' }, { entity: 'light.a' }, { state_image: { on: '/local/on.png' } },
    { state_filter: { on: 'opacity(1)' } }, { tap_action: { action: 'call-service', service: 'script.a' } }];
  const result = convert([...images.map((extra, i) => ({ type: 'image', id: `source-${i}`, ...extra })), { type: 'icon' }]);
  assert.equal(result.documents[0].payload.config.markers.length, 1);
  assert.equal(result.documents[0].payload.config.spaces[0].decor.length, 0);
  assert.equal(result.documents[0].payload.config.spaces[0].plan_url, '/local/plan.png');
  for (const [i, entry] of result.report.levels[0].elements.entries()) {
    assert.equal(entry.sourceIndex, i);
    assert.equal(entry.status, i === 5 ? 'transferred' : 'skipped');
    if (i < 5) { assert.equal(entry.sourceId, `source-${i}`); assert.deepEqual(entry.codes, ['element_image_skipped']); }
  }
  assert.deepEqual(result.report.levels[0].counts, { transferred: 1, partial: 0, skipped: 5 });
});

test('#1022 invalid positions never become percentages and literal label styles stay within the current model', () => {
  const result = convert([{ type: 'icon', style: { left: 25, top: '30%' } },
    { type: 'state-label', entity: 'sensor.t', prefix: '{sensor.other} ', suffix: ' °C',
      style: { left: '1.25e1%', top: '.5%', color: '#abc', 'font-size': '20px' } },
    { type: 'state-label', entity: 'sensor.t', style: { left: '50%', top: '50%', 'font-size': 'var(--size)' } }]);
  const [a, b] = result.documents[0].payload.config.spaces[0].decor;
  assert.equal(a.text, '❴sensor.other❵ {sensor.t} °C'); assert.equal(a.size_cm, 20); assert.equal(a.color, '#aabbcc');
  assert.equal(b.size_cm, 16);
  assert.deepEqual(result.report.levels[0].counts, { transferred: 0, partial: 2, skipped: 1 });
  assert.ok(result.report.levels[0].notes.some(n => n.code === 'element_font_size_skipped' && n.sourceIndex === 2));
});

test('#1022 unsupported prototype-like types and oversized captions are reported safely', () => {
  const result = convert([{ type: 'constructor' }, { type: 'toString' }, { type: '__proto__' },
    { type: 'icon', title: 'x'.repeat(501), id: 'y'.repeat(501) }]);
  assert.equal(result.documents[0].payload.config.markers.length, 1);
  assert.equal(result.documents[0].payload.config.markers[0].name, 'Device');
  assert.deepEqual(result.report.levels[0].counts, { transferred: 0, partial: 1, skipped: 3 });
  assert.equal(result.report.levels[0].elements[3].sourceId, undefined);
  assert.equal(result.report.levels[0].elements[3].sourceIndex, 3);
});

test('#1022 maximum repeated virtual icons have deterministic unique IDs without restarting collision scans', () => {
  const result = convert(Array.from({ length: 2000 }, () => ({ type: 'icon' })));
  const markers = result.documents[0].payload.config.markers;
  assert.equal(markers.length, 2000); assert.equal(new Set(markers.map(m => m.id)).size, 2000);
  assert.equal(markers[0].id, 'picture-1-element-icon');
  assert.equal(markers[1999].id, 'picture-1-element-icon-1999');
  const ids = makeIds('x');
  assert.deepEqual(['same', 'same-1', 'same', 'same'].map(name => ids('a', name)),
    ['x-a-same', 'x-a-same-1', 'x-a-same-2', 'x-a-same-3']);
});

test('#1022 unsafe/signed backdrop references are omitted whole without leaking them into output or report', () => {
  for (const image of ['javascript:alert(1)', 'data:image/png;base64,abc',
    'https://user:password@example.org/plan.png', 'https://example.org/plan.png?token=private',
    'https://example.org/plan.png#private', '/api/image_proxy/secret']) {
    const result = convertPicture(JSON.stringify({ type: 'picture-elements', image,
      elements: [{ type: 'icon', icon: 'mdi:home', style: { left: '50%', top: '50%' } }] }), options);
    assert.equal(result.documents[0].payload.config.spaces[0].plan_url, undefined);
    assert.ok(result.report.levels[0].notes.some(note => note.code === 'image_reference_skipped'));
    assert.equal(JSON.stringify(result).includes(image), false);
  }
});
