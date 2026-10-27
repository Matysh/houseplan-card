import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alertNumber, alertOperand, evaluateMarkerAlert, normalizeMarkerAlert, normalizeMarkerAlerts } from '../test-build/marker-alert.js';

const contract = JSON.parse(readFileSync(new URL('./fixtures/marker-alerts.json', import.meta.url)));
test('#1000 shared TS/Python persisted contract rejects malformed new edits', () => {
  for (const entry of contract.cases) {
    const rule = { ...contract.rule, ...entry.patch };
    for (const key of entry.remove || []) delete rule[key];
    const parsed = normalizeMarkerAlert(rule);
    assert.equal(parsed !== null, entry.valid, entry.name);
    assert.equal(normalizeMarkerAlerts([rule]) !== null, entry.valid, entry.name);
    if (entry.valid) assert.deepEqual(parsed, rule, `${entry.name}: exact scalar values preserved`);
  }
  assert.deepEqual(normalizeMarkerAlerts([]), []);
  assert.equal(normalizeMarkerAlerts([contract.rule, contract.rule]), null, 'IDs are unique within a marker');
  assert.equal(normalizeMarkerAlerts(Array.from({ length: 4 }, (_, i) => ({ ...contract.rule, id: `r${i}` }))), null);
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(normalizeMarkerAlert({ ...contract.rule, value }), null);
  for (const length of [255, 256]) assert.equal(normalizeMarkerAlert({ ...contract.rule, operator: 'eq', value: '🧭'.repeat(length) }) !== null, length === 255);
});

test('#1000 finite full numbers, manual text and raw enum retain their distinct types', () => {
  for (const [raw, value] of [['0', 0], ['-1,5', -1.5], ['.25', .25], ['1e3', 1000], ['-2.5e-2', -.025]]) {
    assert.equal(alertNumber(raw), value); assert.equal(alertOperand(raw, 'gt'), value);
  }
  for (const raw of ['', ' ', '1 000', '1,000,000', '12 ppm', 'NaN', 'Infinity', '1e9999']) assert.equal(alertOperand(raw, 'gt'), null, raw);
  assert.equal(alertOperand('123', 'eq', true), '123');
  assert.equal(alertOperand('123', 'eq'), 123);
  assert.equal(alertOperand(' On ', 'eq'), ' On ');
  assert.equal(alertOperand('on', 'gt', true), null);
  assert.equal(alertNumber(true), null);
});

test('#1000 six comparisons use exact boundaries and incomparable ne never activates', () => {
  for (const [operator, at, below, above] of [
    ['eq', true, false, false], ['ne', false, true, true], ['gt', false, false, true],
    ['lt', false, true, false], ['ge', true, false, true], ['le', true, true, false],
  ]) {
    const rule = { ...contract.rule, operator, value: 0 };
    for (const [value, expected] of [[0, at], [-.1, below], [.1, above], ['0.0', at]]) assert.equal(evaluateMarkerAlert(rule, value), expected, `${operator} ${value}`);
    for (const missing of [null, undefined, '', 'unknown', 'unavailable', true, {}, [], NaN, Infinity, '1 ppm']) assert.equal(evaluateMarkerAlert(rule, missing), null, `${operator} rejects incomparable`);
  }
  assert.equal(evaluateMarkerAlert({ ...contract.rule, operator: 'eq', value: 'unavailable' }, 'unavailable'), true);
  assert.equal(evaluateMarkerAlert({ ...contract.rule, operator: 'ne', value: 'on' }, undefined), null);
  assert.equal(evaluateMarkerAlert({ ...contract.rule, operator: 'eq', value: '123' }, 123), null);
  assert.equal(evaluateMarkerAlert({ ...contract.rule, operator: 'eq', value: ' On ' }, 'On'), false);
});
