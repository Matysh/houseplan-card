import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  adoptWallSegmentModelCandidateInPlace,
  commitWallSegmentModel,
  deterministicWallSegmentId,
  fixedTopologyWallLineageHints,
  resolveRoomOpeningHost,
  sanitizeRoomDraftPath,
  wallModelOffGridValueCount,
  WallSegmentModelError,
  WALL_SEGMENT_MODEL_VERSION,
} from '../test-build/wall-segment-model.js';
import { wallKey } from '../test-build/wall-thickness.js';
import { GRID_STEP_N } from '../test-build/space-geometry.js';

const rectangle = (id, x1 = 0, y1 = 0, x2 = 1, y2 = 1) => ({
  id,
  poly: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
});
const configOf = (space) => ({ spaces: [space], markers: [], settings: {} });
const segmentFor = (room, index, catalogue) => (
  catalogue.find((segment) => segment.id === room.wall_ids[index])
);

test('the #319 pair fixture matches the current initial migration byte for byte', () => {
  // Guards the fixture against drift: `sent` must stay exactly what the
  // current writer produces from `stored` (a v1.68.0-beta.2 document with one
  // orphan open_span), and the wall catalogue must stay byte-identical —
  // that combination is the whole point of the backend regression test.
  const fixture = JSON.parse(readFileSync(
    new URL('./fixtures/319-orphan-span-migration.json', import.meta.url), 'utf8',
  ));
  const migrated = commitWallSegmentModel(structuredClone(fixture.stored)).config;
  assert.deepEqual(migrated, fixture.sent);
  assert.equal(
    JSON.stringify(fixture.stored.spaces[0].wall_segments),
    JSON.stringify(fixture.sent.spaces[0].wall_segments),
  );
  assert.equal('open_spans' in fixture.sent.spaces[0], false);
});

test('frontend migration matches the shared backend parity fixture', () => {
  const fixture = JSON.parse(readFileSync(
    new URL('./fixtures/282-wall-identity-parity.json', import.meta.url), 'utf8',
  ));
  const space = commitWallSegmentModel(fixture.input).config.spaces[0];
  assert.deepEqual(space.rooms[0].wall_ids, fixture.expected.large_wall_ids);
  assert.deepEqual(space.rooms[1].wall_ids, fixture.expected.small_wall_ids);
  assert.deepEqual(space.openings[0].host, fixture.expected.opening_host);
  assert.deepEqual(
    space.room_drafts[0].segments.map((segment) => segment.id), fixture.expected.draft_ids,
  );
});

test('wall ids use the specified SHA-256/base32 seed and ignore endpoint order', () => {
  const a = [0, 0], b = [1, 0], owners = ['room-b', 'room-a'];
  const seed = 'floor|0.000000000000,0.000000000000|1.000000000000,0.000000000000|room-a,room-b';
  const digest = createHash('sha256').update(seed).digest();
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0, value = 0, encoded = '';
  for (const byte of digest) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) encoded += alphabet[(value << (5 - bits)) & 31];
  const expected = `wall-${encoded.slice(0, 20)}`;
  assert.equal(deterministicWallSegmentId('floor', a, b, owners), expected);
  assert.equal(deterministicWallSegmentId('floor', b, a, [...owners].reverse()), expected);
});

test('v7 rectangle migrates atomically to the complete id catalogue and is idempotent', () => {
  const input = configOf({
    id: 'floor', title: 'Floor', rooms: [rectangle('room')],
    walls: [{
      key: wallKey([0, 0], [1, 0], GRID_STEP_N),
      a: [0, 0], b: [1, 0], cm: 15,
    }],
  });
  const first = commitWallSegmentModel(input);
  assert.equal(first.config.model_version, WALL_SEGMENT_MODEL_VERSION);
  assert.equal(first.config.spaces[0].wall_segments.length, 4);
  assert.equal(first.config.spaces[0].rooms[0].wall_ids.length, 4);
  assert.equal(segmentFor(
    first.config.spaces[0].rooms[0], 0, first.config.spaces[0].wall_segments,
  ).cm, 15);
  assert.equal(first.config.spaces[0].wall_segments.filter((segment) => segment.cm === 0).length, 3);
  assert.deepEqual(first.config.spaces[0].walls, [{
    key: wallKey([0, 0], [1, 0], GRID_STEP_N), cm: 15, a: [0, 0], b: [1, 0],
  }]);
  assert.deepEqual(input.spaces[0].rooms[0], rectangle('room'), 'pure barrier cannot mutate v7');

  const second = commitWallSegmentModel(first.config);
  assert.equal(second.changed, false);
  assert.equal(second.migratedSegments, 0);
  assert.deepEqual(second.config, first.config);
});

