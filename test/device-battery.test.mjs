import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDeviceBatteryContext, deviceBatteryEntityIds, resolveDeviceBattery,
} from '../test-build/device-battery.js';
import { activeRegistryHass } from '../test-build/ha-binding-status.js';
import { createRenderDeviceSnapshot } from '../test-build/render-device-snapshot.js';
import { classifyHassRenderChange } from '../test-build/render-invalidation.js';

const row = (state, deviceClass = 'battery') => ({ state, attributes: { device_class: deviceClass } });
const registryRow = (deviceId = 'own', deviceClass = 'battery') => ({
  device_id: deviceId, original_device_class: deviceClass, disabled_by: null,
});
const marker = (kind = 'device', ref = 'own') => ({
  id: 'marker', name: 'Marker', space: 'floor', entities: [], icon: 'mdi:chip',
  bindingKind: kind, bindingRef: ref, bindingStatus: { kind: 'active' },
});
const one = (state, entityId = 'sensor.battery') => ({
  entities: { [entityId]: registryRow() },
  devices: { own: { disabled_by: null } },
  states: { [entityId]: row(state) },
});
const resolved = (hass, device = marker()) => resolveDeviceBattery(device, createDeviceBatteryContext(hass));
const expectState = (hass, state, sourceEntityId = 'sensor.battery', device = marker()) => (
  assert.deepEqual(resolved(hass, device), { state, sourceEntityId })
);

for (const [value, state] of [
  [0, 'low'], [19, 'low'], [19.9, 'low'], [20, 'warning'],
  [59, 'warning'], [59.9, 'warning'], [60, 'normal'], [100, 'normal'],
]) test(`AC1 percentage ${value} uses the exact ${state} band without rounding`, () => {
  expectState(one(String(value)), state);
  expectState(one(value), state);
});

for (const [label, value] of [
  ['missing', undefined], ['null', null], ['empty', ''], ['whitespace', '  '],
  ['unknown', 'unknown'], ['unavailable', 'unavailable'], ['NaN', 'NaN'],
  ['numeric NaN', NaN], ['Infinity', 'Infinity'], ['numeric Infinity', Infinity],
  ['negative', '-1'], ['above range', '100.1'], ['unit', '19%'], ['suffix', '19 low'],
  ['hexadecimal', '0x20'], ['scientific text', '2e1'], ['comma', '19,9'],
  ['boolean', false], ['array', []], ['object', {}],
]) test(`AC1 invalid ${label} is unknown, not a false numeric level`, () => {
  expectState(one(value), 'unknown');
});

test('missing state preserves known battery identity and decimal whitespace is harmless', () => {
  const hass = one('20');
  delete hass.states['sensor.battery'];
  expectState(hass, 'unknown');
  expectState(one(' 20.0 '), 'warning');
  expectState(one('.5'), 'low');
});

for (const [value, state] of [
  ['on', 'low'], ['off', 'normal'], ['unknown', 'unknown'], ['unavailable', 'unknown'],
  ['low', 'unknown'], ['normal', 'unknown'], ['ON', 'unknown'], [0, 'unknown'], [true, 'unknown'],
]) test(`AC1 binary ${String(value)} maps only HA on/off, never an invented percent`, () => {
  expectState(one(value, 'binary_sensor.battery'), state, 'binary_sensor.battery');
  assert.deepEqual(Object.keys(resolved(one(value, 'binary_sensor.battery'))).sort(), ['sourceEntityId', 'state']);
});

test('AC2 class evidence, not name, icon, unit or legacy battery attribute, identifies a battery', () => {
  const hass = {
    devices: { own: {} },
    entities: {
      'sensor.battery_name': registryRow('own', null),
      'sensor.voltage': registryRow('own', 'voltage'),
      'sensor.battery_temperature': registryRow('own', 'temperature'),
      'binary_sensor.charging': registryRow('own', 'battery_charging'),
      'vacuum.robot': registryRow('own', null),
    },
    states: {
      'sensor.battery_name': { state: '10', attributes: { unit_of_measurement: '%', icon: 'mdi:battery-low' } },
      'sensor.voltage': row('3.1', 'voltage'),
      'sensor.battery_temperature': row('20', 'temperature'),
      'binary_sensor.charging': row('on', 'battery_charging'),
      'vacuum.robot': { state: 'docked', attributes: { battery_level: 15 } },
    },
  };
  assert.equal(resolved(hass), null);
});

