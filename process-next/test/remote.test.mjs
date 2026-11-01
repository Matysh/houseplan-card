import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeRemoteCommand, WorkflowReviewAdapter, finishTask, initializeMissingTrack } from '../remote.mjs';
import { MemoryQueueStore, QueueController, StateConflict, reduceQueue } from '../lib/queue.mjs';
import { initialReleaseState, reduceRelease } from '../lib/release.mjs';
import { reconcileQueue } from '../lib/coordinator.mjs';
import { GitHubClient } from '../lib/github.mjs';

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

test('durable exact-material artifact is read without writes and prevents another model run', async () => {
  const artifact = { issue: 1, kind: 'code', requestId: context.requestId, materialSha: B, verdict: 'accepted', report: { summary: 'accepted' } };
  const runs = [{ id: 11, display_title: `Code ${context.requestId}`, status: 'completed', conclusion: 'failure' }];
  const api = reviewApi({ runs, artifact }), review = new WorkflowReviewAdapter({ api, readArtifact: async () => artifact });
  assert.equal((await review.readReviewResult(context)).verdict, 'accepted');
  assert.equal((await review.requestReview(context)).requested, false); assert.equal(api.writes.length, 0);
  const wrong = new WorkflowReviewAdapter({ api, readArtifact: async () => ({ ...artifact, materialSha: C }) });
  await assert.rejects(wrong.readReviewResult(context), /different material/);
});

