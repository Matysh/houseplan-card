// #744/#769: the content key of a floor's records. `floorRecordKeyMemo` is the
// helper shared by the card's floor-geometry reader (#744) and the summary
// panel's per-floor area (#769).
import assert from 'node:assert/strict';
import test from 'node:test';

import { floorGeometryKeyReader, floorRecordKeyMemo } from '../test-build/floor-geometry-key.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';

const record = (id, cm = 15) => ({
  id, cell_cm: 5, rooms: [{ id: `${id}1`, poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]] }],
  walls: [{ key: 'k', cm, a: [0.1, 0.1], b: [0.5, 0.1] }],
});

const spied = () => {
  const calls = [];
  const keyOf = floorRecordKeyMemo((value) => {
    calls.push(value);
    return contentFingerprint(value);
  });
  return { calls, keyOf };
};

test('#769 record key: one record is fingerprinted alone, two different objects together', () => {
  const { keyOf } = spied();
  const a = record('A');
  assert.equal(keyOf(1, 's', 'A', a, a), `A|${contentFingerprint(a)}`);
  const preview = record('A', 30);
  assert.equal(keyOf(1, 't', 'A', preview, a), `A|${contentFingerprint([preview, a])}`,
    'a preview record and the stored one: both enter the key');
  const twin = structuredClone(a);
  assert.equal(keyOf(1, 'u', 'A', twin, a), `A|${contentFingerprint([twin, a])}`,
    'two objects are two records even with equal content');
  assert.notEqual(keyOf(1, 'v', 'A', record('A', 20), a), keyOf(1, 't', 'A', preview, a),
    'the content of the second record moves the key');
});

test('#769 record key: remembered per epoch and per record object', () => {
  const { calls, keyOf } = spied();
  const a = record('A');
  const first = keyOf(1, '0', 'A', a, a);
  for (let index = 0; index < 50; index++) assert.equal(keyOf(1, '0', 'A', a, a), first);
  assert.equal(calls.length, 1, 'the same epoch and objects: one fingerprint');
  const copy = structuredClone(a);
  assert.equal(keyOf(1, '0', 'A', copy, copy), first, 'a new object with the same content: the same key');
  assert.equal(calls.length, 2, '… after one more fingerprint');
  assert.equal(keyOf(2, '0', 'A', copy, copy), first);
  assert.equal(calls.length, 3, 'a new epoch fingerprints again');
  keyOf(2, '1', 'B', record('B'), record('B'));
  assert.equal(keyOf(2, '0', 'A', copy, copy), first, 'slots are separate');
  assert.equal(calls.length, 4);
});

test('#769 record key does not depend on the shown floor; the #744 reader keys a foreign floor with it', () => {
  const a = record('A');
  const b = record('B');
  const source = { _cfgEpoch: 1, _renderCfg: { spaces: [a, b] }, _curSpaceCfg: a };
  const reader = floorGeometryKeyReader(source);
  const { keyOf } = spied();
  const own = keyOf(1, '1', 'B', b, b);
  assert.equal(reader('A'), keyOf(1, '0', 'A', a, a), 'the shown floor: its own record');
  assert.equal(reader('B'), `B|${contentFingerprint([b, a])}`,
    '#744: a foreign floor is read next to the shown floor\'s record');
  source._curSpaceCfg = b;
  assert.equal(reader('B'), own, 'shown, B gets the record key');
  source._curSpaceCfg = a;
  assert.equal(keyOf(1, '1', 'B', b, b), own, 'the record key of B is the same whichever floor is shown');
});
