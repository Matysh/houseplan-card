import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildZigbeeRouteTree, mapTopologyNodes, normalizeIeee, normalizeZ2mTopology,
  normalizeZhaTopology, resolveTopologyHover,
} from '../test-build/zigbee-topology.js';
import { zigbeeArrowGeometry } from '../test-build/zigbee-topology-geometry.js';
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
  assert.ok(topology.links.some((link) => (
    link.aToB?.relationship === 'sibling' || link.bToA?.relationship === 'sibling'
  )));
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

test('Z2M relationship strings ignore case and separators', () => {
  const topology = normalizeZ2mTopology({ data: { value: JSON.stringify({
    nodes: [
      { ieeeAddr: '00124b0000000001', type: 'Coordinator' },
      { ieeeAddr: '00124b0000000002', type: 'Router' },
      { ieeeAddr: '00124b0000000003', type: 'EndDevice' },
    ],
    links: [
      { sourceIeeeAddr: '00124b0000000001', targetIeeeAddr: '00124b0000000002',
        relationship: ' PREVIOUS-child ' },
      { sourceIeeeAddr: '00124b0000000002', targetIeeeAddr: '00124b0000000003',
        relationship: ' P_a-r ent ' },
    ],
  }) } }, 'zigbee2mqtt');
  assert.deepEqual(topology.links.map((link) => link.aToB.relationship), ['previous_child', 'parent']);
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
    parentTargets: [],
  });
  assert.deepEqual(resolveTopologyHover([topology], devices, registry, 'one', 'mb'), {
    lines: [{ neighborMarkerId: 'ma', lqi: undefined }], remoteCount: 0, omittedCount: 0,
    parentTargets: [],
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
    lines: [], remoteCount: 0, omittedCount: 1, parentTargets: [],
  });
});

test('uplink tree is deterministic, acyclic and always reaches the sole coordinator', () => {
  const topology = {
    provider: 'zha', instanceId: 'zha', obtainedAt: 1, freshness: 'provider-cache', warnings: [],
    nodes: [
      { key: 'c', ieee: '0000000000000001', role: 'coordinator' },
      { key: 'a', ieee: '0000000000000002', role: 'router' },
      { key: 'b', ieee: '0000000000000003', role: 'router' },
      { key: 'd', ieee: '0000000000000004', role: 'end' },
      { key: 'x', ieee: '0000000000000005', role: 'router' },
    ],
    links: [
      { a: 'c', b: 'a', bToA: { lqi: 90 } },
      { a: 'c', b: 'b', bToA: { lqi: 220 } },
      { a: 'a', b: 'b', aToB: { relationship: 'parent', lqi: 255 } },
      { a: 'a', b: 'd', bToA: { relationship: 'parent', lqi: 40 } },
      { a: 'b', b: 'd', bToA: { relationship: 'sibling', lqi: 240 } },
    ],
  };
  const tree = buildZigbeeRouteTree(topology);
  assert.equal(tree.coordinatorKey, 'c');
  assert.deepEqual(Object.fromEntries(tree.distances), { c: 0, a: 1, b: 1, d: 2 });
  assert.deepEqual(Object.fromEntries(tree.parents), { a: 'c', b: 'c', d: 'a' });
  assert.equal(tree.parents.has('x'), false);
  for (const key of tree.parents.keys()) {
    const visited = new Set();
    let current = key;
    while (current !== tree.coordinatorKey) {
      assert.equal(visited.has(current), false, `cycle from ${key}`);
      visited.add(current);
      const parent = tree.parents.get(current);
      assert.ok(parent, `missing parent from ${current}`);
      assert.equal(tree.distances.get(parent), tree.distances.get(current) - 1);
      current = parent;
    }
  }
  const permuted = buildZigbeeRouteTree({
    ...topology, nodes: [...topology.nodes].reverse(), links: [...topology.links].reverse(),
  });
  assert.deepEqual(Object.fromEntries(permuted.parents), Object.fromEntries(tree.parents));
});

