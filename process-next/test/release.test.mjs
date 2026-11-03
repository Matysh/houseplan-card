import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialReleaseState, reduceRelease, releaseReadiness, releaseClosePlan, HacsClient, HacsDeliveryVerifier, ReleaseDiscoveryVerifier, ReleaseGitAdapter, ReleasePublisher, readPublishedMeasurement, readRunnerReport, normalizeMetricsDecision } from '../lib/release.mjs';
import { runPlan } from '../lib/runner.mjs';
import { runGit } from '../lib/github.mjs';
import { sha256 } from '../lib/github.mjs';
const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40), D = 'd'.repeat(64);
const metricsDecision = { decisionId: 'metrics-beta1', source: 'chat', sourceRef: 'chat:release#metrics-beta1', decisionText: 'Accept these metric changes for this beta.' };
function report(materialSha = A, event = 'beta', overrides = {}) {
  return { schema: 1, id: 'run', event, materialSha, materialClean: true, finishedAt: '2026-11-01T00:00:00Z', reportPath: 'runs/run/report.json', status: 'passed',
    results: [{ id: 'core', status: 'passed' }, { id: 'area', status: 'passed' }], ...overrides };
}
function harness(initial) {
  let state = initial ?? initialReleaseState(), count = 0;
  return { event(value) { state = reduceRelease(state, { id: `e${++count}`, candidate: 'beta1', ...value }); return state; },
    get state() { return state; }, get candidate() { return state.candidates.beta1; } };
}
function create(h, extra = {}) { const sourceSha = extra.sourceSha ?? A; h.event({ type: 'create', kind: 'beta', branch: 'release/beta1', sourceSha,
  membership: { schema: 1, candidate: sourceSha, base: null, issues: [1, 2].map(number => ({ number, commits: [sourceSha] })) }, ...extra }); }
function shipPacket(extra = {}) {
  return { schema: 1, candidateId: 'beta1', base: null, head: A, version: 'v1-beta.1', selectionDigest: D,
    requestId: `ship-review:${A}`, tasks: [{ issue: 1, title: 'Простая правка', url: 'https://example.invalid/1',
      body: 'ТЗ', commits: [A], fingerprint: D, track: 'ship' }], pending: [1], reused: [], ...extra };
}
function shipResult(packet, verdict = 'accepted', extra = {}) {
  return { kind: 'ship-batch', candidateId: packet.candidateId, requestId: packet.requestId, materialSha: packet.head,
    base: packet.base, selectionDigest: packet.selectionDigest, verdict, markdown: 'Полный русский отчёт.', ...extra };
}
function noShipTasks(h) {
  const packet = shipPacket({ head: h.candidate.sha, tasks: [], pending: [], requestId: `empty:${h.candidate.sha}` });
  h.event({ type: 'ship-review-prepared', packet });
  h.event({ type: 'ship-review-result', requestId: packet.requestId, result: shipResult(packet, 'not-required') });
}
function passed(h, { ship = true } = {}) {
  h.event({ type: 'run-started', sha: h.candidate.sha });
  h.event({ type: 'runner-report', report: report(h.candidate.sha, h.candidate.kind) });
  h.event({ type: 'metrics', sha: h.candidate.sha, report: { requiresDecision: false } });
  if (ship && h.candidate.kind === 'beta') noShipTasks(h);
}
function publish(h) {
  h.event({ type: 'publication-started', sha: h.candidate.sha, tag: 'v1-beta.1' });
  h.event({ type: 'published', sha: h.candidate.sha, evidence: { sha: h.candidate.sha, tag: 'v1-beta.1', artifactDigest: D } });
}

test('beta publication requires a completed ship inventory and matching accepted report', () => {
  const h = harness(); create(h); passed(h, { ship: false });
  assert.deepEqual(releaseReadiness(h.candidate).reasons, ['ship-review-required']);
  const packet = shipPacket(); h.event({ type: 'ship-review-prepared', packet });
  for (const verdict of ['incomplete', 'changes_requested']) {
    h.event({ type: 'ship-review-result', requestId: packet.requestId, result: shipResult(packet, verdict) });
    assert.throws(() => h.event({ type: 'publication-started', sha: A, tag: 'v1-beta.1' }), /ship-review-required/);
  }
  h.event({ type: 'ship-review-result', requestId: packet.requestId, result: shipResult(packet) });
  assert.equal(releaseReadiness(h.candidate).ready, true);
  for (const shipReview of [{ ...h.candidate.shipReview, sha: B }, { ...h.candidate.shipReview, inventoryComplete: false }])
    assert.deepEqual(releaseReadiness({ ...h.candidate, shipReview }).reasons, ['ship-review-required']);
});

test('already-started legacy publication resumes without a new ship review but keeps the original readiness checks', () => {
  const h = harness(); create(h); passed(h, { ship: false });
  const prepared = { ...h.candidate, status: 'prepared' };
  assert.deepEqual(releaseReadiness(prepared).reasons, ['ship-review-required']);
  for (const status of ['publishing', 'publication-retry', 'published']) {
    const persisted = { ...prepared, status };
    assert.equal(releaseReadiness(persisted).ready, true);
    assert.deepEqual(releaseReadiness({ ...persisted, runner: null }).reasons, ['runner-report-required']);
    assert.deepEqual(releaseReadiness({ ...persisted, metrics: null }).reasons, ['metrics-report-required']);
    assert.deepEqual(releaseReadiness({ ...persisted, reviewRequired: true }).reasons, ['fix-review-required']);
  }
});

