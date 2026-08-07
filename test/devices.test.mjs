import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDevices, lightGroups, primaryEntity, lqiFor, tempFor, humFor, climateTempFor,
  areaLights, areaTemp, areaHum, areaLightStats, sourceValue, areaClimate, areaClimateMap,
  litLightEntity, resolvedDeviceStateEntities, resolvedLightSources, resolvedLightState,
  resolvedLightStats, seedHiddenBindings,
  deletePlanMarkerRecords, effectiveMarkerControls, persistedExternalControls,
} from '../test-build/devices.js';
import { compileIconRules, iconFor } from '../test-build/rules.js';

/** Minimal fake hass around the pieces buildDevices reads. */
function mkHass({ devices = {}, entities = {}, states = {}, areas = {} } = {}) {
  return { devices, entities, states, areas };
}
const loc = (k) =>
  ({ 'device.unnamed': 'unnamed', 'device.light_group': 'light group',
     'device.fallback': 'device', 'device.virtual': 'virtual device' }[k]);
const baseCtx = (hass, over = {}) => ({
  hass, areaToSpace: { living: 'f1', kitchen: 'f1' }, markers: [], settings: {},
  excluded: new Set(['hacs']), showAll: false, firstSpaceId: 'f1', loc, ...over,
});
const dev = (id, name, model, area, extra = {}) =>
  ({ id, name, model, area_id: area, identifiers: [['demo', id]], entry_type: null, via_device_id: null, ...extra });

test('deletePlanMarkerRecords removes only the selected virtual marker', () => {
  const markers = [
    { id: 'v_a', binding: 'virtual', name: 'A' },
    { id: 'v_b', binding: 'virtual', name: 'B', pdfs: [{ name: 'manual', url: '/files/v_b/manual.pdf' }] },
    { id: 'plug', binding: 'device:plug' },
  ];
  const result = deletePlanMarkerRecords(markers, 'v_a', 'virtual', true);
  assert.deepEqual(result.markers, [markers[1], markers[2]]);
  assert.deepEqual([...result.cleanupIds], ['v_a']);
});

test('deletePlanMarkerRecords deduplicates HA binding and leaves old-card-safe tombstone', () => {
  const result = deletePlanMarkerRecords([
    { id: 'old', binding: 'entity:sensor.x' },
    { id: 'new', binding: 'entity:sensor.x' },
    { id: 'other', binding: 'entity:sensor.y' },
  ], 'new', 'entity:sensor.x', false);
  assert.deepEqual(result.markers, [
    { id: 'other', binding: 'entity:sensor.y' },
    { id: 'new', binding: 'entity:sensor.x', removed: true, hidden: true },
  ]);
  assert.deepEqual(new Set(result.cleanupIds), new Set(['old', 'new']));
});

test('buildDevices: devices outside bound areas are dropped', () => {
  const h = mkHass({ devices: {
    a: dev('a', 'Lamp', 'Bulb', 'living'),
    b: dev('b', 'Lamp', 'Bulb', 'garage'),      // area not bound to a room
    c: dev('c', 'Lamp', 'Bulb', null),          // no area at all
  }});
  const res = buildDevices(baseCtx(h));
  assert.deepEqual(res.map((d) => d.id), ['a']);
  assert.equal(res[0].space, 'f1');
});

test('buildDevices: curation hides excluded/service/group/scene/bridge, show_all reveals', () => {
  const h = mkHass({ devices: {
    ok: dev('ok', 'Plug', 'Smart Plug', 'living'),
    ex: dev('ex', 'HACS', 'x', 'living', { identifiers: [['hacs', '1']] }),
    sv: dev('sv', 'Service', 'x', 'living', { entry_type: 'service' }),
    gr: dev('gr', 'Group dev', 'Group', 'living'),
    sc: dev('sc', 'Scenes', 'wireless scene switch', 'living'),
    br: dev('br', 'Zigbee Bridge', 'Bridge V2', 'living'),
  }});
  assert.deepEqual(buildDevices(baseCtx(h)).map((d) => d.id), ['ok']);
  // show_all reveals everything except service entries (those are never devices on the plan)
  const all = buildDevices(baseCtx(h, { showAll: true })).map((d) => d.id);
  assert.deepEqual(all.sort(), ['br', 'ex', 'gr', 'ok', 'sc']);
});

test('buildDevices: duplicate name|area gets numbered, different areas do not', () => {
  const h = mkHass({ devices: {
    a: dev('a', 'Lamp', 'Bulb', 'living'),
    b: dev('b', 'Lamp', 'Bulb', 'living'),
    c: dev('c', 'Lamp', 'Bulb', 'kitchen'),
  }});
  const names = buildDevices(baseCtx(h)).map((d) => d.name);
  assert.deepEqual(names, ['Lamp', 'Lamp 2', 'Lamp']);
});

test('buildDevices: light groups appear, single lamps in grouped areas are suppressed', () => {
  const h = mkHass({
    devices: { lamp: dev('lamp', 'Ceiling lamp', 'Bulb E27', 'living') },
    entities: {
      'light.group_living': { entity_id: 'light.group_living', platform: 'group', area_id: 'living' },
      'light.single': { entity_id: 'light.single', device_id: 'lamp', platform: 'demo' },
    },
    states: { 'light.group_living': { state: 'on', attributes: { friendly_name: 'Living lights' } } },
  });
  const res = buildDevices(baseCtx(h));
  const ids = res.map((d) => d.id);
  assert.ok(ids.includes('lg_light.group_living'));
  assert.ok(!ids.includes('lamp'), 'single lamp must fold into the group');
  // group_lights=false: no groups, the lamp comes back
  const res2 = buildDevices(baseCtx(h, { settings: { group_lights: false } }));
  assert.deepEqual(res2.map((d) => d.id), ['lamp']);
});

test('buildDevices: claimed device is replaced by its marker (metadata applied)', () => {
  const h = mkHass({ devices: { a: dev('a', 'Boiler', 'BAXI', 'living') } });
  const markers = [{ id: 'a', binding: 'device:a', name: 'Main boiler', icon: 'mdi:water-boiler',
    link: 'https://x', tap_action: 'more-info' }];
  const res = buildDevices(baseCtx(h, { markers }));
  assert.equal(res.length, 1);
  const it = res[0];
  assert.equal(it.name, 'Main boiler');
  assert.equal(it.icon, 'mdi:water-boiler');
  assert.equal(it.link, 'https://x');
  assert.equal(it.tapAction, 'more-info');
  assert.equal(it.bindingKind, 'device');
});

