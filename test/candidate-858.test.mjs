import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCandidate, candidateInputs, digest, NATIVE_PROFILES, intentionalDrift, ownerRecord } from '../scripts/candidate-readiness.mjs';
import { prepareCandidate, assertCandidateAcceptance } from '../scripts/release-prepare.mjs';
import { judgeNativeOutput, runCandidateNative } from '../scripts/candidate-native.mjs';
import { diagnoseNight, diagnosticLines } from '../scripts/night-diagnostics.mjs';
import { issueBodyDigest } from '../scripts/review-doc-guard.mjs';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';
import { findStep, runStep } from './helpers/workflow-step.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const a = 'a'.repeat(40), b = 'b'.repeat(40), k = 'e'.repeat(64);
const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'test@test', GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'test@test' };
const temp = t => { const p = mkdtempSync(join(tmpdir(), 'hp-858-')); t.after(() => rmSync(p, { recursive: true, force: true })); return p; };
const git = (p, ...args) => execFileSync('git', args, { cwd: p, env, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
const comment = (marker, record, login = 'Matysh', id = 1) => ({ user: { login }, id,
  html_url: `https://github.com/o/r/issues/1#issuecomment-${id}`, body: `<!-- hp:${marker}\n${JSON.stringify(record)}\n-->` });
function fixture(category = 'major') {
  const input = { sha: a, tree: b, manifest: k, pins: { lock: k },
    catalogue: { entries: [{ issue: 1, category, commits: [a] }] },
    issueFiles: { 1: ['src/wall-node-move.ts', 'src/houseplan-card.ts'] }, issueMaterials: { 1: k },
    scripts: Object.fromEntries(Object.values(NATIVE_PROFILES).flat().map(c => [c.script, k])) };
  const issue = { number: 1, body: 'spec', state: 'open', labels: ['S8-merged', 'ci:golden'], comments: [] };
  const plan = { schema: 1, issue: 1, body: issueBodyDigest(issue.body), issueMaterial: k, change: ['one'], new: [], reason: 'reviewed intended change' };
  issue.comments.push(comment('candidate-plan', plan));
  const proof = { status: 'green', url: 'https://github.com/o/r/actions/runs/11', note: 'full exact proof' };
  const build = () => buildCandidate({ input, issues: [issue], proof, owner: 'Matysh', sceneIds: ['one','two'] });
  const pending = build();
  const acceptance = { schema: 1, material: pending.material, verdict: 'accepted', surface: 'dev',
    environment: { browser: 'Firefox 155', os: 'Windows', realGpu: true, gpu: 'owner GPU', headless: false },
    gpuEvidence: 'https://github.com/o/r/issues/1#field-video',
    native: { pass: true, sha: a, tree: b, bundle: k, pins: input.pins,
      environment: { node: '22.23.2', browser: { version: '151.0.7922.34' } } },
    cases: pending.cases.map(c => ({ ...c, scriptHash: k, nativeOutput: k, pass: true,
      observed: c.oracle, evidence: proof.url })) };
  acceptance.native.cases = structuredClone(acceptance.cases);
  issue.comments.push(comment('candidate-acceptance', acceptance, 'Matysh', 2));
  return { input, issue, plan, proof, acceptance, build };
}
test('#858 candidate identity is deterministic; exact material/body/pins/proof invalidate', () => {
  const f = fixture(); const first = f.build();
  assert.equal(first.ready, true); assert.equal(first.publish, false);
  assert.deepEqual(f.build(), first);
  for (const mutate of [f => f.input.sha = b, f => f.input.tree = a, f => f.input.manifest = 'f'.repeat(64),
    f => f.input.pins.lock = 'f'.repeat(64), f => f.issue.body += 'changed', f => f.input.issueMaterials[1] = 'f'.repeat(64)]) {
    const n = fixture(); mutate(n); const next = n.build(); assert.notEqual(next.identity, first.identity); assert.equal(next.ready, false);
  }
  f.proof.status = 'pending'; assert.equal(f.build().ready, false);
  for (const status of ['failed','stale','cancelled','missing']) { f.proof.status = status; assert.equal(f.build().ready, false); }
});
test('#858 owner scene intent is authenticated, reviewed and scoped; unrelated drift never accepted', () => {
  const f = fixture();
  assert.equal(intentionalDrift([{ id: 'one', status: 'different' }, { id: 'two', status: 'passed' }], f.build().scenes, ['one','two']), true);
  assert.equal(intentionalDrift([{ id: 'one', status: 'different' }, { id: 'two', status: 'different' }], f.build().scenes, ['one','two']), false);
  assert.equal(intentionalDrift([{ id: 'one', status: 'different' }], f.build().scenes, ['one','two']), false);
  assert.equal(intentionalDrift([{ id: 'one', status: 'timeout' }], f.build().scenes), false);
  for (const change of [f => f.issue.comments[0].user.login = 'intruder', f => f.issue.labels = ['ci:golden'],
    f => f.issue.comments[0] = comment('candidate-plan', { ...f.plan, new: ['one'] }),
    f => f.issue.comments[0] = comment('candidate-plan', { ...f.plan, change: ['unknown'] })]) {
    const n = fixture(); change(n); assert.equal(n.build().ready, false);
  }
  assert.equal(ownerRecord([comment('candidate-plan', { owner: 'Matysh' }, 'intruder')], 'candidate-plan', 'Matysh'), null);
  f.issue.comments.push({ ...comment('candidate-plan', {}), body: '<!-- hp:candidate-plan\nnot-json\n-->' });
  assert.equal(f.build().ready, false, 'new malformed owner record does not revive older approval');
});
test('#858 interactive floor needs native ordinary+neighbour and independent owner real-GPU receipt', () => {
  for (const mutate of [r => r.cases.pop(), r => r.cases[0].pass = false, r => r.cases[0].observed = '',
    r => r.environment.headless = true, r => r.environment.realGpu = false, r => delete r.gpuEvidence,
    r => r.native.sha = b, r => r.native.pins = {}, r => r.native.environment = {}, r => r.native.pass = false, r => r.native.cases.pop()]) {
    const f = fixture(); mutate(f.acceptance); f.issue.comments[1] = comment('candidate-acceptance', f.acceptance, 'Matysh', 2);
    assert.equal(f.build().ready, false);
  }
  const f = fixture(); f.issue.comments[1].user.login = 'agent'; assert.equal(f.build().ready, false);
});
test('#858 prepare only performs GETs, calls existing full proof, never dispatches/publishes', async () => {
  const f = fixture('infra'); f.issue.labels = []; f.issue.comments = [];
  const requests = [];
  const request = path => { requests.push(path); return path.includes('/comments?') ? [] : f.issue; };
  const opts = { repo: 'Matysh/houseplan-card', input: f.input, token: 'fixture-token', request,
    probe: async args => { assert.equal(args.sha, a); assert.equal(args.tree, b); return f.proof; } };
  const one = await prepareCandidate(opts); const two = await prepareCandidate(opts);
  assert.deepEqual(one, two); assert.equal(one.ready, true); assert.equal(one.publish, false);
  assert.ok(requests.every(p => /\/issues\/1(?:\/comments\?.*)?$/.test(p)));
  f.proof.status = 'failed'; await assert.rejects(assertCandidateAcceptance(opts), /not ready.*\nfull exact-SHA Validate is failed/);
  await assert.rejects(prepareCandidate({ ...opts, request: p => p.includes('comments') ? Array(100).fill({}) : f.issue }), /more than 1000/);
});
test('#858 native receipt refuses exit0 without real observed floor, timeout and partial output', async () => {
  const script = NATIVE_PROFILES.geometry[0].script;
  const stdout = 'HP_SMOKE_CHECKS ' + JSON.stringify(['committed geometry equals the visible preview', 'Undo restores exact starting catalogue/openings']) + '\nOK\n';
  assert.equal(judgeNativeOutput(script, { status: 0, stdout }).pass, true);
  for (const bad of [{ status: 0, stdout: 'OK\n' }, { status: 1, stdout }, { status: null, stdout }, { status: 0, stdout, error: Error('timeout') }])
    assert.equal(judgeNativeOutput(script, bad).pass, false);
  const f = fixture(); const calls = [];
  const report = await runCandidateNative({ input: f.input, profiles: ['geometry'], attest: async () => ({ actual: { version: 'pinned' } }),
    execute: (_node, args, opts) => { calls.push({ args, opts }); return { status: 0, stdout: args[1].includes('topology') ? '{"scenarios":7,"cycles":100}\nOK\n' : stdout }; } });
  assert.equal(report.pass, true); assert.equal(report.ownerAcceptance, false); assert.equal(calls.length, 2);
  assert.ok(calls.every(c => c.args[0] === 'scripts/candidate-native.mjs' && c.opts.timeout === 180000));
});
test('#858 red categories use exact complete attempt/environment evidence, never declare a gate PASS', () => {
  const run = { id: 10, run_attempt: 2, head_sha: a, status: 'completed', conclusion: 'failure', html_url: 'https://github.com/o/r/actions/runs/10' };
  const jobs = [{ name: 'Frontend', conclusion: 'failure', html_url: run.html_url + '/job/3',
    steps: [{ number: 7, name: 'Unit tests', conclusion: 'failure' }] }];
  const base = { complete: true, run: 10, attempt: 2, sha: a, environmentKey: k };
  const check = evidence => diagnoseNight({ run, jobs, evidence, sceneIds: ['one','two'] });
  assert.equal(check(null).category, 'unknown');
  assert.match(diagnosticLines(check(null)).join('\n'), /Unit tests.*#step:7:1/);
  for (const kind of ['environment','harness']) assert.equal(check({ ...base, kind, observedFailure: 'exact install/harness failure' }).category, kind);
  assert.equal(check({ ...base, kind: 'product-assertion', oracle: 'one toggle', observedFailure: 'two calls' }).category, 'product-regression');
  const golden = { ...base, kind: 'golden', reviewed: true, scenes: { change: ['one'], new: [] }, results: [{ id: 'one', status: 'different' }, { id: 'two', status: 'passed' }] };
  assert.equal(check(golden).category, 'intentional-drift');
  assert.equal(check({ ...golden, results: [{ id: 'two', status: 'different' }] }).category, 'unknown');
  const retry = { ...base, kind: 'retry', full: true, retries: 1, previous: { complete: true, full: true, sha: a, environmentKey: k, status: 'completed', conclusion: 'success' } };
  assert.equal(check(retry).category, 'bounded-flaky-evidence'); assert.equal(check(retry).gateOutcome, 'not-green');
  for (const bad of [{ attempt: 1 }, { sha: b }, { complete: false }, { full: false }, { retries: 2 }, { previous: { ...retry.previous, environmentKey: 'other' } },
    { previous: { ...retry.previous, conclusion: 'timed_out' } }, { previous: { ...retry.previous, complete: false } }])
    assert.equal(check({ ...retry, ...bad }).category, 'unknown');
});
test('#858 actual publisher workflow steps refuse an unprepared candidate before public work', t => {
  const dir = temp(t); git(dir, 'init', '-q', '-b', 'dev'); writeFileSync(join(dir, 'README.md'), 'fixture');
  git(dir, 'add', '.'); git(dir, 'commit', '-qm', 'base'); symlinkSync(join(root, 'scripts'), join(dir, 'scripts'));
  const before = git(dir, 'status', '--porcelain');
  for (const workflow of ['release.yml', 'publish-prerelease.yml']) {
    const yaml = readFileSync(join(root, '.github/workflows', workflow), 'utf8');
    const step = findStep(yaml, { name: 'Candidate scenes and owner native/GPU acceptance are current' });
    assert.match(yaml.slice(yaml.indexOf('      - name: Candidate scenes')), /if: steps.readiness.outputs.proceed == 'true'/);
    const result = runStep(step, step.run, { cwd: dir, env: { ...env, SHA: git(dir, 'rev-parse', 'HEAD'), GITHUB_REPOSITORY: 'Matysh/houseplan-card' } });
    assert.notEqual(result.status, 0); assert.match(result.stderr + result.stdout, /clean exact-candidate checkout|release-ledger/);
  }
  assert.equal(git(dir, 'status', '--porcelain'), before); assert.equal(git(dir, 'tag'), '');
  const publisher = readFileSync(join(root, 'scripts/release-prerelease.mjs'), 'utf8');
  assert.ok(publisher.indexOf('await assertCandidateAcceptance') < publisher.indexOf('if (checkOnly) return'));
});
test('#858 candidate inspects actual first-parent merge delta and committed bundle, not issue title', t => {
  const dir = temp(t); const put = (p, v) => { mkdirSync(join(dir, p, '..'), { recursive: true }); writeFileSync(join(dir, p), v); };
  git(dir, 'init', '-q', '-b', 'dev');
  for (const tree of ['dist','custom_components/houseplan/frontend']) cpSync(join(root, tree), join(dir, tree), { recursive: true });
  for (const p of ['package.json','package-lock.json','.nvmrc','.python-version','tests_backend/requirements.txt','.github/workflows/validate.yml','demo/golden/matrix.mjs',
    ...new Set(Object.values(NATIVE_PROFILES).flat().map(c => c.script))]) put(p, readFileSync(join(root,p)));
  put('src/dummy.ts','export const a = 1;');
  put('docs/release-ledger/cycle.json', JSON.stringify({ schema: 1, baseStable: 'v1.80.1', targetStable: 'v1.81.0', milestone: { number: 1, title: '1.81' } }));
  const sync = () => { const m = JSON.parse(readFileSync(join(dir,'dist/houseplan-assets.json'))); m.fingerprint = sourceFingerprint(dir);
    for (const tree of ['dist','custom_components/houseplan/frontend']) put(`${tree}/houseplan-assets.json`, JSON.stringify(m)); };
  sync(); git(dir,'add','.'); git(dir,'commit','-qm','base'); git(dir,'tag','v1.80.1');
  git(dir,'switch','-qc','side'); put('src/wall-node-new.ts','export const b = 2;');
  put('docs/release-ledger/v1.80.1/1.json',JSON.stringify({ schema: 1, issue: 1, baseStable: 'v1.80.1', category: 'infra', rationale: 'fixture' }));
  sync(); git(dir,'add','.'); git(dir,'commit','-qm','task\n\nIssue: #1\nUser-Visible: no'); git(dir,'switch','-q','dev');
  git(dir,'merge','--no-ff','side','-m','integrate\n\nIssue: #1\nUser-Visible: no');
  const inputs = candidateInputs({ root: dir }); assert.ok(inputs.issueFiles[1].includes('src/wall-node-new.ts'));
  assert.equal(inputs.sha, git(dir,'rev-parse','HEAD')); assert.equal(inputs.manifest.length,64);
  put('dist/houseplan-card.js','corrupt'); assert.throws(() => candidateInputs({ root: dir }), /clean exact-candidate/);
});
