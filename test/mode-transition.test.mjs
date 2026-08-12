import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ModeTransitionController,
  interpolateModeVisualState,
  viewBoxFromViewport,
  viewportFromViewBox,
} from '../test-build/mode-transition.js';

const endpoint = (mode, chrome, stageHeight, viewBox, opacity = mode === 'view' ? 0 : 1) => ({
  presentedMode: mode,
  editorChromeHeight: chrome,
  stageWidth: 800,
  stageHeight,
  viewport: viewportFromViewBox(viewBox, 800),
  stageColor: mode === 'view' ? 'rgb(20, 30, 40)' : 'rgb(255, 255, 255)',
  paperColor: mode === 'view' ? '#202830' : '#ffffff',
  sceneBrightness: mode === 'view' ? 0.9 : 1,
  architectureOpacity: mode === 'decor' ? 0.35 : 1,
  backdropOpacity: mode === 'decor' ? 0.5 : 1,
  viewWeight: mode === 'view' ? 1 : 0,
  editorWeight: mode === 'view' ? 0 : 1,
  toolbarContentOpacity: opacity,
});

test('camera round-trip preserves center and uses the current stage aspect', () => {
  const view = { x: 10, y: 20, w: 400, h: 300 };
  const viewport = viewportFromViewBox(view, 800);
  const roundTrip = viewBoxFromViewport(viewport, 800, 600);
  assert.deepEqual(roundTrip, view);
  const narrow = viewBoxFromViewport(viewport, 400, 600);
  assert.equal(narrow.x + narrow.w / 2, viewport.centerX);
  assert.equal(narrow.y + narrow.h / 2, viewport.centerY);
  assert.equal(narrow.w / narrow.h, 400 / 600);
});

test('one interpolation owns chrome, stage, camera, colors and content fade', () => {
  const from = endpoint('view', 0, 600, { x: 0, y: 0, w: 800, h: 600 });
  const to = endpoint('plan', 120, 480, { x: 100, y: 80, w: 600, h: 360 });
  const mid = interpolateModeVisualState(from, to, 0.5);
  assert.ok(mid.editorChromeHeight > 0 && mid.editorChromeHeight < 120);
  assert.ok(mid.editorChromeHeight > 108,
    'the shared timeline follows cubic-bezier(0.2, 0.7, 0.2, 1), not a generic easing');
  assert.ok(mid.stageHeight > 480 && mid.stageHeight < 600);
  assert.equal(mid.viewport.viewBox.w / mid.viewport.viewBox.h, mid.stageWidth / mid.stageHeight);
  assert.ok(mid.sceneBrightness > 0.9 && mid.sceneBrightness < 1);
  assert.ok(mid.toolbarContentOpacity > 0 && mid.toolbarContentOpacity < 1);
  assert.match(mid.stageColor, /^rgba\(/);
});

test('controller is deterministic, settles exactly and leaves no scheduled frame', () => {
  let now = 0;
  let sequence = 0;
  const callbacks = new Map();
  const clock = {
    now: () => now,
    requestFrame: (callback) => { callbacks.set(++sequence, callback); return sequence; },
    cancelFrame: (handle) => callbacks.delete(handle),
  };
  const frames = [];
  let settled = null;
  const controller = new ModeTransitionController({
    frame: (state) => frames.push(state.presented),
    settled: (state) => { settled = state.presented; },
  }, clock);
  const from = endpoint('view', 0, 600, { x: 0, y: 0, w: 800, h: 600 });
  const to = endpoint('devices', 96, 504, { x: 50, y: 30, w: 700, h: 441 });
  controller.start(from, to, 'devices', 100);
  assert.equal(controller.active, true);
  const step = (time) => {
    now = time;
    const [id, callback] = callbacks.entries().next().value;
    callbacks.delete(id);
    callback(time);
  };
  step(50);
  assert.ok(controller.presented.stageHeight > 504 && controller.presented.stageHeight < 600);
  step(100);
  assert.deepEqual(settled, to);
  assert.equal(controller.active, false);
  assert.equal(callbacks.size, 0);
  assert.ok(frames.length >= 3);
});

test('zero-duration and interrupted transitions commit one exact target', () => {
  let sequence = 0;
  const callbacks = new Map();
  const clock = {
    now: () => 0,
    requestFrame: (callback) => { callbacks.set(++sequence, callback); return sequence; },
    cancelFrame: (handle) => callbacks.delete(handle),
  };
  const settled = [];
  const controller = new ModeTransitionController({
    frame: () => {},
    settled: (state) => settled.push(state.presented),
  }, clock);
  const view = endpoint('view', 0, 600, { x: 0, y: 0, w: 800, h: 600 });
  const plan = endpoint('plan', 120, 480, { x: 40, y: 30, w: 720, h: 432 });

  controller.start(view, plan, 'plan', 0);
  assert.deepEqual(settled.pop(), plan);
  assert.equal(callbacks.size, 0);

  controller.start(view, plan, 'plan', 220);
  controller.cancel(true);
  assert.deepEqual(settled.pop(), plan);
  assert.equal(controller.active, false);
  assert.equal(callbacks.size, 0);
});

test('retarget starts from the actually presented frame and invalidates old RAF', () => {
  let now = 0;
  let sequence = 0;
  const callbacks = new Map();
  const clock = {
    now: () => now,
    requestFrame: (callback) => { callbacks.set(++sequence, callback); return sequence; },
    cancelFrame: (handle) => callbacks.delete(handle),
  };
  const frames = [];
  const controller = new ModeTransitionController({
    frame: (state) => frames.push(state.presented),
    settled: () => {},
  }, clock);
  const view = endpoint('view', 0, 600, { x: 0, y: 0, w: 800, h: 600 });
  const plan = endpoint('plan', 120, 480, { x: 40, y: 30, w: 720, h: 432 });
  const decor = endpoint('decor', 160, 440, { x: 80, y: 50, w: 640, h: 352 });

  controller.start(view, plan, 'plan', 100);
  now = 40;
  const [oldHandle, oldFrame] = callbacks.entries().next().value;
  callbacks.delete(oldHandle);
  oldFrame(now);
  const presented = controller.presented;
  controller.start(presented, decor, 'decor', 100);

  assert.deepEqual(frames.at(-1), presented);
  assert.equal(callbacks.size, 1, 'the previous generation cannot retain a scheduled frame');
});
