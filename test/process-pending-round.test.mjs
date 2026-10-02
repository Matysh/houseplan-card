// #775: real incident identities; list-window/order variants below are synthetic
// witnesses, not a claim about GitHub's unsaved historical API responses.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideReconciliation, pendingEvidenceError, processRuns, reviewRunsForRequest,
} from '../scripts/process-reconcile.mjs';
import { decideResume, resume } from '../scripts/process-resume.mjs';

const LABEL = 'S7-code-review';
const incidents = [
  [740, 'stairs-floor-switch', 36877086418, 36877204584, 'f23cca8f65a9641f9cc409b749347ba167cf9c65', '14:32:05', 'success'],
  [748, 'canon-reconcile', 36883983363, 36884081445, '395210117e242b5b16118cdfd1985f9a3d620cef', '15:24:18', 'success'],
  [744, 'floor-geometry-key', 36875649994, 36875756451, '62bd32538132462d4f5222a36db3bdf1e660b80b', '14:21:07', 'failure'],
];
function fixture(row = incidents[0]) {
  const [issue, slug, id, validateId, sha, time, conclusion] = row;
  const branch = `issue/${issue}-${slug}`;
  const createdAt = `2026-10-01T${time}Z`;
  const run = { id, attempt: 1, issue, label: LABEL, stage: 'code', status: 'completed', conclusion: 'success', createdAt };
  const request = { id: 'request-1', label: LABEL, at: createdAt };
  const pending = { schema: 1, issue: String(issue), run_id: String(id), run_attempt: '1', stage: 'code', branch,
    material_sha: sha, validate_run_id: String(validateId) };
  return { issue, branch, sha, headSha: sha, request, labels: [LABEL], run, pending,
    runs: [run], validateRun: { id: validateId, event: 'workflow_dispatch', status: 'completed', headSha: sha, conclusion },
    pendingOf: (candidate) => candidate.id === id ? pending : null };
}
const raw = (run, extra = {}) => ({ ...run, event: 'issues',
  display_title: `process #${run.issue} · ${run.label} · fixture`, created_at: run.createdAt, ...extra });

test('#775 all three incident markers resume, including red Validate (ordinary prepare owns S6/comment)', () => {
  for (const row of incidents) assert.equal(decideResume(fixture(row)).action, 'resume', `#${row[0]}`);
});

test('#775 history is paged to the request, not capped at 200 or filtered-search 1000 runs', () => {
  for (const row of incidents) {
    const f = fixture(row);
    const unrelated = Array.from({ length: 1100 }, (_, n) => raw({ ...f.run, id: n + 1, issue: 999,
      createdAt: '2026-10-01T16:00:00Z' }, { display_title: 'process #999 · P2 · unrelated label' }));
    const rows = [...unrelated, raw(f.run), raw({ ...f.run, id: 2, createdAt: '2026-09-30T00:00:00Z' })];
    const calls = [];
    const runs = processRuns('o/r', [{ number: f.issue }], { since: f.request.at, getJson: (args) => {
      const url = args[1];
      calls.push(url);
      assert.ok(!url.includes('event='), 'unfiltered endpoint avoids the search-result cap');
      const page = Number(new URL(`https://api.test/${url}`).searchParams.get('page'));
      return { workflow_runs: rows.slice((page - 1) * 100, page * 100) };
    } });
    assert.equal(calls.length, 12);
    assert.equal(decideResume({ ...f, runs }).action, 'resume', `#${f.issue}`);
  }
});

test('#775 history errors/repeated pages are not silently interpreted as a lost request', () => {
  const f = fixture();
  const page = Array.from({ length: 100 }, (_, n) => raw({ ...f.run, id: n + 1 }));
  let calls = 0;
  assert.throws(() => processRuns('o/r', [], { since: f.request.at, getJson: () => {
    if (++calls === 2) throw new Error('API unavailable');
    return { workflow_runs: page };
  } }), /API unavailable/);
  assert.throws(() => processRuns('o/r', [], { since: f.request.at,
    getJson: () => ({ workflow_runs: page }) }), /pagination/);
});

test('#775 stop at the request time, deduplicate overlapping pages, ignore non-issue workflow events', () => {
  const f = fixture();
  const first = Array.from({ length: 100 }, (_, n) => raw({ ...f.run, id: n + 1, createdAt: '2026-10-01T16:00:00Z' }));
  const second = [first[99], raw(f.run), raw({ ...f.run, id: 3, createdAt: '2026-09-30T00:00:00Z' }),
    raw({ ...f.run, id: 200 }, { event: 'workflow_dispatch' })];
  let count = 0;
  const runs = processRuns('o/r', [], { since: f.request.at,
    getJson: () => ({ workflow_runs: [first, second][count++] }) });
  assert.equal(count, 2);
  assert.equal(runs.length, 101);
  assert.equal(new Set(runs.map((run) => run.id)).size, runs.length);
});

test('#775 skipped noise can be ignored but newer attempted reviews are barriers', () => {
  const f = fixture();
  const newer = { ...f.run, id: f.run.id + 1, createdAt: '2026-10-01T16:00:00Z' };
  assert.equal(decideResume({ ...f, runs: [{ ...newer, conclusion: 'skipped' }, f.run] }).action, 'resume');
  for (const conclusion of ['failure', 'cancelled', 'success']) {
    assert.equal(decideResume({ ...f, runs: [{ ...newer, conclusion }, f.run] }).action, 'noop', conclusion);
  }
  assert.equal(decideResume({ ...f, runs: [{ ...newer, status: 'in_progress' }, f.run] }).action, 'noop');
});

