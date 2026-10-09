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
 * #836: опубликованная интеграция помечена как dev-сборка — `BUILD.json`
 * (`{"schema": 1, "channel": "dev", "source": "<SHA>"}`) рядом с манифестом и
 * `version` манифеста с суффиксом `+dev.<sha8>`; так HA, «О программе» и
 * отчёт поддержки видят, что стоит. Метка ложится в коммит ПОСЛЕ подсчёта
 * `integrationTree`: хеш по-прежнему описывает содержимое интеграции, и
 * коммит, не меняющий её, установка всё так же пропускает, сохраняя SHA, с
 * которого её ставили. В дереве `dev`, бетах и релизах метки нет.
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
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { verifyBundleTree } from './bundle-tree.mjs';

export const DEV_BUILD_BRANCH = 'dev-build';
export const DEV_BUILD_MARKER = 'DEV-BUILD.json';
export const DEV_BUILD_INTEGRATION = 'custom_components/houseplan';
export const DEV_BUILD_TARGET = `${DEV_BUILD_INTEGRATION}/frontend`;
export const DEV_BUILD_SCHEMA = 2;
export const DEV_BUILD_MANIFEST = `${DEV_BUILD_INTEGRATION}/manifest.json`;
/** #836: метка dev-сборки; читает её бэкенд (`build_identity.py`). */
export const DEV_BUILD_LABEL = `${DEV_BUILD_INTEGRATION}/BUILD.json`;
export const DEV_BUILD_LABEL_SCHEMA = 1;

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
  return (args, { allowFailure = false, input, raw = false } = {}) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', input, env: { ...process.env, ...extraEnv } });
    if (r.error) throw r.error;
    if (r.status !== 0 && !allowFailure) {
      throw new Error(`git ${args.join(' ')} → ${(r.stderr || r.stdout || '').trim()}`);
    }
    // raw — содержимое файла байт в байт: обрезка пробелов изменила бы манифест.
    return { ok: r.status === 0, out: raw ? (r.stdout || '') : (r.stdout || '').trim() };
  };
}

/**
 * #836: текст манифеста опубликованной сборки — `version` с суффиксом
 * `+dev.<sha8>`, остальные байты те же. Замена проверяется разбором: результат
 * обязан совпасть с исходным объектом, где изменена одна `version`. Манифест,
 * который не разбирается или без строковой `version`, — ошибка: сборка без
 * метки выглядела бы релизом, поэтому её не публикуют вовсе.
 */
export function labelManifestText(text, sha) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${DEV_BUILD_MANIFEST} не разбирается: ${error instanceof Error ? error.message : error}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof parsed.version !== 'string') {
    throw new Error(`в ${DEV_BUILD_MANIFEST} нет строковой version`);
  }
  // Второй `+` сделал бы версию недействительной для загрузчика HA.
  if (!parsed.version || parsed.version.includes('+')) {
    throw new Error(`version ${JSON.stringify(parsed.version)} в ${DEV_BUILD_MANIFEST} не принимает суффикс +dev`);
  }
  const version = `${parsed.version}+dev.${sha.slice(0, 8)}`;
  const expected = JSON.stringify({ ...parsed, version });
  for (const match of text.matchAll(/("version"\s*:\s*)"(?:[^"\\]|\\.)*"/g)) {
    const candidate = text.slice(0, match.index) + match[1] + JSON.stringify(version)
      + text.slice(match.index + match[0].length);
    let reparsed;
    try {
      reparsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (JSON.stringify(reparsed) === expected) return { text: candidate, version };
  }
  throw new Error(`не удалось заменить version в ${DEV_BUILD_MANIFEST}, не трогая остальной текст`);
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
    const manifestEntry = backend.find((entry) => entry.path === DEV_BUILD_MANIFEST);
    const manifestText = labelManifestText(git(['cat-file', 'blob', manifestEntry.object], { raw: true }).out, sha);
    git(['read-tree', '--empty']);
    git(['update-index', '-z', '--index-info'], {
      input: backend.map((entry) => `${entry.mode} ${entry.object}\t${entry.path}\0`).join(''),
    });
    git(['--work-tree', stage, 'add', '-A', '--', DEV_BUILD_TARGET]);
    // Хеш дерева интеграции считается до маркера: маркер лежит вне него.
    const integrationTree = git(['rev-parse', `${git(['write-tree']).out}:${DEV_BUILD_INTEGRATION}`]).out;
    // #836: метка dev-сборки — тоже после хеша. Она внутри интеграции, но
    // хеш описывает содержимое, а не SHA: иначе каждый коммит в dev
    // переставлял бы интеграцию, даже не меняя её.
    const label = { schema: DEV_BUILD_LABEL_SCHEMA, channel: 'dev', source: sha };
    mkdirSync(join(stage, DEV_BUILD_INTEGRATION), { recursive: true });
    writeFileSync(join(stage, DEV_BUILD_MANIFEST), manifestText.text);
    writeFileSync(join(stage, DEV_BUILD_LABEL), `${JSON.stringify(label, null, 2)}\n`);
    git(['--work-tree', stage, 'add', '--', DEV_BUILD_MANIFEST, DEV_BUILD_LABEL]);
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
    return { commit, tree, marker, label, version: manifestText.version };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/**
 * `integrationTree` текущей `dev-build` на удалённом, `''` — ветки нет.
 * Из маркера, а не хешем дерева в ветке: с #836 в дереве лежит метка, и хеш
 * ветки отличается от хеша содержимого на каждом коммите.
 */
function publishedIntegrationTree(git, remote, branch) {
  const tip = git(['ls-remote', remote, `refs/heads/${branch}`]).out.split(/\s+/)[0] || '';
  if (!tip) return '';
  // По имени ветки, а не по SHA: выдачу произвольного SHA сервер может не разрешать.
  const fetched = git(['fetch', '--quiet', '--depth=1', remote, `refs/heads/${branch}`], { allowFailure: true });
  if (!fetched.ok) return '';
  const marker = git(['show', `${tip}:${DEV_BUILD_MARKER}`], { allowFailure: true });
  if (!marker.ok) return '';
  try {
    const tree = JSON.parse(marker.out).integrationTree;
    return typeof tree === 'string' ? tree : '';
  } catch {
    return '';
  }
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
