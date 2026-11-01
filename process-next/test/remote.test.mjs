import test from 'node:test';
import assert from 'node:assert/strict';
import { executeRemoteCommand, WorkflowReviewAdapter } from '../remote.mjs';
import { MemoryQueueStore, QueueController, StateConflict, reduceQueue } from '../lib/queue.mjs';
import { initialReleaseState, reduceRelease } from '../lib/release.mjs';
import { reconcileQueue } from '../lib/coordinator.mjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40), D = 'd'.repeat(64);
const config = { enabled: true, owner: 'owner', repo: 'repo' }, env = { HP_PROCESS_NEXT_ACTIVATE: '1' };
const context = { requestId: 'review:1:tick-admit', active: { issue: 1, expectedBase: A, materialSha: B }, task: { track: 'show', ownerAssigned: true, s6: { results: ['passed'] } } };
function reviewApi({ comments = [], runs = [] } = {}) {
  const writes = [], reads = [];
  return { root: '/repos/owner/repo', writes, reads, request: async (method, path, body) => {
    if (method !== 'GET') { writes.push({ path, body }); return null; }
    reads.push(path);
    return path.includes('/comments') ? comments : { workflow_runs: runs };
  } };
}
function trustedReport(verdict = 'accepted', extra = {}) {
  return { user: { login: 'github-actions[bot]' }, html_url: 'https://example.test/report',
    body: '<!-- process-next-review:review:1:tick-admit -->\n```json\n' + JSON.stringify({ requestId: context.requestId, materialSha: B, verdict, ...extra }) + '\n```\nReview text' };
}

test('default remote planning is offline even with enabled config and credentials', async () => {
  let calls = 0;
  const result = await executeRemoteCommand({ command: 'merge', config, event: { id: 'plan', issue: 1 },
    env: { ...env, GH_TOKEN: 'secret-value' }, dependencies: { api: { getIssue: () => { calls++; } } } });
  assert.equal(result.offline, true); assert.equal(calls, 0); assert.ok(!JSON.stringify(result).includes('secret-value'));
});

test('execution needs both explicit activations and credentials come only from env', async () => {
  for (const [conf, environment] of [[{ ...config, enabled: false }, env], [config, {}]])
    await assert.rejects(executeRemoteCommand({ command: 'admit', config: conf, env: environment, event: { id: 'a' }, execute: true }), /disabled/);
  await assert.rejects(executeRemoteCommand({ command: 'admit', config, env, event: { id: 'a' }, execute: true }), /Missing credential/);
});

test('workflow adapter accepts only trusted exact-material reports and skips duplicate dispatch', async () => {
  const impostor = trustedReport('changes_requested'); impostor.user.login = 'someone';
  const api = reviewApi({ comments: [impostor, trustedReport()] }), review = new WorkflowReviewAdapter({ api });
  assert.equal((await review.readReviewResult(context)).verdict, 'accepted');
  assert.equal((await review.requestReview(context)).requested, false); assert.equal(api.writes.length, 0);
  const wrong = new WorkflowReviewAdapter({ api: reviewApi({ comments: [trustedReport('accepted', { materialSha: C })] }) });
  await assert.rejects(wrong.readReviewResult(context), /different material/);
});

test('pending workflow prevents redispatch, missing workflow gets pinned inputs and S6 receipt', async () => {
  const pending = reviewApi({ runs: [{ display_title: `Код-ревью задачи #1 · ${context.requestId}`, status: 'in_progress' }] });
  assert.equal((await new WorkflowReviewAdapter({ api: pending }).requestReview(context)).observed.pending, true);
  assert.equal(pending.writes.length, 0);
  const api = reviewApi(); await new WorkflowReviewAdapter({ api }).requestReview(context);
  assert.deepEqual(api.writes[0].body.inputs, { issue: '1', base: A, head: B, track: 'show', requestId: context.requestId,
    kind: 'code', ownerAssigned: 'true', receipts: JSON.stringify([context.task.s6]) });
});

test('completed workflow without report is incomplete; owner ship cannot dispatch', async () => {
  const api = reviewApi({ runs: [{ display_title: `Code ${context.requestId}`, status: 'completed' }] });
  assert.equal((await new WorkflowReviewAdapter({ api }).readReviewResult(context)).verdict, 'incomplete');
  await assert.rejects(new WorkflowReviewAdapter({ api }).requestReview({ ...context, task: { track: 'ship', ownerAssigned: true } }), /never requests/);
});

function queueHarness() {
  const store = new MemoryQueueStore(), queue = new QueueController(store, { clock: () => 100 });
  const originalRead = store.read.bind(store); store.read = async () => ({ ...await originalRead(), headSha: C });
  store.branch = 'process-state'; store.path = 'queue.json';
  const issue = { number: 1, state: 'open', labels: ['S6-in-progress', 'track:show'] }, actions = [];
  const api = { root: '/repos/owner/repo', getIssue: async () => structuredClone(issue),
    moveStatus: async (_number, status) => { issue.labels = issue.labels.filter(label => !/^S\d-/.test(label)).concat(status); } };
  const git = { dev: 'dev', remoteHead: async branch => branch === 'dev' ? A : B,
    ensureCommit: async () => {}, assertAncestor: async () => {}, merge: async ({ fence, materialSha }) => {
      actions.push('merge'); const before = await store.read();
      const state = reduceQueue(before.state, { id: fence.eventId, type: 'merged', issue: 1, token: fence.token, materialSha, actualDevSha: materialSha }, { now: 100 });
      await store.compareAndSwap(before.version, state); return { merged: true, statePersisted: true, state };
    } };
  const dependencies = { queue, api, git, review: { requestReview: async () => { actions.push('review'); },
    readReviewResult: async ({ requestId }) => ({ requestId, materialSha: B, verdict: 'accepted' }) } };
  let count = 0;
  const command = (name, extra = {}) => executeRemoteCommand({ command: name, config, env, execute: true,
    dependencies, event: { id: `event${++count}`, issue: 1, ...extra } });
  return { store, queue, dependencies, actions, issue, command };
}

