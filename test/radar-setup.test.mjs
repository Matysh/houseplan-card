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
  });
  assert.equal(controller.begin('radar', draft(), {
    id: 'living', name: 'Living', poly: [[0, 0], [1, 0], [1, 1], [0, 1]],
  }, 5, 7), true);
  controller.choosePoint(pointer(250, 400));
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

test('cancelling calibration releases its draft subscription exactly once', () => {
  const controller = new RadarSetupController({
    hass: () => ({}), requestUpdate() {}, t: (key) => key,
    configFromDraft: radarConfigFromDraft, apply() {},
  });
  assert.equal(controller.begin('radar', draft(), {
    id: 'living', name: 'Living', poly: [[0, 0], [1, 0], [1, 1]],
  }, 5, 7), true);
  let calls = 0;
  controller.unsubscribe = () => { calls += 1; };
  assert.equal(controller.cancel(), true);
  assert.equal(controller.cancel(), false);
  assert.equal(calls, 1);
});
