import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceCopyFileGroups, deviceCopyIncoming, deviceCopyPosition, deviceCopyRadius, nextDeviceCopyName, rewriteDeviceCopyFiles, virtualDeviceCopy } from '../test-build/device-copy.js';
import { resolvedLightSources } from '../test-build/devices.js';

const device = (extra = {}) => ({ id: 'lamp', name: 'Lamp', icon: 'mdi:lightbulb-group', model: 'HA model', area: 'room', space: 'f1',
  bindingKind: 'entity', bindingRef: 'light.lamp', primary: 'light.lamp', entities: ['light.lamp'], ...extra });
const hass = { states: { 'light.lamp': { state: 'on', attributes: { rgb_color: [0, 0, 255], brightness: 128 } } } };

test('#935 copy names always fill the first hole from two, including hidden names and numbered sources', () => {
  for (const [source, occupied, expected] of [
    ['Lamp', [], 'Lamp 2'], ['Lamp 2', ['Lamp 2', 'Lamp 4'], 'Lamp 3'],
    ['Lamp 4', ['Lamp 4'], 'Lamp 2'], ['Lamp 10', ['Lamp 2'], 'Lamp 3'],
    ['  ', [], 'Device 2'], ['Lamp 1', [], 'Lamp 1 2'],
  ]) assert.equal(nextDeviceCopyName(source, occupied, 'Device'), expected);
});

test('#935 automatic HA lamp freezes base icon and manual glow, not own binding/state', () => {
  const copy = virtualDeviceCopy(device(), 'v_new', 'Lamp 2', [], hass, '#ffffff');
  assert.equal(copy.binding, 'virtual'); assert.equal(copy.icon, 'mdi:lightbulb-group');
  assert.equal(copy.tap_action, 'toggle'); assert.equal(copy.is_light, true);
  assert.deepEqual(copy.glow_color, { c: '#0000ff', bri: 128 / 255 });
  assert.equal(copy.model, 'HA model'); assert.equal(copy.area, 'room');
  assert.equal(copy.light_entity, undefined); assert.equal(copy.toggle_entity, undefined);
  assert.equal(copy.battery, undefined); assert.equal(copy.state, undefined);
  const runtime = device({ id: copy.id, marker: copy, bindingKind: 'virtual', bindingRef: undefined, primary: undefined, entities: [] });
  assert.equal(resolvedLightSources({ states: {} }, [runtime])[0].on, true);
});

test('#1000 virtual copy clears the physical HA dialog target and retains independent alarm definitions', () => {
  const alerts = [{ id: 'r1', type: 'threshold', level: 'attention', entity_id: 'light.lamp', operator: 'eq', value: 'on' }];
  const source = device({ marker: { id: 'lamp', binding: 'entity:light.lamp',
    more_info_entity: 'light.lamp', light_entity: 'light.lamp', toggle_entity: 'light.lamp', alert_sources: alerts } });
  const before = structuredClone(source);
  const copy = virtualDeviceCopy(source, 'v_new', 'Lamp 2', [], hass, '#ffffff');
  assert.equal(copy.binding, 'virtual');
  for (const key of ['more_info_entity', 'light_entity', 'toggle_entity']) assert.equal(Object.hasOwn(copy, key), false);
  assert.deepEqual(copy.alert_sources, alerts);
  assert.notEqual(copy.alert_sources, source.marker.alert_sources);
  copy.alert_sources[0].value = 'off';
  assert.deepEqual(source, before);
});

test('#935 template preserves nested future settings and explicit external controls independently', () => {
  const marker = { id: 'lamp', binding: 'entity:light.lamp', room_id: 'r1', icon: 'mdi:star',
    controls: ['light.lamp', 'light.other', 'sensor.legacy', 'light.other'],
    glow_color: { c: '#123456', bri: .25 }, value_source: { kind: 'derived_marker_state', ref: 'marker:lamp' },
    future: { list: [{ a: 2 }] }, vacuum: { new_run_after_dock: true, map_routes: [{ id: 'route', space: 'f1', source: 'camera.map', map_id: '1' }] } };
  const source = device({ marker, icon: 'mdi:star', pdfs: [{ name: 'manual', url: '/api/houseplan/content/files/lamp/manual.pdf' }] });
  const before = structuredClone(source);
  const copy = virtualDeviceCopy(source, 'v_new', 'Lamp 2', [], hass, '#ffffff');
  assert.deepEqual(copy.controls, ['light.other', 'sensor.legacy', 'light.other']);
  assert.deepEqual(copy.glow_color, marker.glow_color);
  assert.equal(copy.value_source.ref, 'marker:v_new');
  assert.equal(copy.vacuum.new_run_after_dock, true, '#940 copy preserves the optional vacuum choice');
  copy.future.list[0].a = 9; copy.vacuum.map_routes[0].space = 'f2'; copy.pdfs[0].name = 'changed';
  assert.deepEqual(source, before);
});

