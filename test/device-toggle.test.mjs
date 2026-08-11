import test from 'node:test';
import assert from 'node:assert/strict';
import {
  projectedTapAction,
  resolveToggleIntent,
  sameToggleCommandTargets,
  toggleCommandEntityIds,
  toggleCoverEntity,
  toggleOriginOf,
} from '../test-build/device-toggle.js';

const services = {
  homeassistant: { turn_on: {}, turn_off: {}, toggle: {} },
  light: { turn_on: {}, turn_off: {}, toggle: {} },
  switch: { turn_on: {}, turn_off: {}, toggle: {} },
  fan: { turn_on: {}, turn_off: {}, toggle: {} },
  cover: { open_cover: {}, close_cover: {}, stop_cover: {}, toggle: {} },
  valve: { open_valve: {}, close_valve: {}, stop_valve: {}, toggle: {} },
  vacuum: { turn_on: {}, turn_off: {}, toggle: {} },
};

function state(entityId, value, attributes = {}) {
  return { entity_id: entityId, state: value, attributes };
}

function hass(states = {}, registry = {}, customServices = services) {
  const entities = { ...registry };
  for (const entityId of Object.keys(states)) {
    entities[entityId] ||= { entity_id: entityId, platform: 'test', disabled_by: null };
  }
  return { states, entities, devices: {}, services: customServices };
}

function device(overrides = {}) {
  return {
    id: 'marker', name: 'Marker', model: '', area: 'room', space: 'floor', icon: 'mdi:chip',
    entities: [], bindingKind: 'virtual', bindingRef: null, tapAction: 'toggle',
    marker: { id: 'marker', binding: 'virtual', controls: [] },
    ...overrides,
  };
}

test('action projection is universal while persisted legacy/default origins stay distinguishable', () => {
  assert.equal(projectedTapAction('cover', 'cover'), 'toggle');
  assert.equal(projectedTapAction(undefined, 'light'), 'toggle');
  assert.equal(projectedTapAction(undefined, 'switch'), 'info');
  assert.equal(toggleOriginOf(device({ tapAction: 'toggle' })), 'explicit-toggle');
  assert.equal(toggleOriginOf(device({ tapAction: 'cover' })), 'legacy-cover');
  assert.equal(toggleOriginOf(device({ tapAction: null, primary: 'light.lamp' })), 'default-light');
});

test('virtual marker without controls is a saved, quiet no-op', () => {
  const d = device();
  const intent = resolveToggleIntent({ hass: hass(), devices: [d], device: d });
  assert.equal(intent.kind, 'none');
  assert.equal(intent.noneReason, 'no-actionable-entity');
  assert.equal(intent.command, null);
});

