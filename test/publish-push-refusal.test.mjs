import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUSH_REFUSAL, classifyPushRefusal, refusalSummary } from '../scripts/merge-candidate.mjs';
import { buildIndex } from '../scripts/reviews-index.mjs';

// #723: два шага публикуют коммит и прежде любой отказ push считали сдвигом
// ветки — документ ревью релиза в `dev` (release-review.yml, три попытки) и
// документ ревью в ветку задачи (_process.yml, ребейз и второй push). Теперь
// отказ разбирает код слияния (`merge-candidate.mjs --push-refusal`, #705):
// устаревший lease — прежний повтор/ребейз, отказ GitHub — остановка без
// повторов, причина и ответ git без токена — в журнале и в сводке шага.
//
// Шаги исполняются как есть, настоящим bash и настоящим git во временных
// репозиториях. Подменён только транспорт: `git push` на github.com уходит в
// локальный origin, а заданный отказ GitHub отвечает записанным stderr. Сдвиг
// ветки — настоящий: сосед пушит в origin до push шага, и git сам отвечает
// `! [rejected] … (fetch first)`.
//
// #730: так же исполняются ещё два тела, которые считали любой отказ сдвигом
// `dev`: публикация SHIP-REVIEW (`_ship-review.yml`, три попытки) и бот-коммит
// производных артефактов (`_beta-derived.yml`, совет перезапустить). Страж
// ребейза пишет причину отказа ещё и в сводку — это исполняет
// test/rebase-generated.test.mjs.

const SCRIPTS = fileURLToPath(new URL('../scripts', import.meta.url));
const WORKFLOWS = fileURLToPath(new URL('../.github/workflows/', import.meta.url));

// Окружение git без GIT_* родителя (урок #633) и без глобального конфига (#496).
const ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_COUNT: '3',
  GIT_CONFIG_KEY_0: 'core.autocrlf', GIT_CONFIG_VALUE_0: 'false',
  GIT_CONFIG_KEY_1: 'core.eol', GIT_CONFIG_VALUE_1: 'lf',
  GIT_CONFIG_KEY_2: 'init.defaultBranch', GIT_CONFIG_VALUE_2: 'dev',
};
const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', env: ENV, stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const commitAll = (cwd, msg) => { git(cwd, 'add', '-A'); git(cwd, 'commit', '-q', '-m', msg); };

/** Замыкание относительных импортов модуля (и скриптов, которые он зовёт по `new URL`). */
function importClosure(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const text = readFileSync(entry, 'utf8');
  const specs = [
    ...text.matchAll(/^import[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm),
    ...text.matchAll(/new URL\('(\.{1,2}\/[^']+\.mjs)', import\.meta\.url\)/g),
  ].map((m) => m[1]);
  for (const spec of specs) importClosure(resolve(dirname(entry), spec), seen);
  return seen;
}
/** Скрипты, которые зовут шаги, — с замыканием импортов. */
const STEP_SCRIPTS = ['release-review.mjs', 'ship-review.mjs', 'reviews-index.mjs', 'review-doc-guard.mjs', 'merge-candidate.mjs']
  .reduce((seen, name) => importClosure(join(SCRIPTS, name), seen), new Set());

const hasTools = () => process.platform !== 'win32'
  && ['bash', 'tar', 'jq', 'sha256sum'].every((tool) => spawnSync(tool, ['--version']).status === 0);

const FAKE_TOKEN = 'ghs_' + 'Q1w2E3r4T5y6U7i8O9p0A1s2D3f4G5h6J7k8';
const OTHER_TOKEN = 'ghp_' + 'M1n2B3v4C5x6Z7l8K9j0H1g2F3d4S5a6P7o8';
const SECRETS = [FAKE_TOKEN, OTHER_TOKEN, 'dG9rZW46c2VjcmV0'];
const remoteRejected = (ref, reason) => `To https://github.com/o/r\n ! [remote rejected] HEAD -> ${ref} (${reason})\n`
  + `error: failed to push some refs to 'https://x-access-token:${FAKE_TOKEN}@github.com/o/r'\n`;
const WORKFLOW_REASON = 'refusing to allow a Personal Access Token to create or update workflow `.github/workflows/validate.yml` without `workflow` scope';
// Ответ с заголовком и чужим токеном: так выглядит stderr при GIT_CURL_VERBOSE / GIT_TRACE.
const noisyRejected = (ref) => `> Authorization: Basic dG9rZW46c2VjcmV0\n`
  + `remote: token ${OTHER_TOKEN} is not allowed here\n${remoteRejected(ref, 'protected branch hook declined')}`;
const NETWORK = `fatal: unable to access 'https://x-access-token:${FAKE_TOKEN}@github.com/o/r/': The requested URL returned error: 403\n`;

/**
 * Тело `run:` шага так, как его прочтёт YAML: блок кончается на первой
 * непустой строке с отступом меньше десяти (PROCESS.md §10.4 п.4) — обрезанный
 * скрипт тест увидит, а не пропустит.
 */
function stepRun(file, name) {
  const text = readFileSync(join(WORKFLOWS, file), 'utf8');
  const start = text.indexOf(`      - name: ${name}\n`);
  assert.ok(start >= 0, `шаг «${name}» в ${file}`);
  const lines = text.slice(start).split('\n');
  const from = lines.indexOf('        run: |');
  assert.ok(from > 0, 'у шага есть run: |');
  const body = [];
  for (const line of lines.slice(from + 1)) {
    if (line.trim() && !/^ {10}/.test(line)) break;
    body.push(line.replace(/^ {10}/, ''));
  }
  return body.join('\n').replace(/\$\{\{ github\.repository \}\}/g, 'o/r');
}

const RELEASE_STEP = () => stepRun('release-review.yml', 'Опубликовать документ');
const REVIEW_DOC_STEP = () => stepRun('_process.yml', 'Опубликовать документ ревью');
// #749: скрипты job integrate — одним снимком dev; шаги получают каталог выходом `dir`.
const TOOLS_STEP = () => stepRun('_process.yml', 'Скрипты конвейера — из dev (#749)');
const REPRO_STEP = () => stepRun('_process.yml', '"Материал раунда воспроизводим (#413)"');

/**
 * Песочница: bare origin, рабочая копия, соседний клон и bin с подменами.
 * `git` — настоящий, кроме транспорта push: `push-N.stderr` — ответ N-го push
 * (отказ GitHub), `before-push-N` — сосед пушит свой коммит перед N-м push.
 */
/** Временный корень теста, убираемый after-хуком (#646). */
function tempRoot(t, prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function sandbox(root) {
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  const other = join(root, 'other');
  const temp = join(root, 'runner');
  const fake = join(root, 'fake');
  const bin = join(root, 'bin');
  for (const dir of [temp, fake, bin]) mkdirSync(dir);
  git(root, 'init', '--bare', '-q', origin);
  git(root, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'dev');
  // Скрипты шага — из репозитория как есть: их несёт dev временного origin.
  mkdirSync(join(work, 'scripts'));
  for (const file of STEP_SCRIPTS) copyFileSync(file, join(work, 'scripts', relative(SCRIPTS, file)));
  // #749: снимок скриптов integrate берёт из dev и validate.yml (его читает workflow-jobs.mjs).
  mkdirSync(join(work, '.github', 'workflows'), { recursive: true });
  copyFileSync(join(WORKFLOWS, 'validate.yml'), join(work, '.github', 'workflows', 'validate.yml'));
  mkdirSync(join(work, 'docs', 'reviews'), { recursive: true });
  writeFileSync(join(work, 'docs', 'reviews', 'CODE-REVIEW-1-r1.md'), '# CODE-REVIEW-1-r1\nВердикт: **зелёный** · High: 0 · Medium: 0\n');
  writeFileSync(join(work, 'docs', 'reviews', 'INDEX.md'), buildIndex(join(work, 'docs', 'reviews')));
  writeFileSync(join(work, 'a.mjs'), 'export const a = 1;\n');
  commitAll(work, 'base');
  git(work, 'push', '-q', 'origin', 'dev');
  const realGit = execFileSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  writeFileSync(join(bin, 'git'), [
    '#!/usr/bin/env bash',
    'echo "$*" >> "$FAKE_DIR/calls"',
    'if [ "$1" = push ]; then',
    '  n=$(( $(cat "$FAKE_DIR/pushes" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$FAKE_DIR/pushes"',
    '  if [ -f "$FAKE_DIR/before-push-$n" ]; then "$REAL_GIT" -C "$FAKE_OTHER" push -q origin "$(cat "$FAKE_DIR/before-push-$n")"; fi',
    '  if [ -f "$FAKE_DIR/push-$n.stderr" ]; then cat "$FAKE_DIR/push-$n.stderr" >&2; exit 1; fi',
    '  args=(); for a in "$@"; do case "$a" in https://*) args+=("$FAKE_ORIGIN") ;; *) args+=("$a") ;; esac; done',
    '  exec "$REAL_GIT" "${args[@]}"',
    'fi',
    'exec "$REAL_GIT" "$@"',
    '',
  ].join('\n'), { mode: 0o755 });
  writeFileSync(join(bin, 'sleep'), '#!/bin/sh\necho "$*" >> "$FAKE_DIR/sleeps"\n', { mode: 0o755 });
  const box = {
    root, origin, work, other, temp, fake,
    /** Сосед: коммит в `ref` origin, который уйдёт туда перед push номер `n`. */
    neighbour(ref, n, file, content) {
      if (!existsSync(other)) git(root, 'clone', '-q', origin, other);
      git(other, 'fetch', '-q', 'origin');
      git(other, 'checkout', '-q', '-B', ref, `origin/${ref}`);
      writeFileSync(join(other, file), content);
      commitAll(other, `neighbour ${file}`);
      writeFileSync(join(fake, `before-push-${n}`), `HEAD:${ref}`);
    },
    refuse(n, stderr) { writeFileSync(join(fake, `push-${n}.stderr`), stderr); },
    run(script, env) {
      const summary = join(temp, 'summary.md');
      const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
        cwd: work, encoding: 'utf8',
        env: {
          ...ENV, ...env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: temp, GITHUB_STEP_SUMMARY: summary,
          GITHUB_OUTPUT: join(temp, 'output'), TOKEN: FAKE_TOKEN,
          FAKE_DIR: fake, FAKE_ORIGIN: origin, FAKE_OTHER: other, REAL_GIT: realGit,
        },
      });
      const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
      return {
        status: r.status, stdout: r.stdout, stderr: r.stderr, summary: read(summary),
        pushes: Number(read(join(fake, 'pushes')) || 0),
        calls: read(join(fake, 'calls')).split('\n').filter(Boolean),
        sleeps: read(join(fake, 'sleeps')).split('\n').filter(Boolean),
      };
    },
  };
  return box;
}

