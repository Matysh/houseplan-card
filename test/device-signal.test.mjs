import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceSignalContext, deviceLqi, deviceSignalEntityIds, deviceSignalPhysicalId,
  markerSignalFields, showMarkerSignalOf } from '../test-build/device-signal.js';
import { areaLqi, buildDevices, lqiFor } from '../test-build/devices.js';
import { resolveDevicePresentation } from '../test-build/device-presentation.js';
import { resolveValueSource, valueBadgeCandidates } from '../test-build/device-value-badge.js';
import { deviceBatteryReading, createDeviceBatteryContext } from '../test-build/device-battery.js';
import { captureRenderDeviceSnapshot } from '../test-build/render-snapshot-capture.js';
import { RenderSnapshotReuseWindow } from '../test-build/render-snapshot-reuse.js';
import { captureHost, oracleFixture } from './render-snapshot-fixture.mjs';

const state = (value, attributes = {}) => ({ state: value, attributes });
const own = (parent = 'A') => ({ device_id: parent, disabled_by: null });
const hass = () => ({ devices: { A: {}, B: {}, router: {} }, entities: {
  'switch.a': own(), 'switch.a2': own(), 'sensor.a_linkquality': own(), 'sensor.a_battery': own(),
  'switch.b': own('B'), 'sensor.b_lqi': own('B'), 'sensor.router_lqi': own('router'),
}, states: { 'switch.a': state('off'), 'switch.a2': state('on'),
  'sensor.a_linkquality': state('100'), 'sensor.a_battery': state('42', { device_class: 'battery' }),
  'switch.b': state('off'), 'sensor.b_lqi': state('200'), 'sensor.router_lqi': state('255'),
} });
const marker = (kind = 'entity', ref = 'switch.a', id = 'a1', patch = {}) => ({
  id, name: id, model: '', icon: 'mdi:toggle-switch', area: 'room', space: 'floor',
  entities: kind === 'entity' ? [ref] : ['switch.a', 'sensor.a_linkquality'], primary: 'switch.a',
  bindingKind: kind, bindingRef: ref, bindingStatus: { kind: 'active' },
  marker: { id, binding: `${kind}:${ref}` }, ...patch,
});
const options = { liveStates: true, showTemperature: true, showSignal: true };

test('#867 AC1 own Z2M/ZHA siblings and exact attributes share one canonical reading, including zero', () => {
  const h = hass(), d = marker();
  assert.equal(deviceLqi(h, d), 100);
  assert.equal(lqiFor(h, ['sensor.a_linkquality']), 100);
  assert.equal(resolveValueSource(h, d, { kind: 'derived_lqi' }).text, '100');
  assert.ok(valueBadgeCandidates(h, d).some(x => x.key === 'derived:lqi'));
  assert.deepEqual(d.entities, ['switch.a'], 'diagnostics never become actions/primary');
  assert.deepEqual(deviceBatteryReading(d, createDeviceBatteryContext(h)),
    { kind: 'percent', value: 42, sourceEntityId: 'sensor.a_battery' });
  h.states['sensor.a_linkquality'] = state('unavailable');
  h.states['switch.a'] = state('off', { lqi: 0 });
  assert.equal(deviceLqi(h, d), 0, 'real zero attribute survives unavailable sibling');
  h.states['switch.a2'] = state('on', { linkquality: 100 });
  assert.equal(deviceLqi(h, d), 50, 'same canonical average across own active attributes');
  const physical = marker('device', 'A');
  assert.equal(deviceLqi(h, physical), 0, 'physical device keeps its existing entity selection');
});

