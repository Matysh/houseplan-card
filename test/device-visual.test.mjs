import test from 'node:test';
import assert from 'node:assert/strict';
import {
  combineVisualSamples,
  edgeActivity,
  entityVisualSample,
  entityVisualSamplesForDevice,
} from '../test-build/device-visual.js';

const hass = (states) => ({
  states: Object.fromEntries(Object.entries(states).map(([eid, value]) => [eid, {
    state: value.state,
    attributes: value.attributes || {},
  }])),
});

test('actual work is yellow/running, but an enabled automation is neutral', () => {
  const h = hass({
    'switch.relay': { state: 'on' },
    'climate.office': { state: 'heat', attributes: { hvac_action: 'idle' } },
    'climate.bedroom': { state: 'heat', attributes: { hvac_action: 'heating' } },
    'climate.mode_only': {
      state: 'heat_cool',
      attributes: { hvac_modes: ['off', 'heat_cool', 'cool', 'heat', 'fan_only', 'dry'] },
    },
    'climate.mode_only_off': {
      state: 'off', attributes: { hvac_modes: ['off', 'heat_cool'] },
    },
    'climate.custom_mode_only': {
      state: 'eco', attributes: { hvac_modes: ['off', 'eco'] },
    },
    'climate.preheating': { state: 'heat', attributes: { hvac_action: 'preheating' } },
    'climate.defrosting': { state: 'heat', attributes: { hvac_action: 'defrosting' } },
    'climate.mode_like_pseudo_action': {
      state: 'cool', attributes: { hvac_modes: ['off', 'cool'], current_operation: 'eco' },
    },
    'climate.recognised_idle_equivalent': {
      state: 'heat', attributes: { hvac_modes: ['off', 'heat'], current_operation: 'idle' },
    },
    'automation.night': { state: 'on' },
    'script.scene': { state: 'on' },
  });
  assert.deepEqual(
    entityVisualSample(h, 'switch.relay'),
    { eid: 'switch.relay', state: 'on', availability: 'available', status: 'working', activity: 'running', edge: 'none' },
  );
  assert.equal(entityVisualSample(h, 'climate.office').status, 'neutral');
  assert.equal(entityVisualSample(h, 'climate.bedroom').status, 'working');
  assert.equal(entityVisualSample(h, 'climate.mode_only').status, 'working');
  assert.equal(entityVisualSample(h, 'climate.mode_only').activity, 'running');
  assert.equal(entityVisualSample(h, 'climate.mode_only_off').status, 'neutral');
  assert.equal(entityVisualSample(h, 'climate.custom_mode_only').status, 'working');
  assert.equal(entityVisualSample(h, 'climate.preheating').status, 'working');
  assert.equal(entityVisualSample(h, 'climate.defrosting').status, 'working');
  assert.equal(entityVisualSample(h, 'climate.mode_like_pseudo_action').status, 'working');
  assert.equal(entityVisualSample(h, 'climate.recognised_idle_equivalent').status, 'neutral');
  assert.equal(entityVisualSample(h, 'automation.night').status, 'neutral');
  assert.equal(entityVisualSample(h, 'script.scene').status, 'working');
});

test('media players express power without treating playback as work', () => {
  const h = hass({
    'media_player.soundbar': { state: 'playing' },
    'media_player.tv': { state: 'on' },
    'media_player.receiver': { state: 'idle' },
    'media_player.speaker': { state: 'off' },
  });
  for (const eid of ['media_player.soundbar', 'media_player.tv', 'media_player.receiver']) {
    assert.deepEqual(
      (({ status, activity }) => ({ status, activity }))(entityVisualSample(h, eid)),
      { status: 'neutral', activity: 'none' },
    );
  }
  assert.deepEqual(
    (({ availability, status, activity }) => ({ availability, status, activity }))(
      entityVisualSample(h, 'media_player.speaker'),
    ),
    { availability: 'unavailable', status: 'neutral', activity: 'none' },
  );
});

