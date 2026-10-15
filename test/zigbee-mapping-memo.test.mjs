import test from 'node:test';
import assert from 'node:assert/strict';
import { HpZigbeeTopologyOverlay } from '../test-build/hp-zigbee-topology-overlay.js';
import * as topology from '../test-build/zigbee-topology.js';
const { normalizeZ2mTopology, mapTopologies, memoizeTopologies } = topology;

const ieee = (n) => n.toString(16).padStart(16, '0');
const nodeKey = (n) => `z2m:zigbee2mqtt:${ieee(n)}`;
const active = { kind: 'active', enabledEntityIds: [], allEntityIds: [] };

function fixture() {
  let scans = 0;
  const records = Object.freeze(Object.fromEntries([1, 2].map((n) => [`d${n}`, Object.freeze({
    id: `d${n}`, identifiers: [['mqtt', `zigbee2mqtt_${ieee(n)}`]], name: `Radio ${n}`,
  })])));
  const registry = {
    revision: 0, authoritative: false, access: 'limited', lastSuccess: 0,
    devices: new Proxy(records, { ownKeys(target) { scans++; return Reflect.ownKeys(target); } }),
    entities: Object.freeze({}),
  };
  const devices = Object.freeze([1, 2].map((n) => Object.freeze({
    id: `m${n}`, name: `Marker ${n}`, model: '', area: '', space: 'main', icon: '', entities: [],
    bindingKind: 'device', bindingRef: `d${n}`, bindingStatus: active,
  })));
  const topology = normalizeZ2mTopology({
    nodes: [
      { ieeeAddr: ieee(1), networkAddress: 0, type: 'Coordinator' },
      { ieeeAddr: ieee(2), networkAddress: 2, type: 'EndDevice' },
    ],
    links: [{ source: { ieeeAddr: ieee(2) }, target: { ieeeAddr: ieee(1) }, relationship: 1, lqi: 91 }],
  }, 'zigbee2mqtt', 123);
  assert.ok(topology.nodes.every((node) => !node.deviceId), 'real registry traversal, not direct deviceId');
  return {
    registry, devices, runtime: { revision: 1, topologies: [topology], states: {} },
    hass: { connection: {}, user: { id: 'admin-A', is_admin: true }, language: 'en' },
    scans: () => scans,
  };
}

function assertMapping(mapped) {
  assert.equal(mapped.length, 1);
  assert.deepEqual([...mapped[0].placements.entries()], [
    [nodeKey(1), { markerId: 'm1', space: 'main' }],
    [nodeKey(2), { markerId: 'm2', space: 'main' }],
  ]);
  assert.deepEqual(mapped[0].routes.get(nodeKey(2)), {
    kind: 'known', targetKey: nodeKey(1), evidence: 'end-parent', lqi: 91,
  });
}

test('compiled overlay reuses real mapping after an unrelated HA update/new registry wrapper (#906 AC1)', () => {
  const input = fixture();
  const overlay = new HpZigbeeTopologyOverlay();
  // Compiled render with ordinary provider/registry fixture; no DOM geometry is
  // fabricated. Native hover/resize is a separate, existing browser witness.
  overlay.hass = input.hass;
  overlay.devices = input.devices;
  overlay.registry = input.registry;
  overlay.currentSpace = 'main';
  overlay._runtime = input.runtime;
  overlay._hovered = 'm2';
  overlay.render();
  const first = overlay._mappedMemo.mapped;
  assertMapping(first);
  const initialScans = input.scans();
  assert.ok(initialScans > 0);
  overlay.hass = { ...input.hass, states: { 'sensor.unrelated': { state: '42' } } };
  overlay.registry = { ...input.registry };
  overlay.render();
  assertMapping(overlay._mappedMemo.mapped);
  const repeatedScans = input.scans() - initialScans;
  console.log(JSON.stringify({ initialScans, repeatedScans, nodeCount: 2, exactMapping: true }));
  assert.equal(repeatedScans, 0, 'an unrelated update cannot traverse the registry again');
  assert.strictEqual(overlay._mappedMemo.mapped, first);
  overlay.updated(new Map([['registry', input.registry], ['hass', input.hass]]));
  assert.strictEqual(overlay._mappedMemo.mapped, first, 'post-render must not discard semantic reuse');
});

const memoInput = (input) => ({
  topologies: input.runtime.topologies, revision: input.runtime.revision,
  devices: input.devices, registry: input.registry, owner: input.hass.connection,
  userIdentity: 'admin-A:true',
});

test('same and new wrappers reuse mapping, including limited revision0 (#906 AC2 positive)', () => {
  const fixtureInput = fixture();
  const input = memoInput(fixtureInput);
  const first = memoizeTopologies(undefined, input);
  assertMapping(first.mapped);
  const count = fixtureInput.scans();
  assert.strictEqual(memoizeTopologies(first, input), first);
  assert.strictEqual(memoizeTopologies(first, { ...input, registry: { ...input.registry } }), first);
  assert.equal(fixtureInput.scans(), count);
});

