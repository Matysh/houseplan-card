import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStateOnMaterial,
  alreadyReported, applyReconciliationDecision, decideReconciliation, latestReviewRequest, markerFor,
  parseProcessRun, preparedEvidenceError, reconcileAll, reconciliationKey, relabel,
} from '../scripts/process-reconcile.mjs';

const NOW = Date.parse('2026-09-13T12:00:00Z');
const request = { id: 'event-7', at: '2026-09-13T10:00:00Z', label: 'S7-code-review' };
const issue = (labels = ['S7-code-review']) => ({ number: 555, title: 'fixture', labels, comments: [] });
const run = (overrides = {}) => ({
  id: 70,
  attempt: 1,
  issue: 555,
  label: 'S7-code-review',
  stage: 'code',
  status: 'completed',
  conclusion: 'cancelled',
  createdAt: '2026-09-13T10:01:00Z',
  updatedAt: '2026-09-13T10:20:00Z',
  url: 'https://example.test/runs/70',
  prepared: null,
  resultArtifact: false,
  ...overrides,
});

test('#555 maps a stable process run-name to issue and stage', () => {
  assert.deepEqual(parseProcessRun({
    id: 70,
    run_attempt: 2,
    display_title: 'process #555 · S7-code-review · fixture title',
    status: 'in_progress',
    created_at: '2026-09-13T10:00:01Z',
  }), {
    id: 70, attempt: 2, issue: 555, label: 'S7-code-review', stage: 'code',
    status: 'in_progress', conclusion: '', createdAt: '2026-09-13T10:00:01Z',
    updatedAt: null, url: null, prepared: null, preparedArtifact: false,
    resultArtifact: false, pending: null, pendingValidate: null, evidenceError: null,
  });
  assert.equal(parseProcessRun({ display_title: 'unrelated label event' }), null);
});

test('#555 latest label request is stage-specific and deterministic', () => {
  const events = [
    { id: 1, event: 'labeled', created_at: '2026-09-13T08:00:00Z', label: { name: 'S7-code-review' } },
    { id: 2, event: 'labeled', created_at: '2026-09-13T09:00:00Z', label: { name: 'P2' } },
    { id: 3, event: 'labeled', created_at: '2026-09-13T10:00:00Z', label: { name: 'S4-spec-review' } },
    { id: 4, event: 'labeled', created_at: '2026-09-13T11:00:00Z', label: { name: 'S7-code-review' }, actor: { login: 'owner' } },
  ];
  assert.deepEqual(latestReviewRequest(events, 'S7-code-review'), {
    id: '4', at: '2026-09-13T11:00:00Z', label: 'S7-code-review', actor: 'owner',
  });
});

test('#555 fixture matrix: lost/cancelled/timeout retry, running waits, applied verdict is noop', () => {
  const lost = decideReconciliation({ issue: issue(), request, runs: [], now: NOW });
  assert.equal(lost.action, 'retry');
  assert.match(lost.reason, /no matching process run/);

  for (const conclusion of ['cancelled', 'timed_out', 'startup_failure']) {
    const decision = decideReconciliation({ issue: issue(), request, runs: [run({ conclusion })], now: NOW });
    assert.equal(decision.action, 'retry', conclusion);
  }

  const running = decideReconciliation({
    issue: issue(), request,
    runs: [run({ status: 'in_progress', conclusion: '', createdAt: '2026-09-13T11:00:00Z' })], now: NOW,
  });
  assert.equal(running.action, 'wait');

  const applied = decideReconciliation({ issue: issue(['S8-merged']), request, runs: [run()], now: NOW });
  assert.equal(applied.action, 'noop');
});

test('#555 guard failure and ambiguous state escalate without automatic retry', () => {
  const failed = decideReconciliation({ issue: issue(), request, runs: [run({ conclusion: 'failure' })], now: NOW });
  assert.equal(failed.action, 'escalate');
  assert.match(failed.reason, /non-transient/);

  const tooLong = decideReconciliation({
    issue: issue(), request: { ...request, at: '2026-09-13T05:00:00Z' },
    runs: [run({ status: 'in_progress', conclusion: '', createdAt: '2026-09-13T06:00:00Z' })], now: NOW,
  });
  assert.equal(tooLong.action, 'escalate');

  assert.equal(decideReconciliation({
    issue: issue(['S7-code-review', 'blocked']), request, runs: [], now: NOW,
  }).action, 'noop');
  assert.equal(decideReconciliation({
    issue: issue(['S7-code-review', 'review-4']), request, runs: [], now: NOW,
  }).action, 'noop');
  assert.equal(decideReconciliation({
    issue: issue(['S4-spec-review', 'S7-code-review']), request, runs: [], now: NOW,
  }).action, 'escalate');
});

