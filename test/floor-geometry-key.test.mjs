// #744/#769: the content key of a floor's records. `floorRecordKeyMemo` is the
// helper shared by the card's floor-geometry reader (#744) and the summary
// panel's per-floor area (#769).
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  floorGeometryKeyReader, floorRecordKeyMemo, physicalBodiesKey, WALL_UNION_POOL_LIMIT,
  wallUnionKey, wallUnionPoolEntry, writeWallUnionPool,
} from '../test-build/floor-geometry-key.js';
import { lightGeometryFingerprint } from '../test-build/glow-scene.js';
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

test('#769 AC8: one format of the union and bodies keys, the pool bound and its entry', () => {
  assert.equal(wallUnionKey('A|f', 3), 'A|f|3', 'the union key: the floor key and its room count');
  assert.equal(physicalBodiesKey('A|f', 5, 1000), 'A|f|5|1000', 'the bodies key: the floor key at a grid scale');
  assert.notEqual(physicalBodiesKey('A|f', 5, 1000), physicalBodiesKey('A|f', 10, 1000));

  const stored = record('A');
  const value = { d: 'M0 0Z' };
  const entry = wallUnionPoolEntry('A|f|1', value, stored, 5, 1000);
  assert.equal(entry.key, 'A|f|1');
  assert.equal(entry.value, value, 'the union itself is the value');
  assert.equal(value.sourceFingerprint, lightGeometryFingerprint(stored, 5, 1000),
    'the union carries the light fingerprint of the record it was built from');
  assert.deepEqual(Object.keys(value), ['d'], 'the fingerprint is not enumerable');
  assert.equal(wallUnionPoolEntry('A|f|0', null, stored, 5, 1000).value, null, 'no union: nothing to tag');

  const pool = new Map();
  for (let index = 0; index < WALL_UNION_POOL_LIMIT + 2; index++)
    assert.equal(writeWallUnionPool(pool, { key: `k${index}`, value: index }).key, `k${index}`);
  assert.equal(WALL_UNION_POOL_LIMIT, 8);
  assert.deepEqual([...pool.keys()], ['k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9'],
    'the oldest floors leave the full pool first');
  writeWallUnionPool(pool, { key: 'k2', value: 'again' });
  assert.deepEqual([...pool.keys()].at(-1), 'k2', 'a rewrite is the most recent');
  assert.equal(pool.size, WALL_UNION_POOL_LIMIT);
});
