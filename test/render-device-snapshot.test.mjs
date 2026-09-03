import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createRenderDeviceSnapshot, presentationSnapshotKey, renderDeviceSnapshotPositions,
} from '../test-build/render-device-snapshot.js';
import { readHouseplanProductionSource } from './houseplan-source.mjs';

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
  assert.equal('set' in snapshot.positions, false);
  assert.equal('set' in snapshot.presentations, false);
  assert.equal('set' in snapshot.facts, false);
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
  for (const name of [
    '_roomLqi', '_resolvedRoomFills', '_sunNow', '_renderSunRays', '_renderGlowLayer',
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
  assert.match(saveMarker, /cfg\.markers/);
  assert.doesNotMatch(saveMarker, /\.openings/);
});
