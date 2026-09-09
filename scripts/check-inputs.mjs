// Единый manifest входов проверок Validate (#492 §5).
//
// Одна проверка (job) — один ответ на вопрос «от каких файлов зависит её
// результат». Раньше ответов было три и они расходились: регэкспы job
// `changes` (что запускать), `HARNESS` в gate-reuse (что хешировать) и молчание
// там, где файл не попал ни туда, ни туда — relay, converter, schema,
// `serve.mjs`, `demo.html`. Здесь ответ один и по возможности ВЫЧИСЛЯЕТСЯ,
// а не перечисляется: у проверки есть точки входа (тесты, скрипты job), и
// всё, что они импортируют или читают по пути, — её вход. Явные корни
// остаются для того, что читается не из кода: бандл собирается из `src/**`,
// pytest обходит `tests_backend/**`, unittest — `scripts/support-relay/tests`.
//
// Из manifest выводятся обе прежние вещи: классификация (`classify-changes`:
// job запускается, если дифф задел хотя бы один её вход) и ключ реюза
// (`gate-reuse`: хеш содержимого всех входов). Неизвестный исполняемый вход —
// файл, который ни одна проверка не считает своим, — расширяет прогон до
// полного набора (§5.2): «не знаю» не равно «не влияет».
//
// Лист покрытия (§5.5, test/check-inputs.test.mjs): каждый отслеживаемый
// исполняемый файл обязан входить в manifest хотя бы одной проверки либо в
// NOT_AN_INPUT с причиной. Новый скрипт без записи — красный тест, не тихое
// расширение прогонов навсегда.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';

/** Корни, внутри которых файл считается исполняемым входом (§5.2). */
export const EXECUTABLE_ROOTS = ['scripts', 'demo', 'test', 'tests_backend', '.github', 'custom_components', 'src'];
export const EXECUTABLE_EXT = /\.(mjs|cjs|js|ts|py|json|ya?ml|html|toml|txt|sh)$/;

/** Копии бандла и результаты сборки: класс D, входом не являются. */
export const BUILD_OUTPUT = [
  'dist/**', 'custom_components/houseplan/frontend/**', 'demo/srv/assets/**',
];

/**
 * Не входы Validate — с причиной. Каждая запись отвечает на вопрос «кто это
 * исполняет и почему не Validate».
 */
export const NOT_AN_INPUT = [
  ['demo/stand/**', 'seed демо-стенда: ставится на стенде, Validate не исполняет'],
  ['demo/shot_*.mjs', 'ручные съёмки для документации и разбора, не гейты'],
  ['demo/capture_*.mjs', 'ручные съёмки эталонов, запускаются человеком'],
  ['demo/helpers/ha-dialog-assets.mjs', 'пиновые HA assets только для явной диагностической съёмки #505; не запускают загрузку в Validate'],
  ['demo/helpers/ha-dialog-fixture.mjs', 'изолированный настоящий ha-dialog только для явной визуальной приёмки #505, не обычный smoke'],
  ['demo/screencast_visual_continuity.mjs', 'ручной скринкаст'],
  ['demo/gen_icons.mjs', 'генератор иконок демо-страницы, запускается вручную; результат в demo/srv/assets (класс D)'],
  ['demo/downgrade_open_passage.mjs', 'ручной инструмент миграции фикстур'],
  ['scripts/dev/**', 'локальные утилиты разработчика'],
  ['scripts/install-hooks.mjs', 'установка git-хуков при npm ci'],
  ['scripts/pre-push-gate.mjs', 'локальный pre-push набор (HP_PREPUSH_GATE), в CI не исполняется'],
  ['scripts/golden-accept.mjs', 'приёмка эталонов человеком, после прогона (#344)'],
  ['scripts/golden-container.mjs', 'локальная съёмка в пиновом образе (#334), ручной запуск'],
  ['scripts/inventory.mjs', 'отчёт для аудита, не гейт'],
  ['scripts/benchmark-wall-segment-model.mjs', 'ручной бенчмарк (npm run benchmark:wall-model)'],
  ['scripts/wall-strip-containment.mjs', 'ручной гейт внешних бэкапов планов (docs/WALL-THICKNESS.md)'],
  ['scripts/sh3d-convert/cli.mjs', 'CLI конвертера для человека'],
  ['scripts/sh3d-convert/make-fixtures.mjs', 'генератор фикстур конвертера, ручной'],
  ['scripts/support-relay/deploy/**', 'деплой relay на стенд'],
  ['scripts/wsl-setup.sh', 'установка локального Linux/WSL-контура с пинами CI (#496), ручной запуск'],
  ['.github/workflows/*.yml', 'другие workflow: у каждого свой запуск; validate.yml — вход toolchain всех проверок, объявлен явно'],
  ['.github/ISSUE_TEMPLATE/**', 'шаблоны issue GitHub, не исполняются'],
  ['.githooks/**', 'локальные хуки'],
];

