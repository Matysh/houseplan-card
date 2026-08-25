#!/usr/bin/env node
/** Machine-readable Stage-1 migration budget for issue #282. */
import { performance } from 'node:perf_hooks';

import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const ATOMS = 10_000;
const BUDGET_MS = 500;

const config = (atoms) => ({
  spaces: [{
    id: 'benchmark',
    rooms: [{
      id: 'room',
      // A large radius keeps consecutive vertices above the existing
      // wall-geometry epsilon while staying far inside the canvas limit.
      poly: Array.from({ length: atoms }, (_, index) => {
        const angle = Math.PI * 2 * index / atoms;
        return [100 * Math.cos(angle), 100 * Math.sin(angle)];
      }),
    }],
  }],
  markers: [],
  settings: {},
});

commitWallSegmentModel(config(100));
const samples = [];
for (let index = 0; index < 5; index++) {
  const started = performance.now();
  const result = commitWallSegmentModel(config(ATOMS));
  samples.push(performance.now() - started);
  if (result.migratedSegments !== ATOMS) throw new Error(
    `expected ${ATOMS} materialised atoms, received ${result.migratedSegments}`,
  );
}
samples.sort((left, right) => left - right);
const p95Ms = samples[Math.ceil(samples.length * 0.95) - 1];
const report = {
  issue: 282,
  atoms: ATOMS,
  samplesMs: samples.map((value) => Number(value.toFixed(3))),
  p95Ms: Number(p95Ms.toFixed(3)),
  budgetMs: BUDGET_MS,
  passed: p95Ms <= BUDGET_MS,
};
process.stdout.write(`${JSON.stringify(report)}\n`);
if (!report.passed) process.exitCode = 1;