test('class uses current attributes then registry override then original metadata', () => {
  const hass = one('10');
  hass.states['sensor.battery'] = row('10', 'temperature');
  assert.equal(resolved(hass), null, 'current non-battery class outranks old metadata');
  hass.states['sensor.battery'] = { state: '10' };
  hass.entities['sensor.battery'].device_class = 'temperature';
  assert.equal(resolved(hass), null, 'registry override outranks original class');
  hass.entities['sensor.battery'].device_class = 'battery';
  expectState(hass, 'low');
  delete hass.entities['sensor.battery'].device_class;
  expectState(hass, 'low');
});

test('AC2 device and entity siblings resolve their own parent independently of functional roster', () => {
  const hass = one('10');
  hass.entities['binary_sensor.contact'] = registryRow('own', 'door');
  hass.states['binary_sensor.contact'] = row('off', 'door');
  hass.entities['sensor.other_battery'] = registryRow('other');
  hass.states['sensor.other_battery'] = row('100');
  hass.devices.other = {};
  for (const device of [marker(), marker('entity', 'binary_sensor.contact')]) {
    device.entities = ['binary_sensor.contact'];
    device.primary = 'binary_sensor.contact';
    device.controls = ['sensor.other_battery'];
    device.allEntities = ['binary_sensor.contact'];
    const original = structuredClone(device);
    expectState(hass, 'low', 'sensor.battery', device);
    assert.deepEqual(device, original, 'battery does not expand or mutate the functional roster');
  }
});

test('AC2 exact battery entity beats both numeric-first and alphabetical sibling selection', () => {
  const hass = one('100');
  hass.entities['sensor.z_battery'] = registryRow();
  hass.states['sensor.z_battery'] = row('40');
  hass.entities['binary_sensor.z_battery'] = registryRow();
  hass.states['binary_sensor.z_battery'] = row('on');
  expectState(hass, 'warning', 'sensor.z_battery', marker('entity', 'sensor.z_battery'));
  expectState(hass, 'low', 'binary_sensor.z_battery', marker('entity', 'binary_sensor.z_battery'));
});

test('AC2 registry-less exact battery is supported, but arbitrary siblings and a parent are not invented', () => {
  const hass = { states: { 'sensor.exact': row('40'), 'light.group': { state: 'on', attributes: {
    entity_id: ['sensor.exact'], device_id: 'invented', battery_level: 40,
  } } } };
  expectState(hass, 'warning', 'sensor.exact', marker('entity', 'sensor.exact'));
  assert.equal(resolved(hass, marker('entity', 'light.group')), null);
  assert.equal(resolved(hass, marker('device', 'invented')), null);
});

test('AC2 controls, group members, same names/areas and via_device_id never provide ownership', () => {
  const hass = one('5');
  hass.entities['sensor.battery'].device_id = 'other';
  hass.entities['light.group'] = { device_id: 'own', name: 'Same', area_id: 'same-area' };
  hass.states['light.group'] = { state: 'on', attributes: { entity_id: ['sensor.battery'] } };
  hass.devices = {
    own: { name: 'Same', area_id: 'same-area', via_device_id: 'other' },
    other: { name: 'Same', area_id: 'same-area' },
  };
  for (const device of [marker(), marker('entity', 'light.group'), marker('virtual', '')]) {
    device.controls = ['sensor.battery'];
    device.marker = { binding: `${device.bindingKind}:${device.bindingRef}`, controls: ['sensor.battery'] };
    assert.equal(resolved(hass, device), null);
  }
});

