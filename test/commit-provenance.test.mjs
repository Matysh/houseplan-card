import assert from 'node:assert/strict';
import test from 'node:test';
import {
  terminalTrailers,
  validateCommitMessage,
} from '../scripts/validate-commit-provenance.mjs';

test('provenance accepts positive issues and one visibility trailer at the end', () => {
  const message = `Fix relay\n\nIssue: #94\nIssue: #98\nUser-Visible: yes\n`;
  assert.deepEqual(validateCommitMessage(message), []);
  assert.deepEqual(terminalTrailers(message).get('Issue'), ['#94', '#98']);
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
