import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  JOBS, harnessFiles, inheritedFailureNote, parseFailureMarker, reuseKey,
} from '../scripts/gate-reuse.mjs';

/**
 * Дерево, минимально достаточное для manifest каждой тяжёлой job (#492):
 * корни проверок, точки входа и то, что они импортируют. Реальные каталоги,
 * а не подмены: ключ обязан отражать файловую систему так же, как в CI.
 * Без `.git` manifest обходит дерево сам.
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
  put('tsconfig.junction-parity.json', '{}\n');
  put('.nvmrc', '22\n');
  put('.python-version', '3.14\n');
  put('.github/workflows/validate.yml', 'name: Validate\n');
  put('scripts/source-fingerprint.mjs', '// pinned by the real repo copy\n');
  put('scripts/gate-reuse.mjs', '// reuse protocol\n');
  put('scripts/check-inputs.mjs', '// manifest\n');
  put('scripts/fix-test-build.mjs', '// esm import fixer\n');
  put('src/card.ts', "export const CARD_VERSION = '1.0.0';\n");
  put('src/plan-optimizer.ts', 'export const PLAN_MODEL_VERSION = 1;\n');
  put('src/logic.ts', 'export const logic = 1;\n');
  put('src/junction-limits.ts', "import './space-geometry';\nexport const MIN = 5;\n");
  put('src/space-geometry.ts', 'export const GRID_STEP_N = 1 / 240;\n');
  put('demo/serve.mjs', "import './bundle-freshness.mjs';\n");
  put('demo/bundle-freshness.mjs', 'export const fresh = 1;\n');
  put('demo/srv/demo.html', '<div id="host"></div>\n');
  put('demo/fixtures/one.mjs', 'export const fixture = 1;\n');
  put('demo/fixtures/large-house.mjs', 'export const makeLargeHouseFixture = () => ({});\n');
  put('demo/fixtures/visual-matrix.mjs', 'export const makeVisualMatrixFixture = () => ({});\n');
  put('demo/smoke_alpha.mjs', "import { launch } from './serve.mjs';\nimport '../scripts/model-invariants.mjs';\nconsole.log(1);\n");
  put('demo/smoke_beta.mjs', "import { launch } from './serve.mjs';\nconsole.log(2);\n");
  put('scripts/model-invariants.mjs', 'export const invariants = 1;\n');
  put('demo/guard/verify-guard.mjs', '// probes\n');
  put('demo/benchmark_glow.mjs', "import './serve.mjs';\nexport const glow = 1;\n");
  put('demo/benchmark_large_house.mjs', "import './serve.mjs';\nimport './fixtures/one.mjs';\n");
  put('demo/golden/run.mjs', "import '../serve.mjs';\nexport const run = 1;\n");
  put('demo/golden/baselines/one.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));
  put('demo/performance/compare.mjs', 'export const cmp = 1;\n');
  put('demo/performance/budgets-glow-smoke.json', '{"hardMaxMs":1}\n');
  put('tests_backend/test_pure.py', 'from custom_components.houseplan.store import VERSION\n\ndef test_x():\n    assert True\n');
  put('tests_backend/junction_parity.py', 'from pure_imports import load_pure\n');
  put('tests_backend/pure_imports.py', 'def load_pure():\n    pass\n');
  put('tests_backend/requirements.txt', 'pytest\n');
  put('test/fixtures/junction-limits-parity.json', '{"schema_version":1}\n');
  put('custom_components/houseplan/junction_limits.py', 'from .wall_segment_model import VERSION\n');
  put('custom_components/houseplan/wall_segment_model.py', 'VERSION = 1\n');
  put('custom_components/houseplan/store.py', 'VERSION = 1\n');
  put('custom_components/houseplan/manifest.json', '{"domain":"houseplan","version":"1.0.0"}\n');
  put('custom_components/houseplan/frontend/houseplan-card.js', 'built bundle\n');
  put('scripts/support-relay/relay.py', 'from hp_relay.app import main\n');
  put('scripts/support-relay/hp_relay/app.py', 'def main():\n    pass\n');
  put('scripts/support-relay/tests/test_relay.py', 'from hp_relay.app import main\n');
  put('scripts/config-schema.json', '{}\n');
  put('pytest.ini', '[pytest]\n');
  put('pyproject.toml', '[tool.ruff]\n');
  put('scripts/backend-coverage-baseline.txt', '80.0\n');
  put('docs/STATUS.md', 'status\n');
  return { dir, put };
};

const keys = (dir) => Object.fromEntries(JOBS.map((job) => [job, reuseKey(dir, job)]));

test('every heavy job has non-empty inputs and its own key', () => {
  const { dir } = makeTree();
  try {
    assert.deepEqual(JOBS, ['smoke', 'golden', 'performance_smoke', 'geometry_parity', 'backend']);
    const k = keys(dir);
    for (const job of JOBS) assert.ok(harnessFiles(dir, job).length > 0, job);
    assert.equal(new Set(Object.values(k)).size, JOBS.length, 'ключи job обязаны различаться');
    assert.throws(() => reuseKey(dir, 'frontend'), /неизвестная job/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('documentation, the process canon and tooling nobody executes leave every key untouched (#208)', () => {
  // Именно этот случай и оплачивал полный прогон: коммит, не меняющий ни одного
  // входа ни одной тяжёлой job.
  const { dir, put } = makeTree();
  try {
    const before = keys(dir);
    put('docs/STATUS.md', 'status changed\n');
    put('test/some.test.mjs', 'import test from "node:test";\n');
    put('scripts/process-gate.mjs', '// unrelated tooling\n');
    put('PROCESS.md', 'canon\n');
    assert.deepEqual(keys(dir), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the workflow itself is a toolchain input of every job (#492 §5.4)', () => {
  // Правка шага job меняет, ЧТО проверяется; пропустить такую job как
  // переиспользованную — тот же дефект, что #430, этажом выше.
  const { dir, put } = makeTree();
  try {
    const before = keys(dir);
    put('.github/workflows/validate.yml', 'name: Validate\n# step added\n');
    for (const job of JOBS) assert.notEqual(reuseKey(dir, job), before[job], job);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a behaviour input changes every browser key and a version bump changes all of them (#208, #492 AC6)', () => {
  const { dir, put } = makeTree();
  try {
    const before = keys(dir);
    put('src/card.ts', "export const CARD_VERSION = '1.0.0';\n// behaviour\n");
    for (const job of ['smoke', 'golden', 'performance_smoke']) assert.notEqual(reuseKey(dir, job), before[job], job);
    // Обратная проба AC6: бэкенд UI не исполняет — его ключ на месте.
    assert.equal(reuseKey(dir, 'backend'), before.backend, 'backend не зависит от src/**');

    // Релизный кандидат бампает версию в package.json (браузерные job) и в
    // manifest.json интеграции (backend): ключи кандидата заведомо новые, и
    // полный набор гейтов прогоняется всегда.
    const bumped = keys(dir);
    put('src/card.ts', "export const CARD_VERSION = '1.1.0';\n// behaviour\n");
    put('package.json', '{"name":"x","version":"1.1.0"}\n');
    put('custom_components/houseplan/manifest.json', '{"domain":"houseplan","version":"1.1.0"}\n');
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
        if (changed.includes(job)) assert.notEqual(after[job], before[job], `${job} должен меняться`);
        else assert.equal(after[job], before[job], `${job} меняться не должен`);
      }
    };
  };

  try {
    only(['smoke'])(() => put('demo/smoke_alpha.mjs', "import { launch } from './serve.mjs';\nconsole.log(3);\n"));
    // Эталон — вход сравнения, его подмена обязана менять ключ golden.
    only(['golden'])(() => put('demo/golden/baselines/one.png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x02])));
    only(['performance_smoke'])(() => put('demo/performance/compare.mjs', 'export const cmp = 2;\n'));
    only(['geometry_parity'])(() => put('test/fixtures/junction-limits-parity.json', '{"schema_version":1,"changed":true}\n'));
    only(['backend'])(() => put('custom_components/houseplan/store.py', 'VERSION = 2\n'));
    // Протокол браузерного харнеса общий для трёх job (#492 §5.1 protocol).
    only(['smoke', 'golden', 'performance_smoke'])(() => put('demo/serve.mjs', "import './bundle-freshness.mjs';\n// harness\n"));
    only(['smoke', 'golden', 'performance_smoke'])(() => put('demo/srv/demo.html', '<div id="host"></div>\n<!-- page -->\n'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#492 backend inputs the old HARNESS did not know: relay, schema, converter, pyproject', () => {
  const { dir, put } = makeTree();
  const bumps = (rel, text) => {
    const before = reuseKey(dir, 'backend');
    put(rel, text);
    assert.notEqual(reuseKey(dir, 'backend'), before, `${rel}: правка не меняет ключ backend`);
  };
  try {
    bumps('scripts/support-relay/relay.py', 'from hp_relay.app import main\n# changed\n');
    bumps('scripts/support-relay/hp_relay/app.py', 'def main():\n    return 1\n');
    bumps('scripts/config-schema.json', '{"v":2}\n');
    bumps('pyproject.toml', '[tool.ruff]\nline-length = 100\n');
    bumps('scripts/backend-coverage-baseline.txt', '81.0\n');
    bumps('tests_backend/requirements.txt', 'pytest==9\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#542 dynamic backend inputs invalidate its reuse key and unrelated fixtures do not', () => {
  const { dir, put } = makeTree();
  const bumpsBackend = (rel, text) => {
    const before = reuseKey(dir, 'backend');
    put(rel, text);
    assert.notEqual(reuseKey(dir, 'backend'), before, `${rel}: backend reuse key не изменился`);
  };
  try {
    bumpsBackend('src/plan-optimizer.ts', 'export const PLAN_MODEL_VERSION = 2;\n');
    bumpsBackend('src/logic.ts', 'export const logic = 2;\n');
    bumpsBackend('demo/fixtures/large-house.mjs', 'export const makeLargeHouseFixture = () => ({ changed: true });\n');
    bumpsBackend('demo/fixtures/visual-matrix.mjs', 'export const makeVisualMatrixFixture = () => ({ changed: true });\n');

    const before = reuseKey(dir, 'backend');
    put('demo/fixtures/one.mjs', 'export const fixture = 2;\n');
    assert.equal(reuseKey(dir, 'backend'), before,
      'нерелевантная fixture не должна превращать backend в широкий UI-гейт');
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
    put('demo/smoke_alpha.mjs', "import { launch } from './serve.mjs';\r\nimport '../scripts/model-invariants.mjs';\r\nconsole.log(1);\r\n");
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

test('#430 ключ смоков покрывает всё, что эта job исполняет', () => {
  // Прогон #2371 (ee678352) добавил в verify-guard.mjs пробу гарда benchmark,
  // и job со смоками была пропущена как переиспользованная: файл исполняется
  // только там, а в её ключ не входил. Проба уехала в dev, не запустившись ни
  // разу. Здесь закреплено, что так больше не выйдет.
  const { dir, put } = makeTree();
  try {
    put('demo/guard/guard_tail_exception.mjs', '// probe\n');
    put('demo/benchmark_backdrop_decode.mjs', '// benchmark\n');
    const files = harnessFiles(dir, 'smoke');
    for (const rel of [
      'demo/serve.mjs',
      'demo/bundle-freshness.mjs',
      'demo/srv/demo.html',
      'demo/guard/verify-guard.mjs',
      'demo/guard/guard_tail_exception.mjs',
      'demo/benchmark_backdrop_decode.mjs',
      'scripts/model-invariants.mjs',
    ]) {
      assert.ok(files.includes(rel), `${rel} вне ключа смоков — его правка будет реюзнута`);
    }
    // И ключ обязан меняться от правки каждого из них: список файлов сам по
    // себе ничего не гарантирует, если хэш их не читает.
    for (const rel of files) {
      if (rel === 'demo/golden/baselines/one.png') continue;
      const before = reuseKey(dir, 'smoke');
      put(rel, readFileSync(join(dir, rel), 'utf8') + '// changed\n');
      assert.notEqual(reuseKey(dir, 'smoke'), before, `${rel}: правка не меняет ключ`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scripts/** enter a key only when the job actually reaches them (#208, #492)', () => {
  // Инфраструктурная работа правит scripts/** постоянно. В ключ попадает не
  // каталог, а то, что job импортирует или запускает: process-gate.mjs — нет,
  // model-invariants.mjs (импорт смока) — да.
  const { dir, put } = makeTree();
  try {
    put('scripts/process-gate.mjs', '// tooling\n');
    for (const job of JOBS) {
      assert.ok(!harnessFiles(dir, job).includes('scripts/process-gate.mjs'), `${job}: process-gate в оснастке`);
    }
    assert.ok(harnessFiles(dir, 'smoke').includes('scripts/model-invariants.mjs'));
    assert.ok(!harnessFiles(dir, 'backend').includes('scripts/model-invariants.mjs'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- маркер падения (#386) -------------------------------------------------

const GATE_REUSE = fileURLToPath(new URL('../scripts/gate-reuse.mjs', import.meta.url));

test('первое падение на этих входах называет виновником текущий коммит (#386)', () => {
  const note = inheritedFailureNote({ job: 'golden', sha: 'dbbe94aeff00', runUrl: 'https://run/1', prior: null });
  assert.equal(note.first, true);
  assert.match(note.notice, /впервые/);
  assert.match(note.notice, /dbbe94ae/);
  assert.match(note.summary.join('\n'), /этого коммита/);
});

test('унаследованное падение снимает вину с текущего коммита (#386)', () => {
  const note = inheritedFailureNote({
    job: 'golden',
    sha: '0f7b6f5aaaaa',
    runUrl: 'https://run/2',
    prior: { sha: 'dbbe94aeff00', runUrl: 'https://run/1' },
  });
  assert.equal(note.first, false);
  // Оба SHA обязаны быть различимы: письмо называет второй, а причина в первом.
  assert.match(note.notice, /dbbe94ae/);
  assert.equal(note.notice.includes('0f7b6f5'), false,
    'свидетель не должен фигурировать как причина');
  assert.match(note.summary.join('\n'), /не ронял/);
  assert.match(note.summary.join('\n'), /https:\/\/run\/1/);
});

test('маркер без SHA не выдумывает коммит (#386)', () => {
  const note = inheritedFailureNote({ job: 'smoke', sha: 'abc1234567', runUrl: '', prior: { sha: '', runUrl: '' } });
  assert.equal(note.first, false);
  assert.match(note.summary.join('\n'), /не записан/);
  assert.equal(/`[0-9a-f]{8}`/.test(note.summary.join('\n')), false);
});

test('разбор маркера переживает пустой и мусорный вход (#386)', () => {
  assert.equal(parseFailureMarker(''), null);
  assert.equal(parseFailureMarker(undefined), null);
  assert.deepEqual(parseFailureMarker('golden упала\nSHA: abc1234\nпрогон: https://run/9\n'),
    { sha: 'abc1234', runUrl: 'https://run/9' });
  assert.deepEqual(parseFailureMarker('мусор\n'), { sha: '', runUrl: '' });
});

test('CLI пишет маркер на первом падении и не трогает его на втором (#386)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-failnote-'));
  const marker = join(dir, '.fail-marker');
  const summary = join(dir, 'summary.md');
  const run = (sha) => spawnSync(process.execPath, [
    GATE_REUSE, '--job=golden', '--note', `--marker=${marker}`,
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_SHA: sha,
      RUN_URL: `https://run/${sha}`,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_OUTPUT: join(dir, 'out.txt'),
    },
  });
  try {
    const first = run('dbbe94aeff00');
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /::notice::/);
    assert.match(readFileSync(marker, 'utf8'), /SHA: dbbe94aeff00/);

    const second = run('0f7b6f5aaaaa');
    assert.equal(second.status, 0, second.stderr);
    // Главное свойство: свидетель не переписывает первопричину.
    assert.match(readFileSync(marker, 'utf8'), /SHA: dbbe94aeff00/);
    assert.match(second.stdout, /не ронял/);
    assert.match(readFileSync(join(dir, 'out.txt'), 'utf8'), /first=false/);
    assert.match(readFileSync(summary, 'utf8'), /унаследованное падение/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
