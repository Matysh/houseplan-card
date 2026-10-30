// #895: real capture/resolver witnesses; the complete path is the oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureHost, oracleFixture } from './render-snapshot-fixture.mjs';
import { makeLedStripsFixture } from '../demo/performance/led-strips-fixture.mjs';
import { captureRenderDeviceSnapshot } from '../test-build/render-snapshot-capture.js';
import { RenderSnapshotReuseWindow } from '../test-build/render-snapshot-reuse.js';
import { PresentationLightFrame, presentationLightWork } from '../test-build/presentation-light-frame.js';
import { resolvedLightSources } from '../test-build/devices.js';
import { resolveDevicePresentation } from '../test-build/device-presentation.js';

const plain = (snapshot) => ({ ...snapshot, capturedAt: undefined,
  positions: [...snapshot.positions], presentations: [...snapshot.presentations], facts: [...snapshot.facts] });
const tick = (host, eid, patch) => {
  const states = { ...host.hass.states };
  if (patch === null) delete states[eid];
  else states[eid] = { ...states[eid], ...patch, entity_id: eid };
  host.hass = { ...host.hass, states };
  host._hassSequence++;
};
const equalComplete = (host, reuse, label) => {
  const next = captureRenderDeviceSnapshot(host, reuse);
  assert.deepEqual(plain(next), plain(captureRenderDeviceSnapshot(host)), label);
  // Independently exercise the pre-index canonical selection: no lightFrame.
  // This fixture has no strips and keeps the default battery policy.
  if (!host._model.some((space) => space.led_strips?.length)
      && host._settings.show_device_battery !== false) {
    const lightSources = resolvedLightSources(host._planHass, host._devices, null, host._virtualLights);
    for (const device of host._devices) for (const showSignal of [false, true]) {
      const canonical = resolveDevicePresentation(host._planHass, device, {
        liveStates: true, showTemperature: true, showSignal, showBattery: true,
        sourceDetails: false, lightDevices: host._devices, lightSources,
        registryHass: host._fullRegistryHass, reducedMotion: host._reducedMotion,
      });
      assert.deepEqual(next.presentations.get(`${device.id}:${showSignal ? 1 : 0}`), canonical,
        `${label}: independent unindexed resolver ${device.id}`);
    }
  }
  return next;
};

test('#895 AC1: 200 markers × 100 light ticks retain every independent face; one lazy graph projection', () => {
  const fixture = makeLedStripsFixture(50, 50);
  const refs = ['perf-device-1', 'perf-device-2'];
  for (const [index, id] of refs.entries()) {
    const marker = fixture.config.markers.find((item) => item.id === id);
    if (index) {
      marker.display = 'value';
      marker.value_source = { kind: 'derived_marker_state', ref: 'marker:perf-device-0' };
    } else marker.value_badge = { enabled: true,
      source: { kind: 'derived_marker_state', ref: 'marker:perf-device-0' } };
  }
  const host = captureHost(fixture), reuse = new RenderSnapshotReuseWindow();
  assert.equal(host._devices.length, 200);
  let previous = captureRenderDeviceSnapshot(host, reuse);
  const builds = reuse.stats.presentations;
  for (let index = 0; index < 100; index++) {
    tick(host, 'light.perf_led_0_0', { state: index % 2 ? 'on' : 'off' });
    const work = [...presentationLightWork];
    const next = captureRenderDeviceSnapshot(host, reuse);
    assert.equal(presentationLightWork[0] - work[0], 1, 'one source index per capture');
    assert.equal(presentationLightWork[1] - work[1], 1, 'one marker-state projection, not N filter/map passes');
    assert.deepEqual(plain(next), plain(captureRenderDeviceSnapshot(host)), `tick ${index}: canonical output`);
    for (const [key, face] of previous.presentations) {
      if (['perf-device-0', ...refs].some((id) => key.startsWith(`${id}:`))) continue;
      assert.equal(next.presentations.get(key), face, `tick ${index}: independent ${key}`);
    }
    previous = next;
  }
  assert.equal(reuse.stats.presentations - builds, 600, '2 × (lamp + two derived consumers) × 100, not 40000');
  // No derived consumer: even supplied lightSources must not create choices.
  for (const id of refs) {
    const marker = fixture.config.markers.find((item) => item.id === id);
    delete marker.value_source; delete marker.value_badge;
  }
  host.rebuildRoster();
  const choices = presentationLightWork[1];
  captureRenderDeviceSnapshot(host, reuse);
  assert.equal(presentationLightWork[1], choices, 'ordinary faces skip marker-state projection entirely');
});

