import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyValidateRuns, workflowRunsUrl } from '../scripts/release-gate.mjs';

test('release gate waits until an exact-SHA Validate exists and completes', () => {
  assert.equal(classifyValidateRuns([]), 'wait');
  assert.equal(classifyValidateRuns([{ status: 'queued', conclusion: null }]), 'wait');
  assert.equal(classifyValidateRuns([
    { status: 'completed', conclusion: 'success' },
    { status: 'in_progress', conclusion: null },
  ]), 'wait');
});

test('release gate accepts only completed success runs', () => {
  assert.equal(classifyValidateRuns([
    { status: 'completed', conclusion: 'success' },
    { status: 'completed', conclusion: 'success' },
  ]), 'success');
});

test('release gate fails closed for red, cancelled and skipped runs', () => {
  for (const conclusion of ['failure', 'cancelled', 'timed_out', 'action_required', 'skipped', null]) {
    assert.equal(
      classifyValidateRuns([{ status: 'completed', conclusion }]),
      'fail',
      `completed/${conclusion} must withhold the asset`,
    );
  }
});

test('one red duplicate blocks a green duplicate for the same SHA', () => {
  assert.equal(classifyValidateRuns([
    { status: 'completed', conclusion: 'success' },
    { status: 'completed', conclusion: 'failure' },
  ]), 'fail');
});

test('release gate can target the dedicated exact-SHA performance workflow', () => {
  assert.equal(
    workflowRunsUrl({ repo: 'Matysh/houseplan-card', workflow: 'performance.yml', sha: 'abc/123' }),
    'https://api.github.com/repos/Matysh/houseplan-card/actions/workflows/performance.yml/runs?head_sha=abc%2F123&per_page=100',
  );
});
