import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOLEAN_COORD_QUANTUM, canonicalColumnAngle, columnBody, floorMinusBodies, geometryArea,
  directionalOccluders, intersectionPaths, partitionBody, pointInPhysicalBody,
  physicalBodyParts, physicalBodySet, pointInOpaquePlanBody, pointInPhysicalGeometry,
  normalizeBooleanBody, sameColumnPlacement, unionBodies,
} from '../test-build/physical-geometry.js';
import {
  polygonSegments, splitAtIntersections, visibilityPolygon,
} from '../test-build/light-visibility.js';

const closeTo = (got, want, tol = 1e-6) =>
  assert.ok(Math.abs(got - want) <= tol, `expected ${want}, got ${got}`);

// Privacy-minimised topology from the six-room #218 failure. The two relevant
// stored double tails are preserved; names, ids, entities and unrelated plan
// geometry are deliberately absent.
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

test('partition body keeps the centreline and requested physical width', () => {
  const body = partitionBody([0, 0], [1, 0], 10, 5, 0.25);
  assert.ok(body);
  closeTo(body[0][1], 0.25);
  closeTo(body[2][1], -0.25);
  closeTo(geometryArea([[[...body, body[0]]]]), 0.5);
});

test('joined partitions fill straight and oblique endpoint teeth without changing flat free caps', () => {
  const base = {
    room_drafts: [], wall_columns: [],
    partitions: [
      { id: 'horizontal', a: [-2, 0], b: [0, 0], cm: 10 },
      { id: 'vertical', a: [0, 0], b: [0, 2], cm: 10 },
      { id: 'oblique', a: [4, 2], b: [3, 0], cm: 20 },
      { id: 'oblique-arm', a: [3, 0], b: [5, -1], cm: 10 },
    ],
  };
  const frame = physicalBodySet(base, 5, 0.25);
  assert.ok(frame.patches.length >= 2, 'each non-collinear endpoint node gains a bounded patch');
  assert.equal(pointInPhysicalGeometry([0.2, -0.2], frame.geometry), true,
    'the missing outer quadrant at the right angle is solid');
  assert.equal(pointInPhysicalGeometry([5.3, -1.15], frame.geometry), false,
    'an unrelated flat free cap is not extended');

  const reversed = physicalBodySet({
    ...base,
    partitions: [...base.partitions].reverse().map((segment) => ({
      ...segment, a: segment.b, b: segment.a,
    })),
  }, 5, 0.25);
  closeTo(geometryArea(frame.geometry), geometryArea(reversed.geometry), 1e-8);
});

test('runtime physical parts preserve joined bodies without materializing union geometry', () => {
  const space = {
    room_drafts: [], wall_columns: [],
    partitions: [
      { id: 'horizontal', a: [-2, 0], b: [0, 0], cm: 10 },
      { id: 'vertical', a: [0, 0], b: [0, 2], cm: 10 },
    ],
  };
  const parts = physicalBodyParts(space, 5, 0.25);
  const set = physicalBodySet(space, 5, 0.25);
  assert.equal(Object.hasOwn(parts, 'geometry'), false,
    'the production parts API must not hide an eager polygon union');
  assert.deepEqual(parts, {
    drafts: set.drafts,
    partitions: set.partitions,
    columns: set.columns,
    patches: set.patches,
    all: set.all,
  });
  assert.ok(set.geometry, 'the explicit geometry API still returns the canonical union');
});

test('endpoint-on-line T join is computed without splitting or mutating source records', () => {
  const space = {
    room_drafts: [{
      id: 'draft-branch', points: [[1, -2], [1, 0]], segments: [{ cm: 15 }],
    }],
    wall_columns: [],
    partitions: [
      { id: 'through', a: [-2, 0], b: [2, 0], cm: 20 },
      { id: 'branch', a: [0, -2], b: [0, 0], cm: 10 },
    ],
  };
  const before = JSON.stringify(space);
  const frame = physicalBodySet(space, 5, 0.25);
  assert.ok(frame.patches.length >= 2, 'partition and saved-draft branches share the T primitive');
  assert.equal(pointInPhysicalGeometry([0.2, -0.1], frame.geometry), true);
  assert.equal(pointInPhysicalGeometry([1.2, -0.1], frame.geometry), true);
  assert.equal(JSON.stringify(space), before, 'computed node topology is render-only');
});

test('column size means square side or circle diameter', () => {
  const square = columnBody(
    { id: 'sq', shape: 'square', center: [1, 1], cm: 20, angle: 45 }, 5, 0.25,
  );
  const circle = columnBody(
    { id: 'ci', shape: 'circle', center: [1, 1], cm: 20 }, 5, 0.25,
  );
  closeTo(Math.hypot(square[0][0] - square[1][0], square[0][1] - square[1][1]), 1);
  closeTo(Math.hypot(circle[0][0] - 1, circle[0][1] - 1), 0.5);
});

