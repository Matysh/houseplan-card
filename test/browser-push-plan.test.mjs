import test from 'node:test';
import assert from 'node:assert/strict';
import { browserPushPlan, browserPlanExecution, goldenConnections } from '../scripts/browser-push-plan.mjs';
import { taskCiPlan } from '../scripts/task-ci-plan.mjs';
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
  smokeSelection: empty, ...options });

test('#983 unrelated tests/docs do not run golden despite demand; full dispatch/PR remain full', () => {
  for (const file of ['test/subject.test.mjs', 'docs/DEVELOPMENT.md']) {
    const plan = make({ files: [file], labels: ['ci:golden', 'ci:full'] });
    assert.equal(plan.golden.mode, 'none'); assert.equal(plan.smoke.mode, 'none');
  }
  for (const eventName of ['workflow_dispatch', 'pull_request', 'schedule']) {
    assert.deepEqual(taskCiPlan({ refName: 'issue/983-test', eventName }, { baseFull: true }), { full: true, golden: true });
  }
});

test('#983 a real dedicated golden input selects its declared scenes; removed/unknown links broaden', () => {
  const plan = make({ files: ['demo/golden/device-battery.mjs'], labels: ['ci:golden'] });
  assert.equal(plan.golden.mode, 'selected');
  assert.deepEqual(plan.golden.ids, GOLDEN_SCENARIOS.filter(s => s.batteryBoard).map(s => s.id).sort());
  assert.ok(plan.golden.ids.length > 0 && plan.golden.ids.length < GOLDEN_SCENARIOS.length);
  const missing = make({ files: ['demo/golden/device-battery.mjs'], labels: ['ci:golden'], links: {} });
  assert.equal(missing.golden.mode, 'full');
  assert.equal(missing.golden.ids.length, GOLDEN_SCENARIOS.length);
  assert.ok(goldenConnections()['demo/fixtures/device-issues.mjs'].length === 4);
  assert.equal(make({ files: ['src/deleted-module.ts'], corpus: [], labels: ['ci:golden'] }).golden.mode, 'full',
    'a deleted source cannot disappear from coverage merely because it left the current corpus');
});

test('#983 ci:full uses smoke-select entries; empty/unknown source selection cannot turn green empty', () => {
  const known = make({ files: ['src/known.ts'], labels: ['ci:full'], smokeSelection: {
    ...empty, direct: [{ smoke: 'smoke_modes.mjs' }], noExecutableDiff: false,
  } });
  assert.equal(known.smoke.mode, 'selected'); assert.deepEqual(known.smoke.ids, ['smoke_modes.mjs']);
  for (const selection of [empty, { ...empty, unproven: true }]) {
    const fallback = make({ files: ['src/known.ts'], labels: ['ci:full'], smokeSelection: selection });
    assert.equal(fallback.smoke.mode, 'full'); assert.equal(fallback.golden.mode, 'full');
    assert.ok(fallback.smoke.ids.length > 100);
  }
});

test('#983 selected plans cannot supply a complete golden proof, ignore a diff, or escape a known entry', () => {
  const plan = make({ files: ['demo/golden/device-battery.mjs'], labels: ['ci:golden'] });
  assert.equal(validateSelectedPlan(plan), plan);
  assert.throws(() => validateSelectedPlan({ ...plan, golden: { mode: 'selected', ids: [] } }), /empty/);
  assert.throws(() => validateSelectedPlan({ ...plan, smoke: { mode: 'selected', ids: ['../src/other.mjs'] } }), /unknown/);
  const id = plan.golden.ids[0];
  for (const report of [{}, { baselineManifest: { valid: true }, results: [{ id, status: 'different' }] },
    { baselineManifest: { valid: false }, results: [{ id, status: 'passed' }] }]) assert.equal(selectedGoldenPassed(report, id), false);
  const single = { ...plan, golden: { ...plan.golden, ids: [id] } };
  const good = () => ({ baselineManifest: { valid: true }, results: [{ id, status: 'passed' }] });
  assert.equal(runSelected(single, { run: () => ({ status: 0 }), report: good, prepare() {}, log() {} }).outcome, 'success');
  assert.equal(runSelected(single, { run: () => ({ status: null, signal: 'SIGTERM' }), report: good, prepare() {}, log() {} }).outcome, 'failure');
  assert.equal(runSelected(single, { run: () => ({ status: 0 }), report: () => ({}), prepare() {}, log() {} }).outcome, 'failure');
  const proof = browserPlanExecution(plan, { browser_selected: { result: 'success' } });
  assert.equal(proof.executed.golden.mode, 'selected'); assert.equal(proof.executed.golden.result, 'success');
  assert.equal(proof.skipped.smoke, 'no full demand');
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

test('#983 real proof policies refuse partial progress for S7/full; missing selected execution fails', () => {
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
  const light = { ...context, policy: CI_PROOF_POLICIES.reviewLight, jobs: baseJobs };
  assert.equal(evaluateCiProof(light).status, 'failed', 'a claimed selected success is not the actual job');
  assert.equal(evaluateCiProof({ ...light, jobs: [...baseJobs,
    { name: UNCONSUMED_JOBS.browser_selected, conclusion: 'success' }] }).status, 'green');
  const missing = buildCiProof({ candidateSha: sha, candidateTree: tree, runId: 3, attempt: 1, event: 'push',
    needs: { ...needs, browser_selected: { result: 'skipped' } } });
  assert.equal(missing.browserPlan.executed.golden.result, 'skipped');
  assert.equal(evaluateCiProof({ ...context, proof: missing, policy: CI_PROOF_POLICIES.reviewLight }).status, 'failed');
});
