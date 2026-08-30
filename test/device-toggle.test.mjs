import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatToggleConfirmation,
  projectedTapAction,
  resolveToggleIntent,
  sameToggleCommandTargets,
  sameToggleOperationTargets,
  toggleOperation,
  toggleCommandEntityIds,
  toggleCoverEntity,
  toggleOriginOf,
  unavailableToggleTargetNames,
} from '../test-build/device-toggle.js';

const confirmationFormatter = {
  state: (target) => `state:${target.state}`,
  current: (value) => `current:${value}`,
  expected: (value) => `expected:${value}`,
  groupCurrent: (on, total) => `group:${on}/${total}`,
  groupAllOn: () => 'all-on',
  groupAllOff: () => 'all-off',
  unavailable: (count) => `unavailable:${count}`,
  effect: (effect) => `effect:${effect}`,
  expectedByHa: () => 'by-ha',
};

const confirmationIntent = (overrides = {}) => ({
  origin: 'explicit-toggle',
  kind: 'single',
  semantics: 'power',
  targets: [{ entityId: 'switch.sample', name: 'Sample', state: 'off', via: 'binding' }],
  skippedTargets: [],
  noneReason: null,
  nextEffect: 'turn-on',
  command: { domain: 'switch', service: 'turn_on', data: { entity_id: 'switch.sample' } },
  ...overrides,
});

