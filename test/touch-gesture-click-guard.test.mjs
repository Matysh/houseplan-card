import assert from 'node:assert/strict';
import test from 'node:test';
import { TouchGestureClickGuard } from '../test-build/touch-gesture-click-guard.js';

const activation = (guard, type = 'click', init = {}) => {
  const event = { type, defaultPrevented: false, immediateStopped: false, ...init,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.immediateStopped = true; } };
  guard.handleActivation(event, false);
  return event;
};

test('#831 modal takeover blocks old and delayed activations, not a fresh press', () => {
  for (const type of ['mouse', 'touch']) for (const terminal of ['pointerup', 'pointercancel']) {
    const guard = new TouchGestureClickGuard();
    guard.pointerDown(1, type); guard.interruptForModal(1);
    assert.equal(activation(guard).defaultPrevented, true, 'old held click blocked');
    guard.pointerTerminal(99, type, terminal);
    activation(guard, 'keydown', { key: 'Enter' });
    assert.equal(activation(guard).defaultPrevented, true, 'foreign terminal cannot re-arm');
    guard.pointerTerminal(1, type, terminal);
    assert.equal(activation(guard).defaultPrevented, true, 'terminal does not admit delayed click');
    activation(guard, 'keydown', { key: 'Tab' });
    assert.equal(activation(guard, 'contextmenu').immediateStopped, true, 'Tab is not action intent');
    guard.pointerDown(2, type);
    assert.equal(activation(guard).defaultPrevented, false, 'fresh dialog press works immediately');
  }
});

test('#831 capture loss and second contact cannot re-arm the held modal tail', () => {
  const guard = new TouchGestureClickGuard();
  guard.pointerDown(1, 'touch'); guard.interruptForModal(1);
  guard.pointerTerminal(1, 'touch', 'lostpointercapture');
  guard.pointerDown(2, 'touch');
  assert.equal(activation(guard).defaultPrevented, true, 'old physical contact still owns modal tail');
  guard.pointerTerminal(2, 'touch');
  activation(guard, 'keydown', { key: ' ' });
  assert.equal(activation(guard).defaultPrevented, true, 'keyboard cannot re-arm before old release');
  guard.pointerTerminal(1, 'touch');
  assert.equal(activation(guard).defaultPrevented, true);
  guard.pointerDown(3, 'touch');
  assert.equal(activation(guard).defaultPrevented, false);
});

test('#831 keyboard modal intent, reused mouse id and remount reset are bounded', () => {
  for (const key of ['Enter', ' ']) {
    const guard = new TouchGestureClickGuard();
    guard.pointerDown(1, 'mouse'); guard.interruptForModal(1);
    activation(guard, 'keydown', { key });
    assert.equal(activation(guard).defaultPrevented, true, 'held mouse has not ended');
    guard.pointerTerminal(1, 'mouse');
    activation(guard, 'keydown', { key });
    assert.equal(activation(guard).defaultPrevented, false, 'keyboard button action after release works');
    guard.interruptForModal(1); guard.pointerDown(1, 'mouse');
    assert.equal(activation(guard).defaultPrevented, false, 'real new down proves old mouse has ended');
    guard.interruptForModal(1); guard.reset();
    assert.equal(activation(guard).defaultPrevented, false, 'remount discards old modal ownership');
  }
});

test('#831 modal keyboard re-arm never bypasses the completed pinch barrier', () => {
  const guard = new TouchGestureClickGuard();
  guard.pointerDown(1, 'touch'); guard.interruptForModal(1); guard.pointerDown(2, 'touch');
  guard.pointerTerminal(1, 'touch'); guard.pointerTerminal(2, 'touch');
  activation(guard, 'keydown', { key: 'Enter' });
  assert.equal(activation(guard).defaultPrevented, true, 'pinch compatibility tail still blocked');
  guard.pointerDown(3, 'mouse');
  assert.equal(activation(guard).defaultPrevented, false, 'new hybrid mouse input works');
});