test('ship review can run alongside tests without changing the immutable candidate or its run', () => {
  const h = harness(); create(h);
  h.event({ type: 'run-started', sha: A, runId: 'beta-tests' });
  const running = structuredClone(h.candidate.running), packet = shipPacket();
  h.event({ type: 'ship-review-prepared', packet });
  h.event({ type: 'ship-review-result', requestId: packet.requestId, result: shipResult(packet) });
  assert.equal(h.candidate.sha, A); assert.deepEqual(h.candidate.running, running);
  assert.equal(h.candidate.status, 'testing'); assert.equal(h.candidate.shipReview.status, 'accepted');
  assert.throws(() => h.event({ type: 'fix', sha: B }), /immutable/);
  assert.ok(releaseReadiness(h.candidate).reasons.includes('run-in-progress'));
  h.event({ type: 'runner-report', report: report(A, 'beta', { id: 'beta-tests' }) });
  h.event({ type: 'metrics', sha: A, report: { requiresDecision: false } });
  h.event({ type: 'publication-started', sha: A, tag: 'v1-beta.1' });
  assert.throws(() => h.event({ type: 'ship-review-prepared', packet }), /immutable during or after publication/);
});

test('ship review freezes its input, refuses mismatched identities and retains full result on prepare retry', () => {
  const initial = initialReleaseState(); delete initial.shipReviews;
  const h = harness(initial); create(h); const packet = shipPacket();
  assert.throws(() => h.event({ type: 'ship-review-prepared', packet: { ...packet, head: B } }), /current candidate/);
  h.event({ type: 'ship-review-prepared', packet });
  for (const extra of [{ kind: 'code' }, { candidateId: 'other' }, { requestId: 'other' }, { materialSha: B },
    { base: B }, { selectionDigest: 'other' }, { verdict: 'passed' }, { verdict: 'not-required' }])
    assert.throws(() => h.event({ type: 'ship-review-result', requestId: packet.requestId, result: shipResult(packet, 'accepted', extra) }), /frozen packet/);
  const result = shipResult(packet, 'accepted', { report: { improvements: ['Пояснить алгоритм.'] } });
  h.event({ type: 'ship-review-result', requestId: packet.requestId, result });
  h.event({ type: 'ship-review-prepared', packet: { ...packet, tasks: [{ ...packet.tasks[0], body: 'Поздняя редакция' }] } });
  assert.equal(h.state.shipReviews[packet.requestId].packet.tasks[0].body, 'ТЗ');
  assert.deepEqual(h.state.shipReviews[packet.requestId].result, result);
  assert.equal(h.candidate.shipReview.status, 'accepted');
  assert.throws(() => h.event({ type: 'ship-review-prepared', packet: { ...packet, base: C } }), /another selection/);
});

test('an empty pending selection records not-required instead of a fabricated model acceptance', () => {
  const h = harness(); create(h); passed(h, { ship: false });
  const packet = shipPacket({ tasks: [], pending: [] });
  h.event({ type: 'ship-review-prepared', packet });
  assert.equal(releaseReadiness(h.candidate).ready, false);
  assert.throws(() => h.event({ type: 'ship-review-result', requestId: packet.requestId, result: shipResult(packet) }), /valid verdict/);
  h.event({ type: 'ship-review-result', requestId: packet.requestId, result: shipResult(packet, 'not-required') });
  assert.equal(releaseReadiness(h.candidate).ready, true);
});

test('beta fixes clear only the current review; late results and unchanged accepted task sets remain reusable', () => {
  const h = harness(); create(h); const packet = shipPacket(); h.event({ type: 'ship-review-prepared', packet });
  h.event({ type: 'fix', sha: B, productChanged: false });
  h.event({ type: 'ship-review-result', requestId: packet.requestId, result: shipResult(packet) });
  assert.equal(h.candidate.shipReview, undefined);
  assert.equal(h.state.shipReviews[packet.requestId].result.verdict, 'accepted');
  const next = shipPacket({ head: B, requestId: 'ship-review:next', pending: [],
    reused: [{ issue: 1, fingerprint: D, requestId: packet.requestId, reportUrl: null }] });
  h.event({ type: 'ship-review-prepared', packet: next });
  h.event({ type: 'ship-review-result', requestId: next.requestId, result: shipResult(next, 'not-required') });
  assert.equal(Object.keys(h.state.shipReviews).length, 2);
  assert.deepEqual(h.state.shipReviews[next.requestId].packet.reused, next.reused);
  assert.equal(h.candidate.shipReview.sha, B);
});

