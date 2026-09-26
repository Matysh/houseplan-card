#!/usr/bin/env node
/**
 * Бандл головы `dev` для стенда разработки — из артефакта Validate (#657).
 *
 * С #657 закоммиченный бандл меняется только релизным кандидатом, поэтому
 * дерево `dev` между бетами несёт бандл последней беты. Стенд
 * `dev.houseplan.tech` должен показывать голову `dev`, и его источник —
 * собранный Validate `dist/` того же SHA (артефакт `card-bundle`), а не
 * дерево.
 *
 * Скрипт публикует этот `dist/` в служебную ветку `dev-build` одним
 * коммитом без родителей: `custom_components/houseplan/frontend/**` плюс
 * `DEV-BUILD.json` с SHA источника. Ветка перезаписывается каждый раз —
 * истории в ней нет, и в историю `dev` бандл больше не попадает. HACS её
 * не видит: он ставит релизы (`zip_release`), не ветки.
 *
 * Хост стенда забирает её `demo/stand/update-dev-bundle.sh`.
 *
 *   node scripts/dev-build.mjs --sha <sha> [--dist dist] [--remote origin]
 *                              [--branch dev-build] [--expect-ref refs/heads/dev] [--dry-run]
 *
 * Публикуется только голова: если `--expect-ref` на удалённом уже ушёл
 * вперёд, прогон ничего не пушит — следующий Validate опубликует свежее.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifyBundleTree } from './bundle-tree.mjs';

export const DEV_BUILD_BRANCH = 'dev-build';
export const DEV_BUILD_MARKER = 'DEV-BUILD.json';
export const DEV_BUILD_TARGET = 'custom_components/houseplan/frontend';

export function parseArgs(argv) {
  const value = (name, fallback = null) => {
    const eq = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (eq) return eq.slice(name.length + 3);
    const at = argv.indexOf(`--${name}`);
    return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith('--') ? argv[at + 1] : fallback;
  };
  return {
    sha: value('sha'),
    dist: value('dist', 'dist'),
    remote: value('remote', 'origin'),
    branch: value('branch', DEV_BUILD_BRANCH),
    expectRef: value('expect-ref', 'refs/heads/dev'),
    dryRun: argv.includes('--dry-run'),
  };
}

function makeGit(cwd, extraEnv = {}) {
  return (args, { allowFailure = false } = {}) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...extraEnv } });
    if (r.error) throw r.error;
    if (r.status !== 0 && !allowFailure) {
      throw new Error(`git ${args.join(' ')} → ${(r.stderr || r.stdout || '').trim()}`);
    }
    return { ok: r.status === 0, out: (r.stdout || '').trim() };
  };
}

/**
 * Собрать коммит `dev-build` в объектах репозитория `cwd`, не трогая его
 * рабочее дерево и индекс: отдельный временный индекс и отдельное дерево.
 */
export function buildDevBuildCommit({ cwd, dist, sha, now = new Date() }) {
  const manifest = verifyBundleTree(resolve(cwd, dist));
  const stage = mkdtempSync(join(tmpdir(), 'hp-dev-build-'));
  try {
    cpSync(resolve(cwd, dist), join(stage, DEV_BUILD_TARGET), { recursive: true });
    const marker = {
      schema: 1,
      source: sha,
      fingerprint: manifest.fingerprint ?? null,
      files: manifest.files.length,
      builtAt: now.toISOString(),
    };
    writeFileSync(join(stage, DEV_BUILD_MARKER), `${JSON.stringify(marker, null, 2)}\n`);
    const index = join(stage, '.git-index');
    const git = makeGit(cwd, { GIT_INDEX_FILE: index });
    git(['read-tree', '--empty']);
    git(['--work-tree', stage, 'add', '-A', '--', DEV_BUILD_TARGET, DEV_BUILD_MARKER]);
    const tree = git(['write-tree']).out;
    const commit = git([
      '-c', 'user.name=github-actions[bot]',
      '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit-tree', tree, '-m', `dev-build: ${sha}\n\nSource: ${sha}\nIssue: #657\nUser-Visible: no`,
    ]).out;
    return { commit, tree, marker };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/** Опубликовать, только если источник — всё ещё голова `expectRef`. */
export function publishDevBuild({ cwd = process.cwd(), sha, dist = 'dist', remote = 'origin',
  branch = DEV_BUILD_BRANCH, expectRef = 'refs/heads/dev', dryRun = false, log = console.log } = {}) {
  if (!/^[0-9a-f]{40}$/.test(String(sha || ''))) throw new Error(`--sha must be a full commit SHA, got ${JSON.stringify(sha)}`);
  const git = makeGit(cwd);
  const head = git(['ls-remote', remote, expectRef]).out.split(/\s+/)[0] || '';
  if (head && head !== sha) {
    log(`${expectRef} на ${remote} уже ${head.slice(0, 8)}, а сборка — ${sha.slice(0, 8)}: публикует следующий прогон`);
    return { published: false, reason: 'stale' };
  }
  const built = buildDevBuildCommit({ cwd, dist, sha });
  if (dryRun) {
    log(`--dry-run: ${branch} ← ${built.commit.slice(0, 8)} (${built.marker.files} ассетов из ${sha.slice(0, 8)})`);
    return { published: false, reason: 'dry-run', ...built };
  }
  // Ветка без истории: каждый прогон заменяет её целиком (один коммит без родителя).
  git(['push', '--force', remote, `${built.commit}:refs/heads/${branch}`]);
  log(`${branch} ← ${built.commit.slice(0, 8)}: бандл ${sha.slice(0, 8)} (${built.marker.files} ассетов)`);
  return { published: true, ...built };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    publishDevBuild(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`dev-build: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
