import test from 'node:test';
import assert from 'node:assert/strict';
import { QueueController, MemoryQueueStore, reduceQueue, AUTOMATION_WAIT_MS, REVIEW_RETRY_VISIBILITY_MS } from '../lib/queue.mjs';
import { handleGithubEvent, reconcileQueue, reconcileMergedLabel, reconcileSpecReview, taskLayerFromDiff, devBuildTarget } from '../lib/coordinator.mjs';
const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
test('a pending product delivery follows current dev after later docs merges; docs alone do not build', () => {
  const product = { issue: 1, status: 'S8-merged', mergedSha: B, mergedAt: 10, devBuild: { status: 'pending' } };
  const docs = { issue: 2, status: 'S8-merged', mergedSha: C, mergedAt: 20, devBuild: { status: 'not-required' } };
  assert.deepEqual(devBuildTarget({ tasks: { 1: product, 2: docs } }, C), { sha: C, issue: 1 });
  assert.equal(devBuildTarget({ tasks: { 2: docs } }, C), null);
});
function harness(track, layer = 'infra') {
  const store = new MemoryQueueStore(), read = store.read.bind(store);
  store.read = async () => ({ ...await read(), headSha: C }); store.branch = 'process-state'; store.path = 'queue.json';
  const queue = new QueueController(store, { clock: () => 100 });
  const issue = { number: 1, state: 'open', labels: ['S6-in-progress', `track:${track}`] };
  let tests = 0, reviews = 0, count = 0, verdict = null, labelFails = false;
  const api = { getIssue: async () => structuredClone(issue), moveStatus: async (number, to) => {
    if (labelFails) throw Error('API down'); issue.labels = issue.labels.filter(name => !/^S\d-/.test(name)).concat(to); } };
  const git = { merge: async ({ fence, materialSha }) => {
    const before = await store.read(), next = reduceQueue(before.state, { id: fence.eventId, type: 'merged', issue: 1,
      token: fence.token, materialSha, actualDevSha: materialSha }, { now: 100 });
    await store.compareAndSwap(before.version, next);
    return { merged: true, status: 'S8-merged', state: next, statePersisted: true };
  } };
  const adapters = { queue, api, git, activated: true, synchronize: async () => ({ expectedBase: A, materialSha: B }),
    runS6: async () => { tests++; return { outcome: 'passed' }; },
    requestReview: async () => { reviews++; }, readReviewResult: async ({ requestId }) => verdict ? ({ requestId, materialSha: B, verdict }) : { pending: true } };
  return { store, queue, api, issue, get tests() { return tests; }, get reviews() { return reviews; },
    verdict(value) { verdict = value; }, failLabels() { labelFails = true; }, restoreLabels() { labelFails = false; },
    ready: () => handleGithubEvent({ activated: true, queue, issue, owner: 'owner', ownerDecision: { decisionId: 'decision1', source: 'chat', sourceRef: 'chat:test#decision1', decisionText: `Use ${track}`, track },
      event: { id: 'ready', kind: 'ready', branch: 'issue/1', materialSha: B, layer } }),
    step: () => reconcileQueue({ ...adapters, eventId: `tick${++count}` }) };
}
test('complete owner ship path runs S6 once and merges without requesting individual review', async () => {
  const h = harness('ship'); await h.ready(); await h.step(); await h.step(); await h.step();
  const result = await h.step(); assert.equal(result.action, 'merged'); assert.equal(h.tests, 1); assert.equal(h.reviews, 0);
  assert.ok(h.issue.labels.includes('S8-merged'));
});
test('complete show path keeps admission through review waiting and never runs tests in S7', async () => {
  const h = harness('show'); await h.ready(); await h.step(); await h.step(); await h.step();
  assert.ok(h.issue.labels.includes('S7-code-review')); await h.step();
  assert.equal((await h.step()).action, 'review-pending'); assert.equal(h.tests, 1); assert.equal(h.reviews, 1);
  assert.equal((await h.store.read()).state.active.phase, 'review');
  h.verdict('accepted'); await h.step(); assert.equal((await h.step()).action, 'merged'); assert.equal(h.tests, 1);
});
test('review findings release the slot and return to S6, retaining completed S6 evidence', async () => {
  const h = harness('show'); await h.ready(); await h.step(); await h.step(); await h.step(); await h.step();
  h.verdict('changes-requested'); assert.equal((await h.step()).action, 'returned');
  assert.equal((await h.store.read()).state.active, null); assert.ok(h.issue.labels.includes('S6-in-progress'));
});
test('documentation ship invokes neither test runner nor reviewer', async () => {
  const h = harness('ship', 'docs'); await h.ready(); await h.step(); await h.step(); await h.step(); await h.step();
  assert.equal(h.tests, 0); assert.equal(h.reviews, 0);
});
test('documentation show skips tests but waits for independent text review', async () => {
  const h = harness('show', 'docs'); await h.ready(); await h.step(); await h.step(); await h.step(); await h.step();
  assert.equal(h.tests, 0); assert.equal(h.reviews, 1); assert.equal((await h.step()).action, 'review-pending');
});
test('installed track wins over older chat provenance and conflicting labels require clarification', async () => {
  const h = harness('ship');
  await handleGithubEvent({ activated: true, queue: h.queue, issue: h.issue, owner: 'owner', ownerDecision: {
    decisionId: 'direct', source: 'manual', sourceRef: 'owner:direct-instruction', decisionText: 'Use ask', track: 'ask' }, event: {
    id: 'owner-label', kind: 'label', action: 'labeled', actor: 'owner', label: 'track:ship' } });
  const event = { id: 'agent-ready', kind: 'ready', actor: 'agent', branch: 'issue/1', materialSha: B, layer: 'infra' };
  h.issue.labels.push('track:ask');
  await assert.rejects(handleGithubEvent({ activated: true, queue: h.queue, issue: h.issue, event }), /conflicting track labels/);
  assert.equal((await h.store.read()).state.waiting.length, 0); h.issue.labels.pop();
  await handleGithubEvent({ activated: true, queue: h.queue, issue: h.issue, event });
  assert.equal((await h.store.read()).state.tasks[1].track, 'ship');
  await h.step(); await h.step(); await h.step(); await h.step();
  assert.equal(h.reviews, 0); assert.equal((await h.store.read()).state.tasks[1].status, 'S8-merged');
});
test('confirmed pending review avoids a write per poll and renews only near lease expiry', async () => {
  const h = harness('show'); await h.ready(); await h.step(); await h.step(); await h.step(); await h.step();
  const snapshot = await h.store.read(), before = snapshot.state.active; h.queue.clock = () => 1000;
  await h.step(); assert.equal((await h.store.read()).version, snapshot.version);
  h.queue.clock = () => before.expiresAt - h.queue.leaseMs / 2;
  await h.step(); const renewed = (await h.store.read()).state.active;
  assert.equal(renewed.token, before.token); assert.ok(renewed.expiresAt > before.expiresAt);
  const outcome = await reconcileQueue({ queue: h.queue, api: h.api, activated: true, eventId: 'timeout', readReviewResult: async () => ({ pending: true }) });
  assert.equal(outcome.action, 'review-pending'); assert.equal((await h.store.read()).state.active.reviewRequest, before.reviewRequest);
});
test('missing review dispatch is ensured with the same idempotency key and no test rerun', async () => {
  const h = harness('show'); await h.ready(); await h.step(); await h.step(); await h.step(); await h.step();
  const active = (await h.store.read()).state.active, requested = [];
  const result = await reconcileQueue({ queue: h.queue, api: h.api, activated: true, eventId: 'missing-dispatch',
    readReviewResult: async () => ({ missing: true }), requestReview: async ({ requestId }) => requested.push(requestId) });
  assert.equal(result.action, 'review-request-ensured'); assert.deepEqual(requested, [active.reviewRequest]); assert.equal(h.tests, 1);
});
test('a label wakeup does not mark an unfinished S6 task ready, and dry-run never activates the queue', async () => {
  const h = harness('show');
  assert.equal((await handleGithubEvent({ queue: h.queue, issue: h.issue, event: { id: 'label', kind: 'label' } })).action, 'reconcile');
  const result = await handleGithubEvent({ queue: h.queue, issue: h.issue, event: { id: 'ready', kind: 'ready', branch: 'issue/1', materialSha: B, layer: 'infra' } });
  assert.equal(result.planned, true); assert.equal((await h.store.read()).state.waiting.length, 0);
});
test('owner blocked snapshot frees the active slot without resetting the owner label', async () => {
  const h = harness('ship'); await h.ready(); await h.step(); h.issue.labels.push('blocked');
  assert.equal((await h.step()).reason, 'owner-stopped'); assert.equal((await h.store.read()).state.active, null);
  assert.ok(h.issue.labels.includes('blocked'));
});
test('failed S8 label publication never re-merges or reruns tests and is separately reconciled', async () => {
  const h = harness('ship'); await h.ready(); await h.step(); await h.step(); await h.step(); h.failLabels();
  const result = await h.step(); assert.equal(result.merged, true); assert.equal(result.warnings.length, 1);
  assert.equal((await h.store.read()).state.tasks[1].status, 'S8-merged'); h.restoreLabels();
  await reconcileMergedLabel({ queue: h.queue, api: h.api, issue: h.issue, activated: true });
  assert.ok(h.issue.labels.includes('S8-merged')); assert.equal(h.tests, 1);
});
test('task layer follows significant diff, not an agent docs declaration or test-directory name', () => {
  assert.equal(taskLayerFromDiff(['README.md', 'docs/guide.md']), 'docs');
  for (const file of ['src/logic.ts', 'package.json', 'package-lock.json', 'rollup.config.mjs', 'tsconfig.test.json']) assert.equal(taskLayerFromDiff([file]), 'product');
  assert.equal(taskLayerFromDiff(['test/dev-build.test.mjs', 'process-next/lib/queue.mjs']), 'infra');
  assert.equal(taskLayerFromDiff(['test/device-toggle.test.mjs']), 'product');
});
test('GitHub transport and incomplete review preserve the slot, completed S6 and request identity', async () => {
  const h = harness('show'); await h.ready(); await h.step(); await h.step(); await h.step(); await h.step();
  const before = (await h.store.read()).state, get = h.api.getIssue;
  h.api.getIssue = async () => { throw Error('temporary outage'); };
  assert.equal((await h.step()).action, 'automation-pending'); h.api.getIssue = get;
  h.verdict('incomplete'); assert.equal((await h.step()).action, 'review-request-ensured');
  const after = (await h.store.read()).state;
  assert.equal(after.active.token, before.active.token); assert.equal(after.active.reviewRequest, before.active.reviewRequest); assert.equal(h.tests, 1);
});
test('S4 review uses specification route, carries a stable round and repairs a lost S5 label without another review', async () => {
  const queue = new QueueController(new MemoryQueueStore()), issue = { number: 44, state: 'open', body: 'Specification', labels: ['S4-spec-review', 'track:ask'] };
  const comments = [{ id: 1, body: 'Owner clarification', user: { type: 'User' } }]; let requests = 0, accepted = false;
  const api = { root: '/repos/test/test', request: async () => comments, moveStatus: async (_issue, label) => { issue.labels = [label, 'track:ask']; } };
  const options = { queue, api, git: { dev: 'dev', remoteHead: async () => A }, issue, activated: true,
    requestReview: async context => { assert.equal(context.kind, 'spec'); requests++; }, readReviewResult: async context => accepted ? { ...context, verdict: 'accepted' } : { missing: true } };
  const first = await reconcileSpecReview({ ...options, eventId: 'round1' }); accepted = true;
  await reconcileSpecReview({ ...options, eventId: 'round2' }); assert.ok(issue.labels.includes('S5-ready'));
  issue.labels = ['S4-spec-review']; comments.push({ id: 2, body: `<!-- process-next-review:${first.requestId} --> result`, user: { type: 'Bot' } });
  await reconcileSpecReview({ ...options, eventId: 'repair' }); assert.equal(requests, 1); assert.ok(issue.labels.includes('S5-ready'));
});

