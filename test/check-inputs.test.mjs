import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  BASELINE_OVERLAY, CHECKS, CHECK_NAMES, NOT_AN_INPUT, REUSE_JOBS, checksAffectedBy, closure, coverage,
  GUARDED_DATA_ROOTS, globToRegExp, inputsOf, isBaselineOverlay, isDeclaredNotAnInput, isExecutableInput,
  isGuardedInput, manifest, referencesOf,
  stripComments,
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

test('#812 AC1: комментарии не съедают реальные импорты process-gate', () => {
  const refs = referencesOf('scripts/process-gate.mjs', readFileSync('scripts/process-gate.mjs', 'utf8'));
  for (const name of ['validate-commit-provenance', 'change-classes', 'review-doc-guard', 'process-track']) {
    assert.ok(refs.code.includes(`scripts/${name}.mjs`), name);
  }
});

test('#812 AC1: маркеры комментариев в строках и regex не повреждают следующие импорты', () => {
  const text = [
    'const a = "/*"; const b = "https://host/path";',
    "const c = 'escaped\\\' // still string';",
    'const re = /[/*]/; const quotient = 8 / 2;',
    '// glob scripts/** — не начало block-comment',
    "import /* annotation */ value from './real.mjs';",
    "export { value } from './exported.mjs';",
    "/* import './block-comment.mjs'; */",
    "// import './line-comment.mjs';",
  ].join('\n');
  const clean = stripComments('test/probe.mjs', text);
  assert.ok(clean.includes('"/*"'));
  assert.ok(clean.includes('"https://host/path"'));
  assert.ok(!clean.includes('block-comment.mjs'));
  assert.deepEqual(referencesOf('test/probe.mjs', text).code.sort(), ['test/exported.mjs', 'test/real.mjs']);
});

test('#812 AC1: текст программы в строке — не импорт; interpolation остаётся исполняемым кодом', () => {
  const text = [
    'const fixture = "import x from \'./fake.mjs\';";',
    'const raw = `import "./template-fake.mjs"; // /* raw`;',
    'const executable = `value: ${await import("./interpolated.mjs")}`;',
    'const fixturePath = "scripts/fixture-only.mjs";',
    "import './real.mjs';",
  ].join('\n');
  const refs = referencesOf('test/probe.mjs', text);
  assert.deepEqual(refs.code.sort(), ['test/interpolated.mjs', 'test/real.mjs']);
  assert.ok(refs.data.includes('scripts/fixture-only.mjs'), 'строковый путь остаётся data-листом');
});

