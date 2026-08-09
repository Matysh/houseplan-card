import test from 'node:test';
import assert from 'node:assert/strict';

import { screenRgb, svgScreenBlendSupported } from '../test-build/glow-blend.js';

test('screenRgb implements rounded 8-bit screen blending', () => {
  assert.deepEqual(screenRgb([0, 0, 0], [12, 34, 56]), [12, 34, 56]);
  assert.deepEqual(screenRgb([255, 10, 20], [8, 255, 30]), [255, 255, 48]);
  assert.deepEqual(screenRgb([128, 32, 16], [16, 64, 128]), [136, 88, 136]);
});

test('capability result is one cached Promise per document', async () => {
  const document = {
    defaultView: { CSS: { supports: () => false } },
  };
  const first = svgScreenBlendSupported(document);
  const second = svgScreenBlendSupported(document);
  assert.equal(first, second);
  assert.equal(await first, false);
});
