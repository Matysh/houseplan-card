import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { taskCheckSource, loadTaskCheckContexts } from '../scripts/task-check-source.mjs';
import { taskCheckCli, taskCheckEnvironment, controllerSupportsTaskChecks, taskCheckReusePolicy } from '../scripts/task-check-reuse-cli.mjs';
import { TASK_CHECK_JOB_NAMES, taskCheckPlanFromSnapshot, makeTaskCheckRecord } from '../scripts/task-check-reuse.mjs';
import { JOB_RULES } from '../scripts/ci-proof.mjs';

const sha = 'a'.repeat(40), candidateSha = 'b'.repeat(40), tree = 'c'.repeat(40);
const now = Date.parse('2026-10-24T19:00:00Z'), repo = 'owner/repo';
const browserPlan = { schema: 1, scope: 'task', smoke: { mode: 'selected', ids: ['smoke_owned.mjs'] },
  golden: { mode: 'none', ids: [] } };
const workflow = 'name: Validate\non: [push]\njobs:\n'
  + Object.entries(TASK_CHECK_JOB_NAMES).map(([id, name]) => `  ${id}:\n    name: ${name}\n    runs-on: ubuntu-latest\n    steps:\n      - run: node check.mjs\n`).join('');
function snapshot() {
  const files = new Map([
    ...['validate', 'validate-product', 'validate-tooling'].map(name => [`.github/workflows/${name}.yml`, workflow]),
    ['scripts/ci-profile-paths.json', JSON.stringify({ product: ['**', '!test/contract.test.mjs'], tooling: ['scripts/**', 'test/contract.test.mjs'] })],
    ['test/contract.test.mjs', 'contract assertions'], ['src/card.ts', 'product'], ['demo/smoke_owned.mjs', 'browser assertions'],
  ]);
  const entries = new Map([...files].map(([path, text]) => [path, { mode: '100644',
    oid: createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0${text}`).digest('hex') }]));
  return { entries, tree, files, read: path => Buffer.from(files.get(path) || '') };
}
async function fixture(job = 'browser_selected') {
  const current = snapshot(), source = snapshot();
  const env = { GITHUB_REPOSITORY: repo, GITHUB_SHA: candidateSha,
    GITHUB_WORKFLOW_SHA: candidateSha, GITHUB_WORKFLOW_REF: `${repo}/.github/workflows/validate.yml@refs/heads/issue/1060-reuse`,
    GITHUB_RUN_ID: '44', GITHUB_RUN_ATTEMPT: '1', GH_TOKEN: 'test-token',
    BROWSER_PLAN: JSON.stringify(browserPlan), ImageOS: 'ubuntu24', ImageVersion: '20261020.1' };
  const plan = await taskCheckPlanFromSnapshot(current, { job, browserPlan, environment: taskCheckEnvironment(env) });
  const record = makeTaskCheckRecord(plan, { repo, run: 42, attempt: 2, sha,
    workflow: '.github/workflows/validate.yml', created: new Date(now - 10000).toISOString() });
  const run = { id: 42, run_attempt: 2, head_sha: sha, head_branch: 'issue/1060-reuse', path: record.workflow,
    status: 'completed', conclusion: 'success', event: 'push', repository: { full_name: repo }, head_repository: { full_name: repo },
    created_at: new Date(now - 60000).toISOString() };
  const proof = { schema: 'houseplan-ci-proof/v1', run: { id: 42, attempt: 2, event: 'push', workflow: 'validate.yml' },
    candidate: { sha, tree }, taskChecks: { [job]: { mode: 'executed', plan, record } },
    browserPlan: { planned: browserPlan, executed: { smoke: { mode: 'selected', ids: browserPlan.smoke.ids, result: 'success' },
      golden: { mode: 'none', ids: [], result: 'skipped' } } } };
  const artifact = { id: 50, name: 'ci-proof-42-2', expired: false, archive_download_url: 'https://artifacts.example.test/50',
    created_at: new Date(now - 5000).toISOString(), workflow_run: { head_sha: sha } };
  const context = { run, latestRun: { ...run }, jobs: [{ name: TASK_CHECK_JOB_NAMES[job], status: 'completed', conclusion: 'success', run_id: 42 }],
    artifact, proof, candidateSnapshot: current, sourceSnapshot: source };
  const claim = { mode: 'reused', record, plan };
  const consumer = { schema: proof.schema, candidate: { sha: candidateSha, tree }, request: {},
    taskChecks: { [job]: claim }, browserPlan: proof.browserPlan };
  return { job, env, plan, record, claim, context, consumer, current, source };
}
function zip(proof) {
  const body = Buffer.from(JSON.stringify(proof)), name = Buffer.from('proof.json');
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4);
  local.writeUInt32LE(body.length, 18); local.writeUInt32LE(body.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(local.length + name.length + body.length, 16);
  return Buffer.concat([local, name, body, central, name, end]);
}
function api(f, { mutate = value => value } = {}) {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    if (url === f.context.artifact.archive_download_url) return { ok: true, arrayBuffer: async () => zip(f.context.proof) };
    const path = url.split(`/repos/${repo}/`)[1]; let value;
    if (path === 'actions/runs/42/attempts/2') value = f.context.run;
    else if (path === 'actions/runs/42') value = f.context.latestRun;
    else if (path === 'actions/runs/42/attempts/2/jobs?per_page=100') value = { total_count: f.context.jobs.length, jobs: f.context.jobs };
    else if (path?.startsWith('actions/runs/42/artifacts?')) value = { total_count: 1, artifacts: [f.context.artifact] };
    else if (path?.startsWith('actions/runs?')) value = { total_count: (f.companions || []).length, workflow_runs: f.companions || [] };
    else if (/^actions\/runs\/5[78]$/.test(path || '')) value = f.companions.find(run => run.id === Number(path.split('/').at(-1)));
    else if (/^actions\/runs\/5[78]\/attempts\/1\/jobs/.test(path || '')) {
      const id = Number(path.split('/')[2]);
      value = { total_count: f.companionJobs[id].length, jobs: f.companionJobs[id] };
    }
    else if (path?.startsWith('git/trees/')) value = { sha: tree, truncated: false,
      tree: [...f.source.entries].map(([path, entry]) => ({ path, type: 'blob', mode: entry.mode, sha: entry.oid })) };
    else if (path?.startsWith('git/blobs/')) {
      const oid = path.slice('git/blobs/'.length), pair = [...f.source.entries].find(([, entry]) => entry.oid === oid);
      assert.ok(pair, 'known immutable blob'); value = { sha: oid, encoding: 'base64', content: f.source.read(pair[0]).toString('base64') };
    } else throw Error('unexpected source request: ' + url);
    return { ok: true, json: async () => mutate(structuredClone(value), path) };
  };
  return { calls, fetchImpl };
}

test('#1060 cold probe bootstrap and fresh policy do not fetch the index or build a receipt plan', async () => {
  for (const options of [{ supported: false, env: {} }, { supported: true, env: { TASK_CHECK_FRESH: 'true' } }]) {
    const fail = () => { throw Error('unexpected expensive work'); };
    const result = await taskCheckCli({ job: 'tooling', ...options, registry: fail, planFor: fail, emit() {} });
    assert.equal(result.reused, false); assert.equal(result.claim, undefined);
  }
  assert.equal(controllerSupportsTaskChecks('.', () => { throw Error('old dev has no module'); }), false);
  assert.equal(controllerSupportsTaskChecks('.', () => "export const x='houseplan-task-check/v1';"), true);
});

test('#1060 tooling policy stays fresh on main/night/release even without product classification outputs', () => {
  for (const env of [{ GITHUB_REF_NAME: 'main' }, { NIGHT_INPUT: 'true' }, { FULL_INPUT: 'true' },
    { CANDIDATE_INPUT: 'true' }, { GITHUB_REF_NAME: 'dev', HEAD_MESSAGE: 'Candidate\n\nRelease: v1.83.0-beta.2' },
    { GITHUB_REF_NAME: 'v1.83.0', GITHUB_REF_TYPE: 'tag' }]) {
    assert.equal(taskCheckReusePolicy(env, true, '1.83.0').allowed, false, JSON.stringify(env));
  }
  for (const GITHUB_REF_NAME of ['dev', 'issue/1060-reuse'])
    assert.equal(taskCheckReusePolicy({ GITHUB_REF_NAME }, true, '1.83.0').allowed, true, 'ordinary stable package version does not force task fresh');
});

test('#1060 CLI stamps actual execution and accepts only authenticated direct source records', async () => {
  for (const job of ['tooling', 'browser_selected']) {
    const f = await fixture(job), emitted = [];
    const options = { job, env: f.env, supported: true, now, snapshotFor: () => f.current,
      registry: () => ({ read: () => f.record }), sourceFactory: () => async () => f.context, emit: value => emitted.push(value) };
    const stamp = await taskCheckCli({ ...options, stamp: true });
    assert.equal(stamp.claim.mode, 'executed'); assert.equal(stamp.claim.record.sha, candidateSha); assert.equal(stamp.claim.record.run, 44);
    const reused = await taskCheckCli(options);
    assert.equal(reused.reused, true, reused.reason); assert.equal(reused.claim.mode, 'reused');
    assert.equal(reused.claim.record.run, 42); assert.equal(reused.claim.record.sha, sha);
    f.context.latestRun.conclusion = 'cancelled';
    assert.equal((await taskCheckCli(options)).reused, false);
    f.context.latestRun.conclusion = 'success';
    assert.equal((await taskCheckCli({ ...options, env: { ...f.env, ImageVersion: 'different' } })).reused, false);
    await assert.rejects(taskCheckCli({ ...options, stamp: true, env: { ...f.env, GITHUB_WORKFLOW_SHA: sha } }), /workflow revision/);
  }
});

test('#1060 network adapter verifies immutable attempt, artifact and Git blobs with cached source reads', async () => {
  const f = await fixture(), network = api(f);
  const source = taskCheckSource({ repo, token: 'test-token', candidateSha, root: 'missing-local-repo', fetchImpl: network.fetchImpl });
  const contexts = await loadTaskCheckContexts({ proof: f.consumer, repo, candidateSha, source, now });
  assert.equal(contexts.get(f.job).accepted, true, contexts.get(f.job).reason);
  const count = network.calls.length;
  assert.ok(network.calls.some(url => url.includes('/attempts/2/jobs')));
  assert.ok(network.calls.some(url => url.includes('/git/blobs/')));
  await loadTaskCheckContexts({ proof: f.consumer, repo, candidateSha, source, now });
  assert.equal(network.calls.length, count, 'same immutable source reads are shared');
});

test('#1060 proof loader refuses changed consumer coverage, fresh requests and recursive sources', async () => {
  for (const change of [
    f => { f.consumer.browserPlan = structuredClone(f.consumer.browserPlan); f.consumer.browserPlan.planned.smoke.ids.push('smoke_missing.mjs'); },
    f => { f.consumer.request.full = true; },
    f => { f.context.proof.taskChecks[f.job].mode = 'reused'; },
    f => { f.context.proof.candidate.tree = 'd'.repeat(40); },
    f => { f.context.latestRun.run_attempt = 3; },
    f => { f.context.jobs[0].conclusion = 'failure'; },
  ]) {
    const f = await fixture(); change(f);
    const contexts = await loadTaskCheckContexts({ proof: f.consumer, repo, candidateSha, source: async () => f.context, now });
    assert.equal(contexts.get(f.job).accepted, false, String(change));
  }
});

test('#1060 incomplete or ambiguous API evidence fails closed without losing the refusal reason', async () => {
  for (const mutate of [
    (value, path) => path.startsWith('git/trees/') ? { ...value, truncated: true } : value,
    (value, path) => path.includes('/jobs?') ? { ...value, total_count: 101 } : value,
    (value, path) => path.includes('/artifacts?') ? { ...value, total_count: 2, artifacts: [value.artifacts[0], value.artifacts[0]] } : value,
    (value, path) => path.startsWith('git/blobs/') ? { ...value, sha: 'd'.repeat(40) } : value,
  ]) {
    const f = await fixture(), network = api(f, { mutate });
    const contexts = await loadTaskCheckContexts({ proof: f.consumer, repo, candidateSha, root: 'missing-local-repo', fetchImpl: network.fetchImpl, now });
    assert.equal(contexts.get(f.job).accepted, false); assert.ok(contexts.get(f.job).reason);
  }
});

test('#1060 a split browser producer requires exact successful companion attempts and actual jobs', async () => {
  const split = async () => {
    const f = await fixture();
    f.record.workflow = '.github/workflows/validate-product.yml'; f.context.run.path = f.record.workflow;
    f.context.latestRun.path = f.record.workflow; f.context.proof.run.workflow = 'validate-product.yml';
    f.context.proof.requiredProfiles = ['product', 'tooling', 'docs'];
    f.companions = ['tooling', 'docs'].map((profile, index) => ({ ...f.context.run, id: 57 + index, run_attempt: 1,
      path: `.github/workflows/validate-${profile}.yml` }));
    f.companionJobs = Object.fromEntries(f.companions.map(run => [run.id,
      [JOB_RULES.preflight[0].name, ...(run.id === 57 ? [TASK_CHECK_JOB_NAMES.tooling] : [])]
        .map(name => ({ name, run_id: run.id, status: 'completed', conclusion: 'success' }))]));
    return f;
  };
  for (const change of [null,
    f => { f.companions.pop(); },
    f => { f.companions[0].conclusion = 'cancelled'; },
    f => { f.companions[0].status = 'in_progress'; },
    f => { f.companions[0].head_sha = candidateSha; },
    f => { f.companionJobs[57].pop(); },
    f => { f.companionJobs[57][0].conclusion = 'failure'; },
    f => { f.context.proof.requiredProfiles = ['product', 'unknown']; },
  ]) {
    const f = await split(); if (change) change(f);
    const network = api(f);
    const contexts = await loadTaskCheckContexts({ proof: f.consumer, repo, candidateSha,
      root: 'missing-local-repo', fetchImpl: network.fetchImpl, now });
    assert.equal(contexts.get(f.job).accepted, !change, contexts.get(f.job).reason);
  }
});
