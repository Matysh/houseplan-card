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
/** Скрипты, которые зовут оба шага, — с замыканием импортов. */
const STEP_SCRIPTS = ['release-review.mjs', 'reviews-index.mjs', 'review-doc-guard.mjs', 'merge-candidate.mjs']
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

function runReviewDoc(box) {
  const source = join(box.temp, 'review-result', 'review-document.md');
  mkdirSync(join(box.temp, 'review-result'));
  writeFileSync(source, '# Код-ревью #9, раунд 1\n\nВердикт: **зелёный** · High: 0 · Medium: 0\n');
  return box.run(REVIEW_DOC_STEP(), {
    BRANCH, NUM: '9', STAGE: 'code', CYCLE: '1', SOURCE: source,
    MATERIAL_SHA: git(box.origin, 'rev-parse', BRANCH), MATERIAL_TREE: git(box.origin, 'rev-parse', `${BRANCH}^{tree}`),
    MATERIAL_SPECS: '', MATERIAL_ISSUE_BODY: '', OUT: '{"verdict":"green","high":0}',
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

// ---------- AC3 и разбор: тексты — из кода, не из run ----------

test('#723 AC3: в run обоих шагов нет многострочного текста и heredoc; отказ разбирает код слияния', () => {
  for (const [label, body, tools] of [['release-review.yml', RELEASE_STEP(), 'scripts'], ['_process.yml', REVIEW_DOC_STEP(), '"$tools/scripts']]) {
    assert.doesNotMatch(body, /<<-?\s*['"]?[A-Za-z_]/, `${label}: heredoc в run`);
    assert.ok(body.includes(`kind=$(node ${tools}/merge-candidate.mjs`), `${label}: разбор — merge-candidate.mjs --push-refusal`);
    assert.match(body, /--push-refusal="\$push_err"[^\n]*\\\n[^\n]*--summary="\$GITHUB_STEP_SUMMARY"\) \|\| kind=unknown/, `${label}: сводку пишет код`);
    assert.match(body, /2> "\$push_err"; then/, `${label}: stderr push идёт в разбор`);
  }
  // Шаг _process.yml берёт разбор из dev: ветка задачи, отставшая от dev, его может не нести.
  assert.match(REVIEW_DOC_STEP(), /git archive origin\/dev scripts \| tar -x -C "\$tools"/);
  // Блок run не обрезан: последняя строка каждого шага на месте.
  assert.match(RELEASE_STEP(), /echo "::error::документ ревью не опубликован в dev за три попытки"\nexit 1\n*$/);
  assert.match(REVIEW_DOC_STEP(), /echo "документ опубликован в \$target: \$doc"\n*$/);
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
