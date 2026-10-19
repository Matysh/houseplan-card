import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resume, resumeEvidence } from '../scripts/process-resume.mjs';
import { sha256 } from '../scripts/review-result-gate.mjs';
import { FINDINGS_FILE, findingsPolicy } from '../scripts/review-findings-policy.mjs';
import { issueBodyDigest } from '../scripts/review-doc-guard.mjs';
import { continuationFailure, diagnoseOnce, resumeMergeContinuation } from '../scripts/workflow-continuation.mjs';
import { realOps } from '../scripts/merge-candidate.mjs';
import { archivePlan, readInputs } from '../scripts/reviews-archive.mjs';
import { findStep, workflowSteps } from './helpers/workflow-step.mjs';

const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40);
const body = 'accepted issue', digest = issueBodyDigest(body), issue = 897, branch = 'issue/897-pipeline-outcomes';
const request = { id: 'epoch-1', label: 'S7-code-review', at: '2026-10-14T00:00:00Z' };
const run = { id: 70, attempt: 1, issue, stage: 'code', label: 'S7-code-review', status: 'completed',
  conclusion: 'success', createdAt: '2026-10-14T01:00:00Z' };
const p = { schema: 1, kind: 'merge', repo: 'o/r', issue, branch, epoch: request.id, bodyDigest: digest,
  material: a, candidate: b, tree: c, dev: c, policy: 'merge-light',
  producer: { run: 70, attempt: 1, sha: a, path: '.github/workflows/process.yml', branch: 'main' },
  createdAt: '2026-10-14T01:00:00Z', expiresAt: '2026-10-15T01:00:00Z' };
const prepared = { schema: 1, issue, run_id: 70, run_attempt: 1, stage: 'code', branch, cycle: 1,
  material_sha: a, material_tree: c, material_specs: '', material_issue_body: digest };