// ---------------------------------------------------------------------------
// glob → regexp: `**` — любой путь, `*` — сегмент без «/», остальное буквально.
export const globToRegExp = (glob) => {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 1;
        if (glob[i + 1] === '/') i += 1;
      } else re += '[^/]*';
    } else if ('.+?^${}()|[]\\'.includes(ch)) re += `\\${ch}`;
    else re += ch;
  }
  return new RegExp(`^${re}$`);
};
const matchesAny = (file, globs) => globs.some((glob) => globToRegExp(glob).test(file));

/** Отслеживаемые файлы (git), либо обход дерева там, где git недоступен. */
export function trackedFiles(root) {
  try {
    // stderr глушится (#496): на синтетических деревьях тестов git отвечает
    // «fatal: not a git repository», и без этого каждый вызов печатал его в лог,
    // хотя отказ штатно ловится ниже и дерево обходится вручную.
    const out = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const files = out.split('\0').filter(Boolean);
    if (files.length) return files.sort();
  } catch { /* не git — обходим дерево */ }
  const walk = (dir) => readdirSync(dir).sort().flatMap((name) => {
    if (name === 'node_modules' || name === '.git') return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [relative(root, path).replaceAll('\\', '/')];
  });
  return walk(root);
}

// ---------------------------------------------------------------------------
// Ссылки из файла: импорты и строковые пути. Чтение, не исполнение.