test('concurrent readers never publish; the completed coordinator publisher creates one report and one outside issue', async () => {
  const comments = [], issues = [], writes = [], run = { id: 11, display_title: `Code ${context.requestId}`, status: 'in_progress', html_url: 'https://example.test/run/11' };
  const receipt = { issue: 1, kind: 'code', requestId: context.requestId, materialSha: B, base: A, verdict: 'accepted',
    markdown: 'Detailed independent review', report: { outsideFindings: [{ title: 'Separate defect', problem: 'Another operation can lose data', evidence: 'other.mjs:10', suggestedFix: 'Keep both updates' }] } };
  const api = { root: '/repos/owner/repo', owner: 'owner', request: async (method, path, body) => {
    if (method !== 'GET') writes.push({ method, path, body });
    if (path.includes('/artifacts')) return { artifacts: [{ id: 41, name: 'review-result' }] };
    if (path.includes('/actions/runs/11')) return { ...run };
    if (path.includes('/actions/workflows/')) return { workflow_runs: [{ ...run }] };
    if (path.includes('/comments')) return structuredClone(comments);
    if (method === 'GET') return structuredClone(issues);
    if (method === 'POST' && path.endsWith('/issues')) {
      const issue = { number: issues.length + 100, ...body }; issues.push(issue); return issue;
    }
    throw Error(`Unexpected ${method} ${path}`);
  }, comment: async (_issue, body) => {
    const comment = { id: comments.length + 1, body, user: { login: 'github-actions[bot]' } };
    comments.push(comment); return comment;
  } };
  const adapter = new WorkflowReviewAdapter({ api, readArtifact: async () => receipt });
  const record = { issue: 1, kind: 'code', requestId: context.requestId, materialSha: B, expectedBase: A, runId: 11 };
  await Promise.all([adapter.readReviewResult(context), adapter.readReviewResult(context), adapter.publishCompletedReview(record)]);
  assert.equal(comments.length, 0); assert.equal(issues.length, 0); assert.equal(writes.length, 0);
  run.status = 'completed';
  await Promise.all([adapter.readReviewResult(context), adapter.publishCompletedReview(record), adapter.readReviewResult(context)]);
  assert.equal(comments.length, 2); assert.equal(issues.length, 1); // report + confirmed links to separately filed defects
  const firstBodies = comments.map(comment => comment.body);
  await adapter.publishCompletedReview(record);
  assert.deepEqual(comments.map(comment => comment.body), firstBodies); assert.equal(issues.length, 1);
  assert.ok(writes.every(write => !write.path.includes('/dispatches') && !write.path.includes('/rerun')));
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
const authoredRelease = () => ({ membership: { schema: 1, candidate: B, base: A, tag: 'v1-beta.1', issues: [] },
  includedIssues: [], body: 'Author-written release notes', technical: { ru: 'RU', en: 'EN' }, userChangelog: null });

test('publication retry reuses checked candidate and actual evidence, including repeated transient failures', async () => {
  const store = new MemoryQueueStore(readyRelease()); let publishes = 0;
  const dependencies = { api: { root: '/repos/owner/repo' }, git: {}, releaseStore: store,
    queue: new QueueController(new MemoryQueueStore()), prepareReleaseData: async () => authoredRelease(),
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
test('finish recognizes a competing coordinator completion without hiding a real admission loss', async () => {
  for (const completed of [true, false]) {
    const h = queueHarness(), progress = []; let sleeps = 0;
    await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'product' });
    await h.command('admit'); const token = (await h.store.read()).state.active.token;
    await h.command('synchronized', { token, expectedBase: A, materialSha: B });
    await h.command('s6-complete', { token, materialSha: B, outcome: 'passed', evidence: { status: 'passed' } });
    await h.command('reconcile'); await h.command('review-complete', { token });
    h.actions.length = 0;
    const assertAdmission = h.queue.assertAdmission.bind(h.queue);
    h.queue.assertAdmission = async options => {
      h.queue.assertAdmission = assertAdmission;
      // Another worker completes or returns the task after our snapshot but before the fence check.
      if (completed) await h.command('merge', { token });
      else await h.queue.dispatch({ id: 'other-return', type: 'return', issue: 1, token, reason: 'lease-expired' });
      return assertAdmission(options);
    };
    h.dependencies.sleep = async () => { sleeps++; };
    h.dependencies.runPlan = () => { throw Error('S6 must not run again'); };
    h.dependencies.review.requestReview = () => { throw Error('Review must not run again'); };
    const result = await finishTask({ config, event: { id: 'finish-race', issue: 1, branch: 'issue/1' },
      queue: h.queue, api: h.dependencies.api, git: h.dependencies.git, review: h.dependencies.review,
      dependencies: h.dependencies, onProgress: item => progress.push(item), maxWaitMs: 1000 });
    const transitions = progress.filter(item => item.kind === 'transition');
    assert.equal(result.action, completed ? 'merged' : 'returned');
    assert.deepEqual(transitions.map(item => item.action), [completed ? 'already-completed' : 'admission-lost']);
    assert.deepEqual(h.actions, completed ? ['merge'] : []);
    if (completed) {
      assert.equal(sleeps, 0);
      assert.equal(transitions[0].issue, 1);
      assert.equal(result.task.mergedSha, B);
    }
  }
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
    queue: new QueueController(new MemoryQueueStore()), prepareReleaseData: async () => authoredRelease(),
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

function issueTransport(issue, { failClose = false, failComment = false } = {}) {
  const comments = [], writes = [], api = new GitHubClient({ owner: 'owner', repo: 'repo', activated: true });
  api.request = async (method, path, body) => {
    if (method !== 'GET') writes.push({ method, path, body });
    if (path.includes('/comments')) {
      if (method === 'GET') return structuredClone(comments);
      if (method === 'POST') {
        if (failComment) { failComment = false; throw Error('Comment transport unavailable'); }
        const result = { id: comments.length + 1, body: body.body }; comments.push(result); return result;
      }
      const id = Number(path.split('/').at(-1)); Object.assign(comments.find(row => row.id === id), body); return body;
    }
    if (path.includes('/labels')) {
      if (method === 'POST') issue.labels = [...new Set([...issue.labels, ...body.labels])];
      if (method === 'DELETE') issue.labels = issue.labels.filter(name => name !== decodeURIComponent(path.split('/').at(-1)));
      return issue.labels;
    }
    if (method === 'GET') return structuredClone(issue);
    if (method === 'PATCH') {
      if (body.state === 'closed' && failClose) { failClose = false; throw Error('Close transport unavailable'); }
      Object.assign(issue, body, body.milestone ? { milestone: { number: body.milestone } } : {}); return structuredClone(issue);
    }
    throw Error(`Unexpected ${method} ${path}`);
  };
  return { api, comments, writes };
}

test('documentation finish removes personal label without ledger or milestone; metadata retry never repeats merge or checks', async () => {
  const h = queueHarness(); h.issue.labels = ['S6-in-progress', 'track:ship', 'to_release', 'personal'];
  h.issue.testLayer = 'docs';
  const transport = issueTransport(h.issue, { failComment: true }); h.dependencies.api = transport.api;
  h.dependencies.synchronize = async () => ({ expectedBase: A, materialSha: B, patchId: 'docs', layer: 'docs', changedFiles: ['README.md'] });
  h.dependencies.git.git = async args => {
    if (args[0] === 'show') throw Error('Documentation does not read the release ledger');
    return A;
  };
  h.dependencies.sleep = async () => {};
  h.dependencies.planProfile = () => { throw Error('Documentation must never start a test plan'); };
  const result = await finishTask({ config, event: { id: 'finish-doc', issue: 1, branch: 'issue/1' }, queue: h.queue,
    api: transport.api, git: h.dependencies.git, review: h.dependencies.review, dependencies: h.dependencies, maxWaitMs: 1000 });
  assert.equal(result.action, 'merged'); assert.deepEqual(h.issue.labels.sort(), ['S8-merged', 'personal', 'track:ship']);
  assert.equal(h.issue.milestone, undefined); assert.equal(result.bookkeeping.pending.length, 1);
  await h.command('reconcile-completions'); await h.command('reconcile-completions');
  assert.equal((await h.store.read()).state.tasks[1].completion.status, 'complete');
  assert.deepEqual(h.actions, ['merge']);
  assert.equal(transport.comments.filter(comment => comment.body.includes('process-next-task-merged:')).length, 1);
  const history = transport.comments.map(comment => comment.body);
  await h.command('reconcile-completions');
  assert.deepEqual(transport.comments.map(comment => comment.body), history);
  assert.ok(transport.writes.every(write => !write.body?.labels?.includes('to_release')));
});

test('finish leaves paid reports for the single coordinator publisher', async () => {
  const h = queueHarness(); let publications = 0;
  h.issue.labels = ['S8-merged', 'track:show'];
  h.store.state.tasks[1] = { issue: 1, branch: 'issue/1', status: 'S8-merged', mergedSha: B, completion: { status: 'complete' } };
  await h.queue.dispatch({ id: 'saved-report', type: 'review-presentation', issue: 1, kind: 'code',
    record: { issue: 1, kind: 'code', requestId: 'review:1:paid', materialSha: B, expectedBase: A, runId: 11 } });
  h.dependencies.review.publishCompletedReview = async () => { publications++; return { published: true }; };
  const finished = await finishTask({ config, event: { id: 'finish-again', issue: 1, branch: 'issue/1' },
    queue: h.queue, api: h.dependencies.api, git: h.dependencies.git, review: h.dependencies.review });
  assert.equal(finished.action, 'merged'); assert.equal(publications, 0);
  assert.equal(Object.keys((await h.store.read()).state.reviewPublications).length, 1);
  await h.command('reconcile-completions'); await h.command('reconcile-completions');
  assert.equal(publications, 1); assert.equal(Object.keys((await h.store.read()).state.reviewPublications).length, 0);
});

test('hosted publication interleaves old review, next entry and next review; a failed delivery preserves that order', async () => {
  const h = queueHarness(), delivered = [];
  h.issue.labels = ['S6-in-progress', 'track:ask'];
  const transport = issueTransport(h.issue);
  h.dependencies.api = transport.api;
  const append = transport.api.upsertComment.bind(transport.api);
  transport.api.upsertComment = async (issue, message) => { delivered.push('entry'); return append(issue, message); };
  h.store.state.specReviews[1] = { requestId: 'spec:1:new', round: 2, status: 'accepted' };
  for (const [requestId, at] of [['spec:1:old', 1000], ['spec:1:new', 2000]]) {
    await h.queue.dispatch({ id: requestId, type: 'review-presentation', issue: 1, kind: 'spec', record: {
      issue: 1, kind: 'spec', requestId, materialSha: B, expectedBase: A,
      presentation: { occurredAt: new Date(at).toISOString() },
    } });
  }
  h.store.state.events.between = { digest: 'saved', issue: 1, message: {
    kind: 'queued', issue: 1, at: 1500, entry: 2, layer: 'infra', track: 'ask',
  } };
  let fail = true;
  h.dependencies.review.publishCompletedReview = async record => {
    if (fail) throw Error('Lost transport before publication');
    delivered.push(record.requestId); return { published: true };
  };
  await h.command('reconcile-completions');
  assert.deepEqual(delivered, []);
  fail = false;
  await h.command('reconcile-completions');
  assert.deepEqual(delivered, ['spec:1:old', 'entry', 'spec:1:new']);
  await h.command('reconcile-completions');
  assert.deepEqual(delivered, ['spec:1:old', 'entry', 'spec:1:new']);
});

test('a completed old specification report is published after the body changed without moving current labels', async () => {
  const comments = [], run = { id: 11, status: 'completed', run_attempt: 1, display_title: 'Ревью ТЗ spec:1:old',
    html_url: 'https://example.test/run', updated_at: '2026-11-01T10:00:00Z' };
  const receipt = { issue: 1, kind: 'spec', requestId: 'spec:1:old', materialSha: B, base: A,
    verdict: 'changes_requested', markdown: 'Подробное замечание первого раунда' };
  const current = { number: 1, state: 'open', labels: ['S5-ready'], body: 'Новая принятая редакция' };
  const api = { root: '/repos/owner/repo', owner: 'owner', getIssue: async () => current,
    request: async (method, path) => {
      assert.equal(method, 'GET', 'publication may not mutate labels or dispatch another review');
      if (path.includes('/artifacts')) return { artifacts: [{ id: 41, name: 'review-result' }] };
      if (path.includes('/actions/runs/11')) return run;
      if (path.includes('/comments')) return comments;
      return [];
    }, comment: async (_issue, body) => { const comment = { id: 1, body, user: { login: 'owner' } }; comments.push(comment); return comment; } };
  const adapter = new WorkflowReviewAdapter({ api, readArtifact: async () => receipt });
  await adapter.publishCompletedReview({ issue: 1, kind: 'spec', requestId: 'spec:1:old', runId: 11,
    materialSha: B, expectedBase: A, presentation: { round: 1 } });
  assert.equal(comments.length, 1); assert.match(comments[0].body, /доставлен с задержкой/);
  assert.match(comments[0].body, /Подробное замечание первого раунда/);
  assert.deepEqual(current.labels, ['S5-ready']);
});

test('current specification report waits for its verdict and label repair, then publishes one S4 to S3 report', async () => {
  const h = queueHarness(); h.issue.labels = ['S4-spec-review', 'track:ask']; h.issue.body = 'ТЗ текущего раунда';
  const transport = issueTransport(h.issue), adapter = new WorkflowReviewAdapter({ api: transport.api });
  h.dependencies.api = transport.api; h.dependencies.review = adapter;
  let completed = false;
  adapter.readReviewResult = async ({ requestId, active }) => completed ? {
    issue: 1, kind: 'spec', requestId, materialSha: active.materialSha, base: active.expectedBase,
    verdict: 'changes_requested', markdown: 'Нужно уточнить поведение отмены.', runId: 11,
    runStatus: 'completed', publicationPending: true,
  } : { pending: true };
  await h.command('label');
  completed = true;
  await h.command('reconcile-completions');
  assert.equal(transport.comments.length, 0, 'a completed artifact alone is not the processed verdict');
  const moveStatus = transport.api.moveStatus.bind(transport.api);
  transport.api.moveStatus = async () => { throw Error('Label transport unavailable'); };
  await assert.rejects(h.command('label'), /Label transport/);
  assert.equal(h.store.state.specReviews[1].status, 'changes_requested');
  await h.command('reconcile-completions');
  assert.equal(transport.comments.length, 0, 'saved verdict must also wait for the failed label mutation');
  transport.api.moveStatus = moveStatus;
  await h.command('label');
  await h.command('reconcile-completions');
  await h.command('reconcile-completions');
  assert.equal(transport.comments.length, 1);
  assert.match(transport.comments[0].body, /S4 «Ревью ТЗ» → S3 «Подготовка ТЗ»/);
  assert.match(transport.comments[0].body, /Нужно уточнить поведение отмены/);
  assert.doesNotMatch(transport.comments[0].body, /Статус остаётся.*S4/);
});

test('code return repairs a failed S7 to S6 label write before publishing its single full report', async () => {
  const h = queueHarness(), transport = issueTransport(h.issue);
  const adapter = new WorkflowReviewAdapter({ api: transport.api });
  h.dependencies.api = transport.api; h.dependencies.review = adapter;
  adapter.requestReview = async () => ({ requested: true });
  adapter.readReviewResult = async ({ requestId, active }) => ({
    issue: 1, kind: 'code', requestId, materialSha: active.materialSha, base: active.expectedBase,
    verdict: 'changes_requested', markdown: 'Исправить потерю отменённого изменения.', runId: 12,
    runStatus: 'completed', publicationPending: true,
  });
  await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'infra' });
  await h.command('admit'); const token = h.store.state.active.token;
  await h.command('synchronized', { token, expectedBase: A, materialSha: B });
  await h.command('s6-complete', { token, materialSha: B, outcome: 'passed', evidence: { sha: B, result: 'passed' } });
  await h.command('reconcile');
  await h.command('reconcile-completions');
  const reports = () => transport.comments.filter(comment => comment.body.startsWith('<!-- process-next-review:'));
  assert.equal(reports().length, 0);
  let failReturn = true, labelAttempts = 0;
  const moveStatus = transport.api.moveStatus.bind(transport.api);
  transport.api.moveStatus = async (...args) => {
    labelAttempts++;
    if (failReturn) throw Error('Label transport unavailable');
    return moveStatus(...args);
  };
  const returned = await h.command('reconcile');
  assert.equal(returned.action, 'returned'); assert.match(returned.warning, /label needs reconciliation/);
  assert.equal(h.store.state.tasks[1].status, 'S6-in-progress'); assert.equal(h.store.state.active, null);
  assert.ok(h.issue.labels.includes('S7-code-review'));
  await h.command('reconcile-completions');
  assert.equal(reports().length, 0); assert.equal(labelAttempts, 2);
  failReturn = false;
  await h.command('reconcile-completions');
  await h.command('reconcile-completions');
  assert.equal(reports().length, 1);
  assert.match(reports()[0].body, /S7 «Код-ревью» → S6 «Реализация и проверки»/);
  assert.match(reports()[0].body, /Исправить потерю отменённого изменения/);
  assert.ok(h.issue.labels.includes('S6-in-progress')); assert.equal(labelAttempts, 3);
});

test('a manual move away from the current review publishes its unconsumed result as history', async () => {
  for (const kind of ['code', 'spec']) for (const labels of [[], ['S6-in-progress'], [kind === 'spec' ? 'S4-spec-review' : 'S7-code-review', 'blocked']]) {
    const current = { number: 1, state: 'open', labels, body: 'ТЗ текущего раунда' };
    const { api, comments, writes } = issueTransport(current), adapter = new WorkflowReviewAdapter({ api });
    const requestId = kind === 'spec'
      ? `spec:1:${createHash('sha256').update(JSON.stringify({ body: current.body })).digest('hex')}` : context.requestId;
    await adapter.publishCompletedReview({ issue: 1, kind, requestId, outcomeConsumed: false,
      receipt: { issue: 1, kind, requestId, materialSha: B,
        verdict: 'changes_requested', runStatus: 'completed', markdown: 'Сохранённый результат.' } });
    assert.equal(comments.length, 1, `${kind}: ${labels.join(',')}`);
    assert.match(comments[0].body, /доставлен с задержкой/);
    assert.deepEqual(current.labels, labels);
    assert.ok(writes.every(write => write.path.includes('/comments')), 'historical publication cannot change labels');
  }
});

test('accepted code already merged in the same round is distinguished from a superseded report', async () => {
  for (const delayed of [false, true]) {
    const { api, comments } = issueTransport({ number: 1, state: 'open', labels: ['S8-merged'] });
    const adapter = new WorkflowReviewAdapter({ api });
    await adapter.publishCompletedReview({ issue: 1, kind: 'code', requestId: context.requestId, outcomeConsumed: true,
      presentation: { delayed }, receipt: { issue: 1, kind: 'code', requestId: context.requestId, materialSha: B,
        verdict: 'accepted', runStatus: 'completed', markdown: 'Код принят.' } });
    assert.equal(comments.length, 1);
    if (delayed) assert.match(comments[0].body, /доставлен с задержкой/);
    else {
      assert.match(comments[0].body, /Код-ревью принято; после этого изменение уже слито в dev/);
      assert.doesNotMatch(comments[0].body, /доставлен с задержкой|Следующий шаг/);
    }
  }
});

test('superseded empty requests do not block later history and expire with an explicit unavailable report', async () => {
  const comments = [], now = Date.parse('2026-11-01T12:00:00Z');
  const current = { state: 'open', labels: ['S5-ready'], body: 'updated specification' };
  const api = { root: '/repos/owner/repo', owner: 'owner',
    getIssue: async () => current,
    request: async (_method, path) => path.includes('/comments') ? comments : { workflow_runs: [], total_count: 0 },
    comment: async (_issue, body) => { const item = { id: comments.length + 1, body, user: { login: 'owner' } }; comments.push(item); return item; } };
  const adapter = new WorkflowReviewAdapter({ api, clock: () => now });
  const record = { issue: 1, kind: 'spec', requestId: 'spec:1:old', materialSha: B, expectedBase: A,
    presentation: { delayed: true, occurredAt: new Date(now - 1000).toISOString() } };
  assert.equal((await adapter.publishCompletedReview(record)).superseded, true);
  assert.equal(comments.length, 0);
  assert.equal((await adapter.publishCompletedReview({ ...record, exhausted: true })).reportAbsent, true);
  record.presentation.occurredAt = new Date(now - 61 * 86400_000).toISOString();
  await adapter.publishCompletedReview(record);
  assert.equal(comments.length, 1); assert.match(comments[0].body, /окно хранения артефактов/);
  await adapter.publishCompletedReview(record);
  assert.equal(comments.length, 1);
  current.labels = ['S4-spec-review'];
  const requestId = `spec:1:${createHash('sha256').update(JSON.stringify({ body: current.body })).digest('hex')}`;
  const unavailable = await adapter.publishCompletedReview({ ...record, requestId, outcomeConsumed: false,
    presentation: { ...record.presentation, delayed: false } });
  assert.equal(unavailable.published, true, 'terminal unavailability is not a model verdict awaiting consumption');
  assert.equal(comments.length, 2); assert.match(comments[1].body, /окно хранения артефактов/);
});

test('published stable completes only missing bookkeeping and Telegram on retry, without local reports or republishing', async () => {
  const initial = readyRelease(), item = initial.candidates.beta1;
  item.kind = 'stable'; item.runner.event = 'stable';
  const issue = { number: 1, state: 'open', labels: ['S8-merged', 'track:show', 'personal'] };
  const { api, comments } = issueTransport(issue, { failClose: true });
  const store = new MemoryQueueStore(initial); let publishes = 0, observations = 0, returns = 0, sends = 0, preparations = 0;
  const data = { ...authoredRelease(), membership: { schema: 1, candidate: B, base: A, tag: 'v1.0.0', issues: [{ number: 1, commits: [B] }] },
    includedIssues: [1], userChangelog: { ru: '<!-- release: v1.0.0 -->\n<!-- base: v0.9.0 -->\n## Релиз Houseplan 1.0.0\n\nПользовательское изменение.\n', en: 'User change' } };
  const dependencies = { api, git: { remoteHead: async () => A }, releaseStore: store,
    queue: new QueueController(new MemoryQueueStore()), prepareReleaseData: async () => { preparations++; return data; },
    publisher: { publish: async ({ body }) => { publishes++; assert.equal(body, data.body); return { published: true,
      evidence: { sha: B, tag: 'v1.0.0', artifactDigest: D } }; } },
    verifier: { verify: async () => { observations++; return { hacsAvailable: true, tag: 'v1.0.0', artifactDigest: D }; } },
    returnToDev: async () => { returns++; return { status: 'completed', devSha: C }; },
    fetchImpl: async (_url, options) => { sends++; assert.match(options.body, /Пользовательское изменение/);
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 42 } }) }; },
  };
  const call = (command, event) => executeRemoteCommand({ command, config: { ...config, workspace: '/missing' },
    env: { ...env, TELEGRAM_BOT_TOKEN: '12345:test-token', TELEGRAM_CHAT_ID: 'test-chat' }, execute: true, dependencies,
    event: { id: 'publish-complete', candidate: 'beta1', tag: 'v1.0.0', ...event } });
  const first = await call('publish-prepared', { artifacts: [] });
  assert.equal(first.completion.status, 'pending'); assert.equal(issue.state, 'open');
  assert.deepEqual(issue.labels, ['track:show', 'personal']); assert.equal(comments.length, 1);
  const second = await call('publish-prepared', { reportPath: 'deleted/report.json', packagePath: 'deleted/package.json' });
  assert.equal(second.completion.status, 'completed', JSON.stringify(second.completion.pending)); assert.equal(issue.state, 'closed');
  await call('complete-release');
  assert.deepEqual({ publishes, preparations, observations, returns, sends }, { publishes: 1, preparations: 1, observations: 1, returns: 1, sends: 1 });
  assert.equal(comments.length, 2); // failure notice followed by confirmed closure, neither rewritten
  assert.equal(second.state.candidates.beta1.announcement.status, 'sent');
});

