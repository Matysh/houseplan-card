import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  draftLiveCandidateSpace, draftLiveSeed, isSingleDraftAppend,
} from '../test-build/draft-live-preflight.js';

const room = (id, x, y, size = 0.1) => ({
  id,
  poly: [[x, y], [x + size, y], [x + size, y + size], [x, y + size]],
  wall_ids: [`${id}-0`, `${id}-1`, `${id}-2`, `${id}-3`],
});

const wallSegments = (one) => one.poly.map((a, index) => ({
  id: one.wall_ids[index], a, b: one.poly[(index + 1) % one.poly.length], cm: 15,
  owners: [one.id],
}));

const activeDraft = {
  id: 'active',
  points: [[0.05, 0.05], [0.1, 0.05], [0.1, 0.1], [0.2, 0.1]],
  segments: [
    { id: 'active-0', cm: 15 }, { id: 'active-1', cm: 15 },
    { id: 'active-2', cm: 15 },
  ],
  future_field: 'kept',
};

test('#461 route guard accepts exactly one active-draft append', () => {
  const beforeDraft = {
    ...activeDraft,
    points: activeDraft.points.slice(0, -1),
    segments: activeDraft.segments.slice(0, -1),
  };
  const before = {
    spaceId: 'space', rooms: [], room_drafts: [beforeDraft], partitions: [],
    plan_transform: {},
  };
  const after = {
    id: 'space', rooms: [], room_drafts: [activeDraft], partitions: [],
  };
  assert.equal(isSingleDraftAppend(before, after, 'active'), true);
  assert.equal(isSingleDraftAppend(before, {
    ...after, partitions: [{ id: 'mixed', a: [0, 0], b: [1, 0], cm: 15 }],
  }, 'active'), false);
  assert.equal(isSingleDraftAppend(before, {
    ...after,
    room_drafts: [{ ...activeDraft, segments: activeDraft.segments.slice(0, -1) }],
  }, 'active'), false);
  assert.equal(isSingleDraftAppend(before, after, 'another'), false);
  assert.equal(isSingleDraftAppend(
    { ...before, room_drafts: [] },
    { ...after, room_drafts: [{ ...activeDraft,
      points: activeDraft.points.slice(0, 2), segments: activeDraft.segments.slice(0, 1) }] },
    'active',
  ), true, 'the transient first point becomes a two-point draft on the first persisted edge');
});

test('#461 local draft projection retains interacting geometry and drops remote work', () => {
  const nearRoom = room('near-room', 0.2, 0.1);
  const remoteRooms = Array.from({ length: 80 }, (_, index) =>
    room(`remote-room-${index}`, 2 + index * 0.2, 2));
  const space = {
    id: 'space', cell_cm: 5,
    rooms: [nearRoom, ...remoteRooms],
    wall_segments: [
      ...wallSegments(nearRoom), ...remoteRooms.flatMap(wallSegments),
    ],
    walls: [],
    room_drafts: [
      activeDraft,
      { id: 'near-draft', points: [[0.15, 0.1], [0.15, 0.2]],
        segments: [{ id: 'near-draft-0', cm: 15 }] },
      { id: 'remote-draft', points: [[4, 4], [4.2, 4]],
        segments: [{ id: 'remote-draft-0', cm: 15 }] },
    ],
    partitions: [
      { id: 'near-partition', a: [0.16, 0.08], b: [0.16, 0.16], cm: 10 },
      // Its axis is outside the 5 cm clearance, but the actual 40 cm body
      // envelope reaches the seed and therefore belongs to the proof.
      { id: 'thick-envelope', a: [0.11, 0.125], b: [0.19, 0.125], cm: 40 },
      { id: 'remote-partition', a: [4, 4], b: [4.2, 4], cm: 10 },
    ],
    wall_columns: [
      { id: 'near-column', center: [0.18, 0.1], cm: 10, shape: 'square' },
      { id: 'remote-column', center: [4, 4], cm: 10, shape: 'square' },
    ],
    openings: [
      { id: 'near-opening', host: { kind: 'partition', id: 'near-partition', t: 0.5 } },
      { id: 'remote-opening', host: { kind: 'partition', id: 'remote-partition', t: 0.5 } },
    ],
    open_spans: [
      { id: 'near-span', a: [0.12, 0.1], b: [0.14, 0.1] },
      { id: 'remote-span', a: [4, 4], b: [4.1, 4] },
    ],
  };
  const original = JSON.stringify(space);
  const seed = draftLiveSeed(space, 'active');
  assert.ok(seed);
  const projected = draftLiveCandidateSpace(space, seed);
  assert.ok(projected);
  assert.deepEqual(projected.roomIds, ['near-room']);
  assert.equal(projected.space.rooms.length, 1);
  assert.deepEqual(projected.space.partitions.map((item) => item.id), [
    'near-partition', 'thick-envelope',
  ]);
  assert.deepEqual(projected.space.wall_columns.map((item) => item.id), ['near-column']);
  assert.deepEqual(projected.space.openings.map((item) => item.id), ['near-opening']);
  assert.deepEqual(projected.space.open_spans.map((item) => item.id), ['near-span']);
  assert.ok(projected.space.room_drafts.some((item) =>
    String(item.id).startsWith('near-draft@local:')));
  assert.equal(projected.space.room_drafts.some((item) => item.id === 'remote-draft'), false);
  assert.equal(projected.space.wall_segments.some((item) =>
    String(item.id).startsWith('remote-room-')), false);
  const activeSlices = projected.space.room_drafts.filter((item) =>
    String(item.id).startsWith('active@local:'));
  assert.ok(activeSlices.length >= 2);
  assert.ok(activeSlices.every((item) => item.future_field === 'kept'));
  assert.ok(activeSlices.every((item) => item.points.length === 2 && item.segments.length === 1));
  assert.equal(JSON.stringify(space), original, 'the runtime proof never mutates stored geometry');
});

