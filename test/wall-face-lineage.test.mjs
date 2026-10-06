import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { selectWallFaceLineage, settleWallFaceLineage } from '../test-build/wall-face-lineage.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { reconcileCoincidentPartitions } from '../test-build/coincident-partitions.js';
import { spaceModels, GRID_PITCH, GRID_STEP_N, NORM_W } from '../test-build/space-geometry.js';
import { setWallThickness, applyWallThicknessToNewRoom } from '../test-build/wall-thickness.js';
import { resolvePartitionOpeningStrict } from '../test-build/partition-openings.js';
import { checkSpacePhysicalGeometry } from '../test-build/plan-geometry-preflight.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/804-wall-face-lineage.json', import.meta.url), 'utf8'));
const sourceId = fixture.source.id;
const normalized = (point) => point.map((value) => value / fixture.grid);
const modelPoint = (point) => normalized(point).map((value) => value * NORM_W);
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9,
  `${message}: ${actual} != ${expected}`);

function makeBefore(options = {}) {
  const cm = options.sourceCm ?? fixture.source.cm;
  const crossCm = options.crossCm ?? fixture.crossCm;
  const a = [fixture.source.a[0], options.start ?? fixture.source.a[1]];
  const b = [fixture.source.b[0], options.end ?? fixture.source.b[1]];
  if (options.reverse) [a[1], b[1]] = [b[1], a[1]];
  const room = { id: 'neighbor', name: 'Neighbor', area: null, poly: fixture.neighbor.map(normalized) };
  const source = { id: sourceId, a: normalized(a), b: normalized(b), cm };
  const partition = (id, first, second) => ({ id, a: normalized(first), b: normalized(second), cm: crossCm });
  const partitions = [
    source,
    partition('top-source', fixture.face[0], fixture.face[1]),
    partition('bottom-source', fixture.face[3], fixture.face[2]),
  ];
  if (options.multiple) partitions.push(partition('divider-source', [74, 122], [102, 122]));
  let walls = [];
  for (const [index, first] of room.poly.entries()) {
    walls = setWallThickness(walls, first, room.poly[(index + 1) % room.poly.length], crossCm, GRID_STEP_N, 1);
  }
  const space = { id: 'floor', title: 'Floor', cell_cm: fixture.cellCm,
    view_box: [0, 0, 1, 1], rooms: [room], partitions, walls };
  if (options.openingY !== undefined) {
    const opening = {
      id: 'hosted-opening', type: options.openingType || 'door',
      x: a[0] / fixture.grid, y: options.openingY / fixture.grid,
      angle: -90, length: (options.openingLength ?? 8) / fixture.grid,
      contact: 'binary_sensor.synthetic_door', lock: 'lock.synthetic_door',
      cover: 'cover.synthetic_opening', invert: true, flip_h: true,
      future_field: { keep: ['opaque', 7] },
      host: { kind: 'partition', id: sourceId, t: (options.openingY - a[1]) / (b[1] - a[1]) },
    };
    space.openings = [opening];
  }
  return commitWallSegmentModel({ spaces: [space, {
    id: 'unrelated-space', title: 'Unrelated', cell_cm: 8, view_box: [0, 0, 1, 1], rooms: [],
  }], markers: [], settings: {} }).config;
}

/** Pure production stages; emit mode exposes actual frontend candidates to Python. */
function acceptFaces(before, options = {}, settle = true) {
  const candidate = structuredClone(before);
  const space = candidate.spaces[0];
  const initialModel = spaceModels(candidate)[0];
  const rings = options.multiple ? [
    [[74, 112], [102, 112], [102, 122], [74, 122]],
    [[74, 122], [102, 122], [102, 133], [74, 133]],
  ] : [fixture.face];
  const newRooms = rings.map((ring, index) => ({
    id: `accepted-${index}`, name: `Accepted ${index}`, area: null,
    poly: ring.map(normalized),
    wall_ids: selectWallFaceLineage(ring.map(modelPoint), initialModel.partitions,
      new Set(), GRID_PITCH * 0.0002),
  }));
  space.rooms.push(...newRooms);
  for (const room of newRooms) {
    space.walls = applyWallThicknessToNewRoom(space.walls, spaceModels(candidate)[0].rooms,
      room.id, options.crossCm ?? fixture.crossCm, GRID_STEP_N, [], NORM_W);
    for (const [index, point] of room.poly.entries()) {
      const carrier = initialModel.partitions.find((partition) => partition.id === room.wall_ids[index]);
      if (carrier) space.walls = setWallThickness(space.walls, point,
        room.poly[(index + 1) % room.poly.length], carrier.cm, GRID_STEP_N, 1);
    }
  }
  const reconciled = reconcileCoincidentPartitions(space, spaceModels(candidate)[0], space.walls, [], {
    pitch: GRID_STEP_N, cellCm: fixture.cellCm, gridPitch: GRID_PITCH,
    coordScale: NORM_W, allowCoincidentPartitions: true,
  });
  for (const key of ['walls', 'partitions', 'openings']) {
    if (reconciled[key].length) space[key] = reconciled[key];
    else delete space[key];
  }
  if (settle) {
    const remainingIds = new Set(reconciled.partitions.map((partition) => partition.id));
    for (const room of newRooms) room.wall_ids = settleWallFaceLineage(room.wall_ids, remainingIds);
  }
  return commitWallSegmentModel(candidate).config;
}

