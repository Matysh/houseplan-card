import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMarkerStateSource, markerStateSourceCandidates, stateSourceOwnership, markerStateSourceFields } from '../test-build/marker-state-source.js';
import { resolveDevicePresentation, resolvePresentationSources, activitySourceSignature } from '../test-build/device-presentation.js';
import { createFiniteActivityRuntime, advanceFiniteActivity } from '../test-build/activity-runtime.js';
import { resolveToggleIntent } from '../test-build/device-toggle.js';
import { resolvedLightSources } from '../test-build/devices.js';
import { captureHost, oracleFixture } from './render-snapshot-fixture.mjs';
import { captureRenderDeviceSnapshot } from '../test-build/render-snapshot-capture.js';
import { RenderSnapshotReuseWindow } from '../test-build/render-snapshot-reuse.js';
import { presentationSnapshotKey } from '../test-build/render-device-snapshot.js';

const row = (state, attributes = {}) => ({ state, attributes });
const fixture = (source = { entity_id: 'sensor.run' }) => ({
  h: { states: { 'switch.relay': row('on'), 'sensor.run': row('running'), 'sensor.foreign': row('running') },
    entities: { 'switch.relay': { device_id: 'd' }, 'sensor.run': { device_id: 'd', entity_category: 'diagnostic' }, 'sensor.foreign': { device_id: 'other' } }, devices: {} },
  d: { id: 'd', name: 'Washer', model: '', space: 's', area: 'a', icon: 'mdi:washing-machine',
    bindingKind: 'device', bindingRef: 'd', bindingStatus: { kind: 'active' },
    entities: ['switch.relay'], primary: 'switch.relay', marker: { id: 'd', binding: 'device:d', display: 'icon_ripple', state_source: source } },
});
const opts = { liveStates: true, showTemperature: true, showSignal: false };
const project = ({ h, d }, extra = {}) => resolveDevicePresentation(h, d, { ...opts, ...extra });

test('#977 normalizer exact states, limits, reserved values and lossless future fields', () => {
  const raw = { entity_id: 'sensor.run', active_states: [' running ', 'running', 'Washing'], future: { v: 3 } };
  assert.deepEqual(normalizeMarkerStateSource(raw), { ...raw, active_states: ['running', 'Washing'] });
  for (const active_states of [[], [''], ['unknown'], [' UNAVAILABLE '], ['a\nb'], [true], ['x'.repeat(256)], Array.from({ length: 33 }, (_, i) => `${i}`)]) {
    assert.equal(normalizeMarkerStateSource({ entity_id: 'sensor.run', active_states }), null);
  }
  assert.ok(normalizeMarkerStateSource({ entity_id: 'sensor.run', active_states: ['🧹'.repeat(255)] }));
  assert.equal(normalizeMarkerStateSource({ entity_id: 'not an entity' }), null);
  assert.deepEqual(markerStateSourceFields({ stateSource: raw }), { state_source: raw });
  assert.deepEqual(markerStateSourceFields({ stateSource: null, stateSourceTouched: true }), {});
  assert.deepEqual(markerStateSourceFields({}), {});
});

test('#977 own-device candidates never borrow controls/via_device/name, entity siblings need proof', () => {
  const { h } = fixture();
  assert.deepEqual(markerStateSourceCandidates('device:d', h), ['sensor.run', 'switch.relay']);
  assert.deepEqual(markerStateSourceCandidates('entity:sensor.run', h), ['sensor.run', 'switch.relay']);
  assert.deepEqual(markerStateSourceCandidates('entity:sensor.lonely', h), ['sensor.lonely']);
  assert.deepEqual(markerStateSourceCandidates('virtual', h), []);
  assert.equal(stateSourceOwnership('device:d', 'sensor.foreign', h), 'foreign');
  assert.equal(stateSourceOwnership('device:d', 'sensor.run', {}), 'pending');
  h.entities['sensor.run'].disabled_by = 'user';
  assert.deepEqual(markerStateSourceCandidates('device:d', h), ['switch.relay']);
  h.entities['sensor.run'].disabled_by = null; h.devices.d = { disabled_by: 'user' };
  assert.deepEqual(markerStateSourceCandidates('device:d', h), []);
});

