// #817: the charge line of the main device tooltip. The pure text function is
// exercised for every AC1/AC2 branch; the tooltip entry points are driven with
// the real presentation resolver so a line tied to the plan indicator fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createDeviceBatteryContext, deviceBatteryReading } from '../test-build/device-battery.js';
import { resolveDevicePresentation } from '../test-build/device-presentation.js';
import {
  deviceBatteryTipText, showDeviceFocusTip, showDevicePointerTip,
} from '../test-build/live-hover.js';
import { subst } from '../test-build/logic.js';

const dictionary = (lang) => JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), 'utf8'));
const translator = (lang) => {
  const words = dictionary(lang);
  return (key, vars) => subst(words[key], vars);
};
const en = translator('en');
const ru = translator('ru');

const marker = (overrides = {}) => ({
  id: 'd1', name: 'Hallway sensor', model: 'TS0201', area: 'room', space: 'floor',
  icon: 'mdi:thermometer', entities: ['sensor.temp'], primary: 'sensor.temp',
  bindingKind: 'device', bindingRef: 'd1',
  bindingStatus: { kind: 'active', enabledEntityIds: ['sensor.temp'], allEntityIds: ['sensor.temp'] },
  marker: { id: 'd1', binding: 'device:d1' },
  ...overrides,
});
const ha = (sources) => {
  const states = { 'sensor.temp': { entity_id: 'sensor.temp', state: '21', attributes: {} } };
  const entities = { 'sensor.temp': { device_id: 'd1', disabled_by: null } };
  for (const [entityId, state, deviceClass = 'battery'] of sources) {
    entities[entityId] = { device_id: 'd1', original_device_class: deviceClass, disabled_by: null };
    if (state !== undefined) states[entityId] = { entity_id: entityId, state, attributes: { device_class: deviceClass } };
  }
  return {
    states, entities, devices: { d1: { disabled_by: null } },
    config: { unit_system: { temperature: '°C' } },
    formatEntityState: (item) => item.state,
    localize: () => undefined,
  };
};
const line = (hass, device = marker(), t = en) => deviceBatteryTipText(device, createDeviceBatteryContext(hass), t);

test('#817 AC1 numeric charge is a rounded whole percent in every shipped language', () => {
  for (const [state, expected] of [
    ['0', 'Battery 0%'], ['100', 'Battery 100%'], ['37.6', 'Battery 38%'], ['37.4', 'Battery 37%'],
    ['0.4', 'Battery 0%'], ['99.5', 'Battery 100%'], [' 20.0 ', 'Battery 20%'], ['.5', 'Battery 1%'],
    ['+42', 'Battery 42%'], [42, 'Battery 42%'],
  ]) assert.equal(line(ha([['sensor.battery', state]])), expected, String(state));
  const hass = ha([['sensor.battery', '37.6']]);
  assert.equal(line(hass, marker(), ru), 'Заряд 38%');
  assert.equal(line(hass, marker(), translator('de')), 'Batterie 38 %');
  assert.equal(line(hass, marker(), translator('fr')), 'Batterie 38 %');
});

test('#817 AC1 binary off/on is normal/low in every shipped language, never a percent', () => {
  const off = ha([['binary_sensor.battery', 'off']]);
  const on = ha([['binary_sensor.battery', 'on']]);
  assert.equal(line(off), 'Battery normal');
  assert.equal(line(on), 'Low battery');
  assert.equal(line(off, marker(), ru), 'Заряд в норме');
  assert.equal(line(on, marker(), ru), 'Низкий уровень батареи');
  assert.equal(line(off, marker(), translator('de')), 'Batterie in Ordnung');
  assert.equal(line(on, marker(), translator('de')), 'Niedriger Batteriestand');
  assert.equal(line(off, marker(), translator('fr')), 'Batterie en bon état');
  assert.equal(line(on, marker(), translator('fr')), 'Batterie faible');
  assert.deepEqual(deviceBatteryReading(marker(), createDeviceBatteryContext(on)),
    { kind: 'binary', low: true, sourceEntityId: 'binary_sensor.battery' });
});