test('#867 AC1 exact ownership refuses router/controls, unknown/disabled/missing parents and sources', () => {
  const h = hass(), d = marker('entity', 'switch.a', 'a1', { controls: ['sensor.router_lqi'] });
  assert.equal(deviceSignalPhysicalId(d, createDeviceSignalContext(h)), 'A');
  h.entities['switch.a'] = { ...own(), device_id: null };
  assert.equal(deviceLqi(h, d), null);
  h.entities['switch.a'] = own(); delete h.devices.A;
  assert.equal(deviceLqi(h, d), null);
  h.devices.A = { disabled_by: 'user' };
  assert.equal(deviceLqi(h, d), null);
  h.devices.A = {}; h.entities['sensor.a_linkquality'] = { ...own(), disabled_by: 'user' };
  assert.equal(deviceLqi(h, d), null);
  h.entities['sensor.a_linkquality'] = own(); h.states['sensor.a_linkquality'] = state('unknown', { lqi: 255 });
  assert.equal(deviceLqi(h, d), null, 'unavailable state attributes are not live readings');
  for (const kind of ['unverified', 'orphaned', 'ha_disabled']) {
    assert.equal(deviceLqi(h, { ...d, bindingStatus: { kind } }), null);
  }
  assert.equal(deviceLqi(h, { ...d, virtual: true }), null);
  assert.equal(deviceLqi(h, { ...d, bindingKind: undefined, bindingRef: undefined, marker: { binding: 'virtual' } }), null);
});

test('#867 AC2 registry index is shared on state ticks and retired on registry replacement', () => {
  const h = hass(), a = createDeviceSignalContext(h), b = createDeviceSignalContext({ ...h, states: {} });
  assert.equal(a.entityIdsByDevice, b.entityIdsByDevice);
  assert.ok(deviceSignalEntityIds(marker(), a).includes('sensor.a_linkquality'));
  const changed = { ...h, entities: { ...h.entities, 'sensor.a_linkquality': own('B') } };
  const c = createDeviceSignalContext(changed);
  assert.notEqual(a.entityIdsByDevice, c.entityIdsByDevice);
  assert.equal(deviceLqi(changed, marker(), c), null, 'old parent cannot retain the moved sibling');
});

test('#867 AC7 10,000 foreign rows are indexed once; state ticks read only the own diagnostic roster', () => {
  const h = hass(), rows = { ...h.entities };
  for (let index = 0; index < 10000; index++) rows[`sensor.foreign_${index}_lqi`] = own(`foreign-${index}`);
  let registryScans = 0, stateReads = 0;
  h.entities = new Proxy(rows, { ownKeys: target => { registryScans++; return Reflect.ownKeys(target); } });
  const d = marker(), ownCount = Object.values(rows).filter(row => row.device_id === 'A').length;
  let firstIndex;
  for (let tick = 0; tick < 250; tick++) {
    const states = new Proxy({ ...h.states, 'sensor.a_linkquality': state(String(tick % 256)) }, {
      get: (target, key) => { if (typeof key === 'string') stateReads++; return Reflect.get(target, key); },
      ownKeys: () => { throw new Error('a marker reading must not enumerate all HA states'); },
    });
    const current = { ...h, states }, context = createDeviceSignalContext(current);
    firstIndex ||= context.entityIdsByDevice;
    assert.equal(context.entityIdsByDevice, firstIndex);
    assert.equal(deviceLqi(current, d, context), tick % 256);
  }
  assert.equal(registryScans, 1, 'registry identity, not state/frame identity, owns the full scan');
  assert.equal(stateReads, 250 * ownCount * 2, 'one availability pass and one canonical reading pass over own rows only');
});

test('#867 AC2 sibling-only tick with battery off invalidates both own presentation variants', () => {
  const fixture = oracleFixture();
  fixture.config.settings.show_device_battery = false;
  fixture.entities['sensor.hp867_lqi'] = own('perf-device-42');
  fixture.states['sensor.hp867_lqi'] = state('120');
  const host = captureHost(fixture), reuse = new RenderSnapshotReuseWindow();
  const first = captureRenderDeviceSnapshot(host, reuse);
  assert.equal(first.presentations.get('perf-entity-42:1').lqiText, '120');
  assert.ok(first.entityIds.includes('sensor.hp867_lqi'));
  const primary = host.hass.states['sensor.perf_42'];
  host.hass = { ...host.hass, states: { ...host.hass.states, 'sensor.hp867_lqi': state('0') } };
  host._hassSequence++;
  const next = captureRenderDeviceSnapshot(host, reuse);
  assert.equal(host.hass.states['sensor.perf_42'], primary);
  assert.equal(next.presentations.get('perf-entity-42:1').lqiText, '0');
  assert.equal(next.presentations.get('perf-entity-42:1').lqiTipText, '0');
  assert.equal(next.presentations.get('perf-entity-42:1').battery, null);
  assert.notEqual(next.presentations.get('perf-entity-42:1'), first.presentations.get('perf-entity-42:1'));
  assert.deepEqual([...next.presentations], [...captureRenderDeviceSnapshot(host).presentations]);
});