test('#563 multi-touch keeps every unowned click blocked after both releases', () => {
  const guard = new TouchGestureClickGuard();
  guard.pointerDown(1, 'touch');
  guard.pointerDown(2, 'touch');
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

  guard.pointerDown(3, 'touch');
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

test('#578 active and completed pinch own click and context-menu activation', () => {
  const guard = new TouchGestureClickGuard();
  guard.pointerDown(1, 'touch');
  guard.pointerDown(2, 'touch');
  assert.equal(guard.clickBlocked, true, 'activation is blocked while both contacts are active');

  guard.pointerTerminal(1, 'touch');
  assert.equal(guard.clickBlocked, true, 'the remaining old contact cannot become a new gesture');
  guard.pointerTerminal(2, 'touch');
  assert.equal(guard.clickBlocked, true, 'compatibility activation stays owned after release');
});

test('#578 keyboard intent re-arms context menu only after every old touch ended', () => {
  const guard = new TouchGestureClickGuard();
  const activation = (type, init = {}) => {
    const event = {
      type, defaultPrevented: false, immediateStopped: false, ...init,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.immediateStopped = true; },
    };
    assert.equal(guard.handleActivation(event, false), true);
    return event;
  };
  guard.pointerDown(1, 'touch');
  guard.pointerDown(2, 'touch');

  activation('keydown', { key: 'F10', shiftKey: true });
  assert.equal(guard.clickBlocked, true, 'a key cannot re-arm actions during an active pinch');
  guard.pointerTerminal(1, 'touch');
  activation('keydown', { key: 'ContextMenu', shiftKey: false });
  assert.equal(guard.clickBlocked, true, 'the last old touch still owns the sequence');
  guard.pointerTerminal(2, 'touch');

  activation('keydown', { key: 'Tab', shiftKey: false });
  assert.equal(guard.clickBlocked, true, 'an unrelated key is not new pointer intent');
  const staleContextMenu = activation('contextmenu');
  assert.equal(staleContextMenu.defaultPrevented, true);
  assert.equal(staleContextMenu.immediateStopped, true);

  activation('keydown', { key: 'F10', shiftKey: true });
  assert.equal(guard.clickBlocked, false, 'Shift+F10 is fresh intent after all contacts ended');
  const freshContextMenu = activation('contextmenu');
  assert.equal(freshContextMenu.defaultPrevented, false);
});

test('#847 blur makes mouse/touch tails inert without forgetting physical owners', () => {
  for (const type of ['mouse', 'touch']) {
    const guard = new TouchGestureClickGuard();
    guard.pointerDown(1, type);
    guard.interrupt();
    assert.equal(guard.hasPointer(1), true);
    assert.equal(activation(guard, 'keydown', { key: 'Enter' }).defaultPrevented, true);
    guard.pointerTerminal(99, type);
    assert.equal(activation(guard, 'contextmenu').defaultPrevented, true);
    guard.pointerTerminal(1, type);
    assert.equal(activation(guard).defaultPrevented, true, 'release is not fresh intent');
    assert.equal(activation(guard, 'contextmenu').defaultPrevented, true);
    assert.equal(activation(guard, 'keydown', { key: 'Enter' }).defaultPrevented, false);
    guard.pointerDown(2, type); guard.pointerTerminal(2, type);
    assert.equal(activation(guard).defaultPrevented, false, 'first deliberate tap works');
  }
});

test('#847 hidden/pagehide abandon contacts, not the old activation tail', () => {
  for (const count of [1, 2]) for (const fresh of ['touch', 'mouse', 'ContextMenu', 'Enter']) {
    const guard = new TouchGestureClickGuard();
    guard.pointerDown(1, 'touch');
    if (count === 2) guard.pointerDown(2, 'touch');
    guard.abandon(); guard.abandon();
    assert.equal(guard.sequenceMultitouch, false);
    assert.equal(guard.hasPointer(1), false);
    guard.pointerTerminal(1, 'touch');
    assert.equal(activation(guard).defaultPrevented, true);
    assert.equal(activation(guard, 'contextmenu').defaultPrevented, true);
    if (fresh === 'ContextMenu' || fresh === 'Enter') {
      assert.equal(activation(guard, 'keydown', { key: fresh }).defaultPrevented, false);
      if (fresh === 'ContextMenu') assert.equal(activation(guard, 'contextmenu').defaultPrevented, false);
    } else {
      guard.pointerDown(3, fresh);
      guard.pointerTerminal(2, 'touch'); // late forgotten terminal cannot retire 3
      assert.equal(guard.hasPointer(3), true);
      guard.pointerTerminal(3, fresh);
      assert.equal(activation(guard).defaultPrevented, false);
    }
    guard.pointerDown(4, 'touch'); guard.pointerDown(5, 'touch');
    assert.equal(guard.sequenceMultitouch, true, 'a new pinch is still navigation');
    assert.equal(activation(guard).defaultPrevented, true);
  }
});

test('#847 F84 capture loss keeps the physically held contact until up/cancel', () => {
  const guard = new TouchGestureClickGuard();
  guard.pointerDown(1, 'touch');
  guard.pointerTerminal(1, 'touch', 'lostpointercapture');
  assert.equal(guard.hasPointer(1), true);
  guard.pointerDown(2, 'touch');
  assert.equal(guard.sequenceMultitouch, true);
  guard.pointerTerminal(2, 'touch'); guard.pointerTerminal(1, 'touch');
  assert.equal(activation(guard).defaultPrevented, true);
  guard.pointerDown(3, 'touch'); guard.pointerTerminal(3, 'touch');
  assert.equal(guard.hasPointer(3), false);
  guard.pointerTerminal(3, 'touch', 'lostpointercapture');
  assert.equal(activation(guard).defaultPrevented, false, 'implicit post-up loss is not cancellation');
});

test('#847 F86 hold/navigation tails block contextmenu, fresh desktop intent works', () => {
  const guard = new TouchGestureClickGuard();
  guard.pointerDown(1, 'touch'); guard.interrupt(1);
  guard.pointerTerminal(1, 'touch', 'lostpointercapture');
  assert.equal(activation(guard, 'contextmenu').defaultPrevented, true);
  guard.pointerTerminal(1, 'touch');
  assert.equal(activation(guard, 'contextmenu').defaultPrevented, true);
  guard.pointerDown(2, 'mouse'); guard.pointerTerminal(2, 'mouse');
  assert.equal(activation(guard, 'contextmenu').defaultPrevented, false);
  guard.pointerDown(3, 'touch'); guard.interrupt(); guard.pointerTerminal(3, 'touch');
  activation(guard, 'keydown', { key: 'ContextMenu' });
  assert.equal(activation(guard, 'contextmenu').defaultPrevented, false);
});
