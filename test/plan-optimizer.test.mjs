import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  collapseIsolatedWallThicknessIslands, optimizePlans, PLAN_MODEL_VERSION,
} from '../test-build/plan-optimizer.js';
import {
  canonicalizeConfigGeometry, canonicalizeLatticeCoordinate, canonicalizeLayoutGeometry,
} from '../test-build/coordinate-canonicalization.js';
import { pointInPhysicalGeometry, unionBodies } from '../test-build/physical-geometry.js';
import { GRID_PITCH, GRID_STEP_N as S, NORM_W } from '../test-build/space-geometry.js';
import {
  wallBodiesGeometry, wallIntervals, wallKey,
} from '../test-build/wall-thickness.js';
import { checkMixedRoleRecords, checkWallKeys } from '../scripts/model-invariants.mjs';

const room = (id, x0, x1, openTo) => ({
  id,
  name: id,
  area: null,
  poly: [[x0, 0], [x1, 0], [x1, 1], [x0, 1]],
  ...(openTo ? { open_to: [openTo] } : {}),
});

const exactWall = (a, b, cm) => ({ key: wallKey(a, b, S), a, b, cm });

const coordinateFixture = JSON.parse(readFileSync(
  new URL('./fixtures/coordinate-canonicalization.json', import.meta.url),
  'utf8',
));
const storageRoundtripFixture = JSON.parse(readFileSync(
  new URL('./fixtures/optimize-storage-roundtrip.json', import.meta.url),
  'utf8',
));
const wallKeyRoundtripFixture = JSON.parse(readFileSync(
  new URL('./fixtures/258-wall-key-roundtrip.json', import.meta.url),
  'utf8',
));
const realFirstFloorFixture = JSON.parse(readFileSync(
  new URL('./fixtures/real-plan-first-floor.json', import.meta.url),
  'utf8',
));

const assertNoPersistedChanges = (result) => {
  assert.equal(result.changed, false);
  for (const field of [
    'moved', 'coordsCanonicalized', 'rotated', 'removedDrafts', 'migrated',
    'glowSpacesMigrated', 'glowRoomsMigrated', 'canonicalized', 'wallsMerged',
    'spansMerged', 'partitionsMerged', 'partitionsReconciled', 'openingsRehosted',
    'redundantDraftsRemoved',
    'wallsStraightened',
    'spaceRefsRemapped', 'roomRefsRemapped',
    'positionsRemapped', 'markersDetached', 'orphanRoomLabelsRemoved',
    'orphanDevicePositionsRemoved', 'orphanGroupPositionsRemoved',
    'liveMissingPositionsRemoved',
    'latticeCoordinatesCanonicalized', 'latticeCoordinatesFar',
    'latticeMaxShift', 'latticeMaxShiftCm',
  ]) assert.equal(result.report[field], 0, `${field} must describe the persisted delta`);
  assert.deepEqual(result.report.latticeSpaces, []);
  assert.equal(result.report.maxShift, 0);
  assert.equal(result.report.maxShiftCm, 0);
  assert.equal(result.report.maxSpace, '');
  assert.equal(result.report.maxStraightenShiftCm, 0);
  assert.equal(result.report.maxStraightenSpace, '');
};

const coincidentPartitionConfig = ({ roomCm = 20, partitionCm = 20, partial = false } = {}) => ({
  model_version: PLAN_MODEL_VERSION,
  spaces: [{
    id: 'coincident', title: 'Coincident', view_box: [0, 0, 1, 1], cell_cm: 5,
    rooms: [
      { id: 'left', name: 'left', area: null,
        poly: [[0, 0], [0.5, 0], [0.5, 1], [0, 1]] },
      { id: 'right', name: 'right', area: null,
        poly: [[0.5, 0], [1, 0], [1, 1], [0.5, 1]] },
    ],
    walls: [exactWall([0.5, 0], [0.5, 1], roomCm)],
    partitions: [{
      id: 'redundant',
      a: [0.5, partial ? 0.1 : 0], b: [0.5, partial ? 0.9 : 1], cm: partitionCm,
    }],
    openings: [{
      id: 'door', type: 'door', x: 0.5, y: 0.5, angle: -90, length: 0.2,
      contact: 'binary_sensor.door', lock: 'lock.door', invert: true,
      host: { kind: 'partition', id: 'redundant', t: 0.5 },
    }],
  }],
  markers: [], settings: {},
});

test('Optimize reconciles an exact coincident partition and losslessly rehosts its opening', () => {
  const input = coincidentPartitionConfig();
  const before = JSON.parse(JSON.stringify(input));
  const first = optimizePlans(input, {});
  assert.deepEqual(input, before, 'preview is immutable');
  assert.equal(first.changed, true);
  assert.equal(first.report.partitionsReconciled, 1);
  assert.equal(first.report.openingsRehosted, 1);
  const space = first.config.spaces[0];
  assert.equal(space.partitions, undefined);
  assert.equal(space.openings.length, 1);
  assert.equal(space.openings[0].host?.kind, 'wall');
  assert.deepEqual(space.openings[0], {
    id: 'door', type: 'door', x: 0.5, y: 0.5, angle: -90, length: 0.2,
    contact: 'binary_sensor.door', lock: 'lock.door', invert: true,
    host: { kind: 'wall', id: space.openings[0].host.id, t: 0.5 },
  });

  const second = optimizePlans(first.config, first.layout);
  assert.equal(second.changed, false);
  assert.equal(second.report.partitionsReconciled, 0);
  assert.equal(second.report.openingsRehosted, 0);
  assert.deepEqual(second.config, first.config);
});