test('remote show flow binds local S6 to workflow review and atomic merge without a test runner', async () => {
  const h = queueHarness();
  await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'product' });
  await h.command('admit'); const token = (await h.store.read()).state.active.token;
  await h.command('synchronized', { token, expectedBase: A, materialSha: B });
  assert.equal((await h.command('reconcile')).action, 's6-required');
  await h.command('s6-complete', { token, materialSha: B, outcome: 'passed', evidence: { sha: B, result: 'passed' } });
  assert.equal((await h.command('reconcile')).action, 'review-requested');
  assert.equal((await h.command('review-complete', { token, verdict: 'rejected-untrusted-input' })).action, 'ready-to-merge');
  assert.equal((await h.command('merge', { token })).action, 'merged');
  assert.deepEqual(h.actions, ['review', 'merge']); assert.ok(h.issue.labels.includes('S8-merged'));
});

test('remote owner decision is retained before ready; ship does not use review', async () => {
  const h = queueHarness();
  await h.command('owner-decision', { ownerDecision: { actor: 'owner', source: 'chat', track: 'ship' } });
  await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'docs' });
  await h.command('admit'); const token = (await h.store.read()).state.active.token;
  await h.command('synchronized', { token, expectedBase: A, materialSha: B });
  assert.equal((await h.command('reconcile')).action, 'ready-to-merge');
  await h.command('merge', { token }); assert.deepEqual(h.actions, ['merge']);
});

test('queue metadata race retries the same merge without returning to S6 or rerunning review', async () => {
  const h = queueHarness();
  await h.command('owner-decision', { ownerDecision: { actor: 'owner', source: 'chat', track: 'ship' } });
  await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'docs' }); await h.command('admit');
  const token = (await h.store.read()).state.active.token;
  await h.command('synchronized', { token, expectedBase: A, materialSha: B }); await h.command('reconcile');
  const merge = h.dependencies.git.merge; let attempts = 0;
  h.dependencies.git.merge = async args => { if (++attempts === 1) throw new StateConflict(); return merge(args); };
  assert.equal((await h.command('merge', { token })).action, 'merged'); assert.equal(attempts, 2);
  assert.deepEqual(h.actions, ['merge']);
});

test('repeated queue metadata races leave accepted material ready, not failed', async () => {
  const h = queueHarness();
  await h.command('owner-decision', { ownerDecision: { actor: 'owner', source: 'chat', track: 'ship' } });
  await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'docs' }); await h.command('admit');
  const token = (await h.store.read()).state.active.token;
  await h.command('synchronized', { token, expectedBase: A, materialSha: B }); await h.command('reconcile');
  h.dependencies.git.merge = async () => { throw new StateConflict(); };
  assert.equal((await h.command('merge', { token })).action, 'merge-pending');
  assert.equal((await h.store.read()).state.active.phase, 'ready-to-merge');
});

function readyRelease() {
  let state = initialReleaseState();
  for (const event of [
    { type: 'create', candidate: 'beta1', kind: 'beta', branch: 'release/beta1', sourceSha: B, requirements: [{ id: 'test', inputsDigest: 'same' }] },
    { type: 'run-started', candidate: 'beta1', sha: B, runId: 'r', cases: ['test'] },
    { type: 'run-finished', candidate: 'beta1', sha: B, runId: 'r', results: [{ id: 'test', inputsDigest: 'same', status: 'passed' }] },
    { type: 'metrics', candidate: 'beta1', sha: B, report: { requiresDecision: false, needsMeasurement: false } }
  ]) state = reduceRelease(state, { id: event.type, ...event });
  return state;
}

test('publication retry reuses checked candidate and actual evidence, including repeated transient failures', async () => {
  const store = new MemoryQueueStore(readyRelease()); let publishes = 0;
  const dependencies = { api: { root: '/repos/owner/repo' }, git: {}, releaseStore: store,
    publisher: { publish: async ({ candidate }) => {
      assert.equal(candidate.results.test.status, 'passed');
      if (++publishes < 3) throw Error(`Transient ${publishes}`);
      return { published: true, evidence: { sha: B, tag: 'v1-beta.1', artifactDigest: D } };
    } } };
  const call = () => executeRemoteCommand({ command: 'publish-prepared', config, env, execute: true, dependencies,
    event: { id: 'publish1', candidate: 'beta1', tag: 'v1-beta.1', artifacts: [] } });
  await assert.rejects(call(), /Transient 1/); await assert.rejects(call(), /Transient 2/);
  assert.equal((await call()).state.candidates.beta1.status, 'published');
  assert.equal(publishes, 3); assert.equal((await store.read()).state.candidates.beta1.results.test.runId, 'r');
});

test('release raw events cannot manufacture publication or HACS evidence', async () => {
  await assert.rejects(executeRemoteCommand({ command: 'release-event', config, env, execute: true,
    event: { id: 'fake', type: 'published' }, dependencies: { api: { root: '/repos/owner/repo' }, git: {} } }), /actual delivery evidence/);
});
