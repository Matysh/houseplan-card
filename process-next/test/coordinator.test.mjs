import test from 'node:test';
import assert from 'node:assert/strict';
import { QueueController, MemoryQueueStore, reduceQueue } from '../lib/queue.mjs';
import { handleGithubEvent, reconcileQueue, reconcileMergedLabel } from '../lib/coordinator.mjs';
const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
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
    ready: () => handleGithubEvent({ activated: true, queue, issue, owner: 'owner', ownerDecision: { actor: 'owner', source: 'chat', track },
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
test('owner ship assigned in a label event survives a later agent ready event', async () => {
  const h = harness('ship');
  await handleGithubEvent({ activated: true, queue: h.queue, issue: h.issue, owner: 'owner', event: {
    id: 'owner-label', kind: 'label', action: 'labeled', actor: 'owner', label: 'track:ship' } });
  h.issue.labels.push('track:ask'); // the explicit owner decision wins over a leftover/agent label
  await handleGithubEvent({ activated: true, queue: h.queue, issue: h.issue, owner: 'owner', event: {
    id: 'agent-ready', kind: 'ready', actor: 'agent', branch: 'issue/1', materialSha: B, layer: 'infra' } });
  await h.step(); await h.step(); await h.step(); await h.step();
  assert.equal(h.reviews, 0); assert.equal((await h.store.read()).state.tasks[1].status, 'S8-merged');
});
test('confirmed pending review renews the same admission; the maximum hold still frees a stuck queue', async () => {
  const h = harness('show'); await h.ready(); await h.step(); await h.step(); await h.step(); await h.step();
  const before = (await h.store.read()).state.active; h.queue.clock = () => 1000;
  await h.step(); const renewed = (await h.store.read()).state.active;
  assert.equal(renewed.token, before.token); assert.ok(renewed.expiresAt > before.expiresAt);
  const outcome = await reconcileQueue({ queue: h.queue, api: h.api, activated: true, eventId: 'timeout', maxAdmissionMs: 500 });
  assert.equal(outcome.reason, 'admission-timeout'); assert.equal((await h.store.read()).state.active, null);
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
