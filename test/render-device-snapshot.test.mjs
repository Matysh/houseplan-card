import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createRenderDeviceSnapshot, presentationSnapshotKey, renderDeviceSnapshotPositions,
} from '../test-build/render-device-snapshot.js';
import { readHouseplanProductionSource } from './houseplan-source.mjs';
import { createDeviceBatteryContext } from '../test-build/device-battery.js';
import { resolveDevicePresentation } from '../test-build/device-presentation.js';
import { classifyHassRenderChange } from '../test-build/render-invalidation.js';

test('#792 opt-out skips battery indexing and extra tick dependencies, not ordinary sources', () => {
  // The diagnostic sibling deliberately precedes the bound entity and has no
  // plan Area: ordinary projection alone does not need this separate source.
  const ha = {
    entities: {
      'sensor.charge': { device_id: 'physical', device_class: 'battery' },
      'binary_sensor.motion': { device_id: 'physical' },
    },
    devices: { physical: {} },
    states: {
      'sensor.charge': { state: '70', attributes: { device_class: 'battery' } },
      'binary_sensor.motion': { state: 'off', attributes: {} },
    },
  };
  const device = {
    id: 'marker', bindingKind: 'entity', bindingRef: 'binary_sensor.motion',
    bindingStatus: { kind: 'active' }, entities: ['binary_sensor.motion'],
  };
  const next = { ...ha, states: { ...ha.states,
    'sensor.charge': { state: '10', attributes: { device_class: 'battery' } },
  } };
  const options = { sourceSequence: 1, hass: ha, devices: [device], presentations: new Map() };
  const disabled = createRenderDeviceSnapshot({ ...options, showBattery: false,
    get batteryContext() { throw new Error('opt-out must not access the battery index'); },
  });
  assert.equal(disabled.entityIds.includes('sensor.charge'), false);
  assert.equal(classifyHassRenderChange(ha, next, disabled), 'none');
  const enabled = createRenderDeviceSnapshot(options);
  assert.equal(enabled.entityIds.includes('sensor.charge'), true);
  assert.equal(classifyHassRenderChange(ha, next, enabled), 'state');
  const ordinarySource = createRenderDeviceSnapshot({ ...options, showBattery: false,
    entityIds: ['sensor.charge'],
  });
  assert.equal(classifyHassRenderChange(ha, next, ordinarySource), 'state',
    'the same entity remains live when an ordinary badge/room source requires it');
});

test('#792 entity marker snapshot captures earlier unplaced battery siblings atomically', () => {
  const device = {
    id: 'marker', name: 'Motion', icon: 'mdi:motion-sensor', space: 'floor',
    entities: ['binary_sensor.motion'], primary: 'binary_sensor.motion',
    bindingKind: 'entity', bindingRef: 'binary_sensor.motion',
    marker: { id: 'marker', binding: 'entity:binary_sensor.motion' },
    bindingStatus: { kind: 'active' },
  };
  const ha = {
    entities: {
      'sensor.charge': { device_id: 'physical', device_class: 'battery' },
      'binary_sensor.motion': { device_id: 'physical' },
      'sensor.other': { device_id: 'other', device_class: 'battery' },
    },
    states: {
      'sensor.charge': { state: '70', attributes: { device_class: 'battery' } },
      'binary_sensor.motion': { state: 'off', attributes: {} },
      'sensor.other': { state: '5', attributes: { device_class: 'battery' } },
    },
    devices: { physical: {} },
  };
  const context = createDeviceBatteryContext(ha);
  const presentation = resolveDevicePresentation(ha, device, {
    liveStates: true, showTemperature: false, showSignal: false, batteryContext: context,
  });
  const snapshot = createRenderDeviceSnapshot({
    sourceSequence: 1, hass: ha, devices: [device], batteryContext: context,
    presentations: new Map([['marker:0', presentation]]),
  });
  assert.ok(snapshot.entityIds.includes('sensor.charge'));
  assert.ok(!snapshot.entityIds.includes('sensor.other'));
  assert.deepEqual(snapshot.devices[0].entities, ['binary_sensor.motion']);
  ha.states['sensor.charge'].state = '10';
  assert.equal(snapshot.hass.states['sensor.charge'].state, '70');
  assert.equal(snapshot.presentations.get('marker:0').battery.state, 'normal');
  const next = resolveDevicePresentation(ha, device, {
    liveStates: true, showTemperature: false, showSignal: false,
  });
  assert.equal(next.battery.state, 'low');
});