test('uplink parent tie-break uses direct LQI then stable key and ambiguous roots fail closed', () => {
  const base = {
    provider: 'zha', instanceId: 'zha', obtainedAt: 1, freshness: 'provider-cache', warnings: [],
    nodes: [
      { key: 'c', ieee: '0000000000000001', role: 'coordinator' },
      { key: 'a', ieee: '0000000000000002', role: 'router' },
      { key: 'b', ieee: '0000000000000003', role: 'router' },
      { key: 'd', ieee: '0000000000000004', role: 'end' },
    ],
    links: [
      { a: 'c', b: 'a' }, { a: 'c', b: 'b' },
      { a: 'a', b: 'd', bToA: { lqi: 100 } },
      { a: 'b', b: 'd', bToA: { lqi: 150 } },
    ],
  };
  assert.equal(buildZigbeeRouteTree(base).parents.get('d'), 'b');
  const tied = { ...base, links: base.links.map((link) => (
    link.a === 'b' && link.b === 'd' ? { ...link, bToA: { lqi: 100 } } : link
  )) };
  assert.equal(buildZigbeeRouteTree(tied).parents.get('d'), 'a');
  assert.equal(buildZigbeeRouteTree({ ...base, nodes: base.nodes.filter((node) => node.key !== 'c') })
    .parents.size, 0);
  assert.equal(buildZigbeeRouteTree({
    ...base, nodes: [...base.nodes, { key: 'c2', ieee: '0000000000000005', role: 'coordinator' }],
  }).parents.size, 0);
});

test('hover projects local route directions and keeps remote children in the old count', () => {
  const topology = normalizeZhaTopology([
    { ieee: '00124b0000000001', device_reg_id: 'da', device_type: 'Coordinator',
      neighbors: [{ ieee: '00124b0000000002', lqi: 180 }] },
    { ieee: '00124b0000000002', device_reg_id: 'db', device_type: 'Router', neighbors: [
      { ieee: '00124b0000000001', lqi: 150, relationship: 'Parent' },
      { ieee: '00124b0000000003', lqi: 70, relationship: 'Child' },
    ] },
    { ieee: '00124b0000000003', device_reg_id: 'dc', device_type: 'EndDevice',
      neighbors: [{ ieee: '00124b0000000002', lqi: 60, relationship: 'Parent' }] },
  ]);
  assert.deepEqual(resolveTopologyHover([topology], devices, registry, 'one', 'mb'), {
    lines: [{ neighborMarkerId: 'ma', lqi: 150, routeDirection: 'toward-neighbor' }],
    remoteCount: 1, omittedCount: 0, parentTargets: [],
  });
  assert.deepEqual(resolveTopologyHover([topology], devices, registry, 'one', 'ma'), {
    lines: [{ neighborMarkerId: 'mb', lqi: 180, routeDirection: 'toward-origin' }],
    remoteCount: 0, omittedCount: 0, parentTargets: [],
  });
  assert.deepEqual(resolveTopologyHover([topology], devices, registry, 'two', 'mc'), {
    lines: [], remoteCount: 0, omittedCount: 0,
    parentTargets: [{ kind: 'remote-space', spaceId: 'one' }],
  });
});

