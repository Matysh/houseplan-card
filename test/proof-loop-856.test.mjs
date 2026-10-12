import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { admissibleFrontendProof, artifactTree, verifyProducerTrees, restoreFrontend, frontendKey } from '../scripts/frontend-proof.mjs';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';
import { sealContinuation, authenticatedContinuation } from '../scripts/continuation-record.mjs';
import { mergeContinuationDecision, resumeMergeContinuation, resumeDomainContinuation } from '../scripts/workflow-continuation.mjs';
import { prepareReleasePending } from '../scripts/workflow-pending.mjs';
import { probeE2e } from '../scripts/e2e-gate.mjs';
import { issueBodyDigest } from '../scripts/review-doc-guard.mjs';
import { unitGroups, groupsAffectedBy } from '../scripts/unit-groups.mjs';
import { findStep, runStep } from './helpers/workflow-step.mjs';

const root = new URL('..', import.meta.url);
const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40), key = 'e'.repeat(64);
const repo = 'Matysh/houseplan-card', body = 'immutable issue';
const environment = { node: '22.23.2', platform: 'linux', arch: 'x64', imageOS: 'ubuntu24', imageVersion: 'pinned-image' };
const run = { id: 11, run_attempt: 1, status: 'completed', conclusion: 'success', head_sha: a,
  path: '.github/workflows/validate.yml', head_branch: 'dev', repository: { full_name: repo }, head_repository: { full_name: repo } };
const jobs = [{ name: 'Фронтенд: типы, юниты, мутанты, синхрон бандла', status: 'completed', conclusion: 'success' }];
const artifact = { name: 'frontend-proof-11-1', expired: false, created_at: '2026-10-12T00:00:00Z' };
const proof = { schema: 1, outcome: 'success', reused: false, key, environment, fingerprint: key, sha: a, tree: b,
  run: 11, attempt: 1, dist: key, testBuild: key };
const context = { key, fingerprint: key, environment, run, jobs, artifact, tree: b, repo, now: Date.parse('2026-10-12T01:00:00Z') };
const temp = t => { const dir = mkdtempSync(join(tmpdir(), 'hp-856-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };

test('#856 frontend reuse needs full successful provenance, exact input/env and producer bytes', t => {
  assert.equal(admissibleFrontendProof(proof, context), true);
  assert.equal(admissibleFrontendProof({ ...proof, outcome: 'failure' }, context), false);
  for (const delta of [{ key: 'f'.repeat(64) }, { environment: { ...environment, node: '23' } },
    { run: { ...run, conclusion: 'failure' } }, { run: { ...run, conclusion: 'cancelled' } },
    { run: { ...run, status: 'in_progress' } }, { run: { ...run, repository: { full_name: 'fork/repo' } } },
    { run: { ...run, head_branch: 'issue/856-forged' } }, { tree: c }, { jobs: [] },
    { artifact: { ...artifact, expired: true } }, { now: context.now + 86400000 }])
    assert.equal(admissibleFrontendProof(proof, { ...context, ...delta }), false);
  assert.equal(admissibleFrontendProof({ ...proof, reused: true }, context), false, 'no unbounded proof chain');
  const dir = temp(t);
  for (const name of ['dist', 'test-build']) { mkdirSync(join(dir, name)); writeFileSync(join(dir, name, 'file.js'), name); }
  const p = { dist: artifactTree(join(dir, 'dist')), testBuild: artifactTree(join(dir, 'test-build')) };
  verifyProducerTrees(p, dir);
  writeFileSync(join(dir, 'dist', 'file.js'), 'corrupted');
  assert.throws(() => verifyProducerTrees(p, dir), /inventory mismatch/);
});

test('#856 real producer restore copies verified bytes; config/lock/pin/workflow/corruption force fresh execution', t => {
  const dir = temp(t), producer = temp(t);
  const files = { '.nvmrc': '22', '.python-version': '3.12', 'package.json': '{}', 'package-lock.json': '{}',
    'tsconfig.json': '{}', 'src/a.ts': 'export const a = 1;',
    'scripts/frontend-proof.mjs': '// helper', 'scripts/check-inputs.mjs': '// manifest',
    '.github/workflows/validate.yml': 'name: Test' };
  for (const [p, content] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true }); writeFileSync(join(dir, p), content);
  }
  const git = (...args) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@x', ...args], { encoding: 'utf8' }).trim();
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'producer');
  const sha = git('rev-parse', 'HEAD'), tree = git('rev-parse', 'HEAD^{tree}');
  for (const p of ['dist', 'test-build']) { mkdirSync(join(producer, p)); writeFileSync(join(producer, p, 'file.js'), 'verified-' + p); }
  const stored = { ...proof, key: frontendKey(dir, environment), fingerprint: sourceFingerprint(dir), sha, tree,
    dist: artifactTree(join(producer, 'dist')), testBuild: artifactTree(join(producer, 'test-build')) };
  writeFileSync(join(producer, 'proof.json'), JSON.stringify(stored));
  const sourceRun = { ...run, head_sha: sha };
  const sourceArtifact = { ...artifact, created_at: new Date().toISOString() };
  const api = args => {
    const path = args[1];
    if (path.includes('/workflows/')) return { workflow_runs: [sourceRun] };
    if (path.includes('/artifacts')) return { artifacts: [sourceArtifact] };
    if (path.includes('/jobs')) return { jobs };
    if (path.includes('/git/commits/')) return { tree: { sha: tree } };
    return sourceRun;
  };
  const restore = () => restoreFrontend({ root: dir, repo, environment, api, download: (_id, _name, out) => cpSync(producer, out, { recursive: true }) });
  assert.equal(restore().reused, true);
  assert.equal(readFileSync(join(dir, 'dist/file.js'), 'utf8'), 'verified-dist');
  for (const p of ['tsconfig.json', 'package-lock.json', '.nvmrc', '.github/workflows/validate.yml', 'src/a.ts']) {
    const bytes = readFileSync(join(dir, p)); writeFileSync(join(dir, p), bytes + '\nchanged');
    assert.equal(restore().reused, false, p); writeFileSync(join(dir, p), bytes);
  }
  writeFileSync(join(producer, 'test-build/file.js'), 'forged');
  assert.equal(restore().reused, false, 'artifact bytes not a cache-hit PASS');
  assert.equal(readFileSync(join(dir, 'test-build/file.js'), 'utf8'), 'verified-test-build', 'invalid artifact never replaces previous bytes');
});