test('#775 a new request, branch head, different dispatch or damaged identity never wakes the old round', () => {
  const f = fixture();
  for (const overrides of [
    { request: null }, { request: { ...f.request, at: '2026-10-01T16:00:00Z' } },
    { headSha: 'b'.repeat(40) }, { issue: 999 }, { branch: 'issue/740-other-branch' },
    { validateRun: { ...f.validateRun, id: f.validateRun.id + 1 } },
    { labels: [LABEL, 'S4-spec-review'] },
  ]) assert.equal(decideResume({ ...f, ...overrides }).action, 'noop', JSON.stringify(overrides));
  for (const overrides of [{ schema: 2 }, { issue: '999' }, { run_id: '1' }, { run_attempt: '2' },
    { stage: 'spec' }, { branch: 'other' }, { validate_run_id: '' }]) {
    assert.equal(decideResume({ ...f, pendingOf: () => ({ ...f.pending, ...overrides }) }).action, 'noop', JSON.stringify(overrides));
  }
});

test('#775 write path rechecks current request, stop labels, head and runs; duplicates cannot relabel twice', async () => {
  const f = fixture();
  for (const changed of [{ labels: [] }, { labels: [LABEL, 'blocked'] }, { headSha: 'b'.repeat(40) },
    { request: { ...f.request, id: 'request-2' } }]) {
    let reads = 0;
    let writes = 0;
    const ops = { state: () => ++reads === 1 ? f : { ...f, ...changed }, runs: () => f.runs,
      pendingOf: f.pendingOf, relabel: () => writes++ };
    const result = await resume({ ...f, repo: 'o/r', ops, sleep: async () => {} });
    assert.equal(result.applied, false);
    assert.equal(writes, 0);
  }
  let reads = 0;
  let writes = 0;
  let state = f;
  const ops = { state: () => state, runs: () => { reads++; return f.runs; }, pendingOf: f.pendingOf,
    relabel: () => { writes++; state = { ...f, request: { ...f.request, id: 'request-2', at: '2026-10-01T17:00:00Z' } }; } };
  assert.equal((await resume({ ...f, repo: 'o/r', ops, sleep: async () => {} })).applied, true);
  assert.equal((await resume({ ...f, repo: 'o/r', ops, sleep: async () => {} })).applied, false);
  assert.equal(writes, 1);
  assert.ok(reads >= 2);
});

test('#775 transient missing/old/no-marker snapshots recover without waiting for the schedule', async () => {
  for (const row of incidents) {
    const f = fixture(row);
    let reads = 0;
    let writes = 0;
    const waits = [];
    const ops = { state: () => f, runs: () => ++reads === 1
      ? (f.issue === 744 ? [] : [{ ...f.run, id: 1, createdAt: f.issue === 748 ? '2026-09-30T00:00:00Z' : f.run.createdAt }])
      : f.runs, pendingOf: f.pendingOf, relabel: () => writes++ };
    const result = await resume({ ...f, repo: 'o/r', ops, sleep: async (ms) => waits.push(ms) });
    assert.equal(result.applied, true, `#${f.issue}`);
    assert.equal(writes, 1);
    assert.deepEqual(waits, [5000]);
  }
});

test('#775 absent evidence gets a bounded grace, never a guessed relabel', async () => {
  const f = fixture();
  let reads = 0;
  const waits = [];
  const result = await resume({ ...f, repo: 'o/r', sleep: async (ms) => waits.push(ms),
    ops: { state: () => f, runs: () => { reads++; return []; }, pendingOf: f.pendingOf,
      relabel: () => assert.fail('no evidence') } });
  assert.equal(result.action, 'noop');
  assert.equal(result.applied, false);
  assert.equal(reads, 3);
  assert.deepEqual(waits, [5000, 5000]);
});

test('#775 reconciler uses the same request boundary, skipped-run handling and sealed identity', () => {
  const f = fixture();
  const now = Date.parse('2026-10-01T17:00:00Z');
  const base = { issue: { number: f.issue, labels: [LABEL] }, request: f.request, now };
  const ready = { ...f.run, pending: f.pending, pendingValidate: 'completed' };
  const skipped = { ...f.run, id: 999, createdAt: '2026-10-01T16:00:00Z', conclusion: 'skipped' };
  assert.equal(decideReconciliation({ ...base, runs: [skipped, ready] }).action, 'retry');
  assert.equal(decideReconciliation({ ...base, runs: [{ ...ready, resultArtifact: true }] }).action, 'escalate');
  const justReapplied = { ...f.request, at: '2026-10-01T14:32:06Z' };
  assert.deepEqual(reviewRunsForRequest([ready], f.issue, justReapplied), [],
    'a run one second before the new label belongs only to the previous request');
  assert.equal(decideReconciliation({ ...base, request: justReapplied, now: Date.parse(justReapplied.at), runs: [ready] }).action, 'wait',
    'previous run one second before the new label cannot be recovered as the new request');
  assert.equal(pendingEvidenceError(f.pending, { issue: f.issue, run: f.run }), null);
  assert.match(pendingEvidenceError({ ...f.pending, run_attempt: '2' }, { issue: f.issue, run: f.run }), /attempt/);
});

test('#775 a run starting between snapshots prevents the write', async () => {
  const f = fixture();
  let reads = 0;
  const ops = { state: () => f, runs: () => ++reads === 1 ? f.runs
    : [{ ...f.run, id: f.run.id + 1, status: 'in_progress', createdAt: '2026-10-01T16:00:00Z' }, f.run],
  pendingOf: f.pendingOf, relabel: () => assert.fail('new process already running') };
  assert.equal((await resume({ ...f, repo: 'o/r', ops })).applied, false);
});
