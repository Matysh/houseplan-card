import test from 'node:test';
import assert from 'node:assert/strict';
import { resumeWarmMode } from '../test-build/warm-mode-adoption.js';

function fixture(t, changed = false) {
  const original = { x: 1, y: 2, w: 10, h: 8 };
  const current = changed ? { x: 3, y: 4, w: 12, h: 9 } : original;
  const committed = { x: 5, y: 6, w: 14, h: 10 };
  const frames = [], released = [], revived = [];
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = callback => frames.push(callback);
  t.after(() => { globalThis.requestAnimationFrame = raf; });
  let render;
  const host = {
    updateComplete: new Promise(resolve => { render = resolve; }),
    _mode: 'view', _warmVp: { view: original }, _warmRevivePending: true,
    _view: current, _viewModeSnap: { space: 'floor', zoom: 2 },
    _editorModeRequest: 7, held: 7,
    _holdWarmRefit(request) { this.held = request; },
    _releaseWarmRefit(request) {
      if (this.held === request && this._editorModeRequest === request) released.push(request);
    },
    _warmReviveDialog(settle = false) { revived.push(settle); this._warmRevivePending = false; },
    _liveVp() {}, requestUpdate() {},
  };
  const commit = () => { host._mode = 'plan'; host._view = committed; host._viewModeSnap = null; };
  const paint = async () => { render(); await Promise.resolve(); };
  return { host, current, committed, frames, released, revived, commit, paint };
}

test('#1234 changed warm camera waits for final editor paint without restoring the memo', async t => {
  const f = fixture(t, true);
  resumeWarmMode(f.host, 'plan', f.commit);
  assert.equal(f.host._view, f.committed);
  assert.deepEqual(f.revived, [true]);
  assert.deepEqual(f.released, [], 'never reconcile against the temporary View layout');
  await f.paint(); assert.deepEqual(f.released, []);
  f.frames.shift()(); assert.deepEqual(f.released, []);
  f.frames.shift()(); assert.deepEqual(f.released, [8]);
  assert.equal(f.host._view, f.committed);
});

test('#1234 applicable warm camera and View return address survive editor adoption', async t => {
  const f = fixture(t);
  const returnAddress = f.host._viewModeSnap;
  resumeWarmMode(f.host, 'plan', f.commit);
  assert.equal(f.host._view, f.current);
  assert.equal(f.host._viewModeSnap, returnAddress);
  assert.deepEqual(f.revived, [false]);
  await f.paint(); f.frames.shift()(); f.frames.shift()();
  assert.deepEqual(f.released, [8]);
});

test('#1234 refused mode and superseded layout completion cannot revive or release a newer owner', async t => {
  const f = fixture(t, true);
  resumeWarmMode(f.host, 'plan', () => {});
  assert.deepEqual(f.revived, [true]);
  assert.deepEqual(f.released, [7]);
  assert.equal(f.frames.length, 0);
  f.released.length = 0;
  resumeWarmMode(f.host, 'plan', f.commit);
  f.host._editorModeRequest++; f.host.held = f.host._editorModeRequest;
  await f.paint(); f.frames.shift()(); f.frames.shift()();
  assert.deepEqual(f.released, []);
});
