// #1159: execute the real compiled host callback; never read monolith text.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 960, height: 820 });
const report = await page.evaluate(() => {
  const settle = window.__card._settleContinuityFrame;
  const out = {}, diagnostics = {};
  const verify = (name, run) => {
    try { run(); out[name] = true; }
    catch (error) { out[name] = false; diagnostics[name] = String(error?.message || error); }
  };
  const expect = (value, message) => { if (!value) throw Error(message); };
  const host = ({ state = 'steady', complete = true, valid = true, assets = true,
    booting = false, staged = false, refuseGeometryRead = false } = {}) => {
    const calls = { geometry: 0, assets: 0, complete: [], barriers: [], updates: 0 };
    const value = {
      isConnected: true, _booting: booting, _continuityDataReady: true,
      _candidateDeviceSnapshot: staged ? {} : null, _visibleDeviceSnapshot: null, _stagedToken: -1,
      _continuity: {
        state, hasCompleteFrame: complete, token: 7,
        markCompleteFrame: fingerprint => calls.complete.push(fingerprint),
        canAttemptPaint: (_external, ready) => ready,
        candidateReady: token => token === 7,
        commitAfterPaint: (token, ports) => { calls.barriers.push({ token, ports }); return Promise.resolve(false); },
      },
      _continuityStageValid() {
        calls.geometry++;
        if (refuseGeometryRead) throw Error('unnecessary forced layout');
        return valid;
      },
      _continuityAssetsReady() { calls.assets++; return assets; },
      _visualFrameFingerprint() { return 'exact-frame'; },
      requestUpdate() { calls.updates++; },
    };
    return { value, calls };
  };
  verify('compiledHostMethodAvailable', () => expect(typeof settle === 'function', 'missing actual host method'));
  verify('completeSteadyDoesNotMeasureOrPaint', () => {
    const { value, calls } = host({ refuseGeometryRead: true });
    settle.call(value, true);
    expect(calls.geometry === 0 && calls.assets === 0 && calls.barriers.length === 0
      && calls.complete.length === 0, 'steady callback did work');
  });
  verify('coldCompletionStillRequiresPositiveStageAndAssets', () => {
    for (const valid of [false, true]) for (const assets of [false, true]) {
      const { value, calls } = host({ complete: false, valid, assets });
      settle.call(value, true);
      expect(calls.geometry === 1, 'cold stage was not measured');
      expect(calls.complete.length === Number(valid && assets), 'cold frame acceptance changed');
      if (calls.complete.length) expect(calls.complete[0] === 'exact-frame', 'foreign fingerprint');
      expect(calls.barriers.length === 0, 'cold completion bypassed existing route');
    }
  });
  verify('pendingStatesKeepGeometryAndPaintBarrier', () => {
    for (const state of ['holding', 'offline-stale', 'overlay-pending', 'overlay-visible', 'candidate-ready']) {
      for (const valid of [false, true]) for (const assets of [false, true]) {
        const { value, calls } = host({ state, valid, assets });
        settle.call(value, true);
        expect(calls.geometry === 1, state + ': missing real stage check');
        expect(calls.barriers.length === Number(valid && assets), state + ': wrong paint admission');
        if (calls.barriers.length) {
          const { token, ports } = calls.barriers[0];
          expect(token === 7 && ports.frameFingerprint() === 'exact-frame', 'paint identity changed');
          expect(ports.stageValid() === true, 'positive stage rejected');
          value.isConnected = false;
          const before = calls.geometry;
          expect(ports.stageValid() === false && calls.geometry === before, 'detach did not short-circuit stage access');
        }
      }
    }
  });
  verify('bootAndStagedOwnershipRemainFenced', () => {
    const boot = host({ booting: true, complete: false });
    settle.call(boot.value, true);
    expect(boot.calls.geometry === 0, 'boot measured stage');
    const staged = host({ state: 'holding', staged: true });
    settle.call(staged.value, true);
    expect(staged.calls.updates === 1 && staged.value._stagedToken === 7
      && staged.calls.barriers.length === 0, 'staged snapshot skipped its render');
  });
  return { out, diagnostics };
});
if (Object.keys(report.diagnostics).length) console.log(JSON.stringify(report.diagnostics));
await finish(browser, checkAll(report.out));
