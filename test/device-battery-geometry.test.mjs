import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deviceBatteryGeometry, deviceBatteryShadow, withDeviceBatteryBounds,
} from '../test-build/device-battery-geometry.js';

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

test('#806 approved battery shadow scales continuously through the two reviewed sizes', () => {
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
  for (const [frame, x, y, blur] of [
    [19, .7, 1.8, 1.3],
    [56, 1.6, 3.6, 3.2],
  ]) {
    const shadow = deviceBatteryShadow(frame);
    close(shadow.x, x);
    close(shadow.y, y);
    close(shadow.blur, blur);
  }
  assert.deepEqual(deviceBatteryShadow(0), { x: 0, y: 0, blur: 0 });
  assert.deepEqual(deviceBatteryShadow(NaN), { x: 0, y: 0, blur: 0 });
  for (let frame = 19; frame < 56; frame++) {
    const before = deviceBatteryShadow(frame);
    const after = deviceBatteryShadow(frame + 1);
    assert.ok(after.x > before.x && after.y > before.y && after.blur > before.blur);
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
    const { frame, gap } = deviceBatteryGeometry(56);
    const shadow = deviceBatteryShadow(frame);
    const spread = shadow.blur * 3;
    const center = (shell.top + shell.bottom) / 2;
    assert.equal(bounds.left, Math.min(shell.left, shell.right + gap + shadow.x - spread));
    assert.equal(bounds.right, Math.max(shell.right, shell.right + gap + frame + shadow.x + spread));
    assert.equal(bounds.top, Math.min(shell.top, center - frame / 2 + shadow.y - spread));
    assert.equal(bounds.bottom, Math.max(shell.bottom, center + frame / 2 + shadow.y + spread));
  }
});
