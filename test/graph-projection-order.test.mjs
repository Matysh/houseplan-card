import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateGraphSpace, verifyGraphProjection } from '../test-build/plan-graph.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const square = [[.1, .1], [.9, .1], [.9, .9], [.1, .9]];
const source = () => ({ model_version: 11, spaces: [migrateGraphSpace({
  id: 'projection-order', cell_cm: 5,
  rooms: [{ id: 'room', name: 'Room', area: null, poly: square,
    wall_ids: square.map((_, i) => `contour-${i}`) }],
  wall_segments: square.map((a, i) => ({ id: `contour-${i}`, a, b: square[(i + 1) % square.length], cm: 20 })),
  partitions: [{ id: 'part', a: [.2, .4], b: [.7, .4], cm: 20,
    future: { label: 'keep', flags: [true, { first: 1, second: 2 }] } }],
  openings: [{ id: 'door', type: 'door', x: .5, y: .4, angle: 0, length: .05,
    host: { kind: 'partition', id: 'part', t: .6 } }],
}, { sourceModelVersion: 10 }).space], markers: [] });
const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reverseKeys(item)])) : value;
const assertAccepted = config => {
  const original = structuredClone(config);
  assert.doesNotThrow(() => verifyGraphProjection(config.spaces[0], config.spaces[0].plan_graph));
  assert.deepEqual(commitWallSegmentModel(config).config, original);
  assert.deepEqual(config, original, 'reading a projection never mutates its source');
};

test('a Python-shaped walls projection is accepted regardless of object key order', () => {
  const config = source();
  assert.equal(config.spaces[0].walls.length, 4, 'positive-thickness compatibility projection is exercised');
  config.spaces[0].walls = config.spaces[0].walls.map(w => ({ key: w.key, a: w.a, b: w.b, cm: w.cm }));
  assertAccepted(config);
});

test('nested projection properties and graph metadata retain meaning across JSON key permutations', () => {
  assertAccepted(reverseKeys(source()));
});

for (const [name, corrupt] of [
  ['coordinate', sp => { sp.walls[0].a[0] += 1 / 240; }],
  ['missing field', sp => { delete sp.walls[0].cm; }],
  ['added field', sp => { sp.walls[0].unexpected = true; }],
  ['array order', sp => { sp.walls.reverse(); }],
  ['opaque array value', sp => { sp.partitions[0].future.flags.reverse(); }],
]) test(`key-order tolerance still refuses an inconsistent ${name}`, () => {
  const config = reverseKeys(source()), sp = config.spaces[0];
  corrupt(sp);
  const frozen = structuredClone(config);
  assert.throws(() => verifyGraphProjection(sp, sp.plan_graph), /projection/);
  assert.throws(() => commitWallSegmentModel(config), /projection-only-write/);
  assert.deepEqual(config, frozen, 'refusal does not repair the authored source');
});