test('an explicit canonical zero is not resurrected from the old thickness projection', () => {
  const base = commitWallSegmentModel(configOf({
    id: 'floor', title: 'Floor', rooms: [rectangle('room')],
    walls: [{
      key: wallKey([0, 0], [1, 0], GRID_STEP_N),
      a: [0, 0], b: [1, 0], cm: 20,
    }],
  })).config;
  const edited = structuredClone(base);
  const topId = edited.spaces[0].rooms[0].wall_ids[0];
  edited.spaces[0].wall_segments.find((segment) => segment.id === topId).cm = 0;
  delete edited.spaces[0].walls;
  const result = commitWallSegmentModel(edited).config.spaces[0];
  assert.equal(result.wall_segments.find((segment) => segment.id === topId).cm, 0);
  assert.equal(result.walls, undefined);
});

test('v8 virtual spans migrate to ordinary zero atoms and legacy fields disappear', () => {
  const base = commitWallSegmentModel(configOf({
    id: 'floor', title: 'Floor',
    rooms: [rectangle('left', 0, 0, 0.5, 1), rectangle('right', 0.5, 0, 1, 1)],
  })).config;
  base.model_version = 8;
  base.spaces[0].open_spans = [{ a: [0.5, 0.25], b: [0.5, 0.75] }];
  base.spaces[0].rooms[0].open_to = ['right'];
  const result = commitWallSegmentModel(base).config.spaces[0];
  const shared = result.wall_segments.filter((segment) => (
    Math.abs(segment.a[0] - 0.5) < 1e-9 && Math.abs(segment.b[0] - 0.5) < 1e-9
  ));
  assert.equal(result.open_spans, undefined);
  assert.equal(result.rooms.some((room) => Object.hasOwn(room, 'open_to')), false);
  assert.ok(shared.some((segment) => segment.cm === 0
    && segment.a[1] >= 0.25 - 1e-9 && segment.b[1] <= 0.75 + 1e-9));
});

test('partial shared side is atomised once and every atom has one or two owners', () => {
  const result = commitWallSegmentModel(configOf({
    id: 'floor', title: 'Floor',
    rooms: [rectangle('large', 0, 0, 1, 1), rectangle('small', 1, 0.25, 1.5, 0.75)],
  })).config.spaces[0];
  assert.equal(result.rooms[0].poly.length, 6);
  const counts = new Map(result.wall_segments.map((segment) => [segment.id, 0]));
  for (const room of result.rooms) for (const id of room.wall_ids) counts.set(id, counts.get(id) + 1);
  assert.ok([...counts.values()].every((count) => count === 1 || count === 2));
  assert.equal([...counts.values()].filter((count) => count === 2).length, 1);
});

test('existing ids survive rigid geometry edits and split lineage chooses midpoint then old a', () => {
  const base = commitWallSegmentModel(configOf({
    id: 'floor', title: 'Floor', rooms: [rectangle('room')],
  })).config;
  const moved = structuredClone(base);
  moved.spaces[0].rooms[0].poly = moved.spaces[0].rooms[0].poly.map(([x, y]) => [x + 1, y]);
  const movedResult = commitWallSegmentModel(moved).config;
  assert.deepEqual(movedResult.spaces[0].rooms[0].wall_ids, base.spaces[0].rooms[0].wall_ids);

  const split = structuredClone(base);
  split.spaces[0].rooms[0].poly.splice(1, 0, [0.25, 0]);
  // The old top segment midpoint lies in [0.25, 1], so that child inherits it.
  const oldTop = base.spaces[0].rooms[0].wall_ids[0];
  const splitResult = commitWallSegmentModel(split).config.spaces[0];
  assert.notEqual(splitResult.rooms[0].wall_ids[0], oldTop);
  assert.equal(splitResult.rooms[0].wall_ids[1], oldTop);
});

