import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeRemoteCommand, WorkflowReviewAdapter, finishTask, initializeMissingTrack } from '../remote.mjs';
import { MemoryQueueStore, QueueController, StateConflict, reduceQueue } from '../lib/queue.mjs';
import { initialReleaseState, reduceRelease } from '../lib/release.mjs';
import { reconcileQueue } from '../lib/coordinator.mjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40), D = 'd'.repeat(64);
const config = { enabled: true, owner: 'owner', repo: 'repo' }, env = { HP_PROCESS_NEXT_ACTIVATE: '1' };
const ownerDecision = { decisionId: 'owner1', source: 'chat', sourceRef: 'chat:test#owner1', decisionText: 'Use ship', track: 'ship' };
const context = { requestId: 'review:1:tick-admit', active: { issue: 1, expectedBase: A, materialSha: B }, task: { track: 'show', ownerAssigned: true, s6: { results: ['passed'] } } };
function reviewApi({ comments = [], runs = [], artifact = null } = {}) {
  const writes = [], reads = [];
  return { root: '/repos/owner/repo', writes, reads, request: async (method, path, body) => {
    if (method !== 'GET') { writes.push({ path, body }); return null; }
    reads.push(path);
    return path.includes('/comments') ? comments : path.includes('/artifacts') ? { artifacts: artifact ? [{ id: 41, name: 'review-result' }] : [] } : { workflow_runs: runs };
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

test('durable exact-material artifact survives failed comment publication and prevents another model run', async () => {
  const artifact = { issue: 1, kind: 'code', requestId: context.requestId, materialSha: B, verdict: 'accepted', report: { summary: 'accepted' } };
  const runs = [{ id: 11, display_title: `Code ${context.requestId}`, status: 'completed', conclusion: 'failure' }];
  const api = reviewApi({ runs, artifact }), review = new WorkflowReviewAdapter({ api, readArtifact: async () => artifact });
  assert.equal((await review.readReviewResult(context)).verdict, 'accepted');
  assert.equal((await review.requestReview(context)).requested, false); assert.equal(api.writes.length, 0);
  const wrong = new WorkflowReviewAdapter({ api, readArtifact: async () => ({ ...artifact, materialSha: C }) });
  await assert.rejects(wrong.readReviewResult(context), /different material/);
});

test('pending workflow prevents redispatch, missing workflow gets pinned inputs and S6 receipt', async () => {
  const pending = reviewApi({ runs: [{ display_title: `Код-ревью задачи #1 · ${context.requestId}`, status: 'in_progress' }] });
  assert.equal((await new WorkflowReviewAdapter({ api: pending }).requestReview(context)).observed.pending, true);
  assert.equal(pending.writes.length, 0);
  const api = reviewApi(); await new WorkflowReviewAdapter({ api }).requestReview(context);
  assert.deepEqual(api.writes[0].body.inputs, { issue: '1', base: A, head: B, track: 'show', requestId: context.requestId,
    kind: 'code', patchId: '', receipts: JSON.stringify([context.task.s6]) });
});

test('completed workflow without report is incomplete; owner ship cannot dispatch', async () => {
  const api = reviewApi({ runs: [{ display_title: `Code ${context.requestId}`, status: 'completed' }] });
  assert.equal((await new WorkflowReviewAdapter({ api }).readReviewResult(context)).verdict, 'incomplete');
  await assert.rejects(new WorkflowReviewAdapter({ api }).requestReview({ ...context, task: { track: 'ship', ownerAssigned: true, ownerDecision } }), /never requests/);
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
  const dependencies = { queue, api, git, inspectMaterial: async (_git, expectedBase, materialSha) => ({ expectedBase, materialSha, patchId: 'patch', layer: issue.testLayer ?? 'product', changedFiles: issue.testLayer === 'docs' ? ['README.md'] : ['src/logic.ts'] }), review: { requestReview: async () => { actions.push('review'); },
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

test('installed ship label needs no provenance and does not use individual review', async () => {
  const h = queueHarness();
  h.issue.labels = ['S6-in-progress', 'track:ship']; h.issue.testLayer = 'docs';
  await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'docs' });
  await h.command('admit'); const token = (await h.store.read()).state.active.token;
  await h.command('synchronized', { token, expectedBase: A, materialSha: B });
  assert.equal((await h.command('reconcile')).action, 'ready-to-merge');
  await h.command('merge', { token }); assert.deepEqual(h.actions, ['merge']);
});

test('queue metadata race retries the same merge without returning to S6 or rerunning review', async () => {
  const h = queueHarness();
  h.issue.labels = ['S6-in-progress', 'track:ship']; h.issue.testLayer = 'docs';
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
  h.issue.labels = ['S6-in-progress', 'track:ship']; h.issue.testLayer = 'docs';
  await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'docs' }); await h.command('admit');
  const token = (await h.store.read()).state.active.token;
  await h.command('synchronized', { token, expectedBase: A, materialSha: B }); await h.command('reconcile');
  h.dependencies.git.merge = async () => { throw new StateConflict(); };
  assert.equal((await h.command('merge', { token })).action, 'automation-pending');
  assert.equal((await h.store.read()).state.active.phase, 'ready-to-merge');
});

function readyRelease() {
  let state = initialReleaseState();
  for (const event of [
    { type: 'create', candidate: 'beta1', kind: 'beta', branch: 'release/beta1', sourceSha: B },
    { type: 'run-started', candidate: 'beta1', sha: B },
    { type: 'runner-report', candidate: 'beta1', report: { schema: 1, id: 'r', event: 'beta', materialSha: B, materialClean: true, status: 'passed', finishedAt: '2026-11-01T00:00:00Z', reportPath: '/report.json', results: [{ id: 'test', status: 'passed' }] } },
    { type: 'metrics', candidate: 'beta1', sha: B, report: { requiresDecision: false, needsMeasurement: false } }
  ]) state = reduceRelease(state, { id: event.type, ...event });
  return state;
}

test('publication retry reuses checked candidate and actual evidence, including repeated transient failures', async () => {
  const store = new MemoryQueueStore(readyRelease()); let publishes = 0;
  const dependencies = { api: { root: '/repos/owner/repo' }, git: {}, releaseStore: store,
    publisher: { publish: async ({ candidate }) => {
      assert.equal(candidate.runner.status, 'passed');
      if (++publishes < 3) throw Error(`Transient ${publishes}`);
      return { published: true, evidence: { sha: B, tag: 'v1-beta.1', artifactDigest: D } };
    } } };
  const call = () => executeRemoteCommand({ command: 'publish-prepared', config, env, execute: true, dependencies,
    event: { id: 'publish1', candidate: 'beta1', tag: 'v1-beta.1', artifacts: [] } });
  await assert.rejects(call(), /Transient 1/); await assert.rejects(call(), /Transient 2/);
  assert.equal((await call()).state.candidates.beta1.status, 'published');
  assert.equal(publishes, 3); assert.equal((await store.read()).state.candidates.beta1.runner.id, 'r');
});

test('release raw events cannot manufacture publication or HACS evidence', async () => {
  await assert.rejects(executeRemoteCommand({ command: 'release-event', config, env, execute: true,
    event: { id: 'fake', type: 'published' }, dependencies: { api: { root: '/repos/owner/repo' }, git: {} } }), /actual delivery evidence/);
});
test('one finish invocation waits, synchronizes, runs S6 once and survives a lost review dispatch response', async () => {
  const h = queueHarness(); let checks = 0, requests = 0;
  h.dependencies.git.git = async () => A;
  h.dependencies.synchronize = async () => ({ expectedBase: A, materialSha: B, patchId: 'samepatch', layer: 'product', changedFiles: ['src/logic.ts'] });
  h.dependencies.planProfile = async options => { assert.equal(options.layer, 'product'); return { name: 'task', steps: [] }; };
  h.dependencies.runPlan = async () => { checks++; return { id: 'real-local-receipt', status: 'passed', reportPath: '/receipt.json' }; };
  h.dependencies.sleep = async () => {};
  h.dependencies.review.requestReview = async () => { requests++; throw Error('response lost after workflow dispatch'); };
  const result = await finishTask({ config: { ...config, workspace: '/prepared' }, event: { id: 'finish-one', issue: 1, branch: 'issue/1', request: { layer: 'docs' } },
    queue: h.queue, api: h.dependencies.api, git: h.dependencies.git, review: h.dependencies.review, dependencies: h.dependencies, maxWaitMs: 1000 });
  assert.equal(result.action, 'merged'); assert.equal(checks, 1); assert.equal(requests, 1);
  assert.equal((await h.store.read()).state.tasks[1].devBuild.status, 'pending');
});
test('completed review transport failure reruns the same workflow instead of another paid request identity', async () => {
  const api = reviewApi({ runs: [{ id: 12, display_title: `Code ${context.requestId}`, status: 'completed', conclusion: 'failure' }] });
  const result = await new WorkflowReviewAdapter({ api }).requestReview({ ...context, retry: true });
  assert.equal(result.retry, true); assert.equal(result.requestId, context.requestId);
  assert.match(api.writes[0].path, /\/actions\/runs\/12\/rerun-failed-jobs$/);
});

test('a retry needs an explicit durable grant and cannot exceed GitHub attempt two', async () => {
  const run = { id: 12, display_title: `Code ${context.requestId}`, status: 'completed', run_attempt: 1 };
  const api = reviewApi({ runs: [run] }), adapter = new WorkflowReviewAdapter({ api });
  assert.equal((await adapter.requestReview(context)).needsAttention, true);
  run.run_attempt = 2;
  assert.equal((await adapter.requestReview({ ...context, retry: true })).needsAttention, true);
  assert.equal(api.writes.length, 0);
});

test('previous review lookup downloads only artifacts belonging to this issue and kind', async () => {
  const runs = [
    { id: 1, display_title: 'Код-ревью задачи #2 · review:2:old' },
    { id: 2, display_title: 'Ревью ТЗ задачи #1 · spec:1:old' },
    { id: 3, display_title: `Код-ревью задачи #1 · ${context.requestId}` },
    { id: 4, display_title: 'Код-ревью задачи #1 · review:1:old' },
  ].map(row => ({ ...row, status: 'completed' }));
  const artifact = { issue: 1, kind: 'code', requestId: 'review:1:old', report: { summary: 'previous' } };
  const api = reviewApi({ runs, artifact });
  const result = await new WorkflowReviewAdapter({ api, readArtifact: async () => artifact })
    .readPreviousReviewResult({ issue: 1, excludeRequestId: context.requestId });
  assert.equal(result.runId, 4);
  assert.equal(api.reads.filter(path => path.includes('/artifacts')).length, 1);
});

test('track initialization adds only a missing label and never changes an installed track', async () => {
  let issue = { number: 1, labels: ['S6-in-progress', 'track:ask'] }; const writes = [];
  const api = { root: '/repos/test/repo', getIssue: async () => issue,
    request: async (...args) => { writes.push(args); issue.labels.push(...args[2].labels); } };
  assert.equal((await initializeMissingTrack(api, issue, 'ship')).labels.at(-1), 'track:ask');
  assert.equal(writes.length, 0);
  issue = { number: 1, labels: ['S6-in-progress'] };
  await initializeMissingTrack(api, issue, 'ship');
  assert.deepEqual(writes[0], ['POST', '/repos/test/repo/issues/1/labels', { labels: ['track:ship'] }]);
  await initializeMissingTrack(api, issue, 'show'); assert.equal(writes.length, 1);
});

test('coordinator label events never assign a missing track; S4 still requests spec review', async () => {
  for (const status of ['S4-spec-review', 'S8-merged']) {
    const h = queueHarness(); h.issue.labels = [status];
    h.dependencies.api.request = async () => { throw Error('Coordinator must not write a track label'); };
    h.dependencies.review.readReviewResult = async () => ({ missing: true });
    const result = await h.command('label', { track: 'ship' });
    assert.equal(result.action, status === 'S4-spec-review' ? 'spec-review-requested' : 'reconcile');
    assert.deepEqual(h.issue.labels, [status]);
    assert.deepEqual(h.actions, status === 'S4-spec-review' ? ['review'] : []);
  }
});

test('executor ready may initialize the missing ship label explicitly', async () => {
  const h = queueHarness(); h.issue.labels = ['S6-in-progress']; const writes = [];
  h.dependencies.api.request = async (method, url, body) => { writes.push({ method, url, body }); h.issue.labels.push(...body.labels); };
  await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'product', track: 'ship' });
  assert.deepEqual(writes.map(write => write.body), [{ labels: ['track:ship'] }]);
  assert.equal((await h.store.read()).state.tasks[1].track, 'ship');
});

test('release return binds computed Git proof, never a caller-supplied review exemption', async () => {
  for (const clean of [true, false]) {
    const h = queueHarness();
    await h.queue.dispatch({ id: 'return-release', type: 'enqueue', task: { issue: 1, branch: 'issue/1', materialSha: B,
      layer: 'product', track: 'show', syncMode: 'merge', mergeSourceSha: C, releaseTag: 'v1.0.1' } });
    await h.command('admit'); const token = (await h.store.read()).state.active.token;
    let proofs = 0;
    h.dependencies.git.publishedReturnReview = async ({ task, expectedBase, materialSha, patchId }) => {
      proofs++; assert.equal(task.releaseTag, 'v1.0.1'); assert.equal(expectedBase, A); assert.equal(materialSha, B);
      return clean ? { source: 'published-release', sourceSha: C, tag: 'v1.0.1', patchId, verdict: 'accepted' } : null;
    };
    await h.command('synchronized', { token, expectedBase: A, materialSha: B, review: { source: 'published-release', verdict: 'accepted', patchId: 'patch' } });
    await h.command('s6-complete', { token, materialSha: B, outcome: 'passed', evidence: { status: 'passed' } });
    assert.equal((await h.store.read()).state.active.phase, clean ? 'ready-to-merge' : 'review');
    assert.equal(proofs, 1);
  }
});

test('finish uses hosted S6 on the admitted SHA and frees the slot on terminal transport failure', async () => {
  for (const terminal of [false, true]) {
    const h = queueHarness(); let calls = 0;
    h.dependencies.git.git = async () => A;
    h.dependencies.synchronize = async () => ({ expectedBase: A, materialSha: B, patchId: 'same', layer: 'product' });
    h.dependencies.runPlan = () => { throw Error('Local tests must not run in fallback'); };
    h.dependencies.sleep = async () => {};
    h.dependencies.fallback = { runS6: async ({ active }) => {
      calls++; assert.equal(active.materialSha, B);
      return terminal ? { outcome: 'unavailable', terminal: true, reason: 'permissions' }
        : { outcome: 'passed', receipt: { runId: 42, materialSha: B, status: 'passed' } };
    } };
    const result = await finishTask({ config, event: { id: 'hosted', issue: 1, branch: 'issue/1', s6: 'github' },
      queue: h.queue, api: h.dependencies.api, git: h.dependencies.git, review: h.dependencies.review,
      dependencies: h.dependencies, maxWaitMs: 1000 });
    assert.equal(result.action, terminal ? 'returned' : 'merged'); assert.equal(calls, 1);
    assert.equal((await h.store.read()).state.active, null);
  }
});

test('waiting finish observes once per minute without reconciling another admitted task', async () => {
  const h = queueHarness();
  await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'product' }); await h.command('admit');
  await h.queue.dispatch({ id: 'ready2', type: 'enqueue', task: { issue: 2, branch: 'issue/2', materialSha: C, layer: 'product', track: 'show' } });
  let now = 0; const sleeps = [], before = (await h.store.read()).state;
  const result = await finishTask({ config, event: { id: 'wait2', issue: 2, branch: 'issue/2' }, queue: h.queue,
    api: h.dependencies.api, git: h.dependencies.git, review: h.dependencies.review, maxWaitMs: 120000,
    dependencies: { clock: () => now, sleep: async ms => { sleeps.push(ms); now += ms; } } });
  assert.equal(result.action, 'waiting'); assert.deepEqual(sleeps, [60000, 60000]);
  assert.deepEqual((await h.store.read()).state, before); assert.deepEqual(h.actions, []);
});

