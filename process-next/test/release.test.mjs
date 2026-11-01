import test from 'node:test';
import assert from 'node:assert/strict';
import { initialReleaseState, reduceRelease, releaseReadiness, releaseClosePlan, HacsClient, HacsDeliveryVerifier, ReleasePublisher } from '../lib/release.mjs';
import { sha256 } from '../lib/github.mjs';
const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40), D = 'd'.repeat(64);
const requirements = [{ id: 'core', inputsDigest: 'core-v1' }, { id: 'area', inputsDigest: 'area-v1' }];
function harness(initial) {
  let state = initial ?? initialReleaseState(), count = 0;
  return { event(value) { state = reduceRelease(state, { id: `e${++count}`, candidate: 'beta1', ...value }); return state; },
    get state() { return state; }, get candidate() { return state.candidates.beta1; } };
}
function create(h, extra = {}) { h.event({ type: 'create', kind: 'beta', branch: 'release/beta1', sourceSha: A, requirements, includedIssues: [1, 2], ...extra }); }
function passed(h) {
  h.event({ type: 'run-started', sha: h.candidate.sha, runId: 'run', cases: ['core', 'area'] });
  h.event({ type: 'run-finished', sha: h.candidate.sha, runId: 'run', results: h.candidate.requirements.map(row => ({ ...row, status: 'passed' })) });
  h.event({ type: 'metrics', sha: h.candidate.sha, report: { requiresDecision: false } });
}
function publish(h) {
  h.event({ type: 'publication-started', sha: h.candidate.sha, tag: 'v1-beta.1' });
  h.event({ type: 'published', sha: h.candidate.sha, evidence: { sha: h.candidate.sha, tag: 'v1-beta.1', artifactDigest: D } });
}
test('candidate cannot change until its running set actually finishes; failures do not drop independent results', () => {
  const h = harness(); create(h); h.event({ type: 'run-started', sha: A, runId: 'r', cases: ['core', 'area'] });
  assert.throws(() => h.event({ type: 'fix', sha: B, requirements }), /immutable/);
  assert.throws(() => h.event({ type: 'abandon' }), /immutable/);
  h.event({ type: 'run-finished', sha: A, runId: 'r', results: [
    { ...requirements[0], status: 'failed' }, { ...requirements[1], status: 'passed' }] });
  assert.equal(h.candidate.results.area.status, 'passed'); assert.deepEqual(releaseReadiness(h.candidate).missing, ['core']);
});
test('missing and cancelled cases are never PASS', () => {
  const h = harness(); create(h); h.event({ type: 'run-started', sha: A, runId: 'r', cases: ['core', 'area'] });
  h.event({ type: 'run-finished', sha: A, runId: 'r', results: [{ ...requirements[0], status: 'cancelled' }] });
  assert.deepEqual(releaseReadiness(h.candidate).missing, ['core', 'area']); assert.equal(h.candidate.results.area.status, 'not-started');
});
test('fix preserves compatible successful cases and asks only for changed evidence and fix review', () => {
  const h = harness(); create(h); passed(h);
  h.event({ type: 'fix', sha: B, requirements: [requirements[0], { id: 'area', inputsDigest: 'area-v2' }] });
  assert.equal(h.candidate.results.core.reused, true); assert.equal(h.candidate.results.area, undefined);
  assert.equal(h.candidate.portToDev[0].to, B); assert.ok(releaseReadiness(h.candidate).reasons.includes('fix-review-required'));
});
test('stable starts at published beta and reuses compatible results, never latest dev', () => {
  const h = harness(); create(h); passed(h); publish(h);
  assert.throws(() => h.event({ type: 'create', candidate: 'stable', kind: 'stable', sourceSha: C, branch: 'release/stable', requirements }), /published beta/);
  h.event({ type: 'create', candidate: 'stable', kind: 'stable', sourceSha: A, branch: 'release/stable', requirements: [...requirements, { id: 'full', inputsDigest: 'full-v1' }] });
  const stable = h.state.candidates.stable; assert.equal(stable.results.core.reused, true);
  assert.deepEqual(releaseReadiness(stable).missing, ['full']);
});
test('previous published beta survives a failed candidate and is retired only after successful publication', () => {
  const h = harness(initialReleaseState({ beta: { sha: C, branch: 'release/old-beta', results: {} } })); create(h); passed(h);
  h.event({ type: 'publication-started', sha: A, tag: 'v1-beta.1' }); h.event({ type: 'publication-failed', sha: A });
  assert.equal(h.state.published.beta.branch, 'release/old-beta'); publish(h);
  assert.equal(h.candidate.retiredBeta, 'release/old-beta'); assert.equal(h.state.published.beta.branch, 'release/beta1');
});
test('publication failure retries the same checked material without a new test run', () => {
  const h = harness(); create(h); passed(h); const results = structuredClone(h.candidate.results);
  h.event({ type: 'publication-started', sha: A, tag: 'v1-beta.1' }); h.event({ type: 'publication-failed', sha: A, reason: 'network' });
  publish(h); assert.deepEqual(h.candidate.results, results);
});
test('beta metrics decision belongs to one candidate and accepted retry does not ask twice', () => {
  const h = harness(); create(h); passed(h); h.event({ type: 'metrics', sha: A, report: { requiresDecision: true } });
  assert.throws(() => h.event({ type: 'publication-started', sha: A, tag: 'v1-beta.1' }), /owner-metrics-decision/);
  h.event({ type: 'accept-metrics', sha: A, ownerDecision: { actor: 'owner', action: 'accept' } }); publish(h);
  assert.equal(h.candidate.status, 'published');
});
test('owner acceptance cannot turn missing or incomparable measurements into a result', () => {
  const h = harness(); create(h); passed(h); h.event({ type: 'metrics', sha: A, report: { requiresDecision: false, needsMeasurement: true } });
  assert.equal(releaseReadiness(h.candidate).ready, false);
  assert.throws(() => h.event({ type: 'accept-metrics', sha: A, ownerDecision: { actor: 'owner' } }), /requires measurements/);
});
test('hotfix uses last stable and cannot run in parallel with a preparing release', () => {
  const h = harness(initialReleaseState({ stable: { sha: C, tag: 'v0', branch: 'release/old' } })); create(h);
  assert.throws(() => h.event({ type: 'create', candidate: 'hotfix', kind: 'hotfix', sourceSha: C, branch: 'release/hotfix', requirements }), /put the fix/);
  h.event({ type: 'abandon' });
  assert.throws(() => h.event({ type: 'create', candidate: 'hotfix', kind: 'hotfix', sourceSha: A, branch: 'release/hotfix', requirements }), /published stable/);
  h.event({ type: 'create', candidate: 'hotfix', kind: 'hotfix', sourceSha: C, branch: 'release/hotfix', requirements });
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
test('HACS and downloadable bytes are separately observed; GitHub availability alone is insufficient', async () => {
  const bytes = Buffer.from('correct zip'), github = { owner: 'o', repo: 'r', getRelease: async () => ({ draft: false, tag_name: 'v1', assets: [{ id: 1, name: 'houseplan.zip' }] }),
    downloadAsset: async () => bytes };
  let rows = []; const verifier = new HacsDeliveryVerifier({ github, hacs: { repositories: async () => rows } });
  const request = { repository: 'o/r', tag: 'v1', assetName: 'houseplan.zip', expectedDigest: sha256(bytes) };
  await assert.rejects(verifier.verify(request), /not observed/);
  rows = [{ full_name: 'o/r', available_version: 'v1', can_download: true, id: '42' }];
  assert.equal((await verifier.verify(request)).hacsAvailable, true);
  await assert.rejects(verifier.verify({ ...request, expectedDigest: '0'.repeat(64) }), /differs/);
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
  assert.equal(drafts, 1); assert.equal(uploads, 1); assert.equal(refs, 1); assert.equal(h.candidate.results.core.runId, 'run');
});
test('changed prepared artifact is refused before creating or uploading a release', async () => {
  const h = harness(); create(h); passed(h); let creates = 0;
  const publisher = new ReleasePublisher({ activated: true, git: { activated: true, publishCandidateRefs: async () => {} },
    github: { activated: true, findRelease: async () => { creates++; } }, readArtifact: async () => Buffer.from('wrong') });
  await assert.rejects(publisher.publish({ candidate: h.candidate, tag: 'v1-beta.1', artifacts: [{ name: 'houseplan.zip', path: 'x', expectedDigest: D }] }), /changed/);
  assert.equal(creates, 0);
});
