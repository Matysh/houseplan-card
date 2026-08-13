import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIsoFloorGeometry, buildIsoWallGeometry, isoEffectiveView, isoGeometryFingerprint,
} from '../test-build/iso-walls.js';
import { floorFootprintGeometry } from '../test-build/wall-thickness.js';

const closed = (points) => [...points, points[0]];
const square = closed([[0, 0], [100, 0], [100, 100], [0, 100]]);

test('one top and only O(E) visible sides are built deterministically', () => {
  const first = buildIsoWallGeometry([[square]]);
  const second = buildIsoWallGeometry([[square]]);
  assert.deepEqual(second, first);
  assert.equal(first.edgeCount, 4);
  assert.ok(first.sides.length > 0 && first.sides.length <= first.edgeCount);
  assert.match(first.topPath, /^M /);
  assert.match(first.contactPath, /^M /);
  assert.equal(first.sides.every((face) => /^M .* Z$/.test(face.d)), true);
});

test('floor edge follows outer components without internal or nested steps', () => {
  const second = closed([[160, 0], [220, 0], [220, 60], [160, 60]]);
  const hole = closed([[30, 30], [30, 70], [70, 70], [70, 30]]);
  const floor = buildIsoFloorGeometry([[square, hole], [second]], 10);
  assert.equal(floor.componentCount, 2);
  assert.equal(floor.edgeCount, 8);
  assert.equal(floor.sides.every((face) => face.planEdge.every((point) => (
    !(point[0] >= 30 && point[0] <= 70 && point[1] >= 30 && point[1] <= 70)
  ))), true);
  assert.ok(floor.sides.length > 0 && floor.sides.length <= floor.edgeCount);
});

test('canonical adjacent room union has no edge on its shared boundary', () => {
  const rooms = [
    { id: 'left', poly: [[0, 0], [100, 0], [100, 100], [0, 100]] },
    { id: 'right', poly: [[100, 0], [200, 0], [200, 100], [100, 100]] },
  ];
  const geometry = floorFootprintGeometry(rooms, [], [], 20, 250, 40, 1);
  const floor = buildIsoFloorGeometry(geometry, 10);
  assert.equal(floor.componentCount, 1);
  assert.equal(floor.edgeCount, 4);
  assert.equal(floor.sides.some((face) => face.planEdge.every((point) => point[0] === 100)), false);
});

test('floor edge output is stable under component order, winding and ring start', () => {
  const a = closed([[0, 0], [80, 0], [80, 60], [0, 60]]);
  const b = closed([[160, 20], [210, 20], [210, 80], [160, 80]]);
  const rotatedA = closed([[80, 60], [80, 0], [0, 0], [0, 60]]);
  const rotatedB = closed([[210, 80], [210, 20], [160, 20], [160, 80]]);
  assert.deepEqual(buildIsoFloorGeometry([[rotatedB], [rotatedA]], 10),
    buildIsoFloorGeometry([[a], [b]], 10));
});

test('empty room footprint emits no inferred slab', () => {
  assert.deepEqual(buildIsoFloorGeometry([], 10), {
    footprintPath: '', sides: [], componentCount: 0, edgeCount: 0,
  });
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

test('latched renderer failures stay flat until explicit retry or a new fingerprint', () => {
  const failed = new Set(['space|old']);
  assert.equal(isoEffectiveView('iso', 'space|old', failed), 'flat');
  assert.equal(isoEffectiveView('iso', 'space|new', failed), 'iso');
  assert.equal(isoEffectiveView('flat', 'space|new', failed), 'flat');
  failed.delete('space|old');
  assert.equal(isoEffectiveView('iso', 'space|old', failed), 'iso');
});
