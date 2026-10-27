/** Synthetic #1000 input only: real config, registry and HA state fields. */
import { makeDeviceIssuesFixture, maintenanceSource } from './device-issues.mjs';
import { makeVisualMatrixFixture } from './visual-matrix.mjs';
export function makeMarkerAlertsFixture(kind) {
  const fixture = makeVisualMatrixFixture(), sample = makeDeviceIssuesFixture();
  fixture.devices = sample.devices; fixture.entities = sample.entities; fixture.states = sample.states;
  fixture.devices.appliance.area_id = 'golden_light_left';
  fixture.entities['sensor.alert_co2'] = { entity_id: 'sensor.alert_co2', device_id: 'appliance', platform: 'demo', name: 'CO₂' };
  fixture.states['sensor.alert_co2'] = { entity_id: 'sensor.alert_co2', state: '1500', attributes: { unit_of_measurement: 'ppm' } };
  fixture.entities['binary_sensor.alert_window'] = { entity_id: 'binary_sensor.alert_window', device_id: 'appliance', platform: 'demo', name: 'Окно' };
  fixture.states['binary_sensor.alert_window'] = { entity_id: 'binary_sensor.alert_window', state: 'on', attributes: { device_class: 'door' } };
  const attention = { id: 'co2-warning', type: 'threshold', level: 'attention', entity_id: 'sensor.alert_co2', operator: 'gt', value: 1000 };
  const rules = kind === 'form' ? [] : [attention, ...(kind === 'alarm' ? [
    { ...attention, id: 'co2-second-warning', value: 1200 },
    { ...attention, id: 'co2-alarm', level: 'alarm', value: 1400 },
  ] : [])];
  if (kind !== 'maintenance' && kind !== 'alarm') fixture.states[maintenanceSource].state = 'off';
  fixture.config.markers = [{ id: 'appliance', binding: 'device:appliance', space: 'golden-lighting',
    icon: 'mdi:dishwasher', display: 'icon_ripple', tap_action: 'info', ...(rules.length ? { alert_sources: rules } : {}) }];
  fixture.layout = { appliance: { s: 'golden-lighting', x: .23, y: .34 } };
  return fixture;
}
