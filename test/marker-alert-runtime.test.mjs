import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfirmedMarkerAlerts } from '../test-build/marker-alert-runtime.js';

function fixture() {
  let now = 0, sequence = 0, sets = 0, reads = 0, changes = 0;
  const queue = new Map(), owner = {};
  const state = { permitted: true, value: 1100, name: 'CO₂' };
  const clock = { now: () => now, set: (callback, delay) => { const id = ++sequence; sets++; queue.set(id, { callback, due: now + delay }); return id; }, clear: id => queue.delete(id) };
  const runtime = new ConfirmedMarkerAlerts(() => changes++, clock);
  const observation = { key: 'marker/r1', identity: 'marker/device:one/floor',
    rule: { id: 'r1', type: 'threshold', level: 'attention', entity_id: 'sensor.co2', operator: 'gt', value: 1000 },
    read: () => { reads++; return state; } };
  const update = (inputs = [observation], scope = owner, enabled = true) => runtime.update(scope, inputs, enabled);
  const advance = time => { now = time; for (;;) { const item = [...queue].find(([, timer]) => timer.due <= now); if (!item) break; queue.delete(item[0]); item[1].callback(); } };
  return { runtime, state, observation, owner, update, advance, queue, stats: () => ({ sets, reads, changes }) };
}

test('#1000 continuous 3000ms activation/removal, noise cancels either candidate', () => {
  const f = fixture(); f.update(); f.advance(2999); assert.equal(f.runtime.snapshot().length, 0);
  f.state.value = 999; f.update(); f.advance(3000); assert.equal(f.runtime.snapshot().length, 0);
  f.state.value = 1100; f.update(); f.advance(5999); assert.equal(f.runtime.snapshot().length, 0);
  f.advance(6000); assert.equal(f.runtime.snapshot().length, 1);
  f.state.value = 0; f.update(); f.advance(8999); assert.equal(f.runtime.snapshot().length, 1);
  f.state.value = 1200; f.update(); f.advance(9000); assert.equal(f.runtime.snapshot().length, 1);
  f.state.value = 0; f.update(); f.advance(12000); assert.equal(f.runtime.snapshot().length, 0);
  assert.equal(f.stats().changes, 5, 'activation/removal and the three visible active-value changes');
  assert.equal(f.queue.size, 0);
});

test('#1000 deadline reads the current field rather than a stale true closure', () => {
  const f = fixture(); f.update(); f.state.value = 0; f.advance(3000);
  assert.equal(f.runtime.snapshot().length, 0); assert.equal(f.queue.size, 0);
  f.state.value = 1100; f.update();
  const oldCallback = [...f.queue.values()][0].callback;
  f.update([], {}); const reads = f.stats().reads;
  oldCallback(); assert.equal(f.stats().reads, reads); assert.equal(f.runtime.snapshot().length, 0);
});

test('#1000 incomparable active source is honest while removal is pending; ownership loss is immediate', () => {
  const f = fixture(); f.update(); f.advance(3000);
  f.state.value = 'unavailable'; f.update();
  assert.equal(f.runtime.snapshot()[0].comparable, false); assert.equal(f.runtime.snapshot()[0].value, null);
  f.advance(5999); assert.equal(f.runtime.snapshot().length, 1);
  f.state.value = 1100; f.update(); f.advance(6000); assert.equal(f.runtime.snapshot().length, 1);
  f.state.permitted = false;
  Object.defineProperty(f.state, 'value', { get() { throw Error('foreign value must not be read'); } });
  f.update(); assert.equal(f.runtime.snapshot().length, 0); assert.equal(f.queue.size, 0);
});

test('#1000 unchanged updates retain one deadline; changed rule/authority/dispose retire callbacks', () => {
  const f = fixture(); f.update();
  for (let i = 0; i < 100; i++) f.update();
  assert.equal(f.stats().sets, 1); assert.equal(f.queue.size, 1);
  const stale = [...f.queue.values()][0].callback;
  f.advance(1000);
  f.observation.rule = { ...f.observation.rule, level: 'alarm' }; f.update();
  assert.equal(f.stats().sets, 2, 'editing starts a fresh confirmation period');
  f.advance(3000); assert.equal(f.runtime.snapshot().length, 0);
  f.advance(4000); assert.equal(f.runtime.snapshot()[0].rule.level, 'alarm');
  f.update([f.observation], {}); assert.equal(f.runtime.snapshot().length, 0);
  f.update([f.observation], {}, false); assert.equal(f.queue.size, 0);
  f.runtime.dispose(); const reads = f.stats().reads; stale(); f.update();
  assert.equal(f.stats().reads, reads); assert.equal(f.queue.size, 0);
});