test('hover distinguishes an unplaced coordinator from an unplaced router and never bubbles a child', () => {
  const topology = normalizeZhaTopology([
    { ieee: '00124b0000000001', device_reg_id: 'missing-coordinator', device_type: 'Coordinator',
      neighbors: [{ ieee: '00124b0000000002', lqi: 180 }] },
    { ieee: '00124b0000000002', device_reg_id: 'missing-router', device_type: 'Router', neighbors: [
      { ieee: '00124b0000000001', lqi: 150, relationship: 'parent' },
      { ieee: '00124b0000000003', lqi: 70 },
    ] },
    { ieee: '00124b0000000003', device_reg_id: 'dc', device_type: 'EndDevice',
      neighbors: [{ ieee: '00124b0000000002', lqi: 60, relationship: 'parent' }] },
  ]);
  const routerDevice = { ...devices[1], bindingKind: 'device', bindingRef: 'missing-router' };
  const localRegistry = { ...registry, devices: {
    ...registry.devices,
    'missing-coordinator': { id: 'missing-coordinator' },
    'missing-router': { id: 'missing-router' },
  } };
  assert.deepEqual(resolveTopologyHover([topology], [routerDevice, devices[2]], localRegistry, 'one', 'mb'), {
    lines: [], remoteCount: 1, omittedCount: 1,
    parentTargets: [{ kind: 'unplaced-coordinator' }],
  });
  assert.deepEqual(resolveTopologyHover([topology], [devices[2]], localRegistry, 'two', 'mc'), {
    lines: [], remoteCount: 0, omittedCount: 1,
    parentTargets: [{ kind: 'unplaced-device' }],
  });
});