test('Optimize uses the exact max envelope for nested coincident thicknesses', () => {
  for (const [roomCm, partitionCm, expected] of [[30, 20, 30], [20, 30, 30]]) {
    const result = optimizePlans(coincidentPartitionConfig({ roomCm, partitionCm }), {});
    assert.equal(result.report.partitionsReconciled, 1);
    assert.equal(result.config.spaces[0].partitions, undefined);
    const intervals = wallIntervals(
      result.config.spaces[0].rooms, result.config.spaces[0].walls, [],
      S, 5, GRID_PITCH, 1,
    ).filter((interval) => interval.kind === 'shared');
    assert.equal(new Set(intervals.map((interval) => interval.cm)).size, 1);
    assert.equal(intervals[0].cm, expected);
  }
});

test('Optimize reconciles fully hidden subspans but leaves ambiguous partitions untouched', () => {
  const partial = coincidentPartitionConfig({ partial: true });
  const partialResult = optimizePlans(partial, {});
  assert.equal(partialResult.report.partitionsReconciled, 1);
  assert.equal(partialResult.config.spaces[0].partitions, undefined);
  assert.equal(partialResult.config.spaces[0].openings[0].host?.kind, 'wall');

  const ambiguous = coincidentPartitionConfig();
  ambiguous.spaces[0].partitions.push({
    id: 'second', a: [0.5, 0], b: [0.5, 1], cm: 10,
  });
  const ambiguousResult = optimizePlans(ambiguous, {});
  assert.equal(ambiguousResult.report.partitionsReconciled, 0);
  assert.equal(ambiguousResult.config.spaces[0].partitions.length, 2);
  assert.ok(ambiguousResult.config.spaces[0].openings[0].host);
});

// Privacy-minimised six-room topology from #218/#223. The relevant stored ULP
// tails stay literal so this fixture proves that Optimize repairs the source,
// not merely that render-time boolean normalisation remains resilient.
const noisySixRoomFloor = [
  [[0.46666666666666673, 0.7083333333333334], [0.6125, 0.9],
    [0.4666666666666667, 1], [0.46666666666666673, 0.9]],
  [[0.1625, 0.3], [0.3458333333333333, 0],
    [0.46666666666666673, 1], [0.3458333333333333, 1]],
  [[0.7, 0], [0.8, 0], [0.8, 0.7083333333333334], [0.7, 0.7083333333333334]],
  [[0.7, 0.7083333333333335], [0.8, 0.7083333333333335], [0.8, 1], [0.7, 1]],
  [[0.85, 0], [0.9, 0], [0.9, 0.4], [0.85, 0.4]],
  [[0.85, 0.5], [0.9, 0.5], [0.9, 1], [0.85, 1]],
];

const microIntervalFixture = (length = S / 3, middleCm = 15, rightCm = 22) => {
  const x0 = 0.2, split = 0.5, x1 = 0.8, y = 0.2;
  return {
    rooms: [{ id: 'r1', poly: [[x0, y], [x1, y], [x1, 0.8], [x0, 0.8]] }],
    walls: [
      exactWall([x0, y], [split, y], 22),
      exactWall([split, y], [split + length, y], middleCm),
      exactWall([split + length, y], [x1, y], rightCm),
    ],
  };
};

// Privacy-minimised beta.5 topology from #273. The main room keeps one
// original straight parent edge. The upper room contributes only the
// perpendicular incident edge at `split`, so it is a real T-node rather than
// a collinear vertex inserted into the candidate's parent edge.
const topologyMicroIntervalFixture = () => {
  const x0 = 0.8, split = 0.8875, x1 = 0.95, y = 0.345833333;
  const microEnd = split + 0.001381904;
  return {
    split,
    microEnd,
    rooms: [
      { id: 'main', poly: [[x0, y], [x1, y], [x1, 0.5], [x0, 0.5]] },
      { id: 'branch', poly: [[0.845833333, 0.245833333], [split, 0.245833333],
        [split, y], [0.845833333, y]] },
    ],
    walls: [
      exactWall([x0, y], [split, y], 22),
      exactWall([split, y], [microEnd, y], 15),
      exactWall([microEnd, y], [x1, y], 22),
    ],
  };
};

test('Optimize collapses one isolated thickness micro-interval and is idempotent', () => {
  const fixture = microIntervalFixture();
  const config = {
    model_version: PLAN_MODEL_VERSION,
    spaces: [{
      id: 'micro', title: 'Micro', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: fixture.rooms, walls: fixture.walls,
    }],
    markers: [], settings: {},
  };
  const before = JSON.parse(JSON.stringify(config));
  const first = optimizePlans(config, {});
  assert.deepEqual(config, before, 'preview must not mutate its input');
  assert.equal(first.changed, true);
  assert.equal(first.report.canonicalized, 1);
  assert.equal(first.report.wallsMerged, 2);
  assert.equal(first.config.spaces[0].walls.length, 1);
  assert.equal(first.config.spaces[0].walls[0].cm, 22);
  assert.deepEqual(first.config.spaces[0].walls[0].a, [0.2, 0.2]);
  assert.deepEqual(first.config.spaces[0].walls[0].b, [0.8, 0.2]);

  const second = optimizePlans(first.config, first.layout);
  assert.equal(second.changed, false);
  assert.equal(second.report.canonicalized, 0);
  assert.equal(second.report.wallsMerged, 0);
  assert.deepEqual(second.config, first.config);
});