const noSecrets = (r) => {
  for (const [where, text] of Object.entries({ stdout: r.stdout, stderr: r.stderr, summary: r.summary })) {
    for (const secret of SECRETS) assert.ok(!text.includes(secret), `${where}: секрет в тексте`);
    assert.doesNotMatch(text, /x-access-token:(?!\*\*\*@)/, `${where}: URL с учётными данными`);
  }
};

// ---------- release-review.yml: документ ревью релиза в dev ----------

const TAG = 'v1.78.0';
const RELEASE_DOC = `docs/reviews/RELEASE-REVIEW-${TAG}.md`;

function runRelease(box) {
  const dir = join(box.temp, 'release-review-result');
  mkdirSync(dir);
  const files = {
    'release-review.md': `# Независимое ревью ${TAG}\n\nИтог: High 0 · Medium 1 · Low 2\n`,
    'result.json': JSON.stringify({ high: 0, medium: 1, low: 2, summary: 'ok' }),
  };
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  writeFileSync(join(dir, 'manifest.sha256'), Object.entries(files)
    .map(([name, text]) => `${createHash('sha256').update(text).digest('hex')}  ${name}\n`).join(''));
  return box.run(RELEASE_STEP(), {
    TAG, DOC: RELEASE_DOC, CANDIDATE: 'c'.repeat(40), BASE: 'v1.77.0', ISSUES: '701,702',
    RUN_URL: 'https://github.com/o/r/actions/runs/42',
  });
}

