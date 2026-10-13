// #878: a light group without a manual icon is `mdi:lightbulb-group` on the
// auto plan, in the marker-dialog preview, after Save and in the "Auto" field
// of a freshly chosen binding. Icon rules do not apply to a group; a manual
// icon still wins; every other entity keeps rules → device_class → chip.
import test from 'node:test';
import assert from 'node:assert/strict';
// Namespace import: on a build without the #878 helper the AC1/AC2 witnesses
// still run and fail on their assertions instead of a missing named export.
import * as devices from '../test-build/devices.js';
import { compileIconRules, DEFAULT_ICON_RULES } from '../test-build/rules.js';

const { buildDevices, deviceFromMarkerDraft } = devices;
const GROUP_ICON = 'mdi:lightbulb-group';
const loc = (key) => ({
  'device.unnamed': 'unnamed', 'device.light_group': 'light group',
  'device.fallback': 'device', 'device.virtual': 'virtual device',
}[key]);
const device = (id, name, model, area, extra = {}) => ({
  id, name, model, area_id: area, identifiers: [['demo', id]], entry_type: null,
  via_device_id: null, disabled_by: null, ...extra,
});
const state = (entity_id, value, attributes = {}) => ({ entity_id, state: value, attributes });

/** The owner's case (#878): a Zigbee2MQTT group, plus an HA `group` light. */
function fixture() {
  return {
    devices: {
      elina: device('elina', 'Свет у Элины', 'Group', 'living', { manufacturer: 'Zigbee2MQTT' }),
      desk: device('desk', 'Desk', 'Smart bulb', 'kitchen'),
      relay: device('relay', 'Relay', 'Relay 1ch', 'kitchen'),
      door: device('door', 'Front', 'Lock S2', 'kitchen'),
      bulbs: device('bulbs', 'Strip', 'LED controller', 'kitchen'),
    },
    entities: {
      'light.svet_u_eliny': { entity_id: 'light.svet_u_eliny', device_id: 'elina', platform: 'mqtt', disabled_by: null },
      'light.kitchen_group': { entity_id: 'light.kitchen_group', platform: 'group', area_id: 'kitchen', disabled_by: null },
      'light.desk': { entity_id: 'light.desk', device_id: 'desk', platform: 'demo', disabled_by: null },
      'light.porch': { entity_id: 'light.porch', device_id: 'desk', platform: 'demo', disabled_by: null },
      // `group_entities` alone is not the group definition (lightGroups is).
      'light.strip_segments': { entity_id: 'light.strip_segments', device_id: 'bulbs', platform: 'mqtt', disabled_by: null },
      'switch.kettle': { entity_id: 'switch.kettle', device_id: 'relay', platform: 'demo', disabled_by: null },
      'switch.relay_group': { entity_id: 'switch.relay_group', platform: 'group', area_id: 'kitchen', disabled_by: null },
      'binary_sensor.front_door': { entity_id: 'binary_sensor.front_door', device_id: 'door', platform: 'demo', disabled_by: null },
      'lock.front': { entity_id: 'lock.front', device_id: 'door', platform: 'demo', disabled_by: null },
    },
    states: {
      'light.svet_u_eliny': state('light.svet_u_eliny', 'off', {
        friendly_name: 'Свет у Элины', group_entities: ['light.elina_1', 'light.elina_2'],
      }),
      'light.kitchen_group': state('light.kitchen_group', 'on', {
        friendly_name: 'Kitchen lamps', entity_id: ['light.k1', 'light.k2'],
      }),
      'light.desk': state('light.desk', 'on', { friendly_name: 'Desk lamp' }),
      'light.porch': state('light.porch', 'off', { friendly_name: 'Porch' }),
      'light.strip_segments': state('light.strip_segments', 'off', {
        friendly_name: 'Strip segments', group_entities: ['light.s1'],
      }),
      'switch.kettle': state('switch.kettle', 'off', { friendly_name: 'Kettle' }),
      'switch.relay_group': state('switch.relay_group', 'off', { friendly_name: 'Relays' }),
      'binary_sensor.front_door': state('binary_sensor.front_door', 'off', {
        friendly_name: 'Front', device_class: 'door',
      }),
      'lock.front': state('lock.front', 'locked', { friendly_name: 'Front' }),
    },
    areas: {},
  };
}

const ctx = (hass, over = {}) => ({
  hass, areaToSpace: { living: 'f1', kitchen: 'f1' }, markers: [], settings: {},
  excluded: new Set(['hacs']), showAll: false, firstSpaceId: 'f1', loc, ...over,
});

/** The draft `_markerDraft` builds for an untouched auto device (icon: null). */
const draftFor = (eid, name, extra = {}) => ({
  id: 'lg_' + eid, binding: 'entity:' + eid, name, icon: null, display: null,
  ripple_color: null, ripple_size: null, size: null, angle: null, controls: null,
  model: null, link: null, description: null, pdfs: [], hidden: false, vacuum: null, ...extra,
});

