import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ISO_CAMERA, ISO_OVERLAY_VISUAL_OFFSET, ISO_RAISED_OVERLAY_HEIGHT,
  ISO_WALL_HEIGHT, applyIsoMatrix, clientToScenePoint, isoFloorMatrix,
  isoPlaneMatrix, isoPlaneMatrixCss, isoRaisedOverlayHeight, projectPlanPoint,
  projectedFrame, unprojectFloorPoint,
} from '../test-build/iso-projection.js';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('Stage 3 camera is the exact fixed +4°/20° orthographic camera', () => {
  assert.equal(ISO_CAMERA.rotDeg, 4);
  assert.equal(ISO_CAMERA.tiltDeg, 20);
  const origin = projectPlanPoint([500, 500], 0);
  assert.deepEqual(origin, [500, 500]);
  const x = projectPlanPoint([600, 500], 0);
  const y = projectPlanPoint([500, 600], 0);
  assert.ok(x[0] > 500 && x[1] > 500, 'positive plan X follows the +4° yaw');
  assert.ok(y[0] < 500 && y[1] > 500, 'positive plan Y follows the +4° yaw');
  assert.equal(ISO_OVERLAY_VISUAL_OFFSET, 4);
  assert.equal(ISO_RAISED_OVERLAY_HEIGHT, 68);
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

test('one canonical affine helper projects floor and raised planes', () => {
  for (const z of [0, ISO_WALL_HEIGHT, ISO_RAISED_OVERLAY_HEIGHT]) {
    const matrix = isoPlaneMatrix(z);
    for (const point of [[0, 0], [250, 750], [-3000, 4000]]) {
      const projected = projectPlanPoint(point, z);
      const affine = applyIsoMatrix(point, matrix);
      close(affine[0], projected[0]);
      close(affine[1], projected[1]);
    }
    assert.match(isoPlaneMatrixCss(z), /^matrix\([-0-9.e ]+\)$/);
  }
  assert.deepEqual(isoPlaneMatrix(0), isoFloorMatrix());
  assert.equal(isoRaisedOverlayHeight(64, 4), 68);
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

test('Stage 3 frame includes the final raised plane and diagonal camera corners', () => {
  const rect = { x: 100, y: 200, w: 400, h: 300 };
  const wallFrame = projectedFrame({ rect, wallHeight: ISO_WALL_HEIGHT });
  const raisedFrame = projectedFrame({
    rect,
    wallHeight: ISO_WALL_HEIGHT,
    raisedHeight: ISO_RAISED_OVERLAY_HEIGHT,
  });
  assert.ok(raisedFrame.y < wallFrame.y, 'raised overlay top is not clipped');
  assert.ok(raisedFrame.h > wallFrame.h, 'raised overlay height participates in fit bounds');
  const projectedFloor = [
    [rect.x, rect.y], [rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y + rect.h], [rect.x, rect.y + rect.h],
  ].map((point) => projectPlanPoint(point, 0));
  const projectedWidth = Math.max(...projectedFloor.map((point) => point[0]))
    - Math.min(...projectedFloor.map((point) => point[0]));
  assert.ok(projectedWidth > rect.w, 'the +4° camera expands the frame diagonally');
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
  assert.throws(() => isoRaisedOverlayHeight(64, -1));
  assert.throws(() => projectedFrame({
    rect: { x: 0, y: 0, w: 1, h: 1 }, wallHeight: 64, raisedHeight: -1,
  }));
});
