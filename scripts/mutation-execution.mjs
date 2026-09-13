// Applying and executing mutants. This module deliberately knows nothing
// about registry layout or diff selection.
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  MUTATION_OUTCOME, MUTATION_PROOF, runGuardPhases, runMutationLifecycle,
} from './mutation-guard-outcome.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export function applyPatches(root, patches) {
  for (const patch of patches) {
    const path = join(root, patch.file);
    const source = readFileSync(path, 'utf8');
    const hits = source.split(patch.find).length - 1;
    if (hits !== 1) {
      throw new Error(`${patch.file}: якорь найден ${hits} раз(а), нужен ровно 1 — реестр отстал от кода`);
    }
    writeFileSync(path, source.replace(patch.find, patch.replace));
  }
}

function sh(cmd, cwd, extraEnv = {}) {
  return spawnSync(cmd, {
    cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    timeout: Number(process.env.MUTATION_COMMAND_TIMEOUT_MS) || 180_000,
    killSignal: 'SIGTERM',
    env: { ...process.env, ...extraEnv },
  });
}

export function makeWorktree() {
  const dir = mkdtempSync(join(tmpdir(), 'hp-mutant-'));
  const added = spawnSync('git', ['-C', repoRoot, 'worktree', 'add', '--detach', dir, 'HEAD'],
    { encoding: 'utf8' });
  if (added.status !== 0) throw new Error(`git worktree add: ${added.stderr}`);
  // node_modules не копируется — символическая ссылка на настоящий. Установка
  // зависимостей на каждого мутанта превратила бы вечерний гейт в суточный.
  symlinkSync(join(repoRoot, 'node_modules'), join(dir, 'node_modules'), 'junction');
  return dir;
}

