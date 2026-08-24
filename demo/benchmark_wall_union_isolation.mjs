// #278: component projection overhead and degraded-fixture completion budget.
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';

import { makeLargeHouseFixture, LARGE_HOUSE_COUNTS } from './fixtures/large-house.mjs';
import { prepareSpacePhysicalGeometryInputs } from '../test-build/plan-geometry-preflight.js';
import { spaceModels } from '../test-build/space-geometry.js';
import {
  polyclipToPathD, wallBodiesGeometry, wallBodiesUnionPath,
} from '../test-build/wall-thickness.js';

const WARMUPS = 3;
const SAMPLES = 50;
// One projection is sub-millisecond. Time a batch and report per-operation
// cost so scheduler/timer quantisation cannot dominate the 10% relative gate.
const VALID_BATCH = 100;
const RELATIVE_RATIO = 1.1;
const OVERHEAD_P95_MS = 20;
const DEGRADED_P95_MS = 100;

const prepare = (config) => {
  const models = spaceModels(config);
  return config.spaces.map((space, index) =>
    prepareSpacePhysicalGeometryInputs(space, models[index]));
};
const args = (input) => [
  input.space.rooms, input.walls, input.openCuts, input.roomOpenings,
  input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordScale,
  input.physicalBodies,
];
const large = makeLargeHouseFixture();
const validInputs = prepare(large.config);
const degradedFixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/278-wall-union-isolation.json', import.meta.url), 'utf8',
));
const degradedInput = prepare(degradedFixture.config)[0];

const validResults = validInputs.map((input) => wallBodiesGeometry(...args(input)));
if (validResults.some((result) => result.status !== 'ok'))
  throw new Error(`valid geometry: ${validResults.map((result) => result.status).join(',')}`);
const validGeometry = () => {
  for (const result of validResults) {
    // The previous production projection also serialized primary + paper.
    if (!polyclipToPathD(result.geom) || !polyclipToPathD(result.paperGeom))
      throw new Error('valid legacy projection');
  }
};
const validProjection = () => {
  for (const result of validResults) {
    const paths = result.components.map((component) => polyclipToPathD(component.geom));
    const paper = polyclipToPathD(result.paperGeom);
    if (!paths.length || paths.some((path) => !path) || !paper)
      throw new Error('valid component projection');
  }
};
const degradedProjection = () => {
  const result = wallBodiesUnionPath(...args(degradedInput));
  if (!result || result.status !== 'degraded-extra' || result.paths.length !== 2)
    throw new Error(`degraded projection: ${result?.status || 'null'}`);
};
const timed = (operation, iterations = 1) => {
  const started = performance.now();
  for (let index = 0; index < iterations; index++) operation();
  return performance.now() - started;
};
const run = (operation) => {
  for (let index = 0; index < WARMUPS; index++) operation();
  return Array.from({ length: SAMPLES }, () => timed(operation));
};
const runPairs = () => {
  for (let index = 0; index < WARMUPS; index++) {
    validGeometry();
    validProjection();
  }
  const baseline = [], candidate = [], overhead = [];
  for (let index = 0; index < SAMPLES; index++) {
    let baseMs, candidateMs;
    if (index % 2 === 0) {
      baseMs = timed(validGeometry, VALID_BATCH) / VALID_BATCH;
      candidateMs = timed(validProjection, VALID_BATCH) / VALID_BATCH;
    } else {
      candidateMs = timed(validProjection, VALID_BATCH) / VALID_BATCH;
      baseMs = timed(validGeometry, VALID_BATCH) / VALID_BATCH;
    }
    baseline.push(baseMs);
    candidate.push(candidateMs);
    overhead.push(candidateMs - baseMs);
  }
  return { baseline, candidate, overhead };
};
const quantile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
};
const summary = (values) => ({
  min: Math.min(...values), median: quantile(values, 0.5),
  p95: quantile(values, 0.95), max: Math.max(...values),
});

const pairs = runPairs();
const baseline = summary(pairs.baseline);
const candidate = summary(pairs.candidate);
const degraded = summary(run(degradedProjection));
const relativeLimit = baseline.p95 * RELATIVE_RATIO;
const overheadP95 = quantile(pairs.overhead, 0.95);
const pass = candidate.p95 <= relativeLimit && overheadP95 <= OVERHEAD_P95_MS
  && degraded.p95 <= DEGRADED_P95_MS;
console.log(JSON.stringify({
  issue: 278, fixture: LARGE_HOUSE_COUNTS, warmups: WARMUPS, samples: SAMPLES,
  validBatch: VALID_BATCH,
  baseline, candidate, degraded, overheadP95,
  budgets: {
    relativeRatio: RELATIVE_RATIO, overheadP95Ms: OVERHEAD_P95_MS,
    relativeLimitP95Ms: relativeLimit, degradedP95Ms: DEGRADED_P95_MS,
  },
  pass,
}, null, 2));
if (!pass) process.exitCode = 1;