test('column rotation is canonical modulo a quarter turn', () => {
  assert.equal(canonicalColumnAngle(90), 0);
  assert.equal(canonicalColumnAngle(-45), 45);
  assert.equal(canonicalColumnAngle(405), 45);
});

test('physical bodies are removed from clean floor area', () => {
  const floor = [[0, 0], [2, 0], [2, 2], [0, 2]];
  const obstacle = [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]];
  closeTo(geometryArea(floorMinusBodies(floor, [obstacle])), 3);
});

test('boolean input normalization collapses ULP tails without mutating saved outlines', () => {
  const body = [
    [-0, 0],
    [0.46666666666666673, 0],
    [0.4666666666666667, 0],
    [0.4666666666666667, 1],
    [0, 1],
    [-0, 0],
  ];
  const before = structuredClone(body);
  const stable = normalizeBooleanBody(body);
  assert.deepEqual(body, before, 'the persisted/input outline stays byte-for-byte untouched');
  assert.deepEqual(stable, [[0, 0], [0.466667, 0], [0.466667, 1], [0, 1]]);
  assert.equal(Object.is(stable[0][0], -0), false, 'negative zero is canonicalised');
  assert.equal(BOOLEAN_COORD_QUANTUM, 1e-6);
  assert.equal(normalizeBooleanBody([[0, 0], [1e-12, 0], [0, 1e-12]]), null,
    'a ring collapsed by the boolean quantum never reaches polyclip');
});

test('six-room ULP topology keeps a complete visible floor and is permutation-stable', () => {
  const before = structuredClone(noisySixRoomFloor);
  const fan = [[-0.1, -0.1], [1.1, -0.1], [1.1, 1.1], [-0.1, 1.1]];
  const failures = [];
  const paths = intersectionPaths([fan], noisySixRoomFloor, {
    onBoundsFailure: (failure) => failures.push(failure),
  });
  assert.ok(paths.length > 0, 'the real ULP topology produces a non-empty Glow clip');
  assert.deepEqual(failures, [], 'normal arithmetic noise is repaired before fallback');
  assert.deepEqual(noisySixRoomFloor, before, 'render-time stabilisation never rewrites room data');

  const direct = unionBodies(noisySixRoomFloor);
  const reversed = unionBodies([...noisySixRoomFloor].reverse());
  assert.ok(direct && reversed);
  closeTo(geometryArea(direct), geometryArea(reversed), BOOLEAN_COORD_QUANTUM ** 2);
  closeTo(geometryArea(direct), 0.31835083680549986, 1e-9);
});

test('one malformed room is diagnosed and cannot erase healthy lit floor', () => {
  const fan = [[-1, -1], [6, -1], [6, 3], [-1, 3]];
  const healthy = [[3, 0], [5, 0], [5, 2], [3, 2]];
  // Deterministic polyclip failure: individually invalid rather than merely a
  // bow-tie, which polyclip legally resolves into two triangles.
  const malformed = [[2, 1], [0, 0], [2, 2], [1, 0], [0, 2], [2, 0]];
  const failures = [];
  const paths = intersectionPaths([fan], [healthy, malformed], {
    onBoundsFailure: (failure) => failures.push(failure),
  });
  assert.deepEqual(paths, ['M 3 0 L 5 0 L 5 2 L 3 2 Z']);
  assert.deepEqual(failures, [{ boundIndex: 1, phase: 'bound-union' }]);
  assert.deepEqual(intersectionPaths([fan], [malformed]), [],
    'when every room fails there is no raw-fan light leak');

  const collapsed = [[0, 0], [1e-12, 0], [0, 1e-12]];
  const collapsedFailures = [];
  assert.deepEqual(intersectionPaths([fan], [healthy, collapsed], {
    onBoundsFailure: (failure) => collapsedFailures.push(failure),
  }), ['M 3 0 L 5 0 L 5 2 L 3 2 Z']);
  assert.deepEqual(collapsedFailures, [{ boundIndex: 1, phase: 'bound-union' }],
    'a ring rejected during normalisation is observable through the same fallback');
});

test('fallback unions overlapping healthy rooms instead of making an evenodd hole', () => {
  const fan = [[-1, -1], [16, -1], [16, 3], [-1, 3]];
  const malformed = [[12, 1], [10, 0], [12, 2], [11, 0], [10, 2], [12, 0]];
  const left = [[0, 0], [3, 0], [3, 2], [0, 2]];
  const right = [[2, 0], [5, 0], [5, 2], [2, 2]];
  const failures = [];
  const paths = intersectionPaths([fan], [malformed, left, right], {
    onBoundsFailure: (failure) => failures.push(failure),
  });
  assert.equal(paths.length, 1, 'overlap is geometrically united, not concatenated as evenodd');
  assert.match(paths[0], /M 0 0 L 5 0 L 5 2 L 0 2 Z/);
  assert.deepEqual(failures, [{ boundIndex: 0, phase: 'bound-union' }]);
});

