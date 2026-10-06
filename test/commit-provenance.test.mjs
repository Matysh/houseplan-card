import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SPEC_DRAFT_VALUE,
  assertHookMode,
  cleanedCommitMessage,
  resolveValidationRange,
  specDraftValues,
  terminalTrailers,
  validateHistoricalCommit,
  validateCommitMessage,
} from '../scripts/validate-commit-provenance.mjs';
import * as processGate from '../scripts/process-gate.mjs';

test('provenance accepts positive issues and one visibility trailer at the end', () => {
  const message = `Fix relay\n\nIssue: #94\nIssue: #98\nUser-Visible: yes\n`;
  assert.deepEqual(validateCommitMessage(message, [
    'docs/CHANGELOG.md', 'docs/CHANGELOG.ru.md',
  ]), []);
  assert.deepEqual(terminalTrailers(message).get('Issue'), ['#94', '#98']);
});

test('editor comments and scissors suffix do not hide terminal trailers', () => {
  const message = `Fix relay\n\nIssue: #94\nUser-Visible: no\n# Please enter the commit message\n# On branch dev\n`;
  assert.deepEqual(validateCommitMessage(message), []);
  assert.equal(cleanedCommitMessage(`${message}# ------------------------ >8 ------------------------\nignored`)
    .includes('ignored'), false);
});

test('user-visible provenance requires both localized changelogs', () => {
  const message = 'Fix UI\n\nIssue: #94\nUser-Visible: yes';
  assert.match(validateCommitMessage(message, [])[0], /CHANGELOG\.md/);
  assert.deepEqual(validateCommitMessage(message, [
    'docs/CHANGELOG.md', 'docs/CHANGELOG.ru.md',
  ]), []);
});

test('hook mode requires the executable index bit', () => {
  assert.doesNotThrow(() => assertHookMode('100755 deadbeef 0\t.githooks/commit-msg'));
  assert.throws(
    () => assertHookMode('100644 deadbeef 0\t.githooks/commit-msg'),
    /must be tracked as executable/,
  );
});

test('validation range uses PR ancestry, push before and dev for a new issue branch', () => {
  const calls = [];
  const runner = (args) => {
    calls.push(args);
    return args[0] === 'merge-base' ? 'common-base' : 'exists';
  };
  assert.equal(resolveValidationRange({
    eventName: 'pull_request', baseSha: 'base', headSha: 'head',
  }, runner), 'common-base..head');
  assert.deepEqual(calls.at(-1), ['merge-base', 'base', 'head']);
  assert.equal(resolveValidationRange({
    // GitHub's default branch is main, but House Plan issue branches start at
    // dev. The all-zero first-push SHA must therefore compare with origin/dev.
    eventName: 'push', beforeSha: '000000', headSha: 'head',
  }, runner), 'common-base..head');
  assert.deepEqual(calls.at(-1), ['merge-base', 'refs/remotes/origin/dev', 'head']);
  assert.equal(resolveValidationRange({
    eventName: 'push', beforeSha: 'before', headSha: 'head', developmentBranch: 'dev',
  }, runner), 'common-base..head');
  assert.deepEqual(calls.at(-1), ['merge-base', 'before', 'head']);
});

test('provenance ignores trailer-like prose and rejects zero or duplicate visibility', () => {
  assert.notDeepEqual(validateCommitMessage('Issue: #12\n\nExplanation after it'), []);
  assert.notDeepEqual(validateCommitMessage('Fix\n\nIssue: #0\nUser-Visible: no'), []);
  assert.notDeepEqual(validateCommitMessage(
    'Fix\n\nIssue: #12\nUser-Visible: no\nUser-Visible: yes',
  ), []);
});

test('golden files require exact release-review provenance', () => {
  const changed = ['demo/golden/baselines/example.png'];
  const base = 'Update baseline\n\nIssue: #75\nUser-Visible: no';
  assert.equal(validateCommitMessage(base, changed).length, 2);
  assert.deepEqual(validateCommitMessage(
    `${base}\nRelease: v1.2.3-beta.1\nBaseline-Reviewed: https://example.test/run`, changed,
  ), []);
});

