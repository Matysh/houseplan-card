import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAINT_BARRIER_MAX_MS,
  VisualContinuityController,
  contentFingerprint,
  visualFrameFingerprint,
} from '../test-build/visual-continuity.js';

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
  clock.advance(150);
  assert.equal(controller.overlayPhase, 'opaque');
  assert.equal(await commit(controller, clock, token), true);
  clock.advance(250);
  assert.equal(controller.overlayPhase, 'leaving');
  clock.advance(180);
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

test('a readiness loss rejects recoverably without masquerading as a timeout', async () => {
  const clock = new FakeClock();
  const controller = new VisualContinuityController(() => undefined, clock);
  controller.markCompleteFrame('old');
  const token = controller.beginCandidate('asset-refresh', 'asset');
  controller.candidateReady(token);
  const committed = await controller.commitAfterPaint(token, {
    updateComplete: async () => undefined,
    stageValid: () => true,
    assetsReady: () => false,
    frameFingerprint: () => 'bad',
  });
  assert.equal(committed, false);
  assert.equal(controller.state, 'holding');
  assert.equal(controller.frameFingerprint, 'old');
  assert.equal(controller.trace.at(-1)?.event, 'paint-barrier-rejected');
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

test('content fingerprints are stable across object key order and frame parts', () => {
  assert.equal(contentFingerprint({ b: 2, a: 1 }), contentFingerprint({ a: 1, b: 2 }));
  assert.notEqual(contentFingerprint({ a: 1 }), contentFingerprint({ a: 2 }));
  assert.equal(visualFrameFingerprint([1, 'x']), visualFrameFingerprint([1, 'x']));
});
