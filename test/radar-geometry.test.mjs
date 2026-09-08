import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  projectRadarLocal, radarLengthCm, radarMedianSample, solveRadarTwoPoint,
} from '../test-build/radar-geometry.js';

const shared = JSON.parse(readFileSync(new URL('./fixtures/radar-source-boundaries.json', import.meta.url)));

test('shared synthetic source boundaries project identically in the browser', () => {
  for (const item of shared.projection) {
    const localCm = item.local.map((value) => radarLengthCm(value, item.unit));
    const actual = projectRadarLocal(
      item.mount, item.heading_deg, item.mirror, item.cell_cm, localCm,
    );
    assert.ok(Math.abs(actual[0] - item.expected[0]) < 1e-12, item.name);
    assert.ok(Math.abs(actual[1] - item.expected[1]) < 1e-12, item.name);
  }
});

test('radar projection uses persisted 0..1 plan coordinates and exact units', () => {
  assert.equal(radarLengthCm(1000, 'mm'), 100);
  assert.deepEqual(projectRadarLocal([.5, .5], 0, false, 5, [120, 0]), [.6, .5]);
  assert.deepEqual(projectRadarLocal([.5, .5], 0, false, 5, [0, 120]), [.5, .4]);
});

test('two reference solve keeps physical scale rigid', () => {
  const fit = solveRadarTwoPoint([.5, .5], [[100, 0], [0, 100]], [
    [.5 + 100 / 1200, .5], [.5, .5 - 100 / 1200],
  ], 5);
  assert.ok(Math.abs(fit.headingDeg) < 1e-9);
  assert.equal(fit.mirror, false);
  assert.ok(fit.rmsCm < 1e-9);
  assert.throws(() => solveRadarTwoPoint([.5, .5], [[100, 0], [200, 0]], [
    [.6, .5], [.7, .5],
  ], 5), /invalid_selection/);
});

test('capture median rejects one sample more than 15cm away', () => {
  assert.deepEqual(radarMedianSample([[100, 200], [102, 198], [101, 201]]), [101, 200]);
  assert.throws(() => radarMedianSample([[100, 200], [101, 199], [140, 240]]), /bad_fit/);
});
