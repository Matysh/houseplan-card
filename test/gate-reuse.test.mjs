import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HARNESS, JOBS, harnessFiles, reuseKey } from '../scripts/gate-reuse.mjs';

/**
 * Дерево, минимально достаточное для sourceFingerprint плюс оснастка каждой
 * тяжёлой job. Реальные каталоги, а не подмены: ключ обязан отражать файловую
 * систему так же, как в CI.
 */
const makeTree = () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-reuse-'));
  const put = (rel, text) => {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  };
  put('package.json', '{"name":"x","version":"1.0.0"}\n');
  put('package-lock.json', '{"lockfileVersion":3}\n');
  put('rollup.config.mjs', 'export default {};\n');
  put('tsconfig.json', '{}\n');
  put('scripts/source-fingerprint.mjs', '// pinned by the real repo copy\n');
  put('src/card.ts', "export const CARD_VERSION = '1.0.0';\n");
  put('demo/fixtures/one.mjs', 'export const fixture = 1;\n');
  put('demo/smoke_alpha.mjs', 'console.log(1);\n');
  put('demo/smoke_beta.mjs', 'console.log(2);\n');
  put('demo/benchmark_glow.mjs', 'export const glow = 1;\n');
  put('demo/golden/run.mjs', 'export const run = 1;\n');
  put('demo/golden/baselines/one.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));
  put('demo/performance/compare.mjs', 'export const cmp = 1;\n');
  put('tests_backend/test_pure.py', 'def test_x():\n    assert True\n');
  put('custom_components/houseplan/store.py', 'VERSION = 1\n');
  put('custom_components/houseplan/frontend/houseplan-card.js', 'built bundle\n');
  put('pytest.ini', '[pytest]\n');
  put('docs/STATUS.md', 'status\n');
  return { dir, put };
};

const keys = (dir) => Object.fromEntries(JOBS.map((job) => [job, reuseKey(dir, job)]));

test('every heavy job has a non-empty harness and its own key', () => {
  const { dir } = makeTree();
  try {
    assert.deepEqual(JOBS, ['smoke', 'golden', 'performance_smoke', 'backend']);
    for (const job of JOBS) assert.ok(harnessFiles(dir, job).length > 0, job);
    // Ключи различаются между job: иначе правка чужой оснастки гасила бы чужой
    // прогон, а совпадение ключей маскировало бы это как «то же самое».
    const set = new Set(Object.values(keys(dir)));
    assert.equal(set.size, JOBS.length);
    assert.throws(() => reuseKey(dir, 'frontend'), /неизвестная job/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('documentation, workflows and unit tests leave every key untouched (#208)', () => {
  // Именно этот случай и оплачивал полный прогон: коммит, не меняющий ни одного
  // входа поведения и ни одной оснастки.
  const { dir, put } = makeTree();
  try {
    const before = keys(dir);
    put('docs/STATUS.md', 'status changed\n');
    put('.github/workflows/validate.yml', 'name: Validate\n');
    put('test/some.test.mjs', 'import test from "node:test";\n');
    put('scripts/process-gate.mjs', '// unrelated tooling\n');
    put('PROCESS.md', 'canon\n');
    assert.deepEqual(keys(dir), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a behaviour input changes every key, including a version bump (#208)', () => {
  const { dir, put } = makeTree();
  try {
    const before = keys(dir);
    put('src/card.ts', "export const CARD_VERSION = '1.0.0';\n// behaviour\n");
    for (const job of JOBS) assert.notEqual(reuseKey(dir, job), before[job], job);

    // Релизный кандидат бампает версию, поэтому его ключи заведомо новые и
    // полный набор гейтов прогоняется всегда — переиспользование не может
    // ослабить релизный гейт.
    const bumped = keys(dir);
    put('src/card.ts', "export const CARD_VERSION = '1.1.0';\n// behaviour\n");
    put('package.json', '{"name":"x","version":"1.1.0"}\n');
    for (const job of JOBS) assert.notEqual(reuseKey(dir, job), bumped[job], job);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('harness edits are isolated to their own job (#208)', () => {
  const { dir, put } = makeTree();
  const only = (changed) => {
    const before = keys(dir);
    return (apply) => {
      apply();
      const after = keys(dir);
      for (const job of JOBS) {
        if (job === changed) assert.notEqual(after[job], before[job], `${job} должен меняться`);
        else assert.equal(after[job], before[job], `${job} меняться не должен`);
      }
    };
  };

  try {
    only('smoke')(() => put('demo/smoke_alpha.mjs', 'console.log(3);\n'));
    // Эталон — вход сравнения, его подмена обязана менять ключ golden.
    only('golden')(() => put('demo/golden/baselines/one.png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x02])));
    only('performance_smoke')(() => put('demo/performance/compare.mjs', 'export const cmp = 2;\n'));
    only('backend')(() => put('custom_components/houseplan/store.py', 'VERSION = 2\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the built bundle is outside every key — each job builds it itself (#208)', () => {
  const { dir, put } = makeTree();
  try {
    const before = keys(dir);
    put('custom_components/houseplan/frontend/houseplan-card.js', 'rebuilt bundle\n');
    put('dist/houseplan-card.js', 'rebuilt bundle\n');
    put('demo/srv/assets/houseplan-card.js', 'rebuilt bundle\n');
    assert.deepEqual(keys(dir), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the key is canonical across line endings', () => {
  const { dir, put } = makeTree();
  try {
    const before = keys(dir);
    put('demo/smoke_alpha.mjs', 'console.log(1);\r\n');
    assert.deepEqual(keys(dir), before, 'CRLF не должен рождать другой ключ');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the CLI prints the key and writes it to GITHUB_OUTPUT', (t) => {
  const { dir } = makeTree();
  const cli = fileURLToPath(new URL('../scripts/gate-reuse.mjs', import.meta.url));
  const out = join(dir, 'gh-output');
  writeFileSync(out, '');
  try {
    const run = (args, env = {}) => spawnSync(process.execPath, [cli, ...args],
      { encoding: 'utf8', env: { ...process.env, ...env } });

    const ok = run([`--repo=${dir}`, '--job=golden'], { GITHUB_OUTPUT: out });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    const printed = ok.stdout.trim();
    assert.match(printed, /^[0-9a-f]{64}$/);
    assert.equal(printed, reuseKey(dir, 'golden'));

    // Значение уезжает в GITHUB_OUTPUT ровно в том виде, который читает шаг.
    // Раньше здесь стоял динамический import внутри синхронной функции — CLI
    // падал бы именно в CI, где GITHUB_OUTPUT задан.
    assert.equal(readFileSync(out, 'utf8'), `key=${printed}\n`);

    // Без --job работать нельзя: пустой ключ совпал бы со всем подряд.
    assert.equal(run([`--repo=${dir}`]).status, 2);
    const unknown = run([`--repo=${dir}`, '--job=frontend']);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /неизвестная job/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('HARNESS keeps scripts/** out of the keys on purpose', () => {
  // Инфраструктурная работа правит scripts/** постоянно. Если бы каталог
  // целиком попал в ключ, переиспользование не срабатывало бы никогда — ровно
  // тот случай, ради которого #208 и заводился.
  const { dir, put } = makeTree();
  try {
    put('scripts/process-gate.mjs', '// tooling\n');
    for (const [job, spec] of Object.entries(HARNESS)) {
      assert.ok(!spec.roots.includes('scripts'), `${job}: scripts в корнях обхода`);
      assert.ok(
        !harnessFiles(dir, job).some((rel) => rel.startsWith('scripts/')),
        `${job}: scripts попал в оснастку`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