test('buildDevices: hidden marker removes the device entirely', () => {
  const h = mkHass({ devices: { a: dev('a', 'Noisy', 'x', 'living') } });
  const res = buildDevices(baseCtx(h, { markers: [{ id: 'a', binding: 'device:a', hidden: true }] }));
  assert.equal(res.length, 0);
});

test('buildDevices: deleted binding is claimed but never built', () => {
  const h = mkHass({ devices: { a: dev('a', 'Deleted', 'Sensor', 'living') } });
  const markers = [{ id: 'a', binding: 'device:a', removed: true }];
  assert.deepEqual(buildDevices(baseCtx(h, { markers })).map((d) => d.id), []);
  assert.deepEqual(
    buildDevices(baseCtx(h, { markers, settings: { filter_seeded: true } })).map((d) => d.id),
    [],
  );
});

test('buildDevices: deleted controls are inactive without being destructively persisted', () => {
  const h = mkHass({
    entities: {
      'light.keep': { entity_id: 'light.keep' },
      'light.gone': { entity_id: 'light.gone' },
    },
    states: {
      'light.keep': { state: 'on', attributes: {} },
      'light.gone': { state: 'on', attributes: {} },
    },
  });
  const markers = [
    { id: 'v1', binding: 'virtual', name: 'Combined light', controls: ['light.keep', 'light.gone'] },
    { id: 'gone', binding: 'entity:light.gone', removed: true },
  ];
  const item = buildDevices(baseCtx(h, { markers })).find((d) => d.id === 'v1');
  assert.deepEqual(item.marker.controls, ['light.keep', 'light.gone']);
  assert.deepEqual(item.controls, ['light.keep']);
  assert.deepEqual(resolvedLightSources(h, [item]).map((source) => source.eid), ['light.keep']);
});

test('entity tombstone does not strip that entity from a live parent device', () => {
  const h = mkHass({
    devices: { sensorbox: dev('sensorbox', 'Climate box', 'Sensor', 'living') },
    entities: {
      'sensor.box_temp': {
        entity_id: 'sensor.box_temp', device_id: 'sensorbox',
        original_device_class: 'temperature',
      },
    },
    states: {
      'sensor.box_temp': { state: '23.5', attributes: { device_class: 'temperature' } },
    },
  });
  const markers = [{ id: 'gone_entity', binding: 'entity:sensor.box_temp', removed: true }];
  const parent = buildDevices(baseCtx(h, { markers })).find((d) => d.id === 'sensorbox');
  assert.ok(parent);
  assert.deepEqual(parent.entities, ['sensor.box_temp']);
  assert.equal(parent.primary, 'sensor.box_temp');
});

test('buildDevices: virtual marker lands in its room; entity marker resolves name from state', () => {
  const h = mkHass({
    entities: { 'sensor.avg': { entity_id: 'sensor.avg', platform: 'min_max', area_id: 'kitchen' } },
    states: { 'sensor.avg': { state: '21', attributes: { friendly_name: 'Average temp' } } },
  });
  const markers = [
    { id: 'v1', binding: 'virtual', name: 'Septic tank', icon: 'mdi:pipe', space: 'f1', area: 'living' },
    { id: 'lg_sensor.avg', binding: 'entity:sensor.avg' },
  ];
  const res = buildDevices(baseCtx(h, { markers }));
  const v = res.find((d) => d.id === 'v1');
  assert.ok(v.virtual);
  assert.equal(v.icon, 'mdi:pipe');
  const e = res.find((d) => d.id === 'lg_sensor.avg');
  assert.equal(e.name, 'Average temp');
  assert.equal(e.primary, 'sensor.avg');
  assert.equal(e.space, 'f1'); // via the entity's area
});

test('buildDevices: custom icon rules apply; lock entity still forces mdi:lock', () => {
  const h = mkHass({
    devices: {
      p: dev('p', 'Steckdose Küche', 'Plug S26', 'living'),
      l: dev('l', 'Home', 'S2', 'living'),
    },
    entities: { 'lock.front': { entity_id: 'lock.front', device_id: 'l', platform: 'demo' } },
  });
  const iconRules = compileIconRules([{ pattern: 'steckdose', icon: 'mdi:power-socket-eu' }]);
  const res = buildDevices(baseCtx(h, { iconRules }));
  assert.equal(res.find((d) => d.id === 'p').icon, 'mdi:power-socket-eu');
  assert.equal(res.find((d) => d.id === 'l').icon, 'mdi:lock');
});

test('buildDevices: device_class fallback when no rule matches', () => {
  const h = mkHass({
    devices: { t: dev('t', 'XYZZY-42', 'unknown', 'living') },
    entities: { 'sensor.x': { entity_id: 'sensor.x', device_id: 't', platform: 'demo' } },
    states: { 'sensor.x': { state: '21.5', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } } },
  });
  const it = buildDevices(baseCtx(h))[0];
  assert.equal(it.icon, 'mdi:thermometer');
  assert.equal(it.temp, 21.5);
  assert.equal(it.primary, 'sensor.x');
});

test('primaryEntity: domain priority and diagnostic-category demotion', () => {
  const h = mkHass({
    entities: {
      'sensor.batt': { entity_id: 'sensor.batt', entity_category: 'diagnostic' },
      'light.a': { entity_id: 'light.a' },
      'sensor.temp': { entity_id: 'sensor.temp' },
    },
    states: {},
  });
  assert.equal(primaryEntity(h, ['sensor.batt', 'sensor.temp', 'light.a'], 'mdi:lightbulb'), 'light.a');
  // only a diagnostic entity → still usable as a last resort
  assert.equal(primaryEntity(h, ['sensor.batt'], 'mdi:chip'), 'sensor.batt');
});

test('primaryEntity: occupancy beats an enabled vendor option switch on a presence sensor', () => {
  const hass = mkHass({
    entities: {
      'switch.presence_anti_interference': { entity_id: 'switch.presence_anti_interference' },
      'binary_sensor.presence_occupancy': { entity_id: 'binary_sensor.presence_occupancy' },
      'sensor.presence_illuminance': { entity_id: 'sensor.presence_illuminance' },
    },
    states: {
      'switch.presence_anti_interference': { state: 'on', attributes: {} },
      'binary_sensor.presence_occupancy': { state: 'off', attributes: { device_class: 'occupancy' } },
      'sensor.presence_illuminance': { state: '12', attributes: { device_class: 'illuminance' } },
    },
  });
  assert.equal(
    primaryEntity(
      hass,
      ['switch.presence_anti_interference', 'binary_sensor.presence_occupancy', 'sensor.presence_illuminance'],
      'mdi:motion-sensor',
    ),
    'binary_sensor.presence_occupancy',
  );
  assert.deepEqual(
    resolvedDeviceStateEntities(
      hass,
      ['switch.presence_anti_interference', 'binary_sensor.presence_occupancy', 'sensor.presence_illuminance'],
    ),
    ['binary_sensor.presence_occupancy'],
  );
});

