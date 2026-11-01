import test from 'node:test';
import assert from 'node:assert/strict';
import { QueueController, MemoryQueueStore } from '../lib/queue.mjs';
import { reconcileTaskCompletions, notifyDevWebhook } from '../lib/task-completion.mjs';
import { runDevBuildDelivery } from '../templates/coordinator-dev-build.mjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
async function fixture({ category = 'major', missing = false, currentMilestone = null, releaseTag } = {}) {
  const queue = new QueueController(new MemoryQueueStore(), { clock: () => 100 });
  await queue.dispatch({ id: 'ready', type: 'enqueue', task: { issue: 9, track: 'ship', layer: 'product', branch: 'task/9', materialSha: B,
    ...(releaseTag ? { releaseTag } : {}) } });
  let state = await queue.dispatch({ id: 'admit', type: 'admit' });
  const token = state.active.token;
  const dispatch = (id, type, extra = {}) => queue.dispatch({ id, type, issue: 9, token, materialSha: B, ...extra });
  await dispatch('sync', 'synchronized', { expectedBase: A });
  await dispatch('s6', 's6-complete', { outcome: 'passed' });
  await dispatch('merged', 'merged', { actualDevSha: B });
  const issue = { number: 9, state: 'open', labels: ['track:ship', 'S6-in-progress', 'to_release', 'bug'],
    milestone: currentMilestone ? { number: currentMilestone } : null };
  const comments = new Map(), writes = { labels: 0, milestone: 0, comment: 0 }; let labelFail = false, commentFail = false;
  const api = { owner: 'owner', repo: 'repo', getIssue: async () => structuredClone(issue),
    moveStatus: async (_number, to) => {
      if (labelFail) throw Error('labels unavailable');
      writes.labels++; issue.labels = issue.labels.filter(label => !/^S[1-8]-/.test(label) && label !== 'to_release').concat(to);
    },
    removeLabel: async (_number, name) => { writes.labels++; issue.labels = issue.labels.filter(label => label !== name); },
    updateIssue: async (_number, change) => { writes.milestone++; issue.milestone = change.milestone ? { number: change.milestone } : null; },
    upsertComment: async (_number, { marker, body }) => {
      if (comments.get(marker) !== body) { writes.comment++; comments.set(marker, body); }
      if (commentFail) { commentFail = false; throw Error('response lost after comment write'); }
    },
  };
  const git = { git: async args => {
    if (missing) throw Error('classification is absent');
    assert.equal(args[0], 'show'); assert.ok(args[1].startsWith(`${B}:docs/release-ledger/`));
    return JSON.stringify(args[1].endsWith('cycle.json')
      ? { baseStable: 'v1.0.0', targetStable: 'v1.1.0', milestone: { number: 7 } }
      : { issue: 9, baseStable: 'v1.0.0', category });
  } };
  return { queue, issue, api, git, comments, writes, labelFailure(value) { labelFail = value; },
    loseCommentResponse() { commentFail = true; }, complete: eventId => reconcileTaskCompletions({ queue, api, git, eventId, activated: true }) };
}

test('post-merge retry repairs S8 and to_release without a second merge, test or review', async () => {
  const f = await fixture(); f.labelFailure(true);
  const failed = await f.complete('tick1');
  assert.equal(failed.pending.length, 1); assert.equal((await f.queue.store.read()).state.active, null);
  assert.equal((await f.queue.store.read()).state.tasks[9].status, 'S8-merged');
  assert.equal(f.issue.milestone.number, 7); f.labelFailure(false);
  assert.equal((await f.complete('tick2')).completed.length, 1);
  assert.deepEqual(f.issue.labels.sort(), ['S8-merged', 'bug', 'track:ship']);
  const writes = { ...f.writes }; await f.complete('tick3'); assert.deepEqual(f.writes, writes);
  assert.equal(f.comments.size, 1);
});

test('missing classification is visible and nonblocking; another milestone is never stolen', async () => {
  const missing = await fixture({ missing: true }); const result = await missing.complete('missing');
  assert.equal(result.pending.length, 1); assert.match(result.pending[0].errors.milestone, /classification is absent/);
  assert.ok(missing.issue.labels.includes('S8-merged')); assert.equal(missing.writes.milestone, 0);
  assert.match([...missing.comments.values()][0], /Учёт milestone ожидает/);
  const foreign = await fixture({ currentMilestone: 88 }); await foreign.complete('foreign');
  assert.equal(foreign.issue.milestone.number, 88); assert.equal(foreign.writes.milestone, 0);
  const infra = await fixture({ category: 'infra', currentMilestone: 7 }); await infra.complete('infra');
  assert.equal(infra.issue.milestone, null);
  const unrelated = await fixture({ category: 'infra', currentMilestone: 88 }); await unrelated.complete('unrelated');
  assert.equal(unrelated.issue.milestone.number, 88);
});

