import test from 'node:test';
import assert from 'node:assert/strict';
import { currentOpeningContext, openingInfoEligible, openingBindingsEqual, openingInfoNames } from '../test-build/opening-context.js';

test('#894: exact opening identity resolves current bindings, never the retained object', () => {
  const context = { spaceId: 'floor-a', openingId: 'door-a' };
  const before = { id: 'door-a', type: 'door', lock: 'lock.before' };
  const after = { ...before, lock: 'lock.after' };
  assert.equal(currentOpeningContext({ id: 'floor-a', openings: [before] }, context), before);
  assert.equal(currentOpeningContext({ id: 'floor-a', openings: [after] }, context), after);
  assert.equal(currentOpeningContext({ id: 'floor-a', openings: [] }, context), null);
});

test('#894: exact lock name precedes contact, and both distinct names remain available for state labels', () => {
  const opening = { id: 'door', type: 'door', lock: 'lock.a', contact: 'binary_sensor.a' };
  const states = {
    'lock.a': { attributes: { friendly_name: 'Main lock' } },
    'binary_sensor.a': { attributes: { friendly_name: 'Door sensor' } },
    'lock.similar': { attributes: { friendly_name: 'Wrong neighbouring door' } },
  };
  assert.deepEqual(openingInfoNames(opening, states, 'Ground floor'), {
    name: 'Main lock', lockName: 'Main lock', contactName: 'Door sensor', diagnostic: null,
  });
  delete states['lock.a'];
  assert.equal(openingInfoNames(opening, states, 'Ground floor').name, 'Door sensor');
  delete states['binary_sensor.a'];
  assert.deepEqual(openingInfoNames(opening, states, 'Ground floor'), {
    name: 'Ground floor', lockName: null, contactName: null, diagnostic: 'lock.a',
  });
  assert.equal(openingInfoNames({ ...opening, type: 'window' }, states, null).diagnostic, 'binary_sensor.a');
  assert.equal(openingInfoNames({ ...opening, type: 'passage' }, states, null).diagnostic, null);
});

test('#894: only applicable bindings keep the info popup eligible, and rebind retires a decision', () => {
  const door = { id: 'door', type: 'door', lock: 'lock.a' };
  assert.equal(openingInfoEligible(door), true);
  assert.equal(openingInfoEligible({ ...door, type: 'passage' }), false);
  assert.equal(openingInfoEligible({ ...door, type: 'window' }), false);
  assert.equal(openingInfoEligible({ ...door, type: 'window', contact: 'binary_sensor.a' }), true);
  assert.equal(openingInfoEligible({ id: 'door', type: 'door' }), false);
  assert.equal(openingBindingsEqual(door, { ...door }), true);
  assert.equal(openingBindingsEqual(door, { ...door, lock: 'lock.b' }), false);
  assert.equal(openingBindingsEqual(door, { ...door, type: 'gate' }), false);
});

test('#894/#846: an identical opening id in another space is not a fallback target', () => {
  const context = { spaceId: 'floor-a', openingId: 'same-id' };
  const other = { id: 'floor-b', openings: [{ id: 'same-id', type: 'door', lock: 'lock.other' }] };
  assert.equal(currentOpeningContext(other, context), null);
  assert.equal(currentOpeningContext(null, context), null);
  assert.equal(currentOpeningContext({ id: 'floor-a' }, context), null);
  assert.equal(currentOpeningContext(other, null), null);
});
