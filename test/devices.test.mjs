import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDevices, lightGroups, primaryEntity, lqiFor, tempFor, humFor, areaLights, areaTemp, areaHum, areaLightStats } from '../test-build/devices.js';
import { compileIconRules } from '../test-build/rules.js';

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
