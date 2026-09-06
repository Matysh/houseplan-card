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
  sourceSha: '1'.repeat(40),
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

test('isometric reports fail closed on exact SHA, effective projection and Stage 3 metadata', () => {
  const isoBudgets = { ...budgets, profile: 'isometric-stage3-dense-v1' };
  const valid = report();
  Object.assign(valid, {
    profile: isoBudgets.profile,
    effectiveProjection: ['iso'],
    isoStageRevision: ['3'],
    stage3Required: true,
  });
  valid.rows.forEach((row) => Object.assign(row, {
    effectiveProjection: 'iso', isoStageRevision: '3',
    isoStructuralBuilds: {
      supported: true, initial: 1, beforeHaUpdate: 2, afterHaUpdate: 2, haUpdateDelta: 0,
    },
  }));
  const baseline = structuredClone(valid);
  baseline.sourceSha = '2'.repeat(40);
  baseline.stage3Required = false;
  assert.equal(evaluatePerformanceBudget({
    baseline, candidate: valid, budgets: isoBudgets,
    baselineSha: baseline.sourceSha, candidateSha: valid.sourceSha,
  }).pass, true);

  for (const mutate of [
    (candidate) => { candidate.sourceSha = null; },
    (candidate) => { candidate.effectiveProjection = ['flat']; },
    (candidate) => { candidate.rows[0].effectiveProjection = 'flat'; },
    (candidate) => { candidate.stage3Required = false; },
    (candidate) => { candidate.isoStageRevision = ['2']; },
    (candidate) => { candidate.rows[0].isoStageRevision = '2'; },
    (candidate) => { candidate.rows[0].isoStructuralBuilds.haUpdateDelta = 1; },
    (candidate) => { delete candidate.rows[0].isoStructuralBuilds; },
  ]) {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.throws(() => evaluatePerformanceBudget({
      baseline, candidate, budgets: isoBudgets,
    }), /sourceSha|effectiveProjection|Stage 3|structural build count/);
  }
  assert.throws(() => evaluatePerformanceBudget({
    baseline, candidate: valid, budgets: isoBudgets, candidateSha: 'f'.repeat(40),
  }), /sourceSha does not match/);
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

test('named interaction windows enforce their own absolute Long Task limits', () => {
  const windowBudgets = {
    ...budgets,
    longTaskWindows: {
      editorSeries: { maxSingleMs: 150, maxCountP95: 3, maxTotalP95Ms: 300 },
    },
  };
  const candidate = report();
  candidate.rows[0].longTasks.editorSeries = {
    supported: true, count: 3, maxMs: 149, totalMs: 299,
  };
  candidate.rows[1].longTasks.editorSeries = {
    supported: true, count: 4, maxMs: 151, totalMs: 301,
  };
  const result = evaluatePerformanceBudget({ baseline: report(), candidate, budgets: windowBudgets });
  assert.deepEqual(
    new Set(result.failures.map((check) => check.id)),
    new Set([
      'longTask.editorSeries.maxSingleMs',
      'longTask.editorSeries.countP95',
      'longTask.editorSeries.totalP95Ms',
    ]),
  );
});

// #473 AC4: smoke-бюджеты диффозависимых профилей повторяют абсолютные потолки
// полных профилей и пригодны для `compare --absolute-only` на трёх образцах.
import { readFileSync } from 'node:fs';

const readBudget = (name) => JSON.parse(readFileSync(new URL(`../demo/performance/${name}`, import.meta.url), 'utf8'));

for (const [smokeName, fullName] of [
  ['budgets-isometric-smoke.json', 'budgets-large-house-isometric.json'],
  ['budgets-interaction-smoke.json', 'budgets-large-house-interaction.json'],
]) {
  test(`${smokeName} повторяет hardMaxMs полного профиля и держит 3 образца (#473 AC4)`, () => {
    const smoke = readBudget(smokeName);
    const full = readBudget(fullName);
    assert.equal(smoke.profile, full.profile);
    assert.equal(smoke.minimumSamples, 3);
    assert.deepEqual(Object.keys(smoke.timings), Object.keys(full.timings), 'набор метрик тот же');
    for (const [metric, budget] of Object.entries(smoke.timings)) {
      assert.equal(budget.hardMaxMs, full.timings[metric].hardMaxMs, `${metric}: потолок отличается от полного`);
      assert.equal(budget.stat, full.timings[metric].stat);
      // Регрессионных коэффициентов в смоке нет: сравнивать не с чем (§5).
      assert.equal(budget.maxRegressionRatio, undefined, `${metric}: в смоке нет относительных лимитов`);
    }
    assert.equal(smoke.longTasks.maxSingleMs, full.longTasks.maxSingleMs);
    assert.equal(smoke.longTasks.maxCountP95, full.longTasks.maxCountP95);
    assert.equal(smoke.longTasks.maxTotalP95Ms, full.longTasks.maxTotalP95Ms);
    assert.deepEqual(smoke.longTaskWindows, full.longTaskWindows);
    assert.equal(smoke.heap.hardMaxGrowthBytes, full.heap.hardMaxGrowthBytes);
    assert.deepEqual(smoke.cacheEntries, full.cacheEntries);
    assert.deepEqual(smoke.renderedDevices, full.renderedDevices);

    // Пригодность для --absolute-only: синтетический отчёт под потолками
    // проходит, первый кадр как у de215578 (9 870 мс) — красный.
    const build = (firstFrame) => ({
      schema: 2, profile: smoke.profile, sourceSha: '1'.repeat(40), buildFingerprint: 'fixture',
      runtime: { node: 'v22.0.0', chromium: '1.2.3', platform: 'linux', arch: 'x64' },
      fixture: { rooms: 60 },
      summary: Object.fromEntries(Object.keys(smoke.timings).map((metric) => {
        const value = metric === 'firstStableRenderMs' ? firstFrame : 1;
        return [metric, { median: value, p95: value, min: value, max: value }];
      })),
      longTasks: { maxSingleMs: 1, countP95: 1, totalP95Ms: 1 },
      ...(smoke.profile === 'large-house-isometric-v1' ? { effectiveProjection: ['iso'] } : {}),
      rows: [0, 1, 2].map(() => ({
        heapGrowthBytes: 1, preciseGc: true,
        longTasks: Object.fromEntries(['load', ...Object.keys(smoke.longTaskWindows ?? {})]
          .map((name) => [name, { supported: true, count: 1, maxMs: 1, totalMs: 1 }])),
        cacheEntries: { ...smoke.cacheEntries },
        cacheGrowth: Object.fromEntries(Object.keys(smoke.cacheGrowth).map((key) => [key, 0])),
        renderedDevices: smoke.renderedDevices,
        ...(smoke.profile === 'large-house-isometric-v1'
          ? {
            effectiveProjection: 'iso',
            isoStructuralBuilds: { supported: true, initial: 1, beforeHaUpdate: 2, afterHaUpdate: 2, haUpdateDelta: 0 },
          } : {}),
      })),
    });
    const ok = evaluatePerformanceBudget({ candidate: build(1), budgets: smoke, absoluteOnly: true });
    assert.deepEqual(ok.failures, [], 'отчёт под потолками обязан проходить');
    const regressed = evaluatePerformanceBudget({ candidate: build(9870), budgets: smoke, absoluteOnly: true });
    assert.ok(regressed.failures.some((check) => check.id === 'timing.firstStableRenderMs.median'),
      'первый кадр 9 870 мс обязан краснеть');
  });
}
