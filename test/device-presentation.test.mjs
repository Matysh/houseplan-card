import test from 'node:test';
import assert from 'node:assert/strict';
import {
  presentationSourceSignature,
  resolveDevicePresentation,
} from '../test-build/device-presentation.js';
import {
  resolveBindingProviders,
  resolveEntityProvider,
} from '../test-build/integration-provider.js';

const state = (entity_id, value, attributes = {}) => ({ entity_id, state: value, attributes });
const hass = (states, entities = {}) => ({
  states,
  entities,
  devices: {},
  config: { unit_system: { temperature: '°C' } },
  formatEntityState: (item) => item.state === 'on' ? 'On' : item.state,
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
  const sourceSignature = presentationSourceSignature(h, base);
  const active = resolveDevicePresentation(h, base, {
    ...options,
    now: 2_000,
    activityRuntime: {
      sources: sourceSignature, flashTs: 1_000, flashKind: 'event', gen: 2,
    },
  });
  assert.equal(active.activity, 'event');
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
