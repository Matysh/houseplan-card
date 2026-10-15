import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleIconMarkers, positionableIconMarkers } from '../test-build/device-icon-roster.js';
import { spacingMarkers } from '../test-build/device-spacing.js';

test('#893 references are painted, positionable icons, not hidden/service/LED/tombstone entries', () => {
  const devices = [
    { id: 'moving', space: 'f' }, { id: 'plain', space: 'f' },
    { id: 'virtual', space: 'f', virtual: true },
    { id: 'unavailable', space: 'f', bindingStatus: { kind: 'unavailable' } },
    { id: 'hidden', space: 'f', hidden: true },
    { id: 'disabled', space: 'f', hidden: true, bindingStatus: { kind: 'ha_disabled' } },
    { id: 'disabled-visible-service', space: 'f', bindingStatus: { kind: 'ha_disabled' } },
    { id: 'removed', space: 'f', marker: { removed: true } },
    { id: 'led', space: 'f' }, { id: 'upstairs', space: 'u' },
  ];
  const leds = new Set(['led']);
  const ids = rows => rows.map(d => d.id);
  assert.deepEqual(ids(visibleIconMarkers(devices, 'f', leds)),
    ['moving', 'plain', 'virtual', 'unavailable', 'disabled-visible-service']);
  assert.deepEqual(ids(visibleIconMarkers(devices, 'f', leds, true)),
    ['moving', 'plain', 'virtual', 'unavailable', 'hidden', 'disabled', 'disabled-visible-service']);
  const expected = ['plain', 'virtual', 'unavailable'];
  assert.deepEqual(ids(positionableIconMarkers(devices, 'f', leds, 'moving')), expected);
  const spacingIds = [];
  spacingMarkers(devices, devices[0], leds, d => { spacingIds.push(d.id); return { x: 0, y: 0 }; });
  assert.deepEqual(spacingIds, expected, 'ordinary alignment and equal-spacing share eligibility');
  leds.clear();
  assert.deepEqual(ids(positionableIconMarkers(devices, 'f', leds, 'moving')), [...expected, 'led'],
    'switching back from LED to icon restores the anchor without saved-coordinate changes');
  assert.equal(devices[4].hidden, true, 'projection never mutates persisted visibility');
});
