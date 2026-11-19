import assert from 'node:assert/strict';
import test from 'node:test';
import { openingLockFloorPlacement, openingSwingDepth } from '../test-build/opening-symbol-placement.js';
import { transportOpeningOrientations } from '../test-build/opening-orientation.js';
import { openingWallIndex, wallKey, openingInnerFaceOffsetFromIndex } from '../test-build/wall-thickness.js';
import { openingPlacementSideLabels } from '../test-build/editors/properties/physical.js';
import { t } from '../test-build/i18n.js';

const room = { id: 'inside', name: 'Hall', poly: [[0,0],[200,0],[200,100],[0,100]] };
const wall = { key: wallKey([0,0],[200,0],1), a: [0,0], b: [200,0], cm: 30 };
const door = { type: 'door', rx: 100, ry: 0, rlen: 36, angle: 0 };
const index = openingWallIndex([room],[wall],[],1,5,5,1);

test('#1475 the swing follows the opening direction even on a wall with the room on the positive side', () => {
  const existingFace = openingInnerFaceOffsetFromIndex(index, { x: 100, y: 0, length: 36, angle: 0 });
  assert.equal(existingFace.oy, 15, 'the current optical origin is on the room side');
  for (const flip_v of [false, true]) for (const swing_position of [undefined, 'auto', 'negative', 'positive', 'center']) {
    const expected = { negative: -15, positive: 15, center: 0 }[swing_position] ?? (flip_v ? 15 : -15);
    assert.equal(openingSwingDepth({ ...door, swing_position, flip_v }, index), expected);
  }
  assert.equal(openingSwingDepth(door, null), 0, 'an unresolved legacy opening has no proven face');
  for (const type of ['window','gate','passage']) {
    assert.equal(openingSwingDepth({ ...door, type, flip_v: true, swing_position: 'positive' }, index), undefined);
  }
  assert.equal(openingSwingDepth({ ...door, swing_position: 'negative',
    opening_features: { version: 1, mechanism: 'slide' } }, index), undefined);
});

test('#1475 wall-side labels follow the ordered physical signs and require proof of an outside face', () => {
  const opening = { x: 100, y: 0, angle: 0, length: 36 };
  const labels = (rooms, wall, signs, item = opening) =>
    openingPlacementSideLabels(item, rooms, wall, signs, (key, vars) => t('ru', key, vars));
  assert.deepEqual(labels([room], index, [-1,1]), ['Снаружи','Внутри']);
  assert.deepEqual(labels([room], index, [1,-1]), ['Внутри','Снаружи'], 'the sliding face at flip=false points inside');
  const north = { id: 'north', name: 'Kitchen', poly: [[0,-100],[200,-100],[200,0],[0,0]] };
  const shared = openingWallIndex([room,north],[wall],[],1,5,5,1);
  assert.deepEqual(labels([{ ...room, name: 'Entry' },north].reverse(), shared, [-1,1]),
    ['Со стороны комнаты «Kitchen»','Со стороны комнаты «Entry»']);
  const partitionHost = { depth: 20 };
  assert.deepEqual(labels([room], index, [-1,1], { ...opening, partitionHost }), ['Сторона А','Сторона Б']);
  assert.deepEqual(labels([room, { ...room, id: 'overlap' }], index, [-1,1]), ['Сторона А','Сторона Б']);
  assert.equal(openingSwingDepth({ ...door, angle: 37, partitionHost }, null), -10);
});

test('#1475 an ordinary door preserves the manual face when the same axis changes basis', () => {
  const opening = { id: 'd', type: 'door', x: 0, y: 0, length: .1, angle: 89,
    swing_position: 'negative', flip_h: true, flip_v: true, contact: 'binary_sensor.door' };
  const before = { openings: [opening] };
  const after = { openings: [{ ...opening, angle: -89 }] };
  transportOpeningOrientations(before, after, new Map([['d',2]]));
  assert.deepEqual(after.openings[0], { ...opening, angle: -89, swing_position: 'positive' });
  transportOpeningOrientations(before, after, new Map([['d',2]]));
  assert.equal(after.openings[0].swing_position, 'positive', 'retry with the same basis is idempotent');
  assert.equal(opening.swing_position, 'negative');
});

test('opening lock floor placement owns both the anchor and its host side', () => {
  const normalize = (point) => point.map((value) => Math.abs(value) < 1e-9 ? 0 : value);
  const regular = openingLockFloorPlacement({
    x: 100, y: 80, angle: 0, flipV: false,
  }, 5);
  assert.deepEqual(normalize(regular[0]), [100, 96]);
  assert.equal(regular[1], false);

  const flipped = openingLockFloorPlacement({
    x: 100, y: 80, angle: 0, flipV: true,
  }, 5);
  assert.deepEqual(normalize(flipped[0]), [100, 64]);
  assert.equal(flipped[1], true);

  const gate = openingLockFloorPlacement({
    x: 100, y: 80, angle: 0, flipV: false, gateFace: { side: 1 },
  }, 5);
  assert.deepEqual(normalize(gate[0]), [100, 64]);
  assert.equal(gate[1], true);
});