test('#461 remote geometry growth does not grow the selected component', () => {
  const make = (remoteCount) => ({
    id: 'space', cell_cm: 5, rooms: [], wall_segments: [],
    room_drafts: [activeDraft],
    partitions: [
      { id: 'near', a: [0.15, 0.08], b: [0.15, 0.16], cm: 15 },
      ...Array.from({ length: remoteCount }, (_, index) => ({
        id: `remote-${index}`, a: [2 + index * 0.02, 2], b: [2 + index * 0.02, 2.1], cm: 15,
      })),
    ],
  });
  const forty = make(40); const eighty = make(80);
  const selectedForty = draftLiveCandidateSpace(forty, draftLiveSeed(forty, 'active'));
  const selectedEighty = draftLiveCandidateSpace(eighty, draftLiveSeed(eighty, 'active'));
  assert.ok(selectedForty && selectedEighty);
  assert.equal(selectedForty.segmentCount, selectedEighty.segmentCount);
  assert.deepEqual(selectedEighty.space.partitions.map((item) => item.id), ['near']);
});

test('#461 projector closes a collinear run and keeps every ray at its junctions', () => {
  const space = {
    id: 'space', cell_cm: 5, rooms: [], walls: [], wall_segments: [],
    room_drafts: [{
      id: 'active', points: [[0, 0], [0.1, 0]],
      segments: [{ id: 'seed', cm: 15 }],
    }],
    partitions: [
      { id: 'run-1', a: [0.1, 0], b: [0.2, 0], cm: 15 },
      { id: 'run-2', a: [0.2, 0], b: [0.3, 0], cm: 15 },
      { id: 'junction-ray', a: [0.3, 0], b: [0.3, 0.1], cm: 10 },
      { id: 'beyond-one-layer', a: [0.3, 0.1], b: [0.4, 0.1], cm: 10 },
      { id: 'remote', a: [0.8, 0.8], b: [0.9, 0.8], cm: 15 },
    ],
  };
  const seed = draftLiveSeed(space, 'active');
  const projected = draftLiveCandidateSpace(space, seed);
  assert.ok(projected);
  assert.deepEqual(projected.space.partitions.map((item) => item.id), [
    'run-1', 'run-2', 'junction-ray',
  ]);
});

test('#461 malformed local geometry fails closed into the proof', () => {
  const space = {
    id: 'space', cell_cm: 5, rooms: [], wall_segments: [],
    room_drafts: [activeDraft, { id: 'broken', points: [['bad', 0]], segments: [] }],
    partitions: [{ id: 'broken-partition', a: ['bad', 0], b: [0, 0], cm: 15 }],
    walls: [{ key: 'unlocatable-wall', cm: 15 }],
  };
  const projected = draftLiveCandidateSpace(space, draftLiveSeed(space, 'active'));
  assert.ok(projected);
  assert.equal(projected.space.room_drafts.some((item) => item.id === 'broken'), true);
  assert.equal(projected.space.partitions.some((item) => item.id === 'broken-partition'), true);
  assert.equal(projected.space.walls.some((item) => item.key === 'unlocatable-wall'), true);
});

test('#461 production source keeps intermediate-local and terminal-full boundaries separate', () => {
  const runtime = readFileSync(
    new URL('../src/houseplan-editor-runtime.ts', import.meta.url), 'utf8',
  );
  const transaction = readFileSync(
    new URL('../src/draft-live-commit.ts', import.meta.url), 'utf8',
  );
  assert.match(runtime,
    /_persistActiveDraftSegment\(\)[\s\S]*?commitDraftSegmentGeometry\(this,/);
  assert.match(runtime, /_finishWallChain\(\)[\s\S]*?_commitPhysicalGeometry\(/);
  assert.match(transaction, /commitDraftSegmentGeometry<[\s\S]*?isSingleDraftAppend/);
  assert.match(transaction, /commitDraftSegmentGeometry<[\s\S]*?draftLiveCandidateSpace/);
  assert.match(transaction,
    /Number\(liveCandidate\.model_version \|\| 0\) !== WALL_SEGMENT_MODEL_VERSION/,
    'unknown future models must use the generic barrier');
});
