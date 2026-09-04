import test from 'node:test';
import assert from 'node:assert/strict';

import { ResizeController } from '../test-build/resize-controller.js';
import {
  resizeLiveCandidateSpace, resizeLiveJunctionRoomIds, resizeLiveRoomIds,
} from '../test-build/resize-live-preflight.js';
import { resolveSafeResize } from '../test-build/resize.js';

const room = () => ({
  id: 'room', wall_ids: ['w0', 'w1', 'w2', 'w3'],
  poly: [[100, 100], [400, 100], [400, 400], [100, 400]],
});
const options = { minDim: 25, eps: 0.5, step: 5 };

const setup = () => {
  const controller = new ResizeController();
  const rooms = [room()];
  const resolution = resolveSafeResize(rooms, [], 'room', 1, options);
  assert.equal(resolution.enabled, true);
  const beforeWalls = [{ cm: 0 }, { cm: 15 }, { cm: 15 }];
  assert.equal(controller.begin({
    pointerId: 7,
    start: [400, 250],
    roomId: 'room',
    plan: resolution.plan,
    options,
    rooms,
    openings: [],
    snapshotIdentity: 'snapshot-a',
    before: { id: 'before' },
    wallUnionBefore: { path: 'old' },
    epochBefore: 42,
  }), true);
  return { controller, beforeWalls };
};

const move = (controller, beforeWalls, overrides = {}) => controller.move({
  pointerId: 7,
  point: [450, 250],
  step: 5,
  snap: (point) => point,
  project: (_snapshot, polys) => ({
    ok: true,
    value: {
      preview: { polys }, beforeWalls, afterWalls: [...beforeWalls], artifact: { path: 'new' },
    },
  }),
  publish: () => {},
  measure: () => ['50 cm'],
  ...overrides,
});

test('#264 controller owns latent selection and bounded eligibility cache', () => {
  const controller = new ResizeController();
  controller.selectRoom('room');
  assert.equal(controller.escapeIdle(), 'selection-cleared');
  assert.equal(controller.escapeIdle(), 'exit-tool');
  let calls = 0;
  const resolution = { enabled: false, reason: 'diagonal' };
  assert.equal(controller.resolve('a', 'room:0', () => (++calls, resolution)), resolution);
  assert.equal(controller.resolve('a', 'room:0', () => (++calls, resolution)), resolution);
  assert.equal(calls, 1);
  controller.resolve('b', 'room:0', () => (++calls, resolution));
  assert.equal(calls, 2);
});

test('#264 accepted preview commits once and late/wrong pointer events are no-ops', () => {
  const { controller, beforeWalls } = setup();
  assert.deepEqual(move(controller, beforeWalls, { pointerId: 99 }), { kind: 'no-op' });
  const accepted = move(controller, beforeWalls);
  assert.equal(accepted.kind, 'accepted');
  assert.deepEqual(controller.liveLabels, ['50 cm']);
  const done = controller.finish({
    pointerId: 7,
    currentSnapshotIdentity: 'snapshot-a',
    validatePreview: () => true,
  });
  assert.equal(done.kind, 'commit');
  assert.deepEqual(done.before, { id: 'before' });
  assert.deepEqual(controller.finish({
    pointerId: 7, currentSnapshotIdentity: 'snapshot-a', validatePreview: () => true,
  }), { kind: 'no-op' });
});

test('#264 failed projection retains the last complete preview and notifies once', () => {
  const { controller, beforeWalls } = setup();
  const accepted = move(controller, beforeWalls);
  assert.equal(accepted.kind, 'accepted');
  const preview = controller.preview;
  const labels = controller.liveLabels;
  const fail = { project: () => ({ ok: false, reason: 'wall-metadata' }) };
  assert.deepEqual(move(controller, beforeWalls, { point: [460, 250], ...fail }), {
    kind: 'rejected', notify: true,
  });
  assert.equal(controller.preview, preview);
  assert.equal(controller.liveLabels, labels);
  assert.deepEqual(move(controller, beforeWalls, { point: [460, 250], ...fail }), {
    kind: 'rejected', notify: false,
  });
});