test('stable inherits the beta review reference, keeps it after a fix and requires no new batch', () => {
  const h = harness(initialReleaseState({ stable: { sha: A, tag: 'v1' } }));
  create(h); passed(h); publish(h); const reference = h.candidate.shipReview;
  h.event({ type: 'create', candidate: 'stable', kind: 'stable', sourceSha: A, branch: 'release/stable' });
  h.event({ type: 'fix', candidate: 'stable', sha: B, productChanged: false });
  h.event({ type: 'runner-report', candidate: 'stable', report: report(B, 'stable') });
  const stable = h.state.candidates.stable;
  assert.deepEqual(stable.shipReview, reference); assert.equal(releaseReadiness(stable).ready, true);
  assert.throws(() => h.event({ type: 'ship-review-prepared', packet: shipPacket({ candidateId: 'stable', head: B }) }), /active beta/);
  h.event({ type: 'abandon', candidate: 'stable' });
  h.event({ type: 'create', candidate: 'hotfix', kind: 'hotfix', sourceSha: A, branch: 'release/hotfix' });
  h.event({ type: 'fix', candidate: 'hotfix', sha: B });
  h.event({ type: 'runner-report', candidate: 'hotfix', report: report(B, 'hotfix') });
  assert.deepEqual(releaseReadiness(h.state.candidates.hotfix).reasons, ['fix-review-required']);
});
test('candidate cannot change while running; one completed report records failure without copying per-case state', () => {
  const h = harness(); create(h); h.event({ type: 'run-started', sha: A });
  assert.throws(() => h.event({ type: 'fix', sha: B }), /immutable/);
  assert.throws(() => h.event({ type: 'abandon' }), /immutable/);
  h.event({ type: 'runner-report', report: report(A, 'beta', { status: 'failed', results: [{ id: 'core', status: 'failed' }, { id: 'area', status: 'passed' }] }) });
  assert.equal(h.candidate.running, null); assert.deepEqual(h.candidate.runner.failed, ['core']);
  assert.equal(h.candidate.results, undefined); assert.equal(h.candidate.requirements, undefined);
  assert.ok(releaseReadiness(h.candidate).reasons.includes('runner-report-required'));
});
test('missing, cancelled, invalidated, wrong-profile and wrong-SHA reports never authorize publication', () => {
  const h = harness(); create(h);
  for (const bad of [report(B), report(A, 'task'), { ...report(), finishedAt: undefined }])
    assert.throws(() => h.event({ type: 'runner-report', report: bad }), /completed runner report/);
  for (const bad of [report(A, 'beta', { results: [] }), report(A, 'beta', { status: 'invalidated' }), report(A, 'beta', { materialClean: false }),
    report(A, 'beta', { results: [{ id: 'area', status: 'cancelled' }] })]) {
    h.event({ type: 'runner-report', report: bad }); assert.equal(releaseReadiness(h.candidate).ready, false);
  }
});
test('fix asks for the new runner report and review; the runner owns case reuse', () => {
  const h = harness(); create(h); passed(h);
  h.event({ type: 'fix', sha: B }); assert.equal(h.candidate.runner, null);
  assert.equal(h.candidate.portToDev[0].to, B); assert.ok(releaseReadiness(h.candidate).reasons.includes('fix-review-required'));
  h.event({ type: 'runner-report', report: report(B, 'beta', { results: [{ id: 'core', status: 'reused' }, { id: 'area', status: 'passed' }] }) });
  assert.equal(h.candidate.runner.reused, 1); assert.equal(h.candidate.runner.ready, true);
});

