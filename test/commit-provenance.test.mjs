import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertHookMode,
  cleanedCommitMessage,
  resolveValidationRange,
  terminalTrailers,
  validateCommitMessage,
} from '../scripts/validate-commit-provenance.mjs';

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
