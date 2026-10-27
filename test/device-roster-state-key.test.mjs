import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceRosterStateKey } from '../test-build/device-roster-state-key.js';
test('roster metadata keeps numeric ticks and detects read fields and missing YAML entities', () => {
  const key = new DeviceRosterStateKey();
  const before = { states: { 'sensor.a': {state:'20',attributes:{friendly_name:'A',device_class:'temperature',brightness:1}} } };
  const build = h => [h.states['sensor.a'].attributes.friendly_name, h.states['sensor.a'].attributes.device_class, !!h.states['sensor.yaml']];
  assert.deepEqual(key.capture(before,build),build(before));
  const tick = structuredClone(before); tick.states['sensor.a'].state='21'; tick.states['sensor.a'].attributes.brightness=2;
  assert.equal(key.matches(tick),true);
  tick.states['sensor.a'].attributes.device_class='humidity'; assert.equal(key.matches(tick),false);
  key.capture(tick,build); tick.states['sensor.yaml']={state:'1',attributes:{}}; assert.equal(key.matches(tick),false);
  key.capture(tick,build); delete tick.states['sensor.a']; assert.equal(key.matches(tick),false);
  key.clear(); assert.equal(key.matches(before),false);
});
test('missing attributes and property existence remain real metadata dependencies', () => {
  const key = new DeviceRosterStateKey(), h = { states: { a: {state:'0'} } };
  key.capture(h, h => h.states.a.attributes?.friendly_name);
  h.states.a.attributes = {friendly_name:'A'};
  assert.equal(key.matches(h), false);
  key.capture(h, h => 'device_class' in h.states.a.attributes);
  h.states.a.attributes.device_class = undefined;
  assert.equal(key.matches(h), false);
});