test('runner receipt retains only public check facts without adding readiness requirements', () => {
  const h = harness(); create(h);
  h.event({ type: 'runner-report', report: report(A, 'beta', { environment: { TOKEN: 'private-value' }, results: [
    { id: 'core', name: 'Ключевая логика', status: 'passed', diagnostic: false,
      counts: { tests: 5, passed: 4, failed: 0, skipped: 1, cancelled: -1, todo: Infinity, TOKEN: 'private-value' },
      logPath: '/home/private/check.log', command: ['secret-command'], environment: { TOKEN: 'private-value' } },
    { id: 'area', name: 'Связанный набор', status: 'reused', sourceRun: '20261103T0000-abcd1234', counts: { passed: 2, failed: NaN },
      reportPath: 'C:\\Users\\private\\report.json', error: 'private-value' },
    { id: 'converter', status: 'failed', diagnostic: true, sourceRun: '/private/run', output: 'private-value' },
  ] }) });
  const expected = [
    { id: 'core', name: 'Ключевая логика', status: 'passed', diagnostic: false, counts: { tests: 5, passed: 4, failed: 0, skipped: 1 } },
    { id: 'area', name: 'Связанный набор', status: 'reused', diagnostic: false, counts: { passed: 2 }, sourceRun: '20261103T0000-abcd1234' },
    { id: 'converter', name: 'converter', status: 'failed', diagnostic: true },
  ];
  assert.deepEqual(h.candidate.runner.checks, expected);
  assert.doesNotMatch(JSON.stringify(h.candidate.runner.checks), /private|TOKEN|command|environment|Path/);
  assert.equal(h.candidate.runner.ready, true); assert.equal(h.candidate.runner.required, 2); assert.equal(h.candidate.runner.reused, 1);
  h.event({ type: 'metrics', sha: A, report: { requiresDecision: false } }); noShipTasks(h);
  assert.equal(releaseReadiness(h.candidate).ready, true);
  publish(h); assert.deepEqual(h.state.published.beta.runner.checks, expected);
});
test('stable uses published beta and accepts its runner cache reuse without a second case ledger', () => {
  const h = harness(); create(h); passed(h); publish(h);
  assert.throws(() => h.event({ type: 'create', candidate: 'stable', kind: 'stable', sourceSha: C, branch: 'release/stable' }), /published beta/);
  h.event({ type: 'create', candidate: 'stable', kind: 'stable', sourceSha: A, branch: 'release/stable' });
  assert.equal(releaseReadiness(h.state.candidates.stable).ready, false); // beta report alone is not the stable remainder
  h.event({ type: 'runner-report', candidate: 'stable', report: report(A, 'stable', { results: [
    { id: 'core', status: 'reused' }, { id: 'area', status: 'reused' }, { id: 'remainder', status: 'passed' }, { id: 'converter', status: 'failed', diagnostic: true }] }) });
  const stable = h.state.candidates.stable; assert.equal(stable.runner.reused, 2); assert.equal(releaseReadiness(stable).ready, true);
  assert.equal(stable.results, undefined); assert.equal(h.state.published.beta.results, undefined);
});
test('previous published beta survives a failed candidate and is retired only after successful publication', () => {
  const h = harness(initialReleaseState({ beta: { sha: C, branch: 'release/old-beta', results: {} } })); create(h); passed(h);
  h.event({ type: 'publication-started', sha: A, tag: 'v1-beta.1' }); h.event({ type: 'publication-failed', sha: A });
  assert.equal(h.state.published.beta.branch, 'release/old-beta'); publish(h);
  assert.equal(h.candidate.retiredBeta.branch, 'release/old-beta'); assert.equal(h.candidate.retiredBeta.sha, C); assert.equal(h.state.published.beta.branch, 'release/beta1');
});
test('publication failure retries the same checked material without a new test run', () => {
  const h = harness(); create(h); passed(h); const receipt = structuredClone(h.candidate.runner);
  h.event({ type: 'publication-started', sha: A, tag: 'v1-beta.1' }); h.event({ type: 'publication-failed', sha: A, reason: 'network' });
  publish(h); assert.deepEqual(h.candidate.runner, receipt);
});
test('completed return records the final published fix and retires superseded intermediate return work', () => {
  const h = harness(); create(h);
  h.event({ type: 'fix', sha: B, productChanged: false });
  h.event({ type: 'fix', sha: C, productChanged: false });
  passed(h); publish(h);
  h.event({ type: 'completion-step', name: 'return-to-dev', result: { status: 'pending', reason: 'queued' } });
  assert.ok(h.candidate.portToDev.every(row => row.status === 'pending'));
  assert.throws(() => h.event({ type: 'completion-step', name: 'return-to-dev', result: { status: 'completed' } }), /actual dev commit/);
  h.event({ type: 'completion-step', name: 'return-to-dev', result: { status: 'completed', devSha: A } });
  assert.deepEqual(h.candidate.portToDev, [
    { from: A, to: B, syncMode: 'merge', status: 'superseded', supersededBy: C },
    { from: B, to: C, syncMode: 'merge', status: 'ported', devSha: A },
  ]);
});
test('beta metrics decision belongs to one candidate and accepted retry does not ask twice', () => {
  const h = harness(); create(h); passed(h); h.event({ type: 'metrics', sha: A, report: { requiresDecision: true } });
  assert.throws(() => h.event({ type: 'publication-started', sha: A, tag: 'v1-beta.1' }), /owner-metrics-decision/);
  h.event({ type: 'accept-metrics', sha: A, ownerDecision: metricsDecision }); publish(h);
  assert.equal(h.candidate.status, 'published');
});
test('missing/noisy/incomparable measurements remain visible but do not block or prevent owner acknowledgement', () => {
  const h = harness(); create(h); passed(h); h.event({ type: 'metrics', sha: A, report: { requiresDecision: false, needsMeasurement: true } });
  assert.equal(releaseReadiness(h.candidate).ready, true);
  h.event({ type: 'accept-metrics', sha: A, ownerDecision: metricsDecision });
  assert.equal(h.candidate.metrics.needsMeasurement, true); publish(h);
});
test('metrics approval requires an explicit decision source, never a shared actor login', () => {
  const h = harness(); create(h); passed(h); h.event({ type: 'metrics', sha: A, report: { requiresDecision: true } });
  for (const value of [{ actor: 'owner', action: 'accept' }, { ...metricsDecision, source: 'github-login' },
    ...['decisionId', 'sourceRef', 'decisionText'].map(key => ({ ...metricsDecision, [key]: ' ' }))]) {
    assert.throws(() => normalizeMetricsDecision(value), /Explicit metrics decision/);
    assert.throws(() => h.event({ type: 'accept-metrics', sha: A, ownerDecision: value }), /Explicit metrics decision/);
    assert.equal(h.candidate.metricsAcceptedSha, null);
  }
  const manual = { ...metricsDecision, source: 'manual', sourceRef: 'manual:owner-release-session', recordedBy: 'shared-login' };
  h.event({ type: 'accept-metrics', sha: A, ownerDecision: manual });
  assert.deepEqual(h.candidate.metricsDecision, manual); assert.equal(releaseReadiness(h.candidate).ready, true);
  h.event({ type: 'fix', sha: B }); assert.equal(h.candidate.metricsAcceptedSha, null);
});
test('hotfix uses last stable and cannot run in parallel with a preparing release', () => {
  const h = harness(initialReleaseState({ stable: { sha: C, tag: 'v0', branch: 'release/old' } })); create(h);
  assert.throws(() => h.event({ type: 'create', candidate: 'hotfix', kind: 'hotfix', sourceSha: C, branch: 'release/hotfix' }), /put the fix/);
  h.event({ type: 'abandon' });
  assert.throws(() => h.event({ type: 'create', candidate: 'hotfix', kind: 'hotfix', sourceSha: A, branch: 'release/hotfix' }), /published stable/);
  h.event({ type: 'create', candidate: 'hotfix', kind: 'hotfix', sourceSha: C, branch: 'release/hotfix' });
  assert.equal(h.state.candidates.hotfix.reviewRequired, true);
});
test('converter failure remains diagnostic and does not block a ready candidate', () => {
  const h = harness(); create(h); passed(h); h.event({ type: 'diagnostic', result: { area: 'converter', status: 'failed' } });
  assert.equal(releaseReadiness(h.candidate).ready, true);
});
test('closure requires published delivery, membership and actual S8; unrelated/unfinished issues remain open', () => {
  const h = harness(); create(h); passed(h); publish(h);
  const issues = [{ number: 1, state: 'open', labels: ['S8-merged'] }, { number: 2, state: 'open', labels: ['S7-code-review'] },
    { number: 3, state: 'open', labels: ['S8-merged'] }];
  assert.deepEqual(releaseClosePlan(h.candidate, issues), []);
  h.event({ type: 'delivery-verified', evidence: { hacsAvailable: true, tag: 'v1-beta.1', artifactDigest: D } });
  assert.deepEqual(releaseClosePlan(h.candidate, issues).map(item => item.issue), [1]);
});
test('duplicate release events are idempotent but cannot reuse an ID for another payload', () => {
  const h = harness(); create(h); const event = { id: 'diagnostic', type: 'diagnostic', result: { status: 'failed' } };
  h.event(event); const before = h.state; h.event(event); assert.deepEqual(h.state, before);
  assert.throws(() => h.event({ ...event, result: { status: 'passed' } }), /another payload/);
});
test('optional instance verification observes HACS itself and the downloadable bytes', async () => {
  const bytes = Buffer.from('correct zip'), github = { owner: 'o', repo: 'r', getRelease: async () => ({ draft: false, tag_name: 'v1', assets: [{ id: 1, name: 'houseplan.zip' }] }),
    downloadAsset: async () => bytes };
  let rows = []; const verifier = new HacsDeliveryVerifier({ github, hacs: { repositories: async () => rows } });
  const request = { repository: 'o/r', tag: 'v1', assetName: 'houseplan.zip', expectedDigest: sha256(bytes) };
  await assert.rejects(verifier.verify(request), /not observed/);
  rows = [{ full_name: 'o/r', available_version: 'v1', can_download: true, id: '42' }];
  assert.equal((await verifier.verify(request)).hacsAvailable, true);
  await assert.rejects(verifier.verify({ ...request, expectedDigest: '0'.repeat(64) }), /differs/);
});

