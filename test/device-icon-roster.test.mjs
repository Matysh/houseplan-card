import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleIconMarkers, positionableIconMarkers } from '../test-build/device-icon-roster.js';
import { spacingMarkers } from '../test-build/device-spacing.js';
import { HiddenDeviceRoster } from '../test-build/hidden-device-visibility.js';

test('#919 visible revealed icons enter contacts/spacing, while Off, disabled and LED stay out', () => {
  const rows = ['moving', 'anchor', 'led', 'disabled'].map(id => ({ id, space: 'f',
    hidden: id !== 'moving', userHidden: id !== 'moving', marker: { hidden: id !== 'moving' },
    bindingStatus: { kind: id === 'disabled' ? 'ha_disabled' : 'active' } }));
  const roster = new HiddenDeviceRoster(), leds = new Set(['led']);
  const ids = devices => positionableIconMarkers(devices, 'f', leds, 'moving').map(d => d.id);
  assert.deepEqual(ids(roster.read(rows, false)), []);
  assert.deepEqual(ids(roster.read(rows, true)), ['anchor']);
  const references = [];
  spacingMarkers(roster.read(rows, true), rows[0], leds, d => { references.push(d.id); return { x: 0, y: 0 }; });
  assert.deepEqual(references, ['anchor']);
  assert.deepEqual(ids(roster.read(rows, false)), [], 'Off leaves no invisible anchor');
  assert.equal(rows[1].hidden, true);
});

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