test('publication reads the completed runner JSON and exact-SHA metrics without manual per-step events', async t => {
  const root = await mkdtemp(join(tmpdir(), 'process-next-publication-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const report = { schema: 1, id: 'actual-file', event: 'beta', materialSha: B, materialClean: true,
    status: 'passed', finishedAt: '2026-11-01T00:00:00Z', results: [{ id: 'behavior', status: 'passed' }] };
  await writeFile(join(root, 'report.json'), JSON.stringify(report));
  await mkdir(join(root, 'artifacts/process-next'), { recursive: true });
  await writeFile(join(root, 'artifacts/process-next/metrics.json'), JSON.stringify({ sha: B, requiresDecision: false, needsMeasurement: false }));
  const initial = reduceRelease(initialReleaseState(), { id: 'create', type: 'create', candidate: 'beta1', kind: 'beta', branch: 'release/beta1', sourceSha: B });
  const store = new MemoryQueueStore(initial);
  const dependencies = { api: { root: '/repos/owner/repo' }, git: {}, releaseStore: store,
    publisher: { publish: async ({ candidate }) => {
      assert.equal(candidate.runner.id, 'actual-file'); assert.equal(candidate.metrics.sha, B);
      return { published: true, evidence: { sha: B, tag: 'v1-beta.1', artifactDigest: D } };
    } } };
  const result = await executeRemoteCommand({ command: 'publish-prepared', config: { ...config, workspace: root }, env, execute: true, dependencies,
    event: { id: 'publish-file', candidate: 'beta1', tag: 'v1-beta.1', reportPath: 'report.json', artifacts: [] } });
  assert.equal(result.state.candidates.beta1.status, 'published');
});

test('observed current dev-build covers every older pending product ancestor', async () => {
  const h = queueHarness();
  await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'product' }); await h.command('admit');
  const token = (await h.store.read()).state.active.token;
  await h.command('synchronized', { token, expectedBase: A, materialSha: B });
  await h.command('s6-complete', { token, materialSha: B, outcome: 'passed', evidence: { result: 'passed' } });
  await h.command('reconcile'); await h.command('reconcile'); await h.command('merge', { token });
  h.dependencies.git.remoteHead = async () => C;
  h.dependencies.git.git = async () => JSON.stringify({ source: C });
  const ancestors = []; h.dependencies.git.assertAncestor = async (older, newer) => ancestors.push([older, newer]);
  const delivered = await h.command('dev-build-complete');
  assert.equal(delivered.state.tasks[1].devBuild.status, 'published'); assert.ok(ancestors.some(([older, newer]) => older === B && newer === C));
});
