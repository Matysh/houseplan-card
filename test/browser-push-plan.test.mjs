import test from 'node:test';
import assert from 'node:assert/strict';
import { browserPushPlan, browserPlanExecution, goldenConnections } from '../scripts/browser-push-plan.mjs';
import { taskCiPlan, readTaskDemand } from '../scripts/task-ci-plan.mjs';
import { validateSelectedPlan, selectedGoldenPassed, runSelected } from '../scripts/browser-selected.mjs';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { buildCiProof, evaluateCiProof, CI_PROOF_POLICIES, JOB_RULES, UNCONSUMED_JOBS } from '../scripts/ci-proof.mjs';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findStep, runStep } from './helpers/workflow-step.mjs';

const empty = { direct: [], registered: [], unproven: false, noExecutableDiff: true };
const make = (options) => browserPushPlan({ files: [], diffText: '', corpus: ['src/known.ts', 'demo/golden/device-battery.mjs'],
  smokeSelection: empty, pendingVisual: { golden: [] }, ...options });

test('#1060 CI reads the same call context as the local selector and task packet', () => {
  const diff = readFileSync(new URL('./fixtures/smoke-select/741-call-arguments.diff', import.meta.url), 'utf8');
  const calls = [];
  const demand = readTaskDemand({ refName: 'issue/1060-ci', repo: 'owner/repo', run(command, args) {
    calls.push([command, ...args]);
    if (command === 'gh') return JSON.stringify({ labels: [{ name: 'track:ask' }] });
    if (args[0] === 'merge-base') return 'a'.repeat(40);
    if (args.includes('--name-only')) return 'src/houseplan-card.ts\n';
    if (args[0] === 'diff') return diff;
    throw Error('unexpected read');
  } });
  assert.equal(demand.diffText, diff);
  assert.ok(calls.some(args => args.includes('--unified=3')));
  assert.ok(!calls.some(args => args.includes('--unified=0')));
});

test('#1060 every track excludes weak inference while preserving explicit scope and full coverage', () => {
  const selection = { ...empty, noExecutableDiff: false,
    direct: [{ smoke: 'smoke_modes.mjs', strong: false }, { smoke: 'smoke_decor.mjs', strong: true }],
    registered: [{ smoke: 'smoke_mode_transition.mjs' }],
    deferred: { until: 'beta/night', reasons: ['weak lexical matches'], smokes: ['smoke_modes.mjs'], symbols: [] } };
  for (const track of ['ship', 'show', 'ask']) {
    const input = { files: ['src/known.ts', 'demo/smoke_hide_layers.mjs'], labels: [`track:${track}`],
      smokeSelection: selection, visualIntent: { golden: [], smokes: ['smoke_static_zoom_sharpness.mjs'] } };
    const plan = make(input);
    assert.deepEqual(plan.smoke.ids, ['smoke_decor.mjs', 'smoke_hide_layers.mjs', 'smoke_mode_transition.mjs', 'smoke_static_zoom_sharpness.mjs']);
    assert.deepEqual(plan.smoke.deferred.smokes, ['smoke_modes.mjs']);
    const explicitWeak = make({ ...input, visualIntent: { golden: [], smokes: ['smoke_modes.mjs'] } });
    assert.ok(explicitWeak.smoke.ids.includes('smoke_modes.mjs'));
    assert.deepEqual(explicitWeak.smoke.deferred.smokes, []);
    const full = make({ ...input, labels: [...input.labels, 'ci:full'] });
    assert.equal(full.scope, 'full'); assert.equal(full.smoke.mode, 'full'); assert.equal(full.golden.mode, 'full');
  }
});

test('#1044 unrelated tests/docs do not run golden; explicit full stays full', () => {
  for (const file of ['test/subject.test.mjs', 'docs/DEVELOPMENT.md']) {
    const plan = make({ files: [file], labels: ['ci:golden'] });
    assert.equal(plan.golden.mode, 'none'); assert.equal(plan.smoke.mode, 'none');
  }
  assert.equal(make({ files: [], labels: ['ci:full'] }).scope, 'full');
  for (const eventName of ['workflow_dispatch', 'pull_request', 'schedule']) {
    assert.deepEqual(taskCiPlan({ refName: 'issue/983-test', eventName }, { baseFull: true }), { full: true, golden: true });
  }
});

test('#1044 connected scenes stay targeted; missing render scope needs intent, never full fallback', () => {
  const plan = make({ files: ['demo/golden/device-battery.mjs'], labels: ['ci:golden'] });
  assert.equal(plan.golden.mode, 'selected');
  assert.deepEqual(plan.golden.ids, GOLDEN_SCENARIOS.filter(s => s.batteryBoard).map(s => s.id).sort());
  assert.ok(plan.golden.ids.length > 0 && plan.golden.ids.length < GOLDEN_SCENARIOS.length);
  assert.throws(() => make({ files: ['demo/golden/device-battery.mjs'], labels: ['ci:golden'], links: {} }), /Task visual scope is not declared/);
  assert.ok(goldenConnections()['demo/fixtures/device-issues.mjs'].length === 4);
  assert.throws(() => make({ files: ['src/deleted-module.ts'], corpus: [], labels: ['ci:golden'] }), /Task visual scope is not declared/);
});

