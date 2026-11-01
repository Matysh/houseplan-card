import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateVisualIntent, readTaskVisualIntent, readPendingVisualIntents, baselineIndexHash } from '../scripts/task-visual-intent.mjs';
import { browserPushPlan } from '../scripts/browser-push-plan.mjs';
import { taskCiPlan } from '../scripts/task-ci-plan.mjs';
import { browserPlanExecution } from '../scripts/browser-plan-proof.mjs';
import { selectedGoldenPassed, runSelected } from '../scripts/browser-selected.mjs';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import historicalScopes from './data/golden-unchanged-scopes.json' with { type: 'json' };

const id = 'geometry-view-dark-fit', other = 'geometry-view-light-fit';
const check = { id, reason: 'The saved opening geometry and wall paint must stay byte-identical' };
const visual = () => ({ schema: 2, baselineIndex: 'a'.repeat(64), golden: [], smokes: [], goldenChecks: [check] });
const empty = { direct: [], registered: [], unproven: false, noExecutableDiff: true };
const make = (intent = visual(), options = {}) => browserPushPlan({ issue: 1114, files: ['src/unmapped-renderer.ts'],
  diffText: '', corpus: [], render: true, smokeSelection: empty, pendingVisual: { golden: [] }, visualIntent: intent, ...options });
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-golden-checks-1114-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ledger = join(root, 'docs/release-ledger/v1.0.0'), baselines = join(root, 'demo/golden/baselines');
  mkdirSync(ledger, { recursive: true }); mkdirSync(baselines, { recursive: true });
  writeFileSync(join(root, 'docs/release-ledger/cycle.json'), JSON.stringify({ baseStable: 'v1.0.0' }));
  writeFileSync(join(baselines, 'baselines-index.json'), '{"scenarios":{}}\n');
  const value = { ...visual(), baselineIndex: baselineIndexHash(root) };
  const put = (issue, item = value) => writeFileSync(join(ledger, `${issue}.json`), JSON.stringify({ issue, visual: item }));
  return { root, baselines, value, put };
}
const report = () => ({ chromium: 'fixture-chromium', buildFingerprint: 'c'.repeat(64),
  baselineManifest: { present: true, valid: false, chromium: 'fixture-chromium' },
  results: [{ id, status: 'passed', actualSha256: 'a'.repeat(64), baselineSha256: 'a'.repeat(64), differingPixels: 0, diffRatio: 0 }] });
const strict = [{ ...check, issue: 1114, expectation: 'unchanged' }];

test('#1114 explicit checks select unknown render scope without declaring a pixel delta', () => {
  const plan = make();
  assert.equal(plan.golden.mode, 'selected');
  assert.deepEqual(plan.golden.ids, [id]);
  assert.deepEqual(plan.golden.intent, strict);
  assert.doesNotThrow(() => browserPlanExecution(plan, {}));
  assert.equal(make(visual(), { files: [], render: false }).golden.mode, 'selected');
  assert.throws(() => make({ ...visual(), goldenChecks: [] }), /Task visual scope is not declared/);
  assert.throws(() => make(null), /Task visual scope is not declared/);
});

test('#1114 strict checks require a reader version that cannot silently ignore them', () => {
  const legacy = { schema: 1, baselineIndex: 'a'.repeat(64), golden: [], smokes: [] };
  assert.deepEqual(validateVisualIntent(legacy, 1114), legacy);
  for (const goldenChecks of [[], [check]])
    assert.throws(() => validateVisualIntent({ ...legacy, goldenChecks }, 1114), /require visual schema 2/);
  assert.deepEqual(validateVisualIntent(visual(), 1114), visual());
  assert.throws(() => validateVisualIntent({ ...visual(), schema: 3 }, 1114), /invalid visual intent/);
});

