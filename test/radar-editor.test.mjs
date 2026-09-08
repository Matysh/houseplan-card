import test from 'node:test';
import assert from 'node:assert/strict';

import {
  freshRadarInstallationId, radarAfterBindingChange, radarConfigFromDraft, radarDraft,
  radarSourceCandidates, recognizeRadar,
} from '../test-build/radar-editor.js';

const space = { id: 'floor', title: 'Floor', cellCm: 5, rooms: [
  { id: 'living', name: 'Living room', poly: [[0, 0], [1000, 0], [1000, 1000]] },
] };
const device = (overrides = {}) => ({
  id: 'd1', name: 'Presence', space: 'floor', area: '', entities: [], allEntities: [],
  bindingKind: 'device', bindingRef: 'dev1', marker: { id: 'd1', binding: 'device:dev1', space: 'floor' },
  ...overrides,
});

test('LD2450 exact role suffixes identify and prefill at most three slots', () => {
  const radar = device({ allEntities: [
    'sensor.office_target_1_x', 'sensor.office_target_1_y',
    'sensor.office_target_2_x', 'sensor.office_target_2_y',
    'sensor.office_target_count',
  ], model: 'HLK-LD2450', marker: {
    id: 'd1', binding: 'device:dev1', space: 'floor', room_id: 'living',
  } });
  assert.deepEqual(recognizeRadar(radar, {}), {
    eligible: true, profile: 'esphome_ld2450_v1', reason: 'ld2450',
  });
  const states = Object.fromEntries(radar.allEntities.map((entityId) => [entityId, { state: '0' }]));
  const draft = radarDraft(radar, space, [500, 500], { states });
  assert.ok(draft);
  assert.equal(draft.enabled, false);
  assert.equal(draft.xEntities[0], 'sensor.office_target_1_x');
  assert.equal(draft.yEntities[1], 'sensor.office_target_2_y');
  assert.equal(draft.xEntities.length, 3);
  assert.equal(radarConfigFromDraft(draft, 5).mount.x, .5);
});

test('ordinary devices stay hidden until explicit manual declaration', () => {
  const ordinary = device({ name: 'Kitchen light', allEntities: ['light.kitchen'] });
  assert.equal(recognizeRadar(ordinary, {}).eligible, false);
  assert.equal(radarDraft(ordinary, space, [50, 60], {}), null);
  const draft = radarDraft(ordinary, space, [50, 60], {}, true);
  assert.ok(draft);
  assert.equal(draft.enabled, false);
  assert.equal(draft.profile, 'presence_v1');
});

test('coordinate-looking entity names alone do not claim an LD2450 adapter', () => {
  const ordinary = device({ allEntities: [
    'sensor.machine_target_1_x', 'sensor.machine_target_1_y',
  ] });
  assert.equal(recognizeRadar(ordinary, {}).eligible, false);
  const fuzzy = device({ model: 'Presence Radar FP2', allEntities: [
    'sensor.machine_target_1_x', 'sensor.machine_target_1_y',
  ] });
  assert.equal(recognizeRadar(fuzzy, {}).eligible, false);
});

test('rebinding preserves only an already-saved radar and a new installation gets a new id', () => {
  const pending = radarDraft(device(), space, [50, 60], {}, true);
  assert.deepEqual(radarAfterBindingChange(pending, true, false), {
    radar: null, radarEligible: false, radarTouched: true, radarRemove: true,
  });
  const saved = { ...pending, original: { version: 1 } };
  assert.deepEqual(radarAfterBindingChange(saved, false, false), {
    radar: saved, radarEligible: true, radarTouched: false, radarRemove: false,
  });
  assert.notEqual(freshRadarInstallationId(), freshRadarInstallationId());
});

test('manual exact sources may come from separate HA devices', () => {
  const candidates = radarSourceCandidates(device({ allEntities: ['sensor.own'] }), {
    states: { 'sensor.z': {}, 'sensor.other_x': {},
      'binary_sensor.other_presence': {}, 'switch.no': {} },
  });
  assert.deepEqual(candidates.numeric, ['sensor.other_x', 'sensor.z']);
  assert.deepEqual(candidates.binary, ['binary_sensor.other_presence']);
});

test('saved future stage siblings survive a stage-one edit', () => {
  const original = {
    version: 1, enabled: true, profile: 'cartesian_v1', room_id: 'living',
    sources: { slots: [{ id: 'target_1', x_entity: 'sensor.x', y_entity: 'sensor.y', unit: 'cm' }] },
    mount: { installation_id: 'install', x: 5, y: 6, heading_deg: 0 },
    calibration: { method: 'manual', mirror: false, cell_cm: 5 },
    zones: { local: [{ future: true }] }, future: { sentinel: 7 },
  };
  const d = device({ marker: { ...device().marker, radar: original } });
  const draft = radarDraft(d, space, [100, 100], {});
  const saved = radarConfigFromDraft({ ...draft, heading: '90' }, 5);
  assert.equal(saved.future.sentinel, 7);
  assert.deepEqual(saved.zones, original.zones);
  assert.equal(saved.mount.heading_deg, 90);
  assert.equal(saved.show_live, undefined);
  assert.equal(saved.mount.x, original.mount.x);
});