test('#555 sealed result and successful-but-unapplied run never trigger a second model', () => {
  const sealed = decideReconciliation({
    issue: issue(), request, runs: [run({ conclusion: 'timed_out', resultArtifact: true })], now: NOW,
  });
  assert.equal(sealed.action, 'escalate');
  assert.match(sealed.reason, /model result/);

  const unapplied = decideReconciliation({
    issue: issue(), request, runs: [run({ conclusion: 'success' })], now: NOW,
  });
  assert.equal(unapplied.action, 'escalate');
  assert.match(unapplied.reason, /did not move/);
});

test('#555 prepared proof is bound to issue, stage, attempt, material and round', () => {
  const good = {
    schema: 1, run_id: '70', run_attempt: '1', issue: '555', stage: 'code', cycle: '2',
    material_sha: 'a'.repeat(40), material_tree: 'b'.repeat(40), material_specs: 'c'.repeat(40) + ' docs/specs/555.md;',
  };
  assert.equal(preparedEvidenceError(good, { issue: issue(), stage: 'code', run: run() }), null);
  for (const patch of [
    { issue: '556' }, { stage: 'spec' }, { run_attempt: '2' }, { material_sha: 'bad' }, { cycle: '0' },
  ]) {
    assert.ok(preparedEvidenceError({ ...good, ...patch }, { issue: issue(), stage: 'code', run: run() }), JSON.stringify(patch));
  }
  const foreign = decideReconciliation({
    issue: issue(), request, runs: [run({ prepared: { ...good, stage: 'spec' } })], now: NOW,
  });
  assert.equal(foreign.action, 'escalate');
  assert.match(foreign.reason, /another issue\/stage/);
});

test('#555 repeat reconciliation has a stable dedupe marker', () => {
  const decision = decideReconciliation({ issue: issue(), request, runs: [], now: NOW });
  const key = reconciliationKey(issue(), request, decision);
  assert.equal(key, reconciliationKey(issue(), request, decision));
  assert.equal(alreadyReported(issue(), key), false);
  assert.equal(alreadyReported({ ...issue(), comments: [{ body: `${markerFor(key)}\ndone` }] }, key), true);

  const afterRetry = {
    ...issue(),
    comments: [{
      createdAt: '2026-09-13T10:05:00Z',
      body: `${markerFor(key)}\nАвтосверка процесса пытается повторно разбудить \`S7-code-review\``,
    }],
  };
  const retriedRequest = { ...request, id: 'event-8', at: '2026-09-13T10:04:59Z' };
  const stopped = decideReconciliation({ issue: afterRetry, request: retriedRequest, runs: [], now: NOW });
  assert.equal(stopped.action, 'escalate');
  assert.match(stopped.reason, /one automatic retry/);
});

test('#555 write path persists the marker before relabel and never mutates after comment failure', async () => {
  const decision = decideReconciliation({ issue: issue(), request, runs: [], now: NOW });
  const key = reconciliationKey(issue(), request, decision);
  const calls = [];
  await assert.rejects(applyReconciliationDecision({
    repo: 'owner/repo', issue: issue(), request, decision, key,
    ops: {
      comment: async () => { calls.push('comment'); throw new Error('comment unavailable'); },
      relabel: async () => { calls.push('relabel'); },
    },
  }), /comment unavailable/);
  assert.deepEqual(calls, ['comment']);

  calls.length = 0;
  await applyReconciliationDecision({
    repo: 'owner/repo', issue: issue(), request, decision, key,
    ops: {
      comment: async (_repo, _issue, body) => { calls.push('comment'); assert.match(body, new RegExp(markerFor(key))); },
      relabel: async () => { calls.push('relabel'); },
    },
  });
  assert.deepEqual(calls, ['comment', 'relabel']);
});

