// Классификация изменённых файлов для job `changes` в validate.yml (#473 AC8).
//
// Шаблоны жили inline в shell-шаге `classify` как `has('regex')`, потом —
// регэкспами здесь (#473). С #492 выбор job идёт из единого manifest входов
// (scripts/check-inputs.mjs): того же, из которого считается ключ реюза.
// Регэкспы остались только у профилей перф-смока — это выбор набора внутри
// job, не самой job. Shell по-прежнему только переписывает вывод функции в
// `$GITHUB_OUTPUT`.
//
// Контракт неизменен: каждый выход — строка 'true'/'false', как её и читают
// условия `if: needs.changes.outputs.X == 'true'`. Fallback «полный прогон
// без классификации» (--all) выставляет все выходы в 'true' — в том числе те,
// что появятся позже: пропущенный ключ в fallback-е означал бы, что job
// с этим условием молча не запускается ровно в тех прогонах, где база
// недоказуема и проверять надо всё.

import { readFileSync } from 'node:fs';
import { isMainModule } from './spawn-portable.mjs';

import { checksAffectedBy } from './check-inputs.mjs';

/**
 * Выходы job `changes` → проверка manifest (#492 §5.2). Job запускается, если
 * дифф задел хотя бы один её вход по `scripts/check-inputs.mjs`; прежние
 * регэкспы по путям заменены тем же источником, из которого считается ключ
 * реюза, — два места больше не расходятся.
 */
export const CHECK_OF_OUTPUT = {
  frontend: 'frontend',
  geometry_parity: 'geometry_parity',
  backend: 'backend',
  integration: 'integration',
  mutants: 'changed_mutants',
};

/**
 * Профили перф-смока (#473 §5): изометрический — при правке изометрии,
 * профиль взаимодействия — при правке живого пути и оркестраторов кадра.
 * Только `src/**`: тесты и демо кадр не замедляют. Это НЕ выбор job, а выбор
 * набора внутри неё, поэтому остаётся фильтром по путям.
 */
export const PERF_PROFILES = {
  perf_iso: /^src\/iso-[^/]+\.ts$/,
  perf_interaction: /^src\/(live-[^/]+|render-[^/]+|houseplan-render-lifecycle|houseplan-card)\.ts$/,
};

/** Совместимость с прежним экспортом: имя выхода → предикат по файлу. */
export const CLASSIFIERS = {
  ...Object.fromEntries(Object.keys(CHECK_OF_OUTPUT).map((name) => [name, null])),
  ...PERF_PROFILES,
};

export const OUTPUTS = [...Object.keys(CHECK_OF_OUTPUT), ...Object.keys(PERF_PROFILES)];

/**
 * Список файлов → выходы job `changes` ('true'/'false' по каждому ключу) плюс
 * `unknown` — неизвестные исполняемые входы, из-за которых прогон расширен
 * до полного набора (§5.2).
 */
export function classifyChanges(files, { root = process.cwd(), manifest } = {}) {
  const list = (Array.isArray(files) ? files : String(files).split('\n'))
    .map((file) => file.trim()).filter(Boolean);
  const { affected, unknown } = checksAffectedBy(list, root, manifest ? { manifest } : {});
  const result = {};
  for (const [name, check] of Object.entries(CHECK_OF_OUTPUT)) {
    result[name] = affected.has(check) ? 'true' : 'false';
  }
  for (const [name, pattern] of Object.entries(PERF_PROFILES)) {
    result[name] = unknown.length || list.some((file) => pattern.test(file)) ? 'true' : 'false';
  }
  result.unknown = unknown;
  return result;
}

