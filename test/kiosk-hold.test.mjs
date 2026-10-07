import assert from 'node:assert/strict';
import test from 'node:test';
import { KIOSK_HOLD_MS, KioskHoldGesture } from '../test-build/kiosk-hold.js';

/** A manual clock: timers run only when the test advances time. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(callback, delay) {
      const id = nextId++;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at > now || !timers.has(id)) continue;
        timers.delete(id);
        timer.callback();
      }
    },
    get pending() { return timers.size; },
  };
}

const gesture = () => {
  const clock = fakeClock();
  const fired = [];
  const hold = new KioskHoldGesture((pointerId) => fired.push(pointerId), clock);
  return { clock, fired, hold };
};

test('#813 AC2 the 3 s kiosk hold fires once, for the pointer that armed it', () => {
  assert.equal(KIOSK_HOLD_MS, 3000);
  const { clock, fired, hold } = gesture();
  hold.arm(7);
  assert.equal(hold.pointerId, 7);
  clock.advance(KIOSK_HOLD_MS - 1);
  assert.deepEqual(fired, []);
  clock.advance(1);
  assert.deepEqual(fired, [7]);
  assert.equal(hold.pointerId, null, 'a fired hold owns no pointer any more');
  clock.advance(KIOSK_HOLD_MS * 3);
  assert.deepEqual(fired, [7], 'one hold, one dialog');
});

test('#813 AC1 the same hold repeats: each new press arms a fresh hold', () => {
  const { clock, fired, hold } = gesture();
  for (const pointerId of [1, 1, 1]) {
    hold.arm(pointerId);
    clock.advance(KIOSK_HOLD_MS);
    hold.cancel(); // the release of the press that opened the dialog
  }
  assert.deepEqual(fired, [1, 1, 1]);
  assert.equal(clock.pending, 0);
});

test('#813 AC2 an ordinary tap, a second contact, cancel, lost capture, blur and disconnect never fire', () => {
  // The card maps each of these endings to cancel(); none may leave a timer.
  for (const [ending, at] of [
    ['tap release', 120], ['second contact', 400], ['pointercancel', 900],
    ['lostpointercapture', 1500], ['window blur', 2000], ['disconnect', KIOSK_HOLD_MS - 1],
  ]) {
    const { clock, fired, hold } = gesture();
    hold.arm(3);
    clock.advance(at);
    hold.cancel();
    assert.equal(clock.pending, 0, `${ending} left a timer`);
    assert.equal(hold.pointerId, null, `${ending} kept its pointer`);
    clock.advance(KIOSK_HOLD_MS * 2);
    assert.deepEqual(fired, [], `${ending} opened the dialog`);
  }
});

test('#813 re-arming replaces the running hold instead of adding a second one', () => {
  const { clock, fired, hold } = gesture();
  hold.arm(1);
  clock.advance(2000);
  hold.arm(2);
  assert.equal(clock.pending, 1);
  clock.advance(1500);
  assert.deepEqual(fired, [], 'the first press no longer owns a timer');
  clock.advance(1500);
  assert.deepEqual(fired, [2]);
});

test('#813 cancel after the hold fired is a no-op', () => {
  const { clock, fired, hold } = gesture();
  hold.arm(5);
  clock.advance(KIOSK_HOLD_MS);
  hold.cancel();
  hold.cancel();
  assert.deepEqual(fired, [5]);
  hold.arm(6);
  clock.advance(KIOSK_HOLD_MS);
  assert.deepEqual(fired, [5, 6]);
});
