import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireHaRegistries, haRegistrySnapshot, refreshHaRegistries } from '../test-build/ha-binding-status.js';

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture(user = 'owner', connection) {
  const events = new Map(), requests = [], unsubscribed = [];
  let devices = [{ id: 'lamp', disabled_by: null }];
  let entities = [{ entity_id: 'light.lamp', device_id: 'lamp', disabled_by: null }];
  const hass = { user: { id: user }, devices: {}, entities: {}, connection: connection || {
    async subscribeEvents(callback, type) {
      events.set(type, callback);
      return () => { events.delete(type); unsubscribed.push(type); };
    },
  }, async callWS(request) {
    requests.push(request.type);
    return structuredClone(request.type.includes('device_registry') ? devices : entities);
  } };
  return { hass, events, requests, unsubscribed,
    disable() { devices = [{ id: 'lamp', disabled_by: 'user' }]; },
    emit() { events.get('device_registry_updated')?.({}); },
  };
}

test('#1386 concurrent cards and a one-second DOM move share one full registry read', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  let notifications = 0;
  const release = acquireHaRegistries(f.hass, () => notifications++);
  const other = acquireHaRegistries(f.hass, () => {});
  await settle();
  assert.equal(f.requests.length, 2);
  release(); other();
  t.mock.timers.tick(1000); await settle();
  assert.equal(f.unsubscribed.length, 0, 'event coverage survives the reported masonry gap');
  const again = acquireHaRegistries(f.hass, () => {});
  await settle();
  assert.equal(f.requests.length, 2, 'same live connection does not reload after a DOM move');
  assert.equal(notifications, 1, 'detached consumers receive no notifications');
  again(); t.mock.timers.tick(5000); await settle();
  assert.equal(f.unsubscribed.length, 2, 'unused subscriptions still have bounded lifetime');
});

test('#1386 an event during the DOM gap invalidates the cache without detached network work', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(), release = acquireHaRegistries(f.hass, () => {});
  await settle(); release();
  f.disable(); f.emit(); t.mock.timers.tick(100); await settle();
  assert.equal(f.requests.length, 2);
  const again = acquireHaRegistries(f.hass, () => {});
  await settle();
  assert.equal(f.requests.length, 4);
  assert.equal(haRegistrySnapshot(f.hass).devices.lamp.disabled_by, 'user');
  again(); t.mock.timers.tick(5000); await settle();
});

test('#1386 a long absence closes subscriptions and revalidates missed changes once', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(), release = acquireHaRegistries(f.hass, () => {});
  await settle(); release(); t.mock.timers.tick(5000); await settle();
  assert.equal(f.unsubscribed.length, 2);
  f.disable();
  const again = acquireHaRegistries(f.hass, () => {});
  const other = acquireHaRegistries(f.hass, () => {});
  await settle();
  assert.equal(f.requests.length, 4);
  assert.equal(haRegistrySnapshot(f.hass).devices.lamp.disabled_by, 'user');
  again(); other(); t.mock.timers.tick(5000); await settle();
});

test('#1386 a true reconnect supersedes an older pending registry response', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(), held = [];
  const current = f.hass.callWS;
  f.hass.callWS = request => new Promise(resolve => held.push({ request, resolve }));
  const release = acquireHaRegistries(f.hass, () => {});
  await settle(); assert.equal(held.length, 2);
  f.disable(); f.hass.callWS = current;
  refreshHaRegistries(f.hass); refreshHaRegistries(f.hass);
  t.mock.timers.tick(100); await settle();
  assert.equal(f.requests.length, 2, 'the reconnect refresh is coalesced');
  assert.equal(haRegistrySnapshot(f.hass).devices.lamp.disabled_by, 'user');
  const revision = haRegistrySnapshot(f.hass).revision;
  for (const { request, resolve } of held) resolve(request.type.includes('device_registry')
    ? [{ id: 'obsolete', disabled_by: null }] : []);
  await settle();
  assert.equal(haRegistrySnapshot(f.hass).revision, revision);
  assert.equal(haRegistrySnapshot(f.hass).devices.lamp.disabled_by, 'user');
  assert.equal(haRegistrySnapshot(f.hass).devices.obsolete, undefined);
  release(); t.mock.timers.tick(5000); await settle();
});

test('#1386 users sharing a reused connection do not share registry authority', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const owner = fixture(), guest = fixture('guest', owner.hass.connection);
  guest.disable();
  const release = acquireHaRegistries(owner.hass, () => {});
  await settle();
  const guestRelease = acquireHaRegistries(guest.hass, () => {});
  await settle();
  assert.equal(guest.requests.length, 2);
  assert.equal(haRegistrySnapshot(owner.hass).devices.lamp.disabled_by, null);
  assert.equal(haRegistrySnapshot(guest.hass).devices.lamp.disabled_by, 'user');
  release(); guestRelease(); t.mock.timers.tick(5000); await settle();
});

test('#1386 failed or unavailable event coverage is rechecked on remount', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture('owner', { async subscribeEvents() { throw Error('limited'); } });
  const release = acquireHaRegistries(f.hass, () => {});
  await settle(); release(); f.disable();
  const again = acquireHaRegistries(f.hass, () => {});
  await settle();
  assert.equal(f.requests.length, 4);
  assert.equal(haRegistrySnapshot(f.hass).devices.lamp.disabled_by, 'user');
  again(); t.mock.timers.tick(5000); await settle();
});

test('#1386 a late event from retired subscriptions cannot restart the current load', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(), release = acquireHaRegistries(f.hass, () => {});
  await settle(); const oldEvent = f.events.get('device_registry_updated');
  release(); t.mock.timers.tick(5000); await settle();
  const again = acquireHaRegistries(f.hass, () => {});
  await settle(); assert.equal(f.requests.length, 4);
  oldEvent({}); t.mock.timers.tick(100); await settle();
  assert.equal(f.requests.length, 4);
  again(); t.mock.timers.tick(5000); await settle();
});

test('#1386 late subscription setup cannot replace or release a new lease', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const active = new Set(); let resolveFirst, first = true;
  const f = fixture('owner', { async subscribeEvents(callback) {
    if (first) { first = false; await new Promise(resolve => { resolveFirst = resolve; }); }
    active.add(callback); return () => active.delete(callback);
  } });
  const release = acquireHaRegistries(f.hass, () => {});
  await settle(); release(); t.mock.timers.tick(5000); await settle();
  const again = acquireHaRegistries(f.hass, () => {});
  await settle(); assert.equal(active.size, 2);
  resolveFirst(); await settle();
  assert.equal(active.size, 2, 'only the new pair survives the obsolete subscribe ACK');
  again(); t.mock.timers.tick(5000); await settle();
  assert.equal(active.size, 0);
});
