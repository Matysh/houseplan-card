import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acquireHaRegistries,
  activeRegistryHass,
  cacheHaBindingStatuses,
  haRegistrySnapshot,
  resolveHaBindingStatus,
} from '../test-build/ha-binding-status.js';

const full = (devices, entities) => ({
  revision: 1,
  authoritative: true,
  access: 'full',
  devices,
  entities,
  lastSuccess: 1,
});

const limited = (devices, entities) => ({
  revision: 1,
  authoritative: false,
  access: 'limited',
  devices,
  entities,
  lastSuccess: 0,
});

test('full registry distinguishes active, disabled and orphaned bindings', () => {
  const devices = {
    active: { id: 'active', disabled_by: null },
    disabled: { id: 'disabled', disabled_by: 'user' },
    empty: { id: 'empty', disabled_by: null },
  };
  const entities = {
    'switch.active': { entity_id: 'switch.active', device_id: 'active', disabled_by: null },
    'switch.disabled_parent': { entity_id: 'switch.disabled_parent', device_id: 'disabled', disabled_by: null },
    'sensor.disabled': { entity_id: 'sensor.disabled', device_id: 'empty', disabled_by: 'integration' },
  };
  const hass = { devices, entities, states: { 'switch.active': { state: 'on' } } };
  const snapshot = full(devices, entities);

  assert.equal(resolveHaBindingStatus(hass, 'device:active', snapshot).kind, 'active');
  assert.deepEqual(resolveHaBindingStatus(hass, 'device:disabled', snapshot), {
    kind: 'ha_disabled', reason: 'device', enabledEntityIds: [], allEntityIds: ['switch.disabled_parent'],
  });
  assert.equal(resolveHaBindingStatus(hass, 'device:empty', snapshot).kind, 'ha_disabled');
  assert.equal(resolveHaBindingStatus(hass, 'entity:sensor.disabled', snapshot).kind, 'ha_disabled');
  assert.equal(resolveHaBindingStatus(hass, 'device:missing', snapshot).kind, 'orphaned');
  assert.equal(resolveHaBindingStatus(hass, 'entity:sensor.missing', snapshot).kind, 'orphaned');
});

test('limited registry never guesses missing rows are disabled or orphaned', () => {
  const hass = {
    devices: {},
    entities: {},
    states: { 'switch.live_only': { state: 'off' } },
  };
  const snapshot = limited({}, {});
  assert.equal(resolveHaBindingStatus(hass, 'entity:switch.live_only', snapshot).kind, 'active');
  assert.equal(resolveHaBindingStatus(hass, 'entity:switch.unknown', snapshot).kind, 'unverified');
  assert.equal(resolveHaBindingStatus(hass, 'device:unknown', snapshot).kind, 'unverified');
});

test('authoritative registry accepts an exact live YAML entity without a registry row', () => {
  const live = { states: { 'camera.xcme': { entity_id: 'camera.xcme', state: 'idle' } } };
  assert.deepEqual(resolveHaBindingStatus(live, 'entity:camera.xcme', full({}, {})), {
    kind: 'active', enabledEntityIds: ['camera.xcme'], allEntityIds: ['camera.xcme'],
  });
  assert.equal(
    resolveHaBindingStatus({ states: {} }, 'entity:camera.xcme', full({}, {})).kind,
    'orphaned',
  );
  const disabled = {
    'camera.xcme': { entity_id: 'camera.xcme', disabled_by: 'user' },
  };
  assert.equal(
    resolveHaBindingStatus(live, 'entity:camera.xcme', full({}, disabled)).kind,
    'ha_disabled',
  );
});

