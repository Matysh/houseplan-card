import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherSource, weatherSources, weatherNumber, weatherDirection, weatherDays, WeatherForecastSubscription } from '../test-build/summary-weather.js';
import { normalizeSummaryDraft, validateSummaryDraft, summaryPanelEntityIds } from '../test-build/summary-panel.js';

const state = (name = 'Home') => ({ state: 'cloudy', attributes: { friendly_name: name, supported_features: 1 } });
const panel = weather => ({ version: 1, title: 'Home', show_on_mobile: true, blocks: [], weather });
test('weather source: one auto source, explicit multiple choice, deleted selection never falls back', () => {
  assert.equal(weatherSource({ enabled: false, entity_id: 'weather.home' }, {}), null);
  assert.equal(weatherSource({ enabled: true }, {}), null);
  assert.equal(weatherSource({ enabled: true }, { 'weather.home': state() }), 'weather.home');
  const states = { 'weather.home': state(), 'weather.country': state(), 'sensor.forecast': state() };
  assert.equal(weatherSource({ enabled: true }, states), null);
  assert.equal(weatherSource({ enabled: true, entity_id: 'weather.deleted' }, states), 'weather.deleted');
  assert.equal(weatherSources(states).length, 2);
  const value = panel({ enabled: true, entity_id: 'weather.home' });
  assert.deepEqual(normalizeSummaryDraft(value).weather, value.weather);
  assert.ok(summaryPanelEntityIds(value).includes('weather.home'));
  assert.equal(validateSummaryDraft(value, null, new Set(), new Set())[0].kind, 'error');
  assert.equal(validateSummaryDraft(value, value, new Set(), new Set())[0].kind, 'warning');
  assert.deepEqual(validateSummaryDraft(value, null, new Set(), new Set(['weather.home'])), []);
});
test('optional values keep real zero; bearing and daily forecast respect timezone and chronological order', () => {
  for (const bad of [null, '', undefined, NaN, Infinity, '0']) assert.equal(weatherNumber(bad), null);
  assert.equal(weatherNumber(0), 0);
  assert.equal(weatherDirection(225), 5); assert.equal(weatherDirection(270), 6);
  assert.equal(weatherDirection(-90), 6); assert.equal(weatherDirection('SW'), 5);
  assert.equal(weatherDirection(undefined), null); assert.equal(weatherDirection(''), null);
  const rows = weatherDays([
    { datetime: '2026-11-04T12:00:00Z', temperature: 4 },
    { datetime: 'bad', temperature: 10 },
    { datetime: '2026-11-02T12:00:00Z', temperature: 0 },
    { datetime: '2026-11-03T12:00:00Z', temperature: 3 },
    { datetime: '2026-11-03T13:00:00Z', temperature: 99 },
    { datetime: '2026-11-01T12:00:00Z', temperature: 1 },
    { datetime: '2026-11-05T12:00:00Z', temperature: 5 },
  ], new Date('2026-11-01T23:30:00Z'), 'Europe/Moscow');
  assert.deepEqual(rows.map(row => row.temperature), [0, 3, 4]);
});
test('one forecast consumer retires pending subscriptions, stale events and changed user/connection', async () => {
  const subscriptions = []; let releases = 0, updates = 0;
  const connection = { subscribeMessage(callback, message) {
    return new Promise(resolve => subscriptions.push({ callback, message, resolve }));
  } };
  const hass = { states: { 'weather.home': state(), 'weather.country': state() }, connection, user: { id: 'one' } };
  const consumer = new WeatherForecastSubscription(() => updates++);
  consumer.update(hass, 'weather.home', true);
  consumer.update({ ...hass }, 'weather.home', true);
  assert.equal(subscriptions.length, 1);
  assert.deepEqual(subscriptions[0].message, { type: 'weather/subscribe_forecast', entity_id: 'weather.home', forecast_type: 'daily' });
  subscriptions[0].callback({ type: 'daily', forecast: [{ temperature: 1 }] });
  assert.equal(consumer.forecast.length, 1);
  consumer.update(hass, 'weather.country', true);
  assert.deepEqual(consumer.forecast, []);
  subscriptions[0].callback({ forecast: [{ temperature: 99 }] });
  subscriptions[0].resolve(() => { releases++; }); await Promise.resolve();
  assert.equal(releases, 1); assert.deepEqual(consumer.forecast, []);
  subscriptions[1].resolve(() => { releases++; }); await Promise.resolve();
  consumer.update({ ...hass, user: { id: 'two' } }, 'weather.country', true);
  assert.equal(releases, 2); assert.equal(subscriptions.length, 3);
  consumer.update(hass, 'weather.country', false);
  subscriptions[2].resolve(() => { releases++; }); await Promise.resolve();
  assert.equal(releases, 3);
  const second = { ...connection };
  consumer.update({ ...hass, connection: second }, 'weather.home', true);
  assert.equal(subscriptions.length, 4);
  subscriptions[3].callback({ type: 'hourly', forecast: [1] }); assert.deepEqual(consumer.forecast, []);
  consumer.stop(); assert.ok(updates >= 2);
});
test('unsupported and unavailable sources never subscribe; rejection preserves current weather without a retry loop', async () => {
  let count = 0;
  const connection = { subscribeMessage() { count++; return Promise.reject(new Error('unsupported')); } };
  const hass = { states: { 'weather.home': state() }, connection };
  const consumer = new WeatherForecastSubscription(() => {});
  consumer.update(hass, 'weather.home', true); await new Promise(resolve => setImmediate(resolve));
  for (let i = 0; i < 5; i++) consumer.update(hass, 'weather.home', true);
  assert.equal(count, 1); assert.deepEqual(consumer.forecast, []);
  consumer.update({ ...hass, states: { 'weather.home': { state: 'unavailable' } } }, 'weather.home', true);
  consumer.update({ ...hass, states: { 'weather.home': { attributes: { supported_features: 2 } } } }, 'weather.home', true);
  assert.equal(count, 1); consumer.stop();
});