test('#641: a local WSL review trailer is exclusive and bound to the accepted index', () => {
  const changed = ['demo/golden/baselines/example.png'];
  const digest = 'a'.repeat(64);
  const base = 'Update baseline\n\nIssue: #641\nUser-Visible: no\nRelease: v1.2.3-beta.1';
  const local = `${base}\nBaseline-Reviewed-Local: sha256:${digest}`;
  const index = { localAttestation: { sha256: digest } };
  assert.deepEqual(validateCommitMessage(local, changed, { baselineIndex: index }), []);
  assert.match(validateCommitMessage(local, changed, {
    baselineIndex: { localAttestation: { sha256: 'b'.repeat(64) } },
  }).join('\n'), /does not match/);
  assert.match(validateCommitMessage(
    `${local}\nBaseline-Reviewed: https:\/\/example.test\/run`, changed, { baselineIndex: index },
  ).join('\n'), /requires one Baseline-Reviewed or Baseline-Reviewed-Local/);
  assert.match(validateCommitMessage(
    `${base}\nBaseline-Reviewed-Local: sha256:ABC`, changed, { baselineIndex: index },
  ).join('\n'), /64 lowercase hex/);
});

test('the audited beta.2 baseline exception is exact and golden-only', () => {
  const changed = ['demo/golden/baselines/example.png'];
  const message = 'Update baseline\n\nIssue: #426\nUser-Visible: no';
  const audited = 'd4dd027b0a27c3c290195cb0e504b1a44c4c2611';
  assert.deepEqual(validateHistoricalCommit(audited, message, changed), []);
  assert.equal(validateHistoricalCommit(`${audited.slice(0, -1)}2`, message, changed).length, 2);
  assert.match(validateHistoricalCommit(audited, 'Update baseline', changed)[0], /Issue/);
});

// #701 (PROCESS.md §3 п.10): трейлеры — только на коммитах с продуктовыми и
// инфраструктурными файлами; документационный коммит их не требует.
test('#701: документационный коммит (только класс C) трейлеров не требует', () => {
  assert.deepEqual(validateCommitMessage('docs: fix a typo in the guide', ['docs/USER-GUIDE.md', 'README.md']), []);
  assert.deepEqual(validateCommitMessage('docs: changelog wording', ['docs/CHANGELOG.md']), []);
  // Хоть один файл вне класса C — прежнее правило.
  assert.equal(validateCommitMessage('fix: x', ['docs/USER-GUIDE.md', 'src/card.ts']).length, 2);
  assert.equal(validateCommitMessage('test: x', ['test/a.test.mjs']).length, 2);
  assert.equal(validateCommitMessage('build: x', ['dist/houseplan-card.js']).length >= 2, true);
  // Судить нечем — не документационный коммит.
  assert.equal(validateCommitMessage('docs: typo', []).length, 2);
  // Трейлер, если он есть, судится всегда: кривой номер — ошибка и в docs-коммите.
  assert.equal(validateCommitMessage('docs: typo\n\nIssue: #x', ['docs/a.md']).length, 2);
  assert.deepEqual(validateCommitMessage('docs: typo\n\nIssue: #9\nUser-Visible: no', ['docs/a.md']), []);
});

// #766: формат трейлера черновика `track:ask` (PROCESS.md §11.8) судит уже
// commit-msg — тем же разбором, что правило 10 process-gate. Эпоху S4, трек и
// SPEC-REVIEW хук не судит: это сеть, она остаётся правилу 10.
const DRAFT_BASE = 'feat: draft (#729)\n\nIssue: #729\nUser-Visible: no';
const DRAFT_HEX = 'a'.repeat(64);
const FORMAT = "Spec-Draft must be 'sha256:<64 lowercase hex>'";

test('#766: Spec-Draft — ровно один и sha256:<64 строчных hex>; обычный коммит без него проходит', () => {
  const code = ['src/a.ts'];
  assert.deepEqual(validateCommitMessage(DRAFT_BASE, code), [], 'обычный коммит трейлера не требует');
  assert.deepEqual(validateCommitMessage(`${DRAFT_BASE}\nSpec-Draft: sha256:${DRAFT_HEX}`, code), [], 'корректный черновик');
  for (const [label, trailer] of [
    ['не hex (проба аналитики)', 'Spec-Draft: sha256:wrong'],
    ['63 знака', `Spec-Draft: sha256:${DRAFT_HEX.slice(1)}`],
    ['заглавные', `Spec-Draft: sha256:${'A'.repeat(64)}`],
    ['без префикса', `Spec-Draft: ${DRAFT_HEX}`],
    ['пустое значение', 'Spec-Draft:'],
    ['ключ в другом регистре — тот же трейлер', 'spec-draft: sha256:x'],
  ]) assert.deepEqual(validateCommitMessage(`${DRAFT_BASE}\n${trailer}`, code), [FORMAT], label);
  assert.deepEqual(validateCommitMessage(`${DRAFT_BASE}\nSpec-Draft: sha256:${DRAFT_HEX}\nSpec-Draft: sha256:${DRAFT_HEX}`, code),
    ["expected at most one 'Spec-Draft' trailer, found 2"], 'повтор, даже одинаковый');
  assert.deepEqual(validateCommitMessage(`${DRAFT_BASE}\n# Spec-Draft: sha256:wrong\n`, code), [], 'комментарий редактора — не трейлер');
  // Трейлер, если он есть, судится и в документационном коммите (#701).
  assert.deepEqual(validateCommitMessage('docs: x\n\nSpec-Draft: sha256:wrong', ['docs/a.md']), [FORMAT]);
});

