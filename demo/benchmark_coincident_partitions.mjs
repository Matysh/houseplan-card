// #276: same-process incremental cost of coincident-partition reconciliation
// inside the complete Optimize candidate pass on the deterministic large house.
import { performance } from 'node:perf_hooks';

import { makeLargeHouseFixture, LARGE_HOUSE_COUNTS } from './fixtures/large-house.mjs';
import { optimizePlans } from '../test-build/plan-optimizer.js';

const WARMUPS = 5;
const SAMPLES = 40;
const RELATIVE_OVERHEAD = 0.15;
const ABSOLUTE_OVERHEAD_MS = 25;

const fixture = makeLargeHouseFixture();
const emptyReconciliation = (rawSpace, _model, walls) => ({
  walls: walls || [],
  partitions: Array.isArray(rawSpace?.partitions) ? rawSpace.partitions : [],
  openings: Array.isArray(rawSpace?.openings) ? rawSpace.openings : [],
  partitionsReconciled: 0,
  openingsRehosted: 0,
});
const baseline = () => optimizePlans(fixture.config, {}, {}, {
  reconcileCoincidentPartitions: emptyReconciliation,
});
const candidate = () => optimizePlans(fixture.config, {});
const timed = (operation) => {
  const start = performance.now();
  const result = operation();
  if (!result || !result.report) throw new Error('Optimize candidate returned no report');
  return performance.now() - start;
};
for (let index = 0; index < WARMUPS; index++) {
  baseline();
  candidate();
}

const baselineTimes = [];
const candidateTimes = [];
const overheadTimes = [];
for (let index = 0; index < SAMPLES; index++) {
  const candidateFirst = index % 2 === 1;
  const first = timed(candidateFirst ? candidate : baseline);
  const second = timed(candidateFirst ? baseline : candidate);
  const baselineMs = candidateFirst ? second : first;
  const candidateMs = candidateFirst ? first : second;
  baselineTimes.push(baselineMs);
  candidateTimes.push(candidateMs);
  overheadTimes.push(candidateMs - baselineMs);
}

const quantile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
};
const summary = (values) => ({
  min: Math.min(...values),
  median: quantile(values, 0.5),
  p95: quantile(values, 0.95),
  max: Math.max(...values),
});
const baselineSummary = summary(baselineTimes);
const candidateSummary = summary(candidateTimes);
const overheadSummary = summary(overheadTimes);
const measuredOverheadP95 = Math.max(0, candidateSummary.p95 - baselineSummary.p95);
const relativeP95 = measuredOverheadP95
  / Math.max(baselineSummary.p95, Number.EPSILON);
const pass = measuredOverheadP95 <= ABSOLUTE_OVERHEAD_MS
  && relativeP95 <= RELATIVE_OVERHEAD;
const report = {
  issue: 276,
  fixture: LARGE_HOUSE_COUNTS,
  warmups: WARMUPS,
  samples: SAMPLES,
  baseline: baselineSummary,
  candidate: candidateSummary,
  pairedOverhead: overheadSummary,
  budgets: {
    relativeOverhead: RELATIVE_OVERHEAD,
    absoluteOverheadMs: ABSOLUTE_OVERHEAD_MS,
  },
  measured: { overheadP95Ms: measuredOverheadP95, relativeP95 },
  pass,
};
console.log(JSON.stringify(report, null, 2));
if (!pass) process.exitCode = 1;
