import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nodeBudgetVerdict, nodeLatencyAttribution, nodeQuantiles, nodeSeriesSummary } from '../demo/helpers/node-performance-report.mjs';

function report() {
  return { schema: 'houseplan-connected-node/v1', material: { sha: 'a'.repeat(40), tree: 'b'.repeat(40), dirty: false },
    harnessSha256: 'c'.repeat(64), fixtureSha256: 'd'.repeat(64), bundleFingerprint: 'e'.repeat(64),
    chromium: '151.0.7922.34', node: 'v22.23.3', counts: { rooms: 8, walls: 30, openings: 14 },
    viewport: { width: 1280, height: 1000 }, dpr: 1, warmupGestures: 3, measuredGestures: 5,
    clockDefinition: 'fixed conservative source clock', latencyDefinition: 'source to post-paint opportunity',
    functionalChecks: 'passed', pass: true, failures: [],
    environment: { platform: 'linux', arch: 'x64', release: 'kernel-a', cpuModel: 'cpu-a', cpuCount: 8,
      totalMemory: 16e9, imageOS: null, imageVersion: null, freeMemoryAtStart: 8e9, loadAtStart: [0, 0, 0] },
    budgets: { mainThreadP95Ms: 55, inputToPaintP95Ms: 121, longTaskMaxMs: 150 },
    mainThread: nodeQuantiles(Array(300).fill(20)), inputToPaint: nodeQuantiles(Array(300).fill(30)), longTasks: nodeQuantiles([]),
    raw: Array.from({ length: 8 }, (_, index) => ({ index, kind: index < 3 ? 'warmup' : 'measured',
      clockCalibration: { offsetMs: 500 }, clockAfter: { offsetMs: 500 },
      inputs: Array.from({ length: 60 }, (_, id) => ({ id, eventTime: 100 + id * 16,
        inputToPaintMs: 30, disposition: 'latest-candidate', coalesced: false })),
      events: Array.from({ length: 60 }, (_, id) => ({ id, eventTime: 101 + id * 16,
        dispatched: 102 + id * 16, paintOpportunity: 130 + id * 16 })),
      samples: Array.from({ length: 60 }, (_, id) => ({ began: 103 + id * 16, mainThreadMs: 20,
        events: [id], validateCalls: 1, invalid: id % 2 === 0 })),
      sourceMatches: Array.from({ length: 60 }, (_, id) => ({ sourceId: id, observationId: id, observationIndex: id })) })) };
}

test('#888 verdict names each exact historical/current budget without changing inputs or thresholds', () => {
  const good = report(), before = structuredClone(good);
  assert.equal(nodeBudgetVerdict(good).pass, true); assert.deepEqual(good, before);
  for (const [group, statistic, key] of [['mainThread', 'p95', 'mainThreadP95Ms'],
    ['inputToPaint', 'p95', 'inputToPaintP95Ms'], ['longTasks', 'max', 'longTaskMaxMs']]) {
    const exact = report(); exact[group][statistic] = exact.budgets[key];
    assert.equal(nodeBudgetVerdict(exact).pass, true, 'equality is allowed, no rounding tolerance');
    exact[group][statistic] += .000001;
    const v = nodeBudgetVerdict(exact);
    assert.equal(v.pass, false); assert.equal(v.budgetFailures.length, 1);
    assert.equal(v.budgetFailures[0].metric, `${group}.${statistic}`);
    assert.equal(v.budgetFailures[0].actual, exact[group][statistic]);
    assert.equal(v.budgetFailures[0].limit, exact.budgets[key]);
    assert.ok(v.failures[0].includes(key)); assert.ok(v.budgetFailures[0].excess > 0);
  }
  const old = report(); old.budgets.inputToPaintP95Ms = 100; old.inputToPaint.p95 = 103.283232;
  assert.equal(nodeBudgetVerdict(old).budgetFailures[0].limit, 100, 'no applying current 121ms to old red');
});

test('#888 malformed/missing values and functional/clock exceptions cannot derive a green result', () => {
  for (const value of [undefined, NaN, Infinity, -1]) {
    const r = report(); r.mainThread.p95 = value;
    assert.equal(nodeBudgetVerdict(r).budgetFailures[0].reason, 'missing-or-invalid-measurement');
    assert.equal(nodeBudgetVerdict(r).pass, false);
  }
  for (const change of [r => r.inputToPaint.count = 0, r => delete r.budgets,
    r => r.failures.push('functional mismatch'), r => r.error = { name: 'Error', message: 'clock bounds' },
    r => r.pass = false]) {
    const r = report(); change(r); assert.equal(nodeBudgetVerdict(r).pass, false);
  }
  const r = report(); r.mainThread.p95 = 56;
  const once = nodeBudgetVerdict(r); Object.assign(r, once);
  assert.deepEqual(nodeBudgetVerdict(r), once, 'offline re-reading does not duplicate failure strings');
});

test('#888 exact ledger join preserves phase sums, source clocks, superseded identity and invalid candidates', () => {
  const r = report(), g = r.raw[3];
  // Source 0 is superseded by source 1. Both settle to the same exact native/flush.
  g.sourceMatches.shift(); g.samples.shift();
  g.inputs[0].inputToPaintMs += 16; g.inputs[0].disposition = 'superseded-by-latest';
  g.inputs[0].coalesced = true;
  const before = structuredClone(r), a = nodeLatencyAttribution(r);
  assert.equal(a.status, 'observed'); assert.equal(a.count, 300); assert.deepEqual(r, before);
  assert.deepEqual(a.rows[0], { gesture: 3, source: 0, settledBySource: 1, observation: 1, sample: 0,
    disposition: 'superseded-by-latest', sourceSuperseded: true, coalesced: true, invalidCandidate: false,
    validateCalls: 1, inputToPaintMs: 46, sourceToNativeMs: 17, nativeDispatchMs: 1, frameSchedulingMs: 1,
    candidateWallMs: 20, afterCandidateToPaintMs: 7 });
  assert.equal(a.rows[2].invalidCandidate, true);
  assert.equal(a.p95Input.inputToPaintMs, 30); assert.equal(a.tail.length, 15);
  assert.match(a.limitations, /not CPU/); assert.match(a.limitations, /must not be added/);
});

