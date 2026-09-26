#!/usr/bin/env node
/**
 * Бандл в `dev` меняется только релизным кандидатом (#657, решение 2б).
 *
 * До #657 каждая задача пересобирала и коммитила бандл (`dist/**`,
 * `custom_components/houseplan/frontend/**`, класс D): за неделю 23–25.09 —
 * 34 коммита из 199, 16 MiB из ≈ 40 MiB прироста истории, потому что
 * content-hashed чанки не дельтируются между версиями. Две задачи, собравшие
 * бандл параллельно, конфликтовали на нём по построению.
 *
 * Теперь закоммиченный бандл — снимок последнего кандидата беты или релиза:
 *
 * - коммит, который трогает пути бандла, обязан нести трейлер `Release:`;
 *   любой другой отклоняется хуком `commit-msg` и проверкой истории в CI;
 * - сверка «собранный = закоммиченный» (`bundle-tree dist frontend`) судит
 *   только коммит, который бандл меняет, и кандидат (`Release v… candidate`),
 *   даже если бандл в нём забыли пересобрать; на остальных проверяется
 *   целостность свежей сборки — закоммиченная копия законно отстаёт.
 *   Приёмка эталонов тоже несёт `Release:`, но бандл не трогает и после
 *   хотфиксов к кандидату сверяться с ним не может;
 * - стенд `dev.houseplan.tech` берёт бандл из артефакта Validate
 *   (`scripts/dev-build.mjs`, ветка `dev-build`), а не из дерева.
 *
 *   node scripts/bundle-policy.mjs --must-match [<ref>]   # код 0 — сверять копии, 1 — нет
 *   node scripts/bundle-policy.mjs --verify [<ref>]       # сборка dist цела; копии равны, если --must-match
 *   node scripts/bundle-policy.mjs --clean                # вернуть бандл к закоммиченному (npm run bundle:clean)
 *
 * Само правило коммита исполняет `validate-commit-provenance.mjs` — в хуке
 * `commit-msg` по индексу и в CI по диапазону истории.
 *
 * История до правила не переписывается: коммиты, написанные раньше
 * `BUNDLE_RELEASE_ONLY_SINCE`, судятся по-старому — иначе ветка, начатая до
 * #657 и уже собравшая бандл, не прошла бы приведение к `dev`.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareBundleTrees, verifyBundleTree } from './bundle-tree.mjs';

export const BUNDLE_ROOTS = Object.freeze(['dist/', 'custom_components/houseplan/frontend/']);

/** С этого момента (дата автора коммита) правило судит и историю. */
export const BUNDLE_RELEASE_ONLY_SINCE = '2026-09-27T00:00:00Z';

export const BUNDLE_RELEASE_ONLY_ERROR = 'bundle (dist/**, custom_components/houseplan/frontend/**) changes only in a '
  + "commit with a 'Release: vX.Y.Z' trailer (#657): restore it with `npm run bundle:clean`";

export const isBundlePath = (path) => {
  const normalized = String(path || '').replaceAll('\\', '/');
  return BUNDLE_ROOTS.some((root) => normalized.startsWith(root));
};

const TRAILER = /^([A-Za-z][A-Za-z0-9-]*):\s*(.*?)\s*$/;

/** Значения трейлера `Release:` в терминальном блоке сообщения. */
export function releaseTrailers(message) {
  const lines = String(message || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !line.startsWith('#'));
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const values = [];
  for (let index = lines.length - 1; index >= 0; index--) {
    const match = lines[index].match(TRAILER);
    if (!match) break;
    if (match[1] === 'Release' && match[2]) values.unshift(match[2]);
  }
  return values;
}

export const isReleaseMessage = (message) => releaseTrailers(message).length > 0;

/**
 * Ошибки правила для одного коммита. `authorDate` передаётся только при
 * проверке истории: коммит раньше `since` правилом не судится.
 */
export function bundleCommitErrors(message, files = [], {
  authorDate = null, since = BUNDLE_RELEASE_ONLY_SINCE,
} = {}) {
  if (!files.some(isBundlePath)) return [];
  if (authorDate && Date.parse(authorDate) < Date.parse(since)) return [];
  return isReleaseMessage(message) ? [] : [BUNDLE_RELEASE_ONLY_ERROR];
}

/**
 * Подпись кандидата беты/релиза: `Release vX.Y.Z[-beta.N] candidate` или
 * `Prepare vX.Y.Z-beta.N` (обе формы есть в истории). Это ранний сигнал
 * Validate; окончательно свежесть бандла судит публикация —
 * `assertCommittedBundleFresh` в `release-prerelease.mjs`, потому что
 * вершиной беты может оказаться и хотфикс поверх кандидата.
 */