test('a composite Power switch is a neutral lifecycle, while a lone relay still works', () => {
  const h = {
    ...hass({
      'switch.soundbar_power': { state: 'off', attributes: { friendly_name: 'Soundbar Power' } },
      'switch.soundbar_pure_voice': { state: 'on' },
      'switch.relay': { state: 'on' },
    }),
    entities: {
      'switch.soundbar_power': {},
      'switch.soundbar_pure_voice': {},
      'switch.relay': {},
    },
  };
  const soundbarIds = ['switch.soundbar_power', 'switch.soundbar_pure_voice'];
  assert.deepEqual(
    combineVisualSamples(entityVisualSamplesForDevice(h, ['switch.soundbar_power'], soundbarIds)),
    { availability: 'unavailable', status: 'neutral', activity: 'none' },
  );
  h.states['switch.soundbar_power'].state = 'on';
  assert.deepEqual(
    combineVisualSamples(entityVisualSamplesForDevice(h, ['switch.soundbar_power'], soundbarIds)),
    { availability: 'available', status: 'neutral', activity: 'none' },
  );
  assert.equal(
    combineVisualSamples(entityVisualSamplesForDevice(h, ['switch.relay'], ['switch.relay'])).status,
    'working',
  );
});

test('off media sources share unavailable styling without hiding an active peer', () => {
  const off = entityVisualSample(hass({ 'media_player.one': { state: 'off' } }), 'media_player.one');
  const on = entityVisualSample(hass({ 'media_player.two': { state: 'on' } }), 'media_player.two');
  assert.deepEqual(
    combineVisualSamples([off]),
    { availability: 'unavailable', status: 'neutral', activity: 'none' },
  );
  assert.deepEqual(
    combineVisualSamples([off, on]),
    { availability: 'available', status: 'neutral', activity: 'none' },
  );
});

test('open state, cover travel and presence are separate meanings', () => {
  const h = hass({
    'binary_sensor.window': { state: 'on', attributes: { device_class: 'window' } },
    'binary_sensor.room': { state: 'on', attributes: { device_class: 'occupancy' } },
    'cover.curtain': { state: 'opening' },
    'lock.front': { state: 'unlocked' },
  });
  assert.equal(entityVisualSample(h, 'binary_sensor.window').status, 'open');
  assert.equal(entityVisualSample(h, 'binary_sensor.room').activity, 'presence');
  assert.deepEqual(
    (({ status, activity }) => ({ status, activity }))(entityVisualSample(h, 'cover.curtain')),
    { status: 'neutral', activity: 'transition' },
  );
  assert.equal(entityVisualSample(h, 'lock.front').status, 'open');
});

test('alarm outranks work and unavailable suppresses unavailable-only markers', () => {
  const h = hass({
    'switch.pump': { state: 'on' },
    'binary_sensor.leak': { state: 'on', attributes: { device_class: 'moisture' } },
    'alarm_control_panel.home': { state: 'triggered' },
    'sensor.dead': { state: 'unavailable' },
  });
  const alarm = combineVisualSamples([
    entityVisualSample(h, 'switch.pump'),
    entityVisualSample(h, 'binary_sensor.leak'),
  ]);
  assert.deepEqual(alarm, { availability: 'available', status: 'alarm', activity: 'none' });
  assert.equal(entityVisualSample(h, 'alarm_control_panel.home').status, 'alarm');
  assert.deepEqual(
    combineVisualSamples([entityVisualSample(h, 'sensor.dead')]),
    { availability: 'unavailable', status: 'neutral', activity: 'none' },
  );
});

test('edges suppress first load/recovery and recognise semantic events', () => {
  const motionOn = entityVisualSample(
    hass({ 'binary_sensor.motion': { state: 'on', attributes: { device_class: 'motion' } } }),
    'binary_sensor.motion',
  );
  assert.equal(edgeActivity(undefined, motionOn), null);
  assert.equal(edgeActivity('unavailable', motionOn), null);
  assert.equal(edgeActivity('off', motionOn), 'event');
  assert.equal(edgeActivity('on', motionOn), null);

  const coverOpen = entityVisualSample(
    hass({ 'cover.curtain': { state: 'open' } }),
    'cover.curtain',
  );
  assert.equal(edgeActivity('closed', coverOpen), 'transition');
  assert.equal(edgeActivity('opening', coverOpen), null);

  const button = entityVisualSample(
    hass({ 'event.doorbell': { state: '2026-08-05T18:00:00+00:00' } }),
    'event.doorbell',
  );
  assert.equal(edgeActivity('2026-08-05T17:59:00+00:00', button), 'event');
});