const TOP = '(?:scripts|demo|docs|src|custom_components|tests_backend|test|\\.github)';
const PATH_LITERAL = new RegExp(`['"\`](${TOP}/[\\w./@-]+)['"\`]`, 'g');
const TOP_RE = new RegExp(`^${TOP}/`);
const ROOT_FILE_LITERAL = /['"`](package\.json|package-lock\.json|hacs\.json|PROCESS\.md|README\.md|README\.ru\.md|pyproject\.toml|pytest\.ini|rollup\.config\.mjs|tsconfig[\w.]*\.json)['"`]/g;
const JS_IMPORT = /(?:^|[^\w$])(?:import|export)\s*(?:[^'"`;]*?\s+from\s*)?['"](\.\.?\/[^'"]+)['"]/g;
const JS_DYNAMIC = /import\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;
const JS_REQUIRE = /require\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;
const PY_FROM = /^\s*from\s+([\w.]+)\s+import/gm;
const PY_IMPORT = /^\s*import\s+([\w.]+)/gm;
const PY_PATH_JOIN = /((?:"[\w.-]+"\s*\/\s*)+"[\w.-]+")/g;
const REL_EXEC_LITERAL = /['"]((?:\.\.?\/)*[\w.-]+(?:\/[\w.-]+)*\.(?:mjs|py))['"]/g;

const toPosix = (p) => p.replaceAll('\\', '/');
const BINARY = /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|pdf|zip)$/i;

/** `test-build/foo.js` — скомпилированный `src/foo.ts` (tsconfig.test.json). */
const mapTestBuild = (rel) => {
  const m = /^test-build\/(.+)\.js$/.exec(rel);
  return m ? `src/${m[1]}.ts` : rel;
};

function resolveJsSpecifier(fromFile, spec) {
  const base = toPosix(posix.normalize(posix.join(posix.dirname(fromFile), spec)));
  // с расширением — ровно этот файл; без — обычные кандидаты Node/TS
  const candidates = /\.(mjs|cjs|js|ts|json)$/.test(base)
    ? [base] : [`${base}.mjs`, `${base}.js`, `${base}.ts`, `${base}/index.mjs`, `${base}/index.js`];
  return candidates.map(mapTestBuild);
}

function pyModuleCandidates(fromFile, mod) {
  const parts = mod.split('.');
  const out = [];
  const asPath = parts.join('/');
  out.push(`${asPath}.py`, `${asPath}/__init__.py`);
  // относительно каталога файла (support-relay: `from hp_relay import …`)
  const dir = posix.dirname(fromFile);
  out.push(`${dir}/${asPath}.py`, `${dir}/${asPath}/__init__.py`);
  // пакет тестов relay лежит на уровень выше своих тестов
  out.push(`${posix.dirname(dir)}/${asPath}.py`, `${posix.dirname(dir)}/${asPath}/__init__.py`);
  return out;
}

const EXEC_LITERAL = new RegExp(`(?:node|python3?|tsx)\\s+((?:scripts|demo|tests_backend)/[\\w./-]+\\.(?:mjs|py))`, 'g');

/**
 * Ссылки одного файла: `code` — импорты и запускаемые процессом файлы (по ним
 * идёт обход), `data` — строковые пути к файлам и каталогам (листья).
 */
/** Комментарии и docstring'и — не ссылки: путь в пояснении не делает файл входом. */
export function stripComments(file, text) {
  if (/\.(mjs|cjs|js|ts)$/.test(file)) {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  }
  if (file.endsWith('.py')) {
    return text.replace(/\"\"\"[\s\S]*?\"\"\"/g, '').replace(/'''[\s\S]*?'''/g, '').replace(/(^|\s)#[^\n]*/g, '$1');
  }
  return text;
}

export function referencesOf(file, rawText) {
  const text = stripComments(file, rawText);
  const code = new Set();
  const data = new Set();
  const norm = (p) => toPosix(posix.normalize(p));
  if (/\.(mjs|cjs|js|ts)$/.test(file)) {
    for (const re of [JS_IMPORT, JS_DYNAMIC, JS_REQUIRE]) {
      for (const m of text.matchAll(re)) resolveJsSpecifier(file, m[1]).forEach((p) => code.add(norm(p)));
    }
  }
  if (file.endsWith('.py')) {
    // pytest подхватывает conftest.py каталога без импорта — это код теста
    if (/^tests_backend\/test_[\w-]+\.py$/.test(file)) code.add('tests_backend/conftest.py');
    for (const m of text.matchAll(PY_FROM)) pyModuleCandidates(file, m[1]).forEach((p) => code.add(norm(p)));
    for (const m of text.matchAll(PY_IMPORT)) pyModuleCandidates(file, m[1]).forEach((p) => code.add(norm(p)));
    for (const m of text.matchAll(PY_PATH_JOIN)) {
      data.add(norm(m[1].split('/').map((s) => s.trim().replace(/^"|"$/g, '')).join('/')));
    }
  }
  // Файл под исполняемым корнем — код только там, где он запускается
  // процессом (строка со spawn/exec/sh(/run(), а не в подсказке человеку.
  for (const line of text.split('\n')) {
    if (!/\b(spawn|spawnSync|exec|execSync|execFileSync|sh|run)\s*\(/.test(line)) continue;
    for (const m of line.matchAll(EXEC_LITERAL)) code.add(norm(m[1]));
    for (const m of line.matchAll(PATH_LITERAL)) if (/\.(mjs|py)$/.test(m[1])) code.add(norm(m[1]));
  }
  for (const m of text.matchAll(PATH_LITERAL)) data.add(norm(m[1].replace(/[.:,;]+$/, '')));
  for (const m of text.matchAll(ROOT_FILE_LITERAL)) data.add(m[1]);
  // Относительный путь к исполняемому файлу рядом (`'guard_x.mjs'`,
  // `'../benchmark_x.mjs'` у verify-guard) — код, если такой файл есть в дереве.
  if (/\.(mjs|cjs|js|ts)$/.test(file)) {
    for (const m of text.matchAll(REL_EXEC_LITERAL)) {
      if (TOP_RE.test(m[1])) continue; // путь от корня уже разобран выше
      const rel = norm(posix.join(posix.dirname(file), m[1]));
      if (!rel.startsWith('..')) code.add(rel);
    }
  }
  for (const c of code) data.delete(c);
  return { code: [...code], data: [...data] };
}

/**
 * Транзитивное замыкание от точек входа по ссылкам внутри репозитория.
 *
 * Правила обхода (§6.2): импорты кода идут транзитивно; строковый путь —
 * ДАННЫЕ, лист замыкания: по нему дальше не идут, даже если это .mjs, кроме
 * случая, когда файл под исполняемым корнем запускается как процесс
 * (`node demo/benchmark_*.mjs`, `python scripts/x.py`) — тогда он код.
 * Ссылка на каталог раскрывается во все отслеживаемые файлы под ним как в
 * данные. `parents` хранит, откуда файл пришёл, — для объяснения «почему это
 * вход» (`--why`).
 */
/**
 * Файлы, чьи ссылки не читаются: реестр мутантов называет в гардах и патчах
 * сотни путей, но для того, кто его импортирует (тесты реестра), это данные,
 * а не зависимости — иначе одна правка любого теста отбирала бы весь реестр.
 */
export const LEAF_FILES = new Set(['scripts/mutation-gate.mjs']);

export function closure(root, entries, { tracked = trackedFiles(root), stopAt = () => false, read, parents } = {}) {
  const trackedSet = new Set(tracked);
  const readText = read || ((rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs) || statSync(abs).isDirectory()) return '';
    return readFileSync(abs, 'utf8');
  });
  const isDir = (rel) => tracked.some((f) => f.startsWith(`${rel}/`));
  const seen = new Set();
  const note = (child, parent) => { if (parents && !parents.has(child)) parents.set(child, parent); };
  const queue = [...entries].filter((e) => trackedSet.has(e));
  for (const e of queue) note(e, null);
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    if (stopAt(file) || LEAF_FILES.has(file)) continue;
    if (!/\.(mjs|cjs|js|ts|py)$/.test(file)) continue;
    let text;
    try { text = readText(file); } catch { continue; }
    const { code, data } = referencesOf(file, text);
    for (const ref of code) {
      if (trackedSet.has(ref)) { note(ref, file); if (!seen.has(ref)) queue.push(ref); }
    }
    for (const ref of data) {
      if (trackedSet.has(ref)) { note(ref, file); seen.add(ref); continue; }
      // каталог по строке — данные; бинарные файлы под ним код по строке не
      // читает (эталоны golden входят в свою проверку явным корнем)
      if (isDir(ref)) for (const f of tracked) if (f.startsWith(`${ref}/`) && !BINARY.test(f)) { note(f, file); seen.add(f); }
    }
  }
  return [...seen].sort();
}

// ---------------------------------------------------------------------------
// Проверки Validate и их входы.

/** Что собирает бандл: те же входы, что у sourceFingerprint (#245). */
const BUILD_INPUTS = ['src/**', 'package.json', 'package-lock.json', 'rollup.config.mjs', 'tsconfig.json',
  'scripts/source-fingerprint.mjs', 'scripts/css-template-minifier.mjs', 'scripts/bundle-manifest.mjs',
  'scripts/bundle-sync.mjs', 'scripts/bundle-tree.mjs'];
/** Протокол браузерного харнеса: страница, сервер, гард исключений, compat-хелперы. */
const BROWSER_PROTOCOL = ['demo/serve.mjs', 'demo/srv/demo.html', 'demo/bundle-freshness.mjs',
  'demo/editor-runtime-compat.mjs', 'demo/iso-runtime-compat.mjs', 'demo/guard/**'];
const WORKFLOW = ['.github/workflows/validate.yml'];
/** Протокол реюза: кто считает ключ, тот и вход (§5.1 protocol). */
const REUSE_PROTOCOL = ['scripts/gate-reuse.mjs', 'scripts/check-inputs.mjs'];

export const CHECKS = {
  preflight: {
    // документация, провенанс, процесс — всегда запускается; реюза нет
    entries: ['scripts/check-docs.mjs', 'scripts/process-gate.mjs', 'scripts/validate-commit-provenance.mjs',
      'scripts/classify-base.mjs', 'scripts/classify-changes.mjs', 'scripts/check-inputs.mjs',
      'scripts/docs-freshness.mjs', 'scripts/review-doc-guard.mjs'],
    roots: ['docs/**', 'README.md', 'README.ru.md', 'PROCESS.md', 'AGENTS.md', 'CONTRIBUTING.md', ...WORKFLOW],
  },
  frontend: {
    // npm run typecheck, npm test, npm run build, bundle:budget
    entries: ['test/*.test.mjs', 'scripts/no-new-any.mjs', 'scripts/bundle-budget.mjs', 'scripts/fix-test-build.mjs'],
    roots: [...BUILD_INPUTS, 'test/**', 'tsconfig*.json', ...WORKFLOW],
  },
  changed_mutants: {
    entries: ['scripts/mutation-gate.mjs', 'scripts/*-guard.mjs', 'test/*.test.mjs', 'demo/smoke_*.mjs', 'tests_backend/**/*.py'],
    roots: [...BUILD_INPUTS, 'custom_components/**/*.py', ...BROWSER_PROTOCOL, ...WORKFLOW],
  },
  integration: {
    entries: [],
    roots: ['custom_components/houseplan/manifest.json', 'hacs.json', 'custom_components/**/*.py',
      'custom_components/**/translations/**', 'custom_components/**/strings.json', ...WORKFLOW],
  },
  smoke: {
    entries: ['demo/smoke_*.mjs', 'demo/guard/verify-guard.mjs', 'scripts/smoke-select.mjs', 'demo/benchmark_*.mjs'],
    roots: [...BUILD_INPUTS, ...BROWSER_PROTOCOL, ...REUSE_PROTOCOL, ...WORKFLOW],
    reuse: true,
  },
  golden: {
    entries: ['demo/golden/run.mjs'],
    roots: [...BUILD_INPUTS, 'demo/golden/**', ...BROWSER_PROTOCOL, ...REUSE_PROTOCOL, ...WORKFLOW],
    reuse: true,
  },
  performance_smoke: {
    entries: ['demo/benchmark_glow.mjs', 'demo/benchmark_large_house.mjs', 'demo/benchmark_junction_limits.mjs',
      'demo/benchmark_wall_draw_click.mjs', 'demo/performance/compare.mjs'],
    roots: [...BUILD_INPUTS, 'demo/performance/**', ...BROWSER_PROTOCOL, ...REUSE_PROTOCOL, ...WORKFLOW],
    reuse: true,
  },
  backend: {
    // pytest tests_backend, unittest scripts/support-relay/tests, ruff/mypy, порог покрытия
    entries: ['tests_backend/**/*.py', 'scripts/support-relay/tests/**/*.py', 'scripts/dump-config-schema.py'],
    // manifest.json несёт версию: кандидат релиза обязан прогнать backend заново
    roots: ['custom_components/**/*.py', 'custom_components/houseplan/manifest.json', 'scripts/support-relay/**/*.py',
      'tests_backend/**', 'pyproject.toml', 'pytest.ini', 'scripts/backend-coverage-baseline.txt',
      'scripts/config-schema.json', ...REUSE_PROTOCOL, ...WORKFLOW],
    reuse: true,
  },
};

export const CHECK_NAMES = Object.keys(CHECKS);
export const REUSE_JOBS = CHECK_NAMES.filter((name) => CHECKS[name].reuse);

const expandGlobs = (globs, tracked) => tracked.filter((f) => matchesAny(f, globs));
const isBuildOutput = (f) => matchesAny(f, BUILD_OUTPUT);

/** Развёрнутый список входов проверки: корни ∪ замыкание точек входа. */
export function inputsOf(check, root = process.cwd(), { tracked = trackedFiles(root), read } = {}) {
  const spec = CHECKS[check];
  if (!spec) throw new Error(`неизвестная проверка: ${check}. Известны: ${CHECK_NAMES.join(', ')}`);
  const roots = expandGlobs(spec.roots, tracked);
  const entries = expandGlobs(spec.entries, tracked);
  const reached = closure(root, entries, { tracked, read, stopAt: isBuildOutput });
  return [...new Set([...roots, ...reached])].filter((f) => !isBuildOutput(f)).sort();
}

/** Все проверки со входами — один обход на прогон. */
export function manifest(root = process.cwd(), options = {}) {
  const tracked = options.tracked || trackedFiles(root);
  const out = {};
  for (const name of CHECK_NAMES) out[name] = new Set(inputsOf(name, root, { ...options, tracked }));
  return out;
}

/** Исполняемый вход по критерию §5.2 — то, что обязано быть чьим-то. */
export const isExecutableInput = (file) => EXECUTABLE_ROOTS.some((r) => file === r || file.startsWith(`${r}/`))
  && EXECUTABLE_EXT.test(file) && !isBuildOutput(file);

export const isDeclaredNotAnInput = (file) => NOT_AN_INPUT.some(([glob]) => globToRegExp(glob).test(file));

/**
 * Проверки, задетые списком файлов, и неизвестные входы среди них.
 * Неизвестный исполняемый вход расширяет до всех проверок (§5.2).
 */
export function checksAffectedBy(files, root = process.cwd(), options = {}) {
  const man = options.manifest || manifest(root, options);
  const affected = new Set();
  const unknown = [];
  for (const file of files) {
    let known = false;
    for (const name of CHECK_NAMES) if (man[name].has(file)) { affected.add(name); known = true; }
    if (!known && isExecutableInput(file) && !isDeclaredNotAnInput(file)) unknown.push(file);
  }
  if (unknown.length) for (const name of CHECK_NAMES) affected.add(name);
  return { affected, unknown };
}

/** Лист покрытия (§5.5): исполняемые файлы, которые никто не считает своими. */
export function coverage(root = process.cwd(), options = {}) {
  const tracked = options.tracked || trackedFiles(root);
  const man = options.manifest || manifest(root, { ...options, tracked });
  const covered = new Set();
  for (const name of CHECK_NAMES) for (const f of man[name]) covered.add(f);
  const unknown = tracked.filter((f) => isExecutableInput(f) && !covered.has(f) && !isDeclaredNotAnInput(f));
  // запись NOT_AN_INPUT лишняя, если ВСЕ её файлы и так чьи-то входы
  const declaredButCovered = NOT_AN_INPUT.map(([glob]) => glob).filter((glob) => {
    const hits = tracked.filter((f) => globToRegExp(glob).test(f));
    return hits.length > 0 && hits.every((f) => covered.has(f));
  });
  return { covered, unknown, declaredButCovered };
}

// ---------------------------------------------------------------------------
// CLI: `node scripts/check-inputs.mjs --check=backend` печатает входы;
//      `--coverage` — лист покрытия; `--affected` читает список файлов из stdin.
const invokedDirectly = isMainModule(import.meta.url); // #496: переносимо для Windows
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const checkArg = argv.find((a) => a.startsWith('--check='))?.slice(8);
  const whyArg = argv.find((a) => a.startsWith('--why='))?.slice(6);
  if (checkArg && whyArg) {
    const parents = new Map();
    const tracked = trackedFiles(root);
    const spec = CHECKS[checkArg];
    closure(root, expandGlobs(spec.entries, tracked), { tracked, stopAt: isBuildOutput, parents });
    let cur = whyArg;
    if (!parents.has(cur)) { console.log(matchesAny(cur, spec.roots) ? `${cur}: корень manifest` : `${cur}: не вход ${checkArg}`); process.exit(0); }
    while (cur) { console.log(cur); cur = parents.get(cur); }
  } else if (checkArg) {
    for (const f of inputsOf(checkArg, root)) console.log(f);
  } else if (argv.includes('--coverage')) {
    const { unknown, declaredButCovered } = coverage(root);
    for (const f of unknown) console.log(`неизвестный вход: ${f}`);
    for (const g of declaredButCovered) console.log(`NOT_AN_INPUT лишний (уже покрыт): ${g}`);
    process.exit(unknown.length ? 1 : 0);
  } else if (argv.includes('--affected')) {
    const files = readFileSync(0, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
    const { affected, unknown } = checksAffectedBy(files, root);
    console.log(JSON.stringify({ affected: [...affected].sort(), unknown }, null, 2));
  } else {
    console.error('usage: check-inputs.mjs --check=<name> | --coverage | --affected < files');
    process.exit(2);
  }
}
