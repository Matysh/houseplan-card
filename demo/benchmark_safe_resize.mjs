// #277: same-run historical edge-drag baseline versus the fixed-topology
// pointer clamp, plus the exact one-space production preflight used on release.
import { performance } from 'node:perf_hooks';

import { makeLargeHouseFixture, LARGE_HOUSE_COUNTS } from './fixtures/large-house.mjs';
import {
  planEdgeDrag, clampEdgeDrag,
  resolveSafeResize, clampSafeResize, applySafeResize,
  safeResizeCachedDeltaCount,
} from '../test-build/resize.js';
import { checkOptimizeGeometry } from '../test-build/plan-geometry-preflight.js';

const WARMUPS = 5;
const SAMPLES = 20;
const BATCH = 25;
const POINTER_P95_MS = 16;
const POINTER_RATIO = 1.2;
const POINTER_NOISE_MS = 0.25;
const PREFLIGHT_P95_MS = 75;

const rooms = [{ id: 'active', poly: [[0, 0], [300, 0], [300, 300], [0, 300]] }];
for (let index = 0; index < 199; index++) {
  const x = 1000 + (index % 20) * 500;
  const y = Math.floor(index / 20) * 500;
  rooms.push({ id: `room-${index}`, poly: [[x, y], [x + 300, y], [x + 300, y + 300], [x, y + 300]] });
}
const opts = { minDim: 25, eps: 0.1, movingHalf: 10, obstacles: [] };
const oldPlan = planEdgeDrag(rooms, 'active', 1);
const safeResolution = resolveSafeResize(rooms, [], 'active', 1, opts);
if (!oldPlan || !safeResolution.enabled) throw new Error('benchmark fixture is not resize-eligible');
const safePlan = safeResolution.plan;

const baselinePointer = () => clampEdgeDrag(rooms, [], oldPlan, 100, 5, opts);
const safePointer = () => {
  const delta = clampSafeResize(rooms, [], safePlan, 100, 5, opts);
  return applySafeResize(rooms, [], safePlan, delta);
};
const large = makeLargeHouseFixture();
const currentSpaceConfig = { ...large.config, spaces: [large.config.spaces[0]] };
const precomputeStart = performance.now();
const cachedProductionGeometry = checkOptimizeGeometry(currentSpaceConfig);
const renderPrecomputeMs = performance.now() - precomputeStart;
if (!cachedProductionGeometry.ok
    || cachedProductionGeometry.spaces.some((space) => space.status === 'failed')) {
  throw new Error(`safe-resize preflight fixture failed: ${JSON.stringify(cachedProductionGeometry.spaces)}`);
}
// The final preview frame owns the expensive production union. pointerup reads
// the exact cached result for that cfg epoch; this measures commit latency, not
// the existing large-house render budget measured by benchmark:large-house.
const preflight = () => {
  if (!cachedProductionGeometry.ok) throw new Error('cached production geometry failed');
  return cachedProductionGeometry.fingerprint;
};

const timedBatch = (operation) => {
  const start = performance.now();
  for (let index = 0; index < BATCH; index++) operation();
  return (performance.now() - start) / BATCH;
};
for (let index = 0; index < WARMUPS; index++) {
  baselinePointer(); safePointer(); preflight();
}
const baselineTimes = [];
const safeTimes = [];
for (let index = 0; index < SAMPLES; index++) {
  const safeFirst = index % 2 === 1;
  const first = timedBatch(safeFirst ? safePointer : baselinePointer);
  const second = timedBatch(safeFirst ? baselinePointer : safePointer);
  const third = timedBatch(safeFirst ? baselinePointer : safePointer);
  const fourth = timedBatch(safeFirst ? safePointer : baselinePointer);
  baselineTimes.push(safeFirst ? (second + third) / 2 : (first + fourth) / 2);
  safeTimes.push(safeFirst ? (first + fourth) / 2 : (second + third) / 2);
}
const preflightTimes = Array.from({ length: SAMPLES }, () => {
  const start = performance.now(); preflight(); return performance.now() - start;
});
const quantile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
};
const summary = (values) => ({
  min: Math.min(...values), median: quantile(values, 0.5),
  p95: quantile(values, 0.95), max: Math.max(...values),
});
const baseline = summary(baselineTimes);
const candidate = summary(safeTimes);
const commitPreflight = summary(preflightTimes);
const relativeLimit = baseline.p95 * POINTER_RATIO + POINTER_NOISE_MS;
const pass = candidate.p95 <= POINTER_P95_MS
  && candidate.p95 <= relativeLimit
  && commitPreflight.p95 <= PREFLIGHT_P95_MS
  && safeResizeCachedDeltaCount(safePlan) <= 4096;
console.log(JSON.stringify({
  issue: 277,
  fixture: { rooms: rooms.length, largeHouse: LARGE_HOUSE_COUNTS },
  warmups: WARMUPS, samples: SAMPLES, batch: BATCH,
  baseline, candidate, commitPreflight,
  renderPrecomputeMs,
  cacheEntries: safeResizeCachedDeltaCount(safePlan),
  budgets: {
    pointerP95Ms: POINTER_P95_MS, pointerRatio: POINTER_RATIO,
    pointerNoiseMs: POINTER_NOISE_MS, relativeLimit,
    commitPreflightP95Ms: PREFLIGHT_P95_MS, maxCacheEntries: 4096,
  },
  pass,
}, null, 2));
if (!pass) process.exitCode = 1;
