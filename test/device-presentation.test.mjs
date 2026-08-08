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
