import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCandidate, candidateInputs, candidatePolicy, digest, NATIVE_PROFILES, intentionalDrift, ownerRecord, requiredProfiles } from '../scripts/candidate-readiness.mjs';
import { prepareCandidate, assertCandidateAcceptance } from '../scripts/release-prepare.mjs';
import { judgeNativeOutput, runCandidateNative, NATIVE_CHECK_FLOORS } from '../scripts/candidate-native.mjs';
import { diagnoseNight, diagnosticLines } from '../scripts/night-diagnostics.mjs';
import { issueBodyDigest, withMaterialAnchors } from '../scripts/review-doc-guard.mjs';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';
import { stableFieldDecisionRefusal } from '../scripts/stable-field-decision.mjs';
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
    issueFiles: { 1: ['src/wall-node-move.ts', 'src/live-interaction-runtime.ts'] }, issueMaterials: { 1: k },
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
  for (const mutate of [f => f.issue.body += 'changed', f => f.input.issueMaterials[1] = 'f'.repeat(64)]) {
    const n = fixture(); mutate(n); const next = n.build(); assert.notEqual(next.identity, first.identity); assert.equal(next.ready, false);
  }
  for (const mutate of [f => f.input.sha = b, f => f.input.tree = a, f => f.input.manifest = 'f'.repeat(64),
    f => f.input.pins.lock = 'f'.repeat(64)]) {
    const n = fixture(); mutate(n); const next = n.build(); assert.notEqual(next.identity, first.identity);
    assert.equal(next.receipts[0].refusal, 'optional field observation is incomplete or stale');
    assert.equal(next.ready, true, '#929: a stale optional human receipt does not block an otherwise valid candidate');
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
test('#929 optional observation never fabricates native or real-GPU proof and never blocks publication', () => {
  for (const mutate of [r => r.cases.pop(), r => r.cases[0].pass = false, r => r.cases[0].observed = '',
    r => r.environment.headless = true, r => r.environment.realGpu = false, r => delete r.gpuEvidence,
    r => r.native.sha = b, r => r.native.pins = {}, r => r.native.environment = {}, r => r.native.pass = false, r => r.native.cases.pop()]) {
    const f = fixture(); mutate(f.acceptance); f.issue.comments[1] = comment('candidate-acceptance', f.acceptance, 'Matysh', 2);
    const result = f.build();
    assert.equal(result.ready, true);
    assert.ok(result.receipts[0].refusal, 'invalid optional observation is not claimed as accepted evidence');
    assert.ok(result.warnings.some(w => w.includes('optional field observation')));
  }
  const f = fixture(); f.issue.comments[1].user.login = 'agent';
  assert.equal(f.build().ready, true);
  assert.equal(f.build().receipts[0].record, null, 'do not invent an authenticated owner observation');
});

test('#929 malformed optional JSON shapes cannot throw or block on any channel', () => {
  for (const version of ['1.82.0', '1.82.0-rc.1', '1.82.0-beta.1', undefined]) {
    for (const mutate of [r => r.cases = [null], r => r.cases = [42],
      r => r.cases[0].observed = 42, r => r.cases[0].evidence = 42,
      r => r.native.cases = [null], r => delete r.native.pins,
      r => r.environment.gpu = 42]) {
      const f = fixture();
      f.input.version = version;
      f.issue.comments.pop();
      f.acceptance.material = f.build().material;
      mutate(f.acceptance);
      f.issue.comments.push(comment('candidate-acceptance', f.acceptance, 'Matysh', 3));
      const result = f.build();
      assert.equal(result.ready, true, `${String(version)} malformed optional observation`);
      assert.ok(result.receipts[0].refusal, 'malformed JSON cannot become accepted field evidence');
      assert.ok(result.warnings.some(w => w.includes('optional field observation')));
    }
  }
});

test('#889 beta missing field/scene records are advisory, not a fabricated owner acceptance', () => {
  const f = fixture();
  f.input.version = '1.81.0-beta.2';
  f.issue.comments = [];
  const result = f.build();
  assert.equal(result.ready, true);
  assert.equal(result.publish, false);
  assert.deepEqual(result.policy, { channel: 'beta', scenePlanRequired: false, manualAcceptanceRequired: false });
  assert.deepEqual(result.scenes, { change: [], new: [] });
  assert.equal(result.cases.length, 4, 'retain ordinary/neighbour risk inventory');
  assert.equal(result.gpu, true, 'do not hide the GPU risk');
  assert.equal(result.receipts[0].record, null);
  assert.equal(result.receipts[0].refusal, null, '#929: no receipt is required');
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /no intentional pixel changes declared/);
  assert.equal(intentionalDrift([{ id: 'one', status: 'different' }, { id: 'two', status: 'passed' }],
    result.scenes, ['one', 'two']), false);
});

