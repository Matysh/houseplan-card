import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePerformanceBudget } from '../demo/performance/evaluate.mjs';

const budgets = {
  schema: 1,
  profile: 'large-house-v1',
  minimumSamples: 2,
  timings: {
    firstStableRenderMs: {
      stat: 'median', maxRegressionRatio: 0.25, noiseAllowanceMs: 10, hardMaxMs: 500,
    },
  },
  longTasks: {
    maxSingleMs: 200, maxCountP95: 10, maxTotalP95Ms: 500,
    maxSingleRegressionRatio: 0.5, maxSingleNoiseAllowanceMs: 20,
    maxCountRegressionRatio: 0.5, countNoiseAllowance: 2,
    maxTotalRegressionRatio: 0.5, noiseAllowanceMs: 20,
  },
  heap: {
    required: true, hardMaxGrowthBytes: 1000, maxRegressionRatio: 0.5, noiseAllowanceBytes: 100,
  },
  cacheEntries: { cleanFloor: 3 },
  cacheGrowth: { cleanFloor: 0 },
  renderedDevices: 200,
};

const report = ({ timing = 100, heap = 100, cache = 3, growth = 0, long = 20 } = {}) => ({
  schema: 2,
  profile: 'large-house-v1',
  buildFingerprint: `fixture-${timing}`,
  runtime: { node: 'v22.0.0', chromium: '1.2.3', platform: 'linux', arch: 'x64' },
  fixture: { rooms: 60 },
  summary: { firstStableRenderMs: { median: timing, p95: timing, min: timing, max: timing } },
  longTasks: { maxSingleMs: long, countP95: 1, totalP95Ms: long },
  rows: [0, 1].map(() => ({
    heapGrowthBytes: heap,
    preciseGc: true,
    longTasks: { load: { supported: true, count: 1, maxMs: long, totalMs: long } },
    cacheEntries: { cleanFloor: cache },
    cacheGrowth: { cleanFloor: growth },
    renderedDevices: 200,
  })),
});

test('performance budget accepts a candidate inside relative and absolute limits', () => {
  const result = evaluatePerformanceBudget({
    baseline: report(), candidate: report({ timing: 120, heap: 150 }), budgets,
  });
  assert.equal(result.pass, true);
  assert.deepEqual(result.failures, []);
});

test('performance budget rejects a timing regression even below the hard ceiling', () => {
  const result = evaluatePerformanceBudget({
    baseline: report(), candidate: report({ timing: 150 }), budgets,
  });
  assert.equal(result.pass, false);
  assert.ok(result.failures.some((check) => check.id === 'timing.firstStableRenderMs.median'));
});

test('performance budget rejects long tasks, heap growth, cache growth and missing devices', () => {
  const candidate = report({ heap: 2000, cache: 4, growth: 1, long: 300 });
  candidate.rows.forEach((row) => { row.renderedDevices = 199; });
  const result = evaluatePerformanceBudget({ baseline: report(), candidate, budgets });
  assert.equal(result.pass, false);
  assert.deepEqual(
    new Set(result.failures.map((check) => check.id)),
    new Set([
      'longTask.maxSingleMs',
      'longTask.totalP95Ms',
      'heap.growthP95Bytes',
      'cache.entries.cleanFloor',
      'cache.growth.cleanFloor',
      'renderedDevices',
    ]),
  );
});

test('performance budget compares single/count Long Tasks to the same-runner baseline', () => {
  const baseline = report({ long: 100 });
  baseline.longTasks.countP95 = 4;
  const candidate = report({ long: 130 });
  candidate.longTasks.countP95 = 6;
  const result = evaluatePerformanceBudget({ baseline, candidate, budgets });
  assert.equal(result.pass, true);
  assert.equal(result.checks.find((check) => check.id === 'longTask.maxSingleMs')?.baseline, 100);
  assert.equal(result.checks.find((check) => check.id === 'longTask.countP95')?.baseline, 4);
});

test('performance budget refuses incomparable runtime profiles', () => {
  const candidate = report();
  candidate.runtime.chromium = 'different';
  assert.throws(
    () => evaluatePerformanceBudget({ baseline: report(), candidate, budgets }),
    /runtime mismatch for chromium/,
  );
});

test('absolute performance smoke needs no baseline and enforces hard ceilings', () => {
  const accepted = evaluatePerformanceBudget({
    candidate: report({ timing: 450, heap: 900, long: 190 }), budgets, absoluteOnly: true,
  });
  assert.equal(accepted.pass, true);
  assert.equal(accepted.mode, 'absolute');
  assert.equal(accepted.checks.find((check) => check.id === 'timing.firstStableRenderMs.median')?.baseline, undefined);

  const rejected = evaluatePerformanceBudget({
    candidate: report({ timing: 501 }), budgets, absoluteOnly: true,
  });
  assert.equal(rejected.pass, false);
  assert.ok(rejected.failures.some((check) => check.id === 'timing.firstStableRenderMs.median'));
});
