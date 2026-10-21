import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeZigbeeTopology } from '../test-build/zigbee-topology-diagnostics.js';
import { normalizeZhaTopology, normalizeZ2mTopology, resolveProviderUplinks,
  TOPOLOGY_MAX_NODES, TOPOLOGY_MAX_LINKS } from '../test-build/zigbee-topology.js';

const ieee = id => id.toString(16).padStart(16, '0');
const key = id => `zha:zha:${ieee(id)}`;
const row = (id, role = 'Router', extra = {}) => ({ ieee: ieee(id), nwk: id === 1 ? 0 : id,
  device_reg_id: `d${id}`, name: `Radio ${id}`, device_type: role, neighbors: [], routes: [], ...extra });
const route = hop => ({ dest_nwk: 0, next_hop: hop, route_status: 'Active' });
const complete = () => normalizeZhaTopology([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0)] })], 123);
const describe = (topology, extra = {}) => describeZigbeeTopology({ topology, devices: [],
  current: { phase: 'ready', obtainedAt: 123, partial: topology.warnings.length > 0 }, ...extra });
const codes = model => model.reasons.map(reason => reason.code);
const markers = [1, 2].map(id => ({ id: `m${id}`, space: 'main', bindingKind: 'device', bindingRef: `d${id}` }));
const registry = { authoritative: true, revision: 1, access: 'full', lastSuccess: 1, entities: {},
  devices: Object.fromEntries([1, 2].map(id => [`d${id}`, { id: `d${id}`, identifiers: [['zha', ieee(id)]] }])) };

test('#1005 no loaded snapshot, full data and stale-only data produce no incomplete details', () => {
  const topology = complete();
  assert.equal(describe(topology).partial, false);
  assert.equal(describe(topology).hasKnownRoute, true);
  assert.deepEqual(describe(topology, { current: undefined }).reasons, []);
  assert.equal(describe(topology, { current: { phase: 'ready' } }).loaded, false);
  assert.deepEqual(describe(topology, { current: { phase: 'ready', obtainedAt: 0, stale: true } }).reasons, []);
});

for (const [name, rows, expected] of [
  ['missing', [row(1, 'Coordinator'), row(2)], 'route_missing'],
  ['role', [row(1, 'Coordinator'), row(2, 'Unknown')], 'route_unknown_role'],
  ['address', [row(1, 'Coordinator'), row(2, 'Router', { routes: [route(999)] })], 'route_unresolved'],
  ['conflict', [row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0), route(3)] }), row(3)], 'route_conflict'],
  ['cycle', [row(1, 'Coordinator'), row(2, 'Router', { routes: [route(3)] }), row(3, 'Router', { routes: [route(2)] })], 'route_cycle'],
]) test(`#1005 actual resolver: ${name} names the affected radio and avoids generic route_unknown duplication`, () => {
  const topology = normalizeZhaTopology(rows, 123), model = describe(topology);
  const reasons = model.reasons.filter(reason => reason.nodeKey === key(2));
  assert.equal(model.partial, true);
  assert.deepEqual(reasons.map(reason => reason.code), [expected]);
  assert.equal(reasons[0].nodeLabel, `Radio 2 (${ieee(2)})`);
});

for (const [warning, expected] of [
  ['invalid_payload', 'invalid_payload'], ['duplicate_link', 'duplicate_link'], ['self_link', 'self_link'],
  ['provider_scan_failure', 'provider_scan_failure'], ['unmatched_device', 'unmatched_device'],
  ['ambiguous_placement', 'ambiguous_placement'], ['route_unknown', 'route_missing'], ['route_unresolved', 'route_unresolved'],
]) test(`#1005 legacy warning ${warning} is still explainable`, () => {
  const topology = complete(); topology.warnings = [{ code: warning, nodeKey: key(2) }];
  const model = describe(topology);
  assert.deepEqual(codes(model), [expected]);
  assert.equal(model.reasons[0].nodeLabel, `Radio 2 (${ieee(2)})`);
});

test('#1005 exact registry/placement failures remain distinct without changing matching', () => {
  const topology = complete();
  const cases = [
    [{ ...registry, devices: {} }, markers, 'registry_missing'],
    [registry, markers.slice(0, 1), 'placement_missing'],
    [registry, [...markers, { ...markers[1], id: 'duplicate' }], 'ambiguous_placement'],
  ];
  for (const [reg, devices, expected] of cases) {
    assert.ok(describe(topology, { registry: reg, devices }).reasons.some(r => r.nodeKey === key(2) && r.code === expected));
  }
  const ambiguous = complete(); delete ambiguous.nodes[1].deviceId;
  const duplicateRegistry = { ...registry, devices: { ...registry.devices,
    alias: { identifiers: [['zha', ieee(2)]] } } };
  assert.ok(describe(ambiguous, { registry: duplicateRegistry, devices: markers }).reasons
    .some(r => r.nodeKey === key(2) && r.code === 'registry_ambiguous'));
  assert.equal(describe(topology, { registry, devices: markers }).partial, false);
});

test('#1005 reported ZHA unavailability is not invented as a scan-stage failure', () => {
  const topology = normalizeZhaTopology([row(1, 'Coordinator'), row(2, 'Router', { routes: [route(0)], available: false })], 123);
  const model = describe(topology, { registry, devices: markers });
  assert.deepEqual(codes(model), ['provider_unavailable']);
  assert.equal(model.reasons[0].failedStages, undefined);
});