test('#929 all channels allow absent owner QA while strict scene plans remain required', () => {
  for (const version of ['1.81.0', '1.81.0-rc.1', '1.81.0-alpha.1',
    '1.81.0-rc-beta.1', '1.81.0-dev-beta.1', '1.81.0-alpha.beta.1',
    '1.81.0-beta.1+build', '1.81.0-beta.0', undefined]) {
    const f = fixture();
    f.input.version = version;
    f.issue.comments = [];
    const result = f.build();
    assert.equal(result.ready, false, String(version));
    assert.equal(result.policy.manualAcceptanceRequired, false);
    assert.equal(result.policy.scenePlanRequired, true);
    assert.ok(result.blockers.some(b => b.includes('owner-reviewed scene plan')));
    assert.ok(result.blockers.every(b => !b.includes('owner dev interactive acceptance')));
    f.issue.comments = [comment('candidate-plan', f.plan)];
    const ready = f.build();
    assert.equal(ready.ready, true, `${String(version)} with scene plan and no field receipt`);
    assert.equal(ready.publish, false);
    assert.equal(ready.receipts[0].record, null);
    assert.equal(ready.receipts[0].refusal, null);
    assert.deepEqual(ready.warnings, []);
    for (const status of ['failed', 'pending', 'cancelled', 'stale', 'missing']) {
      f.proof.status = status;
      assert.equal(f.build().ready, false, `${String(version)} full proof ${status}`);
    }
  }
  for (const version of ['not-a-version', '1.81.0-beta.02', '1.81.0-beta.2 extra'])
    assert.throws(() => candidatePolicy(version), /SemVer|leading zeroes/);
});

test('#889 beta still blocks every non-green full proof and invalid/revoked owner scene intent', () => {
  for (const status of ['failed', 'pending', 'cancelled', 'stale', 'missing']) {
    const f = fixture();
    f.input.version = '1.81.0-beta.2';
    f.issue.comments = [];
    f.proof.status = status;
    const result = f.build();
    assert.equal(result.ready, false, status);
    assert.ok(result.blockers.some(b => b.includes(`Validate is ${status}`)));
  }
  for (const mutate of [
    p => p.body = 'stale', p => p.issueMaterial = 'f'.repeat(64),
    p => p.change = ['unknown'], p => p.new = ['one'], p => p.schema = 0,
  ]) {
    const f = fixture();
    f.input.version = '1.81.0-beta.2';
    mutate(f.plan);
    f.issue.comments = [comment('candidate-plan', f.plan)];
    assert.equal(f.build().ready, false);
  }
  const f = fixture();
  f.input.version = '1.81.0-beta.2';
  f.issue.comments.push({ ...comment('candidate-plan', {}), body: '<!-- hp:candidate-plan\nnot-json\n-->' });
  assert.equal(f.build().ready, false);
});