test('issue 273 Optimize collapses the beta.5 island beside one T-node', () => {
  const fixture = topologyMicroIntervalFixture();
  const config = {
    model_version: PLAN_MODEL_VERSION,
    spaces: [{
      id: 'topology-micro', title: 'Topology micro', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: fixture.rooms, walls: fixture.walls,
    }],
    markers: [], settings: {},
  };
  const before = structuredClone(config);
  const rawIntervals = wallIntervals(fixture.rooms, fixture.walls, [], S, 5, S);
  assert.ok(rawIntervals.some((interval) => interval.cm === 15),
    'runtime remains lossless before explicit Optimize');

  const first = optimizePlans(config, {});
  assert.deepEqual(config, before, 'preview must not mutate the T-node source');
  assert.equal(first.changed, true);
  assert.equal(first.report.canonicalized, 1);
  assert.equal(first.report.wallsMerged, 0,
    'role breakpoints may keep the record count even after the micro island is repaired');
  const canonicalBefore = canonicalizeConfigGeometry(before);
  assert.deepEqual(
    first.config.spaces[0].rooms.map((room) => room.id),
    canonicalBefore.spaces[0].rooms.map((room) => room.id),
    'T migration preserves room identity and order',
  );
  assert.deepEqual(
    first.config.spaces[0].rooms.map((room) => room.poly.filter((point) => (
      point[0] === 83 / 240 || point[0] === 203 / 240 || point[0] === 213 / 240
    ))),
    [
      [[203 / 240, 83 / 240], [213 / 240, 83 / 240]],
      [[203 / 240, 59 / 240], [213 / 240, 59 / 240], [213 / 240, 83 / 240], [203 / 240, 83 / 240]],
    ],
    'atomization materialises the exact T-node and owner-role breakpoints',
  );
  assert.equal(first.config.spaces[0].walls.length, 3);
  assert.ok(first.config.spaces[0].walls.every((wall) => wall.cm === 22),
    'the micro thickness is repaired without merging outer/shared owner roles');
  const exactNode = 83 / 240;
  const roleBreaks = first.config.spaces[0].walls
    .flatMap((wall) => [wall.a?.[0], wall.b?.[0]])
    .filter(Number.isFinite);
  assert.ok(roleBreaks.includes(203 / 240), 'outer→shared owner boundary stays exact');
  assert.ok(roleBreaks.includes(213 / 240), 'shared→outer owner boundary stays exact');

  const afterIntervals = wallIntervals(
    first.config.spaces[0].rooms, first.config.spaces[0].walls, [], S, 5, S,
  );
  assert.equal(afterIntervals.some((interval) => interval.cm === 15), false);
  const geometry = wallBodiesGeometry(
    first.config.spaces[0].rooms, first.config.spaces[0].walls, [], [], S, 5, S,
  );
  assert.ok(geometry, 'optimized profile must render a masonry body');
  for (const x of [fixture.split - S, (fixture.split + fixture.microEnd) / 2,
    fixture.microEnd + S]) {
    assert.equal(pointInPhysicalGeometry([x, exactNode - 0.008], geometry.geom), true,
      `22 cm outer face must stay continuous at x=${x}`);
  }

  const second = optimizePlans(first.config, first.layout);
  assertNoPersistedChanges(second);
  assert.deepEqual(second.config, first.config);
});

test('#299 Optimize keeps the real first-floor shared/outer role breakpoint', () => {
  const config = {
    model_version: PLAN_MODEL_VERSION,
    spaces: [structuredClone(realFirstFloorFixture.space)],
    markers: [], settings: {},
  };
  const before = structuredClone(config);
  const first = optimizePlans(config, {});
  assert.deepEqual(config, before, 'Optimize preview must not mutate the real fixture');
  assert.equal(first.changed, true);
  assert.deepEqual(checkMixedRoleRecords(first.config), []);
  assert.deepEqual(checkWallKeys(first.config, { notes: [] }), []);

  const y = 83 / 240;
  const line = first.config.spaces[0].walls.filter((wall) => wall.a && wall.b
    && Math.abs(wall.a[1] - y) < 1e-9 && Math.abs(wall.b[1] - y) < 1e-9);
  assert.equal(line.length, 2, 'micro cleanup keeps one exact record per owner role');
  assert.ok(line.every((wall) => wall.cm === 22));
  assert.ok(line.every((wall) => wall.a[0] === 213 / 240 || wall.b[0] === 213 / 240),
    'both runs stop at the exact shared/outer boundary');

  const second = optimizePlans(first.config, first.layout);
  assertNoPersistedChanges(second);
  assert.deepEqual(second.config, first.config);
  assert.deepEqual(second.layout, first.layout);
});

