const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
};

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const round = (value, digits = 2) => finite(value) ? Number(value.toFixed(digits)) : value;

export const summarizeTimings = (rows, metricNames) => Object.fromEntries(
  metricNames.map((metric) => {
    const values = rows.map((row) => row[metric]).filter(finite);
    return [metric, {
      median: percentile(values, 0.5),
      p95: percentile(values, 0.95),
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
    }];
  }),
);

export const summarizeLongTasks = (rows) => {
  const totals = [];
  const counts = [];
  const singles = [];
  for (const row of rows) {
    const windows = Object.values(row.longTasks ?? {});
    totals.push(windows.reduce((sum, item) => sum + (item?.totalMs ?? 0), 0));
    counts.push(windows.reduce((sum, item) => sum + (item?.count ?? 0), 0));
    singles.push(...windows.map((item) => item?.maxMs ?? 0));
  }
  return {
    maxSingleMs: round(singles.length ? Math.max(...singles) : 0),
    countP95: percentile(counts, 0.95) ?? 0,
    totalP95Ms: round(percentile(totals, 0.95) ?? 0),
  };
};

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const requireReport = (report, budgets, label) => {
  if (!report || report.schema !== 2) throw new Error(`${label}: unsupported report schema`);
  if (report.profile !== budgets.profile) throw new Error(`${label}: unexpected benchmark profile`);
  if (!Array.isArray(report.rows) || report.rows.length < budgets.minimumSamples) {
    throw new Error(`${label}: expected at least ${budgets.minimumSamples} measured samples`);
  }
};

const relativeLimit = (baseline, ratio, allowance) => Math.max(
  baseline * (1 + ratio),
  baseline + allowance,
);

const makeCheck = (id, actual, limit, details = {}) => ({
  id,
  actual: round(actual),
  limit: round(limit),
  pass: finite(actual) && actual <= limit,
  ...details,
});

/**
 * Evaluate a candidate report against both stable absolute ceilings and a
 * report captured from the base SHA on the same runner.
 */
