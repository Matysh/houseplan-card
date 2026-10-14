// #850 AC1: the judge of the sensor-tick scenarios of led-strips-v1 fails
// closed, multiplies per-tick limits and attributes a CPU profile.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TICK_COUNTERS, summarizeCpuProfile, tickCounterFailures,
} from '../demo/performance/sensor-tick-scenarios.mjs';

const budgets = JSON.parse(readFileSync(new URL('../demo/performance/budgets-led-strips.json', import.meta.url), 'utf8'));

const scenario = (patch = {}) => ({
  ticks: 30, fullRenders: 30, snapshots: 30, presentationBuilds: 60, ledFrames: 0, ledTubes: 0,
  lightGeometry: 0, lightGraphs: 0, lightResolutions: 0, staleStripes: 0, ...patch,
});
const row = (patch = {}) => ({ ticks: { scenarios: {
  S0: scenario({ fullRenders: 0, snapshots: 0, presentationBuilds: 0 }),
  S1: scenario(), S1b: scenario(), S2: scenario({ ledFrames: 30, presentationBuilds: 12000 }), ...patch,
} } });

test('#850 AC1: the tick budgets are zero counters plus two presentations per tick of S1/S1b', () => {
  for (const name of ['S1', 'S1b']) {
    assert.deepEqual(budgets.ticks[name], { presentationBuildsPerTick: 2, ledFrames: 0, ledTubes: 0,
      lightGeometry: 0, lightGraphs: 0, lightResolutions: 0 });
  }
  assert.deepEqual(budgets.ticks.S2, { ledTubes: 0, lightGeometry: 0, lightGraphs: 0, staleStripes: 0 });
  assert.ok(Object.values(budgets.ticks.S0).every((limit) => limit === 0));
  assert.deepEqual(Object.keys(budgets.ticks.S0).sort(), [...TICK_COUNTERS].sort());
  assert.deepEqual(budgets.camera, { lightGeometry: 0 });
});

test('#850 AC1: a clean row passes; one frame, one tube or one extra presentation fails', () => {
  assert.deepEqual(tickCounterFailures([row()], budgets.ticks), []);
  assert.deepEqual(tickCounterFailures([row({ S1: scenario({ ledFrames: 30 }) })], budgets.ticks),
    ['sample 0: S1.ledFrames = 30 > 0'], 'dev: one LED frame per tick of a plan sensor');
  assert.equal(tickCounterFailures([row({ S1b: scenario({ ledTubes: 1500 }) })], budgets.ticks).length, 1);
  assert.deepEqual(tickCounterFailures([row({ S1: scenario({ presentationBuilds: 61 }) })], budgets.ticks),
    ['sample 0: S1.presentationBuilds = 61 > 60']);
  assert.equal(tickCounterFailures([row({ S2: scenario({ staleStripes: 1 }) })], budgets.ticks).length, 1,
    'a stripe that keeps the old state fails');
});

test('#850 AC1: a missing counter or scenario fails closed', () => {
  assert.deepEqual(tickCounterFailures([row({ S1: scenario({ presentationBuilds: null }) })], budgets.ticks),
    ['sample 0: S1.presentationBuilds missing'], 'a base without the product counter is not a pass');
  assert.deepEqual(tickCounterFailures([row({ S1b: null })], budgets.ticks), ['sample 0: S1b not measured']);
  assert.equal(tickCounterFailures([{}], budgets.ticks).length, 4);
});

test('#850 AC1: the profile attribution splits product, GC, idle and program by self time', () => {
  const profile = {
    nodes: [
      { id: 1, callFrame: { functionName: '(root)' } },
      { id: 2, callFrame: { functionName: 'resolveDevicePresentation' } },
      { id: 3, callFrame: { functionName: '(garbage collector)' } },
      { id: 4, callFrame: { functionName: '(idle)' } },
      { id: 5, callFrame: { functionName: '(program)' } },
    ],
    samples: [2, 2, 3, 4, 5, 2],
    timeDeltas: [1000, 1000, 2000, 500, 500, 1000],
  };
  assert.deepEqual(summarizeCpuProfile(profile), {
    product: { ms: 3, share: 0.5 }, gc: { ms: 2, share: 0.3333 },
    idle: { ms: 0.5, share: 0.0833 }, program: { ms: 0.5, share: 0.0833 },
  });
});