test('one incomplete review retry preserves S6 evidence, then returns the task and admits the next ready ship', async () => {
  const h = harness('show'); await h.ready(); await h.step(); await h.step(); await h.step(); await h.step();
  const before = (await h.store.read()).state, requestId = before.active.reviewRequest; let retries = 0, attempt = 1;
  await h.queue.dispatch({ id: 'next-ship', type: 'enqueue', task: { issue: 2, track: 'ship', branch: 'issue/2', layer: 'infra', materialSha: C } });
  const retry = eventId => reconcileQueue({ queue: h.queue, api: h.api, activated: true, eventId,
    requestReview: async value => { assert.equal(value.requestId, requestId); assert.equal(value.retry, true); retries++; },
    readReviewResult: async () => ({ verdict: 'incomplete', runId: 10, runAttempt: attempt }) });
  assert.equal((await retry('first-failure')).action, 'review-request-ensured');
  for (let tick = 0; tick < 5; tick++) assert.equal((await retry(`old-run-${tick}`)).action, 'review-pending');
  attempt = 2; assert.equal((await retry('second-failure')).reason, 'review-retry-exhausted');
  const after = (await h.store.read()).state;
  assert.equal(retries, 1); assert.equal(after.active, null); assert.equal(after.tasks[1].reviewRequest, requestId);
  assert.deepEqual(after.tasks[1].s6, before.tasks[1].s6); assert.ok(h.issue.labels.includes('S6-in-progress'));
  assert.equal((await h.step()).state.active.issue, 2); assert.equal(h.tests, 1);
});