test('#812 AC1: пути собственного manifest — метаданные, но его импорты обходятся', () => {
  const source = "import './helper.mjs'; const excluded = 'scripts/manual-only.mjs';";
  const files = {
    'scripts/check-inputs.mjs': source,
    'scripts/helper.mjs': "import './nested.mjs';",
    'scripts/nested.mjs': '',
    'scripts/manual-only.mjs': '',
  };
  assert.deepEqual(closure('/virtual', ['scripts/check-inputs.mjs'], {
    tracked: Object.keys(files), read: (file) => files[file],
  }), ['scripts/check-inputs.mjs', 'scripts/helper.mjs', 'scripts/nested.mjs']);
  assert.ok(referencesOf('scripts/ordinary-reader.mjs', source).data.includes('scripts/manual-only.mjs'),
    'исключение касается только деклараций самого manifest');
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

test('замыкание: код транзитивно, данные — листья, каталог — runtime-файлы под ним', () => {
  const files = {
    'demo/smoke_a.mjs': "import './serve.mjs';\nconst x = 'demo/fixtures';\n",
    'demo/serve.mjs': "import './compat.mjs';\n",
    'demo/compat.mjs': "import '../scripts/helper.mjs';\n",
    'scripts/helper.mjs': "export const h = 1; // import './never.mjs'\n",
    'scripts/never.mjs': '',
    'demo/fixtures/one.mjs': "import '../deep.mjs';\n",
    'demo/fixtures/two.json': '{}',
    'demo/fixtures/README.md': 'documentation',
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
  assert.ok(!reached.includes('demo/fixtures/README.md'));
  assert.ok(!reached.includes('scripts/never.mjs'));
  assert.equal(parents.get('scripts/helper.mjs'), 'demo/compat.mjs');
});

test('#812 AC2: data → code повышает уровень обхода независимо от порядка корней и рёбер, цикл конечен', () => {
  for (const entries of [['scripts/data.mjs', 'scripts/code.mjs'], ['scripts/code.mjs', 'scripts/data.mjs']]) {
    for (const imports of ["import './b.mjs'; import './data.mjs';", "import './data.mjs'; import './b.mjs';"]) {
      const files = {
        'scripts/data.mjs': "const b = 'scripts/b.mjs'; const leaf = 'scripts/leaf.mjs';",
        'scripts/code.mjs': imports,
        'scripts/b.mjs': "import './c.mjs';",
        'scripts/c.mjs': "import './b.mjs';",
        'scripts/leaf.mjs': "import './never.mjs';",
        'scripts/never.mjs': '',
      };
      const reads = new Map();
      const reached = closure('/virtual', entries, {
        tracked: Object.keys(files),
        read: (file) => { reads.set(file, (reads.get(file) || 0) + 1); return files[file]; },
      });
      assert.deepEqual(reached, ['scripts/b.mjs', 'scripts/c.mjs', 'scripts/code.mjs', 'scripts/data.mjs', 'scripts/leaf.mjs']);
      assert.ok([...reads.values()].every((n) => n === 1), 'код читается один раз даже при цикле');
      assert.ok(!reads.has('scripts/leaf.mjs'), 'data-only лист не читается');
    }
  }
});

test('#812 AC2: повышение после каталога сохраняет stopAt, LEAF_FILES и overlay', () => {
  const files = {
    'scripts/a.mjs': "const dir = 'demo/fixtures'; const registry = 'scripts/mutation-registry.mjs';",
    'scripts/z.mjs': "import '../demo/fixtures/b.mjs'; import './mutation-registry.mjs'; import './stop.mjs';",
    'demo/fixtures/b.mjs': "import '../child.mjs';",
    'demo/child.mjs': "const overlay = 'demo/golden';",
    'demo/fixtures/leaf.mjs': "import '../never.mjs';",
    'demo/fixtures/README.md': '',
    'demo/fixtures/pic.png': '',
    'demo/golden/baselines/x.json': '{}',
    'scripts/mutation-registry.mjs': "import './never.mjs';",
    'scripts/stop.mjs': "import './never.mjs';",
    'scripts/never.mjs': '',
    'demo/never.mjs': '',
  };
  const reads = [];
  const reached = closure('/virtual', ['scripts/a.mjs', 'scripts/z.mjs'], {
    tracked: Object.keys(files), stopAt: (file) => file === 'scripts/stop.mjs',
    read: (file) => { reads.push(file); return files[file]; },
  });
  assert.deepEqual(reached, ['demo/child.mjs', 'demo/fixtures/b.mjs', 'demo/fixtures/leaf.mjs',
    'scripts/a.mjs', 'scripts/mutation-registry.mjs', 'scripts/stop.mjs', 'scripts/z.mjs']);
  assert.ok(!reads.includes('scripts/stop.mjs'));
  assert.ok(!reads.includes('scripts/mutation-registry.mjs'));
  assert.ok(!reads.includes('demo/fixtures/leaf.mjs'));
});

// #573: overlay принятых эталонов принадлежит только golden. Строка-каталог
// `demo/golden` в корпусе отпечатка раскрывалась во ВСЕ текстовые файлы под
// ним, и индекс эталонов становился входом smoke, perf и каждого гарда через
// serve.mjs — приёмка 13 кадров на beta.3 перегнала 22 минуты чужой работы.
test('#573: раскрытие каталога не выдаёт overlay эталонов; явный корень и явная ссылка — выдают', () => {
  const files = {
    'demo/smoke_a.mjs': "import './serve.mjs';\n",
    'demo/serve.mjs': "import '../scripts/source-fingerprint.mjs';\n",
    'scripts/source-fingerprint.mjs': "const corpus = ['demo/fixtures', 'demo/golden'];\n",
    'demo/golden/run.mjs': "const baselineRoot = 'demo/golden/baselines';\n",
    'demo/golden/matrix.mjs': 'export const GOLDEN_SCENARIOS = [];\n',
    'demo/golden/baselines/baselines-index.json': '{"scenarios":{}}',
    'demo/golden/baselines/scene.png': 'binary',
    'demo/golden/baselines/.gitkeep': '',
    'test/golden-index.test.mjs': "const index = 'demo/golden/baselines/baselines-index.json';\n",
  };
  const tracked = Object.keys(files).sort();
  const viaSmoke = closure('/virtual', ['demo/smoke_a.mjs'], { tracked, read: (f) => files[f] });
  assert.ok(viaSmoke.includes('demo/golden/matrix.mjs'), 'код под demo/golden — по-прежнему вход');
  assert.ok(!viaSmoke.some(isBaselineOverlay), `overlay не течёт через каталог: ${viaSmoke.join(', ')}`);
  // golden сама называет каталог эталонов строкой — и всё равно получает их не
  // раскрытием, а явным корнем manifest (CHECKS.golden.roots)
  const viaGolden = closure('/virtual', ['demo/golden/run.mjs'], { tracked, read: (f) => files[f] });
  assert.ok(!viaGolden.some(isBaselineOverlay), 'каталог overlay по строке — тоже не раскрывается');
  assert.ok(CHECKS.golden.roots.includes('demo/golden/baselines/**'), 'эталоны входят в golden корнем');
  assert.ok(!CHECKS.golden.roots.includes('demo/golden/**'), 'весь каталог golden не должен захватывать README');
  // явная ссылка на файл overlay — честная зависимость, она остаётся
  const viaTest = closure('/virtual', ['test/golden-index.test.mjs'], { tracked, read: (f) => files[f] });
  assert.ok(viaTest.includes('demo/golden/baselines/baselines-index.json'));
  assert.deepEqual(BASELINE_OVERLAY, ['demo/golden/baselines/**']);
  assert.equal(isBaselineOverlay('demo/golden/baselines/baselines-index.json'), true);
  assert.equal(isBaselineOverlay('demo/golden/matrix.mjs'), false);
});

test('#672: документация каталога не раскрывается, но явно читаемый Markdown остаётся входом', () => {
  const files = {
    'demo/runner.mjs': "const root = 'demo/harness';\n",
    'demo/harness/runtime.mjs': 'export const runtime = true;\n',
    'demo/harness/config.json': '{}\n',
    'demo/harness/README.md': 'not an implicit input\n',
    'test/read-doc.test.mjs': "readFileSync(new URL('../demo/harness/README.md', import.meta.url), 'utf8');\n",
  };
  const tracked = Object.keys(files).sort();
  const implicit = closure('/virtual', ['demo/runner.mjs'], { tracked, read: (f) => files[f] });
  assert.ok(implicit.includes('demo/harness/runtime.mjs'));
  assert.ok(implicit.includes('demo/harness/config.json'));
  assert.ok(!implicit.includes('demo/harness/README.md'));
  const explicit = closure('/virtual', ['test/read-doc.test.mjs'], { tracked, read: (f) => files[f] });
  assert.ok(explicit.includes('demo/harness/README.md'));
});

test('#672: README каталогов харнесса не выбирают проверки; реально читаемый README выбирает', () => {
  const implicitDocs = [
    p('demo', 'golden', 'README.md'),
    p('demo', 'guard', 'README.md'),
    p('demo', 'srv', 'reference', 'device-icons', 'README.md'),
  ];
  for (const file of implicitDocs) {
    const { affected, unknown } = checksAffectedBy([file], ROOT, { manifest: MANIFEST });
    assert.deepEqual(unknown, [], file);
    assert.deepEqual([...affected], [], `${file}: ${[...affected].join(', ')}`);
  }
  const readByReleaseGate = p('demo', 'performance', 'README.md');
  assert.ok(MANIFEST.frontend.has(readByReleaseGate), 'явное чтение в release-gate.test.mjs — вход frontend');
  assert.ok(MANIFEST.performance_smoke.has(readByReleaseGate), 'performance README остаётся входом performance_smoke');
});

test('#573: на живом дереве индекс эталонов — вход golden и ничьей другой реюзной job', () => {
  // путь собран из кусков: литерал сделал бы индекс входом frontend через этот тест
  const index = p('demo', 'golden', 'baselines', 'baselines-index.json');
  for (const check of ['smoke', 'performance_smoke', 'geometry_parity', 'backend']) {
    assert.ok(!MANIFEST[check].has(index), `${check} не читает эталоны`);
  }
  assert.ok(MANIFEST.golden.has(index));
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
  assert.deepEqual(REUSE_JOBS, ['smoke', 'golden', 'performance_smoke', 'geometry_parity', 'backend']);
  for (const name of CHECK_NAMES) {
    assert.ok(MANIFEST[name].size > 0, `${name}: пустой manifest`);
    assert.ok(Array.isArray(CHECKS[name].entries) && Array.isArray(CHECKS[name].roots), name);
  }
  assert.throws(() => inputsOf('nope', ROOT), /неизвестная проверка/);
});

test('§8.1 представители: каждая категория каждой тяжёлой job — её вход', () => {
  const expect = {
    geometry_parity: {
      source: ['src/junction-limits.ts', 'src/space-geometry.ts',
        'custom_components/houseplan/junction_limits.py', 'custom_components/houseplan/wall_segment_model.py'],
      tests: ['tests_backend/junction_parity.py'],
      fixtures: ['test/fixtures/junction-limits-parity.json'],
      config: ['tsconfig.junction-parity.json', 'tsconfig.json'],
      toolchain: ['package.json', 'package-lock.json', '.nvmrc', '.python-version',
        '.github/workflows/validate.yml'],
      protocol: ['scripts/fix-test-build.mjs', 'scripts/gate-reuse.mjs', 'scripts/check-inputs.mjs'],
    },
    backend: {
      source: ['custom_components/houseplan/websocket_api.py', 'scripts/support-relay/relay.py',
        'scripts/support-relay/hp_relay/app.py', 'scripts/sh3d-convert/convert.mjs', 'scripts/dump-config-schema.py'],
      tests: ['tests_backend/test_ha_websocket.py', 'tests_backend/conftest.py', 'scripts/support-relay/tests/test_relay.py'],
      fixtures: ['scripts/sh3d-convert/golden/two-levels.space-1.json', 'scripts/config-schema.json',
        'test/fixtures/real-plan-first-floor.json'],
      config: ['pyproject.toml', 'pytest.ini', 'scripts/backend-coverage-baseline.txt'],
      toolchain: ['tests_backend/requirements.txt', 'custom_components/houseplan/manifest.json', '.github/workflows/validate.yml'],
      protocol: ['scripts/gate-reuse.mjs', 'scripts/check-inputs.mjs', 'scripts/ci-proof.mjs'],
    },
    smoke: {
      source: ['src/houseplan-card.ts', 'src/logic.ts'],
      tests: ['demo/smoke_infinite_canvas.mjs', 'demo/guard/verify-guard.mjs', 'demo/benchmark_glow.mjs'],
      fixtures: ['demo/fixtures/large-house.mjs', 'demo/fixtures/wall-draw-click.mjs'],
      config: ['rollup.config.mjs', 'tsconfig.json'],
      toolchain: ['package.json', 'package-lock.json', '.github/workflows/validate.yml'],
      protocol: ['demo/serve.mjs', 'demo/srv/demo.html', 'demo/bundle-freshness.mjs',
        'demo/editor-runtime-compat.mjs', 'demo/iso-runtime-compat.mjs', 'scripts/smoke-select.mjs',
        'scripts/ci-proof.mjs'],
    },
    golden: {
      source: ['src/houseplan-card.ts'],
      tests: ['demo/golden/run.mjs', 'demo/golden/matrix.mjs', 'demo/golden/harness.mjs'],
      fixtures: ['demo/golden/baselines/geometry-view-dark-fit.png', 'demo/golden/baselines/baselines-index.json',
        'demo/fixtures/visual-matrix.mjs'],
      config: ['rollup.config.mjs', 'tsconfig.json'],
      toolchain: ['package.json', '.github/workflows/validate.yml'],
      protocol: ['demo/serve.mjs', 'demo/srv/demo.html', 'demo/bundle-freshness.mjs',
        'demo/editor-runtime-compat.mjs', 'scripts/ci-proof.mjs'],
    },
    performance_smoke: {
      source: ['src/houseplan-card.ts'],
      tests: ['demo/benchmark_glow.mjs', 'demo/benchmark_large_house.mjs', 'demo/performance/compare.mjs'],
      fixtures: ['demo/fixtures/large-house.mjs', 'demo/performance/budgets-glow-smoke.json',
        'demo/performance/budgets-isometric-smoke.json', 'demo/performance/budgets-interaction-smoke.json'],
      config: ['rollup.config.mjs'],
      toolchain: ['package.json', '.github/workflows/validate.yml'],
      protocol: ['demo/serve.mjs', 'demo/srv/demo.html', 'demo/editor-runtime-compat.mjs',
        'demo/performance/evaluate.mjs', 'scripts/ci-proof.mjs'],
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

test('#542: каждый динамический cross-runtime input выбирает backend без глобального fallback', () => {
  const cases = [
    [p('src', 'plan-optimizer.ts'), p('tests_backend', 'test_validation.py')],
    [p('src', 'logic.ts'), p('tests_backend', 'test_support_package.py')],
    [p('demo', 'fixtures', 'large-house.mjs'), p('tests_backend', 'test_validation.py')],
    [p('demo', 'fixtures', 'visual-matrix.mjs'), p('tests_backend', 'test_validation.py')],
  ];
  for (const [input, consumer] of cases) {
    assert.ok(MANIFEST.backend.has(consumer), `${consumer}: consumer не входит в backend`);
    assert.ok(MANIFEST.backend.has(input), `${consumer} читает ${input}, но manifest его потерял`);
    const { affected, unknown } = checksAffectedBy([input], ROOT, { manifest: MANIFEST });
    assert.ok(affected.has('backend'), `${input}: backend не выбран`);
    assert.ok(affected.size < CHECK_NAMES.length, `${input}: сработал глобальный fallback вместо точного owner`);
    assert.deepEqual(unknown, [], input);
  }

  const unrelated = p('demo', 'fixtures', 'wall-draw-click.mjs');
  assert.ok(!MANIFEST.backend.has(unrelated), `${unrelated}: точные roots нельзя расширять до всего каталога`);
  assert.ok(!checksAffectedBy([unrelated], ROOT, { manifest: MANIFEST }).affected.has('backend'));
});

test('#671: весь пакет мебели — точный вход frontend, а шрифты исключены явно', () => {
  const furniture = p('assets', 'furniture', 'houseplan-0.4.1', 'svg', 'menu', 'air_conditioner.svg');
  const font = p('assets', 'fonts', 'Roboto-Regular.ttf');
  assert.deepEqual(GUARDED_DATA_ROOTS, ['assets']);
  assert.ok(isGuardedInput(furniture));
  assert.ok(MANIFEST.frontend.has(furniture), `${furniture}: frontend потерял пакет`);
  const { affected, unknown } = checksAffectedBy([furniture], ROOT, { manifest: MANIFEST });
  assert.deepEqual([...affected], ['frontend']);
  assert.deepEqual(unknown, []);
  assert.ok(isDeclaredNotAnInput(font), `${font}: ручной генератор должен быть явным исключением`);
  assert.equal(MANIFEST.frontend.has(font), false);
});

test('#671: новый assets/** без владельца не молчит, а расширяет прогон', () => {
  const orphan = p('assets', 'future-pack', 'new.bin');
  const { affected, unknown } = checksAffectedBy([orphan], ROOT, { manifest: MANIFEST });
  assert.deepEqual(unknown, [orphan]);
  assert.deepEqual([...affected].sort(), [...CHECK_NAMES].sort());

  const synthetic = coverage('/virtual', {
    tracked: [orphan],
    manifest: Object.fromEntries(CHECK_NAMES.map((name) => [name, new Set()])),
  });
  assert.deepEqual(synthetic.unknown, [orphan]);
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
  for (const file of ['src/houseplan-card.ts', 'src/houseplan-editor-runtime.ts',
    'custom_components/houseplan/websocket_api.py']) {
    assert.ok(!MANIFEST.geometry_parity.has(file), `geometry_parity зависит от ${file}`);
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
  // fileURLToPath, не URL.pathname (#496): на Windows pathname даёт «/C:/…», Node ищет C:\C:\… .
  const script = fileURLToPath(new URL('../scripts/check-inputs.mjs', import.meta.url));
  const backend = execFileSync('node', [script, '--check=backend'], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(backend.includes('scripts/support-relay/relay.py'));
  const why = execFileSync('node', [script, '--check=backend', '--why=scripts/sh3d-convert/convert.mjs'], { encoding: 'utf8' });
  assert.match(why, /^scripts\/sh3d-convert\/convert\.mjs\n/);
  assert.match(why, /tests_backend\/test_sh3d_convert\.py/);
  const cov = execFileSync('node', [script, '--coverage'], { encoding: 'utf8' });
  assert.equal(cov.trim(), '');
});
