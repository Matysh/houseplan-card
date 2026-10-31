import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAINT_BARRIER_MAX_MS,
  VisualContinuityController,
  subscribePageVisibility,
  contentFingerprint,
  visualFrameFingerprint,
} from '../test-build/visual-continuity.js';

test('#847 shared pagehide is an idempotent hidden signal and disposes with its last card', () => {
  class Surface extends EventTarget {
    listeners = new Map();
    addEventListener(type, listener, options) {
      this.listeners.set(type, (this.listeners.get(type) || 0) + 1);
      super.addEventListener(type, listener, options);
    }
    removeEventListener(type, listener, options) {
      this.listeners.set(type, (this.listeners.get(type) || 0) - 1);
      super.removeEventListener(type, listener, options);
    }
  }
  const doc = new Surface(); doc.visibilityState = 'visible'; doc.defaultView = new Surface();
  const first = [], second = [];
  const stopFirst = subscribePageVisibility(doc, (signal) => first.push(signal));
  const stopSecond = subscribePageVisibility(doc, (signal) => second.push(signal));
  assert.equal(doc.listeners.get('visibilitychange'), 1);
  assert.equal(doc.defaultView.listeners.get('pageshow'), 1);
  assert.equal(doc.defaultView.listeners.get('pagehide'), 1);
  doc.defaultView.dispatchEvent(new Event('pagehide'));
  doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
  doc.defaultView.dispatchEvent(new Event('pagehide'));
  assert.deepEqual(first.map((signal) => signal.kind), ['hidden']);
  assert.deepEqual(second, first);
  const show = new Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true });
  doc.defaultView.dispatchEvent(show);
  assert.equal(first.at(-1).kind, 'pageshow');
  assert.equal(first.at(-1).long, true);
  assert.equal(first.at(-1).persisted, true);
  stopFirst();
  doc.defaultView.dispatchEvent(new Event('pagehide'));
  assert.equal(first.length, 2, 'disconnected subscriber receives no late signal');
  assert.equal(second.length, 3);
  stopSecond();
  assert.equal(doc.listeners.get('visibilitychange'), 0);
  assert.equal(doc.defaultView.listeners.get('pageshow'), 0);
  assert.equal(doc.defaultView.listeners.get('pagehide'), 0);
  doc.defaultView.dispatchEvent(new Event('pagehide'));
  assert.equal(second.length, 3);
});

test('#847 hidden+pagehide preserves the original long-hidden duration', () => {
  const originalNow = Date.now;
  let now = 0;
  Date.now = () => now;
  const doc = new EventTarget(); doc.visibilityState = 'visible'; doc.defaultView = new EventTarget();
  const signals = [];
  const stop = subscribePageVisibility(doc, (signal) => signals.push(signal));
  try {
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'));
    now = 10_000; doc.defaultView.dispatchEvent(new Event('pagehide'));
    now = 20_000; doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'));
    assert.deepEqual(signals.map((signal) => signal.kind), ['hidden', 'visible']);
    assert.equal(signals.at(-1).hiddenFor, 20_000);
    assert.equal(signals.at(-1).long, true);
  } finally { stop(); Date.now = originalNow; }
});

class FakeClock {
  at = 10_000;
  nextId = 1;
  timers = new Map();
  frames = new Map();
  now = () => this.at;
  setTimeout = (callback, delay) => {
    const id = this.nextId++;
    this.timers.set(id, { at: this.at + delay, callback });
    return id;
  };
  clearTimeout = (id) => this.timers.delete(id);
  requestAnimationFrame = (callback) => {
    const id = this.nextId++;
    this.frames.set(id, callback);
    return id;
  };
  cancelAnimationFrame = (id) => this.frames.delete(id);
  advance(ms) {
    const end = this.at + ms;
    while (true) {
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= end)
        .sort((left, right) => left[1].at - right[1].at)[0];
      if (!due) break;
      this.at = due[1].at;
      this.timers.delete(due[0]);
      due[1].callback();
    }
    this.at = end;
  }
  frame() {
    this.at += 16;
    const callbacks = [...this.frames.values()];
    this.frames.clear();
    for (const callback of callbacks) callback(this.at);
  }
}

