import test from 'node:test';
import assert from 'node:assert/strict';
import { CardReadLifecycle } from '../test-build/card-read-lifecycle.js';

const context = (connection = {}, userId = 'owner', route = '/dashboard/home') => ({ connection, userId, route });

test('#824 late initial HA binds one deferred intent and coalesces repeated starts', () => {
  const owner = new CardReadLifecycle();
  owner.defer(); owner.defer();
  assert.equal(owner.pending, true);
  const ready = context();
  owner.observe(ready);
  assert.equal(owner.pending, true);
  const claim = owner.begin(ready);
  assert.ok(claim);
  assert.equal(owner.pending, false);
  assert.equal(owner.begin(ready), null);
  assert.equal(owner.isCurrent(claim), true);
  assert.equal(owner.finish(claim), true);
  assert.equal(owner.finish(claim), false);
});

for (const boundary of ['disconnect', 'connection', 'user', 'route']) {
  test(`#824 ${boundary} rejects old callbacks even after authority returns`, () => {
    const owner = new CardReadLifecycle();
    const initial = context();
    const claim = owner.begin(initial);
    owner.defer();
    if (boundary === 'disconnect') owner.invalidate();
    else owner.observe({ ...initial, [boundary === 'user' ? 'userId' : boundary]: boundary === 'connection' ? {} : 'changed' });
    assert.equal(owner.pending, false, 'an invalidated intent cannot survive');
    owner.observe(initial);
    const next = owner.begin(initial);
    assert.ok(next);
    assert.notEqual(next, claim);
    assert.equal(owner.isCurrent(claim), false);
    assert.equal(owner.finish(claim), false, 'a stale finally cannot release the new read');
    assert.equal(owner.busy, true);
    assert.equal(owner.isCurrent(next), true);
  });
}

test('#824 detach before late HA discards pending recovery without starting a read', () => {
  const owner = new CardReadLifecycle();
  owner.defer(); owner.invalidate(); owner.observe(context());
  assert.equal(owner.pending, false);
  assert.equal(owner.busy, false);
});
