import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeZhaTopology, normalizeZ2mTopology, normalizeZigbeeNwk, resolveProviderUplinks,
  mapTopologyNodes, mapTopologies, resolveTopologyHover, resolveMappedTopologyHover,
  TOPOLOGY_MAX_NODES, TOPOLOGY_MAX_LINKS, TOPOLOGY_MAX_PAYLOAD_BYTES,
} from '../test-build/zigbee-topology.js';

const ieee = (id) => id.toString(16).padStart(16, '0');
const key = (id, provider = 'zha', instance = 'zha') => `${provider}:${instance}:${ieee(id)}`;
const row = (id, role = 'Router', extra = {}) => ({
  ieee: ieee(id), nwk: id === 1 ? 0 : id, device_reg_id: `d${id}`,
  device_type: role, neighbors: [], routes: [], ...extra,
});
const neighbor = (id, extra = {}) => ({ ieee: ieee(id), ...extra });
const route = (hop, extra = {}) => ({ dest_nwk: '0x0000', next_hop: hop, route_status: 'Active', ...extra });
const active = { kind: 'active', enabledEntityIds: [], allEntityIds: [] };
const markers = [1, 2, 3, 4].map((id) => ({
  id: `m${id}`, name: `Marker ${id}`, model: '', area: '', space: 'main', icon: '', entities: [],
  bindingKind: 'device', bindingRef: `d${id}`, bindingStatus: active,
}));
const registry = {
  revision: 1, authoritative: true, access: 'full', lastSuccess: 1, entities: {},
  devices: Object.fromEntries([1, 2, 3, 4].map((id) => [`d${id}`, {
    id: `d${id}`, identifiers: [['zha', ieee(id)]], name: `Registry ${id}`,
  }])),
};
const hover = (topologies, marker = 'm2', devices = markers, reg = registry) => (
  resolveTopologyHover(topologies, devices, reg, 'main', marker)
);
const zha = (rows) => normalizeZhaTopology(rows, 123);
const selected = (topology, id) => resolveProviderUplinks(topology).get(key(id, topology.provider, topology.instanceId));
const z2m = (links, nodes = [
  { ieeeAddr: ieee(1), networkAddress: 0, type: 'Coordinator' },
  { ieeeAddr: ieee(2), networkAddress: 2, type: 'Router' },
  { ieeeAddr: ieee(3), networkAddress: 3, type: 'EndDevice' },
]) => normalizeZ2mTopology({ nodes, links }, 'zigbee2mqtt', 123);
const zlink = (source, target, extra = {}) => ({
  source: { ieeeAddr: ieee(source) }, target: { ieeeAddr: ieee(target) }, ...extra,
});

test('ZHA route next hop wins over a shorter stronger neighbor and router Parent', () => {
  const topology = zha([
    row(1, 'Coordinator'), row(2, 'Router', {
      neighbors: [neighbor(1, { lqi: 255, relationship: 'Parent' }), neighbor(4, { lqi: 10 })],
      routes: [route('0x0004')],
    }), row(4),
  ]);
  assert.deepEqual(selected(topology, 2), { kind: 'known', targetKey: key(4), evidence: 'route-to-coordinator', lqi: 10 });
  assert.deepEqual(hover([topology]).lines, [{ neighborMarkerId: 'm4', routeDirection: 'toward-neighbor', lqi: 10 }]);
  assert.equal(hover([topology], 'm4').lines[0].routeDirection, 'toward-origin');
  assert.equal(hover([topology], 'm4').outgoing, 'unknown', 'known first hop does not require the rest of the chain');
});

