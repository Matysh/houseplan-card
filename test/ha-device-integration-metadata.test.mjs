import test from 'node:test';
import assert from 'node:assert/strict';
import { haIntegrationMetadataSource, acquireIntegrationMetadata, integrationMetadataSnapshot,
  integrationDisplayName, resolveBindingProviders, resolveEntityProvider } from '../test-build/integration-provider.js';
import { zigbeeIntegrationPresence } from '../test-build/zigbee-integration-presence.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const registry = { devices: { device: { config_entries: ['entry'] } },
  entities: { 'light.lamp': { device_id: 'device', config_entry_id: 'entry', platform: 'fixture' } } };

test('#1446 finite reader shares the lazy metadata owner, retains both display-name readers and releases once', async () => {
  let calls = [], subscribe = 0, unsubscribe = 0, update;
  const raw = {
    user: { id: 'owner', is_admin: true }, auth: { private: 'never projected' },
    connection: { async subscribeMessage(receive, command) {
      assert.equal(command.type, 'config_entries/subscribe'); subscribe++; update = receive;
      return () => { unsubscribe++; };
    } },
    async callWS(command) {
      assert.equal(this, raw); calls.push(command.type);
      return command.type === 'config_entries/get'
        ? [{ entry_id: 'entry', domain: 'fixture', title: 'Entry title', secret: 'never projected' },
          { entry_id: 'ignored', domain: 'zha', source: 'ignore' }]
        : [{ domain: 'fixture', name: 'HA Manifest Name', secret: 'never projected' }];
    },
    localize: () => null,
  };
  const port = haIntegrationMetadataSource(raw);
  assert.deepEqual(Object.keys(port).sort(), ['acquire', 'identity', 'snapshot']);
  assert.deepEqual(Object.keys(port.identity), [], 'identity is opaque, not the HA connection');
  assert.equal(port.snapshot().loaded, false);
  assert.equal(calls.length, 0, 'merely rendering the parent never fetches metadata');
  let notifications = 0;
  const release = port.acquire(() => { notifications++; });
  const neighbourRelease = acquireIntegrationMetadata(raw, () => {});
  await settle();
  assert.deepEqual(calls.sort(), ['config_entries/get', 'manifest/list']);
  assert.equal(subscribe, 1);
  const metadata = port.snapshot();
  assert.equal(metadata, port.snapshot(), 'display snapshot is memoized by metadata revision');
  assert.equal(JSON.stringify(metadata).includes('never projected'), false);
  assert.equal(Object.isFrozen(metadata.configEntries.entry), true);
  assert.equal(resolveBindingProviders({}, 'device:device', registry, metadata)[0].label, 'HA Manifest Name');
  assert.equal(resolveEntityProvider({}, 'light.lamp', registry, metadata).label, 'HA Manifest Name');
  assert.equal(integrationDisplayName({ localize: () => 'Localized name' }, 'fixture', metadata), 'Localized name');
  assert.equal(integrationDisplayName({}, 'missing_integration', metadata, 'Entry title'), 'Entry title');
  assert.equal(integrationDisplayName({}, 'missing_integration', metadata), 'missing integration');
  assert.deepEqual(zigbeeIntegrationPresence(integrationMetadataSnapshot(raw), { authoritative: true, entities: {}, devices: {} }),
    { zha: 'absent', z2m: 'absent' }, 'the adjacent real-HA reader retains ignored-entry semantics');
  update({ entry_id: 'entry', domain: 'fixture', title: 'Updated title' });
  assert.equal(port.snapshot().configEntries.entry.title, 'Updated title');
  assert.ok(notifications >= 2);
  assert.equal(haIntegrationMetadataSource({ ...raw }), port, 'ordinary HA ticks reuse the reader');
  release(); release(); assert.equal(unsubscribe, 0, 'the neighbour still owns the subscription');
  neighbourRelease(); assert.equal(unsubscribe, 1);
});

test('#1446 authority replacement isolates late replies/events, role changes and reconnects', async () => {
  const pending = deferred(), events = [];
  const connection = { async subscribeMessage(receive) { events.push(receive); return () => {}; } };
  const a = { user: { id: 'a', is_admin: true }, connection,
    async callWS(command) { return command.type === 'manifest/list' ? pending.promise
      : [{ entry_id: 'entry', domain: 'fixture', title: 'A entry' }]; } };
  const b = { ...a, user: { id: 'b', is_admin: true }, async callWS(command) {
    return command.type === 'manifest/list' ? [{ domain: 'fixture', name: 'B name' }]
      : [{ entry_id: 'entry', domain: 'fixture', title: 'B entry' }];
  } };
  const first = haIntegrationMetadataSource(a), next = haIntegrationMetadataSource(b);
  assert.notEqual(first.identity, next.identity);
  assert.notEqual(next.identity, haIntegrationMetadataSource({ ...b, user: { ...b.user, is_admin: false } }).identity);
  assert.notEqual(next.identity, haIntegrationMetadataSource({ ...b, connection: {} }).identity);
  let oldNotifications = 0;
  const release = first.acquire(() => { oldNotifications++; });
  await settle(); release();
  const nextRelease = next.acquire(() => {});
  await settle();
  pending.resolve([{ domain: 'fixture', name: 'Late A name' }]);
  events[0]({ entry_id: 'entry', domain: 'fixture', title: 'Late A event' });
  await settle();
  assert.equal(oldNotifications, 0, 'released preview receives no late completion');
  assert.equal(next.snapshot().manifests.fixture.name, 'B name');
  assert.equal(next.snapshot().configEntries.entry.title, 'B entry');
  nextRelease();
});

test('#1446 absent or denied metadata retains honest fallback without throwing', async () => {
  for (const raw of [undefined, {}, { connection: {}, callWS: true }])
    assert.equal(haIntegrationMetadataSource(raw), undefined);
  for (const callWS of [() => { throw new Error('unavailable'); }, async () => { throw new Error('forbidden'); },
    async () => ({ unsupported: true })]) {
    const port = haIntegrationMetadataSource({ connection: {}, callWS });
    const release = port.acquire(() => {});
    await settle();
    assert.equal(port.snapshot().entriesAvailable, false);
    assert.equal(integrationDisplayName({}, 'missing_name', port.snapshot()), 'missing name');
    release();
  }
});
