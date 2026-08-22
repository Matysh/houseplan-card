// #199: same-process production-builder baseline versus the complete Optimize
// preflight wrapper on the deterministic 3-floor large-house fixture.
import { performance } from 'node:perf_hooks';

import { makeLargeHouseFixture, LARGE_HOUSE_COUNTS } from './fixtures/large-house.mjs';
import {
  checkOptimizeGeometry,
  prepareSpacePhysicalGeometryInputs,
} from '../test-build/plan-geometry-preflight.js';
import { spaceModels } from '../test-build/space-geometry.js';
import {
  floorFootprintGeometry,
  wallBodiesGeometry,
} from '../test-build/wall-thickness.js';

const WARMUPS = 3;
const SAMPLES = 20;
const ABSOLUTE_P95_MS = 250;
const RELATIVE_RATIO = 1.2;
const RELATIVE_NOISE_MS = 15;

const fixture = makeLargeHouseFixture();
const models = spaceModels(fixture.config);
const prepared = fixture.config.spaces.map((space, index) =>
  prepareSpacePhysicalGeometryInputs(space, models[index]));

const directProductionPass = () => {
  for (const input of prepared) {
    const hasWalls = input.walls.length > 0 || input.physicalBodies.length > 0;
    const united = hasWalls
      ? wallBodiesGeometry(
          input.space.rooms, input.walls, input.openCuts, input.roomOpenings,
          input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordScale,
          input.physicalBodies,
        )
      : null;
    if (hasWalls && united == null) throw new Error(`baseline wall failure: ${input.space.id}`);
    if (input.space.rooms.length && united?.paperGeom == null) {
      const floor = floorFootprintGeometry(
        input.space.rooms, input.walls, input.openCuts,
        input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordScale,
      );
      if (floor == null) throw new Error(`baseline floor failure: ${input.space.id}`);
    }
  }
};

const completePreflight = () => {
  const result = checkOptimizeGeometry(fixture.config);
  if (!result.ok || result.spaces.length !== LARGE_HOUSE_COUNTS.floors
      || result.spaces.some((space) => space.status !== 'ok')) {
    throw new Error(`candidate preflight failure: ${JSON.stringify(result.spaces)}`);
  }
};

const sample = (operation) => {
  const start = performance.now();
  operation();
  return performance.now() - start;
};
const run = (operation) => {
  for (let index = 0; index < WARMUPS; index++) operation();
  return Array.from({ length: SAMPLES }, () => sample(operation));
};
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

const baseline = summary(run(directProductionPass));
const candidate = summary(run(completePreflight));
const relativeLimit = baseline.p95 * RELATIVE_RATIO + RELATIVE_NOISE_MS;
const pass = candidate.p95 <= ABSOLUTE_P95_MS && candidate.p95 <= relativeLimit;
const report = {
  issue: 199,
  fixture: LARGE_HOUSE_COUNTS,
  warmups: WARMUPS,
  samples: SAMPLES,
  baseline,
  candidate,
  budgets: {
    absoluteP95Ms: ABSOLUTE_P95_MS,
    relativeRatio: RELATIVE_RATIO,
    relativeNoiseMs: RELATIVE_NOISE_MS,
    relativeLimitP95Ms: relativeLimit,
  },
  pass,
};
console.log(JSON.stringify(report, null, 2));
if (!pass) process.exitCode = 1;
