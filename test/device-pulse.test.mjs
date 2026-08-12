import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDevicePulse } from '../test-build/device-pulse.js';

const visual = (status = 'neutral', activity = 'none') => ({
  availability: 'available', status, activity,
});

const resolve = (overrides = {}) => resolveDevicePulse({
  display: 'icon_ripple', visual: visual(), semanticActivity: 'none',
  liveStates: true, effectiveHidden: false, now: 1_000,
  ...overrides,
});

test('pulse priority is hidden/static, alarm, finite event, continuous state', () => {
  assert.equal(resolve({ effectiveHidden: true, visual: visual('alarm') }).kind, 'none');
  assert.equal(resolve({ display: 'static_icon', visual: visual('alarm') }).kind, 'none');
  assert.equal(resolve({ display: 'badge', visual: visual('alarm') }).kind, 'alarm');
  assert.equal(resolve({
    shortReason: 'event', shortExpiresAt: 2_000, semanticActivity: 'running',
  }).kind, 'short');
  assert.equal(resolve({ semanticActivity: 'presence' }).kind, 'continuous');
});

test('ordinary activity belongs only to icon plus activity mode', () => {
  for (const display of ['badge', 'value']) {
    assert.equal(resolve({ display, semanticActivity: 'running' }).kind, 'none');
  }
  assert.equal(resolve({ display: 'icon_ripple', semanticActivity: 'running' }).kind, 'continuous');
  assert.equal(resolve({ liveStates: false, semanticActivity: 'running' }).kind, 'none');
});

test('reduced motion replaces ordinary waves with a dot and keeps alarm semantic', () => {
  const ordinary = resolve({
    semanticActivity: 'running', reducedMotion: true,
    color: '#123456', diameterScale: 5,
  });
  assert.equal(ordinary.animated, false);
  assert.equal(ordinary.reducedMotionIndicator, 'dot');
  assert.equal(ordinary.color, null);
  assert.equal(ordinary.diameterScale, 1);
  const alarm = resolve({
    visual: visual('alarm'), reducedMotion: true,
    color: '#123456', diameterScale: 5,
  });
  assert.equal(alarm.kind, 'alarm');
  assert.equal(alarm.animated, false);
  assert.equal(alarm.reducedMotionIndicator, 'none');
  assert.equal(alarm.color, '#f25a4a');
  assert.equal(alarm.diameterScale, 3);
});

test('expired finite runtime never leaves a static ring', () => {
  const pulse = resolve({ shortReason: 'event', shortExpiresAt: 999 });
  assert.equal(pulse.kind, 'none');
});

test('inactive projection retains configured preview colour and diameter', () => {
  const pulse = resolve({
    color: '#123456', diameterScale: 4.25,
  });
  assert.equal(pulse.kind, 'none');
  assert.equal(pulse.color, '#123456');
  assert.equal(pulse.diameterScale, 4.25);
});
