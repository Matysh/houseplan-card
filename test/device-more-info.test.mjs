import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDevices, resolvedDeviceStateEntities } from '../test-build/devices.js';
import { resolveDevicePresentation } from '../test-build/device-presentation.js';
import { resolveDeviceMoreInfoTarget, moreInfoEntityCandidates } from '../test-build/device-more-info.js';
import { markerMoreInfoFields, moreInfoDraftInvalid } from '../test-build/marker-more-info-fields.js';

function fixture(extra = {}) {
  const states = {
    'sensor.floor_temperature': { state: '24', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
    'climate.floor': { state: 'heat', attributes: { current_temperature: 24, temperature: 27, hvac_action: 'heating', hvac_modes: ['off', 'heat'] } },
    'switch.floor_lock': { state: 'off', attributes: {} },
    'sensor.foreign': { state: '20', attributes: {} },
  };
  const h = { states, devices: { floor: { id: 'floor', name: 'Тёплый пол', area_id: 'bathroom' }, other: { id: 'other' } },
    entities: Object.fromEntries(Object.keys(states).map(id => [id, { entity_id: id, device_id: id === 'sensor.foreign' ? 'other' : 'floor' }])) };
  const marker = { id: 'm', binding: 'device:floor', display: 'value', icon: 'mdi:radiator',
    value_source: { kind: 'entity_attribute', entity_id: 'climate.floor', attribute: 'current_temperature' }, ...extra };
  const ctx = { hass: h, markers: [marker], areaToSpace: { bathroom: 'f' }, firstSpaceId: 'f', settings: { filter_seeded: true }, excluded: new Set(), showAll: false, loc: key => key };
  const d = buildDevices(ctx).find(item => item.id === 'm');
  return { h, d, marker, ctx };
}

test('#1087 Auto uses the functional thermostat without rewriting the historical measurement primary', () => {
  const { h, d } = fixture();
  assert.equal(d.primary, 'sensor.floor_temperature'); // real old failure witness
  assert.deepEqual(resolvedDeviceStateEntities(h, d.entities), ['climate.floor']);
  assert.equal(resolveDeviceMoreInfoTarget(h, h, d).entityId, 'climate.floor');
  assert.equal(d.icon, 'mdi:radiator');
  assert.equal(d.marker.value_source.entity_id, 'climate.floor');
  assert.equal(d.primary, 'sensor.floor_temperature');
});

test('#1087 manual target is exact and independent from display, activity, controls and entity order', () => {
  const { h, d } = fixture({ more_info_entity: 'switch.floor_lock', state_source: { entity_id: 'climate.floor' }, controls: ['sensor.foreign'] });
  d.entities.reverse();
  assert.deepEqual(resolveDeviceMoreInfoTarget(h, h, d), { entityId: 'switch.floor_lock', explicit: true });
  assert.ok(!moreInfoEntityCandidates(d, h).includes('sensor.foreign'));
  for (const state of ['unknown', 'unavailable']) {
    h.states['switch.floor_lock'].state = state;
    assert.equal(resolveDeviceMoreInfoTarget(h, h, d).entityId, 'switch.floor_lock');
  }
});

for (const [name, alter, failure] of [
  ['foreign', f => { f.d.marker.more_info_entity = 'sensor.foreign'; }, 'foreign'],
  ['deleted', f => { delete f.h.entities['climate.floor']; }, 'missing'],
  ['no readable state', f => { delete f.h.states['climate.floor']; }, 'missing'],
  ['disabled entity', f => { f.h.entities['climate.floor'].disabled_by = 'user'; }, 'disabled'],
  ['disabled parent', f => { f.h.devices.floor.disabled_by = 'integration'; }, 'disabled'],
  ['moved entity', f => { f.h.entities['climate.floor'].device_id = 'other'; }, 'foreign'],
  ['malformed', f => { f.d.marker.more_info_entity = 'not an entity'; }, 'invalid'],
]) {
  test(`#1087 explicit ${name} refuses without sensor fallback`, () => {
    const f = fixture({ more_info_entity: 'climate.floor' }); alter(f);
    assert.deepEqual(resolveDeviceMoreInfoTarget(f.h, f.h, f.d), { failure, explicit: true });
  });
}

test('#1087 entity binding stays exact, including an unregistered YAML entity; virtual never borrows', () => {
  const f = fixture({ binding: 'entity:climate.floor', more_info_entity: 'sensor.foreign' });
  assert.deepEqual(moreInfoEntityCandidates(f.d, f.h), ['climate.floor']);
  assert.equal(resolveDeviceMoreInfoTarget(f.h, f.h, f.d).entityId, 'climate.floor');
  delete f.h.entities['climate.floor'];
  assert.equal(resolveDeviceMoreInfoTarget(f.h, f.h, f.d).entityId, 'climate.floor');
  f.d.marker.binding = 'virtual'; f.d.virtual = true;
  assert.equal(resolveDeviceMoreInfoTarget(f.h, f.h, f.d).entityId, undefined);
  assert.deepEqual(moreInfoEntityCandidates(f.d, f.h), []);
});

test('#1087 inactive or unverified device binding never supplies an HA target', () => {
  const { h, d } = fixture({ more_info_entity: 'climate.floor' });
  for (const kind of ['ha_disabled', 'orphaned', 'unverified']) {
    d.bindingStatus = { kind };
    assert.equal(resolveDeviceMoreInfoTarget(h, h, d).entityId, undefined);
  }
});

test('#1087 passive sensor keeps the historical measurement target; Auto also preserves climate unavailable', () => {
  const { h, d } = fixture();
  h.states['climate.floor'].state = 'unavailable';
  assert.equal(resolveDeviceMoreInfoTarget(h, h, d).entityId, 'climate.floor');
  d.entities = ['sensor.floor_temperature'];
  assert.equal(resolveDeviceMoreInfoTarget(h, h, d).entityId, 'sensor.floor_temperature');
  d.primary = 'sensor.foreign';
  assert.equal(resolveDeviceMoreInfoTarget(h, h, d).entityId, undefined);
});

test('#1087 Auto/null remain sparse, old selection is lossless, changed invalid ownership is blocked', () => {
  assert.deepEqual(markerMoreInfoFields({}), {});
  assert.deepEqual(markerMoreInfoFields({ moreInfoEntity: null }), { more_info_entity: null });
  assert.deepEqual(markerMoreInfoFields({ moreInfoEntity: null, moreInfoTouched: true }), {});
  assert.deepEqual(markerMoreInfoFields({ moreInfoEntity: 'climate.floor', moreInfoTouched: true }), { more_info_entity: 'climate.floor' });
  const { h } = fixture();
  const draft = { binding: 'device:floor', moreInfoEntity: 'sensor.foreign', moreInfoTouched: false };
  assert.equal(moreInfoDraftInvalid(draft, h, h), false);
  assert.equal(moreInfoDraftInvalid({ ...draft, moreInfoTouched: true }, h, h), true);
  assert.equal(moreInfoDraftInvalid({ ...draft, moreInfoTouched: true, moreInfoEntity: 'climate.floor' }, h, h), false);
  assert.equal(moreInfoDraftInvalid({ ...draft, binding: 'entity:climate.floor', moreInfoTouched: true }, h, h), true);
});

test('#1087 choosing an HA dialog does not change the rendered device presentation or saved projection', () => {
  const { h, d } = fixture();
  const options = { liveStates: true, showTemperature: true, showSignal: false, registryHass: h };
  const before = resolveDevicePresentation(h, d, options);
  const primary = d.primary, value = structuredClone(d.marker.value_source);
  d.marker.more_info_entity = 'switch.floor_lock';
  assert.deepEqual(resolveDevicePresentation(h, d, options), before);
  assert.equal(d.primary, primary);
  assert.deepEqual(d.marker.value_source, value);
});