test('AC3 numeric-first and entity-ID order do not depend on registry order or minimum value', () => {
  const entries = [
    ['sensor.z_battery', registryRow()], ['binary_sensor.a_battery', registryRow()],
    ['sensor.a_battery', registryRow()],
  ];
  const hass = { devices: { own: {} }, entities: {}, states: {
    'sensor.z_battery': row('0'), 'binary_sensor.a_battery': row('on'), 'sensor.a_battery': row('100'),
  } };
  for (const order of [entries, [...entries].reverse(), [entries[1], entries[2], entries[0]]]) {
    hass.entities = Object.fromEntries(order);
    expectState(hass, 'normal', 'sensor.a_battery');
  }
  hass.entities = { 'binary_sensor.a_battery': hass.entities['binary_sensor.a_battery'] };
  expectState(hass, 'low', 'binary_sensor.a_battery');
});

test('AC3 missing, unavailable and disabled first source never fall through to a live second source', () => {
  for (const condition of ['missing', 'unavailable', 'disabled']) {
    const hass = one('100', 'sensor.second');
    hass.entities['sensor.first'] = registryRow();
    if (condition !== 'missing') hass.states['sensor.first'] = row(condition === 'disabled' ? '100' : 'unavailable');
    if (condition === 'disabled') hass.entities['sensor.first'].disabled_by = 'user';
    const active = activeRegistryHass(hass, { entities: hass.entities, devices: hass.devices, authoritative: true });
    const context = createDeviceBatteryContext(active, hass);
    assert.deepEqual(resolveDeviceBattery(marker(), context), { state: 'unknown', sourceEntityId: 'sensor.first' });
    assert.ok(deviceBatteryEntityIds(marker(), context).includes('sensor.first'));
  }
});

test('disabled parent or entity cannot revive a stale state even if an unfiltered caller supplies it', () => {
  for (const disabled of ['entity', 'parent']) {
    const hass = one('100');
    if (disabled === 'entity') hass.entities['sensor.battery'].disabled_by = 'integration';
    else hass.devices.own.disabled_by = 'user';
    expectState(hass, 'unknown');
  }
  const full = one('100');
  assert.deepEqual(resolveDeviceBattery(marker(), createDeviceBatteryContext({ states: {} }, full)), {
    state: 'unknown', sourceEntityId: 'sensor.battery',
  }, 'raw full-registry states are not used as live values');
});

test('AC3 deletion and re-addition replace the identity index and reselect metadata, not retained values', () => {
  const hass = one('100', 'sensor.second');
  hass.entities['sensor.first'] = registryRow();
  hass.states['sensor.first'] = row('10');
  expectState(hass, 'low', 'sensor.first');
  const removed = { ...hass, entities: { 'sensor.second': hass.entities['sensor.second'] } };
  expectState(removed, 'normal', 'sensor.second');
  const restored = { ...removed, entities: { ...removed.entities, 'sensor.first': registryRow() },
    states: { 'sensor.second': hass.states['sensor.second'] } };
  expectState(restored, 'unknown', 'sensor.first');
});

test('virtual, removed, disabled, orphaned and unverified bindings have no live battery projection', () => {
  const hass = one('10');
  const context = createDeviceBatteryContext(hass);
  const invalid = [
    { ...marker(), virtual: true }, { ...marker(), bindingKind: 'virtual' },
    { ...marker(), marker: { binding: 'virtual' } },
    { ...marker(), marker: { binding: 'device:own', removed: true } },
    ...['ha_disabled', 'orphaned', 'unverified'].map((kind) => ({ ...marker(), bindingStatus: { kind } })),
    { entities: ['sensor.battery'] },
  ];
  for (const device of invalid) {
    assert.equal(resolveDeviceBattery(device, context), null);
    assert.deepEqual(deviceBatteryEntityIds(device, context), []);
  }
  expectState(hass, 'low', 'sensor.battery', { marker: { binding: 'device:own' } });
});

test('AC4 ownership is indexed once per registry identity, not per marker or state tick', () => {
  const hass = one('10');
  let scans = 0;
  const entities = new Proxy(hass.entities, { ownKeys: (target) => { scans++; return Reflect.ownKeys(target); } });
  const registry = { ...hass, entities };
  const first = createDeviceBatteryContext(hass, registry);
  for (let index = 0; index < 200; index++) {
    const active = { ...hass, states: { 'sensor.battery': row(index % 2 ? '100' : '10') } };
    const context = createDeviceBatteryContext(active, registry);
    assert.equal(context.entityIdsByDevice, first.entityIdsByDevice);
    assert.equal(resolveDeviceBattery(marker(), context).state, index % 2 ? 'normal' : 'low');
    assert.deepEqual(deviceBatteryEntityIds(marker(), context), ['sensor.battery']);
  }
  assert.equal(scans, 1);
  const changed = createDeviceBatteryContext(hass, { ...registry, entities: { ...hass.entities } });
  assert.notEqual(changed.entityIdsByDevice, first.entityIdsByDevice);
});

