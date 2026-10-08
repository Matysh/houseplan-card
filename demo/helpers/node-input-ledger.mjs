import assert from 'node:assert/strict';

/** Determine the epoch-to-native-clock conversion from independent probes. */
export function nodeInputClockCalibration(probes, observations, timeOrigin) {
  assert.ok(probes.length >= 3 && Number.isFinite(timeOrigin), 'native clock calibration needs at least three independent probes');
  const pairs = probes.map(probe => {
    const matches = observations.filter(event => Math.abs(probe.x - event.x) < .001 && Math.abs(probe.y - event.y) < .001);
    assert.equal(matches.length, 1, 'each independent clock probe must have exactly one native observation');
    const event = matches[0], epochRelative = probe.epochMs - timeOrigin;
    assert.ok(Number.isFinite(event.eventTime) && Number.isFinite(epochRelative), 'clock probe timestamps must be finite');
    return { ...probe, eventTime: event.eventTime, epochRelative, offsetMs: event.eventTime - epochRelative };
  });
  const offsets = pairs.map(pair => pair.offsetMs), offsetMs = Math.min(...offsets);
  const spreadMs = Math.max(...offsets) - offsetMs;
  assert.ok(spreadMs <= .25, `native clock calibration must be stable within 0.25ms (spread ${spreadMs}ms)`);
  // The lower edge is conservative: timestamp quantisation cannot make an
  // input appear later, and therefore cannot under-report input-to-paint time.
  return { offsetMs, spreadMs, pairs, observations };
}

/** Native probes run before mouse-down, never using the measured input stream. */
export async function calibrateNodeInputClock(page, cdp, timeOrigin) {
  await page.evaluate(() => {
    const probe = window.__hpNodeClockProbe = { events: [] };
    probe.listener = event => probe.events.push({ eventTime: event.timeStamp, x: event.clientX, y: event.clientY });
    document.addEventListener('pointermove', probe.listener, true);
  });
  try {
    const probes = [];
    for (let index = 0; index < 3; index++) {
      const position = { x: 10 + index * 3, y: 10 }, epochMs = Date.now();
      probes.push({ ...position, epochMs });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...position, buttons: 0,
        pointerType: 'mouse', timestamp: epochMs / 1000 });
      await page.waitForFunction(position => window.__hpNodeClockProbe.events.some(event =>
        Math.abs(event.x - position.x) < .001 && Math.abs(event.y - position.y) < .001), position);
    }
    const observations = await page.evaluate(() => window.__hpNodeClockProbe.events);
    return nodeInputClockCalibration(probes, observations, timeOrigin);
  } finally {
    await page.evaluate(() => {
      document.removeEventListener('pointermove', window.__hpNodeClockProbe.listener, true);
      delete window.__hpNodeClockProbe;
    });
  }
}

/**
 * Reconcile independently submitted CDP inputs with delivered native events.
 * The browser may deliver additional pointer observations; they remain in the
 * raw trace and never acquire a submitted clock by proximity alone. All source
 * clocks survive coalescing, and the last submitted input must be observed.
 */
export function settleNodeInputLedger(inputs, observations) {
  assert.ok(inputs.length > 0, 'a source-input ledger cannot be empty');
  assert.ok(inputs.every((input, index) => input.id === index
    && Number.isFinite(input.eventTime)
    && (!index || input.eventTime > inputs[index - 1].eventTime)),
  'submitted clocks and IDs must be distinct and monotonic');
  const settled = inputs.map(input => ({ ...input })), unmatchedObservations = [], matchedObservations = [];
  let through = -1;
  for (const event of observations) {
    // CDP epoch-to-performance conversion has sub-ms rounding. Screen position
    // disambiguates unrelated browser events instead of widening that tolerance.
    const matches = inputs.filter(input => Math.abs(input.eventTime - event.eventTime) < 1.5
      && Math.abs(input.x - event.x) < .001 && Math.abs(input.y - event.y) < .001);
    assert.ok(matches.length <= 1, 'a native event cannot identify multiple source inputs');
    if (!matches.length) {
      unmatchedObservations.push({ ...event });
      continue;
    }
    const id = matches[0].id;
    assert.ok(id > through, 'matched native source inputs must be observed in submission order');
    assert.ok(Number.isFinite(event.paintOpportunity) && event.paintOpportunity >= event.eventTime,
      'a matched source input needs a complete post-paint observation');
    matchedObservations.push({ observationId: event.id, sourceId: id });
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
  assert.equal(through, inputs.length - 1, 'the final separately submitted input must have a matching native post-paint observation');
  assert.ok(settled.every(input => Number.isFinite(input.inputToPaintMs) && input.inputToPaintMs >= 0),
    'every submitted input retains its own complete, non-negative latency');
  return { inputs: settled, matchedObservations, unmatchedObservations };
}