test('#264 exact wall profile fails closed on preview and is rechecked on finish', () => {
  const first = setup();
  assert.deepEqual(move(first.controller, first.beforeWalls, {
    project: (_snapshot, polys) => ({
      ok: true,
      value: {
        preview: { polys }, beforeWalls: first.beforeWalls,
        afterWalls: [{ cm: 0 }, { cm: 15 }], artifact: null,
      },
    }),
  }), { kind: 'rejected', notify: true });
  assert.equal(first.controller.preview, null);

  const second = setup();
  const afterWalls = [...second.beforeWalls];
  assert.equal(move(second.controller, second.beforeWalls, {
    project: (_snapshot, polys) => ({
      ok: true,
      value: { preview: { polys }, beforeWalls: second.beforeWalls, afterWalls, artifact: null },
    }),
  }).kind, 'accepted');
  afterWalls.pop();
  assert.deepEqual(second.controller.finish({
    pointerId: 7,
    currentSnapshotIdentity: 'snapshot-a',
    validatePreview: () => true,
  }), { kind: 'rejected', reason: 'wall-records' });
});

test('#264 cancel restores retained masonry only for the same snapshot', () => {
  const same = setup().controller;
  assert.deepEqual(same.cancel('snapshot-a'), {
    kind: 'cancelled', restoreWallUnion: { path: 'old' }, restoreEpoch: 42,
  });
  assert.deepEqual(same.cancel('snapshot-a'), { kind: 'no-op' });
  const stale = setup().controller;
  assert.deepEqual(stale.cancel('snapshot-b'), {
    kind: 'cancelled', restoreWallUnion: null, restoreEpoch: null,
  });
});

test('#451 live resize preflight keeps only affected rooms at any plan size', () => {
  const rect = (id, x, y, w = 1, h = 1) => ({
    id, poly: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
  });
  const rooms = Array.from({ length: 100 }, (_, index) =>
    rect(`room-${index}`, index % 10, Math.floor(index / 10)));
  assert.deepEqual(
    resizeLiveRoomIds(rooms, ['room-44']),
    ['room-44'],
  );
  assert.deepEqual(resizeLiveRoomIds([
    rect('changed', 0, 0, 2, 2), rect('nested', 0.5, 0.5, 0.5, 0.5),
    rect('endpoint', 2, 2), rect('remote', 10, 10),
  ], ['changed']), ['changed']);
  assert.deepEqual(resizeLiveJunctionRoomIds([
    rect('changed', 0, 0, 2, 2), rect('nested', 0.5, 0.5, 0.5, 0.5),
    rect('endpoint', 2, 2), rect('remote', 10, 10),
  ], ['changed']), ['changed', 'nested', 'endpoint']);
});

test('#451 live resize candidate keeps nearby physical bodies and excludes remote work', () => {
  const rect = (id, x, y) => ({
    id, poly: [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]],
  });
  const rooms = Array.from({ length: 100 }, (_, index) =>
    rect(`room-${index}`, index % 10, Math.floor(index / 10)));
  const candidate = resizeLiveCandidateSpace({
    id: 'large', cell_cm: 5, rooms,
    walls: [
      { id: 'near', key: '4.5,4.0@0.0000', a: [4, 4], b: [5, 4] },
      { id: 'remote', key: '90.5,90.0@0.0000', a: [90, 90], b: [91, 90] },
      { id: 'unknown-legacy-data', cm: 15 },
    ],
    wall_segments: [
      { id: 'near', a: [4, 4], b: [5, 4] },
      { id: 'remote', a: [90, 90], b: [91, 90] },
    ],
    open_spans: [
      { id: 'near', a: [4, 4], b: [5, 4] },
      { id: 'remote', a: [90, 90], b: [91, 90] },
    ],
    partitions: [
      { id: 'near', a: [4.5, 4.5], b: [5, 5] },
      { id: 'remote', a: [90, 90], b: [91, 91] },
    ],
    room_drafts: [
      { id: 'near', points: [[3, 3], [4, 3], [4, 4]] },
      { id: 'remote', points: [[90, 90], [91, 90], [91, 91]] },
    ],
    wall_columns: [
      { id: 'near', center: [4, 4.5], cm: 15 },
      { id: 'remote', center: [90, 90], cm: 15 },
    ],
    openings: [
      { id: 'near', x: 4.5, y: 4, length: 1 },
      { id: 'remote', x: 90, y: 90, length: 1 },
    ],
  }, ['room-44']);
  assert.ok(candidate);
  assert.equal(candidate.rooms.length, 1);
  assert.deepEqual(candidate.walls.map((item) => item.id), ['near', 'unknown-legacy-data']);
  assert.deepEqual(candidate.wall_segments.map((item) => item.id), ['near']);
  assert.deepEqual(candidate.open_spans.map((item) => item.id), ['near']);
  assert.deepEqual(candidate.partitions.map((item) => item.id), ['near']);
  assert.deepEqual(candidate.room_drafts.map((item) => item.id), ['near']);
  assert.deepEqual(candidate.wall_columns.map((item) => item.id), ['near']);
  assert.deepEqual(candidate.openings.map((item) => item.id), ['near']);
});
