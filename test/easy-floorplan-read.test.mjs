import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_EASY_BYTES, readEasy, easyFloors } from '../scripts/sh3d-convert/easy-read.mjs';
import { estimateEasyScale } from '../scripts/sh3d-convert/easy-scale.mjs';

test('#937 the same card reads from YAML and JSON, without YAML 1.1 y coercion', () => {
  const card = { type: 'custom:easy-floorplan-card', width: 1000, items: [{ x: 1, y: 2 }] };
  assert.deepEqual(readEasy('type: custom:easy-floorplan-card\nwidth: 1000\nitems:\n  - x: 1\n    y: 2'), card);
  assert.deepEqual(readEasy(JSON.stringify(card)), card);
  assert.equal(easyFloors(card)[0].id, 'main');
  const two = { ...card, floors: [{ id: 'a' }, { id: 'b' }] };
  assert.deepEqual(easyFloors(two), two.floors, 'explicit floors do not duplicate the legacy arrays');
});

test('#937 rejects unsafe YAML, duplicate/prototype keys and malformed roots', () => {
  for (const text of [
    '', '[]', 'type: other', 'type: custom:easy-floorplan-card\nwidth: 1\nwidth: 2',
    '{"type":"custom:easy-floorplan-card","__proto__":{}}',
    'type: custom:easy-floorplan-card\na: &a [1]\nb: *a',
    'type: custom:easy-floorplan-card\na: !!str something',
    '%YAML 1.1\n---\ntype: custom:easy-floorplan-card',
    'type: custom:easy-floorplan-card\nwidth: .inf',
    'type: custom:easy-floorplan-card\nwidth: -1',
    'type: custom:easy-floorplan-card\nfloors: {}',
    'type: custom:easy-floorplan-card\nitems: [null]',
    'type: custom:easy-floorplan-card\nitems: {}',
    'type: custom:easy-floorplan-card\n---\ntype: custom:easy-floorplan-card',
  ]) assert.throws(() => readEasy(text), error => Boolean(error.code), text);
  assert.equal({}.polluted, undefined);
  assert.throws(() => readEasy(' '.repeat(MAX_EASY_BYTES + 1) + '{}'));
  assert.throws(() => readEasy('type: custom:easy-floorplan-card\nx: ' + '['.repeat(70) + '0' + ']'.repeat(70)));
  assert.throws(() => readEasy(JSON.stringify({ type: 'custom:easy-floorplan-card', items: Array.from({ length: 5001 }, () => ({})) })));
});

test('#937 scale is automatic: ordinary-door median, known furniture, then explicit fallback', () => {
  const floors = [{ openings: [
    { type: 'door', length: 80 }, { type: 'door', length: 100 },
    { type: 'door', length: 300, motion: 'roll' },
    { type: 'door', length: 200, sash: 'double' }, { type: 'window', length: 500 },
  ] }];
  assert.deepEqual(estimateEasyScale(floors), { cmPerUnit: 1, basis: 'doors', count: 2 });
  assert.equal(estimateEasyScale([{ openings: [{ type: 'door', length: 9 }] }]).cmPerUnit, 10);
  const defaults = [{ id: 'sofa', w: 180, h: 90 }];
  assert.deepEqual(estimateEasyScale([{ furniture: [{ type: 'sofa', w: 18, h: 9 }] }], defaults),
    { cmPerUnit: 10, basis: 'furniture', count: 1 });
  assert.deepEqual(estimateEasyScale([{ furniture: [{ type: 'unknown', w: 18, h: 9 }] }], defaults),
    { cmPerUnit: 1, basis: 'default', count: 0 });
  assert.deepEqual(estimateEasyScale([]), { cmPerUnit: 1, basis: 'default', count: 0 });
});
