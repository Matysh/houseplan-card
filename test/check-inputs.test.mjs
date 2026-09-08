import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import {
  CHECKS, CHECK_NAMES, NOT_AN_INPUT, REUSE_JOBS, checksAffectedBy, closure, coverage, globToRegExp,
  inputsOf, isDeclaredNotAnInput, isExecutableInput, manifest, referencesOf, stripComments,
} from '../scripts/check-inputs.mjs';

// Единый manifest входов (#492 §5). Две группы доказательств: чистая механика
// (glob, ссылки, замыкание) на виртуальном дереве и представительные входы
// §8.1 на РЕАЛЬНОМ репозитории — для каждой тяжёлой job и каждой категории
// названный файл обязан быть её входом, а UI — не входом backend (AC6).

const ROOT = process.cwd();
const MANIFEST = manifest(ROOT);
// Пути, которых в manifest быть не должно, собираются из кусков — литерал в
// этом файле сделал бы их входом frontend (тесты читают то, что называют).
const p = (...parts) => parts.join('/');

test('glob: ** — любой путь, * — сегмент, точка буквальна', () => {
  assert.ok(globToRegExp('src/**').test('src/a/b.ts'));
  assert.ok(globToRegExp('src/**').test('src/a.ts'));
  assert.ok(!globToRegExp('src/**').test('srcx/a.ts'));
  assert.ok(globToRegExp('demo/smoke_*.mjs').test('demo/smoke_alpha.mjs'));
  assert.ok(!globToRegExp('demo/smoke_*.mjs').test('demo/guard/smoke_alpha.mjs'));
  assert.ok(globToRegExp('custom_components/**/*.py').test('custom_components/houseplan/store.py'));
  assert.ok(!globToRegExp('custom_components/**/*.py').test('custom_components/houseplan/frontend/x.js'));
  assert.ok(!globToRegExp('package.json').test('packageXjson'));
});

test('ссылки: импорты JS — код, строковые пути — данные, комментарии — ничего', () => {
  const text = `
    import a from './a.mjs';
    import { b } from '../lib/b.mjs';
    export * from './c.mjs';
    const d = await import('./d.mjs');
    const e = require('./e.mjs');
    // import x from './comment.mjs';
    /* readFileSync('demo/fixtures/comment.json') */
    const f = readFileSync('demo/fixtures/f.json');
    const g = 'docs/g.md';
    const h = spawnSync('node', ['demo/benchmark_h.mjs', '--guard-probe']);
    const hint = 'run node demo/benchmark_hint.mjs by hand';
  `;
  const refs = referencesOf('test/x.test.mjs', text);
  assert.deepEqual(refs.code.sort(), [
    'demo/benchmark_h.mjs', 'lib/b.mjs', 'test/a.mjs', 'test/c.mjs', 'test/d.mjs', 'test/e.mjs',
  ]);
  // путь внутри фразы-подсказки — не ссылка: строка обязана быть путём целиком
  assert.deepEqual(refs.data.sort(), ['demo/fixtures/f.json', 'docs/g.md']);
  assert.ok(!stripComments('x.mjs', text).includes('comment.mjs'));
});

test('ссылки: test-build/*.js — это src/*.ts, компилируемый tsconfig.test.json', () => {
  const refs = referencesOf('test/x.test.mjs', "import { f } from '../test-build/space-geometry.js';\n");
  assert.deepEqual(refs.code, ['src/space-geometry.ts']);
});

test('ссылки: Python — пакеты репозитория, относительные модули relay, Path-цепочки', () => {
  const text = `
    from custom_components.houseplan.validation import CONFIG_SCHEMA
    import tests_backend.pure_imports
    from hp_relay.app import main
    """ from custom_components.houseplan.ghost import x """
    GOLDEN = REPO / "scripts" / "sh3d-convert" / "golden"
    schema = (REPO / "scripts" / "config-schema.json").read_text()
  `;
  const refs = referencesOf('scripts/support-relay/tests/test_relay.py', text);
  assert.ok(refs.code.includes('custom_components/houseplan/validation.py'));
  assert.ok(refs.code.includes('tests_backend/pure_imports.py'));
  assert.ok(refs.code.includes('scripts/support-relay/hp_relay/app.py'));
  assert.ok(!refs.code.some((f) => f.includes('ghost')), 'docstring — не импорт');
  assert.ok(refs.data.includes('scripts/sh3d-convert/golden'));
  assert.ok(refs.data.includes('scripts/config-schema.json'));
});

