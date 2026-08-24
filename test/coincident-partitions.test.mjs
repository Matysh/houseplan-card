import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { optimizePlans } from '../test-build/plan-optimizer.js';
import { checkOptimizeGeometry } from '../test-build/plan-geometry-preflight.js';
import { GRID_PITCH, GRID_STEP_N as S } from '../test-build/space-geometry.js';
import { wallIntervals } from '../test-build/wall-thickness.js';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/276-coincident-partition.json', import.meta.url),
  'utf8',
));
const clone = (value) => structuredClone(value);

const optimize = (config) => optimizePlans(config, {});

test('issue 276 reconciles the anonymized 5 cm offset fixture without moving its door', () => {
  const input = clone(fixture);
  const before = clone(input);
  const result = optimize(input);
  assert.deepEqual(input, before, 'Optimize preview must not mutate the source');
  assert.equal(result.changed, true);
  assert.equal(result.report.partitionsReconciled, 1);
  assert.equal(result.report.openingsRehosted, 1);

  const space = result.config.spaces[0];
  assert.equal(space.partitions, undefined);
  assert.equal(space.openings.length, 1);
  assert.deepEqual(space.openings[0], {
    id: 'hosted-door', type: 'door',
    x: 0.504166667, y: 0.5, angle: -90, length: 0.2,
    contact: 'binary_sensor.test_door', lock: 'lock.test_door',
    invert: true, flip_h: true, future_field: { keep: true },
  });
  const intervals = wallIntervals(
    space.rooms, space.walls, [], S, 5, GRID_PITCH, 1,
  ).filter((interval) => interval.kind === 'shared');
  assert.equal(intervals.length, 2);
  assert.deepEqual(new Set(intervals.map((interval) => interval.cm)), new Set([20]));
  assert.equal(checkOptimizeGeometry(result.config).ok, true);

  const second = optimize(result.config);
  assert.equal(second.changed, false);
  assert.equal(second.report.partitionsReconciled, 0);
  assert.equal(second.report.openingsRehosted, 0);
  assert.deepEqual(second.config, result.config);
});

test('issue 276 exact proof ignores endpoint direction and room order', () => {
  for (const reversePartition of [false, true]) {
    for (const reverseRooms of [false, true]) {
      const input = clone(fixture);
      const space = input.spaces[0];
      if (reversePartition) {
        [space.partitions[0].a, space.partitions[0].b] = [
          space.partitions[0].b, space.partitions[0].a,
        ];
        space.openings[0].host.t = 0.5;
      }
      if (reverseRooms) space.rooms.reverse();
      const result = optimize(input);
      assert.equal(result.report.partitionsReconciled, 1,
        `direction=${reversePartition}, rooms=${reverseRooms}`);
      assert.equal(result.report.openingsRehosted, 1);
      assert.equal(checkOptimizeGeometry(result.config).ok, true);
    }
  }
});

test('issue 276 fails closed for an orphan host, overlap, draft, column and unknown partition data', () => {
  const variants = [];

  const orphan = clone(fixture);
  orphan.spaces[0].openings[0].host.t = 2;
  variants.push(['invalid hosted opening', orphan]);

  const overlap = clone(fixture);
  overlap.spaces[0].openings.push({
    id: 'ordinary', type: 'door', x: 0.5041666666666667, y: 0.5,
    angle: 90, length: 0.2,
  });
  variants.push(['overlapping opening', overlap]);

  const draft = clone(fixture);
  draft.spaces[0].room_drafts = [{
    id: 'draft', points: [[0.5041666666666667, 0.2], [0.5041666666666667, 0.8]],
    segments: [{ cm: 15 }],
  }];
  variants.push(['overlapping draft', draft]);

  const column = clone(fixture);
  column.spaces[0].wall_columns = [{
    id: 'column', shape: 'circle', center: [0.5041666666666667, 0.5], cm: 20,
  }];
  variants.push(['overlapping column', column]);

  const futurePartition = clone(fixture);
  futurePartition.spaces[0].partitions[0].future_semantics = true;
  variants.push(['unknown partition data', futurePartition]);

  for (const [name, input] of variants) {
    const result = optimize(input);
    assert.equal(result.report.partitionsReconciled, 0, name);
    assert.equal(result.config.spaces[0].partitions.length, 1, name);
    assert.ok(result.config.spaces[0].openings[0].host, name);
  }
});