async function commit(controller, clock, token, fingerprint = 'next') {
  assert.equal(controller.candidateReady(token), true);
  const result = controller.commitAfterPaint(token, {
    updateComplete: async () => undefined,
    stageValid: () => true,
    assetsReady: () => true,
    frameFingerprint: () => fingerprint,
  });
  await Promise.resolve();
  clock.frame();
  await Promise.resolve();
  clock.frame();
  return result;
}

test('quick return is a strict no-op; long return holds the complete frame', () => {
  const clock = new FakeClock();
  let updates = 0;
  const controller = new VisualContinuityController(() => updates++, clock);
  controller.markCompleteFrame('complete');
  const baselineUpdates = updates;
  const token = controller.visibility({
    kind: 'visible', token: 1, at: clock.now(), hiddenFor: 2000, long: false,
  });
  assert.equal(token, 0);
  assert.equal(controller.state, 'steady');
  assert.equal(updates, baselineUpdates, 'quick return schedules no render');

  controller.visibility({
    kind: 'visible', token: 2, at: clock.now(), hiddenFor: 20_000, long: true,
  });
  assert.equal(controller.state, 'holding');
  clock.advance(1000);
  assert.equal(controller.overlayVisible, false);
  assert.equal(controller.frameFingerprint, 'complete');
});

test('state-only frame identity refreshes without scheduling another render', () => {
  const clock = new FakeClock();
  let updates = 0;
  const controller = new VisualContinuityController(() => updates++, clock);
  controller.markCompleteFrame('state-1');
  const baselineUpdates = updates;
  controller.refreshCompleteFrame('state-2');
  assert.equal(controller.frameFingerprint, 'state-2');
  assert.equal(updates, baselineUpdates);
});

test('a candidate commits only after two paint opportunities', async () => {
  const clock = new FakeClock();
  const controller = new VisualContinuityController(() => undefined, clock);
  controller.markCompleteFrame('old');
  const token = controller.beginCandidate('resume');
  const result = commit(controller, clock, token, 'new');
  assert.equal(await result, true);
  assert.equal(controller.state, 'steady');
  assert.equal(controller.frameFingerprint, 'new');
});

test('overlay is delayed, never covers a complete stale frame, and fades after commit', async () => {
  const clock = new FakeClock();
  const controller = new VisualContinuityController(() => undefined, clock);
  const token = controller.beginCandidate('cold-recovery', 'connection');
  assert.equal(controller.overlayVisible, false);
  clock.advance(149);
  assert.equal(controller.overlayVisible, false);
  clock.advance(1);
  assert.equal(controller.overlayPhase, 'entering');
  clock.frame();
  assert.equal(controller.overlayPhase, 'fading-in');
  clock.advance(180); // #1147: the shared surface appearance timing.
  assert.equal(controller.overlayPhase, 'opaque');
  const opaqueAt = clock.now();
  assert.equal(await commit(controller, clock, token), true);
  clock.advance(opaqueAt + 250 - clock.now());
  assert.equal(controller.overlayPhase, 'leaving');
  clock.advance(139);
  assert.equal(controller.overlayVisible, true);
  clock.advance(1); // Shared 140ms opacity-only leave, without shortening the hold.
  assert.equal(controller.state, 'steady');
  assert.equal(controller.overlayVisible, false);
});

test('a candidate that wins during fade-in cancels the overlay without a minimum hold', async () => {
  const clock = new FakeClock();
  const controller = new VisualContinuityController(() => undefined, clock);
  const token = controller.beginCandidate('cold-recovery');
  clock.advance(150);
  clock.frame();
  assert.equal(controller.overlayPhase, 'fading-in');
  assert.equal(await commit(controller, clock, token), true);
  assert.equal(controller.state, 'steady');
  assert.equal(controller.overlayVisible, false);
});

test('a stale recovery token can never commit', async () => {
  const clock = new FakeClock();
  const controller = new VisualContinuityController(() => undefined, clock);
  controller.markCompleteFrame('old');
  const stale = controller.beginCandidate('first');
  controller.beginCandidate('second');
  assert.equal(controller.candidateReady(stale), false);
  assert.equal(await controller.commitAfterPaint(stale, {
    updateComplete: async () => undefined,
    stageValid: () => true,
    assetsReady: () => true,
    frameFingerprint: () => 'stale',
  }), false);
  assert.equal(controller.frameFingerprint, 'old');
});