const token = 'ghs_' + 'Z'.repeat(36), credentials = `https://user:password@github.com/o/r ${token}`;
const temp = t => { const dir = mkdtempSync(join(tmpdir(), 'hp-897-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };

function sealedResult(over = {}, passport = prepared) {
  const bytes = { 'prepared.json': JSON.stringify(passport), 'verdict.json': JSON.stringify({ verdict: 'green', high: 0, medium: 0, summary: 'accepted' }),
    'review-document.md': '# Independent review', ...over };
  bytes['manifest.sha256'] = Object.entries(bytes).map(([name, text]) => `${sha256(text)}  ${name}`).join('\n');
  return { files: Object.keys(bytes), read: name => bytes[name], bytes };
}
const artifacts = ['review-result-897-70-1', 'review-prepared-897-70-1', 'workflow-continuation-70-1'].map(name => ({ name, expired: false }));
const evidence = (over = {}) => resumeEvidence({ repo: 'o/r', issue, run, artifacts,
  loadJson: (_artifact, file) => file === 'prepared.json' ? prepared : p, loadResult: () => sealedResult(), ...over });

test('#897 AC1 complete deferred model receipt is a successful noop, never a second review', async () => {
  let writes = 0;
  const result = await resume({ repo: 'o/r', branch, sha: b,
    validateRun: { id: 80, event: 'workflow_dispatch', status: 'completed', headSha: b },
    ops: { state: () => ({ labels: ['S7-code-review'], body, request, headSha: b }), runs: () => [run],
      pendingOf: () => evidence(), relabel: () => writes++ }, sleep: () => assert.fail('normal result must not enter delivery retry') });
  assert.equal(result.action, 'noop'); assert.match(result.reason, /merge continuation owns/);
  assert.equal(writes, 0); assert.equal(result.applied, false);
});

// #961: old #897 fixtures predated findings_policy_snapshot and never exercised
// the current identity boundary. Repository authority comes from the controller,
// not from an optional field in the downloaded prepared/result artifact.
const policyTarget = { repo: 'o/r', issue, stage: 'code', round: 1 };
function policyEvidence({ raw = '', target = policyTarget, policyOver = {}, preparedOver = {}, resultOver = {}, mergeOver = {}, tamper = () => {} } = {}) {
  const policy = { ...findingsPolicy(raw, target), ...policyOver };
  const passport = { ...prepared, findings_policy_snapshot: JSON.stringify(policy), ...preparedOver };
  const result = sealedResult({ ...(policy.mode === 'file' ? { [FINDINGS_FILE]: 'No outside findings.\n' } : {}), ...resultOver }, passport);
  tamper(result.bytes);
  result.files = Object.keys(result.bytes);
  return evidence({ loadJson: (_artifact, file) => file === 'prepared.json' ? passport : { ...p, ...mergeOver }, loadResult: () => result });
}

for (const raw of ['', `[${issue}]`]) test(`#961 sealed ${raw ? 'file' : 'issues'} policy result stays a verified noop for push and dispatch`, async () => {
  for (const event of ['push', 'workflow_dispatch']) {
    const result = await resume({ repo: 'o/r', branch, sha: b,
      validateRun: { id: 80, event, status: 'completed', headSha: b },
      ops: { state: () => ({ labels: ['S7-code-review'], body, request, headSha: b }), runs: () => [run],
        pendingOf: () => policyEvidence({ raw }), relabel: () => assert.fail('completed review must not relabel') },
      sleep: () => assert.fail('completed review must not retry') });
    assert.equal(result.action, 'noop'); assert.match(result.reason, /merge continuation owns/);
    assert.equal(result.applied, false);
  }
});

test('#961 trusted controller repo defeats foreign policy even with self-consistent resealed artifacts', () => {
  for (const over of [{ repo: 'foreign/repo' }, { issue: issue + 1 }, { stage: 'spec' }, { round: 2 }]) {
    assert.throws(() => policyEvidence({ target: { ...policyTarget, ...over }, preparedOver: { repo: 'foreign/repo' } }), /seal invalid.*identity/);
  }
  assert.equal(policyEvidence({ preparedOver: { repo: 'untrusted/claim' } }).completedModel, true,
    'an extra artifact field is not the repository authority');
  for (const policyOver of [{ path: '../../outside.md' }, { source: 'issue-body' }, { extra: true }]) {
    assert.throws(() => policyEvidence({ raw: `[${issue}]`, policyOver }), /seal invalid.*findings policy/);
  }
});

test('#961 current policy never bypasses result seal, companion or exact epoch/body/material guards', async () => {
  assert.throws(() => policyEvidence({ preparedOver: { findings_policy_snapshot: '{' } }), /seal invalid.*доверенная политика/);
  assert.throws(() => policyEvidence({ raw: `[${issue}]`, resultOver: { [FINDINGS_FILE]: '' } }), /seal invalid.*outside findings/);
  assert.throws(() => policyEvidence({ resultOver: { [FINDINGS_FILE]: 'unauthorized companion' } }), /seal invalid.*набор файлов/);
  assert.throws(() => policyEvidence({ resultOver: { 'prepared.json': JSON.stringify(prepared) } }), /seal invalid.*findings_policy_snapshot/);
  assert.throws(() => policyEvidence({ tamper: bytes => { bytes['manifest.sha256'] = 'corrupt seal'; } }), /seal invalid.*manifest/);
  assert.throws(() => policyEvidence({ raw: `[${issue}]`, tamper: bytes => { delete bytes[FINDINGS_FILE]; } }), /seal invalid.*набор файлов/);
  assert.throws(() => policyEvidence({ raw: `[${issue}]`, tamper: bytes => { bytes[FINDINGS_FILE] += 'tampered'; } }), /seal invalid.*контрольная сумма/);
  assert.throws(() => policyEvidence({ mergeOver: { material: c } }), /receipt identity differ/);
  for (const [mergeOver, reason] of [[{ epoch: 'another-epoch' }, /another epoch\/body\/material/],
    [{ bodyDigest: issueBodyDigest('changed body') }, /receipt identity differ/], [{ candidate: c }, /another epoch\/body\/material/]]) {
    await assert.rejects(resume({ repo: 'o/r', branch, sha: b,
      validateRun: { id: 80, event: 'push', status: 'completed', headSha: b },
      ops: { state: () => ({ labels: ['S7-code-review'], body, request, headSha: b }), runs: () => [run],
        pendingOf: () => policyEvidence({ mergeOver }), relabel: () => assert.fail('foreign continuation must not relabel') } }), reason);
  }
});

test('#897 AC1 corrupt/incomplete/foreign result never earns the completed-model noop', async () => {
  const corrupt = sealedResult(); corrupt.bytes['review-document.md'] += 'tampered';
  for (const over of [{ artifacts: artifacts.slice(0, 1) }, { artifacts: [...artifacts, artifacts[0]] },
    { loadResult: () => corrupt }, { loadResult: () => sealedResult({ 'prepared.json': JSON.stringify({ ...prepared, stage: 'spec' }) }) },
    { loadJson: (_artifact, file) => file === 'prepared.json' ? prepared : { ...p, material: c } },
    { loadJson: (_artifact, file) => file === 'prepared.json' ? prepared : { ...p, repo: 'foreign/repo' } }])
    assert.throws(() => evidence(over), /receipt|duplicate|seal|identity/);
  await assert.rejects(resume({ repo: 'o/r', branch, sha: b,
    validateRun: { id: 80, event: 'workflow_dispatch', status: 'completed', headSha: b },
    ops: { state: () => ({ labels: ['S7-code-review'], body, request, headSha: b }), runs: () => [run],
      pendingOf: () => ({ ...evidence(), continuation: { ...p, epoch: 'foreign' } }), relabel: () => assert.fail('foreign noop must not relabel') } }), /another epoch/);
});

for (const raw of [null, '', `[${issue}]`]) test(`#897/#961 actual resume CLI: ${raw === null ? 'legacy' : raw ? 'file' : 'issues'} policy exits zero only for verified receipts, no writes`, t => {
  if (process.platform === 'win32') { t.skip('POSIX Actions entrypoint'); return; }
  const dir = temp(t), bin = join(dir, 'bin'), fixture = join(dir, 'fixture.json'), calls = join(dir, 'calls');
  mkdirSync(bin);
  const policy = raw === null ? null : findingsPolicy(raw, policyTarget);
  const passport = { ...prepared, ...(policy ? { findings_policy_snapshot: JSON.stringify(policy) } : {}) };
  const companions = policy?.mode === 'file' ? { [FINDINGS_FILE]: 'No outside findings.\n' } : {};
  const result = sealedResult(companions, passport);
  const jsonArtifact = (name, file, value) => {
    const location = join(dir, name); mkdirSync(location, { recursive: true });
    const text = JSON.stringify(value); writeFileSync(join(location, file), text);
    writeFileSync(join(location, 'manifest.sha256'), `${sha256(text)}  ${file}\n`);
  };
  jsonArtifact(artifacts[1].name, 'prepared.json', passport);
  jsonArtifact(artifacts[2].name, 'pending.json', p);
  const resultDir = join(dir, artifacts[0].name); mkdirSync(resultDir);
  for (const [name, bytes] of Object.entries(result.bytes)) writeFileSync(join(resultDir, name), bytes);
  writeFileSync(fixture, JSON.stringify({ issue: { state: 'OPEN', labels: [{ name: 'S7-code-review' }], body },
    events: [{ id: request.id, event: 'labeled', label: { name: request.label }, created_at: request.at }],
    run: { id: 70, run_attempt: 1, status: 'completed', conclusion: 'success', event: 'issues',
      display_title: 'process #897 · S7-code-review', created_at: run.createdAt }, artifacts }));
  writeFileSync(join(bin, 'gh'), [
    '#!/usr/bin/env node', "const fs = require('node:fs'), path = require('node:path');",
    'const args=process.argv.slice(2), f=JSON.parse(fs.readFileSync(process.env.FAKE_FIXTURE));',
    'fs.appendFileSync(process.env.FAKE_CALLS,JSON.stringify(args)+"\\n");',
    'if(args[0]==="run"&&args[1]==="download"){fs.cpSync(path.join(process.env.FAKE_ARTIFACTS,args[args.indexOf("--name")+1]),args[args.indexOf("--dir")+1],{recursive:true});process.exit(0);}',
    'let value; const endpoint=args.find(a=>a.startsWith("repos/"))||"";',
    'if(args[0]==="issue"&&args[1]==="view")value=f.issue;',
    'else if(args[0]!=="api"||args.includes("--method"))process.exit(42);',
    'else if(endpoint.includes("/events?"))value=[f.events];',
    'else if(endpoint.includes("/git/ref/heads/"))value={object:{sha:"' + b + '"}};',
    'else if(endpoint.includes("/workflows/process.yml/runs?"))value={workflow_runs:[f.run]};',
    'else if(endpoint.includes("/actions/runs/70/artifacts?"))value={artifacts:f.artifacts};',
    'else process.exit(43); process.stdout.write(JSON.stringify(value));',
  ].join('\n'), { mode: 0o755 });
  const execute = () => spawnSync(process.execPath, ['scripts/process-resume.mjs', '--repo=o/r', `--branch=${branch}`,
    `--sha=${b}`, '--run-id=80', '--event=workflow_dispatch'], { encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_FIXTURE: fixture, FAKE_CALLS: calls, FAKE_ARTIFACTS: dir,
      GITHUB_OUTPUT: join(dir, 'output') } });
  const normal = execute(); assert.equal(normal.status, 0, normal.stderr); assert.match(normal.stdout, /action=noop/);
  assert.match(normal.stdout, /reason=completed sealed model review; merge continuation owns/);
  assert.match(normal.stdout, /applied=false/);
  writeFileSync(join(resultDir, 'review-document.md'), '# tampered after seal');
  const corrupt = execute(); assert.notEqual(corrupt.status, 0); assert.match(corrupt.stderr, /seal invalid/);
  if (policy) {
    const foreign = { ...passport, repo: 'foreign/repo', findings_policy_snapshot: JSON.stringify({ ...policy, repo: 'foreign/repo' }) };
    jsonArtifact(artifacts[1].name, 'prepared.json', foreign);
    const forged = sealedResult(companions, foreign);
    for (const [name, bytes] of Object.entries(forged.bytes)) writeFileSync(join(resultDir, name), bytes);
    const rejected = execute(); assert.notEqual(rejected.status, 0); assert.match(rejected.stderr, /seal invalid.*identity/);
  }
  assert.doesNotMatch(readFileSync(calls, 'utf8'), /"edit"|"comment"|"POST"|"PATCH"|"DELETE"|"workflow","run"/);
});

const state = () => ({ issue: { state: 'open', labels: ['S7-code-review'], body }, request,
  latestProcess: 70, branch: b, dev: c, merged: false });
test('#897 AC2 changed reviewed patch diagnoses once and re-reviews only the same current candidate', async () => {
  const comments = [], moves = [], calls = [];
  const error = Object.assign(Error(`reviewed patch changed ${credentials}`), { code: 'reviewed-patch-changed', stage: 'patch-identity' });
  const diagnose = failure => diagnoseOnce(p, failure, { page: () => comments, fresh: () => true,
    comment: text => comments.push({ body: text }) });
  const io = { state, proof: () => ({ status: 'green' }), merge: () => { calls.push('merge-check'); throw error; },
    move: (...v) => moves.push(v), comment: () => assert.fail('not merged'), diagnose,
    rereview: () => calls.push('canonical-rereview'), secrets: [token] };
  const result = await resumeMergeContinuation(p, io);
  assert.equal(result.action, 'rereview'); assert.equal(result.to, 'S7-code-review');
  assert.deepEqual(moves, []); assert.deepEqual(calls, ['merge-check', 'canonical-rereview']);
  await resumeMergeContinuation(p, io); assert.equal(comments.length, 1, 'idempotent source/attempt/reason marker');
  assert.match(comments[0].body, /patch-identity/); assert.match(comments[0].body, /attempt 1/);
  assert.ok(!JSON.stringify([result, comments]).includes(token)); assert.ok(!comments[0].body.includes('user:password'));
  for (const current of [{ ...state(), request: { ...request, id: 'new' } },
    { ...state(), issue: { ...state().issue, labels: ['S7-code-review', 'blocked'] } },
    { ...state(), issue: { ...state().issue, labels: ['S6-in-progress'] } },
    { ...state(), branch: a }, { ...state(), latestProcess: 71 }, { ...state(), issue: { ...state().issue, body: 'changed' } }]) {
    const untouched = await resumeMergeContinuation(p, { ...io, state: () => current,
      merge: () => assert.fail('stale merge'), diagnose: () => assert.fail('stale diagnosis'), rereview: () => assert.fail('stale rereview') });
    assert.equal(untouched.action, 'noop');
  }
  let reads = 0;
  const race = await resumeMergeContinuation(p, { ...io, state: () => ++reads <= 2 ? state() : { ...state(), branch: a },
    diagnose: () => assert.fail('context advanced during refusal') });
  assert.equal(race.action, 'noop');
  let advanced = false;
  const afterDiagnosis = await resumeMergeContinuation(p, { ...io,
    state: () => advanced ? { ...state(), issue: { ...state().issue, labels: ['S7-code-review', 'blocked'] } } : state(),
    diagnose: () => { advanced = true; }, rereview: () => assert.fail('owner stopped after diagnosis') });
  assert.equal(afterDiagnosis.action, 'unverified');
});

test('#897 AC2 material fetch failure stays unverified with precise step; unknown never authorizes rereview', async () => {
  const comments = [], calls = [];
  const result = await resumeMergeContinuation(p, { state, proof: () => ({ status: 'green' }),
    merge: () => { throw Object.assign(Error('git fetch unavailable'), { code: 'material-fetch-failed', stage: 'material-fetch' }); },
    diagnose: failure => comments.push(failure), rereview: () => calls.push('rereview'), move: () => calls.push('move') });
  assert.equal(result.action, 'unverified'); assert.equal(result.stage, 'material-fetch'); assert.equal(comments.length, 1);
  assert.deepEqual(calls, []);
  assert.equal(continuationFailure(Error('boom'), p, 'child-authentication').stage, 'child-authentication');
  assert.equal(continuationFailure(Object.assign(Error('boom'), { stage: credentials }), p, 'merge').stage, 'merge');
  assert.equal(continuationFailure(Error('boom'), { kind: token, candidate: credentials }).candidate, undefined);
  assert.throws(() => diagnoseOnce(p, result, { page: () => Array(100).fill({ body: 'other' }),
    fresh: () => true, comment: () => assert.fail('unknown marker absence') }), /bounded scan/);
});

test('#897 AC3 realOps port redacts stderr, stdout, injected exceptions and patch-id failures before callers', () => {
  for (const exec of [() => ({ status: 128, stderr: `fetch step ${credentials}`, stdout: '' }),
    () => ({ status: 128, stderr: '', stdout: `fetch step ${credentials}` }),
    () => { throw Error(`fetch step ${credentials}`); },
    () => ({ status: null, error: Error(`spawn step ${credentials}`), stderr: '', stdout: '' })]) {
    const ops = realOps({ repo: 'o/r', token, exec });
    assert.throws(() => ops.fetch(a), error => /step/.test(error.message) && !error.message.includes(token)
      && !error.message.includes('user:password') && error.message.length <= 1500);
  }
  const ops = realOps({ repo: 'o/r', token, exec: (_cmd, args) => args[0] === 'diff'
    ? { status: 0, stdout: '', stderr: '' } : { status: 1, stdout: '', stderr: `patch-id step ${credentials}` } });
  assert.throws(() => ops.patchId('HEAD', 'HEAD'), error => /patch-id step/.test(error.message)
    && !error.message.includes(token) && !error.message.includes('user:password'));
});

test('#897 AC4 real git chooses actual stable ancestry, never a similar filename; dry inputs do not write', t => {
  const cwd = temp(t);
  const git = (...args) => execFileSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@x', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' }).trim();
  git('init', '-q'); mkdirSync(join(cwd, 'docs/reviews'), { recursive: true });
  const write = (name, text) => writeFileSync(join(cwd, 'docs/reviews', name), text);
  const commit = message => { git('add', '.'); git('commit', '-qm', message); };
  write('INDEX.md', '# index'); commit('base'); git('branch', '-M', 'work'); git('tag', 'v1.79.0');
  const one = 'SHIP-REVIEW-v1.80.0-beta.1.md', seven = 'SHIP-REVIEW-v1.80.0-beta.7.md';
  git('tag', 'v1.80.0-beta.1'); write(one, 'first report'); commit('report one');
  git('tag', 'v1.80.0-beta.7'); write(seven, 'seventh report'); commit('report seven');
  git('tag', 'v1.80.1');
  const unknown = 'SHIP-REVIEW-v1.80.0-beta.999.md', future = 'SHIP-REVIEW-v1.81.0-beta.1.md';
  write(unknown, 'no tag'); write(future, 'open report'); commit('open docs'); git('tag', 'v1.81.0-beta.1');
  // A similar version tag on an unrelated branch proves nothing.
  git('checkout', '-q', '--orphan', 'unrelated'); git('rm', '-q', '-rf', '.');
  writeFileSync(join(cwd, 'unrelated'), 'x'); commit('unrelated'); git('tag', 'v1.80.0-beta.999'); git('checkout', '-q', 'work');
  const before = git('status', '--porcelain'), head = git('rev-parse', 'HEAD');
  const inputs = readInputs({ through: 'v1.80.1', cwd });
  const plan = archivePlan({ ...inputs, through: 'v1.80.1' });
  assert.deepEqual(plan.moves.map(m => [m.name, m.tag]), [[one, 'v1.80.1'], [seven, 'v1.80.1']]);
  assert.ok(plan.kept.some(m => m.name === unknown)); assert.ok(plan.kept.some(m => m.name === future));
  assert.equal(git('status', '--porcelain'), before); assert.equal(git('rev-parse', 'HEAD'), head);
  assert.equal(readFileSync(join(cwd, 'docs/reviews', one), 'utf8'), 'first report');
});

test('#897 AC5 workflow parse/bodies stay valid; terminal refusal uses the no-trigger token without widening permissions', () => {
  const source = readFileSync(new URL('../.github/workflows/_process.yml', import.meta.url), 'utf8');
  const terminal = findStep(source, { name: 'Перепроверить тело перед моделью (#855)' });
  assert.match(source.slice(source.indexOf(`      - name: "${terminal.name}"`), source.indexOf('      - name: "Закрепить', source.indexOf(terminal.name))), /GH_TOKEN: \$\{\{ github.token \}\}/);
  if (process.platform !== 'win32') for (const step of workflowSteps(source).filter(s => s.run)) {
    const parsed = spawnSync('bash', ['-n'], { input: step.run, encoding: 'utf8' });
    assert.equal(parsed.status, 0, `${step.name}: ${parsed.stderr}`);
  }
  // Runtime refusal effects are covered by #855 tests; this asserts its real
  // workflow call retains --return and no review-triggering S4/S7 writes.
  assert.match(terminal.run, /--return=true/); assert.doesNotMatch(terminal.run, /--to=S[47]-/);
});