test('public release discovery checks the beta feed or latest stable and exact ZIP without claiming HA observation', async () => {
  const bytes = Buffer.from('published ZIP'), calls = [];
  const release = { tag_name: 'v1-beta.1', draft: false, prerelease: true, assets: [{ id: 1, name: 'houseplan.zip' }] };
  let current = release;
  const github = { owner: 'o', repo: 'r', root: '/repos/o/r', getRelease: async () => release,
    downloadAsset: async () => bytes, request: async (method, path) => { calls.push(path); return path.endsWith('/latest') ? current : [{ draft: true, prerelease: true, tag_name: 'draft' }, current]; } };
  const verifier = new ReleaseDiscoveryVerifier({ github });
  const request = { repository: 'o/r', tag: release.tag_name, kind: 'beta', assetName: 'houseplan.zip', expectedDigest: sha256(bytes) };
  const evidence = await verifier.verify(request);
  assert.equal(evidence.discoveryAvailable, true); assert.equal(evidence.source, 'github-release-feed'); assert.equal(evidence.hacsAvailable, undefined);
  const h = harness(); create(h); passed(h); publish(h);
  h.event({ type: 'delivery-verified', evidence: { ...evidence, artifactDigest: D } });
  assert.equal(h.candidate.delivery.source, 'github-release-feed');
  await assert.rejects(verifier.verify({ ...request, expectedDigest: '0'.repeat(64) }), /differs/);
  current = { ...release, tag_name: 'v0-beta.1' };
  await assert.rejects(verifier.verify(request), /not exposed/);
  Object.assign(release, { tag_name: 'v1', prerelease: false }); current = release;
  assert.equal((await verifier.verify({ ...request, tag: 'v1', kind: 'stable' })).discoveryAvailable, true);
  assert.equal(calls.at(-1), '/repos/o/r/releases/latest');
});
test('actual HACS protocol authenticates and sends only the read-only repository list command', async () => {
  const sent = [];
  class Socket {
    constructor() { this.listeners = {}; queueMicrotask(() => this.emit({ type: 'auth_required' })); }
    addEventListener(type, callback) { this.listeners[type] = callback; }
    emit(data) { this.listeners.message({ data: JSON.stringify(data) }); }
    send(text) { const value = JSON.parse(text); sent.push(value); queueMicrotask(() => this.emit(value.type === 'auth'
      ? { type: 'auth_ok' } : { id: 1, type: 'result', success: true, result: [{ full_name: 'o/r' }] })); }
    close() {}
  }
  const client = new HacsClient({ url: 'https://ha.example', token: 'test-only', WebSocketImpl: Socket });
  assert.equal((await client.repositories())[0].full_name, 'o/r');
  assert.deepEqual(sent.map(row => row.type), ['auth', 'hacs/repositories/list']);
});
test('release publisher is offline by default even with activated underlying adapters', async () => {
  const h = harness(); create(h); passed(h);
  const publisher = new ReleasePublisher({ github: { activated: true }, git: { activated: true }, readArtifact: () => { throw Error('must not read'); } });
  const result = await publisher.publish({ candidate: h.candidate, tag: 'v1-beta.1', artifacts: [{ name: 'houseplan.zip', path: 'prepared.zip', expectedDigest: D }] });
  assert.equal(result.planned, true);
});
test('publication retry after a lost upload response reuses the draft and bytes without invoking tests', async () => {
  const h = harness(); create(h); passed(h); const bytes = Buffer.from('zip'), digest = sha256(bytes);
  let release = null, uploads = 0, drafts = 0, lose = true, refs = 0;
  const github = { activated: true, findRelease: async () => structuredClone(release),
    createDraftRelease: async ({ tag }) => { drafts++; release = { id: 1, tag_name: tag, draft: true, assets: [] }; return structuredClone(release); },
    uploadReleaseAsset: async () => { uploads++; release.assets.push({ id: 2, name: 'houseplan.zip' }); if (lose) { lose = false; throw Error('lost response'); } },
    downloadAsset: async () => bytes, updateRelease: async () => { release.draft = false; return release; },
    verifyPublication: async ({ tag, expectedSha, expectedDigest }) => ({ tag, sha: expectedSha, artifactDigest: expectedDigest }) };
  const git = { activated: true, publishCandidateRefs: async ({ checkOnly }) => { if (!checkOnly) refs++; } };
  const publisher = new ReleasePublisher({ github, git, activated: true, readArtifact: async () => bytes });
  const input = { candidate: h.candidate, tag: 'v1-beta.1', artifacts: [{ name: 'houseplan.zip', path: 'prepared.zip', expectedDigest: digest }] };
  await assert.rejects(publisher.publish(input), /lost response/);
  const result = await publisher.publish(input); assert.equal(result.published, true); assert.equal(result.deliveryPending, true);
  assert.equal(drafts, 1); assert.equal(uploads, 1); assert.equal(refs, 1); assert.equal(h.candidate.runner.id, 'run');
});
test('changed prepared artifact is refused before creating or uploading a release', async () => {
  const h = harness(); create(h); passed(h); let creates = 0;
  const publisher = new ReleasePublisher({ activated: true, git: { activated: true, publishCandidateRefs: async () => {} },
    github: { activated: true, findRelease: async () => { creates++; } }, readArtifact: async () => Buffer.from('wrong') });
  await assert.rejects(publisher.publish({ candidate: h.candidate, tag: 'v1-beta.1', artifacts: [{ name: 'houseplan.zip', path: 'x', expectedDigest: D }] }), /changed/);
  assert.equal(creates, 0);
});

