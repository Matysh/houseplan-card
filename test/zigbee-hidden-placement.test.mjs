import test from 'node:test';
import assert from 'node:assert/strict';
import { describeZigbeeTopology } from '../test-build/zigbee-topology-diagnostics.js';
import { HiddenDeviceRoster } from '../test-build/hidden-device-visibility.js';
import { mapTopologyNodes, mapTopologies, normalizeZhaTopology, resolveMappedTopologyHover } from '../test-build/zigbee-topology.js';

const ieee = n => n.toString(16).padStart(16, '0');
const key = n => 'zha:zha:' + ieee(n);
const topologyOf = () => normalizeZhaTopology([1, 2].map(n => ({ ieee: ieee(n), nwk: n === 1 ? 0 : n,
  device_reg_id: 'd' + n, device_type: n === 1 ? 'Coordinator' : 'Router', name: 'Radio ' + n,
  neighbors: [], routes: n === 1 ? [] : [{ dest_nwk: 0, next_hop: 0, route_status: 'Active' }] })), 123);
const registry = { authoritative: true, revision: 1, access: 'full', lastSuccess: 1, entities: {
  'sensor.radio_two': { device_id: 'd2' },
}, devices: Object.fromEntries([1, 2].map(n => ['d' + n, { id: 'd' + n, identifiers: [['zha', ieee(n)]] }])) };
const rows = () => [1, 2].map(n => ({ id: 'm' + n, space: 'main', bindingKind: 'device', bindingRef: 'd' + n,
  bindingStatus: { kind: 'active' }, hidden: n === 2, userHidden: n === 2, marker: { id: 'm' + n, hidden: n === 2 } }));
const describe = (devices, topology = topologyOf(), extra = {}) => describeZigbeeTopology({ devices, registry, topology,
  current: { phase: 'ready', obtainedAt: 123, partial: topology.warnings.length > 0 }, ...extra });

test('#1077 hidden-only is an existing placement, not incomplete provider data', () => {
  const devices = rows(), before = structuredClone(devices), model = describe(devices);
  assert.equal(model.partial, false);
  assert.deepEqual(model.reasons, []);
  assert.deepEqual(model.hidden, [{ nodeKey: key(2), nodeLabel: 'Radio 2 (' + ieee(2) + ')', shown: false }]);
  assert.equal(mapTopologyNodes(topologyOf(), devices, registry).placements.has(key(2)), false);
  assert.deepEqual(devices, before, 'read projection must not rewrite saved/user visibility');
});

test('#1077 revealed hidden origin and neighbour share ordinary direct links without rewriting config', () => {
  const devices = rows(), before = structuredClone(devices), roster = new HiddenDeviceRoster();
  const visible = roster.read(devices, true, 1), mapped = mapTopologies([topologyOf()], visible, registry);
  const model = describe(visible);
  assert.equal(model.partial, false); assert.equal(model.hidden[0].shown, true);
  const outgoing = resolveMappedTopologyHover(mapped, 'main', 'm2');
  const incoming = resolveMappedTopologyHover(mapped, 'main', 'm1');
  assert.equal(outgoing.outgoing, 'known'); assert.equal(outgoing.showIncomplete, false);
  assert.equal(incoming.showIncomplete, false, 'coordinator is never incomplete');
  assert.deepEqual(outgoing.lines.map(l => l.neighborMarkerId), ['m1']);
  assert.deepEqual(incoming.lines.map(l => l.neighborMarkerId), ['m2']);
  assert.deepEqual(devices, before);
  assert.equal(describe(roster.read(devices, false, 1)).hidden[0].shown, false);
});

test('#1077 hidden to hidden uses both positive revealed bindings, then eye off removes both', () => {
  const devices = rows().map(d => ({ ...d, hidden: true, userHidden: true, marker: { ...d.marker, hidden: true } }));
  const roster = new HiddenDeviceRoster(), visible = roster.read(devices, true);
  const hover = resolveMappedTopologyHover(mapTopologies([topologyOf()], visible, registry), 'main', 'm2');
  assert.deepEqual(hover.lines.map(l => l.neighborMarkerId), ['m1']);
  assert.equal(describe(visible).hidden.length, 2);
  const off = roster.read(devices, false);
  assert.equal(mapTopologyNodes(topologyOf(), off, registry).placements.size, 0);
  assert.equal(describe(off).partial, false);
});

test('#1077 actual absent placement remains missing and is not described as hidden', () => {
  const model = describe(rows().slice(0, 1));
  assert.equal(model.partial, true);
  assert.equal(model.hidden, undefined);
  assert.ok(model.reasons.some(r => r.code === 'placement_missing' && r.nodeKey === key(2)));
});

for (const [name, patch] of [
  ['HA disabled', { bindingStatus: { kind: 'ha_disabled' } }],
  ['orphaned', { bindingStatus: { kind: 'orphaned' } }],
  ['unverified', { bindingStatus: { kind: 'unverified' } }],
  ['removed', { marker: { hidden: true, removed: true } }],
  ['virtual', { virtual: true }],
]) test('#1077 hidden never revives ' + name, () => {
  const devices = rows(); devices[1] = { ...devices[1], ...patch };
  const visible = new HiddenDeviceRoster().read(devices, true);
  assert.equal(mapTopologyNodes(topologyOf(), visible, registry).placements.has(key(2)), false);
  const model = describe(visible);
  assert.equal(model.hidden, undefined);
  assert.ok(model.reasons.some(r => r.code === 'placement_missing'));
});

test('#1077 provider and route failures remain independent of hidden-only placement', () => {
  const topology = topologyOf();
  topology.warnings = [{ code: 'provider_scan_failure', nodeKey: key(2), failedStages: ['routingTable'] }];
  const model = describe(rows(), topology);
  assert.equal(model.hidden[0].shown, false);
  assert.equal(model.partial, true);
  assert.deepEqual(model.reasons.map(r => r.code), ['provider_scan_failure']);
  const opaque = describe(rows(), topologyOf(), { current: { phase: 'ready', obtainedAt: 123, partial: true } });
  assert.deepEqual(opaque.reasons.map(r => r.code), ['provider_partial']);
});

test('#1077 duplicate hidden physical placements remain ambiguous', () => {
  const devices = rows(); devices.push({ ...devices[1], id: 'duplicate' });
  const model = describe(devices);
  assert.equal(model.hidden, undefined);
  assert.deepEqual(model.reasons.map(r => r.code), ['ambiguous_placement']);
});

test('#1077 a visible entity alias remains a valid radio representative while the device marker is hidden', () => {
  const devices = [...rows(), { id: 'alias', space: 'upper', hidden: false, bindingKind: 'entity',
    bindingRef: 'sensor.radio_two', bindingStatus: { kind: 'active' } }];
  const placement = mapTopologyNodes(topologyOf(), devices, registry);
  assert.deepEqual(placement.placements.get(key(2)), { markerId: 'alias', space: 'upper' });
  assert.equal(describe(devices).partial, false);
  assert.equal(describe(devices).hidden, undefined);
});