test('#766: commit-msg и правило 10 читают Spec-Draft одним разбором и одним форматом', () => {
  assert.equal(processGate.SPEC_DRAFT_VALUE, SPEC_DRAFT_VALUE, 'формат — один объект');
  for (const body of [
    'Issue: #729\nUser-Visible: no',
    `Issue: #729\nUser-Visible: no\nSpec-Draft: sha256:${DRAFT_HEX}`,
    'Issue: #729\nSpec-Draft: sha256:wrong\nUser-Visible: no',
    `Spec-Draft: sha256:${DRAFT_HEX}\n\nIssue: #729\nUser-Visible: no\nspec-draft: sha256:${DRAFT_HEX}`,
    'Issue: #729\nUser-Visible: no\nSpec-Draft:',
  ]) {
    const drafts = processGate.makeCommit({ subject: 'feat: x', body }).specDrafts;
    assert.deepEqual(drafts, specDraftValues(body), body);
    // Правило 10 отказывает черновику при `drafts.length !== 1` или неверном значении;
    // хук — при тех же условиях, если трейлер вообще есть.
    const rule10 = drafts.length !== 1 || !SPEC_DRAFT_VALUE.test(drafts[0]);
    const hook = validateCommitMessage(`feat: x\n\n${body}`, ['src/a.ts']).some((error) => /Spec-Draft/.test(error));
    assert.equal(hook, drafts.length > 0 && rule10, body);
  }
});

test('#766: настоящий .githooks/commit-msg — неверный Spec-Draft отвергнут, верный и обычный коммиты проходят', (t) => {
  if (process.platform === 'win32' || spawnSync('git', ['--version']).status !== 0) { t.skip('git/sh недоступны'); return; }
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const root = mkdtempSync(join(tmpdir(), 'hp-766-msg-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // Окружение git без GIT_* родителя и без глобального конфига (#633, #496).
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  };
  const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env });
  const ok = (r) => { assert.equal(r.status, 0, r.stderr); return r; };
  ok(git('init', '-q', '-b', 'dev'));
  // Хук и все скрипты верхнего уровня — без ручного списка импортов валидатора.
  mkdirSync(join(root, '.githooks'));
  copyFileSync(join(repo, '.githooks', 'commit-msg'), join(root, '.githooks', 'commit-msg'));
  chmodSync(join(root, '.githooks', 'commit-msg'), 0o755);
  mkdirSync(join(root, 'scripts'));
  for (const name of readdirSync(join(repo, 'scripts')).filter((file) => file.endsWith('.mjs'))) {
    copyFileSync(join(repo, 'scripts', name), join(root, 'scripts', name));
  }
  ok(git('add', '-A'));
  ok(git('update-index', '--chmod=+x', '.githooks/commit-msg'));
  ok(git('-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'base\n\nIssue: #766\nUser-Visible: no'));
  let n = 0;
  const commit = (message) => {
    n += 1;
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'a.ts'), `export const a = ${n};\n`);
    ok(git('add', 'src/a.ts'));
    writeFileSync(join(root, 'msg'), message);
    return git('-c', 'core.hooksPath=.githooks', 'commit', '-q', '-F', join(root, 'msg'));
  };
  const head = () => git('rev-parse', 'HEAD').stdout.trim();
  for (const trailer of ['Spec-Draft: sha256:wrong', `Spec-Draft: sha256:${DRAFT_HEX}\nSpec-Draft: sha256:${DRAFT_HEX}`]) {
    const before = head();
    const refused = commit(`${DRAFT_BASE}\n${trailer}\n`);
    assert.notEqual(refused.status, 0, `хук пропустил:\n${trailer}`);
    assert.match(refused.stderr, /Spec-Draft/);
    assert.equal(head(), before, 'коммит не создан');
    ok(git('reset', '-q'));
  }
  ok(commit(`${DRAFT_BASE}\nSpec-Draft: sha256:${DRAFT_HEX}\n`));
  ok(commit(`${DRAFT_BASE}\n`));
});
