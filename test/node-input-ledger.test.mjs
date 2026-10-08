import assert from 'node:assert/strict';
import { test } from 'node:test';
import { performance } from 'node:perf_hooks';
import { assertNodeClockBounds, assertUniqueNodeInputPositions, calibrateNodeInputClock, inspectNodeInputObservations, installNodeInputObserver,
  nodeInputClockCalibration, settleNodeInputLedger } from '../demo/helpers/node-input-ledger.mjs';

const source = () => Array.from({ length: 60 }, (_, id) => Object.freeze({ id,
  nodeTime: 1000 + id * 16, eventTime: 100 + id * 16, x: 20, y: 30 + id,
  pointerId: 1, pointerType: 'mouse', buttons: 1 }));
const observation = (input, extra = {}) => ({ ...input, eventTime: input.eventTime + .1,
  dispatched: input.eventTime + 5, firstRaf: input.eventTime + 40, twoRafOpportunity: input.eventTime + 56,
  paintOpportunity: input.eventTime + 40, producerWasRaf: true, coalesced: false, isTrusted: true, ...extra });
const probes = () => Array.from({ length: 8 }, (_, index) => {
  const nodeBefore = 100 + index * 16, rtt = index === 3 ? .2 : .4;
  return { nodeBefore, nodeAfter: nodeBefore + rtt, browserNow: nodeBefore + rtt / 2 + 500 };
});

test('#834 calibration performs exactly eight independent direct CDP clock reads with no native input', async () => {
  const calls = [];
  const cdp = { async send(method, params) {
    calls.push({ method, params });
    return { result: { type: 'number', value: performance.now() + 500 } };
  } };
  const result = await calibrateNodeInputClock(cdp);
  assert.equal(calls.length, 8);
  assert.equal(result.pairs.length, 8);
  for (const call of calls) assert.deepEqual(call, { method: 'Runtime.evaluate', params: { expression: 'performance.now()', returnByValue: true } });
  assert.ok(result.offsetMs <= 500);
  assert.ok(result.uncertaintyMs <= 1);
  await assert.rejects(calibrateNodeInputClock({ async send() { return { result: { type: 'undefined' } }; } }),
    error => /finite browser number/.test(error.message) && error.clockProbes.length === 1);
});

test('#834 independent monotonic RTT calibration fixes a conservative lower offset before input', () => {
  const raw = probes(), before = structuredClone(raw), calibration = nodeInputClockCalibration(raw);
  assert.deepEqual(raw, before);
  assert.equal(calibration.chosen, 3);
  assert.ok(Math.abs(calibration.lower - 499.8) < 1e-8);
  assert.ok(Math.abs(calibration.upper - 500.2) < 1e-8);
  assert.ok(Math.abs(calibration.uncertaintyMs - .4) < 1e-8);
  assert.equal(calibration.offsetMs, calibration.lower);
  assert.equal(calibration.resolutionMs, .1);
  assert.equal(calibration.pairs.length, 8);
  const nodeSend = 5000, actualBrowserSend = nodeSend + 500;
  assert.ok(nodeSend + calibration.offsetMs <= actualBrowserSend);
  assert.ok(actualBrowserSend + 80 - (nodeSend + calibration.offsetMs) >= 80,
    'lower offset can only make source-to-paint latency conservative');
});

test('#834 clock calibration rejects inconsistent, imprecise, missing and non-monotonic probes', () => {
  const inconsistent = probes(); inconsistent[7].browserNow += 2;
  assert.throws(() => nodeInputClockCalibration(inconsistent), /common intersection/);
  const imprecise = probes().map(p => ({ ...p, nodeAfter: p.nodeBefore + 2, browserNow: p.nodeBefore + 501 }));
  assert.throws(() => nodeInputClockCalibration(imprecise), /at most 1ms/);
  assert.throws(() => nodeInputClockCalibration(probes().slice(1)), /exactly eight/);
  const backwards = probes(); backwards[0].nodeAfter = backwards[0].nodeBefore - 1;
  assert.throws(() => nodeInputClockCalibration(backwards), /finite and monotonic/);
  const invalid = probes(); invalid[0].browserNow = Infinity;
  assert.throws(() => nodeInputClockCalibration(invalid), /finite and monotonic/);
});

test('#834 after-gesture clock check requires overlapping feasible brackets, not a refitted source clock', () => {
  const before = { lower: 499.6, upper: 500.2, intersection: { lower: 499.8, upper: 500.1 } };
  assert.doesNotThrow(() => assertNodeClockBounds(before, { lower: 499.9, upper: 500.1, intersection: { lower: 499.9, upper: 500.05 } }));
  assert.throws(() => assertNodeClockBounds(before, { lower: 500.3, upper: 500.5, intersection: { lower: 500.3, upper: 500.5 } }), /must overlap/);
  assert.throws(() => assertNodeClockBounds(
    { lower: -.5, upper: .5, intersection: { lower: -.5, upper: -.2 } },
    { lower: -.5, upper: .5, intersection: { lower: .2, upper: .5 } }), /must overlap/,
  'overlapping chosen pairs cannot hide inconsistent constraints from the other probes');
});

