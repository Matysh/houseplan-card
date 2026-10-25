import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentInputKey } from '../scripts/content-inputs.mjs';
import { frontendUnitPlan } from '../scripts/frontend-units.mjs';
import { localGateKey, sealLocalGate, restoreLocalGate, invalidateLocalGate } from '../scripts/local-gate-proof.mjs';
import { frontendContentKey, artifactTree, restoreFrontend } from '../scripts/frontend-proof.mjs';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';
import { taskCiPlan } from '../scripts/task-ci-plan.mjs';
import { directTransfer, discoverTransfers, transferProtocolMatches } from '../scripts/check-proof-transfer.mjs';
import { runnerEnvironment, matchingProducerEnvironment, producerEnvironments } from '../scripts/ci-job-environment.mjs';
import { buildCiProof, JOB_RULES, requiredCheckIds, resolveJobRules } from '../scripts/ci-proof.mjs';
import { selectSmokes } from '../scripts/smoke-select.mjs';
import { localGateEnvironment } from '../scripts/local-gate-environment.mjs';
import { statusCounterFixture } from './helpers/status-counter-fixture.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-954-fixture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (p, s) => { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), s); };
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@x', ...args], { encoding: 'utf8' }).trim();
  for (const p of ['frontend-proof', 'frontend-units', 'content-inputs', 'check-inputs', 'local-gate-proof', 'local-gate-environment', 'gate-small', 'ci-proof', 'ci-job-environment']) put(`scripts/${p}.mjs`, '// fixture protocol');
  put('src/a.ts', 'export const a=1;'); put('test/a.test.mjs', 'import "../test-build/a.js";'); put('.nvmrc', '22'); put('.python-version', '3.14'); put('package.json', '{}');
  put('.github/workflows/validate.yml', 'name: fixture');
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'source');
  return { root, put, git };
}

test('#954 reusable product units exclude FS/Git/process/dynamic readers; every unit has one owner', () => {
  const tests = ['test/pure.test.mjs', 'test/git.test.mjs', 'test/tool.test.mjs', 'test/dynamic.test.mjs'];
  const grouping = { tests, product: tests.filter(x => !x.includes('tool')), dependencies: Object.fromEntries(tests.map(x => [x, [x]])) };
  const source = ['import assert from "node:assert";', 'import {execFileSync} from "node:child_process";', 'const tool = 1;', 'await import(variable);'];
  const plan = frontendUnitPlan('.', { grouping, read: p => source[tests.indexOf(p)] });
  assert.deepEqual(plan.reusable, [tests[0]]);
  assert.deepEqual(plan.fresh, tests.slice(1));
  assert.deepEqual([...plan.fresh, ...plan.reusable].sort(), [...tests].sort());
  assert.equal(frontendUnitPlan('.', { grouping, read: () => { throw Error('missing'); } }).reusable.length, 0);
});

test('#1044 task scope is explicit on every track; full is an intentional request', () => {
  const input = { refName: 'issue/954-x' };
  for (const options of [{ labels: ['ci:golden'] }, { unknown: true }, { risk: { visual: { render: true } } }])
    assert.throws(() => taskCiPlan(input, options), /Task check plan is unknown/);
  for (const options of [{ labels: ['ci:full'] }, { baseFull: true }])
    assert.deepEqual(taskCiPlan(input, options), { full: true, golden: true });
  for (const track of ['ship', 'show', 'ask']) for (const eventName of ['push', 'workflow_dispatch']) {
    const plan = taskCiPlan({ ...input, eventName }, { files: [], diffText: '', labels: [`track:${track}`],
      browserOptions: { smokeSelection: { direct: [], registered: [], noExecutableDiff: true } } });
    assert.equal(plan.full, false); assert.equal(plan.golden, false);
    assert.equal(plan.browser.scope, 'task');
  }
  assert.deepEqual(requiredCheckIds({ request: { golden: true } }), ['preflight', 'changes', 'reuse', 'golden']);
  assert.ok(requiredCheckIds({ request: { full: true } }).includes('smoke'));
});

