#!/usr/bin/env node
// #643: ребейз, который сам решает конфликт в генерируемом индексе ревью.
//
// Шаг публикации документа ревью коммитит в ветку задачи и документ, и
// пересобранный `docs/reviews/INDEX.md`. Пока задача ждёт слияния, в `dev`
// приезжают документы других задач со своей версией индекса, и doc-коммит
// ветки конфликтует на ребейзе ВСЕГДА — 24.09 так отскочили в S6 зелёные
// #617, #618, #629, #642 и дважды до ревью #631. Решать там нечего: индекс —
// функция каталога `docs/reviews/` (класс C), и правильная версия — не «наша»
// и не «их», а пересборка по дереву, в котором остановился ребейз.
//
// Правило одно: остановку разрешает только набор конфликтов, в котором ВСЕ
// пути — индекс (или пути, которые вызывающий объявил своими: бандл в
// `rebase-on-dev.mjs`). Хоть один другой путь — `git rebase --abort` и
// перечень ВСЕХ конфликтующих файлов, индекс в нём тоже: автор видит полную
// картину, дерево и HEAD как были.
//
//   node scripts/rebase-generated.mjs --onto=origin/dev
//
// Код 0 — ребейз завершён; 3 — отказ (ребейз отменён), в stdout по строке на
// конфликтующий путь (для `$GITHUB_OUTPUT` конвейера), пояснения — в stderr;
// любой другой — сбой. Отказ намеренно не 1: единицей Node завершается сам на
// необработанном исключении и ненайденном модуле, и сбой помощника читался
// бы как конфликт ветки.
// Личность коммитера берётся из окружения (конвейер задаёт GIT_AUTHOR_* и
// GIT_COMMITTER_*) либо из `gitPrefix` (`-c user.name=…`) при вызове из кода.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './spawn-portable.mjs';

export const REVIEWS_INDEX_PATH = 'docs/reviews/INDEX.md';
/** Скрипт индекса — по абсолютному пути: ребейз идёт и из чужого cwd (worktree кандидата). */
export const REVIEWS_INDEX_SCRIPT = fileURLToPath(new URL('./reviews-index.mjs', import.meta.url));
/** Предохранитель от зацикливания: коммитов в ветке задачи единицы, не тысячи. */
export const MAX_STOPS = 500;
/** Код выхода CLI «ребейз отменён, вот конфликты». */
export const EXIT_CONFLICT = 3;

const uniquePaths = (paths) => [...new Set(paths.map((p) => String(p).trim()).filter(Boolean))].sort();

/**
 * Чистое решение по одной остановке ребейза.
 *
 * @param {string[]} paths конфликтующие пути (`git diff --name-only --diff-filter=U`)
 * @param {{ extra?: (path: string) => boolean }} [opts] пути, которые вызывающий решает сам
 * @returns {{ action: 'resolve', index: boolean, extra: string[], conflicts: string[] }
 *         | { action: 'abort', reason: 'no-conflicts'|'manual', manual: string[], conflicts: string[] }}
 */
export function planStop(paths, { extra = () => false } = {}) {
  const conflicts = uniquePaths(paths);
  if (!conflicts.length) return { action: 'abort', reason: 'no-conflicts', manual: [], conflicts };
  const manual = conflicts.filter((path) => path !== REVIEWS_INDEX_PATH && !extra(path));
  if (manual.length) return { action: 'abort', reason: 'manual', manual, conflicts };
  return {
    action: 'resolve',
    index: conflicts.includes(REVIEWS_INDEX_PATH),
    extra: conflicts.filter((path) => path !== REVIEWS_INDEX_PATH),
    conflicts,
  };
}

/** git-исполнитель: `(args, { allowFailure }) => { ok, status, stdout, stderr }`. */
export function makeGit({ cwd = process.cwd(), env = process.env, gitPrefix = [] } = {}) {
  const run = (args, { allowFailure = false } = {}) => {
    const r = spawnSync('git', [...gitPrefix, ...args], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      // Редактор сообщения на `rebase --continue` не открывается никогда.
      env: { ...env, GIT_EDITOR: 'true' },
    });
    if (r.error) throw r.error;
    const out = { ok: r.status === 0, status: r.status, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
    if (!out.ok && !allowFailure) throw new Error(`git ${args.join(' ')} → ${out.stderr || out.stdout}`);
    return out;
  };
  run.cwd = cwd;
  return run;
}

