import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  mapTopologyNodes, normalizeIeee, normalizeZ2mTopology,
  normalizeZhaTopology, resolveTopologyHover,
} from '../test-build/zigbee-topology.js';
import {
  normalizeZ2mBaseTopic, writeZigbeeTopologySettings, zigbeeTopologySettingsOf,
} from '../test-build/zigbee-topology-settings.js';
import {
  readZhaTopology, refreshZ2mTopology, zigbeeTopologyRuntimeSnapshot,
} from '../test-build/zigbee-topology-runtime.js';

const z2mNetworkmapFixture = JSON.parse(readFileSync(
  new URL('./fixtures/zigbee2mqtt-networkmap-real-anonymized.json', import.meta.url),
  'utf8',
));

const registry = {
  revision: 1, authoritative: true, access: 'full', lastSuccess: 1,
  devices: {
    da: { id: 'da', identifiers: [['zha', '00:12:4b:00:00:00:00:01']] },
    db: { id: 'db', identifiers: [['mqtt', 'zigbee2mqtt_0x00124b0000000002']] },
    dc: { id: 'dc', identifiers: [['mqtt', 'zigbee2mqtt_bridge_00124b0000000003']] },
  },
  entities: {
    'sensor.b': { entity_id: 'sensor.b', device_id: 'db', unique_id: 'b_lqi' },
  },
};

const active = { kind: 'active', enabledEntityIds: [], allEntityIds: [] };
const devices = [
  { id: 'ma', name: 'A', model: '', area: 'a', space: 'one', icon: '', entities: [], bindingKind: 'device', bindingRef: 'da', bindingStatus: active },
  { id: 'mb', name: 'B', model: '', area: 'b', space: 'one', icon: '', entities: [], bindingKind: 'entity', bindingRef: 'sensor.b', bindingStatus: active },
  { id: 'mc', name: 'C', model: '', area: 'c', space: 'two', icon: '', entities: [], bindingKind: 'device', bindingRef: 'dc', bindingStatus: active },
];

test('topology settings are default-off, bounded, normalized and preserved independently', () => {
  assert.deepEqual(zigbeeTopologySettingsOf(undefined), { enabled: false, z2mBaseTopics: [] });
  assert.deepEqual(zigbeeTopologySettingsOf({ zigbee_topology: {
    enabled: true, z2m_base_topics: [' zigbee2mqtt/ ', 'zigbee2mqtt', 'bad/#'],
  } }), { enabled: true, z2mBaseTopics: ['zigbee2mqtt'] });
  assert.equal(normalizeZ2mBaseTopic('/house//z2m/'), 'house/z2m');
  const saved = writeZigbeeTopologySettings({ keep: 7 }, {
    enabled: true, z2mBaseTopics: ['zigbee2mqtt'],
  });
  assert.deepEqual(saved, { keep: 7, zigbee_topology: { enabled: true, z2m_base_topics: ['zigbee2mqtt'] } });
  assert.deepEqual(writeZigbeeTopologySettings(saved, { enabled: false, z2mBaseTopics: [] }), { keep: 7 });
});

test('IEEE normalization is exact and rejects partial identifiers', () => {
  assert.equal(normalizeIeee('0x00124B0000000001'), '00124b0000000001');
  assert.equal(normalizeIeee('00:12:4b:00:00:00:00:01'), '00124b0000000001');
  assert.equal(normalizeIeee('124b1'), null);
});

test('ZHA normalization keeps directional observations and never infers route edges', () => {
  const topology = normalizeZhaTopology([
    { ieee: '00124b0000000001', device_reg_id: 'da', device_type: 'Router',
      neighbors: [{ ieee: '00124b0000000002', lqi: 170 }],
      routes: [{ dest_nwk: 77, next_hop: 88 }] },
    { ieee: '00124b0000000002', device_reg_id: 'db', device_type: 'EndDevice',
      neighbors: [{ ieee: '00124b0000000001', lqi: 90 }] },
  ], 123);
  assert.equal(topology.links.length, 1);
  assert.equal(topology.links[0].aToB.lqi, 170);
  assert.equal(topology.links[0].bToA.lqi, 90);
  assert.equal(topology.obtainedAt, 123);
});