test('#817 AC1 the #792 source decides: first numeric by ID, else binary; a battery-entity marker reads itself', () => {
  const several = ha([['sensor.zzz_battery', '5'], ['binary_sensor.battery', 'on'], ['sensor.aaa_battery', '80']]);
  assert.equal(line(several), 'Battery 80%');
  const entityMarker = marker({ bindingKind: 'entity', bindingRef: 'binary_sensor.battery',
    marker: { id: 'd1', binding: 'entity:binary_sensor.battery' } });
  assert.equal(line(several, entityMarker), 'Low battery');
  const zzz = marker({ bindingKind: 'entity', bindingRef: 'sensor.zzz_battery',
    marker: { id: 'd1', binding: 'entity:sensor.zzz_battery' } });
  assert.equal(line(several, zzz), 'Battery 5%');
  // An ordinary entity marker inherits its own physical device's source.
  const temp = marker({ bindingKind: 'entity', bindingRef: 'sensor.temp',
    marker: { id: 'd1', binding: 'entity:sensor.temp' } });
  assert.equal(line(several, temp), 'Battery 80%');
});

for (const [label, state] of [
  ['unknown', 'unknown'], ['unavailable', 'unavailable'], ['empty', ''], ['whitespace', '  '],
  ['text', 'abc'], ['above range', '101'], ['negative', '-1'], ['just above range', '100.1'],
  ['unit suffix', '19%'], ['NaN', 'NaN'], ['Infinity', 'Infinity'], ['hexadecimal', '0x20'],
  ['comma', '19,9'], ['missing row', undefined], ['null', null], ['boolean', false],
]) test(`#817 AC2 numeric ${label} gives no line, not a normal charge`, () => {
  assert.equal(line(ha([['sensor.battery', state]])), '');
  assert.equal(deviceBatteryReading(marker(), createDeviceBatteryContext(ha([['sensor.battery', state]]))), null);
});

test('#817 AC2 binary unknown, unavailable, empty or non-HA text gives no line', () => {
  for (const state of ['unknown', 'unavailable', '', 'ON', 'low', 'normal', undefined]) {
    assert.equal(line(ha([['binary_sensor.battery', state]])), '', String(state));
  }
});

test('#817 AC2 an invalid selected source does not borrow another sensor', () => {
  assert.equal(line(ha([['sensor.aaa_battery', 'unavailable'], ['sensor.zzz_battery', '80'],
    ['binary_sensor.battery', 'off']])), '');
});

test('#817 AC2 a disabled entity or device gives no line even if a stale state is supplied', () => {
  const entity = ha([['sensor.battery', '80']]);
  entity.entities['sensor.battery'].disabled_by = 'user';
  assert.equal(line(entity), '');
  const device = ha([['sensor.battery', '80']]);
  device.devices.d1.disabled_by = 'integration';
  assert.equal(line(device), '');
  for (const kind of ['ha_disabled', 'orphaned', 'unverified']) {
    assert.equal(line(ha([['sensor.battery', '80']]), marker({ bindingStatus: { kind } })), '', kind);
  }
});

test('#817 AC2 non-battery and virtual devices get no line', () => {
  assert.equal(line(ha([])), '');
  assert.equal(line(ha([['sensor.humidity', '80', 'humidity']])), '');
  const hass = ha([['sensor.battery', '80']]);
  for (const device of [
    marker({ virtual: true }), marker({ bindingKind: 'virtual', bindingRef: '' }),
    marker({ bindingKind: undefined, bindingRef: undefined, marker: { id: 'd1', binding: 'virtual' } }),
    marker({ marker: { id: 'd1', binding: 'device:d1', removed: true } }),
  ]) assert.equal(line(hass, device), '');
});

test('#817 r1 a value badge already showing the selected battery sensor suppresses only the duplicate', () => {
  const numeric = ha([['sensor.battery', '37.6']]);
  const state = (entity_id) => ({ kind: 'entity_state', entity_id });
  const withBadge = (hass, badge, device = marker()) => deviceBatteryTipText(device,
    createDeviceBatteryContext(hass), en, badge);
  assert.equal(withBadge(numeric, state('sensor.battery')), '');
  for (const badge of [
    undefined, null, state('sensor.temp'), state('sensor.other_battery'),
    { kind: 'entity_attribute', entity_id: 'sensor.battery', attribute: 'voltage' },
    { kind: 'derived_lqi' }, { kind: 'derived_marker_state', ref: 'marker:d1' },
  ]) assert.equal(withBadge(numeric, badge), 'Battery 38%', JSON.stringify(badge));
  const binary = ha([['binary_sensor.battery', 'on']]);
  assert.equal(withBadge(binary, state('binary_sensor.battery')), '');
  assert.equal(withBadge(binary, state('sensor.temp')), 'Low battery');
  // The comparison is with the source the reader selected, not with any battery sensor.
  const several = ha([['sensor.aaa_battery', '80'], ['sensor.zzz_battery', '5']]);
  assert.equal(withBadge(several, state('sensor.zzz_battery')), 'Battery 80%');
  assert.equal(withBadge(several, state('sensor.aaa_battery')), '');
});