test('#895 AC2: incoming passive, controls, shared physical, missing refs, cycles and manual state equal canonical', () => {
  const fixture = oracleFixture();
  const controller = fixture.config.markers.find((item) => item.id === 'perf-device-1');
  controller.controls.push('marker:perf-virtual-a', 'marker:missing');
  fixture.config.markers.find((item) => item.id === 'perf-device-2').value_badge = {
    enabled: true, source: { kind: 'derived_marker_state', ref: 'marker:perf-virtual-a' },
  };
  fixture.config.markers.push({ id: 'physical-alias', binding: 'entity:light.perf_0',
    space: 'perf-floor-1', is_light: true });
  fixture.layout['physical-alias'] = { s: 'perf-floor-1', x: .4, y: .4 };
  const host = captureHost(fixture), reuse = new RenderSnapshotReuseWindow();
  let previous = equalComplete(host, reuse, 'warm');
  const passive = 'perf-virtual-a:0';
  for (const state of ['on', 'off', 'unavailable', 'on']) {
    tick(host, 'switch.perf_1', { state });
    const next = equalComplete(host, reuse, `passive driver ${state}`);
    if (next.presentations.get(passive).visual.status !== previous.presentations.get(passive).visual.status) {
      assert.notEqual(next.presentations.get(passive), previous.presentations.get(passive),
        'passive target has empty stateEids yet follows its incoming source key');
    }
    assert.equal(next.presentations.get(passive).visual.status, state === 'on' ? 'working' : 'neutral');
    previous = next;
  }
  controller.controls.push('light.perf_0');
  equalComplete(host, reuse, 'direct entity plus shared marker control');
  controller.controls.reverse();
  equalComplete(host, reuse, 'reversed controls preserve canonical graph/source/colour order');
  for (const [eid, patch] of [
    ['light.perf_0', { state: 'off' }], ['light.perf_0', { state: 'unavailable' }],
    ['light.perf_0', { state: 'on', attributes: { rgb_color: [3, 70, 255], brightness: 38 } }],
  ]) { tick(host, eid, patch); previous = equalComplete(host, reuse, `${eid}: ${JSON.stringify(patch)}`); }
  for (const attributes of [
    { rgb_color: [255, 80, 9], brightness: 38 },
    { rgb_color: [255, 80, 9], brightness: 210 },
  ]) {
    const incremental = reuse.stats.incremental, builds = reuse.stats.presentations;
    tick(host, 'light.perf_0', { state: 'on', attributes });
    const next = equalComplete(host, reuse, `same-on attributes: ${JSON.stringify(attributes)}`);
    assert.equal(reuse.stats.incremental, incremental + 1, 'same-on attribute change uses actual reuse');
    assert.notEqual(next.presentations.get('perf-device-0:1'), previous.presentations.get('perf-device-0:1'),
      'tracked source row rebuilds its face even when the resolved on bit is unchanged');
    assert.ok(reuse.stats.presentations - builds < host._devices.length * 2,
      'same-on attribute change retains independent faces, not a disguised full rebuild');
    previous = next;
  }
  for (const [eid, patch] of [
    ['sensor.perf_0_battery', { state: '3' }], ['sensor.perf_3_linkquality', { state: '8' }],
    ['binary_sensor.perf_door_0', { state: 'on', attributes: { device_class: 'smoke' } }],
  ]) { tick(host, eid, patch); equalComplete(host, reuse, `${eid}: ${JSON.stringify(patch)}`); }
  const a = fixture.config.markers.find((item) => item.id === 'perf-virtual-a');
  const b = fixture.config.markers.find((item) => item.id === 'perf-virtual-b');
  a.controls = ['marker:perf-virtual-b']; b.controls = ['marker:perf-virtual-a'];
  equalComplete(host, reuse, 'legacy cycle remains canonical (no new cycle semantics)');
  controller.controls = [];
  a.controls = []; b.controls = [];
  host._virtualLights = { rev: 3, configRev: 0, off: new Set(['perf-virtual-a']) };
  equalComplete(host, reuse, 'manual bit and removed incoming links');
  // Missing derived reference becomes a real source without an HA row.
  a.value_source = { kind: 'derived_marker_state', ref: 'marker:missing' }; a.display = 'value';
  equalComplete(host, reuse, 'missing derived ref');
  fixture.config.markers.push({ id: 'missing', binding: 'virtual', is_light: true, space: 'perf-floor-1' });
  fixture.layout.missing = { s: 'perf-floor-1', x: .2, y: .2 };
  host.rebuildRoster();
  equalComplete(host, reuse, 'previously missing reference appeared');
});

