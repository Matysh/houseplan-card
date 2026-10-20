// #972: all 55 supplied HA state/class pairs, with entity names anonymized.
// Registry fields are reconstructed from Home Connect Local 1.12.5
// (a950e5438d479df3b97582edb8901adf10ad8726), not a real registry capture.
export const maintenanceSource = 'binary_sensor.appliance_machinecare_and_filter';
export function makeDeviceIssuesFixture() {
  const rows = `
binary_sensor.appliance_aquastop_occurred|off|problem
binary_sensor.appliance_check_filter_system|off|problem
binary_sensor.appliance_connection|on|connectivity
binary_sensor.appliance_door|off|
binary_sensor.appliance_drain_pump_blocked|off|problem
binary_sensor.appliance_draining_not_possible|off|problem
binary_sensor.appliance_ecodry_active|off|
binary_sensor.appliance_intensive_zone_active|unavailable|
binary_sensor.appliance_low_voltage|off|problem
binary_sensor.appliance_low_water_pressure|off|problem
binary_sensor.appliance_machine_care|off|problem
binary_sensor.appliance_machinecare_and_filter|on|problem
binary_sensor.appliance_program_aborted|off|problem
binary_sensor.appliance_program_finished|off|
binary_sensor.appliance_remote_start_allowed|on|
binary_sensor.appliance_smart_filter_cleaning|off|problem
binary_sensor.appliance_water_heater_calcified|off|problem
button.appliance_abort|unavailable|
button.appliance_start|unknown|
number.appliance_silence_on_demand_duration|1800|duration
number.appliance_start_in|0|duration
select.appliance_default_program|lastprogram|
select.appliance_drying_assistant_all_programs|allprograms|
select.appliance_power_state|off|
select.appliance_remote_control|permanentremotestart|
select.appliance_rinse_aid|r05|
select.appliance_selected_program|dishcare_dishwasher_program_quick65|
select.appliance_sound_level_key|medium|
select.appliance_sound_level_signal|medium|
select.appliance_turbidity_sensor_sensitivity|sensitive|
select.appliance_water_connection|coldwater|
select.appliance_water_hardness|h03|
sensor.appliance_active_program|unknown|enum
sensor.appliance_energy_forecast|72.0|
sensor.appliance_machine_care_reminder|0|
sensor.appliance_operation_state|ready|enum
sensor.appliance_power_state|off|enum
sensor.appliance_program_end_condition|programfinished|enum
sensor.appliance_program_phase|unknown|enum
sensor.appliance_program_progress|0.0|
sensor.appliance_remaining_program_time|1.58333333333333|duration
sensor.appliance_rinse_aid|full|enum
sensor.appliance_salt|full|enum
sensor.appliance_silence_on_demand_remaining|0|duration
sensor.appliance_start_count|489|
sensor.appliance_start_in|0.0|duration
sensor.appliance_water_forecast|50.0|
sensor.appliance_wifi_signal_strength|-52|signal_strength
switch.appliance_ecodry|on|switch
switch.appliance_extra_dry|off|switch
switch.appliance_intensiv_zone|unavailable|switch
switch.appliance_power|off|switch
switch.appliance_silence_on_demand|off|switch
switch.appliance_speed_on_demand|unavailable|switch
switch.appliance_variospeedplus|unavailable|switch
`.trim().split('\n').map(row => row.split('|'));
  const states = Object.fromEntries(rows.map(([eid, state, dc]) => [eid, {
    entity_id: eid, state, attributes: { friendly_name: eid.split('.')[1].replaceAll('_', ' '),
      ...(dc ? { device_class: dc } : {}) },
  }]));
  const entities = Object.fromEntries(rows.map(([eid,, dc]) => [eid, {
    entity_id: eid, device_id: 'appliance', platform: 'homeconnect_ws', disabled_by: null,
    ...(['problem', 'connectivity'].includes(dc) ? { entity_category: 'diagnostic' } : {}),
  }]));
  for (const [eid, key] of [
    [maintenanceSource, 'binary_sensor_machinecareandfiltercleaningreminder'],
    ['binary_sensor.appliance_machine_care', 'binary_sensor_machinecarereminder'],
    ['binary_sensor.appliance_smart_filter_cleaning', 'binary_sensor_smartfiltercleaningreminder'],
  ]) entities[eid].translation_key = key;
  entities[maintenanceSource].name = 'MachineCare and Filter';
  return { states, entities, devices: { appliance: { id: 'appliance', name: 'Dishwasher' } },
    device: { id: 'appliance', name: 'Dishwasher', model: 'Dishwasher', icon: 'mdi:dishwasher',
      primary: 'switch.appliance_power', entities: Object.keys(states), bindingKind: 'device',
      bindingRef: 'appliance', marker: { id: 'appliance', binding: 'device:appliance' } } };
}