const iconOf = (list, id) => list.find((item) => item.id === id)?.icon;

test('#878 AC1 draft preview of an auto light group shows the plan icon (Z2M Group and HA group)', () => {
  const hass = fixture();
  const plan = buildDevices(ctx(hass));
  for (const [eid, name] of [['light.svet_u_eliny', 'Свет у Элины'], ['light.kitchen_group', 'Kitchen lamps']]) {
    const planIcon = iconOf(plan, 'lg_' + eid);
    assert.equal(planIcon, GROUP_ICON, `${eid}: auto plan icon`);
    const draft = deviceFromMarkerDraft({ ...ctx(hass), marker: draftFor(eid, name), siblingMarkers: [] });
    assert.ok(draft, `${eid}: draft is built`);
    assert.equal(draft.icon, planIcon, `${eid}: preview icon = plan icon`);
  }
});

test('#878 AC1 the draft keeps the group icon with user icon rules and group_lights off', () => {
  const hass = fixture();
  const iconRules = compileIconRules([{ pattern: 'элин|kitchen', icon: 'mdi:star' }, ...DEFAULT_ICON_RULES]);
  for (const settings of [{}, { group_lights: false }]) {
    for (const [eid, name] of [['light.svet_u_eliny', 'Свет у Элины'], ['light.kitchen_group', 'Kitchen lamps']]) {
      const draft = deviceFromMarkerDraft({
        ...ctx(hass, { settings, iconRules }), marker: draftFor(eid, name), siblingMarkers: [],
      });
      assert.equal(draft?.icon, GROUP_ICON, `${eid} ${JSON.stringify(settings)}`);
    }
  }
});

test('#878 AC2 a saved group marker without a manual icon stays the group icon, even when a rule matches', () => {
  const hass = fixture();
  // A group whose name a rule matches: the default "lamp" rule (Kitchen lamps)
  // and a user rule for "Элин". Without the fix they give mdi:lightbulb / star;
  // without any match the saved marker fell to mdi:chip.
  const iconRules = compileIconRules([{ pattern: 'элин', icon: 'mdi:star' }, ...DEFAULT_ICON_RULES]);
  const markers = [
    { id: 'lg_light.svet_u_eliny', binding: 'entity:light.svet_u_eliny', icon: null },
    { id: 'lg_light.kitchen_group', binding: 'entity:light.kitchen_group', icon: null },
  ];
  for (const rules of [undefined, iconRules]) {
    for (const settings of [{}, { group_lights: false }]) {
      const saved = buildDevices(ctx(hass, { markers, settings, iconRules: rules }));
      assert.equal(iconOf(saved, 'lg_light.svet_u_eliny'), GROUP_ICON, `Z2M group ${rules ? 'with' : 'without'} rules`);
      assert.equal(iconOf(saved, 'lg_light.kitchen_group'), GROUP_ICON, `HA group ${rules ? 'with' : 'without'} rules`);
    }
  }
  // Placement does not matter either: an area-less group is placed by its
  // marker alone and still keeps the group icon.
  const areaLess = fixture();
  delete areaLess.entities['light.kitchen_group'].area_id;
  const placed = buildDevices(ctx(areaLess, { markers }));
  assert.equal(iconOf(placed, 'lg_light.kitchen_group'), GROUP_ICON, 'area-less HA group');
});

test('#878 AC2 a manual icon on a group marker stays manual', () => {
  const hass = fixture();
  const markers = [
    { id: 'lg_light.svet_u_eliny', binding: 'entity:light.svet_u_eliny', icon: 'mdi:ceiling-light' },
    { id: 'lg_light.kitchen_group', binding: 'entity:light.kitchen_group', icon: 'mdi:led-strip' },
  ];
  const saved = buildDevices(ctx(hass, { markers }));
  assert.equal(iconOf(saved, 'lg_light.svet_u_eliny'), 'mdi:ceiling-light');
  assert.equal(iconOf(saved, 'lg_light.kitchen_group'), 'mdi:led-strip');
  const draft = deviceFromMarkerDraft({
    ...ctx(hass), marker: draftFor('light.svet_u_eliny', 'Свет у Элины', { icon: 'mdi:ceiling-light' }),
    siblingMarkers: [],
  });
  assert.equal(draft?.icon, 'mdi:ceiling-light', 'preview of a manual icon');
});

