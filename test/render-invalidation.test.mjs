import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyHassRenderChange } from '../test-build/render-invalidation.js';

const entity = (id, state = 'off') => ({ entity_id: id, state, attributes: {} });

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
    language: 'en',
    states: { 'light.plan': entity('light.plan'), 'sensor.other': entity('sensor.other') },
  };
};

const deps = { entityIds: new Set(['light.plan']) };

test('an unrelated HA state row does not invalidate the plan frame', () => {
  const before = base();
  const after = {
    ...before,
    states: { ...before.states, 'sensor.other': entity('sensor.other', 'on') },
  };
  assert.equal(classifyHassRenderChange(before, after, deps), 'none');
});

test('a dependency row identity or presence change invalidates state', () => {
  const before = base();
  const changed = {
    ...before,
    states: { ...before.states, 'light.plan': entity('light.plan', 'on') },
  };
  assert.equal(classifyHassRenderChange(before, changed, deps), 'state');

  const missing = { ...before, states: { 'sensor.other': before.states['sensor.other'] } };
  assert.equal(classifyHassRenderChange(before, missing, deps), 'state');
});

test('structural HA changes fail open while same-object assignment is free', () => {
  const before = base();
  assert.equal(classifyHassRenderChange(before, before, deps), 'none');
  assert.equal(classifyHassRenderChange(before, { ...before, themes: {} }, deps), 'structural');
  assert.equal(classifyHassRenderChange(before, { ...before, entities: {} }, deps), 'structural');
  assert.equal(classifyHassRenderChange(before, { ...before, locale: { ...before.locale, language: 'ru' } }, deps), 'structural');
  assert.equal(classifyHassRenderChange(before, { ...before, future_capability: {} }, deps), 'structural');
});

test('missing dependency authority fails open', () => {
  const before = base();
  assert.equal(classifyHassRenderChange(before, { ...before, states: { ...before.states } }, null), 'structural');
  assert.equal(classifyHassRenderChange(null, before, deps), 'structural');
});