test('Optimize canonicalizes the six-room ULP source without claiming a visible move', () => {
  const config = {
    model_version: PLAN_MODEL_VERSION,
    spaces: [{
      id: 'noisy', title: 'Noisy', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: noisySixRoomFloor.map((poly, index) => ({ id: `room-${index}`, poly })),
    }],
    markers: [], settings: {}, future: { kept: true },
  };
  const before = structuredClone(config);
  const first = optimizePlans(config, {});

  assert.deepEqual(config, before, 'preview never mutates the noisy source');
  assert.equal(first.changed, true);
  assert.equal(first.report.moved, 0);
  assert.equal(first.report.maxShift, 0);
  assert.equal(first.report.maxShiftCm, 0);
  assert.ok(first.report.latticeCoordinatesCanonicalized > 0);
  assert.equal(first.report.coordsCanonicalized, 0,
    'storage-only tails are not presented as visible grid alignment');
  assert.deepEqual(first.config.future, { kept: true });
  for (const item of first.config.spaces[0].rooms) {
    for (const [x, y] of item.poly) {
      assert.equal(x, canonicalizeLatticeCoordinate(Math.round(x / S) * S));
      assert.equal(y, canonicalizeLatticeCoordinate(Math.round(y / S) * S));
    }
  }
  assert.ok(unionBodies(first.config.spaces[0].rooms.map((item) => item.poly)),
    'downstream boolean geometry accepts the exact candidate');

  const second = optimizePlans(first.config, first.layout);
  assert.equal(second.changed, false);
  assert.equal(second.report.coordsCanonicalized, 0);
  assert.equal(second.report.latticeCoordinatesCanonicalized, 0);
  assert.deepEqual(second.config, first.config);
  assert.deepEqual(second.layout, first.layout);
});

test('issue 248 Optimize stays a no-op across the lattice storage round-trip', () => {
  const inputBefore = structuredClone(storageRoundtripFixture.input);
  const first = optimizePlans(
    storageRoundtripFixture.input.config,
    storageRoundtripFixture.input.layout,
  );

  assert.deepEqual(storageRoundtripFixture.input, inputBefore, 'preview must keep fixture input');
  assert.equal(first.changed, true);
  assert.ok(first.report.latticeCoordinatesCanonicalized > 0);
  assert.equal(first.config.model_version, PLAN_MODEL_VERSION);
  assert.ok(first.config.spaces.every((space) => Array.isArray(space.wall_segments)));
  assert.deepEqual(
    first.config.spaces.map((space) => space.rooms.map((room) => room.poly)),
    storageRoundtripFixture.expected.config.spaces.map((space) => (
      space.rooms.map((room) => room.poly)
    )),
  );
  assert.deepEqual(first.layout, storageRoundtripFixture.expected.layout);
  assert.deepEqual(canonicalizeConfigGeometry(first.config), first.config);
  assert.deepEqual(canonicalizeLayoutGeometry(first.layout), first.layout);

  const inMemorySecond = optimizePlans(first.config, first.layout);
  assertNoPersistedChanges(inMemorySecond);
  assert.deepEqual(inMemorySecond.config, first.config);
  assert.deepEqual(inMemorySecond.layout, first.layout);

  const backendEcho = optimizePlans(
    canonicalizeConfigGeometry(first.config),
    canonicalizeLayoutGeometry(first.layout),
  );
  assertNoPersistedChanges(backendEcho);
  assert.deepEqual(backendEcho.config, first.config);
  assert.deepEqual(backendEcho.layout, first.layout);
});

test('issue 258 Optimize canonicalizes an affected wall key across storage round-trip', () => {
  const space = structuredClone(wallKeyRoundtripFixture.space);
  space.walls[0].key = wallKeyRoundtripFixture.affected_key;
  const config = {
    model_version: PLAN_MODEL_VERSION,
    spaces: [space],
    markers: [], settings: {},
  };
  const before = structuredClone(config);
  const first = optimizePlans(config, {});
  assert.deepEqual(config, before, 'preview must not mutate the affected source');
  assert.equal(first.changed, true);
  assert.equal(first.report.canonicalized, 1);
  const repaired = first.config.spaces[0].walls.find((wall) => wall.cm === 29);
  assert.ok(repaired);
  assert.equal(repaired.cm, 29);
  const canonicalSource = canonicalizeConfigGeometry({ spaces: [wallKeyRoundtripFixture.space] });
  assert.deepEqual(repaired.a, canonicalSource.spaces[0].walls[0].a);
  assert.deepEqual(repaired.b, canonicalSource.spaces[0].walls[0].b);
  assert.equal(repaired.key, wallKeyRoundtripFixture.canonical_key);
  assert.equal(repaired.key, wallKey(repaired.a, repaired.b, S));
  assert.deepEqual(canonicalizeConfigGeometry(first.config), first.config);

  const inMemorySecond = optimizePlans(first.config, first.layout);
  assertNoPersistedChanges(inMemorySecond);
  assert.deepEqual(inMemorySecond.config, first.config);
  const backendEcho = optimizePlans(canonicalizeConfigGeometry(first.config), first.layout);
  assertNoPersistedChanges(backendEcho);
  assert.deepEqual(backendEcho.config, first.config);
});

test('issue 248 every persisted geometry surface converges at every supported scale', () => {
  for (const cellCm of [1, 3, 5, 1000]) {
    const config = structuredClone(coordinateFixture.configInput);
    config.spaces[0].cell_cm = cellCm;
    const first = optimizePlans(config, coordinateFixture.layoutInput);
    assert.deepEqual(canonicalizeConfigGeometry(first.config), first.config, `config ${cellCm}`);
    assert.deepEqual(canonicalizeLayoutGeometry(first.layout), first.layout, `layout ${cellCm}`);

    const second = optimizePlans(first.config, first.layout);
    assertNoPersistedChanges(second);
    assert.deepEqual(second.config, first.config, `config round-trip ${cellCm}`);
    assert.deepEqual(second.layout, first.layout, `layout round-trip ${cellCm}`);
  }
});

