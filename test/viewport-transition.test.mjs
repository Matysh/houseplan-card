import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CameraTransitionController,
  cameraTargetAtAnchor,
  interpolateCameraState,
  sameCameraState,
  validCameraState,
} from '../test-build/viewport-transition.js';

const camera = (zoom, x, y, w, h) => ({ zoom, viewBox: { x, y, w, h } });

function fakeClock() {
  let now = 0;
  let sequence = 0;
  const callbacks = new Map();
  return {
    clock: {
      now: () => now,
      requestFrame: (callback) => { callbacks.set(++sequence, callback); return sequence; },
      cancelFrame: (handle) => callbacks.delete(handle),
    },
    callbacks,
    step(time) {
      now = time;
      const entry = callbacks.entries().next().value;
      assert.ok(entry, 'one animation frame is scheduled');
      callbacks.delete(entry[0]);
      entry[1](time);
    },
  };
}

test('camera interpolation uses perceptual zoom, linear center and exact endpoints', () => {
  const from = camera(1, 0, 0, 800, 600);
  const to = camera(4, 500, 350, 200, 150);
  assert.deepEqual(interpolateCameraState(from, to, 0), from);
  assert.deepEqual(interpolateCameraState(from, to, 1), to);
  const mid = interpolateCameraState(from, to, 0.5);
  assert.ok(mid.zoom > 1 && mid.zoom < 4);
  assert.ok(mid.viewBox.w < 800 && mid.viewBox.w > 200);
  assert.equal(mid.viewBox.w / mid.viewBox.h, 4 / 3);
  assert.ok(mid.viewBox.x > from.viewBox.x && mid.viewBox.x < to.viewBox.x);
});

test('anchor target preserves the presented world point without clamp', () => {
  const from = camera(1, 100, 40, 800, 600);
  const fit = { x: 0, y: 0, w: 800, h: 600 };
  const target = cameraTargetAtAnchor(from, 2, fit, 800, 600, 120, 450);
  assert.ok(target);
  const before = [
    from.viewBox.x + 120 / 800 * from.viewBox.w,
    from.viewBox.y + 450 / 600 * from.viewBox.h,
  ];
  const after = [
    target.viewBox.x + 120 / 800 * target.viewBox.w,
    target.viewBox.y + 450 / 600 * target.viewBox.h,
  ];
  assert.ok(Math.abs(before[0] - after[0]) < 1e-9);
  assert.ok(Math.abs(before[1] - after[1]) < 1e-9);
});

test('controller settles exactly and owns one RAF', () => {
  const fake = fakeClock();
  const frames = [];
  const settled = [];
  const controller = new CameraTransitionController({
    frame: (state) => frames.push(state.presented),
    settled: (state) => settled.push(state.presented),
  }, fake.clock);
  const from = camera(1, 0, 0, 800, 600);
  const to = camera(2, 200, 150, 400, 300);
  controller.start(from, to, 'button', 100);
  assert.equal(controller.active, true);
  assert.equal(fake.callbacks.size, 1);
  fake.step(50);
  assert.equal(fake.callbacks.size, 1);
  assert.ok(frames.at(-1).zoom > 1 && frames.at(-1).zoom < 2);
  fake.step(100);
  assert.deepEqual(settled, [to]);
  assert.equal(controller.active, false);
  assert.equal(fake.callbacks.size, 0);
});

test('retarget starts from presented state and cancels the obsolete RAF', () => {
  const fake = fakeClock();
  const frames = [];
  const controller = new CameraTransitionController({
    frame: (state) => frames.push(state.presented),
    settled: () => {},
  }, fake.clock);
  const from = camera(1, 0, 0, 800, 600);
  const first = camera(2, 200, 150, 400, 300);
  const reversed = camera(0.75, -133, -100, 1066, 800);
  controller.start(from, first, 'wheel', 100);
  fake.step(40);
  const presented = controller.presented;
  assert.ok(presented);
  controller.start(presented, reversed, 'wheel', 100);
  assert.deepEqual(frames.at(-1), presented);
  assert.equal(fake.callbacks.size, 1);
  assert.deepEqual(controller.target, reversed);
});

test('cancel policies either freeze or commit one exact target', () => {
  const fake = fakeClock();
  const settled = [];
  const controller = new CameraTransitionController({
    frame: () => {},
    settled: (state) => settled.push(state.presented),
  }, fake.clock);
  const from = camera(1, 0, 0, 800, 600);
  const to = camera(2, 200, 150, 400, 300);
  controller.start(from, to, 'fit', 100);
  controller.cancel(false);
  assert.equal(settled.length, 0);
  assert.equal(fake.callbacks.size, 0);
  controller.start(from, to, 'fit', 100);
  controller.cancel(true);
  assert.deepEqual(settled, [to]);
  assert.equal(fake.callbacks.size, 0);
});

test('invalid input and missing RAF settle safely without a loop', () => {
  const from = camera(1, 0, 0, 800, 600);
  const to = camera(2, 200, 150, 400, 300);
  assert.equal(validCameraState(camera(0, 0, 0, 0, 0)), false);
  assert.equal(cameraTargetAtAnchor(from, 2, to.viewBox, 0, 600, 10, 10), null);
  const settled = [];
  const controller = new CameraTransitionController({
    frame: () => {},
    settled: (state) => settled.push(state.presented),
  }, { now: () => 0, requestFrame: () => null, cancelFrame: () => {} });
  controller.start(from, to, 'button', 180);
  assert.deepEqual(settled, [to]);
  assert.equal(controller.active, false);
  assert.equal(sameCameraState(to, { zoom: 2, viewBox: { ...to.viewBox } }), true);
});