test('a lost comment response retries its marker, and a released closed issue never regains S8', async () => {
  const f = await fixture(); f.loseCommentResponse();
  assert.equal((await f.complete('first')).pending.length, 1); assert.equal(f.comments.size, 1);
  f.issue.state = 'closed'; f.issue.labels = ['track:ship', 'bug'];
  await f.complete('retry'); assert.equal(f.comments.size, 1);
  assert.ok(!f.issue.labels.includes('S8-merged'));
  const closed = await fixture(); closed.issue.state = 'closed'; closed.issue.labels = ['track:ship', 'to_release'];
  await closed.complete('closed'); assert.deepEqual(closed.issue.labels, ['track:ship']);
});
test('a queued published-tag return completes without classification or changing its milestone', async () => {
  const f = await fixture({ releaseTag: 'v1.1.0', missing: true, currentMilestone: 88 });
  f.git.git = async () => assert.fail('service return does not require a new product classification');
  const result = await f.complete('service-return');
  assert.equal(result.completed.length, 1); assert.equal(result.completed[0].milestone, 'not-required');
  assert.equal((await f.queue.store.read()).state.tasks[9].releaseTag, 'v1.1.0');
  assert.equal(f.issue.milestone.number, 88); assert.equal(f.writes.milestone, 0);
});

test('failure notices and paid review presentation retry independently without changing statuses', async () => {
  const f = await fixture(), snapshot = await f.queue.store.read();
  snapshot.state.tasks[9].notice = { key: '1:review-findings', reason: 'review-findings', status: 'pending' };
  snapshot.state.tasks[9].reviewPublication = { issue: 9, kind: 'code', requestId: 'review:9', materialSha: B, expectedBase: A, status: 'pending' };
  snapshot.state.specReviews[10] = { requestId: 'spec:10', status: 'accepted', base: A,
    reviewPublication: { issue: 10, kind: 'spec', requestId: 'spec:10', materialSha: A, expectedBase: A, status: 'pending' } };
  await f.queue.store.compareAndSwap(snapshot.version, snapshot.state);
  let calls = 0;
  const args = { queue: f.queue, api: f.api, git: f.git, activated: true, publishReview: async record => {
    calls++; assert.ok(['review:9', 'spec:10'].includes(record.requestId));
    if (calls <= 2) throw Error('comment endpoint unavailable'); return { published: true };
  } };
  await reconcileTaskCompletions({ ...args, eventId: 'failed' });
  assert.equal((await f.queue.store.read()).state.tasks[9].notice.status, 'delivered');
  await reconcileTaskCompletions({ ...args, eventId: 'retry' });
  const repaired = (await f.queue.store.read()).state;
  assert.equal(repaired.tasks[9].status, 'S8-merged'); assert.equal(repaired.specReviews[10].status, 'accepted');
  assert.deepEqual(repaired.reviewPublications, {});
  assert.equal(repaired.tasks[9].reviewPublication, undefined);
  assert.equal(repaired.specReviews[10].reviewPublication, undefined);
  assert.equal([...f.comments.keys()].filter(marker => marker.includes('task-return')).length, 1);
  await reconcileTaskCompletions({ ...args, eventId: 'done' }); assert.equal(calls, 4);
});

test('new spec and code rounds retain every undelivered paid report until its own publication succeeds', async () => {
  const queue = new QueueController(new MemoryQueueStore(), { clock: () => 100 });
  const task = { issue: 9, track: 'show', layer: 'infra', branch: 'task/9', materialSha: B };
  const presentation = (kind, number, round) => ({ issue: number, kind, requestId: `${kind}:${number}:${round}`,
    materialSha: B, expectedBase: A, runId: round });
  for (const round of [1, 2]) {
    await queue.dispatch({ id: `ready${round}`, type: 'enqueue', task });
    await queue.dispatch({ id: `spec${round}`, type: 'spec-requested', issue: 10,
      request: { requestId: `spec:10:${round}`, base: A } });
    for (const [kind, number] of [['code', 9], ['spec', 10]]) await queue.dispatch({ id: `presentation-${kind}${round}`,
      type: 'review-presentation', issue: number, kind, record: presentation(kind, number, round) });
  }
  const before = (await queue.store.read()).state;
  assert.equal(Object.keys(before.reviewPublications).length, 4);
  const calls = [], args = { queue, api: {}, git: {}, activated: true, publishReview: async record => {
    calls.push(record.requestId);
    assert.deepEqual({ issue: record.issue, kind: record.kind, runId: record.runId },
      { issue: record.kind === 'code' ? 9 : 10, kind: record.kind, runId: Number(record.requestId.split(':').at(-1)) });
    if (record.requestId === 'spec:10:1' && calls.filter(id => id === record.requestId).length === 1) throw Error('old comment unavailable');
    return { published: true };
  } };
  await reconcileTaskCompletions({ ...args, eventId: 'first-sweep' });
  assert.deepEqual(Object.values((await queue.store.read()).state.reviewPublications).map(record => record.requestId), ['spec:10:1']);
  await reconcileTaskCompletions({ ...args, eventId: 'second-sweep' });
  const after = (await queue.store.read()).state;
  assert.deepEqual(after.reviewPublications, {});
  assert.deepEqual(after.tasks, before.tasks); assert.deepEqual(after.specReviews, before.specReviews);
  assert.equal(calls.length, 5);
  await reconcileTaskCompletions({ ...args, eventId: 'third-sweep' }); assert.equal(calls.length, 5);
});

