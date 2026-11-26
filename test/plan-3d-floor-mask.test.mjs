import assert from 'node:assert/strict';
import test from 'node:test';
import { packFloorMask } from '../test-build/plan-3d-floor-mask.js';

const size = 32;
const coverage = image => {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) pixels[(y * size + x) * 4 + 3] = image(x, y);
  return pixels;
};

test('floor shadow stores sub-texel distance as well as unchanged coverage in two channels (#1578)', () => {
  const stride = size * 2, dst = new Uint8Array(stride * stride * 2);
  const edge = y => 8.23 + .37 * y;
  const src = coverage((x, y) => 255 * (.5 + x - edge(y)));
  packFloorMask(src, size, dst, stride, 1, 0, new Float32Array(size * size));
  const value = (x, y, channel = 0) => dst[(y * stride + x + size) * 2 + channel];
  assert.equal(dst[(3 * stride + 3) * 2], 0, 'a neighbouring tile is not touched');
  for (let y = 2; y < size - 2; y++) {
    assert.equal(value(0, y), 0, 'fully shadowed');
    assert.equal(value(size - 1, y), 255, 'fully visible');
    const guess = Math.floor(edge(y));
    const x = [guess - 1, guess, guess + 1].find(x => value(x, y) < 128 && value(x + 1, y) > 127);
    assert.ok(x !== undefined, 'there is one fractional crossing near the analytic edge');
    const a = value(x, y), b = value(x + 1, y);
    assert.ok(Math.abs(x + (127.5 - a) / (b - a) - edge(y)) < .28,
      'the fractional contour stays near the actual diagonal rather than jumping to full texels');
    for (let x = 0; x < size; x++) assert.equal(value(x, y, 1), src[(y * size + x) * 4 + 3]);
  }
});

test('a thin aperture and the non-floor coverage path are not erased by quantization (#1578)', () => {
  const src = coverage(x => x === 14 ? 64 : 0), dst = new Uint8Array(size * size * 2);
  const index = 14 * 2;
  packFloorMask(src, size, dst, size, 0, 0, new Float32Array(size * size));
  assert.ok(dst[index] > 64, 'sub-texel light still reaches the floor');
  packFloorMask(src, size, dst, size, 0, 0, null);
  assert.equal(dst[index], 0, 'sun does not compute a signed-distance band');
  assert.equal(dst[index + 1], 64, 'sun keeps the original coverage');
});
