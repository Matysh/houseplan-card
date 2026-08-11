import test from 'node:test';
import assert from 'node:assert/strict';
import { floatingViewport, placeFloatingSurface } from '../test-build/floating-surface.js';

const rect = (left, top, width, height) => ({
  left, top, width, height, right: left + width, bottom: top + height,
});

test('floating surface uses the preferred bottom side when it fits', () => {
  assert.deepEqual(
    placeFloatingSurface(rect(100, 100, 20, 20), rect(0, 0, 100, 50), {
      left: 0, top: 0, width: 500, height: 500,
    }),
    { left: 100, top: 127, side: 'bottom', maxWidth: 484, maxHeight: 484 },
  );
});

test('floating surface flips above an anchor near the lower edge', () => {
  assert.deepEqual(
    placeFloatingSurface(rect(100, 440, 20, 20), rect(0, 0, 100, 80), {
      left: 0, top: 0, width: 500, height: 500,
    }),
    { left: 100, top: 353, side: 'top', maxWidth: 484, maxHeight: 484 },
  );
});

test('floating surface shifts back inside when its trigger is below the viewport', () => {
  assert.deepEqual(
    placeFloatingSurface(rect(100, 540, 20, 20), rect(0, 0, 100, 80), {
      left: 0, top: 0, width: 500, height: 500,
    }),
    { left: 100, top: 412, side: 'top', maxWidth: 484, maxHeight: 484 },
  );
});

test('floating surface shifts inside both horizontal safe edges', () => {
  const viewport = { left: 0, top: 0, width: 500, height: 500 };
  assert.equal(placeFloatingSurface(rect(-10, 100, 20, 20), rect(0, 0, 100, 50), viewport).left, 8);
  assert.equal(placeFloatingSurface(rect(450, 100, 20, 20), rect(0, 0, 100, 50), viewport).left, 370);
});

test('oversized surfaces are constrained and pinned to the safe viewport', () => {
  assert.deepEqual(
    placeFloatingSurface(rect(20, 10, 10, 20), rect(0, 0, 900, 700), {
      left: 0, top: 0, width: 300, height: 200,
    }),
    { left: 8, top: 8, side: 'bottom', maxWidth: 284, maxHeight: 184 },
  );
});

test('visual viewport offsets are preserved for pinch zoom and virtual keyboards', () => {
  assert.deepEqual(floatingViewport({
    innerWidth: 1000,
    innerHeight: 800,
    visualViewport: { offsetLeft: 31, offsetTop: 47, width: 390, height: 520 },
  }), { left: 31, top: 47, width: 390, height: 520 });
});