test('a retry that never appears reaches attention without dispatching another paid request', async () => {
  const h = harness('show'); await h.ready(); await h.step(); await h.step(); await h.step(); await h.step(); let retries = 0;
  const step = eventId => reconcileQueue({ queue: h.queue, api: h.api, activated: true, eventId,
    requestReview: async () => { retries++; }, readReviewResult: async () => ({ missing: true }) });
  await step('missing'); h.queue.clock = () => 101 + REVIEW_RETRY_VISIBILITY_MS;
  assert.equal((await step('still-missing')).reason, 'review-retry-exhausted');
  assert.equal(retries, 1); assert.equal((await h.store.read()).state.active, null);
});

test('a persistent merge failure cannot reserve the queue forever even when a worker keeps heartbeating', async () => {
  const h = harness('ship'); await h.ready(); await h.step(); await h.step(); await h.step();
  const before = (await h.store.read()).state.active; let now = 100, merges = 0; h.queue.clock = () => now;
  const options = { queue: h.queue, api: h.api, activated: true,
    git: { merge: async () => { merges++; throw Error('branch protection refuses merge'); } } };
  const first = await reconcileQueue({ ...options, eventId: 'protected-first' });
  assert.equal(first.action, 'automation-pending'); assert.equal(first.state.active.expiresAt, before.expiresAt);
  for (let minute = 1; minute <= 30; minute++) {
    now = 100 + minute * 60_000;
    await h.queue.dispatch({ id: `heartbeat-${minute}`, type: 'heartbeat', issue: 1, token: before.token });
    const result = await reconcileQueue({ ...options, eventId: `protected-${minute}` });
    assert.equal(result.action, minute === 30 ? 'returned' : 'automation-pending');
  }
  const state = (await h.store.read()).state;
  assert.equal(state.active, null); assert.equal(state.tasks[1].automationSince, 100);
  assert.equal(state.tasks[1].reason, 'automation-timeout:automation-error'); assert.equal(state.tasks[1].status, 'S6-in-progress');
  assert.equal(now - state.tasks[1].automationSince, AUTOMATION_WAIT_MS); assert.equal(merges, 31);
  assert.equal((await h.step()).action, 'idle');
});

