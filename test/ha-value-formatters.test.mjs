import test from 'node:test';
import assert from 'node:assert/strict';
import { haValueFormatters } from '../test-build/ha-value-formatters.js';
import { HaPlanHost } from '../test-build/ha-plan-host.js';
import { hassValue, valueWithUnit } from '../test-build/logic.js';
import { markerAlertValueControl } from '../test-build/marker-alert-source.js';

const state = { entity_id: 'sensor.tank', state: '68.42', attributes: { unit_of_measurement: '%', temperature: 21.53 } };

test('#1437 HA enrichment binds both formatters to their current source without leaking HA fields', () => {
  const source = {
    states: { 'sensor.tank': state }, language: 'ru', callWS() {}, auth: { private: true },
    formatEntityState(row) { assert.equal(this, source); return this.language + ':' + row.state + ' %'; },
    formatEntityAttributeValue(row, name, value = row.attributes[name]) { assert.equal(this, source); return this.language + ':' + value; },
  };
  const frame = { states: source.states, ...haValueFormatters(source) };
  assert.deepEqual(Object.keys(haValueFormatters(source)).sort(), ['formatEntityAttributeValue', 'formatEntityState']);
  assert.equal(valueWithUnit(hassValue(frame, 'sensor.tank'), '%', 'проц.'), 'ru:68.42 проц.');
  assert.deepEqual(hassValue(frame, 'sensor.tank', 'temperature'), { text: 'ru:21.53', formatted: true });
  assert.equal(frame.formatEntityAttributeValue(state, 'temperature', 7), 'ru:7', 'weather forecast override is forwarded');
  const next = { ...source, language: 'en', formatEntityState(row) { assert.equal(this, next); return this.language + ':' + row.state; } };
  assert.equal(haValueFormatters(next).formatEntityState(state), 'en:68.42');
  assert.equal(frame.formatEntityState(state), 'ru:68.42 %', 'an accepted frame retains its source');
  const presentation = new HaPlanHost(source).environment.presentation;
  assert.deepEqual(Object.keys(presentation).sort(), ['language', 'locale', 'localize', 'themes']);
  assert.equal(presentation.formatEntityState, undefined);
});

test('#1437 localized binary options retain raw values and absent/throwing formatters retain raw fallbacks', () => {
  const row = { state: 'on', attributes: {} };
  const frame = haValueFormatters({ formatEntityState(value) { return value.state === 'on' ? 'Открыто' : value.state === 'off' ? 'Закрыто' : value.state; } });
  assert.deepEqual(markerAlertValueControl(frame, 'binary_sensor.door', row).options.slice(0, 2), [
    { value: 'on', label: 'Открыто' }, { value: 'off', label: 'Закрыто' },
  ]);
  for (const source of [undefined, {}, { formatEntityState: null, formatEntityAttributeValue: true },
    { formatEntityState() { throw new Error('older HA'); }, formatEntityAttributeValue() { throw new Error('unsupported'); } }]) {
    const fallback = { states: { 'sensor.tank': state }, ...haValueFormatters(source) };
    assert.deepEqual(hassValue(fallback, 'sensor.tank'), { text: '68.42', formatted: false });
    assert.deepEqual(hassValue(fallback, 'sensor.tank', 'temperature'), { text: '21.53', formatted: false });
    assert.deepEqual(markerAlertValueControl(fallback, 'binary_sensor.door', row).options.slice(0, 2), [
      { value: 'on', label: 'on' }, { value: 'off', label: 'off' },
    ]);
  }
});
