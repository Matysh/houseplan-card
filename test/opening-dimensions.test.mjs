import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOpeningDimensionContext,
  resolveOpeningDimensions,
} from '../test-build/opening-dimensions.js';
import { setWallThickness } from '../test-build/wall-thickness.js';

const CELL_CM = 1;
const GRID = 1;
const PITCH = 1;

function wallsFor(rooms, cmByEdge = () => 20) {
  let walls = [];
  for (const room of rooms) {
    for (let i = 0; i < room.poly.length; i++) {
      const a = room.poly[i], b = room.poly[(i + 1) % room.poly.length];
      walls = setWallThickness(walls, a, b, cmByEdge(room, i), PITCH, 1);
    }
  }
  return walls;
}

function context({ rooms = [], walls = [], partitions = [], roomOpenings = [], partitionCuts = [] } = {}) {
  return buildOpeningDimensionContext({
    rooms, walls, openCuts: [], partitions, roomOpenings, partitionCuts,
    pitch: PITCH, cellCm: CELL_CM, gridPitch: GRID, coordScale: 1, epsilon: 1e-6,
  });
}

function candidate({
  x, y, angle, length, a, b, host,
}) {
  return {
    x, y, angle, renderedLength: length,
    target: {
      segmentKey: `${a.join(',')}>${b.join(',')}`,
      a, b, physicalHalfWidth: 10, sourceOrder: 0,
      ...(host ? { partitionHost: { kind: 'partition', id: host } } : {}),
    },
    ...(host ? { host: { kind: 'partition', id: host, t: 0.5 } } : {}),
  };
}

