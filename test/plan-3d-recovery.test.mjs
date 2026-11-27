import assert from 'node:assert/strict';
import test from 'node:test';
import { Plan3dRestoreBudget, PLAN_3D_RESTORE_VISIBLE_MS } from '../test-build/plan-3d-recovery-budget.js';
import { takeDiscardedPanel } from '../test-build/plan-3d-discard.js';

function fakeClock() {
  let now = 0, next = 0;
  const tasks = new Map();
  return {
    now: () => now,
    setTimeout(fn, delay) { const id = ++next; tasks.set(id, [now + delay, fn]); return id; },
    clearTimeout(id) { tasks.delete(id); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const task = [...tasks].sort(([, a], [, b]) => a[0] - b[0])[0];
        if (!task || task[1][0] > end) break;
        const [id, [when, fn]] = task;
        now = when; tasks.delete(id); fn();
      }
      now = end;
    },
    pending: () => tasks.size,
  };
}

test('#1609 one recovery spends visible time only, including repeated losses and visibility signals', () => {
  const clock = fakeClock();
  let calls = 0;
  const budget = new Plan3dRestoreBudget(clock, () => { calls++; });
  budget.begin(false);
  assert.equal(clock.pending(), 0);
  clock.advance(20000);
  budget.visibility(true);
  clock.advance(1700);
  budget.begin(true);
  budget.visibility(true);
  budget.visibility(false);
  assert.equal(clock.pending(), 0);
  clock.advance(40000);
  budget.begin(false);
  budget.visibility(true);
  clock.advance(PLAN_3D_RESTORE_VISIBLE_MS - 1701);
  assert.equal(calls, 0);
  clock.advance(1);
  assert.equal(calls, 1);
});

test('#1609 full paint or retirement cancels the old deadline', () => {
  const clock = fakeClock();
  let calls = 0;
  const budget = new Plan3dRestoreBudget(clock, () => { calls++; });
  budget.begin(true);
  clock.advance(3000);
  budget.finish();
  budget.begin(true);
  clock.advance(PLAN_3D_RESTORE_VISIBLE_MS - 1);
  assert.equal(calls, 0);
  clock.advance(1);
  assert.equal(calls, 1);
});

function documentAt(initial, current = initial, wasDiscarded = true) {
  return {
    wasDiscarded,
    defaultView: {
      location: { href: 'http://demo.local' + current },
      performance: { getEntriesByType: () => initial ? [{ name: 'http://demo.local' + initial }] : [] },
    },
  };
}

test('#1609 discard is a one-shot for the initial panel route, not for a HA SPA remount', () => {
  const document = documentAt('/houseplan?kiosk=1', '/houseplan?kiosk=1#space=f2');
  assert.equal(takeDiscardedPanel(document, '/houseplan'), true);
  assert.equal(takeDiscardedPanel(document, '/houseplan'), false);
  assert.equal(takeDiscardedPanel(documentAt('/lovelace', '/houseplan'), '/houseplan'), false);
  assert.equal(takeDiscardedPanel(documentAt('/', '/houseplan'), '/houseplan'), false);
  assert.equal(takeDiscardedPanel(documentAt('/houseplanner'), '/houseplan'), false);
  assert.equal(takeDiscardedPanel(documentAt('', '/houseplan'), '/houseplan'), false);
  assert.equal(takeDiscardedPanel(documentAt('/houseplan', '/houseplan', false), '/houseplan'), false);
});