test('#1005 opaque provider partial remains explicit alongside independent placement issues', () => {
  const model = describe(complete(), { current: { phase: 'ready', obtainedAt: 123, partial: true },
    registry, devices: markers.slice(0, 1) });
  assert.deepEqual(codes(model), ['placement_missing', 'provider_partial']);
  const topology = complete(); topology.warnings = [{ code: 'invalid_payload' }];
  assert.deepEqual(describe(topology).reasons, [{ code: 'invalid_payload' }], 'do not invent missing device identities');
});

test('#1005 retained snapshot keeps its own reasons and separately reports the failed refresh', () => {
  const topology = normalizeZhaTopology([row(2)], 123);
  const model = describe(topology, { current: { phase: 'error', obtainedAt: 123, partial: true, stale: true, error: 'timeout' } });
  assert.deepEqual(codes(model), ['route_missing']);
  assert.equal(model.refreshError, 'timeout');
  assert.equal(topology.obtainedAt, 123);
});

test('#1005 real anonymized Z2M failed routingTable survives normalization without changing routes', () => {
  const raw = JSON.parse(readFileSync(new URL('./fixtures/zigbee2mqtt-networkmap-real-anonymized.json', import.meta.url), 'utf8'));
  const topology = normalizeZ2mTopology(raw, 'zigbee2mqtt', 123);
  const warning = topology.warnings.find(w => w.code === 'provider_scan_failure');
  assert.deepEqual(warning.failedStages, ['routingTable']);
  const routes = resolveProviderUplinks(topology);
  const reason = describe(topology).reasons.find(r => r.code === 'provider_scan_failure');
  assert.deepEqual(reason.failedStages, ['routingTable']);
  assert.ok(reason.nodeLabel.includes('End device'));
  assert.deepEqual(resolveProviderUplinks(topology), routes, 'diagnostic projection never mutates route evidence');
});

test('#1005 a reported failed table does not override an independently confirmed next hop', () => {
  const topology = normalizeZ2mTopology({ nodes: [
    { ieeeAddr: ieee(1), networkAddress: 0, type: 'Coordinator' },
    { ieeeAddr: ieee(2), networkAddress: 2, type: 'Router', failed: ['routingTable'] },
  ], links: [{ source: { ieeeAddr: ieee(1) }, target: { ieeeAddr: ieee(2) },
    routes: [{ status: 'ACTIVE', destinationAddress: 0, nextHopAddress: 0 }] }] }, 'zigbee2mqtt', 123);
  const before = resolveProviderUplinks(topology);
  assert.equal(before.get(`z2m:zigbee2mqtt:${ieee(2)}`).kind, 'known');
  assert.ok(codes(describe(topology)).includes('provider_scan_failure'));
  assert.deepEqual(resolveProviderUplinks(topology), before);
});

test('#1005 multiple and malformed failed stages preserve the reported failure, not raw objects', () => {
  const topology = normalizeZ2mTopology({ links: [], nodes: [{ ieeeAddr: ieee(2), type: 'Coordinator',
    failed: ['routingTable', 'lqi', ' routingTable ', { secret: 'not diagnostic text' }, null, '', 'x'.repeat(256)] }] }, 'lab/z2m', 123);
  const reason = describe(topology).reasons.find(r => r.code === 'provider_scan_failure');
  assert.deepEqual(reason.failedStages, ['routingTable', 'lqi']);
  assert.equal(reason.unknownStage, true);
  assert.ok(!JSON.stringify(reason).includes('secret'));
});

test('#1005 duplicate warning and mapping facts merge stages but preserve different causes', () => {
  const topology = complete();
  topology.warnings = [
    { code: 'provider_scan_failure', nodeKey: key(2), failedStages: ['routingTable'] },
    { code: 'provider_scan_failure', nodeKey: key(2), failedStages: ['routingTable', 'lqi'], unknownStage: true },
    { code: 'invalid_payload', nodeKey: key(2) },
  ];
  const model = describe(topology);
  assert.deepEqual(codes(model), ['provider_scan_failure', 'invalid_payload']);
  assert.deepEqual(model.reasons[0].failedStages, ['routingTable', 'lqi']);
  assert.equal(model.reasons[0].unknownStage, true);
});

test('#1005 labels remain literal text and are never identities', () => {
  const topology = complete(); topology.nodes[1].name = '<img src=x onerror=alert(1)>';
  topology.warnings = [{ code: 'invalid_payload', nodeKey: key(2) }];
  const model = describe(topology);
  assert.equal(model.reasons[0].nodeLabel, `<img src=x onerror=alert(1)> (${ieee(2)})`);
  assert.equal(model.reasons[0].nodeKey, key(2));
});

test('#1005 maximum-size normalized input does not silently omit nodes or distinct reasons', () => {
  const topology = normalizeZhaTopology(Array.from({ length: TOPOLOGY_MAX_NODES }, (_, i) => row(i + 1, i ? 'Router' : 'Coordinator')), 123);
  topology.warnings = Array.from({ length: TOPOLOGY_MAX_LINKS }, (_, i) => ({ code: 'invalid_payload', nodeKey: key(i % TOPOLOGY_MAX_NODES + 1) }));
  const model = describe(topology);
  assert.equal(model.reasons.filter(r => r.code === 'invalid_payload').length, TOPOLOGY_MAX_NODES);
  assert.equal(model.reasons.filter(r => r.code === 'route_missing').length, TOPOLOGY_MAX_NODES - 1);
  assert.equal(new Set(model.reasons.map(r => r.nodeKey)).size, TOPOLOGY_MAX_NODES);
});
