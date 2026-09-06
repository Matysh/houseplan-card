import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  isSinglePartitionAppend, wallChainLiveCandidateSpace, wallChainLiveSeed,
} from '../test-build/draft-live-preflight.js';
import { increasedViolations, junctionLimitViolations } from '../test-build/junction-limits.js';
import { GRID_STEP_N } from '../test-build/space-geometry.js';

const room = (id, x, y, size = 0.1) => ({
  id,
  poly: [[x, y], [x + size, y], [x + size, y + size], [x, y + size]],
  wall_ids: [`${id}-0`, `${id}-1`, `${id}-2`, `${id}-3`],
});

const wallSegments = (one) => one.poly.map((a, index) => ({
  id: one.wall_ids[index], a, b: one.poly[(index + 1) % one.poly.length], cm: 15,
  owners: [one.id],
}));

const cmUnits = (value) => value / 5 * GRID_STEP_N;
const terminal = (lengthCm = 40, cm = 0) => ({
  id: 'terminal', a: [0, 0], b: [cmUnits(lengthCm), 0], cm,
});
const limitSegments = (space) => [
  ...(space.wall_segments || []), ...(space.partitions || []),
];
const introducedRules = (previous, candidate) => increasedViolations(
  junctionLimitViolations(
    { model_version: 10, spaces: [candidate] }, candidate.id,
    limitSegments(candidate), { status: 'lightweight' },
  ),
  junctionLimitViolations(
    { model_version: 10, spaces: [previous] }, previous.id,
    limitSegments(previous), { status: 'lightweight' },
  ),
).map((item) => item.rule).sort();
const paritySpace = (partitions, seedLengthCm = 40) => ({
  id: 'space', cell_cm: 5,
  rooms: [], walls: [], wall_segments: [], openings: [], open_spans: [],
  wall_columns: [],
  partitions: [
    ...partitions,
    { id: 'remote', a: [2, 2], b: [2 + cmUnits(40), 2], cm: 0 },
    terminal(seedLengthCm),
  ],
});

test('#461/#478 route guard accepts exactly one terminal partition append', () => {
  const prior = { id: 'prior', a: [0, 0], b: [0.05, 0], cm: 15 };
  const appended = { id: 'terminal', a: [0.05, 0], b: [0.1, 0], cm: 15 };
  const before = { spaceId: 'space', rooms: [], partitions: [prior], plan_transform: {} };
  const after = { id: 'space', rooms: [], partitions: [prior, appended] };
  assert.equal(isSinglePartitionAppend(before, after, 'terminal'), true);
  assert.equal(isSinglePartitionAppend(before, {
    ...after, walls: [{ key: 'mixed', cm: 15 }],
  }, 'terminal'), false);
  assert.equal(isSinglePartitionAppend(before, {
    ...after, partitions: [appended, prior],
  }, 'terminal'), false);
  assert.equal(isSinglePartitionAppend(before, after, 'another'), false);
  assert.equal(isSinglePartitionAppend(
    { ...before, partitions: [] }, { ...after, partitions: [appended] }, 'terminal',
  ), true, 'the first accepted edge is one ordinary partition append');
});

