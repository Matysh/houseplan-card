import test from 'node:test';
import assert from 'node:assert/strict';
import { ZigbeeTopologyLoadGate } from '../test-build/zigbee-topology-action.js';
import { dialogSession } from '../test-build/editors/dialog-baseline.js';
import { acceptGeneralBaseline, generalDirty, rememberGeneralBaseline } from '../test-build/editors/general-form-state.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('#1031 saves before loading, coalesces double activation and releases busy', async () => {
  const gate = new ZigbeeTopologyLoadGate(), saved = deferred(), calls = [];
  const action = { current: () => true, prepare: () => { calls.push('save'); return saved.promise; },
    load: async current => { assert.equal(current(), true); calls.push('load'); }, changed() {} };
  const first = gate.run(action);
  await gate.run(action);
  assert.equal(gate.pending, true);
  assert.deepEqual(calls, ['save']);
  saved.resolve(true); await first;
  assert.equal(gate.pending, false);
  assert.deepEqual(calls, ['save', 'load']);
});

test('#1031 failed and refused saves never load; an explicit retry works', async () => {
  for (const failed of [() => Promise.resolve(false), () => Promise.reject(new Error('conflict'))]) {
    const gate = new ZigbeeTopologyLoadGate(); let loads = 0;
    const action = { current: () => true, prepare: failed, load: async () => { loads++; }, changed() {} };
    await gate.run(action);
    assert.equal(loads, 0); assert.equal(gate.pending, false);
    await gate.run({ ...action, prepare: async () => true });
    assert.equal(loads, 1);
  }
});

test('#1031 invalidated or unavailable context cannot start after save', async () => {
  for (const retire of ['generation', 'current']) {
    const gate = new ZigbeeTopologyLoadGate(), saved = deferred(); let current = true, loads = 0;
    const pending = gate.run({ current: () => current, prepare: () => saved.promise,
      load: async () => { loads++; }, changed() {} });
    if (retire === 'generation') gate.invalidate(); else current = false;
    saved.resolve(true); await pending;
    assert.equal(loads, 0); assert.equal(gate.pending, false);
  }
});

test('#1031 saved ON loads without saving; lazy import checks retired context', async () => {
  const gate = new ZigbeeTopologyLoadGate(), imported = deferred(); let loads = 0;
  const pending = gate.run({ current: () => true, changed() {},
    load: async current => { await imported.promise; if (current()) loads++; } });
  gate.invalidate(); imported.resolve(); await pending;
  assert.equal(loads, 0);
  await gate.run({ current: () => true, changed() {}, load: async () => { loads++; } });
  assert.equal(loads, 1);
});

test('#1031 keep-open baseline preserves session and later edits; old sessions cannot change it', () => {
  const host = {}, original = { bgMode: 'static', busy: false }, saved = { ...original, bgMode: 'daynight' };
  rememberGeneralBaseline(host, original);
  const owner = dialogSession(host, 'settings');
  assert.equal(generalDirty(host, saved), true);
  assert.equal(acceptGeneralBaseline(host, saved, owner), true);
  assert.equal(dialogSession(host, 'settings'), owner);
  assert.equal(generalDirty(host, { ...saved, busy: true }), false);
  assert.equal(generalDirty(host, { ...saved, moon: true }), true);
  rememberGeneralBaseline(host, original);
  assert.equal(acceptGeneralBaseline(host, saved, owner), false);
  assert.equal(generalDirty(host, original), false);
  assert.equal(acceptGeneralBaseline({}, saved, undefined), false);
});
