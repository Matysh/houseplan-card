import test from 'node:test';
import assert from 'node:assert/strict';
import {
  placeResizeAreaLabel, resizeInwardNormal, resizeMeasuredEdges,
} from '../test-build/resize-labels.js';

const VIEW = { x: 0, y: 0, w: 1000, h: 1000, stageWidth: 1000, stageHeight: 1000 };
const ROOM = [[100, 100], [500, 100], [500, 500], [100, 500]];

test('#300 keeps only the two side-wall measurements', () => {
  assert.deepEqual(resizeMeasuredEdges(ROOM, 1), [0, 2]);
  assert.deepEqual(resizeMeasuredEdges(ROOM, 0), [3, 1]);
});

test('#300 inward side is stable for both polygon windings', () => {
  const clean = (normal) => normal.map((value) => Math.abs(value) < 1e-9 ? 0 : value);
  assert.deepEqual(clean(resizeInwardNormal(ROOM, 1)), [-1, 0]);
  const reversed = [...ROOM].reverse();
  const edge = reversed.findIndex((a, index) => {
    const b = reversed[(index + 1) % reversed.length];
    return a[0] === 500 && a[1] === 500 && b[0] === 500 && b[1] === 100;
  });
  assert.deepEqual(clean(resizeInwardNormal(reversed, edge)), [-1, 0]);
});

test('#300 shared-wall areas land on opposite sides', () => {
  const left = placeResizeAreaLabel({
    poly: ROOM, edge: 1, text: '16.0 m²', view: VIEW,
    gearCenter: [300, 300], gearWidthPx: 20, gearHeightPx: 20,
  });
  const rightRoom = [[500, 100], [900, 100], [900, 500], [500, 500]];
  const right = placeResizeAreaLabel({
    poly: rightRoom, edge: 3, text: '16.0 m²', view: VIEW,
    gearCenter: [700, 300], gearWidthPx: 20, gearHeightPx: 20,
  });
  assert.equal(left.side, 'left');
  assert.equal(right.side, 'right');
  assert.ok(left.offsetXPx < 0);
  assert.ok(right.offsetXPx > 0);
});

test('#300 room gear collision shifts area along the wall without hiding it', () => {
  const placed = placeResizeAreaLabel({
    poly: ROOM, edge: 1, text: '16.0 m²', view: VIEW,
    // Nominal label centre is x=472,y=300; put a wide zoomed gear there.
    gearCenter: [472, 300], gearWidthPx: 120, gearHeightPx: 28,
  });
  assert.notEqual(placed.tangentOffsetPx, 0);
  assert.equal(placed.anchor[0], 500);
  assert.equal(placed.anchor[1], 300);
  const dxPx = (placed.leader.b[0] - placed.leader.a[0]) * VIEW.stageWidth / VIEW.w;
  const dyPx = (placed.leader.b[1] - placed.leader.a[1]) * VIEW.stageHeight / VIEW.h;
  assert.ok(Math.abs(Math.hypot(dxPx, dyPx) - 12) < 1e-9);
});

test('#300 non-default zoom keeps gear avoidance in current screen pixels', () => {
  const zoomedView = { ...VIEW, x: 250, y: 250, w: 500, h: 500 };
  const placed = placeResizeAreaLabel({
    poly: ROOM, edge: 1, text: '16.0 m²', view: zoomedView,
    gearCenter: [486, 300], gearWidthPx: 160, gearHeightPx: 36,
  });
  assert.notEqual(placed.tangentOffsetPx, 0);
  assert.ok(Number.isFinite(placed.offsetXPx));
  assert.ok(Number.isFinite(placed.offsetYPx));
});
