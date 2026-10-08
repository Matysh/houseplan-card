#!/usr/bin/env node
/**
 * Голова `dev` для стенда разработки и своей инсталляции HA — из артефакта
 * Validate (#657, #835).
 *
 * С #657 закоммиченный бандл меняется только релизным кандидатом, поэтому
 * дерево `dev` между бетами несёт бандл последней беты. Стенд
 * `dev.houseplan.tech` должен показывать голову `dev`, и его источник —
 * собранный Validate `dist/` того же SHA (артефакт `card-bundle`), а не
 * дерево.
 *
 * Скрипт публикует в служебную ветку `dev-build` одним коммитом без родителей
 * всю интеграцию этого SHA (#835): файлы `custom_components/houseplan/**` вне
 * `frontend/` — из дерева коммита-источника, `frontend/**` — из `dist/`;
 * закоммиченный бандл последней беты в ветку не попадает. Рядом —
 * `DEV-BUILD.json`: SHA источника и `integrationTree` — git-хеш дерева
 * интеграции. Хеш содержательный: коммит, не меняющий того, что попадает в
 * HA (документация, процесс), даёт тот же хеш, и установка на него не
 * реагирует. Ветка перезаписывается каждый раз — истории в ней нет, и в
 * историю `dev` бандл не попадает. HACS её не видит: он ставит релизы
 * (`zip_release`), не ветки.
 *
 * Потребители: стенд берёт только `frontend/` (`demo/stand/update-dev-bundle.sh`),
 * своя инсталляция владельца — всю интеграцию (`scripts/ha-track-dev.sh`,
 * docs/DEVELOPMENT.md «Tracking the head of dev»).
 *
 *   node scripts/dev-build.mjs --sha <sha> [--dist dist] [--remote origin]
 *                              [--branch dev-build] [--expect-ref refs/heads/dev] [--dry-run]
 *
 * Публикуется только голова: если `--expect-ref` на удалённом уже ушёл
 * вперёд, прогон ничего не пушит — следующий Validate опубликует свежее.
 * В `$GITHUB_OUTPUT` (если задан) пишется `changed=true|false`: изменилось ли
 * дерево интеграции против прежней `dev-build` — по нему Validate решает,
 * звать ли вебхук своей инсталляции.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifyBundleTree } from './bundle-tree.mjs';

export const DEV_BUILD_BRANCH = 'dev-build';
export const DEV_BUILD_MARKER = 'DEV-BUILD.json';
export const DEV_BUILD_INTEGRATION = 'custom_components/houseplan';
export const DEV_BUILD_TARGET = `${DEV_BUILD_INTEGRATION}/frontend`;
export const DEV_BUILD_SCHEMA = 2;

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
  return (args, { allowFailure = false, input } = {}) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', input, env: { ...process.env, ...extraEnv } });
    if (r.error) throw r.error;
    if (r.status !== 0 && !allowFailure) {
      throw new Error(`git ${args.join(' ')} → ${(r.stderr || r.stdout || '').trim()}`);
    }
    return { ok: r.status === 0, out: (r.stdout || '').trim() };
  };
}

/**
 * Записи индекса для файлов интеграции из дерева источника — всё, кроме
 * `frontend/`: его даёт `dist/`, а в дереве `dev` там бандл последней беты.
 */
export function integrationIndexEntries(git, sha) {
  const listed = git(['ls-tree', '-r', '-z', '--full-tree', sha, '--', DEV_BUILD_INTEGRATION]).out
    .split('\0').filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t');
      const [mode, type, object] = line.slice(0, tab).split(' ');
      return { mode, type, object, path: line.slice(tab + 1) };
    });
  const entries = listed.filter((entry) => entry.type === 'blob'
    && entry.path !== DEV_BUILD_TARGET && !entry.path.startsWith(`${DEV_BUILD_TARGET}/`));
  if (!entries.some((entry) => entry.path === `${DEV_BUILD_INTEGRATION}/manifest.json`)) {
    throw new Error(`в дереве ${sha.slice(0, 8)} нет ${DEV_BUILD_INTEGRATION}/manifest.json`);
  }
  return entries;
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
    const index = join(stage, '.git-index');
    const git = makeGit(cwd, { GIT_INDEX_FILE: index });
    const backend = integrationIndexEntries(git, sha);
    git(['read-tree', '--empty']);
    git(['update-index', '-z', '--index-info'], {
      input: backend.map((entry) => `${entry.mode} ${entry.object}\t${entry.path}\0`).join(''),
    });
    git(['--work-tree', stage, 'add', '-A', '--', DEV_BUILD_TARGET]);
    // Хеш дерева интеграции считается до маркера: маркер лежит вне него.
    const integrationTree = git(['rev-parse', `${git(['write-tree']).out}:${DEV_BUILD_INTEGRATION}`]).out;
    const marker = {
      schema: DEV_BUILD_SCHEMA,
      source: sha,
      integrationTree,
      fingerprint: manifest.fingerprint ?? null,
      files: manifest.files.length,
      backendFiles: backend.length,
      builtAt: now.toISOString(),
    };
    writeFileSync(join(stage, DEV_BUILD_MARKER), `${JSON.stringify(marker, null, 2)}\n`);
    git(['--work-tree', stage, 'add', '--', DEV_BUILD_MARKER]);
    const tree = git(['write-tree']).out;
    const commit = git([
      '-c', 'user.name=github-actions[bot]',
      '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit-tree', tree, '-m', `dev-build: ${sha}\n\nSource: ${sha}\nIssue: #657\nIssue: #835\nUser-Visible: no`,
    ]).out;
    return { commit, tree, marker };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/** Дерево интеграции в текущей `dev-build` на удалённом, `''` — ветки нет. */
function publishedIntegrationTree(git, remote, branch) {
  const tip = git(['ls-remote', remote, `refs/heads/${branch}`]).out.split(/\s+/)[0] || '';
  if (!tip) return '';
  // По имени ветки, а не по SHA: выдачу произвольного SHA сервер может не разрешать.
  const fetched = git(['fetch', '--quiet', '--depth=1', remote, `refs/heads/${branch}`], { allowFailure: true });
  if (!fetched.ok) return '';
  return git(['rev-parse', `${tip}:${DEV_BUILD_INTEGRATION}`], { allowFailure: true }).out;
}

function writeOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
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
  const previous = publishedIntegrationTree(git, remote, branch);
  const changed = previous !== built.marker.integrationTree;
  if (dryRun) {
    log(`--dry-run: ${branch} ← ${built.commit.slice(0, 8)} (${built.marker.files} ассетов из ${sha.slice(0, 8)}, интеграция ${changed ? 'изменилась' : 'та же'})`);
    return { published: false, reason: 'dry-run', changed, ...built };
  }
  // Ветка без истории: каждый прогон заменяет её целиком (один коммит без родителя).
  git(['push', '--force', remote, `${built.commit}:refs/heads/${branch}`]);
  writeOutput('changed', String(changed));
  log(`${branch} ← ${built.commit.slice(0, 8)}: интеграция ${sha.slice(0, 8)} (${built.marker.files} ассетов, ${built.marker.backendFiles} файлов бэкенда; ${changed ? 'изменилась' : 'содержимое то же'})`);
  return { published: true, changed, ...built };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    publishDevBuild(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(`dev-build: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
