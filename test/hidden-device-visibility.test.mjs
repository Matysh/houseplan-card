import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRevealUserHidden, HiddenDeviceRoster, HiddenDevicePreference, hiddenDevicePreferenceKey,
} from '../test-build/hidden-device-visibility.js';
import { resolveToggleIntent, toggleOperation } from '../test-build/device-toggle.js';

const hidden = (kind = 'active') => ({
  id: kind, hidden: true, userHidden: true, marker: { hidden: true, binding: 'device:x' },
  bindingStatus: { kind },
});
const memory = () => {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('#919 display override requires a live user-hidden marker, never disabled/removed/unknown', () => {
  assert.equal(canRevealUserHidden(hidden()), true);
  for (const kind of ['ha_disabled', 'orphaned', 'unverified']) assert.equal(canRevealUserHidden(hidden(kind)), false);
  assert.equal(canRevealUserHidden({ ...hidden(), marker: { hidden: true, removed: true } }), false);
  assert.equal(canRevealUserHidden({ hidden: true }), false);
  assert.equal(canRevealUserHidden({ hidden: true, userHidden: true }), false);
  assert.equal(canRevealUserHidden({ virtual: true, hidden: true, marker: { hidden: true, binding: 'virtual' } }), true);
});

test('#919 projected visibility preserves saved metadata, raw array and unrelated identities', () => {
  const active = hidden(), disabled = hidden('ha_disabled'), visible = { id: 'visible' };
  const rows = Object.freeze([Object.freeze(active), Object.freeze(disabled), Object.freeze(visible)]);
  const roster = new HiddenDeviceRoster();
  assert.equal(roster.read(rows, false, 1), rows);
  const shown = roster.read(rows, true, 1);
  assert.equal(shown[0].hidden, false);
  assert.equal(shown[0].userHidden, true);
  assert.equal(shown[0].marker, active.marker);
  assert.equal(active.marker.hidden, true);
  assert.equal(active.hidden, true);
  assert.equal(shown[1], disabled);
  assert.equal(shown[2], visible);
  assert.equal(roster.read(rows, true, 1), shown);
  assert.notEqual(roster.read(rows, true, 2), shown, 'accepted source epoch retires the projection');
  assert.equal(roster.read(rows, false, 2), rows);
  assert.equal(roster.read([visible], true)[0], visible);
});

test('#953 hidden linked-light actions need the display roster, not the saved-hidden source', () => {
  const lamp = { id: 'lamp', name: 'Hidden linked lamp', hidden: true, userHidden: true,
    virtual: true, bindingKind: 'virtual', entities: [], controls: [], tapAction: 'toggle',
    marker: { id: 'lamp', binding: 'virtual', hidden: true, is_light: true, tap_action: 'toggle', controls: [] } };
  const driver = { id: 'driver', name: 'Hidden relay', hidden: true, userHidden: true,
    bindingKind: 'entity', bindingRef: 'switch.relay', primary: 'switch.relay', entities: ['switch.relay'],
    bindingStatus: { kind: 'active' }, controls: [],
    marker: { id: 'driver', binding: 'entity:switch.relay', hidden: true, controls: ['marker:lamp'] } };
  const source = [driver, lamp], roster = new HiddenDeviceRoster();
  const display = roster.read(source, true);
  const selected = display.find(row => row.id === 'lamp');
  const hass = { states: { 'switch.relay': { state: 'on', attributes: {} } },
    entities: {}, devices: {}, services: { homeassistant: { turn_on: {}, turn_off: {} } } };
  const options = { hass, device: selected, virtualLights: { rev: 1, configRev: 1, off: new Set(['lamp']) } };
  assert.deepEqual(toggleOperation(resolveToggleIntent({ ...options, devices: display })),
    { kind: 'ha-service', command: { domain: 'homeassistant', service: 'turn_off', data: { entity_id: ['switch.relay'] } } });
  // A real alternative input: with the saved-hidden roster there is no visible
  // target in the incoming graph, so the existing manual fallback is expected.
  assert.deepEqual(toggleOperation(resolveToggleIntent({ ...options, devices: source })),
    { kind: 'virtual-light', markerId: 'lamp' });
  const unlinked = display.map(row => row.id === 'driver' ? { ...row, marker: { ...row.marker, controls: [] } } : row);
  assert.deepEqual(toggleOperation(resolveToggleIntent({ ...options, devices: unlinked })),
    { kind: 'virtual-light', markerId: 'lamp' });
  assert.equal(lamp.hidden, true);
  assert.equal(driver.hidden, true);
});

test('#919 saved choice survives a new owner instance and stays isolated by user/card address', () => {
  const store = memory(), a = new HiddenDevicePreference();
  assert.equal(a.sync('user-a/card-a', store), false);
  a.set(true, store);
  assert.equal(new HiddenDevicePreference().sync('user-a/card-a', store), true);
  assert.equal(new HiddenDevicePreference().sync('user-a/card-b', store), false);
  assert.equal(a.sync('user-b/card-a', store), false);
  assert.equal(a.sync(null, store), false);
  assert.equal(store.data.get('user-a/card-a'), 'true');
  store.data.set('invalid', '{"enabled":true}');
  assert.equal(a.sync('invalid', store), false);
});

test('#919 unavailable storage keeps deliberate in-memory intent but never crosses identities', () => {
  const broken = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } };
  const choice = new HiddenDevicePreference();
  assert.equal(choice.sync('mine', broken), false);
  choice.set(true, broken);
  assert.equal(choice.sync('mine', broken), true);
  assert.equal(choice.sync('another-user', broken), false);
  assert.equal(new HiddenDevicePreference().sync('mine', broken), false);
});

test('#919 preference identity requires the real HA user and distinguishes independent card placements', () => {
  const parent = { localName: 'test-root', children: [] };
  const doc = { defaultView: { location: { pathname: '/dashboard/home' } } };
  const make = id => ({ localName: 'houseplan-card', parentNode: parent, hass: { user: { id } }, panelHost: false, ownerDocument: doc });
  const a = make('a'), b = make('a'); parent.children.push(a, b);
  assert.notEqual(hiddenDevicePreferenceKey(a), hiddenDevicePreferenceKey(b));
  assert.notEqual(hiddenDevicePreferenceKey(a), hiddenDevicePreferenceKey({ ...a, hass: { user: { id: 'b' } } }));
  assert.equal(hiddenDevicePreferenceKey({ ...a, hass: { user: { name: 'Not an ID' } } }), null);
  assert.equal(hiddenDevicePreferenceKey({ ...a, ownerDocument: {} }), null);
});