test('замыкание: код транзитивно, данные — листья, каталог — все текстовые файлы под ним', () => {
  const files = {
    'demo/smoke_a.mjs': "import './serve.mjs';\nconst x = 'demo/fixtures';\n",
    'demo/serve.mjs': "import './compat.mjs';\n",
    'demo/compat.mjs': "import '../scripts/helper.mjs';\n",
    'scripts/helper.mjs': "export const h = 1; // import './never.mjs'\n",
    'scripts/never.mjs': '',
    'demo/fixtures/one.mjs': "import '../deep.mjs';\n",
    'demo/fixtures/two.json': '{}',
    'demo/fixtures/pic.png': 'binary',
    'demo/deep.mjs': '',
  };
  const tracked = Object.keys(files).sort();
  const parents = new Map();
  const reached = closure('/virtual', ['demo/smoke_a.mjs'], { tracked, read: (f) => files[f], parents });
  assert.deepEqual(reached, [
    'demo/compat.mjs', 'demo/fixtures/one.mjs', 'demo/fixtures/two.json', 'demo/serve.mjs',
    'demo/smoke_a.mjs', 'scripts/helper.mjs',
  ]);
  // фикстура — данные: её собственный импорт (deep.mjs) не читается,
  // картинка под каталогом не берётся, комментарий не ссылка
  assert.ok(!reached.includes('demo/deep.mjs'));
  assert.ok(!reached.includes('demo/fixtures/pic.png'));
  assert.ok(!reached.includes('scripts/never.mjs'));
  assert.equal(parents.get('scripts/helper.mjs'), 'demo/compat.mjs');
});

test('замыкание останавливается на копиях бандла (класс D)', () => {
  const files = {
    'demo/smoke_a.mjs': "import '../custom_components/houseplan/frontend/houseplan-card.js';\n",
    'custom_components/houseplan/frontend/houseplan-card.js': "import './houseplan-assets/x.js';\n",
    'custom_components/houseplan/frontend/houseplan-assets/x.js': '',
  };
  const tracked = Object.keys(files).sort();
  const spec = { entries: ['demo/smoke_a.mjs'], roots: [] };
  const saved = CHECKS.__virtual;
  CHECKS.__virtual = spec;
  try {
    const inputs = inputsOf('__virtual', '/virtual', { tracked, read: (f) => files[f] });
    assert.deepEqual(inputs, ['demo/smoke_a.mjs']);
  } finally {
    if (saved) CHECKS.__virtual = saved; else delete CHECKS.__virtual;
  }
});

test('каждая проверка объявлена, у тяжёлых job включён реюз, у остальных нет', () => {
  assert.deepEqual(REUSE_JOBS, ['smoke', 'golden', 'performance_smoke', 'backend']);
  for (const name of CHECK_NAMES) {
    assert.ok(MANIFEST[name].size > 0, `${name}: пустой manifest`);
    assert.ok(Array.isArray(CHECKS[name].entries) && Array.isArray(CHECKS[name].roots), name);
  }
  assert.throws(() => inputsOf('nope', ROOT), /неизвестная проверка/);
});

test('§8.1 представители: каждая категория каждой тяжёлой job — её вход', () => {
  const expect = {
    backend: {
      source: ['custom_components/houseplan/websocket_api.py', 'scripts/support-relay/relay.py',
        'scripts/support-relay/hp_relay/app.py', 'scripts/sh3d-convert/convert.mjs', 'scripts/dump-config-schema.py'],
      tests: ['tests_backend/test_ha_websocket.py', 'tests_backend/conftest.py', 'scripts/support-relay/tests/test_relay.py'],
      fixtures: ['scripts/sh3d-convert/golden/two-levels.space-1.json', 'scripts/config-schema.json',
        'test/fixtures/real-plan-first-floor.json'],
      config: ['pyproject.toml', 'pytest.ini', 'scripts/backend-coverage-baseline.txt'],
      toolchain: ['tests_backend/requirements.txt', 'custom_components/houseplan/manifest.json', '.github/workflows/validate.yml'],
      protocol: ['scripts/gate-reuse.mjs', 'scripts/check-inputs.mjs'],
    },
    smoke: {
      source: ['src/houseplan-card.ts', 'src/logic.ts'],
      tests: ['demo/smoke_infinite_canvas.mjs', 'demo/guard/verify-guard.mjs', 'demo/benchmark_glow.mjs'],
      fixtures: ['demo/fixtures/large-house.mjs', 'demo/fixtures/wall-draw-click.mjs'],
      config: ['rollup.config.mjs', 'tsconfig.json'],
      toolchain: ['package.json', 'package-lock.json', '.github/workflows/validate.yml'],
      protocol: ['demo/serve.mjs', 'demo/srv/demo.html', 'demo/bundle-freshness.mjs',
        'demo/editor-runtime-compat.mjs', 'demo/iso-runtime-compat.mjs', 'scripts/smoke-select.mjs'],
    },
    golden: {
      source: ['src/houseplan-card.ts'],
      tests: ['demo/golden/run.mjs', 'demo/golden/matrix.mjs', 'demo/golden/harness.mjs'],
      fixtures: ['demo/golden/baselines/geometry-view-dark-fit.png', 'demo/golden/baselines/baselines-index.json',
        'demo/fixtures/visual-matrix.mjs'],
      config: ['rollup.config.mjs', 'tsconfig.json'],
      toolchain: ['package.json', '.github/workflows/validate.yml'],
      protocol: ['demo/serve.mjs', 'demo/srv/demo.html', 'demo/bundle-freshness.mjs', 'demo/editor-runtime-compat.mjs'],
    },
    performance_smoke: {
      source: ['src/houseplan-card.ts'],
      tests: ['demo/benchmark_glow.mjs', 'demo/benchmark_large_house.mjs', 'demo/performance/compare.mjs'],
      fixtures: ['demo/fixtures/large-house.mjs', 'demo/performance/budgets-glow-smoke.json',
        'demo/performance/budgets-isometric-smoke.json', 'demo/performance/budgets-interaction-smoke.json'],
      config: ['rollup.config.mjs'],
      toolchain: ['package.json', '.github/workflows/validate.yml'],
      protocol: ['demo/serve.mjs', 'demo/srv/demo.html', 'demo/editor-runtime-compat.mjs', 'demo/performance/evaluate.mjs'],
    },
  };
  for (const [job, categories] of Object.entries(expect)) {
    for (const [category, files] of Object.entries(categories)) {
      for (const file of files) {
        assert.ok(MANIFEST[job].has(file), `${job}/${category}: ${file} не вход`);
        const { affected, unknown } = checksAffectedBy([file], ROOT, { manifest: MANIFEST });
        assert.ok(affected.has(job), `${job}/${category}: ${file} не классифицируется`);
        assert.deepEqual(unknown, [], file);
      }
    }
  }
});

