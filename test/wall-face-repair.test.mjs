import test from 'node:test';
import assert from 'node:assert/strict';
import { planWallFaceRepair } from '../test-build/wall-face-repair.js';

const ringWithGap = (gap) => [
  { a: [0, 0], b: [100, 0], key: 'static:partition|top|0' },
  { a: [100, 0], b: [100, 100], key: 'static:partition|right|0' },
  { a: [100, 100], b: [0, 100], key: 'static:partition|bottom|0' },
  { a: [0, 100], b: [0, gap], key: 'static:partition|left|0' },
];

test('one endpoint gap up to and including 2 cm produces one exact bounded face', () => {
  for (const gap of [1.2, 2]) {
    const sources = ringWithGap(gap);
    const snapshot = structuredClone(sources);
    const result = planWallFaceRepair(sources, {
      point: [50, 50], maxDistance: 2, gridStep: 10, epsilon: 0.001,
    });
    assert.equal(result.kind, 'repair');
    assert.equal(result.proposal.distance, gap);
    assert.equal(result.face.area, 10000);
    assert.deepEqual(sources, snapshot, 'planning is immutable');
  }
  assert.equal(planWallFaceRepair(ringWithGap(2.01), {
    point: [50, 50], maxDistance: 2, gridStep: 10, epsilon: 0.001,
  }).kind, 'none');
});

test('an independent endpoint may repair to the interior of a solid target line', () => {
  const result = planWallFaceRepair([
    { a: [0, 0], b: [100, 0], key: 'static:room|edge|0' },
    { a: [50, 1.2], b: [100, 50], key: 'active:session:0' },
    { a: [100, 50], b: [50, 100], key: 'static:partition|right|0' },
    { a: [50, 100], b: [0, 50], key: 'static:partition|bottom|0' },
    { a: [0, 50], b: [0, 0], key: 'static:partition|left|0' },
  ], { point: [50, 40], maxDistance: 2, gridStep: 10, epsilon: 0.001 });
  assert.equal(result.kind, 'repair');
  assert.equal(result.proposal.targetKind, 'line');
  assert.deepEqual(result.proposal.to, [50, 0]);
  assert.ok(!result.proposal.sourceKey.startsWith('static:room|'));
});

test('multiple valid closures fail closed instead of choosing record order', () => {
  const base = ringWithGap(1.2);
  base.push({ a: [1, 0], b: [1, -10], key: 'static:partition|alternative|0' });
  const result = planWallFaceRepair(base, {
    point: [50, 50], maxDistance: 2, gridStep: 10, epsilon: 0.001,
  });
  assert.notEqual(result.kind, 'repair');
});