test('#461/#478 local projection retains interacting walls and drops remote work', () => {
  const nearRoom = room('near-room', 0.2, 0.1);
  const remoteRooms = Array.from({ length: 80 }, (_, index) =>
    room(`remote-room-${index}`, 2 + index * 0.2, 2));
  const space = {
    id: 'space', cell_cm: 5,
    rooms: [nearRoom, ...remoteRooms],
    wall_segments: [...wallSegments(nearRoom), ...remoteRooms.flatMap(wallSegments)],
    walls: [],
    partitions: [
      { id: 'terminal', a: [0.05, 0.1], b: [0.2, 0.1], cm: 15 },
      { id: 'near-partition', a: [0.16, 0.08], b: [0.16, 0.16], cm: 10 },
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
  const seed = wallChainLiveSeed(space, 'terminal');
  assert.ok(seed);
  const projected = wallChainLiveCandidateSpace(space, seed);
  assert.ok(projected);
  assert.deepEqual(projected.roomIds, ['near-room']);
  assert.equal(projected.space.rooms.length, 1);
  assert.deepEqual(projected.space.partitions.map((item) => item.id), [
    'terminal', 'near-partition', 'thick-envelope',
  ]);
  assert.deepEqual(projected.space.wall_columns.map((item) => item.id), ['near-column']);
  assert.deepEqual(projected.space.openings.map((item) => item.id), ['near-opening']);
  assert.deepEqual(projected.space.open_spans.map((item) => item.id), ['near-span']);
  assert.equal(projected.space.wall_segments.some((item) =>
    String(item.id).startsWith('remote-room-')), false);
  assert.equal(JSON.stringify(space), original, 'the bounded proof never mutates stored geometry');
});

test('#461 remote geometry growth does not grow the selected component', () => {
  const make = (remoteCount) => ({
    id: 'space', cell_cm: 5, rooms: [], wall_segments: [],
    partitions: [
      { id: 'terminal', a: [0, 0], b: [0.1, 0], cm: 15 },
      { id: 'near', a: [0.1, 0], b: [0.1, 0.1], cm: 15 },
      ...Array.from({ length: remoteCount }, (_, index) => ({
        id: `remote-${index}`, a: [2 + index * 0.02, 2], b: [2 + index * 0.02, 2.1], cm: 15,
      })),
    ],
  });
  const forty = make(40); const eighty = make(80);
  const selectedForty = wallChainLiveCandidateSpace(forty, wallChainLiveSeed(forty, 'terminal'));
  const selectedEighty = wallChainLiveCandidateSpace(eighty, wallChainLiveSeed(eighty, 'terminal'));
  assert.ok(selectedForty && selectedEighty);
  assert.equal(selectedForty.segmentCount, selectedEighty.segmentCount);
  assert.deepEqual(selectedEighty.space.partitions.map((item) => item.id), ['terminal', 'near']);
});

test('#461 local and full junction verdicts agree at every limit boundary', () => {
  const ray = (id, angleDeg, lengthCm = 40) => {
    const angle = angleDeg * Math.PI / 180;
    return {
      id, a: [0, 0],
      b: [cmUnits(lengthCm) * Math.cos(angle), cmUnits(lengthCm) * Math.sin(angle)], cm: 0,
    };
  };
  const valenceRays = (total) => Array.from({ length: total - 1 }, (_, index) =>
    ray(`ray-${total}-${index}`, (index + 1) * 360 / total));
  const cases = [
    { name: '14 degree junction is rejected', partitions: [ray('angle-14', 14)], expected: ['angle'] },
    { name: '15 degree junction is accepted', partitions: [ray('angle-15', 15)], expected: [] },
    { name: '19 cm segment is rejected', partitions: [], seedLengthCm: 19, expected: ['length'] },
    { name: '20 cm segment is accepted', partitions: [], seedLengthCm: 20, expected: [] },
    { name: '4 cm node clearance is rejected', partitions: [{
      id: 'distance-4', a: [cmUnits(4), cmUnits(4)], b: [cmUnits(4), cmUnits(44)], cm: 0,
    }], expected: ['distance'] },
    { name: '5 cm node clearance is accepted', partitions: [{
      id: 'distance-5', a: [cmUnits(5), cmUnits(5)], b: [cmUnits(5), cmUnits(45)], cm: 0,
    }], expected: [] },
    { name: 'valence 6 is accepted', partitions: valenceRays(6), expected: [] },
    { name: 'valence 7 is rejected', partitions: valenceRays(7), expected: ['valence'] },
  ];
  for (const scenario of cases) {
    const candidate = paritySpace(scenario.partitions, scenario.seedLengthCm);
    const previous = { ...candidate, partitions: candidate.partitions.slice(0, -1) };
    const seed = wallChainLiveSeed(candidate, 'terminal');
    const localPrevious = wallChainLiveCandidateSpace(previous, seed)?.space;
    const localCandidate = wallChainLiveCandidateSpace(candidate, seed)?.space;
    assert.ok(seed && localPrevious && localCandidate, scenario.name);
    assert.deepEqual(introducedRules(localPrevious, localCandidate), introducedRules(previous, candidate),
      `${scenario.name}: local verdict must equal full verdict`);
    assert.deepEqual(introducedRules(previous, candidate), scenario.expected, scenario.name);
    assert.equal(localCandidate.partitions.some((item) => item.id === 'remote'), false);
  }
});

test('#461 projector closes a collinear run and keeps every ray at its junctions', () => {
  const space = {
    id: 'space', cell_cm: 5, rooms: [], walls: [], wall_segments: [],
    partitions: [
      { id: 'terminal', a: [0, 0], b: [0.1, 0], cm: 15 },
      { id: 'run-1', a: [0.1, 0], b: [0.2, 0], cm: 15 },
      { id: 'run-2', a: [0.2, 0], b: [0.3, 0], cm: 15 },
      { id: 'junction-ray', a: [0.3, 0], b: [0.3, 0.1], cm: 10 },
      { id: 'beyond-one-layer', a: [0.3, 0.1], b: [0.4, 0.1], cm: 10 },
      { id: 'remote', a: [0.8, 0.8], b: [0.9, 0.8], cm: 15 },
    ],
  };
  const projected = wallChainLiveCandidateSpace(space, wallChainLiveSeed(space, 'terminal'));
  assert.ok(projected);
  assert.deepEqual(projected.space.partitions.map((item) => item.id), [
    'terminal', 'run-1', 'run-2', 'junction-ray',
  ]);
});

test('#461 malformed local geometry fails closed into the proof', () => {
  const space = {
    id: 'space', cell_cm: 5, rooms: [], wall_segments: [],
    partitions: [
      { id: 'terminal', a: [0, 0], b: [0.1, 0], cm: 15 },
      { id: 'broken-partition', a: ['bad', 0], b: [0, 0], cm: 15 },
    ],
    walls: [{ key: 'unlocatable-wall', cm: 15 }],
  };
  const projected = wallChainLiveCandidateSpace(space, wallChainLiveSeed(space, 'terminal'));
  assert.ok(projected);
  assert.equal(projected.space.partitions.some((item) => item.id === 'broken-partition'), true);
  assert.equal(projected.space.walls.some((item) => item.key === 'unlocatable-wall'), true);
});

test('#461/#478 production source keeps bounded append and terminal room barriers separate', () => {
  const runtime = readFileSync(new URL('../src/houseplan-editor-runtime.ts', import.meta.url), 'utf8');
  const transaction = readFileSync(new URL('../src/draft-live-commit.ts', import.meta.url), 'utf8');
  assert.match(runtime, /partitions\.push\([\s\S]*?commitWallChainSegmentGeometry\(this,/);
  assert.match(transaction, /commitWallChainSegmentGeometry<[\s\S]*?isSinglePartitionAppend/);
  assert.match(transaction, /commitWallChainSegmentGeometry<[\s\S]*?wallChainLiveCandidateSpace/);
  assert.match(transaction,
    /Number\(liveCandidate\.model_version \|\| 0\) !== WALL_SEGMENT_MODEL_VERSION/,
    'unknown future models must use the generic barrier');
  assert.doesNotMatch(runtime, /_finishWallChain\(\)[\s\S]{0,600}_commitPhysicalGeometry\(/,
    'ending a session-only chain must not create another geometry transaction');
});