test('active projection removes stale states of disabled rows', () => {
  const devices = {
    d1: { id: 'd1', disabled_by: null },
    d2: { id: 'd2', disabled_by: 'user' },
  };
  const entities = {
    'switch.good': { entity_id: 'switch.good', device_id: 'd1', disabled_by: null },
    'switch.disabled': { entity_id: 'switch.disabled', device_id: 'd1', disabled_by: 'user' },
    'switch.parent_disabled': { entity_id: 'switch.parent_disabled', device_id: 'd2', disabled_by: null },
  };
  const states = Object.fromEntries(Object.keys(entities).map((eid) => [eid, { entity_id: eid, state: 'on' }]));
  const projected = activeRegistryHass({ devices, entities, states }, full(devices, entities));

  assert.deepEqual(Object.keys(projected.entities), ['switch.good']);
  assert.deepEqual(Object.keys(projected.states), ['switch.good']);
});

test('authoritative active projection keeps live states without registry rows', () => {
  const state = {
    entity_id: 'sun.sun', state: 'above_horizon',
    attributes: { azimuth: 180, elevation: 35 },
  };
  const projected = activeRegistryHass(
    { devices: {}, entities: {}, states: { 'sun.sun': state } },
    full({}, {}),
  );

  assert.equal(projected.states['sun.sun'], state);
  assert.equal(projected.entities['sun.sun'], undefined);
});

test('limited active projection keeps a live entity when its parent row is unavailable', () => {
  const entities = {
    'switch.live': { entity_id: 'switch.live', device_id: 'not_exposed', disabled_by: null },
  };
  const states = { 'switch.live': { entity_id: 'switch.live', state: 'on' } };
  const projected = activeRegistryHass({ devices: {}, entities, states }, limited({}, entities));
  assert.ok(projected.entities['switch.live']);
  assert.ok(projected.states['switch.live']);
});

test('live rows augment a stale full snapshot and remain immediately discoverable', async () => {
  const connection = { subscribeEvents: async () => () => undefined };
  const hass = {
    connection,
    devices: { old: { id: 'old', disabled_by: null } },
    entities: {},
    states: {},
    callWS: async ({ type }) => type.includes('device_registry')
      ? [{ id: 'old', disabled_by: null }] : [],
  };
  let ready;
  const loaded = new Promise((resolve) => { ready = resolve; });
  const release = acquireHaRegistries(hass, ready);
  await loaded;

  hass.devices = { ...hass.devices, fresh: { id: 'fresh', disabled_by: null } };
  hass.entities = {
    'switch.fresh': { entity_id: 'switch.fresh', device_id: 'fresh', disabled_by: null },
  };
  hass.states = { 'switch.fresh': { entity_id: 'switch.fresh', state: 'off' } };
  const snapshot = haRegistrySnapshot(hass);
  assert.equal(snapshot.authoritative, true);
  assert.ok(snapshot.devices.fresh);
  assert.ok(snapshot.entities['switch.fresh']);
  assert.equal(resolveHaBindingStatus(hass, 'device:fresh', snapshot).kind, 'active');
  release();
});

test('limited live rows cannot override the last authoritative disabled result', () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => '{}',
    setItem: () => undefined,
  };
  cacheHaBindingStatuses(new Map([['device:cached-disabled', {
    kind: 'ha_disabled', reason: 'all_entities', enabledEntityIds: [], allEntityIds: ['switch.cached'],
  }]]));
  const devices = { 'cached-disabled': { id: 'cached-disabled', disabled_by: null } };
  const entities = {
    'switch.cached': { entity_id: 'switch.cached', device_id: 'cached-disabled', disabled_by: null },
  };
  const hass = { devices, entities, states: { 'switch.cached': { state: 'on' } } };
  assert.deepEqual(resolveHaBindingStatus(hass, 'device:cached-disabled', limited(devices, entities)), {
    kind: 'ha_disabled', reason: 'all_entities', enabledEntityIds: [], allEntityIds: ['switch.cached'],
  });
  globalThis.localStorage = previousStorage;
});

test('entity with a missing parent reports device_missing', () => {
  const entities = {
    'sensor.orphan': { entity_id: 'sensor.orphan', device_id: 'gone', disabled_by: null },
  };
  assert.equal(
    resolveHaBindingStatus({ devices: {}, entities, states: {} }, 'entity:sensor.orphan', full({}, entities)).reason,
    'device_missing',
  );
});
