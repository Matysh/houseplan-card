import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DEVICE_BASE_SIZE,
  DEVICE_PREVIEW_BASE_PX,
  effectiveDeviceBaseSize,
} from '../test-build/device-marker-geometry.js';

test('issue 213 resolves compatibility size units once at the surface boundary', () => {
  assert.equal(DEFAULT_DEVICE_BASE_SIZE, 2.25);
  assert.equal(DEVICE_PREVIEW_BASE_PX, 48.6);
  assert.equal(effectiveDeviceBaseSize(2.5), 2.25);
  assert.equal(effectiveDeviceBaseSize(4), 3.6);
  assert.equal(effectiveDeviceBaseSize(5) / effectiveDeviceBaseSize(2.5), 2);
  assert.equal(effectiveDeviceBaseSize(Number.NaN), 2.25);
});