test('snapshot positions skip resolution until a renderable plan exists', () => {
  const devices = [{ id: 'one' }, { id: 'two' }];
  let calls = 0;
  const empty = renderDeviceSnapshotPositions(false, devices, () => {
    calls++;
    throw new Error('a missing plan has no position geometry');
  });

  assert.equal(empty.size, 0);
  assert.equal(calls, 0, 'the resolver is not called without a plan model');

  const positions = renderDeviceSnapshotPositions(true, devices, (device) => {
    calls++;
    return device.id === 'one' ? { x: 12, y: 34 } : { x: 56, y: 78 };
  });

  assert.equal(calls, 2);
  assert.deepEqual([...positions], [
    ['one', { x: 12, y: 34 }],
    ['two', { x: 56, y: 78 }],
  ]);
});

test('RenderDeviceSnapshot keeps immutable facts and excludes live HA capabilities', () => {
  const state = { entity_id: 'light.one', state: 'on', attributes: { brightness: 120 } };
  const device = { id: 'one', space: 'floor', entities: ['light.one'], icon: 'mdi:lightbulb' };
  const presentation = { icon: 'mdi:lightbulb', valueText: null, visual: { status: 'working' } };
  const snapshot = createRenderDeviceSnapshot({
    sourceSequence: 7,
    hass: {
      states: { 'light.one': state }, entities: {}, devices: {},
      connection: { live: true }, callService: () => undefined,
    },
    devices: [device],
    positions: new Map([['one', { x: 12, y: 34 }]]),
    presentations: new Map([[presentationSnapshotKey('one', true), presentation]]),
    facts: new Map([['vacuum:one', { moving: true }]]),
  });

  state.attributes.brightness = 1;
  device.entities.push('switch.other');
  presentation.visual.status = 'neutral';

  assert.equal(snapshot.sourceSequence, 7);
  assert.equal(snapshot.hass.connection, undefined);
  assert.equal(snapshot.hass.callService, undefined);
  assert.equal(snapshot.hass.states['light.one'].attributes.brightness, 120);
  assert.deepEqual(snapshot.devices[0].entities, ['light.one']);
  assert.deepEqual(snapshot.positions.get('one'), { x: 12, y: 34 });
  assert.equal(snapshot.presentations.get(presentationSnapshotKey('one', true)).visual.status, 'working');
  assert.equal(snapshot.facts.get('vacuum:one').moving, true);
  assert.deepEqual([...snapshot.entityIds], ['light.one']);
  assert.equal('set' in snapshot.positions, false);
  assert.equal('set' in snapshot.presentations, false);
  assert.equal('set' in snapshot.facts, false);
  assert.equal('add' in snapshot.entityIds, false);
});

test('RenderDeviceSnapshot exposes one immutable vacuum-only roster subset', () => {
  const devices = [
    { id: 'lamp', entities: ['light.lamp'] },
    { id: 'robot', entities: ['vacuum.robot'] },
    { id: 'sensor', entities: ['sensor.temp'] },
  ];
  const snapshot = createRenderDeviceSnapshot({
    sourceSequence: 8,
    hass: { states: {}, entities: {}, devices: {} },
    devices,
    presentations: new Map(),
    facts: new Map([['vacuum:robot', { moving: false }]]),
  });

  devices[1].entities.push('camera.late');
  assert.deepEqual(snapshot.vacuumDevices.map((device) => device.id), ['robot']);
  assert.equal(snapshot.vacuumDevices[0], snapshot.devices[1], 'subset reuses the same cloned row');
  assert.deepEqual(snapshot.vacuumDevices[0].entities, ['vacuum.robot']);
  assert.ok(Object.isFrozen(snapshot.vacuumDevices));
  assert.throws(() => snapshot.vacuumDevices.push({ id: 'late' }), TypeError);
});

const methodBody = (source, name) => {
  const start = source.search(new RegExp(`private\\s+(?:async\\s+)?${name}\\(`));
  assert.notEqual(start, -1, `${name} exists`);
  const tail = source.slice(start + 1);
  const next = tail.search(/\n  (?:private|protected|public)\s/);
  return source.slice(start, next < 0 ? source.length : start + 1 + next);
};

