import test from 'node:test';
import assert from 'node:assert/strict';
import { WarmMarkerRestore } from '../test-build/warm-marker-restore.js';

function fixture() {
  const f = { allowed: true, loads: 0, shown: [], changed: 0, replies: [] };
  f.controller = new WarmMarkerRestore({ allowed: () => f.allowed,
    ensure: () => { ++f.loads; return new Promise(resolve => f.replies.push(resolve)); },
    restore: d => f.shown.push(d), changed: () => ++f.changed });
  return f;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('#894 draft is published once, only after its renderer is ready', async () => {
  const f = fixture(), draft = { name: 'unsaved', binding: 'device:lamp' };
  f.controller.begin(draft);
  assert.equal(f.loads, 1); assert.equal(f.controller.active, true); assert.deepEqual(f.shown, []);
  f.replies[0](true); await tick(); assert.deepEqual(f.shown, [draft]); assert.equal(f.controller.active, false);
});
test('#894 loss of permission, close and newer draft retire pending completion', async () => {
  for (const invalidation of ['permission', 'close', 'newer']) {
    const f = fixture(); f.controller.begin({ name: 'old' });
    if (invalidation === 'permission') { f.allowed = false; f.controller.reconcile(); }
    if (invalidation === 'close') f.controller.cancel();
    if (invalidation === 'newer') f.controller.begin({ name: 'new' });
    f.replies[0](true); await tick(); assert.deepEqual(f.shown, []);
    if (invalidation === 'newer') { f.replies[1](true); await tick(); assert.deepEqual(f.shown, [{ name: 'new' }]); }
  }
});
test('#894 denied or failed load never publishes a hidden marker draft', async () => {
  const f = fixture(); f.allowed = false; f.controller.begin({ name: 'denied' });
  assert.equal(f.loads, 0); assert.equal(f.controller.active, false);
  f.allowed = true; f.controller.begin({ name: 'retryable' }); f.replies[0](false); await tick();
  assert.deepEqual(f.shown, []); assert.equal(f.controller.active, true);
  f.controller.cancel(); f.controller.begin({ name: 'next' }); f.replies[1](true); await tick();
  assert.deepEqual(f.shown, [{ name: 'next' }]);
});
