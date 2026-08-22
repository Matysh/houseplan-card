import assert from 'node:assert/strict';
import test from 'node:test';
import { openingSymbolOffset } from '../test-build/opening-symbol-placement.js';

const positiveFace = { ox: 0, oy: 20, cm: 20, side: 1 };
const negativeFace = { ox: 0, oy: -20, cm: 20, side: -1 };

test('default opening symbols stay centred regardless of the resolved room face', () => {
  for (const type of ['door', 'window', 'gate', 'passage']) {
    assert.deepEqual(openingSymbolOffset(type, false, 0, positiveFace), { ox: 0, oy: 0 });
    assert.deepEqual(openingSymbolOffset(type, false, 0, negativeFace), { ox: 0, oy: 0 });
  }
});

test('saved door and window flips use one canonical local edge', () => {
  for (const type of ['door', 'window']) {
    assert.deepEqual(openingSymbolOffset(type, true, 0, positiveFace), { ox: 0, oy: 20 });
    assert.deepEqual(openingSymbolOffset(type, true, 0, negativeFace), { ox: 0, oy: 20 });
    const diagonal = openingSymbolOffset(type, true, 90, positiveFace);
    assert.ok(Math.abs(diagonal.ox + 20) < 1e-9);
    assert.ok(Math.abs(diagonal.oy) < 1e-9);
  }
});

test('gate leaves never translate and malformed faces fail centred', () => {
  assert.deepEqual(openingSymbolOffset('gate', true, 0, positiveFace), { ox: 0, oy: 0 });
  assert.deepEqual(openingSymbolOffset('gate', true, 45, negativeFace), { ox: 0, oy: 0 });
  assert.deepEqual(openingSymbolOffset('door', true, NaN, positiveFace), { ox: 0, oy: 0 });
  assert.deepEqual(openingSymbolOffset('window', true, 0, { ox: 0, oy: 0 }), { ox: 0, oy: 0 });
});
