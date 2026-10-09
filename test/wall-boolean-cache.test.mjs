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

test('834 each call serializes current operands once and shares its result key without trusting returned arrays', () => {
  const cache = new WallBooleanBaseline(), current = structuredClone(operands);
  const observe = work => {
    const original = JSON.stringify, values = [];
    JSON.stringify = function(value, ...rest) { values.push(value); return original.call(this, value, ...rest); };
    try { return { result: work(), values }; }
    finally { JSON.stringify = original; }
  };
  const first = observe(() => cache.apply('difference', current, true));
  assert.equal(first.values.filter(value => value === current[0]).length, 1);
  assert.equal(first.values.filter(value => value === current[1]).length, 1);
  assert.equal(first.values.filter(value => value === first.result).length, 1,
    'the fresh result key is shared by provenance, frozen storage and character accounting');
  first.result[0][0][0][0] = 999;
  const hit = observe(() => cache.apply('difference', current, false));
  assert.deepEqual(hit.values, current, 'the private frozen result reuses its captured key; both live operands are fresh');
  assert.deepEqual(hit.result, canonical.difference(...current));
  current[1][0][1][0] += .125;
  const previousHits = cache.counts.hits;
  const changed = observe(() => cache.apply('difference', current, false));
  assert.equal(changed.values.filter(value => value === current[1]).length, 1);
  assert.equal(cache.counts.hits, previousHits, 'mutating the same array cannot retain the old full-value key');
  assert.deepEqual(changed.result, canonical.difference(...current));
});

test('834 assembled keys preserve invalid array entries, exact arity and signed-zero JSON semantics', () => {
  const cache = new WallBooleanBaseline(), subject = rect(0, 0, 4, 4);
  const captured = cache.apply('union', [subject], true);
  const negativeZero = structuredClone(subject);
  negativeZero[0][0][0] = -0;
  assert.deepEqual(cache.apply('union', [negativeZero], false), captured);
  assert.equal(cache.counts.hits, 1, 'negative zero has the same existing JSON/geometry semantics');
  for (const operands of [[subject, undefined], [subject, null], Object.assign(new Array(2), { 0: subject })]) {
    const counts = structuredClone(cache.counts);
    assert.throws(() => cache.apply('union', operands, false));
    assert.equal(cache.counts.hits, counts.hits, 'invalid extra arity never aliases the one-operand cache');
    assert.equal(cache.counts.stored, counts.stored);
  }
});