test('§8.1 обратная проба (AC6): UI — не вход backend, backend — не вход браузерных job без причины', () => {
  for (const file of ['src/houseplan-card.ts', 'src/houseplan-editor-runtime.ts', 'src/iso-overlays.ts', 'package.json']) {
    assert.ok(!MANIFEST.backend.has(file), `backend зависит от ${file}`);
    assert.ok(!checksAffectedBy([file], ROOT, { manifest: MANIFEST }).affected.has('backend'), file);
  }
  // smoke_infinite_canvas запускает backend-валидацию как процесс — это
  // честная зависимость; но tests_backend/** браузерным job не нужны
  for (const job of ['smoke', 'golden', 'performance_smoke']) {
    assert.ok(![...MANIFEST[job]].some((f) => f.startsWith('tests_backend/')), `${job} читает tests_backend`);
  }
});

test('§5.5 лист покрытия: ни одного неизвестного исполняемого файла, ни одной лишней записи NOT_AN_INPUT', () => {
  const { unknown, declaredButCovered } = coverage(ROOT, { manifest: MANIFEST });
  assert.deepEqual(unknown, [], 'исполняемый файл без хозяина: впишите в CHECKS или в NOT_AN_INPUT с причиной');
  assert.deepEqual(declaredButCovered, [], 'запись NOT_AN_INPUT лишняя — файл и так вход');
  for (const [glob, reason] of NOT_AN_INPUT) assert.ok(reason.length > 10, `${glob}: нужна причина`);
});

test('неизвестный вход расширяет до всех проверок и называется; документация и не-входы — нет', () => {
  const ghost = p('scripts', 'ghost-gate.mjs');
  const { affected, unknown } = checksAffectedBy([ghost], ROOT, { manifest: MANIFEST });
  assert.deepEqual(unknown, [ghost]);
  assert.deepEqual([...affected].sort(), [...CHECK_NAMES].sort());
  assert.ok(isExecutableInput(ghost));
  assert.ok(!isExecutableInput(p('docs', 'ghost.md')));
  assert.ok(isDeclaredNotAnInput(p('demo', 'shot_sun.mjs')));
  const quiet = checksAffectedBy([p('docs', 'ghost.md'), p('demo', 'shot_sun.mjs')], ROOT, { manifest: MANIFEST });
  assert.deepEqual(quiet.unknown, []);
  assert.equal(quiet.affected.size, 0);
});

test('CLI: --check печатает входы, --why объясняет цепочку, --coverage зелёный на текущем дереве', () => {
  const script = new URL('../scripts/check-inputs.mjs', import.meta.url).pathname;
  const backend = execFileSync('node', [script, '--check=backend'], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(backend.includes('scripts/support-relay/relay.py'));
  const why = execFileSync('node', [script, '--check=backend', '--why=scripts/sh3d-convert/convert.mjs'], { encoding: 'utf8' });
  assert.match(why, /^scripts\/sh3d-convert\/convert\.mjs\n/);
  assert.match(why, /tests_backend\/test_sh3d_convert\.py/);
  const cov = execFileSync('node', [script, '--coverage'], { encoding: 'utf8' });
  assert.equal(cov.trim(), '');
});
