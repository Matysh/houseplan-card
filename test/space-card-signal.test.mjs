import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { getConfig } from '../test-build/config-store.js';

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
globalThis.window = { customCards: [], setTimeout, clearTimeout };
globalThis.location = { origin: 'http://static-card.test' };
after(() => {
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
  else delete globalThis.window;
  if (previousLocation) Object.defineProperty(globalThis, 'location', previousLocation);
  else delete globalThis.location;
});
const { HouseplanSpaceCard } = await import('../test-build/space-card.js');

test('#867 AC7 real static-card captures reuse the full-registry signal index', async () => {
  const primary = 'sensor.signal_primary', sibling = 'sensor.signal_linkquality';
  const entities = {
    [primary]: { device_id: 'radio', area_id: 'room' },
    [sibling]: { device_id: 'radio', entity_category: 'diagnostic' },
  };
  for (let i = 0; i < 32; i++) entities[`sensor.foreign_${i}`] = { device_id: `foreign-${i}` };
  const config = { spaces: [{ id: 'floor', name: 'Floor', vb: [0, 0, 1000, 1000],
    rooms: [{ id: 'room', area: 'room', poly: [[0, 0], [100, 0], [100, 100], [0, 100]] }] }],
    markers: [{ id: 'entity-marker', binding: `entity:${primary}`, area: 'room', space: 'floor' }],
    settings: { filter_seeded: true, show_device_battery: false } };
  const h = { entities, devices: { radio: { area_id: 'room', name: 'Radio' } },
    states: {}, areas: { room: { name: 'Room' } }, config: {}, locale: { language: 'en' },
    callWS: async message => {
      if (message.type === 'houseplan/config/get') return { config, rev: 1 };
      if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
      throw new Error(`Unexpected transport ${message.type}`);
    } };
  await getConfig(h, true); // Public wire/cache path, not an injected private snapshot.
  const card = new HouseplanSpaceCard();
  Object.defineProperty(card, 'ownerDocument', { value: { defaultView: window } });
  card.setConfig({ type: 'custom:houseplan-space-card', space: 'floor', live_states: true });
  const entries = Object.entries, freshActiveScans = new Map();
  let fullIndexScans = 0;
  Object.entries = function (value) {
    const stack = new Error().stack || '';
    if (stack.includes('createDeviceSignalContext')) fullIndexScans++;
    if (value !== entities && value?.[primary] === entities[primary]
        && value?.['sensor.foreign_0'] === entities['sensor.foreign_0']
        && stack.includes('_captureRenderDeviceSnapshot')) {
      freshActiveScans.set(value, (freshActiveScans.get(value) || 0) + 1);
    }
    return entries(value);
  };
  try {
    for (const reading of [137, 0, 55, 77]) {
      card.hass = { ...h, states: {
        [primary]: { state: '20', attributes: { device_class: 'temperature' } },
        [sibling]: { state: String(reading), attributes: { unit_of_measurement: 'lqi' } },
      } };
      // The real class owns its fields. Invoke its normal pre-render callback;
      // no copied capture function or private-state assignment substitutes it.
      card.willUpdate(new Map([['hass', undefined]]));
      const snapshot = card._visibleDeviceSnapshot;
      assert.ok(snapshot, 'the actual static consumer captured a frame');
      assert.equal(snapshot.presentations.get('entity-marker:1').lqiText, String(reading));
      assert.ok(snapshot.entityIds.includes(sibling));
      assert.equal(snapshot.presentations.get('entity-marker:1').battery, null);
    }
  } finally {
    Object.entries = entries;
    card.disconnectedCallback();
  }
  assert.equal(fullIndexScans, 1, 'state frames do not rebuild a diagnostic registry index');
  assert.equal(freshActiveScans.size, 4, 'each real capture has its own active projection');
  assert.deepEqual([...freshActiveScans.values()], [1, 1, 1, 1],
    'only the existing snapshot projection scans each active roster, not another signal index');
});
