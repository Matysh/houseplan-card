import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribeDirectSignal, directSignalReadings, normalizeDirectSignalReadings } from '../test-build/device-signal-runtime.js';
import { createDeviceSignalContext, deviceLqi } from '../test-build/device-signal.js';
import { areaLqi } from '../test-build/devices.js';
import { resolveDevicePresentation } from '../test-build/device-presentation.js';
import { valueBadgeCandidates, resolveValueSource } from '../test-build/device-value-badge.js';
import { captureRenderDeviceSnapshot } from '../test-build/render-snapshot-capture.js';
import { RenderSnapshotReuseWindow } from '../test-build/render-snapshot-reuse.js';
import { captureHost, oracleFixture } from './render-snapshot-fixture.mjs';

const reading = (lqi, available = true, provider = 'z2m') => ({ lqi, provider, available, observed_at: 123, measurement_at: null });
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture(capability = 1) {
  const callbacks = [], events = new Map(), removed = [];
  let commands = 0, subscriptions = 0;
  const hass = { user: { id: 'a', is_admin: false }, states: {}, entities: {}, devices: {},
    callWS: async () => { commands++; return { zigbee_lqi_api: capability }; },
    connection: {
      subscribeMessage: async (callback, command) => {
        assert.equal(command.type, 'houseplan/zigbee_lqi/subscribe');
        const id = subscriptions++; callbacks.push(callback); return () => removed.push(id);
      },
      addEventListener: (name, callback) => events.set(name, callback),
      removeEventListener: (name, callback) => { if (events.get(name) === callback) events.delete(name); },
    } };
  const send = (devices, revision = 0, session_id = 's', index = callbacks.length - 1) =>
    callbacks[index]({ kind: 'reset', devices, revision, session_id });
  return { hass, callbacks, events, removed, send, counts: () => ({ commands, subscriptions }) };
}

test('#1029 AC10/14/15 shared feed is ordered, user-fenced and released after its final consumer', async () => {
  const f = fixture(), notices = [];
  const releaseA = subscribeDirectSignal(f.hass, () => notices.push('a'));
  const releaseB = subscribeDirectSignal(f.hass, () => notices.push('b'));
  await settle();
  assert.deepEqual(f.counts(), { commands: 1, subscriptions: 1 });
  f.send({ device: reading(0) });
  assert.equal(directSignalReadings(f.hass).device.lqi, 0);
  assert.ok(Object.isFrozen(directSignalReadings(f.hass).device));
  f.send({ device: reading(200) }, 4);
  f.send({ device: reading(1) }, 3);
  assert.equal(directSignalReadings(f.hass).device.lqi, 200, 'late revision is refused');
  f.send({ device: reading(3) }, 5, 'new-session');
  assert.equal(directSignalReadings(f.hass).device.lqi, 3, 'full reset replaces a session atomically');
  const next = { ...f.hass, user: { id: 'b' } };
  assert.deepEqual(directSignalReadings(next), {}, 'user swap clears the old projection synchronously');
  f.send({ device: reading(255) }, 10);
  assert.deepEqual(directSignalReadings(next), {}, 'old callback has no authority');
  releaseA(); releaseB();
  assert.equal(f.events.size, 0);
  assert.deepEqual(f.removed, [0]);
  assert.deepEqual(notices, ['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b']);
  const unsupported = fixture(undefined);
  unsupported.hass.callWS = async () => ({});
  const stop = subscribeDirectSignal(unsupported.hass, () => {});
  await settle();
  assert.equal(unsupported.counts().subscriptions, 0, 'old backend does not receive an unknown command'); stop();
});

test('#1029 AC4/10 cancelled pending subscribe and disconnect cannot install old data', async () => {
  const f = fixture();
  let complete;
  f.hass.connection.subscribeMessage = (callback) => {
    f.callbacks.push(callback);
    return new Promise(resolve => { complete = () => resolve(() => f.removed.push('late')); });
  };
  const stop = subscribeDirectSignal(f.hass, () => {});
  await settle(); stop(); complete(); await settle();
  f.send({ device: reading(250) });
  assert.deepEqual(directSignalReadings(f.hass), {});
  assert.deepEqual(f.removed, ['late']);
  assert.equal(f.events.size, 0);
  const live = fixture(), release = subscribeDirectSignal(live.hass, () => {});
  await settle(); live.send({ device: reading(90) });
  live.events.get('disconnected')();
  assert.deepEqual(directSignalReadings(live.hass), {});
  live.events.get('ready')(); await settle();
  live.send({ device: reading(180) }, 0, 'new');
  live.send({ device: reading(2) }, 3, 's', 0);
  assert.equal(directSignalReadings(live.hass).device.lqi, 180);
  release(); assert.equal(live.events.size, 0);
});

test('#1029 AC6 malformed atomic snapshots refuse to replace valid measurements', () => {
  for (const value of [false, null, '', '20', NaN, Infinity, -1, 256]) {
    assert.equal(normalizeDirectSignalReadings({ a: reading(value) }), null, String(value));
  }
  for (const value of [0, 255, 12.5]) assert.equal(normalizeDirectSignalReadings({ a: reading(value) }).a.lqi, value);
  assert.equal(normalizeDirectSignalReadings(Object.fromEntries(Array.from({ length: 1501 }, (_, i) => [i, reading(4)]))), null);
});