test('#929 optional field QA preserves only explicit current owner vetoes, not malformed-record blockers', () => {
  for (const verdict of ['rejected', 'revoked']) {
    const f = fixture();
    f.input.version = '1.81.0-beta.2';
    f.issue.comments = [];
    const material = f.build().material;
    f.issue.comments.push(comment('candidate-acceptance', { schema: 1, material, verdict }, 'Matysh', 3));
    assert.equal(f.build().ready, false, verdict);
  }
  const f = fixture();
  f.input.version = '1.81.0-beta.2';
  f.issue.comments.push({ ...comment('candidate-acceptance', {}),
    body: '<!-- hp:candidate-acceptance\nnot-json\n-->' });
  assert.equal(f.build().ready, true);
  assert.equal(f.build().receipts[0].record.invalid, 'invalid owner JSON');
  assert.ok(f.build().warnings.some(w => w.includes('optional field observation')));
  for (const version of ['1.82.0', '1.82.0-rc.1', '1.82.0-beta.1', undefined]) {
    for (const verdict of ['rejected', 'revoked']) {
      const current = fixture(); current.input.version = version;
      const material = current.build().material;
      current.issue.comments.push(comment('candidate-acceptance', { schema: 1, material, verdict }, 'Matysh', 3));
      assert.equal(current.build().ready, false, `${String(version)} ${verdict}`);
      assert.ok(current.build().blockers.some(b => b.includes(`explicit owner ${verdict}`)));
      current.issue.comments.at(-1).user.login = 'intruder';
      assert.equal(current.build().ready, true, 'foreign actor cannot veto');
      current.issue.comments.at(-1).user.login = 'Matysh';
      current.issue.comments.at(-1).body = comment('candidate-acceptance', { schema: 1, material: 'stale', verdict }).body;
      assert.equal(current.build().ready, true, 'a different material does not veto this candidate');
      current.issue.comments.at(-1).body = comment('candidate-acceptance', { schema: 1, material, verdict }).body;
      current.issue.comments.push({ ...comment('candidate-acceptance', {}), body: '<!-- hp:candidate-acceptance\nnot-json\n-->' });
      assert.equal(current.build().ready, false, 'malformed optional observation cannot erase an explicit veto');
      current.issue.comments.push(comment('candidate-acceptance', { schema: 1, material, verdict: 'accepted' }, 'intruder', 5));
      assert.equal(current.build().ready, false, 'foreign acceptance cannot lift the owner veto');
      current.issue.comments.at(-1).user.login = 'Matysh';
      assert.equal(current.build().ready, true, 'new explicit owner decision lifts its own veto without GPU proof');
    }
  }
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
  const stdout = 'HP_SMOKE_CHECKS ' + JSON.stringify(NATIVE_CHECK_FLOORS[script]) + '\nOK\n';
  assert.equal(judgeNativeOutput(script, { status: 0, stdout }).pass, true);
  for (const bad of [{ status: 0, stdout: 'OK\n' }, { status: 1, stdout }, { status: null, stdout }, { status: 0, stdout, error: Error('timeout') }])
    assert.equal(judgeNativeOutput(script, bad).pass, false);
  const view = 'demo/smoke_live_pan_coverage.mjs';
  assert.equal(judgeNativeOutput(view, { status: 0, stdout: `HP_SMOKE_CHECKS ${JSON.stringify(NATIVE_CHECK_FLOORS[view])}\nOK\n` }).pass, true);
  assert.equal(judgeNativeOutput(view, { status: 0, stdout: 'HP_SMOKE_CHECKS ["flatMouseRightEdgeHeldCoverageButNotActually"]\nOK\n' }).pass, false);
  const f = fixture(); const calls = [];
  const report = await runCandidateNative({ input: f.input, profiles: ['geometry'], attest: async () => ({ actual: { version: 'pinned' } }),
    execute: (_node, args, opts) => { calls.push({ args, opts }); return { status: 0, stdout: args[1].includes('topology') ? '{"scenarios":7,"cycles":100}\nOK\n' : stdout }; } });
  assert.equal(report.pass, true); assert.equal(report.ownerAcceptance, false); assert.equal(calls.length, 2);
  assert.ok(calls.every(c => c.args[0] === 'scripts/candidate-native.mjs' && c.opts.timeout === 180000));
});