test('#723 release-review.yml на настоящем bash: dev ушёл вперёд — прежний повтор, документ собран заново поверх соседа', (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const box = sandbox(tempRoot(t, 'hp-723-release-'));
  box.neighbour('dev', 1, 'docs/reviews/CODE-REVIEW-8-r1.md', '# CODE-REVIEW-8-r1\nВердикт: **зелёный** · High: 0 · Medium: 0\n');
  const r = runRelease(box);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.pushes, 2, 'повтор после устаревшего lease');
  assert.deepEqual(r.sleeps, ['10']);
  assert.match(r.stdout, /::warning::dev ушёл вперёд — попытка 1 из 3/);
  assert.match(r.stderr, /git push отклонён — stale \(fetch first\)/, 'разбор отказа — кодом слияния');
  assert.match(r.summary, /^### Независимое ревью v1\.78\.0\nИтог: High 0 · Medium 1 · Low 2 — `docs\/reviews\/RELEASE-REVIEW-v1\.78\.0\.md` в dev\./m);
  assert.doesNotMatch(r.summary, /отклонён/);
  assert.equal(git(box.origin, 'log', '-1', '--format=%B', 'dev'),
    `docs: release review for ${TAG}\n\nНезависимое ревью линии перед стабильным релизом (PROCESS.md §11.5).\n`
    + 'Итог: High 0 · Medium 1 · Low 2. Выпуск не блокирует; решение по находкам — за владельцем.\n\nIssue: #638\nUser-Visible: no');
  assert.deepEqual(git(box.origin, 'show', '--name-only', '--format=', 'dev').split('\n').sort(),
    ['docs/reviews/INDEX.md', RELEASE_DOC], 'коммит несёт документ и индекс');
  const index = git(box.origin, 'show', 'dev:docs/reviews/INDEX.md');
  assert.match(index, /CODE-REVIEW-8-r1/, 'индекс собран поверх сдвинутого dev');
  assert.match(index, /RELEASE-REVIEW-v1\.78\.0/);
  assert.match(git(box.origin, 'show', `dev:${RELEASE_DOC}`), /<!-- hp-release-review-anchors -->\n### Материал ревью\n\n```\ntag v1\.78\.0\n/);
});

test('#737 AC4 _ship-review.yml на настоящем bash: строка расхода сразу после блока, повтор после сдвига dev — одна; без выхода — missing', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const { parseAnchorBlock } = await import('../scripts/ship-review.mjs');
  const { parseUsageLine } = await import('../scripts/model-usage.mjs');
  const box = sandbox(tempRoot(t, 'hp-737-ship-'));
  box.neighbour('dev', 1, 'b.mjs', 'export const b = 1;\n');
  const r = runShip(box, { USAGE });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.pushes, 2, 'документ собран заново после устаревшего lease');
  const doc = git(box.origin, 'show', `dev:${SHIP_DOC}`);
  assert.match(doc, new RegExp(`\npatches —\n\`\`\`\n${USAGE}$`), 'строка — сразу после закрывающего ```');
  assert.equal(doc.split('hp:usage').length - 1, 1, 'строка одна');
  const block = parseAnchorBlock(doc);
  assert.deepEqual(block.usage, parseUsageLine(USAGE));
  assert.deepEqual([block.high, block.medium, block.low, block.issues], [0, 1, 0, [731, 733]], 'поля блока — прежние');
  const bare = sandbox(tempRoot(t, 'hp-737-ship-'));
  assert.equal(runShip(bare).status, 0);
  const missing = git(bare.origin, 'show', `dev:${SHIP_DOC}`);
  assert.equal(lastLine(missing), '<!-- hp:usage-none reason=missing -->');
  assert.deepEqual(parseAnchorBlock(missing).usage, { reason: 'missing' });
});

for (const [label, stderr, kind, reason] of [
  ['право на workflow', remoteRejected('dev', WORKFLOW_REASON), PUSH_REFUSAL.workflow, WORKFLOW_REASON],
  ['прочий [remote rejected] (с заголовком Authorization и чужим токеном)', noisyRejected('dev'), PUSH_REFUSAL.remote, 'protected branch hook declined'],
  ['не отказ (сеть, аутентификация)', NETWORK, PUSH_REFUSAL.unknown, ''],
]) {
  test(`#723 release-review.yml на настоящем bash: ${label} — без повторов, причина и ответ git без токена в журнале и сводке`, (t) => {
    if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
    const box = sandbox(tempRoot(t, 'hp-723-release-'));
    const before = git(box.origin, 'rev-parse', 'dev');
    box.refuse(1, stderr);
    const r = runRelease(box);
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.equal(r.pushes, 1, 'повторов нет');
    assert.deepEqual(r.sleeps, []);
    assert.doesNotMatch(r.stdout, /dev ушёл вперёд/, 'отказ GitHub — не сдвиг dev');
    assert.match(r.stdout, new RegExp(`::error::push docs/reviews/RELEASE-REVIEW-v1\\.78\\.0\\.md в dev отклонён \\(${kind}\\) — это не сдвиг dev`));
    assert.match(r.stderr, new RegExp(`git push отклонён — ${kind}`), 'ответ git — в журнале');
    assert.match(r.summary, new RegExp(`^### git push в \`dev\` отклонён: ${kind} \\(#723\\)$`, 'm'));
    assert.match(r.summary, /Документ независимого ревью релиза не опубликован в `dev`/);
    if (reason) {
      assert.ok(r.summary.includes(`Причина, которую назвал GitHub: «${reason}»`), r.summary);
      assert.ok(r.stderr.includes(reason));
    }
    assert.match(r.summary, /Ответ git:\n\n```\n[\s\S]+\n```\n$/);
    assert.doesNotMatch(r.summary, /Независимое ревью v1\.78\.0/, 'успеха в сводке нет');
    noisySecretsGone(r);
    assert.equal(git(box.origin, 'rev-parse', 'dev'), before, 'dev не тронут');
  });
}

function noisySecretsGone(r) {
  noSecrets(r);
  assert.doesNotMatch(r.summary + r.stderr, /Authorization: Basic (?!\*\*\*)/i);
}

// ---------- _process.yml: документ ревью в ветку задачи ----------

const BRANCH = 'issue/9-fix';
const REVIEW_DOC = 'docs/reviews/CODE-REVIEW-9-r1.md';

function taskBranch(box) {
  git(box.work, 'checkout', '-q', '-b', BRANCH);
  writeFileSync(join(box.work, 'a.mjs'), 'export const a = 9;\n');
  commitAll(box.work, 'fix: a (#9)');
  git(box.work, 'push', '-q', 'origin', BRANCH);
  // Как actions/checkout в integrate: рабочая копия на dev.
  git(box.work, 'checkout', '-q', 'dev');
}

/**
 * #749: шаг снимка как есть — на рабочей копии dev, как после checkout в
 * integrate. Возвращает каталог из его выхода `dir`: его шаги получают env TOOLS.
 */
function devTools(box) {
  const r = box.run(TOOLS_STEP(), {});
  assert.equal(r.status, 0, `снимок скриптов dev: ${r.stderr}${r.stdout}`);
  const dir = readFileSync(join(box.temp, 'output'), 'utf8').match(/^dir=(.+)$/m)?.[1];
  assert.ok(dir && existsSync(join(dir, 'scripts')), 'снимок назвал каталог со scripts/');
  return dir;
}

function runReviewDoc(box, out = '{"verdict":"green","high":0}', extra = {}) {
  const source = join(box.temp, 'review-result', 'review-document.md');
  mkdirSync(join(box.temp, 'review-result'));
  writeFileSync(source, '# Код-ревью #9, раунд 1\n\nВердикт: **зелёный** · High: 0 · Medium: 0\n');
  return box.run(REVIEW_DOC_STEP(), {
    BRANCH, NUM: '9', STAGE: 'code', CYCLE: '1', SOURCE: source, TOOLS: extra.TOOLS ?? devTools(box),
    MATERIAL_SHA: git(box.origin, 'rev-parse', BRANCH), MATERIAL_TREE: git(box.origin, 'rev-parse', `${BRANCH}^{tree}`),
    MATERIAL_SPECS: '', MATERIAL_ISSUE_BODY: '', OUT: out, ...extra,
  });
}

