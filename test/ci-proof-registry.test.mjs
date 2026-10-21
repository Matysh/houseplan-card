import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { REGISTRY_SCHEMA, REGISTRY_TTL_MS, verifyRegistryRecord, registryPath, registryPolicy } from '../scripts/ci-registry-verify.mjs';
import { fetchRegistry, probeRegistry, publishRegistry } from '../scripts/ci-proof-registry.mjs';
import { producedRegistryRecords } from '../scripts/ci-registry-records.mjs';
import { intentPolicy } from '../scripts/ci-registry-cli.mjs';
import { buildCiProof, evaluateCiProof, JOB_RULES, resolveJobRules } from '../scripts/ci-proof.mjs';
import { jobInstanceNames, validateJobs } from '../scripts/workflow-jobs.mjs';

const H = c => c.repeat(64), sha = 'a'.repeat(40), now = Date.parse('2026-10-21T03:00:00Z');
function fixture(job = 'frontend') {
  const toolchain = { node: '22.23.3', python: '3.14.5', platform: 'linux', arch: 'x64', pins: H('1') };
  const plan = { schema: 1, mode: 'exact', treeId: H('2'), keys: { [job]: H('3') }, recipes: { [job]: H('4') }, toolchain };
  const record = { schema: REGISTRY_SCHEMA, job, repo: 'Matysh/houseplan-card', key: plan.keys[job], treeId: plan.treeId,
    mode: plan.mode, outcome: 'success', reused: false, workflow: '.github/workflows/validate.yml',
    workflow_sha: plan.recipes[job], workflow_revision: sha, run: 1234, attempt: 2, sha, toolchain,
    created: new Date(now - 10000).toISOString(),
    ...(job === 'frontend' ? { inventory: { dist: H('5'), testBuild: H('6'), fingerprint: H('7') } } : {}) };
  const run = { id: record.run, run_attempt: 2, head_sha: sha, path: record.workflow, status: 'completed', conclusion: 'success',
    head_branch: 'issue/981-registry', repository: { full_name: record.repo }, head_repository: { full_name: record.repo },
    created_at: new Date(now - 60000).toISOString() };
  const jobNames = [job, ...(job === 'smoke' ? ['smoke_done'] : [])].flatMap(id => jobInstanceNames(validateJobs().get(id)));
  const jobs = [...jobNames, JOB_RULES.bundle[0].name, JOB_RULES.product_guards[0].name]
    .map(name => ({ name, status: 'completed', conclusion: 'success' }));
  const proof = { schema: 'houseplan-ci-proof/v1', candidate: { sha }, run: { id: record.run, attempt: 2 },
    request: { full: true }, requiredChecks: [job, 'bundle', 'product_guards'],
    checks: Object.fromEntries([job, 'bundle', 'product_guards'].map(id => [id, { mode: 'executed', result: 'success' }])),
    registry: { schema: 1, produced: [structuredClone(record)] } };
  const artifact = { name: 'ci-proof-1234-2', expired: false, created_at: new Date(now - 5000).toISOString(), workflow_run: { head_sha: sha } };
  return { record, args: { plan, job, repo: record.repo, run, jobs, proof, artifact, jobNames, now,
    sourceEquivalent: true, actualWorkflowRecipe: record.workflow_sha } };
}
test('all six jobs require a direct immutable successful producer', () => {
  for (const job of ['frontend', 'backend', 'geometry_parity', 'smoke', 'golden', 'performance_smoke']) {
    const { record, args } = fixture(job); assert.equal(verifyRegistryRecord(record, args).accepted, true, job);
  }
});
const refusals = {
  red: f => { f.args.run.conclusion = 'failure'; },
  cancelled: f => { f.args.run.conclusion = 'cancelled'; },
  incomplete: f => { f.args.run.status = 'in_progress'; },
  otherToolchain: f => { f.record.toolchain = { ...f.record.toolchain, node: '24.0.0' }; },
  otherRecipe: f => { f.record.workflow_sha = H('8'); },
  otherTree: f => { f.record.treeId = H('8'); },
  otherKey: f => { f.record.key = H('8'); },
  foreignWorkflow: f => { f.args.run.path = '.github/workflows/fake.yml'; },
  foreignRepository: f => { f.args.run.head_repository.full_name = 'foreign/fork'; },
  foreignBranch: f => { f.args.run.head_branch = 'untrusted'; },
  otherAttempt: f => { f.args.run.run_attempt++; },
  otherSha: f => { f.args.run.head_sha = 'b'.repeat(40); },
  otherRevision: f => { f.record.workflow_revision = 'b'.repeat(40); },
  expired: f => { f.args.now += REGISTRY_TTL_MS + 1; },
  future: f => { f.record.created = new Date(now + 1).toISOString(); },
  corruptTime: f => { f.record.created = 'not a timestamp'; },
  expiredArtifact: f => { f.args.artifact.expired = true; },
  wrongArtifactAttempt: f => { f.args.artifact.name = 'ci-proof-1234-1'; },
  missingActualJob: f => { f.args.jobs.shift(); },
  duplicateActualJob: f => { f.args.jobs.push({ ...f.args.jobs[0] }); },
  redActualJob: f => { f.args.jobs[0].conclusion = 'failure'; },
  incompleteActualJob: f => { f.args.jobs[0].status = 'in_progress'; },
  missingFreshGuards: f => { f.args.jobs.pop(); },
  unrequestedFreshGuards: f => { delete f.args.proof.checks.product_guards; },
  reusedSource: f => { f.args.proof.checks.frontend.mode = 'reused'; },
  tamperedIndex: f => { f.record.created = new Date(now - 20000).toISOString(); },
  tamperedInventory: f => { f.record.inventory.dist = H('8'); },
  missingInventory: f => { delete f.record.inventory; },
  missingImmutableRecord: f => { f.args.proof.registry.produced = []; },
  missingImmutableProof: f => { f.args.proof = null; },
  redCompanion: f => { f.args.companionsGreen = false; },
  actualSourceChanged: f => { f.args.sourceEquivalent = false; },
  actualWorkflowChanged: f => { f.args.actualWorkflowRecipe = H('9'); },
};
for (const [name, change] of Object.entries(refusals)) test('fresh on ' + name, () => {
  const f = fixture(); change(f); assert.equal(verifyRegistryRecord(f.record, f.args).accepted, false);
});
test('selected browser progress cannot become a full reusable receipt', () => {
  for (const job of ['smoke', 'golden', 'performance_smoke']) {
    const f = fixture(job); f.args.proof.request.full = false;
    assert.equal(verifyRegistryRecord(f.record, f.args).accepted, false);
  }
});
test('night, stable and explicit fresh remain fresh; beta mode is explicit', () => {
  for (const input of [{ night: true }, { stable: true }, { fresh: true }]) assert.equal(registryPolicy(input).allowed, false);
  assert.equal(registryPolicy({ candidate: true }).mode, 'candidate');
  assert.equal(intentPolicy({ REF_NAME: 'dev', HEAD_MESSAGE: 'Release: v1.82.0-beta.6' }, '1.82.0-beta.6').mode, 'candidate');
  assert.equal(intentPolicy({ REF_NAME: 'issue/981-test', HEAD_MESSAGE: 'Release: v1.82.0-beta.6' }, '1.82.0-beta.6').mode, 'exact');
  assert.equal(intentPolicy({ CANDIDATE_INPUT: 'true' }, '1.82.0-beta.6').mode, 'candidate');
  assert.equal(intentPolicy({}, '1.82.0').allowed, false);
  assert.equal(intentPolicy({ GITHUB_EVENT_NAME: 'workflow_dispatch' }, '1.82.0-beta.6', { registrySupported: false }).allowed, false);
  assert.equal(intentPolicy({ GITHUB_EVENT_NAME: 'workflow_dispatch', CANDIDATE_INPUT: 'true' }, '1.82.0-beta.6', { registrySupported: false }).allowed, true);
  assert.equal(intentPolicy({ GITHUB_EVENT_NAME: 'workflow_dispatch' }, '1.82.0-beta.6', { registrySupported: true }).allowed, true);
  assert.throws(() => registryPath('../frontend', H('a')));
  assert.throws(() => registryPath('frontend', '../key'));
});
test('probe authenticates the indexed record, never treats JSON presence as PASS', async () => {
  const f = fixture();
  const common = { root: '.', repo: f.args.repo, plan: f.args.plan, jobs: ['frontend'], now,
    store: { tip: sha, read: () => f.record }, source: async () => f.args, nameOf: () => f.args.jobNames };
  assert.equal((await probeRegistry(common)).results.frontend.accepted, true);
  f.record.inventory.dist = H('9');
  assert.equal((await probeRegistry(common)).results.frontend.accepted, false);
  assert.equal((await probeRegistry({ ...common, source: async () => { throw Error('offline'); } })).results.frontend.accepted, false);
  assert.equal((await probeRegistry({ ...common, allowed: false })).results.frontend.accepted, false);
  assert.equal((await probeRegistry({ ...common, store: { tip: sha, read: () => null } })).results.frontend.accepted, false);
});
function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-registry-proof-'));
  assert.ok(root.startsWith(resolve(tmpdir()) + sep));
  t.after(() => rmSync(root, { recursive: true, force: true })); return root;
}
const git = (root, args, options = {}) => execFileSync('git', ['-C', root, ...args],
  { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options }).trim();
