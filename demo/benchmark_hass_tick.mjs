// #1111: isolated intake/projection/activity CPU cost, not browser paint latency.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeSelectiveInvalidationFixture } from './fixtures/selective-invalidation.mjs';
import { projectionFixture } from '../test/plan-hass-fixture.mjs';

const arg = (key, fallback) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const runtime = resolve(arg('runtime', 'test-build'));
const load = path => import(pathToFileURL(resolve(runtime, path)).href);
globalThis.window ??= { customCards: [] };
const { HouseplanCard } = await load('houseplan-card.js');
const { intakeHass } = await load('houseplan-render-lifecycle.js');
const { virtualLightSnapshot } = await load('virtual-light-state.js');
const { buildDevices, lightWork } = await load('devices.js');
const data = makeSelectiveInvalidationFixture(true);
const f = projectionFixture({ HouseplanCard, virtualLightSnapshot, data }), host = f.host;
host._displayDevices = buildDevices({ hass: host.hass, registry: host._haRegistry,
  areaToSpace: {}, markers: data.config.markers, settings: data.config.settings,
  excluded: new Set(), showAll: false, firstSpaceId: 'f1', loc: key => key });
host._syncActivityRuntime = HouseplanCard.prototype._syncActivityRuntime;
host._activityTick = HouseplanCard.prototype._activityTick;
assert.equal(host._displayDevices.some(d => d.marker?.display === 'icon_ripple'), false);
const samples = [];
for (const kind of ['unchanged', 'five-changes', 'registry-change']) {
  for (let i = 0; i < 20; i++) {
    let states = host.hass.states;
    if (kind === 'five-changes') {
      states = { ...states };
      for (let k = 0; k < 5; k++) states[`sensor.load_${k}`] = { ...states[`sensor.load_${k}`], state: String(i) };
    }
    if (kind === 'registry-change') host._haRegistry = { ...host._haRegistry, revision: host._haRegistry.revision + 1 };
    host.hass = { ...host.hass, states };
    f.reset(); const lightBefore = lightWork[1];
    const start = performance.now();
    intakeHass(host); const active = host._planHass;
    const duration = performance.now() - start;
    assert.equal(active.states['sensor.load_0'], host.hass.states['sensor.load_0']);
    assert.equal(Object.keys(active.states).length, 1673);
    samples.push({ kind, iteration: i, duration, registryLookups: f.count(),
      lightRequests: f.reads() - 1,
      lightCalculations: lightWork[1] - lightBefore });
  }
}
const statistics = ['unchanged', 'five-changes', 'registry-change'].map(kind => {
  const rows = samples.filter(row => row.kind === kind), times = rows.map(row => row.duration).toSorted((a,b) => a-b);
  return { kind, n: rows.length, median: times[9], p95: times[18], max: times[19],
    maxRegistryLookups: Math.max(...rows.map(row => row.registryLookups)),
    maxLightRequests: Math.max(...rows.map(row => row.lightRequests)),
    maxLightCalculations: Math.max(...rows.map(row => row.lightCalculations)) };
});
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const report = { schema: 1, runtime, node: process.version,
  fixture: { devices: Object.keys(data.devices).length, entities: Object.keys(data.entities).length,
    states: Object.keys(data.states).length, displayed: host._displayDevices.length },
  sources: Object.fromEntries(['houseplan-card.js','ha-binding-status.js','houseplan-render-lifecycle.js','devices.js']
    .map(file => [file, sha256(resolve(runtime,file))])),
  harness: sha256(new URL(import.meta.url)), hostFixture: sha256(new URL('../test/plan-hass-fixture.mjs',import.meta.url)),
  fixtureSource: sha256(new URL('./fixtures/selective-invalidation.mjs',import.meta.url)),
  samples, statistics };
const output = resolve(arg('output', 'artifacts/1111/hass-tick.json'));
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ output, fixture: report.fixture, statistics }));
