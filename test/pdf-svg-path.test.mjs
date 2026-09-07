import test from 'node:test';
import assert from 'node:assert/strict';
import { GENERATED_FURNITURE_ART } from '../test-build/furniture-plan-art.generated.js';
import { parseSvgPath, transformSvgPath } from '../test-build/pdf/svg-path.js';

test('every designer furniture path converts to finite PDF vector operations', () => {
  assert.ok(Object.keys(GENERATED_FURNITURE_ART).length >= 40);
  for (const [id, art] of Object.entries(GENERATED_FURNITURE_ART)) {
    const operations = parseSvgPath(art.d);
    assert.ok(operations.length > 0, `${id} has no operations`);
    for (const operation of operations) {
      for (const value of Object.values(operation)) {
        if (typeof value === 'number') assert.ok(Number.isFinite(value), `${id} contains ${value}`);
      }
    }
  }
});

test('arc and affine transforms become deterministic cubic paths', () => {
  const first = transformSvgPath('M0 5A5 5 0 1 1 10 5Z', {
    a: 2, b: 0, c: 0, d: 3, e: 7, f: 11,
  });
  const second = transformSvgPath('M0 5A5 5 0 1 1 10 5Z', {
    a: 2, b: 0, c: 0, d: 3, e: 7, f: 11,
  });
  assert.deepEqual(first, second);
  assert.ok(first.some((operation) => operation.op === 'C'));
  assert.deepEqual(first.at(-1), { op: 'Z' });
});