test('draft notes are repaired once after a lost response, published notes stay unchanged, and ZIP evidence ignores asset order', async () => {
  const h = harness(); create(h); passed(h);
  const files = new Map([['js', Buffer.from('public JS')], ['zip', Buffer.from('checked ZIP')]]);
  const release = { id: 1, tag_name: 'v1-beta.1', draft: true, body: 'stale draft', assets: [] }, bytes = new Map(), updates = [];
  let lost = true;
  const github = { activated: true, findRelease: async () => structuredClone(release),
    updateRelease: async (_id, change) => { updates.push(change); Object.assign(release, change);
      if (change.body && lost) { lost = false; throw Error('lost draft response'); } return structuredClone(release); },
    uploadReleaseAsset: async (_id, artifact) => { const id = release.assets.length + 10; release.assets.push({ id, name: artifact.name }); bytes.set(id, artifact.bytes); },
    downloadAsset: async id => bytes.get(id),
    verifyPublication: async ({ tag, expectedSha, expectedDigest }) => ({ tag, sha: expectedSha, artifactDigest: expectedDigest }) };
  const publisher = new ReleasePublisher({ github, git: { activated: true, publishCandidateRefs: async () => {} }, activated: true, readArtifact: async path => files.get(path) });
  const input = { candidate: h.candidate, tag: release.tag_name, body: 'Author RU / Author EN', artifacts: [
    { name: 'houseplan-card.js', path: 'js', expectedDigest: sha256(files.get('js')) },
    { name: 'houseplan.zip', path: 'zip', expectedDigest: sha256(files.get('zip')) },
  ] };
  await assert.rejects(publisher.publish(input), /lost draft response/);
  const result = await publisher.publish(input);
  assert.equal(result.evidence.assetName, 'houseplan.zip'); assert.equal(result.evidence.artifactDigest, sha256(files.get('zip')));
  assert.equal(release.body, input.body); assert.equal(updates.filter(change => change.body).length, 1);
  const before = updates.length, retry = await publisher.publish({ ...input, body: 'different late text' });
  assert.equal(updates.length, before); assert.equal(release.body, input.body); assert.match(retry.warnings[0], /public text was preserved/);
});

test('HACS cache delay waits and retries only delivery observation, with a visible resumable timeout', async () => {
  const bytes = Buffer.from('checked artifact'); let now = 0, observations = 0;
  const github = { owner: 'o', repo: 'r', getRelease: async () => ({ tag_name: 'v1', draft: false, assets: [{ name: 'houseplan.zip', id: 1 }] }), downloadAsset: async () => bytes };
  const hacs = { repositories: async () => ++observations < 3 ? [] : [{ full_name: 'o/r', available_version: 'v1', can_download: true }] };
  const verifier = new HacsDeliveryVerifier({ github, hacs, clock: () => now, sleep: async ms => { now += ms; } });
  const request = { repository: 'o/r', tag: 'v1', assetName: 'houseplan.zip', expectedDigest: sha256(bytes), timeoutMs: 100, intervalMs: 10 };
  const progress = [], result = await verifier.wait({ ...request, onProgress: value => progress.push(value) });
  assert.equal(result.status, 'verified'); assert.equal(result.attempts, 3); assert.equal(progress.length, 2);
  hacs.repositories = async () => [];
  const pending = await verifier.wait({ ...request, timeoutMs: 20 });
  assert.equal(pending.status, 'waiting'); assert.equal(pending.hacsAvailable, undefined); assert.equal(pending.elapsedMs, 20);
  hacs.repositories = async () => { throw Error('Authentication refused'); };
  await assert.rejects(verifier.wait(request), /Authentication/);
});