test('#1044 ordinary tasks use smoke-select; uncertainty gets the bounded minimum', () => {
  const known = make({ files: ['src/known.ts'], smokeSelection: {
    ...empty, direct: [{ smoke: 'smoke_modes.mjs', strong: true }], noExecutableDiff: false,
  } });
  assert.equal(known.smoke.mode, 'selected'); assert.deepEqual(known.smoke.ids, ['smoke_modes.mjs']);
  for (const selection of [{ ...empty, noExecutableDiff: false }, { ...empty, unproven: true }]) {
    const fallback = make({ files: ['src/known.ts'], smokeSelection: selection });
    assert.equal(fallback.smoke.mode, 'selected'); assert.equal(fallback.golden.mode, 'none');
    assert.ok(fallback.smoke.ids.length > 0 && fallback.smoke.ids.length < 10);
  }
});

test('#983 selected plans cannot supply a complete golden proof, ignore a diff, or escape a known entry', () => {
  const plan = make({ files: ['demo/golden/device-battery.mjs'], labels: ['ci:golden'] });
  assert.equal(validateSelectedPlan(plan), plan);
  assert.throws(() => validateSelectedPlan({ ...plan, golden: { mode: 'selected', ids: [] } }), /coverage|empty/);
  assert.throws(() => validateSelectedPlan({ ...plan, smoke: { mode: 'selected', ids: ['../src/other.mjs'] } }), /unknown/);
  const id = plan.golden.ids[0];
  for (const report of [{}, { baselineManifest: { valid: true }, results: [{ id, status: 'different' }] },
    { baselineManifest: { valid: false }, results: [{ id, status: 'passed' }] }]) assert.equal(selectedGoldenPassed(report, id), false);
  const single = { ...plan, golden: { ...plan.golden, ids: [id] } };
  const good = () => ({ chromium: 'pinned', buildFingerprint: 'source', baselineManifest: { present: true, valid: true, chromium: 'pinned' },
    results: [{ id, status: 'passed', actualSha256: 'a'.repeat(64), baselineSha256: 'b'.repeat(64) }] });
  assert.equal(runSelected(single, { run: () => ({ status: 0 }), report: good, prepare() {}, preserve() {}, log() {} }).outcome, 'success');
  assert.equal(runSelected(single, { run: () => ({ status: null, signal: 'SIGTERM' }), report: good, prepare() {}, preserve() {}, log() {} }).outcome, 'failure');
  assert.equal(runSelected(single, { run: () => ({ status: 0 }), report: () => ({}), prepare() {}, preserve() {}, log() {} }).outcome, 'failure');
  const proof = browserPlanExecution(plan, { browser_selected: { result: 'success' } });
  assert.equal(proof.executed.golden.mode, 'selected'); assert.equal(proof.executed.golden.result, 'success');
  assert.equal(proof.skipped.smoke, 'no related browser smoke');
});

test('#1044 task intent selects its scenes and carries earlier pending changes only in that scope', () => {
  const id = 'geometry-view-dark-fit', other = 'geometry-view-light-fit';
  const intent = { issue: 1044, golden: [{ id, expectation: 'change', reason: 'Correct the opening depth' }], smokes: ['smoke_modes.mjs'] };
  for (const track of ['ship', 'show', 'ask']) {
    const plan = make({ files: ['src/known.ts'], render: true, labels: [`track:${track}`], visualIntent: intent,
      pendingVisual: { golden: [{ id, issue: 1043, expectation: 'change', reason: 'Earlier opening symbol fix' },
        { id: other, issue: 1042, expectation: 'change', reason: 'Unrelated pending scene' }] } });
    assert.equal(plan.scope, 'task'); assert.equal(plan.golden.mode, 'selected');
    assert.deepEqual(plan.golden.ids, [id]); assert.deepEqual(plan.golden.intent.map(item => item.issue), [1043, 1044]);
    assert.deepEqual(plan.smoke.ids, ['smoke_modes.mjs']);
  }
  assert.throws(() => make({ files: ['src/known.ts'], render: true,
    visualIntent: { ...intent, golden: [{ ...intent.golden[0], id: 'nonexistent' }] } }), /Unknown declared/);
});

test('#1044 intentional pixels/new scenes pass task evidence; runtime, checksum and undeclared differences fail', () => {
  const id = 'geometry-view-dark-fit', intent = [{ id, issue: 1044, expectation: 'change', reason: 'New geometry' }];
  const report = { chromium: 'pinned', buildFingerprint: 'source', baselineManifest: { present: true, valid: false, chromium: 'pinned' },
    results: [{ id, status: 'different', actualSha256: 'a'.repeat(64), baselineSha256: 'b'.repeat(64) }] };
  assert.equal(selectedGoldenPassed(report, id, intent), true, 'unrelated pending matrix additions do not invalidate a checked frame');
  assert.equal(selectedGoldenPassed(report, id), false);
  for (const status of ['invalid-baseline', 'error', 'missing-baseline']) {
    assert.equal(selectedGoldenPassed({ ...report, results: [{ ...report.results[0], status }] }, id, intent), false);
  }
  assert.equal(selectedGoldenPassed({ ...report, results: [{ ...report.results[0], error: 'semantic assertion failed' }] }, id, intent), false);
  const added = { ...report, results: [{ ...report.results[0], status: 'missing-baseline' }] };
  assert.equal(selectedGoldenPassed(added, id, [{ ...intent[0], expectation: 'new' }]), true);
  assert.equal(selectedGoldenPassed({ ...report, chromium: 'foreign' }, id, intent), false);
});