test('fixed-topology Resize hints preserve every shared and side-wall id', () => {
  const legacy = configOf({
    id: 'floor', title: 'Floor',
    rooms: [rectangle('left', 0, 0, 0.5, 1), rectangle('right', 0.5, 0, 1, 1)],
  });
  const baseline = commitWallSegmentModel(legacy).config;
  const candidate = structuredClone(baseline);
  candidate.spaces[0].rooms = [
    rectangle('left', 0, 0, 0.6, 1), rectangle('right', 0.6, 0, 1, 1),
  ];
  const hints = fixedTopologyWallLineageHints(
    baseline.spaces[0], legacy.spaces[0].rooms, candidate.spaces[0],
  );
  const result = commitWallSegmentModel(candidate, {
    lineageHints: hints, lineageSpaceId: 'floor',
  }).config.spaces[0];
  assert.deepEqual(
    [...result.wall_segments.map((segment) => segment.id)].sort(),
    [...baseline.spaces[0].wall_segments.map((segment) => segment.id)].sort(),
  );
  assert.equal(result.rooms[0].wall_ids[1], result.rooms[1].wall_ids[3]);
});

test('fixed-topology move carries zero walls without leaving phantom breakpoints', () => {
  const baseline = commitWallSegmentModel(configOf({
    id: 'floor', title: 'Floor', rooms: [rectangle('room', 0, 0, 1, 1)],
  })).config;
  const candidate = structuredClone(baseline);
  const room = candidate.spaces[0].rooms[0];
  room.poly = [[0, 0], [1, 0], [1, 1.25], [0, 1.25]];
  const hints = fixedTopologyWallLineageHints(
    baseline.spaces[0], baseline.spaces[0].rooms, candidate.spaces[0],
  );
  const result = commitWallSegmentModel(candidate, {
    lineageHints: hints, lineageSpaceId: 'floor',
  }).config.spaces[0];
  assert.equal(result.rooms[0].poly.length, 4);
  assert.deepEqual(result.rooms[0].poly, room.poly);
  assert.equal(result.wall_segments.length, 4);
  assert.ok(result.wall_segments.every((segment) => segment.cm === 0));
  assert.ok(result.wall_segments.some((segment) => (
    segment.a[1] === 1.25 || segment.b[1] === 1.25
  )));
});

test('off-grid contour guard counts values once across compatibility projections', () => {
  const point = 0.0605;
  assert.equal(wallModelOffGridValueCount({
    rooms: [{ id: 'room', poly: [[point, 0], [1, 0], [1, 1], [point, 1]] }],
    wall_segments: [{ id: 'wall', a: [point, 0], b: [point, 1], cm: 20 }],
    walls: [{ key: 'legacy', a: [point, 0], b: [point, 1], cm: 20 }],
  }), 1);
  assert.equal(
    wallModelOffGridValueCount({ rooms: [] }, [[point, 0], [point, 1]]),
    1,
    'a transient authored path contributes its coordinates to the baseline once',
  );
});

