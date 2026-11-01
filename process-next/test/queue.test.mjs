import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialQueueState, reduceQueue, MemoryQueueStore, LocalQueueStore, QueueController, StateConflict, LeaseLost } from '../lib/queue.mjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40);
const task = (issue, track = 'show', layer = 'product') => ({ issue, track, layer, ownerAssigned: true, branch: `issue/${issue}`, materialSha: B });
const decision = (issue, track = 'ship') => ({ type: 'owner-track', issue, track, decisionId: `owner-${issue}`, source: 'chat', sourceRef: `chat:test#${issue}`, decisionText: `Use ${track}` });
function harness() {
  let state = initialQueueState(), counter = 0, now = 100;
  return { event(value) { state = reduceQueue(state, { id: `e${++counter}`, ...value }, { now, leaseMs: 100 }); return state; },
    get state() { return state; }, time(value) { now = value; } };
}
function prepared(h, selected = task(1)) {
  if (selected.track === 'ship' && selected.ownerAssigned) h.event(decision(selected.issue));
  h.event({ type: 'enqueue', task: selected }); h.event({ type: 'admit' });
  const token = h.state.active.token;
  h.event({ type: 'synchronized', issue: selected.issue, token, expectedBase: A, materialSha: B });
  return token;
}

test('ready ship first; show and ask share FIFO; no interruption of an admitted task', () => {
  const h = harness();
  h.event(decision(3)); h.event(decision(4));
  h.event({ type: 'enqueue', task: task(1, 'ask') }); h.event({ type: 'enqueue', task: task(2, 'show') });
  h.event({ type: 'enqueue', task: task(3, 'ship') }); h.event({ type: 'admit' });
  assert.equal(h.state.active.issue, 3);
  h.event({ type: 'enqueue', task: task(4, 'ship') }); h.event({ type: 'admit' }); assert.equal(h.state.active.issue, 3);
  for (const issue of [4, 1, 2]) {
    h.event({ type: 'return', issue: h.state.active.issue, token: h.state.active.token, reason: 'fix' });
    h.event({ type: 'admit' }); assert.equal(h.state.active.issue, issue);
  }
});
test('duplicate deliveries are idempotent, conflicting reuse of delivery ID refuses', () => {
  const h = harness(), event = { type: 'enqueue', id: 'same', task: task(1) };
  h.event(event); const before = h.state; h.event(event); assert.deepEqual(h.state, before);
  assert.throws(() => h.event({ ...event, task: task(2) }), /another payload/);
});
test('show keeps exclusive admission while waiting for S7; no merge before accepted review', () => {
  const h = harness(), token = prepared(h);
  h.event({ type: 's6-complete', issue: 1, token, materialSha: B, outcome: 'passed' });
  assert.equal(h.state.active.phase, 'review'); assert.equal(h.state.tasks[1].status, 'S7-code-review');
  assert.throws(() => h.event({ type: 'merged', issue: 1, token, materialSha: B, actualDevSha: B }), /Actual merge/);
  h.event({ type: 'review-complete', issue: 1, token, materialSha: B, verdict: 'accepted' });
  h.event({ type: 'merged', issue: 1, token, materialSha: B, actualDevSha: B });
  assert.equal(h.state.tasks[1].status, 'S8-merged'); assert.equal(h.state.active, null);
});
test('owner ship skips individual review, but cannot skip S6', () => {
  const h = harness(), token = prepared(h, task(1, 'ship'));
  assert.throws(() => h.event({ type: 'merged', issue: 1, token, materialSha: B, actualDevSha: B }), /Actual merge/);
  h.event({ type: 's6-complete', issue: 1, token, materialSha: B, outcome: 'passed' });
  assert.equal(h.state.active.phase, 'ready-to-merge'); assert.equal(h.state.tasks[1].review, undefined);
});
test('docs use not-required without pretending tests passed', () => {
  const h = harness(), token = prepared(h, task(1, 'ship', 'docs'));
  assert.throws(() => h.event({ type: 's6-complete', issue: 1, token, materialSha: B, outcome: 'passed' }), /documentation/);
  h.event({ type: 's6-complete', issue: 1, token, materialSha: B, outcome: 'not-required' });
  assert.equal(h.state.active.phase, 'ready-to-merge');
});
test('unconfirmed ship has no owner exemption', () => {
  const h = harness(), token = prepared(h, { ...task(1, 'ship'), ownerAssigned: false });
  h.event({ type: 's6-complete', issue: 1, token, materialSha: B, outcome: 'passed' }); assert.equal(h.state.active.phase, 'review');
});
test('return frees the slot and retains useful evidence; reentry has a new fence and FIFO ticket', () => {
  const h = harness(), token = prepared(h);
  h.event({ type: 's6-complete', issue: 1, token, materialSha: B, outcome: 'passed', evidence: { run: 'kept' } });
  h.event({ type: 'return', issue: 1, token }); assert.equal(h.state.tasks[1].s6.run, 'kept');
  h.event({ type: 'enqueue', task: task(2) }); h.event({ type: 'enqueue', task: task(1) }); h.event({ type: 'admit' });
  assert.equal(h.state.active.issue, 2); assert.notEqual(h.state.active.token, token);
});
test('unchanged accepted review survives an automation return and same-material reentry', () => {
  const h = harness(), token = prepared(h);
  h.event({ type: 's6-complete', issue: 1, token, materialSha: B, outcome: 'passed' });
  h.event({ type: 'review-complete', issue: 1, token, materialSha: B, verdict: 'accepted', review: { report: 'review.md' } });
  h.event({ type: 'return', issue: 1, token, reason: 'automation-error' });
  h.event({ type: 'enqueue', task: task(1) }); h.event({ type: 'admit' }); const next = h.state.active.token;
  h.event({ type: 'synchronized', issue: 1, token: next, expectedBase: A, materialSha: B });
  h.event({ type: 's6-complete', issue: 1, token: next, materialSha: B, outcome: 'passed', evidence: { reused: true } });
  assert.equal(h.state.active.phase, 'ready-to-merge'); assert.equal(h.state.tasks[1].review.report, 'review.md');
});
test('expired worker cannot heartbeat or submit old results; next task can acquire the slot', () => {
  const h = harness(), token = prepared(h); h.event({ type: 'enqueue', task: task(2) }); h.time(201);
  assert.throws(() => h.event({ type: 'heartbeat', issue: 1, token }), LeaseLost);
  h.event({ type: 'admit' }); assert.equal(h.state.active.issue, 2);
  assert.throws(() => h.event({ type: 's6-complete', issue: 1, token, materialSha: B, outcome: 'passed' }), LeaseLost);
});
test('results for another material do not advance S6', () => {
  const h = harness(), token = prepared(h);
  assert.throws(() => h.event({ type: 's6-complete', issue: 1, token, materialSha: A, outcome: 'passed' }), /another material/);
});
test('CAS retries concurrent enqueues and never loses either event', async () => {
  const store = new MemoryQueueStore(), one = new QueueController(store), two = new QueueController(store);
  await Promise.all([one.dispatch({ id: 'one', type: 'enqueue', task: task(1) }), two.dispatch({ id: 'two', type: 'enqueue', task: task(2) })]);
  assert.equal((await store.read()).state.waiting.length, 2);
  await Promise.all([one.dispatch({ id: 'a', type: 'admit' }), two.dispatch({ id: 'b', type: 'admit' })]);
  assert.equal((await store.read()).state.waiting.length, 1);
});
test('local state CAS persists across instances and rejects a stale writer', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'hp-next-state-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'queue.json'), one = new LocalQueueStore(path), two = new LocalQueueStore(path);
  const before = await one.read(), next = reduceQueue(before.state, { id: 'add', type: 'enqueue', task: task(1) });
  await one.compareAndSwap(before.version, next);
  await assert.rejects(two.compareAndSwap(before.version, before.state), StateConflict);
  assert.deepEqual((await two.read()).state, next);
});
test('idle ticks never write state and active delivery history remains bounded', async () => {
  const store = new MemoryQueueStore(), queue = new QueueController(store); let writes = 0;
  const save = store.compareAndSwap.bind(store); store.compareAndSwap = (...args) => { writes++; return save(...args); };
  for (let index = 0; index < 1000; index++) await queue.dispatch({ id: `idle${index}`, type: 'admit' });
  assert.equal(writes, 0); assert.equal((await store.read()).state.revision, 0);
  const h = harness(), token = prepared(h);
  for (let index = 0; index < 600; index++) { h.time(101 + index); h.event({ type: 'heartbeat', issue: 1, token }); }
  assert.ok(Object.keys(h.state.events).length <= 256);
});
test('explicit source is required; enqueue ownerAssigned and a shared owner login confer no exemption', () => {
  let state = reduceQueue(initialQueueState(), { id: 'agent', type: 'enqueue', task: task(1, 'ship') });
  assert.equal(state.tasks[1].ownerAssigned, false);
  assert.throws(() => reduceQueue(state, { id: 'actor', type: 'owner-track', issue: 1, actor: 'Matysh', source: 'label', track: 'ship' }), /Explicit owner decision/);
});
test('expired lease and clean rebase retain accepted patch review without a new request', () => {
  const h = harness(), token = prepared(h);
  h.event({ type: 's6-complete', issue: 1, token, materialSha: B, outcome: 'passed' });
  h.event({ type: 'review-requested', issue: 1, token, materialSha: B, requestId: 'review:same-patch' });
  h.event({ type: 'review-complete', issue: 1, token, materialSha: B, verdict: 'accepted' });
  h.time(201); h.event({ type: 'expire' }); h.event({ type: 'admit' });
  const next = h.state.active.token, nextSha = 'c'.repeat(40);
  h.event({ type: 'synchronized', issue: 1, token: next, expectedBase: A, materialSha: nextSha, patchId: B });
  h.event({ type: 's6-complete', issue: 1, token: next, materialSha: nextSha, outcome: 'passed' });
  assert.equal(h.state.active.phase, 'ready-to-merge'); assert.equal(h.state.active.reviewRequest, 'review:same-patch');
});
