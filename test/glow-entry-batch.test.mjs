import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGlowRuntimeState, disposeGlowRuntime, forgetGlowSource, forgetGlowSpace,
  GLOW_FADE_MS, pruneGlowSources, transitionGlowSource,
} from '../test-build/glow-scene.js';

function runtime(reducedMotion = false) {
  let seq = 0, updates = 0, connected = true;
  const frames = new Map(), timers = new Map();
  const win = {
    requestAnimationFrame(cb) { const id = ++seq; frames.set(id, cb); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(cb, delay) { const id = ++seq; timers.set(id, { cb, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const host = { window: () => win, reducedMotion: () => reducedMotion,
    isConnected: () => connected, requestUpdate: () => { updates++; } };
  const state = createGlowRuntimeState();
  return { state, host, frames, timers,
    get updates() { return updates; },
    disconnect() { connected = false; },
    enter(key) { return transitionGlowSource(state, host, key, true); },
    off(key) { return transitionGlowSource(state, host, key, false); },
    frame() { for (const [id, cb] of [...frames]) { frames.delete(id); cb(0); } },
    dispose() { disposeGlowRuntime(state, host); },
  };
}

for (const reduced of [false, true]) {
  test(`50 Glow/LED entries share one frame and one update, reduced motion=${reduced}`, () => {
    const r = runtime(reduced);
    for (let i = 0; i < 50; i++) {
      const result = r.enter(`floor|${i % 2 ? 'lamp' : 'led'}-${i}`);
      assert.equal(result.entering, true);
    }
    assert.equal(r.frames.size, 1, 'old per-source scheduler produces 50 callbacks here');
    assert.equal(r.updates, 0, 'entering state is painted before its next frame');
    assert.equal(r.state.enteringSources.size, 50);
    r.frame();
    assert.equal(r.updates, 1);
    assert.equal(r.state.enteringSources.size, 0);
    assert.equal(r.frames.size, 0);
    for (const key of r.state.renderedSources.keys()) assert.equal(r.enter(key).entering, false);
    assert.equal(r.frames.size, 0, 'steady renders do not schedule entry again');
    r.dispose();
    assert.equal(r.timers.size, 0);
  });
}

test('owners do not share their scheduler or their entering sources', () => {
  const a = runtime(), b = runtime();
  a.enter('floor|same'); b.enter('floor|same');
  a.frame();
  assert.equal(a.updates, 1); assert.equal(b.updates, 0);
  assert.equal(b.state.enteringSources.size, 1);
  b.frame();
  assert.equal(b.updates, 1);
  a.dispose(); b.dispose();
});

test('off before the entry frame preserves its peers and fade-out duration', () => {
  const r = runtime();
  const first = r.enter('s|a'); r.enter('s|b');
  const off = r.off('s|a');
  assert.deepEqual(off, { domId: first.domId, entering: false, leaving: true });
  assert.equal(r.frames.size, 1, 'cancelling one member must not cancel another');
  const timer = r.state.fadeTimers.get('s|a');
  assert.equal(r.timers.get(timer).delay, GLOW_FADE_MS + 34);
  r.frame();
  assert.equal(r.updates, 1);
  assert.equal(r.state.renderedSources.has('s|a'), true, 'off node survives through fade');
  r.timers.get(timer).cb();
  assert.equal(r.state.renderedSources.has('s|a'), false);
  assert.equal(r.state.renderedSources.has('s|b'), true);
  r.dispose();
});

test('rapid off/on keeps DOM identity and rejects its stale fade callback', () => {
  const r = runtime();
  const first = r.enter('s|a');
  r.off('s|a');
  const stale = r.timers.get(r.state.fadeTimers.get('s|a')).cb;
  assert.equal(r.frames.size, 0, 'last departing entry cancels the empty batch');
  assert.deepEqual(r.enter('s|a'), { domId: first.domId, entering: false, leaving: false });
  stale();
  assert.equal(r.state.renderedSources.get('s|a'), first.domId);
  assert.equal(r.updates, 0);
  r.dispose();
});

test('prune/space switch remove only their sources; cancelled old frame cannot consume the new batch', () => {
  const r = runtime();
  r.enter('old|a'); r.enter('old|b');
  const stale = [...r.frames.values()][0];
  pruneGlowSources(r.state, r.host, 'old', new Set(['old|b']));
  assert.equal(r.frames.size, 1);
  forgetGlowSpace(r.state, r.host, 'old');
  assert.equal(r.frames.size, 0);
  assert.equal(r.state.renderedSources.size, 0);
  r.enter('new|c');
  stale();
  assert.equal(r.state.enteringSources.has('new|c'), true);
  assert.equal(r.updates, 0);
  r.frame();
  assert.equal(r.updates, 1);
  r.dispose();
});

test('disconnect/dispose prevent queued entry and fade callbacks from updating their owner', () => {
  const r = runtime();
  r.enter('s|a');
  const staleFrame = [...r.frames.values()][0];
  r.off('s|a');
  const staleFade = r.timers.get(r.state.fadeTimers.get('s|a')).cb;
  r.enter('s|b'); r.disconnect();
  r.frame();
  assert.equal(r.updates, 0);
  r.dispose();
  staleFrame(); staleFade();
  assert.equal(r.updates, 0);
  assert.equal(r.frames.size, 0); assert.equal(r.timers.size, 0);
  assert.equal(r.state.enteringSources.size, 0);
  assert.equal(r.state.renderedSources.size, 0);
  assert.equal(r.state.enterBatches.size, 0);
  assert.equal(r.state.collectingEntryBatch, null);
});

test('forget the last entry cancels its frame without affecting an already visible source', () => {
  const r = runtime();
  r.enter('s|visible'); r.frame();
  r.enter('s|new');
  forgetGlowSource(r.state, r.host, 's|new');
  assert.equal(r.frames.size, 0);
  assert.equal(r.state.renderedSources.has('s|visible'), true);
  assert.equal(r.updates, 1);
  r.dispose();
});

test('a source discovered by an earlier rAF is not consumed by an older pending batch', async () => {
  const r = runtime();
  r.host.window().requestAnimationFrame(() => r.enter('s|later'));
  r.enter('s|first');
  await Promise.resolve(); // finish the synchronous render before the browser frame
  r.frame(); // earlier external callback, then the old entry batch
  assert.equal(r.state.enteringSources.has('s|first'), false);
  assert.equal(r.state.enteringSources.has('s|later'), true,
    'the newly rendered source needs its own initial entering frame');
  assert.equal(r.frames.size, 1);
  assert.equal(r.updates, 1);
  await Promise.resolve();
  r.frame();
  assert.equal(r.state.enteringSources.size, 0);
  assert.equal(r.updates, 2);
  r.dispose();
});

test('forget/re-add of the same key cannot let an earlier batch consume its new entry', async () => {
  const r = runtime();
  r.enter('s|a'); r.enter('s|peer');
  await Promise.resolve();
  forgetGlowSource(r.state, r.host, 's|a');
  const oldFrame = [...r.frames.values()][0];
  r.enter('s|a');
  oldFrame();
  assert.equal(r.state.enteringSources.has('s|a'), true);
  assert.equal(r.state.enteringSources.has('s|peer'), false);
  r.frame();
  assert.equal(r.state.enteringSources.size, 0);
  assert.equal(r.updates, 2);
  r.dispose();
});

test('a reused runtime ignores old frames and microtasks after dispose', async () => {
  const r = runtime();
  r.enter('s|same');
  const oldFrame = [...r.frames.values()][0];
  r.dispose();
  // Runs between the old seal-microtask and the new one. A stale seal must
  // not clear the new collecting batch and split this peer into a second rAF.
  queueMicrotask(() => r.enter('s|peer'));
  r.enter('s|same');
  oldFrame();
  await Promise.resolve();
  assert.equal(r.state.enteringSources.has('s|same'), true);
  assert.equal(r.state.enteringSources.has('s|peer'), true);
  assert.equal(r.frames.size, 1);
  assert.equal(r.updates, 0);
  r.frame();
  assert.equal(r.updates, 1);
  assert.equal(r.state.enteringSources.size, 0);
  r.dispose();
});
