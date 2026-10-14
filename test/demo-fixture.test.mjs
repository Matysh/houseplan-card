import assert from 'node:assert/strict';
import test from 'node:test';
import { createFixtureStore, createServiceRecorder } from '../demo/srv/fixture-state.js';
import { transitionOutcome } from '../demo/transition-timeline.mjs';

const fixture = () => createFixtureStore({ spaces: [], markers: [], settings: {}, future: { keep: 1 } },
  { a: { s: 'f', x: .2, y: .3, future: 'a' }, b: { s: 'f', x: .7, y: .8, future: 'b' } });
test('#896 saved fixture pairs are independent, cloned, and CAS refuses even a stale no-op', () => {
  const s = fixture(), get = () => s.handle({ type: 'houseplan/config/get' });
  const initial = get(); initial.config.future.keep = 999;
  assert.equal(get().config.future.keep, 1);
  const candidate = { ...get().config, title: 'saved' };
  assert.deepEqual(s.handle({ type: 'houseplan/config/set', config: candidate, expected_rev: 1 }), { ok: true, rev: 2 });
  assert.deepEqual(get().config, candidate); assert.equal(s.layoutRev, 1);
  const before = JSON.stringify([get(), s.handle({ type: 'houseplan/layout/get' })]);
  for (const expected_rev of [undefined, 1, 3]) assert.throws(() => s.handle({
    type: 'houseplan/config/set', config: candidate, ...(expected_rev === undefined ? {} : { expected_rev }),
  }), { code: 'conflict' });
  assert.equal(JSON.stringify([get(), s.handle({ type: 'houseplan/layout/get' })]), before);
  candidate.future.keep = 88; assert.equal(get().config.future.keep, 1);
});
test('#896 exact wire: full layout set, point replacement, deletion and no-op revisions', () => {
  const s = fixture(), read = () => s.handle({ type: 'houseplan/layout/get' });
  const layout = { ...read().layout, extra: { s: 'f', x: .1, y: .9, unknown: ['keep'] } };
  s.handle({ type: 'houseplan/layout/set', layout, expected_rev: 1 });
  const untouched = structuredClone(read().layout.b);
  const pos = { s: 'g', x: .4, y: .5, future: { retained: true } };
  assert.deepEqual(s.handle({ type: 'houseplan/layout/update', device_id: 'a', pos }), { ok: true, rev: 3 });
  assert.deepEqual(read().layout, { ...layout, a: pos });
  assert.deepEqual(read().layout.b, untouched);
  assert.equal(s.handle({ type: 'houseplan/layout/update', device_id: 'a', pos }).rev, 3);
  assert.deepEqual(s.handle({ type: 'houseplan/layout/delete', device_id: 'extra' }), { ok: true, rev: 4 });
  assert.deepEqual(s.handle({ type: 'houseplan/layout/delete', device_id: 'extra' }), { ok: true, rev: null });
  assert.equal(s.layoutRev, 4); assert.equal(s.configRev, 1);
  const before = JSON.stringify(read());
  assert.throws(() => s.handle({ type: 'houseplan/layout/set', layout, expected_rev: 1 }), { code: 'conflict' });
  assert.equal(JSON.stringify(read()), before);
});
test('#896 recorder counts each delegated invocation, with detached immutable arguments', async () => {
  const performed = [], recorder = createServiceRecorder((...args) => performed.push(args));
  const old = recorder.callService, data = { entity_id: 'light.a' };
  for (const service of ['turn_on', 'turn_off', 'toggle']) await old('light', service, data);
  assert.deepEqual(recorder.calls, performed);
  data.entity_id = 'foreign'; assert.equal(recorder.calls[0][2].entity_id, 'light.a');
  assert.equal(recorder.callService, old);
  const cancelled = createServiceRecorder(() => assert.fail('cancelled gesture dispatched'));
  assert.equal(cancelled.calls.length, 0);
});
test('#896 first-only recreated method and revision-only persistence fail the exact positive oracles', async () => {
  const expected = ['turn_off', 'turn_on', 'turn_off'].map(service => ['light', service, { entity_id: 'light.a' }]);
  const mkOldHass = () => ({ callService: async () => { oldHass = mkOldHass(); } });
  let oldHass = mkOldHass(); const original = oldHass.callService, counted = [];
  oldHass.callService = async (...args) => { counted.push(args); return original(...args); };
  for (const args of expected) await oldHass.callService(...args);
  assert.equal(counted.length, 1, 'controlled old fixture loses its wrapper');
  assert.throws(() => assert.deepEqual(counted, expected), assert.AssertionError);
  const oldSaved = { a: { s: 'f', x: .1, y: .2 } }, requested = { a: { s: 'g', x: .5, y: .6 } };
  const oldRevisionOnly = () => ({ ok: true, rev: 2 });
  assert.equal(oldRevisionOnly(requested).rev, 2);
  assert.throws(() => assert.deepEqual(oldSaved, requested), assert.AssertionError,
    'an increased revision is not an exact stored-candidate witness');
});

const run = { card: 0, kind: 0, phase: 'on', node: 1, event: 'transitionrun', elapsed: 0, listenerAt: 0, deliveredAt: 20 };
const end = { ...run, event: 'transitionend', elapsed: .5, deliveredAt: 520 };
const options = { card: 0, kind: 0, phase: 'on', startedAt: 10, deadlineMs: 750 };
test('#896 transition diagnostic: delivered completion, delayed delivery, missing and wrong-node end', () => {
  assert.equal(transitionOutcome([run, end], options).passed, true);
  assert.equal(transitionOutcome([run, { ...end, deliveredAt: 761 }], options).cause, 'delivered-after-deadline');
  assert.equal(transitionOutcome([run], options).cause, 'missing-transitionend');
  assert.equal(transitionOutcome([], options).cause, 'missing-transitionrun');
  assert.equal(transitionOutcome([run, { ...end, node: 2 }], options).cause, 'missing-transitionend');
  assert.equal(transitionOutcome([{ ...run, listenerAt: 11 }, end], options).cause, 'listener-attached-late');
  assert.equal(transitionOutcome([run, { ...end, elapsed: .2 }], options).cause, 'unexpected-native-duration');
  const first = transitionOutcome([run], options);
  assert.equal(transitionOutcome([run, end], options).passed, true);
  assert.equal(first.passed, false, 'a later observation cannot rewrite the failed first receipt');
});
