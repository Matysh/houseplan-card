// Diff/guard input selection. Caches are caller-owned and therefore cannot
// leak across source trees or separate CLI invocations.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { closure, trackedFiles } from './check-inputs.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
export const MUTATION_REGISTRY_FILES = ['scripts/mutation-registry.mjs'];
export const LEGACY_MUTATION_REGISTRY_FILE = 'scripts/mutation-gate.mjs';

/**
 * Мутанты, чьи патч-файлы задеты диффом (#332). Дифф-режим — для локальной
 * проверки и ревью-циклов; полный набор идёт ночным расписанием (#513),
 * поэтому пустая выборка — честный успех с явным сообщением, а не ошибка.
 */
/**
 * Файлы, на которые ссылается команда гарда (#475).
 *
 * Без парсинга команды: берутся токены с суффиксом `.mjs`, `.test.mjs` или
 * `.py`, которые существуют в репозитории. Флаги (`--test-name-pattern=…`),
 * шаблоны и произвольные слова файлами не считаются. Фикстуры гардов
 * (`test/fixtures/*`, `tests_backend/fixtures/*`) по команде вывести нельзя —
 * это граница: их дрейф остаётся полному прогону.
 */
export function guardFiles(guard, exists = (file) => existsSync(join(repoRoot, file))) {
  const files = new Set();
  for (const token of String(guard || '').split(/\s+/)) {
    const bare = token.replace(/^["']|["']$/g, '');
    // Путь, а не обрывок шаблона: только [A-Za-z0-9_./-], без кавычек,
    // «|» и флагов. `--test-name-pattern="a|b.mjs"` даёт токен `b.mjs"` —
    // он не файл, даже если бы такой существовал.
    if (!/^[\w./-]+\.(mjs|py)$/.test(bare) || bare.startsWith('-')) continue;
    if (exists(bare)) files.add(bare);
  }
  return [...files];
}

/**
 * Обёртки гардов объявляют, что запускают (#492 §6.1): `export const
 * GUARD_INPUTS = [...]` читается статически, без исполнения — обёртка при
 * импорте сразу бежит и падает на usage. Файл гарда без объявления не
 * считается обёрткой: его входы — только импорты и пути (§6.2).
 */
const GUARD_INPUTS_RE = /export const GUARD_INPUTS = \[([^\]]*)\]/;
export function wrapperInputs(file, read = (f) => (existsSync(join(repoRoot, f)) ? readFileSync(join(repoRoot, f), 'utf8') : '')) {
  if (!/^scripts\/[\w-]+-guard\.mjs$/.test(file)) return [];
  const m = GUARD_INPUTS_RE.exec(String(read(file)));
  if (!m) return [];
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
}

/** Сторона патча остаётся точечной (#492 §6.4): замыкание в `src/**` не идёт. */
const GUARD_CLOSURE_STOP = (file) => file.startsWith('src/') || file.startsWith('custom_components/houseplan/frontend/');

/**
 * Все входы гарда (#492 §6): файлы из строки команды ∪ объявленные входы
 * обёрток ∪ транзитивное замыкание по импортам и путям — смок тянет
 * `serve.mjs` и фикстуры, pytest-модуль — `conftest.py`, обёртка — свои
 * тесты. `src/**` исключён: это сторона патча, не гарда.
 */
export function guardInputs(guard, {
  exists = (file) => existsSync(join(repoRoot, file)),
  read,
  files = trackedFiles(repoRoot),
} = {}) {
  const named = guardFiles(guard, exists);
  // Объявленное умолчание обёртки действует, когда гард не назвал файл сам:
  // третий аргумент backend-test-guard уже стоит в строке и отбирается оттуда.
  const isWrapper = (file) => /^scripts\/[\w-]+-guard\.mjs$/.test(file);
  const wrappers = named.filter(isWrapper);
  const explicit = named.some((file) => !isWrapper(file));
  const declared = explicit ? [] : wrappers.flatMap((file) => wrapperInputs(file, read));
  // Сама обёртка — вход (её текст в отпечатке), но её ссылки не читаются:
  // умолчание уже учтено выше, а перечитывать его из текста значило бы
  // отменять явный аргумент.
  const entries = [...new Set([...named, ...declared])].filter(exists);
  const reached = closure(repoRoot, entries.filter((file) => !wrappers.includes(file)),
    { tracked: files, read, stopAt: GUARD_CLOSURE_STOP });
  return [...new Set([...entries, ...reached])]
    .filter((file) => !GUARD_CLOSURE_STOP(file))
    .sort();
}

/**
 * Invocation-scoped resolver for the expensive guard dependency closure.
 *
 * The resolver owns its Map; constructing a new resolver is the cache reset
 * when the source tree, tracked-file inventory or read strategy changes.
 */
export function createGuardInputResolver(options = {}) {
  const cache = new Map();
  // Take the tracked-file snapshot once per resolver. A new invocation (or a
  // caller examining another tree) constructs a new resolver and therefore a
  // fresh snapshot; no module-global result can leak across source material.
  const invocationOptions = {
    ...options,
    files: options.files ?? trackedFiles(repoRoot),
  };
  let requests = 0;
  let computations = 0;
  const resolve = (guard) => {
    requests++;
    if (cache.has(guard)) return cache.get(guard);
    computations++;
    const inputs = guardInputs(guard, invocationOptions);
    cache.set(guard, inputs);
    return inputs;
  };
  resolve.stats = () => ({
    requests,
    computations,
    hits: requests - computations,
    uniqueGuards: cache.size,
  });
  return resolve;
}

/**
 * Радиус области якоря (#518): сколько строк вокруг патча считается «его
 * кодом». Хост-файлы карты — тринадцать тысяч строк, и правка в одном их
 * конце перегоняла свидетелей из другого: на #500 двенадцать изменённых строк
 * `houseplan-editor-runtime.ts` тянули 53 мутанта из 75. Сорок строк — то
 * расстояние, на котором правка ещё почти всегда трогает тот же код; дальше
 * начинается чужой, и его перебирает ночной полный гейт (#513).
 */
export const ANCHOR_RADIUS_LINES = 40;

/**
 * Строки области якоря, 1-based включительно, или `null` — когда `find`
 * встречается в файле не ровно один раз. `null` значит «судить по файлу
 * целиком»: реестр, отставший от кода, обязан отвечать консервативно, а не
 * сужать проверку (эту же однократность требуют `--check` и `applyPatches`).
 */
export function anchorSpan(source, find, radius = ANCHOR_RADIUS_LINES) {
  const text = String(source ?? '');
  if (!find || text.split(find).length - 1 !== 1) return null;
  const start = text.indexOf(find);
  const before = text.slice(0, start).split('\n').length; // 1-based строка начала
  const inside = String(find).split('\n').length - 1;
  const lines = text.split('\n').length;
  return {
    from: Math.max(1, before - radius),
    to: Math.min(lines, before + inside + radius),
  };
}

/** Текст области якоря (или весь файл, если якорь не однозначен). */
export function anchorRegion(source, find, radius = ANCHOR_RADIUS_LINES) {
  const text = String(source ?? '');
  const span = anchorSpan(text, find, radius);
  if (!span) return text;
  return text.split('\n').slice(span.from - 1, span.to).join('\n');
}

/**
 * Изменённые области по файлам из `git diff --unified=0` — стороны ГОЛОВЫ
 * (`+`), потому что якоря ищутся в рабочем дереве. Чистое удаление даёт
 * нулевую длину `+c,0`: считаем задетыми строки вокруг стыка, иначе вырезанный
 * кусок кода не задел бы никого.
 */
export function parseDiffRanges(diffText) {
  const ranges = new Map();
  let file = null;
  for (const line of String(diffText ?? '').split('\n')) {
    const head = /^\+\+\+ (?:b\/)?(.+)$/.exec(line);
    if (head) { file = head[1] === '/dev/null' ? null : head[1]; continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || !file) continue;
    const from = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const list = ranges.get(file) ?? [];
    list.push(count === 0 ? [from, from + 1] : [from, from + count - 1]);
    ranges.set(file, list);
  }
  return ranges;
}

const spansOverlap = (span, [from, to]) => from <= span.to && to >= span.from;

/**
 * Задел ли дифф область якоря патча (#518). `ranges` — карта из
 * `parseDiffRanges`; её отсутствие означает прежний ответ по файлу целиком.
 */
export function patchTouched(patch, ranges, read) {
  if (!ranges) return true;
  const hunks = ranges.get(patch.file);
  if (!hunks || !hunks.length) return true;
  const span = anchorSpan(read(patch.file), patch.find);
  if (!span) return true; // якорь не однозначен — судим по файлу
  return hunks.some((hunk) => spansOverlap(span, hunk));
}

/**
 * Мутанты, затронутые диффом (#332, расширено в #475).
 *
 * Два способа свидетелю сгнить: изменился файл, который он патчит, — либо
 * изменился его гард (тест, смок, pytest-модуль), и тот перестал ходить по
 * мутированной ветке. Прежде отбор видел только первый; так после #302/#309
 * четыре мутанта пережили свои гарды и обнаружились лишь полным прогоном
 * перед v1.72.0 (#466, #467).
 */
export function selectChangedMutants(mutants, changedFiles, exists, options = {}) {
  const changed = new Set(changedFiles);
  if (!changed.size) return [];
  const inputsOf = options.guardInputs || createGuardInputResolver({
    ...(exists ? { exists } : {}),
    ...(options.read ? { read: options.read } : {}),
    ...(options.files ? { files: options.files } : {}),
  });
  // #518: когда известны области диффа, файл патча отбирает свидетеля лишь
  // тем, что задел его якорь. Без областей — прежний ответ по файлу.
  const ranges = options.ranges || null;
  const read = options.read || ((file) => (existsSync(join(repoRoot, file)) ? readFileSync(join(repoRoot, file), 'utf8') : ''));
  return mutants.filter((m) => m.patches.some((patch) => changed.has(patch.file)
      && patchTouched(patch, ranges, read))
    || inputsOf(m.guard).some((file) => changed.has(file)));
}

/**
 * Задевает ли правка package.json хоть один гвард (#496, run 2795).
 *
 * package.json — вход почти каждого гварда (`npm run …`, `npx …`), поэтому любое
 * его касание отбирало ~195 мутантов из 590 и шард упирался в 30-минутный
 * лимит job. Но гвард зависит только от того, что он вызывает: изменённый или
 * удалённый существующий script, зависимости, engines/overrides. ДОБАВЛЕННЫЙ
 * script никакой прежний гвард не вызывает — он не вход. Любое другое поле или
 * непрочитанная база — считается задевающим: сторона ошибки — лишний прогон.
 */
export function packageJsonRelevance(baseText, headText) {
  let base; let head;
  try { base = JSON.parse(baseText); head = JSON.parse(headText); } catch { return { relevant: true, reason: 'package.json не разобран' }; }
  const baseScripts = base.scripts || {}; const headScripts = head.scripts || {};
  const changedScripts = Object.keys(baseScripts).filter((k) => headScripts[k] !== baseScripts[k]);
  if (changedScripts.length) return { relevant: true, reason: `изменены/удалены scripts: ${changedScripts.join(', ')}` };
  const rest = (pkg) => JSON.stringify({ ...pkg, scripts: undefined, description: undefined });
  if (rest(base) !== rest(head)) return { relevant: true, reason: 'изменены поля вне scripts (зависимости, engines, …)' };
  const added = Object.keys(headScripts).filter((k) => !(k in baseScripts));
  return { relevant: false, reason: `только добавлены scripts: ${added.join(', ') || '—'}` };
}

/**
 * Определения реестра, добавленные или изменённые относительно базы (#492
 * §6.4): реестр базы читается через `git show` во временный модуль рядом с
 * этим файлом (относительные импорты обязаны разрешаться) и импортируется —
 * реестр данные, побочных эффектов при импорте нет (закреплено тестом).
 * Удалённые id возвращаются отдельно: гонять их нечем, но сказать стоит.
 */
export function registryDelta(current, base) {
  const shape = (m) => JSON.stringify({ guard: m.guard, patches: m.patches, because: m.because });
  const before = new Map(base.map((m) => [m.id, shape(m)]));
  const changed = current.filter((m) => before.get(m.id) !== shape(m)).map((m) => m.id);
  const removed = base.filter((m) => !current.some((c) => c.id === m.id)).map((m) => m.id);
  return { changed, removed };
}

/**
 * Отбор для диффа (#332, #475, #492): по файлам патчей и входам гардов плюс —
 * когда дифф трогает сам реестр — по добавленным/изменённым определениям
 * относительно реестра базы (`base`, null — база не прочитана).
 */
export function selectForDiff(mutants, files, base, options = {}) {
  const byFiles = selectChangedMutants(mutants, files, options.exists, options);
  let byRegistry = [];
  let removed = [];
  if (files.some((file) => MUTATION_REGISTRY_FILES.includes(file)) && base) {
    const delta = registryDelta(mutants, base);
    byRegistry = mutants.filter((m) => delta.changed.includes(m.id));
    removed = delta.removed;
  }
  const ids = new Set([...byFiles, ...byRegistry].map((m) => m.id));
  return { selected: mutants.filter((m) => ids.has(m.id)), byFiles, byRegistry, removed };
}

export async function baseRegistry(baseRef) {
  let registryFile = MUTATION_REGISTRY_FILES[0];
  let shown = spawnSync('git', ['-C', repoRoot, 'show', `${baseRef}:${registryFile}`], { encoding: 'utf8' });
  if (shown.status !== 0) {
    // Compatibility across the one-time #558 split: a base before this
    // refactor still stores declarations inside mutation-gate.mjs.
    registryFile = LEGACY_MUTATION_REGISTRY_FILE;
    shown = spawnSync('git', ['-C', repoRoot, 'show', `${baseRef}:${registryFile}`], { encoding: 'utf8' });
  }
  if (shown.status !== 0) return null;
  const temp = join(repoRoot, 'scripts', `.mutation-gate.base-${process.pid}.mjs`);
  writeFileSync(temp, shown.stdout);
  try {
    const mod = await import(`${pathToFileURL(temp).href}?t=${Date.now()}`);
    return mod.MUTANTS;
  } finally {
    rmSync(temp, { force: true });
  }
}

/**
 * Детерминированный шард `index/total` (#332): реестр сортируется по id и
 * режется чересполосно, чтобы дорогие смок-мутанты (соседи по алфавиту)
 * не скапливались в одном шарде. Объединение шардов равно реестру,
 * пересечений нет — закреплено юнитом.
 */
export function shardMutants(mutants, index, total) {
  const ordered = [...mutants].sort((a, b) => a.id.localeCompare(b.id));
  return ordered.filter((_, position) => position % total === index - 1);
}