test('asset readiness is polled inside the bounded barrier and keeps a stale frame on timeout', async () => {
  const clock = new FakeClock();
  const controller = new VisualContinuityController(() => undefined, clock);
  controller.markCompleteFrame('old');
  const token = controller.beginCandidate('asset-refresh', 'asset');
  controller.candidateReady(token);
  const committed = controller.commitAfterPaint(token, {
    updateComplete: async () => undefined,
    stageValid: () => true,
    assetsReady: () => false,
    frameFingerprint: () => 'bad',
  });
  await Promise.resolve();
  clock.advance(PAINT_BARRIER_MAX_MS);
  assert.equal(await committed, false);
  assert.equal(controller.state, 'holding');
  assert.equal(controller.paintTimedOut, true);
  assert.equal(controller.frameFingerprint, 'old');
  assert.equal(controller.trace.at(-1)?.event, 'paint-barrier-timeout');
});

test('a real paint timeout without a complete frame becomes a recoverable error', async () => {
  const clock = new FakeClock();
  const controller = new VisualContinuityController(() => undefined, clock);
  const token = controller.beginCandidate('cold-recovery');
  controller.candidateReady(token);
  const result = controller.commitAfterPaint(token, {
    updateComplete: async () => undefined,
    stageValid: () => true,
    assetsReady: () => true,
    frameFingerprint: () => 'late',
  });
  await Promise.resolve();
  clock.advance(PAINT_BARRIER_MAX_MS);
  assert.equal(await result, false);
  assert.equal(controller.state, 'recovery-error');
  assert.equal(controller.overlayPhase, 'opaque');
});

test('#824 a timeout preserves identity and only external readiness can retry', async () => {
  const clock = new FakeClock();
  let changes = 0;
  const controller = new VisualContinuityController(() => changes++, clock);
  controller.markCompleteFrame('old-pair');
  const token = controller.beginCandidate('replacement');
  assert.equal(controller.canAttemptPaint(false, true), true);
  controller.candidateReady(token);
  const pending = controller.commitAfterPaint(token, {
    updateComplete: async () => undefined,
    stageValid: () => true, assetsReady: () => false,
    frameFingerprint: () => 'new-pair',
  });
  await Promise.resolve(); clock.advance(PAINT_BARRIER_MAX_MS);
  assert.equal(await pending, false);
  assert.equal(controller.state, 'holding');
  assert.equal(controller.frameFingerprint, 'old-pair');
  assert.equal(controller.canAttemptPaint(false, true), false, 'timeout notifications cannot self-retry');
  assert.equal(controller.canAttemptPaint(true, false), false, 'an update cannot bypass missing assets');
  const afterTimeout = changes;
  clock.advance(20_000); clock.frame(); await Promise.resolve();
  assert.equal(changes, afterTimeout, 'no timer/RAF retry loop');
  assert.equal(controller.canAttemptPaint(true, true), true);
  assert.equal(await commit(controller, clock, token, 'new-pair'), true);
  assert.equal(controller.paintTimedOut, false);
  assert.equal(controller.frameFingerprint, 'new-pair');
});

test('content fingerprints are stable across object key order and frame parts', () => {
  assert.equal(contentFingerprint({ b: 2, a: 1 }), contentFingerprint({ a: 1, b: 2 }));
  assert.notEqual(contentFingerprint({ a: 1 }), contentFingerprint({ a: 2 }));
  assert.equal(visualFrameFingerprint([1, 'x']), visualFrameFingerprint([1, 'x']));
  const shared = { value: 1 };
  assert.equal(
    contentFingerprint({ a: shared, b: shared }),
    contentFingerprint({ a: { value: 1 }, b: { value: 1 } }),
    'a shared acyclic reference is hashed by value, not misclassified as a cycle',
  );
});

test('trace diagnostics are returned as a defensive copy', () => {
  const clock = new FakeClock();
  const controller = new VisualContinuityController(() => undefined, clock);
  controller.note('sample', { stage: [10, 20] });
  const trace = controller.trace;
  trace[0].event = 'mutated';
  trace[0].stage[0] = 999;
  assert.equal(controller.trace[0].event, 'sample');
  assert.deepEqual(controller.trace[0].stage, [10, 20]);
});