// The tooltip entry points with the production presentation resolver. The
// plan indicator is hidden in each case; the tooltip line must not be.
const tipHost = (hass, { showBattery = true, batteryLowOnly = false } = {}) => ({
  renderRoot: { querySelector: () => null },
  _tip: null,
  _mode: 'view',
  _drag: null,
  _deviceDrag: null,
  _config: { show_signal: true },
  _hoverRoom: null,
  _pointerModality: { hoverEnabled: true },
  _deviceHits: { hover: () => {} },
  _notePointer: () => {},
  _spaceModel: () => null,
  _roomHoverPaths: () => null,
  _spaceDisplayForRender: () => ({}),
  _devicePresentation: (device, showLqi) => resolveDevicePresentation(hass, device, {
    liveStates: true, showTemperature: true, showSignal: showLqi, showBattery, batteryLowOnly,
    registryHass: hass, sourceDetails: false,
  }),
  _t: (key, vars) => en(key, vars),
  _renderPlanHass: hass,
  _fullRegistryHass: hass,
});
const focusTarget = { matches: (selector) => selector === ':focus-visible', getBoundingClientRect: () => ({ right: 10, top: 20 }) };
const tips = (host, device) => {
  showDevicePointerTip(host, { clientX: 1, clientY: 2 }, device);
  const pointer = host._tip;
  showDeviceFocusTip(host, focusTarget, device);
  return { pointer, focus: host._tip };
};

test('#817 AC2 the line stays when the plan indicator is off, low-only or hidden for this device', () => {
  const hass = ha([['sensor.battery', '80']]);
  const hidden = marker({ marker: { id: 'd1', binding: 'device:d1', hide_battery: true } });
  for (const [label, settings, device] of [
    ['None', { showBattery: false }, marker()],
    ['Low only', { batteryLowOnly: true }, marker()],
    ['local hide', {}, hidden],
  ]) {
    const host = tipHost(hass, settings);
    assert.equal(host._devicePresentation(device, true).battery, null, `${label}: the plan indicator is hidden`);
    const { pointer, focus } = tips(host, device);
    assert.equal(pointer.source, 'pointer');
    assert.equal(focus.source, 'focus');
    for (const tip of [pointer, focus]) {
      assert.equal(tip.battery, 'Battery 80%', `${label}: ${tip.source}`);
    }
  }
});

test('#817 AC3 title and model row are unchanged; a non-battery or invalid device gets no line', () => {
  const withBattery = tips(tipHost(ha([['binary_sensor.battery', 'on']])), marker());
  const without = tips(tipHost(ha([])), marker());
  const invalid = tips(tipHost(ha([['sensor.battery', 'unavailable']])), marker());
  for (const source of ['pointer', 'focus']) {
    assert.equal(withBattery[source].battery, 'Low battery');
    assert.equal(without[source].battery, '');
    assert.equal(invalid[source].battery, '');
    for (const tip of [withBattery[source], without[source], invalid[source]]) {
      assert.equal(tip.title, 'Hallway sensor');
      assert.equal(tip.meta, 'TS0201');
    }
  }
});

test('#817 r1 tooltip: a badge on the same battery sensor is shown once, other badges keep the line', () => {
  const hass = ha([['sensor.battery', '37.6']]);
  hass.states['sensor.battery'].attributes.unit_of_measurement = '%';
  const badge = (source, enabled = true) => marker({
    marker: { id: 'd1', binding: 'device:d1', value_badge: { enabled, source, position: 'right' } },
  });
  const same = badge({ kind: 'entity_state', entity_id: 'sensor.battery' });
  const host = tipHost(hass);
  const presented = host._devicePresentation(same, true).valueBadge;
  assert.match(presented.fullText, /37\.6/, 'the badge itself shows the battery sensor');
  for (const tip of Object.values(tips(host, same))) {
    assert.equal(tip.battery, '', tip.source);
    assert.equal(tip.meta, `TS0201 · ${presented.fullText}`, tip.source);
  }
  for (const [label, device] of [
    ['badge on another entity', badge({ kind: 'entity_state', entity_id: 'sensor.temp' })],
    ['badge disabled', badge({ kind: 'entity_state', entity_id: 'sensor.battery' }, false)],
  ]) {
    for (const tip of Object.values(tips(tipHost(hass), device))) {
      assert.equal(tip.battery, 'Battery 38%', `${label}: ${tip.source}`);
    }
  }
});
