/** #1026: ordinary owned HA rows; presentation is always derived by the shipped product. */
export function makeDeviceOfflineFixture(space = 'golden-offline') {
  const fixture = {
    config: { model_version: 7, spaces: [{ id: space, title: 'Offline reference', cell_cm: 5,
      plan_url: null, view_box: [0, 0, 1, 1], rooms: [{ id: 'offline-room', name: '', area: 'offline-area',
        poly: [[0,0],[1,0],[1,1],[0,1]] }], walls: [], wall_segments: [], partitions: [],
      openings: [], wall_columns: [], decor: [], led_strips: [],
      settings: { fill_mode: 'none', show_names: false, show_borders: false, glow_enabled: false },
    }], markers: [], settings: { bg_mode: 'static', sun_rays: false, marker_area_snapshot: {}, show_device_battery: true } },
    devices: {}, entities: {}, states: {}, layout: {},
    areas: { 'offline-area': { area_id: 'offline-area', name: 'Offline reference' } },
  };
  const entity = (id, state, attributes = {}, row = {}) => {
    fixture.entities[id] = { entity_id: id, device_id: null, area_id: null,
      platform: 'houseplan_golden', config_entry_id: 'offline-entry', disabled_by: null, ...row };
    if (state !== undefined) fixture.states[id] = { entity_id: id, state,
      attributes: { friendly_name: id, ...attributes } };
  };
  const device = id => {
    fixture.devices[id] = { id, name: id, model: 'Offline reference', area_id: 'offline-area',
      identifiers: [['houseplan_golden', id]], config_entries: ['offline-entry'], disabled_by: null };
  };
  const badge = (id = 'sensor.offline_value') => ({ enabled: true,
    source: { kind: 'entity_state', entity_id: id }, position: 'right' });
  const marker = (id, source, x, y, extra = {}) => {
    const binding = source.startsWith('device:') ? source : `entity:${source}`;
    fixture.config.markers.push({ id, name: id, binding, space, tap_action: 'info',
      icon: 'mdi:television', display: 'badge', value_badge: { enabled: false }, ...extra });
    fixture.layout[id] = { s: space, x, y };
    fixture.config.settings.marker_area_snapshot[id] = { binding, area: 'offline-area' };
  };
  entity('sensor.offline_value', '23.5', { unit_of_measurement: '°C' });
  entity('media_player.offline_icon', 'off');
  entity('media_player.offline_down', 'unavailable');
  entity('switch.offline_text', 'unavailable');
  entity('switch.offline_unknown', 'unknown');
  entity('switch.offline_missing', undefined);
  entity('switch.offline_source', 'off');
  entity('sensor.offline_badge', 'unavailable');
  entity('switch.offline_double', 'unavailable');
  entity('switch.offline_static', 'unavailable');
  marker('offline-icon', 'media_player.offline_icon', .18, .15, { value_badge: badge() });
  marker('offline-down', 'media_player.offline_down', .50, .15, { value_badge: badge() });
  marker('offline-text', 'switch.offline_text', .82, .15, { display: 'value', value_badge: badge(),
    value_source: { kind: 'entity_state', entity_id: 'sensor.offline_value' } });
  marker('offline-unknown', 'switch.offline_unknown', .18, .34);
  marker('offline-missing', 'switch.offline_missing', .50, .34);
  marker('offline-source', 'switch.offline_source', .82, .34, { value_badge: badge('sensor.offline_badge') });
  marker('offline-double', 'switch.offline_double', .18, .53, { value_badge: badge('sensor.offline_badge') });
  marker('offline-static', 'switch.offline_static', .50, .53, { display: 'static_icon', value_badge: badge() });
  device('offline-controller-device');
  entity('event.offline_controller', 'unknown', {}, { device_id: 'offline-controller-device' });
  entity('sensor.offline_controller_battery', '100', { device_class: 'battery', unit_of_measurement: '%' },
    { device_id: 'offline-controller-device', entity_category: 'diagnostic' });
  entity('light.offline_target', 'unavailable', { supported_color_modes: ['onoff'] });
  marker('offline-controller', 'device:offline-controller-device', .82, .53,
    { icon: 'mdi:light-switch', controls: ['light.offline_target'] });
  device('offline-exact-device');
  entity('switch.offline_exact', 'unavailable', {}, { device_id: 'offline-exact-device' });
  entity('sensor.offline_exact_battery', '100', { device_class: 'battery', unit_of_measurement: '%' },
    { device_id: 'offline-exact-device', entity_category: 'diagnostic' });
  entity('sensor.offline_exact_linkquality', '175', { unit_of_measurement: 'lqi' },
    { device_id: 'offline-exact-device', entity_category: 'diagnostic' });
  marker('offline-exact', 'switch.offline_exact', .18, .72, { value_badge: badge() });
  device('offline-alarm-device');
  entity('switch.offline_alarm_power', 'unavailable', {}, { device_id: 'offline-alarm-device' });
  entity('binary_sensor.offline_alarm_moisture', 'on', { device_class: 'moisture' },
    { device_id: 'offline-alarm-device' });
  marker('offline-alarm', 'switch.offline_alarm_power', .34, .72, { display: 'icon_ripple',
    state_source: { entity_id: 'binary_sensor.offline_alarm_moisture' } });
  device('offline-legacy-device');
  entity('sensor.offline_legacy_humidity', '45', { device_class: 'humidity', unit_of_measurement: '%' },
    { device_id: 'offline-legacy-device' });
  entity('climate.offline_legacy_temperature', 'idle', { current_temperature: 22.4 },
    { device_id: 'offline-legacy-device', entity_category: 'diagnostic' });
  marker('offline-legacy', 'device:offline-legacy-device', .18, .91,
    { icon: 'mdi:water-percent', use_climate_temp: true });
  delete fixture.config.markers.at(-1).value_badge;
  for (const [index, state] of ['off', 'unavailable', 'unknown'].entries()) {
    const source = `light.offline_led_${state}`, id = `offline-led-${state}`;
    entity(source, state, { supported_color_modes: ['onoff'] });
    marker(id, source, .50 + index * .15, .72,
      { is_light: true, value_badge: state === 'off' ? { enabled: false } : badge() });
    fixture.config.spaces[0].led_strips.push({ id: `${id}-strip`, marker: id,
      points: [[.45 + index * .17,.88],[.57 + index * .17,.88]], width_cm: 3 });
  }
  return fixture;
}
