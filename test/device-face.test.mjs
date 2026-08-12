import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceFaceStyle } from '../test-build/device-face.js';

const face = (rippleColor) => ({
  display: 'icon_ripple', scale: 1,
  pulse: {
    kind: 'continuous', reason: 'running', generation: 1, expiresAt: null,
    color: rippleColor, diameterScale: 3, animated: true, reducedMotionIndicator: 'none',
  },
});

test('device face never emits an arbitrary persisted ripple declaration', () => {
  assert.deepEqual(deviceFaceStyle(face('#12aBcD')), [
    '--ripple-scale:3', '--ripple-color:#12aBcD',
  ]);
  assert.deepEqual(deviceFaceStyle(face('rgb(12, 140, 250)')), [
    '--ripple-scale:3', '--ripple-color:rgb(12, 140, 250)',
  ]);
  const hostile = deviceFaceStyle(face('red;position:fixed;inset:0'));
  assert.deepEqual(hostile, ['--ripple-scale:3']);
  assert.ok(!hostile.join(';').includes('position'));
});
