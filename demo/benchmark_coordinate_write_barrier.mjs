#!/usr/bin/env node
// #291: same-process p95 of the complete config+layout boundary versus the
// pre-existing full-candidate clone contract. Batching makes the strict 20%
// ratio meaningful even on coarse/loaded CI timers.
import { performance } from 'node:perf_hooks';

import { makeLargeHouseFixture } from './fixtures/large-house.mjs';
import {
  canonicalizeConfigGeometry, canonicalizeLayoutGeometry,
} from '../test-build/coordinate-canonicalization.js';

const WARMUPS = 30;
const SAMPLES = 120;
const BATCH = 10;
const MAX_RATIO = 1.2;
const fixture = makeLargeHouseFixture();

const baseline = () => {
  JSON.parse(JSON.stringify(fixture.config));
  JSON.parse(JSON.stringify(fixture.layout || {}));
};
const candidate = () => {
  canonicalizeConfigGeometry(fixture.config);
  canonicalizeLayoutGeometry(fixture.layout || {});
};
const measure = (operation) => {
  const started = performance.now();
  for (let index = 0; index < BATCH; index++) operation();
  return (performance.now() - started) / BATCH;
};
for (let index = 0; index < WARMUPS; index++) {
  baseline();
  candidate();
}
const baselineSamples = [];
const candidateSamples = [];
for (let index = 0; index < SAMPLES; index++) {
  if (index % 2) {
    candidateSamples.push(measure(candidate));
    baselineSamples.push(measure(baseline));
  } else {
    baselineSamples.push(measure(baseline));
    candidateSamples.push(measure(candidate));
  }
}
const p95 = (values) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
const baselineP95 = p95(baselineSamples);
const candidateP95 = p95(candidateSamples);
const ratio = candidateP95 / baselineP95;
const report = {
  fixture: 'large-house-v1', samples: SAMPLES, batch: BATCH,
  baselineP95Ms: baselineP95, candidateP95Ms: candidateP95,
  ratio, limit: MAX_RATIO, pass: ratio <= MAX_RATIO,
};
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