test('primaryEntity: vacuum beats an unavailable unclassified Customized Cleaning switch', () => {
  const hass = mkHass({
    entities: {
      'switch.x50_master_customized_cleaning': { entity_id: 'switch.x50_master_customized_cleaning' },
      'vacuum.x50_master': { entity_id: 'vacuum.x50_master' },
      'sensor.x50_master_state': { entity_id: 'sensor.x50_master_state' },
    },
    states: {
      'switch.x50_master_customized_cleaning': { state: 'unavailable', attributes: {} },
      'vacuum.x50_master': { state: 'docked', attributes: {} },
      'sensor.x50_master_state': { state: 'docked', attributes: {} },
    },
  });
  assert.equal(
    primaryEntity(
      hass,
      ['switch.x50_master_customized_cleaning', 'vacuum.x50_master', 'sensor.x50_master_state'],
      'mdi:robot-vacuum',
    ),
    'vacuum.x50_master',
  );
  assert.deepEqual(
    resolvedDeviceStateEntities(
      hass,
      ['switch.x50_master_customized_cleaning', 'vacuum.x50_master', 'sensor.x50_master_state'],
    ),
    ['vacuum.x50_master'],
  );
});

test('primaryEntity: a real cover beats its option switch, but a mixed lamp stays a light', () => {
  const hass = mkHass({
    entities: {
      'cover.curtain': { entity_id: 'cover.curtain', hidden: true },
      'switch.curtain_reverse': { entity_id: 'switch.curtain_reverse' },
      'cover.mixed': { entity_id: 'cover.mixed' },
      'light.mixed': { entity_id: 'light.mixed' },
    },
    states: {
      'cover.curtain': { state: 'closed', attributes: { device_class: 'curtain' } },
      'switch.curtain_reverse': { state: 'on', attributes: {} },
      'cover.mixed': { state: 'opening', attributes: { device_class: 'curtain' } },
      'light.mixed': { state: 'on', attributes: {} },
    },
  });
  assert.equal(
    primaryEntity(hass, ['switch.curtain_reverse', 'cover.curtain'], 'mdi:curtains'),
    'cover.curtain',
  );
  assert.equal(
    primaryEntity(hass, ['cover.mixed', 'light.mixed'], 'mdi:lightbulb'),
    'light.mixed',
  );
});

test('media role shields a marker from auxiliary light and switch entities', () => {
  const hass = mkHass({
    entities: {
      'light.soundbar_display': { entity_id: 'light.soundbar_display' },
      'switch.soundbar_night_mode': { entity_id: 'switch.soundbar_night_mode' },
      'media_player.soundbar': { entity_id: 'media_player.soundbar' },
    },
    states: {
      'light.soundbar_display': { state: 'on', attributes: {} },
      'switch.soundbar_night_mode': { state: 'on', attributes: {} },
      'media_player.soundbar': { state: 'playing', attributes: {} },
    },
  });
  const entities = [
    'light.soundbar_display', 'switch.soundbar_night_mode', 'media_player.soundbar',
  ];
  assert.deepEqual(resolvedDeviceStateEntities(hass, entities), ['media_player.soundbar']);
  assert.equal(primaryEntity(hass, entities, 'mdi:soundbar'), 'media_player.soundbar');

  const soundbar = {
    id: 'soundbar', area: 'living', primary: 'media_player.soundbar', entities,
  };
  assert.deepEqual(resolvedLightSources(hass, [soundbar]), []);
  assert.deepEqual(
    resolvedLightSources(hass, [{ ...soundbar, marker: { is_light: true } }])
      .map((source) => source.eid),
    ['light.soundbar_display'],
  );
});

test('resolvedDeviceStateEntities: passive readings aggregate availability instead of picking the first', () => {
  const hass = mkHass({
    entities: {
      'sensor.monitor_temperature': { entity_id: 'sensor.monitor_temperature' },
      'sensor.monitor_humidity': { entity_id: 'sensor.monitor_humidity' },
    },
    states: {
      'sensor.monitor_temperature': { state: 'unavailable', attributes: { device_class: 'temperature' } },
      'sensor.monitor_humidity': { state: '45', attributes: { device_class: 'humidity' } },
    },
  });
  assert.deepEqual(
    resolvedDeviceStateEntities(hass, ['sensor.monitor_temperature', 'sensor.monitor_humidity']),
    ['sensor.monitor_temperature', 'sensor.monitor_humidity'],
  );
});

test('lqiFor: dedicated sensor wins over attribute duplication; tempFor rounds', () => {
  const h = mkHass({ states: {
    'sensor.x_linkquality': { state: '120', attributes: { unit_of_measurement: 'lqi' } },
    'sensor.temp': { state: '22.46', attributes: { device_class: 'temperature', linkquality: 118 } },
  }});
  assert.equal(lqiFor(h, ['sensor.x_linkquality', 'sensor.temp']), 119); // avg(120,118)
  assert.equal(tempFor(h, ['sensor.temp']), 22.5);
});

test('areaLights: on / off / none tri-state', () => {
  const hass = mkHass({ states: { 'light.a': { state: 'on' }, 'light.b': { state: 'off' } } });
  const devs = [
    { area: 'living', entities: ['light.a', 'sensor.x'] },
    { area: 'kitchen', entities: ['light.b'] },
    { area: 'bath', entities: ['sensor.hum'] },
  ];
  assert.equal(areaLights(hass, devs, 'living'), 'on');
  assert.equal(areaLights(hass, devs, 'kitchen'), 'off');
  assert.equal(areaLights(hass, devs, 'bath'), 'none');
});

test('areaTemp: averages only thermometer devices, null when none report', () => {
  const hass = mkHass({ states: {
    'sensor.t1': { state: '20.0', attributes: { device_class: 'temperature' } },
    'sensor.t2': { state: '23.1', attributes: { device_class: 'temperature' } },
    'sensor.hum': { state: '55', attributes: { device_class: 'humidity' } },
  }});
  const devs = [
    { area: 'living', icon: 'mdi:thermometer', entities: ['sensor.t1'] },
    { area: 'living', icon: 'mdi:thermometer', entities: ['sensor.t2'] },
    { area: 'bath', icon: 'mdi:water-percent', entities: ['sensor.hum'] },
  ];
  assert.equal(areaTemp(hass, devs, 'living'), 21.6); // (20+23.1)/2=21.55 → 21.6
  assert.equal(areaTemp(hass, devs, 'bath'), null);
  assert.equal(areaTemp(hass, devs, 'garage'), null);
});

