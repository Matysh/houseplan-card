import test from 'node:test';
import assert from 'node:assert/strict';
import { markerAlertFields, markerAlertOwnership, markerAlertValueControl, readMarkerAlertSource } from '../test-build/marker-alert-source.js';

const rule = { id: 'r', type: 'threshold', level: 'attention', entity_id: 'sensor.co2', operator: 'gt', value: 1000 };
const device = { id: 'd', bindingKind: 'device', bindingRef: 'd', bindingStatus: { kind: 'active' }, marker: { id: 'm', binding: 'device:d' } };
const registry = { entities: { 'sensor.co2': { device_id: 'd' }, 'binary_sensor.door': { device_id: 'd' }, 'sensor.foreign': { device_id: 'other' } }, devices: {} };

test('#1000 own index precedes every state/name read; exact and virtual cannot borrow siblings', () => {
  let reads = 0;
  const hass = { states: new Proxy({}, { get: () => { reads++; throw Error('foreign state read'); } }) };
  assert.equal(readMarkerAlertSource(hass, registry, device, { ...rule, entity_id: 'sensor.foreign' }).permitted, false);
  assert.equal(readMarkerAlertSource(hass, registry, { ...device, marker: { binding: 'entity:binary_sensor.door' } }, rule).permitted, false);
  assert.equal(readMarkerAlertSource(hass, registry, { ...device, virtual: true, marker: { binding: 'virtual' } }, rule).permitted, false);
  assert.equal(readMarkerAlertSource(hass, registry, { ...device, bindingStatus: { kind: 'ha_disabled' } }, rule).permitted, false);
  assert.equal(readMarkerAlertSource(hass, { ...registry, entities: { ...registry.entities, 'sensor.co2': { device_id: 'd', disabled_by: 'user' } } }, device, rule).permitted, false);
  assert.equal(reads, 0);
  assert.equal(markerAlertOwnership(registry, device, 'sensor.co2'), null);
});

test('#1000 known state controls retain raw HA strings and exclude malformed options', () => {
  const row = { state: 'on', attributes: { device_class: 'door' } };
  const hass = { formatEntityState: state => state.state === 'on' ? 'Открыто' : state.state };
  const binary = markerAlertValueControl(hass, 'binary_sensor.door', row);
  assert.equal(binary.kind, 'enum'); assert.deepEqual(binary.options[0], { value: 'on', label: 'Открыто' });
  const enumRow = { state: '123', attributes: { options: ['123', 'eco', 'eco', '', 42, null] } };
  assert.deepEqual(markerAlertValueControl({}, 'select.mode', enumRow).options.map(item => item.value), ['123', 'eco', 'unknown', 'unavailable']);
  assert.equal(markerAlertValueControl({}, 'sensor.mode', { state: 'eco', attributes: { device_class: 'enum' } }).kind, 'enum', 'missing enum options must never expose free text');
  const exact = { ...device, bindingKind: 'entity', bindingRef: 'select.mode', marker: { binding: 'entity:select.mode' } };
  const stateHass = { states: { 'select.mode': enumRow } };
  const target = { ...rule, entity_id: 'select.mode', operator: 'eq', value: '123' };
  assert.equal(readMarkerAlertSource(stateHass, {}, exact, target).value, '123');
  assert.equal(readMarkerAlertSource(stateHass, {}, exact, { ...target, value: 'removed' }).value, undefined);
  assert.equal(readMarkerAlertSource(stateHass, {}, exact, { ...target, operator: 'gt', value: 100 }).value, undefined);
});

test('#1000 field inventory is own scalars only; dotted keys stay one direct attribute', () => {
  const hass = { states: { 'sensor.co2': { state: '1100', attributes: { 'literal.key': 5, text: 'Ready', object: { value: 5 }, list: [5], flag: true, empty: null } } } };
  const fields = markerAlertFields(hass, registry, device).filter(field => field.entityId === 'sensor.co2');
  assert.deepEqual(fields.map(field => field.attribute), [undefined, 'literal.key', 'text']);
  assert.equal(readMarkerAlertSource(hass, registry, device, { ...rule, attribute: 'literal.key' }).value, 5);
  const inherited = { states: { 'sensor.co2': { state: '1100', attributes: Object.create({ guessed: 'on' }) } } };
  assert.equal(readMarkerAlertSource(inherited, registry, device, { ...rule, attribute: 'guessed' }).value, undefined, 'a direct HA attribute must be its own field, not a prototype fallback');
  const missing = readMarkerAlertSource({ states: {} }, registry, device, rule);
  assert.equal(missing.permitted, true); assert.equal(missing.value, undefined, 'missing telemetry is not a forged unavailable string');
});