test('interrupted publication resumes persisted inputs even after report files disappeared', async () => {
  let initial = readyRelease();
  initial = reduceRelease(initial, { id: 'data', type: 'release-prepared', candidate: 'beta1', sha: B, data: authoredRelease() });
  initial = reduceRelease(initial, { id: 'start', type: 'publication-started', candidate: 'beta1', sha: B, tag: 'v1-beta.1' });
  const store = new MemoryQueueStore(initial); let calls = 0;
  const result = await executeRemoteCommand({ command: 'publish-prepared', config: { ...config, workspace: '/missing' }, env, execute: true,
    event: { id: 'resume-after-restart', candidate: 'beta1', reportPath: 'deleted.json', metricsPath: 'deleted-metrics.json', artifacts: [] },
    dependencies: { api: {}, git: {}, releaseStore: store, queue: new QueueController(new MemoryQueueStore()),
      prepareReleaseData: async () => { throw Error('Previously prepared release data must be reused'); },
      publisher: { publish: async ({ candidate }) => { calls++; assert.equal(candidate.runner.id, 'r');
        return { published: true, evidence: { sha: B, tag: 'v1-beta.1', artifactDigest: D } }; } } } });
  assert.equal(result.state.candidates.beta1.status, 'published'); assert.equal(calls, 1);
});

