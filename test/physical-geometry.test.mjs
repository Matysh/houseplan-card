import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalColumnAngle, columnBody, floorMinusBodies, geometryArea,
  directionalOccluders, partitionBody, pointInPhysicalBody, radialOccluders,
  sameColumnPlacement,
} from '../test-build/physical-geometry.js';

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

test('radial occluder extends a wall away from the source', () => {
  const body = [[1, -0.1], [1.2, -0.1], [1.2, 0.1], [1, 0.1]];
  const shadows = radialOccluders([body], [0, 0], 10);
  assert.ok(Math.max(...shadows.flat().map((p) => p[0])) > 9);
});

test('radial shadow covers the far side of a long nearby partition', () => {
  const body = partitionBody([1, -3], [1, 3], 10, 5, 0.25);
  assert.ok(body);
  const shadows = radialOccluders([body], [0, 0], 10);
  assert.ok(shadows.some((poly) => pointInPhysicalBody([5, 0], poly)),
    'the far side of the wall must remain occluded inside the glow radius');
});

test('a source inside a physical body is fully blocked', () => {
  const body = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const shadows = radialOccluders([body], [0, 0], 10);
  for (const point of [[5, 0], [-5, 0], [0, 5], [0, -5]])
    assert.ok(shadows.some((poly) => pointInPhysicalBody(point, poly)));
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

test('exact column overlays are rejected but rotated square bodies remain distinct', () => {
  const square = { id: 'a', shape: 'square', center: [1, 1], cm: 30, angle: 0 };
  assert.equal(sameColumnPlacement(square, { ...square, id: 'b', angle: 90 }, 1e-9), true);
  assert.equal(sameColumnPlacement(square, { ...square, id: 'b', angle: 45 }, 1e-9), false);
  assert.equal(sameColumnPlacement(square,
    { id: 'c', shape: 'circle', center: [1, 1], cm: 30 }, 1e-9), true);
});
