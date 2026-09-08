import test from 'node:test';
import assert from 'node:assert/strict';

import { radarConfigFromDraft } from '../test-build/radar-editor.js';
import { RadarSetupController } from '../test-build/radar-setup.js';

const draft = () => ({
  original: null, enabled: true, showLive: true, profile: 'presence_v1', roomId: 'living',
  installationId: 'installation-1', mountX: '500', mountY: '500', heading: '0',
  rangeCm: '', fovDeg: '', mirror: false, unit: 'cm', xEntities: [''], yEntities: [''],
  distanceEntity: '', angleEntity: '', angleUnit: 'degrees', angleZero: 'forward',
  angleClockwise: true, occupancyEntity: 'binary_sensor.presence', countEntity: '',
  zoneEntity: '', zoneKind: 'occupancy',
});

const pointer = (x, y) => ({
  clientX: x, clientY: y,
  currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 }) },
});

test('on-plan installation changes only the editor draft until ordinary Save', () => {
  let applied = null;
  const controller = new RadarSetupController({
    hass: () => ({}), requestUpdate() {}, t: (key) => key,
    configFromDraft: radarConfigFromDraft, apply: (next) => { applied = next; },
    confirmDiscard: async () => true,
  });
  assert.equal(controller.begin('radar', draft(), {
        id: 'living', name: 'Living', poly: [[0, 0], [1, 0], [1, 1], [0, 1]],
  }, 5, 7), true);
  assert.equal(controller.isDirty(), false, 'an untouched setup may close synchronously');
  controller.choosePoint(pointer(250, 400));
  assert.equal(controller.isDirty(), true, 'placing the mount makes the setup discard-sensitive');
  controller.choosePoint(pointer(250, 100));
  assert.equal(applied, null, 'the setup surface must not persist or apply before confirmation');
  controller.apply();
  assert.equal(applied.mountX, '250');
  assert.equal(applied.mountY, '400');
  assert.equal(applied.heading, '0');
  assert.deepEqual(applied.calibrationOverride, {
    method: 'not_required', mirror: false, cell_cm: 5,
  });
  assert.equal(radarConfigFromDraft(applied, 5).mount.x, .25);
});

test('cancelling calibration releases its draft subscription exactly once', async () => {
  const controller = new RadarSetupController({
    hass: () => ({}), requestUpdate() {}, t: (key) => key,
    configFromDraft: radarConfigFromDraft, apply() {}, confirmDiscard: async () => true,
  });
  assert.equal(controller.begin('radar', draft(), {
    id: 'living', name: 'Living', poly: [[0, 0], [1, 0], [1, 1]],
  }, 5, 7), true);
  let calls = 0;
  controller.unsubscribe = () => { calls += 1; };
  assert.equal(await controller.cancel(), true);
  assert.equal(await controller.cancel(), true);
  assert.equal(calls, 1);
  assert.equal(controller.isDirty(), false);
});

test('dirty calibration stays open when discard confirmation is rejected', async () => {
  let confirmations = 0;
  const controller = new RadarSetupController({
    hass: () => ({}), requestUpdate() {}, t: (key) => key,
    configFromDraft: radarConfigFromDraft, apply() {},
    confirmDiscard: async () => { confirmations += 1; return false; },
  });
  assert.equal(controller.begin('radar', draft(), {
    id: 'living', name: 'Living', poly: [[0, 0], [1, 0], [1, 1]],
  }, 5, 7), true);
  controller.choosePoint(pointer(250, 400));
  let cleanups = 0;
  controller.unsubscribe = () => { cleanups += 1; };

  assert.equal(await controller.cancel(), false);
  assert.equal(confirmations, 1);
  assert.equal(cleanups, 0);
  assert.ok(controller.active);
});

test('calibration reports bad reference placement separately from a measurement mismatch', () => {
  const controller = new RadarSetupController({
    hass: () => ({}), requestUpdate() {}, t: (key) => key,
    configFromDraft: radarConfigFromDraft, apply() {}, confirmDiscard: async () => true,
  });
  assert.equal(controller.begin('radar', draft(), {
    id: 'living', name: 'Living', poly: [[0, 0], [1, 0], [1, 1]],
  }, 5, 7), true);
  const plan = (x, y) => [.5 + x / 1200, .5 - y / 1200];
  controller.active.mount = [.5, .5];
  controller.active.refs = [
    { local: [100, 0], plan: plan(100, 0) },
    { local: [200, 0], plan: plan(200, 0) },
  ];
  controller.solve();
  assert.equal(controller.active.error, 'radar.bad_references');

  controller.active.refs = [
    { local: [100, 0], plan: plan(100, 0) },
    { local: [0, 100], plan: plan(-50, 86.603) },
  ];
  controller.solve();
  assert.equal(controller.active.error, 'radar.bad_fit');
});
