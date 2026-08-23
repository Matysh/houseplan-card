import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  activitySourceSignature,
  deviceA11yState,
  markerLqiBand,
  markerLqiColor,
  presentationSourceSignature,
  resolveDevicePresentation,
  resolvePresentationSources,
} from '../test-build/device-presentation.js';
import { lqiColor } from '../test-build/logic.js';
import {
  resolveBindingProviders,
  resolveEntityProvider,
} from '../test-build/integration-provider.js';
import { valueBadgeTitle, valueBadgeWriteFields } from '../test-build/device-value-badge.js';
import { resolvedLightSources } from '../test-build/devices.js';

const state = (entity_id, value, attributes = {}) => ({ entity_id, state: value, attributes });
const hass = (states, entities = {}) => ({
  states,
  entities,
  devices: {},
  config: { unit_system: { temperature: '°C' } },
  formatEntityState: (item) => item.state === 'on' ? 'On' : item.state,
  localize: (key) => key === 'state.default.on' ? 'On'
    : key === 'state.default.off' ? 'Off' : undefined,
});

const device = (overrides = {}) => ({
  id: 'd1',
  name: 'Relay',
  model: '',
  area: 'room',
  space: 'floor',
  icon: 'mdi:toggle-switch',
  entities: ['switch.relay'],
  primary: 'switch.relay',
  bindingKind: 'device',
  bindingRef: 'd1',
  bindingStatus: { kind: 'active', enabledEntityIds: ['switch.relay'], allEntityIds: ['switch.relay'] },
  marker: { id: 'd1', binding: 'device:d1' },
  ...overrides,
});

const options = {
  liveStates: true,
  showTemperature: true,
  showSignal: true,
};

test('marker LQI keeps semantic bands while its colour uses the continuous gradient', () => {
  assert.deepEqual([0, 40, 41, 179, 180].map(markerLqiBand), [
    'low', 'low', 'mid', 'mid', 'high',
  ]);
  for (const lqi of [0, 40, 41, 110, 179, 180, 255]) {
    assert.equal(markerLqiColor(lqi), lqiColor(lqi));
  }
  assert.notEqual(markerLqiColor(41), markerLqiColor(42));
  assert.equal(lqiColor(110), 'hsl(60, 85%, 55%)');
});

test('lock presentation distinguishes locked and unlocked without changing generic open', () => {
  const h = hass({
    'lock.front': state('lock.front', 'locked'),
  }, {
    'lock.front': { entity_id: 'lock.front', device_id: 'd1', platform: 'demo' },
  });
  const lock = device({
    icon: 'mdi:lock', entities: ['lock.front'], primary: 'lock.front',
  });
  const locked = resolveDevicePresentation(h, lock, options);
  assert.equal(locked.lockState, 'locked');
  assert.ok(locked.classes.includes('lock-locked'));
  assert.equal(deviceA11yState(locked), 'locked');

  h.states['lock.front'].state = 'unlocked';
  const unlocked = resolveDevicePresentation(h, lock, options);
  assert.equal(unlocked.lockState, 'unlocked');
  assert.ok(unlocked.classes.includes('lock-unlocked'));
  assert.equal(deviceA11yState(unlocked), 'unlocked');
});