test('micro-interval cleanup has a strict half-step boundary at both coordinate scales', () => {
  for (const length of [S / 3, S / 2, S / 2 + S / 100]) {
    const fixture = microIntervalFixture(length);
    const normalized = collapseIsolatedWallThicknessIslands(
      fixture.rooms, fixture.walls, [], S, 5, S, 1,
    );
    const normalizedMiddle = normalized.find((wall) => wall.a?.[0] === 0.5);
    assert.equal(normalizedMiddle?.cm, length < S / 2 ? 22 : 15, `normalized length=${length}`);

    const renderRooms = fixture.rooms.map((item) => ({
      ...item, poly: item.poly.map(([x, y]) => [x * NORM_W, y * NORM_W]),
    }));
    const rendered = collapseIsolatedWallThicknessIslands(
      renderRooms, fixture.walls, [], S, 5, GRID_PITCH, NORM_W,
    );
    const renderMiddle = rendered.find((wall) => wall.a?.[0] === 0.5);
    assert.equal(renderMiddle?.cm, length < S / 2 ? 22 : 15, `render length=${length}`);
  }
});

test('micro-interval cleanup preserves ambiguous and topological boundaries', () => {
  const unequal = microIntervalFixture(S / 3, 15, 20);
  assert.deepEqual(
    collapseIsolatedWallThicknessIslands(unequal.rooms, unequal.walls, [], S, 5, S),
    unequal.walls,
    'different neighbour thicknesses have no unambiguous replacement',
  );

  const overlapping = microIntervalFixture();
  overlapping.walls.splice(2, 0, { ...overlapping.walls[1], cm: 18 });
  assert.deepEqual(
    collapseIsolatedWallThicknessIslands(overlapping.rooms, overlapping.walls, [], S, 5, S),
    overlapping.walls,
    'conflicting exact owners of the same micro-interval are ambiguous',
  );

  const atVertex = microIntervalFixture();
  atVertex.rooms[0].poly.splice(1, 0, [0.5, 0.2]);
  assert.deepEqual(
    collapseIsolatedWallThicknessIslands(atVertex.rooms, atVertex.walls, [], S, 5, S),
    atVertex.walls,
    'a room vertex at the island endpoint is a topology boundary',
  );

  const atOpening = microIntervalFixture();
  const cut = [[0.45, 0.2, 0.5, 0.2]];
  assert.deepEqual(
    collapseIsolatedWallThicknessIslands(atOpening.rooms, atOpening.walls, cut, S, 5, S),
    atOpening.walls,
    'an open-cut endpoint at the island boundary blocks cleanup',
  );

  const betweenTwoNodes = topologyMicroIntervalFixture();
  betweenTwoNodes.rooms.push({
    id: 'branch-2',
    poly: [
      [betweenTwoNodes.microEnd, 0.245833333],
      [betweenTwoNodes.microEnd + 5 * S, 0.245833333],
      [betweenTwoNodes.microEnd + 5 * S, 0.345833333],
      [betweenTwoNodes.microEnd, 0.345833333],
    ],
  });
  assert.deepEqual(
    collapseIsolatedWallThicknessIslands(
      betweenTwoNodes.rooms, betweenTwoNodes.walls, [], S, 5, S,
    ),
    betweenTwoNodes.walls,
    'an interval between two room topology nodes remains intentional',
  );

  const chain = microIntervalFixture(S / 3, 15, 22);
  const y = 0.2, firstEnd = 0.5 + S / 3, secondEnd = firstEnd + S / 3;
  chain.walls = [
    exactWall([0.2, y], [0.5, y], 22),
    exactWall([0.5, y], [firstEnd, y], 15),
    exactWall([firstEnd, y], [secondEnd, y], 16),
    exactWall([secondEnd, y], [0.8, y], 22),
  ];
  assert.deepEqual(
    collapseIsolatedWallThicknessIslands(chain.rooms, chain.walls, [], S, 5, S),
    chain.walls,
    'a chain of different micro-intervals must not collapse cumulatively',
  );
});

test('micro-interval cleanup is endpoint, input-order and room-order invariant without mutation', () => {
  const baselineFixture = microIntervalFixture();
  const fixture = microIntervalFixture();
  const detached = {
    id: 'r2', poly: [[0.85, 0.85], [0.95, 0.85], [0.95, 0.95], [0.85, 0.95]],
  };
  const semantic = (walls) => walls.map((wall) => {
    const ends = [wall.a, wall.b]
      .map((point) => point.map((value) => Number(value.toFixed(12))).join(','))
      .sort();
    return `${ends[0]}|${ends[1]}|${wall.cm}`;
  }).sort();

  const baseline = collapseIsolatedWallThicknessIslands(
    [baselineFixture.rooms[0], structuredClone(detached)], baselineFixture.walls, [], S, 5, S,
  );
  const reversedMiddle = {
    ...fixture.walls[1],
    a: [...fixture.walls[1].b],
    b: [...fixture.walls[1].a],
  };
  const rooms = [detached, {
    ...fixture.rooms[0], poly: [...fixture.rooms[0].poly].reverse().map((point) => [...point]),
  }];
  const walls = [fixture.walls[2], reversedMiddle, fixture.walls[0]]
    .map((wall) => ({ ...wall, a: [...wall.a], b: [...wall.b] }));
  const beforeRooms = structuredClone(rooms);
  const beforeWalls = structuredClone(walls);

  const result = collapseIsolatedWallThicknessIslands(rooms, walls, [], S, 5, S);
  assert.deepEqual(rooms, beforeRooms, 'helper must not mutate rooms or their winding');
  assert.deepEqual(walls, beforeWalls, 'helper must not mutate the walls array or entries');
  assert.deepEqual(semantic(result), semantic(baseline));
  assert.equal(result.find((wall) => wall.a?.[0] === 0.5 || wall.b?.[0] === 0.5)?.cm, 22);
});

