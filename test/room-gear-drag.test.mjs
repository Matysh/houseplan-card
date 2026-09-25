import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampRoomGearPointAlongPath,
  resolveRoomGearCenter,
  roomGearDragMoved,
  roomGearPointAllowed,
} from '../test-build/room-gear-drag.js';

const SQUARE = [[0, 0], [10, 0], [10, 10], [0, 10]];
const L_SHAPE = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];

test('#645 resolves an allowed temporary centre and rejects a stale one', () => {
  const room = { id: 'room', name: 'Room', area: null, poly: SQUARE };
  assert.deepEqual(resolveRoomGearCenter(room, [8, 7]), {
    point: [8, 7], usedTemporary: true,
  });
  const stale = resolveRoomGearCenter(room, [12, 7]);
  assert.equal(stale.usedTemporary, false);
  assert.ok(roomGearPointAllowed(stale.point, SQUARE));
});

test('#645 keeps the click/drag threshold in CSS pixels', () => {
  assert.equal(roomGearDragMoved([100, 100], [102, 101]), false);
  assert.equal(roomGearDragMoved([100, 100], [102.01, 101]), true);
  assert.equal(roomGearDragMoved([100, 100], [100, 96.9]), true);
});

test('#645 stops at the first room boundary', () => {
  assert.deepEqual(clampRoomGearPointAlongPath([5, 5], [15, 5], SQUARE), [10, 5]);
  assert.deepEqual(clampRoomGearPointAlongPath([5, 5], [8, 8], SQUARE), [8, 8]);
});

test('#645 cannot jump across a concave room cut-out', () => {
  // Both endpoints are in the L-shaped room, but the direct segment crosses
  // its missing top-right quadrant. The first intersection is (4, 6).
  assert.equal(roomGearPointAllowed([2, 8], L_SHAPE), true);
  assert.equal(roomGearPointAllowed([8, 2], L_SHAPE), true);
  assert.deepEqual(clampRoomGearPointAlongPath([2, 8], [8, 2], L_SHAPE), [4, 6]);
});

test('#645 permits movement along the room boundary', () => {
  assert.deepEqual(clampRoomGearPointAlongPath([0, 2], [0, 8], SQUARE), [0, 8]);
});
