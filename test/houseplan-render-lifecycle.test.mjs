import test from 'node:test';
import assert from 'node:assert/strict';

import { RenderLifecycle } from '../test-build/houseplan-render-lifecycle.js';
import { LiveRuntime } from '../test-build/live-interaction-runtime.js';

const row = (state = 'off') => ({ entity_id: 'light.plan', state, attributes: {} });
const base = () => {
  const connection = {};
  const entities = {};
  const devices = {};
  const areas = {};
  const themes = {};
  const user = {};
  const config = {};
  const floors = {};
  const services = {};
  const panels = {};
  const locale = { language: 'en', number_format: 'language', time_format: 'language' };
  return {
    connection, entities, devices, areas, themes, user, config, floors, services, panels, locale,
    language: 'en', states: { 'light.plan': row(), 'sensor.other': { state: '0' } },
  };
};

test('HA intake runs once even when an unrelated visual update is skipped', () => {
  const lifecycle = new RenderLifecycle();
  const before = base();
  const after = { ...before, states: { ...before.states, 'sensor.other': { state: '1' } } };
  let intakes = 0;
  lifecycle.observe(before, after, { entityIds: ['light.plan'] }, () => intakes++);
  lifecycle.intake(after, () => intakes++);
  assert.equal(intakes, 1);
});

const liveHost = (lifecycle) => ({
  _renderLife: lifecycle, _pointers: new Map(), _cameraTransition: { active: false },
  _deviceDrag: null, _physicalDrag: null, _physicalRotate: null, _decorMove: null,
  _decorDraft: null, _dtDrag: null, _bdDrag: null, _opDrag: null,
  _resize: { dragging: false },
});

test('a relevant HA tick is deferred only while a continuous interaction is active', () => {
  const lifecycle = new RenderLifecycle();
  const host = liveHost(lifecycle);
  const live = new LiveRuntime(host);
  const before = base();
  const after = { ...before, states: { ...before.states, 'light.plan': row('on') } };
  host._pointers.set(1, {});
  assert.equal(live.hass(before, after, { entityIds: ['light.plan'] }, () => {}), false);
  assert.equal(live.take(), true);
  assert.equal(live.take(), false);
  host._pointers.clear();
  const final = { ...after, states: { ...after.states, 'light.plan': row('off') } };
  assert.equal(live.hass(after, final, { entityIds: ['light.plan'] }, () => {}), true);
});

test('gesture reconciliation is last-wins and a normal full update subsumes it', () => {
  const lifecycle = new RenderLifecycle();
  const host = liveHost(lifecycle);
  const live = new LiveRuntime(host);
  const before = base();
  const first = { ...before, states: { ...before.states, 'light.plan': row('on') } };
  const second = { ...first, states: { ...first.states, 'light.plan': row('unavailable') } };
  host._pointers.set(1, {});
  assert.equal(live.hass(before, first, { entityIds: ['light.plan'] }, () => {}), false);
  assert.equal(live.hass(first, second, { entityIds: ['light.plan'] }, () => {}), false);
  assert.equal(live.take(), true);
  assert.equal(live.take(), false);

  live.hass(second, first, { entityIds: ['light.plan'] }, () => {});
  live.clear();
  assert.equal(live.take(), false);
});

test('diagnostics scan is cached and invalidated by tracked state presence', () => {
  const lifecycle = new RenderLifecycle();
  const before = base();
  const markers = [{ binding: 'device:kitchen' }];
  let scans = 0;
  const resolve = () => {
    scans++;
    return { kind: 'active', enabledEntityIds: ['light.plan'], allEntityIds: ['light.plan'] };
  };
  assert.equal(lifecycle.diagnostics(before, markers, resolve).bindings.active, 1);
  assert.equal(lifecycle.diagnostics(before, markers, resolve).bindings.active, 1);
  assert.equal(scans, 1);

  const missing = { ...before, states: { 'sensor.other': before.states['sensor.other'] } };
  lifecycle.observe(before, missing, { entityIds: ['light.plan'] }, () => {});
  lifecycle.diagnostics(missing, markers, resolve);
  assert.equal(scans, 2);
});
