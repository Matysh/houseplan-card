import assert from 'node:assert/strict';
import test from 'node:test';
import { VIEW_HOLD_MS, ViewHoldGesture } from '../test-build/view-hold.js';

function setup() {
  let now = 0, nextId = 0;
  const timers = new Map(), queued = [];
  const clock = {
    setTimeout(callback, delay) {
      const id = ++nextId;
      timers.set(id, { at: now + delay, callback });
      queued.push(callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now) {
        timers.delete(id); timer.callback();
      }
    },
  };
  return { clock, timers, queued, hold: new ViewHoldGesture(clock) };
}

test('#847 one View hold fires once at 600 ms, only for its current owner', () => {
  const { hold, clock, timers } = setup();
  let calls = 0;
  assert.equal(VIEW_HOLD_MS, 600);
  hold.arm(1, () => ++calls);
  clock.advance(599);
  assert.equal(calls, 0);
  hold.cancel(99);
  assert.equal(hold.pointerId, 1);
  clock.advance(1);
  assert.equal(calls, 1);
  assert.equal(hold.pointerId, null);
  hold.cancel(1); hold.cancel();
  clock.advance(1200);
  assert.equal(calls, 1);
  assert.equal(timers.size, 0);
});

test('#847 owner terminal and each lifecycle exit retire the timer and queued callback', () => {
  for (const ending of ['up', 'cancel', 'lostcapture', 'blur', 'hidden', 'space', 'disconnect']) {
    const { hold, clock, timers, queued } = setup();
    let calls = 0;
    hold.arm(7, () => ++calls);
    clock.advance(200);
    hold.cancel(['up', 'cancel', 'lostcapture'].includes(ending) ? 7 : undefined);
    assert.equal(timers.size, 0, ending);
    assert.equal(hold.pointerId, null, ending);
    clock.advance(1000); queued[0]();
    assert.equal(calls, 0, `${ending}: even an already queued callback is inert`);
    hold.arm(7, () => ++calls);
    queued[0]();
    assert.equal(calls, 0, `${ending}: reused pointer id is not the retired press`);
    clock.advance(600);
    assert.equal(calls, 1, `${ending}: fresh hold works immediately`);
  }
});

test('#847 re-arm leaves one timer and old callback cannot interrupt the new gesture', () => {
  const { hold, clock, timers, queued } = setup();
  const fired = [];
  hold.arm(1, () => fired.push(1));
  clock.advance(200);
  hold.arm(2, () => fired.push(2));
  assert.equal(timers.size, 1);
  queued[0]();
  assert.equal(hold.pointerId, 2);
  assert.deepEqual(fired, []);
  clock.advance(600);
  assert.deepEqual(fired, [2]);
});
