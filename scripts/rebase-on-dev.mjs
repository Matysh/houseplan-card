#!/usr/bin/env node
// Ребейз ветки задачи на origin/dev без ручных конфликтов в бандле (#479).
//
// Бандл лежит в репозитории (класс D: dist/**, custom_components/houseplan/
// frontend/**). С #657 его меняет только релизный кандидат, а ветка задачи не
// несёт его вовсе; конфликт на нём остаётся возможен лишь у ветки, начатой до
// правила. Такой конфликт решается версией dev — без пересборки и без
// амендинга: собранный бандл в ветке был бы коммитом, который правило
// отклонит (`scripts/bundle-policy.mjs`). Индекс ревью
// `docs/reviews/INDEX.md` (#643) — тоже генерируемый: при конфликте он
// пересобирается по каталогу в дереве остановки (общий помощник
// `rebase-generated.mjs`, тот же, что у конвейера). Конфликт в любом другом
// пути — останов с `git rebase --abort`: содержательные конфликты решает автор.
//
//   node scripts/rebase-on-dev.mjs            # ребейз текущей ветки
//   node scripts/rebase-on-dev.mjs --dry-run  # только план, дерево не трогается
//
// Дерево должно быть чистым. Ветка `dev` сама себя не ребейзит.

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REVIEWS_INDEX_PATH, rebaseRegenerating } from './rebase-generated.mjs';
import { BUNDLE_ROOTS } from './bundle-policy.mjs';

export const GENERATED_ROOTS = BUNDLE_ROOTS;
export const isGenerated = (path) => GENERATED_ROOTS.some((root) => path.startsWith(root));
/** Генерируемые пути, которые решаются пересборкой в момент остановки, а не версией dev (#643). */
export const REGENERATED_PATHS = [REVIEWS_INDEX_PATH];
export const isRegenerated = (path) => REGENERATED_PATHS.includes(path);

/** Разделить конфликтующие пути: бандл и индекс решаем сами, остальные — нет. */
export function splitConflicts(paths) {
  const generated = []; const regenerated = []; const manual = [];
  for (const path of paths.map((p) => p.trim()).filter(Boolean)) {
    (isGenerated(path) ? generated : isRegenerated(path) ? regenerated : manual).push(path);
  }
  return { generated, regenerated, manual };
}

export function makeGit(cwd) {
  return (args, { allowFailure = false, input } = {}) => {
    const result = spawnSync('git', args, {
      cwd, encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GIT_EDITOR: 'true' },
    });
    if (result.error) throw result.error;
    if (result.status !== 0 && !allowFailure) {
      throw new Error(`git ${args.join(' ')} → ${(result.stderr || result.stdout || '').trim()}`);
    }
    return { ok: result.status === 0, stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim() };
  };
}

/**
 * Во время rebase «ours» — это upstream (dev), «theirs» — переигрываемый
 * коммит ветки. Для сгенерированного пути берём dev: если в dev файла нет
 * (чанк переименован), путь удаляется — пересборка вернёт актуальное имя.
 */
export function resolveGeneratedConflict(git, path) {
  const inOurs = git(['cat-file', '-e', `:2:${path}`], { allowFailure: true }).ok;
  if (inOurs) {
    git(['checkout', '--ours', '--', path]);
    git(['add', '--', path]);
    return 'dev';
  }
  git(['rm', '--cached', '-f', '--quiet', '--', path], { allowFailure: true });
  rmSync(resolve(git.cwd, path), { force: true });
  return 'removed';
}

export function rebaseOnDev({
  cwd = process.cwd(), upstream = 'origin/dev', dryRun = false,
  log = console.log, fetch = true,
} = {}) {
  const git = Object.assign(makeGit(cwd), { cwd });
  const dirty = git(['status', '--porcelain']).stdout;
  if (dirty) throw new Error(`рабочее дерево не чистое — закоммитьте или спрятайте изменения:\n${dirty}`);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout;
  if (branch === 'HEAD') throw new Error('detached HEAD: ребейзится ветка, не коммит');
  if (branch === 'dev' || branch === 'main') throw new Error(`ветка ${branch} не ребейзится этим скриптом`);
  if (fetch) {
    const [remote, ...rest] = upstream.split('/');
    git(['fetch', '--quiet', remote, rest.join('/')]);
  }
  const base = git(['merge-base', upstream, 'HEAD']).stdout;
  const ahead = Number(git(['rev-list', '--count', `${upstream}..HEAD`]).stdout);
  const behind = Number(git(['rev-list', '--count', `HEAD..${upstream}`]).stdout);
  log(`ветка ${branch}: впереди ${upstream} на ${ahead}, позади на ${behind}`);
  if (behind === 0) { log('ребейз не нужен'); return { branch, rebased: false, resolved: [] }; }

  // Предсказание конфликтов по сгенерированным путям: файлы, которые менялись
  // по обе стороны от merge-base. Точный список даёт только сам ребейз.
  const ours = new Set(git(['diff', '--name-only', base, 'HEAD']).stdout.split('\n').filter(Boolean));
  const theirs = git(['diff', '--name-only', base, upstream]).stdout.split('\n').filter(Boolean);
  const both = theirs.filter((path) => ours.has(path));
  const predicted = splitConflicts(both);
  if (predicted.generated.length) log(`бандл менялся с обеих сторон: ${predicted.generated.length} файл(ов) — возьмётся версия dev (#657)`);
  if (predicted.regenerated.length) log(`индекс ревью менялся с обеих сторон — решится пересборкой по каталогу: ${predicted.regenerated.join(', ')}`);
  if (predicted.manual.length) log(`менялись с обеих сторон и НЕ сгенерированы (возможен ручной конфликт): ${predicted.manual.join(', ')}`);
  if (dryRun) { log('--dry-run: дерево не тронуто'); return { branch, rebased: false, resolved: [], predicted }; }

  // Цикл остановок — общий с конвейером (#643): индекс ревью пересобирается
  // помощником, бандл — версией dev здесь, всё прочее — отказ с abort.
  const outcome = rebaseRegenerating({
    onto: upstream, cwd, git,
    extra: { match: isGenerated, resolve: (path) => resolveGeneratedConflict(git, path) },
  });
  if (!outcome.ok) {
    if (outcome.reason === 'manual') {
      throw new Error(`конфликт вне сгенерированных путей — ребейз отменён, дерево как было:\n  ${outcome.manual.join('\n  ')}`);
    }
    throw new Error(`rebase остановился без конфликтов (${outcome.reason}) — ребейз отменён:\n${outcome.output}`);
  }
  const { resolved } = outcome;
  log(`ребейз завершён; сгенерированных конфликтов решено: ${resolved.length}`);
  // #657: бандл в ветке задачи не пересобирается и не коммитится — его
  // меняет только кандидат (npm run bundle:release).
  return { branch, rebased: true, resolved };
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    rebaseOnDev({ dryRun: process.argv.includes('--dry-run') });
  } catch (error) {
    console.error(`rebase-on-dev: ${error.message}`);
    process.exitCode = 1;
  }
}