test('terminal unavailable S6 fallback returns to the executor and frees the slot', async () => {
  const h = harness('show'); await h.ready(); await h.step(); await h.step();
  const result = await reconcileQueue({ queue: h.queue, api: h.api, activated: true, eventId: 'no-fallback',
    runS6: async () => ({ outcome: 'unavailable', terminal: true, reason: 'fallback-permission-denied' }) });
  assert.equal(result.action, 'returned'); assert.equal(result.reason, 'fallback-permission-denied');
  assert.equal(result.state.active, null); assert.equal(result.state.tasks[1].status, 'S6-in-progress');
});

test('S4 ignores unrelated comments, allows one retry per body and then visibly waits for intervention', async () => {
  const queue = new QueueController(new MemoryQueueStore(), { clock: () => 100 });
  const issue = { number: 44, state: 'open', body: 'Specification', labels: ['S4-spec-review', 'track:ask'] };
  const comments = []; let requests = 0, retries = 0, attempt = 1, commentsFetched = 0;
  const options = { queue, issue, activated: true, git: { dev: 'dev', remoteHead: async () => A },
    api: { request: async () => { commentsFetched++; return comments; } },
    requestReview: async context => { requests++; if (context.retry) retries++; },
    readReviewResult: async () => ({ verdict: 'incomplete', runId: 10, runAttempt: attempt }) };
  const first = await reconcileSpecReview({ ...options, eventId: 'body-1' });
  comments.push({ body: 'Unrelated progress message' });
  const again = await reconcileSpecReview({ ...options, eventId: 'body-1-retry' });
  assert.equal(first.requestId, again.requestId); attempt = 2;
  for (let tick = 0; tick < 10; tick++) assert.equal((await reconcileSpecReview({ ...options, eventId: `again-${tick}` })).action, 'spec-review-attention');
  assert.equal(requests, 2); assert.equal(retries, 1); assert.equal(commentsFetched, 0);
  assert.equal((await queue.store.read()).state.specReviews[44].status, 'attention');
  issue.body += '\nClarified acceptance criterion';
  const changed = await reconcileSpecReview({ ...options, eventId: 'body-2' });
  assert.notEqual(changed.requestId, first.requestId); assert.equal(requests, 3);
});