test('#878 AC2 entities that are not light groups keep rules → device_class → chip', () => {
  const hass = fixture();
  const markers = [
    'light.desk', 'light.porch', 'light.strip_segments', 'switch.kettle', 'switch.relay_group',
    'binary_sensor.front_door', 'lock.front',
  ].map((eid) => ({ id: 'lg_' + eid, binding: 'entity:' + eid, icon: null }));
  const saved = buildDevices(ctx(hass, { markers, settings: { group_lights: false } }));
  assert.deepEqual(Object.fromEntries(markers.map((m) => [m.id, iconOf(saved, m.id)])), {
    'lg_light.desk': 'mdi:lightbulb',          // rule "lamp"
    'lg_light.porch': 'mdi:chip',              // no rule, no device_class
    'lg_light.strip_segments': 'mdi:chip',     // group_entities without a Group model
    'lg_switch.kettle': 'mdi:kettle',          // rule "kettle"
    'lg_switch.relay_group': 'mdi:chip',       // a group, but not a light
    'lg_binary_sensor.front_door': 'mdi:door', // device_class
    'lg_lock.front': 'mdi:lock',               // lock domain
  });
});

test('#878 AC3 the auto icon of a freshly chosen binding: light group → group icon, others unchanged', () => {
  const { autoIconForBinding } = devices;
  assert.equal(typeof autoIconForBinding, 'function', 'devices.autoIconForBinding is exported');
  const hass = fixture();
  const iconRules = compileIconRules([{ pattern: 'элин', icon: 'mdi:star' }, ...DEFAULT_ICON_RULES]);
  const active = (ids) => () => ({ kind: 'active', enabledEntityIds: ids, allEntityIds: ids });
  const disabled = (ids) => () => ({ kind: 'ha_disabled', reason: 'entity', enabledEntityIds: [], allEntityIds: ids });
  const auto = (binding, status = active([]), rules) => autoIconForBinding(hass, binding, status, rules);

  // the light groups: the plan's icon, regardless of rules
  const plan = buildDevices(ctx(hass));
  for (const eid of ['light.svet_u_eliny', 'light.kitchen_group']) {
    assert.equal(auto('entity:' + eid, active([eid])), GROUP_ICON, eid);
    assert.equal(auto('entity:' + eid, active([eid]), iconRules), GROUP_ICON, `${eid} with a matching rule`);
    assert.equal(auto('entity:' + eid, disabled([eid])), GROUP_ICON, `${eid} HA-disabled`);
    assert.equal(auto('entity:' + eid, active([eid])), iconOf(plan, 'lg_' + eid), `${eid} = plan`);
  }
  // everything else: the previous chain
  assert.equal(auto('entity:light.desk'), 'mdi:lightbulb');
  assert.equal(auto('entity:light.porch'), 'mdi:chip');
  assert.equal(auto('entity:light.strip_segments'), 'mdi:chip');
  assert.equal(auto('entity:switch.kettle'), 'mdi:kettle');
  assert.equal(auto('entity:switch.relay_group'), 'mdi:chip');
  assert.equal(auto('entity:binary_sensor.front_door'), 'mdi:door');
  assert.equal(auto('entity:lock.front'), 'mdi:lock');
  assert.equal(auto('device:elina', active(['light.svet_u_eliny']), iconRules), 'mdi:star', 'device binding keeps rules');
  assert.equal(auto('device:elina', active(['light.svet_u_eliny'])), 'mdi:chip', 'device binding keeps the chain');
  assert.equal(auto('device:desk', active(['light.desk', 'light.porch'])), 'mdi:lightbulb', 'device rule by model');
  assert.equal(auto('device:door', active(['binary_sensor.front_door', 'lock.front'])), 'mdi:lock');
  assert.equal(auto('device:door', disabled(['lock.front'])), 'mdi:lock', 'disabled device uses all entities');
  assert.equal(auto('device:missing'), 'mdi:help-circle');
  assert.equal(auto('virtual'), 'mdi:map-marker');
  assert.equal(auto('entity:'), '');
  assert.equal(auto('unknown:x'), '');
});

test('#878 the light-group definition is the one lightGroups places', () => {
  const { isLightGroupEntity } = devices;
  assert.equal(typeof isLightGroupEntity, 'function', 'devices.isLightGroupEntity is exported');
  const hass = fixture();
  const placed = new Set(devices.lightGroups(hass, true).map((group) => group.eid));
  for (const eid of Object.keys(hass.entities)) {
    assert.equal(isLightGroupEntity(hass, eid), placed.has(eid), eid);
  }
  // Placement filters are not part of the definition.
  const hidden = fixture();
  hidden.entities['light.kitchen_group'].hidden = true;
  hidden.devices.elina.area_id = null;
  assert.equal(isLightGroupEntity(hidden, 'light.kitchen_group'), true, 'hidden group');
  assert.equal(isLightGroupEntity(hidden, 'light.svet_u_eliny'), true, 'area-less Z2M group');
  assert.equal(isLightGroupEntity(hidden, 'light.unknown'), false, 'no registry row');
});