test('HA wakeup retries only HTTP and does not expose its URL or response', async () => {
  const f = await fixture(), secret = 'https://ha.example/api/webhook/SECRET';
  await f.queue.dispatch({ id: 'published', type: 'dev-webhook', sourceSha: B, integrationTree: C, status: 'pending' });
  let calls = 0;
  const fetchImpl = async (url, request) => { calls++; assert.equal(String(url), secret); assert.deepEqual(JSON.parse(request.body), { source: B });
    if (calls === 1) throw Error(`failed secret ${secret}`); return { ok: true }; };
  const args = { queue: f.queue, activated: true, url: secret, fetchImpl };
  const failed = await notifyDevWebhook({ ...args, eventId: 'first' });
  assert.equal(failed.status, 'pending'); assert.ok(!JSON.stringify(failed).includes('SECRET'));
  assert.equal((await notifyDevWebhook({ ...args, eventId: 'retry' })).status, 'delivered');
  await f.queue.dispatch({ id: 'duplicate-publish', type: 'dev-webhook', sourceSha: B, status: 'pending' });
  await notifyDevWebhook({ ...args, eventId: 'again' }); assert.equal(calls, 2);
});

test('old HA response cannot acknowledge a newer pending source', async () => {
  const f = await fixture();
  await f.queue.dispatch({ id: 'old', type: 'dev-webhook', sourceSha: A, status: 'pending' });
  await notifyDevWebhook({ queue: f.queue, activated: true, url: 'https://ha.example/hook', eventId: 'send-old',
    fetchImpl: async () => { await f.queue.dispatch({ id: 'new', type: 'dev-webhook', sourceSha: B, status: 'pending' }); return { ok: true }; } });
  assert.deepEqual((await f.queue.store.read()).state.devWebhook, { sourceSha: B, status: 'pending' });
});

test('dev-build binding persists changed wakeup before sending and does not repeat the build for HTTP retry', async () => {
  const calls = [], env = { PROCESS_NEXT_ENABLED: 'true', DEV_BUILD_SHA: B, DEV_BUILD_ISSUE: '9', GITHUB_RUN_ID: '22', HP_HA_DEV_WEBHOOK: 'secret' };
  const result = await runDevBuildDelivery({ env, config: {}, log: () => {},
    publish: async () => { calls.push('build'); return { published: true, changed: true }; },
    execute: async request => { calls.push(request.command); if (request.command === 'dev-build-complete') assert.equal(request.event.webhookPending, true);
      return { status: 'pending' }; } });
  assert.deepEqual(calls, ['build', 'dev-build-complete', 'dev-webhook']); assert.equal(result.published, true);
  let pending;
  await runDevBuildDelivery({ env, config: {}, log: () => {}, publish: async () => ({ published: true, changed: false }),
    execute: async request => { if (request.command === 'dev-build-complete') pending = request.event.webhookPending; return {}; } });
  assert.equal(pending, false);
});

test('disabled preparation performs no completion writes, publication or webhook calls', async () => {
  const f = await fixture();
  assert.equal((await reconcileTaskCompletions({ queue: f.queue, api: f.api, git: f.git, eventId: 'dry' })).planned, true);
  assert.deepEqual(f.writes, { labels: 0, milestone: 0, comment: 0 });
  const noFetch = async () => assert.fail('network must remain disabled');
  assert.equal((await notifyDevWebhook({ queue: f.queue, fetchImpl: noFetch, eventId: 'dry' })).planned, true);
  await assert.rejects(runDevBuildDelivery({ env: {}, config: {}, publish: () => assert.fail('no publication') }), /not activated/);
});