/** Fallback без классификации: всё прогоняется. */
export function classifyAll() {
  return { ...Object.fromEntries(OUTPUTS.map((name) => [name, 'true'])), unknown: [] };
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

/**
 * Нужны ли мутанты по диффу (#510, сужено в #601). За 08–09.09 они съели 86 %
 * job-минут Validate, потому что бежали на каждом промежуточном пуше и
 * отменялись следующим. Место мутантов — кандидат ревью и кандидат слияния:
 * оба запускают Validate по кнопке с `mutants=true`; на PR Validate —
 * единственный сигнал, поэтому там тоже. Больше нигде: мутанты проверяют
 * тесты, а не продукт (#513), и к моменту беты каждая задача прогнана ими
 * дважды — на ревью и на слитом после ребейза кандидате. Трейлер `Release:`
 * и `full=true` включают тяжёлые гейты, но не мутантов — иначе ручной полный
 * прогон ради артефакта эталонов и приёмка эталонов с трейлером на ветке
 * задачи платили шестью job впустую (#601). Ночь — полный реестр
 * (mutation-gate.yml), не диффовое подмножество; `schedule` здесь тоже
 * не запрашивает, чтобы будущее расписание Validate не вернуло их молча.
 * CLI по-прежнему передаёт headMessage и fullInput вместе с остальным —
 * функция их не читает, и тест закрепляет, что они НЕ влияют на ответ.
 */
export function mutantsRequested({ eventName, mutantsInput } = {}) {
  if (eventName === 'pull_request') return true;
  if (eventName === 'workflow_dispatch') return String(mutantsInput) === 'true';
  return false;
}

/**
 * Режим гейта свежести скриншотов документации (#479, починен в #586).
 *
 * Значение одно, и считается оно здесь, а не в shell. Прежде preflight сравнивал
 * со строкой `heavy=true` ВЕСЬ вывод `--heavy`, а вывод из двух строк
 * (`heavy=…` и `mutants_requested=…`) в `$(…)` схлопывается в одну через
 * пробел. Сравнение не совпадало никогда: строгий режим не включился ни на
 * одном кандидате, проверка деградировала в предупреждение, а предупреждения
 * в сводке не видно. Так обе беты после `699ab471` уехали с устаревшим
 * индексом кадров.
 *
 * Правило разбора, которое из этого следует: формат `$GITHUB_OUTPUT` —
 * построчный `ключ=значение`, и читать его надо по ключу либо не читать вовсе.
 * Где нужен один ответ — CLI отдаёт один ответ.
 */
export function screenshotsGateMode(inputs) {
  return heavyGatesRequested(inputs) ? 'strict' : 'warn';
}

/** Трейлер `Release: vX.Y.Z` в конце сообщения коммита — признак кандидата. */
export function hasReleaseTrailer(message) {
  return /^Release:\s*v?\d+\.\d+\.\d+\S*\s*$/m.test(String(message || ''));
}

/** Формат `$GITHUB_OUTPUT`; неизвестные входы — отдельной строкой через пробел. */
export function formatOutputs(outputs) {
  const lines = OUTPUTS.map((name) => `${name}=${outputs[name]}`);
  lines.push(`unknown_inputs=${(outputs.unknown || []).join(' ')}`);
  return lines.join('\n') + '\n';
}

// #496: pathToFileURL, не `file://${argv}` — на Windows последнее давало
// `file:///C:/C:/...`, CLI считал себя импортированным и молчал.
const invokedDirectly = isMainModule(import.meta.url);
if (invokedDirectly) {
  if (process.argv.includes('--screenshots-mode')) {
    // #586: один вопрос — один ответ. Разбирать многострочный вывод в shell
    // больше негде и нечем.
    process.stdout.write(`${screenshotsGateMode({
      eventName: process.env.EVENT_NAME,
      headMessage: process.env.HEAD_MESSAGE,
      fullInput: process.env.FULL_INPUT,
    })}\n`);
  } else if (process.argv.includes('--heavy')) {
    // Отдельный вызов: у `heavy` другие входы (событие, сообщение head-коммита),
    // и на dev он нужен даже там, где классификация путей выключена.
    const heavy = heavyGatesRequested({
      eventName: process.env.EVENT_NAME,
      headMessage: process.env.HEAD_MESSAGE,
      fullInput: process.env.FULL_INPUT,
    });
    process.stdout.write(`heavy=${heavy ? 'true' : 'false'}\n`);
    const mutants = mutantsRequested({
      eventName: process.env.EVENT_NAME,
      headMessage: process.env.HEAD_MESSAGE,
      fullInput: process.env.FULL_INPUT,
      mutantsInput: process.env.MUTANTS_INPUT,
    });
    process.stdout.write(`mutants_requested=${mutants ? 'true' : 'false'}\n`);
  } else {
    const all = process.argv.includes('--all');
    const outputs = all ? classifyAll() : classifyChanges(readFileSync(0, 'utf8'));
    process.stdout.write(formatOutputs(outputs));
  }
}
