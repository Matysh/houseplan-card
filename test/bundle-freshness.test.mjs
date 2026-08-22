import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  ALLOW_STALE_BUNDLE,
  assertFreshDemoBundle,
  assertFreshDemoBundleUnlessAllowed,
} from '../demo/bundle-freshness.mjs';
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

test('bundle freshness uses the target tree fingerprint contract', async () => {
  const root = fixtureRoot();
  try {
    mkdirSync(resolve(root, 'scripts'), { recursive: true });
    writeFileSync(
      resolve(root, 'scripts/source-fingerprint.mjs'),
      "export const sourceFingerprint = () => 'legacy-tree-fingerprint';\n",
      'utf8',
    );
    const page = { evaluate: async () => 'legacy-tree-fingerprint' };
    assert.equal(await assertFreshDemoBundle(page, root), 'legacy-tree-fingerprint');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('bundle freshness includes deterministic golden harness inputs (#244)', () => {
  const root = fixtureRoot();
  try {
    const golden = resolve(root, 'demo/golden');
    mkdirSync(golden, { recursive: true });
    writeFileSync(resolve(golden, 'matrix.mjs'), 'export const version = 1;\n', 'utf8');
    const before = sourceFingerprint(root);
    writeFileSync(resolve(golden, 'matrix.mjs'), 'export const version = 2;\n', 'utf8');
    assert.notEqual(sourceFingerprint(root), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the launcher gate refuses a stale bundle by default (#236)', async () => {
  // Смок против несвежего бандла не падает честно: на #234 три проверки
  // покраснели, а четвёртая ПРОШЛА, потому что старый код одинаково врал в двух
  // местах, которые сверялись друг с другом. Такой результат читается как
  // дефект логики и отправляет искать причину не туда.
  const root = fixtureRoot();
  try {
    const stale = { evaluate: async () => 'fingerprint-of-an-older-tree' };
    await assert.rejects(
      () => assertFreshDemoBundleUnlessAllowed(stale, root, {}),
      /stale/,
    );
    const fresh = { evaluate: async () => sourceFingerprint(root) };
    assert.equal(
      await assertFreshDemoBundleUnlessAllowed(fresh, root, {}),
      sourceFingerprint(root),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the escape hatch skips the gate but never silently (#236)', async () => {
  const root = fixtureRoot();
  const warnings = [];
  const realWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const stale = { evaluate: async () => 'stale' };
    const result = await assertFreshDemoBundleUnlessAllowed(
      stale, root, { [ALLOW_STALE_BUNDLE]: '1' },
    );
    assert.equal(result, null, 'пропуск возвращает null, а не выдуманный фингерпринт');
    assert.equal(warnings.length, 1, 'пропуск обязан быть слышен');
    assert.match(warnings[0], new RegExp(ALLOW_STALE_BUNDLE));
    assert.match(warnings[0], /#236/);
  } finally {
    console.warn = realWarn;
    rmSync(root, { recursive: true, force: true });
  }
});

test('the smoke launcher enforces the gate on the repository root (#236)', async () => {
  // Контракт места вызова: гейт живёт в общем лаунчере, поэтому защита есть у
  // всех ~128 смоков без правки каждого. И считает фингерпринт по корню
  // репозитория, а не по каталогу раздачи demo/srv, где нет src/**.
  const source = readFileSync(
    new URL('../demo/serve.mjs', import.meta.url), 'utf8',
  );
  assert.match(source, /assertFreshDemoBundleUnlessAllowed\(page, REPO_ROOT\)/);
  assert.match(source, /const REPO_ROOT = dirname\(dirname\(/);
});