test('#954 local receipt restores actual bytes across a commit, refuses data/env/corruption/expiry/failure', t => {
  const { root, put, git } = fixture(t), environment = { PATH: 'fixed', arbitraryOption: 'first' };
  put('dist/a.js', 'built'); put('test-build/a.js', 'compiled');
  const key = localGateKey(root, environment);
  sealLocalGate(root, key, 1000);
  put('docs/reviews/review.md', 'metadata only'); git('add', 'docs'); git('commit', '-qm', 'review');
  assert.equal(localGateKey(root, environment), key, 'Git/metadata units are fresh, not in cached product identity');
  put('dist/a.js', 'old committed bundle');
  assert.equal(restoreLocalGate(root, key, 2000), true);
  assert.equal(readFileSync(join(root, 'dist/a.js'), 'utf8'), 'built');
  assert.notEqual(localGateKey(root, { ...environment, arbitraryOption: 'changed' }), key);
  for (const changed of [{ PATH: 'another tool directory' }, { MSYS: 'disable_pcon' }, { MSYSTEM: 'MINGW64' }]) {
    assert.notEqual(localGateKey(root, { ...environment, ...changed }), key, 'tool/search options cannot reuse the earlier PASS');
  }
  assert.equal(localGateKey(root, { ...environment, WSL_INTEROP: '/run/WSL/another-interop' }), key,
    'WSL transport session is not a Linux build or pure-unit input');
  put('src/new.ts', 'untracked executable'); assert.notEqual(localGateKey(root, environment), key);
  rmSync(join(root, 'src/new.ts'));
  assert.equal(restoreLocalGate(root, key, 1000 + 86400001), false);
  const privateDir = join(root, '.git/hp-local-gate-v1');
  const receipt = readFileSync(join(privateDir, 'proof.json'), 'utf8');
  writeFileSync(join(privateDir, 'proof.json'), JSON.stringify({ ...JSON.parse(receipt), created: 'unknown' }));
  assert.equal(restoreLocalGate(root, key, 2000), false, 'unknown receipt age is not fresh');
  writeFileSync(join(privateDir, 'proof.json'), receipt);
  writeFileSync(join(privateDir, 'dist/a.js'), 'corrupt');
  assert.equal(restoreLocalGate(root, key, 2000), false);
  sealLocalGate(root, key, 1000); invalidateLocalGate(root);
  assert.equal(restoreLocalGate(root, key, 2000), false, 'a failed new attempt cannot expose the old PASS');
});

test('#960 receipt environment follows Windows key casing while preserving tool options and unknown inputs', () => {
  const env = { Path: 'C:/tools;C:/Windows', ComSpec: 'C:/Windows/cmd.exe', custom: 'one' };
  const key = localGateEnvironment(env, 'win32');
  assert.deepEqual(localGateEnvironment({ PATH: env.Path, COMSPEC: env.ComSpec, CUSTOM: 'one' }, 'win32'), key);
  for (const extra of [{ custom: 'two' }, { MSYS: 'disable_pcon' }, { MSYSTEM: 'MINGW64' }, { PATH: 'C:/other' }]) {
    assert.notDeepEqual(localGateEnvironment({ ...key, ...Object.fromEntries(Object.entries(extra).map(([k,v]) => [k.toUpperCase(),v])) }, 'win32'), key);
  }
  assert.throws(() => localGateEnvironment({ Path: 'one', PATH: 'two' }, 'win32'), /conflicting environment key/);
  assert.notDeepEqual(localGateEnvironment({ Path: 'one' }, 'linux'), localGateEnvironment({ PATH: 'one' }, 'linux'));
});