test('#723 _process.yml на настоящем bash: ветка ушла вперёд — прежний ребейз и второй push, документ на ветке', (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const box = sandbox(tempRoot(t, 'hp-723-doc-'));
  taskBranch(box);
  box.neighbour(BRANCH, 1, 'b.mjs', 'export const b = 1;\n');
  const r = runReviewDoc(box);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.pushes, 2);
  assert.ok(r.calls.some((call) => /(^| )rebase origin\/issue\/9-fix$/.test(call)), 'ребейз на сдвинутую ветку');
  assert.match(r.stderr, /git push отклонён — stale \(fetch first\)/);
  assert.match(r.stdout, /документ опубликован в issue\/9-fix: docs\/reviews\/CODE-REVIEW-9-r1\.md/);
  assert.equal(r.summary, '', 'сводка об отказе не пишется: повтор прошёл');
  assert.equal(git(box.origin, 'log', '-1', '--format=%B', BRANCH), 'docs: review document for #9\n\nIssue: #9\nUser-Visible: no');
  assert.deepEqual(git(box.origin, 'show', '--name-only', '--format=', BRANCH).split('\n'), [REVIEW_DOC], 'один документ, без индекса');
  assert.equal(git(box.origin, 'log', '-1', '--format=%s', `${BRANCH}~1`), 'neighbour b.mjs', 'коммит автора не потерян');
});

for (const [label, stderr, kind] of [
  ['право на workflow', remoteRejected(BRANCH, WORKFLOW_REASON), PUSH_REFUSAL.workflow],
  ['прочий [remote rejected] (с заголовком Authorization и чужим токеном)', noisyRejected(BRANCH), PUSH_REFUSAL.remote],
]) {
  test(`#723 _process.yml на настоящем bash: ${label} — без ребейза и второго push, причина в журнале и сводке`, (t) => {
    if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
    const box = sandbox(tempRoot(t, 'hp-723-doc-'));
    taskBranch(box);
    const before = git(box.origin, 'rev-parse', BRANCH);
    box.refuse(1, stderr);
    const r = runReviewDoc(box);
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.equal(r.pushes, 1, 'второго push нет');
    assert.ok(!r.calls.some((call) => /(^| )rebase /.test(call)), 'ребейза нет');
    assert.match(r.stdout, new RegExp(`::error::push документа ревью в issue/9-fix отклонён \\(${kind}\\) — это не сдвиг issue/9-fix`));
    assert.match(r.stderr, new RegExp(`git push отклонён — ${kind}`));
    assert.match(r.summary, new RegExp(`^### git push в \`issue/9-fix\` отклонён: ${kind} \\(#723\\)$`, 'm'));
    assert.match(r.summary, /Документ ревью не опубликован в `issue\/9-fix`/);
    if (kind === PUSH_REFUSAL.workflow) assert.match(r.summary, /Файлы: `\.github\/workflows\/validate\.yml`\./);
    noisySecretsGone(r);
    assert.equal(git(box.origin, 'rev-parse', BRANCH), before, 'ветка не тронута');
  });
}

test('#723 _process.yml на настоящем bash: сдвиг, затем отказ GitHub на втором push — ошибка с причиной, без третьей попытки', (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const box = sandbox(tempRoot(t, 'hp-723-doc-'));
  taskBranch(box);
  box.neighbour(BRANCH, 1, 'b.mjs', 'export const b = 1;\n');
  box.refuse(2, noisyRejected(BRANCH));
  const r = runReviewDoc(box);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(r.pushes, 2);
  assert.match(r.stdout, /::error::документ ревью не опубликован в issue\/9-fix и после ребейза \(remote-rejected\)/);
  assert.match(r.summary, /^### git push в `issue\/9-fix` отклонён: remote-rejected \(#723\)$/m);
  noisySecretsGone(r);
});

test('#726 AC5 _process.yml на настоящем bash: публикация пишет маршрут вердикта хвостом строки якоря', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const { anchorVerdictFrom } = await import('../scripts/review-doc-guard.mjs');
  const anchor = (doc) => doc.split('\n').find((line) => line.startsWith('- Вердикт конвейера:'));
  const routed = sandbox(tempRoot(t, 'hp-726-doc-'));
  taskBranch(routed);
  const r = runReviewDoc(routed, JSON.stringify({ verdict: 'yellow', high: 0, medium: 1, summary: 's', route: 'reclassify', criterion: 'undocumented' }));
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const doc = git(routed.origin, 'show', `${BRANCH}:${REVIEW_DOC}`);
  assert.equal(anchor(doc), '- Вердикт конвейера: `yellow` · High 0 · маршрут `reclassify` (критерий `undocumented`)');
  assert.deepEqual(anchorVerdictFrom(doc), { verdict: 'yellow', high: 0 });
  // Вердикт без route (до #726) — прежняя строка.
  const plain = sandbox(tempRoot(t, 'hp-726-doc-'));
  taskBranch(plain);
  assert.equal(runReviewDoc(plain).status, 0);
  assert.equal(anchor(git(plain.origin, 'show', `${BRANCH}:${REVIEW_DOC}`)), '- Вердикт конвейера: `green` · High 0');
});

// #737 AC3: расход модели — последней строкой блока якорей. Выход job
// `model_review.usage` недоверенный: пусто — `reason=missing`, мусор — `invalid`.
const USAGE = '<!-- hp:usage input_tokens=97209 output_tokens=55524 cache_creation_input_tokens=149047 cache_read_input_tokens=1135731 num_turns=42 -->';
const lastLine = (text) => text.trimEnd().split('\n').at(-1);

test('#737 AC3 _process.yml на настоящем bash: строка расхода — последней в блоке; без выхода модели — missing; мусор — invalid', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const { ANCHOR_MARKER, anchorVerdictFrom, materialAnchorsFrom } = await import('../scripts/review-doc-guard.mjs');
  for (const [label, extra, line] of [
    ['с выходом usage', { USAGE }, USAGE],
    ['выход пуст', { USAGE: '' }, '<!-- hp:usage-none reason=missing -->'],
    ['выхода нет вовсе', {}, '<!-- hp:usage-none reason=missing -->'],
    ['мусор с 40 hex', { USAGE: `<!-- hp:usage input_tokens=${'f'.repeat(40)} -->` }, '<!-- hp:usage-none reason=invalid -->'],
  ]) {
    const box = sandbox(tempRoot(t, 'hp-737-doc-'));
    taskBranch(box);
    const tree = git(box.origin, 'rev-parse', `${BRANCH}^{tree}`);
    const r = runReviewDoc(box, undefined, extra);
    assert.equal(r.status, 0, `${label}: ${r.stderr}${r.stdout}`);
    const doc = git(box.origin, 'show', `${BRANCH}:${REVIEW_DOC}`);
    assert.equal(lastLine(doc), line, label);
    assert.equal(doc.split('hp:usage').length - 1, 1, `${label}: строка одна`);
    assert.ok(doc.indexOf(ANCHOR_MARKER) < doc.indexOf('hp:usage'), `${label}: строка в блоке якорей`);
    assert.deepEqual(anchorVerdictFrom(doc), { verdict: 'green', high: 0 }, label);
    assert.deepEqual(materialAnchorsFrom(doc), [tree], `${label}: новых якорей нет`);
  }
});