test('#983 actual heavy CLI emits complete structured plan when explicitly requested', () => {
  const result = spawnSync(process.execPath, ['scripts/classify-changes.mjs', '--heavy', '--browser-plan'], {
    encoding: 'utf8', env: { ...process.env, REF_NAME: 'dev', EVENT_NAME: 'workflow_dispatch', FULL_INPUT: 'true' },
  });
  assert.equal(result.status, 0, result.stderr);
  const fields = Object.fromEntries(result.stdout.trim().split('\n').map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
  }));
  assert.equal(fields.heavy, 'true'); assert.equal(fields.golden, 'true'); assert.equal(fields.browser_subset, 'false');
  const plan = JSON.parse(fields.browser_plan);
  assert.equal(plan.scope, 'full'); assert.equal(plan.golden.mode, 'full'); assert.equal(plan.smoke.mode, 'full');
});

test('#983 actual workflow step emits the plan and retains all full-dispatch gates', t => {
  const directory = mkdtempSync(join(tmpdir(), 'hp-browser-plan-step-983-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = join(directory, 'outputs');
  const workflow = readFileSync(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  const step = findStep(workflow, { id: 'heavy' });
  const result = runStep(step, step.run, { cwd: process.cwd(), env: {
    ...process.env, REF_NAME: 'dev', EVENT_NAME: 'workflow_dispatch', FULL_INPUT: 'true', GITHUB_OUTPUT: output,
  } });
  assert.equal(result.status, 0, result.stderr);
  const text = readFileSync(output, 'utf8');
  assert.match(text, /^heavy=true$/m); assert.match(text, /^golden=true$/m);
  const plan = JSON.parse(text.split('\n').find(line => line.startsWith('browser_plan=')).slice('browser_plan='.length));
  assert.equal(plan.smoke.mode, 'full'); assert.equal(plan.golden.mode, 'full');
});

test('#1044 task proof accepts exact selected execution for S7; full release still requires full coverage', () => {
  const plan = make({ files: ['demo/golden/device-battery.mjs'], labels: ['ci:golden'] });
  const sha = 'a'.repeat(40), tree = 'b'.repeat(40);
  const needs = { preflight: { result: 'success' }, reuse: { result: 'success' },
    changes: { result: 'success', outputs: { browser_plan: JSON.stringify(plan) } },
    browser_selected: { result: 'success' } };
  const proof = buildCiProof({ candidateSha: sha, candidateTree: tree, runId: 3, attempt: 1, event: 'push', needs });
  assert.equal(proof.request.full, false); assert.ok(!proof.requiredChecks.includes('golden'));
  const context = { proof, candidate: { sha, tree }, run: { id: 3, run_attempt: 1, head_sha: sha,
    status: 'completed', conclusion: 'success', event: 'push' }, policy: CI_PROOF_POLICIES.release };
  assert.equal(evaluateCiProof(context).status, 'stale');
  const baseJobs = ['preflight', 'changes', 'reuse'].map(id => ({ name: JOB_RULES[id][0].name, conclusion: 'success' }));
  const light = { ...context, policy: { ...CI_PROOF_POLICIES.reviewLight, task: true, golden: true }, jobs: baseJobs };
  assert.equal(evaluateCiProof(light).status, 'failed', 'a claimed selected success is not the actual job');
  const green = { ...light, jobs: [...baseJobs,
    { name: UNCONSUMED_JOBS.browser_selected, conclusion: 'success' }] };
  assert.equal(evaluateCiProof(green).status, 'green');
  for (const execution of [{ mode: 'full', ids: plan.golden.ids, result: 'success' },
    { mode: 'selected', ids: plan.golden.ids.slice(1), result: 'success' },
    { mode: 'selected', ids: [...plan.golden.ids, 'unplanned-scene'], result: 'success' }]) {
    const altered = structuredClone(proof);
    altered.browserPlan.executed.golden = execution;
    assert.equal(evaluateCiProof({ ...green, proof: altered }).status, 'failed');
  }
  const missing = buildCiProof({ candidateSha: sha, candidateTree: tree, runId: 3, attempt: 1, event: 'push',
    needs: { ...needs, browser_selected: { result: 'skipped' } } });
  assert.equal(missing.browserPlan.executed.golden.result, 'skipped');
  assert.equal(evaluateCiProof({ ...context, proof: missing, policy: CI_PROOF_POLICIES.reviewLight }).status, 'failed');
});
