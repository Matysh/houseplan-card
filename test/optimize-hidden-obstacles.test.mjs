import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { optimizePlans } from '../test-build/plan-optimizer.js';
import { GRID_PITCH, GRID_STEP_N as S } from '../test-build/space-geometry.js';
import { wallIntervals, wallKey } from '../test-build/wall-thickness.js';

const clone = (value) => structuredClone(value);
const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/real-plan-second-floor.json', import.meta.url), 'utf8',
));

const configOf = (space) => ({ model_version: 7, spaces: [space], markers: [], settings: {} });

test('issue 296 real second floor removes all three hidden blockers in one Optimize', () => {
  const input = configOf(clone(fixture.space));
  const before = clone(input);
  const result = optimizePlans(input, {});
  assert.deepEqual(input, before, 'preview must stay immutable');
  assert.equal(result.changed, true);
  assert.ok(result.report.partitionsReconciled >= 2);
  assert.equal(result.report.removedDrafts, 1);
  const space = result.config.spaces[0];
  assert.equal(space.partitions, undefined);
  assert.equal(space.room_drafts, undefined);

  const leftProfile = wallIntervals(
    space.rooms, space.walls, [], S, space.cell_cm, GRID_PITCH, 1,
  ).filter((interval) => Math.abs(interval.a[0] + 1.6708333333333334) < 1e-8
    && Math.abs(interval.b[0] + 1.6708333333333334) < 1e-8
    && Math.min(interval.a[1], interval.b[1]) >= 1.2666666666666666 - 1e-8
    && Math.max(interval.a[1], interval.b[1]) <= 3.8666666666666667 + 1e-8);
  assert.ok(leftProfile.length >= 3);
  assert.deepEqual(new Set(leftProfile.map((interval) => interval.cm)), new Set([30]));

  const second = optimizePlans(result.config, result.layout);
  assert.equal(second.changed, false);
  assert.equal(second.report.partitionsReconciled, 0);
  assert.equal(second.report.removedDrafts, 0);
  assert.deepEqual(second.config, result.config);
});

test('issue 296 reconciles the covered middle and keeps deterministic disjoint residuals', () => {
  const space = {
    id: 'partial', title: 'Partial', view_box: [-0.3, -0.3, 1.6, 1.6], cell_cm: 5,
    rooms: [{
      id: 'room', name: 'room', area: null,
      poly: [[0, 0], [1, 0], [1, 1], [0, 1]],
    }],
    walls: [{ key: wallKey([0, 0], [1, 0], S), a: [0, 0], b: [1, 0], cm: 15 }],
    partitions: [{ id: 'long-wall', a: [-0.25, 0], b: [1.25, 0], cm: 20 }],
  };
  const first = optimizePlans(configOf(space), {});
  assert.equal(first.report.partitionsReconciled, 1);
  assert.equal(first.config.spaces[0].partitions.length, 2);
  assert.equal(first.config.spaces[0].partitions[0].id, 'long-wall');
  assert.match(first.config.spaces[0].partitions[1].id, /^long-wall~r-/);
  assert.deepEqual(first.config.spaces[0].partitions.map((partition) => [partition.a, partition.b]), [
    [[-0.25, 0], [0, 0]],
    [[1, 0], [1.25, 0]],
  ]);
  const ids = first.config.spaces[0].partitions.map((partition) => partition.id);
  const second = optimizePlans(first.config, first.layout);
  assert.equal(second.changed, false);
  assert.deepEqual(second.config.spaces[0].partitions.map((partition) => partition.id), ids);
});

test('issue 296 draft cleanup is all-or-nothing and preserves legal unfinished work', () => {
  const space = {
    id: 'drafts', title: 'Drafts', view_box: [-0.2, -0.2, 1.4, 1.4], cell_cm: 5,
    rooms: [{
      id: 'room', name: 'room', area: null,
      poly: [[0, 0], [1, 0], [1, 1], [0, 1]],
    }],
    walls: [
      { key: wallKey([0, 1], [1, 1], S), a: [0, 1], b: [1, 1], cm: 15 },
    ],
    room_drafts: [
      { id: 'hidden', points: [[0, 0], [1, 0]], segments: [{ cm: 15 }] },
      { id: 'free', points: [[0, 0.5], [1, 0.5]], segments: [{ cm: 15 }] },
      { id: 'partial', points: [[-0.1, 0], [0.5, 0]], segments: [{ cm: 15 }] },
      { id: 'thicker', points: [[0, 1], [1, 1]], segments: [{ cm: 30 }] },
    ],
  };
  const result = optimizePlans(configOf(space), {});
  assert.equal(result.report.removedDrafts, 1);
  assert.deepEqual(result.config.spaces[0].room_drafts.map((draft) => draft.id), [
    'free', 'partial', 'thicker',
  ]);
  assert.deepEqual(result.config.spaces[0].room_drafts,
    space.room_drafts.filter((draft) => draft.id !== 'hidden'));
});

test('issue 296 an opening across a structural breakpoint keeps the source partition intact', () => {
  const space = {
    id: 'opening-boundary', title: 'Opening boundary', view_box: [0, 0, 1, 1], cell_cm: 5,
    rooms: [
      { id: 'left', name: 'left', area: null,
        poly: [[0, 0], [0.5, 0], [0.5, 1], [0, 1]] },
      { id: 'right', name: 'right', area: null,
        poly: [[0.5, 0], [1, 0], [1, 1], [0.5, 1]] },
    ],
    walls: [
      { key: wallKey([0, 0], [0.5, 0], S), a: [0, 0], b: [0.5, 0], cm: 20 },
      { key: wallKey([0.5, 0], [1, 0], S), a: [0.5, 0], b: [1, 0], cm: 20 },
    ],
    partitions: [{ id: 'host', a: [0, 0], b: [1, 0], cm: 20 }],
    openings: [{
      id: 'door', type: 'door', x: 0, y: 0, angle: 0, length: 0.2,
      host: { kind: 'partition', id: 'host', t: 0.5 },
    }],
  };
  const result = optimizePlans(configOf(space), {});
  assert.equal(result.report.partitionsReconciled, 0);
  assert.deepEqual(result.config.spaces[0].partitions, space.partitions);
  assert.equal(result.config.spaces[0].openings[0].host.id, 'host');
  assert.equal(result.config.spaces[0].openings[0].host.t, 0.5);
});