test('#1114 checks reject malformed IDs/reasons, duplicate scene ownership and fake delta expectations', () => {
  const value = visual();
  assert.deepEqual(validateVisualIntent(value, 1114), value);
  for (const goldenChecks of [null, {}, [{ ...check, id: '../scene' }], [{ ...check, reason: ' ' }],
    [check, check], [{ ...check, expectation: 'change' }]]) {
    assert.throws(() => validateVisualIntent({ ...value, goldenChecks }, 1114), /golden check/i);
  }
  assert.throws(() => validateVisualIntent({ ...value, golden: [{ ...check, expectation: 'change' }] }, 1114), /golden check/i);
  assert.throws(() => validateVisualIntent({ ...value, golden: [{ ...check, expectation: 'unchanged' }], goldenChecks: [] }, 1114), /change\/new/);
  assert.throws(() => make({ ...value, goldenChecks: [{ ...check, id: 'unknown-scene' }] }), /Unknown declared golden scene/);
});

test('#1114 pending change/new can never weaken an unchanged check, in either input order', () => {
  for (const expectation of ['change', 'new']) {
    const delta = { ...check, issue: 1100, expectation };
    assert.throws(() => make(visual(), { pendingVisual: { golden: [delta] } }), /unchanged.*pending|pending.*unchanged/i);
    for (const intent of [[delta, ...strict], [...strict, delta]]) assert.equal(selectedGoldenPassed(report(), id, intent), false);
  }
});

test('#1114 unchanged requires byte identity and complete zero-diff metrics, even inside the ordinary tolerance', () => {
  assert.equal(selectedGoldenPassed(report(), id, strict), true);
  for (const patch of [{ differingPixels: 1, diffRatio: 0.000001 }, { actualSha256: 'b'.repeat(64) },
    { status: 'different' }, { status: 'missing-baseline' }, { differingPixels: undefined }, { diffRatio: undefined },
    { differingPixels: -1 }, { diffRatio: NaN }, { error: 'capture failure' }]) {
    const candidate = report(); Object.assign(candidate.results[0], patch);
    assert.equal(selectedGoldenPassed(candidate, id, strict), false, JSON.stringify(patch));
  }
  for (const candidate of [{}, { ...report(), results: [] }, { ...report(), results: [...report().results, ...report().results] },
    { ...report(), chromium: 'other' }, { ...report(), buildFingerprint: '' }]) {
    assert.equal(selectedGoldenPassed(candidate, id, strict), false);
  }
  // Existing tolerant and explicit-delta routes keep their previous semantics.
  const tolerated = report(); tolerated.results[0].differingPixels = 1;
  assert.equal(selectedGoldenPassed(tolerated, id), true);
  tolerated.results[0].status = 'different';
  assert.equal(selectedGoldenPassed(tolerated, id, [{ ...check, issue: 1100, expectation: 'change' }]), true);
});

test('#1114 check declarations never become pending beta changes, and stale checks fail instead of disappearing', t => {
  const { root, baselines, value, put } = fixture(t);
  put(1114); put(1100, { ...value, goldenChecks: [], golden: [{ id: other, expectation: 'change', reason: 'Real pixel delta' }] });
  const pending = readPendingVisualIntents({ root });
  assert.deepEqual(pending.expectChange, [other]); assert.deepEqual(pending.expectNew, []);
  assert.deepEqual(pending.golden.map(item => item.id), [other]);
  assert.equal(readTaskVisualIntent({ root, issue: 1114 }).goldenChecks.length, 1);
  writeFileSync(join(baselines, 'baselines-index.json'), '{"scenarios":{},"accepted":"next"}\n');
  assert.deepEqual(readPendingVisualIntents({ root }).golden, []);
  assert.throws(() => readTaskVisualIntent({ root, issue: 1114 }), /stale.*golden check|golden check.*baseline/i);
  assert.equal(readTaskVisualIntent({ root, issue: 1100 }), null, 'old delta expiry is unchanged');
});

