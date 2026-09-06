#!/usr/bin/env node
// Ребейз ветки задачи на origin/dev без ручных конфликтов в бандле (#479).
//
// Бандл лежит в репозитории (класс D: dist/**, custom_components/houseplan/
// frontend/**), поэтому две задачи, собравшие его параллельно, конфликтуют на
// нём всегда — 1.16 МБ минифицированного текста плюс переименованные
// content-hashed чанки. Руками это не решается, решается пересборкой. Скрипт
// делает ровно это: при конфликте ТОЛЬКО в сгенерированных путях берёт версию
// dev, доводит ребейз до конца, пересобирает бандл (`npm run bundle:sync`) и,
// если он отличается, амендит последний коммит ветки. Конфликт в любом другом
// пути — останов с `git rebase --abort`: содержательные конфликты решает автор.
//
//   node scripts/rebase-on-dev.mjs            # ребейз текущей ветки
//   node scripts/rebase-on-dev.mjs --dry-run  # только план, дерево не трогается
//
// Дерево должно быть чистым. Ветка `dev` сама себя не ребейзит.

import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GENERATED_ROOTS = ['dist/', 'custom_components/houseplan/frontend/'];
export const isGenerated = (path) => GENERATED_ROOTS.some((root) => path.startsWith(root));

/** Разделить конфликтующие пути: сгенерированные решаем сами, остальные — нет. */
export function splitConflicts(paths) {
  const generated = []; const manual = [];
  for (const path of paths.map((p) => p.trim()).filter(Boolean)) {
    (isGenerated(path) ? generated : manual).push(path);
  }
  return { generated, manual };
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
  syncCommand = ['npm', 'run', 'bundle:sync'], log = console.log, fetch = true,
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
  if (behind === 0) { log('ребейз не нужен'); return { branch, rebased: false, resolved: [], rebuilt: false }; }

  // Предсказание конфликтов по сгенерированным путям: файлы, которые менялись
  // по обе стороны от merge-base. Точный список даёт только сам ребейз.
  const ours = new Set(git(['diff', '--name-only', base, 'HEAD']).stdout.split('\n').filter(Boolean));
  const theirs = git(['diff', '--name-only', base, upstream]).stdout.split('\n').filter(Boolean);
  const both = theirs.filter((path) => ours.has(path));
  const predicted = splitConflicts(both);
  if (predicted.generated.length) log(`бандл менялся с обеих сторон: ${predicted.generated.length} файл(ов) — решится пересборкой`);
  if (predicted.manual.length) log(`менялись с обеих сторон и НЕ сгенерированы (возможен ручной конфликт): ${predicted.manual.join(', ')}`);
  if (dryRun) { log('--dry-run: дерево не тронуто'); return { branch, rebased: false, resolved: [], rebuilt: false, predicted }; }

  const resolved = [];
  let step = git(['rebase', upstream], { allowFailure: true });
  while (!step.ok) {
    const conflicts = git(['diff', '--name-only', '--diff-filter=U']).stdout.split('\n').filter(Boolean);
    if (!conflicts.length) {
      git(['rebase', '--abort'], { allowFailure: true });
      throw new Error(`rebase остановился без конфликтов:\n${step.stderr || step.stdout}`);
    }
    const { generated, manual } = splitConflicts(conflicts);
    if (manual.length) {
      git(['rebase', '--abort']);
      throw new Error(`конфликт вне сгенерированных путей — ребейз отменён, дерево как было:\n  ${manual.join('\n  ')}`);
    }
    for (const path of generated) resolved.push(`${path} ← ${resolveGeneratedConflict(git, path)}`);
    step = git(['rebase', '--continue'], { allowFailure: true });
  }
  log(`ребейз завершён; сгенерированных конфликтов решено: ${resolved.length}`);

  // Пересборка: версия dev в бандле — не версия этой ветки. Собираем и, если
  // бандл отличается, амендим последний коммит ветки.
  const [cmd, ...args] = syncCommand;
  const sync = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (sync.status !== 0) throw new Error(`${syncCommand.join(' ')} завершился с кодом ${sync.status}; ребейз сделан, бандл не закоммичен`);
  git(['add', '-A', '--', ...GENERATED_ROOTS.filter((root) => existsSync(resolve(cwd, root)))]);
  const staged = git(['diff', '--cached', '--name-only']).stdout;
  const rebuilt = staged.length > 0;
  if (rebuilt) {
    git(['commit', '--amend', '--no-edit', '--quiet']);
    log(`бандл пересобран и добавлен в последний коммит (${staged.split('\n').length} файл(ов))`);
  } else {
    log('бандл после пересборки совпал с dev — амендить нечего');
  }
  return { branch, rebased: true, resolved, rebuilt };
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
