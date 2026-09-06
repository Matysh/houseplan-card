// Классификация изменённых файлов для job `changes` в validate.yml (#473 AC8).
//
// Шаблоны жили inline в shell-шаге `classify` как `has('regex')`. Пока выходов
// было три, это терпимо; с диффозависимыми профилями перф-смока (#473) их
// пять, и вопрос «запустит ли правка src/iso-x.ts изометрический профиль»
// стал вопросом к workflow, на который нельзя ответить тестом — shell в YAML
// не исполняется локально. Теперь ответ даёт функция, а shell только
// переписывает её вывод в `$GITHUB_OUTPUT`.
//
// Контракт неизменен: каждый выход — строка 'true'/'false', как её и читают
// условия `if: needs.changes.outputs.X == 'true'`. Fallback «полный прогон
// без классификации» (--all) выставляет все выходы в 'true' — в том числе те,
// что появятся позже: пропущенный ключ в fallback-е означал бы, что job
// с этим условием молча не запускается ровно в тех прогонах, где база
// недоказуема и проверять надо всё.

import { readFileSync } from 'node:fs';

export const CLASSIFIERS = {
  frontend: /^(src\/|demo\/|test\/|dist\/|custom_components\/houseplan\/frontend\/|package(-lock)?\.json$|rollup\.config\.mjs$|tsconfig)/,
  backend: /^(custom_components\/.*\.py$|tests_backend\/|scripts\/support-relay\/|pytest\.ini$)/,
  integration: /^(custom_components\/houseplan\/manifest\.json$|hacs\.json$|custom_components\/.*\.py$|custom_components\/.*\/translations\/)/,
  // Перф-смок (#473 §5): изометрический профиль — при правке изометрии,
  // профиль взаимодействия — при правке живого пути и оркестраторов кадра.
  // Только `src/**`: тесты и демо кадр не замедляют.
  perf_iso: /^src\/iso-[^/]+\.ts$/,
  perf_interaction: /^src\/(live-[^/]+|render-[^/]+|houseplan-render-lifecycle|houseplan-card)\.ts$/,
};

export const OUTPUTS = Object.keys(CLASSIFIERS);

/** Список файлов → выходы job `changes` ('true'/'false' по каждому ключу). */
export function classifyChanges(files) {
  const list = (Array.isArray(files) ? files : String(files).split('\n'))
    .map((file) => file.trim()).filter(Boolean);
  const result = {};
  for (const [name, pattern] of Object.entries(CLASSIFIERS)) {
    result[name] = list.some((file) => pattern.test(file)) ? 'true' : 'false';
  }
  return result;
}

/** Fallback без классификации: всё прогоняется. */
export function classifyAll() {
  return Object.fromEntries(OUTPUTS.map((name) => [name, 'true']));
}

/**
 * Нужен ли полный набор тяжёлых job — смоки, golden, performance_smoke (#479).
 *
 * На обычном пуше они не идут: за всё время они не ловили дефект в момент
 * ревью, ловили при подготовке беты, а стоили ~6 минут критического пути на
 * каждую итерацию. Полный набор идёт там, где он и нужен:
 *  - кандидат беты/релиза — head-коммит несёт трейлер `Release:` (класс D
 *    без него и так невалиден, а publish-prerelease требует трейлер явно);
 *  - `workflow_dispatch` с `full=true` — ночной прогон (nightly.yml) и ручной;
 *  - pull_request — там Validate единственный сигнал.
 */
export function heavyGatesRequested({ eventName, headMessage, fullInput } = {}) {
  if (eventName === 'pull_request') return true;
  if (eventName === 'workflow_dispatch') return String(fullInput) === 'true';
  if (eventName === 'schedule') return true;
  return hasReleaseTrailer(headMessage);
}

/** Трейлер `Release: vX.Y.Z` в конце сообщения коммита — признак кандидата. */
export function hasReleaseTrailer(message) {
  return /^Release:\s*v?\d+\.\d+\.\d+\S*\s*$/m.test(String(message || ''));
}

/** Формат `$GITHUB_OUTPUT`. */
export function formatOutputs(outputs) {
  return OUTPUTS.map((name) => `${name}=${outputs[name]}`).join('\n') + '\n';
}

const invokedDirectly = process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  if (process.argv.includes('--heavy')) {
    // Отдельный вызов: у `heavy` другие входы (событие, сообщение head-коммита),
    // и на dev он нужен даже там, где классификация путей выключена.
    const heavy = heavyGatesRequested({
      eventName: process.env.EVENT_NAME,
      headMessage: process.env.HEAD_MESSAGE,
      fullInput: process.env.FULL_INPUT,
    });
    process.stdout.write(`heavy=${heavy ? 'true' : 'false'}\n`);
  } else {
    const all = process.argv.includes('--all');
    const outputs = all ? classifyAll() : classifyChanges(readFileSync(0, 'utf8'));
    process.stdout.write(formatOutputs(outputs));
  }
}
