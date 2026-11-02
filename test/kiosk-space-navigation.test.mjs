import assert from 'node:assert/strict';
import test from 'node:test';
import { KioskSpaceNavigation, KIOSK_NAV_IDLE_MS } from '../test-build/kiosk-space-navigation.js';

function fixture() {
  const pending = new Map(); let next = 0, paints = 0;
  const clock = { setTimeout(fn, delay) { const id = ++next; pending.set(id, { fn, delay }); return id; }, clearTimeout(id) { pending.delete(id); } };
  const navigation = new KioskSpaceNavigation(() => paints++, clock);
  navigation.sync(true);
  const expire = () => { const timers = [...pending]; pending.clear(); for (const [, timer] of timers) timer.fn(); };
  return { navigation, pending, expire, paints: () => paints };
}

test('initially hidden; hover, wheel and keyboard alone cannot reveal it', () => {
  const f = fixture();
  for (const event of [{ type: 'pointermove', pointerId: 1 }, { type: 'wheel' }, { type: 'keydown' }, { type: 'pointerdown', pointerId: 1, button: 2 }]) f.navigation.interact(event);
  assert.equal(f.navigation.visible, false); assert.equal(f.pending.size, 0); assert.equal(f.paints(), 0);
});

test('click reveals for five idle seconds; continuing actions invalidate the old timer', () => {
  const f = fixture(); f.navigation.interact({ type: 'click' });
  assert.equal(f.navigation.visible, true); assert.equal(f.pending.size, 1);
  const old = [...f.pending.values()][0]; assert.equal(old.delay, KIOSK_NAV_IDLE_MS); assert.equal(old.delay, 5000);
  for (const type of ['click', 'wheel', 'keydown']) {
    f.navigation.interact({ type }); assert.equal(f.pending.size, 1); old.fn(); assert.equal(f.navigation.visible, true);
  }
  f.expire(); assert.equal(f.navigation.visible, false); assert.equal(f.paints(), 2);
  f.navigation.interact({ type: 'click' }); assert.equal(f.navigation.visible, true, 'an interrupted exit can reverse');
});

test('multiple fingers keep it alive until the last pointer ends, including an outside terminal', () => {
  const f = fixture();
  for (const pointerId of [1, 2]) f.navigation.interact({ type: 'pointerdown', pointerId, button: 0 });
  assert.equal(f.navigation.visible, true); assert.equal(f.pending.size, 0);
  f.navigation.interact({ type: 'pointermove', pointerId: 1 });
  f.navigation.release(99); f.navigation.release(1); assert.equal(f.pending.size, 0);
  f.navigation.release(2); assert.equal(f.pending.size, 1); assert.equal(f.navigation.ownsPointer(2), false);
  f.expire(); assert.equal(f.navigation.visible, false);
});

test('ineligible state or disconnect clears timers/pointers; reenabling starts hidden', () => {
  const f = fixture(); f.navigation.interact({ type: 'click' }); const old = [...f.pending.values()][0];
  f.navigation.sync(false); assert.equal(f.pending.size, 0); assert.equal(f.navigation.visible, false);
  f.navigation.interact({ type: 'click' }); assert.equal(f.navigation.visible, false);
  f.navigation.sync(true); assert.equal(f.navigation.visible, false);
  f.navigation.interact({ type: 'pointerdown', pointerId: 5, button: 0 });
  f.navigation.reset(); assert.equal(f.navigation.ownsPointer(5), false); assert.equal(f.navigation.visible, false);
  f.navigation.interact({ type: 'click' }); old.fn(); assert.equal(f.navigation.visible, true);
  f.navigation.reset(); assert.equal(f.pending.size, 0);
});