test('optimizePlans migrates, aligns and canonicalises idempotently', () => {
  const config = {
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1], cell_cm: 5,
      plan_scale: 0.75,
      segments: [[0, 0, 1, 0]],
      rooms: [room('a', 0, 0.5, 'b'), room('b', 0.5, 1, 'a')],
      walls: [
        { key: wallKey([0, 0], [0.25, 0], S), a: [0, 0], b: [0.25, 0], cm: 20 },
        { key: wallKey([0.25, 0], [0.5, 0], S), a: [0.25, 0], b: [0.5, 0], cm: 20 },
      ],
      decor: [{
        id: 't1', kind: 'text', x: S / 3, y: S / 3,
        text: 'Now {}', entity: 'sensor.temp', attr: 'state', size: 'm',
      }, {
        id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 1, y2: 0, width: 3,
      }],
    }],
    markers: [{
      id: 'm1', binding: 'virtual', display: 'ripple',
      vacuum: { trail: false },
    }],
    settings: {},
  };
  const layout = { m1: { s: 'f1', x: S / 3, y: S / 3 } };

  const first = optimizePlans(config, layout);
  assert.equal(first.changed, true);
  assert.equal(first.config.model_version, PLAN_MODEL_VERSION);
  assert.equal('segments' in first.config.spaces[0], false);
  assert.equal(first.config.markers[0].display, 'icon_ripple');
  assert.deepEqual(first.config.markers[0].vacuum, { trail_mode: 'never' });
  assert.equal(first.config.spaces[0].decor[0].text, 'Now {sensor.temp}');
  assert.equal(first.config.spaces[0].decor[0].size_cm, 24);
  assert.equal('scale' in first.config.spaces[0].decor[0], false);
  assert.equal(first.config.spaces[0].decor[1].width_cm, 3.6);
  assert.equal('width' in first.config.spaces[0].decor[1], false);
  assert.equal(first.config.spaces[0].plan_scale_x, 0.75);
  assert.equal(first.config.spaces[0].plan_scale_y, 0.75);
  assert.equal('plan_scale' in first.config.spaces[0], false);
  assert.equal('entity' in first.config.spaces[0].decor[0], false);
  assert.equal(first.config.spaces[0].open_spans.length, 1);
  assert.equal(first.config.spaces[0].walls.length, 1);
  assert.equal(first.layout.m1.x % S, 0);

  const second = optimizePlans(first.config, first.layout);
  assert.equal(second.changed, false);
  assert.deepEqual(second.config, first.config);
  assert.deepEqual(second.layout, first.layout);
});

test('legacy physical decor fields are clamped to the persisted schema', () => {
  const result = optimizePlans({
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1], cell_cm: 1000,
      rooms: [],
      decor: [
        { id: 'wide', kind: 'line', x1: 0, y1: 0, x2: 1, y2: 0, width: 300 },
        { id: 'thin', kind: 'line', x1: 0, y1: 0, x2: 1, y2: 0, width: 0 },
        { id: 'huge', kind: 'text', x: 0, y: 0, text: 'X', scale: 20 },
      ],
    }],
    markers: [], settings: {},
  }, {});
  const [wide, thin, huge] = result.config.spaces[0].decor;
  assert.equal(wide.width_cm, 100);
  assert.equal(thin.width_cm, 0.1);
  assert.equal(huge.size_cm, 2000);
});

test('invalid legacy plan_scale is preserved instead of being counted as migrated', () => {
  const result = optimizePlans({
    model_version: PLAN_MODEL_VERSION,
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1],
      plan_scale: 'broken', rooms: [],
    }],
    markers: [], settings: {},
  }, {});
  assert.equal(result.config.spaces[0].plan_scale, 'broken');
  assert.equal(result.report.migrated, 0);
});

test('model version bookkeeping does not claim a data migration', () => {
  const result = optimizePlans({
    model_version: PLAN_MODEL_VERSION - 1,
    spaces: [], markers: [], settings: {},
  }, {});
  assert.equal(result.changed, true, 'explicit Optimize materialises model v8 even without rooms');
  assert.equal(result.config.model_version, PLAN_MODEL_VERSION);
  assert.equal(result.report.modelTo, PLAN_MODEL_VERSION);
  assert.equal(result.report.migrated, 0);
  assert.equal(result.report.wallSegmentsMigrated, 0);
});