test('atomic plan render paths do not bypass RenderDeviceSnapshot with this.hass', () => {
  const source = readHouseplanProductionSource();
  // #624: `_sunNow` был мёртвым методом (никто не звал) и снят; путь солнца
  // читает состояние через `_renderSunRays`, который остаётся в списке.
  for (const name of [
    '_roomLqi', '_resolvedRoomFills', '_renderSunRays', '_renderGlowLayer',
    '_renderVacuums', '_renderVacFit', '_renderDevice', '_roomTemp', '_roomHum', '_openingAmt',
    '_renderOpeningLocks', '_renderDecorLayer',
  ]) {
    assert.doesNotMatch(methodBody(source, name), /this\.hass\b/, name);
  }
});

test('the card gates snapshot positions on the render model', () => {
  const source = readHouseplanProductionSource();
  const capture = methodBody(source, '_captureRenderDeviceSnapshot');
  assert.match(
    capture,
    /positions:\s*renderDeviceSnapshotPositions\(\s*this\._model\.length > 0,/s,
    'the empty-plan predicate is the same render-model predicate used by the empty state',
  );
  assert.doesNotMatch(
    capture,
    /positions:\s*new Map\(this\._devices\.map\(/,
    'the previous unconditional position path must not return',
  );
  assert.match(
    capture,
    /this\._summary\?\.entityIds\(\)/,
    '#490 summary-only HA sources join the one render dependency projection',
  );
});

test('opening references use their own availability policy without weakening plan tombstones', () => {
  const source = readHouseplanProductionSource();
  for (const name of [
    '_contactCandidates', '_lockCandidates', '_openingAmt', '_renderOpenings',
    '_renderOpeningLocks', '_renderOpeningInfoCard', '_lockAction',
  ]) {
    assert.match(
      methodBody(source, name),
      /_openingEntityAvailable|_renderOpeningEntityAvailable/,
      `${name} uses the explicit opening-reference policy`,
    );
  }
  const planAvailability = methodBody(source, '_planEntityAvailable');
  const renderAvailability = methodBody(source, '_renderEntityAvailable');
  assert.match(planAvailability, /isRemovedPlanEntity/);
  assert.match(renderAvailability, /isRemovedPlanEntity/);
  assert.doesNotMatch(planAvailability, /openingEntityAvailable/);
  assert.doesNotMatch(renderAvailability, /renderOpeningEntityAvailable/);

  const openingRenderAvailability = methodBody(source, '_renderOpeningEntityAvailable');
  assert.match(
    openingRenderAvailability,
    /renderOpeningEntityAvailable\(this\._renderPlanHass, eid\)/,
    'opening render availability receives only the immutable painted-frame projection',
  );
  assert.doesNotMatch(openingRenderAvailability, /this\.hass\b/);
});

test('lock actuation remains guarded inside the one sanctioned opening-card method', () => {
  const source = readHouseplanProductionSource();
  const action = methodBody(source, '_lockAction');
  const guardAt = action.indexOf('_openingEntityAvailable(entityId)');
  const confirmAt = action.indexOf('await this._confirmDanger');
  const recheckAt = action.indexOf('_openingEntityAvailable(entityId)', guardAt + 1);
  const serviceAt = action.indexOf("callService?.('lock'");
  assert.ok(
    guardAt >= 0 && guardAt < confirmAt && confirmAt < recheckAt && recheckAt < serviceAt,
    'unlock revalidates the opening binding and entity after confirmation',
  );
  assert.match(action, /state !== 'locked'/);
  assert.equal(source.match(/callService\?\.\('lock'/g)?.length, 1);
  assert.equal(source.match(/this\._lockAction\(/g)?.length, 1, 'only the opening card button calls it');
});

test('marker delete/re-add and opening save remain separate config transactions', () => {
  const source = readHouseplanProductionSource();
  const saveOpening = methodBody(source, '_saveOpening');
  const saveMarker = methodBody(source, '_saveMarker');
  assert.match(saveOpening, /sp\.openings/);
  assert.doesNotMatch(saveOpening, /cfg\.markers|this\._markers/);
  assert.match(saveMarker, /candidate\.markers/);
  assert.doesNotMatch(saveMarker, /\.openings/);
});