test('#737 AC3 _process.yml на настоящем bash: ребейз и второй push — строка расхода одна', (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const box = sandbox(tempRoot(t, 'hp-737-doc-'));
  taskBranch(box);
  box.neighbour(BRANCH, 1, 'b.mjs', 'export const b = 1;\n');
  const r = runReviewDoc(box, undefined, { USAGE });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.pushes, 2);
  assert.ok(r.calls.some((call) => /(^| )rebase origin\/issue\/9-fix$/.test(call)), 'ребейз на сдвинутую ветку');
  const doc = git(box.origin, 'show', `${BRANCH}:${REVIEW_DOC}`);
  assert.equal(lastLine(doc), USAGE);
  assert.equal(doc.split(USAGE).length - 1, 1, 'строка одна');
});

// ---------- #749: скрипты job integrate — из снимка dev ----------

// Ветка show/ship с чистым слиянием до ревью не ребейзится и может нести
// отставший review-doc-guard.mjs: такой молча терял флаги якоря (маршрут #726,
// расход #737). Здесь её версия громкая — пишет маркер в документ и выходит 7.
const BRANCH_GUARD = [
  "import { appendFileSync } from 'node:fs';",
  "const anchor = process.argv.find((arg) => arg.startsWith('--anchor='));",
  "if (anchor) appendFileSync(anchor.slice('--anchor='.length), '\\nBRANCH-VERSION\\n');",
  "appendFileSync(`${process.env.RUNNER_TEMP}/branch-version.log`, `BRANCH-VERSION ${process.argv.slice(2).join(' ')}\\n`);",
  'process.exit(7);',
  '',
].join('\n');

test('#749 AC1 _process.yml на настоящем bash: якорь и проверка #413 — версия dev, скрипт ветки задачи не исполняется', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const { ANCHOR_MARKER, materialAnchorsFrom } = await import('../scripts/review-doc-guard.mjs');
  const box = sandbox(tempRoot(t, 'hp-749-doc-'));
  git(box.work, 'checkout', '-q', '-b', BRANCH);
  writeFileSync(join(box.work, 'a.mjs'), 'export const a = 9;\n');
  writeFileSync(join(box.work, 'scripts', 'review-doc-guard.mjs'), BRANCH_GUARD);
  commitAll(box.work, 'fix: a (#9)');
  git(box.work, 'push', '-q', 'origin', BRANCH);
  git(box.work, 'checkout', '-q', 'dev');
  const tree = git(box.origin, 'rev-parse', `${BRANCH}^{tree}`);
  const branchLog = join(box.temp, 'branch-version.log');
  // Один снимок на job: его каталог получают и публикация, и шаг #413.
  const tools = devTools(box);
  const out = JSON.stringify({ verdict: 'yellow', high: 0, medium: 1, summary: 's', route: 'reclassify', criterion: 'undocumented' });
  const r = runReviewDoc(box, out, { USAGE, TOOLS: tools });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(!existsSync(branchLog), `скрипт ветки задачи исполнялся: ${existsSync(branchLog) ? readFileSync(branchLog, 'utf8') : ''}`);
  const doc = git(box.origin, 'show', `${BRANCH}:${REVIEW_DOC}`);
  assert.doesNotMatch(doc, /BRANCH-VERSION/);
  assert.ok(doc.includes(ANCHOR_MARKER), 'машинный блок якорей');
  assert.match(doc, /^- Вердикт конвейера: `yellow` · High 0 · маршрут `reclassify` \(критерий `undocumented`\)$/m, 'маршрут — из OUT');
  assert.deepEqual(materialAnchorsFrom(doc), [tree]);
  assert.equal(lastLine(doc), USAGE, 'флаг --usage понят: версия dev');
  // Шаг #413 на том же origin: опубликованный документ судит та же версия dev.
  const repro = box.run(REPRO_STEP(), { NUM: '9', STAGE: 'code', CYCLE: '1', BRANCH, TOOLS: tools });
  assert.equal(repro.status, 0, repro.stderr + repro.stdout);
  assert.ok(!existsSync(branchLog), 'шаг #413 не исполнял скрипт ветки задачи');
});

// ---------- #730 _ship-review.yml: SHIP-REVIEW в dev ----------

const SHIP_STEP = () => stepRun('_ship-review.yml', 'Опубликовать документ');
const BETA = 'v1.79.0-beta.1';
const SHIP_DOC = `docs/reviews/SHIP-REVIEW-${BETA}.md`;

function runShip(box, extra = {}) {
  const dir = join(box.temp, 'ship-review-result');
  mkdirSync(dir);
  const files = {
    'ship-review.md': `# Пакетное ревью ship ${BETA}\n\nИтог: High 0 · Medium 1 · Low 0\n`,
    'result.json': JSON.stringify({ high: 0, medium: 1, low: 0, summary: 'ok' }),
  };
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  writeFileSync(join(dir, 'manifest.sha256'), Object.entries(files)
    .map(([name, text]) => `${createHash('sha256').update(text).digest('hex')}  ${name}\n`).join(''));
  return box.run(SHIP_STEP(), {
    TAG: BETA, DOC: SHIP_DOC, CANDIDATE: 'c'.repeat(40), BASE: 'v1.78.0', ISSUES: '731,733',
    RUN_URL: 'https://github.com/o/r/actions/runs/43', ...extra,
  });
}