test('#834 shared inspector settles coalesced inputs despite unpainted unmatched native extras', () => {
  const inputs = source(), before = structuredClone(inputs);
  const extra = { eventTime: 97, x: 20000, y: 20000, pointerId: 1, pointerType: 'mouse', buttons: 1, isTrusted: true };
  const events = [extra, observation(inputs[2]), observation(inputs[59])];
  const view = {}, browserInspect = installNodeInputObserver(view);
  assert.equal(browserInspect, view.__hpNodeInputObserver.inspect);
  assert.deepEqual(browserInspect(inputs, events), inspectNodeInputObservations(inputs, events));
  assert.equal(browserInspect(inputs, events).ready, true);
  const result = settleNodeInputLedger(inputs, events);
  assert.deepEqual(inputs, before, 'all 60 source clocks remain immutable');
  assert.equal(result.inputs.length, 60);
  assert.equal(result.inputs[0].inputToPaintMs, 72);
  assert.equal(result.inputs[1].inputToPaintMs, 56);
  assert.equal(result.inputs[2].inputToPaintMs, 40);
  assert.equal(result.inputs[0].disposition, 'superseded-by-latest');
  assert.equal(result.inputs[2].disposition, 'latest-candidate');
  assert.deepEqual(result.unmatchedObservations, [extra]);
  assert.equal('paintOpportunity' in result.unmatchedObservations[0], false, 'no invented paint');
  assert.equal('inputToPaintMs' in result.unmatchedObservations[0], false, 'no invented latency');
});

test('#834 delayed native receipt is legitimate but cannot replace the earlier immutable source clock', () => {
  const inputs = source(), last = inputs[59], before = structuredClone(inputs);
  const late = observation(last, { eventTime: last.eventTime + 100, dispatched: last.eventTime + 110,
    paintOpportunity: last.eventTime + 140, firstRaf: last.eventTime + 140, twoRafOpportunity: last.eventTime + 156 });
  const result = settleNodeInputLedger(inputs, [late]);
  assert.equal(result.inputs[59].inputToPaintMs, 140, 'native receipt latency of 40ms would hide 100ms of queued input');
  assert.deepEqual(inputs, before);
  assert.equal(result.inputs[59].eventTime, last.eventTime);
});

test('#834 negative control: a painted final input cannot hide an earlier matched input awaiting paint', () => {
  const inputs = source();
  for (const paintOpportunity of [undefined, NaN, Infinity, inputs[0].eventTime - 1]) {
    const events = [observation(inputs[0], { paintOpportunity }), observation(inputs[59])];
    assert.equal(inspectNodeInputObservations(inputs, events).ready, false);
    assert.throws(() => settleNodeInputLedger(inputs, events), /complete post-paint/);
  }
});

test('#834 missing final, foreign pointer, synthetic input and invalid native clock cannot pass', () => {
  const inputs = source();
  for (const change of [{ pointerId: 2 }, { pointerType: 'touch' }, { buttons: 0 }, { isTrusted: false }, { x: 30000 }]) {
    const events = [observation(inputs[58]), observation(inputs[59], change)];
    assert.equal(inspectNodeInputObservations(inputs, events).ready, false);
    assert.throws(() => settleNodeInputLedger(inputs, events), /final separately submitted input/);
  }
  for (const change of [{ eventTime: inputs[59].eventTime - 1 },
    { eventTime: inputs[59].eventTime + 10, dispatched: inputs[59].eventTime + 5 }, { eventTime: NaN }]) {
    assert.throws(() => settleNodeInputLedger(inputs, [observation(inputs[59], change)]), /native receipt must lie between/);
  }
});

test('#834 duplicate, reordered and ambiguous observations remain hard failures', () => {
  const inputs = source();
  assert.throws(() => inspectNodeInputObservations(inputs, [observation(inputs[3]), observation(inputs[3])]), /submission order/);
  assert.throws(() => inspectNodeInputObservations(inputs, [observation(inputs[3]), observation(inputs[2])]), /submission order/);
  const ambiguous = inputs.map((input, index) => ({ ...input, x: index === 1 ? inputs[0].x + .0015 : input.x,
    y: index === 1 ? inputs[0].y : input.y }));
  assert.throws(() => inspectNodeInputObservations(ambiguous, [observation(ambiguous[0], { x: ambiguous[0].x + .00075 })]), /multiple source inputs/);
  const duplicatePosition = inputs.map((input, index) => index === 1 ? { ...input, x: inputs[0].x, y: inputs[0].y } : input);
  assert.throws(() => assertUniqueNodeInputPositions(duplicatePosition), /screen positions must be unique/);
  assert.throws(() => inspectNodeInputObservations(duplicatePosition, []), /screen positions must be unique/);
  const duplicateClock = inputs.map((input, index) => index === 1 ? { ...input, eventTime: inputs[0].eventTime } : input);
  assert.throws(() => inspectNodeInputObservations(duplicateClock, []), /distinct and monotonic/);
});
