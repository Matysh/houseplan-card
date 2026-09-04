/** #54: bounded provider normalization and incident-only hover performance. */
import { performance } from 'node:perf_hooks';
import { mapTopologies, normalizeZhaTopology, resolveMappedTopologyHover } from '../test-build/zigbee-topology.js';

const NODES = 500;
const SAMPLES = 9;
const BUDGETS = { normalizeMs: 80, mapMs: 160, firstHoverMs: 180, repeatedHoverMs: 120 };
const hex = (index) => index.toString(16).padStart(16, '0');
const rows = Array.from({ length: NODES }, (_, index) => ({
  ieee: hex(index + 1), device_reg_id: `d${index}`, device_type: index ? 'Router' : 'Coordinator',
  neighbors: [1, 2, 3, 4, 5, 6].flatMap((offset) => {
    const other = index + offset;
    return other < NODES ? [{ ieee: hex(other + 1), lqi: (index * 17 + offset * 13) % 256 }] : [];
  }),
}));
const registry = {
  revision: 1, authoritative: true, access: 'full', lastSuccess: Date.now(), entities: {},
  devices: Object.fromEntries(rows.map((_, index) => [`d${index}`, { id: `d${index}` }])),
};
const active = { kind: 'active', enabledEntityIds: [], allEntityIds: [] };
const devices = rows.map((_, index) => ({
  id: `m${index}`, name: '', model: '', area: '', space: index % 5 ? 'main' : 'remote',
  icon: '', entities: [], bindingKind: 'device', bindingRef: `d${index}`, bindingStatus: active,
}));

const measured = (fn) => {
  const samples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const started = performance.now(); fn(); samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length * .9)];
};

let topology; let mapped;
const normalizeMs = measured(() => { topology = normalizeZhaTopology(rows); });
const mapMs = measured(() => { mapped = mapTopologies([topology], devices, registry); });
const firstHoverMs = measured(() => resolveMappedTopologyHover(mapped, 'main', 'm1'));
const repeatedHoverMs = measured(() => {
  for (let i = 1; i <= 20; i++) resolveMappedTopologyHover(mapped, 'main', `m${i}`);
});
const result = { nodes: topology.nodes.length, links: topology.links.length,
  normalizeMs, mapMs, firstHoverMs, repeatedHoverMs };
console.log(JSON.stringify(result, null, 2));
for (const [name, budget] of Object.entries(BUDGETS)) {
  if (result[name] > budget) throw new Error(`${name} ${result[name].toFixed(2)} ms > ${budget} ms`);
}