test('areaTemp: ignores non-thermometer devices that expose a temperature (fridge, TRV, chip)', () => {
  const hass = mkHass({
    entities: { 'sensor.plug_device_temperature': { entity_id: 'sensor.plug_device_temperature', entity_category: 'diagnostic' } },
    states: {
      'sensor.room': { state: '22.0', attributes: { device_class: 'temperature' } },
      'sensor.fridge_t': { state: '4.5', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.trv_current': { state: '8.3', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.plug_device_temperature': { state: '31', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
    },
  });
  const devs = [
    { area: 'living', icon: 'mdi:thermometer', entities: ['sensor.room'] },
    { area: 'living', icon: 'mdi:fridge', entities: ['sensor.fridge_t'] },
    { area: 'living', icon: 'mdi:radiator', entities: ['sensor.trv_current'] },
    { area: 'living', icon: 'mdi:power-socket-de', entities: ['sensor.plug_device_temperature'] },
  ];
  // только настоящий термометр (22.0), холодильник/термоголовка/чип игнорируются
  assert.equal(areaTemp(hass, devs, 'living'), 22.0);
});

test('isTempEntity: excludes chip temperature and diagnostic-category entities', () => {
  const hass = mkHass({
    entities: { 'sensor.calibrated': { entity_id: 'sensor.calibrated', entity_category: 'diagnostic' } },
    states: {
      'sensor.room_temperature': { state: '21', attributes: { device_class: 'temperature' } },
      'sensor.plug_device_temperature': { state: '30', attributes: { device_class: 'temperature' } },
      'sensor.calibrated': { state: '19', attributes: { device_class: 'temperature' } },
    },
  });
  // настоящий комнатный датчик проходит
  assert.equal(tempFor(hass, ['sensor.room_temperature']), 21);
  // чип и диагностика — нет
  assert.equal(tempFor(hass, ['sensor.plug_device_temperature']), null);
  assert.equal(tempFor(hass, ['sensor.calibrated']), null);
  // если в устройстве и чип, и настоящий — берётся настоящий
  assert.equal(tempFor(hass, ['sensor.plug_device_temperature', 'sensor.room_temperature']), 21);
});

test('buildDevices: entity marker gets an auto icon + temperature (split a multi-entity device)', () => {
  const h = mkHass({
    entities: {
      'sensor.clim_temp': { entity_id: 'sensor.clim_temp', device_id: 'clim', platform: 'demo' },
      'sensor.clim_hum': { entity_id: 'sensor.clim_hum', device_id: 'clim', platform: 'demo' },
    },
    states: {
      'sensor.clim_temp': { state: '22.5', attributes: { device_class: 'temperature', friendly_name: 'Climate Temperature' } },
      'sensor.clim_hum': { state: '55', attributes: { device_class: 'humidity', friendly_name: 'Climate Humidity' } },
    },
  });
  const ctx = baseCtx(h, { markers: [
    { id: 'e1', binding: 'entity:sensor.clim_temp' },
    { id: 'e2', binding: 'entity:sensor.clim_hum' },
  ] });
  const devs = buildDevices(ctx);
  const t = devs.find((d) => d.id === 'e1');
  const hum = devs.find((d) => d.id === 'e2');
  assert.equal(t.icon, 'mdi:thermometer');
  assert.equal(t.temp, 22.5);
  // humidity resolves to a real icon (device_class fallback), not the old generic shape
  assert.ok(hum && hum.icon && hum.icon !== 'mdi:shape-outline');
  assert.equal(hum.primary, 'sensor.clim_hum'); // more-info target
});

test('humFor: reads a humidity entity as an integer %, ignores non-humidity', () => {
  const h = mkHass({ states: {
    'sensor.h': { state: '54.7', attributes: { device_class: 'humidity' } },
    'sensor.t': { state: '22', attributes: { device_class: 'temperature' } },
  }});
  assert.equal(humFor(h, ['sensor.t', 'sensor.h']), 55); // rounded
  assert.equal(humFor(h, ['sensor.t']), null);
});

test('buildDevices: humidity entity marker shows a humidity badge (item.hum), water-percent icon', () => {
  const h = mkHass({
    entities: { 'sensor.clim_hum': { entity_id: 'sensor.clim_hum', device_id: 'clim', platform: 'demo' } },
    states: { 'sensor.clim_hum': { state: '54.7', attributes: { device_class: 'humidity', friendly_name: 'Climate Humidity' } } },
  });
  const hum = buildDevices(baseCtx(h, { markers: [{ id: 'e2', binding: 'entity:sensor.clim_hum' }] })).find((d) => d.id === 'e2');
  assert.equal(hum.icon, 'mdi:water-percent');
  assert.equal(hum.hum, 55);
  assert.equal(hum.temp, undefined);
});

test('buildDevices: humidity badge is gated on device_class, not the icon (name may force another icon)', () => {
  const h = mkHass({
    entities: { 'sensor.mh_hum': { entity_id: 'sensor.mh_hum', device_id: 'mh', platform: 'demo' } },
    // name contains "myheat" → icon rule resolves to water-boiler, NOT water-percent…
    states: { 'sensor.mh_hum': { state: '45.2', attributes: { device_class: 'humidity', friendly_name: 'Myheat Влажность 1 этаж' } } },
  });
  const d = buildDevices(baseCtx(h, { markers: [{ id: 'e', binding: 'entity:sensor.mh_hum' }] })).find((x) => x.id === 'e');
  assert.notEqual(d.icon, 'mdi:water-percent'); // name rule won the icon
  assert.equal(d.hum, 45); // …but the humidity value is still shown (gated on device_class)
});

test('areaLightStats: counts unique lights that are on', () => {
  const hass = { states: {
    'light.a': { state: 'on' }, 'light.b': { state: 'off' }, 'light.c': { state: 'on' },
  } };
  const devs = [
    { area: 'living', entities: ['light.a', 'sensor.x'] },
    { area: 'living', entities: ['light.b', 'light.a'] }, // light.a duplicated on purpose
    { area: 'other', entities: ['light.c'] },
  ];
  assert.deepEqual(areaLightStats(hass, devs, 'living'), { on: 1, total: 2 });
  assert.deepEqual(areaLightStats(hass, devs, 'other'), { on: 1, total: 1 });
  assert.equal(areaLightStats(hass, devs, 'empty'), null);
});

test('areaHum: averages climate sensors only, integer %', () => {
  const hass = { states: {
    'sensor.t1_humidity': { state: '41', attributes: { device_class: 'humidity', unit_of_measurement: '%' } },
    'sensor.t2_humidity': { state: '46', attributes: { device_class: 'humidity', unit_of_measurement: '%' } },
    'sensor.fridge_humidity': { state: '90', attributes: { device_class: 'humidity', unit_of_measurement: '%' } },
  } };
  const devs = [
    { area: 'living', icon: 'mdi:thermometer', entities: ['sensor.t1_humidity'] },
    { area: 'living', icon: 'mdi:air-filter', entities: ['sensor.t2_humidity'] },
    { area: 'living', icon: 'mdi:fridge', entities: ['sensor.fridge_humidity'] }, // curated out
  ];
  assert.equal(areaHum(hass, devs, 'living'), 44);
  assert.equal(areaHum(hass, devs, 'nothing'), null);
});

test('primaryEntity: hidden light beats visible config switch (grouped lamps)', () => {
  const hass = {
    entities: {
      'light.lamp': { hidden: true },
      'switch.lamp_do_not_disturb': { entity_category: 'config' },
      'button.lamp_identify': { entity_category: 'diagnostic' },
    },
    states: {},
  };
  assert.equal(
    primaryEntity(hass, ['switch.lamp_do_not_disturb', 'light.lamp', 'button.lamp_identify'], 'mdi:lightbulb'),
    'light.lamp',
  );
  // видимая сущность того же домена всё равно приоритетнее скрытой
  const hass2 = {
    entities: { 'light.a': { hidden: true }, 'light.b': {} },
    states: {},
  };
  assert.equal(primaryEntity(hass2, ['light.a', 'light.b'], 'mdi:lightbulb'), 'light.b');
});

test('icon rules: soundbars vs smart speakers (v1.40.2)', () => {
  assert.equal(iconFor('Sony soundbar', ''), 'mdi:soundbar');
  assert.equal(iconFor('Яндекс Станция Мини', ''), 'mdi:speaker');
  assert.equal(iconFor('Колонка Алисы', ''), 'mdi:speaker');
  assert.equal(iconFor('Kitchen speaker', ''), 'mdi:speaker');
});

test('sourceValue: explicit entity and device sources (tier 3)', () => {
  const hass = {
    states: {
      'sensor.custom_temp': { state: '23.456' },
      'sensor.custom_hum': { state: '47.8' },
      'sensor.bad': { state: 'unknown' },
      'sensor.dev_t': { state: '21.5', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
    },
    entities: {
      'sensor.dev_t': { device_id: 'dev1' },
      'sensor.custom_temp': {}, 'sensor.custom_hum': {}, 'sensor.bad': {},
    },
  };
  assert.equal(sourceValue(hass, 'entity:sensor.custom_temp', 'temp'), 23.5);
  assert.equal(sourceValue(hass, 'entity:sensor.custom_hum', 'hum'), 48);
  assert.equal(sourceValue(hass, 'entity:sensor.bad', 'temp'), null);
  assert.equal(sourceValue(hass, 'device:dev1', 'temp'), 21.5);
  assert.equal(sourceValue(hass, 'device:nope', 'temp'), null);
  assert.equal(sourceValue(hass, '', 'temp'), null);
  assert.equal(sourceValue(hass, 'garbage', 'temp'), null);
  assert.equal(
    sourceValue(hass, 'entity:sensor.custom_temp', 'temp', [
      { id: 'gone', binding: 'entity:sensor.custom_temp', removed: true },
    ]),
    null,
  );
  assert.equal(
    sourceValue(hass, 'device:dev1', 'temp', [
      { id: 'gone', binding: 'device:dev1', removed: true },
    ]),
    null,
  );
});

test('sourceValue: entity tombstone does not remove data from a surviving device source', () => {
  const hass = {
    devices: { dev1: { id: 'dev1' } },
    entities: {
      'sensor.gone': { device_id: 'dev1' },
      'sensor.keep': { device_id: 'dev1' },
    },
    states: {
      'sensor.keep': { state: '20', attributes: { device_class: 'temperature' } },
      'sensor.gone': { state: '30', attributes: { device_class: 'temperature' } },
    },
  };
  const markers = [{ id: 'gone', binding: 'entity:sensor.gone', removed: true }];
  // Device sources intentionally use the first valid reading. Keeping the
  // tombstoned entity inside its live parent therefore returns 30, not 20.
  assert.equal(sourceValue(hass, 'device:dev1', 'temp', markers), 30);
});

test('areaClimate: counts sensors that are NOT on the plan (field report)', () => {
  const hass = {
    devices: {
      d1: { id: 'd1', name: 'Датчик температуры спальня', area_id: 'bed' },
      d2: { id: 'd2', name: 'Холодильник', model: 'LG', area_id: 'bed' },
      d3: { id: 'd3', name: 'Qingping air monitor', area_id: 'bed' },
      d4: { id: 'd4', name: 'Датчик температуры кухня', area_id: 'kitchen' },
    },
    entities: {
      'sensor.bed_t': { device_id: 'd1' },
      'sensor.bed_h': { device_id: 'd1' },
      'sensor.fridge_t': { device_id: 'd2' },
      'sensor.air_t': { device_id: 'd3' },
      'sensor.air_h': { device_id: 'd3' },
      'sensor.kitchen_t': { device_id: 'd4' },
    },
    states: {
      'sensor.bed_t': { state: '21.0', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.bed_h': { state: '40', attributes: { device_class: 'humidity', unit_of_measurement: '%' } },
      'sensor.fridge_t': { state: '4', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.air_t': { state: '23.0', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.air_h': { state: '50', attributes: { device_class: 'humidity', unit_of_measurement: '%' } },
      'sensor.kitchen_t': { state: '30.0', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
    },
  };
  // среднее по двум термометрам зоны; ни одно устройство не «размещено» на плане
  assert.equal(areaClimate(hass, 'bed', 'temp'), 22);
  assert.equal(areaClimate(hass, 'bed', 'hum'), 45);
  // холодильник по-прежнему не считается климатом комнаты
  assert.notEqual(areaClimate(hass, 'bed', 'temp'), (21 + 4 + 23) / 3);
  // чужая зона не подмешивается
  assert.equal(areaClimate(hass, 'kitchen', 'temp'), 30);
  assert.equal(areaClimate(hass, 'nowhere', 'temp'), null);
  // сущность со своей area_id учитывается, даже если устройство в другой зоне
  const hass2 = {
    ...hass,
    entities: { ...hass.entities, 'sensor.kitchen_t': { device_id: 'd4', area_id: 'bed' } },
  };
  assert.equal(areaClimate(hass2, 'kitchen', 'temp'), null);
});

test('areaClimate: only ROOM AIR counts (field question, 2026-07-27)', () => {
  const hass = {
    devices: {
      good: { id: 'good', name: 'Датчик температуры спальня', area_id: 'bed' },
      kettle: { id: 'kettle', name: 'Polaris PWK-1725CGLD', model: 'Kettle', area_id: 'bed' },
      nas: { id: 'nas', name: 'System Monitor', area_id: 'bed' },
      sauna: { id: 'sauna', name: 'Сауна Harvia', area_id: 'bed' },
      trv: { id: 'trv', name: 'Термоголовка в спальне', area_id: 'bed' },
      bt: { id: 'bt', name: 'Спальня better thermostat', area_id: 'bed' },
      zb: { id: 'zb', name: 'SLZB-06MU', area_id: 'bed' },
    },
    entities: {
      'sensor.good_t': { device_id: 'good', platform: 'mqtt' },
      // вода в чайнике
      'sensor.kettle_current_temperature': { device_id: 'kettle', platform: 'syncleo_kettle' },
      // температура процессора: и diagnostic, и исключённая интеграция
      'sensor.nas_processor_temperature': { device_id: 'nas', platform: 'systemmonitor', entity_category: 'diagnostic' },
      'sensor.sauna_temperature': { device_id: 'sauna', platform: 'harvia_sauna' },
      'sensor.trv_local_temperature': { device_id: 'trv', platform: 'mqtt' },
      'sensor.bt_temperature': { device_id: 'bt', platform: 'better_thermostat' },
      'sensor.zb_core_chip_temp': { device_id: 'zb', platform: 'smlight', entity_category: 'diagnostic' },
    },
    states: {
      'sensor.good_t': { state: '22.0', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.kettle_current_temperature': { state: '95', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.nas_processor_temperature': { state: '61', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.sauna_temperature': { state: '90', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.trv_local_temperature': { state: '24', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.bt_temperature': { state: '22.0', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.zb_core_chip_temp': { state: '48', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
    },
  };
  // остаётся ровно один настоящий датчик воздуха
  assert.equal(areaClimate(hass, 'bed', 'temp'), 22);
});

test('areaClimateMap: one registry pass for all areas (review R2-3)', () => {
  // 60 зон × 2000 сущностей — размер боевой установки из отчёта
  const devices = {}; const entities = {}; const states = {};
  for (let a = 0; a < 60; a++) {
    for (let i = 0; i < 33; i++) {
      const dev = `d${a}_${i}`;
      const eid = `sensor.d${a}_${i}_temperature`;
      devices[dev] = { id: dev, name: `Датчик температуры ${a}.${i}`, area_id: `area${a}` };
      entities[eid] = { device_id: dev, platform: 'mqtt' };
      states[eid] = { state: String(20 + a * 0.1), attributes: { device_class: 'temperature', unit_of_measurement: '°C' } };
    }
  }
  // считаем ОБХОДЫ реестра: Object.entries дёргает ownKeys ровно один раз
  let scans = 0;
  const traced = new Proxy(entities, { ownKeys(t) { scans++; return Reflect.ownKeys(t); } });
  const hass = { devices, states, entities: traced };


  const map = areaClimateMap(hass);
  assert.equal(scans, 1, 'реестр обходится один раз на снимок hass');
  assert.equal(map.size, 60);
  assert.equal(map.get('area0').temp, 20);
  assert.equal(map.get('area59').temp, 25.9);
  assert.equal(map.get('area0').hum, null);
  assert.equal(map.get('nope'), undefined);

  // старый путь: отдельный обход на каждую комнату и каждую величину
  scans = 0;
  for (let a = 0; a < 60; a++) { areaClimate(hass, `area${a}`, 'temp'); areaClimate(hass, `area${a}`, 'hum'); }
  assert.equal(scans, 120, 'wrapper считает по одной зоне — им нельзя пользоваться в рендере');
});

test('climateTempFor: первая climate-сущность с валидной current_temperature', () => {
  const h = {
    states: {
      'climate.dead': { state: 'unavailable', attributes: {} },
      'climate.mute': { state: 'heat', attributes: {} }, // атрибута нет — мимо
      'climate.ac': { state: 'cool', attributes: { current_temperature: 23.46 } },
      'climate.second': { state: 'heat', attributes: { current_temperature: 30 } },
      'sensor.t': { state: '21', attributes: { device_class: 'temperature' } },
    },
  };
  // несколько climate — берётся ПЕРВАЯ с валидным значением, с округлением до 0.1
  assert.equal(climateTempFor(h, ['climate.dead', 'climate.mute', 'climate.ac', 'climate.second']), 23.5);
  // не-climate сущности не участвуют вовсе
  assert.equal(climateTempFor(h, ['sensor.t']), null);
  // unavailable/unknown/без атрибута — null: ни плашки, ни голоса в средней
  assert.equal(climateTempFor(h, ['climate.dead']), null);
  assert.equal(climateTempFor(h, ['climate.mute']), null);
});

test('areaClimateMap: климат с опцией участвует в средней (термометр 20 + кондиционер 23.5)', () => {
  const hass = {
    devices: {
      dt: { id: 'dt', name: 'Датчик температуры', area_id: 'living' },
      dac: { id: 'dac', name: 'Кондиционер', model: 'AC-12', area_id: 'living' },
    },
    entities: {
      'sensor.t': { device_id: 'dt', platform: 'mqtt' },
      'climate.ac': { device_id: 'dac', platform: 'demo' },
    },
    states: {
      'sensor.t': { state: '20', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'climate.ac': { state: 'cool', attributes: { current_temperature: 23.5 } },
    },
  };
  // без опции — как раньше: только термометр
  assert.equal(areaClimateMap(hass).get('living').temp, 20);
  assert.equal(areaClimateMap(hass, undefined, [{ id: 'm1', binding: 'device:dac' }]).get('living').temp, 20);
  // опция включена: (20 + 23.5) / 2 = 21.75 → 21.8 по сетке карточки (0.1°)
  const markers = [{ id: 'm1', binding: 'device:dac', use_climate_temp: true }];
  assert.equal(areaClimateMap(hass, undefined, markers).get('living').temp, 21.8);
  // entity-привязка работает так же
  const entMarkers = [{ id: 'm1', binding: 'entity:climate.ac', use_climate_temp: true }];
  assert.equal(areaClimateMap(hass, undefined, entMarkers).get('living').temp, 21.8);
  // unavailable климат не ломает и не участвует
  const broken = { ...hass, states: { ...hass.states, 'climate.ac': { state: 'unavailable', attributes: {} } } };
  assert.equal(areaClimateMap(broken, undefined, markers).get('living').temp, 20);
});

test('areaClimateMap: комната только с климат-источником появляется в карте', () => {
  const hass = {
    devices: { dac: { id: 'dac', name: 'Кондиционер', area_id: 'bed' } },
    entities: { 'climate.bed': { device_id: 'dac', platform: 'demo' } },
    states: { 'climate.bed': { state: 'heat', attributes: { current_temperature: 24.2 } } },
  };
  assert.equal(areaClimateMap(hass).get('bed'), undefined);
  const markers = [{ id: 'm1', binding: 'device:dac', use_climate_temp: true }];
  assert.deepEqual(areaClimateMap(hass, undefined, markers).get('bed'), { temp: 24.2, hum: null });
});

test('areaClimateMap: температура и влажность живут в одной записи', () => {
  const hass = {
    devices: { q: { id: 'q', name: 'Qingping Air Monitor', area_id: 'hall' } },
    entities: {
      'sensor.q_t': { device_id: 'q', platform: 'xiaomi' },
      'sensor.q_h': { device_id: 'q', platform: 'xiaomi' },
    },
    states: {
      'sensor.q_t': { state: '21.4', attributes: { device_class: 'temperature', unit_of_measurement: '°C' } },
      'sensor.q_h': { state: '48', attributes: { device_class: 'humidity', unit_of_measurement: '%' } },
    },
  };
  assert.deepEqual(areaClimateMap(hass).get('hall'), { temp: 21.4, hum: 48 });
});


test('primaryEntity: a service switch never beats the visible main function (TRV)', () => {
  // the owner's radiator heads, verified live: switch outranks climate in the
  // domain list, and the old inner-tier loop let a CONFIG switch (anti
  // scaling, child lock) become primary — the icon glowed yellow because
  // scale protection was on, while the head actually heating stayed dark
  const hass = {
    entities: {
      'climate.trv': {},
      'sensor.trv_temp': {},
      'switch.trv_anti_scaling': { entity_category: 'config' },
      'switch.trv_child_lock': { entity_category: 'config' },
    },
    states: {},
  };
  assert.equal(
    primaryEntity(hass, ['switch.trv_anti_scaling', 'switch.trv_child_lock', 'climate.trv', 'sensor.trv_temp'], 'mdi:thermostat'),
    'climate.trv',
  );
  // but a device whose only functional entity IS a switch keeps it
  const plug = { entities: { 'switch.plug': {}, 'sensor.plug_power': {} }, states: {} };
  assert.equal(primaryEntity(plug, ['sensor.plug_power', 'switch.plug'], 'mdi:power-socket'), 'switch.plug');
});

test('litLightEntity: one truth for "this thing is shining"', () => {
  const hass = { states: {
    'light.a': { state: 'off' }, 'light.b': { state: 'on' },
    'switch.wall': { state: 'on' }, 'sensor.x': { state: '5' },
  } };
  // a lit light.* anywhere in the device
  assert.equal(litLightEntity(hass, { entities: ['light.a', 'light.b'] }), 'light.b');
  assert.equal(litLightEntity(hass, { entities: ['light.a'] }), null);
  // without the flag a lit switch is NOT a light
  assert.equal(litLightEntity(hass, { entities: ['switch.wall'] }), null);
  // with "is a light source" any lit entity counts, controls first
  assert.equal(
    litLightEntity(hass, { entities: ['sensor.x'], marker: { is_light: true, controls: ['switch.wall'] } }),
    'switch.wall',
  );
});

test('areaClimateMap: whole device tombstone wins; entity tombstone stays binding-scoped', () => {
  const hass = {
    devices: {
      a: { id: 'a', name: 'Room thermometer A', area_id: 'living' },
      b: { id: 'b', name: 'Room thermometer B', area_id: 'living' },
    },
    entities: {
      'sensor.a_temperature': { device_id: 'a', platform: 'demo' },
      'sensor.b_temperature': { device_id: 'b', platform: 'demo' },
    },
    states: {
      'sensor.a_temperature': { state: '20', attributes: { device_class: 'temperature' } },
      'sensor.b_temperature': { state: '30', attributes: { device_class: 'temperature' } },
    },
  };
  const markers = [
    { id: 'a', binding: 'device:a', removed: true },
    { id: 'b-temp', binding: 'entity:sensor.b_temperature', removed: true },
  ];
  assert.deepEqual(areaClimateMap(hass, undefined, markers).get('living'), { temp: 30, hum: null });
});

test('resolvedLightSources: one source set feeds room fill, card, glow and controls', () => {
  const hass = { states: {
    'light.auto': { state: 'on' },
    'switch.relay': { state: 'on' },
    'light.bound': { state: 'off' },
    'switch.bound': { state: 'on' },
    'light.own': { state: 'on' },
    'light.hidden': { state: 'on' },
  } };
  const devices = [
    { id: 'lamp', area: 'living', entities: ['light.auto'] },
    { id: 'relay', area: 'living', primary: 'switch.relay', entities: ['switch.relay'], marker: { is_light: true } },
    {
      id: 'controller', area: 'living', entities: ['light.own'],
      marker: { controls: ['light.bound', 'switch.bound'] },
    },
    { id: 'hidden', area: 'living', hidden: true, entities: ['light.hidden'] },
  ];

  const sources = resolvedLightSources(hass, devices, { id: 'room-a', area: 'living' });
  assert.deepEqual(
    sources.map(({ eid, via, on }) => ({ eid, via, on })),
    [
      { eid: 'light.auto', via: 'light', on: true },
      { eid: 'switch.relay', via: 'forced', on: true },
      { eid: 'light.bound', via: 'controls', on: false },
      { eid: 'switch.bound', via: 'controls', on: true },
    ],
  );
  assert.equal(resolvedLightState(sources), 'on');
  assert.deepEqual(resolvedLightStats(sources), { on: 3, total: 4 });
  assert.ok(!sources.some((source) => source.eid === 'light.own'), 'controls replace automatic device lights');
  assert.ok(!sources.some((source) => source.eid === 'light.hidden'), 'hidden markers cast and count no light');
});

test('resolvedLightSources: marker room_id is more precise than a shared HA area', () => {
  const hass = { states: { 'switch.one': { state: 'on' } } };
  const devices = [{
    id: 'one', area: 'living', primary: 'switch.one', entities: ['switch.one'],
    marker: { room_id: 'room-b', is_light: true },
  }];
  assert.deepEqual(resolvedLightSources(hass, devices, { id: 'room-a', area: 'living' }), []);
  assert.deepEqual(
    resolvedLightSources(hass, devices, { id: 'room-b', area: null }).map((source) => source.eid),
    ['switch.one'],
  );
});

test('self-control is not external but preserves legacy switch-as-light intent', () => {
  assert.deepEqual(
    persistedExternalControls('entity:switch.hood', [
      'switch.hood', 'input_boolean.yaml_only', 'light.mirror',
      'light.mirror', 'sensor.vendor_option',
    ]),
    ['input_boolean.yaml_only', 'light.mirror', 'light.mirror', 'sensor.vendor_option'],
    'dialog persistence removes only self and keeps unknown/duplicate user data',
  );
  assert.deepEqual(
    effectiveMarkerControls('entity:switch.hood', [
      'switch.hood', 'light.mirror', 'switch.hood', 'lock.front_door',
    ]),
    ['light.mirror'],
  );
  assert.deepEqual(
    effectiveMarkerControls(
      'device:hood', ['switch.hood', 'switch.mirror'], ['switch.hood'],
    ),
    ['switch.mirror'],
    'a device marker also separates its own entities from external targets',
  );

  const hass = { states: {
    'switch.hood': { state: 'on' }, 'light.mirror': { state: 'off' },
  } };
  const hood = {
    id: 'hood', area: 'bathroom', primary: 'switch.hood', entities: ['switch.hood'],
    marker: { binding: 'entity:switch.hood', controls: ['switch.hood', 'light.mirror'] },
  };
  assert.deepEqual(
    resolvedLightSources(hass, [hood]).map(({ eid, via }) => ({ eid, via })),
    [
      { eid: 'light.mirror', via: 'controls' },
      { eid: 'switch.hood', via: 'forced' },
    ],
    'legacy entity self-control remains additive with external light targets',
  );
  assert.deepEqual(
    resolvedLightSources(hass, [{
      ...hood, primary: 'light.mirror', entities: ['light.mirror', 'switch.hood'],
    }]).map(({ eid, via }) => ({ eid, via })),
    [
      { eid: 'light.mirror', via: 'controls' },
      { eid: 'switch.hood', via: 'forced' },
    ],
    'an entity binding preserves the exact legacy relay even if registry primary differs',
  );
  assert.deepEqual(
    resolvedLightSources(hass, [{
      ...hood, marker: { binding: 'device:hood', controls: ['switch.hood'] },
    }]).map(({ eid, via }) => ({ eid, via })),
    [{ eid: 'switch.hood', via: 'forced' }],
    'legacy device-child self-control preserves the same intent',
  );
  assert.deepEqual(
    resolvedLightSources(hass, [{ ...hood, marker: { ...hood.marker, is_light: true } }])
      .map(({ eid, via }) => ({ eid, via })),
    [
      { eid: 'light.mirror', via: 'controls' },
      { eid: 'switch.hood', via: 'forced' },
    ],
    'the canonical explicit source flag keeps the same combined result',
  );
});


// ---------- explicit hide-from-plan flags (docs/FILTERING.md) ----------

test('seedHiddenBindings: non-physical devices in bound areas, unmarked only', () => {
  const h = mkHass({ devices: {
    lamp: dev('lamp', 'Lamp', 'Bulb', 'living'),
    bridge: dev('bridge', 'Z2M Bridge', 'Bridge', 'living'),
    grp: dev('grp', 'All lights', 'Group', 'living'),
    scn: dev('scn', 'Evening', 'Scene switch', 'living'),
    faraway: dev('faraway', 'Bridge 2', 'Bridge', 'garage'), // unbound area
  }});
  const ctx = { hass: h, areaToSpace: { living: 'f1' }, markers: [], settings: {},
    excluded: new Set(['hacs']), firstSpaceId: 'f1' };
  assert.deepEqual(seedHiddenBindings(ctx).sort(), ['device:bridge', 'device:grp', 'device:scn']);
  // a marker of ANY kind — even hidden: false — is the user's decision
  const marked = { ...ctx, markers: [
    { id: 'x', binding: 'device:bridge', hidden: false },
    { id: 'y', binding: 'device:grp', hidden: true },
    { id: 'z', binding: 'device:scn', removed: true },
  ] };
  assert.deepEqual(seedHiddenBindings(marked), [], 'marked and deleted devices are never revisited');
});

test('seeded config: hidden is a flag, not an absence', () => {
  const h = mkHass({ devices: {
    lamp: dev('lamp', 'Lamp', 'Bulb', 'living'),
    plug: dev('plug', 'Plug', 'Socket', 'living'),
  }});
  const res = buildDevices(baseCtx(h, {
    settings: { filter_seeded: true },
    markers: [{ id: 'hplug', binding: 'device:plug', hidden: true }],
  }));
  const plug = res.find((d) => d.bindingRef === 'plug');
  assert.ok(plug, 'the hidden device is BUILT — room LQI still counts it');
  assert.equal(plug.hidden, true, 'and flagged for the renderer');
  assert.ok(!res.find((d) => d.id === 'lamp').hidden);
});

test('legacy config (no filter_seeded): the runtime filter still applies', () => {
  const h = mkHass({ devices: {
    lamp: dev('lamp', 'Lamp', 'Bulb', 'living'),
    bridge: dev('bridge', 'Hub', 'Bridge', 'living'),
  }});
  const res = buildDevices(baseCtx(h));
  assert.deepEqual(res.map((d) => d.id), ['lamp'], 'a read-only client on an old config sees the old behaviour');
  // and a hidden marker still removes the device entirely, as before
  const res2 = buildDevices(baseCtx(h, { markers: [{ id: 'x', binding: 'device:lamp', hidden: true }] }));
  assert.deepEqual(res2.map((d) => d.id), []);
});

test('hidden lights cast no visible light, but count toward LQI', () => {
  const h = mkHass({
    devices: {},
    states: { 'light.a': { state: 'on', attributes: {} } },
  });
  const devices = [
    { area: 'living', entities: ['light.a'], hidden: true },
  ];
  assert.equal(areaLights(h, devices, 'living'), 'none', 'an invisible device casts no visible light');
  assert.equal(areaLightStats(h, devices, 'living'), null);
});