test('room openings acquire a stable wall host while partition hosts stay untouched', () => {
  const result = commitWallSegmentModel(configOf({
    id: 'floor', title: 'Floor', rooms: [rectangle('room')],
    walls: [{ key: wallKey([0, 0], [1, 0], GRID_STEP_N), a: [0, 0], b: [1, 0], cm: 15 }],
    openings: [
      { id: 'door', type: 'door', x: 0.5, y: 0, angle: 0, length: 0.2 },
      {
        id: 'partition-door', type: 'door', x: 0.5, y: 0.5, angle: 0, length: 0.2,
        host: { kind: 'partition', id: 'partition', t: 0.5 },
      },
    ],
    partitions: [{ id: 'partition', a: [0, 0.5], b: [1, 0.5], cm: 15 }],
  })).config.spaces[0];
  assert.equal(result.openings[0].host.kind, 'wall');
  assert.equal(result.openings[0].host.t, 0.5);
  assert.deepEqual(result.openings[1].host, { kind: 'partition', id: 'partition', t: 0.5 });
});

test('room opening host resolver updates t and rejects ambiguous or zero walls', () => {
  const opening = {
    id: 'door', type: 'door', x: 0.75, y: 0, angle: 0, length: 0.2,
    host: { kind: 'wall', id: 'top', t: 0.5 },
  };
  assert.deepEqual(resolveRoomOpeningHost(opening, [
    { id: 'top', a: [0, 0], b: [1, 0], cm: 15 },
  ]), { kind: 'wall', id: 'top', t: 0.75 });
  assert.equal(resolveRoomOpeningHost({ ...opening, host: undefined }, [
    { id: 'a', a: [0, 0], b: [1, 0], cm: 15 },
    { id: 'b', a: [0, 0], b: [1, 0], cm: 15 },
  ]), null);
  assert.equal(resolveRoomOpeningHost({ ...opening, host: undefined }, [
    { id: 'top', a: [0, 0], b: [1, 0], cm: 0 },
  ]), null);
});

test('an ambiguous room opening blocks the complete candidate without mutating input', () => {
  const input = configOf({
    id: 'floor', title: 'Floor',
    rooms: [rectangle('room')],
    openings: [{ id: 'door', type: 'door', x: 0, y: 0, angle: 0, length: 0.2 }],
  });
  const before = structuredClone(input);
  assert.throws(
    () => commitWallSegmentModel(input),
    (error) => error instanceof WallSegmentModelError && error.reason === 'opening-host',
  );
  assert.deepEqual(input, before);
});

test('draft segment ids materialise once and remain stable', () => {
  const first = commitWallSegmentModel(configOf({
    id: 'floor', title: 'Floor', rooms: [],
    room_drafts: [{
      id: 'draft', points: [[0, 0], [0.5, 0], [1, 0]],
      segments: [{ cm: 10 }, { cm: 20 }],
    }],
  })).config;
  const ids = first.spaces[0].room_drafts[0].segments.map((segment) => segment.id);
  assert.ok(ids.every(Boolean));
  assert.deepEqual(
    commitWallSegmentModel(first).config.spaces[0].room_drafts[0].segments.map((segment) => segment.id),
    ids,
  );
});

test('draft sanitation drops only the segment carried by a duplicate point', () => {
  const draft = sanitizeRoomDraftPath({
    points: [[0, 0], [0, 0], [1, 0], [1, 0], [1, 1]],
    segments: [
      { id: 'zero-a', cm: 11 }, { id: 'edge-a', cm: 21 },
      { id: 'zero-b', cm: 12 }, { id: 'edge-b', cm: 22 },
    ],
  });
  assert.deepEqual(draft.points, [[0, 0], [1, 0], [1, 1]]);
  assert.deepEqual(draft.segments, [
    { id: 'edge-a', cm: 21 }, { id: 'edge-b', cm: 22 },
  ]);
});

test('post-v8 atoms use fresh identity while promoted draft carriers keep theirs', () => {
  const base = commitWallSegmentModel(configOf({
    id: 'floor', title: 'Floor', rooms: [rectangle('room')],
  })).config;
  const changed = structuredClone(base);
  changed.spaces[0].rooms.push({
    id: 'promoted',
    poly: [[2, 0], [3, 0], [3, 1], [2, 1]],
    wall_ids: ['draft-top', '', '', ''],
  });
  const result = commitWallSegmentModel(changed).config.spaces[0];
  const promoted = result.rooms.find((room) => room.id === 'promoted');
  assert.equal(promoted.wall_ids[0], 'draft-top');
  assert.match(promoted.wall_ids[1], /^wall-[0-9a-f-]{36}$/,
    'new v8 identity comes from the UUID factory, not its coordinates');
  assert.notEqual(
    promoted.wall_ids[1],
    deterministicWallSegmentId('floor', [3, 0], [3, 1], ['promoted']),
  );
});

