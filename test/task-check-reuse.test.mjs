import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { canonical } from '../scripts/ci-registry-inputs.mjs';
import { profilePaths } from '../scripts/ci-profile-paths.mjs';
import { TASK_CHECK_JOB_NAMES, normalizeTaskCheckScope, taskCheckPlanFromSnapshot, taskCheckPlan,
  taskCheckSnapshot, makeTaskCheckRecord, taskCheckRecordError, verifyTaskCheckClaim } from '../scripts/task-check-reuse.mjs';
import { statusCounterFixture } from './helpers/status-counter-fixture.mjs';

const sha = '1'.repeat(40), repo = 'Matysh/houseplan-card', now = Date.parse('2026-10-24T20:00:00Z');
const environment = { node: '22.23.3', platform: 'linux', arch: 'x64', locale: 'en-US', timezone: 'UTC',
  imageOS: 'ubuntu24', imageVersion: '20261012.1', nodeFlags: [], nodeOptions: null, nodeEnv: null };
const browserPlan = { schema: 1, scope: 'task', smoke: { mode: 'selected', ids: ['smoke_b.mjs', 'smoke_a.mjs'] },
  golden: { mode: 'selected', ids: ['fixture'], intent: [{ id: 'fixture', issue: 1060, expectation: 'change', reason: 'approved fixture' }] } };