test('#856 release pending preserves owner intent; no green for partial/failed/cancelled/new tag/dev state', async t => {
  const candidate = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const fields = [];
  const base = { repo, candidate, tag: 'v1.81.0-beta.2', stable: false, workflow: 'publish-prerelease.yml', out: temp(t),
    request: path => { if (path.includes('/tags/')) throw Error('404 Not Found'); return { object: { sha: candidate } }; },
    seal: p => fields.push(p), probe: () => ({ status: 'pending' }) };
  const pending = await prepareReleasePending(base);
  assert.equal(pending.proceed, false); assert.equal(fields[0].dispatchSha, candidate); assert.equal(fields[0].tagSha, null);
  assert.equal((await prepareReleasePending({ ...base, probe: () => ({ status: 'green' }) })).proceed, true);
  await assert.rejects(prepareReleasePending({ ...base, probe: () => ({ status: 'failed' }) }), /red/);
  for (const status of ['missing', 'pending', 'cancelled', 'stale']) {
    assert.equal((await prepareReleasePending({ ...base, probe: () => ({ status }) })).proceed, false);
  }
  const p = { kind: 'release', dispatchSha: a, tagSha: b };
  let calls = 0;
  const ops = { state: () => ({ branch: a, tag: b }), proof: () => ({ status: 'green' }),
    claim: () => true, dispatch: () => calls++ };
  assert.equal((await resumeDomainContinuation(p, ops)).action, 'dispatched');
  for (const state of [{ branch: c, tag: b }, { branch: a, tag: c }]) await resumeDomainContinuation(p, { ...ops, state: () => state });
  await resumeDomainContinuation(p, { ...ops, claim: () => false });
  await resumeDomainContinuation(p, { ...ops, proof: () => ({ status: 'cancelled' }) });
  assert.equal(calls, 1);
});

test('#856 bounded E2E snapshot accepts only exact ref; no polling, no repeated dispatch, newest red barrier', async () => {
  let dispatched = 0;
  const run = { databaseId: 1, createdAt: new Date().toISOString(), status: 'completed', conclusion: 'success', url: 'run/1' };
  const ops = { listRuns: () => [run], jobs: () => [{ name: `journeys · HP ${a} · HA stable` }],
    releases: () => [], dispatch: () => dispatched++ };
  assert.equal((await probeE2e({ tag: 'v1.81.0', ref: a, ops, dispatch: true })).status, 'green');
  assert.equal(dispatched, 0);
  assert.equal((await probeE2e({ tag: 'v1.81.0', ref: b, ops, dispatch: true })).status, 'pending');
  assert.equal(dispatched, 1);
  assert.equal((await probeE2e({ tag: 'v1.81.0', ref: a, ops: { ...ops, listRuns: () => [{ ...run, conclusion: 'failure' }] } })).status, 'failed');
});