test('#861 gesture candidates require their exact ordinary and held-preview native floors', () => {
  for (const file of ['src/physical-body-gesture.ts', 'src/backdrop-frame-gesture.ts', 'src/live-editor.ts',
    'src/canvas-surface-gestures.ts', 'src/wall-thickness-dialog-gesture.ts', 'src/wall-thickness-selection.ts'])
    assert.ok(requiredProfiles({ category: 'stable-fix' }, [file]).includes('editor'));
  assert.deepEqual(requiredProfiles({ category: 'infra' }, ['src/physical-body-gesture.ts']), []);
  assert.equal(NATIVE_PROFILES.editor.length, 5);
  for (const item of NATIVE_PROFILES.editor) {
    const checks = NATIVE_CHECK_FLOORS[item.script];
    const output = names => ({ status: 0, stdout: `HP_SMOKE_CHECKS ${JSON.stringify(names)}\nOK\n` });
    assert.equal(judgeNativeOutput(item.script, output(checks)).pass, true);
    for (let i = 0; i < checks.length; i++)
      assert.equal(judgeNativeOutput(item.script, output(checks.filter((_, index) => index !== i))).pass, false);
  }
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
    const step = findStep(yaml, { name: 'Candidate scene intent and automatic proofs are current' });
    assert.match(yaml.slice(yaml.indexOf('      - name: Candidate scene intent')), /if: steps.readiness.outputs.proceed == 'true'/);
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
  // A candidate must work from the one committed snapshot, with no local dist.
  put('.gitignore', '/dist\n');
  cpSync(join(root, 'custom_components/houseplan/frontend'), join(dir, 'custom_components/houseplan/frontend'), { recursive: true });
  for (const p of ['package.json','package-lock.json','.nvmrc','.python-version','tests_backend/requirements.txt','.github/workflows/validate.yml','demo/golden/matrix.mjs',
    ...new Set(Object.values(NATIVE_PROFILES).flat().map(c => c.script))]) put(p, readFileSync(join(root,p)));
  put('src/dummy.ts','export const a = 1;');
  put('docs/release-ledger/cycle.json', JSON.stringify({ schema: 1, baseStable: 'v1.80.1', targetStable: 'v1.81.0', milestone: { number: 1, title: '1.81' } }));
  const sync = () => { const m = JSON.parse(readFileSync(join(dir,'custom_components/houseplan/frontend/houseplan-assets.json'))); m.fingerprint = sourceFingerprint(dir);
    put('custom_components/houseplan/frontend/houseplan-assets.json', JSON.stringify(m)); };
  sync(); git(dir,'add','.'); git(dir,'commit','-qm','base'); git(dir,'tag','v1.80.1');
  // #903: an unrelated accepted SPEC must stay traceable without becoming a
  // release implementation or requiring a premature agent classification.
  put('docs/reviews/SPEC-REVIEW-2-r1.md', withMaterialAnchors('# SPEC-REVIEW-2-r1\n', {
    sha: git(dir, 'rev-parse', 'HEAD'), tree: git(dir, 'rev-parse', 'HEAD^{tree}'),
    issueBody: issueBodyDigest('accepted specification'), verdict: 'green', high: 0,
  }));
  put('docs/reviews/INDEX.md', 'SPEC-REVIEW-2-r1.md\n');
  git(dir, 'add', '.');
  git(dir, '-c', 'user.name=claude[bot]', '-c', 'user.email=209825114+claude[bot]@users.noreply.github.com',
    'commit', '--author=claude[bot] <209825114+claude[bot]@users.noreply.github.com>', '-qm',
    'docs: review document for #2\n\nIssue: #2\nUser-Visible: no\nDelivery-Phase: spec-review/v1');
  git(dir,'switch','-qc','side'); put('src/wall-node-new.ts','export const b = 2;');
  put('docs/release-ledger/v1.80.1/1.json',JSON.stringify({ schema: 1, issue: 1, baseStable: 'v1.80.1', category: 'infra', rationale: 'fixture' }));
  sync(); git(dir,'add','.'); git(dir,'commit','-qm','task\n\nIssue: #1\nUser-Visible: no'); git(dir,'switch','-q','dev');
  git(dir,'merge','--no-ff','side','-m','integrate\n\nIssue: #1\nUser-Visible: no');
  const inputs = candidateInputs({ root: dir }); assert.ok(inputs.issueFiles[1].includes('src/wall-node-new.ts'));
  assert.deepEqual(inputs.catalogue.entries.map(e => e.issue), [1]);
  assert.equal(inputs.catalogue.specDeliveries[0].issue, 2);
  assert.equal(inputs.issueFiles[2], undefined);
  assert.equal(buildCandidate({ input: inputs, issues: [{ number: 1, body: 'infra', labels: [], comments: [] }],
    proof: { status: 'green' }, owner: 'Matysh' }).ready, true);
  assert.equal(inputs.sha, git(dir,'rev-parse','HEAD')); assert.equal(inputs.manifest.length,64);
  assert.equal(inputs.version, JSON.parse(git(dir, 'show', 'HEAD:package.json')).version,
    '#889: publication policy is bound to the Git version, not an environment override');
  put('houseplan.zip','generated');
  assert.throws(() => candidateInputs({ root: dir }), /clean exact-candidate/);
  assert.deepEqual(candidateInputs({ root: dir, publicationCheck: true }), inputs);
  put('src/untracked.ts','unsafe');
  assert.throws(() => candidateInputs({ root: dir, publicationCheck: true }), /clean exact-candidate/);
  rmSync(join(dir,'src/untracked.ts')); rmSync(join(dir,'houseplan.zip'));
  put('dist/houseplan-card.js','corrupt');
  assert.deepEqual(candidateInputs({ root: dir }), inputs, 'ignored local output cannot replace the committed candidate');
  put('custom_components/houseplan/frontend/houseplan-card.js','corrupt');
  assert.throws(() => candidateInputs({ root: dir }), /clean exact-candidate/);
});