test('Z2M normalization accepts a real anonymized camelCase raw network map', () => {
  const topology = normalizeZ2mTopology(z2mNetworkmapFixture, 'zigbee2mqtt', 456);
  assert.deepEqual(topology.nodes.map(({ ieee, role, available }) => ({ ieee, role, available })), [
    { ieee: '187a3efffe000002', role: 'coordinator', available: undefined },
    { ieee: 'c02cedfffe000001', role: 'router', available: undefined },
    { ieee: '00158d0000000003', role: 'end', available: undefined },
  ]);
  assert.ok(topology.nodes.every((node) => !Object.hasOwn(node, 'available')));
  assert.equal(topology.links.length, 2);
  assert.deepEqual(
    topology.links.map((link) => link.aToB?.lqi ?? link.bToA?.lqi).sort((a, b) => a - b),
    [97, 182],
  );
  assert.deepEqual(topology.warnings, []);
});

test('Z2M normalization keeps snake_case compatibility and prefers flat link IEEE fields', () => {
  const topology = normalizeZ2mTopology({ data: { value: JSON.stringify({
    nodes: [
      { ieee_address: '00124b0000000001', network_address: 1, type: 'Coordinator', failed: true },
      { ieee_address: '00124b0000000002', type: 'Router' },
      { ieee_address: '00124b0000000003', type: 'Router' },
    ],
    links: [
      { sourceIeeeAddr: '00124b0000000001', targetIeeeAddr: '00124b0000000002',
        source: { ieee_address: '00124b0000000003' }, target: { ieee_address: '00124b0000000003' }, linkquality: 'bad' },
      { source: { ieee_address: '00124b0000000001' }, target: { ieee_address: '00124b0000000001' }, linkquality: 255 },
    ],
  }) } }, 'zigbee2mqtt', 456);
  assert.equal(topology.links.length, 1);
  assert.deepEqual([topology.links[0].a, topology.links[0].b], [
    'z2m:zigbee2mqtt:00124b0000000001',
    'z2m:zigbee2mqtt:00124b0000000002',
  ]);
  assert.equal(topology.links[0].aToB.lqi, undefined);
  assert.equal(topology.nodes.find((node) => node.ieee === '00124b0000000001')?.available, false);
  assert.ok(topology.warnings.some((item) => item.code === 'self_link'));
});

test('exact device/entity mapping yields local lines and a deduplicated remote count', () => {
  const topology = normalizeZhaTopology([
    { ieee: '00124b0000000001', device_reg_id: 'da', neighbors: [
      { ieee: '00124b0000000002', lqi: 180 },
      { ieee: '00124b0000000003', lqi: 70 },
    ] },
    { ieee: '00124b0000000002', device_reg_id: 'db', neighbors: [] },
    { ieee: '00124b0000000003', device_reg_id: 'dc', neighbors: [] },
  ]);
  const mapped = mapTopologyNodes(topology, devices, registry);
  assert.deepEqual([...mapped.placements.values()], [
    { markerId: 'ma', space: 'one' }, { markerId: 'mb', space: 'one' }, { markerId: 'mc', space: 'two' },
  ]);
  assert.deepEqual(resolveTopologyHover([topology], devices, registry, 'one', 'ma'), {
    lines: [{ neighborMarkerId: 'mb', lqi: 180 }], remoteCount: 1, omittedCount: 0,
  });
  assert.deepEqual(resolveTopologyHover([topology], devices, registry, 'one', 'mb'), {
    lines: [{ neighborMarkerId: 'ma', lqi: undefined }], remoteCount: 0, omittedCount: 0,
  });
});

test('hidden and ambiguous placements fail closed', () => {
  const topology = normalizeZhaTopology([
    { ieee: '00124b0000000001', device_reg_id: 'da', neighbors: [{ ieee: '00124b0000000002', lqi: 100 }] },
    { ieee: '00124b0000000002', device_reg_id: 'db', neighbors: [] },
  ]);
  const ambiguous = [...devices, { ...devices[0], id: 'ma2' }];
  assert.equal(mapTopologyNodes(topology, ambiguous, registry).placements.has(topology.nodes[0].key), false);
  const hidden = devices.map((item) => item.id === 'mb' ? { ...item, hidden: true } : item);
  assert.deepEqual(resolveTopologyHover([topology], hidden, registry, 'one', 'ma'), {
    lines: [], remoteCount: 0, omittedCount: 1,
  });
});