test('#1068 local receipt restores counter-only commits but refuses counter plus real fixture changes', t => {
  const { root, put, git } = fixture(t), environment = { PATH: 'fixed' };
  put('docs/STATUS.md', statusCounterFixture());
  put('demo/fixtures/one.mjs', 'export const input = 1;');
  put('test/status.test.mjs', 'import {readFileSync} from "node:fs"; import "../src/a.ts"; readFileSync(new URL("../docs/STATUS.md", import.meta.url));');
  git('add', '.'); git('commit', '-qm', 'source with generated counters');
  assert.ok(frontendUnitPlan(root).fresh.includes('test/status.test.mjs'), 'metadata consumers still run fresh');
  put('dist/a.js', 'built'); put('test-build/a.js', 'compiled');
  const key = localGateKey(root, environment);
  sealLocalGate(root, key, 1000);
  put('docs/STATUS.md', statusCounterFixture(11));
  git('add', 'docs/STATUS.md'); git('commit', '-qm', 'counter only');
  assert.equal(git('diff', '--name-only', 'HEAD^', 'HEAD'), 'docs/STATUS.md');
  put('dist/a.js', 'stale');
  assert.equal(restoreLocalGate(root, localGateKey(root, environment), 2000), true);
  assert.equal(readFileSync(join(root, 'dist/a.js'), 'utf8'), 'built');
  put('docs/STATUS.md', statusCounterFixture(12));
  put('demo/fixtures/one.mjs', 'export const input = 2;');
  git('add', 'docs/STATUS.md', 'demo/fixtures/one.mjs'); git('commit', '-qm', 'real fixture and counters');
  assert.equal(restoreLocalGate(root, localGateKey(root, environment), 2000), false);
});

