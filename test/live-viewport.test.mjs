import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isIdentityLiveLayerProjection,
  liveLayerProjection,
  liveViewBoxText,
} from '../test-build/live-viewport.js';

test('live viewport projects pan and zoom from the last complete frame', () => {
  assert.deepEqual(
    liveLayerProjection(
      { x: 0, y: 0, w: 1000, h: 500 },
      { x: 100, y: 50, w: 500, h: 250 },
    ),
    { translateXPercent: -20, translateYPercent: -20, scaleX: 2, scaleY: 2 },
  );
});

test('live viewport serializes one exact SVG camera box', () => {
  assert.equal(liveViewBoxText({ x: -12.5, y: 4, w: 800, h: 450 }), '-12.5 4 800 450');
});

test('a settled live viewport removes its compositor transform', () => {
  const settled = { x: 17.25, y: -4, w: 800, h: 450 };
  assert.equal(isIdentityLiveLayerProjection(liveLayerProjection(settled, settled)), true);
  assert.equal(isIdentityLiveLayerProjection(liveLayerProjection(
    settled,
    { ...settled, x: settled.x + 0.001 },
  )), false);
});
