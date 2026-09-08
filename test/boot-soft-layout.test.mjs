import assert from 'node:assert/strict';
import test from 'node:test';

import {
  measuredCardHeaderHeight,
  settleSoftStageLayout,
} from '../test-build/boot-soft-layout.js';

const fixture = ({ width = 780, height = 669 } = {}) => {
  const removed = [];
  const card = { getBoundingClientRect: () => ({ top: 8 }) };
  const stage = {
    clientWidth: width,
    clientHeight: height,
    style: { height: '' },
    classList: { remove: (name) => removed.push(name) },
    getBoundingClientRect: () => ({ top: 131 }),
  };
  const root = { querySelector: (selector) => selector === 'ha-card' ? card : null };
  return { card, stage, root, removed };
};

test('#437 measures card and bounded dashboard chrome without using stage height', () => {
  const { root, stage } = fixture();
  assert.equal(measuredCardHeaderHeight(root, stage, false), 131);
  assert.equal(measuredCardHeaderHeight(root, stage, true), 123);
});

test('#437 first input synchronously consumes the final soft-layout stage box', () => {
  const { root, stage, removed } = fixture();
  assert.deepEqual(settleSoftStageLayout(root, stage, false, false), {
    headerHeight: 131,
    size: [780, 669],
  });
  assert.equal(stage.style.height, 'calc(100dvh - 131px)');
  assert.deepEqual(removed, ['hpsettle']);
});

test('#437 panel, kiosk and invalid boxes never invent a dashboard height', () => {
  const panel = fixture();
  assert.deepEqual(settleSoftStageLayout(panel.root, panel.stage, true, false)?.size, [780, 669]);
  assert.equal(panel.stage.style.height, '');
  const kiosk = fixture();
  settleSoftStageLayout(kiosk.root, kiosk.stage, false, true);
  assert.equal(kiosk.stage.style.height, '');
  const invalid = fixture({ width: 0 });
  assert.equal(settleSoftStageLayout(invalid.root, invalid.stage, false, false), null);
  assert.deepEqual(invalid.removed, ['hpsettle']);
});