test('shares one lifecycle presentation between full and space cards', () => {
  const h = hass({
    'sensor.washer_status': state('sensor.washer_status', 'start'),
    'switch.washer_power': state('switch.washer_power', 'on'),
    'switch.washer_child_lock': state('switch.washer_child_lock', 'off'),
  }, {
    'sensor.washer_status': {
      entity_id: 'sensor.washer_status', device_id: 'd1', platform: 'demo',
      translation_key: 'status',
    },
    'switch.washer_power': {
      entity_id: 'switch.washer_power', device_id: 'd1', platform: 'demo',
      original_name: 'Power',
    },
    'switch.washer_child_lock': {
      entity_id: 'switch.washer_child_lock', device_id: 'd1', platform: 'demo',
    },
  });
  const washer = device({
    name: 'Washer',
    icon: 'mdi:washing-machine',
    entities: ['switch.washer_child_lock', 'sensor.washer_status', 'switch.washer_power'],
    allEntities: ['switch.washer_child_lock', 'sensor.washer_status', 'switch.washer_power'],
    primary: 'switch.washer_power',
    marker: { id: 'd1', binding: 'device:d1', display: 'value' },
  });
  const full = resolveDevicePresentation(h, washer, options);
  const space = resolveDevicePresentation(h, washer, { ...options });
  const projection = (value) => ({
    sources: value.visualSources.map((source) => [source.eid, source.role]),
    visual: value.visual,
    reason: value.explanation.reason,
    valueText: value.valueText,
  });
  assert.deepEqual(projection(full), projection(space));
  assert.deepEqual(full.visualSources.map((source) => [source.eid, source.role]), [
    ['sensor.washer_status', 'lifecycle'],
    ['switch.washer_power', 'power_gate'],
  ]);
  assert.equal(full.visual.status, 'working');
  assert.equal(full.explanation.reason, 'working');
  assert.equal(full.valueText, 'On', 'the historical Power value remains unambiguous');

  const deviceVisual = readFileSync(new URL('../src/device-visual.ts', import.meta.url), 'utf8');
  const presentation = readFileSync(new URL('../src/device-presentation.ts', import.meta.url), 'utf8');
  const fullCard = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  const spaceCard = readFileSync(new URL('../src/space-card.ts', import.meta.url), 'utf8');
  assert.match(deviceVisual, /const LIFECYCLE_WORKING_STATES/);
  assert.doesNotMatch(presentation, /const LIFECYCLE_WORKING_STATES/);
  assert.doesNotMatch(spaceCard, /const LIFECYCLE_WORKING_STATES/);
  assert.match(fullCard, /resolveDevicePresentation\(/);
  assert.match(spaceCard, /resolveDevicePresentation\(/);
});

test('passive source and its controller share the plan-wide derived state', () => {
  const h = hass({
    'switch.wall': state('switch.wall', 'on'),
  });
  const controller = device({
    id: 'controller',
    name: 'Wall switch',
    entities: ['switch.wall'],
    primary: 'switch.wall',
    bindingRef: 'switch.wall',
    marker: {
      id: 'controller', binding: 'entity:switch.wall', controls: ['marker:bulb'],
    },
  });
  const bulb = device({
    id: 'bulb',
    name: 'Dumb bulb',
    entities: [],
    primary: null,
    bindingKind: 'virtual',
    bindingRef: 'bulb',
    marker: { id: 'bulb', binding: 'virtual:bulb', is_light: true },
  });

  const target = resolvePresentationSources(h, bulb, [controller, bulb]);
  const switchPresentation = resolvePresentationSources(h, controller, [controller, bulb]);

  assert.equal(target.sourceKind, 'light');
  assert.equal(target.visualSources[0].eid, 'marker:bulb');
  assert.equal(target.visualSources[0].sample.status, 'working');
  assert.equal(switchPresentation.sourceKind, 'controls');
  assert.equal(switchPresentation.visualSources[0].eid, 'marker:bulb');
  assert.equal(switchPresentation.visualSources[0].sample.status, 'working');
});

test('issue 107 manual virtual source owns its face despite saved outgoing controls', () => {
  const h = hass({
    'light.ceiling': state('light.ceiling', 'on'),
  });
  const lamp = device({
    id: 'manual-lamp',
    name: 'Manual lamp',
    entities: [],
    primary: null,
    bindingKind: 'virtual',
    bindingRef: 'manual-lamp',
    marker: {
      id: 'manual-lamp',
      binding: 'virtual',
      is_light: true,
      tap_action: 'toggle',
      controls: ['light.ceiling'],
    },
  });
  const offState = { rev: 2, configRev: 1, off: new Set(['manual-lamp']) };
  const offSources = resolvedLightSources(h, [lamp], null, offState);
  const off = resolveDevicePresentation(h, lamp, {
    ...options,
    lightDevices: [lamp],
    lightSources: offSources,
  });
  assert.equal(off.sourceKind, 'light');
  assert.deepEqual(off.visualSources.map((source) => source.eid), ['marker:manual-lamp']);
  assert.equal(off.visual.status, 'neutral');
  assert.ok(!off.classes.includes('on'));

  const onSources = resolvedLightSources(
    h, [lamp], null, { rev: 3, configRev: 1, off: new Set() },
  );
  const on = resolveDevicePresentation(h, lamp, {
    ...options,
    lightDevices: [lamp],
    lightSources: onSources,
  });
  assert.equal(on.sourceKind, 'light');
  assert.equal(on.visual.status, 'working');
  assert.ok(on.classes.includes('on'));
});

test('issue 174 linked manual source and controller presentation follow the real relay', () => {
  const h = hass({ 'switch.wall': state('switch.wall', 'on') });
  const controller = device({
    id: 'controller', name: 'Wall relay', entities: ['switch.wall'], primary: 'switch.wall',
    bindingRef: 'switch.wall',
    marker: {
      id: 'controller', binding: 'entity:switch.wall', controls: ['marker:lamp'],
    },
  });
  const lamp = device({
    id: 'lamp', name: 'Dumb lamp', entities: [], primary: null,
    bindingKind: 'virtual', bindingRef: 'lamp',
    marker: {
      id: 'lamp', binding: 'virtual', is_light: true, tap_action: 'toggle', controls: [],
    },
  });
  const devices = [controller, lamp];
  const manualOff = { rev: 7, configRev: 2, off: new Set(['lamp']) };

  let graph = resolvedLightSources(h, devices, null, manualOff);
  let target = resolveDevicePresentation(h, lamp, {
    ...options, lightDevices: devices, lightSources: graph,
  });
  let control = resolveDevicePresentation(h, controller, {
    ...options, lightDevices: devices, lightSources: graph,
  });
  assert.equal(target.visual.status, 'working');
  assert.equal(control.visual.status, 'working');

  h.states['switch.wall'].state = 'off';
  graph = resolvedLightSources(h, devices, null, manualOff);
  target = resolveDevicePresentation(h, lamp, {
    ...options, lightDevices: devices, lightSources: graph,
  });
  control = resolveDevicePresentation(h, controller, {
    ...options, lightDevices: devices, lightSources: graph,
  });
  assert.equal(target.visual.status, 'neutral');
  assert.equal(control.visual.status, 'neutral');
});

test('issue 251 separates controller availability from controlled target status', () => {
  const own = [
    'event.wall_action', 'sensor.wall_battery', 'sensor.wall_linkquality', 'update.wall',
  ];
  const h = hass({
    'event.wall_action': state('event.wall_action', 'unknown'),
    'sensor.wall_battery': state('sensor.wall_battery', '100'),
    'sensor.wall_linkquality': state('sensor.wall_linkquality', '164'),
    'update.wall': state('update.wall', 'off'),
    'light.wall_group': state('light.wall_group', 'unavailable', { friendly_name: 'Wall lights' }),
  }, Object.fromEntries([...own, 'light.wall_group'].map((entity_id) => [entity_id, {
    entity_id,
    device_id: own.includes(entity_id) ? 'wall' : 'lights',
    platform: 'demo',
  }])));
  const controller = device({
    id: 'wall', name: 'Wall switch', entities: own, primary: 'event.wall_action',
    bindingRef: 'wall',
    bindingStatus: { kind: 'active', enabledEntityIds: own, allEntityIds: own },
    marker: {
      id: 'wall', binding: 'device:wall', tap_action: 'toggle', controls: ['light.wall_group'],
    },
  });

  let result = resolveDevicePresentation(h, controller, options);
  assert.equal(result.sourceKind, 'controls');
  assert.deepEqual(result.visual, {
    availability: 'available', status: 'neutral', activity: 'none',
  });
  assert.ok(!result.classes.includes('unavail'));
  assert.ok(!result.classes.includes('on'));

  h.states['light.wall_group'].state = 'on';
  result = resolveDevicePresentation(h, controller, options);
  assert.equal(result.visual.availability, 'available');
  assert.equal(result.visual.status, 'working');
  assert.ok(result.classes.includes('on'));

  for (const entityId of ['sensor.wall_battery', 'sensor.wall_linkquality', 'update.wall']) {
    h.states[entityId].state = 'unavailable';
  }
  result = resolveDevicePresentation(h, controller, options);
  assert.equal(result.visual.availability, 'unavailable');
  assert.equal(result.visual.status, 'working', 'target work remains a separate fact');
  assert.ok(result.classes.includes('unavail'));
  assert.ok(!result.classes.includes('on'));
  assert.equal(deviceA11yState(result), 'unavailable');
  assert.equal(result.pulse.kind, 'none');

  const staticLiveDisabled = resolveDevicePresentation(h, controller, {
    ...options, liveStates: false,
  });
  assert.deepEqual(staticLiveDisabled.visual, {
    availability: 'available', status: 'neutral', activity: 'none',
  });

  h.states['light.wall_group'].state = 'unavailable';
  const eventOnly = resolveDevicePresentation(h, {
    ...controller,
    entities: ['event.wall_action'],
    bindingStatus: {
      kind: 'active', enabledEntityIds: ['event.wall_action'], allEntityIds: ['event.wall_action'],
    },
  }, options);
  assert.equal(eventOnly.visual.availability, 'unavailable');
  assert.equal(eventOnly.visual.status, 'neutral');

  const virtual = resolveDevicePresentation(h, device({
    id: 'virtual-control', name: 'Virtual control', virtual: true,
    entities: [], primary: null, bindingKind: 'virtual', bindingRef: 'virtual-control',
    marker: {
      id: 'virtual-control', binding: 'virtual', tap_action: 'toggle',
      controls: ['light.wall_group'],
    },
  }), options);
  assert.equal(virtual.sourceKind, 'controls');
  assert.equal(virtual.visual.availability, 'available');
  assert.equal(virtual.visual.status, 'neutral');

  h.states['binary_sensor.wall_smoke'] = state(
    'binary_sensor.wall_smoke', 'on', { device_class: 'smoke' },
  );
  h.entities['binary_sensor.wall_smoke'] = {
    entity_id: 'binary_sensor.wall_smoke', device_id: 'wall', platform: 'demo',
  };
  const alarm = resolveDevicePresentation(h, {
    ...controller, entities: [...own, 'binary_sensor.wall_smoke'],
  }, options);
  assert.equal(alarm.visual.status, 'alarm');
  assert.equal(alarm.visual.availability, 'available');
  assert.ok(alarm.classes.includes('alarm'));
});

test('passive sensor source keeps its normal scalar value and never probes marker ids', () => {
  const hits = [];
  const h = hass(new Proxy({
    'sensor.lux': state('sensor.lux', '234', { unit_of_measurement: 'lx' }),
  }, {
    get(target, key) {
      if (String(key).startsWith('marker:')) hits.push(key);
      return target[key];
    },
  }));
  const sensor = device({
    id: 'lux', name: 'Lux', primary: 'sensor.lux', entities: ['sensor.lux'],
    marker: {
      id: 'lux', binding: 'entity:sensor.lux', is_light: true, display: 'value',
    },
  });
  const presentation = resolveDevicePresentation(h, sensor, options);
  assert.equal(presentation.valueText, '234 lx');
  assert.deepEqual(hits, []);
});

test('secondary humidity diagnostics do not create a legacy humidity satellite', () => {
  const h = hass({
    'switch.relay': state('switch.relay', 'on'),
    'sensor.relay_humidity': state('sensor.relay_humidity', '49', {
      device_class: 'humidity', unit_of_measurement: '%',
    }),
  });
  const relay = device({
    entities: ['switch.relay', 'sensor.relay_humidity'],
    primary: 'switch.relay',
  });
  const presentation = resolveDevicePresentation(h, relay, options);
  assert.equal(presentation.humText, null);
});

test('derived marker-state badge follows a stateful Always source', () => {
  const h = hass({ 'light.bulb': state('light.bulb', 'on') });
  const bulb = device({
    id: 'bulb', name: 'Bulb', primary: 'light.bulb', entities: ['light.bulb'],
    marker: { id: 'bulb', binding: 'entity:light.bulb', is_light: true },
  });
  const controller = device({
    id: 'controller', primary: 'switch.wall', entities: ['switch.wall'],
    marker: {
      id: 'controller', binding: 'entity:switch.wall',
      value_badge: {
        enabled: true,
        source: { kind: 'derived_marker_state', ref: 'marker:bulb' },
        position: 'right',
      },
    },
  });
  const graph = resolvedLightSources(h, [controller, bulb]);
  const presentation = resolveDevicePresentation(h, controller, {
    ...options, lightDevices: [controller, bulb], lightSources: graph,
  });
  assert.equal(presentation.valueBadge?.availability, 'available');
  assert.equal(presentation.valueBadge?.text, 'On');
});

test('ordinary presentation stays on the local light path', () => {
  const h = hass({ 'switch.relay': state('switch.relay', 'on') });
  const forbiddenGlobalGraph = new Proxy([], {
    get(target, prop, receiver) {
      if (prop === Symbol.iterator) throw new Error('ordinary marker traversed the global graph');
      return Reflect.get(target, prop, receiver);
    },
  });
  const sources = resolvePresentationSources(h, device(), forbiddenGlobalGraph);
  assert.equal(sources.sourceKind, 'device_role');
  assert.equal(sources.visualSources[0].eid, 'switch.relay');
});

test('always-static display suppresses every live visual but keeps diagnostics', () => {
  const h = hass({
    'binary_sensor.smoke': state('binary_sensor.smoke', 'on', { device_class: 'smoke' }),
  }, {
    'binary_sensor.smoke': { entity_id: 'binary_sensor.smoke', device_id: 'd1', platform: 'demo' },
  });
  const marker = device({
    icon: 'mdi:smoke-detector',
    entities: ['binary_sensor.smoke'],
    primary: 'binary_sensor.smoke',
    marker: {
      id: 'd1', binding: 'device:d1', display: 'static_icon',
      ripple_color: '#00ff00', size: 1.75, angle: 125, vacuum: { live: true },
    },
  });
  const result = resolveDevicePresentation(h, marker, options);
  assert.equal(result.display, 'static_icon');
  assert.equal(result.visual.status, 'neutral');
  assert.equal(result.visual.activity, 'none');
  assert.equal(result.icon, 'mdi:smoke-detector');
  assert.equal(result.valueText, null);
  assert.equal(result.tempText, null);
  assert.equal(result.humText, null);
  assert.equal(result.lqiText, null);
  assert.equal(result.lightColor, null);
  assert.equal(result.scale, 1.75);
  assert.equal(result.angle, 125);
  assert.equal(result.rippleColor, null);
  assert.equal(result.vacuumLive, false);
  assert.deepEqual(result.classes, ['static-icon']);
  assert.equal(result.explanation.reason, 'static_icon');
  assert.equal(result.visualSources[0].eid, 'binary_sensor.smoke');
});

test('always-static light keeps configured geometry but suppresses RGB and state colour', () => {
  const h = hass(
    {
      'light.rgb': state('light.rgb', 'on', {
        rgb_color: [12, 140, 250], brightness: 210,
      }),
    },
    { 'light.rgb': { entity_id: 'light.rgb', device_id: 'd1', platform: 'demo' } },
  );
  const base = device({
    icon: 'mdi:lightbulb', entities: ['light.rgb'], primary: 'light.rgb',
    marker: { id: 'd1', binding: 'device:d1', size: 2.25, angle: 315 },
  });
  const dynamic = resolveDevicePresentation(h, base, options);
  const fixed = resolveDevicePresentation(h, {
    ...base, marker: { ...base.marker, display: 'static_icon' },
  }, options);
  assert.equal(dynamic.visual.status, 'working');
  assert.ok(dynamic.lightColor);
  assert.ok(dynamic.classes.includes('on'));
  assert.equal(fixed.lightColor, null);
  assert.equal(fixed.visual.status, 'neutral');
  assert.deepEqual(fixed.classes, ['static-icon']);
  assert.equal(fixed.icon, 'mdi:lightbulb');
  assert.equal(fixed.scale, 2.25);
  assert.equal(fixed.angle, 315);
});

test('hostile stored ripple color cannot add CSS and does not mask a safe HA light color', () => {
  const h = hass(
    { 'light.rgb': state('light.rgb', 'on', { rgb_color: [12, 140, 250] }) },
    { 'light.rgb': { entity_id: 'light.rgb', device_id: 'd1', platform: 'demo' } },
  );
  const result = resolveDevicePresentation(h, device({
    icon: 'mdi:lightbulb', entities: ['light.rgb'], primary: 'light.rgb',
    marker: {
      id: 'd1', binding: 'device:d1', display: 'icon_ripple',
      ripple_color: 'red;position:fixed;inset:0',
    },
  }), options);
  assert.equal(result.rippleColor, 'rgb(12, 140, 250)');

  const noLight = resolveDevicePresentation(hass({}), device({
    marker: {
      id: 'd1', binding: 'device:d1', display: 'icon_ripple',
      ripple_color: '#123456;position:fixed',
    },
  }), options);
  assert.equal(noLight.rippleColor, null);
});

test('static mode cannot revive HA-disabled or orphaned lifecycle diagnostics', () => {
  const h = hass({});
  const disabled = resolveDevicePresentation(h, device({
    bindingStatus: {
      kind: 'ha_disabled', reason: 'device', enabledEntityIds: [], allEntityIds: ['switch.relay'],
    },
    entities: [], primary: undefined,
    marker: { id: 'd1', binding: 'device:d1', display: 'static_icon' },
  }), options);
  assert.equal(disabled.effectiveHidden, true);
  assert.equal(disabled.explanation.reason, 'ha_disabled');
  assert.deepEqual(disabled.classes, []);

  const orphaned = resolveDevicePresentation(h, device({
    bindingStatus: { kind: 'orphaned', enabledEntityIds: [], allEntityIds: [] },
    entities: [], primary: undefined,
    marker: { id: 'd1', binding: 'device:d1', display: 'static_icon' },
  }), options);
  assert.equal(orphaned.orphaned, true);
  assert.equal(orphaned.explanation.reason, 'orphaned');
});

test('switching through static mode cannot reuse a finite activity window', () => {
  const h = hass(
    { 'binary_sensor.motion': state('binary_sensor.motion', 'on', { device_class: 'motion' }) },
    { 'binary_sensor.motion': { entity_id: 'binary_sensor.motion', device_id: 'd1', platform: 'demo' } },
  );
  const base = device({
    icon: 'mdi:motion-sensor', entities: ['binary_sensor.motion'], primary: 'binary_sensor.motion',
    marker: { id: 'd1', binding: 'device:d1', display: 'icon_ripple' },
  });
  const sourceSignature = activitySourceSignature(h, base);
  const active = resolveDevicePresentation(h, base, {
    ...options,
    now: 2_000,
    activityRuntime: {
      sources: sourceSignature, flashTs: 1_000, flashKind: 'event', gen: 2,
    },
  });
  assert.equal(active.activity, 'event');
  assert.equal(active.pulse.kind, 'short');
  assert.equal(active.pulse.reason, 'event');
  assert.ok(active.classes.includes('activity-gen2'));
  const fixed = resolveDevicePresentation(h, {
    ...base, marker: { ...base.marker, display: 'static_icon' },
  }, {
    ...options,
    now: 2_000,
    activityRuntime: {
      sources: sourceSignature, flashTs: 1_000, flashKind: 'event', gen: 2,
    },
  });
  assert.equal(fixed.activity, 'none');
  assert.deepEqual(fixed.classes, ['static-icon']);
  const restored = resolveDevicePresentation(h, base, {
    ...options, now: 2_000, activityRuntime: null,
  });
  assert.equal(restored.activity, 'none');
  assert.ok(!restored.classes.some((name) => name.startsWith('activity-')));
});

test('always-static source short-circuit is plan-only and lifecycle still wins', () => {
  const h = hass(
    { 'switch.relay': state('switch.relay', 'unavailable') },
    { 'switch.relay': { entity_id: 'switch.relay', device_id: 'd1', platform: 'demo' } },
  );
  const marker = device({ marker: { id: 'd1', binding: 'device:d1', display: 'static_icon' } });
  const plan = resolveDevicePresentation(h, marker, { ...options, sourceDetails: false });
  assert.equal(plan.visual.status, 'neutral');
  assert.deepEqual(plan.visualSources, []);
  assert.deepEqual(plan.classes, ['static-icon']);

  const hidden = resolveDevicePresentation(h, { ...marker, hidden: true, userHidden: true }, options);
  assert.equal(hidden.effectiveHidden, true);
});

test('always-static vacuum keeps its dock face but exposes no live overlay', () => {
  const h = hass(
    { 'vacuum.robot': state('vacuum.robot', 'cleaning') },
    { 'vacuum.robot': { entity_id: 'vacuum.robot', device_id: 'd1', platform: 'demo' } },
  );
  const base = device({
    icon: 'mdi:robot-vacuum',
    entities: ['vacuum.robot'],
    primary: 'vacuum.robot',
    marker: { id: 'd1', binding: 'device:d1', vacuum: { live: true } },
  });
  const dynamic = resolveDevicePresentation(h, base, options);
  const fixed = resolveDevicePresentation(h, {
    ...base, marker: { ...base.marker, display: 'static_icon' },
  }, options);
  assert.equal(dynamic.visual.status, 'working');
  assert.equal(dynamic.vacuumLive, true);
  assert.equal(fixed.visual.status, 'neutral');
  assert.equal(fixed.vacuumLive, false);
  assert.equal(fixed.explanation.reason, 'static_icon');
});

test('one projection supplies working state and localized text value', () => {
  const h = hass(
    { 'switch.relay': state('switch.relay', 'on') },
    { 'switch.relay': { entity_id: 'switch.relay', device_id: 'd1', platform: 'demo' } },
  );
  const marker = device({ marker: { id: 'd1', binding: 'device:d1', display: 'value' } });
  const result = resolveDevicePresentation(h, marker, options);
  assert.equal(result.valueText, 'On');
  assert.equal(result.visual.status, 'working');
  assert.ok(result.classes.includes('on'));
  assert.equal(result.valueSource?.eid, 'switch.relay');
});

test('value mode refuses to choose the first of multiple equal control sources', () => {
  const h = hass({
    'switch.relay': state('switch.relay', 'off'),
    'light.one': state('light.one', 'on'),
    'light.two': state('light.two', 'off'),
  }, {
    'switch.relay': { entity_id: 'switch.relay', device_id: 'd1', platform: 'demo' },
    'light.one': { entity_id: 'light.one', platform: 'hue' },
    'light.two': { entity_id: 'light.two', platform: 'hue' },
  });
  const marker = device({
    controls: ['light.one', 'light.two'],
    marker: {
      id: 'd1', binding: 'device:d1', display: 'value', controls: ['light.one', 'light.two'],
    },
  });
  const result = resolveDevicePresentation(h, marker, options);
  assert.equal(result.valueText, null);
  assert.equal(result.fallbackReason, 'value_ambiguous_sources');
  assert.equal(result.visualSources.length, 2);
});

test('hidden design preview is visible without mutating the hidden contract', () => {
  const h = hass(
    { 'switch.relay': state('switch.relay', 'on') },
    { 'switch.relay': { entity_id: 'switch.relay', device_id: 'd1', platform: 'demo' } },
  );
  const marker = device({
    hidden: true,
    userHidden: true,
    marker: { id: 'd1', binding: 'device:d1', hidden: true },
  });
  const plan = resolveDevicePresentation(h, marker, options);
  const preview = resolveDevicePresentation(h, marker, { ...options, designPreview: true });
  assert.equal(plan.effectiveHidden, true);
  assert.equal(preview.effectiveHidden, false);
  assert.ok(preview.explanation.notices.includes('hidden_design_preview'));
  assert.equal(preview.visual.status, 'working');
});

test('activity source signature ignores control ordering but changes with role graph', () => {
  const h = hass({
    'switch.relay': state('switch.relay', 'off'),
    'light.one': state('light.one', 'off'),
    'light.two': state('light.two', 'off'),
  }, {
    'switch.relay': { entity_id: 'switch.relay', device_id: 'd1', platform: 'demo' },
    'light.one': { entity_id: 'light.one', platform: 'hue' },
    'light.two': { entity_id: 'light.two', platform: 'hue' },
  });
  const one = device({ controls: ['light.one', 'light.two'] });
  const two = device({ controls: ['light.two', 'light.one'] });
  const own = device({ controls: [] });
  assert.equal(presentationSourceSignature(h, one), presentationSourceSignature(h, two));
  assert.notEqual(presentationSourceSignature(h, one), presentationSourceSignature(h, own));
});

test('integration provenance prefers config-entry ownership and entity platform', () => {
  const registry = {
    revision: 4,
    authoritative: true,
    devices: { d1: { id: 'd1', config_entry_id: 'ce1', identifiers: [['fallback', 'd1']] } },
    entities: {
      'switch.relay': {
        entity_id: 'switch.relay', device_id: 'd1', platform: 'localtuya', config_entry_id: 'ce1', disabled_by: null,
      },
    },
  };
  const metadata = {
    revision: 1,
    loaded: true,
    configEntries: { ce1: { entry_id: 'ce1', domain: 'localtuya', title: 'Boiler room' } },
    manifests: { localtuya: { domain: 'localtuya', name: 'Local Tuya' } },
  };
  const h = { devices: registry.devices, entities: registry.entities };
  assert.deepEqual(
    resolveBindingProviders(h, 'device:d1', registry, metadata).map((item) => item.domain),
    ['localtuya'],
  );
  assert.equal(resolveEntityProvider(h, 'switch.relay', registry, metadata)?.domain, 'localtuya');
  assert.equal(resolveBindingProviders(h, 'virtual', registry, metadata)[0].domain, 'houseplan');
});

test('derived temperature and humidity retain compact plan formatting', () => {
  const tempHass = hass({
    'sensor.temp': state('sensor.temp', '22.44', { device_class: 'temperature', unit_of_measurement: '°C' }),
  }, {
    'sensor.temp': { entity_id: 'sensor.temp', device_id: 'd1', platform: 'demo' },
  });
  const temperature = resolveDevicePresentation(tempHass, device({
    icon: 'mdi:thermometer', entities: ['sensor.temp'], primary: 'sensor.temp',
    marker: { id: 'd1', binding: 'device:d1', display: 'value' },
  }), options);
  assert.equal(temperature.valueText, '22.4°');

  const humidityHass = hass({
    'sensor.humidity': state('sensor.humidity', '47.7', { device_class: 'humidity', unit_of_measurement: '%' }),
  }, {
    'sensor.humidity': { entity_id: 'sensor.humidity', device_id: 'd1', platform: 'demo' },
  });
  const humidity = resolveDevicePresentation(humidityHass, device({
    entities: ['sensor.humidity'], primary: 'sensor.humidity',
    marker: { id: 'd1', binding: 'device:d1', display: 'value' },
  }), options);
  assert.equal(humidity.valueText, '48%');
});

test('temperature-led composite marker does not add a legacy humidity satellite', () => {
  const h = hass({
    'sensor.temp': state('sensor.temp', '22.4', { device_class: 'temperature', unit_of_measurement: '°C' }),
    'sensor.humidity': state('sensor.humidity', '47.7', { device_class: 'humidity', unit_of_measurement: '%' }),
  }, {
    'sensor.temp': { entity_id: 'sensor.temp', device_id: 'd1', platform: 'demo' },
    'sensor.humidity': { entity_id: 'sensor.humidity', device_id: 'd1', platform: 'demo' },
  });
  const result = resolveDevicePresentation(h, device({
    icon: 'mdi:thermometer', primary: 'sensor.temp',
    entities: ['sensor.temp', 'sensor.humidity'],
  }), options);
  assert.equal(result.valueBadge?.text, '22.4°');
  assert.equal(result.tempText, '22.4');
  assert.equal(result.humText, null);
});

test('preview explanations distinguish activity display and composite Power source', () => {
  const workingHass = hass(
    { 'switch.relay': state('switch.relay', 'on') },
    { 'switch.relay': { entity_id: 'switch.relay', device_id: 'd1', platform: 'demo' } },
  );
  const badge = resolveDevicePresentation(workingHass, device(), options);
  const ripple = resolveDevicePresentation(workingHass, device({
    marker: { id: 'd1', binding: 'device:d1', display: 'icon_ripple' },
  }), options);
  assert.equal(badge.explanation.reason, 'working');
  assert.ok(badge.explanation.notices.includes('activity_display_disabled'));
  assert.equal(ripple.explanation.reason, 'working_activity');
  assert.ok(!ripple.explanation.notices.includes('activity_display_disabled'));

  const compositeHass = hass({
    'switch.power': state('switch.power', 'on'),
    'switch.voice': state('switch.voice', 'on'),
  }, {
    'switch.power': {
      entity_id: 'switch.power', device_id: 'd1', platform: 'demo', translation_key: 'power',
    },
    'switch.voice': { entity_id: 'switch.voice', device_id: 'd1', platform: 'demo' },
  });
  const composite = resolveDevicePresentation(compositeHass, device({
    entities: ['switch.voice', 'switch.power'], primary: 'switch.power',
  }), options);
  assert.ok(composite.explanation.notices.includes('composite_power_source'));
});

test('issue 90 explicit value badge overrides legacy gates and keeps its position', () => {
  const h = hass({
    'sensor.power': state('sensor.power', '0', { unit_of_measurement: 'W' }),
  }, {
    'sensor.power': { entity_id: 'sensor.power', device_id: 'd1', platform: 'demo' },
  });
  const result = resolveDevicePresentation(h, device({
    entities: ['sensor.power'], primary: 'sensor.power',
    marker: {
      id: 'd1', binding: 'device:d1',
      value_badge: {
        enabled: true,
        source: { kind: 'entity_state', entity_id: 'sensor.power' },
        position: 'left',
      },
    },
  }), { ...options, showTemperature: false, showSignal: false });
  assert.equal(result.valueBadge?.text, '0 W');
  assert.equal(result.valueBadge?.position, 'left');
  assert.equal(result.valueBadge?.configured, true);
});

test('issue 90 explicit off suppresses legacy and static display preserves but hides badge', () => {
  const h = hass({
    'sensor.temp': state('sensor.temp', '22.4', { device_class: 'temperature', unit_of_measurement: '°C' }),
  }, {
    'sensor.temp': { entity_id: 'sensor.temp', device_id: 'd1', platform: 'demo' },
  });
  const base = device({
    icon: 'mdi:thermometer', entities: ['sensor.temp'], primary: 'sensor.temp',
  });
  assert.equal(resolveDevicePresentation(h, base, options).valueBadge?.text, '22.4°');
  assert.equal(resolveDevicePresentation(h, {
    ...base, marker: {
      ...base.marker,
      value_badge: { enabled: false, source: null, position: 'right' },
    },
  }, options).valueBadge, null);
  assert.equal(resolveDevicePresentation(h, {
    ...base, marker: {
      ...base.marker, display: 'static_icon',
      value_badge: {
        enabled: true,
        source: { kind: 'entity_state', entity_id: 'sensor.temp' },
        position: 'top',
      },
    },
  }, options).valueBadge, null);
});

test('legacy climate-temperature flag does not fall through when the attribute is absent', () => {
  const h = hass({
    'climate.room': state('climate.room', 'heat', {}),
    'sensor.temp': state('sensor.temp', '22.4', {
      device_class: 'temperature', unit_of_measurement: '°C',
    }),
  }, {
    'climate.room': { entity_id: 'climate.room', device_id: 'd1', platform: 'demo' },
    'sensor.temp': { entity_id: 'sensor.temp', device_id: 'd1', platform: 'demo' },
  });
  const d = device({
    icon: 'mdi:thermometer', primary: 'sensor.temp',
    entities: ['climate.room', 'sensor.temp'], marker: { use_climate_temp: true },
  });
  assert.equal(resolveDevicePresentation(h, d, options).valueBadge, null);
});

test('an incomplete explicit enabled badge remains visible as unavailable', () => {
  const h = hass({}, {});
  const d = device({ marker: { value_badge: { enabled: true, position: 'top' } } });
  const badge = resolveDevicePresentation(h, d, options).valueBadge;
  assert.equal(badge?.text, '—');
  assert.equal(badge?.availability, 'missing');
  assert.equal(badge?.position, 'top');
  assert.equal(badge?.source, null);
  assert.equal(valueBadgeTitle(badge), 'Unavailable');
});

test('issue 90 untouched persistence gate never materializes a legacy badge', () => {
  assert.deepEqual(valueBadgeWriteFields({
    touched: false, originalHas: false, original: undefined,
    enabled: true, source: { kind: 'entity_state', entity_id: 'sensor.temp' }, position: 'right',
  }), {});
  const original = {
    enabled: false,
    source: { kind: 'entity_state', entity_id: 'sensor.old' },
    position: 'left',
    future: { preserved: true },
  };
  assert.equal(valueBadgeWriteFields({
    touched: false, originalHas: true, original,
    enabled: true, source: null, position: 'top',
  }).value_badge, original);
});

test('issue 90 missing source never falls back and derived LQI renders only once', () => {
  const h = hass({
    'sensor.value': state('sensor.value', '42'),
    'sensor.linkquality': state('sensor.linkquality', '150', { unit_of_measurement: 'lqi' }),
  }, {
    'sensor.value': { entity_id: 'sensor.value', device_id: 'd1', platform: 'demo' },
    'sensor.linkquality': { entity_id: 'sensor.linkquality', device_id: 'd1', platform: 'demo' },
  });
  const missing = resolveDevicePresentation(h, device({
    entities: ['sensor.value'], primary: 'sensor.value',
    marker: {
      id: 'd1', binding: 'device:d1',
      value_badge: {
        enabled: true,
        source: { kind: 'entity_state', entity_id: 'sensor.missing' },
        position: 'right',
      },
    },
  }), options);
  assert.equal(missing.valueBadge?.text, '—');
  assert.equal(missing.valueBadge?.availability, 'missing');

  const lqi = resolveDevicePresentation(h, device({
    entities: ['sensor.value', 'sensor.linkquality'], primary: 'sensor.value',
    marker: {
      id: 'd1', binding: 'device:d1',
      value_badge: { enabled: true, source: { kind: 'derived_lqi' }, position: 'bottom' },
    },
  }), options);
  assert.equal(lqi.valueBadge?.text, '150');
  assert.equal(lqi.lqiText, null);
});

test('cover presentation follows the same service target selected by toggle resolution', () => {
  const h = hass({
    'cover.curtain': state('cover.curtain', 'opening', {
      device_class: 'curtain', supported_features: 15,
    }),
    'sensor.position': state('sensor.position', '45'),
  }, {
    'cover.curtain': { entity_id: 'cover.curtain', device_id: 'd1', platform: 'demo' },
    'sensor.position': { entity_id: 'sensor.position', device_id: 'd1', platform: 'demo' },
  });
  const result = resolvePresentationSources(h, device({
    entities: ['sensor.position', 'cover.curtain'], primary: 'sensor.position',
  }));
  assert.equal(result.sourceKind, 'cover');
  assert.equal(result.visualSources.length, 1);
  assert.equal(result.visualSources[0].eid, 'cover.curtain');
  assert.equal(result.visualSources[0].state, 'opening');
});

test('presentation role uses the full registry projection with a frozen state snapshot', () => {
  const planHass = hass({
    'sensor.position': state('sensor.position', '45'),
    'cover.curtain': state('cover.curtain', 'opening', {
      device_class: 'curtain', supported_features: 15,
    }),
  });
  const registryHass = hass(planHass.states, {
    'sensor.position': {
      entity_id: 'sensor.position', device_id: 'd1', platform: 'demo',
      entity_category: 'diagnostic',
    },
    'cover.curtain': { entity_id: 'cover.curtain', device_id: 'd1', platform: 'demo' },
  });
  const result = resolvePresentationSources(planHass, device({
    entities: ['sensor.position', 'cover.curtain'], primary: 'sensor.position',
  }), undefined, undefined, registryHass);
  assert.equal(result.sourceKind, 'cover');
  assert.deepEqual(result.visualSources.map((source) => source.eid), ['cover.curtain']);
});

test('an incidental cover does not hijack the light face of a mixed device', () => {
  const h = hass({
    'light.mixed': state('light.mixed', 'on'),
    'cover.mixed': state('cover.mixed', 'opening', {
      device_class: 'curtain', supported_features: 15,
    }),
  }, {
    'light.mixed': { entity_id: 'light.mixed', device_id: 'd1', platform: 'demo' },
    'cover.mixed': { entity_id: 'cover.mixed', device_id: 'd1', platform: 'demo' },
  });
  const plain = resolvePresentationSources(h, device({
    entities: ['light.mixed', 'cover.mixed'], primary: 'light.mixed', tapAction: null,
  }));
  assert.equal(plain.sourceKind, 'light');
  assert.deepEqual(plain.visualSources.map((source) => source.eid), ['light.mixed']);

  const explicitCover = resolvePresentationSources(h, device({
    entities: ['light.mixed', 'cover.mixed'], primary: 'light.mixed', tapAction: 'cover',
  }));
  assert.equal(explicitCover.sourceKind, 'cover');
  assert.equal(explicitCover.visualSources[0].eid, 'cover.mixed');
});

test('an explicitly primary cover keeps the face when a light sibling exists', () => {
  const h = hass({
    'cover.mixed': state('cover.mixed', 'opening', {
      device_class: 'curtain', supported_features: 15,
    }),
    'light.mixed': state('light.mixed', 'on'),
  }, {
    'cover.mixed': { entity_id: 'cover.mixed', device_id: 'd1', platform: 'demo' },
    'light.mixed': { entity_id: 'light.mixed', device_id: 'd1', platform: 'demo' },
  });
  const result = resolvePresentationSources(h, device({
    entities: ['cover.mixed', 'light.mixed'], primary: 'cover.mixed', tapAction: 'info',
  }));
  assert.equal(result.sourceKind, 'cover');
  assert.deepEqual(result.visualSources.map((source) => source.eid), ['cover.mixed']);
});

test('an incidental cover does not hijack another whole-device role on info tap', () => {
  const h = hass({
    'media_player.screen': state('media_player.screen', 'playing'),
    'cover.screen': state('cover.screen', 'opening', {
      device_class: 'curtain', supported_features: 15,
    }),
  }, {
    'media_player.screen': { entity_id: 'media_player.screen', device_id: 'd1', platform: 'demo' },
    'cover.screen': { entity_id: 'cover.screen', device_id: 'd1', platform: 'demo' },
  });
  const result = resolvePresentationSources(h, device({
    entities: ['cover.screen', 'media_player.screen'],
    primary: 'media_player.screen', tapAction: 'info',
  }));
  assert.equal(result.sourceKind, 'device_role');
  assert.deepEqual(result.visualSources.map((source) => source.eid), ['media_player.screen']);
});
