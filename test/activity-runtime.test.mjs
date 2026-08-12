import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_REPAINT_DELAY_MS,
  ACTIVITY_WINDOW_MS,
  advanceFiniteActivity,
  createFiniteActivityRuntime,
  resetFiniteActivityRuntime,
  stampFiniteActivity,
} from '../test-build/activity-runtime.js';

const sample = (eid, state, extra = {}) => ({
  eid, state, availability: 'available', status: 'neutral', activity: 'none',
  edge: 'none', ...extra,
});

test('finite activity establishes baselines and reports the same witnessed edge to every renderer', () => {
  const runtime = createFiniteActivityRuntime('binary_sensor.motion', [sample('binary_sensor.motion', 'off')]);
  const cleared = [];
  const clear = (timer) => cleared.push(timer);
  assert.equal(advanceFiniteActivity(runtime, [sample('binary_sensor.motion', 'on', { edge: 'rising' })], clear), 'event');

  let delay = 0;
  stampFiniteActivity(runtime, 'event', 1000, clear, (ms) => { delay = ms; return 7; });
  assert.equal(runtime.expiresAt, 1000 + ACTIVITY_WINDOW_MS);
  assert.equal(runtime.timer, 7);
  assert.equal(delay, ACTIVITY_REPAINT_DELAY_MS);

  // A lower-priority transition in the same window cannot replace the event.
  stampFiniteActivity(runtime, 'transition', 1100, clear, () => 8);
  assert.equal(runtime.flashKind, 'event');
  assert.equal(runtime.timer, 7);
});

test('alarm and source replacement reset finite history without a synthetic event', () => {
  const runtime = createFiniteActivityRuntime('binary_sensor.alarm', [sample('binary_sensor.alarm', 'off')]);
  assert.equal(advanceFiniteActivity(runtime, [sample('binary_sensor.alarm', 'on', {
    status: 'alarm', isAlarm: true,
  })], () => {}), null);
  assert.equal(runtime.alarmActive, true);

  assert.equal(advanceFiniteActivity(runtime, [sample('binary_sensor.alarm', 'off')], () => {}), null);
  assert.equal(runtime.alarmActive, false);

  resetFiniteActivityRuntime(runtime, 'binary_sensor.rebound', [sample('binary_sensor.rebound', 'on', {
    edge: 'rising',
  })], () => {});
  assert.equal(runtime.flashKind, null);
  assert.equal(runtime.last['binary_sensor.rebound'], 'on');
});