const invalidations = [
  ['limited revision0 device rows', (input) => ({ ...input, registry: { ...input.registry, devices: {
    d1: { id: 'd1', identifiers: [['mqtt', `zigbee2mqtt_${ieee(2)}`]] },
    d2: { id: 'd2', identifiers: [['mqtt', `zigbee2mqtt_${ieee(1)}`]] },
  } } })],
  ['limited revision0 entity rows', (input) => ({ ...input, registry: { ...input.registry,
    entities: { 'sensor.child': { device_id: 'd1', unique_id: `zigbee2mqtt_${ieee(2)}` } },
  } })],
  ['empty limited rows', (input) => ({ ...input, registry: { ...input.registry, devices: {}, entities: {} } })],
  ['registry revision', (input) => ({ ...input, registry: { ...input.registry, revision: 1 } })],
  ['registry authority', (input) => ({ ...input, registry: { ...input.registry, authoritative: true } })],
  ['registry access', (input) => ({ ...input, registry: { ...input.registry, access: 'full' } })],
  ['registry freshness', (input) => ({ ...input, registry: { ...input.registry, lastSuccess: 123 } })],
  ['registry error', (input) => ({ ...input, registry: { ...input.registry, error: 'forbidden' } })],
  ['marker binding', (input) => ({ ...input,
    devices: input.devices.map((marker) => marker.id === 'm2' ? { ...marker, bindingRef: 'd1' } : marker),
  })],
  ['marker visibility', (input) => ({ ...input,
    devices: input.devices.map((marker) => marker.id === 'm2' ? { ...marker, hidden: true } : marker),
  })],
  ['marker permission', (input) => ({ ...input,
    devices: input.devices.map((marker) => marker.id === 'm2'
      ? { ...marker, bindingStatus: { kind: 'unverified' } } : marker),
  })],
  ['marker floor', (input) => ({ ...input,
    devices: input.devices.map((marker) => marker.id === 'm2' ? { ...marker, space: 'upstairs' } : marker),
  })],
  ['provider material', (input) => ({ ...input,
    topologies: input.topologies.map((topology) => ({ ...topology, uplinkEvidence: [] })),
  })],
  ['provider revision', (input) => ({ ...input, revision: input.revision + 1 })],
  ['connection owner', (input) => ({ ...input, owner: {} })],
  ['user identity', (input) => ({ ...input, userIdentity: 'admin-B:true' })],
  ['admin permission', (input) => ({ ...input, userIdentity: 'admin-A:false' })],
];

for (const [name, change] of invalidations) test(`${name} invalidates and equals a fresh exact map (#906 AC2)`, () => {
  const input = memoInput(fixture());
  const first = memoizeTopologies(undefined, input);
  const changed = change(input);
  const next = memoizeTopologies(first, changed);
  assert.notStrictEqual(next, first);
  assert.notStrictEqual(next.mapped, first.mapped);
  assert.deepEqual(next.mapped, mapTopologies(changed.topologies, changed.devices, changed.registry));
  assert.strictEqual(memoizeTopologies(next, { ...changed, registry: { ...changed.registry } }), next);
});

test('single-owner cache never resurrects an earlier A after A→B→A (#906 AC2)', () => {
  const input = memoInput(fixture());
  const a1 = memoizeTopologies(undefined, input);
  const b = memoizeTopologies(a1, { ...input, userIdentity: 'admin-B:true', owner: {} });
  const a2 = memoizeTopologies(b, input);
  assert.notStrictEqual(a2, a1);
  assert.notStrictEqual(a2.mapped, a1.mapped);
  assertMapping(a2.mapped);
});

test('scalar metadata is captured, not read back through a mutated wrapper (#906 AC2)', () => {
  const input = memoInput(fixture());
  const first = memoizeTopologies(undefined, input);
  input.registry.access = 'full';
  const next = memoizeTopologies(first, input);
  assert.notStrictEqual(next, first);
  assert.equal(first.registry.access, 'limited');
  assert.equal(next.registry.access, 'full');
  assertMapping(next.mapped);
});

test('entity-only discovery changes exact placement without changing device rows/revision (#906 AC2)', () => {
  const input = memoInput(fixture());
  input.registry = { ...input.registry,
    devices: { d1: { id: 'd1' }, d2: { id: 'd2' } },
    entities: Object.fromEntries([1, 2].map((n) => [`sensor.${n}`, {
      device_id: `d${n}`, unique_id: `zigbee2mqtt_${ieee(n)}`,
    }])),
  };
  const first = memoizeTopologies(undefined, input);
  assertMapping(first.mapped);
  const changed = { ...input, registry: { ...input.registry, entities: {
    ...input.registry.entities, 'sensor.2': { device_id: 'gone', unique_id: `zigbee2mqtt_${ieee(2)}` },
  } } };
  const next = memoizeTopologies(first, changed);
  assert.notStrictEqual(next.mapped, first.mapped);
  assert.equal(next.mapped[0].placements.has(nodeKey(2)), false, 'old child marker is no longer an exact owner');
  assert.deepEqual(next.mapped, mapTopologies(changed.topologies, changed.devices, changed.registry));
  assert.equal(changed.registry.revision, 0);
  assert.strictEqual(changed.registry.devices, input.registry.devices);
});