test('#856 actual completion runner refuses cancelled/foreign/failed-source events without any write', t => {
  if (process.platform === 'win32') { t.skip('Linux runner'); return; }
  const dir = temp(t), bin = join(dir, 'bin'); mkdirSync(bin);
  const pendingDir = join(dir, 'pending');
  const now = new Date();
  sealContinuation({ kind: 'release', repo, candidate: b, tree: c, tag: 'v1.81.0-beta.2', stable: false,
    workflow: 'publish-prerelease.yml', dispatchSha: a, tagSha: null, children: [], e2eDispatched: false,
    producerPath: '.github/workflows/publish-prerelease.yml' }, pendingDir,
  { GITHUB_RUN_ID: '20', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: a, GITHUB_REF_NAME: 'dev' }, now);
  const parent = { id: 20, run_attempt: 1, head_sha: a, head_branch: 'dev', event: 'workflow_dispatch',
    path: '.github/workflows/publish-prerelease.yml', status: 'completed', conclusion: 'success',
    repository: { full_name: repo }, head_repository: { full_name: repo }, created_at: new Date(+now - 60000).toISOString() };
  const child = { ...parent, id: 30, head_sha: b, path: '.github/workflows/validate.yml',
    created_at: now.toISOString(), conclusion: 'cancelled' };
  const artifact = { name: 'workflow-continuation-20-1', expired: false };
  const fixture = join(dir, 'fixture.json'), calls = join(dir, 'calls');
  writeFileSync(join(bin, 'gh'), [
    '#!/usr/bin/env node', "const fs = require('node:fs');",
    'const a=process.argv.slice(2), f=JSON.parse(fs.readFileSync(process.env.FAKE_FIXTURE));',
    'fs.appendFileSync(process.env.FAKE_CALLS, JSON.stringify(a)+"\\n");',
    'if(a[0]==="run"&&a[1]==="download"){fs.cpSync(process.env.FAKE_PENDING,a[a.indexOf("--dir")+1],{recursive:true});process.exit(0);}',
    'if(a[0]!=="api"||a.includes("--method"))process.exit(42);',
    'let value; const p=a[1];',
    'if(p.endsWith("/actions/runs/30"))value=f.child;',
    'else if(p.includes("/actions/artifacts?"))value={artifacts:[f.artifact]};',
    'else if(p.includes("/actions/runs/20/attempts/1"))value=f.parent;',
    'else if(p.includes("/workflows/validate.yml/runs?"))value={workflow_runs:[f.child]};',
    'else process.exit(43);process.stdout.write(JSON.stringify(value));',
  ].join('\n'), { mode: 0o755 });
  const wf = readFileSync(new URL('.github/workflows/_process-resume.yml', root), 'utf8');
  const step = findStep(wf, { name: 'Consume authenticated immutable continuation' });
  const execute = (source, event) => {
    writeFileSync(fixture, JSON.stringify({ parent: source, child: event, artifact }));
    return runStep(step, step.run.replaceAll('${{ runner.temp }}/continuation-result', join(dir, 'result')), {
      cwd: root, encoding: 'utf8', env: { ...process.env, PATH: bin + ':' + process.env.PATH,
        REPO: repo, EVENT_ID: '30', FAKE_FIXTURE: fixture, FAKE_PENDING: pendingDir, FAKE_CALLS: calls,
        GH_TOKEN: 'fixture-token', HP_PROCESS_TOKEN: 'fixture-token', GITHUB_STEP_SUMMARY: join(dir, 'summary') },
    });
  };
  const cancelled = execute(parent, child);
  assert.equal(cancelled.status, 0, cancelled.stderr); assert.match(cancelled.stdout, /cancelled completion grants no dispatch/);
  const foreign = execute(parent, { ...child, head_repository: { full_name: 'fork/repo' } });
  assert.equal(foreign.status, 0); assert.equal(foreign.stdout.trim(), '[]');
  const failedSource = execute({ ...parent, conclusion: 'failure' }, child);
  assert.equal(failedSource.status, 0); assert.equal(failedSource.stdout.trim(), '[]');
  const logged = readFileSync(calls, 'utf8');
  assert.doesNotMatch(logged, /"POST"|"PATCH"|"DELETE"|"workflow","run"/);
});

function pending(t) {
  return sealContinuation({ kind: 'merge', repo, issue: 856, branch: 'issue/856-loop', material: a,
    candidate: b, tree: c, dev: c, epoch: 'epoch-1', bodyDigest: issueBodyDigest(body), policy: 'merge-light',
    producerPath: '.github/workflows/process.yml' }, temp(t),
  { GITHUB_RUN_ID: '20', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: a, GITHUB_REF_NAME: 'main' }, new Date('2026-10-12T00:00:00Z'));
}
const current = () => ({ issue: { state: 'open', labels: ['S7-code-review'], body },
  request: { id: 'epoch-1', label: 'S7-code-review' }, latestProcess: 20, branch: b, dev: c, merged: false });
