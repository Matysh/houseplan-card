import test from 'node:test';
import assert from 'node:assert/strict';
import { svgDefaults } from '../test-build/pdf/export-options.js';
import { assertSvgBudget } from '../test-build/pdf/svg-snapshot.js';

test('SVG defaults exclude devices and keep independent mutable drafts', () => {
  const first = svgDefaults(), second = svgDefaults();
  assert.equal(first.devices, false); assert.equal(first.background, 'transparent');
  assert.deepEqual([first.decor, first.roomNames, first.backdrop], [true, true, true]);
  first.devices = true; first.color = '#123456'; first.opacity = 0;
  assert.equal(second.devices, false); assert.equal(second.opacity, 1); assert.equal(second.color, '#ffffff');
});
test('SVG asset budget accepts exact limit and rejects corrupt or excessive totals', () => {
  assertSvgBudget(0); assertSvgBudget(25 * 1024 * 1024);
  for (const n of [NaN, Infinity, -1, 25 * 1024 * 1024 + 1]) {
    assert.throws(() => assertSvgBudget(n), /svg.too_large/);
  }
});