test('an unrelated edit preserves accepted two-point calibration', () => {
  const original = {
    version: 1, enabled: true, show_live: false,
    profile: 'cartesian_v1', room_id: 'living',
    sources: { slots: [{ id: 'target_1', x_entity: 'sensor.x', y_entity: 'sensor.y', unit: 'cm' }] },
    mount: { installation_id: 'install', x: .5, y: .5, heading_deg: 90 },
    calibration: { method: 'two_point', mirror: true, cell_cm: 5,
      refs: [
        { plan: { x: .5, y: .5 - 100 / 1200 }, local_cm: { x: 100, y: 0 } },
        { plan: { x: .5 + 100 / 1200, y: .5 }, local_cm: { x: 0, y: 100 } },
      ], rms_cm: 0 },
  };
  const configured = device({ marker: { ...device().marker, radar: original } });
  const draft = radarDraft(configured, space, [0, 0], {});
  const saved = radarConfigFromDraft({ ...draft, showLive: true }, 5);
  assert.equal(saved.calibration.method, 'two_point');
  assert.deepEqual(saved.calibration.refs, original.calibration.refs);
  assert.equal(saved.show_live, undefined);
});

test('polar conventions are explicit and round-trip through the editor', () => {
  const original = {
    version: 1, enabled: true, profile: 'polar_v1', room_id: 'living',
    sources: { slots: [{ id: 'target_1', distance_entity: 'sensor.distance',
      angle_entity: 'sensor.angle', unit: 'm', angle_unit: 'radians',
      angle_zero: 'right', angle_clockwise: false }] },
    mount: { installation_id: 'install', x: .2, y: .3, heading_deg: 15 },
    calibration: { method: 'manual', mirror: false, cell_cm: 5 },
  };
  const configured = device({ marker: { ...device().marker, radar: original } });
  const draft = radarDraft(configured, space, [0, 0], {});
  assert.equal(draft.angleUnit, 'radians');
  assert.equal(draft.angleZero, 'right');
  assert.equal(draft.angleClockwise, false);
  assert.deepEqual(radarConfigFromDraft(draft, 5).sources.slots[0], original.sources.slots[0]);
});

test('generic Cartesian axis mapping and per-slot gate round-trip exactly', () => {
  const original = {
    version: 1, enabled: true, profile: 'cartesian_v1', room_id: 'living',
    sources: { slots: [{ id: 'target_1', x_entity: 'sensor.raw_a', y_entity: 'sensor.raw_b',
      unit: 'ft', swap_xy: true, x_sign: -1, y_sign: -1,
      presence_entity: 'binary_sensor.slot_1' }],
      availability_entity: 'binary_sensor.radar_online' },
    mount: { installation_id: 'install', x: .2, y: .3, heading_deg: 15 },
    calibration: { method: 'manual', mirror: false, cell_cm: 5 },
  };
  const draft = radarDraft(device({ marker: { ...device().marker, radar: original } }), space, [0, 0], {});
  const saved = radarConfigFromDraft(draft, 5);
  assert.deepEqual(saved.sources.slots[0], original.sources.slots[0]);
  assert.equal(saved.sources.availability_entity, 'binary_sensor.radar_online');
});

test('polar and range profiles persist every supported channel', () => {
  const base = radarDraft(device(), space, [500, 500], {}, true);
  const polar = radarConfigFromDraft({
    ...base, roomId: 'living', profile: 'polar_v1', distanceEntities: ['sensor.d1', 'sensor.d2'],
    angleEntities: ['sensor.a1', 'sensor.a2'], slotPresenceEntities: ['', 'binary_sensor.p2'],
  }, 5);
  assert.equal(polar.sources.slots.length, 2);
  assert.equal(polar.sources.slots[1].presence_entity, 'binary_sensor.p2');
  const ranges = radarConfigFromDraft({
    ...base, roomId: 'living', profile: 'range_v1', rangeEntities: ['sensor.near', 'sensor.far'],
    rangePresenceEntities: ['binary_sensor.moving', 'binary_sensor.still'],
  }, 5);
  assert.equal(ranges.sources.ranges.length, 2);
  assert.equal(ranges.sources.ranges[1].presence_entity, 'binary_sensor.still');
});