test('ZHA Parent and reverse Child prove the same end parent; sibling and previous child do not', () => {
  for (const own of [true, false]) {
    const topology = zha([row(1, 'Coordinator'), row(2, 'Router', {
      neighbors: own ? [] : [neighbor(3, { relationship: 'Child', lqi: 97 })],
    }), row(3, 'EndDevice', {
      neighbors: own ? [neighbor(2, { relationship: 'Parent', lqi: 97 })] : [],
    })]);
    assert.equal(selected(topology, 3).targetKey, key(2));
    assert.deepEqual(hover([topology], 'm3').lines, [{ neighborMarkerId: 'm2', lqi: 97, routeDirection: 'toward-neighbor' }]);
  }
  for (const relationship of ['Sibling', 'PreviousChild', 'NoneOfTheAbove', undefined]) {
    const topology = zha([row(2, 'Router', { neighbors: [neighbor(3, { relationship, lqi: 255 })] }), row(3, 'EndDevice')]);
    assert.equal(selected(topology, 3).kind, 'unknown');
    assert.deepEqual(hover([topology], 'm3').lines, []);
  }
});

test('Z2M reverses raw link for routing table but Child=1 points source child to target parent', () => {
  const topology = z2m([
    zlink(1, 2, { lqi: 150, relationship: 2, routes: [{ status: 'ACTIVE', destinationAddress: 0, nextHopAddress: 0 }] }),
    zlink(3, 2, { lqi: 0, relationship: 1 }),
  ]);
  assert.equal(selected(topology, 2).targetKey, key(1, 'z2m', 'zigbee2mqtt'));
  assert.equal(selected(topology, 3).targetKey, key(2, 'z2m', 'zigbee2mqtt'));
  assert.deepEqual(hover([topology]).lines, [
    { neighborMarkerId: 'm1', routeDirection: 'toward-neighbor', lqi: 150 },
    { neighborMarkerId: 'm3', routeDirection: 'toward-origin', lqi: 0 },
  ]);
  assert.equal(selected(z2m([zlink(2, 3, { relationship: 0 })]), 3).kind, 'known');
  assert.equal(selected(z2m([zlink(3, 2, { relationship: 2 })]), 3).kind, 'unknown');
});

test('Z2M flat IEEE and snake_case nodes remain compatible; addresses are provider-local', () => {
  const topology = normalizeZ2mTopology({ data: { value: JSON.stringify({
    nodes: [
      { ieee_address: ieee(1), network_address: 0, type: 'Coordinator' },
      { ieee_address: ieee(2), network_address: 2, type: 'Router' },
    ], links: [{ sourceIeeeAddr: ieee(1), targetIeeeAddr: ieee(2),
      source: { ieeeAddr: ieee(4) }, target: { ieeeAddr: ieee(4) },
      routes: [{ status: 'ACTIVE', destinationAddress: 0, nextHopAddress: 0 }] }],
  }) } }, 'second', 123);
  assert.equal(resolveProviderUplinks(topology).get(key(2, 'z2m', 'second')).targetKey, key(1, 'z2m', 'second'));
});

test('relationship strings normalize separators without promoting previous child', () => {
  for (const relationship of [' Pa_rent ', 'PARENT', 'par-ent']) {
    assert.equal(selected(z2m([zlink(2, 3, { relationship })]), 3).kind, 'known');
  }
  for (const relationship of [' Ch_ild ', 'CHILD', 'ch-ild']) {
    assert.equal(selected(z2m([zlink(3, 2, { relationship })]), 3).kind, 'known');
  }
  for (const relationship of [' Previous_Child ', 'previous-child', 'previous child']) {
    assert.equal(selected(z2m([zlink(3, 2, { relationship })]), 3).kind, 'unknown');
  }
});

test('real anonymized routes:false fixture stays neighbors-only, never fake active evidence', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/zigbee2mqtt-networkmap-real-anonymized.json', import.meta.url), 'utf8'));
  const topology = normalizeZ2mTopology(fixture, 'zigbee2mqtt', 123);
  assert.equal(topology.nodes.length, 3); assert.equal(topology.links.length, 2);
  assert.equal(topology.uplinkEvidence.length, 0);
  assert.ok([...resolveProviderUplinks(topology).values()].every((item) => item.kind !== 'known'));
  assert.ok(topology.warnings.some((item) => item.code === 'provider_scan_failure'));
});

