import assert from 'node:assert/strict';
import test from 'node:test';
import {
  openingLockFloorPlacement,
  openingSymbolOffset,
} from '../test-build/opening-symbol-placement.js';

const positiveFace = { ox: 0, oy: 20, cm: 20, side: 1 };
const negativeFace = { ox: 0, oy: -20, cm: 20, side: -1 };

test('every opening symbol stays exactly on the wall centreline', () => {
  const faces = [
    positiveFace,
    negativeFace,
    { ox: 20, oy: 0, cm: 20, side: 1 },
    { ox: 0, oy: 0, cm: 0, side: -1 },
    { ox: Infinity, oy: NaN, cm: 20, side: 1 },
  ];
  for (const type of ['door', 'window', 'gate', 'passage']) {
    for (const flip of [false, true]) {
      for (const angle of [0, 45, 90, -135, NaN]) {
        for (const face of faces) {
          assert.deepEqual(
            openingSymbolOffset(type, flip, angle, face),
            { ox: 0, oy: 0 },
            `${type} flip=${flip} angle=${angle} face=${face.ox},${face.oy}`,
          );
        }
      }
    }
  }
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
    x: 100, y: 80, angle: 0, flipV: false, gateFace: positiveFace,
  }, 5);
  assert.deepEqual(normalize(gate[0]), [100, 64]);
  assert.equal(gate[1], true);
});
