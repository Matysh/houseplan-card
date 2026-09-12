import assert from 'node:assert/strict';
import test from 'node:test';

import { ConfigReloadAuthority } from '../test-build/config-reload-authority.js';

const connectionA = {};
const connectionB = {};
const context = (connection = connectionA, userId = 'user-a', route = '/lovelace/home') => ({
  connection, userId, route,
});
const state = (claim, overrides = {}) => ({
  claim,
  context: context(),
  connected: true,
  baselineRevision: claim.baselineRevision,
  baselineFingerprint: claim.baselineFingerprint,
  writePending: false,
  ...overrides,
});

test('#543 ordinary event high-water rejects a late lower observation without superseding the winner', () => {
  const owner = new ConfigReloadAuthority();
  assert.ok(owner.observeRevision(4, 2, context()));
  const winner = owner.begin({
    force: false, context: context(), baselineRevision: 2, baselineFingerprint: 'base-2',
  });
  assert.equal(owner.observeRevision(3, 2, context()), null);
  assert.equal(owner.isCurrent(state(winner)), true, 'the rejected event cannot cancel rev 4');
  assert.ok(owner.observeRevision(5, 2, context()));
  const newer = owner.begin({
    force: false, context: context(), baselineRevision: 2, baselineFingerprint: 'base-2',
  });
  assert.equal(owner.isCurrent(state(winner)), false);
  assert.equal(owner.isCurrent(state(newer)), true);
});

test('#543 a force generation resets event high-water and may accept a lower restored revision', () => {
  const owner = new ConfigReloadAuthority();
  assert.ok(owner.observeRevision(12, 10, context()));
  const ordinary = owner.begin({
    force: false, context: context(), baselineRevision: 10, baselineFingerprint: 'base-10',
  });
  const restored = owner.begin({
    force: true, context: context(), baselineRevision: 10, baselineFingerprint: 'base-10',
  });
  assert.equal(owner.isCurrent(state(ordinary)), false);
  assert.equal(owner.isCurrent(state(restored)), true);
  assert.ok(owner.observeRevision(4, 3, context()), 'the new generation has its own high-water');
  assert.equal(owner.observeRevision(3, 3, context()), null);
});

test('#543 a deferred event reservation expires on an echo, newer event, read or lifecycle', () => {
  const invalidations = [
    (owner) => owner.observeRevision(5, 2, context()),
    (owner) => owner.begin({
      force: false, context: context(), baselineRevision: 2, baselineFingerprint: 'base-2',
    }),
    (owner) => owner.invalidateLifecycle(),
  ];
  for (const invalidate of invalidations) {
    const owner = new ConfigReloadAuthority();
    const reserved = owner.observeRevision(4, 2, context());
    assert.ok(reserved);
    assert.equal(owner.isReservationCurrent(reserved, context(), 2), true);
    invalidate(owner);
    assert.equal(owner.isReservationCurrent(reserved, context(), 2), false);
  }
  const owner = new ConfigReloadAuthority();
  const echo = owner.observeRevision(4, 2, context());
  assert.ok(echo);
  assert.equal(owner.isReservationCurrent(echo, context(), 4), false);
});

test('#543 connection, user, route and disconnect generations invalidate claims without revival', () => {
  const changes = [
    context(connectionB, 'user-a', '/lovelace/home'),
    context(connectionA, 'user-b', '/lovelace/home'),
    context(connectionA, 'user-a', '/lovelace/other'),
  ];
  for (const changed of changes) {
    const owner = new ConfigReloadAuthority();
    const claim = owner.begin({
      force: false, context: context(), baselineRevision: 2, baselineFingerprint: 'base-2',
    });
    owner.observeContext(changed);
    owner.observeContext(context());
    assert.equal(owner.isCurrent(state(claim)), false, 'returning to the old context must not revive a claim');
  }
  const owner = new ConfigReloadAuthority();
  const claim = owner.begin({
    force: false, context: context(), baselineRevision: 2, baselineFingerprint: 'base-2',
  });
  owner.invalidateLifecycle();
  assert.equal(owner.isCurrent(state(claim)), false);
  assert.equal(owner.isCurrent(state(claim, { connected: false })), false);
});

test('#543 a local or paired-write baseline and pending local write invalidate the old read', () => {
  const owner = new ConfigReloadAuthority();
  const claim = owner.begin({
    force: false, context: context(), baselineRevision: 2, baselineFingerprint: 'base-2',
  });
  assert.equal(owner.isCurrent(state(claim, { baselineRevision: 3 })), false);
  assert.equal(owner.isCurrent(state(claim, { baselineFingerprint: 'edited' })), false);
  assert.equal(owner.isCurrent(state(claim, { writePending: true })), false);
  assert.equal(owner.isCurrent(state(claim, { connected: false })), false);
});

test('#543 force recovery may run while its rejected writer unwinds, but still yields to an accepted baseline', () => {
  const owner = new ConfigReloadAuthority();
  const claim = owner.begin({
    force: true, context: context(), baselineRevision: 2, baselineFingerprint: 'base-2',
  });
  assert.equal(owner.isCurrent(state(claim, { writePending: true })), true);
  assert.equal(owner.isCurrent(state(claim, {
    writePending: true, baselineRevision: 3, baselineFingerprint: 'accepted-3',
  })), false);
});