test('only ACTIVE status and coordinator destination qualify in either provider', () => {
  for (const status of ['Inactive', 'Discovery_Underway', 'Discovery_Failed', 'Validation_Underway', '', undefined]) {
    assert.equal(selected(zha([row(1, 'Coordinator'), row(2, 'Router', {
      routes: [route(0, { route_status: status })], neighbors: [neighbor(1, { relationship: 'Parent', lqi: 255 })],
    })]), 2).kind, 'unknown');
  }
  for (const status of ['INACTIVE', 'DISCOVERY_UNDERWAY', 'DISCOVERY_FAILED', 'VALIDATION_UNDERWAY', 'UNKNOWN', undefined]) {
    assert.equal(selected(z2m([zlink(1, 2, { routes: [{ status, destinationAddress: 0, nextHopAddress: 0 }] })]), 2).kind, 'unknown');
  }
  for (const destination of [1, 3, 0xffff]) {
    assert.equal(selected(zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0, { dest_nwk: destination })] })]), 2).kind, 'unknown');
    assert.equal(selected(z2m([zlink(1, 2, { routes: [{ status: 'ACTIVE', destinationAddress: destination, nextHopAddress: 0 }] })]), 2).kind, 'unknown');
  }
});

test('unknown roles never acquire an inferred parent or router route', () => {
  for (const role of ['', 'unknown', 'notRouter']) {
    const topology = zha([row(1, 'Coordinator'), row(2, role, {
      neighbors: [neighbor(1, { relationship: 'Parent' })], routes: [route(0)],
    })]);
    assert.deepEqual(selected(topology, 2), { kind: 'unknown', reason: 'unknown-role' });
  }
});

test('addresses reject null/empty/bool/malformed and accept exact decimal or hex zero', () => {
  for (const value of [null, undefined, '', ' ', false, true, '0junk', '1.2', -1, 1.2, 65536, NaN, Infinity]) {
    assert.equal(normalizeZigbeeNwk(value), undefined);
    const topology = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(value)] })]);
    assert.equal(selected(topology, 2).kind, 'unknown');
    assert.equal(selected(zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0, { dest_nwk: value })] })]), 2).kind, 'unknown');
  }
  for (const value of [0, '0', '0x0000', ' 0x0000 ']) assert.equal(normalizeZigbeeNwk(value), 0);
  assert.equal(normalizeZigbeeNwk('0xABcd'), 0xabcd);
});

test('missing or invalid LQI stays undefined; numeric zero remains known', () => {
  for (const lqi of [undefined, null, '', ' ', false, true, -1, 256, NaN, 'bad']) {
    const topology = zha([row(2, 'Router', { neighbors: [neighbor(3, { relationship: 'Child', lqi })] }), row(3, 'EndDevice')]);
    assert.equal(selected(topology, 3).kind, 'known');
    assert.equal(selected(topology, 3).lqi, undefined);
  }
  for (const lqi of [0, '0', 128, 255]) {
    const topology = zha([row(2, 'Router', { neighbors: [neighbor(3, { relationship: 'Child', lqi })] }), row(3, 'EndDevice')]);
    assert.equal(selected(topology, 3).lqi, Number(lqi));
  }
});

test('duplicate evidence merges but conflicting parent/next hop disappears on incoming side too', () => {
  const duplicate = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0), route(0)] })]);
  assert.equal(hover([duplicate]).lines.length, 1);
  const routerConflict = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0), route(4)] }), row(4)]);
  assert.equal(selected(routerConflict, 2).reason, 'conflict');
  assert.deepEqual(hover([routerConflict], 'm1').lines, []);
  assert.deepEqual(hover([routerConflict], 'm4').lines, []);
  const childConflict = zha([row(2, 'Router', { neighbors: [neighbor(3, { relationship: 'Child', lqi: 255 })] }),
    row(4, 'Router', { neighbors: [neighbor(3, { relationship: 'Child', lqi: 1 })] }), row(3, 'EndDevice')]);
  assert.equal(selected(childConflict, 3).reason, 'conflict');
  assert.deepEqual(hover([childConflict]).lines, []);
  assert.deepEqual(hover([childConflict], 'm4').lines, []);
});

