import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraCycleFailures, cameraCycleSampleFailures, finishLedCameraCycle } from '../demo/performance/led-camera-cycle.mjs';

function clock({ stuck = false, tailFailure = false } = {}) {
  let time = 0, deadline = 160;
  const events = [];
  return { events, args: {
    now: () => time,
    fullQuality: () => !stuck && time >= deadline && !(tailFailure && time >= 800),
    sleep: async ms => { events.push(['sleep', ms]); time += ms; },
    frame: async () => { events.push(['frame', time]); time += 32; },
    input: async () => { events.push(['input', time]); deadline = time + 160; },
  } };
}

test('LED full cycle waits for both restores and the >=500 ms tail without replacing the original camera series', async () => {
  const probe = clock();
  const marks = await finishLedCameraCycle(probe.args);
  assert.equal(marks.firstFullQuality, 160);
  assert.equal(marks.firstPaintOpportunity, 192);
  assert.equal(marks.restartInput, 192);
  assert.ok(marks.finalFullQuality >= 352);
  assert.ok(marks.tailEnd - marks.finalPaintOpportunity >= 500);
  assert.equal(probe.events.filter(([name]) => name === 'input').length, 1);
  assert.equal(probe.events.filter(([name]) => name === 'frame').length, 4);
});

test('LED full cycle rejects a stuck coarse state instead of truncating the observer window', async () => {
  const probe = clock({ stuck: true });
  await assert.rejects(finishLedCameraCycle(probe.args), /did not restore within 1000 ms/);
  assert.equal(probe.events.filter(([name]) => name === 'input').length, 0);
});

test('LED full cycle checks that a late callback does not restore coarse in the tail', async () => {
  await assert.rejects(finishLedCameraCycle(clock({ tailFailure: true }).args), /regressed in the restore tail/);
});

test('LED full cycle also measures the no-LED/full-quality control with the same restart and tail', async () => {
  const probe = clock();
  const marks = await finishLedCameraCycle({ ...probe.args, fullQuality: () => true });
  assert.equal(marks.firstFullQuality, 0);
  assert.ok(marks.tailEnd - marks.finalPaintOpportunity >= 500);
  assert.equal(probe.events.filter(([name]) => name === 'input').length, 1);
});

test('full cycle inherits the unchanged camera ceiling; missing/over-budget evidence cannot pass', () => {
  assert.deepEqual(cameraCycleFailures({ median: 150, p95: 150 }, 150), []);
  assert.equal(cameraCycleFailures({ median: 100, p95: 151 }, 150).length, 1);
  assert.equal(cameraCycleFailures({ median: 151, p95: 200 }, 150).length, 2);
  for (const value of [undefined, null, NaN, Infinity]) {
    assert.equal(cameraCycleFailures({ median: value, p95: value }, 150).length, 2);
  }
  assert.deepEqual(cameraCycleFailures({ median: 0, p95: 0 }, undefined), []);
});

test('full-cycle evidence validates every merged row, raw maximum and phase tail', async () => {
  const probe = clock();
  const phases = { seriesEnd: 0, ...await finishLedCameraCycle(probe.args) };
  const good = { cameraFullCycleLongTaskMaxMs: 51,
    cameraFullCycle: { startTime: 0, endTime: phases.tailEnd, phases, entries: [{ startTime: 10, duration: 51 }] } };
  assert.deepEqual(cameraCycleSampleFailures([good, good]), []);
  assert.equal(cameraCycleSampleFailures([good, {}]).length, 1, 'one absent sample cannot hide in a finite median');
  for (const mutate of [
    row => { row.cameraFullCycleLongTaskMaxMs = NaN; },
    row => { delete row.cameraFullCycle.entries; },
    row => { row.cameraFullCycle.entries[0].duration = Infinity; },
    row => { row.cameraFullCycle.phases.restartInput = -1; },
    row => { row.cameraFullCycle.phases.tailEnd = row.cameraFullCycle.phases.finalPaintOpportunity + 499; },
    row => { row.cameraFullCycleLongTaskMaxMs = 0; },
  ]) {
    const bad = structuredClone(good); mutate(bad);
    assert.equal(cameraCycleSampleFailures([good, bad]).length, 1);
  }
  const empty = structuredClone(good); empty.cameraFullCycle.entries = []; empty.cameraFullCycleLongTaskMaxMs = 0;
  assert.deepEqual(cameraCycleSampleFailures([empty]), [], 'no Long Tasks means zero, not missing evidence');
});