const distances = (dimensions) => dimensions.map((dimension) => dimension.distance);
const near = (actual, expected, epsilon = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≈ ${expected}`);

test('room dimensions stop at inner faces instead of room centrelines (#238 AC1)', () => {
  const rooms = [{ id: 'room', poly: [[0, 0], [400, 0], [400, 300], [0, 300]] }];
  const dimensions = resolveOpeningDimensions(candidate({
    x: 200, y: 0, angle: 0, length: 80, a: [0, 0], b: [400, 0],
  }), context({ rooms, walls: wallsFor(rooms) }));

  assert.equal(dimensions.length, 2);
  assert.deepEqual(distances(dimensions), [150, 150]);
  assert.deepEqual(dimensions.map((item) => item.source), ['room-face', 'room-face']);
  assert.deepEqual(dimensions.map((item) => item.roomId), ['room', 'room']);
  assert.deepEqual(dimensions[0].from, [160, 10]);
  assert.deepEqual(dimensions[0].to, [10, 10]);
  assert.deepEqual(dimensions[1].from, [240, 10]);
  assert.deepEqual(dimensions[1].to, [390, 10]);
});

test('an angled adjacent wall ends the room dimension at the real mitre (#238 AC2)', () => {
  const rooms = [{ id: 'room', poly: [[0, 0], [400, 0], [300, 300], [0, 300]] }];
  const dimensions = resolveOpeningDimensions(candidate({
    x: 200, y: 0, angle: 0, length: 80, a: [0, 0], b: [400, 0],
  }), context({ rooms, walls: wallsFor(rooms) }));

  // Top inner face is y=10. Its right end is the intersection with the
  // 20-unit angled wall's inner line, not `400 - 10` from an axis endpoint.
  const expectedRightEnd = 400 - (10 + 10 / Math.sqrt(10)) / 3 - 30 / Math.sqrt(10);
  near(dimensions[1].to[0], expectedRightEnd);
  near(dimensions[1].distance, expectedRightEnd - 240);
  assert.notEqual(dimensions[1].distance, 150);
});

test('shared wall keeps two independently resolved room sides (#238 AC3)', () => {
  const rooms = [
    { id: 'a', poly: [[0, 0], [200, 0], [200, 300], [0, 300]] },
    { id: 'b', poly: [[200, 0], [400, 0], [400, 300], [200, 300]] },
  ];
  const walls = wallsFor(rooms, (room, edge) => {
    if (room.id === 'b' && edge === 0) return 40;
    if (room.id === 'b' && edge === 2) return 60;
    return 20;
  });
  const dimensions = resolveOpeningDimensions(candidate({
    x: 200, y: 150, angle: -90, length: 80, a: [200, 0], b: [200, 300],
  }), context({ rooms, walls }));

  assert.equal(dimensions.length, 4);
  assert.deepEqual(dimensions.map((item) => item.roomId), ['a', 'b', 'a', 'b']);
  assert.deepEqual(dimensions.map((item) => item.roomSide), [-1, 1, -1, 1]);
  assert.deepEqual(distances(dimensions), [100, 80, 100, 90]);
  assert.equal(new Set(dimensions.map((item) => item.source)).size, 1);
});

test('shared wall dimension order is independent of room config order (#238 AC3)', () => {
  const a = { id: 'a', poly: [[0, 0], [200, 0], [200, 300], [0, 300]] };
  const b = { id: 'b', poly: [[200, 0], [400, 0], [400, 300], [200, 300]] };
  const rooms = [b, a];
  const dimensions = resolveOpeningDimensions(candidate({
    x: 200, y: 150, angle: -90, length: 80, a: [200, 0], b: [200, 300],
  }), context({ rooms, walls: wallsFor(rooms) }));

  assert.deepEqual(dimensions.map((item) => item.roomId), ['a', 'b', 'a', 'b']);
  assert.deepEqual(distances(dimensions), [100, 100, 100, 100]);
});

test('a concave room uses only the connected inner-face run (#238 AC4)', () => {
  const rooms = [{
    id: 'concave',
    poly: [[0, 0], [150, 0], [150, 100], [250, 100], [250, 0], [400, 0], [400, 300], [0, 300]],
  }];
  const dimensions = resolveOpeningDimensions(candidate({
    x: 75, y: 0, angle: 0, length: 80, a: [0, 0], b: [150, 0],
  }), context({ rooms, walls: wallsFor(rooms) }));

  assert.equal(dimensions.length, 2);
  assert.deepEqual(distances(dimensions), [25, 25]);
  assert.deepEqual(dimensions.map((item) => item.source), ['room-face', 'room-face']);
});

test('independent T junction measures to the near masonry face, not its axis (#238 AC5)', () => {
  const partitions = [
    { id: 'host', a: [0, 0], b: [400, 0], cm: 20 },
    { id: 'cross', a: [350, -100], b: [350, 100], cm: 40 },
  ];
  const dimensions = resolveOpeningDimensions(candidate({
    x: 200, y: 0, angle: 0, length: 80, a: [0, 0], b: [400, 0], host: 'host',
  }), context({ partitions }));

  assert.equal(dimensions.length, 2);
  assert.deepEqual(distances(dimensions), [160, 90]);
  assert.equal(dimensions[0].source, 'host-end');
  assert.equal(dimensions[1].source, 'connected-face');
  assert.deepEqual(dimensions[1].to, [330, 0]);
});

test('independent fallback is per direction and ignores a wall beyond the host (#238 AC6/AC7)', () => {
  const partitions = [
    { id: 'host', a: [0, 0], b: [400, 0], cm: 20 },
    { id: 'left-cross', a: [50, -100], b: [50, 100], cm: 20 },
    { id: 'beyond', a: [450, -100], b: [450, 100], cm: 80 },
  ];
  const dimensions = resolveOpeningDimensions(candidate({
    x: 200, y: 0, angle: 0, length: 80, a: [0, 0], b: [400, 0], host: 'host',
  }), context({ partitions }));

  assert.deepEqual(distances(dimensions), [100, 160]);
  assert.deepEqual(dimensions.map((item) => item.source), ['connected-face', 'host-end']);
  assert.deepEqual(dimensions[0].to, [60, 0]);
  assert.deepEqual(dimensions[1].to, [400, 0]);
});

test('an opening cut in a crossing room wall is empty, not a dimension boundary', () => {
  const rooms = [{ id: 'cross-room', poly: [[340, -100], [360, -100], [360, 100], [340, 100]] }];
  const walls = wallsFor(rooms);
  const partitions = [{ id: 'host', a: [0, 0], b: [400, 0], cm: 20 }];
  const wallOpening = { x: 350, y: 0, angle: -90, length: 80 };
  const dimensions = resolveOpeningDimensions(candidate({
    x: 200, y: 0, angle: 0, length: 80, a: [0, 0], b: [400, 0], host: 'host',
  }), context({ rooms, walls, partitions, roomOpenings: [wallOpening] }));

  assert.deepEqual(distances(dimensions), [160, 160]);
  assert.deepEqual(dimensions.map((item) => item.source), ['host-end', 'host-end']);
});

test('room geometry that cannot prove an inner face fails closed to two host-end dimensions', () => {
  const rooms = [{ id: 'room', poly: [[0, 0], [400, 0], [400, 300], [0, 300]] }];
  const ctx = context({ rooms, walls: wallsFor(rooms) });
  // Damage only the derived inner contour: ownership is still provable, but
  // mixing one physical side with an axis fallback is forbidden.
  ctx.rooms[0].inner = [[10, 10], [20, 30], [30, 10]];
  const dimensions = resolveOpeningDimensions(candidate({
    x: 200, y: 0, angle: 0, length: 80, a: [0, 0], b: [400, 0],
  }), ctx);

  assert.deepEqual(distances(dimensions), [160, 160]);
  assert.deepEqual(dimensions.map((item) => item.source), ['host-end', 'host-end']);
});

test('zero remaining distance never becomes negative', () => {
  const rooms = [{ id: 'room', poly: [[0, 0], [100, 0], [100, 80], [0, 80]] }];
  const dimensions = resolveOpeningDimensions(candidate({
    x: 50, y: 0, angle: 0, length: 100, a: [0, 0], b: [100, 0],
  }), context({ rooms, walls: wallsFor(rooms) }));

  assert.deepEqual(distances(dimensions), [0, 0]);
  for (const item of dimensions) assert.deepEqual(item.from, item.to);
});

test('a diagonal crossing uses polygon intersection geometry', () => {
  const partitions = [
    { id: 'host', a: [0, 0], b: [400, 0], cm: 20 },
    { id: 'diagonal', a: [300, -100], b: [400, 0], cm: 20 },
  ];
  const dimensions = resolveOpeningDimensions(candidate({
    x: 200, y: 0, angle: 0, length: 80, a: [0, 0], b: [400, 0], host: 'host',
  }), context({ partitions }));

  // A 45° wall of half-depth 10 reaches the host axis at x=400-10*sqrt(2),
  // not at axis junction x=400 and not at x=390.
  near(dimensions[1].to[0], 400 - 10 * Math.SQRT2);
  near(dimensions[1].distance, 160 - 10 * Math.SQRT2);
});