test('#1114 strict checks cannot silently take the full-matrix early return', t => {
  const { root, put } = fixture(t); put(1114);
  assert.throws(() => make(visual(), { labels: ['ci:full'] }), /unchanged.*selected|golden checks.*full/i);
  for (const options of [{ baseFull: true }, { labels: ['ci:full'] }]) {
    assert.throws(() => taskCiPlan({ refName: 'issue/1114-checks' }, { root, ...options }), /unchanged.*selected|golden checks.*full/i);
  }
  const inherited = { ...visual(), goldenChecks: [] }; put(1114, inherited);
  assert.throws(() => taskCiPlan({ refName: 'issue/1114-checks' }, { root, baseFull: true,
    browserOptions: { visualIntent: visual() } }), /unchanged.*selected|golden checks.*full/i);
  assert.deepEqual(taskCiPlan({ refName: 'issue/1114-checks' }, { root, baseFull: true }), { full: true, golden: true });
});

test('#1114 internal unchanged survives the legacy task wire, never a full or unscoped push claim', () => {
  const plan = { schema: 1, scope: 'task', smoke: { mode: 'none', ids: [] }, golden: { mode: 'selected', ids: [id], intent: strict } };
  const wire = browserPlanExecution(plan, {}).planned;
  assert.equal(wire.scope, 'push'); assert.equal(wire.coverageScope, 'task');
  assert.doesNotThrow(() => browserPlanExecution(wire, {}));
  for (const invalid of [{ ...plan, scope: 'full' }, { ...plan, scope: 'push' },
    { ...plan, golden: { ...plan.golden, mode: 'full' } }]) assert.throws(() => browserPlanExecution(invalid, {}), /intent|coverage/);
});

test('#1114 recorded real render-source scopes stay bounded to their existing check scenes', () => {
  for (const sample of historicalScopes.cases) {
    for (const scene of sample.goldenCheckIds) assert.ok(GOLDEN_SCENARIOS.some(item => item.id === scene));
    // This unit projects only Golden inputs; the complete branch/label replay is recorded separately.
    const plan = make({ ...visual(), goldenChecks: sample.goldenCheckIds.map(scene => ({ id: scene, reason: 'Existing task readback must remain identical' })) },
      { files: sample.files.filter(file => file.startsWith('src/')), labels: sample.ciLabels, render: sample.render });
    assert.equal(plan.scope, 'task'); assert.deepEqual(plan.golden.ids, [...sample.goldenCheckIds].sort());
    assert.ok(plan.golden.ids.length < GOLDEN_SCENARIOS.length);
    assert.ok(plan.golden.intent.every(item => item.expectation === 'unchanged'));
  }
});
test('#1114 unrelated true deltas retain their intent alongside a strict checked scene', () => {
  const delta = { id: other, expectation: 'change', reason: 'A real independent visual change', issue: 1114 };
  const plan = make({ ...visual(), golden: [{ id: other, expectation: delta.expectation, reason: delta.reason }] },
    { pendingVisual: { golden: [delta] } });
  assert.deepEqual(plan.golden.ids, [id, other].sort());
  assert.deepEqual(plan.golden.intent.filter(item => item.id === other), [delta]);
  assert.deepEqual(plan.golden.intent.filter(item => item.id === id), strict);
});

test('#1114 the actual selected worker retains child/partial-output failure for strict checks', () => {
  const plan = { schema: 1, scope: 'task', smoke: { mode: 'none', ids: [] },
    golden: { mode: 'selected', ids: [id], intent: strict } };
  const run = (child, captured = report()) => runSelected(plan, { run: () => child, report: () => captured,
    prepare() {}, preserve() {}, log() {} });
  assert.equal(run({ status: 0 }).outcome, 'success');
  for (const child of [{ status: 1 }, { status: null, signal: 'SIGTERM' }, { status: 0, error: Error('timeout') }])
    assert.equal(run(child).outcome, 'failure');
  assert.equal(run({ status: 0 }, { ...report(), results: [] }).outcome, 'failure');
});