test('unresolvable candidate poisons a concurrent good claim; ambiguous NWK is not first-match', () => {
  const unresolved = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0), route(1234)] })]);
  assert.equal(selected(unresolved, 2).reason, 'unresolved');
  const ambiguous = zha([row(1, 'Coordinator'), row(4, 'Router', { nwk: 0 }), row(2, 'Router', { routes: [route(0)] })]);
  assert.equal(selected(ambiguous, 2).kind, 'unknown');
  const badZ2m = z2m([zlink(1, 2, { routes: [{ status: 'ACTIVE', destinationAddress: 0, nextHopAddress: 3 }] })]);
  assert.equal(selected(badZ2m, 2).reason, 'unresolved');
});

test('provider cycles are suppressed, not repaired, including incoming appearance', () => {
  const topology = zha([row(2, 'Router', { routes: [route(4)] }), row(4, 'Router', { routes: [route(2)] }),
    row(3, 'EndDevice', { neighbors: [neighbor(2, { relationship: 'Parent' })] })]);
  assert.equal(selected(topology, 2).reason, 'cycle');
  assert.equal(selected(topology, 4).reason, 'cycle');
  assert.equal(selected(topology, 3).kind, 'known', 'earlier confirmed hop remains useful');
  assert.deepEqual(hover([topology], 'm4').lines, []);
  assert.deepEqual(hover([topology]).lines.map((line) => line.neighborMarkerId), ['m3']);
});

test('cross-provider outgoing conflict is suppressed both ways; missing evidence does not veto known', () => {
  const a = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0)] }), row(4)]);
  const b = normalizeZ2mTopology({ nodes: [
    { ieeeAddr: ieee(1), networkAddress: 0, type: 'Coordinator' },
    { ieeeAddr: ieee(2), networkAddress: 2, type: 'Router' },
    { ieeeAddr: ieee(4), networkAddress: 4, type: 'Router' },
  ], links: [zlink(4, 2, { routes: [{ status: 'ACTIVE', destinationAddress: 0, nextHopAddress: 4 }] })] }, 'second', 124);
  assert.deepEqual(hover([a, b]).lines, []);
  assert.equal(hover([a, b]).outgoing, 'unknown');
  assert.deepEqual(hover([a, b], 'm1').lines, []);
  assert.deepEqual(hover([a, b], 'm4').lines, []);
  const missing = { ...b, uplinkEvidence: [] };
  assert.equal(hover([a, missing]).outgoing, 'known');
  assert.equal(hover([a, missing]).lines.length, 1);
});

test('cycles assembled across providers are suppressed too', () => {
  const a = zha([row(2, 'Router', { routes: [route(4)] }), row(4)]);
  const b = normalizeZ2mTopology({ nodes: [
    { ieeeAddr: ieee(2), networkAddress: 2, type: 'Router' },
    { ieeeAddr: ieee(4), networkAddress: 4, type: 'Router' },
  ], links: [zlink(2, 4, { routes: [{ status: 'ACTIVE', destinationAddress: 0, nextHopAddress: 2 }] })] }, 'second', 124);
  assert.deepEqual(hover([a, b]).lines, []);
  assert.deepEqual(hover([a, b], 'm4').lines, []);
});

