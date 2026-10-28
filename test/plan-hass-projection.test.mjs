import { projectionFixture } from './plan-hass-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { intakeHass } from '../test-build/houseplan-render-lifecycle.js';
import { virtualLightSnapshot } from '../test-build/virtual-light-state.js';
import { PlanHassProjection } from '../test-build/plan-hass-projection.js';
import { activeRegistryHass } from '../test-build/ha-binding-status.js';
import { lightWork } from '../test-build/devices.js';

globalThis.window ??= { customCards: [] };
const { HouseplanCard } = await import('../test-build/houseplan-card.js');


const fixture = () => projectionFixture({ HouseplanCard, virtualLightSnapshot });
test('#1111 actual intake/projection processes only changed states; no-change tick processes none', () => {
  const f = fixture();
  f.reset();
  const states = { ...f.host.hass.states };
  for (let i = 0; i < 5; i++) states[`sensor.tick_${i}`] = { ...states[`sensor.tick_${i}`], state: '1' };
  f.host.hass = { ...f.host.hass, states };
  intakeHass(f.host);
  const active = f.host._planHass;
  assert.ok(f.count() <= 5, `processed ${f.count()} registry state decisions for five changes`);
  assert.equal(active.states['sensor.tick_0'], states['sensor.tick_0']);
  f.reset(); f.host.hass = { ...f.host.hass };
  intakeHass(f.host); void f.host._planHass;
  assert.equal(f.count(), 0, 'unchanged states need no registry decisions');
});

test('#1111 no visible ripple demand never requests the active light projection', () => {
  const f = fixture(); f.reset();
  const before = [...lightWork];
  HouseplanCard.prototype._syncActivityRuntime.call(f.host);
  assert.equal(f.reads(), 0, 'no light-source calculation without a visible ripple consumer');
  assert.deepEqual(lightWork, before);
});

test('#1111 incremental corpus equals the full projection, preserves old frames and unknown state values', () => {
  const snapshot = { revision: 1, authoritative: true, access: 'full', lastSuccess: 1,
    devices: { enabled: { disabled_by: null }, disabled: { disabled_by: 'user' } },
    entities: { 'light.enabled': { device_id: 'enabled' },
      'light.disabled': { disabled_by: 'user' }, 'light.parent': { device_id: 'disabled' },
      'light.missing': { device_id: 'absent' } } };
  const projector = new PlanHassProjection();
  let hass = { connection: {}, user: {}, states: Object.fromEntries(
    ['light.enabled', 'light.disabled', 'light.parent', 'light.missing', 'sun.sun', 'sensor.yaml']
      .map(id => [id, { state: 'off' }])) };
  let previous;
  for (const change of [
    states => ({ ...states, 'light.enabled': { state: 'on' } }),
    states => ({ ...states, 'sensor.new': { state: '3' }, 'sensor.undefined': undefined }),
    states => Object.fromEntries(Object.entries(states).filter(([id]) => id !== 'sensor.yaml')),
    states => ({ ...states, 'light.disabled': { state: 'on' }, 'light.parent': { state: 'on' } }),
    states => ({ ...states, 'sun.sun': { state: 'below_horizon' } }),
  ]) {
    const old = previous && { ...previous.states };
    hass = { ...hass, states: change(hass.states) };
    const next = projector.project(hass, snapshot);
    assert.deepEqual(next.states, activeRegistryHass(hass, snapshot).states);
    for (const id of Object.keys(next.states)) assert.equal(next.states[id], hass.states[id]);
    if (previous) assert.deepEqual(previous.states, old, 'the preceding frame remains immutable');
    previous = next;
  }
  snapshot.authoritative = false;
  const limited = projector.project(hass, snapshot);
  assert.equal(limited.states['light.missing'], hass.states['light.missing']);
  assert.deepEqual(limited.states, activeRegistryHass(hass, snapshot).states);
});

test('#1111 a pre-hass/empty frame has the same projection as the full builder', () => {
  const snapshot = { revision: 0, authoritative: false, access: 'pending',
    devices: {}, entities: {}, lastSuccess: 0 };
  const projector = new PlanHassProjection();
  assert.deepEqual(projector.project(undefined, snapshot), activeRegistryHass(undefined, snapshot));
  assert.deepEqual(projector.project({ states: {} }, snapshot), activeRegistryHass({ states: {} }, snapshot));
});

test('#1111 registry, connection, user and visibility boundaries each rebuild once', () => {
  const f = fixture(), host = f.host;
  const projector = host._planHassProjection;
  const count = () => projector.counters.fullBuilds;
  let n = count();
  for (const update of [
    () => { host._haRegistry = { ...host._haRegistry, revision: 2 }; },
    () => { host.hass = { ...host.hass, connection: {} }; },
    () => { host.hass = { ...host.hass, user: {} }; },
    () => { host.ownerDocument.visibilityState = 'hidden'; intakeHass(host);
      host.ownerDocument.visibilityState = 'visible'; },
    () => { host._routeDepartureHandled = true; intakeHass(host); host._routeDepartureHandled = false; },
  ]) {
    update(); intakeHass(host); void host._planHass;
    assert.equal(count(), ++n);
    for (let i = 0; i < 3; i++) {
      host.hass = { ...host.hass }; intakeHass(host); void host._planHass;
    }
    assert.equal(count(), n, 'three following frames do not rebuild');
  }
});

test('#1111 current-floor visible ripple alone creates demand; leaving it retires history', () => {
  const f = fixture(), host = f.host;
  host._activitySnapshot = () => ({ samples: [], sourceKey: 'empty' });
  const ripple = { id: 'ripple', space: 'f2', entities: [], marker: { display: 'icon_ripple' } };
  host._displayDevices = [ripple];
  f.reset(); HouseplanCard.prototype._syncActivityRuntime.call(host);
  assert.equal(f.reads(), 0);
  ripple.space = 'f1'; ripple.hidden = true;
  f.reset(); HouseplanCard.prototype._syncActivityRuntime.call(host);
  assert.equal(f.reads(), 0);
  ripple.hidden = false;
  f.reset(); HouseplanCard.prototype._syncActivityRuntime.call(host);
  assert.equal(f.reads(), 1);
  assert.ok(host._activityRt.has('ripple'));
  const before = [...lightWork];
  HouseplanCard.prototype._syncActivityRuntime.call(host);
  assert.deepEqual(lightWork, before, 'unchanged source inputs reuse the existing light cache');
  ripple.space = 'f2';
  f.reset(); HouseplanCard.prototype._syncActivityRuntime.call(host);
  assert.equal(f.reads(), 0);
  assert.equal(host._activityRt.has('ripple'), false);
});