export const isCandidateSubject = (subject) => /^(Release|Prepare) v\d/.test(String(subject || ''));

/**
 * Закоммиченный бандл собран из этого же дерева: отпечаток исходников,
 * вшитый сборкой в манифест, равен отпечатку дерева публикуемого SHA.
 * С #657 это единственное, что не даёт выпустить бету со старым бандлом,
 * если после кандидата в `dev` ушёл коммит без пересборки.
 */
export function assertCommittedBundleFresh(manifest, expectedFingerprint) {
  const actual = manifest?.fingerprint;
  if (!actual || actual !== expectedFingerprint) {
    throw new Error(`Committed bundle is stale: manifest fingerprint ${String(actual).slice(0, 12)} `
      + `≠ source ${String(expectedFingerprint).slice(0, 12)}; rebuild the candidate with \`npm run bundle:release\` (#657)`);
  }
  return actual;
}

/**
 * Обязан ли закоммиченный бандл этого коммита совпасть со свежей сборкой:
 * да, если коммит бандл меняет (значит, он релизный по правилу выше) или
 * это кандидат — у кандидата бандл обязан быть свежим, даже если его забыли.
 */
export function committedBundleMustMatch({ subject = '', files = [] } = {}) {
  return files.some(isBundlePath) || isCandidateSubject(subject);
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/** Тема и пути коммита. В shallow-клоне без родителя diff-tree выдал бы всё дерево. */
function commitShape(ref, cwd) {
  const parents = git(['rev-list', '--parents', '-n', '1', ref], cwd).split(/\s+/).slice(1);
  if (!parents.length && git(['rev-parse', '--is-shallow-repository'], cwd) === 'true') {
    throw new Error(`${ref}: shallow-клон без родителя — пути коммита не определить (нужен fetch-depth: 0)`);
  }
  const subject = git(['show', '-s', '--format=%s', ref], cwd);
  const files = git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', ref], cwd)
    .split('\n').filter(Boolean);
  return { subject, files };
}

function main(argv, cwd = process.cwd()) {
  const at = argv.indexOf('--must-match');
  if (at >= 0) {
    const ref = argv[at + 1] && !argv[at + 1].startsWith('--') ? argv[at + 1] : 'HEAD';
    const must = committedBundleMustMatch(commitShape(ref, cwd));
    console.log(must
      ? `${ref}: коммит меняет бандл или это кандидат — закоммиченные копии обязаны совпасть со сборкой`
      : `${ref}: бандл не меняется — закоммиченная копия законно отстаёт, судится только свежая сборка (#657)`);
    return must ? 0 : 1;
  }
  const verifyAt = argv.indexOf('--verify');
  if (verifyAt >= 0) {
    // Одна точка решения для Validate и gate:small: свежая сборка обязана
    // быть целой всегда, а совпадать с закоммиченной копией — только там,
    // где коммит бандл меняет или объявлен кандидатом.
    const ref = argv[verifyAt + 1] && !argv[verifyAt + 1].startsWith('--') ? argv[verifyAt + 1] : 'HEAD';
    if (committedBundleMustMatch(commitShape(ref, cwd))) {
      const manifest = compareBundleTrees(resolve(cwd, 'dist'), resolve(cwd, 'custom_components/houseplan/frontend'));
      console.log(`${ref}: релизный коммит — dist и custom_components/houseplan/frontend совпадают (${manifest.files.length} ассетов)`);
    } else {
      const manifest = verifyBundleTree(resolve(cwd, 'dist'));
      console.log(`${ref}: свежая сборка dist цела (${manifest.files.length} ассетов); закоммиченная копия не сверяется — бандл меняет только кандидат (#657)`);
    }
    return 0;
  }
  if (argv.includes('--clean')) {
    // Сборка переписывает отслеживаемый dist/ (и custom_components при
    // --release): перед обычным коммитом это вернуть. Новые чанки с новыми
    // хешами — неотслеживаемые файлы, их убирает clean в тех же корнях.
    const roots = BUNDLE_ROOTS.map((root) => root.replace(/\/$/, ''));
    git(['checkout', '--', ...roots], cwd);
    git(['clean', '-fdq', '--', ...roots], cwd);
    console.log(`бандл возвращён к закоммиченному: ${roots.join(', ')} (#657)`);
    return 0;
  }
  console.error('usage: bundle-policy.mjs --must-match [<ref>] | --verify [<ref>] | --clean');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`bundle-policy: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