test('#954/#1068 real schema2 producer survives counters/docs-only SHA, rejects source/env/foreign repository or tampered bytes', t => {
  const { root, put, git } = fixture(t);
  const producer = mkdtempSync(join(tmpdir(), 'hp-954-producer-')); t.after(() => rmSync(producer, { recursive: true, force: true }));
  for (const n of ['dist', 'test-build']) { mkdirSync(join(producer, n)); writeFileSync(join(producer, n, 'a.js'), n); }
  const repo = 'o/r', environment = { node: '22', imageOS: 'ubuntu', imageVersion: 'one' };
  put('docs/producer.md', 'source metadata'); put('docs/STATUS.md', statusCounterFixture());
  put('demo/fixtures/one.mjs', 'export const input = 1;');
  git('add', 'docs', 'demo'); git('commit', '-qm', 'producer');
  const sha = git('rev-parse', 'HEAD'), tree = git('rev-parse', 'HEAD^{tree}');
  const proof = { schema: 2, outcome: 'success', reused: false, key: frontendContentKey(root, environment), environment,
    fingerprint: sourceFingerprint(root), sha, tree, run: 11, attempt: 1,
    dist: artifactTree(join(producer, 'dist')), testBuild: artifactTree(join(producer, 'test-build')) };
  writeFileSync(join(producer, 'proof.json'), JSON.stringify(proof));
  const run = { id: 11, run_attempt: 1, head_sha: sha, head_branch: 'issue/954-source', status: 'completed', conclusion: 'success',
    path: '.github/workflows/validate.yml', repository: { full_name: repo }, head_repository: { full_name: repo } };
  const api = args => {
    const p = args[1];
    if (p.includes('/actions/runs?')) return { workflow_runs: [run] };
    if (p.includes('/artifacts')) return { artifacts: [{ name: 'frontend-proof-11-1', expired: false, created_at: new Date().toISOString() }] };
    if (p.includes('/jobs')) return { jobs: [{ name: JOB_RULES.frontend[0].name, status: 'completed', conclusion: 'success' }] };
    if (p.includes('/git/commits/')) return { tree: { sha: tree } };
    return run;
  };
  let downloadCount = 0;
  const restore = (env, consumerBranch = 'issue/954-consumer') => restoreFrontend({ root, repo, api, environment: env || environment, consumerBranch,
    download: (_id, _name, out) => { downloadCount++; cpSync(producer, out, { recursive: true }); } });
  put('docs/STATUS.md', statusCounterFixture(11)); git('add', 'docs/STATUS.md'); git('commit', '-qm', 'counter only');
  assert.equal(git('diff', '--name-only', 'HEAD^', 'HEAD'), 'docs/STATUS.md');
  assert.equal(restore().reused, true, 'actual schema2 consumer accepts its immutable producer after counter-only commit');
  assert.equal(readFileSync(join(root, 'dist/a.js'), 'utf8'), 'dist');
  put('docs/STATUS.md', statusCounterFixture(12)); put('demo/fixtures/one.mjs', 'export const input = 2;');
  git('add', 'docs/STATUS.md', 'demo/fixtures/one.mjs'); git('commit', '-qm', 'real fixture and counters');
  assert.equal(restore().reused, false, 'a counter update cannot conceal substantive upstream fixture inputs');
  put('demo/fixtures/one.mjs', 'export const input = 1;'); git('add', 'demo/fixtures/one.mjs'); git('commit', '-qm', 'restore fixture');
  put('docs/reviews/review.md', 'review'); git('add', 'docs'); git('commit', '-qm', 'review');
  assert.equal(restore().reused, true);
  const oldUnitProtocol = readFileSync(join(root, 'scripts/frontend-units.mjs'), 'utf8');
  const downloadsBeforeProtocolChange = downloadCount;
  put('scripts/frontend-units.mjs', '// different mandatory unit protocol');
  assert.equal(restore().reused, false, 'a changed unit protocol refuses historical producers before artifact discovery');
  assert.equal(downloadCount, downloadsBeforeProtocolChange, 'incompatible unit protocol must not download a producer');
  put('scripts/frontend-units.mjs', oldUnitProtocol);
  put('test/git.test.mjs', 'import {readFileSync} from "node:fs"; import "../scripts/content-inputs.mjs";');
  assert.equal(frontendContentKey(root, environment), proof.key, 'new metadata test belongs to the always-fresh group');
  assert.equal(restore({ ...environment, imageVersion: 'two' }).reused, false);
  run.repository.full_name = 'foreign/repo'; assert.equal(restore().reused, false); run.repository.full_name = repo;
  put('src/a.ts', 'export const a=2;'); assert.equal(restore().reused, false); git('restore', 'src/a.ts');
  git('checkout', '-qb', 'rebased', `${sha}^`);
  put('demo/fixtures/one.mjs', 'export const input = 1;');
  put('docs/rebased.md', 'different metadata base'); git('add', 'docs', 'demo'); git('commit', '-qm', 'rebased equivalent product');
  assert.equal(restore().reused, false, 'a non-ancestor from another issue cannot inherit trust');
  assert.equal(restore(undefined, run.head_branch).reused, true, 'same issue retains its independently identical product proof after rebase');
  writeFileSync(join(producer, 'dist/a.js'), 'tampered'); assert.equal(restore(undefined, run.head_branch).reused, false);
});

