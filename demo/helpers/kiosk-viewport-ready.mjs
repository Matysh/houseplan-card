// #949: JS clock jumps do not advance Chromium's CSS height timeline.
// Read setup lifecycle only; in particular, never wait for the asserted zoom.
export function kioskViewportReady(diagnostics = false) {
  const card = window.__card;
  const stage = card?.shadowRoot?.querySelector('.stage');
  const size = stage ? [stage.clientWidth, stage.clientHeight] : null;
  const accepted = card?._lastValidStageSize;
  const heights = stage?.getAnimations().filter(a => a.transitionProperty === 'height')
    .map(a => ({ state: a.playState, time: a.currentTime })) || [];
  const snapshot = {
    connected: card?.isConnected === true, booting: card?._booting,
    updatePending: card?.isUpdatePending, fonts: document.fonts.status,
    modeBusy: card?._modeTransitionBusy, cameraBusy: card?._cameraTransition?.active,
    size, accepted, refit: card?._refitRaf, pending: card?._pendingRefitSize, heights,
  };
  if (diagnostics) return snapshot;
  return snapshot.connected && snapshot.booting === false && snapshot.updatePending === false
    && snapshot.fonts === 'loaded' && snapshot.modeBusy === false && snapshot.cameraBusy === false
    && !!size && size.every(n => Number.isFinite(n) && n > 0)
    && !!accepted && accepted.every((n, i) => n === size[i])
    && snapshot.refit === 0 && snapshot.pending === null
    && heights.every(a => a.state === 'finished' || a.state === 'idle');
}

/** Call while page.clock is still running, before freeze/Enter/deadline checks. */
export async function waitForKioskViewport(page) {
  try {
    await page.waitForFunction(kioskViewportReady, false, { timeout: 5000 });
  } catch (cause) {
    const snapshot = await page.evaluate(kioskViewportReady, true).catch(() => null);
    throw new Error(`Kiosk setup did not settle before clock pause: ${JSON.stringify(snapshot)}`, { cause });
  }
}
