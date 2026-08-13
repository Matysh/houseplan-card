import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIsoWallGeometry, isoGeometryFingerprint } from '../test-build/iso-walls.js';

const closed = (points) => [...points, points[0]];
const square = closed([[0, 0], [100, 0], [100, 100], [0, 100]]);

test('one top and only O(E) visible sides are built deterministically', () => {
  const first = buildIsoWallGeometry([[square]]);
  const second = buildIsoWallGeometry([[square]]);
  assert.deepEqual(second, first);
  assert.equal(first.edgeCount, 4);
  assert.ok(first.sides.length > 0 && first.sides.length <= first.edgeCount);
  assert.match(first.topPath, /^M /);
  assert.equal(first.sides.every((face) => /^M .* Z$/.test(face.d)), true);
});

test('holes preserve an evenodd top and add visible inner/jamb edges', () => {
  const hole = closed([[40, 40], [40, 60], [60, 60], [60, 40]]);
  const geometry = buildIsoWallGeometry([[square, hole]]);
  assert.equal(geometry.edgeCount, 8);
  assert.equal((geometry.topPath.match(/M /g) || []).length, 2);
  assert.ok(geometry.sides.some((face) => face.ring === 1));
});

test('a full-height gap remains split into jamb edges without a bridge', () => {
  const left = closed([[0, 0], [40, 0], [40, 20], [0, 20]]);
  const right = closed([[60, 0], [100, 0], [100, 20], [60, 20]]);
  const geometry = buildIsoWallGeometry([[left], [right]]);
  assert.equal(geometry.edgeCount, 8);
  assert.equal((geometry.topPath.match(/M /g) || []).length, 2);
  assert.equal(geometry.topPath.includes('40 0 L 60 0'), false);
});

test('fingerprint is content based, stable and sensitive to in-place geometry edits', () => {
  const value = { rooms: [{ poly: [[0, 0], [1, 0], [1, 1]] }], showBorders: true };
  const first = isoGeometryFingerprint(value);
  assert.equal(isoGeometryFingerprint({ showBorders: true, rooms: value.rooms }), first);
  value.rooms[0].poly[1][0] = 2;
  assert.notEqual(isoGeometryFingerprint(value), first);
  assert.equal(isoGeometryFingerprint({ rooms: value.rooms, showBorders: false }),
    isoGeometryFingerprint({ rooms: value.rooms, showBorders: false }));
});