const workflow = ['name: Fixture', 'on: push', 'jobs:', ...Object.entries(TASK_CHECK_JOB_NAMES).flatMap(([job, name]) => [
  `  ${job}:`, `    name: '${name}'`, '    runs-on: ubuntu-24.04', '    steps:', `      - run: node scripts/${job}.mjs`,
]), ''].join('\n');
function files() {
  return new Map([
    ['src/widget.ts', 'export const widget = 1;'], ['test/tool.test.mjs', "import '../scripts/tooling.mjs';"],
    ['scripts/tooling.mjs', 'export const tool = 1;'], ['scripts/browser_selected.mjs', 'export const browser = 1;'],
    ['demo/smoke_a.mjs', 'export const a = 1;'], ['demo/smoke_b.mjs', 'export const b = 1;'],
    ['demo/golden/baselines/fixture.png', 'baseline bytes'],
    ['demo/fixtures/one.mjs', 'export const fixture = 1;'], ['docs/STATUS.md', statusCounterFixture()],
    ['package-lock.json', '{"version":"1.83.0-beta.2"}'],
    ['scripts/ci-profile-paths.json', JSON.stringify(profilePaths(['test/tool.test.mjs']))],
    ...['validate.yml', 'validate-product.yml', 'validate-tooling.yml'].map(name => ['.github/workflows/' + name, workflow]),
  ]);
}
const oid = text => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0${text}`).digest('hex');
function snapshot(entries = files()) {
  const captured = new Map(entries);
  const rows = new Map([...captured].map(([path, text]) => [path, { mode: '100644', oid: oid(text) }]));
  return { entries: rows, tree: createHash('sha1').update(canonical([...rows])).digest('hex'),
    read: async path => { assert.ok(captured.has(path), path); return Buffer.from(captured.get(path)); } };
}
async function fixture(job = 'browser_selected') {
  const sourceSnapshot = snapshot(), candidateSnapshot = snapshot();
  const plan = await taskCheckPlanFromSnapshot(candidateSnapshot, { job, browserPlan, environment });
  const record = makeTaskCheckRecord(plan, { repo, run: 12, attempt: 2, sha,
    workflow: `.github/workflows/validate-${job === 'tooling' ? 'tooling' : 'product'}.yml`,
    created: new Date(now - 10000).toISOString() });
  const run = { id: 12, run_attempt: 2, head_sha: sha, status: 'completed', conclusion: 'success',
    head_branch: 'issue/1060-fixture', path: record.workflow, event: 'push',
    repository: { full_name: repo }, head_repository: { full_name: repo }, run_started_at: new Date(now - 60000).toISOString() };
  const claim = { mode: 'reused', record, plan };
  const proof = { schema: 'houseplan-ci-proof/v1', candidate: { sha, tree: sourceSnapshot.tree },
    requiredProfiles: ['product', 'tooling', 'docs'],
    run: { id: 12, attempt: 2, workflow: record.workflow.split('/').at(-1), event: 'push' },
    request: { full: false, fresh: false }, taskChecks: { [job]: { mode: 'executed', record, plan } },
    browserPlan: { planned: browserPlan, executed: Object.fromEntries(['smoke', 'golden'].map(kind => [kind,
      { mode: 'selected', result: 'success', ids: [...browserPlan[kind].ids] }])) } };
  const context = { plan, repo, run, latestRun: { ...run }, jobs: [{ name: record.jobName, run_id: 12, status: 'completed', conclusion: 'success' }],
    artifact: { name: 'ci-proof-12-2', expired: false, workflow_run: { head_sha: sha }, created_at: new Date(now - 5000).toISOString() },
    proof, candidateSnapshot, sourceSnapshot, companionsGreen: true, now };
  return { claim, context };
}

test('#1068 scoped receipts verify counter-only Git commits and refuse real upstream fixture changes', async t => {
  const root = mkdtempSync(join(tmpdir(), 'hp-task-reuse-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  git(['init', '-b', 'dev']); git(['config', 'user.name', 'Fixture']); git(['config', 'user.email', 'fixture@example.invalid']);
  for (const [path, text] of files()) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); }
  git(['add', '.']); git(['commit', '-m', 'source']);
  const before = taskCheckSnapshot(root);
  const plans = await Promise.all(['tooling', 'browser_selected'].map(job => taskCheckPlan(root, { job, browserPlan, environment })));
  writeFileSync(join(root, 'docs/STATUS.md'), statusCounterFixture(11));
  git(['add', '.']); git(['commit', '-m', 'counter only']);
  const after = taskCheckSnapshot(root);
  assert.notEqual(before.sha, after.sha); assert.notEqual(before.tree, after.tree);
  assert.equal(git(['diff', '--name-only', before.sha, after.sha]), 'docs/STATUS.md');
  writeFileSync(join(root, 'docs/STATUS.md'), statusCounterFixture(12));
  writeFileSync(join(root, 'demo/fixtures/one.mjs'), 'export const fixture = 2;');
  git(['add', '.']); git(['commit', '-m', 'real fixture and counters']);
  const changedSha = git(['rev-parse', 'HEAD']);
  for (const [index, job] of ['tooling', 'browser_selected'].entries()) {
    assert.deepEqual(await taskCheckPlan(root, { ref: after.sha, job, browserPlan, environment }), plans[index]);
    const { claim, context } = await fixture(job);
    claim.record.sha = before.sha; claim.record.workflow_revision = before.sha;
    context.run.head_sha = before.sha; context.latestRun.head_sha = before.sha;
    context.artifact.workflow_run.head_sha = before.sha; context.proof.candidate.sha = before.sha;
    context.proof.candidate.tree = before.tree;
    // Each verification is a new bounded lookup. Keep the exact immutable
    // commits, but do not age their readers through unrelated Git fixture
    // preparation or the preceding job's verification under suite load.
    context.candidateSnapshot = taskCheckSnapshot(root, after.sha);
    context.sourceSnapshot = taskCheckSnapshot(root, before.sha);
    const verified = await verifyTaskCheckClaim(claim, context);
    assert.equal(verified.accepted, true, verified.reason);
    context.candidateSnapshot = taskCheckSnapshot(root, changedSha);
    context.sourceSnapshot = taskCheckSnapshot(root, before.sha);
    const refused = await verifyTaskCheckClaim(claim, context);
    assert.equal(refused.accepted, false, 'an old claimed plan cannot conceal substantive fixture bytes: ' + job);
    assert.match(refused.reason, /actual task inputs\/environment\/recipe differ/);
  }
});

test('selected scope ignores routing prose but preserves exact IDs and golden intent, never full coverage', async () => {
  const original = normalizeTaskCheckScope('browser_selected', browserPlan);
  const rerouted = structuredClone(browserPlan);
  rerouted.files = ['docs/reviews/REVIEW.md']; rerouted.smoke.reason = 'same task after integration';
  rerouted.smoke.ids.reverse();
  assert.deepEqual(normalizeTaskCheckScope('browser_selected', rerouted), original);
  for (const change of [plan => { plan.smoke.mode = 'full'; }, plan => { plan.scope = 'full'; },
    plan => { plan.smoke.ids.push(plan.smoke.ids[0]); }, plan => { plan.smoke.mode = 'none'; },
    plan => { plan.golden.intent[0].expectation = 'unapproved'; }]) {
    const invalid = structuredClone(browserPlan); change(invalid);
    assert.throws(() => normalizeTaskCheckScope('browser_selected', invalid));
  }
});

test('task input identity includes runtime additions, deletions, helper/oracle/lock/workflow bytes and rejects symlinks', async () => {
  const plan = await taskCheckPlanFromSnapshot(snapshot(), { job: 'browser_selected', browserPlan, environment });
  for (const change of [data => data.set('src/new.ts', 'new runtime'), data => data.delete('src/widget.ts'),
    data => data.set('demo/smoke_a.mjs', 'changed oracle'), data => data.set('demo/golden/baselines/fixture.png', 'changed baseline'),
    data => data.set('package-lock.json', 'different runtime dependencies')]) {
    const data = files(); change(data);
    assert.notEqual((await taskCheckPlanFromSnapshot(snapshot(data), { job: 'browser_selected', browserPlan, environment })).key, plan.key);
  }
  const symbolic = snapshot(); symbolic.entries.set('src/widget.ts', { oid: '1'.repeat(40), mode: '120000' });
  await assert.rejects(() => taskCheckPlanFromSnapshot(symbolic, { job: 'browser_selected', browserPlan, environment }), /symbolic task input/);
  const inconsistent = files(); inconsistent.set('.github/workflows/validate-product.yml', workflow.replace('node scripts/browser_selected', 'node other'));
  await assert.rejects(() => taskCheckPlanFromSnapshot(snapshot(inconsistent), { job: 'browser_selected', browserPlan, environment }), /canonical recipe/);
  const changedIntent = structuredClone(browserPlan); changedIntent.golden.intent[0].reason = 'new visual intent';
  assert.notEqual((await taskCheckPlanFromSnapshot(snapshot(), { job: 'browser_selected', browserPlan: changedIntent, environment })).key, plan.key);
  assert.notEqual((await taskCheckPlanFromSnapshot(snapshot(), { job: 'browser_selected', browserPlan,
    environment: { ...environment, node: '22.99.0' } })).key, plan.key);
});

for (const [name, change] of Object.entries({
  failed: x => { x.context.run.conclusion = 'failure'; },
  cancelled: x => { x.context.run.conclusion = 'cancelled'; },
  running: x => { x.context.run.status = 'in_progress'; },
  rerun: x => { x.context.latestRun.run_attempt = 3; },
  redLatest: x => { x.context.latestRun.conclusion = 'failure'; },
  foreignSha: x => { x.context.run.head_sha = '2'.repeat(40); },
  foreignRepository: x => { x.context.run.head_repository = { full_name: 'other/repo' }; },
  foreignWorkflow: x => { x.context.run.path = '.github/workflows/other.yml'; },
  foreignTree: x => { x.context.proof.candidate.tree = '2'.repeat(40); },
  foreignSnapshotSha: x => { x.context.sourceSnapshot.sha = '3'.repeat(40); },
  missingJob: x => { x.context.jobs = []; },
  duplicateJob: x => { x.context.jobs.push({ ...x.context.jobs[0] }); },
  skippedJob: x => { x.context.jobs[0].conclusion = 'skipped'; },
  expired: x => { x.context.artifact.expired = true; },
  old: x => { x.context.now += 8 * 24 * 60 * 60 * 1000; },
  wrongArtifact: x => { x.context.artifact.name = 'ci-proof-12-1'; },
  inherited: x => { x.context.proof.taskChecks.browser_selected.mode = 'reused'; },
  missingCompanion: x => { delete x.context.companionsGreen; },
  redCompanion: x => { x.context.companionsGreen = false; },
  incompleteProfiles: x => { x.context.proof.requiredProfiles = ['tooling', 'docs']; },
  unknownProfile: x => { x.context.proof.requiredProfiles.push('other'); },
  duplicateProfile: x => { x.context.proof.requiredProfiles.push('product'); },
  partial: x => { x.context.proof.browserPlan.executed.smoke.ids.pop(); },
  missingExecution: x => { delete x.context.proof.browserPlan.executed; },
  inconsistentScope: x => { x.context.proof.browserPlan.planned = { ...browserPlan, smoke: { mode: 'selected', ids: ['other.mjs'] } }; },
  changedInput: x => { x.context.candidateSnapshot.entries.set('src/widget.ts', { mode: '100644', oid: '3'.repeat(40) }); },
  changedSource: x => { x.context.sourceSnapshot.entries.set('src/widget.ts', { mode: '100644', oid: '4'.repeat(40) }); },
  missingSnapshots: x => { delete x.context.sourceSnapshot; },
  full: x => { x.context.request = { full: true }; },
  fresh: x => { x.context.request = { fresh: true }; },
  stable: x => { x.context.request = { stable: true }; },
  night: x => { x.context.request = { night: true }; },
})) test('scoped task reuse refuses ' + name, async () => {
  const input = await fixture(); change(input);
  assert.equal((await verifyTaskCheckClaim(input.claim, input.context)).accepted, false);
});

test('direct record validation binds key, scope, actual execution identity and fixed job name', async () => {
  const { claim } = await fixture('tooling');
  assert.equal(taskCheckRecordError(claim.record), null);
  for (const change of [r => { r.key = 'f'.repeat(64); }, r => { r.scope.tests.push('test/forged.test.mjs'); },
    r => { r.jobName = 'other'; }, r => { r.workflow_revision = '2'.repeat(40); }, r => { r.reused = true; }]) {
    const record = structuredClone(claim.record); change(record); assert.ok(taskCheckRecordError(record));
  }
});
