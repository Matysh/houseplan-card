import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneGestureFromPath, clampSurfacePosition } from '../test-build/canvas-surface-gestures.js';

const node = (...selectors) => ({ matches: list => list.split(',').some(s => selectors.includes(s)) });
test('scene input refuses every screen surface and native editable path', () => {
  for (const selector of ['[data-scene-surface]', 'hp-dialog', '.editor-secondary', '.summary-overlay',
    '.summary-control', '.recoveryoverlay', 'input', 'textarea', 'select',
    '[contenteditable]:not([contenteditable="false"])']) {
    assert.equal(sceneGestureFromPath([node('span'), node(selector), node('.stage'), null]), false, selector);
  }
  for (const target of ['.stage', '.room', '.backdrop', '.roomlabel', '.rlhandle', 'button'])
    assert.equal(sceneGestureFromPath([node(target), node('.stage'), {}]), true, target);
});
test('surface bounds retain the full rectangle, including after stage resize', () => {
  const surface = { width: 240, height: 100 }, stage = { width: 1000, height: 700 };
  assert.deepEqual(clampSurfacePosition({ x: 120, y: 80 }, surface, stage), { x: 120, y: 80 });
  assert.deepEqual(clampSurfacePosition({ x: -2000, y: -2000 }, surface, stage), { x: 8, y: 8 });
  assert.deepEqual(clampSurfacePosition({ x: 2000, y: 2000 }, surface, stage), { x: 752, y: 592 });
  assert.deepEqual(clampSurfacePosition({ x: 752, y: 592 }, surface, { width: 500, height: 300 }), { x: 252, y: 192 });
  assert.deepEqual(clampSurfacePosition({ x: 50, y: 50 }, surface, { width: 200, height: 90 }), { x: 8, y: 8 });
});
