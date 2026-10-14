// #850: the `large-house` capture host shared by the incremental-snapshot
// oracle (render-snapshot-incremental.test.mjs) and the capture contract
// tests (render-device-snapshot.test.mjs): real resolvers, real rosters.
import { makeLargeHouseFixture } from '../demo/fixtures/large-house.mjs';
import { buildDevices } from '../test-build/devices.js';
import { activeRegistryHass, fullRegistryHass } from '../test-build/ha-binding-status.js';
import { spaceModels } from '../test-build/space-geometry.js';
import { virtualLightSnapshot } from '../test-build/virtual-light-state.js';

/** Deterministic PRNG: a failing tick sequence is reproducible from its seed. */
export const prng = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

/**
 * The large house plus the rows the oracle must cover: battery and LQI
 * siblings, door contacts, a wall switch driving lamps through `marker:*`,
 * manual virtual lights and an explicit value badge.
 */
export function oracleFixture() {
  const fixture = makeLargeHouseFixture({ includeStairs: false });
  const { entities, states, config } = fixture;
  const add = (entityId, deviceId, state, attributes = {}, registry = {}) => {
    entities[entityId] = { entity_id: entityId, device_id: deviceId, platform: 'houseplan_perf',
      config_entry_id: 'perf_entry', disabled_by: null, ...registry };
    states[entityId] = { entity_id: entityId, state, attributes };
  };
  for (let index = 0; index < 200; index += 7) {
    add(`sensor.perf_${index}_battery`, `perf-device-${index}`, String(10 + (index % 90)),
      { device_class: 'battery', unit_of_measurement: '%' }, { entity_category: 'diagnostic' });
  }
  for (let index = 3; index < 200; index += 11) {
    add(`sensor.perf_${index}_linkquality`, `perf-device-${index}`, String(40 + index % 200),
      { unit_of_measurement: 'lqi' }, { entity_category: 'diagnostic' });
  }
  // Door contacts bound to openings of the first floor.
  const doors = config.spaces[0].openings.filter((opening) => opening.type === 'door').slice(0, 8);
  doors.forEach((opening, index) => {
    const entityId = `binary_sensor.perf_door_${index}`;
    add(entityId, `perf-device-${(index * 13) % 200}`, index % 2 ? 'on' : 'off', { device_class: 'door' });
    opening.contact = entityId;
  });
  // A wall switch (perf-device-1 owns switch.perf_1) drives two light markers.
  const wall = config.markers.find((marker) => marker.id === 'perf-device-1');
  const links = { id: 'perf-device-1', binding: 'device:perf-device-1', controls: ['marker:perf-device-0', 'marker:perf-device-10'] };
  if (wall) Object.assign(wall, links); else config.markers.push(links);
  // Manual virtual lights and an explicit value badge.
  for (const id of ['perf-virtual-a', 'perf-virtual-b']) {
    config.markers.push({ id, binding: 'virtual', is_light: true, tap_action: 'toggle', space: 'perf-floor-1',
      name: id, icon: 'mdi:lightbulb' });
    fixture.layout[id] = { s: 'perf-floor-1', x: 0.5, y: 0.5 };
  }
  // A badge of another device's row, and an entity-bound marker whose battery
  // is a sibling it does not own: both rows reach a presentation only through
  // the badge resolver and the battery context.
  config.markers.push({ id: 'perf-device-2', binding: 'device:perf-device-2',
    value_badge: { enabled: true, source: { kind: 'entity_state', entity_id: 'sensor.perf_12' } } });
  config.markers.push({ id: 'perf-entity-42', binding: 'entity:sensor.perf_42', space: 'perf-floor-1' });
  fixture.layout['perf-entity-42'] = { s: 'perf-floor-1', x: 0.3, y: 0.3 };
  return fixture;
}

export function captureHost(fixture) {
  const hass = {
    language: 'en', locale: { language: 'en', number_format: 'language' },
    config: { unit_system: { length: 'km', temperature: '°C' } }, themes: { darkMode: false },
    devices: fixture.devices, entities: fixture.entities, areas: fixture.areas, states: fixture.states,
  };
  const model = spaceModels(fixture.config);
  const areaToSpace = Object.fromEntries(model.flatMap((space) => space.rooms
    .filter((room) => room.area).map((room) => [room.area, space.id])));
  // A loaded registry, as the card has it after `config/*_registry/list`.
  const registryOf = (current) => ({ revision: 1, authoritative: true, access: 'full', lastSuccess: 1,
    devices: current.devices, entities: current.entities });
  const roster = (current) => buildDevices({
    hass: current, registry: registryOf(current), areaToSpace, markers: fixture.config.markers,
    settings: fixture.config.settings, excluded: new Set(), showAll: false, firstSpaceId: model[0].id,
    loc: (key) => key,
  });
  let projection = null;
  const host = {
    hass,
    _hassSequence: 1,
    _cfgEpoch: 1,
    _devices: roster(hass),
    _layout: fixture.layout,
    /** The card's `_settings`: the stored config's settings. */
    get _settings() { return this._serverCfg?.settings || {}; },
    _config: { live_states: true, show_temperature: true },
    _model: model,
    _serverCfg: fixture.config,
    _markers: fixture.config.markers,
    _summary: { entityIds: () => ['sensor.perf_2'] },
    _vacFit: null,
    _virtualLights: virtualLightSnapshot(null),
    _activityRt: new Map(),
    _reducedMotion: false,
    _vacRt: new Map(),
    _vacSrvTrails: {},
    _isVacDev: () => false,
    _vacSource: () => null,
    _vacObservedMapId: () => undefined,
    _vacMapId: () => '',
    _livePos: (device) => ({ x: (fixture.layout[device.id]?.x ?? 0) * 1000, y: (fixture.layout[device.id]?.y ?? 0) * 1000 }),
    /** The card's `_planHass`: one projection per HA object, registry rows kept while the registry is the same. */
    get _planHass() {
      if (projection?.hass === this.hass) return projection.active;
      const same = projection && projection.entities === this.hass.entities
        && projection.devices === this.hass.devices ? projection.active : undefined;
      projection = { hass: this.hass, entities: this.hass.entities, devices: this.hass.devices,
        active: activeRegistryHass(this.hass, registryOf(this.hass), same) };
      return projection.active;
    },
    get _fullRegistryHass() { return fullRegistryHass(this.hass, registryOf(this.hass)); },
    rebuildRoster() { this._devices = roster(this.hass); },
  };
  return host;
}
