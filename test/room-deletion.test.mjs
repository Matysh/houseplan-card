import test from 'node:test';
import assert from 'node:assert/strict';
import { parameterOnPartition, planRoomDeletion } from '../test-build/room-deletion.js';

const interval = (patch = {}) => ({
  a: [0, 0], b: [100, 0], key: 'outer', kind: 'outer', cm: 20, open: false, ...patch,
});

test('Keep walls materializes only positive exclusive solids and reuses compatible masonry', () => {
  const plan = planRoomDeletion([
    interval(),
    interval({ a: [100, 0], b: [100, 100], key: 'shared', kind: 'shared' }),
    interval({ a: [0, 100], b: [100, 100], key: 'open', open: true }),
    interval({ a: [0, 0], b: [0, 100], key: 'zero', cm: 0 }),
  ], [{ id: 'existing', a: [0, 0], b: [120, 0], cm: 20 }], [], 0.001);
  assert.deepEqual(plan.materialize.map((item) => [item.interval.key, item.reusePartitionId]), [
    ['outer', 'existing'],
  ]);
});

test('exclusive room openings rehost or cascade while shared and hosted openings survive', () => {
  const plan = planRoomDeletion([
    interval(),
    interval({ a: [100, 0], b: [100, 100], key: 'shared', kind: 'shared' }),
  ], [], [
    { id: 'exclusive', x: 50, y: 0, angle: 0 },
    { id: 'shared', x: 100, y: 50, angle: 90 },
    { id: 'hosted', x: 20, y: 0, angle: 0, host: { kind: 'partition', id: 'p', t: 0.2 } },
  ], 0.001);
  assert.equal(plan.openingIntervals.get('exclusive'), 'outer');
  assert.deepEqual(plan.removeOpeningIds, ['exclusive']);
  assert.ok(!plan.openingIntervals.has('shared'));
  assert.ok(!plan.openingIntervals.has('hosted'));
});

test('opening host parameter is stable for either endpoint direction', () => {
  assert.equal(parameterOnPartition([25, 0], { a: [0, 0], b: [100, 0] }), 0.25);
  assert.equal(parameterOnPartition([25, 0], { a: [100, 0], b: [0, 0] }), 0.75);
});