test('#977 Auto is identical; manual nonmatch wins over active Power and missing never falls back', () => {
  const f = fixture(undefined); delete f.d.marker.state_source;
  const auto = project(f); f.d.marker.state_source = null;
  assert.deepEqual(project(f), auto);
  f.d.marker.state_source = { entity_id: 'sensor.run', active_states: ['washing'] };
  assert.equal(project(f).visual.status, 'neutral'); assert.equal(project(f).pulse.kind, 'none');
  f.h.states['sensor.run'] = row('washing');
  assert.equal(project(f).visual.status, 'working');
  f.h.states['sensor.run'] = row('Washing');
  assert.equal(project(f).visual.status, 'neutral');
  f.h.states['sensor.run'] = row('unknown');
  assert.equal(project(f).stateSource.failure, 'unknown');
  assert.equal(project(f).visual.availability, 'available'); assert.equal(project(f).visual.status, 'neutral');
  delete f.h.states['sensor.run'];
  assert.equal(project(f).stateSource.failure, 'missing'); assert.equal(project(f).visual.status, 'neutral');
});

test('#977 foreign/disabled/virtual sources are not read, even from imported config', () => {
  for (const [binding, eid, expected] of [['device:d', 'sensor.foreign', 'foreign'], ['virtual', 'sensor.run', 'virtual']]) {
    const f = fixture({ entity_id: eid }); f.d.marker.binding = binding;
    Object.defineProperty(f.h.states, eid, { get() { throw new Error('foreign source read'); } });
    assert.equal(project(f).stateSource.failure, expected);
    assert.equal(project(f).visual.status, 'neutral');
  }
  const f = fixture(); f.h.entities['sensor.run'].disabled_by = 'user';
  assert.equal(project(f).stateSource.failure, 'disabled');
});

test('#977 standard domain/class/attribute/lifecycle semantics, native offline and protected roles', () => {
  for (const [eid, state, attrs, status, activity] of [
    ['binary_sensor.run', 'on', { device_class: 'running' }, 'working', 'running'],
    ['binary_sensor.presence', 'on', { device_class: 'occupancy' }, 'neutral', 'presence'],
    ['automation.run', 'on', {}, 'neutral', 'none'],
    ['climate.run', 'heat', { hvac_action: 'idle' }, 'neutral', 'none'],
    ['climate.run', 'heat', { hvac_action: 'heating' }, 'working', 'running'],
    ['sensor.operation_state', 'active', {}, 'working', 'running'],
  ]) {
    const f = fixture({ entity_id: eid }); f.h.entities[eid] = { device_id: 'd' }; f.h.states[eid] = row(state, attrs);
    const p = project(f); assert.equal(p.visual.status, status, eid); assert.equal(p.stateSource.sample.activity, activity, eid);
  }
  for (const [eid, state, attrs] of [['cover.blind', 'opening', {}], ['lock.front', 'locked', {}], ['binary_sensor.door', 'off', { device_class: 'door' }]]) {
    const f = fixture(); f.h.states[eid] = row(state, attrs); f.d.entities = [eid]; f.d.primary = eid;
    const p = project(f); const auto = structuredClone(f); auto.d.marker.state_source = null;
    assert.equal(p.protectedFace, true); assert.deepEqual(p.visual, project(auto).visual); assert.equal(p.lockState, project(auto).lockState);
  }
  const f = fixture(); f.h.states['switch.relay'] = row('unavailable');
  assert.equal(project(f).visual.availability, 'unavailable'); assert.equal(project(f).pulse.kind, 'none');
  f.h.states['switch.relay'] = row('on'); f.d.entities.push('cover.unrelated'); f.h.states['cover.unrelated'] = row('open');
  assert.equal(project(f).protectedFace, undefined);
});

