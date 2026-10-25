import test from 'node:test';
import assert from 'node:assert/strict';
import { WallNodeDeleteMenu } from '../test-build/wall-node-delete-menu.js';
import { applyNodeDelete } from '../test-build/wall-node-delete.js';
import { structuralWallNodes } from '../test-build/wall-node-move.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

function setup(t) {
  let config = commitWallSegmentModel({ spaces: [{ id: 'f', rooms: [], cell_cm: 5,
    partitions: [{ id: 'a', a: [.1, .3], b: [.4, .3], cm: 0 }, { id: 'b', a: [.4, .3], b: [.8, .3], cm: 0 }] }],
    markers: [], settings: {} }).config;
  const ctx = { enabled: true, api: true, space: 'f', revision: 1 }, view = new EventTarget();
  let epoch = 0, navigation = 0, authority = true, busy = false, before = null, retry;
  let resolve, current; const gate = new Promise(r => { resolve = r; });
  const writes = [], records = [], validations = [], toasts = [], stage = {};
  const port = { context: () => ctx, config: () => config, navigation: () => navigation, epoch: () => epoch,
    claim: () => () => authority, beforeIntent: callback => { retry = callback; return before == null; },
    topology: () => ({ source: config.spaces[0], nodes: structuralWallNodes(config.spaces[0]) }),
    basis: space => ({ epoch, space, floor: 'exact-floor' }),
    validate: (next, source) => { validations.push([next, source]); return true; },
    write: async (history, basis, guard) => { writes.push([history, basis]); current = guard; await gate;
      const next = applyNodeDelete(history.beforeSpace, history.intent); assert.equal(next.ok, true);
      return { ...config, spaces: [next.space] }; },
    record: (...args) => records.push(args), document: { defaultView: view }, stage: () => stage,
    root: () => ({ querySelector: () => null }), busy: () => busy, setBusy: value => { busy = value; },
    changed() {}, text: key => key, toast: (...args) => toasts.push(args) };
  const menu = new WallNodeDeleteMenu(port); t.after(() => menu.dispose());
  const open = () => menu.open({ clientX: 10, clientY: 20 }, [.4, .3]);
  return { menu, port, ctx, view, writes, records, validations, toasts, open, retry: () => retry(),
    pending: () => { before = true; }, ready: () => { before = null; }, current: () => current(), release: () => resolve(),
    busy: () => busy, config: () => config, ownSave: () => { config = structuredClone(config); ctx.revision++; },
    foreign: () => { epoch++; }, navigation: () => { navigation++; }, revoke: () => { authority = false; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('#1045 Properties opening may follow its own Save, but cannot follow outside/foreign authority', t => {
  const s = setup(t); s.pending(); s.open();
  assert.equal(s.menu.menu, null); assert.equal(s.busy(), false, 'invalid field cannot leave a busy lock');
  s.ownSave(); s.ready(); s.retry();
  assert.equal(s.menu.menu.revision, 2, 'same original authority derives the source after its own Save');
  assert.equal(s.menu.menu.config, s.config());
  assert.equal(s.validations.length, 1, 'proof runs at opening, never at pending render');
  s.menu.cancel(); s.pending(); s.open();
  s.view.dispatchEvent(new Event('pointerdown')); s.ready(); s.retry();
  assert.equal(s.menu.menu, null, 'late Properties callback cannot reopen a retired intent');
  s.pending(); s.open(); s.foreign(); s.ready(); s.retry();
  assert.equal(s.menu.menu, null); assert.equal(s.writes.length, 0);
});

test('#1045 chosen action outlives normal menu retirement, sends once and records only the acknowledgement', async t => {
  const s = setup(t), original = structuredClone(s.config()); s.open();
  const owner = s.menu.menu; assert.equal(owner.reason, null);
  s.menu.choose(owner);
  assert.equal(s.validations.length, 1, '#1075 unchanged opening proof is not built a second time');
  assert.equal(s.menu.menu, null); assert.equal(s.current(), true, 'writer guard is the chosen intent, not isOpen');
  assert.equal(s.busy(), true); assert.equal(s.writes.length, 1); assert.equal(s.records.length, 0);
  assert.deepEqual(s.config(), original, 'no optimistic geometry');
  s.menu.choose(owner); assert.equal(s.writes.length, 1, 'retained callback is inert');
  // Config adoption/navigation can retire presentation after the request has
  // been accepted. That must not discard its one shared history command.
  s.menu.cancel(); assert.equal(s.current(), false); s.release(); await tick();
  assert.equal(s.records.length, 1); assert.equal(s.records[0][0].kind, 'delete');
  assert.deepEqual(s.records[0][1].partitions.map(w => w.id), ['a']); assert.equal(s.busy(), false);
});

test('#1045 invoke rechecks revision after Properties; Escape preserves field keyboard ownership', async t => {
  const s = setup(t); s.open(); const owner = s.menu.menu;
  s.pending(); s.menu.choose(owner); assert.equal(s.busy(), false);
  s.ownSave(); s.ready(); s.retry(); assert.equal(s.writes.length, 0, 'changed original basis cannot delete');
  s.menu.cancel(); s.pending(); s.open();
  const escape = new Event('keydown', { cancelable: true }); Object.defineProperty(escape, 'key', { value: 'Escape' });
  s.view.dispatchEvent(escape); assert.equal(escape.defaultPrevented, false);
  s.ready(); s.retry(); assert.equal(s.menu.menu, null); assert.equal(s.writes.length, 0);
  await tick(); assert.equal(s.records.length, 0);
});
