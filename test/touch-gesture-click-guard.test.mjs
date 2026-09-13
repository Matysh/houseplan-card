import assert from 'node:assert/strict';
import test from 'node:test';
import { TouchGestureClickGuard } from '../test-build/touch-gesture-click-guard.js';

test('#563 multi-touch keeps every unowned click blocked after both releases', () => {
  const guard = new TouchGestureClickGuard();
  assert.equal(guard.pointerDown(1, 'touch'), false);
  assert.equal(guard.pointerDown(2, 'touch'), true);
  assert.equal(guard.sequenceMultitouch, true);
  assert.equal(guard.clickBlocked, true);

  assert.equal(guard.pointerTerminal(1, 'touch'), true);
  assert.equal(guard.sequenceMultitouch, true);
  assert.equal(guard.clickBlocked, true);
  assert.equal(guard.pointerTerminal(2, 'touch'), true);
  assert.equal(guard.sequenceMultitouch, false);
  assert.equal(guard.clickBlocked, true);
});

test('#563 a new single-pointer sequence re-arms its click immediately', () => {
  const guard = new TouchGestureClickGuard();
  guard.pointerDown(1, 'touch');
  guard.pointerDown(2, 'touch');
  guard.pointerTerminal(2, 'touch');
  guard.pointerTerminal(1, 'touch');
  assert.equal(guard.clickBlocked, true);

  assert.equal(guard.pointerDown(3, 'touch'), false);
  assert.equal(guard.clickBlocked, false);
  assert.equal(guard.pointerTerminal(3, 'touch'), false);
  assert.equal(guard.clickBlocked, false);
});

test('#563 reverse release, cancel and lost capture never turn a pinch into a tap', () => {
  for (const terminals of [
    ['pointerup', 'pointercancel'],
    ['lostpointercapture', 'pointerup'],
  ]) {
    const guard = new TouchGestureClickGuard();
    guard.pointerDown(10, 'touch');
    guard.pointerDown(11, 'touch');
    // Event names are deliberately irrelevant to the state transition: every
    // terminal removes its exact pointer but preserves multi-touch ownership.
    assert.equal(guard.pointerTerminal(11, 'touch'), true, terminals[0]);
    assert.equal(guard.pointerTerminal(10, 'touch'), true, terminals[1]);
    assert.equal(guard.clickBlocked, true);
  }
});

test('#563 a new mouse sequence on a hybrid device is not held by an old pinch', () => {
  const guard = new TouchGestureClickGuard();
  guard.pointerDown(1, 'touch');
  guard.pointerDown(2, 'touch');
  guard.pointerTerminal(1, 'touch');
  guard.pointerTerminal(2, 'touch');
  assert.equal(guard.clickBlocked, true);

  guard.pointerDown(20, 'mouse');
  assert.equal(guard.clickBlocked, false);
  guard.reset();
  assert.equal(guard.sequenceMultitouch, false);
  assert.equal(guard.clickBlocked, false);
});