test('stable/hotfix publication records an ancestry-preserving return instead of cherry-pick', () => {
  const h = harness(initialReleaseState({ beta: { sha: A, tag: 'v1-beta.1' } }));
  create(h, { kind: 'stable' }); passed(h); publish(h);
  assert.deepEqual(h.candidate.portToDev, [{ to: A, tag: 'v1-beta.1', syncMode: 'merge', status: 'pending' }]);
  h.event({ type: 'port-completed', fixSha: A, devSha: B }); assert.equal(h.candidate.portToDev[0].status, 'ported');
});

test('stable measurement is uploaded/read as a diagnostic asset; missing data never cancels publication', async () => {
  const h = harness(initialReleaseState({ beta: { sha: A, tag: 'v1-beta.1' } })); create(h, { kind: 'stable' }); passed(h);
  const zip = Buffer.from('zip'), measurement = Buffer.from(JSON.stringify({ source_sha: A, release: 'v1', timing_metrics: {} }));
  const bytes = new Map([[1, zip]]), release = { id: 1, draft: false, tag_name: 'v1', assets: [{ id: 1, name: 'houseplan.zip' }] };
  const github = { activated: true, findRelease: async () => release, getRelease: async () => release,
    downloadAsset: async id => bytes.get(id), uploadReleaseAsset: async (_id, asset) => {
      const row = { id: 2, name: asset.name }; release.assets.push(row); bytes.set(2, asset.bytes); return row;
    }, verifyPublication: async ({ tag, expectedSha, expectedDigest }) => ({ tag, sha: expectedSha, artifactDigest: expectedDigest }) };
  const publisher = new ReleasePublisher({ activated: true, github, git: { activated: true, publishCandidateRefs: async () => {} },
    readArtifact: async path => path === 'zip' ? zip : path === 'measurement' ? measurement : Promise.reject(Error('No measurement')) });
  const input = { candidate: h.candidate, tag: 'v1', artifacts: [{ name: 'houseplan.zip', path: 'zip', expectedDigest: sha256(zip) }] };
  const missing = await publisher.publish(input); assert.equal(missing.published, true); assert.equal(missing.warnings.length, 1);
  const result = await publisher.publish({ ...input, measurementPath: 'measurement' });
  assert.equal(result.published, true); assert.equal(result.measurement.sourceSha, A); assert.equal(result.warnings.length, 0);
  assert.equal((await readPublishedMeasurement(github, { tag: 'v1', sha: A })).source_sha, A);
  await assert.rejects(readPublishedMeasurement(github, { tag: 'v1', sha: B }), /another commit/);
});

