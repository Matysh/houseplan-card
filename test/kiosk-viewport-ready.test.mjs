import test from 'node:test';
import assert from 'node:assert/strict';
import { kioskViewportReady, waitForKioskViewport } from '../demo/helpers/kiosk-viewport-ready.mjs';

function fixture() {
  const animations = [];
  const stage = { clientWidth: 780, clientHeight: 800, getAnimations: () => animations };
  const card = { isConnected: true, _booting: false, isUpdatePending: false,
    _modeTransitionBusy: false, _cameraTransition: { active: false },
    _lastValidStageSize: [780, 800], _refitRaf: 0, _pendingRefitSize: null,
    _zoom: 1.72549, shadowRoot: { querySelector: () => stage } };
  globalThis.window = { __card: card };
  globalThis.document = { fonts: { status: 'loaded' } };
  return { animations, stage, card };
}
test.afterEach(() => { delete globalThis.window; delete globalThis.document; });

test('#949 readiness rejects native CSS resize even when sampled sizes agree', () => {
  const h = fixture();
  h.animations.push({ transitionProperty: 'height', playState: 'running', currentTime: 183.334 });
  assert.equal(kioskViewportReady(), false);
  // A second equal box / another fake RAF is not a CSS timeline barrier.
  assert.equal(kioskViewportReady(), false);
  h.animations[0].playState = 'paused';
  assert.equal(kioskViewportReady(), false);
  h.animations[0].playState = 'finished';
  assert.equal(kioskViewportReady(), true);
  assert.equal(h.card._zoom, 1.72549, 'readiness never waits for or writes idle-fit outcome');
});

test('#949 CSS completion still waits for the actual refit/Lit owner', () => {
  for (const change of [
    h => { h.card._lastValidStageSize = [780, 787]; },
    h => { h.card._pendingRefitSize = [780, 800]; },
    h => { h.card._refitRaf = 42; },
    h => { h.card.isUpdatePending = true; },
    h => { h.card._cameraTransition.active = true; },
    h => { h.card._modeTransitionBusy = true; },
    h => { h.card._booting = true; },
    h => { h.card.isConnected = false; },
    h => { h.stage.clientHeight = 0; },
    () => { document.fonts.status = 'loading'; },
  ]) {
    const h = fixture(); change(h);
    assert.equal(kioskViewportReady(), false);
  }
  fixture();
  assert.equal(kioskViewportReady(), true);
});

test('#949 bounded setup failure retains native animation/geometry diagnostics', async () => {
  fixture().animations.push({ transitionProperty: 'height', playState: 'running', currentTime: 183.334 });
  const page = {
    waitForFunction: async (probe, argument, options) => {
      assert.equal(probe(argument), false);
      assert.deepEqual(options, { timeout: 5000 });
      throw new Error('setup timeout');
    },
    evaluate: async (probe, argument) => probe(argument),
  };
  await assert.rejects(waitForKioskViewport(page), error =>
    error.cause.message === 'setup timeout' && /"time":183.334/.test(error.message)
      && /"size":\[780,800\]/.test(error.message));
});
