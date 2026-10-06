import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceBatteryGeometry, withDeviceBatteryBounds } from '../test-build/device-battery-geometry.js';

test('#792 battery geometry uses outer-shell diameter and exact designer control points', () => {
  for (const [diameter, frame, gap] of [[32, 19, 2], [56, 33, 4], [96, 56, 7]]) {
    assert.deepEqual(deviceBatteryGeometry(diameter), { frame, gap });
  }
  assert.deepEqual(deviceBatteryGeometry(0), { frame: 0, gap: 0 });
  assert.deepEqual(deviceBatteryGeometry(-4), { frame: 0, gap: 0 });
  assert.deepEqual(deviceBatteryGeometry(NaN), { frame: 0, gap: 0 });
  for (const diameter of [16, 32, 44, 56, 76, 96, 144]) {
    const before = deviceBatteryGeometry(diameter - .001);
    const after = deviceBatteryGeometry(diameter + .001);
    assert.ok(after.frame > before.frame && after.frame - before.frame < .002);
    assert.ok(after.gap > before.gap && after.gap - before.gap < .001);
  }
});

test('#792 fit extent adds the battery to the whole asymmetric capsule without moving the shell', () => {
  for (const shell of [
    { left: -28, right: 28, top: -28, bottom: 28 },
    { left: -28, right: 150, top: -28, bottom: 28 },
    { left: -150, right: 28, top: -28, bottom: 28 },
    { left: -65, right: 65, top: -28, bottom: 100 },
    { left: -65, right: 65, top: -100, bottom: 28 },
  ]) {
    const copy = { ...shell };
    const bounds = withDeviceBatteryBounds(shell, 56);
    assert.deepEqual(shell, copy, 'the frame is read-only');
    assert.equal(bounds.left, shell.left);
    assert.equal(bounds.right, shell.right + 4 + 33);
    assert.equal(bounds.top, shell.top);
    assert.equal(bounds.bottom, shell.bottom);
  }
});