test('promoted divider identity outranks a stale same-index room hint', () => {
  const base = commitWallSegmentModel(configOf({
    id: 'floor', title: 'Floor', rooms: [rectangle('parent')],
  })).config;
  const changed = structuredClone(base);
  const oldIds = changed.spaces[0].rooms[0].wall_ids;
  changed.spaces[0].rooms = [{
    id: 'parent', poly: [[0, 0], [0.5, 0], [0.5, 1], [0, 1]], wall_ids: oldIds,
  }, {
    id: 'child', poly: [[0.5, 0], [1, 0], [1, 1], [0.5, 1]],
    wall_ids: ['', '', '', 'draft-divider'],
  }];
  const result = commitWallSegmentModel(changed).config.spaces[0];
  const parent = result.rooms.find((room) => room.id === 'parent');
  const child = result.rooms.find((room) => room.id === 'child');
  assert.equal(parent.wall_ids[1], 'draft-divider');
  assert.equal(child.wall_ids[3], 'draft-divider');
});

test('validated candidate adoption preserves active editor object identity', () => {
  const target = configOf({
    id: 'floor', title: 'Floor', rooms: [rectangle('room')],
    walls: [{ key: wallKey([0, 0], [1, 0], GRID_STEP_N), a: [0, 0], b: [1, 0], cm: 15 }],
    openings: [{ id: 'door', type: 'door', x: 0.5, y: 0, angle: 0, length: 0.2 }],
  });
  const space = target.spaces[0];
  const opening = space.openings[0];
  const candidate = commitWallSegmentModel(target).config;
  adoptWallSegmentModelCandidateInPlace(target, candidate);
  assert.equal(target.spaces[0], space);
  assert.equal(space.openings[0], opening);
  assert.equal(target.model_version, WALL_SEGMENT_MODEL_VERSION);
  assert.equal(opening.host.kind, 'wall');
});

test('initial migration resolves a reserved deterministic id with the documented suffix', () => {
  const baseId = deterministicWallSegmentId('floor', [0, 0], [1, 0], ['room']);
  const result = commitWallSegmentModel(configOf({
    id: 'floor', title: 'Floor', rooms: [rectangle('room')],
    partitions: [{ id: baseId, a: [2, 0], b: [3, 0], cm: 15 }],
  })).config.spaces[0];
  assert.equal(result.rooms[0].wall_ids[0], `${baseId}-2`);
});

test('every frontend structural transaction crosses the wall identity barrier', () => {
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  const optimizer = readFileSync(new URL('../src/plan-optimizer.ts', import.meta.url), 'utf8');
  const methodSource = (name) => {
    const start = source.indexOf(`private ${name}(`);
    assert.notEqual(start, -1, `${name} must remain a named structural boundary`);
    const end = source.indexOf('\n  private ', start + 10);
    return source.slice(start, end < 0 ? source.length : end);
  };
  const commitMethod = methodSource('_commitPhysicalGeometry');
  const restoreMethod = methodSource('_applyGeometryState');
  assert.match(commitMethod, /commitWallSegmentModel\(liveCandidate\)/,
    'ordinary structural commits must cross the identity barrier');
  assert.match(restoreMethod, /commitWallSegmentModel\(restoredCandidate\)/,
    'Undo/Redo restoration must cross the identity barrier');
  assert.match(optimizer, /commitWallSegmentModelInPlace\(config\)/,
    'Optimize must cross the identity barrier after its geometry repairs');
  assert.doesNotMatch(commitMethod, /this\._writeConfig\(/,
    'the common barrier must finish before the existing persistence path runs');
});