test('AC4 sibling-before-bound dependencies update battery-only ticks and preserve immutable frames', () => {
  const before = one('100');
  before.entities['binary_sensor.bound'] = registryRow('own', 'door');
  before.states['binary_sensor.bound'] = row('off', 'door');
  before.entities['sensor.other'] = registryRow('other', 'temperature');
  before.states['sensor.other'] = row('21', 'temperature');
  before.devices.other = {};
  const device = { ...marker('entity', 'binary_sensor.bound'), entities: ['binary_sensor.bound'] };
  const context = createDeviceBatteryContext(before);
  const dependencies = deviceBatteryEntityIds(device, context);
  assert.deepEqual(dependencies, ['binary_sensor.bound', 'sensor.battery']);
  const snapshot = createRenderDeviceSnapshot({ sourceSequence: 1, hass: before, devices: [device],
    entityIds: dependencies, presentations: new Map([['marker:1', { battery: resolveDeviceBattery(device, context) }]]) });
  const after = { ...before, states: { ...before.states, 'sensor.battery': row('10') } };
  assert.equal(classifyHassRenderChange(before, after, snapshot), 'state');
  assert.equal(resolveDeviceBattery(device, createDeviceBatteryContext(after)).state, 'low');
  assert.equal(snapshot.presentations.get('marker:1').battery.state, 'normal');
  assert.equal(snapshot.hass.states['sensor.battery'].state, '100');
  assert.throws(() => { snapshot.presentations.get('marker:1').battery.state = 'low'; }, TypeError);
  const unrelated = { ...before, states: { ...before.states, 'sensor.other': row('23', 'temperature') } };
  assert.equal(classifyHassRenderChange(before, unrelated, snapshot), 'none');
});

test('AC4 metadata-class appearance and missing-row recovery are dependencies before selection', () => {
  const before = one('100');
  before.entities['sensor.battery'] = registryRow('own', 'temperature');
  before.states['sensor.battery'] = row('100', 'temperature');
  before.entities['event.bound'] = { device_id: 'own' };
  const device = marker('entity', 'event.bound');
  const context = createDeviceBatteryContext(before);
  assert.equal(resolveDeviceBattery(device, context), null);
  const dependencies = { entityIds: deviceBatteryEntityIds(device, context) };
  assert.deepEqual(dependencies.entityIds, ['sensor.battery']);
  const classified = { ...before, states: { ...before.states, 'sensor.battery': row('100') } };
  assert.equal(classifyHassRenderChange(before, classified, dependencies), 'state');
  assert.equal(resolveDeviceBattery(device, createDeviceBatteryContext(classified)).state, 'normal');
  const absent = { ...classified, states: {} };
  assert.equal(classifyHassRenderChange(absent, classified, dependencies), 'state');
  assert.deepEqual(deviceBatteryEntityIds(marker('entity', 'sensor.unregistered'), context), ['sensor.unregistered']);
});

test('contexts and results do not mutate inputs, retain old values or expose a numeric percentage', () => {
  const hass = one('100');
  const original = structuredClone(hass);
  const first = createDeviceBatteryContext(hass);
  const result = resolveDeviceBattery(marker(), first);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(deviceBatteryEntityIds(marker(), first)));
  assert.deepEqual(hass, original);
  const next = { ...hass, states: { 'sensor.battery': row('unknown') } };
  assert.equal(resolveDeviceBattery(marker(), createDeviceBatteryContext(next)).state, 'unknown');
  assert.equal(resolveDeviceBattery(marker(), first).state, 'normal');
  assert.equal(resolveDeviceBattery(marker(), createDeviceBatteryContext(null)), null);
});