test('#895 AC2/AC4: unknown proof falls back; topology, disposal and fresh rows bound the live cache', () => {
  const host = captureHost(oracleFixture()), reuse = new RenderSnapshotReuseWindow();
  const noProof = { begin: (current) => reuse.begin(current, undefined),
    present: reuse.present.bind(reuse), end: reuse.end.bind(reuse) };
  equalComplete(host, noProof, 'no source dependency proof');
  const before = reuse.stats.presentations;
  tick(host, 'light.perf_0', { state: 'off' });
  equalComplete(host, noProof, 'unknown proof is never an incremental acceptance');
  assert.equal(reuse.stats.presentations - before, host._devices.length * 2);
  const sources = resolvedLightSources(host._planHass, host._devices);
  const ambiguous = new PresentationLightFrame([...sources, sources[0]]);
  assert.equal(ambiguous.topology, null, 'duplicate graph keys cannot prove reuse');
  for (let index = 0; index < 12; index++) {
    host.hass = { ...host.hass, states: Object.fromEntries(Object.entries(host.hass.states)
      .map(([id, row]) => [id, { ...row, attributes: { ...row.attributes } }])) };
    equalComplete(host, reuse, 'fresh state rows');
    // #1161 moves the unchanged cache into bounded floor owners. Keep every
    // original memory assertion on the retained cache, without a product API.
    const slots = [...reuse.floors.values()];
    assert.equal(slots.length, 1, 'undefined-floor caller retains one owner');
    for (const slot of slots) {
      assert.ok(slot.built.size <= host._devices.length * 2, 'presentation entries bounded by current roster');
      assert.ok(slot.lightDeps.size <= host._devices.length, 'source dependency entries bounded by current roster');
    }
  }
  const retiredSlots = [...reuse.floors.values()];
  const oldSources = retiredSlots[0].lightFrame;
  reuse.reset();
  assert.equal(reuse.floors.size, 0, 'dispose retires every floor owner');
  for (const slot of retiredSlots) {
    assert.equal(slot.built.size, 0); assert.equal(slot.lightDeps.size, 0);
    assert.equal(slot.lightFrame, null, 'dispose does not retain old graph/frame');
    assert.equal(slot.rows.size, 0);
  }
  // A late invocation from a retired source context has no owner callback or
  // reference to the new capture's dependency sets.
  oldSources.markerStates(['marker:late']);
  equalComplete(host, reuse, 'new lifecycle is independent of the retired graph');
  for (const change of [
    () => { host._cfgEpoch++; },
    () => { host._layout = { ...host._layout }; },
    () => { host._devices = [...host._devices].reverse(); },
    () => { host.hass = { ...host.hass, entities: { ...host.hass.entities } }; },
    () => { host._serverCfg = { ...host._serverCfg, settings: { show_device_battery: false } }; },
  ]) { change(); equalComplete(host, reuse, 'structural invalidation'); }
  const graph = new PresentationLightFrame(resolvedLightSources(host._planHass, host._devices));
  reuse.begin(host, graph);
  assert.throws(() => reuse.present('interrupted', false, () => { throw Error('interrupted capture'); }), /interrupted/);
  const full = reuse.stats.full;
  equalComplete(host, reuse, 'unfinished capture cannot lend partial dependencies to a new frame');
  assert.equal(reuse.stats.full, full + 1);
});