test('actual runner report authorizes its clean Git candidate; dirty and deleted sources are rejected by release state', async t => {
  const root = await mkdtemp(join(tmpdir(), 'hp-release-runner-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = async args => (await runGit(args, { cwd: root })).stdout.trim();
  await git(['init', '-b', 'dev']); await git(['config', 'user.name', 'Fixture']); await git(['config', 'user.email', 'fixture@example.invalid']);
  await git(['config', 'core.hooksPath', join(root, 'no-hooks')]);
  await mkdir(join(root, 'src')); const source = join(root, 'src', 'model.mjs');
  await writeFile(source, 'export const model = 1;\n'); await git(['add', 'src']); await git(['commit', '-m', 'candidate']);
  const materialSha = await git(['rev-parse', 'HEAD']);
  const plan = { event: 'beta', name: 'Small integration fixture', steps: [{ id: 'behavior', name: 'Behavior',
    command: ['node', '-e', '/* executor injected */'], inputs: ['src/**'] }] };
  const execute = async () => ({ status: 'passed', counts: { tests: 1, passed: 1 }, durationMs: 0 });
  const h = harness(); create(h, { sourceSha: materialSha }); h.event({ type: 'run-started', sha: materialSha });
  const clean = await runPlan(plan, { root, execute });
  assert.equal(clean.materialSha, materialSha); assert.equal(clean.materialClean, true);
  h.event({ type: 'runner-report', report: await readRunnerReport(clean.reportPath) });
  h.event({ type: 'metrics', sha: materialSha, report: { requiresDecision: false } });
  noShipTasks(h);
  assert.equal(releaseReadiness(h.candidate).ready, true); assert.equal(h.candidate.runner.id, clean.id);
  assert.equal(h.candidate.results, undefined);
  await writeFile(source, 'export const model = 2;\n');
  const dirty = await runPlan(plan, { root, execute });
  assert.equal(dirty.status, 'passed'); assert.equal(dirty.materialSha, materialSha); assert.equal(dirty.materialClean, false);
  await unlink(source);
  const deleted = await runPlan(plan, { root, execute });
  assert.equal(deleted.status, 'passed'); assert.equal(deleted.materialClean, false);
  for (const invalid of [dirty, deleted]) {
    const fresh = harness(); create(fresh, { sourceSha: materialSha }); fresh.event({ type: 'run-started', sha: materialSha });
    fresh.event({ type: 'runner-report', report: invalid });
    assert.equal(fresh.candidate.running, null); assert.equal(fresh.candidate.runner.materialClean, false);
    assert.equal(fresh.candidate.runner.reason, 'dirty-material');
    assert.equal(releaseReadiness(fresh.candidate).ready, false);
    assert.throws(() => fresh.event({ type: 'publication-started', sha: materialSha, tag: 'v1' }), /dirty-material/);
    fresh.event({ type: 'fix', sha: B }); assert.equal(fresh.candidate.sha, B, 'a finished dirty run must not keep the candidate locked');
  }
});

async function returnFixture(t, { conflict = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'hp-release-return-')), cwd = join(directory, 'work');
  t.after(() => rm(directory, { recursive: true, force: true })); await mkdir(cwd);
  const git = async args => (await runGit(args, { cwd })).stdout.trim();
  await git(['init', '-b', 'dev']); await git(['config', 'user.name', 'Fixture']); await git(['config', 'user.email', 'fixture@example.invalid']);
  await git(['config', 'core.hooksPath', join(directory, 'no-hooks')]);
  await git(['init', '--bare', join(directory, 'remote.git')]); await git(['remote', 'add', 'origin', join(directory, 'remote.git')]);
  await writeFile(join(cwd, 'model.txt'), 'base\n'); await git(['add', '.']); await git(['commit', '-m', 'base']);
  await git(['checkout', '-b', 'release/stable']); await writeFile(join(cwd, 'model.txt'), 'published fix\n');
  await git(['commit', '-am', 'reviewed release fix']); const sourceSha = await git(['rev-parse', 'HEAD']);
  await git(['tag', '-a', 'v1', '-m', 'published stable']); await git(['push', 'origin', 'refs/tags/v1']);
  await git(['checkout', 'dev']); await writeFile(join(cwd, conflict ? 'model.txt' : 'next.txt'), 'new dev work\n');
  await git(['add', '.']); await git(['commit', '-m', 'next task']); const expectedBase = await git(['rev-parse', 'HEAD']);
  await git(['push', 'origin', 'dev']); await git(['checkout', '-b', 'issue/1-return']);
  const merge = () => git(['merge', '--no-ff', '-m', 'return published v1', sourceSha]);
  if (conflict) {
    await assert.rejects(merge()); await writeFile(join(cwd, 'model.txt'), 'manually reconciled fix and dev\n');
    await git(['add', 'model.txt']); await git(['commit', '-m', 'resolve return conflict']);
  } else await merge();
  return { cwd, git, expectedBase, materialSha: await git(['rev-parse', 'HEAD']),
    task: { syncMode: 'merge', mergeSourceSha: sourceSha, releaseTag: 'v1' }, adapter: new ReleaseGitAdapter({ cwd }) };
}
test('a clean return merge reuses published review; extra code or a local-only tag does not', async t => {
  const f = await returnFixture(t), input = { task: f.task, expectedBase: f.expectedBase, materialSha: f.materialSha, patchId: D };
  const before = { head: await f.git(['rev-parse', 'HEAD']), status: await f.git(['status', '--porcelain']) };
  // Exercise the actual installed Git: old versions take the ordinary-review path.
  let supportsMergeTree = true;
  try { await f.git(['merge-tree', '--write-tree', f.expectedBase, f.task.mergeSourceSha]); }
  catch { supportsMergeTree = false; }
  assert.deepEqual(await f.adapter.publishedReturnReview(input), supportsMergeTree ? { source: 'published-release', sourceSha: f.task.mergeSourceSha,
    tag: 'v1', verdict: 'accepted', patchId: D, materialSha: f.materialSha } : null);
  assert.deepEqual({ head: await f.git(['rev-parse', 'HEAD']), status: await f.git(['status', '--porcelain']) }, before);
  assert.equal(await f.adapter.publishedReturnReview({ ...input, task: { ...f.task, mergeSourceSha: f.expectedBase } }), null);
  await f.git(['tag', 'local-only', f.task.mergeSourceSha]);
  assert.equal(await f.adapter.publishedReturnReview({ ...input, task: { ...f.task, releaseTag: 'local-only' } }), null);
  assert.equal(await f.adapter.publishedReturnReview({ ...input, materialSha: f.expectedBase }), null);
  await writeFile(join(f.cwd, 'unreviewed.txt'), 'new work\n'); await f.git(['add', '.']); await f.git(['commit', '-m', 'unreviewed addition']);
  assert.equal(await f.adapter.publishedReturnReview({ ...input, materialSha: await f.git(['rev-parse', 'HEAD']) }), null);
});
test('manual release-return conflict resolution still requires its own review', async t => {
  const f = await returnFixture(t, { conflict: true });
  await f.adapter.assertAncestor(f.task.mergeSourceSha, f.materialSha);
  assert.equal(await f.adapter.publishedReturnReview({ task: f.task, expectedBase: f.expectedBase, materialSha: f.materialSha, patchId: D }), null);
  assert.equal(await f.git(['status', '--porcelain']), '');
});

test('unavailable merge-tree declines reuse while remote and required Git failures remain visible', async () => {
  const input = { task: { syncMode: 'merge', mergeSourceSha: A, releaseTag: 'v1' }, expectedBase: B, materialSha: C, patchId: D };
  for (const failure of [Object.assign(Error('unknown option: --write-tree'), { code: 128 }), Object.assign(Error('merge conflict'), { code: 1 }), Error('merge-tree unavailable')]) {
    const adapter = new ReleaseGitAdapter({ cwd: '.' });
    adapter.ensureCommit = adapter.assertAncestor = async () => {};
    adapter.git = async args => {
      if (args[0] === 'ls-remote') return `${A}\trefs/tags/v1`;
      if (args[0] === 'merge-tree') throw failure;
      throw Error(`Unexpected Git command: ${args[0]}`);
    };
    assert.equal(await adapter.publishedReturnReview(input), null);
    adapter.git = async () => { throw Error('remote unavailable'); };
    await assert.rejects(adapter.publishedReturnReview(input), /remote unavailable/);
    adapter.git = async args => args[0] === 'ls-remote' ? `${A}\trefs/tags/v1` : C;
    adapter.assertAncestor = async () => { throw Object.assign(Error('object database unreadable'), { code: 128 }); };
    await assert.rejects(adapter.publishedReturnReview(input), /object database unreadable/);
  }
});