test('screen-pixel arrow geometry points at the requested endpoint and respects clearance', () => {
  const origin = { x: 0, y: 20 };
  const neighbor = { x: 100, y: 20 };
  const outgoing = zigbeeArrowGeometry(origin, neighbor, 10, 12, 'toward-neighbor');
  assert.deepEqual(outgoing?.tip, { x: 88, y: 20 });
  assert.equal(outgoing?.points[1].x, 79);
  assert.equal(outgoing?.points[2].x, 79);
  const incoming = zigbeeArrowGeometry(origin, neighbor, 10, 12, 'toward-origin');
  assert.deepEqual(incoming?.tip, { x: 10, y: 20 });
  assert.equal(incoming?.points[1].x, 19);
  const diagonal = zigbeeArrowGeometry({ x: 10, y: 10 }, { x: 70, y: 90 }, 5, 7, 'toward-neighbor');
  assert.ok(diagonal && diagonal.tip.x < 70 && diagonal.tip.y < 90);
  assert.equal(zigbeeArrowGeometry(origin, { x: 20, y: 20 }, 10, 8, 'toward-neighbor'), null);
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

// #459. Подсказка «Связи Zigbee»: легенда живёт в словаре, и её содержание —
// защитный контракт. Текст, называющий только цвет и пунктир, формально
// «подсказка есть», но не отвечает ни на один вопрос про стрелки — ради
// которых задача и ждала #457. Поэтому проверяется КАЖДЫЙ пункт легенды.

const topologyDict = (code) => JSON.parse(readFileSync(
  new URL(`../src/i18n/topology/${code}.json`, import.meta.url), 'utf8',
));
const TOPOLOGY_LANGS = ['en', 'ru', 'de', 'fr'];

test('подсказка называет все шесть пунктов легенды (#459 AC3)', () => {
  const help = topologyDict('ru').help;
  const claims = [
    // шкала LQI — обе границы, и они не выдуманы, а взяты из lqiColor (AC4)
    [/\bLQI\b/, 'качество связи названо аббревиатурой LQI'],
    [/\b40\b/, 'нижняя граница шкалы'],
    [/\b180\b/, 'верхняя граница шкалы'],
    [/[Пп]унктир/, 'пунктир как отдельное состояние линии'],
    [/исходящ/i, 'исходящая стрелка'],
    [/координатор/i, 'исходящая стрелка ведёт к координатору'],
    [/входящ/i, 'входящие стрелки'],
    [/без стрелки/i, 'линия без стрелки — запасной сосед'],
    [/подпись на конце стрелки/i, 'подпись = цель не на этом плане'],
    [/отсутствие стрелки/i, 'нет стрелки = путь неизвестен'],
  ];
  for (const [pattern, why] of claims) {
    assert.match(help, pattern, `подсказка не называет: ${why}`);
  }
});

test('подсказка предупреждает, что стрелки — не путь пакета (#459 AC3b)', () => {
  // Оговорка унаследована от §6 ТЗ #457: дерево аплинков строим мы, и между
  // роутерами это приближение. Без неё администратор примет стрелку за истину.
  const help = topologyDict('ru').help;
  // `\w` в JS-регулярке ASCII-словесный: «дерев\w+» на кириллице не совпадёт
  // никогда. Ловушка та же, что с `\b` в счётчике раундов ревью (#454).
  assert.match(help, /дерево маршрут/i);
  assert.match(help, /не путь пакета/i);
});

test('границы шкалы в подсказке — те же, что у lqiColor (#459 AC4)', async () => {
  const { lqiColor } = await import('../test-build/logic.js');
  const hueOf = (value) => Number(/hsl\((\d+)/.exec(lqiColor(value))[1]);
  // Красный край и зелёный край берутся из функции, а не из константы в тесте:
  // сдвинется реализация — тест назовёт другие числа и подсказка разойдётся.
  assert.equal(hueOf(40), 0, 'красный край шкалы');
  assert.equal(hueOf(180), 120, 'зелёный край шкалы');
  const help = topologyDict('ru').help;
  assert.match(help, new RegExp(`\\b40\\b`));
  assert.match(help, new RegExp(`\\b180\\b`));
});

test('подсказка не полагается на переносы строк (#459 AC5)', () => {
  // hp-help кладёт .text текстовым узлом: \n схлопнется в пробел.
  for (const code of TOPOLOGY_LANGS) {
    const dict = topologyDict(code);
    assert.ok(!dict.help.includes('\n'), `${code}: перенос строки в help`);
    assert.ok(dict.help.trim().length > 0, `${code}: пустая подсказка`);
    assert.ok(dict.help_aria.trim().length > 0, `${code}: пустая подпись для скринридера`);
  }
});

test('словари topology несут один и тот же набор ключей (#459 AC6)', () => {
  // Гейт, которого не было: i18n-dead-keys и i18n.test знают основной словарь,
  // бэкендные переводы и support, но не namespace topology.
  const english = Object.keys(topologyDict('en')).sort();
  const placeholders = (value) => (String(value).match(/\{\w+\}/gu) || []).sort();
  const en = topologyDict('en');
  for (const code of TOPOLOGY_LANGS) {
    const dict = topologyDict(code);
    assert.deepEqual(Object.keys(dict).sort(), english, `${code}: набор ключей расходится`);
    for (const key of english) {
      assert.deepEqual(placeholders(dict[key]), placeholders(en[key]),
        `${code}: плейсхолдеры расходятся в ${key}`);
    }
  }
});

test('кружок справки не рисуется без подписи для скринридера (#459 AC2)', async () => {
  const { hasTopologyTranslation } = await import('../test-build/i18n/topology.js');
  // Проверка идёт по СЛОВАРЮ, а не по строке: topologyT на отсутствующий ключ
  // отвечает именем ключа, и «help» — вполне непустая строка.
  assert.equal(hasTopologyTranslation('ru', 'help'), true);
  assert.equal(hasTopologyTranslation('ru', 'help_aria'), true);
  assert.equal(hasTopologyTranslation('ru', 'no_such_key'), false);
  // Английский — слой фолбэка: ключ, которого нет в локали, но есть в en,
  // доступен, как и в topologyT.
  assert.equal(hasTopologyTranslation('de', 'help'), true);
});

test('подсказка вызывается из блока настройки топологии (#459 AC1)', () => {
  const source = readFileSync(
    new URL('../src/hp-zigbee-topology-settings.ts', import.meta.url), 'utf8',
  );
  // Кружок стоит у ЗАГОЛОВКА функции, а не у тумблера: он объясняет функцию,
  // а не то, что делает галочка.
  assert.match(source, /<div class="section">\$\{this\._t\('title'\)\}\$\{this\._help\(\)\}<\/div>/);
  assert.match(source, /<hp-help \.text=/);
  // Fail-closed: оба ключа обязательны, иначе не рисуется ничего.
  assert.match(source, /hasTopologyTranslation\(lang, 'help'\)/);
  assert.match(source, /hasTopologyTranslation\(lang, 'help_aria'\)/);
});
