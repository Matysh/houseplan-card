import test from 'node:test';
import assert from 'node:assert/strict';
import { co2DeviceValue, co2For, co2Value, isCo2Entity } from '../test-build/room-co2.js';
import { roomClimateMap, sourceValue } from '../test-build/devices.js';
import { spaceDisplayOf } from '../test-build/logic.js';
import { newSpaceDialogDraft, savedSpaceDialogDraft, spaceDialogSettings } from '../test-build/editors/space-dialog-draft.js';
import { roomDraftKey } from '../test-build/editors/room-form-state.js';

const reading = (state, attributes = {}) => ({ state,
  attributes: { device_class: 'carbon_dioxide', unit_of_measurement: 'ppm', ...attributes } });
const hassFor = (state, attributes) => ({
  devices: { air: { id: 'air', name: 'Generic sensor', area_id: 'living' } },
  entities: { 'sensor.air_co2': { device_id: 'air', platform: 'demo' } },
  states: { 'sensor.air_co2': reading(state, attributes) },
});

test('#920 shared space drafts retain legacy source, display, fill and calibration defaults', () => {
  for (const imperial of [false, true]) {
    const created = newSpaceDialogDraft(imperial);
    assert.equal(created.source, 'file');
    assert.equal(created.showNames, false); assert.equal(created.displayTouched, false);
    assert.equal(created.customFill.a, 0); assert.equal(created.labelCo2, false);
    assert.equal(created.tempMinInput, String(created.tempMin));
    const settings = { label_co2: true, label_temp: true, label_hum: true, label_light: true,
      label_lqi: true, fill_mode: 'none', north_deg: 42, sun_rays: false, card_font_scale: 1.5 };
    const saved = savedSpaceDialogDraft({ id: 's', title: 'Floor', plan_url: 'floor.svg', cell_cm: 7, settings }, imperial);
    assert.equal(saved.mode, 'edit'); assert.equal(saved.spaceId, 's'); assert.equal(saved.source, 'file');
    assert.equal(saved.fillMode, 'custom'); assert.equal(saved.customFill.a, 0);
    assert.equal(saved.labelCo2, true); assert.equal(saved.cardFontScale, 1.5);
    assert.equal(saved.northDeg, 42); assert.equal(saved.northDegInput, '42');
    assert.equal(saved.sunRays, false); assert.equal(saved.cellCm, 7);
    assert.equal(saved.displayTouched, true);
    const written = spaceDialogSettings(saved, { future: 'preserve', label_co2: false });
    assert.equal(written.future, 'preserve'); assert.equal(written.label_co2, true);
    assert.equal(written.sun_rays, false); assert.equal(written.north_deg, 42);
    assert.equal(written.card_name_scale, 1.5); assert.equal(written.card_label_scale, 1.5); assert.equal(written.custom_fill.a, 0);
    assert.equal(savedSpaceDialogDraft({ id: 's', title: 'Floor' }, imperial).source, 'draw');
    assert.deepEqual(settings, { label_co2: true, label_temp: true, label_hum: true, label_light: true,
      label_lqi: true, fill_mode: 'none', north_deg: 42, sun_rays: false, card_font_scale: 1.5 });
  }
});

test('#920 changing only the CO2 draft source participates in dirty/discard state', () => {
  const draft = { _roomCo2Src: '', _roomTempSrc: '', _roomHumSrc: '' };
  assert.notEqual(roomDraftKey(draft), roomDraftKey({ ...draft, _roomCo2Src: 'entity:sensor.co2' }));
  assert.equal(roomDraftKey(draft), roomDraftKey({ ...draft }));
});

test('#920 CO₂ is strict default-off without changing other room-card flags', () => {
  for (const value of [undefined, false, null, 'true', 1]) {
    assert.equal(spaceDisplayOf({ settings: { label_co2: value, label_temp: true } }).labelCo2, false);
  }
  assert.equal(spaceDisplayOf({ settings: { label_co2: true, label_hum: false } }).labelCo2, true);
  assert.equal(spaceDisplayOf({ settings: { label_co2: true, label_hum: false } }).labelHum, false);
});