test('#888 incomplete, ambiguous, reordered or non-monotone evidence gives unknown, never guessed phases', () => {
  const cases = [r => r.raw[3].samples.push(structuredClone(r.raw[3].samples[0])),
    r => r.raw[3].sourceMatches.pop(), r => r.raw[3].sourceMatches[1].observationIndex = 0,
    r => r.raw[3].inputs[0].id = 77, r => r.raw[3].inputs[0].inputToPaintMs = 29,
    r => r.raw[3].events[0].dispatched = 99, r => r.inputToPaint.count = 299,
    r => delete r.raw, r => r.raw[3].sourceMatches[0].sourceId = .5];
  for (const change of cases) {
    const r = report(); change(r); const before = structuredClone(r), a = nodeLatencyAttribution(r);
    assert.equal(a.status, 'unknown'); assert.ok(a.reason); assert.equal('phases' in a, false);
    assert.deepEqual(r, before, 'diagnosis never edits raw evidence or original verdict');
  }
});

test('#888 fixed series retains red outcomes and environment load, without calling cause or flake', () => {
  const reports = Array.from({ length: 3 }, report);
  reports[1].mainThread.p95 = 56; reports[1].pass = false;
  reports[1].error = { name: 'AssertionError', message: 'performance budgets', stage: 'budget-verdict' };
  reports[2].environment.freeMemoryAtStart = 5e9; reports[2].environment.loadAtStart = [3, 1, 2];
  const before = structuredClone(reports), s = nodeSeriesSummary(reports);
  assert.equal(s.comparable, true); assert.equal(s.cause, 'unknown'); assert.deepEqual(reports, before);
  assert.deepEqual(s.observations.map(o => o.originalPass), [true, false, true]);
  assert.deepEqual(s.ranges.mainThread, { minP95: 20, maxP95: 56 });
  assert.deepEqual(s.observations[2].environment.loadAtStart, [3, 1, 2]);
  assert.equal(s.observations[1].budgetVerdict.pass, false);
});

test('#888 foreign, dirty, partial, unknown-environment and too-short series are not comparable', () => {
  for (const change of [r => r.material.sha = 'f'.repeat(40), r => r.material.dirty = true,
    r => delete r.material, r => r.harnessSha256 = 'f'.repeat(64), r => r.fixtureSha256 = 'f'.repeat(64),
    r => r.bundleFingerprint = 'f'.repeat(64), r => r.budgets.mainThreadP95Ms = 50,
    r => r.viewport.width = 1920, r => r.environment.cpuModel = 'cpu-b', r => delete r.environment,
    r => r.functionalChecks = 'incomplete', r => r.raw.pop(), r => delete r.raw[0].clockAfter,
    r => r.error = { message: 'pixel mismatch', stage: 'smoke' }, r => r.raw[3].inputs.pop()]) {
    const reports = Array.from({ length: 3 }, report); change(reports[1]);
    assert.equal(nodeSeriesSummary(reports).comparable, false);
  }
  assert.equal(nodeSeriesSummary([report(), report()]).comparable, false);
});

test('#910 AC1 uniformly dirty triples are rejected without a signature mismatch or input changes', () => {
  const clean = Array.from({ length: 3 }, report), dirty = structuredClone(clean);
  for (const receipt of dirty) receipt.material.dirty = true;
  assert.deepEqual(dirty[0], dirty[1], 'all signature inputs, not only material, are identical');
  assert.deepEqual(dirty[1], dirty[2]);
  assert.deepEqual(dirty.map(receipt => ({ ...receipt, material: { ...receipt.material, dirty: false } })), clean,
    'the negative input differs from the clean positive only in dirty');
  for (const [reports, comparable] of [[clean, true], [dirty, false]]) {
    const before = structuredClone(reports), summary = nodeSeriesSummary(reports);
    assert.equal(summary.comparable, comparable, comparable ? 'uniform clean control' : 'uniform dirty refusal');
    assert.equal(summary.cause, 'unknown');
    assert.deepEqual(reports, before, 'summarising either input never edits receipts');
  }
});

test('#888 diagnostic CLI is read-only, bounded and retains original red plus its recorded budget', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-node-report-'));
  try {
    const r = report(); r.budgets.mainThreadP95Ms = 50; r.mainThread.p95 = 50.6; r.pass = false;
    const path = join(dir, 'raw.json'), raw = JSON.stringify(r); writeFileSync(path, raw);
    const cli = fileURLToPath(new URL('../scripts/node-connected-diagnostics.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [cli, path], { encoding: 'utf8' });
    assert.equal(result.status, 0); const s = JSON.parse(result.stdout);
    assert.equal(s.observations[0].originalPass, false);
    assert.equal(s.observations[0].budgetVerdict.budgetFailures[0].limit, 50);
    assert.equal('rows' in s.observations[0].attribution, false);
    assert.equal(s.observations[0].attribution.tail.length, 15);
    assert.equal(readFileSync(path, 'utf8'), raw); assert.deepEqual(readdirSync(dir), ['raw.json']);
    assert.equal(spawnSync(process.execPath, [cli], { encoding: 'utf8' }).status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
