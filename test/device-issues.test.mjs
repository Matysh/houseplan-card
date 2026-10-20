import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDeviceIssue } from '../test-build/device-issues.js';
import { resolveDevicePresentation } from '../test-build/device-presentation.js';
import { makeDeviceIssuesFixture, maintenanceSource as eid } from '../demo/fixtures/device-issues.mjs';
import { captureHost, oracleFixture } from './render-snapshot-fixture.mjs';
import { captureRenderDeviceSnapshot } from '../test-build/render-snapshot-capture.js';
import { RenderSnapshotReuseWindow } from '../test-build/render-snapshot-reuse.js';
import { presentationSnapshotKey } from '../test-build/render-device-snapshot.js';
const plain = s => ({ sourceSequence: s.sourceSequence, hass: s.hass, devices: s.devices,
  vacuumDevices: s.vacuumDevices, positions: [...s.positions], presentations: [...s.presentations],
  facts: [...s.facts], entityIds: s.entityIds, geometry: s.geometry });

const registry = { platform: 'homeconnect_ws', translation_key: 'binary_sensor_machinecareandfiltercleaningreminder' };
const options = { liveStates: true, showTemperature: false, showSignal: false };
const project = (fixture, marker = {}, extra = {}) => resolveDevicePresentation(fixture,
  { ...fixture.device, marker: { ...fixture.device.marker, ...marker } }, { ...options, ...extra });

test('#972 AC1: all 55 supplied states yield only a passive service reminder while powered off', () => {
  const fixture = makeDeviceIssuesFixture();
  assert.equal(Object.keys(fixture.states).length, 55);
  const p = project(fixture);
  assert.equal(p.visual.status, 'neutral');
  assert.equal(p.pulse.kind, 'none');
  assert.equal(p.maintenance, true);
  assert.deepEqual(p.issues.map(i => [i.eid, i.severity, i.reason]), [[eid, 'maintenance', 'machine_care_filter']]);
  assert.equal(p.issues[0].name, 'MachineCare and Filter');
  assert.equal(p.issues[0].state, 'on');
  fixture.states[eid] = { ...fixture.states[eid], state: 'off' };
  assert.deepEqual(project(fixture).issues, []);
  assert.equal(project(fixture).maintenance, false);
});

test('#972 AC2: only exact service semantics can lower a problem alarm', () => {
  for (const key of ['binary_sensor_machinecarereminder', 'binary_sensor_machinecareandfiltercleaningreminder', 'binary_sensor_smartfiltercleaningreminder']) {
    assert.equal(classifyDeviceIssue(eid, 'on', 'problem', { ...registry, translation_key: key }).severity, 'maintenance');
    assert.equal(classifyDeviceIssue(eid, 'on', 'problem', { platform: 'homeconnect_ws', unique_id: `opaque-device-${key}` }).severity, 'maintenance');
  }
  for (const meta of [undefined, {}, { ...registry, platform: 'another' },
    { ...registry, translation_key: 'unknown' }, { platform: 'homeconnect_ws', unique_id: 'device-machinecare_and_filter' },
    { ...registry, translation_key: 'unknown', unique_id: `device-${registry.translation_key}` },
    { platform: 'homeconnect_ws', name: 'MachineCare and Filter' },
    { platform: 'homeconnect_ws', unique_id: `${registry.translation_key}` },
  ]) assert.equal(classifyDeviceIssue(eid, 'on', 'problem', meta).severity, 'alarm', JSON.stringify(meta));
  for (const dc of ['smoke', 'gas', 'carbon_monoxide', 'moisture', 'safety', 'tamper']) {
    assert.equal(classifyDeviceIssue(eid, 'on', dc, registry).severity, 'alarm', dc);
  }
  for (const [id, state, dc] of [['siren.test', 'on', ''], ['alarm_control_panel.test', 'triggered', '']]) {
    assert.equal(classifyDeviceIssue(id, state, dc, registry).severity, 'alarm');
  }
  for (const state of ['off', 'unknown', 'unavailable']) assert.equal(classifyDeviceIssue(eid, state, 'problem', registry), null);
});

test('#972 AC3/6: all concurrent sources deduplicate and alarms outrank maintenance', () => {
  const f = makeDeviceIssuesFixture();
  for (const id of ['binary_sensor.appliance_aquastop_occurred', 'binary_sensor.appliance_drain_pump_blocked']) f.states[id] = { ...f.states[id], state: 'on' };
  f.device.entities.push(eid); // A visual/owned alias must not duplicate its explanation.
  const p = project(f);
  assert.equal(p.visual.status, 'alarm');
  assert.equal(p.pulse.kind, 'alarm');
  assert.equal(p.pulse.color, '#F0410C');
  assert.equal(p.maintenance, false);
  assert.equal(p.issues.length, 3);
  assert.equal(p.issues.filter(i => i.severity === 'alarm').length, 2);
  f.states['binary_sensor.appliance_aquastop_occurred'] = { ...f.states['binary_sensor.appliance_aquastop_occurred'], state: 'off' };
  assert.equal(project(f).issues.length, 2);
  f.states['binary_sensor.appliance_drain_pump_blocked'] = { ...f.states['binary_sensor.appliance_drain_pump_blocked'], state: 'unavailable' };
  assert.equal(project(f).maintenance, true);
});