test('#954 transfer verifies direct executed source, exact tree/env/key/attempt and all source jobs', async () => {
  const repo = 'o/r', sha = 'a'.repeat(40), tree = 'b'.repeat(40), key = 'c'.repeat(64), environment = runnerEnvironment({ ImageOS: 'ubuntu', ImageVersion: 'one' });
  const run = { id: 11, run_attempt: 1, head_sha: sha, head_branch: 'issue/954-source', event: 'push', path: '.github/workflows/validate.yml',
    status: 'completed', conclusion: 'success', repository: { full_name: repo }, head_repository: { full_name: repo },
    html_url: 'https://github.com/o/r/actions/runs/11', updated_at: new Date().toISOString() };
  const needs = Object.fromEntries(['preflight', 'changes', 'reuse', 'backend'].map(n => [n, { result: 'success', outputs: {} }]));
  needs.changes.outputs.backend = 'true';
  const proof = buildCiProof({ candidateSha: sha, candidateTree: tree, runId: 11, attempt: 1, event: 'push', needs, evidence: { keys: { backend: key } } });
  proof.environments = { backend: environment };
  const context = { proof, jobs: ['preflight', 'changes', 'reuse', 'backend'].map(n => ({ name: JOB_RULES[n][0].name, status: 'completed', conclusion: 'success' })) };
  const input = { repo, run, context, job: 'backend', key, sourceKey: key, tree, environment };
  assert.equal(directTransfer(input).sourceRun, 11);
  for (const delta of [{ sourceKey: 'd'.repeat(64) }, { tree: sha }, { environment: { ...environment, imageVersion: 'two' } },
    { run: { ...run, conclusion: 'failure' } }, { run: { ...run, conclusion: 'cancelled' } },
    { run: { ...run, run_attempt: 2 } }, { run: { ...run, repository: { full_name: 'foreign/repo' } } },
    { context: { ...context, jobs: context.jobs.slice(1) } },
    { context: { ...context, proof: { ...proof, environment, environments: {} } } },
    { context: { ...context, proof: { ...proof, checks: { backend: { ...proof.checks.backend, mode: 'reused' } } } } },
    { now: Date.now() + 86400001 }]) assert.equal(directTransfer({ ...input, ...delta }), null);
  const options = { repo, environment, jobs: ['backend'], api: async p => p.includes('/actions/runs?') ? { workflow_runs: [run] } : run,
    contextOf: async () => context, ancestor: () => true, treeOf: () => tree, keyOf: () => key };
  assert.equal((await discoverTransfers(options)).backend.sourceRun, 11);
  assert.deepEqual(await discoverTransfers({ ...options, ancestor: () => false }), {});
  const fullNeeds = Object.fromEntries(['preflight', 'changes', 'reuse', 'smoke', 'smoke_done', 'golden', 'performance_smoke']
    .map(n => [n, { result: 'success', outputs: {} }]));
  fullNeeds.changes.outputs.heavy = 'true';
  const perfProof = buildCiProof({ candidateSha: sha, candidateTree: tree, runId: 11, attempt: 1, event: 'push', needs: fullNeeds,
    evidence: { keys: { performance_smoke: key } } });
  perfProof.environments = { performance_smoke: environment }; perfProof.performanceSet = 'glow';
  const rules = resolveJobRules();
  const perfContext = { proof: perfProof, jobs: perfProof.requiredChecks.flatMap(id => rules[id].flatMap(r => r.names))
    .map(name => ({ name, conclusion: 'success', status: 'completed' })) };
  const perfInput = { ...input, context: perfContext, job: 'performance_smoke' };
  assert.equal(directTransfer(perfInput).sourceRun, 11);
  assert.equal(directTransfer({ ...perfInput, performanceSet: 'glow-interaction' }), null, 'Glow alone cannot prove the interaction profile');
});

test('#954 actual producer stamps require all smoke shards; aggregation runner is not evidence', t => {
  const { root, put } = fixture(t), out = join(root, 'output');
  const script = new URL('../scripts/ci-job-environment.mjs', import.meta.url);
  const env = { ...process.env, ImageOS: 'ubuntu', ImageVersion: 'one', GITHUB_OUTPUT: out };
  execFileSync(process.execPath, [fileURLToPath(script), '--output=environment_2'], { env });
  const stamp = JSON.parse(readFileSync(out, 'utf8').trim().slice('environment_2='.length));
  const expected = runnerEnvironment(env);
  assert.deepEqual(stamp, expected);
  const outputs = Object.fromEntries([1, 2, 3].map(n => [`environment_${n}`, JSON.stringify(stamp)]));
  const needs = { smoke: { outputs }, backend: { outputs: { environment: JSON.stringify(stamp) } } };
  const stamps = producerEnvironments(needs);
  assert.equal(matchingProducerEnvironment(stamps.backend, expected, 'backend'), true);
  assert.equal(matchingProducerEnvironment(stamps.smoke, expected, 'smoke'), true);
  for (const shards of [stamps.smoke.slice(1), [stamp, null, stamp], [stamp, { ...stamp, imageVersion: 'two' }, stamp]])
    assert.equal(matchingProducerEnvironment(shards, expected, 'smoke'), false);
  assert.equal(matchingProducerEnvironment(producerEnvironments({}).backend, expected, 'backend'), false);
  assert.equal(matchingProducerEnvironment(stamp, { ...expected, node: 'another' }, 'backend'), false);
  put('invalid', 'not JSON');
  assert.equal(producerEnvironments({ backend: { outputs: { environment: readFileSync(join(root, 'invalid'), 'utf8') } } }).backend, null);
});