test('issue 252 Optimize detaches a live marker without silently deleting its old position', () => {
  const input = {
    model_version: PLAN_MODEL_VERSION - 1,
    spaces: [{ id: 'home', title: 'Home', view_box: [0, 0, 1, 1], rooms: [] }],
    markers: [{ id: 'm', binding: 'virtual', space: 'gone', icon: 'mdi:sofa' }],
    settings: {},
  };
  const result = optimizePlans(input, { m: { s: 'gone', x: 0.25, y: 0.5 } });
  assert.equal(result.changed, true);
  assert.equal(result.config.model_version, PLAN_MODEL_VERSION);
  assert.equal(result.config.markers[0].space, undefined);
  assert.equal(result.config.markers[0].icon, 'mdi:sofa');
  assert.deepEqual(result.layout.m, { s: 'gone', x: 0.25, y: 0.5 });
  assert.equal(result.report.markersDetached, 1);
  assert.equal(result.report.positionsUnresolved, 1);
  assert.equal(result.report.liveMissingPositions.length, 1);
  assert.equal(result.report.migrated, 0, 'reference counters stay separate from migration');
});

test('optimizer never downgrades a model from a newer client', () => {
  const future = PLAN_MODEL_VERSION + 1;
  const result = optimizePlans({
    model_version: future,
    spaces: [], markers: [], settings: {},
  }, {});
  assert.equal(result.changed, false);
  assert.equal(result.config.model_version, future);
  assert.equal(result.report.modelTo, future);
});

test('legacy filled shapes receive the canonical fill fields', () => {
  const result = optimizePlans({
    model_version: PLAN_MODEL_VERSION,
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1], rooms: [],
      decor: [{
        id: 'r1', kind: 'rect', x: 0, y: 0, w: 0.2, h: 0.2,
        color: '#123456', fill: true,
      }],
    }],
    markers: [], settings: {},
  }, {});
  assert.equal(result.config.spaces[0].decor[0].fill_color, '#123456');
  assert.equal(result.config.spaces[0].decor[0].fill_opacity, 0.25);
});

test('optimizer removes legacy self-control without inventing a light source', () => {
  const result = optimizePlans({
    model_version: PLAN_MODEL_VERSION - 1,
    spaces: [],
    markers: [{
      id: 'hood', binding: 'entity:switch.hood',
      controls: ['switch.hood', 'input_boolean.legacy', 'light.mirror', 'light.mirror'],
    }],
    settings: {},
  }, {});
  assert.deepEqual(result.config.markers[0].controls, [
    'input_boolean.legacy', 'light.mirror', 'light.mirror',
  ]);
  assert.equal(result.config.markers[0].is_light, undefined);
  assert.equal(result.config.model_version, PLAN_MODEL_VERSION);
  assert.equal(result.report.migrated, 1);
});

test('optimizer repairs legacy cell_cm values into the server schema range', () => {
  const result = optimizePlans({
    spaces: [
      { id: 'high', title: 'High', view_box: [0, 0, 1, 1], cell_cm: 5000, rooms: [] },
      { id: 'low', title: 'Low', view_box: [0, 0, 1, 1], cell_cm: 0.01, rooms: [] },
      { id: 'bad', title: 'Bad', view_box: [0, 0, 1, 1], cell_cm: 'NaN', rooms: [] },
      { id: 'zero', title: 'Zero', view_box: [0, 0, 1, 1], cell_cm: 0, rooms: [] },
      { id: 'null', title: 'Null', view_box: [0, 0, 1, 1], cell_cm: null, rooms: [] },
      { id: 'negative', title: 'Negative', view_box: [0, 0, 1, 1], cell_cm: -2, rooms: [] },
    ],
    markers: [], settings: {},
  }, {});
  assert.deepEqual(result.config.spaces.map((space) => space.cell_cm), [1000, 0.1, 5, 5, 5, 5]);
  assert.equal(result.report.migrated, 6);
});

test('optimizer separates legacy Glow from data fill without losing explicit booleans', () => {
  const result = optimizePlans({
    spaces: [{
      id: 'legacy', title: 'Legacy', view_box: [0, 0, 1, 1],
      settings: { fill_mode: 'glow', glow_enabled: false, future: 'kept' },
      rooms: [
        { ...room('a', 0, 0.5), settings: { fill_mode: 'glow', future: 1 } },
        { ...room('b', 0.5, 1), settings: { fill_mode: 'glow', glow: false } },
      ],
    }],
    markers: [], settings: {},
  }, {});
  const space = result.config.spaces[0];
  assert.equal(space.settings.fill_mode, 'none');
  assert.equal(space.settings.glow_enabled, false);
  assert.equal(space.settings.future, 'kept');
  assert.deepEqual(space.rooms[0].settings, { future: 1, glow: true });
  assert.deepEqual(space.rooms[1].settings, { glow: false });
  assert.equal(result.report.migrated, 3);
  assert.equal(result.report.glowSpacesMigrated, 1);
  assert.equal(result.report.glowRoomsMigrated, 2);
  const again = optimizePlans(result.config, result.layout);
  assert.equal(again.changed, false);
});

test('optimizer canonicalises only an explicitly stored square-column angle', () => {
  const result = optimizePlans({
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1], rooms: [],
      wall_columns: [
        { id: 'implicit', shape: 'square', center: [0.2, 0.2], cm: 30 },
        { id: 'explicit', shape: 'square', center: [0.4, 0.4], cm: 30, angle: 95 },
      ],
    }],
    markers: [], settings: {},
  }, {});
  const [implicit, explicit] = result.config.spaces[0].wall_columns;
  assert.equal('angle' in implicit, false);
  assert.equal(explicit.angle, 5);
});

// --- issue #229: сращивание независимых стен в «Оптимизировать планы» --------

