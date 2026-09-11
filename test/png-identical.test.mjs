// #512 AC3: the frame comparator judges decoded pixels, strictly.
import assert from 'node:assert/strict';
import test from 'node:test';

import { compareDecodedPixels, compareFramePairs } from '../scripts/png-identical.mjs';

const frame = (width, height, fill = 0) => ({ width, height, data: new Uint8Array(width * height * 4).fill(fill) });

test('#512 AC3: identical buffers → 0 differing pixels', () => {
  assert.deepEqual(compareDecodedPixels(frame(3, 2, 9), frame(3, 2, 9)), { identical: true, differing: 0, sizeMismatch: false });
});

test('#512 AC3: one byte of one pixel is one differing pixel, alpha included', () => {
  const a = frame(3, 2, 9);
  const b = frame(3, 2, 9);
  b.data[4 * 4 + 3] = 8; // pixel 4, alpha
  assert.deepEqual(compareDecodedPixels(a, b), { identical: false, differing: 1, sizeMismatch: false });
  b.data[0] = 1; // pixel 0, red
  assert.equal(compareDecodedPixels(a, b).differing, 2);
});

test('#512 AC3: a size mismatch is never identical', () => {
  const result = compareDecodedPixels(frame(3, 2), frame(2, 3));
  assert.equal(result.identical, false);
  assert.equal(result.sizeMismatch, true);
});

test('#512 AC3: pairs are compared one by one and reported by id', async () => {
  const calls = [];
  const results = await compareFramePairs(
    [{ id: 'same', committed: 'c1', candidate: 'k1' }, { id: 'diff', committed: 'c2', candidate: 'k2' }],
    async (committed, candidate) => { calls.push([committed, candidate]); return compareDecodedPixels(frame(1, 1, 1), frame(1, 1, committed === 'c2' ? 2 : 1)); },
  );
  assert.deepEqual(calls, [['c1', 'k1'], ['c2', 'k2']]);
  assert.deepEqual(results.map((r) => [r.id, r.identical, r.differing]), [['same', true, 0], ['diff', false, 1]]);
});
