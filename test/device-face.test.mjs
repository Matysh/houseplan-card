import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deviceFaceStyle, legacySupplementalMetrics, lqiClassName, valueBadgeClassName,
} from '../test-build/device-face.js';

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

test('untouched legacy temperature and humidity keep the second satellite', () => {
  const presentation = {
    valueBadge: {
      configured: false,
      source: { kind: 'temperature', eid: 'sensor.temp' },
      tone: 'temperature',
    },
    tempText: '22.4',
    humText: '48',
  };
  assert.deepEqual(legacySupplementalMetrics(presentation), [
    { kind: 'humidity', text: '48', suffix: '%' },
  ]);
  assert.deepEqual(legacySupplementalMetrics({
    ...presentation,
    valueBadge: { ...presentation.valueBadge, configured: true },
  }), []);
});

test('value badge classes cover all four positions and only bottom displaces LQI', () => {
  for (const position of ['right', 'bottom', 'left', 'top']) {
    const badge = {
      position, availability: 'available', tone: 'default',
    };
    assert.equal(
      valueBadgeClassName(badge),
      `value-badge pos-${position} available tone-default`,
    );
    assert.equal(
      lqiClassName(badge),
      position === 'bottom' ? 'lqi below-value-badge' : 'lqi',
    );
  }
  assert.equal(lqiClassName(null), 'lqi');
});
