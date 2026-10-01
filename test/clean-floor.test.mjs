import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanFloorForRoom } from '../test-build/clean-floor.js';
import { geometryAreaMinusStairs } from '../test-build/stairs.js';

// #669: the four render paths read only `path`; the room tooltip and the PDF
// read `area`. The stair subtraction behind `area` must wait for that read.
const floor = [[100, 100], [500, 100], [500, 500], [100, 500]];
const room = { id: 'room-a' };
const stair = {
  id: 'stair-a', kind: 'straight', x: 0.3, y: 0.3, angle: 0,
  direction: 'forward', length: 0.1, width: 0.05, target_space_id: 'upper',
};
const column = [[400, 400], [440, 400], [440, 440], [400, 440]];
const space = { id: 'space-a', rooms: [room], stairs: [stair] };

const counting = () => {
  const calls = { count: 0 };
  const areaMinusStairs = (source, stairs) => {
    calls.count += 1;
    return geometryAreaMinusStairs(source, stairs);
  };
  return { calls, areaMinusStairs };
};

const build = (overrides = {}) => cleanFloorForRoom({
  room, floor, space, floorKey: (spaceId) => `${spaceId}|3`, resizePreview: false, cache: new Map(),
  physicalBodies: () => [column], ...overrides,
});

test('#669 AC1 a floor path does not subtract stairs until the area is read', () => {
  const { calls, areaMinusStairs } = counting();
  const cache = new Map();
  const result = build({ cache, areaMinusStairs });
  assert.ok(result.path.length > 0, 'the path is built from the floor minus the column');
  assert.equal(calls.count, 0, 'building the path must not run the stair subtraction');

  const area = result.area;
  assert.equal(calls.count, 1, 'the first read subtracts once');
  assert.equal(result.area, area);
  assert.equal(calls.count, 1, 'a second read reuses the value');

  const again = build({ cache, areaMinusStairs });
  assert.equal(again, result, 'the cached result is returned');
  assert.equal(again.area, area);
  assert.equal(calls.count, 1, 'a cache hit does not subtract again');
});

test('#669 AC1 the lazy area equals the eager subtraction and still removes stairs', () => {
  const result = build();
  const expected = geometryAreaMinusStairs(result.geom, space.stairs);
  assert.ok(Math.abs(result.area - expected) <= expected * 1e-9);
  const withoutStairs = build({ space: { ...space, stairs: [] } }).area;
  assert.ok(result.area < withoutStairs - 1, 'the stair footprint is subtracted');
});

test('#669 AC1 the resize preview is not cached and stays lazy', () => {
  const { calls, areaMinusStairs } = counting();
  const cache = new Map();
  const preview = build({ cache, resizePreview: true, areaMinusStairs });
  assert.equal(cache.size, 0);
  assert.equal(calls.count, 0);
  assert.ok(preview.area > 0);
  assert.equal(calls.count, 1);
});

test('#669 AC1 a room without independent bodies subtracts stairs from the plain floor', () => {
  const { calls, areaMinusStairs } = counting();
  const result = build({ physicalBodies: () => [], areaMinusStairs });
  assert.equal(result.geom, null);
  assert.equal(calls.count, 0);
  const plain = geometryAreaMinusStairs([[[...floor, floor[0]]]], space.stairs);
  assert.ok(Math.abs(result.area - plain) <= plain * 1e-9);
  assert.equal(calls.count, 1);
});
