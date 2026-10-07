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

test('isometric reports fail closed on exact SHA, effective projection and current Stage 4 metadata', () => {
  const isoBudgets = { ...budgets, profile: 'isometric-stage3-dense-v1' };
  const valid = report();
  Object.assign(valid, {
    profile: isoBudgets.profile,
    effectiveProjection: ['iso'],
    isoStageRevision: ['4'],
    stage3Required: true,
  });
  valid.rows.forEach((row) => Object.assign(row, {
    effectiveProjection: 'iso', isoStageRevision: '4',
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
    }), /sourceSha|effectiveProjection|Stage 4|structural build count/);
  }
  assert.throws(() => evaluatePerformanceBudget({
    baseline, candidate: valid, budgets: isoBudgets, candidateSha: 'f'.repeat(40),
  }), /sourceSha does not match/);
});

test('#743 backdrop candidate renders a warm 2.5D floor switch in one update pass', () => {
  const backdropBudgets = { ...budgets, profile: 'large-house-isometric-backdrop-v1' };
  const withPasses = (sourceSha, perSwitch) => {
    const value = report();
    Object.assign(value, { profile: backdropBudgets.profile, sourceSha, effectiveProjection: ['iso'] });
    value.rows.forEach((row) => Object.assign(row, {
      effectiveProjection: 'iso',
      isoStructuralBuilds: {
        supported: true, initial: 1, beforeHaUpdate: 2, afterHaUpdate: 2, haUpdateDelta: 0,
      },
      ...(perSwitch ? { floorSwitchPasses: { supported: true, perSwitch: [...perSwitch] } } : {}),
    }));
    return value;
  };
  const evaluate = (candidate, baseline) => evaluatePerformanceBudget({
    baseline, candidate, budgets: backdropBudgets,
    baselineSha: baseline.sourceSha, candidateSha: candidate.sourceSha,
  });
  // The base is reported, not judged: before #739 (v1.78.0 too) it takes two passes.
  const base = withPasses('2'.repeat(40), [2, 2]);
  assert.equal(evaluate(withPasses('1'.repeat(40), [1, 1, 1, 1, 1, 1]), base).pass, true);

  const twice = withPasses('1'.repeat(40), [1, 2]);
  assert.throws(() => evaluate(twice, base),
    /^Error: candidate: a warm 2\.5D floor switch with a backdrop took 2 update passes$/);
  const oneRowTwice = withPasses('1'.repeat(40), [1, 1]);
  oneRowTwice.rows[1].floorSwitchPasses.perSwitch = [1, 2];
  assert.throws(() => evaluate(oneRowTwice, base), /took 2 update passes/, 'every sample is judged');

  for (const mutate of [
    (candidate) => { delete candidate.rows[0].floorSwitchPasses; },
    (candidate) => { candidate.rows[0].floorSwitchPasses.supported = false; },
    (candidate) => { candidate.rows[0].floorSwitchPasses.perSwitch = []; },
  ]) {
    const candidate = withPasses('1'.repeat(40), [1, 1]);
    mutate(candidate);
    assert.throws(() => evaluate(candidate, base), /candidate: floor switch update passes are missing/);
  }
  assert.throws(() => evaluate(withPasses('1'.repeat(40), null), base),
    /candidate: floor switch update passes are missing/, 'a candidate report without the probe fails closed');
  // The twin is an isometric profile: exact SHA and effective Iso are required as well.
  const flat = withPasses('1'.repeat(40), [1, 1]);
  flat.effectiveProjection = ['flat'];
  assert.throws(() => evaluate(flat, base), /effectiveProjection is not exclusively iso/);
  const unpinned = withPasses(null, [1, 1]);
  assert.throws(() => evaluatePerformanceBudget({ baseline: base, candidate: unpinned, budgets: backdropBudgets }),
    /candidate: missing exact sourceSha/);
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

// Синтетический отчёт для `compare --absolute-only`: все метрики по 1 мс,
// кроме переданных в `timings`.
const absoluteSmokeReport = (smoke, timings = {}) => ({
  schema: 2, profile: smoke.profile, sourceSha: '1'.repeat(40), buildFingerprint: 'fixture',
  runtime: { node: 'v22.0.0', chromium: '1.2.3', platform: 'linux', arch: 'x64' },
  fixture: { rooms: 60 },
  summary: Object.fromEntries(Object.keys(smoke.timings).map((metric) => {
    const value = timings[metric] ?? 1;
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
    const ok = evaluatePerformanceBudget({ candidate: absoluteSmokeReport(smoke), budgets: smoke, absoluteOnly: true });
    assert.deepEqual(ok.failures, [], 'отчёт под потолками обязан проходить');
    const regressed = evaluatePerformanceBudget({
      candidate: absoluteSmokeReport(smoke, { firstStableRenderMs: 9870 }), budgets: smoke, absoluteOnly: true,
    });
    assert.ok(regressed.failures.some((check) => check.id === 'timing.firstStableRenderMs.median'),
      'первый кадр 9 870 мс обязан краснеть');
  });
}

test('#692 первый стабильный кадр interaction: потолок над уровнем 1.78 с запасом на шум раннера', () => {
  const smoke = readBudget('budgets-interaction-smoke.json');
  const full = readBudget('budgets-large-house-interaction.json');
  const ceiling = full.timings.firstStableRenderMs.hardMaxMs;
  assert.equal(ceiling, 3400);
  assert.equal(smoke.timings.firstStableRenderMs.hardMaxMs, ceiling, 'смок = полный профиль (#473 AC4)');
  // Медианы полного профиля (7 образцов) из performance.yml: линия 1.77 и v1.78.0.
  const level177 = [2769.0, 2838.2, 2777.3, 2801.7];
  const level178 = [2925.0, 2925.2];
  const worst = 3144.8; // тот же SHA v1.78.0, соседний прогон — шум раннера до 7,5 %
  for (const median of [...level177, ...level178, worst]) assert.ok(median < ceiling, `${median} краснеет на ${ceiling}`);
  assert.ok(ceiling >= Math.max(...level178) * 1.15, 'запас над уровнем 1.78 не меньше 15 %');
  assert.ok(ceiling <= Math.max(...level178) * 1.2, 'и не больше 20 %: потолок остаётся гардом');
  // Относительное сравнение полного профиля не ослаблено.
  assert.equal(full.timings.firstStableRenderMs.maxRegressionRatio, 0.3);
  assert.equal(full.timings.firstStableRenderMs.noiseAllowanceMs, 250);
});

test('interaction aggregate keeps hosted-runner headroom without weakening component gates (#483)', () => {
  const smoke = readBudget('budgets-interaction-smoke.json');
  const full = readBudget('budgets-large-house-interaction.json');
  assert.equal(smoke.timings.interactionSeriesMs.hardMaxMs, 3300);
  assert.equal(full.timings.interactionSeriesMs.hardMaxMs, 3300);
  assert.equal(smoke.timings.hoverSeriesMs.hardMaxMs, 500);
  assert.equal(smoke.timings.panSeriesMs.hardMaxMs, 500);
  assert.equal(smoke.timings.cameraSeriesMs.hardMaxMs, 500);
  assert.equal(smoke.timings.editorSeriesMs.hardMaxMs, 750);
});

// #675: обоснование потолка и ряд замеров — demo/performance/README.md,
// «CI contracts». Три файла держат одно число: смок повторяет полный профиль
// (#473 AC4), плотный двойник — исторический (#160).
test('isometric space switch ceiling covers the 2.5D runner level and still catches #583 (#675)', () => {
  const files = [
    'budgets-isometric-smoke.json',
    'budgets-large-house-isometric.json',
    'budgets-isometric-stage3-dense.json',
  ];
  for (const file of files)
    assert.equal(readBudget(file).timings.spaceSwitchMs.hardMaxMs, 2200, `${file}: общий потолок spaceSwitchMs`);
  const smoke = readBudget('budgets-isometric-smoke.json');
  const red = (ms) => evaluatePerformanceBudget({
    candidate: absoluteSmokeReport(smoke, { spaceSwitchMs: ms }), budgets: smoke, absoluteOnly: true,
  }).failures.some((check) => check.id === 'timing.spaceSwitchMs.median');
  assert.equal(red(1867.7), false, 'максимум уровня 2.5D на hosted-раннере (прогон 36306131709) проходит');
  assert.equal(red(2719.6), true, 'провал #583 до решётки (прогон 35070397356) краснеет и по spaceSwitchMs');
  assert.equal(red(2 * 1798.3), true, 'удвоение текущего уровня краснеет');
  // Потолок — не детектор тренда: полный прогон по-прежнему сравнивает с базой
  // того же раннера, и рычагом не стали ни коэффициент, ни допуск.
  for (const file of files.slice(1)) {
    const budget = readBudget(file).timings.spaceSwitchMs;
    assert.equal(budget.maxRegressionRatio, 0.2, `${file}: коэффициент не рычаг`);
    assert.equal(budget.noiseAllowanceMs, 100, `${file}: допуск не рычаг`);
  }
});

// #747: обоснование потолков `switchCycleMs` и ряд — demo/performance/README.md,
// «CI contracts». Ряд — медианы Full Performance после #735 (7 образцов, обе
// стороны: база меряется раннером кандидата, окно тёплое) в порядке
// [база, кандидат] прогонов 36821241343 (#735, база 76558bf2), 36838891001
// (#740), 36838952536 (#742), 36839009721 (#739); у трёх последних база —
// `dev` 7ff2b5ae. Смоковых медиан (3 образца) в ряду пока нет.
const SWITCH_CYCLE_FAMILIES = {
  flat: {
    ceiling: 950,
    smoke: 'budgets-interaction-smoke.json',
    files: ['budgets.json', 'budgets-large-house-plan-snap.json', 'budgets-large-house-interaction.json',
      'budgets-interaction-smoke.json'],
    full: { maxRegressionRatio: 0.35, noiseAllowanceMs: 250 },
    medians: {
      'large-house-v1': [733.4, 683.3, 812.7, 749.9, 750.3, 800, 716.7, 717.9],
      'large-house-plan-snap-v1': [716.7, 700.1, 762.6, 701, 733.3, 783.2, 749.9, 750.8],
      'large-house-interaction-v1': [716.1, 754.1, 766.5, 666.9, 720.3, 750.1, 700.4, 703.4],
    },
  },
  isometric: {
    ceiling: 1550,
    smoke: 'budgets-isometric-smoke.json',
    files: ['budgets-large-house-isometric.json', 'budgets-isometric-stage3-dense.json',
      'budgets-large-house-isometric-backdrop.json', 'budgets-isometric-smoke.json'],
    full: { maxRegressionRatio: 0.2, noiseAllowanceMs: 250 },
    medians: {
      'large-house-isometric-v1': [1069.5, 1051, 866.5, 766.5, 1134.9, 1100.4, 1135.7, 1089],
      'isometric-stage3-dense-v1': [966.7, 983.2, 982.4, 916.5, 1249.7, 1333.9, 849.9, 803.6],
    },
  },
};

test('#812 AC8: the backdrop twin participates in the shared 2.5D switch-cycle contract', () => {
  assert.ok(SWITCH_CYCLE_FAMILIES.isometric.files.includes('budgets-large-house-isometric-backdrop.json'));
});

for (const [family, spec] of Object.entries(SWITCH_CYCLE_FAMILIES)) {
  test(`#747 switchCycleMs (${family}): потолок над тёплым уровнем после #735 с запасом на шум раннера`, () => {
    // Одно число на семью: смок = полный (#473 AC4), plan-snap и interaction
    // сохраняют потолки large-house-v1, плотный двойник — исторические (#160).
    for (const file of spec.files) {
      const budget = readBudget(file).timings.switchCycleMs;
      assert.equal(budget.hardMaxMs, spec.ceiling, `${file}: общий потолок switchCycleMs семьи ${family}`);
      assert.equal(budget.stat, 'median', `${file}: метрика — медиана, как у соседей`);
    }
    const smoke = readBudget(spec.smoke);
    const red = (ms) => evaluatePerformanceBudget({
      candidate: absoluteSmokeReport(smoke, { switchCycleMs: ms }), budgets: smoke, absoluteOnly: true,
    }).failures.some((check) => check.id === 'timing.switchCycleMs.median');
    const series = Object.values(spec.medians).flat();
    for (const median of series) assert.equal(red(median), false, `${median} из ряда краснеет на ${spec.ceiling}`);
    const level = Math.max(...series);
    // Правило #747: первое кратное 50 мс не ниже 1.15 × M и не выше 1.2 × M —
    // полоса #692, в которую попадает и #675.
    assert.equal(spec.ceiling, Math.ceil((level * 1.15) / 50) * 50, `потолок — первое кратное 50 над 1.15 × ${level}`);
    assert.ok(spec.ceiling >= level * 1.15, 'запас над максимумом ряда не меньше 15 %');
    assert.ok(spec.ceiling <= level * 1.2, 'и не больше 20 %: потолок остаётся гардом');
    assert.equal(red(2 * level), true, 'удвоение уровня краснеет');
    // Меньшее ловит относительное сравнение полного прогона: его коэффициент и
    // допуск не рычаг.
    for (const file of spec.files.filter((name) => name !== spec.smoke)) {
      const budget = readBudget(file).timings.switchCycleMs;
      assert.equal(budget.maxRegressionRatio, spec.full.maxRegressionRatio, `${file}: коэффициент не рычаг`);
      assert.equal(budget.noiseAllowanceMs, spec.full.noiseAllowanceMs, `${file}: допуск не рычаг`);
    }
  });
}

// #770: обоснование потолков `longTasks.maxCountP95` / `maxTotalP95Ms` и ряд —
// demo/performance/README.md, «CI contracts». Суммы Long Task — по всем окнам
// образца, и окно `switchCycle` после #735 тёплое, поэтому прежние 30 / 12000
// стояли в 1,25–3,2 раза над уровнем. Ряд — все прогоны Full Performance
// 01–05.10 (раннер кандидата содержит #735 во всех), обе стороны, 7 образцов,
// один тип раннера (linux x64, Chromium 151.0.7922.34, Node 22.23.3), в порядке
// [база, кандидат] прогонов 36883292495, 36904753178, 36904816677, 36905707715,
// 36905760140, 37055609391, 37062790080, 37065283633, 37134606046, 37136641943,
// 37149329461 (только кандидат), 37176616088, 37203867985, 37302579095. Точка —
// то, что судит потолок: p95 ближайшего ранга по 7 образцам, то есть максимум.
// База 37149329461 — v1.78.0 (7d4d75bd, 28.09, до #735 и тёплых работ
// #694/#725/#739): на том же раннере она в 1,2–2 раза медленнее кандидата, это
// код, а не шум, и в M она не входит — это известный более медленный вариант.
// Смоковая точка (3 образца) — 36910217188, interaction, adc2d7c5.
const LONG_TASK_FAMILIES = {
  flat: {
    count: 18, total: 4350,
    smoke: 'budgets-interaction-smoke.json',
    files: ['budgets.json', 'budgets-large-house-plan-snap.json', 'budgets-large-house-interaction.json',
      'budgets-interaction-smoke.json'],
    full: { maxCountRegressionRatio: 0.35, countNoiseAllowance: 3, maxTotalRegressionRatio: 0.3, noiseAllowanceMs: 150 },
    series: {
      'large-house-v1': {
        count: [12, 11, 11, 10, 11, 12, 9, 7, 11, 12, 10, 9, 9, 9, 10, 11, 9, 9, 8, 8, 10, 10, 10, 13, 9, 10, 10],
        total: [3301, 3101, 3068, 2825, 3140, 2994, 2269, 2108, 2948, 2927, 2923, 2811, 2803, 2781, 3047, 3140,
          2823, 2748, 2183, 2128, 2836, 2852, 2826, 3133, 2759, 2823, 2818],
      },
      'large-house-plan-snap-v1': {
        count: [8, 7, 14, 14, 14, 14, 14, 13, 14, 14, 14, 14, 12, 12, 8, 9, 14, 14, 14, 12, 6, 14, 13, 15, 12, 13, 13],
        total: [1752, 1647, 3550, 3323, 3498, 3610, 3546, 3313, 3418, 3433, 3759, 3433, 3192, 3179, 2327, 2359,
          3387, 3411, 3416, 3296, 1798, 3407, 3400, 3509, 3157, 3266, 3279],
      },
      'large-house-interaction-v1': {
        count: [11, 12, 11, 10, 12, 12, 13, 12, 12, 13, 10, 10, 13, 11, 12, 13, 11, 11, 12, 12, 12, 5, 5, 13, 12, 11, 11],
        total: [3104, 3240, 3116, 2851, 3142, 3105, 3159, 3038, 3112, 3208, 2450, 2270, 3056, 2919, 3242, 3289,
          2895, 2864, 3203, 3046, 2957, 1480, 1558, 3111, 3057, 2671, 2676],
      },
    },
    smokePoints: [{ count: 12, total: 3047 }],
    slower: {
      'large-house-v1': { count: 17, total: 3959 },
      'large-house-plan-snap-v1': { count: 12, total: 2562 },
      'large-house-interaction-v1': { count: 16, total: 3660 },
    },
  },
  isometric: {
    count: 28, total: 6850,
    smoke: 'budgets-isometric-smoke.json',
    files: ['budgets-large-house-isometric.json', 'budgets-isometric-stage3-dense.json',
      'budgets-large-house-isometric-backdrop.json', 'budgets-isometric-smoke.json'],
    full: { maxCountRegressionRatio: 0.2, countNoiseAllowance: 5, maxTotalRegressionRatio: 0.2, noiseAllowanceMs: 150 },
    series: {
      'large-house-isometric-v1': {
        count: [15, 16, 21, 21, 20, 21, 20, 20, 21, 22, 19, 20, 20, 21, 21, 21, 14, 14, 12, 15, 19, 21, 20, 12, 12, 20, 21],
        total: [3713, 3543, 4944, 5088, 5104, 5022, 4135, 3956, 5101, 5078, 4618, 4709, 4816, 4754, 4831, 4889,
          3525, 3404, 2651, 2854, 4761, 4812, 5073, 2571, 2569, 4926, 4978],
      },
      'isometric-stage3-dense-v1': {
        count: [23, 24, 23, 23, 23, 24, 23, 23, 23, 23, 24, 23, 23, 23, 24, 23, 23, 23, 23, 23, 23, 23, 20, 23, 22, 21, 21],
        total: [5670, 5769, 5480, 5458, 5618, 5935, 5935, 5492, 5645, 5527, 5520, 5643, 5375, 5407, 5894, 5555,
          5740, 5502, 5488, 5516, 5627, 4380, 4181, 5419, 5474, 4088, 4086],
      },
      'large-house-isometric-backdrop-v1': {
        count: [21, 21, 20, 21, 21, 22, 12, 12, 21, 21, 20, 22, 20, 21, 21, 22, 13, 12, 22, 21, 11, 21, 20, 22, 20, 12, 14],
        total: [4946, 4887, 4736, 4816, 5331, 5182, 2694, 2524, 5010, 5014, 5086, 4931, 4748, 4907, 5286, 4975,
          2913, 2698, 5158, 5160, 2634, 5036, 5026, 5034, 4908, 2591, 2669],
      },
    },
    smokePoints: [],
    slower: {
      'large-house-isometric-v1': { count: 24, total: 6783 },
      'isometric-stage3-dense-v1': { count: 27, total: 8754 },
      'large-house-isometric-backdrop-v1': { count: 22, total: 5159 },
    },
  },
};

for (const [family, spec] of Object.entries(LONG_TASK_FAMILIES)) {
  test(`#770 Long Task count/total (${family}): потолки над тёплым уровнем после #735 с запасом на шум раннера`, () => {
    // Одно число на семью, как у #747: смок = полный (#473 AC4), plan-snap и
    // interaction — потолки large-house-v1, двойники — исторические (#160, #743).
    for (const file of spec.files) {
      const { longTasks } = readBudget(file);
      assert.equal(longTasks.maxCountP95, spec.count, `${file}: общий потолок числа Long Task семьи ${family}`);
      assert.equal(longTasks.maxTotalP95Ms, spec.total, `${file}: общий потолок суммы Long Task семьи ${family}`);
      // Ужесточение, а не ослабление: прежние 30 / 12000 #770 только опускает.
      assert.ok(longTasks.maxCountP95 < 30 && longTasks.maxTotalP95Ms < 12000, `${file}: потолок не ниже прежнего`);
    }
    const smoke = readBudget(spec.smoke);
    const failures = (count, total) => evaluatePerformanceBudget({
      candidate: { ...absoluteSmokeReport(smoke), longTasks: { maxSingleMs: 1, countP95: count, totalP95Ms: total } },
      budgets: smoke, absoluteOnly: true,
    }).failures.map((check) => check.id);
    const counts = Object.values(spec.series).flatMap((series) => series.count);
    const totals = Object.values(spec.series).flatMap((series) => series.total);
    for (const series of Object.values(spec.series)) {
      assert.equal(series.count.length, 27, 'ряд — 14 прогонов × 2 стороны без базы v1.78.0');
      assert.equal(series.total.length, 27);
      series.count.forEach((count, index) => assert.deepEqual(failures(count, series.total[index]), [],
        `${count} / ${series.total[index]} из ряда краснеет на ${spec.count} / ${spec.total}`));
    }
    for (const { count, total } of spec.smokePoints) assert.deepEqual(failures(count, total), [], 'смоковая точка');
    // Правило #747 для обеих метрик: первый шаг (1 задача, 50 мс) не ниже
    // 1.15 × M и не выше 1.2 × M, M — максимум ряда семьи.
    const maxCount = Math.max(...counts);
    const maxTotal = Math.max(...totals);
    assert.equal(spec.count, Math.ceil(maxCount * 1.15), `число — первое целое над 1.15 × ${maxCount}`);
    assert.equal(spec.total, Math.ceil((maxTotal * 1.15) / 50) * 50, `сумма — первое кратное 50 над 1.15 × ${maxTotal}`);
    assert.ok(spec.count >= maxCount * 1.15 && spec.count <= maxCount * 1.2, 'число: запас 15–20 %');
    assert.ok(spec.total >= maxTotal * 1.15 && spec.total <= maxTotal * 1.2, 'сумма: запас 15–20 %');
    assert.deepEqual(failures(2 * maxCount, 1), ['longTask.countP95'], 'удвоение числа краснеет');
    assert.deepEqual(failures(1, 2 * maxTotal), ['longTask.totalP95Ms'], 'удвоение суммы краснеет');
    // Известный более медленный вариант — база v1.78.0 того же раннера: в M не
    // входит. Возврат плотного двойника к её сумме (8754 мс) потолок ловит;
    // остальные её точки ниже потолков — их ловит относительное сравнение.
    for (const [profile, { count, total }] of Object.entries(spec.slower)) {
      const expected = profile === 'isometric-stage3-dense-v1' ? ['longTask.totalP95Ms'] : [];
      assert.deepEqual(failures(count, total), expected, `${profile} v1.78.0: ${count} / ${total}`);
    }
    // Меньшее ловит относительное сравнение полного прогона: его коэффициенты и
    // допуски не рычаг.
    for (const file of spec.files.filter((name) => name !== spec.smoke)) {
      const { longTasks } = readBudget(file);
      for (const [key, value] of Object.entries(spec.full)) assert.equal(longTasks[key], value, `${file}: ${key} не рычаг`);
    }
  });
}

test('boundary collision search restores the ordinary isometric allowances (#585)', () => {
  const isometric = readBudget('budgets-large-house-isometric.json');
  const dense = readBudget('budgets-isometric-stage3-dense.json');
  // v1.76.0 temporarily widened exactly these three allowances after #583.
  // The boundary-event search retires that exception; the twin profiles keep
  // their shared Stage 3/4 contract and the ordinary pre-exception values.
  assert.equal(isometric.timings.resizePreviewMs.noiseAllowanceMs, 150);
  assert.equal(isometric.timings.panZoomMs.noiseAllowanceMs, 60);
  assert.equal(isometric.timings.stateUpdateMs.noiseAllowanceMs, 75,
    'профили-близнецы обязаны совпадать по общим метрикам (#160)');
  assert.equal(dense.timings.stateUpdateMs.noiseAllowanceMs, 75);
  assert.equal(dense.timings.resizePreviewMs.noiseAllowanceMs, 150);
  assert.equal(dense.timings.panZoomMs.noiseAllowanceMs, 60);
  for (const budget of [isometric, dense]) {
    for (const metric of ['resizePreviewMs', 'panZoomMs', 'stateUpdateMs']) {
      assert.equal(budget.timings[metric].maxRegressionRatio, 0.2, 'коэффициент не рычаг');
    }
    assert.equal(budget.timings.resizePreviewMs.hardMaxMs, 2200, 'абсолютный потолок не двигался');
    assert.equal(budget.timings.panZoomMs.hardMaxMs, 600);
    assert.equal(budget.timings.modelReadyMs.noiseAllowanceMs, 200, 'загрузка допуска не получала');
    assert.equal(budget.timings.spaceSwitchMs.noiseAllowanceMs, 100);
  }
  for (const file of ['budgets.json', 'budgets-large-house-plan-snap.json', 'budgets-large-house-interaction.json']) {
    const other = readBudget(file);
    assert.equal(other.timings.panZoomMs.noiseAllowanceMs, 60, `${file} допуска жеста не получал`);
    assert.equal(other.timings.resizePreviewMs.noiseAllowanceMs, 150, `${file} допуска ресайза не получал`);
  }
});

test('isometric long-task count allowance covers the lazy iso-chunk split, nothing else (#507)', () => {
  const isometric = readBudget('budgets-large-house-isometric.json');
  assert.equal(isometric.longTasks.countNoiseAllowance, 5, 'owner-accepted +2 tasks of the lazy iso-scene-render split plus jitter');
  assert.equal(isometric.longTasks.maxCountRegressionRatio, 0.2, 'the ratio is not the lever');
  // #770: the family ceiling, above the 21 the allowance yields for that base,
  // so the relative half still decides this comparison.
  assert.equal(isometric.longTasks.maxCountP95, 28);
  assert.equal(isometric.longTasks.maxTotalRegressionRatio, 0.2, 'total work is still gated as before');
  assert.equal(isometric.longTasks.maxSingleRegressionRatio, 0.2);
  assert.equal(readBudget('budgets-isometric-stage3-dense.json').longTasks.countNoiseAllowance, 5, 'the dense twin shares the lazy iso chunk and the #160 common-ceiling contract');
  for (const file of ['budgets.json', 'budgets-large-house-plan-snap.json', 'budgets-large-house-interaction.json']) {
    assert.equal(readBudget(file).longTasks.countNoiseAllowance, 3, `${file} keeps the ordinary allowance`);
  }
  // The v1.73.0 stable comparison against v1.72.0: 16 → 20 passes, 22 does not.
  const limit = Math.max(16 * (1 + isometric.longTasks.maxCountRegressionRatio), 16 + isometric.longTasks.countNoiseAllowance);
  assert.equal(limit, 21);
});

test('#720: the 2.5D view toggle is reported, not budgeted (owner decision in #694)', () => {
  // A one-off settings operation, and since #649 the runner measures a full
  // config reload for the candidate but a per-device projection flip for
  // v1.77.0 — not the same operation. Load, floor switch and the single
  // long-task ceiling keep gating the 2.5D scene build and UI freezes.
  for (const name of [
    'budgets-isometric-smoke.json',
    'budgets-large-house-isometric.json',
    'budgets-isometric-stage3-dense.json',
    'budgets-large-house-isometric-backdrop.json',
  ]) {
    const budget = readBudget(name);
    assert.equal('viewToggleMs' in budget.timings, false, `${name} budgets viewToggleMs`);
    for (const metric of ['modelReadyMs', 'firstStableRenderMs', 'spaceSwitchMs'])
      assert.ok(budget.timings[metric], `${name} keeps ${metric}`);
    assert.ok(budget.longTasks.maxSingleMs > 0, `${name} keeps the single long-task ceiling`);
  }
  const runner = readFileSync(new URL('../demo/benchmark_large_house.mjs', import.meta.url), 'utf8');
  assert.match(runner, /if \(isometric\) metricNames\.splice\(2, 0, 'viewToggleMs'\);/,
    'the runner still reports the toggle');
});
