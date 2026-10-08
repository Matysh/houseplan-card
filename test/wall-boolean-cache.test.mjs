import test from 'node:test';
import assert from 'node:assert/strict';
import * as canonical from 'polyclip-ts';
import { withWallBooleanBaseline, union, difference, intersection } from '../test-build/wall-boolean-cache.js';
import * as shared from '../test-build/wall-boolean-cache.js';
import { WallBooleanBaseline } from '../test-build/wall-boolean-baseline.js';

const rect = (x, y, w, h) => [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
const operands = [rect(0, 0, 4, 4), rect(1, 1, 2, 2)];

test('834 the shared View boolean port does not expose the lazy editor cache implementation', () => {
  assert.equal('WallBooleanBaseline' in shared, false);
  assert.equal(typeof shared.union, 'function');
  assert.equal(typeof shared.withWallBooleanBaseline, 'function');
});

test('834 baseline booleans preserve exact op/input semantics, holes and independent mutable results', () => {
  const cache = new WallBooleanBaseline();
  for (const [name, operation] of [['union', union], ['difference', difference], ['intersection', intersection]]) {
    const expected = canonical[name](...operands);
    assert.deepEqual(withWallBooleanBaseline(cache, true, () => operation(...operands)), expected);
    const reused = withWallBooleanBaseline(cache, false, () => operation(...structuredClone(operands)));
    assert.deepEqual(reused, expected);
    reused[0][0][0][0] = 999;
    assert.deepEqual(withWallBooleanBaseline(cache, false, () => operation(...operands)), expected,
      'caller mutation cannot poison a later gesture frame');
  }
  assert.equal(cache.counts.stored, 3);
  assert.equal(cache.counts.hits, 6);
});

test('834 live candidates never grow the frozen cache and nearby unequal coordinates are not rounded', () => {
  const cache = new WallBooleanBaseline();
  withWallBooleanBaseline(cache, true, () => difference(...operands));
  const stored = cache.counts.stored;
  for (let i = 1; i <= 60; i++) {
    const clipping = rect(1 + i * 1e-7, 1, 2, 2);
    assert.deepEqual(withWallBooleanBaseline(cache, false, () => difference(operands[0], clipping)),
      canonical.difference(operands[0], clipping));
  }
  assert.equal(cache.counts.stored, stored);
  assert.equal(cache.counts.hits, 0);
  assert.equal(cache.counts.misses, 61);
});

test('834 nested/throwing scopes restore their parent and never leak into View operations', () => {
  const outer = new WallBooleanBaseline(), inner = new WallBooleanBaseline();
  withWallBooleanBaseline(outer, true, () => {
    union(...operands);
    assert.throws(() => withWallBooleanBaseline(inner, true, () => {
      difference(...operands); throw new Error('simulated geometry failure');
    }), /simulated/);
    union(...operands);
  });
  assert.deepEqual(outer.counts, { hits: 1, misses: 1, stored: 1 });
  assert.deepEqual(inner.counts, { hits: 0, misses: 1, stored: 1 });
  const counts = structuredClone([outer.counts, inner.counts]);
  assert.deepEqual(union(...operands), canonical.union(...operands));
  assert.deepEqual([outer.counts, inner.counts], counts, 'no active editor memo after scope return');
});

test('834 baseline capture itself has a fixed entry ceiling', () => {
  const cache = new WallBooleanBaseline();
  withWallBooleanBaseline(cache, true, () => {
    for (let i = 0; i < 540; i++) union(rect(i * 10, 0, 1, 1));
  });
  assert.equal(cache.counts.stored, 512);
});
