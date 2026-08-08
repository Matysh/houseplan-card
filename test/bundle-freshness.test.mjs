import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { assertFreshDemoBundle } from '../demo/bundle-freshness.mjs';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';

const fixtureRoot = () => {
  const root = mkdtempSync(resolve(tmpdir(), 'houseplan-bundle-freshness-'));
  mkdirSync(resolve(root, 'src'), { recursive: true });
  writeFileSync(resolve(root, 'src/card.ts'), 'export const card = true;\n', 'utf8');
  return root;
};

test('bundle freshness accepts the exact embedded build fingerprint', async () => {
  const root = fixtureRoot();
  try {
    const expected = sourceFingerprint(root);
    const page = { evaluate: async () => expected };
    assert.equal(await assertFreshDemoBundle(page, root), expected);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('bundle freshness rejects a missing or stale fingerprint', async () => {
  const root = fixtureRoot();
  try {
    await assert.rejects(
      assertFreshDemoBundle({ evaluate: async () => null }, root),
      /stale.*Expected.*no fingerprint/is,
    );
    await assert.rejects(
      assertFreshDemoBundle({ evaluate: async () => 'stale' }, root),
      /stale.*Expected/is,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