function assertIdentity(space) {
  const physicalIds = [...(space.partitions || []), ...space.wall_segments].map((wall) => wall.id);
  assert.equal(new Set(physicalIds).size, physicalIds.length, 'physical IDs are globally disjoint');
  for (const room of space.rooms) {
    assert.equal(room.wall_ids.length, room.poly.length);
    for (const id of room.wall_ids) assert.equal(space.wall_segments.filter((wall) => wall.id === id).length, 1);
  }
}

// Captures keep real UUIDs for Python. Replay compares every field while giving
// only newly allocated contour IDs a deterministic name from their exact span.
function comparableNewIdentities(config, before) {
  const result = structuredClone(config);
  const existing = new Set(before.spaces.flatMap((space) => [
    ...(space.wall_segments || []), ...(space.partitions || []),
  ]).map((wall) => wall.id));
  for (const space of result.spaces) {
    const replacement = new Map((space.wall_segments || []).filter((wall) => !existing.has(wall.id))
      .map((wall) => [wall.id, `new:${JSON.stringify([wall.a, wall.b].sort((a, b) => a[0] - b[0] || a[1] - b[1]))}`]));
    for (const wall of space.wall_segments || []) wall.id = replacement.get(wall.id) || wall.id;
    for (const room of space.rooms) room.wall_ids = room.wall_ids?.map((id) => replacement.get(id) || id);
    for (const opening of space.openings || []) {
      if (opening.host?.kind === 'wall') opening.host.id = replacement.get(opening.host.id) || opening.host.id;
    }
  }
  return result;
}

const variants = [
  { name: 'two residuals, mixed thickness', options: {}, residuals: 2 },
  { name: 'one trailing residual', options: { start: 112 }, residuals: 1 },
  { name: 'one leading residual', options: { end: 133 }, residuals: 1 },
  { name: 'fully consumed carrier', options: { start: 112, end: 133 }, residuals: 0 },
  { name: 'reversed source', options: { reverse: true }, residuals: 2 },
  { name: 'uniform positive thickness', options: { sourceCm: 15 }, residuals: 2 },
  { name: 'zero carrier', options: { sourceCm: 0 }, residuals: 2 },
  { name: 'fully consumed zero carrier', options: { sourceCm: 0, start: 112, end: 133 }, residuals: 0 },
];
const hostVariants = [
  { name: 'same-id-residual-host', options: { openingY: 100 }, expectedPartitionHostResult: 'ok' },
  { name: 'other-residual-host', options: { openingY: 170 }, expectedPartitionHostResult: 'reject' },
  { name: 'consumed-partition-host', options: { openingY: 122 }, expectedPartitionHostResult: 'reject' },
];