test('#935 incoming marker/entity edges include hidden controllers but never shared external targets or own self refs', () => {
  const config = { markers: [
    { id: 'a', controls: ['marker:lamp'] }, { id: 'b', controls: ['light.lamp', 'light.lamp'], hidden: true },
    { id: 'c', controls: ['light.other'] }, { id: 'lamp', controls: ['light.lamp'] },
    { id: 'removed', controls: ['marker:lamp'], removed: true }, { id: 'sibling', controls: ['switch.sibling'] },
  ] };
  assert.deepEqual(deviceCopyIncoming(config, device({ entities: ['light.lamp', 'switch.sibling'] })), ['a', 'b']);
  assert.deepEqual(deviceCopyIncoming(config, device({ bindingKind: 'device' })), ['a', 'b']);
  const relay = device({ primary: 'switch.relay', entities: ['switch.relay'], bindingRef: 'switch.relay',
    marker: { id: 'lamp', binding: 'entity:switch.relay', is_light: false } });
  assert.equal(virtualDeviceCopy(relay, 'v_new', 'Relay 2', [], hass, '#ffffff').is_light, false);
  assert.equal(virtualDeviceCopy(relay, 'v_new', 'Relay 2', ['controller'], hass, '#ffffff').is_light, true);
});

test('#935 unavailable HA light has safe fallback and virtual copies retain stored modes', () => {
  const copy = virtualDeviceCopy(device(), 'v_new', 'Lamp 2', [], { states: {} }, '#abcdef');
  assert.deepEqual(copy.glow_color, { c: '#abcdef', bri: 1 }); assert.equal(copy.is_light, true);
  const source = device({ bindingKind: 'virtual', primary: undefined, entities: [], marker: { id: 'lamp', binding: 'virtual', is_light: true, glow_color: { c: '#333333' } } });
  assert.deepEqual(virtualDeviceCopy(source, 'v_new', 'Lamp 2', [], hass, '#fff').glow_color, { c: '#333333' });
});

test('#935 placement is adjacent and nonoverlapping outside room/unit square; supports LED obstacles and finite refusal', () => {
  assert.equal(deviceCopyRadius(10,{box:{left:-10,right:10,top:-10,bottom:10},radius:10}),10);
  assert.equal(deviceCopyRadius(10,{box:{left:-50,right:50,top:-10,bottom:10},radius:10}),50);
  const source = { x: 995, y: 995, radius: 20 }, occupied = [source, { x: 1045, y: 995, radius: 30 }];
  const before = structuredClone(occupied);
  const outside = deviceCopyPosition(source, [source], 5);
  assert(outside.x > 1 || outside.y > 1);
  const pos = deviceCopyPosition(source, occupied, 5);
  assert(occupied.every(o => Math.hypot(pos.x * 1000 - o.x, pos.y * 1000 - o.y) > source.radius + o.radius));
  assert.deepEqual(occupied, before);
  const strip = { points: [[100, 100], [300, 100]], radius: 5 };
  const led = deviceCopyPosition({ x: 200, y: 100, radius: 20 }, [], 5, [strip]);
  assert(Math.abs(led.y * 1000 - 100) >= 25);
  assert.equal(deviceCopyPosition(source, occupied, 5, [], 0), null);
  assert.equal(deviceCopyPosition({ x: 5e6, y: 5e6, radius: 50 }, [{ x: 5e6, y: 5e6, radius: 1e8 }], 5, [], 2), null);
});

test('#935 internal attachment mapping is exact, independent and never rewrites external URLs', () => {
  const pdfs = [{ name: 'one', url: '/api/houseplan/content/files/lamp/a%20b.pdf' },
    { name: 'legacy', url: '/houseplan_files/files/other/a.pdf' },
    { name: 'external', url: 'https://example.org/files/lamp/a%20b.pdf' }];
  assert.deepEqual([...deviceCopyFileGroups({ pdfs })], [['lamp', ['a b.pdf']], ['other', ['a.pdf']]]);
  const rewritten = rewriteDeviceCopyFiles(pdfs, 'lamp', 'v_new', { 'a b.pdf': 'a b-2.pdf' });
  assert.equal(rewritten[0].url, '/api/houseplan/content/files/v_new/a%20b-2.pdf');
  assert.deepEqual(rewritten.slice(1), pdfs.slice(1));
  assert.throws(() => rewriteDeviceCopyFiles(pdfs, 'lamp', 'v_new', {}), /Missing copied attachment/);
  assert.equal(pdfs[0].url, '/api/houseplan/content/files/lamp/a%20b.pdf');
});
