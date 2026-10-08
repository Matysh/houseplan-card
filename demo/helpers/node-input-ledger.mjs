import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

/** Independent monotonic clocks, never fitted to the measured input stream. */
export function nodeInputClockCalibration(probes) {
  assert.equal(probes.length, 8, 'clock calibration needs exactly eight independent RTT probes');
  const resolutionMs = .1; // unisolated Chromium performance.now() coarsening
  const pairs = probes.map(probe => {
    const { nodeBefore, browserNow, nodeAfter } = probe;
    assert.ok([nodeBefore, browserNow, nodeAfter].every(Number.isFinite) && nodeAfter >= nodeBefore,
      'clock probe timestamps must be finite and monotonic');
    return { ...probe, lower: browserNow - nodeAfter - resolutionMs,
      upper: browserNow - nodeBefore + resolutionMs, uncertaintyMs: nodeAfter - nodeBefore + 2 * resolutionMs };
  });
  const intersection = { lower: Math.max(...pairs.map(pair => pair.lower)), upper: Math.min(...pairs.map(pair => pair.upper)) };
  assert.ok(intersection.lower <= intersection.upper, 'independent clock probe intervals must have a common intersection');
  const chosen = pairs.reduce((best, pair, index) => pair.uncertaintyMs < pairs[best].uncertaintyMs ? index : best, 0);
  const { lower, upper, uncertaintyMs } = pairs[chosen];
  assert.ok(uncertaintyMs <= 1, `native clock calibration uncertainty must be at most 1ms (${uncertaintyMs}ms)`);
  // Keep the lower edge of the independently tightest RTT bracket. The source
  // can only appear earlier than its true browser time, never spuriously later.
  return { offsetMs: lower, lower, upper, uncertaintyMs, resolutionMs, chosen, intersection, pairs };
}

/** Fixed probe count outside the gesture: no retries, native input or pacing. */
export async function calibrateNodeInputClock(cdp) {
  const probes = [];
  try {
    for (let index = 0; index < 8; index++) {
      const nodeBefore = performance.now();
      // Same page/session as native input; avoid the additional Playwright
      // evaluate-wrapper RPC while retaining an independent renderer-clock read.
      const reply = await cdp.send('Runtime.evaluate', { expression: 'performance.now()', returnByValue: true });
      const nodeAfter = performance.now(), browserNow = reply.result?.value;
      probes.push({ nodeBefore, browserNow, nodeAfter });
      assert.ok(!reply.exceptionDetails && reply.result?.type === 'number' && Number.isFinite(browserNow),
        'independent CDP clock probe must return a finite browser number');
    }
    return nodeInputClockCalibration(probes);
  }
  catch (error) { error.clockProbes = probes; throw error; }
}

export function assertNodeClockBounds(before, after) {
  assert.ok(Math.max(before.intersection.lower, after.intersection.lower)
    <= Math.min(before.intersection.upper, after.intersection.upper),
    'independent before/after monotonic clock bounds must overlap');
}

/** Self-contained browser installer; the returned inspector is also used in Node. */
export function installNodeInputObserver(view = globalThis) {
  const samePosition = (a, b) => Math.abs(a.x - b.x) < .001 && Math.abs(a.y - b.y) < .001;
  function assertUniquePositions(inputs) {
    if (!inputs.every(input => Number.isFinite(input.x) && Number.isFinite(input.y)))
      throw new Error('submitted screen positions must be finite');
    if (!inputs.every((input, index) => !inputs.slice(index + 1).some(other => samePosition(input, other))))
      throw new Error('submitted screen positions must be unique at native precision');
  }
  function inspect(inputs, observations) {
    const require = (condition, message) => { if (!condition) throw new Error(message); };
    require(inputs.length > 0, 'a source-input ledger cannot be empty');
    require(inputs.every((input, index) => input.id === index && Number.isFinite(input.eventTime)
      && Number.isFinite(input.nodeTime) && Number.isFinite(input.x) && Number.isFinite(input.y)
      && Number.isInteger(input.pointerId) && input.pointerType === 'mouse' && input.buttons === 1
      && (!index || input.eventTime > inputs[index - 1].eventTime && input.nodeTime > inputs[index - 1].nodeTime)),
    'submitted clocks, IDs and mouse ownership must be finite, distinct and monotonic');
    assertUniquePositions(inputs);
    const matchedObservations = [], unmatchedIndices = [], pendingIndices = [];
    let through = -1;
    for (const [observationIndex, event] of observations.entries()) {
      const matches = inputs.filter(input => samePosition(input, event) && event.isTrusted === true
        && event.pointerType === 'mouse' && event.pointerId === input.pointerId && event.buttons === input.buttons);
      require(matches.length <= 1, 'a native event cannot identify multiple source inputs');
      if (!matches.length) { unmatchedIndices.push(observationIndex); continue; }
      const input = matches[0], id = input.id;
      require(id > through, 'matched native source inputs must be observed in submission order');
      require(Number.isFinite(event.eventTime) && Number.isFinite(event.dispatched)
        && event.eventTime >= input.eventTime && event.eventTime <= event.dispatched,
      'native receipt must lie between the conservative submitted clock and dispatch');
      if (!Number.isFinite(event.paintOpportunity) || event.paintOpportunity < event.eventTime)
        pendingIndices.push(observationIndex);
      matchedObservations.push({ observationIndex, observationId: event.id, sourceId: id });
      through = id;
    }
    const finalSeen = through === inputs.length - 1;
    return { ready: finalSeen && pendingIndices.length === 0, finalSeen,
      matchedObservations, unmatchedIndices, pendingIndices };
  }
  inspect.assertUniquePositions = assertUniquePositions;
  view.__hpNodeInputObserver = { inspect, assertUniquePositions };
  return inspect;
}

export const inspectNodeInputObservations = installNodeInputObserver({});
export const assertUniqueNodeInputPositions = inspectNodeInputObservations.assertUniquePositions;

/**
 * Reconcile independently submitted CDP inputs with delivered native events.
 * The browser may deliver additional pointer observations; they remain in the
 * raw trace and never acquire a submitted clock by proximity alone. All source
 * clocks survive coalescing, and the last submitted input must be observed.
 */
export function settleNodeInputLedger(inputs, observations) {
  const inspection = inspectNodeInputObservations(inputs, observations);
  assert.equal(inspection.pendingIndices.length, 0, 'a matched source input needs a complete post-paint observation');
  assert.ok(inspection.finalSeen, 'the final separately submitted input must have a matching native post-paint observation');
  const settled = inputs.map(input => ({ ...input }));
  let through = -1;
  for (const { observationIndex, sourceId: id } of inspection.matchedObservations) {
    const event = observations[observationIndex];
    for (let n = through + 1; n <= id; n++) {
      const coalesced = n !== id || event.coalesced;
      Object.assign(settled[n], { settledAtPaintOpportunity: event.paintOpportunity,
        inputToPaintMs: event.paintOpportunity - inputs[n].eventTime, coalesced,
        firstRafMs: event.firstRaf - inputs[n].eventTime,
        twoRafMs: event.twoRafOpportunity - inputs[n].eventTime, producerWasRaf: event.producerWasRaf,
        disposition: coalesced ? 'superseded-by-latest' : 'latest-candidate' });
    }
    through = id;
  }
  assert.ok(settled.every(input => Number.isFinite(input.inputToPaintMs) && input.inputToPaintMs >= 0),
    'every submitted input retains its own complete, non-negative latency');
  return { inputs: settled, matchedObservations: inspection.matchedObservations,
    unmatchedObservations: inspection.unmatchedIndices.map(index => ({ ...observations[index] })) };
}