test('S4 ship and show labels bypass model review without requiring a separate owner record', async () => {
  for (const track of ['ship', 'show']) {
    const queue = new QueueController(new MemoryQueueStore()), issue = { number: 44, state: 'open', labels: ['S4-spec-review', `track:${track}`] };
    let status;
    const result = await reconcileSpecReview({ queue, issue, activated: true, api: { moveStatus: async (_issue, value) => { status = value; } },
      requestReview: () => { throw Error('Specification workflow must not be dispatched'); } });
    assert.equal(result.action, 'spec-not-required'); assert.equal(status, 'S5-ready');
    assert.deepEqual((await queue.store.read()).state.specReviews, {});
  }
});

test('a live label event reprioritizes the waiting queue without changing GitHub labels', async () => {
  const h = harness('show'); await h.ready();
  await h.queue.dispatch({ id: 'second-ready', type: 'enqueue', task: { issue: 2, track: 'show', layer: 'infra', branch: 'issue/2', materialSha: C } });
  const issue = { number: 2, state: 'open', labels: ['S6-in-progress', 'track:ship'] };
  await handleGithubEvent({ activated: true, queue: h.queue, issue, event: { id: 'new-track', kind: 'label' } });
  assert.equal((await h.step()).state.active.issue, 2);
  assert.deepEqual(issue.labels, ['S6-in-progress', 'track:ship']);
});

test('reconciliation observes ship assigned after S6 and merges without a new review', async () => {
  const h = harness('show'); await h.ready(); await h.step(); await h.step(); await h.step();
  h.issue.labels = ['S7-code-review', 'track:ship'];
  assert.equal((await h.step()).action, 'merged'); assert.equal(h.tests, 1); assert.equal(h.reviews, 0);
  assert.ok(h.issue.labels.includes('track:ship'));
});

test('reconciliation observes show assigned to a ready ship and requests review before merge', async () => {
  const h = harness('ship'); await h.ready(); await h.step(); await h.step(); await h.step();
  h.issue.labels = ['S6-in-progress', 'track:show'];
  assert.equal((await h.step()).action, 'review-requested');
  assert.equal((await h.store.read()).state.active.phase, 'review'); assert.ok(h.issue.labels.includes('S7-code-review'));
  assert.equal(h.tests, 1); assert.equal(h.reviews, 1);
});
