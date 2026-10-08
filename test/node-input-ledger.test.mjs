import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodeInputClockCalibration, settleNodeInputLedger } from '../demo/helpers/node-input-ledger.mjs';

const source = () => Array.from({ length: 60 }, (_, id) => Object.freeze({ id, eventTime: 100 + id * 16, x: 20, y: 30 + id }));
const observation = (input, extra = {}) => ({ ...input, eventTime: input.eventTime + .1,
  firstRaf: input.eventTime + 40, twoRafOpportunity: input.eventTime + 56,
  paintOpportunity: input.eventTime + 40, producerWasRaf: true, coalesced: false, ...extra });

test('#834 clock calibration measures an independent native offset instead of assuming performance.timeOrigin', () => {
  const timeOrigin = 1000, probes = Array.from({ length: 3 }, (_, index) => ({ epochMs: 2000 + index * 16, x: 10 + index * 3, y: 10 }));
  const events = probes.map(probe => ({ x: probe.x, y: probe.y, eventTime: probe.epochMs - timeOrigin + 2.1 }));
  const calibration = nodeInputClockCalibration(probes, events, timeOrigin);
  assert.ok(Math.abs(calibration.offsetMs - 2.1) < 1e-8);
  assert.ok(calibration.spreadMs < 1e-8);
  assert.equal(calibration.pairs.length, 3);
  const inputs = source().map(input => ({ ...input, eventTime: input.eventTime + calibration.offsetMs }));
  const native = source().map(input => observation(input, { eventTime: input.eventTime + 2.1 }));
  assert.throws(() => settleNodeInputLedger(source(), native), /final separately submitted input/,
    'negative control reproduces the observed constant +2.1ms mapping failure');
  assert.equal(settleNodeInputLedger(inputs, native).inputs.length, 60);
});

test('#834 clock calibration fails closed on unstable, missing, or ambiguous independent probes', () => {
  const probes = Array.from({ length: 3 }, (_, index) => ({ epochMs: 2000 + index * 16, x: 10 + index * 3, y: 10 }));
  const events = probes.map(probe => ({ ...probe, eventTime: probe.epochMs - 1000 }));
  assert.throws(() => nodeInputClockCalibration(probes, events.map((event, index) => ({ ...event, eventTime: event.eventTime + index })), 1000), /stable within/);
  assert.throws(() => nodeInputClockCalibration(probes, events.slice(1), 1000), /exactly one native observation/);
  assert.throws(() => nodeInputClockCalibration(probes, [...events, events[0]], 1000), /exactly one native observation/);
  assert.throws(() => nodeInputClockCalibration(probes.slice(0, 2), events, 1000), /at least three/);
});

test('#834 ledger preserves all 60 immutable source clocks through native coalescing', () => {
  const inputs = source(), before = structuredClone(inputs);
  const result = settleNodeInputLedger(inputs, [observation(inputs[2]), observation(inputs[59])]);
  assert.deepEqual(inputs, before, 'measurement never rewrites submission clocks');
  assert.equal(result.inputs.length, 60);
  assert.equal(result.inputs[0].inputToPaintMs, 72);
  assert.equal(result.inputs[1].inputToPaintMs, 56);
  assert.equal(result.inputs[2].inputToPaintMs, 40);
  assert.equal(result.inputs[0].disposition, 'superseded-by-latest');
  assert.equal(result.inputs[2].disposition, 'latest-candidate');
  assert.equal(result.inputs[59].eventTime, inputs[59].eventTime);
});

test('#834 ledger retains unrelated native observations without assigning a fictitious source clock', () => {
  const inputs = source(), foreign = observation({ eventTime: 93, x: 20, y: 30 });
  const sameTimeWrongPosition = observation(inputs[10], { y: inputs[10].y + 1 });
  const result = settleNodeInputLedger(inputs, [foreign, observation(inputs[0]), sameTimeWrongPosition, observation(inputs[59])]);
  assert.deepEqual(result.unmatchedObservations, [foreign, sameTimeWrongPosition]);
  assert.equal(result.inputs[10].disposition, 'superseded-by-latest');
  assert.equal(result.inputs[10].inputToPaintMs, inputs[59].eventTime + 40 - inputs[10].eventTime,
    'an unrelated observation cannot make the reported source latency faster');
});

test('#834 negative control: an unmatched tail cannot stand in for missing source input 59', () => {
  const inputs = source();
  assert.throws(() => settleNodeInputLedger(inputs, [observation(inputs[58]),
    observation(inputs[59], { eventTime: inputs[59].eventTime + 8 })]), /final separately submitted input/);
  assert.throws(() => settleNodeInputLedger(inputs, [observation(inputs[59], { paintOpportunity: undefined })]), /complete post-paint/);
});

test('#834 ledger rejects reordered observations or rewritten/duplicate source clocks', () => {
  const inputs = source();
  assert.throws(() => settleNodeInputLedger(inputs, [observation(inputs[3]), observation(inputs[2])]), /submission order/);
  assert.throws(() => settleNodeInputLedger(inputs.map((input, index) => index === 1 ? { ...input, eventTime: inputs[0].eventTime } : input), []), /distinct and monotonic/);
});