test('coordinator is incoming-only; unrelated and unknown hover states stay distinct', () => {
  const topology = zha([row(1, 'Coordinator', { routes: [route(2)] }), row(2, 'Router', { routes: [route(0)] }), row(3, 'EndDevice')]);
  assert.equal(hover([topology], 'm1').outgoing, 'root');
  assert.equal(hover([topology], 'm1').lines[0].routeDirection, 'toward-origin');
  assert.equal(hover([topology], 'm3').outgoing, 'unknown');
  assert.equal(hover([topology], 'm4').outgoing, 'not-zigbee');
  assert.equal(hover([topology], 'm3').obtainedAt, 123);
  assert.equal(hover([topology], 'm3').partial, true);
});

test('#816 known uplink omits incomplete regardless of placement or LQI; global partial survives', () => {
  for (const lqi of [undefined, 0, 255]) for (const placement of ['local', 'remote', 'unplaced']) {
    const topology = zha([row(1, 'Coordinator'), row(2, 'EndDevice', {
      neighbors: [neighbor(1, { relationship: 'Parent', lqi })],
    })]);
    topology.warnings.push({ code: 'invalid_payload' });
    const devices = placement === 'unplaced' ? markers.filter(m => m.id !== 'm1')
      : markers.map(m => m.id === 'm1' && placement === 'remote' ? { ...m, space: 'other' } : m);
    const before = JSON.stringify(topology), result = hover([topology], 'm2', devices);
    assert.equal(result.outgoing, 'known'); assert.equal(result.partial, true);
    assert.equal(result.showIncomplete, false);
    assert.equal(result.lines.length + result.parentTargets.length, 1);
    assert.equal(JSON.stringify(topology), before, 'presentation does not rewrite provider evidence');
  }
});

test('#816 coordinator never incomplete even after cross-provider root conflict', () => {
  const a = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0)] })]);
  a.warnings.push({ code: 'invalid_payload' });
  const b = z2m([zlink(2, 1, { routes: [{ status: 'ACTIVE', destinationAddress: 0, nextHopAddress: 2 }] })], [
    { ieeeAddr: ieee(1), networkAddress: 1, type: 'Router' },
    { ieeeAddr: ieee(2), networkAddress: 0, type: 'Coordinator' },
  ]);
  const empty = zha([row(1, 'Coordinator')]); empty.warnings.push({ code: 'invalid_payload' });
  for (const snapshots of [[a], [empty], [a, b], [b, a]]) {
    const result = hover(snapshots, 'm1');
    assert.equal(result.partial, true); assert.equal(result.showIncomplete, false);
    if (snapshots.length === 2) assert.equal(result.outgoing, 'unknown', 'root conflict is not misreported known');
  }
});

test('#816 incoming-only/unknown stay incomplete; fresh/non-Zigbee do not', () => {
  const topology = zha([row(2, 'Router'), row(3, 'EndDevice', {
    neighbors: [neighbor(2, { relationship: 'Parent' })],
  })]);
  topology.warnings.push({ code: 'invalid_payload' });
  const incoming = hover([topology]);
  assert.equal(incoming.outgoing, 'unknown'); assert.equal(incoming.showIncomplete, true);
  assert.deepEqual(incoming.lines.map(line => line.routeDirection), ['toward-origin']);
  assert.equal(hover([topology], 'm4').showIncomplete, false);
  const mapped = mapTopologies([topology], markers, registry);
  for (const map of mapped) map.partial = false;
  const fresh = resolveMappedTopologyHover(mapped, 'main', 'm2');
  assert.equal(fresh.outgoing, 'unknown'); assert.equal(fresh.showIncomplete, false);
  const a = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0)] }), row(4)]);
  const b = z2m([zlink(4, 2, { routes: [{ status: 'ACTIVE', destinationAddress: 0, nextHopAddress: 4 }] })], [
    { ieeeAddr: ieee(1), networkAddress: 0, type: 'Coordinator' },
    { ieeeAddr: ieee(2), networkAddress: 2, type: 'Router' },
    { ieeeAddr: ieee(4), networkAddress: 4, type: 'Router' },
  ]);
  assert.equal(hover([a, b]).outgoing, 'unknown'); assert.equal(hover([a, b]).showIncomplete, true);
});