// #916: candidate policy consumes the explicit owner decision without
// manufacturing any per-issue field/native/GPU observation.
{
const tag = 'v1.81.0', beta = `${tag}-beta.4`, version = tag.slice(1), testedSha = 'c'.repeat(40);
const decision = { schema: 1, tag, testedTag: beta, testedSha, issue: 916, productEquivalent: true };
const acceptance = { schema: 1, tag, testedTag: beta, testedSha, owner: 'Matysh', verdict: 'accepted',
  source: 'owner-chat', recordedBy: 'agent', acceptance: 'stand-passed',
  linkedPerIssueRecords: 'waived-for-this-promotion', statements: ['Owner says the stand acceptance passed; their message is sufficient.'] };
const ownerComment = (value, login = 'Matysh', marker = 'stable-field-decision') => ({ id: 1, user: { login },
  html_url: 'https://github.com/Matysh/houseplan-card/issues/916#issuecomment-1',
  body: `<!-- hp:${marker}\n${JSON.stringify(value)}\n-->` });

function candidateFixture() {
  const input = { sha: 'a'.repeat(40), tree: 'b'.repeat(40), version, manifest: 'd'.repeat(64), pins: {}, scripts: {},
    catalogue: { entries: [{ issue: 1, category: 'major' }, { issue: 916, category: 'infra' }] },
    issueFiles: { 1: ['src/wall-node-move.ts'], 916: ['scripts/release-ledger.mjs'] }, issueMaterials: { 1: 'e'.repeat(64) },
    fieldDecision: structuredClone(decision) };
  const issues = [{ number: 1, body: 'implemented', state: 'closed', labels: ['ci:golden'], comments: [] },
    { number: 916, body: 'owner promotion decision', labels: [], comments: [ownerComment(acceptance)] }];
  const proof = { status: 'green' };
  return { input, issues, proof, build: () => buildCandidate({ input, issues, proof, owner: 'Matysh', sceneIds: ['one'] }) };
}

test('#916 explicit owner chat promotion preserves missing-record truth, strict default and automatic proof', () => {
  const f = candidateFixture(); const value = f.build();
  assert.equal(value.ready, true); assert.equal(value.publish, false);
  assert.equal(value.policy.channel, 'strict'); assert.equal(value.policy.fieldAcceptance, 'owner-confirmed-prerelease-promotion');
  assert.equal(value.receipts[0].record, null, 'never fabricate per-issue/native/GPU records');
  assert.equal(value.receipts[0].refusal, null); assert.equal(value.gpu, true);
  assert.deepEqual(value.scenes, { change: [], new: [] });
  assert.match(value.warnings[0], /No native\/GPU observation is fabricated/);
  delete f.input.fieldDecision;
  assert.equal(f.build().ready, false, 'stable without the historical scene-plan waiver still needs scene intent');
  f.issues[0].comments.push(comment('candidate-plan', { schema: 1, issue: 1,
    body: issueBodyDigest(f.issues[0].body), issueMaterial: f.input.issueMaterials[1],
    change: [], new: [], reason: 'No intentional scene changes' }));
  assert.equal(f.build().ready, true, '#929: normal stable path needs no field decision or manual QA receipt');
  f.issues[0].comments = [];
  f.input.fieldDecision = structuredClone(decision);
  for (const status of ['failed', 'pending', 'stale', 'missing', 'cancelled']) {
    f.proof.status = status; assert.equal(f.build().ready, false, status);
  }
});

test('#916 changed promotion, foreign/malformed/revoked latest decision and owner veto never revive an older approval', () => {
  for (const mutate of [
    f => f.input.version = '1.81.1', f => f.input.fieldDecision.productEquivalent = false,
    f => f.input.fieldDecision.testedSha = 'e'.repeat(40),
    f => f.issues[1].comments[0].user.login = 'intruder',
    f => f.issues[1].comments.push(ownerComment({ ...acceptance, verdict: 'revoked' })),
    f => f.issues[1].comments.push({ ...ownerComment(acceptance), body: '<!-- hp:stable-field-decision\nnot-json\n-->' }),
    f => f.issues[0].comments.push({ ...ownerComment({}, 'Matysh', 'candidate-plan'), body: '<!-- hp:candidate-plan\nnot-json\n-->' }),
  ]) {
    const f = candidateFixture(); mutate(f); assert.equal(f.build().ready, false);
  }
  const f = candidateFixture();
  f.issues[0].comments.push(ownerComment({ schema: 1, material: f.build().material, verdict: 'rejected' }, 'Matysh', 'candidate-acceptance'));
  assert.equal(f.build().ready, false);
  assert.ok(stableFieldDecisionRefusal(decision, { ...acceptance, statements: [] }, { version, owner: 'Matysh' }));
});

test('#916 prepare independently checks the approved beta is publicly published at the exact SHA', async () => {
  const f = candidateFixture(); const calls = [];
  const published = { tag_name: beta, prerelease: true, draft: false, published_at: '2026-10-15T21:29:36Z' };
  const request = path => {
    calls.push(path);
    if (path.includes('/releases/tags/')) return published;
    if (path.includes('/commits/')) return { sha: testedSha };
    const issue = f.issues.find(item => path.includes(`/issues/${item.number}`));
    return path.includes('/comments?') ? issue.comments : issue;
  };
  const options = { repo: 'Matysh/houseplan-card', input: f.input, token: 'fixture', request, probe: async () => f.proof };
  assert.equal((await prepareCandidate(options)).ready, true);
  assert.ok(calls.some(path => path.endsWith(`/commits/${beta}`)));
  for (const mutate of [() => published.draft = true, () => published.prerelease = false,
    () => published.tag_name = 'v1.81.0-beta.3', () => published.published_at = null]) {
    Object.assign(published, { tag_name: beta, prerelease: true, draft: false, published_at: '2026-10-15T21:29:36Z' });
    mutate(); await assert.rejects(prepareCandidate(options), /not published at the approved exact SHA/);
  }
  Object.assign(published, { tag_name: beta, prerelease: true, draft: false, published_at: '2026-10-15T21:29:36Z' });
  await assert.rejects(prepareCandidate({ ...options,
    request: path => path.includes('/commits/') ? { sha: 'f'.repeat(40) } : request(path) }), /approved exact SHA/);
});
}
