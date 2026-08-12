import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalColumnAngle, columnBody, floorMinusBodies, geometryArea,
  directionalOccluders, intersectionPaths, partitionBody, pointInPhysicalBody,
  pointInOpaquePlanBody, pointInPhysicalGeometry,
  sameColumnPlacement,
} from '../test-build/physical-geometry.js';
import {
  polygonSegments, splitAtIntersections, visibilityPolygon,
} from '../test-build/light-visibility.js';

const closeTo = (got, want, tol = 1e-6) =>
  assert.ok(Math.abs(got - want) <= tol, `expected ${want}, got ${got}`);

test('partition body keeps the centreline and requested physical width', () => {
  const body = partitionBody([0, 0], [1, 0], 10, 5, 0.25);
  assert.ok(body);
  closeTo(body[0][1], 0.25);
  closeTo(body[2][1], -0.25);
  closeTo(geometryArea([[[...body, body[0]]]]), 0.5);
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

test('exact column overlays are rejected but rotated square bodies remain distinct', () => {
  const square = { id: 'a', shape: 'square', center: [1, 1], cm: 30, angle: 0 };
  assert.equal(sameColumnPlacement(square, { ...square, id: 'b', angle: 90 }, 1e-9), true);
  assert.equal(sameColumnPlacement(square, { ...square, id: 'b', angle: 45 }, 1e-9), false);
  assert.equal(sameColumnPlacement(square,
    { id: 'c', shape: 'circle', center: [1, 1], cm: 30 }, 1e-9), true);
});
