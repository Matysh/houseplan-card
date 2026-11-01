import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mutationShardForDate, runBackground, publishBackgroundFailure } from '../lib/background.mjs';
import { backgroundJob } from '../templates/background-job.mjs';

test('daily rotation visits each explicit shard once and wraps without another state store', () => {
  const shards = Array.from({ length: 10 }, (_, i) => mutationShardForDate(new Date(Date.UTC(2026, 10, i + 1)), 5));
  assert.equal(new Set(shards.slice(0, 5)).size, 5); assert.deepEqual(shards.slice(0, 5), shards.slice(5));
  assert.throws(() => mutationShardForDate('invalid'), /Valid rotation/);
});

test('background notices mutation failure even when the common runner treats its step as diagnostic', async t => {
  const root = mkdtempSync(join(tmpdir(), 'background-test-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  let requested;
  const result = await runBackground({ root, kind: 'mutations', gitSha: () => 'a'.repeat(40),
    plan: async value => { requested = value; return {}; },
    run: async () => ({ status: 'passed', results: [{ id: 'mutation-shard', diagnostic: true, status: 'failed' }] }) });
  assert.equal(requested.event, 'mutation'); assert.match(requested.mutationShard, /^[1-5]\/5$/);
  assert.equal(result.status, 'failed');
});

test('scheduled mutation failure creates one issue; retry deduplicates and manual/coverage do not notify', async () => {
  const issues = [], comments = [];
  const api = { root: '/repos/test/repo', request: async (method, url, body) => {
    if (method === 'GET') return url.includes('/comments?') ? comments : issues;
    const issue = { number: 9, ...body }; issues.push(issue); return issue;
  }, comment: async (_n, body) => comments.push({ body }) };
  const request = { api, result: { kind: 'mutations', status: 'failed', shard: '1/5', reason: 'setup failed' }, eventName: 'schedule', runId: '123', runUrl: 'https://example.invalid/run' };
  await publishBackgroundFailure(request); await publishBackgroundFailure(request);
  assert.equal(issues.length, 1); assert.equal(comments.length, 0);
  await publishBackgroundFailure({ ...request, runId: '124' }); assert.equal(comments.length, 1);
  assert.equal((await publishBackgroundFailure({ ...request, eventName: 'workflow_dispatch' })).required, false);
  assert.equal((await publishBackgroundFailure({ ...request, result: { kind: 'coverage', status: 'failed' } })).required, false);
});

test('inert background job refuses execution before accessing API or running code', async () => {
  await assert.rejects(backgroundJob({ env: { PROCESS_NEXT_ENABLED: 'false', HP_BACKGROUND_KIND: 'mutations' },
    run: () => { throw Error('must not run'); } }), /not activated/);
});