test('#954 retired marker CLI cannot grant a skip from cached or transfer JSON', t => {
  const { root, put } = fixture(t), marker = join(root, '.reuse-marker'), file = join(root, 'transfer.json');
  const cli = fileURLToPath(new URL('../scripts/check-proof-transfer.mjs', import.meta.url));
  put('.reuse-marker', 'SHA: foreign\nпрогон: https://github.com/foreign/r/actions/runs/99\nпопытка: 1\n');
  const original = readFileSync(marker, 'utf8');
  for (const content of ['{}', JSON.stringify({ backend: { sourceRun: 11, sourceAttempt: 2, sourceSha: 'a'.repeat(40) } })]) {
    put('transfer.json', content);
    const result = execFileSync(process.execPath, [cli, '--job=backend', '--file=' + file, '--marker=' + marker],
      { cwd: root, env: { ...process.env, GITHUB_OUTPUT: '' }, encoding: 'utf8' });
    assert.match(result, /^backend=false$/m); assert.doesNotMatch(result, /=true|accepted=true|source_run=11/);
    assert.equal(readFileSync(marker, 'utf8'), original, 'retired CLI cannot rewrite a cached source into authority');
  }
});

test('#954 source stamp implementation must match too, not just the proof aggregator', t => {
  const { root, put, git } = fixture(t), sha = git('rev-parse', 'HEAD');
  assert.equal(transferProtocolMatches(root, sha), true);
  for (const name of ['ci-proof', 'ci-job-environment']) {
    put(`scripts/${name}.mjs`, '// changed protocol data, never executed');
    assert.equal(transferProtocolMatches(root, sha), false, name);
    git('restore', `scripts/${name}.mjs`);
  }
  assert.equal(transferProtocolMatches(root, '--invalid-ref'), false);
});

test('#954 common orchestration fields cannot select unrelated smoke contracts', () => {
  const diff = 'diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+this._config = this._editorRuntime;';
  const selection = selectSmokes(diff, { table: new Set(['_config', '_editorRuntime']), corpus: new Map([['smoke_unrelated.mjs', 'card._config; card._editorRuntime;']]) });
  assert.equal(selection.direct.length, 0);
  assert.equal(selection.unproven, true);
  assert.ok(selection.visualMinimum.length > 0, 'uncertainty cannot be empty PASS');
});

test('#954 content proof survives docs-only commit, not source/test/pin/env or untracked inputs', t => {
  const root = mkdtempSync(join(tmpdir(), 'hp-954-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@x', ...args], { encoding: 'utf8' }).trim();
  const put = (p, s) => { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), s); };
  put('src/a.ts', 'export const a=1;'); put('test/a.test.mjs', 'const a=1;'); put('.nvmrc', '22');
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'source');
  const ref = git('rev-parse', 'HEAD'), environment = { node: '22' };
  const key = () => contentInputKey(root, 'frontend', { environment });
  const original = key();
  put('docs/reviews/a.md', 'review'); git('add', '.'); git('commit', '-qm', 'review');
  assert.equal(key(), original);
  assert.equal(contentInputKey(root, 'frontend', { ref, environment }), original);
  for (const file of ['src/a.ts', 'test/a.test.mjs', '.nvmrc']) {
    put(file, 'changed'); assert.notEqual(key(), original, file); git('restore', file);
  }
  assert.notEqual(contentInputKey(root, 'frontend', { environment: { node: '23' } }), original);
  put('src/new.ts', 'export const newValue=2;'); assert.notEqual(key(), original, 'untracked source cannot inherit PASS');
});