test('remote/unplaced parent carries exact target name and observed LQI, never source name', () => {
  const topology = zha([row(2, 'Router', { name: '<b>Provider parent</b>', neighbors: [neighbor(3, { relationship: 'Child', lqi: 128 })] }), row(3, 'EndDevice')]);
  const onlyChild = markers.filter((device) => device.id === 'm3');
  const reg = { ...registry, devices: { ...registry.devices, d2: { ...registry.devices.d2, name_by_user: '<img src=x> User parent' } } };
  const target = hover([topology], 'm3', onlyChild, reg).parentTargets[0];
  assert.deepEqual(target, { kind: 'unplaced-device', nodeKey: key(2), deviceName: '<img src=x> User parent', lqi: 128 });
  assert.equal(hover([topology], 'm3', onlyChild).parentTargets[0].deviceName, 'Registry 2');
  const namelessRegistry = { ...registry, devices: { ...registry.devices, d2: { id: 'd2' } } };
  assert.equal(hover([topology], 'm3', onlyChild, namelessRegistry).parentTargets[0].deviceName, '<b>Provider parent</b>');
  const remoteMarkers = markers.map((device) => device.id === 'm2' ? { ...device, space: 'other' } : device);
  const remote = hover([topology], 'm3', remoteMarkers);
  assert.equal(remote.parentTargets[0].spaceId, 'other');
  assert.equal(remote.remoteCount, 0, 'the named outgoing bubble is not also an incoming count');
  assert.equal(remote.omittedCount, 0);
  const unnamed = zha([row(2), row(3, 'EndDevice', { neighbors: [neighbor(2, { relationship: 'Parent' })] })]);
  assert.equal(hover([unnamed], 'm3', onlyChild, namelessRegistry).parentTargets[0].deviceName, undefined);
});

test('exact device/entity ownership and hidden/ambiguous placements still fail closed', () => {
  const topology = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0)] })]);
  assert.equal(mapTopologyNodes(topology, [...markers, { ...markers[1], id: 'duplicate' }], registry).placements.has(key(2)), false);
  assert.equal(mapTopologyNodes(topology, markers.map((device) => ({ ...device, hidden: true })), registry).placements.size, 0);
  const entityRegistry = { ...registry, entities: { 'sensor.router': { device_id: 'd2' } } };
  const entityMarkers = markers.map((device) => device.id === 'm2'
    ? { ...device, bindingKind: 'entity', bindingRef: 'sensor.router' } : device);
  assert.equal(hover([topology], 'm2', entityMarkers, entityRegistry).lines.length, 1);
  assert.equal(hover([topology], 'm2', markers.filter((device) => device.id !== 'm1')).parentTargets[0].kind, 'unplaced-coordinator');
});

test('node/link/payload bounds remain enforced with no unbounded evidence collection', () => {
  assert.equal(zha(Array.from({ length: TOPOLOGY_MAX_NODES + 1 }, (_, index) => row(index + 1))).nodes.length, 0);
  assert.equal(normalizeZ2mTopology('x'.repeat(TOPOLOGY_MAX_PAYLOAD_BYTES + 1), 'z2m').nodes.length, 0);
  const excessive = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: Array.from({ length: TOPOLOGY_MAX_LINKS + 1 }, () => route(0)) })]);
  assert.equal(selected(excessive, 2).kind, 'unknown');
  assert.ok(excessive.uplinkEvidence.length <= TOPOLOGY_MAX_LINKS);
  const neighbors = Array.from({ length: TOPOLOGY_MAX_NODES + 5 }, (_, index) => neighbor(index + 10, { device_type: 'Router' }));
  assert.ok(zha([row(1, 'Coordinator', { neighbors })]).nodes.length <= TOPOLOGY_MAX_NODES);
});