test('candidate creation uses computed history membership, not a caller-provided issue list', async () => {
  const queue = new QueueController(new MemoryQueueStore());
  const releaseStore = new MemoryQueueStore(initialReleaseState());
  const result = await executeRemoteCommand({ command: 'release-event', config, env, execute: true,
    event: { id: 'create-real', type: 'create', candidate: 'beta', kind: 'beta', sourceSha: B, branch: 'release/beta', includedIssues: [999] },
    dependencies: { api: {}, queue, releaseStore, git: { resolveSource: async () => ({ sourceSha: B }) },
      prepareReleaseData: async options => { assert.equal(options.texts, false); return {
        membership: { schema: 1, candidate: B, base: A, issues: [{ number: 1, commits: [B] }] }, includedIssues: [1] }; } } });
  assert.deepEqual(result.state.candidates.beta.includedIssues, [1]);
});

test('dev wakeup survives a lost publication response even when resumed publisher says unchanged', async () => {
  const h = queueHarness(); h.issue.labels = ['S6-in-progress', 'track:ship'];
  await h.command('ready', { branch: 'issue/1', materialSha: B, layer: 'product' }); await h.command('admit');
  const token = (await h.store.read()).state.active.token;
  await h.command('synchronized', { token, expectedBase: A, materialSha: B });
  await h.command('s6-complete', { token, materialSha: B, outcome: 'passed', evidence: { status: 'passed' } });
  await h.command('merge', { token });
  h.dependencies.git.remoteHead = async () => C;
  h.dependencies.git.git = async () => JSON.stringify({ source: B, integrationTree: C });
  const delivered = await h.command('dev-build-complete', { changed: false, webhookPending: true });
  assert.equal(delivered.state.devWebhook.status, 'pending'); assert.equal(delivered.state.tasks[1].devBuild.status, 'published');
  let wakeups = 0; h.dependencies.fetchImpl = async () => { wakeups++; return { ok: true }; };
  const call = () => executeRemoteCommand({ command: 'dev-webhook', config, env: { ...env, HP_HA_DEV_WEBHOOK: 'https://example.test/hook' },
    execute: true, dependencies: h.dependencies, event: { id: 'wakeup' } });
  await call(); await call(); assert.equal(wakeups, 1);
});