/** Пересборка индекса по каталогу в дереве остановки — тем же генератором, что и конвейер. */
export function rebuildIndexWith({ cwd = process.cwd(), env = process.env } = {}) {
  return () => {
    const r = spawnSync(process.execPath, [REVIEWS_INDEX_SCRIPT, '--dir=docs/reviews'], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env,
    });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`reviews-index.mjs → ${(r.stderr || r.stdout || '').trim()}`);
  };
}

const conflictedPaths = (git) => git(['diff', '--name-only', '--diff-filter=U']).stdout.split('\n');
const rebaseInProgress = (git, cwd) => ['rebase-merge', 'rebase-apply'].some((name) => {
  const probe = git(['rev-parse', '--git-path', name], { allowFailure: true });
  return probe.ok && existsSync(resolve(git.cwd || cwd, probe.stdout));
});

/**
 * Ребейз на `onto` с разрешением генерируемых конфликтов.
 *
 * Возвращает `{ ok: true, stops, resolved }` либо
 * `{ ok: false, reason, conflicts, manual, output }` — во втором случае ребейз
 * уже отменён. Сбой посреди ребейза (исключение) тоже отменяет его: дерево
 * вызывающего не остаётся в полуребейзе.
 */
export function rebaseRegenerating({
  onto, cwd = process.cwd(), env = process.env, gitPrefix = [],
  git = makeGit({ cwd, env, gitPrefix }),
  rebuildIndex = rebuildIndexWith({ cwd, env }),
  extra = null, log = () => {}, maxStops = MAX_STOPS,
}) {
  if (!onto) throw new Error('rebaseRegenerating: не задано, на что ребейзить (onto)');
  const resolved = [];
  let stops = 0;
  const abort = (result) => {
    git(['rebase', '--abort'], { allowFailure: true });
    return { ok: false, resolved, stops, ...result };
  };
  try {
    let step = git(['rebase', onto], { allowFailure: true });
    while (!step.ok) {
      stops += 1;
      if (stops > maxStops) return abort({ reason: 'too-many-stops', conflicts: [], manual: [], output: step.stderr || step.stdout });
      const plan = planStop(conflictedPaths(git), { extra: extra?.match });
      if (plan.action === 'abort') {
        return abort({ reason: plan.reason, conflicts: plan.conflicts, manual: plan.manual, output: step.stderr || step.stdout });
      }
      for (const path of plan.extra) resolved.push(`${path} ← ${extra.resolve(path)}`);
      if (plan.index) {
        // Не --ours и не --theirs: ни одна сторона не знает документов другой.
        rebuildIndex();
        git(['add', '--', REVIEWS_INDEX_PATH]);
        resolved.push(`${REVIEWS_INDEX_PATH} ← пересборка`);
      }
      log(`остановка ${stops}: решено ${plan.conflicts.join(', ')}`);
      // Коммит, ставший пустым после пересборки (индекс-коммит конвейера
      // поверх уже пересобранного индекса), пропускается явно: что делает
      // `--continue` с пустым результатом, зависит от версии git и бэкенда
      // ребейза, а `--skip` при индексе, равном HEAD, не теряет ничего.
      const empty = git(['diff', '--cached', '--quiet', 'HEAD'], { allowFailure: true }).ok;
      step = git(['rebase', empty ? '--skip' : '--continue'], { allowFailure: true });
    }
    return { ok: true, stops, resolved };
  } catch (error) {
    if (rebaseInProgress(git, cwd)) git(['rebase', '--abort'], { allowFailure: true });
    throw error;
  }
}

if (isMainModule(import.meta.url)) { // #496: переносимо для Windows
  const onto = process.argv.find((a) => a.startsWith('--onto='))?.slice('--onto='.length);
  if (!onto) {
    console.error('usage: rebase-generated.mjs --onto=<ref>');
    process.exit(2);
  }
  try {
    const result = rebaseRegenerating({ onto, log: (line) => console.error(line) });
    if (result.ok) {
      console.error(`ребейз на ${onto} завершён; остановок решено: ${result.stops}${result.resolved.length ? ` (${result.resolved.join('; ')})` : ''}`);
      process.exit(0);
    }
    if (result.conflicts.length) process.stdout.write(`${result.conflicts.join('\n')}\n`);
    console.error(result.reason === 'manual'
      ? `ребейз на ${onto} отменён: конфликт вне генерируемых путей — ${result.manual.join(', ')}`
      : `ребейз на ${onto} отменён (${result.reason}):\n${result.output}`);
    process.exit(EXIT_CONFLICT);
  } catch (error) {
    console.error(`rebase-generated: ${error.message}`);
    process.exit(2);
  }
}