export const evaluatePerformanceBudget = ({ candidate, baseline, budgets }) => {
  requireReport(candidate, budgets, 'candidate');
  requireReport(baseline, budgets, 'baseline');
  if (!sameJson(candidate.fixture, baseline.fixture)) throw new Error('fixture mismatch');
  for (const key of ['node', 'chromium', 'platform', 'arch']) {
    if (candidate.runtime?.[key] !== baseline.runtime?.[key]) {
      throw new Error(`runtime mismatch for ${key}`);
    }
  }

  const checks = [];
  for (const [metric, budget] of Object.entries(budgets.timings)) {
    const stat = budget.stat ?? 'median';
    const actual = candidate.summary?.[metric]?.[stat];
    const base = baseline.summary?.[metric]?.[stat];
    if (!finite(actual) || !finite(base)) throw new Error(`missing ${stat} for ${metric}`);
    const regressionLimit = relativeLimit(base, budget.maxRegressionRatio, budget.noiseAllowanceMs);
    checks.push(makeCheck(
      `timing.${metric}.${stat}`,
      actual,
      Math.min(budget.hardMaxMs, regressionLimit),
      { baseline: round(base), hardLimit: budget.hardMaxMs, regressionLimit: round(regressionLimit) },
    ));
  }

  const candidateLong = candidate.longTasks ?? summarizeLongTasks(candidate.rows);
  const baselineLong = baseline.longTasks ?? summarizeLongTasks(baseline.rows);
  const longTasksAvailable = candidate.rows.every((row) => {
    const windows = Object.values(row.longTasks ?? {});
    return windows.length > 0 && windows.every((item) => item?.supported === true);
  });
  checks.push({ id: 'longTask.available', actual: longTasksAvailable ? 1 : 0, limit: 1, pass: longTasksAvailable });
  checks.push(makeCheck('longTask.maxSingleMs', candidateLong.maxSingleMs, budgets.longTasks.maxSingleMs));
  checks.push(makeCheck('longTask.countP95', candidateLong.countP95, budgets.longTasks.maxCountP95));
  const longRegressionLimit = relativeLimit(
    baselineLong.totalP95Ms,
    budgets.longTasks.maxTotalRegressionRatio,
    budgets.longTasks.noiseAllowanceMs,
  );
  checks.push(makeCheck(
    'longTask.totalP95Ms',
    candidateLong.totalP95Ms,
    Math.min(budgets.longTasks.maxTotalP95Ms, longRegressionLimit),
    { baseline: baselineLong.totalP95Ms, hardLimit: budgets.longTasks.maxTotalP95Ms },
  ));

  const candidateHeap = candidate.rows
    .map((row) => row.heapGrowthBytes)
    .filter(finite)
    .map((value) => Math.max(0, value));
  const baselineHeap = baseline.rows
    .map((row) => row.heapGrowthBytes)
    .filter(finite)
    .map((value) => Math.max(0, value));
  const preciseGc = candidate.rows.every((row) => row.preciseGc === true);
  checks.push({
    id: 'heap.preciseGc', actual: preciseGc ? 1 : 0, limit: budgets.heap.required ? 1 : 0,
    pass: !budgets.heap.required || preciseGc,
  });
  if (budgets.heap.required && (!candidateHeap.length || !baselineHeap.length)) {
    checks.push({ id: 'heap.available', actual: candidateHeap.length, limit: 1, pass: false });
  } else if (candidateHeap.length && baselineHeap.length) {
    const actual = percentile(candidateHeap, 0.95);
    const base = percentile(baselineHeap, 0.95);
    const regressionLimit = relativeLimit(base, budgets.heap.maxRegressionRatio, budgets.heap.noiseAllowanceBytes);
    checks.push(makeCheck(
      'heap.growthP95Bytes',
      actual,
      Math.min(budgets.heap.hardMaxGrowthBytes, regressionLimit),
      { baseline: base, hardLimit: budgets.heap.hardMaxGrowthBytes },
    ));
  }

  for (const [cache, limit] of Object.entries(budgets.cacheEntries)) {
    const actual = Math.max(...candidate.rows.map((row) => row.cacheEntries?.[cache] ?? Number.POSITIVE_INFINITY));
    checks.push(makeCheck(`cache.entries.${cache}`, actual, limit));
  }
  for (const [cache, limit] of Object.entries(budgets.cacheGrowth)) {
    const actual = Math.max(...candidate.rows.map((row) => row.cacheGrowth?.[cache] ?? Number.POSITIVE_INFINITY));
    checks.push(makeCheck(`cache.growth.${cache}`, actual, limit));
  }

  const renderedDevices = Math.min(...candidate.rows.map((row) => row.renderedDevices ?? -1));
  checks.push({
    id: 'renderedDevices',
    actual: renderedDevices,
    limit: budgets.renderedDevices,
    pass: renderedDevices === budgets.renderedDevices,
  });

  const failures = checks.filter((check) => !check.pass);
  return {
    schema: 1,
    profile: budgets.profile,
    pass: failures.length === 0,
    candidateFingerprint: candidate.buildFingerprint,
    baselineFingerprint: baseline.buildFingerprint,
    checks,
    failures,
  };
};

export const performanceSummaryMarkdown = (evaluation) => {
  const icon = evaluation.pass ? '✅' : '❌';
  const lines = [
    `### ${icon} House Plan large-house performance`,
    '',
    '| Check | Candidate | Limit | Base |',
    '|---|---:|---:|---:|',
  ];
  for (const check of evaluation.checks) {
    lines.push(`| ${check.pass ? '✅' : '❌'} ${check.id} | ${check.actual} | ${check.limit} | ${check.baseline ?? '—'} |`);
  }
  return `${lines.join('\n')}\n`;
};