test('intersection failure is fail-dark and never returns the unclipped fan', () => {
  const rooms = [
    [[100, 70], [160, 70], [160, 120], [100, 120]],
    [[10, 150], [60, 150], [60, 170], [10, 170]],
    [[240, 20], [250, 20], [250, 80], [240, 80]],
    [[180, 150], [230, 150], [230, 220], [180, 220]],
    [[180, 110], [240, 110], [240, 170], [180, 170]],
  ];
  // This exact sweep used to make polyclip throw on nudge-generated decimals.
  const barriers = splitAtIntersections(rooms.flatMap(polygonSegments));
  const fan = visibilityPolygon([170, 380], 285, barriers);
  const paths = intersectionPaths([fan], rooms);
  assert.deepEqual(paths, [], 'a source outside every room must never return its raw visibility fan');
  assert.deepEqual(intersectionPaths([fan], []), [], 'missing floor bounds are dark, not unbounded');
});

test('overlapping physical bodies are subtracted from floor only once', () => {
  const floor = [[0, 0], [4, 0], [4, 4], [0, 4]];
  const a = [[1, 1], [3, 1], [3, 2], [1, 2]];
  const b = [[2, 1], [3.5, 1], [3.5, 2], [2, 2]];
  closeTo(geometryArea(floorMinusBodies(floor, [a, b])), 13.5);
});

test('96-sided circle area error stays below 0.2 percent', () => {
  const circle = columnBody(
    { id: 'circle', shape: 'circle', center: [0, 0], cm: 100 }, 5, 0.25,
  );
  const got = geometryArea([[[...circle, circle[0]]]]);
  const radius = 2.5;
  assert.ok(Math.abs(got - Math.PI * radius * radius) / (Math.PI * radius * radius) < 0.002);
});

test('directional occluder extrudes a body along the ray direction', () => {
  const body = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const [shadow] = directionalOccluders([body], [1, 0], 8);
  assert.ok(Math.max(...shadow.map((p) => p[0])) >= 9);
  assert.ok(pointInPhysicalBody([5, 0.5], shadow));
});

test('a source in an exterior opening is opaque while an interior passage hole is valid', () => {
  const geometry = [[
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]],
  ]];
  // Exterior doors/gates and every window are deliberately absent from the
  // passage cuts, so their drawn tunnel remains part of light's opaque
  // masonry. A source centred there must emit no pool at all.
  assert.equal(pointInPhysicalGeometry([1, 5], geometry), true, 'opaque exterior opening');
  // A door/gate with floor on both sides is a real cut through the light
  // masonry. Placing a source in that internal passage remains valid.
  assert.equal(pointInPhysicalGeometry([5, 5], geometry), false, 'transparent interior passage');
  assert.equal(pointInPhysicalGeometry([12, 5], geometry), false, 'outside body');
});

test('the source guard combines wall masonry with partitions and columns', () => {
  const masonry = [[
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]],
  ]];
  const partition = [[12, 0], [14, 0], [14, 10], [12, 10]];
  assert.equal(pointInOpaquePlanBody([1, 5], masonry, [partition]), true, 'wall body');
  assert.equal(pointInOpaquePlanBody([5, 5], masonry, [partition]), false, 'interior opening');
  assert.equal(pointInOpaquePlanBody([13, 5], masonry, [partition]), true, 'partition/column');
  assert.equal(pointInOpaquePlanBody([20, 5], masonry, [partition]), false, 'clear floor');
});

test('empty boolean masonry falls back to light-policy partition bodies', () => {
  const space = {
    room_drafts: [], wall_columns: [],
    partitions: [{ id: 'host', a: [0, 0], b: [10, 0], cm: 10 }],
  };
  const hostedSlot = { hostId: 'host', a: [4, 0], b: [6, 0], depth: 2 };
  const drawnBodies = physicalBodyParts(space, 5, 1, 1e-6, [hostedSlot]).all;
  const opaqueWindowBodies = physicalBodyParts(space, 5, 1, 1e-6, []).all;
  const source = [5, 0];

  assert.equal(pointInOpaquePlanBody(source, [], drawnBodies), false,
    'the presentation body has a slot for every hosted opening');
  assert.equal(pointInOpaquePlanBody(source, [], opaqueWindowBodies), true,
    'a window/exterior opening stays opaque when boolean masonry is unavailable');
  assert.equal(pointInOpaquePlanBody(source, [], drawnBodies), false,
    'an interior passage remains a valid transparent source position');
});

test('exact column overlays are rejected but rotated square bodies remain distinct', () => {
  const square = { id: 'a', shape: 'square', center: [1, 1], cm: 30, angle: 0 };
  assert.equal(sameColumnPlacement(square, { ...square, id: 'b', angle: 90 }, 1e-9), true);
  assert.equal(sameColumnPlacement(square, { ...square, id: 'b', angle: 45 }, 1e-9), false);
  assert.equal(sameColumnPlacement(square,
    { id: 'c', shape: 'circle', center: [1, 1], cm: 30 }, 1e-9), true);
});