test('real orphan registry survives concurrent CAS writers and reads from unrelated branches', t => {
  const root = temporary(t), remote = join(root, 'origin.git'), a = join(root, 'a'), b = join(root, 'b');
  mkdirSync(remote); git(remote, ['init', '--bare']);
  for (const dir of [a, b]) {
    git(root, ['clone', remote, dir]); git(dir, ['config', 'user.name', 'Fixture']);
    git(dir, ['config', 'user.email', 'fixture@example.invalid']);
  }
  const record = fixture().record, second = { ...record, key: H('b') }, third = { ...record, key: H('c') };
  publishRegistry({ root: a, records: [record] });
  const first = git(a, ['rev-parse', 'refs/remotes/origin/ci-proofs']);
  assert.equal(git(a, ['rev-list', '--parents', first]).split(/\s+/).length, 1, 'first registry commit is orphan');
  let collision = false, pushes = 0;
  publishRegistry({ root: b, records: [third], gitOp: (dir, args, opts) => {
    if (args[0] === 'push') {
      pushes++;
      if (!collision) { collision = true; publishRegistry({ root: a, records: [second] }); }
    }
    return git(dir, args, opts);
  } });
  assert.equal(pushes, 2, 'lost CAS is retried against the winning tip');
  git(b, ['checkout', '--orphan', 'issue/981-unrelated', 'refs/remotes/origin/ci-proofs']);
  writeFileSync(join(b, 'README.md'), 'unrelated content\n'); git(b, ['add', 'README.md']); git(b, ['commit', '-m', 'unrelated']);
  const head = git(b, ['rev-parse', 'HEAD']), store = fetchRegistry(b);
  for (const expected of [record, second, third]) assert.deepEqual(store.read('frontend', expected.key), expected);
  assert.equal(git(b, ['rev-parse', 'HEAD']), head, 'index reads never move the checkout');
  // Corrupt external JSON is an input case, not a code mutation.
  git(b, ['checkout', '-b', 'registry-corrupt-input', 'refs/remotes/origin/ci-proofs']);
  const path = registryPath('frontend', record.key); writeFileSync(join(b, path), '{corrupt JSON');
  git(b, ['add', path]); git(b, ['commit', '-m', 'corrupt fixture input']); git(b, ['push', 'origin', 'HEAD:ci-proofs']);
  assert.equal(fetchRegistry(a).read('frontend', record.key), null);
});
test('proof consumer re-authenticates source instead of believing a reuse claim', () => {
  const f = fixture(), workflow = validateJobs(), needs = {};
  for (const id of workflow.keys()) needs[id] = { result: 'success', outputs: {} };
  needs.changes.outputs = { frontend: 'true' };
  needs.reuse.outputs = { frontend: 'true', frontend_key: f.record.key, frontend_source_run: '1234',
    frontend_source_attempt: '2', frontend_source_sha: sha, frontend_record: JSON.stringify(f.record) };
  const proof = buildCiProof({ candidateSha: 'b'.repeat(40), candidateTree: 'c'.repeat(40), runId: 2222,
    attempt: 1, event: 'push', needs, registry: { plan: f.args.plan } });
  const jobs = [...workflow.values()].flatMap(j => jobInstanceNames(j).map(name => ({ name, status: 'completed', conclusion: 'success' })));
  const run = { id: 2222, run_attempt: 1, head_sha: proof.candidate.sha, path: '.github/workflows/validate.yml',
    status: 'completed', conclusion: 'success', repository: { full_name: f.args.repo } };
  const context = { run, proof, jobs, reuseRuns: new Map([['1234:2', f.args]]) };
  assert.equal(evaluateCiProof(context).status, 'green');
  f.args.proof.registry.produced = [];
  assert.equal(evaluateCiProof(context).status, 'failed');
  assert.equal(evaluateCiProof({ ...context, policy: { fresh: true } }).status, 'stale');
});
test('minting records requires actual producer stamps and never publishes inherited chains', () => {
  const f = fixture(), needs = { frontend: { outputs: { toolchain: JSON.stringify(f.args.plan.toolchain), inventory: JSON.stringify(f.record.inventory), recipe: f.args.plan.recipes.frontend } } };
  f.args.proof.run.workflow = 'validate.yml';
  const records = producedRegistryRecords({ plans: [f.args.plan], proof: f.args.proof, needs, repo: f.args.repo, workflowRevision: sha });
  assert.equal(records.length, 1);
  f.args.proof.checks.frontend.mode = 'reused';
  assert.equal(producedRegistryRecords({ plans: [f.args.plan], proof: f.args.proof, needs }).length, 0);
  f.args.proof.checks.frontend.mode = 'executed'; needs.frontend.outputs.toolchain = '{}';
  assert.equal(producedRegistryRecords({ plans: [f.args.plan], proof: f.args.proof, needs }).length, 0);
});
test('unchanged pre-registry dev reader accepts the fresh additive v1 migration proof', t => {
  const root = temporary(t), archive = join(root, 'old-controller.tar');
  // Accepted immutable #980 dev snapshot; no historical code is modified.
  git(process.cwd(), ['archive', '--format=tar', '--output=' + archive,
    '2b151e454750b3b1413b794311ac375caa1426cc', 'scripts', '.github/workflows/validate.yml']);
  // stdin avoids GNU tar interpreting a native Windows drive as a remote host.
  execFileSync('tar', ['-xf', '-'], { cwd: root, input: readFileSync(archive) });
  const f = fixture(), workflow = validateJobs(), needs = {};
  for (const id of workflow.keys()) needs[id] = { result: 'success', outputs: {} };
  const proof = buildCiProof({ candidateSha: sha, candidateTree: 'c'.repeat(40), runId: 1234, attempt: 2, event: 'workflow_dispatch',
    needs, registry: { plan: f.args.plan } });
  const jobs = [...workflow.values()].flatMap(j => jobInstanceNames(j).map(name => ({ name, status: 'completed', conclusion: 'success' })));
  const run = { ...f.args.run, event: 'workflow_dispatch' };
  const historicalReader = [
    "import { readFileSync } from 'node:fs';",
    "import { evaluateCiProof } from './scripts/ci-proof.mjs';",
    "console.log(JSON.stringify(evaluateCiProof(JSON.parse(readFileSync(0, 'utf8')))));",
  ].join('\n');
  const legacy = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', historicalReader],
    { cwd: root, input: JSON.stringify({ run, proof, jobs }), encoding: 'utf8' }));
  assert.equal(legacy.status, 'green');
  assert.equal(evaluateCiProof({ run, proof, jobs }).status, 'green');
  jobs.splice(jobs.findIndex(j => j.name === JOB_RULES.product_guards[0].name), 1);
  assert.equal(evaluateCiProof({ run, proof, jobs }).status, 'failed', 'new reader still requires fresh guards');
});
