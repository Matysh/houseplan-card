import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowReviewAdapter } from '../remote.mjs';

const NOW = Date.parse('2026-11-01T12:00:00Z'), DAY = 86400000;
const A = 'a'.repeat(40), B = 'b'.repeat(40);
const requestId = 'review:1:2:patch:base';
const context = { requestId, active: { issue: 1, expectedBase: A, materialSha: B }, task: { track: 'show' } };
const receipt = { issue: 1, kind: 'code', requestId, materialSha: B, verdict: 'accepted', report: { summary: 'Reviewed' } };
const row = (id, age, request = `review:2:${id}`) => ({ id, created_at: new Date(NOW - age).toISOString(),
  display_title: `Код-ревью задачи #${request.split(':')[1]} · ${request}`, status: 'completed', run_attempt: 1 });

function fixture(rows, reports = new Map()) {
  const reads = [], writes = [];
  const api = { root: '/repos/test/repo', request: async (method, path) => {
    if (method !== 'GET') { writes.push(path); return null; }
    reads.push(path);
    const url = new URL(`https://example.invalid${path}`);
    if (url.pathname.endsWith('/artifacts')) {
      const id = Number(url.pathname.split('/').at(-2));
      return { artifacts: reports.has(id) ? [{ id, name: 'review-result' }] : [], total_count: reports.has(id) ? 1 : 0 };
    }
    const direct = url.pathname.match(/\/actions\/runs\/(\d+)$/);
    if (direct) return rows.find(run => run.id === Number(direct[1]));
    assert.ok(url.searchParams.has('created'), 'history search must have a time window');
    const [from, to] = url.searchParams.get('created').split('..').map(Date.parse);
    const selected = rows.filter(run => Date.parse(run.created_at) >= from && Date.parse(run.created_at) <= to)
      .sort((a, b) => b.id - a.id);
    const start = (Number(url.searchParams.get('page')) - 1) * 100;
    // Reproduce GitHub's 1000-result cap even when total_count is larger.
    return { total_count: selected.length, workflow_runs: selected.slice(0, 1000).slice(start, start + 100) };
  } };
  const adapter = new WorkflowReviewAdapter({ api, clock: () => NOW, readArtifact: async artifact => reports.get(artifact.id) });
  return { api, adapter, reads, writes };
}

test('2050 expired runs do not affect current or previous review lookup', async () => {
  const old = Array.from({ length: 2050 }, (_, i) => row(i + 1, 70 * DAY + i * 1000));
  const current = row(3000, 1000, requestId), previous = row(2999, DAY, 'review:1:1:old:base');
  const h = fixture([...old, current, previous], new Map([[3000, receipt], [2999, { ...receipt, requestId: 'review:1:1:old:base' }]]));
  assert.equal((await h.adapter.readReviewResult(context)).verdict, 'accepted');
  assert.equal((await h.adapter.readPreviousReviewResult({ issue: 1, excludeRequestId: requestId })).runId, 2999);
  assert.equal(h.reads.filter(path => path.includes('/workflows/')).length, 2);
  assert.equal(h.writes.length, 0);
});

test('exactly 100 runs finish pagination on total_count without an empty extra page', async () => {
  const h = fixture(Array.from({ length: 100 }, (_, i) => row(i + 1, DAY + i * 1000)));
  assert.equal((await h.adapter.runs()).length, 100);
  assert.equal(h.reads.length, 1);
});

test('more than 1000 recent runs are read in complete time slices, including an older matching review', async () => {
  const rows = Array.from({ length: 1100 }, (_, i) => row(i + 1, (50 - i / 25) * DAY));
  rows[0].display_title = `Код-ревью задачи #1 · ${requestId}`;
  const h = fixture(rows, new Map([[1, receipt]]));
  assert.equal((await h.adapter.readReviewResult(context)).verdict, 'accepted');
  assert.ok(h.reads.filter(path => path.includes('/workflows/')).length <= 15);
  assert.equal(h.writes.length, 0);
});

test('an old known retry is inspected directly and never redispatched as a missing recent request', async () => {
  const old = { ...row(1, 70 * DAY, requestId), status: 'in_progress', run_attempt: 2 };
  const h = fixture([old]);
  const known = { ...context, retry: true, task: { ...context.task, reviewRetry: { requestId, runId: 1 } } };
  assert.equal((await h.adapter.requestReview(known)).observed.pending, true);
  assert.equal(h.reads.some(path => path.includes('/workflows/')), false);
  assert.equal(h.writes.length, 0);
});
