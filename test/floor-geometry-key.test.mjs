// #744/#769: the content key of a floor's records. `floorRecordKeyMemo` is the
// helper shared by the card's floor-geometry reader (#744) and the summary
// panel's per-floor area (#769).
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  floorGeometryKeyReader, floorRecordKeyMemo, openingWallIndexKey, physicalBodiesKey,
  sunGeometryKey, WALL_UNION_POOL_LIMIT, wallUnionKey, wallUnionPoolEntry, writeWallUnionPool,
} from '../test-build/floor-geometry-key.js';
import { lightGeometryFingerprint } from '../test-build/glow-scene.js';
import { computeSunRays } from '../test-build/sun.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';
import { openingWallIndex } from '../test-build/wall-thickness.js';

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

/** A one-slot memo by `key`, counting its builds: what the card does with a key. */
const memoOf = (key, build) => {
  let last = null;
  const memo = (...input) => {
    const k = key(...input);
    if (last?.k !== k) { memo.builds++; last = { k, value: build(...input) }; }
    return last.value;
  };
  memo.builds = 0;
  return memo;
};

test('#814 AC1: the opening wall index key — every input moves it, the cached index is the uncached one', () => {
  const scale = (input) => [1 / 240, input.cellCm, input.gridPitch];
  const keyOf = (input) => openingWallIndexKey(input.spaceId, input.rooms, input.walls, input.cuts, scale(input));
  const fresh = (input) => openingWallIndex(input.rooms, input.walls, input.cuts, 1 / 240, input.cellCm,
    input.gridPitch, 1000);
  const index = memoOf(keyOf, fresh);
  const input = {
    spaceId: 'f1', cellCm: 5, gridPitch: 1000 / 240,
    rooms: [
      { id: 'r1', name: 'Living', poly: [[100, 100], [500, 100], [500, 500], [100, 500]] },
      { id: 'r2', x: 500, y: 100, w: 300, h: 400 },
    ],
    walls: [{ key: 'w', cm: 15, a: [0.5, 0.1], b: [0.5, 0.5] }],
    cuts: [],
  };
  const steps = [
    ['a room point moved in place', () => { input.rooms[0].poly[1][0] = 520; }],
    ['a rect room moved in place', () => { input.rooms[1].w = 320; }],
    ['the room order', () => { input.rooms.reverse(); }],
    ['a room id', () => { input.rooms[0].id = 'r9'; }],
    ['a wall thickness in place', () => { input.walls[0].cm = 30; }],
    ['a wall endpoint in place', () => { input.walls[0].b[1] = 0.45; }],
    ['a wall key', () => { input.walls[0].key = 'w2'; }],
    ['an open cut', () => { input.cuts.push([500, 200, 500, 300]); }],
    ['the cell size', () => { input.cellCm = 10; }],
    ['the grid pitch', () => { input.gridPitch = 1000 / 120; }],
    ['the floor', () => { input.spaceId = 'f2'; }],
  ];
  let previous = keyOf(input);
  assert.deepEqual(index(input), fresh(input));
  for (const [name, change] of steps) {
    const builds = index.builds;
    change();
    assert.notEqual(keyOf(input), previous, `${name} moves the key`);
    previous = keyOf(input);
    assert.deepEqual(index(input), fresh(input), `${name}: the cached index is the uncached one`);
    assert.equal(index.builds, builds + 1, `${name}: one build`);
  }
  // What the index never reads leaves the key: a rename, a setting, another
  // floor, a new epoch with equal records (a server push), a Home Assistant tick.
  const builds = index.builds;
  input.rooms[0].name = 'Renamed';
  input.rooms[0].settings = { fill_mode: 'light' };
  assert.deepEqual(index(structuredClone(input)), fresh(input));
  assert.equal(index.builds, builds, 'no build');
});

test('#814 AC1: the sun key — every input moves it, the cached wedges are the uncached ones', () => {
  const rooms = [
    { id: 'r1', poly: [[100, 100], [500, 100], [500, 500], [100, 500]] },
    { id: 'r2', poly: [[500, 100], [800, 100], [800, 500], [500, 500]] },
  ];
  const input = {
    rooms, walls: [], cuts: [], bodies: 'f1|record|5|1000',
    windows: [{ id: 'wE', x: 800, y: 300, angle: 90, length: 60 }, { id: 'wS', x: 300, y: 500, angle: 0, length: 60 }],
    azimuth: 90, elevation: 20, north: 0, origin: 'inner', zero: { style: 'solid', barriers: [] },
  };
  const keyOf = (i) => sunGeometryKey(openingWallIndexKey('f1', i.rooms, i.walls, i.cuts, [1, 5, 1000]),
    i.bodies, i.windows, [i.azimuth, i.elevation, i.north, i.origin], i.zero);
  const fresh = (i) => computeSunRays(structuredClone(i.rooms), structuredClone(i.windows), i.azimuth, i.elevation,
    i.north, undefined, undefined, i.origin);
  const rays = memoOf(keyOf, fresh);
  assert.ok(rays(input).length > 0, 'the fixture is lit');
  const steps = [
    ['a window moved in place', () => { input.windows[0].y = 340; }],
    ['a window resized in place', () => { input.windows[0].length = 80; }],
    ['a window added', () => { input.windows.push({ id: 'wN', x: 300, y: 100, angle: 0, length: 60 }); }],
    ['a room point moved in place', () => { input.rooms[1].poly[1][0] = 760; input.rooms[1].poly[2][0] = 760; }],
    ['the azimuth', () => { input.azimuth = 200; }],
    ['the elevation', () => { input.elevation = 40; }],
    ['the compass', () => { input.north = 90; }],
    ['the ray origin', () => { input.origin = 'outer'; }],
  ];
  let previous = keyOf(input);
  for (const [name, change] of steps) {
    change();
    assert.notEqual(keyOf(input), previous, `${name} moves the key`);
    previous = keyOf(input);
    assert.deepEqual(rays(input), fresh(input), `${name}: the cached wedges are the uncached ones`);
  }
  for (const [name, change] of [
    ['a wall record', () => { input.walls.push({ key: 'w', cm: 15 }); }],
    ['an open cut', () => { input.cuts.push([500, 200, 500, 300]); }],
    ['the floor record of the bodies', () => { input.bodies = 'f1|moved partition|5|1000'; }],
    ['a solid zero wall', () => { input.zero = { style: 'solid', barriers: [[100, 300, 300, 300]] }; }],
    ['the zero-wall style', () => { input.zero = { ...input.zero, style: 'dashed' }; }],
  ]) {
    change();
    assert.notEqual(keyOf(input), previous, `${name} moves the key`);
    previous = keyOf(input);
  }
  rays(input);
  const builds = rays.builds;
  rays(structuredClone(input));
  assert.equal(rays.builds, builds, 'equal inputs in new objects (a server push, an epoch) build nothing');
});
