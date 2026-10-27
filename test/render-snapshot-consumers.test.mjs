import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotConsumerDemand } from '../test-build/render-snapshot-consumers.js';
import { spaceDisplayOf } from '../test-build/logic.js';
import { captureRenderDeviceSnapshot } from '../test-build/render-snapshot-capture.js';
import { RenderSnapshotReuseWindow } from '../test-build/render-snapshot-reuse.js';
import { roomClimateKey, roomClimateMap } from '../test-build/devices.js';
import { captureHost, oracleFixture } from './render-snapshot-fixture.mjs';

const context = () => ({
  spaceId: 'floor', rooms: [{ id: 'room', name: 'Room', area: 'area', settings: {
    temp_source: 'entity:sensor.temperature', hum_source: 'device:humidity', co2_source: 'entity:sensor.co2',
  } }], markers: [], mode: 'view', markup: false, tooltip: false,
  display: { ...spaceDisplayOf(null, {}), showNames: false, hideDecor: true,
    labelTemp: false, labelHum: false, labelCo2: false, labelLqi: false, labelLight: false, fill: 'none', glow: false },
});

test('#1093 unpainted room sources and decor retire, reveal uses the same display policy', () => {
  const input = context();
  assert.deepEqual(snapshotConsumerDemand(input), { sources: [], areas: [], decor: false });
  input.display.labelTemp = true;
  assert.deepEqual(snapshotConsumerDemand(input).sources, [], 'hidden room names hide their metric row too');
  input.display.showNames = true;
  assert.deepEqual(snapshotConsumerDemand(input).sources, ['entity:sensor.temperature']);
  input.display.showNames = false; input.markup = true;
  assert.deepEqual(snapshotConsumerDemand(input).sources, ['entity:sensor.temperature'], 'plan labels remain painted');
  input.mode = 'decor'; input.markup = false;
  assert.equal(snapshotConsumerDemand(input).decor, true, 'decor editor overrides the stored hidden layer');
});

test('#1093 tooltip, draft temperature fill and room Glow retain their actual data consumers', () => {
  const input = context(); input.tooltip = true;
  assert.deepEqual(snapshotConsumerDemand(input).sources,
    ['entity:sensor.temperature', 'device:humidity', 'entity:sensor.co2']);
  input.mode = 'devices';
  assert.deepEqual(snapshotConsumerDemand(input).sources, [], 'room tooltip is View only');
  input.roomPreview = { id: 'room', fill: 'temp' };
  assert.deepEqual(snapshotConsumerDemand(input).sources, ['entity:sensor.temperature']);
  input.roomPreview.fill = ''; input.rooms[0].settings.fill_mode = 'temp';
  assert.deepEqual(snapshotConsumerDemand(input).sources, [], 'blank draft inherits the space, not stored room fill');
  input.rooms[0].settings.glow = true;
  assert.deepEqual(snapshotConsumerDemand(input).areas, ['area']);
});

test('#1093 hidden and moved local-room climate sources survive capture, ticks and demand retirement/reveal', () => {
  const fixture = oracleFixture(), space = fixture.config.spaces[0], room = space.rooms[0];
  room.area = null; room.id = 'local-room-demand'; room.settings = {};
  const entity = 'sensor.local_room_temperature';
  fixture.entities[entity] = { entity_id: entity, device_id: null, area_id: null, platform: 'houseplan_perf', disabled_by: null };
  fixture.states[entity] = { entity_id: entity, state: '25', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } };
  fixture.config.markers.push({ id: 'hidden-local', binding: `entity:${entity}`, hidden: true,
    space: space.id, area: null, room_id: room.id, icon: 'mdi:thermometer' });
  const host = captureHost(fixture), input = context(), reuse = new RenderSnapshotReuseWindow();
  input.spaceId = space.id; input.rooms = [room]; input.markers = fixture.config.markers;
  input.display.showNames = true; input.display.labelTemp = true;
  host._space = space.id; host._mode = 'view'; host._snapshotConsumerDemand = () => snapshotConsumerDemand(input);
  assert.equal(host._devices.some(device => device.id === 'hidden-local' && !device.hidden), false,
    'the aggregate source has no painted face');
  const climate = snapshot => roomClimateMap(snapshot.hass, undefined, fixture.config.markers, new Set())
    .get(roomClimateKey(space.id, room))?.temp;
  assert.equal(climate(captureRenderDeviceSnapshot(host, reuse)), 25);
  host.hass = { ...host.hass, states: { ...host.hass.states, [entity]: { ...host.hass.states[entity], state: '29' } } };
  host._hassSequence++;
  assert.equal(climate(captureRenderDeviceSnapshot(host, reuse)), 29);
  input.display.labelTemp = false;
  assert.equal(captureRenderDeviceSnapshot(host, reuse).hass.states[entity], undefined);
  input.tooltip = true;
  const revealed = captureRenderDeviceSnapshot(host, reuse);
  assert.equal(climate(revealed), 29, 'immediate tooltip sees the latest hidden source');
  assert.deepEqual(revealed.hass, captureRenderDeviceSnapshot(host, null).hass, 'reuse equals a complete fresh capture');
});

test('#1093 hidden decorative text skips formatting and captures its current value when revealed', () => {
  const host = captureHost(oracleFixture()), input = context(), reuse = new RenderSnapshotReuseWindow();
  const space = host._serverCfg.spaces[0], entity = 'sensor.decor_only';
  host._space = space.id; host._devices = []; host._summary = null;
  host.hass.entities[entity] = { entity_id: entity, platform: 'houseplan_perf', disabled_by: null };
  host.hass.states[entity] = { entity_id: entity, state: 'first', attributes: {} };
  space.decor = [{ id: 'caption', kind: 'text', text: `{${entity}}` }];
  input.rooms = []; input.spaceId = space.id;
  host._snapshotConsumerDemand = () => snapshotConsumerDemand(input);
  const hidden = captureRenderDeviceSnapshot(host, reuse);
  assert.equal(hidden.facts.has(`decor:${space.id}:caption`), false);
  assert.equal(hidden.hass.states[entity], undefined);
  host.hass = { ...host.hass, states: { ...host.hass.states, [entity]: { ...host.hass.states[entity], state: 'latest' } } };
  host._hassSequence++;
  input.display.hideDecor = false;
  const shown = captureRenderDeviceSnapshot(host, reuse);
  assert.equal(shown.facts.get(`decor:${space.id}:caption`), 'latest');
  assert.deepEqual(shown.hass, captureRenderDeviceSnapshot(host, null).hass);
});
