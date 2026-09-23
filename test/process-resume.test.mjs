// #636: раунд ревью продолжается по событию завершения Validate, а не сном
// раннера. Решение чистое: будить можно только раунд, который сам оставил
// маркер ожидания на этот материал, при стоящей метке S7 и без активного
// прогона конвейера. Всё остальное — noop: лишняя метка = второй вызов модели.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decideResume, issueNumberFromBranch, resume, REVIEW_LABEL } from '../scripts/process-resume.mjs';

const SHA = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const validateRun = (over = {}) => ({ event: 'workflow_dispatch', status: 'completed', headSha: SHA, ...over });
const processRun = (over = {}) => ({
  id: 70, attempt: 1, issue: 636, label: REVIEW_LABEL, stage: 'code', status: 'completed', conclusion: 'success',
  createdAt: '2026-09-23T10:00:00Z', ...over,
});
const pending = { schema: 1, issue: 636, run_id: 70, material_sha: SHA };
const pendingOf = (run) => (run.id === 70 ? pending : null);

test('#636 branch → issue number', () => {
  assert.equal(issueNumberFromBranch('issue/636-review-wait-event'), 636);
  assert.equal(issueNumberFromBranch('issue/7-x'), 7);
  assert.equal(issueNumberFromBranch('dev'), null);
  assert.equal(issueNumberFromBranch('issue/abc-x'), null);
  assert.equal(issueNumberFromBranch(''), null);
});

test('#636 the round that waited for exactly this Validate is resumed', () => {
  const decision = decideResume({ labels: ['bug', REVIEW_LABEL], validateRun: validateRun(), sha: SHA, runs: [processRun()], pendingOf });
  assert.equal(decision.action, 'resume');
  assert.equal(decision.run.id, 70);
});

test('#636 push runs, unfinished runs and foreign SHAs never wake a round', () => {
  const base = { labels: [REVIEW_LABEL], sha: SHA, runs: [processRun()], pendingOf };
  assert.equal(decideResume({ ...base, validateRun: validateRun({ event: 'push' }) }).action, 'noop');
  assert.equal(decideResume({ ...base, validateRun: validateRun({ status: 'in_progress' }) }).action, 'noop');
  assert.equal(decideResume({ ...base, validateRun: validateRun({ headSha: OTHER }) }).action, 'noop');
});

test('#636 label state gates the wake-up: no S7, blocked or review-4 → noop', () => {
  const base = { validateRun: validateRun(), sha: SHA, runs: [processRun()], pendingOf };
  assert.equal(decideResume({ ...base, labels: ['S6-in-progress'] }).action, 'noop');
  assert.equal(decideResume({ ...base, labels: [REVIEW_LABEL, 'blocked'] }).action, 'noop');
  assert.equal(decideResume({ ...base, labels: [REVIEW_LABEL, 'review-4'] }).action, 'noop');
});

test('#636 an active process run, a run without a pending marker or a marker for another SHA → noop', () => {
  const base = { labels: [REVIEW_LABEL], validateRun: validateRun(), sha: SHA };
  const active = decideResume({ ...base, runs: [processRun({ id: 71, status: 'in_progress', conclusion: '', createdAt: '2026-09-23T10:05:00Z' }), processRun()], pendingOf });
  assert.equal(active.action, 'noop');
  assert.match(active.reason, /already active/);
  const noMarker = decideResume({ ...base, runs: [processRun()], pendingOf: () => null });
  assert.equal(noMarker.action, 'noop');
  assert.match(noMarker.reason, /no pending marker/);
  const otherSha = decideResume({ ...base, runs: [processRun()], pendingOf: () => ({ ...pending, material_sha: OTHER }) });
  assert.equal(otherSha.action, 'noop');
  assert.match(otherSha.reason, /waits for bbbbbbbb/);
  const failed = decideResume({ ...base, runs: [processRun({ conclusion: 'failure' })], pendingOf });
  assert.equal(failed.action, 'noop');
  const none = decideResume({ ...base, runs: [], pendingOf });
  assert.match(none.reason, /reconcile owns lost requests/);
});

test('#636 the newest process run decides, not an older pending one', () => {
  const older = processRun({ id: 60, createdAt: '2026-09-23T09:00:00Z' });
  const newerReturned = processRun({ id: 71, conclusion: 'failure', createdAt: '2026-09-23T11:00:00Z' });
  const decision = decideResume({
    labels: [REVIEW_LABEL], validateRun: validateRun(), sha: SHA, runs: [older, newerReturned],
    pendingOf: (run) => (run.id === 60 ? pending : null),
  });
  assert.equal(decision.action, 'noop');
});

test('#636 resume() relabels only on a resume decision and only with apply', async () => {
  const relabels = [];
  const ops = {
    labels: () => [REVIEW_LABEL],
    runs: () => [processRun()],
    pendingOf,
    relabel: () => relabels.push(REVIEW_LABEL),
  };
  const applied = await resume({ repo: 'o/r', branch: 'issue/636-x', sha: SHA, validateRun: validateRun(), ops });
  assert.equal(applied.action, 'resume');
  assert.equal(applied.applied, true);
  assert.deepEqual(relabels, [REVIEW_LABEL]);
  const dry = await resume({ repo: 'o/r', branch: 'issue/636-x', sha: SHA, validateRun: validateRun(), ops, apply: false });
  assert.equal(dry.applied, false);
  assert.deepEqual(relabels, [REVIEW_LABEL], 'dry run does not relabel');
  const foreign = await resume({ repo: 'o/r', branch: 'dev', sha: SHA, validateRun: validateRun(), ops });
  assert.equal(foreign.action, 'noop');
  assert.equal(foreign.issue, null);
});

test('#636 workflows: prepare exits pending with a sealed marker, resume relabels by the marker, preflight mirrors the new file', () => {
  const process = readFileSync(new URL('../.github/workflows/process.yml', import.meta.url), 'utf8');
  const resumeWf = readFileSync(new URL('../.github/workflows/process-resume.yml', import.meta.url), 'utf8');
  const validate = readFileSync(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  assert.match(process, /validate-gate\.mjs --repo="\$\{\{ github\.repository \}\}" --ref="\$BRANCH" --sha="\$SHA" --no-wait/);
  assert.match(process, /2\) echo 'proceed=pending' >> "\$GITHUB_OUTPUT"/);
  assert.match(process, /review-pending-\$\{NUM\}-\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}/);
  assert.match(process, /sha256sum pending\.json > manifest\.sha256/);
  assert.match(process, /Validate красный — вернуть автору без ревью\n\s+if: steps\.rebase\.outputs\.conflict != 'true' && steps\.gate\.outputs\.proceed == 'false'/);
  assert.match(resumeWf, /workflow_run:\n\s+workflows: \["Проверка \(CI\)"\]\n\s+types: \[completed\]/);
  assert.match(resumeWf, /github\.event\.workflow_run\.event == 'workflow_dispatch' && startsWith\(github\.event\.workflow_run\.head_branch, 'issue\/'\)/);
  assert.match(resumeWf, /GH_TOKEN: \$\{\{ secrets\.HP_PROCESS_TOKEN \}\}/);
  assert.match(resumeWf, /node scripts\/process-resume\.mjs/);
  assert.ok(!/issues: write/.test(resumeWf), 'resume relabels with HP_PROCESS_TOKEN only');
  assert.match(validate, /for file in process\.yml mutation-gate\.yml process-resume\.yml; do/);
  assert.equal(readFileSync(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8').includes('name: Проверка (CI)'), true, 'workflow_run listens to the Validate workflow name');
});
