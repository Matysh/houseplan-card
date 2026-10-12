/** #863: observe state and paint in the browser, not between Node round trips. */
export function ledDeliveryVerdict(row, expected, phase = 'active') {
  if (!['active', 'settled'].includes(phase)) return false;
  const field = row?.frame?.fields?.filter(f => f.id === expected.id) || [];
  return !row?.error && row?.wheel?.trusted === true && row?.wheel?.coarseObserved === true
    && row.deliveredAt >= row.wheel.at && row.frame?.at >= row.deliveredAt
    && row.before?.fields?.every(f => f.id !== expected.id)
    && row.coarseAtDelivery === (phase === 'active')
    && row.state === 'on' && row.frame?.state === 'on'
    && row.frame.coarse === (phase === 'active') && field.length === 1
    && field[0].retained === 48 && field[0].painted === (phase === 'active' ? 24 : 48)
    && (phase !== 'active' || field[0].correct24 === true)
    && field[0].visible === true && field[0].fill?.toLowerCase() === expected.fill.toLowerCase()
    && field[0].alpha === expected.alpha;
}

/** One actual wheel, one delivery, one frame. No private writes/renewal/retry. */
export async function observeLedStateDelivery(page, wheel, options) {
  await page.evaluate(({ attributes, delayMs = 0 }) => {
    const card = window.__card, stage = card.shadowRoot.querySelector('.stage');
    const probe = window.__ledDelivery = { done: false, frames: [], cancelled: false };
    const quality = () => ({ ...window.__ledZoomOracle.quality(card), at: performance.now(),
      state: card.hass.states['light.ceiling']?.state });
    probe.before = quality();
    const complete = error => { probe.error = error; probe.done = true; };
    probe.timeout = setTimeout(() => { probe.cancelled = true; complete('no contemporaneous native wheel/state frame within 3s'); }, 3000);
    probe.listener = event => {
      probe.wheel = { at: performance.now(), trusted: event.isTrusted, timestamp: event.timeStamp };
      const observe = () => {
        if (probe.cancelled) return;
        const row = quality(); probe.frames.push({ at: row.at, coarse: row.coarse });
        if (!row.coarse) { probe.raf = requestAnimationFrame(observe); return; }
        probe.wheel.coarseObserved = true;
        probe.deliveryTimer = setTimeout(async () => {
          if (probe.cancelled) return;
          probe.deliveredAt = performance.now(); probe.coarseAtDelivery = quality().coarse;
          const previous = card.hass.states['light.ceiling'];
          card.hass = { ...card.hass, states: { ...card.hass.states,
            'light.ceiling': { ...previous, state: 'on', attributes: { ...previous.attributes, ...attributes } } } };
          probe.state = card.hass.states['light.ceiling'].state;
          try {
            await card.updateComplete;
            // Entering source has its own shared frame; observe after it, without
            // waiting for a "good" value or giving a wrong field another chance.
            probe.raf = requestAnimationFrame(() => {
              probe.raf = requestAnimationFrame(() => {
                if (probe.cancelled) return;
                probe.frame = quality(); clearTimeout(probe.timeout); complete(null);
              });
            });
          } catch { complete('state delivery/update failed'); }
        }, delayMs);
      };
      probe.raf = requestAnimationFrame(observe);
    };
    stage.addEventListener('wheel', probe.listener, { once: true });
    probe.stage = stage;
  }, options);
  try {
    await wheel();
    await page.waitForFunction(() => window.__ledDelivery.done, undefined, { timeout: 4000 });
    return await page.evaluate(() => {
      const { before, wheel, frames, deliveredAt, coarseAtDelivery, state, frame, error } = window.__ledDelivery;
      return { before, wheel, frames, deliveredAt, coarseAtDelivery, state, frame, error };
    });
  } finally {
    await page.evaluate(() => {
      const probe = window.__ledDelivery;
      probe.cancelled = true; clearTimeout(probe.timeout); clearTimeout(probe.deliveryTimer);
      cancelAnimationFrame(probe.raf); probe.stage.removeEventListener('wheel', probe.listener);
      delete window.__ledDelivery;
    });
  }
}
