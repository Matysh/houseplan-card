import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

test('scheduled mutation failure creates one issue; retry deduplicates and unidentified new runs stay separate', async () => {
  const issues = [], comments = [];
  const api = { root: '/repos/test/repo', request: async (method, url, body) => {
    if (method === 'GET') return url.includes('/comments?') ? comments : issues;
    const issue = { number: issues.length + 9, state: 'open', ...body }; issues.push(issue); return issue;
  }, comment: async (_n, body) => comments.push({ body }) };
  const request = { api, result: { kind: 'mutations', status: 'failed', shard: '1/5', reason: 'setup failed' }, eventName: 'schedule', runId: '123', runUrl: 'https://example.invalid/run' };
  await publishBackgroundFailure(request); await publishBackgroundFailure(request);
  assert.equal(issues.length, 1); assert.equal(comments.length, 0);
  await publishBackgroundFailure({ ...request, runId: '124' }); assert.equal(issues.length, 2);
  assert.equal(comments.length, 0);
  assert.equal((await publishBackgroundFailure({ ...request, eventName: 'workflow_dispatch' })).required, false);
  assert.equal((await publishBackgroundFailure({ ...request, result: { kind: 'coverage', status: 'failed' } })).required, false);
});

test('inert background job refuses execution before accessing API or running code', async () => {
  await assert.rejects(backgroundJob({ env: { PROCESS_NEXT_ENABLED: 'false', HP_BACKGROUND_KIND: 'mutations' },
    run: () => { throw Error('must not run'); } }), /not activated/);
});

function issueApi(seed = []) {
  const issues = structuredClone(seed), comments = new Map();
  return { issues, comments, root: '/repos/test/repo',
    async request(method, url, body) {
      if (method === 'POST') {
        const issue = { number: issues.length + 2000, state: 'open', ...body };
        issues.push(issue); return issue;
      }
      const match = url.match(/issues\/(\d+)\/comments/);
      return match ? comments.get(Number(match[1])) ?? [] : issues;
    },
    async comment(number, body) {
      comments.set(number, [...comments.get(number) ?? [], { body }]);
    },
  };
}

function backgroundFailure(t, guard = 'node guard-a.mjs') {
  const dir = mkdtempSync(join(tmpdir(), 'background-cause-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const logPath = join(dir, 'mutation.log');
  writeFileSync(logPath, `FAIL чистый прогон: ${guard} красный без мутанта\n`);
  return { kind: 'mutations', status: 'failed', shard: '1/5',
    report: { results: [{ id: 'mutation-shard', status: 'failed', logPath }] } };
}

const publication = (api, result, runId) => ({ api, result, runId,
  eventName: 'schedule', runUrl: `https://example.invalid/runs/${runId}` });

test('#1407 different failing guards create distinct issues; a repeated cause reuses only its owner', async t => {
  const api = issueApi();
  const a = backgroundFailure(t), b = backgroundFailure(t, 'node guard-b.mjs');
  const first = await publishBackgroundFailure(publication(api, a, '10'));
  const second = await publishBackgroundFailure(publication(api, b, '11'));
  assert.notEqual(second.issue, first.issue);
  const repeat = await publishBackgroundFailure(publication(api, a, '12'));
  assert.equal(repeat.issue, first.issue);
  assert.equal(api.comments.get(first.issue).length, 1);
  assert.equal(api.comments.has(second.issue), false);
  await publishBackgroundFailure(publication(api, a, '12'));
  assert.equal(api.comments.get(first.issue).length, 1, 'retry is idempotent');
  api.issues[0].labels = ['S8-merged'];
  assert.equal((await publishBackgroundFailure(publication(api, a, '12'))).issue, first.issue);
  assert.equal(api.issues.length, 2, 'a retry of an existing comment stays idempotent after completion');
});

test('#1407 S8 and closed issues are not reopened; retry of their original run stays idempotent', async t => {
  for (const completed of ['S8-merged', 'closed']) {
    const api = issueApi(), result = backgroundFailure(t);
    const first = await publishBackgroundFailure(publication(api, result, '20'));
    const original = api.issues[0];
    if (completed === 'closed') original.state = 'closed';
    else original.labels = [{ name: 'S8-merged' }];
    assert.equal((await publishBackgroundFailure(publication(api, result, '20'))).issue, first.issue);
    assert.equal(api.issues.length, 1);
    assert.notEqual((await publishBackgroundFailure(publication(api, result, '21'))).issue, first.issue);
    assert.equal(api.comments.has(first.issue), false);
    assert.equal(original.state, completed === 'closed' ? 'closed' : 'open');
  }
});

test('#1407 an old generic title without cause identity never owns a new failure', async t => {
  const api = issueApi([{ number: 1379, state: 'open', labels: [],
    title: '[mutation-gate] отказ прогона по расписанию: 2026-11-10',
    body: '<!-- process-next-background:mutations:old -->\nOld backend guard' }]);
  const next = await publishBackgroundFailure(publication(api, backgroundFailure(t), '30'));
  assert.notEqual(next.issue, 1379);
  assert.equal(api.comments.has(1379), false);
});