test('#920 CO₂ reads the whole finite decimal state, never absent data as zero', () => {
  for (const state of ['', ' ', 'unknown', 'unavailable', '850 ppm', '850garbage', 'NaN', 'Infinity', '-1', true, null]) {
    assert.equal(co2Value(hassFor(state), 'sensor.air_co2'), null, String(state));
  }
  for (const state of ['0', '850.49', ' 851.5 ', '8.5e2']) {
    assert.equal(co2Value(hassFor(state), 'sensor.air_co2'), Number(state));
  }
  for (const device_class of ['carbon_monoxide', 'co2', 'volatile_organic_compounds_parts', 'aqi', undefined]) {
    assert.equal(co2Value(hassFor('850', { device_class }), 'sensor.air_co2'), null);
  }
  for (const unit_of_measurement of ['ppb', '%', '', undefined]) {
    assert.equal(co2Value(hassFor('850', { unit_of_measurement }), 'sensor.air_co2'), null);
  }
  assert.equal(isCo2Entity(hassFor('unavailable'), 'sensor.air_co2'), true);
});

test('#920 stable physical source sibling and final-only rounding', () => {
  const h = hassFor('unavailable');
  h.entities['sensor.a'] = { device_id: 'air', platform: 'demo' };
  h.entities['sensor.b'] = { device_id: 'air', platform: 'demo' };
  h.states['sensor.a'] = reading('800.4'); h.states['sensor.b'] = reading('950.9');
  assert.equal(co2For(h, ['sensor.b', 'sensor.air_co2', 'sensor.a']), 800.4);
  assert.equal(co2DeviceValue(h, 'air'), 800);
  assert.equal(sourceValue(h, 'entity:sensor.b', 'co2'), 951);
  assert.equal(sourceValue(h, 'device:air', 'co2'), 800);
  const next = { ...h, states: { ...h.states, 'sensor.a': reading('unavailable') } };
  assert.equal(co2DeviceValue(next, 'air'), 951, 'metadata index must not cache a stale state');
});

test('#920 CO₂-only rooms and icons do not depend on temperature or humidity', () => {
  const h = hassFor('800.4');
  h.devices.second = { id: 'second', name: 'Unrelated icon', area_id: 'living' };
  h.entities['sensor.second_co2'] = { device_id: 'second', platform: 'demo' };
  h.states['sensor.second_co2'] = reading('801.4');
  assert.deepEqual(roomClimateMap(h).get('living'), { temp: null, hum: null, co2: 801 });
});

test('#920 exact room placement, hidden aliases and tombstones preserve physical identity', () => {
  const h = hassFor('850');
  const markers = [
    { id: 'parent', binding: 'device:air', space: 'f1', area: 'living', hidden: true },
    { id: 'child', binding: 'entity:sensor.air_co2', space: 'f1', area: null, room_id: 'office', hidden: true },
  ];
  const values = roomClimateMap(h, undefined, markers);
  assert.equal(values.get('living'), undefined);
  assert.equal(values.get('@room/f1/office').co2, 850);
  assert.equal(roomClimateMap(h, undefined, [{ id: 'gone', binding: 'device:air', removed: true }]).size, 0);
  assert.equal(sourceValue(h, 'device:air', 'co2', [{ id: 'gone', binding: 'device:air', removed: true }]), null);
  assert.equal(roomClimateMap(h, undefined, [
    { id: 'gone', binding: 'device:air', removed: true }, markers[1],
  ]).get('@room/f1/office').co2, 850);
  h.devices.air.disabled_by = 'user';
  assert.equal(co2Value(h, 'sensor.air_co2'), null);
  assert.equal(roomClimateMap(h, undefined, markers).size, 0);
});

test('#920 physical aliases vote once; automatic exclusions do not block an explicit active source', () => {
  const h = hassFor('800');
  h.devices.other = { id: 'other', name: 'Sensor', area_id: 'living' };
  h.entities['sensor.other_co2'] = { device_id: 'other', platform: 'demo' };
  h.states['sensor.other_co2'] = reading('1000');
  const markers = [
    { id: 'a', binding: 'device:air', space: 'f1', area: 'living' },
    { id: 'ae', binding: 'entity:sensor.air_co2', space: 'f1', area: 'living', hidden: true },
  ];
  assert.equal(roomClimateMap(h, undefined, markers).get('living').co2, 900);
  assert.equal(roomClimateMap(h, undefined, markers, new Set(['demo'])).size, 0);
  assert.equal(sourceValue(h, 'entity:sensor.air_co2', 'co2', markers), 800);
  h.states['sensor.air_co2'] = reading('unavailable');
  assert.equal(sourceValue(h, 'entity:sensor.air_co2', 'co2', markers), null, 'no automatic fallback');
  assert.equal(roomClimateMap(h, undefined, markers).get('living').co2, 1000);
});