const services = {
  homeassistant: { turn_on: {}, turn_off: {}, toggle: {} },
  light: { turn_on: {}, turn_off: {}, toggle: {} },
  switch: { turn_on: {}, turn_off: {}, toggle: {} },
  fan: { turn_on: {}, turn_off: {}, toggle: {} },
  humidifier: { turn_on: {}, turn_off: {}, toggle: {} },
  input_boolean: { turn_on: {}, turn_off: {}, toggle: {} },
  automation: { turn_on: {}, turn_off: {}, toggle: {} },
  remote: { turn_on: {}, turn_off: {}, toggle: {} },
  climate: { turn_on: {}, turn_off: {}, toggle: {} },
  media_player: { turn_on: {}, turn_off: {}, toggle: {} },
  siren: { turn_on: {}, turn_off: {}, toggle: {} },
  water_heater: { turn_on: {}, turn_off: {}, toggle: {} },
  camera: { turn_on: {}, turn_off: {} },
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
  assert.equal(projectedTapAction('', 'light'), 'toggle');
  assert.equal(projectedTapAction(undefined, 'switch'), 'info');
  assert.equal(projectedTapAction('future-action', 'light'), 'info');
  assert.equal(projectedTapAction('none', 'light'), 'none');
  assert.equal(projectedTapAction('none', 'switch'), 'none');
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

test('issue 107: exact manual virtual light wins over saved HA controls', () => {
  const d = device({
    marker: {
      id: 'marker', binding: 'virtual', is_light: true, tap_action: 'toggle',
      controls: ['light.saved'],
    },
    controls: ['light.saved'],
  });
  const h = hass({ 'light.saved': state('light.saved', 'on') });
  const on = resolveToggleIntent({
    hass: h, devices: [d], device: d,
    virtualLights: { rev: 4, configRev: 9, off: new Set() },
  });
  assert.equal(on.command, null, 'manual mode must not call the saved HA target');
  assert.deepEqual(toggleOperation(on), { kind: 'virtual-light', markerId: 'marker' });
  assert.equal(on.targets[0].via, 'virtual-light');
  assert.equal(on.targets[0].state, 'on');
  assert.equal(on.nextEffect, 'turn-off');

  const off = resolveToggleIntent({
    hass: h, devices: [d], device: d,
    virtualLights: { rev: 5, configRev: 9, off: new Set(['marker']) },
  });
  assert.equal(off.targets[0].state, 'off');
  assert.equal(off.nextEffect, 'turn-on');
  assert.equal(sameToggleOperationTargets(on, off), true, 'direction may change, target may not');

  const resumed = resolveToggleIntent({
    hass: h,
    devices: [{ ...d, marker: { ...d.marker, is_light: false } }],
    device: { ...d, marker: { ...d.marker, is_light: false } },
  });
  assert.equal(toggleOperation(resumed).kind, 'ha-service', 'saved controls resume outside the triple');
});

test('issue 174: linked manual lamp redirects its toggle to the real controller driver', () => {
  const lamp = device({
    id: 'lamp', name: 'Dumb lamp',
    marker: { id: 'lamp', binding: 'virtual', is_light: true, tap_action: 'toggle', controls: [] },
  });
  const controller = device({
    id: 'wall', name: 'Wall relay', bindingKind: 'entity', bindingRef: 'switch.wall',
    primary: 'switch.wall', entities: ['switch.wall'],
    marker: {
      id: 'wall', binding: 'entity:switch.wall', tap_action: 'toggle', controls: ['marker:lamp'],
    },
    controls: [],
  });
  const devices = [controller, lamp];
  const h = hass({ 'switch.wall': state('switch.wall', 'on') });
  const manualOff = { rev: 5, configRev: 9, off: new Set(['lamp']) };

  const on = resolveToggleIntent({ hass: h, devices, device: lamp, virtualLights: manualOff });
  assert.equal(toggleOperation(on).kind, 'ha-service');
  assert.deepEqual(toggleCommandEntityIds(on.command), ['switch.wall']);
  assert.equal(on.command.service, 'turn_off');
  assert.equal(on.targets[0].via, 'control-marker-driver');

  h.states['switch.wall'].state = 'off';
  const off = resolveToggleIntent({ hass: h, devices, device: lamp, virtualLights: manualOff });
  assert.equal(off.command.service, 'turn_on');
  assert.equal(sameToggleOperationTargets(on, off), true, 'direction changes but the relay does not');

  const unlinked = resolveToggleIntent({ hass: h, devices: [lamp], device: lamp, virtualLights: manualOff });
  assert.deepEqual(toggleOperation(unlinked), { kind: 'virtual-light', markerId: 'lamp' });
  assert.equal(unlinked.targets[0].state, 'off', 'unlink restores the stored manual state');
  assert.equal(sameToggleOperationTargets(on, unlinked), false, 'confirmation cannot cross modes');
});

test('issue 174: source unions all drivers while each controller toggles only its own group', () => {
  const lamp = device({
    id: 'lamp', name: 'Dumb lamp',
    marker: { id: 'lamp', binding: 'virtual', is_light: true, tap_action: 'toggle', controls: [] },
  });
  const relayA = device({
    id: 'relay-a', primary: 'switch.a', entities: ['switch.a'],
    bindingKind: 'entity', bindingRef: 'switch.a', controls: [],
    marker: {
      id: 'relay-a', binding: 'entity:switch.a', tap_action: 'toggle', controls: ['marker:lamp'],
    },
  });
  const relayB = device({
    id: 'relay-b', bindingKind: 'virtual', bindingRef: 'relay-b',
    controls: ['switch.b'],
    marker: {
      id: 'relay-b', binding: 'virtual', tap_action: 'toggle',
      controls: ['switch.b', 'marker:lamp'],
    },
  });
  const devices = [relayA, relayB, lamp];
  const h = hass({
    'switch.a': state('switch.a', 'on'),
    'switch.b': state('switch.b', 'off'),
  });

  const source = resolveToggleIntent({ hass: h, devices, device: lamp });
  assert.deepEqual(toggleCommandEntityIds(source.command), ['switch.a', 'switch.b']);
  assert.equal(source.command.service, 'turn_off', 'any-on applies to the union');

  const first = resolveToggleIntent({ hass: h, devices, device: relayA });
  assert.deepEqual(toggleCommandEntityIds(first.command), ['switch.a']);
  const second = resolveToggleIntent({ hass: h, devices, device: relayB });
  assert.deepEqual(toggleCommandEntityIds(second.command), ['switch.b']);
});

test('issue 174: linked source keeps partial availability and never falls back to manual state', () => {
  const lamp = device({
    id: 'lamp', name: 'Dumb lamp',
    marker: { id: 'lamp', binding: 'virtual', is_light: true, tap_action: 'toggle', controls: [] },
  });
  const partial = device({
    id: 'partial', bindingKind: 'virtual', bindingRef: 'partial',
    controls: ['switch.missing', 'switch.unavailable', 'switch.disabled', 'switch.ok'],
    marker: {
      id: 'partial', binding: 'virtual',
      controls: [
        'switch.missing', 'switch.unavailable', 'switch.disabled', 'switch.ok', 'marker:lamp',
      ],
    },
  });
  const h = hass({
    'switch.unavailable': state('switch.unavailable', 'unavailable'),
    'switch.disabled': state('switch.disabled', 'off'),
    'switch.ok': state('switch.ok', 'off'),
  }, {
    'switch.disabled': { entity_id: 'switch.disabled', platform: 'test', disabled_by: 'user' },
  });
  const manualOff = { rev: 3, configRev: 4, off: new Set(['lamp']) };
  const intent = resolveToggleIntent({ hass: h, devices: [partial, lamp], device: lamp, virtualLights: manualOff });
  assert.deepEqual(toggleCommandEntityIds(intent.command), ['switch.ok']);
  assert.equal(intent.command.service, 'turn_on');
  assert.deepEqual(intent.skippedTargets.map((target) => [target.entityId, target.reason]), [
    ['switch.missing', 'missing'],
    ['switch.unavailable', 'unavailable'],
    ['switch.disabled', 'ha-disabled'],
  ]);

  const dormant = device({
    id: 'dormant', bindingKind: 'virtual', bindingRef: 'dormant', controls: [],
    marker: { id: 'dormant', binding: 'virtual', controls: ['marker:lamp'] },
  });
  const none = resolveToggleIntent({
    hass: h, devices: [dormant, lamp], device: lamp, virtualLights: manualOff,
  });
  assert.equal(none.kind, 'group');
  assert.equal(none.command, null);
  assert.equal(none.noneReason, 'configured-targets-missing');
  assert.equal(toggleOperation(none), null, 'linked zero-driver state does not use virtual-light');
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

test('explicit light driver overrides an exact entity binding consistently', () => {
  const h = hass({
    'switch.relay': state('switch.relay', 'off'),
    'light.lamp': state('light.lamp', 'on'),
  });
  const d = device({
    bindingKind: 'entity', bindingRef: 'switch.relay', primary: 'switch.relay',
    entities: ['switch.relay', 'light.lamp'],
    marker: {
      id: 'marker', binding: 'entity:switch.relay', controls: [],
      is_light: true, light_entity: 'light.lamp',
    },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.deepEqual(toggleCommandEntityIds(intent.command), ['light.lamp']);
  assert.equal(intent.command?.service, 'turn_off');
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

test('issue 251 classifies only unavailable configured groups for the no-op toast', () => {
  const h = hass({
    'light.dead': state('light.dead', 'unavailable', { friendly_name: 'Dead lamp' }),
    'light.live': state('light.live', 'off', { friendly_name: 'Live lamp' }),
  }, {
    'light.dead': { entity_id: 'light.dead', platform: 'demo', name: 'Dead lamp' },
    'light.live': { entity_id: 'light.live', platform: 'demo', name: 'Live lamp' },
    'light.missing': { entity_id: 'light.missing', platform: 'demo', name: 'Missing lamp' },
  });
  const controls = (refs) => device({
    id: 'controller', name: 'Controller', controls: refs,
    marker: {
      id: 'controller', binding: 'virtual', tap_action: 'toggle', controls: refs,
    },
  });

  const oneDevice = controls(['light.dead']);
  const one = resolveToggleIntent({ hass: h, devices: [oneDevice], device: oneDevice });
  assert.deepEqual(unavailableToggleTargetNames(one), ['Dead lamp']);

  const groupDevice = controls(['light.missing', 'light.dead', 'light.dead']);
  const group = resolveToggleIntent({ hass: h, devices: [groupDevice], device: groupDevice });
  assert.deepEqual(unavailableToggleTargetNames(group), ['Missing lamp', 'Dead lamp']);

  const partialDevice = controls(['light.dead', 'light.live']);
  const partial = resolveToggleIntent({ hass: h, devices: [partialDevice], device: partialDevice });
  assert.ok(toggleOperation(partial));
  assert.deepEqual(unavailableToggleTargetNames(partial), []);

  const exact = device({
    bindingKind: 'entity', bindingRef: 'light.dead', primary: 'light.dead',
    entities: ['light.dead'], marker: { id: 'exact', binding: 'entity:light.dead' },
  });
  assert.deepEqual(unavailableToggleTargetNames(resolveToggleIntent({
    hass: h, devices: [exact], device: exact,
  })), [], 'an unavailable own binding is not an unavailable controls group');

  const mixedSecure = {
    ...group,
    skippedTargets: [
      ...group.skippedTargets,
      { ref: 'marker:secure', entityId: 'cover.gate', name: 'Gate', reason: 'secure' },
    ],
  };
  assert.deepEqual(unavailableToggleTargetNames(mixedSecure), ['Missing lamp', 'Dead lamp']);

  const mixedUnsupported = {
    ...group,
    skippedTargets: [
      ...group.skippedTargets,
      { ref: 'sensor.mode', entityId: 'sensor.mode', name: 'Mode', reason: 'unsupported' },
    ],
  };
  assert.deepEqual(unavailableToggleTargetNames(mixedUnsupported), []);
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

test('passive marker driver matches the light graph without explicit light flags', () => {
  const h = hass({
    'switch.wall': state('switch.wall', 'off'),
    'light.indicator': state('light.indicator', 'on'),
  });
  const lamp = device({
    id: 'lamp', name: 'Dumb lamp', tapAction: null, primary: undefined, entities: [],
    marker: { id: 'lamp', binding: 'virtual', is_light: true, controls: [] },
  });
  const controller = device({
    id: 'wall', bindingKind: 'device', bindingRef: 'wall', primary: 'switch.wall',
    entities: ['switch.wall', 'light.indicator'], controls: ['marker:lamp'],
    marker: { id: 'wall', binding: 'device:wall', controls: ['marker:lamp'] },
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

test('legacy cover keeps a disabled cover identity when active siblings remain', () => {
  const h = hass({
    'switch.reverse': state('switch.reverse', 'off'),
    'cover.curtain': state('cover.curtain', 'closed', {
      device_class: 'curtain', supported_features: 3,
    }),
  }, {
    'switch.reverse': { entity_id: 'switch.reverse', device_id: 'dev' },
    'cover.curtain': {
      entity_id: 'cover.curtain', device_id: 'dev', disabled_by: 'user', device_class: 'curtain',
    },
  });
  const d = device({
    tapAction: 'cover', bindingKind: 'device', bindingRef: 'dev', primary: 'switch.reverse',
    entities: ['switch.reverse'], allEntities: ['switch.reverse', 'cover.curtain'],
    marker: { id: 'marker', binding: 'device:dev' },
  });
  const intent = resolveToggleIntent({ hass: h, registryHass: h, devices: [d], device: d });
  assert.equal(intent.command, null);
  assert.equal(intent.noneReason, 'ha-disabled');
  assert.equal(intent.skippedTargets[0].entityId, 'cover.curtain');
  assert.equal(toggleCoverEntity(intent), 'cover.curtain');
});

test('legacy cover prefers an active cover over an earlier disabled peer', () => {
  const h = hass({
    'cover.active': state('cover.active', 'closed', { supported_features: 3 }),
  }, {
    'cover.disabled': { entity_id: 'cover.disabled', device_id: 'dev', disabled_by: 'user' },
    'cover.active': { entity_id: 'cover.active', device_id: 'dev', disabled_by: null },
  });
  const d = device({
    tapAction: 'cover', bindingKind: 'device', bindingRef: 'dev', primary: 'cover.active',
    entities: ['cover.active'], allEntities: ['cover.disabled', 'cover.active'],
    marker: { id: 'marker', binding: 'device:dev' },
  });
  const intent = resolveToggleIntent({ hass: h, registryHass: h, devices: [d], device: d });
  assert.deepEqual(toggleCommandEntityIds(intent.command), ['cover.active']);
  assert.equal(toggleCoverEntity(intent), 'cover.active');
});

test('cover and valve adapters resolve open, close, stop and unknown fallback', () => {
  const matrix = [
    ['cover.blind', 'closed', 1, 'open_cover', 'open'],
    ['cover.blind', 'open', 2, 'close_cover', 'close'],
    ['cover.blind', 'closing', 8, 'stop_cover', 'stop'],
    ['cover.blind', 'unknown', 3, 'toggle', 'toggle'],
    ['valve.water', 'closed', 1, 'open_valve', 'open'],
    ['valve.water', 'open', 2, 'close_valve', 'close'],
    ['valve.water', 'opening', 8, 'stop_valve', 'stop'],
    ['valve.water', 'unknown', 3, 'toggle', 'toggle'],
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

test('cover toggle fallback requires both open and close capabilities', () => {
  for (const supported_features of [0, 1, 2]) {
    const entityId = 'cover.one_way';
    const h = hass({
      [entityId]: state(entityId, 'unknown', { supported_features }),
    });
    const d = device({
      bindingKind: 'entity', bindingRef: entityId, primary: entityId, entities: [entityId],
      marker: { id: 'marker', binding: `entity:${entityId}` },
    });
    assert.equal(resolveToggleIntent({ hass: h, devices: [d], device: d }).command, null);
  }
});

test('explicit leading light entity drives the same entity used by the presentation', () => {
  const h = hass({
    'light.channel': state('light.channel', 'on'),
    'switch.power': state('switch.power', 'off'),
  });
  const d = device({
    bindingKind: 'device', bindingRef: 'dev', primary: 'light.channel',
    entities: ['light.channel', 'switch.power'],
    marker: {
      id: 'marker', binding: 'device:dev', is_light: true, light_entity: 'switch.power',
    },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.deepEqual(toggleCommandEntityIds(intent.command), ['switch.power']);
});

test('issue 178: an explicit toggle entity selects one exact composite-device channel', () => {
  const h = hass({
    'switch.power': state('switch.power', 'on'),
    'switch.child_lock': state('switch.child_lock', 'off'),
  });
  const base = device({
    bindingKind: 'device', bindingRef: 'washer', primary: 'switch.power',
    entities: ['switch.power', 'switch.child_lock'],
    marker: { id: 'marker', binding: 'device:washer', tap_action: 'toggle' },
  });
  const childLock = {
    ...base, marker: { ...base.marker, toggle_entity: 'switch.child_lock' },
  };
  assert.deepEqual(toggleCommandEntityIds(resolveToggleIntent({
    hass: h, devices: [childLock], device: childLock,
  }).command), ['switch.child_lock']);

  const power = { ...base, marker: { ...base.marker, toggle_entity: 'switch.power' } };
  assert.deepEqual(toggleCommandEntityIds(resolveToggleIntent({
    hass: h, devices: [power], device: power,
  }).command), ['switch.power']);
});

test('issue 178: stale selection falls back while an active missing target never retargets', () => {
  const h = hass({ 'switch.power': state('switch.power', 'off') });
  h.entities['switch.child_lock'] = {
    entity_id: 'switch.child_lock', platform: 'test', disabled_by: null,
  };
  const base = device({
    bindingKind: 'device', bindingRef: 'washer', primary: 'switch.power',
    entities: ['switch.power', 'switch.child_lock'],
    marker: { id: 'marker', binding: 'device:washer', tap_action: 'toggle' },
  });
  const activeMissing = {
    ...base, marker: { ...base.marker, toggle_entity: 'switch.child_lock' },
  };
  const exact = resolveToggleIntent({ hass: h, devices: [activeMissing], device: activeMissing });
  assert.equal(exact.command, null);
  assert.equal(exact.noneReason, 'unavailable');
  assert.equal(exact.skippedTargets[0].entityId, 'switch.child_lock');

  const stale = {
    ...base, marker: { ...base.marker, toggle_entity: 'switch.removed' },
  };
  const fallback = resolveToggleIntent({ hass: h, devices: [stale], device: stale });
  assert.deepEqual(toggleCommandEntityIds(fallback.command), ['switch.power']);
});

test('issue 178: an entity binding stays exact even with a sibling toggle selection', () => {
  const h = hass({
    'switch.bound': state('switch.bound', 'off'),
    'switch.sibling': state('switch.sibling', 'on'),
  });
  const d = device({
    bindingKind: 'entity', bindingRef: 'switch.bound', primary: 'switch.bound',
    entities: ['switch.bound', 'switch.sibling'],
    marker: {
      id: 'marker', binding: 'entity:switch.bound', tap_action: 'toggle',
      toggle_entity: 'switch.sibling',
    },
  });
  assert.deepEqual(toggleCommandEntityIds(resolveToggleIntent({
    hass: h, devices: [d], device: d,
  }).command), ['switch.bound']);
});

test('issue 178: explicit own selection joins controls without changing legacy groups', () => {
  const h = hass({
    'switch.power': state('switch.power', 'off'),
    'switch.child_lock': state('switch.child_lock', 'on'),
    'light.external': state('light.external', 'off'),
  });
  const base = device({
    bindingKind: 'device', bindingRef: 'washer', primary: 'switch.power',
    entities: ['switch.power', 'switch.child_lock'], controls: ['light.external'],
    marker: {
      id: 'marker', binding: 'device:washer', tap_action: 'toggle',
      controls: ['light.external'],
    },
  });
  const legacy = resolveToggleIntent({ hass: h, devices: [base], device: base });
  assert.deepEqual(toggleCommandEntityIds(legacy.command), ['light.external']);
  assert.equal(legacy.command.service, 'turn_on');

  const selected = {
    ...base, marker: { ...base.marker, toggle_entity: 'switch.child_lock' },
  };
  const group = resolveToggleIntent({ hass: h, devices: [selected], device: selected });
  assert.deepEqual(toggleCommandEntityIds(group.command), ['light.external', 'switch.child_lock']);
  assert.equal(group.command.service, 'turn_off');
});

test('issue 178: unavailable selected own group member is skipped without replacing it', () => {
  const h = hass({
    'switch.power': state('switch.power', 'on'),
    'switch.child_lock': state('switch.child_lock', 'unavailable'),
    'light.external': state('light.external', 'off'),
  });
  const d = device({
    bindingKind: 'device', bindingRef: 'washer', primary: 'switch.power',
    entities: ['switch.power', 'switch.child_lock'], controls: ['light.external'],
    marker: {
      id: 'marker', binding: 'device:washer', tap_action: 'toggle',
      toggle_entity: 'switch.child_lock', controls: ['light.external'],
    },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.deepEqual(toggleCommandEntityIds(intent.command), ['light.external']);
  assert.equal(intent.command.service, 'turn_on');
  assert.deepEqual(intent.skippedTargets.map((target) => [target.entityId, target.reason]), [
    ['switch.child_lock', 'unavailable'],
  ]);
});

test('group domain remains a universal power target', () => {
  const entityId = 'group.downstairs';
  const h = hass({ [entityId]: state(entityId, 'on') });
  const d = device({
    bindingKind: 'entity', bindingRef: entityId, primary: entityId, entities: [entityId],
    marker: { id: 'marker', binding: `entity:${entityId}` },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.command?.service, 'turn_off');
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

test('device-level disabled_by also blocks every entity of that device', () => {
  const entityId = 'switch.child';
  const h = hass({ [entityId]: state(entityId, 'on') }, {
    [entityId]: { entity_id: entityId, platform: 'test', device_id: 'dev-disabled', disabled_by: null },
  });
  h.devices['dev-disabled'] = { id: 'dev-disabled', disabled_by: 'user' };
  const d = device({
    bindingKind: 'device', bindingRef: 'dev-disabled', primary: entityId, entities: [entityId],
    marker: { id: 'marker', binding: 'device:dev-disabled' },
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

test('an absent service catalog is not optimistic proof of a service', () => {
  const entityId = 'switch.plug';
  const h = hass({ [entityId]: state(entityId, 'off') }, {}, {});
  const d = device({
    bindingKind: 'entity', bindingRef: entityId, primary: entityId, entities: [entityId],
    marker: { id: 'marker', binding: `entity:${entityId}` },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.noneReason, 'unsupported');
  assert.equal(intent.command, null);
});

test('basic power adapters expose the same off/on state contract', () => {
  for (const domain of [
    'light', 'switch', 'fan', 'humidifier', 'input_boolean', 'automation', 'remote',
  ]) {
    const entityId = `${domain}.sample`;
    const d = device({
      bindingKind: 'entity', bindingRef: entityId, primary: entityId, entities: [entityId],
      marker: { id: 'marker', binding: `entity:${entityId}` },
    });
    const off = resolveToggleIntent({
      hass: hass({ [entityId]: state(entityId, 'off') }), devices: [d], device: d,
    });
    assert.equal(off.command?.service, 'turn_on', `${domain} off`);
    const on = resolveToggleIntent({
      hass: hass({ [entityId]: state(entityId, 'on') }), devices: [d], device: d,
    });
    assert.equal(on.command?.service, 'turn_off', `${domain} on`);
  }
});

test('feature-gated HA domains require the exact entity capability bits', () => {
  const matrix = [
    ['climate.room', 'off', 256, 'turn_on'],
    ['climate.room', 'heat', 128, 'turn_off'],
    ['media_player.tv', 'off', 128, 'turn_on'],
    ['media_player.tv', 'playing', 256, 'turn_off'],
    ['siren.alarm', 'off', 1, 'turn_on'],
    ['siren.alarm', 'on', 2, 'turn_off'],
    ['water_heater.boiler', 'off', 8, 'turn_on'],
    ['water_heater.boiler', 'eco', 8, 'turn_off'],
    ['camera.garden', 'off', 1, 'turn_on'],
    ['camera.garden', 'idle', 1, 'turn_off'],
    ['vacuum.legacy', 'off', 1, 'turn_on'],
    ['vacuum.legacy', 'on', 2, 'turn_off'],
  ];
  for (const [entityId, value, features, expectedService] of matrix) {
    const h = hass({
      [entityId]: state(entityId, value, { supported_features: features }),
    });
    const d = device({
      bindingKind: 'entity', bindingRef: entityId, primary: entityId, entities: [entityId],
      marker: { id: 'marker', binding: `entity:${entityId}` },
    });
    const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
    assert.equal(intent.command?.service, expectedService, `${entityId} ${value}`);

    const withoutCapability = hass({
      [entityId]: state(entityId, value, { supported_features: 0 }),
    });
    const blocked = resolveToggleIntent({
      hass: withoutCapability, devices: [d], device: d,
    });
    assert.equal(blocked.command, null, `${entityId} without feature`);
    assert.equal(blocked.noneReason, 'unsupported', `${entityId} without feature`);

    const withoutFeatureAttribute = hass({ [entityId]: state(entityId, value) });
    const missingCapability = resolveToggleIntent({
      hass: withoutFeatureAttribute, devices: [d], device: d,
    });
    assert.equal(missingCapability.command, null, `${entityId} without feature attribute`);
    assert.equal(
      missingCapability.noneReason, 'unsupported', `${entityId} without feature attribute`,
    );
  }
});

test('unknown state uses toggle only when the complete capability is present', () => {
  const lightId = 'light.unknown';
  const lightDevice = device({
    bindingKind: 'entity', bindingRef: lightId, primary: lightId, entities: [lightId],
    marker: { id: 'marker', binding: `entity:${lightId}` },
  });
  const lightIntent = resolveToggleIntent({
    hass: hass({ [lightId]: state(lightId, 'unknown') }),
    devices: [lightDevice], device: lightDevice,
  });
  assert.equal(lightIntent.command?.service, 'toggle');
  assert.equal(lightIntent.nextEffect, 'toggle');

  const climateId = 'climate.unknown';
  const climateDevice = device({
    bindingKind: 'entity', bindingRef: climateId, primary: climateId, entities: [climateId],
    marker: { id: 'marker', binding: `entity:${climateId}` },
  });
  const capable = resolveToggleIntent({
    hass: hass({ [climateId]: state(climateId, 'unknown', { supported_features: 384 }) }),
    devices: [climateDevice], device: climateDevice,
  });
  assert.equal(capable.command?.service, 'toggle');
  assert.equal(capable.nextEffect, 'toggle');

  const onlyTurnOn = resolveToggleIntent({
    hass: hass({ [climateId]: state(climateId, 'unknown', { supported_features: 256 }) }),
    devices: [climateDevice], device: climateDevice,
  });
  assert.equal(onlyTurnOn.command, null);
  assert.equal(onlyTurnOn.noneReason, 'unsupported');
});

test('device binding chooses the first capable peer inside one functional role', () => {
  const h = hass({
    'camera.first': state('camera.first', 'idle', { supported_features: 0 }),
    'camera.second': state('camera.second', 'idle', { supported_features: 1 }),
    'switch.option': state('switch.option', 'off'),
  }, {
    'camera.first': { entity_id: 'camera.first', device_id: 'dev' },
    'camera.second': { entity_id: 'camera.second', device_id: 'dev' },
    'switch.option': { entity_id: 'switch.option', device_id: 'dev' },
  });
  const d = device({
    bindingKind: 'device', bindingRef: 'dev', primary: 'camera.first',
    entities: ['camera.first', 'camera.second', 'switch.option'],
    marker: { id: 'marker', binding: 'device:dev' },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.deepEqual(toggleCommandEntityIds(intent.command), ['camera.second']);
  assert.equal(intent.targets[0].via, 'device-role');
});

test('device binding preserves an unavailable first role entity instead of retargeting', () => {
  const h = hass({
    'camera.first': state('camera.first', 'unavailable', { supported_features: 1 }),
    'camera.second': state('camera.second', 'idle', { supported_features: 1 }),
  }, {
    'camera.first': { entity_id: 'camera.first', device_id: 'dev' },
    'camera.second': { entity_id: 'camera.second', device_id: 'dev' },
  });
  const d = device({
    bindingKind: 'device', bindingRef: 'dev', primary: 'camera.first',
    entities: ['camera.first', 'camera.second'], marker: { id: 'marker', binding: 'device:dev' },
  });
  const intent = resolveToggleIntent({ hass: h, devices: [d], device: d });
  assert.equal(intent.command, null);
  assert.equal(intent.noneReason, 'unavailable');
  assert.equal(intent.skippedTargets[0].entityId, 'camera.first');
});

test('confirmation target comparison ignores order but detects target-set changes', () => {
  const a = { domain: 'homeassistant', service: 'turn_on', data: { entity_id: ['switch.b', 'light.a'] } };
  const b = { domain: 'homeassistant', service: 'turn_off', data: { entity_id: ['light.a', 'switch.b'] } };
  const c = { domain: 'homeassistant', service: 'turn_on', data: { entity_id: ['light.a'] } };
  assert.equal(sameToggleCommandTargets(a, b), true);
  assert.equal(sameToggleCommandTargets(a, c), false);
});

test('toggle confirmation formats every next effect without deriving direction from state', () => {
  for (const effect of ['turn-on', 'turn-off', 'open', 'close', 'stop']) {
    const lines = formatToggleConfirmation(
      confirmationIntent({ nextEffect: effect }), confirmationFormatter,
    );
    assert.deepEqual(lines, ['current:state:off', `expected:effect:${effect}`], effect);
  }
  assert.deepEqual(
    formatToggleConfirmation(
      confirmationIntent({ nextEffect: 'toggle' }), confirmationFormatter,
    ),
    ['current:state:off', 'expected:by-ha'],
  );
});

test('toggle confirmation describes executable group targets and skipped targets separately', () => {
  const targets = [
    { entityId: 'switch.one', name: 'One', state: 'on', via: 'control-entity' },
    { entityId: 'light.two', name: 'Two', state: 'off', via: 'control-entity' },
  ];
  const partial = confirmationIntent({
    kind: 'group', semantics: 'group-power', targets,
    skippedTargets: [{
      ref: 'switch.missing', entityId: 'switch.missing', name: 'Missing', reason: 'unavailable',
    }],
    nextEffect: 'turn-off',
    command: {
      domain: 'homeassistant', service: 'turn_off',
      data: { entity_id: targets.map((target) => target.entityId) },
    },
  });
  assert.deepEqual(formatToggleConfirmation(partial, confirmationFormatter), [
    'current:group:1/2', 'expected:all-off', 'unavailable:1',
  ]);

  const allOff = {
    ...partial,
    targets: targets.map((target) => ({ ...target, state: 'off' })),
    skippedTargets: [],
    nextEffect: 'turn-on',
    command: { ...partial.command, service: 'turn_on' },
  };
  assert.deepEqual(formatToggleConfirmation(allOff, confirmationFormatter), [
    'current:all-off', 'expected:all-on',
  ]);
});

test('toggle confirmation covers virtual lights and refuses non-executable intents', () => {
  const virtual = confirmationIntent({
    targets: [{ entityId: '', name: 'Virtual lamp', state: 'on', via: 'virtual-light' }],
    nextEffect: 'turn-off',
    command: null,
    operation: { kind: 'virtual-light', markerId: 'virtual-lamp' },
  });
  assert.deepEqual(formatToggleConfirmation(virtual, confirmationFormatter), [
    'current:state:on', 'expected:effect:turn-off',
  ]);

  assert.deepEqual(formatToggleConfirmation(confirmationIntent({
    kind: 'none', targets: [], nextEffect: null, command: null,
    noneReason: 'no-actionable-entity',
  }), confirmationFormatter), []);
});
