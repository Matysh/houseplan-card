import test from 'node:test';
import assert from 'node:assert/strict';
import { markerDeletionCandidate } from '../test-build/marker-deletion.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';

for (const binding of ['virtual', 'entity:sensor.synthetic']) test(`#1287 ${binding} Delete owns its layout position, preserving every other owner`, () => {
  const config = commitWallSegmentModel({ model_version: 10, spaces: [{ id: 'f', rooms: [] }],
    markers: [{ id: 'target', binding }, { id: 'other', binding: 'virtual' }], settings: {} }).config;
  const layout = { target: { s: 'f', x: .25, y: .25, k: 4 }, other: { s: 'f', x: .5, y: .5 } };
  const original = structuredClone({ config, layout });
  const result = markerDeletionCandidate(config, [{ id: 'target', binding }], layout);
  assert.deepEqual(result.layout, { other: layout.other });
  assert.deepEqual([...result.cleanupIds], ['target']);
  assert.deepEqual({ config, layout }, original);
  if (binding === 'virtual') assert.equal(result.candidate.markers.some(m => m.id === 'target'), false);
  else assert.deepEqual(result.candidate.markers.find(m => m.id === 'target'),
    { id: 'target', binding, hidden: true, removed: true });
  const optimized = optimizePlans(result.candidate, result.layout);
  assert.equal(optimized.changed, false);
  assert.equal(optimized.report.orphanDevicePositionsRemoved, 0);
});