export function dropWorktree(dir) {
  // On Windows a directory junction can be traversed by recursive worktree
  // cleanup. Detach it first; otherwise removing the mutant may empty the real
  // repository's node_modules target instead of deleting only the junction.
  const modules = join(dir, 'node_modules');
  if (existsSync(modules)) unlinkSync(modules);
  spawnSync('git', ['-C', repoRoot, 'worktree', 'remove', '--force', dir], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Нужен ли гварду скомпилированный `test-build/` (#235).
 *
 * Гварды в реестре двух видов: длинные сами начинаются с
 * `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`, короткие —
 * сразу с `node --test`. В свежем worktree каталога `test-build/` нет вообще,
 * поэтому короткий гвард падал с `ERR_MODULE_NOT_FOUND` — и это читалось как
 * «мутант поймал поломку», хотя означало «гвард не смог исполниться». Компиляция
 * стоит секунд, поэтому шаг ставится только там, где гвард не делает его сам.
 */
export function guardNeedsTestBuild(guard) {
  return /(^|[\s&|;])node --test\b/.test(guard) && !guard.includes('tsconfig.test.json');
}

/**
 * Нужен ли гварду СОБРАННЫЙ бандл (#332).
 *
 * Бандл читают только браузерные проверки: смоки и golden-сцены грузят
 * дерево `demo/srv/assets/`, и мутант обязан попасть в entry и lazy chunks,
 * иначе
 * guard проверяет чистый код. Юнит- и бэкенд-гварды бандл не открывают ни в
 * каком виде (проверено по реестру и по исходникам тестов: dist/** читается
 * только как git-чекаут, который в worktree и так есть). Rollup-сборка —
 * самая дорогая часть прогона (255 мутантов × ~15-20 с), поэтому она
 * выполняется только там, где её результат кто-то откроет.
 */
export function guardNeedsBundle(guard) {
  // `bundle:sync` в гварде реестр больше не допускает (--check, #499), но
  // распознавание остаётся: чужой или старый гвард со сборкой всё равно
  // браузерный, и бандл ему нужен.
  return guard.includes('demo/') || guard.includes('bundle:sync');
}

/**
 * Тёплый старт компиляции мутанта (#332): скопировать `test-build/` вместе с
 * `.tsbuildinfo` из основного дерева. Мутант меняет один-два файла, и
 * инкрементальный tsc пересобирает только их дельту вместо всего проекта;
 * `.tsbuildinfo` сверяет файлы по хэшу содержимого, поэтому свежие mtime
 * worktree его не сбивают, а мутированный файл гарантированно пересобирается.
 * Отсутствие каталога в основном дереве — не ошибка: холодная сборка просто
 * идёт прежним полным путём.
 */
function seedTestBuild(dir) {
  const warm = join(repoRoot, 'test-build');
  if (!existsSync(warm)) return;
  cpSync(warm, join(dir, 'test-build'), { recursive: true });
}

/**
 * Собрать `test-build/` из мутированного src в каталоге мутанта.
 *
 * `tsc` здесь — подготовка, а не заявленный оракул. Его отказ не может
 * считаться падением последующего теста (#550), даже если тёплый каталог от
 * прошлого дерева всё ещё существует.
 */
function buildTestBuild(dir) {
  seedTestBuild(dir);
  const built = sh('npx tsc -p tsconfig.test.json', dir);
  if (built.status !== 0) {
    throw new Error(`test-build не скомпилировался в мутанте:\n${(built.stderr || built.stdout || built.error?.message || '').slice(-2000)}`);
  }
  const fixed = sh('node scripts/fix-test-build.mjs', dir);
  if (fixed.status !== 0 || !existsSync(join(dir, 'test-build'))) {
    throw new Error(`test-build не собрался в мутанте:\n${(fixed.stderr || fixed.stdout).slice(-2000)}`);
  }
}

export function buildBundle(dir) {
  // Только rollup, без tsc --noEmit: мутант имеет право быть нестрогим по
  // типам — он воспроизводит поломку, а не образцовый код.
  const built = sh('npx rollup -c', dir);
  if (built.status !== 0) {
    throw new Error(`сборка мутанта упала:\n${String(built.stderr || built.stdout || built.error?.message || '').slice(-2000)}`);
  }
  const synced = sh('node scripts/bundle-sync.mjs', dir);
  if (synced.status !== 0) {
    throw new Error(`дерево бандла мутанта не синхронизировалось:\n${String(synced.stderr || synced.stdout || synced.error?.message || '').slice(-2000)}`);
  }
}

function printMutantOutcome(mutant, outcome) {
  if (outcome.kind === MUTATION_OUTCOME.ASSERTION_KILLED) {
    console.log(`ok   ${mutant.id}: заявленный тест покраснел на мутанте`);
    return;
  }
  if (outcome.kind === MUTATION_OUTCOME.COMPILE_KILLED) {
    console.log(`ok   ${mutant.id}: явный compile-time свидетель поймал мутант`);
    return;
  }
  if (outcome.kind === MUTATION_OUTCOME.SURVIVED) {
    // Формат читает mutation-gate-report.mjs — менять синхронно.
    console.log(`FAIL ${mutant.id}: тест остался зелёным на сломанном коде`);
    console.log(`     guard: ${mutant.guard}`);
    console.log(`     ${mutant.because}`);
    return;
  }
  const labels = {
    [MUTATION_OUTCOME.INVALID]: 'неприменимый мутант',
    [MUTATION_OUTCOME.SETUP]: 'ошибка подготовки до заявленного теста',
    [MUTATION_OUTCOME.INTERRUPTED]: 'прерывание инфраструктуры',
  };
  console.log(`FAIL ${mutant.id}: ${labels[outcome.kind] || outcome.kind}`);
  if (outcome.command) console.log(`     command: ${outcome.command}`);
  if (outcome.detail) console.log(`     ${outcome.detail}`);
}

export function runMutant(mutant) {
  let dir;
  try {
    dir = makeWorktree();
    const outcome = runMutationLifecycle({
      apply: () => applyPatches(dir, mutant.patches),
      prepare: () => {
        if (guardNeedsBundle(mutant.guard)) buildBundle(dir);
        if (guardNeedsTestBuild(mutant.guard)) buildTestBuild(dir);
      },
      guard: mutant.guard,
      proof: mutant.oracle || MUTATION_PROOF.ASSERTION,
      execute: (command) => sh(command, dir),
    });
    printMutantOutcome(mutant, outcome);
    return outcome;
  } catch (error) {
    const outcome = {
      kind: MUTATION_OUTCOME.INTERRUPTED,
      detail: error.message,
      command: '',
    };
    printMutantOutcome(mutant, outcome);
    return outcome;
  } finally {
    if (dir) dropWorktree(dir);
  }
}

// Чистый прогон каждого guard ровно один раз: тест, красный и без мутанта,
// «ловит» поломку тривиально и не доказывает ничего.
export function runCleanGuards(mutants) {
  const guards = [...new Set(mutants.map((m) => m.guard))];
  const dir = makeWorktree();
  try {
    try {
      if (guards.some(guardNeedsBundle)) buildBundle(dir);
      // Один worktree на все чистые гварды — значит и компиляция одна.
      if (guards.some(guardNeedsTestBuild)) buildTestBuild(dir);
    } catch (error) {
      console.log(`FAIL чистая подготовка: ${error.message}`);
      return false;
    }
    for (const guard of guards) {
      const mutant = mutants.find((item) => item.guard === guard);
      const outcome = runGuardPhases(guard, {
        proof: mutant?.oracle || MUTATION_PROOF.ASSERTION,
        execute: (command) => sh(command, dir),
      });
      if (outcome.kind !== MUTATION_OUTCOME.SURVIVED) {
        if (outcome.kind === MUTATION_OUTCOME.SETUP) {
          console.log(`FAIL чистая подготовка: ${outcome.command}`);
        } else if (outcome.kind === MUTATION_OUTCOME.INTERRUPTED) {
          console.log(`FAIL чистая инфраструктура: ${outcome.command || guard}`);
        } else {
          // Формат читает mutation-gate-report.mjs — менять синхронно.
          console.log(`FAIL чистый прогон: ${guard} красный без мутанта`);
        }
        if (outcome.detail) console.log(outcome.detail.slice(-1500));
        return false;
      }
      console.log(`ok   чистый прогон: ${guard}`);
    }
    return true;
  } finally {
    dropWorktree(dir);
  }
}