test('ZHA runtime is explicit, admin-only and deduplicates concurrent reads', async () => {
  let calls = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const hass = { user: { is_admin: true }, connection: {}, callWS: async (message) => {
    calls++;
    assert.deepEqual(message, { type: 'zha/devices' });
    await pending;
    return [{ ieee: '00124b0000000001', device_reg_id: 'da', neighbors: [] }];
  } };
  const a = readZhaTopology(hass);
  const b = readZhaTopology(hass);
  assert.equal(calls, 1);
  release();
  await Promise.all([a, b]);
  assert.equal(zigbeeTopologyRuntimeSnapshot(hass).topologies.length, 1);

  const denied = { user: { is_admin: false }, connection: {}, callWS: async () => assert.fail('must not call') };
  await readZhaTopology(denied);
  assert.equal(zigbeeTopologyRuntimeSnapshot(denied).states.zha.error, 'permission');
});

test('Z2M runtime verifies retained bridge info, correlates transaction and cleans subscriptions', async () => {
  const listeners = new Map();
  let cleanups = 0;
  const hass = {
    user: { is_admin: true },
    connection: {
      async subscribeMessage(callback, message) {
        listeners.set(message.topic, callback);
        if (message.topic.endsWith('/bridge/info')) queueMicrotask(() => callback({ retain: true, payload: '{}' }));
        if (message.topic.endsWith('/bridge/response/networkmap')) {
          queueMicrotask(() => callback({ retain: false, payload: 'stale-not-json' }));
        }
        return () => { cleanups++; listeners.delete(message.topic); };
      },
    },
    async callService(domain, service, data) {
      assert.equal(`${domain}.${service}`, 'mqtt.publish');
      const request = JSON.parse(data.payload);
      assert.equal(request.type, 'raw');
      assert.equal(request.routes, false);
      listeners.get('zigbee2mqtt/bridge/response/networkmap')?.({ retain: true,
        payload: JSON.stringify({ status: 'ok', transaction: request.transaction }) });
      listeners.get('zigbee2mqtt/bridge/response/networkmap')?.({ retain: false,
        payload: JSON.stringify({ status: 'ok', transaction: 'foreign' }) });
      queueMicrotask(() => listeners.get('zigbee2mqtt/bridge/response/networkmap')?.({
        retain: false,
        payload: JSON.stringify({
          ...z2mNetworkmapFixture,
          transaction: request.transaction,
        }),
      }));
    },
  };
  await refreshZ2mTopology(hass, 'zigbee2mqtt', 100);
  assert.equal(cleanups, 2);
  const snapshot = zigbeeTopologyRuntimeSnapshot(hass);
  assert.equal(snapshot.states['z2m:zigbee2mqtt'].phase, 'ready');
  assert.equal(snapshot.topologies[0].nodes.length, 3);
  assert.equal(snapshot.topologies[0].links.length, 2);
});

test('Z2M runtime rejects a malformed response immediately instead of timing out', async () => {
  const listeners = new Map();
  let cleanups = 0;
  const hass = {
    user: { is_admin: true },
    connection: {
      async subscribeMessage(callback, message) {
        listeners.set(message.topic, callback);
        if (message.topic.endsWith('/bridge/info')) queueMicrotask(() => callback({ retain: true, payload: '{}' }));
        return () => { cleanups++; listeners.delete(message.topic); };
      },
    },
    async callService() {
      queueMicrotask(() => listeners.get('zigbee2mqtt/bridge/response/networkmap')?.({
        retain: false, payload: 'not-json-garbage',
      }));
    },
  };
  const startedAt = performance.now();
  await refreshZ2mTopology(hass, 'zigbee2mqtt', 500);
  assert.ok(performance.now() - startedAt < 250, 'malformed response must not wait for the timeout');
  assert.equal(cleanups, 2);
  assert.equal(zigbeeTopologyRuntimeSnapshot(hass).states['z2m:zigbee2mqtt'].error, 'invalid_payload');
});

test('Z2M runtime refuses an unconfirmed base topic without publishing and still cleans up', async () => {
  let publishes = 0;
  let cleanups = 0;
  const hass = {
    user: { is_admin: true },
    connection: { async subscribeMessage() { return () => { cleanups++; }; } },
    async callService() { publishes++; },
  };
  await refreshZ2mTopology(hass, 'zigbee2mqtt', 10);
  assert.equal(publishes, 0);
  assert.equal(cleanups, 2);
  assert.equal(zigbeeTopologyRuntimeSnapshot(hass).states['z2m:zigbee2mqtt'].error, 'timeout');
});
