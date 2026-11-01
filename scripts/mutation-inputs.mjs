// Read-only dependency discovery for background mutation witnesses. No task or release gates.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { relativeDependencies, scanJavaScript } from './relative-dependencies.mjs';
const BASELINE_OVERLAY = ['demo/golden/baselines/**'];
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
export const isBaselineOverlay = (file) => matchesAny(file, BASELINE_OVERLAY);

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
const PY_FROM = /^\s*from\s+([\w.]+)\s+import/gm;
const PY_IMPORT = /^\s*import\s+([\w.]+)/gm;
const PY_PATH_JOIN = /((?:"[\w.-]+"\s*\/\s*)+"[\w.-]+")/g;
const REL_EXEC_LITERAL = /['"]((?:\.\.?\/)*[\w.-]+(?:\/[\w.-]+)*\.(?:mjs|py))['"]/g;
const REL_DOC_LITERAL = /['"]((?:\.\.?\/)+[\w.-]+(?:\/[\w.@-]+)*\.md)['"]/gi;

const toPosix = (p) => p.replaceAll('\\', '/');
const BINARY = /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|pdf|zip)$/i;
const DIRECTORY_DOCUMENTATION = /\.md$/i;

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
    return scanJavaScript(text).withoutComments;
  }
  if (file.endsWith('.py')) {
    return text.replace(/\"\"\"[\s\S]*?\"\"\"/g, '').replace(/'''[\s\S]*?'''/g, '').replace(/(^|\s)#[^\n]*/g, '$1');
  }
  return text;
}

export function referencesOf(file, rawText) {
  const js = /\.(mjs|cjs|js|ts)$/.test(file) ? scanJavaScript(rawText) : null;
  const text = js ? js.withoutComments : stripComments(file, rawText);
  const code = new Set();
  const data = new Set();
  const norm = (p) => toPosix(posix.normalize(p));
  if (/\.(mjs|cjs|js|ts)$/.test(file)) {
    for (const spec of relativeDependencies(rawText, js)) resolveJsSpecifier(file, spec).forEach((p) => code.add(norm(p)));
    // Документ внутри названного каталога не является runtime-входом сам по
    // себе. Но точный относительный путь к Markdown в исполняемом коде — это
    // явная зависимость (например, release-gate действительно читает README).
    for (const m of text.matchAll(REL_DOC_LITERAL)) {
      const rel = norm(posix.join(posix.dirname(file), m[1]));
      if (!rel.startsWith('..')) data.add(rel);
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
    // Only real string literals, not quoted fixture source containing another
    // quoted path. Root-relative fixture paths retain their data-only policy.
    for (const literal of js.tokens.filter((token) => token.kind === 'string')) {
      const m = REL_EXEC_LITERAL.exec(JSON.stringify(literal.value));
      REL_EXEC_LITERAL.lastIndex = 0;
      if (!m || m[0].length !== JSON.stringify(literal.value).length) continue;
      if (TOP_RE.test(m[1])) continue; // путь от корня уже разобран выше
      const rel = norm(posix.join(posix.dirname(file), m[1]));
      if (!rel.startsWith('..')) code.add(rel);
    }
  }
  // This module declares paths for all jobs and NOT_AN_INPUT; those strings
  // are graph metadata, not files read by its own callers. Preserve its real
  // imports above, without making manual scripts inputs of every reuse job.
  if (file === 'scripts/mutation-inputs.mjs') return { code: [...code], data: [] };
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
// The mutation registry contains patch snippets that look like imports and
// file paths but are data, not executable dependencies. Runner modules are
// ordinary source and must participate in closure discovery.
export const LEAF_FILES = new Set(['scripts/mutation-registry.mjs']);

export function closure(root, entries, { tracked = trackedFiles(root), stopAt = () => false, read, parents, references } = {}) {
  const trackedSet = new Set(tracked);
  const readText = read || ((rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs) || statSync(abs).isDirectory()) return '';
    return readFileSync(abs, 'utf8');
  });
  const isDir = (rel) => tracked.some((f) => f.startsWith(`${rel}/`));
  const seen = new Set();
  const traversed = new Set(); // included as data ≠ dependencies already read
  const note = (child, parent) => { if (parents && !parents.has(child)) parents.set(child, parent); };
  const queue = [...entries].filter((e) => trackedSet.has(e));
  for (const e of queue) note(e, null);
  while (queue.length) {
    const file = queue.shift();
    if (traversed.has(file)) continue;
    seen.add(file);
    traversed.add(file);
    if (stopAt(file) || LEAF_FILES.has(file)) continue;
    if (!/\.(mjs|cjs|js|ts|py)$/.test(file)) continue;
    let refs = references?.get(file);
    if (!refs) {
      let text;
      try { text = readText(file); } catch { continue; }
      refs = referencesOf(file, text);
      references?.set(file, refs);
    }
    const { code, data } = refs;
    for (const ref of code) {
      if (trackedSet.has(ref)) { note(ref, file); if (!traversed.has(ref)) queue.push(ref); }
    }
    for (const ref of data) {
      if (trackedSet.has(ref)) { note(ref, file); seen.add(ref); continue; }
      // Каталог по строке — данные. Бинарные файлы и документация под ним код
      // по одной строке-каталогу не читает; точный Markdown-путь выше остаётся
      // честной зависимостью. Overlay эталонов принадлежит только golden (#573).
      if (isDir(ref)) {
        for (const f of tracked) {
          if (f.startsWith(`${ref}/`) && !BINARY.test(f) && !DIRECTORY_DOCUMENTATION.test(f) && !isBaselineOverlay(f)) { note(f, file); seen.add(f); }
        }
      }
    }
  }
  return [...seen].sort();
}