test('#972 AC6: display policies and lifecycle do not revive a hidden or unavailable marker', () => {
  const f = makeDeviceIssuesFixture();
  for (const liveStates of [true, false]) for (const display of ['badge', 'icon_ripple', 'value']) {
    assert.equal(project(f, { display }, { liveStates }).maintenance, true, display);
  }
  for (const display of ['static_icon', 'value_static_icon']) {
    const p = project(f, { display });
    assert.equal(p.maintenance, false);
    assert.equal(p.pulse.kind, 'none');
    assert.equal(p.issues[0].eid, eid);
  }
  for (const kind of ['ha_disabled', 'orphaned']) {
    const p = project({ ...f, device: { ...f.device, bindingStatus: { kind } } });
    assert.deepEqual(p.issues, []); assert.equal(p.maintenance, false);
  }
  const hidden = project({ ...f, device: { ...f.device, userHidden: true, hidden: true } }, { hidden: true });
  assert.deepEqual(hidden.issues, []); assert.equal(hidden.maintenance, false);
  const empty = { ...f, states: {}, device: { ...f.device, entities: [], primary: null, virtual: true, bindingKind: 'virtual', marker: { binding: 'virtual' } } };
  assert.deepEqual(project(empty).issues, []);
});

test('#972 AC6: a reminder preserves genuine work, presence and open states', () => {
  for (const [source, dc, expected, activity] of [
    ['binary_sensor.renamed_presence', 'occupancy', 'neutral', 'presence'],
    ['binary_sensor.renamed_door', 'door', 'open', 'none'],
    ['binary_sensor.renamed_running', 'running', 'working', 'running'],
  ]) {
    const f = makeDeviceIssuesFixture();
    f.states[source] = { entity_id: source, state: 'on', attributes: { device_class: dc } };
    f.entities[source] = { entity_id: source, device_id: 'appliance', platform: 'demo' };
    f.device.entities = [source, eid]; f.device.primary = source;
    const p = project(f, { display: 'icon_ripple' });
    assert.equal(p.maintenance, true); assert.equal(p.visual.status, expected);
    assert.equal(p.activity, activity);
    assert.equal(p.pulse.kind === 'alarm', false);
  }
  assert.equal(classifyDeviceIssue('binary_sensor.arbitrary_new_name', 'on', 'problem', registry).severity, 'maintenance');
});

test('#972 AC5: accepted incremental snapshots equal a full capture across states, metadata and binding changes', () => {
  const f = oracleFixture(), sample = makeDeviceIssuesFixture();
  const owner = 'perf-device-2';
  Object.assign(f.states, sample.states);
  Object.assign(f.entities, Object.fromEntries(Object.entries(sample.entities).map(([id, row]) => [id, { ...row, device_id: owner }])));
  const host = captureHost(f);
  host.rebuildRoster();
  const reuse = new RenderSnapshotReuseWindow();
  let previous = captureRenderDeviceSnapshot(host, reuse);
  const accepted = previous;
  const issueList = frame => frame.presentations.get(presentationSnapshotKey(owner, false)).issues;
  assert.equal(issueList(previous).length, 1);
  const step = change => {
    change(); host._hassSequence++; host.rebuildRoster();
    const incremental = captureRenderDeviceSnapshot(host, reuse);
    const full = captureRenderDeviceSnapshot(host, null);
    assert.deepEqual(plain(incremental), plain(full));
    previous = incremental;
  };
  step(() => { host.hass = { ...host.hass, states: { ...host.hass.states, [eid]: { ...host.hass.states[eid], state: 'off' } } }; });
  assert.equal(issueList(previous).length, 0);
  assert.equal(issueList(accepted).length, 1);
  assert.ok(Object.isFrozen(issueList(accepted)));
  step(() => { host.hass = { ...host.hass, states: { ...host.hass.states, [eid]: { ...host.hass.states[eid], state: 'on' } } }; });
  step(() => { host.hass = { ...host.hass, entities: { ...host.hass.entities, [eid]: { ...host.hass.entities[eid], platform: 'other' } } }; });
  assert.equal(issueList(previous)[0].severity, 'alarm');
  step(() => { host.hass = { ...host.hass, language: 'ru' }; });
  step(() => { host.hass = { ...host.hass, entities: { ...host.hass.entities, [eid]: { ...host.hass.entities[eid], disabled_by: 'user' } } }; });
  assert.deepEqual(issueList(previous), []);
  step(() => { host.hass = { ...host.hass, entities: { ...host.hass.entities, [eid]: { ...host.hass.entities[eid], ...registry, disabled_by: null, name: 'Renamed reminder' } } }; });
  assert.equal(issueList(previous)[0].name, 'Renamed reminder');
  const row = host.hass.states[eid];
  step(() => { const states = { ...host.hass.states }; delete states[eid]; host.hass = { ...host.hass, states }; });
  assert.deepEqual(issueList(previous), []);
  step(() => { host.hass = { ...host.hass, states: { ...host.hass.states, [eid]: row },
    entities: { ...host.hass.entities, [eid]: { ...host.hass.entities[eid], device_id: 'perf-device-3' } } }; });
  assert.deepEqual(issueList(previous), []);
});
