import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ISO_CAMERA, ISO_WALL_HEIGHT, clientToScenePoint, isoFloorMatrix,
  projectPlanPoint, projectedFrame, unprojectFloorPoint,
} from '../test-build/iso-projection.js';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('fixed camera is orthographic, unrotated and inside the owner range', () => {
  assert.equal(ISO_CAMERA.rotDeg, 0);
  assert.ok(ISO_CAMERA.tiltDeg >= 18 && ISO_CAMERA.tiltDeg <= 22);
  const origin = projectPlanPoint([500, 500], 0);
  assert.deepEqual(origin, [500, 500]);
  const x = projectPlanPoint([600, 500], 0);
  const y = projectPlanPoint([500, 600], 0);
  close(x[1], 500);
  close(y[0], 500);
  assert.ok(y[1] > 500, 'plan Y remains a screen-aligned axis');
});

test('floor projection round-trips across the infinite canvas contract', () => {
  for (const point of [[-5000, -5000], [0, 0], [500, 500], [5000, 5000], [-1234.5, 4321.25]]) {
    const roundTrip = unprojectFloorPoint(projectPlanPoint(point, 0));
    close(roundTrip[0], point[0]);
    close(roundTrip[1], point[1]);
  }
});

test('floor matrix is identical to point projection', () => {
  const [a, b, c, d, e, f] = isoFloorMatrix();
  for (const point of [[0, 0], [250, 750], [-3000, 4000]]) {
    const projected = projectPlanPoint(point, 0);
    close(a * point[0] + c * point[1] + e, projected[0]);
    close(b * point[0] + d * point[1] + f, projected[1]);
  }
});

test('projected frame includes raised wall tops and is view-state independent', () => {
  const rect = { x: 100, y: 200, w: 400, h: 300 };
  const frame = projectedFrame({ rect, wallHeight: ISO_WALL_HEIGHT });
  const floorOnly = projectedFrame({ rect, wallHeight: 0 });
  assert.ok(frame.y < floorOnly.y);
  assert.ok(frame.h > floorOnly.h);
  assert.deepEqual(projectedFrame({ rect, wallHeight: ISO_WALL_HEIGHT }), frame);
});

test('Stage 2 frame includes opening tops and the structural floor edge, not blur', () => {
  const rect = { x: 100, y: 200, w: 400, h: 300 };
  const stage1 = projectedFrame({ rect, wallHeight: ISO_WALL_HEIGHT });
  const stage2 = projectedFrame({
    rect, wallHeight: ISO_WALL_HEIGHT, openingHeight: ISO_WALL_HEIGHT + 5, floorDepth: 10,
  });
  assert.ok(stage2.y < stage1.y);
  assert.ok(stage2.h > stage1.h);
  assert.deepEqual(Object.keys(stage2).sort(), ['h', 'w', 'x', 'y']);
});

test('client coordinates map through the current scene view', () => {
  const scene = clientToScenePoint([250, 175], { left: 50, top: 25, width: 400, height: 300 },
    { x: 100, y: 200, w: 800, h: 600 });
  assert.deepEqual(scene, [500, 500]);
});

test('degenerate cameras and frames throw instead of mixing projections', () => {
  assert.throws(() => projectPlanPoint([0, 0], 0, { ...ISO_CAMERA, xyScale: 0 }));
  assert.throws(() => unprojectFloorPoint([0, 0], { ...ISO_CAMERA, tiltDeg: 90 }));
  assert.throws(() => clientToScenePoint([0, 0], { left: 0, top: 0, width: 0, height: 1 },
    { x: 0, y: 0, w: 1, h: 1 }));
});