test('#977 alarms, static, live off and RGB/actions/values/battery stay independent', () => {
  const f = fixture({ entity_id: 'sensor.run', active_states: ['washing'] });
  f.d.entities.push('binary_sensor.smoke'); f.h.states['binary_sensor.smoke'] = row('on', { device_class: 'smoke' });
  assert.equal(project(f).visual.status, 'alarm'); assert.equal(project(f).pulse.kind, 'alarm');
  f.d.marker.display = 'static_icon'; assert.equal(project(f).visual.status, 'neutral');
  f.d.marker.display = 'icon_ripple'; f.h.states['binary_sensor.smoke'] = row('off', { device_class: 'smoke' });
  assert.equal(project(f, { liveStates: false }).visual.status, 'neutral');
  f.d.entities = ['light.rgb']; f.d.primary = 'light.rgb'; f.h.states['light.rgb'] = row('on', { rgb_color: [1, 22, 233] });
  const manual = project(f); f.d.marker.state_source = null; const auto = project(f);
  for (const key of ['icon', 'lightColor', 'valueText', 'valueBadge', 'battery', 'lqiText', 'rippleColor']) assert.deepEqual(manual[key], auto[key], key);
  assert.equal(manual.visual.status, 'neutral'); assert.equal(auto.visual.status, 'working');
  f.d.tapAction = 'toggle';
  const autoAction = resolveToggleIntent({ hass: f.h, device: f.d, devices: [f.d] });
  const lightFacts = () => resolvedLightSources(f.h, [f.d]).map(({ device, ...source }) => source);
  const autoLights = lightFacts();
  f.d.marker.state_source = { entity_id: 'sensor.run', active_states: ['washing'] };
  assert.deepEqual(resolveToggleIntent({ hass: f.h, device: f.d, devices: [f.d] }), autoAction);
  assert.deepEqual(lightFacts(), autoLights, 'same Glow/room-light inputs, not the icon override');
  const alarm = fixture({ entity_id: 'binary_sensor.smoke', active_states: ['off'] });
  alarm.h.entities['binary_sensor.smoke'] = { device_id: 'd' };
  alarm.h.states['binary_sensor.smoke'] = row('on', { device_class: 'smoke' });
  assert.equal(project(alarm).visual.status, 'alarm', 'an own selected critical sibling cannot be demoted by an explicit nonmatch');
  assert.equal(project(alarm).issues.filter(issue => issue.eid === 'binary_sensor.smoke').length, 1, 'critical reason is explained, not only painted');
});

test('#977 source signature fences old short events; initial observations never fabricate edges', () => {
  const f = fixture({ entity_id: 'binary_sensor.motion' });
  f.h.entities['binary_sensor.motion'] = { device_id: 'd' }; f.h.states['binary_sensor.motion'] = row('on', { device_class: 'motion' });
  const sources = resolvePresentationSources(f.h, f.d), signature = activitySourceSignature(f.h, f.d, sources);
  const runtime = createFiniteActivityRuntime(signature, sources.samples);
  assert.equal(advanceFiniteActivity(runtime, sources.samples, () => {}), null);
  f.d.marker.state_source = { entity_id: 'sensor.run' };
  assert.notEqual(activitySourceSignature(f.h, f.d), signature);
  const p = project(f, { now: 5000, activityRuntime: { sources: signature, flashTs: 4500, flashKind: 'event', gen: 1 } });
  assert.equal(p.activity, 'running'); assert.notEqual(p.pulse.kind, 'short');
});

test('#977 chosen diagnostic outside d.entities: state/attrs/registry-only ticks match full capture', () => {
  const f = oracleFixture(), id = 'perf-device-0', eid = 'climate.own_diagnostic';
  f.config.markers.push({ id, binding: `device:${id}`, state_source: { entity_id: eid }, display: 'icon_ripple' });
  f.entities[eid] = { entity_id: eid, device_id: id, entity_category: 'diagnostic' };
  f.states[eid] = { entity_id: eid, ...row('heat', { hvac_action: 'idle' }) };
  const host = captureHost(f), reuse = new RenderSnapshotReuseWindow(), key = presentationSnapshotKey(id, true);
  // Narrow functional roster (for example an entity marker); ownership still
  // comes from the full registry, not from this renderer/action projection.
  host._devices = host._devices.map(d => d.id === id ? { ...d, entities: d.entities.filter(value => value !== eid) } : d);
  assert.ok(!host._devices.find(d => d.id === id).entities.includes(eid));
  const first = captureRenderDeviceSnapshot(host, reuse);
  assert.equal(first.presentations.get(key).visual.status, 'neutral');
  const other = first.presentations.get(presentationSnapshotKey('perf-device-1', true));
  host.hass = { ...host.hass, states: { ...host.hass.states, [eid]: { entity_id: eid, ...row('heat', { hvac_action: 'heating' }) } } }; host._hassSequence++;
  const next = captureRenderDeviceSnapshot(host, reuse), full = captureRenderDeviceSnapshot(host);
  assert.equal(next.presentations.get(key).visual.status, 'working');
  assert.equal(next.presentations.get(presentationSnapshotKey('perf-device-1', true)), other);
  assert.deepEqual([...next.presentations], [...full.presentations]);
  assert.equal(first.hass.states[eid].attributes.hvac_action, 'idle');
  host.hass = { ...host.hass, entities: { ...host.hass.entities, [eid]: { ...host.hass.entities[eid], device_id: 'other' } } }; host._hassSequence++;
  const foreign = captureRenderDeviceSnapshot(host, reuse);
  assert.equal(foreign.presentations.get(key).stateSource.failure, 'foreign');
  assert.equal(foreign.presentations.get(key).visual.status, 'neutral');
});