test('#730 _ship-review.yml на настоящем bash: dev ушёл вперёд — прежний повтор, документ собран заново поверх соседа', (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const box = sandbox(tempRoot(t, 'hp-730-ship-'));
  box.neighbour('dev', 1, 'docs/reviews/CODE-REVIEW-8-r1.md', '# CODE-REVIEW-8-r1\nВердикт: **зелёный** · High: 0 · Medium: 0\n');
  const r = runShip(box);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.pushes, 2, 'повтор после устаревшего lease');
  assert.deepEqual(r.sleeps, ['10']);
  assert.match(r.stdout, /::warning::dev ушёл вперёд — попытка 1 из 3/);
  assert.match(r.stderr, /git push отклонён — stale \(fetch first\)/, 'разбор отказа — кодом слияния');
  assert.match(r.summary, /^### Пакетное ревью ship v1\.79\.0-beta\.1\nЗадачи 731,733 · High 0 · Medium 1 · Low 0 — `docs\/reviews\/SHIP-REVIEW-v1\.79\.0-beta\.1\.md` в dev\./m);
  assert.doesNotMatch(r.summary, /отклонён/);
  assert.equal(git(box.origin, 'log', '-1', '--format=%B', 'dev'),
    `docs: ship review for ${BETA}\n\nПакетное ревью задач track:ship перед бетой (PROCESS.md §11.7).\n`
    + 'Задачи: 731,733. Итог: High 0 · Medium 1 · Low 0.\n\nIssue: #696\nUser-Visible: no');
  assert.deepEqual(git(box.origin, 'show', '--name-only', '--format=', 'dev').split('\n').sort(),
    ['docs/reviews/INDEX.md', SHIP_DOC], 'коммит несёт документ и индекс');
  const index = git(box.origin, 'show', 'dev:docs/reviews/INDEX.md');
  assert.match(index, /CODE-REVIEW-8-r1/, 'индекс собран поверх сдвинутого dev');
  assert.match(index, /SHIP-REVIEW-v1\.79\.0-beta\.1/);
  assert.match(git(box.origin, 'show', `dev:${SHIP_DOC}`), /<!-- hp-ship-review-anchors -->\n### Материал пакетного ревью\n\n```\ntag v1\.79\.0-beta\.1\ncandidate c{40}\nbase v1\.78\.0\nissues 731,733\nhigh 0\nmedium 1\nlow 0\n/);
});

// #748 AC2: ночью (#727) тот же шаг писал в dev «docs: ship review for nightly …
// перед бетой» с трейлером задачи бета-шага. Ночное сообщение — своё: заголовок
// по имени документа, задача ночного режима; бета-сообщение (тест выше) прежнее.
test('#748 AC2 _ship-review.yml на настоящем bash: ночная публикация — свой заголовок, тело и Issue: #727', (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const box = sandbox(tempRoot(t, 'hp-748-ship-'));
  // Ночной документ называется по прошлому тегу кандидата: тег — на родителе.
  git(box.work, 'tag', 'v1.78.0');
  writeFileSync(join(box.work, 'b.mjs'), 'export const b = 1;\n');
  commitAll(box.work, 'fix: b');
  git(box.work, 'push', '-q', 'origin', 'dev');
  const candidate = git(box.work, 'rev-parse', 'HEAD');
  const night = `v1.78.0-dev-${candidate.slice(0, 12)}`;
  const doc = `docs/reviews/SHIP-REVIEW-${night}.md`;
  const r = runShip(box, { TAG: 'nightly', MODE: 'nightly', DOC: doc, CANDIDATE: candidate, BASE: 'v1.78.0' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.pushes, 1);
  assert.equal(git(box.origin, 'log', '-1', '--format=%B', 'dev'),
    `docs: nightly ship review ${night}\n\nНочное пакетное ревью задач track:ship (PROCESS.md §11.7).\n`
    + 'Задачи: 731,733. Итог: High 0 · Medium 1 · Low 0.\n\nIssue: #727\nUser-Visible: no');
  assert.deepEqual(git(box.origin, 'show', '--name-only', '--format=', 'dev').split('\n').sort(),
    ['docs/reviews/INDEX.md', doc], 'коммит несёт ночной документ и индекс');
  assert.match(git(box.origin, 'show', `dev:${doc}`), /\nmode nightly\n/);
});

for (const [label, stderr, kind, reason] of [
  ['право на workflow', remoteRejected('dev', WORKFLOW_REASON), PUSH_REFUSAL.workflow, WORKFLOW_REASON],
  ['прочий [remote rejected] (с заголовком Authorization и чужим токеном)', noisyRejected('dev'), PUSH_REFUSAL.remote, 'protected branch hook declined'],
  ['не отказ (сеть, аутентификация)', NETWORK, PUSH_REFUSAL.unknown, ''],
]) {
  test(`#730 _ship-review.yml на настоящем bash: ${label} — без повторов, причина и ответ git без токена в журнале и сводке`, (t) => {
    if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
    const box = sandbox(tempRoot(t, 'hp-730-ship-'));
    const before = git(box.origin, 'rev-parse', 'dev');
    box.refuse(1, stderr);
    const r = runShip(box);
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.equal(r.pushes, 1, 'повторов нет');
    assert.deepEqual(r.sleeps, []);
    assert.doesNotMatch(r.stdout, /dev ушёл вперёд/, 'отказ GitHub — не сдвиг dev');
    assert.match(r.stdout, new RegExp(`::error::push docs/reviews/SHIP-REVIEW-v1\\.79\\.0-beta\\.1\\.md в dev отклонён \\(${kind}\\) — это не сдвиг dev`));
    assert.match(r.stderr, new RegExp(`git push отклонён — ${kind}`), 'ответ git — в журнале');
    assert.match(r.summary, new RegExp(`^### git push в \`dev\` отклонён: ${kind} \\(#723\\)$`, 'm'));
    assert.match(r.summary, /Документ пакетного ревью ship не опубликован в `dev`/);
    if (reason) {
      assert.ok(r.summary.includes(`Причина, которую назвал GitHub: «${reason}»`), r.summary);
      assert.ok(r.stderr.includes(reason));
    }
    assert.match(r.summary, /Ответ git:\n\n```\n[\s\S]+\n```\n$/);
    assert.doesNotMatch(r.summary, /Пакетное ревью ship v1/, 'успеха в сводке нет');
    noisySecretsGone(r);
    assert.equal(git(box.origin, 'rev-parse', 'dev'), before, 'dev не тронут');
  });
}

test('#730 _ship-review.yml на настоящем bash: сдвиг, затем отказ GitHub на второй попытке — стоп без третьей', (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const box = sandbox(tempRoot(t, 'hp-730-ship-'));
  box.neighbour('dev', 1, 'b.mjs', 'export const b = 1;\n');
  box.refuse(2, noisyRejected('dev'));
  const r = runShip(box);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(r.pushes, 2);
  assert.deepEqual(r.sleeps, ['10'], 'сдвиг — повтор, отказ — нет');
  assert.match(r.stdout, /::error::push docs\/reviews\/SHIP-REVIEW-v1\.79\.0-beta\.1\.md в dev отклонён \(remote-rejected\)/);
  assert.doesNotMatch(r.stdout, /попытка 2 из 3/);
  assert.match(r.summary, /^### git push в `dev` отклонён: remote-rejected \(#723\)$/m);
  noisySecretsGone(r);
});

// ---------- #730 _beta-derived.yml: бот-коммит производных артефактов в dev ----------

const DERIVED_STEP = () => stepRun('_beta-derived.yml', 'Коммит в dev');

/** Кадры и эталоны на dev, как после checkout. */
function derivedSandbox(t) {
  const box = sandbox(tempRoot(t, 'hp-730-derived-'));
  mkdirSync(join(box.work, 'docs', 'images'), { recursive: true });
  mkdirSync(join(box.work, 'demo', 'golden', 'baselines'), { recursive: true });
  writeFileSync(join(box.work, 'docs', 'images', 'screenshots.json'), '{"fingerprint":"old"}\n');
  writeFileSync(join(box.work, 'demo', 'golden', 'baselines', 'a.png'), 'png');
  commitAll(box.work, 'artifacts');
  git(box.work, 'push', '-q', 'origin', 'dev');
  return box;
}

/** Шаг съёмки изменил отпечаток; коммит и push — шагом как есть. */
function runDerived(box) {
  writeFileSync(join(box.work, 'docs', 'images', 'screenshots.json'), '{"fingerprint":"new"}\n');
  return box.run(DERIVED_STEP(), {
    TAG: BETA, DOCS_CHANGED: 'true', DOCS_EXPECT: '', GOLDEN_CHANGED: '', GOLDEN_URL: '',
    GOLDEN_EXPECT_CHANGE: '', GOLDEN_EXPECT_NEW: '', RUN_URL: 'https://github.com/o/r/actions/runs/44', HP_PREPUSH_GATE: '0',
  });
}

test('#730 _beta-derived.yml на настоящем bash: push прошёл — коммит в dev, сводка об успехе, разбора нет', (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const box = derivedSandbox(t);
  const r = runDerived(box);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(r.pushes, 1);
  assert.match(r.summary, /^### Производные артефакты v1\.79\.0-beta\.1\nКоммит `[0-9a-f]+` в dev — проверить перед кандидатом беты\.\n$/);
  assert.doesNotMatch(r.stderr, /git push отклонён/);
  assert.equal(git(box.origin, 'log', '-1', '--format=%s', 'dev'), `docs: accept derived artifacts on dev for ${BETA}`);
  assert.deepEqual(git(box.origin, 'show', '--name-only', '--format=', 'dev').split('\n'), ['docs/images/screenshots.json']);
});

test('#730 _beta-derived.yml на настоящем bash: dev ушёл вперёд — прежний совет перезапустить, сводки об отказе нет', (t) => {
  if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
  const box = derivedSandbox(t);
  box.neighbour('dev', 1, 'b.mjs', 'export const b = 1;\n');
  const r = runDerived(box);
  assert.equal(r.status, 1, r.stderr + r.stdout);
  assert.equal(r.pushes, 1, 'шаг не повторяет сам: отпечаток судит дерево');
  assert.match(r.stdout, /::error::dev ушёл вперёд за время съёмки — запустить workflow заново/);
  assert.match(r.stderr, /git push отклонён — stale \(fetch first\)/, 'разбор отказа — кодом слияния');
  assert.equal(r.summary, '', 'устаревший lease сводку не пишет');
  assert.equal(git(box.origin, 'log', '-1', '--format=%s', 'dev'), 'neighbour b.mjs', 'dev — соседа, коммит бота не ушёл');
});

for (const [label, stderr, kind, reason] of [
  ['право на workflow', remoteRejected('dev', WORKFLOW_REASON), PUSH_REFUSAL.workflow, WORKFLOW_REASON],
  ['прочий [remote rejected] (с заголовком Authorization и чужим токеном)', noisyRejected('dev'), PUSH_REFUSAL.remote, 'protected branch hook declined'],
  ['не отказ (сеть, аутентификация)', NETWORK, PUSH_REFUSAL.unknown, ''],
]) {
  test(`#730 _beta-derived.yml на настоящем bash: ${label} — не «dev ушёл вперёд», причина и ответ git без токена в журнале и сводке`, (t) => {
    if (!hasTools()) { t.skip('bash/tar/jq/sha256sum недоступны'); return; }
    const box = derivedSandbox(t);
    const before = git(box.origin, 'rev-parse', 'dev');
    box.refuse(1, stderr);
    const r = runDerived(box);
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.equal(r.pushes, 1);
    assert.doesNotMatch(r.stdout, /dev ушёл вперёд/, 'отказ GitHub — не сдвиг dev');
    assert.match(r.stdout, new RegExp(`::error::push производных артефактов в dev отклонён \\(${kind}\\) — это не сдвиг dev, перезапуск не поможет`));
    assert.match(r.stderr, new RegExp(`git push отклонён — ${kind}`), 'ответ git — в журнале');
    assert.match(r.summary, new RegExp(`^### git push в \`dev\` отклонён: ${kind} \\(#723\\)$`, 'm'));
    assert.match(r.summary, /Коммит производных артефактов беты не опубликован в `dev`/);
    if (reason) {
      assert.ok(r.summary.includes(`Причина, которую назвал GitHub: «${reason}»`), r.summary);
      assert.ok(r.stderr.includes(reason));
    }
    assert.match(r.summary, /Ответ git:\n\n```\n[\s\S]+\n```\n$/);
    assert.doesNotMatch(r.summary, /Производные артефакты v1/, 'успеха в сводке нет');
    noisySecretsGone(r);
    assert.equal(git(box.origin, 'rev-parse', 'dev'), before, 'dev не тронут');
  });
}

// ---------- AC3 и разбор: тексты — из кода, не из run ----------

test('#723 AC3: в run обоих шагов нет многострочного текста и heredoc; отказ разбирает код слияния', () => {
  for (const [label, body, tools] of [['release-review.yml', RELEASE_STEP(), 'scripts'], ['_process.yml', REVIEW_DOC_STEP(), '"$TOOLS/scripts']]) {
    assert.doesNotMatch(body, /<<-?\s*['"]?[A-Za-z_]/, `${label}: heredoc в run`);
    assert.ok(body.includes(`kind=$(node ${tools}/merge-candidate.mjs`), `${label}: разбор — merge-candidate.mjs --push-refusal`);
    assert.match(body, /--push-refusal="\$push_err"[^\n]*\\\n[^\n]*--summary="\$GITHUB_STEP_SUMMARY"\) \|\| kind=unknown/, `${label}: сводку пишет код`);
    assert.match(body, /2> "\$push_err"; then/, `${label}: stderr push идёт в разбор`);
  }
  // Шаг _process.yml берёт разбор из снимка dev (#749): ветка задачи, отставшая от dev, его может не нести.
  assert.doesNotMatch(REVIEW_DOC_STEP(), /git archive/, 'своего извлечения у шага нет — снимок job');
  assert.match(TOOLS_STEP(), /git archive origin\/dev scripts \.github\/workflows\/validate\.yml \| tar -x -C "\$tools"/);
  // Блок run не обрезан: последняя строка каждого шага на месте.
  assert.match(RELEASE_STEP(), /echo "::error::документ ревью не опубликован в dev за три попытки"\nexit 1\n*$/);
  assert.match(REVIEW_DOC_STEP(), /echo "документ опубликован в \$target: \$doc"\n*$/);
});

test('#730 AC3: тела _ship-review.yml и _beta-derived.yml — без heredoc, разбор кодом слияния из dev, сводку пишет код', () => {
  const read = (name) => readFileSync(join(WORKFLOWS, name), 'utf8');
  for (const [label, body] of [['_ship-review.yml', SHIP_STEP()], ['_beta-derived.yml', DERIVED_STEP()]]) {
    assert.doesNotMatch(body, /<<-?\s*['"]?[A-Za-z_]/, `${label}: heredoc в run`);
    assert.ok(body.includes('kind=$(node scripts/merge-candidate.mjs'), `${label}: разбор — merge-candidate.mjs --push-refusal`);
    assert.match(body, /--push-refusal="\$push_err"[^\n]*\\\n[^\n]*--summary="\$GITHUB_STEP_SUMMARY"\) \|\| kind=unknown/, `${label}: сводку пишет код`);
    assert.match(body, /HEAD:dev 2> "\$push_err"; then/, `${label}: stderr push идёт в разбор`);
  }
  // Разбор — из dev: job берёт dev, публикация ship ещё и сбрасывается на
  // origin/dev перед каждой попыткой, до разбора её отказа.
  const job = (text, name) => text.slice(text.indexOf(`\n  ${name}:`));
  assert.match(job(read('_ship-review.yml'), 'publish'), /actions\/checkout@[^\n]+\n\s+with:\n\s+fetch-depth: 0\n\s+ref: dev\n/);
  assert.match(job(read('_beta-derived.yml'), 'accept'), /actions\/checkout@[^\n]+\n\s+with:\n\s+ref: dev\n/);
  const ship = SHIP_STEP();
  const loop = ship.slice(ship.indexOf('for attempt in 1 2 3; do'));
  assert.ok(loop.indexOf('git reset -q --hard origin/dev') >= 0
    && loop.indexOf('git reset -q --hard origin/dev') < loop.indexOf('kind=$(node scripts/merge-candidate.mjs'));
  // Блок run не обрезан: последняя строка каждого шага на месте.
  assert.match(ship, /echo "::error::документ ревью не опубликован в dev за три попытки"\nexit 1\n*$/);
  assert.match(DERIVED_STEP(), /в dev — проверить перед кандидатом беты\." >> "\$GITHUB_STEP_SUMMARY"\n*$/);
});

test('#730: подписи сводки для публикации ship, производных артефактов и стража ребейза', () => {
  const refusal = classifyPushRefusal(remoteRejected('dev', 'protected branch hook declined'));
  assert.match(refusalSummary(refusal, { ref: 'dev', stage: 'ship-review' }), /\n\nДокумент пакетного ревью ship не опубликован в `dev`\./);
  assert.match(refusalSummary(refusal, { ref: 'dev', stage: 'beta-derived' }), /\n\nКоммит производных артефактов беты не опубликован в `dev`\./);
  assert.match(refusalSummary(refusal, { ref: 'issue/9-fix', stage: 'rebase' }), /\n\nРебейз ветки на dev не опубликован в `issue\/9-fix`\./);
});

test('#730 r1: при отказе по праву на workflow сводка зовёт автора сделать ребейз, а не отговаривает', () => {
  const workflow = refusalSummary(classifyPushRefusal(remoteRejected('issue/9-fix', WORKFLOW_REASON)), { ref: 'issue/9-fix', stage: 'rebase' });
  assert.match(workflow, /ребейз и push делает автор, либо владелец выдаёт право/);
  assert.doesNotMatch(workflow, /ребейз не помогут/);
  const remote = refusalSummary(classifyPushRefusal(remoteRejected('dev', 'protected branch hook declined')), { ref: 'dev', stage: 'ship-review' });
  assert.match(remote, /повтор и ребейз не помогут/);
  assert.doesNotMatch(remote, /ребейз и push делает автор/);
});

test('#723 AC2: сводка об отказе — без токена, URL с учётными данными и Authorization; причина и файлы названы', () => {
  const refusal = classifyPushRefusal(`> Authorization: Bearer ${OTHER_TOKEN}\n${remoteRejected('dev', WORKFLOW_REASON)}`, { secrets: [FAKE_TOKEN] });
  const text = refusalSummary(refusal, { ref: 'dev', stage: 'release-review' });
  for (const secret of SECRETS) assert.ok(!text.includes(secret));
  assert.doesNotMatch(text, /x-access-token:(?!\*\*\*@)/);
  assert.match(text, /Authorization: Bearer \*\*\*/);
  assert.match(text, /^### git push в `dev` отклонён: workflow \(#723\)\n\nДокумент независимого ревью релиза не опубликован в `dev`\. GitHub отклонил push по праву на workflow/);
  assert.match(text, /Файлы: `\.github\/workflows\/validate\.yml`\./);
  // ``` в ответе git не закрывает блок кода сводки
  const fenced = refusalSummary(classifyPushRefusal(remoteRejected('dev', 'hook declined ```x```')), { ref: 'dev', stage: 'review-doc' });
  assert.equal(fenced.match(/```/g).length, 2);
});

test('#723 CLI --summary: для устаревшего lease сводку не пишет (шаг повторяет), для отказа GitHub — дописывает', () => {
  const temp = mkdtempSync(join(tmpdir(), 'hp-723-cli-'));
  try {
    const cli = join(SCRIPTS, 'merge-candidate.mjs');
    const summary = join(temp, 'summary.md');
    writeFileSync(summary, 'прежнее\n');
    const run = (stderr) => {
      writeFileSync(join(temp, 'push.stderr'), stderr);
      return spawnSync(process.execPath, [cli, `--push-refusal=${join(temp, 'push.stderr')}`, '--ref=dev', '--stage=release-review', `--summary=${summary}`], {
        encoding: 'utf8', env: { ...ENV, TOKEN: FAKE_TOKEN },
      });
    };
    const stale = run(' ! [rejected]        HEAD -> dev (fetch first)\nerror: failed to push some refs\n');
    assert.equal(stale.status, 0);
    assert.equal(stale.stdout, 'stale\n');
    assert.equal(readFileSync(summary, 'utf8'), 'прежнее\n', 'stale — без сводки');
    const refused = run(remoteRejected('dev', 'protected branch hook declined'));
    assert.equal(refused.stdout, 'remote-rejected\n');
    const text = readFileSync(summary, 'utf8');
    assert.ok(text.startsWith('прежнее\n### git push в `dev` отклонён: remote-rejected (#723)\n'), 'дописывает, не затирает');
    assert.ok(!text.includes(FAKE_TOKEN) && !refused.stderr.includes(FAKE_TOKEN));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