test('aggregate scan/evidence truncation cannot retain a misleading first route', () => {
  const topology = zha([row(1, 'Coordinator'),
    row(2, 'Router', { routes: Array.from({ length: 3001 }, () => route(0)) }),
    row(2, 'Router', { routes: [...Array.from({ length: 3000 }, () => route(0)), route(4)] }), row(4),
  ]);
  assert.equal(selected(topology, 2).kind, 'unknown');
  assert.ok(topology.uplinkEvidence.length <= TOPOLOGY_MAX_LINKS);
  const parents = zha([row(2), row(3, 'EndDevice', { neighbors: [neighbor(2, { relationship: 'Parent' }),
    ...Array.from({ length: TOPOLOGY_MAX_LINKS }, () => neighbor(4, { relationship: 'Parent' }))] }), row(4)]);
  assert.equal(selected(parents, 3).kind, 'unknown');
});

test('an unresolvable parent observation is not silently discarded beside a known parent', () => {
  const topology = zha([row(2), row(3, 'EndDevice', { neighbors: [
    neighbor(2, { relationship: 'Parent' }), { relationship: 'Parent', ieee: 'malformed' },
  ] })]);
  assert.equal(selected(topology, 3).reason, 'unresolved');
  const mqtt = z2m([zlink(3, 2, { relationship: 1 }), {
    source: { ieeeAddr: ieee(3) }, target: { networkAddress: 9999 }, relationship: 1,
  }]);
  assert.equal(selected(mqtt, 3).reason, 'unresolved');
});

test('self Parent or Child cannot be discarded beside a valid parent in either provider', () => {
  for (const relationship of ['Parent', 'Child']) {
    const topology = zha([row(2), row(3, 'EndDevice', { neighbors: [
      neighbor(2, { relationship: 'Parent' }), neighbor(3, { relationship }),
    ] })]);
    assert.equal(selected(topology, 3).reason, 'unresolved');
    assert.deepEqual(hover([topology], 'm2').lines, []);
  }
  for (const relationship of [0, 1]) {
    const topology = z2m([zlink(3, 2, { relationship: 1 }), zlink(3, 3, { relationship })]);
    assert.equal(selected(topology, 3).reason, 'unresolved');
    assert.deepEqual(hover([topology], 'm2').lines, []);
  }
  assert.equal(selected(z2m([zlink(3, 2, { relationship: 1 }), zlink(3, 3, { relationship: 2 })]), 3).kind, 'known');
});

test('conflicting duplicate node metadata cannot select a source role or target address', () => {
  const topology = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0)] }),
    row(2, 'EndDevice', { neighbors: [neighbor(4, { relationship: 'Parent' })] }), row(4),
    row(3, 'EndDevice', { neighbors: [neighbor(2, { relationship: 'Parent' })] })]);
  assert.equal(selected(topology, 2).reason, 'unresolved');
  assert.equal(selected(topology, 3).reason, 'unresolved');
  assert.deepEqual(hover([topology], 'm4').lines, []);
  const nodes = [{ ieeeAddr: ieee(1), networkAddress: 0, type: 'Coordinator' },
    { ieeeAddr: ieee(2), networkAddress: 2, type: 'Router' },
    { ieeeAddr: ieee(2), networkAddress: 4, type: 'Router' }];
  const mqtt = z2m([zlink(1, 2, { routes: [{ status: 'ACTIVE', destinationAddress: 0, nextHopAddress: 0 }] })], nodes);
  assert.equal(selected(mqtt, 2).reason, 'unresolved');
  const identical = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0)] }), row(2)]);
  assert.equal(selected(identical, 2).kind, 'known');
});

test('memoized mapping contains provider selections and hover cannot mutate them', () => {
  const topology = zha([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0)] })]);
  const mapped = mapTopologies([topology], markers, registry);
  const before = JSON.stringify([...mapped[0].routes]);
  for (let i = 0; i < 20; i++) assert.equal(resolveMappedTopologyHover(mapped, 'main', 'm2').lines.length, 1);
  assert.equal(JSON.stringify([...mapped[0].routes]), before);
});
