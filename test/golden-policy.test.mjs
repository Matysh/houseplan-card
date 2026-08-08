import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertGoldenInvocation,
  GOLDEN_BASELINE_MANIFEST,
  goldenRunFailed,
} from '../demo/golden/policy.mjs';

test('golden metadata cannot be mistaken for a Home Assistant integration manifest', () => {
  assert.equal(GOLDEN_BASELINE_MANIFEST, 'baseline-manifest.json');
  assert.notEqual(GOLDEN_BASELINE_MANIFEST, 'manifest.json');
});

test('golden capture fails on runtime errors but permits missing baselines', () => {
  assert.equal(goldenRunFailed('capture', false, [{ status: 'error' }]), true);
  assert.equal(goldenRunFailed('capture', false, [{ status: 'missing-baseline' }]), false);
  assert.equal(goldenRunFailed('verify', true, [{ status: 'different' }]), true);
  assert.equal(goldenRunFailed('verify', true, [{ status: 'passed' }]), false);
});

test('golden verification cannot make a partial success claim', () => {
  assert.doesNotThrow(() => assertGoldenInvocation('capture', 'one-scenario'));
  assert.doesNotThrow(() => assertGoldenInvocation('verify', ''));
  assert.throws(() => assertGoldenInvocation('verify', 'one-scenario'), /complete matrix/);
  assert.throws(() => assertGoldenInvocation('unknown', ''), /unknown golden mode/);
});