test('#555 relabel checks the bounded restore attempt instead of throwing the first error blindly', () => {
  const calls = [];
  let adds = 0;
  const recovered = (args) => {
    calls.push(args.at(-2));
    if (args.includes('--remove-label')) return { status: 0, stderr: '' };
    adds++;
    return adds === 1 ? { status: 1, stderr: 'transient' } : { status: 0, stderr: '' };
  };
  assert.doesNotThrow(() => relabel('owner/repo', issue(), 'S7-code-review', recovered));
  assert.equal(adds, 2);
  assert.equal(calls.length, 3);

  const broken = (args) => args.includes('--remove-label')
    ? { status: 0, stderr: '' } : { status: 1, stderr: 'still broken' };
  assert.throws(() => relabel('owner/repo', issue(), 'S7-code-review', broken), /still broken/);
});

test('#555 one write failure stays in machine summary and does not abort the snapshot', async () => {
  const snapshot = { issue: issue(), request, runs: [] };
  const runtime = {
    openReviewIssues: async () => [snapshot.issue],
    processRuns: async () => [],
    snapshot: async () => snapshot,
    applyDecision: async () => { throw new Error('write failed after durable diagnosis'); },
  };
  const summary = await reconcileAll({ repo: 'owner/repo', apply: true, now: NOW, runtime });
  assert.equal(summary.failures, 1);
  assert.equal(summary.mutations, 0);
  assert.equal(summary.records.length, 1);
  assert.equal(summary.records[0].applied, false);
  assert.match(summary.records[0].error, /write failed/);
});

test('#555 a fresh label/run completion stays inside grace instead of duplicating work', () => {
  assert.equal(decideReconciliation({
    issue: issue(),
    request: { ...request, at: '2026-09-13T11:58:00Z' },
    runs: [], now: NOW,
  }).action, 'wait');
  assert.equal(decideReconciliation({
    issue: issue(), request,
    runs: [run({ conclusion: 'cancelled', updatedAt: '2026-09-13T11:58:00Z' })], now: NOW,
  }).action, 'wait');
});

// #636: подготовка вышла успешно, оставив маркер ожидания — Validate на
// материале ещё шёл. Это не «успешный прогон без вердикта»: пока Validate идёт,
// reconcile ждёт; завершился или пропал, а событие раунд не разбудило —
// повторная метка. Маркер обязателен: без него правило прежнее (escalate),
// иначе любой успешный прогон без вердикта будил бы модель второй раз.
test('#636 pending marker: running Validate waits, finished Validate retries, no marker still escalates', () => {
  const pending = { schema: 1, issue: 636, material_sha: 'a'.repeat(40) };
  const waiting = decideReconciliation({
    issue: issue(), request, runs: [run({ conclusion: 'success', pending, pendingValidate: 'active' })], now: NOW,
  });
  assert.equal(waiting.action, 'wait');
  assert.match(waiting.reason, /still running/);

  for (const state of ['completed', 'missing']) {
    const done = decideReconciliation({
      issue: issue(), request, runs: [run({ conclusion: 'success', pending, pendingValidate: state })], now: NOW,
    });
    assert.equal(done.action, 'retry', state);
    assert.match(done.reason, /was not resumed/);
  }

  const noMarker = decideReconciliation({ issue: issue(), request, runs: [run({ conclusion: 'success' })], now: NOW });
  assert.equal(noMarker.action, 'escalate');
  const parsed = parseProcessRun({ display_title: 'process #555 · S7-code-review · x', id: 1, pending, pendingValidate: 'active' });
  assert.equal(parsed.pending, pending);
  assert.equal(parsed.pendingValidate, 'active');
});

test('#636 validateStateOnMaterial reads only dispatch runs and prefers active over completed', () => {
  assert.equal(validateStateOnMaterial([]), 'missing');
  assert.equal(validateStateOnMaterial([{ event: 'push', status: 'completed' }]), 'missing');
  assert.equal(validateStateOnMaterial([{ event: 'workflow_dispatch', status: 'completed' }]), 'completed');
  assert.equal(validateStateOnMaterial([
    { event: 'workflow_dispatch', status: 'completed' }, { event: 'workflow_dispatch', status: 'in_progress' },
  ]), 'active');
  assert.equal(validateStateOnMaterial([{ event: 'workflow_dispatch', status: 'queued' }]), 'active');
});