test('#856 completion authentication rejects foreign, stale, partial and expired producers', t => {
  const p = pending(t);
  const producer = { id: 20, run_attempt: 1, head_sha: a, head_branch: 'main', path: p.producer.path,
    repository: { full_name: repo }, head_repository: { full_name: repo }, event: 'issues',
    created_at: '2026-10-11T23:59:00Z', status: 'completed', conclusion: 'success' };
  const event = { repository: { full_name: repo }, head_repository: { full_name: repo }, head_sha: b,
    path: '.github/workflows/validate.yml', created_at: '2026-10-12T00:00:00Z', status: 'completed' };
  const now = Date.parse('2026-10-12T01:00:00Z');
  assert.equal(authenticatedContinuation(p, producer, event, repo, now), true);
  for (const delta of [{ run_attempt: 2 }, { conclusion: 'failure' }, { head_sha: c }, { path: '.github/workflows/evil.yml' },
    { head_repository: { full_name: 'fork/repo' } }]) assert.equal(authenticatedContinuation(p, { ...producer, ...delta }, event, repo, now), false);
  assert.equal(authenticatedContinuation(p, producer, { ...event, head_sha: c }, repo, now), false);
  assert.equal(authenticatedContinuation(p, producer, event, repo, now + 86400000), false);
});
test('#856 merge continuation does not apply a stale epoch/body/head/dev or replay', async t => {
  const p = pending(t);
  for (const alter of [s => { s.branch = a; }, s => { s.issue.body += 'new'; }, s => { s.request.id = 'new'; },
    s => { s.latestProcess = 21; }, s => s.issue.labels.push('blocked'), s => { s.issue.labels = ['S8-merged']; }]) {
    const s = current(); alter(s); assert.equal(mergeContinuationDecision(p, s).action, 'noop');
  }
  assert.equal(mergeContinuationDecision(p, { ...current(), dev: a }).action, 'return');
  let moved = [], merged = false;
  const result = await resumeMergeContinuation(p, { state: () => ({ ...current(), merged }),
    proof: () => ({ status: 'green' }), merge: () => { merged = true; return true; },
    move: (...v) => moved.push(v), comment: () => {} });
  assert.equal(result.to, 'S8-merged'); assert.deepEqual(moved, [['S7-code-review', 'S8-merged']]);
  const red = await resumeMergeContinuation(p, { state: current, proof: () => ({ status: 'missing' }),
    merge: () => assert.fail('incomplete proof merge'), move: (...v) => moved.push(v), comment: () => {} });
  assert.equal(red.to, 'S6-in-progress');
  let reads = 0;
  assert.equal((await resumeMergeContinuation(p, { state: () => { const s = current(); if (reads++) s.branch = a; return s; },
    proof: () => ({ status: 'green' }), merge: () => assert.fail('racing new tip'), move: () => assert.fail('racing label'), comment: () => {} })).action, 'noop');
});
test('#856 local groups compose every unit file and preserve producer-before-consumer', t => {
  const dir = temp(t); mkdirSync(join(dir, 'test'));
  writeFileSync(join(dir, 'test', 'pure.test.mjs'), 'export const x = 1;');
  writeFileSync(join(dir, 'test', 'product.test.mjs'), "import '../test-build/color.js';");
  const groups = unitGroups(dir);
  assert.deepEqual(groups.product, ['test/product.test.mjs']); assert.deepEqual(groups.tooling, ['test/pure.test.mjs']);
  assert.deepEqual([...groups.product, ...groups.tooling].sort(), groups.tests);
  assert.deepEqual(groupsAffectedBy(['unknown.mjs'], groups), ['product', 'tooling']);
  const workflow = readFileSync(new URL('.github/workflows/validate.yml', root), 'utf8');
  const frontend = workflow.slice(workflow.indexOf('\n  frontend:\n'), workflow.indexOf('\n  dev_build:\n'));
  assert.doesNotMatch(frontend, /run: npm run typecheck/);
  assert.match(frontend, /run: npm run build/); assert.match(frontend, /run: npm test/); assert.match(frontend, /run: npm run lint:unused/);
  const step = findStep(workflow, { name: 'Restore complete compatible frontend producer' });
  const r = runStep(step, step.run.replace(/\$\{\{ github.repository \}\}/g, repo), { cwd: new URL('..', import.meta.url),
    env: { ...process.env, ImageOS: '', ImageVersion: '' } });
  assert.equal(r.status, 0); assert.match(r.stdout, /"reused":false/);
});