const partition = (id, ax, ay, bx, by, cm = 15) => ({ id, a: [ax, ay], b: [bx, by], cm });

test('issue 229 Optimize collapses the seams an older plan has piled up', () => {
  const config = {
    spaces: [{
      id: 'f1', title: 'Floor', cell_cm: 5, view_box: [0, 0, 1, 1], rooms: [],
      partitions: [
        partition('p1', 0.1, 0.1, 0.3, 0.1),
        partition('p2', 0.3, 0.1, 0.5, 0.1),
        partition('p3', 0.5, 0.1, 0.7, 0.1),
        // a lone wall elsewhere: nothing to merge with, must survive untouched
        partition('lonely', 0.1, 0.6, 0.4, 0.6),
      ],
    }],
    markers: [], settings: {},
  };
  const result = optimizePlans(config, {});
  const space = result.config.spaces[0];
  assert.equal(result.report.partitionsMerged, 2, 'three collinear pieces are one wall');
  assert.equal(space.partitions.length, 2);
  const merged = space.partitions.find((p) => p.id !== 'lonely');
  assert.deepEqual([merged.a, merged.b], [[0.1, 0.1], [0.7, 0.1]]);
  assert.ok(space.partitions.some((p) => p.id === 'lonely'), 'an unrelated wall is left alone');

  // Idempotent: the sweep has nothing left to do on its own output.
  const again = optimizePlans(result.config, result.layout);
  assert.equal(again.report.partitionsMerged, 0);
  assert.equal(again.config.spaces[0].partitions.length, 2);
});

test('issue 229 Optimize keeps a door where it was when its host is merged', () => {
  const config = {
    spaces: [{
      id: 'f1', title: 'Floor', cell_cm: 5, view_box: [0, 0, 1, 1], rooms: [],
      partitions: [
        partition('p1', 0.1, 0.1, 0.3, 0.1),
        partition('p2', 0.3, 0.1, 0.5, 0.1),
      ],
      // door in the middle of p2 → absolute x = 0.4
      openings: [{
        id: 'door', type: 'door', x: 0.4, y: 0.1, angle: 0, length: 0.05,
        host: { kind: 'partition', id: 'p2', t: 0.5 },
      }],
    }],
    markers: [], settings: {},
  };
  const result = optimizePlans(config, {});
  const space = result.config.spaces[0];
  assert.equal(result.report.partitionsMerged, 1);
  const [wall] = space.partitions;
  const [door] = space.openings;
  assert.equal(door.host.id, wall.id, 'the host that vanished is not referenced any more');
  const x = wall.a[0] + (wall.b[0] - wall.a[0]) * door.host.t;
  assert.ok(Math.abs(x - 0.4) < 1e-9, `door moved to ${x}`);
  // …and the legacy projection follows, because that is all an older reader sees
  assert.ok(Math.abs(door.x - 0.4) < 1e-9, `stale projection: ${door.x}`);
});

test('issue 229 Optimize rewrites the legacy projection when the merged wall turns around', () => {
  // Both pieces are stored right-to-left; the survivor is canonicalised
  // left-to-right, so the angle an older reader draws from must be rewritten.
  const config = {
    spaces: [{
      id: 'f1', title: 'Floor', cell_cm: 5, view_box: [0, 0, 1, 1], rooms: [],
      partitions: [
        partition('p1', 0.5, 0.1, 0.3, 0.1),
        partition('p2', 0.3, 0.1, 0.1, 0.1),
      ],
      openings: [{
        id: 'door', type: 'door', x: 0.4, y: 0.1, angle: 180, length: 0.05,
        host: { kind: 'partition', id: 'p1', t: 0.5 },
      }],
    }],
    markers: [], settings: {},
  };
  const result = optimizePlans(config, {});
  const space = result.config.spaces[0];
  const [wall] = space.partitions;
  const [door] = space.openings;
  assert.equal(result.report.partitionsMerged, 1);
  assert.deepEqual([wall.a, wall.b], [[0.1, 0.1], [0.5, 0.1]], 'survivor points one way');
  const x = wall.a[0] + (wall.b[0] - wall.a[0]) * door.host.t;
  assert.ok(Math.abs(x - 0.4) < 1e-9, `door moved to ${x}`);
  assert.ok(Math.abs(door.x - 0.4) < 1e-9, `stale projection x: ${door.x}`);
  assert.equal(door.angle, 0, 'stale projection angle');
});

test('issue 229 a node on the side of a room survives the sweep', () => {
  // The junction sits in the middle of the room's bottom side, not on a
  // corner — an ordinary T-junction, and the reason the node exists.
  // Regression for the rescaled room polygons of CODE-REVIEW-229-r1 High-1.
  const config = {
    spaces: [{
      id: 'f1', title: 'Floor', cell_cm: 5, view_box: [0, 0, 1, 1],
      rooms: [{ id: 'r1', x: 0.1, y: 0.1, w: 0.4, h: 0.4 }],
      partitions: [
        partition('p1', 0.1, 0.5, 0.3, 0.5),
        partition('p2', 0.3, 0.5, 0.5, 0.5),
      ],
    }],
    markers: [], settings: {},
  };
  const result = optimizePlans(config, {});
  assert.equal(result.report.partitionsMerged, 0, 'the room side holds the node');
  assert.equal(result.report.partitionsReconciled, 2,
    'the two node-bounded records are then independently absorbed by #296');
  assert.equal(result.config.spaces[0].partitions, undefined);
});