if (process.argv.includes('--emit-backend-fixtures')) {
  const cases = [
    ...variants.map(({ name, options }) => ({ name, options, expectedPartitionHostResult: 'ok' })),
    ...hostVariants,
  ].map(({ name, options, expectedPartitionHostResult }) => {
    const before = makeBefore(options);
    return { name, before, after: acceptFaces(before, options), expectedPartitionHostResult };
  });
  process.stdout.write(`${JSON.stringify(cases)}\n`);
} else {
  test('carrier selection keeps active, length and ID priority without mutating inputs', () => {
    const ring = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const partitions = [
      { id: 'long', a: [-5, 0], b: [15, 0] },
      { id: 'short-z', a: [0, 0], b: [10, 0] },
      { id: 'short-a', a: [10, 0], b: [0, 0] },
      { id: 'degenerate', a: [0, 0], b: [0, 0] },
      { id: 'partial', a: [0, 0], b: [5, 0] },
    ];
    const original = structuredClone({ ring, partitions });
    assert.deepEqual(selectWallFaceLineage(ring, partitions, new Set(), 0.001), ['short-a', '', '', '']);
    assert.deepEqual(selectWallFaceLineage(ring, partitions, new Set(['long']), 0.001), ['long', '', '', '']);
    assert.deepEqual({ ring, partitions }, original);
    assert.deepEqual(selectWallFaceLineage([], partitions, new Set(), 0.001), []);
  });

  test('settlement clears only occupied hints and preserves edge slots and full promotions', () => {
    const hints = ['long-source', '', 'fully-consumed', 'long-source'];
    const remaining = new Set(['long-source', 'unrelated']);
    assert.deepEqual(settleWallFaceLineage(hints, remaining), ['', '', 'fully-consumed', '']);
    assert.deepEqual(hints, ['long-source', '', 'fully-consumed', 'long-source']);
    assert.deepEqual([...remaining], ['long-source', 'unrelated']);
    assert.deepEqual(settleWallFaceLineage([], remaining), []);
  });

  for (const { name, options, residuals } of variants) test(`AC2: ${name}`, () => {
    const before = makeBefore(options);
    const original = structuredClone(before);
    const after = acceptFaces(before, options);
    const space = after.spaces[0];
    const room = space.rooms.find((item) => item.id === 'accepted-0');
    assert.equal(space.rooms.length, 2);
    assert.deepEqual(room.poly, fixture.face.map(normalized));
    assert.deepEqual(space.rooms.find((item) => item.id === 'neighbor'), before.spaces[0].rooms[0]);
    assert.deepEqual(after.spaces[1], before.spaces[1]);
    assert.deepEqual(after.markers, before.markers);
    assert.deepEqual(before, original, 'pure pipeline does not mutate its source');
    assert.equal((space.partitions || []).length, residuals);
    assert.equal((space.partitions || []).some((wall) => wall.id === sourceId), residuals > 0);
    const leftId = room.wall_ids[3];
    assert.equal(leftId === sourceId, residuals === 0, 'source identity belongs to a residual before promotion');
    assert.deepEqual(room.wall_ids.slice(0, 3), ['top-source', before.spaces[0].rooms[0].wall_ids[3], 'bottom-source']);
    assert.deepEqual(room.wall_ids.map((id) => space.wall_segments.find((wall) => wall.id === id).cm),
      [fixture.crossCm, fixture.crossCm, fixture.crossCm, options.sourceCm ?? fixture.source.cm]);
    for (const residual of space.partitions || []) {
      close(residual.a[0], 74 / fixture.grid, 'residual x');
      close(residual.b[0], 74 / fixture.grid, 'residual x');
      const low = Math.min(residual.a[1], residual.b[1]);
      const high = Math.max(residual.a[1], residual.b[1]);
      assert.ok(high <= 112 / fixture.grid + 1e-9 || low >= 133 / fixture.grid - 1e-9,
        'residual does not duplicate the consumed span');
      assert.equal(residual.cm, options.sourceCm ?? fixture.source.cm);
    }
    const source = before.spaces[0].partitions.find((wall) => wall.id === sourceId);
    const residualLength = (space.partitions || []).reduce((sum, wall) => sum + Math.abs(wall.b[1] - wall.a[1]), 0);
    close(residualLength + 21 / fixture.grid, Math.abs(source.b[1] - source.a[1]), 'source coverage');
    assertIdentity(space);
    assert.equal(checkSpacePhysicalGeometry(after, space.id).ok, true);
    assert.deepEqual(commitWallSegmentModel(after).config, after, 'no identity churn on the second commit');
  });

  test('the original unsatisfied hints still fail the unchanged duplicate-ID barrier', () => {
    const before = makeBefore();
    const original = structuredClone(before);
    assert.throws(() => acceptFaces(before, {}, false), (error) => error.reason === 'duplicate-id'
      && error.message.includes(sourceId));
    assert.deepEqual(before, original);
    const malformed = acceptFaces(before);
    malformed.spaces[0].partitions[0].id = malformed.spaces[0].wall_segments[0].id;
    const unchanged = structuredClone(malformed);
    assert.throws(() => commitWallSegmentModel(malformed), (error) => error.reason === 'duplicate-id');
    assert.deepEqual(malformed, unchanged, 'failed model commit is pure');
  });

  for (const fullyConsumed of [false, true]) test(`two accepted faces share one divider atom; full consumption=${fullyConsumed}`, () => {
    const options = { multiple: true, ...(fullyConsumed ? { start: 112, end: 133 } : {}) };
    const before = makeBefore(options);
    const after = acceptFaces(before, options);
    const space = after.spaces[0];
    const first = space.rooms.find((room) => room.id === 'accepted-0');
    const second = space.rooms.find((room) => room.id === 'accepted-1');
    assert.equal(first.wall_ids[2], 'divider-source');
    assert.equal(second.wall_ids[0], first.wall_ids[2]);
    assert.notEqual(first.wall_ids[3], second.wall_ids[3]);
    assert.equal([first.wall_ids[3], second.wall_ids[3]].filter((id) => id === sourceId).length,
      fullyConsumed ? 1 : 0, 'a fully consumed source ID belongs to exactly one physical atom');
    assertIdentity(space);
    assert.deepEqual(commitWallSegmentModel(after).config, after);
  });

  for (const { name, options } of hostVariants) test(`AC4 frontend candidate: ${name}`, () => {
    const before = makeBefore(options);
    const original = structuredClone(before);
    const after = acceptFaces(before, options);
    const space = after.spaces[0];
    assert.equal(space.openings.length, 1);
    const oldOpening = before.spaces[0].openings[0];
    const opening = space.openings[0];
    const { host: oldHost, ...oldData } = oldOpening;
    const { host, ...data } = opening;
    assert.deepEqual(data, oldData, 'absolute geometry and all metadata are preserved');
    if (options.openingY === 122) {
      assert.equal(host.kind, 'wall');
      assert.equal(space.wall_segments.filter((wall) => wall.id === host.id).length, 1);
    } else {
      assert.equal(host.kind, 'partition');
      assert.equal(host.id === oldHost.id, options.openingY === 100);
      assert.notEqual(host.t, oldHost.t, 'the parameter changes to preserve world position');
      const resolved = resolvePartitionOpeningStrict(opening, space.partitions, 1,
        fixture.cellCm, GRID_STEP_N).resolved;
      assert.ok(resolved, 'residual host resolves with strict jamb margins');
      close(resolved.center[0], oldOpening.x, 'opening x');
      close(resolved.center[1], oldOpening.y, 'opening y');
      close(resolved.length, oldOpening.length, 'opening length');
    }
    assertIdentity(space);
    assert.deepEqual(commitWallSegmentModel(after).config, after);
    assert.deepEqual(before, original);
  });

  test('ambiguous overlapping openings retain their hosts instead of disappearing', () => {
    const before = makeBefore({ openingY: 122 });
    before.spaces[0].openings.push({ ...structuredClone(before.spaces[0].openings[0]), id: 'overlapping-opening' });
    const after = acceptFaces(before);
    assert.deepEqual(after.spaces[0].openings, before.spaces[0].openings);
    for (const opening of after.spaces[0].openings) {
      assert.ok(after.spaces[0].partitions.some((wall) => wall.id === opening.host.id));
    }
    assertIdentity(after.spaces[0]);
  });

  const backendFixture = new URL('./fixtures/804-wall-face-lineage-backend.json', import.meta.url);
  for (const captured of JSON.parse(readFileSync(backendFixture, 'utf8'))) {
    test(`shared backend candidate is a fixed point: ${captured.name}`, () => {
      const scenario = [...variants, ...hostVariants].find((item) => item.name === captured.name);
      assert.ok(scenario, 'captured scenario has a current generator');
      assert.deepEqual(captured.before, makeBefore(scenario.options), 'capture input matches the synthetic seed');
      const crossCm = captured.before.spaces[0].partitions.find((wall) => wall.id === 'top-source').cm;
      const replay = acceptFaces(captured.before, { crossCm });
      assert.deepEqual(comparableNewIdentities(replay, captured.before),
        comparableNewIdentities(captured.after, captured.before), 'capture matches current frontend stages');
      assertIdentity(captured.after.spaces[0]);
      assert.deepEqual(commitWallSegmentModel(captured.after).config, captured.after);
      assert.equal(checkSpacePhysicalGeometry(captured.after, captured.after.spaces[0].id).ok, true);
      assert.deepEqual(captured.after.spaces[1], captured.before.spaces[1]);
    });
  }
}
