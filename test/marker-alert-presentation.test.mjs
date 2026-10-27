import test from 'node:test';
import assert from 'node:assert/strict';
import { thresholdIssues } from '../test-build/marker-alert-presentation.js';
import { resolveDevicePresentation } from '../test-build/device-presentation.js';
import { makeDeviceIssuesFixture, maintenanceSource } from '../demo/fixtures/device-issues.mjs';
import { captureHost, oracleFixture } from './render-snapshot-fixture.mjs';
import { captureRenderDeviceSnapshot } from '../test-build/render-snapshot-capture.js';
import { RenderSnapshotReuseWindow } from '../test-build/render-snapshot-reuse.js';
import { presentationSnapshotKey } from '../test-build/render-device-snapshot.js';
const observation = (id, level = 'attention') => ({ key: `marker/${id}`, identity: 'owner',
  rule: { id, type: 'threshold', level, entity_id: maintenanceSource, operator: 'eq', value: 'on' },
  value: 'on', comparable: true, name: 'Own source', unit: '' });
const options = { liveStates: true, showTemperature: false, showSignal: false };

test('#1000 threshold/native identities and levels preserve all causes of one entity', () => {
  const fixture = makeDeviceIssuesFixture();
  const custom = thresholdIssues([observation('a'), observation('b')], 'ru');
  const project = more => resolveDevicePresentation(fixture, fixture.device, { ...options, alertIssues: custom, ...more });
  const attention = project();
  assert.equal(attention.visual.status, 'neutral'); assert.equal(attention.pulse.kind, 'none');
  assert.equal(attention.maintenance, true); assert.equal(attention.attention, 'Внимание');
  assert.equal(attention.issues.length, 3); assert.equal(new Set(attention.issues.map(issue => issue.cause.id)).size, 3);
  assert.deepEqual(attention.issues.map(issue => issue.cause.type), ['native', 'threshold', 'threshold']);
  const alarm = project({ alertIssues: [...custom, ...thresholdIssues([observation('c', 'alarm')], 'ru')] });
  assert.equal(alarm.visual.status, 'alarm'); assert.equal(alarm.pulse.kind, 'alarm');
  assert.equal(alarm.attention, undefined); assert.equal(alarm.maintenance, false); assert.equal(alarm.issues.length, 4);
  fixture.states['binary_sensor.appliance_aquastop_occurred'] = { ...fixture.states['binary_sensor.appliance_aquastop_occurred'], state: 'on' };
  const nativeAlarm = project({ alertIssues: [] });
  assert.equal(nativeAlarm.visual.status, 'alarm'); assert.equal(nativeAlarm.pulse.kind, 'alarm');
});

test('#1000 custom facts respect static/live/hidden/lifecycle policy and unknown value is honest', () => {
  const fixture = makeDeviceIssuesFixture(), row = observation('a'); row.comparable = false; row.value = null;
  const custom = thresholdIssues([row], 'en');
  assert.equal(custom[0].state, ''); assert.equal(custom[0].stateText, 'Current value unavailable');
  assert.equal(thresholdIssues([{ ...observation('literal'), value: 'unavailable', unit: 'ppm',
    rule: { ...observation('literal').rule, value: 'unavailable' } }], 'en')[0].stateText, 'unavailable', 'literal HA unavailable does not fabricate a numeric measurement');
  for (const display of ['static_icon', 'value_static_icon']) {
    const result = resolveDevicePresentation(fixture, { ...fixture.device, marker: { ...fixture.device.marker, display } }, { ...options, alertIssues: custom });
    assert.equal(result.attention, undefined); assert.equal(result.issues.length, 1, 'native diagnostic is preserved');
  }
  const noLive = resolveDevicePresentation(fixture, fixture.device, { ...options, liveStates: false, alertIssues: custom });
  assert.equal(noLive.attention, undefined); assert.equal(noLive.issues.length, 1);
  for (const bindingStatus of [{ kind: 'ha_disabled' }, { kind: 'orphaned' }]) {
    const result = resolveDevicePresentation(fixture, { ...fixture.device, bindingStatus }, { ...options, alertIssues: custom });
    assert.equal(result.attention, undefined); assert.deepEqual(result.issues, []);
  }
});

test('#1000 inert external cause uses the same presentation consumer without a producer', () => {
  const fixture = makeDeviceIssuesFixture(), calls = [];
  fixture.callService = (...args) => { calls.push(['service', ...args]); };
  fixture.callWS = (...args) => { calls.push(['ws', ...args]); };
  const before = structuredClone({ states: fixture.states, device: fixture.device });
  const threshold = thresholdIssues([observation('threshold')], 'en')[0];
  /** @type {import('../src/device-issues.ts').ResolvedDeviceIssue} */
  const external = { ...threshold, cause: { type: 'external', id: 'inert-fixture', level: 'attention' },
    name: 'External fixture', explanation: 'Inert consumer input', groupTitle: 'Attention' };
  const project = externalCause => resolveDevicePresentation(fixture, fixture.device,
    { ...options, alertIssues: [threshold, externalCause] });
  const attention = project(external);
  assert.equal(attention.attention, 'Attention'); assert.equal(attention.pulse.kind, 'none');
  assert.deepEqual(attention.issues.map(issue => issue.cause.type), ['native', 'threshold', 'external']);
  assert.equal(new Set(attention.issues.map(issue => issue.cause.id)).size, 3);
  assert.equal(attention.issues.find(issue => issue.cause.type === 'external').explanation, 'Inert consumer input');
  const alarm = project({ ...external, severity: 'alarm',
    cause: { ...external.cause, level: 'alarm' }, groupTitle: 'Alarm' });
  assert.equal(alarm.visual.status, 'alarm'); assert.equal(alarm.pulse.kind, 'alarm');
  assert.equal(alarm.attention, undefined); assert.equal(alarm.issues.length, 3);
  assert.deepEqual(calls, [], 'a typed cause is inert presentation data, not an external API or HA action');
  assert.deepEqual({ states: fixture.states, device: fixture.device }, before);
});

test('#1000 confirmation timer invalidates real incremental presentation without an HA tick', () => {
  const host = captureHost(oracleFixture()), reuse = new RenderSnapshotReuseWindow();
  const id = host._devices[0].id, key = presentationSnapshotKey(id, false);
  let rows = [];
  host._alerts = { version: 0, issuesForDevice: device => device === id ? rows : [] };
  const first = captureRenderDeviceSnapshot(host, reuse), original = first.presentations.get(key);
  rows = thresholdIssues([observation('a')], 'en'); host._alerts.version++;
  const next = captureRenderDeviceSnapshot(host, reuse), full = captureRenderDeviceSnapshot(host);
  assert.notEqual(next.presentations.get(key), original);
  assert.deepEqual(next.presentations.get(key), full.presentations.get(key));
  assert.equal(next.presentations.get(key).attention, 'Attention');
  rows = []; host._alerts.version++;
  assert.equal(captureRenderDeviceSnapshot(host, reuse).presentations.get(key).attention, undefined);
  assert.equal(first.presentations.get(key).attention, undefined, 'old accepted frame remains immutable');
});