test('#867 AC3 local hide affects only system line; explicit badge/value, tip and global/static gates remain', () => {
  const h = hass(), d = marker();
  assert.deepEqual(markerSignalFields(false), {});
  assert.deepEqual(markerSignalFields(true), { hide_signal: true });
  for (const value of [undefined, false, null, 'true', 1]) assert.equal(showMarkerSignalOf({ hide_signal: value }), true);
  d.marker.hide_signal = true;
  const hidden = resolveDevicePresentation(h, d, options);
  assert.equal(hidden.lqiText, null); assert.equal(hidden.lqiTipText, '100');
  assert.equal(resolveDevicePresentation(h, marker(), options).lqiText, '100');
  const off = resolveDevicePresentation(h, d, { ...options, showSignal: false });
  assert.equal(off.lqiText, null); assert.equal(off.lqiTipText, null);
  d.marker.value_badge = { enabled: true, source: { kind: 'derived_lqi' } };
  assert.equal(resolveDevicePresentation(h, d, { ...options, showSignal: false }).valueBadge.text, '100');
  d.marker.display = 'value'; d.marker.value_source = { kind: 'derived_lqi' };
  assert.equal(resolveDevicePresentation(h, d, { ...options, showSignal: false }).valueText, '100');
  d.marker.display = 'static_icon';
  const neutral = resolveDevicePresentation(h, d, options);
  assert.equal(neutral.lqiText, null); assert.equal(neutral.lqiTipText, null);
});

test('#867 AC5 one physical radio per room, hidden included; deleted and HA-disabled excluded', () => {
  const h = hass(), device = marker('device', 'A'), a = marker(), a2 = marker('entity', 'switch.a2', 'a2');
  const b = marker('device', 'B', 'b', { entities: ['switch.b', 'sensor.b_lqi'] });
  assert.equal(areaLqi(h, [device, a, a2, b], 'room'), 150, 'not per-marker 125');
  a.marker.hide_signal = true; device.hidden = true;
  assert.equal(areaLqi(h, [device, a, a2, b], 'room'), 150);
  device.marker.removed = true;
  assert.equal(areaLqi(h, [device, a, a2, b], 'room'), 150, 'live entity retains its own HA parent');
  assert.equal(areaLqi(h, [{ ...a, area: 'other' }, b], 'other'), 100);
  a.bindingStatus = a2.bindingStatus = { kind: 'ha_disabled' };
  assert.equal(areaLqi(h, [device, a, a2, b], 'room'), 200);
});

test('#867 AC1/AC5 a plan-only device tombstone leaves the exact live entity and own battery/LQI', () => {
  const h = hass();
  const devices = buildDevices({ hass: h, registry: { authoritative: true, access: 'full', revision: 1,
    devices: h.devices, entities: h.entities }, areaToSpace: { room: 'floor' },
    markers: [{ id: 'removed-A', binding: 'device:A', removed: true, hidden: true },
      { id: 'live-a', binding: 'entity:switch.a', space: 'floor', area: 'room' }],
    settings: { filter_seeded: true }, excluded: new Set(), showAll: true, firstSpaceId: 'floor', loc: x => x });
  const live = devices.find(d => d.id === 'live-a');
  assert.ok(live); assert.equal(devices.some(d => d.id === 'removed-A'), false);
  assert.equal(deviceLqi(h, live), 100);
  assert.equal(deviceBatteryReading(live, createDeviceBatteryContext(h)).value, 42);
  assert.equal(areaLqi(h, devices, 'room'), 100);
});