test('#1029 AC15 HA asynchronous unsubscribe rejection is contained after release, revoke and pending cancellation', async () => {
  for (const mode of ['release', 'revoked', 'pending']) {
    const f = fixture();
    let complete, releases = 0;
    const remove = async () => { releases++; throw new Error('invalid_subscription'); };
    f.hass.connection.subscribeMessage = (callback) => {
      f.callbacks.push(callback);
      return mode === 'pending' ? new Promise(resolve => { complete = () => resolve(remove); }) : Promise.resolve(remove);
    };
    const stop = subscribeDirectSignal(f.hass, () => {});
    await settle();
    if (mode === 'revoked') {
      f.send({ device: reading(90) });
      f.callbacks[0]({ kind: 'closed', session_id: 's', revision: 1 });
    }
    stop(); complete?.(); await settle();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(releases, 1, mode);
    assert.equal(f.events.size, 0, mode);
    assert.deepEqual(directSignalReadings(f.hass), {}, mode);
  }
});

function ownDevice(id, entity, markerId = id) {
  return { id: markerId, name: markerId, model: '', icon: 'mdi:toggle-switch', entities: [entity], primary: entity,
    area: 'room', space: 'floor', bindingKind: 'device', bindingRef: id, bindingStatus: { kind: 'active' },
    marker: { id: markerId, binding: `device:${id}` } };
}

test('#1029 AC5/7/8/9 direct resolver drives projections, fallback, real zero, candidate cache and room deduplication', async () => {
  const f = fixture(), h = f.hass, d = ownDevice('A', 'switch.a');
  h.devices = { A: {}, B: {}, router: {} };
  h.entities = { 'switch.a': { device_id: 'A' }, 'switch.alias': { device_id: 'A' }, 'sensor.a_lqi': { device_id: 'A' } };
  h.states = { 'switch.a': { state: 'on', attributes: {} } };
  const stop = subscribeDirectSignal(h, () => {}); await settle();
  assert.equal(deviceLqi(h, d), null);
  assert.ok(!valueBadgeCandidates(h, d).some(x => x.key === 'derived:lqi'));
  f.send({ A: reading(200), B: reading(100) });
  const sameStates = h.states;
  assert.equal(deviceLqi(h, d), 200);
  assert.equal(resolveValueSource(h, d, { kind: 'derived_lqi' }).text, '200');
  assert.ok(valueBadgeCandidates(h, d).some(x => x.key === 'derived:lqi'));
  assert.equal(h.states, sameStates);
  const alias = { ...ownDevice('A', 'switch.alias', 'alias'), bindingKind: 'entity', bindingRef: 'switch.alias',
    marker: { id: 'alias', binding: 'entity:switch.alias' } };
  assert.equal(areaLqi(h, [d, alias, ownDevice('B', 'switch.b')], 'room'), 150);
  h.states['sensor.a_lqi'] = { state: '40', attributes: {} }; d.entities.push('sensor.a_lqi');
  assert.equal(deviceLqi(h, d), 200, 'direct preferred, never averaged with HA');
  f.send({ A: reading(200, false) }, 1);
  assert.equal(deviceLqi(h, d), 40, 'available HA preferred over disconnected direct cache');
  delete h.states['sensor.a_lqi'];
  const last = resolveDevicePresentation(h, d, { liveStates: true, showTemperature: true, showSignal: true });
  assert.equal(last.lqiText, '200'); assert.deepEqual(last.lqiSource, { provider: 'z2m', stale: true });
  d.marker.value_source = { kind: 'derived_lqi' };
  f.send({}, 2);
  assert.ok(valueBadgeCandidates(h, d).some(x => x.key === 'derived:lqi'), 'saved unavailable selection survives');
  f.send({ A: reading(0) }, 3);
  assert.equal(deviceLqi(h, d), 0);
  for (const bindingStatus of [{ kind: 'unverified' }, { kind: 'orphaned' }, { kind: 'ha_disabled' }]) {
    assert.equal(deviceLqi(h, { ...d, bindingStatus }), null);
  }
  assert.equal(deviceLqi(h, { ...d, virtual: true }), null);
  h.devices.A = { disabled_by: 'user' }; assert.equal(deviceLqi(h, d), null);
  stop();
});

test('#1029 AC8 frozen and incremental snapshots refresh on direct feed identity without a states tick', async () => {
  const host = captureHost(oracleFixture()), reuse = new RenderSnapshotReuseWindow(), feed = fixture();
  Object.assign(host.hass, { connection: feed.hass.connection, callWS: feed.hass.callWS, user: feed.hass.user });
  const release = subscribeDirectSignal(host.hass, () => {}); await settle();
  const id = 'perf-device-3';
  feed.send({ [id]: reading(200) });
  const first = captureRenderDeviceSnapshot(host, reuse);
  assert.equal(first.presentations.get(`${id}:1`).lqiText, '200');
  feed.send({ [id]: reading(40) }, 1);
  host._hassSequence++;
  const next = captureRenderDeviceSnapshot(host, reuse);
  assert.equal(next.presentations.get(`${id}:1`).lqiText, '40');
  assert.equal(first.hass.zigbeeLqi[id].lqi, 200, 'painted frame keeps its exact old reading');
  assert.equal(deviceLqi(next.hass, next.devices.find(x => x.id === id)), 40);
  assert.equal(createDeviceSignalContext(next.hass).direct[id].lqi, 40);
  release();
});
