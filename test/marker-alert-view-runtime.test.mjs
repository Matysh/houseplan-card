import assert from 'node:assert/strict';
import test from 'node:test';
import { MarkerAlertViewRuntime } from '../test-build/marker-alert-view-runtime.js';
import { ConfigWriteContext } from '../test-build/config-write-context.js';

function fixture() {
  let now = 0, reads = 0, changes = 0, seq = 0;
  const queue = new Map();
  const rule = { id: 'r', type: 'threshold', level: 'attention', entity_id: 'sensor.co2', operator: 'gt', value: 1000 };
  const marker = { id: 'd', binding: 'device:d', alert_sources: [rule] };
  const states = new Proxy({ 'sensor.co2': { state: '1200', attributes: { unit_of_measurement: 'ppm' } } }, {
    get: (target, key) => { reads++; assert.equal(key, 'sensor.co2'); return target[key]; },
  });
  const hass = { states, callWS() {}, connection: {}, user: { id: 'viewer' } };
  const context = new ConfigWriteContext(); context.observe(hass);
  const host = { hass, _planHass: hass, _fullRegistryHass: { entities: { 'sensor.co2': { device_id: 'd' } }, devices: {} },
    _configWriteContext: context, _connectionWasLost: false, _config: { live_states: true }, _markers: [marker],
    _devices: [{ id: 'd', space: 'floor', bindingKind: 'device', bindingRef: 'd', bindingStatus: { kind: 'active' }, marker }],
    isConnected: true, _capturedSeq: 7, requestUpdate() { changes++; } };
  const runtime = new MarkerAlertViewRuntime(host, { now: () => now,
    set: (callback, delay) => { const id = ++seq; queue.set(id, { callback, due: now + delay }); return id; },
    clear: id => queue.delete(id) });
  const advance = at => { now = at; for (const [id, item] of [...queue]) if (item.due <= now) { queue.delete(id); item.callback(); } };
  return { host, runtime, rule, marker, queue, advance, reads: () => reads, changes: () => changes };
}

test('#1000 optional projection confirms current selected fields and retires on lost authority', () => {
  const f = fixture(); f.runtime.connect(); const opened = f.changes(); f.host._capturedSeq = 7; f.advance(2999);
  assert.equal(f.runtime.forDevice('d').length, 0); assert.equal(f.queue.size, 1);
  f.advance(3000); assert.equal(f.runtime.forDevice('d')[0].value, '1200');
  assert.equal(f.host._capturedSeq, -1); assert.equal(f.changes(), opened + 1);
  f.host._connectionWasLost = true; const reads = f.reads(); f.runtime.reconcile();
  assert.equal(f.runtime.forDevice('d').length, 0); assert.equal(f.queue.size, 0); assert.equal(f.reads(), reads);
  f.host._connectionWasLost = false; f.runtime.reconcile(); f.advance(5999);
  assert.equal(f.runtime.forDevice('d').length, 0); f.advance(6000); assert.equal(f.runtime.forDevice('d').length, 1);
  f.host.hass = { ...f.host.hass, connection: {} }; f.host._configWriteContext.observe(f.host.hass);
  assert.equal(f.runtime.forDevice('d').length, 0, 'foreign authority cannot expose an old frame even before reconcile');
});

test('#1000 late deadline reads no retired rule, floor, static or disconnected owner', () => {
  for (const retire of [f => { f.marker.alert_sources = []; }, f => { f.marker.space = 'other'; },
    f => { f.marker.display = 'static_icon'; }, f => { f.host._config.live_states = false; },
    f => { f.runtime.disconnect(); }]) {
    const f = fixture(); f.runtime.connect();
    const reads = f.reads(); retire(f); f.advance(3000);
    assert.equal(f.runtime.forDevice('d').length, 0); assert.equal(f.reads(), reads);
    f.runtime.reconcile(); f.advance(5999); assert.equal(f.runtime.forDevice('d').length, 0);
  }
});

test('#1000 unrelated HA rows/locale do not restart confirmation; reconnect does', () => {
  const f = fixture(); f.runtime.connect(); f.advance(2000);
  f.host.hass = { ...f.host.hass, language: 'fr' }; f.runtime.reconcile();
  f.advance(3000); assert.equal(f.runtime.forDevice('d').length, 1);
  f.runtime.disconnect(); f.runtime.connect(); f.advance(5999); assert.equal(f.runtime.forDevice('d').length, 0);
  f.advance(6000); assert.equal(f.runtime.forDevice('d').length, 1);
});

test('#1000 200 configured devices consume only selected fields on unrelated HA ticks', t => {
  const markers = [], devices = [], entities = {}, rawStates = {};
  let reads = 0, now = 0, timer = null, schedules = 0, changes = 0;
  for (let i = 0; i < 200; i++) {
    const id = `owner_${i}`, eid = `sensor.owner_${i}`;
    entities[eid] = { entity_id: eid, device_id: id };
    rawStates[eid] = { state: '1500', attributes: { unit_of_measurement: 'ppm' } };
    const marker = { id, binding: `device:${id}`, alert_sources: Array.from({ length: 3 }, (_, j) => ({
      id: `r${j}`, type: 'threshold', level: 'attention', entity_id: eid, operator: 'gt', value: 1000 + j * 100,
    })) };
    markers.push(marker); devices.push({ id, space: 'floor', marker, bindingKind: 'device', bindingRef: id,
      bindingStatus: { kind: 'active' } });
  }
  for (let i = 0; i < 15000; i++) rawStates[`sensor.unrelated_${i}`] = { state: '0', attributes: {} };
  const states = new Proxy(rawStates, {
    ownKeys() { throw Error('Threshold runtime enumerated HA states'); },
    get(target, key) { reads++; assert.match(String(key), /^sensor\.owner_\d+$/); return target[key]; },
  });
  const hass = { states, entities, devices: {}, callWS() {}, connection: {}, user: { id: 'viewer' } };
  const context = new ConfigWriteContext(); context.observe(hass);
  const host = { hass, _planHass: hass, _fullRegistryHass: hass, _markers: markers, _devices: devices,
    _config: { live_states: true }, _configWriteContext: context, _connectionWasLost: false,
    isConnected: true, _capturedSeq: 0, requestUpdate() { changes++; } };
  const runtime = new MarkerAlertViewRuntime(host, { now: () => now,
    set(callback) { schedules++; timer = callback; return callback; }, clear() { timer = null; } });
  runtime.connect(); assert.equal(reads, 600); assert.equal(schedules, 1);
  now = 3000; const deadline = timer; timer = null; deadline();
  assert.equal(reads, 1200); assert.equal(runtime.forDevice('owner_199').length, 3);
  const stableUpdates = changes, startReads = reads, samples = [];
  for (let i = 0; i < 100; i++) {
    rawStates[`sensor.unrelated_${i}`] = { state: String(i), attributes: {} };
    host.hass = { ...host.hass }; host._planHass = host.hass; context.observe(host.hass);
    const start = performance.now(); runtime.reconcile(); samples.push(performance.now() - start);
  }
  assert.equal(reads - startReads, 60000); assert.equal(schedules, 1);
  assert.equal(timer, null); assert.equal(changes, stableUpdates);
  samples.sort((a, b) => a - b);
  t.diagnostic(JSON.stringify({ devices: 200, rules: 600, unrelatedStates: 15000,
    p50Ms: samples[50], p95Ms: samples[95], readsPerTick: 600, stateEnumerations: 0, extraSchedules: 0 }));
  runtime.disconnect(); assert.equal(timer, null);
});