test('exact entity binding never retargets to a controllable sibling', () => {
  const h = hass({
    'sensor.room': state('sensor.room', '21'),
    'switch.room': state('switch.room', 'off'),
  }, {
    'sensor.room': { entity_id: 'sensor.room', device_id: 'dev' },
    'switch.room': { entity_id: 'switch.room', device_id: 'dev' },
  });
  const d = device({
    bindingKind: 'entity', bindingRef: 'sensor.room', primary: 'sensor.room',
    entities: ['sensor.room', 'switch.room'], marker: { id: 'marker', binding: 'entity:sensor.room' },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.command, null);
  assert.equal(intent.noneReason, 'unsupported');
  assert.equal(intent.skippedTargets[0].entityId, 'sensor.room');
});

test('default light ignores external controls until toggle is explicitly selected', () => {
  const h = hass({
    'light.room': state('light.room', 'off'),
    'switch.other': state('switch.other', 'on'),
  });
  const d = device({
    tapAction: null, bindingKind: 'device', bindingRef: 'dev', primary: 'light.room',
    entities: ['light.room'], controls: ['switch.other'],
    marker: { id: 'marker', binding: 'device:dev', controls: ['switch.other'] },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.origin, 'default-light');
  assert.deepEqual(toggleCommandEntityIds(intent.command), ['light.room']);
  assert.equal(intent.command.service, 'turn_on');
});

test('explicit controls execute only the available subset and report skipped targets', () => {
  const h = hass({
    'light.a': state('light.a', 'off'),
    'switch.b': state('switch.b', 'unavailable'),
  });
  const d = device({
    controls: ['light.a', 'switch.b', 'switch.missing'],
    marker: { id: 'marker', binding: 'virtual', controls: ['light.a', 'switch.b', 'switch.missing'] },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.kind, 'group');
  assert.deepEqual(toggleCommandEntityIds(intent.command), ['light.a']);
  assert.deepEqual(intent.skippedTargets.map((item) => item.reason), ['unavailable', 'missing']);
});

test('a group turns everything off when any available target is on', () => {
  const h = hass({
    'light.a': state('light.a', 'off'),
    'switch.b': state('switch.b', 'on'),
  });
  const d = device({
    controls: ['light.a', 'switch.b'],
    marker: { id: 'marker', binding: 'virtual', controls: ['light.a', 'switch.b'] },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.command.service, 'turn_off');
  assert.equal(intent.nextEffect, 'turn-off');
  assert.deepEqual(toggleCommandEntityIds(intent.command), ['light.a', 'switch.b']);
});

test('configured controls never fall back to the marker own relay', () => {
  const h = hass({ 'switch.own': state('switch.own', 'off') });
  const d = device({
    bindingKind: 'device', bindingRef: 'dev', primary: 'switch.own', entities: ['switch.own'],
    controls: [], marker: { id: 'marker', binding: 'device:dev', controls: ['light.missing'] },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.kind, 'group');
  assert.equal(intent.noneReason, 'configured-targets-missing');
  assert.equal(intent.command, null);
});

test('passive forced-light marker is driven by the controller own relay and de-duplicated', () => {
  const h = hass({ 'switch.wall': state('switch.wall', 'off') });
  const lamp = device({
    id: 'lamp', name: 'Dumb lamp', tapAction: null, primary: undefined, entities: [],
    marker: { id: 'lamp', binding: 'virtual', is_light: true, controls: [] },
  });
  const controller = device({
    id: 'wall', bindingKind: 'device', bindingRef: 'wall', primary: 'switch.wall',
    entities: ['switch.wall'], controls: ['marker:lamp', 'marker:lamp'],
    marker: { id: 'wall', binding: 'device:wall', controls: ['marker:lamp', 'marker:lamp'] },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [controller, lamp], device: controller });
  assert.deepEqual(toggleCommandEntityIds(intent.command), ['switch.wall']);
  assert.equal(intent.targets[0].via, 'control-marker-driver');
});

test('legacy cover keeps cover priority, ignores controls and uses open/close/stop semantics', () => {
  const h = hass({
    'light.mixed': state('light.mixed', 'on'),
    'cover.curtain': state('cover.curtain', 'opening', { device_class: 'curtain', supported_features: 11 }),
    'switch.other': state('switch.other', 'on'),
  });
  const d = device({
    tapAction: 'cover', bindingKind: 'device', bindingRef: 'dev', primary: 'light.mixed',
    entities: ['light.mixed', 'cover.curtain'], controls: ['switch.other'],
    marker: { id: 'marker', binding: 'device:dev', controls: ['switch.other'] },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.command.service, 'stop_cover');
  assert.deepEqual(toggleCommandEntityIds(intent.command), ['cover.curtain']);
  assert.equal(toggleCoverEntity(intent), 'cover.curtain');
});

test('cover and valve adapters resolve open, close, stop and unknown fallback', () => {
  const matrix = [
    ['cover.blind', 'closed', 1, 'open_cover', 'open'],
    ['cover.blind', 'open', 2, 'close_cover', 'close'],
    ['cover.blind', 'closing', 8, 'stop_cover', 'stop'],
    ['cover.blind', 'unknown', 0, 'toggle', 'toggle'],
    ['valve.water', 'closed', 1, 'open_valve', 'open'],
    ['valve.water', 'open', 2, 'close_valve', 'close'],
    ['valve.water', 'opening', 8, 'stop_valve', 'stop'],
    ['valve.water', 'unknown', 0, 'toggle', 'toggle'],
  ];
  for (const [entityId, value, features, service, effect] of matrix) {
    const h = hass({
      [entityId]: state(entityId, value, { supported_features: features }),
    });
    const d = device({
      bindingKind: 'entity', bindingRef: entityId, primary: entityId, entities: [entityId],
      marker: { id: 'marker', binding: `entity:${entityId}` },
    });
    const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
    assert.equal(intent.command.service, service, `${entityId} ${value}`);
    assert.equal(intent.nextEffect, effect, `${entityId} ${value}`);
  }
});

test('moving cover without stop capability falls back to its toggle service', () => {
  const entityId = 'cover.blind';
  const h = hass({ [entityId]: state(entityId, 'opening', { supported_features: 3 }) });
  const d = device({
    bindingKind: 'entity', bindingRef: entityId, primary: entityId, entities: [entityId],
    marker: { id: 'marker', binding: `entity:${entityId}` },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.command.service, 'toggle');
  assert.equal(intent.nextEffect, 'toggle');
});

test('locks, alarms and guarded covers are secure no-ops even without a live state', () => {
  for (const entityId of ['lock.front', 'alarm_control_panel.home', 'cover.garage']) {
    const registry = { [entityId]: {
      entity_id: entityId, platform: 'test', device_class: entityId === 'cover.garage' ? 'garage' : undefined,
    } };
    const h = hass({}, registry);
    const d = device({
      bindingKind: 'entity', bindingRef: entityId, primary: entityId, entities: [entityId],
      marker: { id: 'marker', binding: `entity:${entityId}` },
    });
    const intent = resolveToggleIntent({ hass: h, registryHass: h, devices: [d], device: d });
    assert.equal(intent.noneReason, 'secure');
    assert.equal(intent.command, null);
  }
});

test('HA-disabled and unavailable targets never produce service calls', () => {
  const entityId = 'switch.disabled';
  const h = hass({ [entityId]: state(entityId, 'off') }, {
    [entityId]: { entity_id: entityId, platform: 'test', disabled_by: 'user' },
  });
  const d = device({
    bindingKind: 'entity', bindingRef: entityId, primary: entityId, entities: [entityId],
    marker: { id: 'marker', binding: `entity:${entityId}` },
  });
  const intent = resolveToggleIntent({ hass: h, registryHass: h, devices: [d], device: d });
  assert.equal(intent.noneReason, 'ha-disabled');
  assert.equal(intent.command, null);
});

test('a disabled marker control is reported as disabled, not as an anonymous missing ref', () => {
  const controller = device({
    controls: ['marker:disabled'],
    marker: { id: 'marker', binding: 'virtual', controls: ['marker:disabled'] },
  });
  const disabled = device({
    id: 'disabled', name: 'Disabled lamp', hidden: true,
    bindingStatus: {
      kind: 'ha_disabled', reason: 'entity', enabledEntityIds: [],
      allEntityIds: ['light.disabled'],
    },
    marker: { id: 'disabled', binding: 'entity:light.disabled', is_light: true, controls: [] },
  });
  const intent = resolveToggleIntent({
    hass: hass(), devices: [controller, disabled], device: controller,
  });
  assert.equal(intent.command, null);
  assert.equal(intent.skippedTargets[0].reason, 'ha-disabled');
  assert.equal(intent.skippedTargets[0].entityId, 'light.disabled');
  assert.equal(intent.skippedTargets[0].name, 'Disabled lamp');
});

test('an unavailable exact binding remains the same unavailable target', () => {
  const entityId = 'switch.plug';
  const h = hass({ [entityId]: state(entityId, 'unavailable') });
  const d = device({
    bindingKind: 'entity', bindingRef: entityId, primary: entityId, entities: [entityId],
    marker: { id: 'marker', binding: `entity:${entityId}` },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.noneReason, 'unavailable');
  assert.equal(intent.skippedTargets[0].entityId, entityId);
  assert.equal(intent.command, null);
});

test('missing services make an otherwise supported entity an explicit no-op', () => {
  const entityId = 'switch.plug';
  const h = hass({ [entityId]: state(entityId, 'off') }, {}, { light: { turn_on: {} } });
  const d = device({
    bindingKind: 'entity', bindingRef: entityId, primary: entityId, entities: [entityId],
    marker: { id: 'marker', binding: `entity:${entityId}` },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.noneReason, 'unsupported');
  assert.equal(intent.command, null);
});

test('confirmation target comparison ignores order but detects target-set changes', () => {
  const a = { domain: 'homeassistant', service: 'turn_on', data: { entity_id: ['switch.b', 'light.a'] } };
  const b = { domain: 'homeassistant', service: 'turn_off', data: { entity_id: ['light.a', 'switch.b'] } };
  const c = { domain: 'homeassistant', service: 'turn_on', data: { entity_id: ['light.a'] } };
  assert.equal(sameToggleCommandTargets(a, b), true);
  assert.equal(sameToggleCommandTargets(a, c), false);
});
