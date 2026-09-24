// Окружение, которое нужно гардам плана (#620). Чистые функции: команда гарда
// и чтение файлов приходят извне, файловой системы модуль не трогает.
//
// Зачем. `changed_mutants` ставил Python с зависимостями бэкенда и Chromium на
// каждом шарде с непустым планом, хотя план уже знает своих гардов: дифф с
// одними юнит-гардами браузер не открывает, а установка стоит минуты на шард.
//
// Что считается кодом гарда. Не замыкание входов из mutation-selection — оно
// нарочно широкое (пути в строках, данные check-inputs) и отвечает на другой
// вопрос: «что может изменить исход». Здесь вопрос «что исполнится», поэтому
// граф такой: точки входа — файлы из строки гарда, объявленные входы обёрток и
// пути, названные в самих точках входа (тест, запускающий `node scripts/x.mjs`,
// порождает процесс); от каждой точки входа — транзитивные относительные
// импорты (тот же процесс). Файл графа, импортирующий Playwright, требует
// браузер; `.py` в графе или запуск `'python3'`/pytest — Python.
//
// Направление ошибки. Лишняя установка стоит минуты. Недоустановка ложной
// зелени не даёт: чистый прогон гарда без Chromium или pytest падает ДО
// мутантов (`runCleanGuards` → код 2), а гард, пропустивший себя без среды,
// остаётся зелёным и на мутанте — это `survived`, тоже красный. Цена ошибки
// здесь — лишний круг задачи, не пропущенная поломка.
import { posix } from 'node:path';

import { guardNeedsBundle } from './mutation-execution.mjs';
import { guardFiles, wrapperInputs } from './mutation-selection.mjs';

const GUARD_BROWSER_RE = /playwright|chromium/i;
const GUARD_PYTHON_RE = /\bpython3?\b|\bpytest\b/;
/** Импорт Playwright — статический или динамический. */
const SOURCE_BROWSER_RE = /(?:\bfrom\s*|\bimport\s*\(\s*)['"]playwright(?:-core)?['"]/;
/** Запуск Python литералом (`spawnSync('python3', …)`, `'pytest'`, `PYTHON`). */
const SOURCE_PYTHON_RE = /['"`](?:python3?|pytest)['"`]|process\.env\.PYTHON\b/;
/** Относительный импорт: тот же процесс. */
const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)['"](\.{1,2}\/[^'"]+)['"]/gm;
/** Путь-литерал в точке входа: относительный или от корня репозитория. */
const PATH_LITERAL_RE = /['"`]((?:\.{1,2}\/)+[\w./-]+\.(?:mjs|cjs|js|py)|(?:scripts|demo|test|tests_backend)\/[\w./-]+\.(?:mjs|cjs|js|py))['"`]/g;
const isScript = (file) => /\.(?:mjs|cjs|js)$/.test(file);
const isWrapper = (file) => /^scripts\/[\w-]+-guard\.mjs$/.test(file);

function resolveFrom(file, spec) {
  const target = spec.startsWith('.') ? posix.join(posix.dirname(file), spec) : posix.normalize(spec);
  return target.startsWith('..') ? null : target;
}

/**
 * Файлы, чей код исполнится при запуске гарда (см. шапку модуля).
 * @param {string} guard
 * @param {{ read: (file: string) => string, exists: (file: string) => boolean }} io
 * @returns {string[]}
 */
export function guardRuntimeFiles(guard, { read, exists }) {
  const named = guardFiles(guard, exists);
  const explicit = named.some((file) => !isWrapper(file));
  const declared = explicit ? [] : named.filter(isWrapper).flatMap((file) => wrapperInputs(file, read));
  const seen = new Set();
  const queue = [...new Set([...named, ...declared])].filter(exists).map((file) => ({ file, entry: true }));
  while (queue.length) {
    const { file, entry } = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!isScript(file)) continue;
    const text = String(read(file) || '');
    const push = (spec, asEntry) => {
      const target = resolveFrom(file, spec);
      if (target && !seen.has(target) && exists(target)) queue.push({ file: target, entry: asEntry });
    };
    for (const match of text.matchAll(IMPORT_RE)) push(match[1], false);
    if (entry) {
      for (const match of text.matchAll(PATH_LITERAL_RE)) {
        const spec = match[1];
        // Путь от корня разрешается от корня, относительный — от файла.
        push(spec.startsWith('.') ? spec : `./${posix.relative(posix.dirname(file), spec)}`, true);
      }
    }
  }
  return [...seen].sort();
}

/**
 * @param {string} guard команда гарда
 * @param {{ read: (file: string) => string, exists: (file: string) => boolean }} io
 * @returns {{ browser: boolean, python: boolean }}
 */
export function guardEnvironment(guard, io) {
  const text = String(guard || '');
  const files = guardRuntimeFiles(text, io);
  const sources = files.filter(isScript).map((file) => String(io.read(file) || ''));
  return {
    browser: guardNeedsBundle(text) || GUARD_BROWSER_RE.test(text)
      || sources.some((source) => SOURCE_BROWSER_RE.test(source)),
    python: GUARD_PYTHON_RE.test(text) || files.some((file) => file.endsWith('.py'))
      || sources.some((source) => SOURCE_PYTHON_RE.test(source)),
  };
}

/**
 * Окружение шарда — объединение по его гардам. Пустой план не требует ничего.
 * @param {{ guard: string }[]} mutants
 * @param {(guard: string) => { browser: boolean, python: boolean }} environmentOf
 */
export function planEnvironment(mutants, environmentOf) {
  const need = { browser: false, python: false };
  for (const guard of new Set(mutants.map((mutant) => mutant.guard))) {
    const env = environmentOf(guard);
    need.browser ||= Boolean(env.browser);
    need.python ||= Boolean(env.python);
  }
  return need;
}

/** Строки, которые читает шаг плана в validate.yml. Формат менять синхронно. */
export function planEnvironmentLines(need) {
  return [`plan-browser=${need.browser ? 'true' : 'false'}`, `plan-python=${need.python ? 'true' : 'false'}`];
}
