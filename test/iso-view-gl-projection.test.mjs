import assert from 'node:assert/strict';
import test from 'node:test';
import { isoCameraDepth, isoCameraFor, projectPlanPoint } from '../test-build/iso-projection.js';
import { isoViewClipMatrix } from '../test-build/iso-view-gl-projection.js';

const view = { x: 177.3, y: 89.2, w: 521.6, h: 286.7 };
const near = 2600;
const far = -1800;
const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} differs from ${b}`);
const mul = (matrix, x, y, z, row) => matrix[row] * x + matrix[row + 4] * y
  + matrix[row + 8] * z + matrix[row + 12];

test('#1472 real 3D uses the current off-centre plan viewport at all quarter turns and heights', () => {
  for (const rotation of [0, 90, 180, 270]) {
    const camera = isoCameraFor(rotation);
    const matrix = isoViewClipMatrix(camera, view, far, near);
    for (const [x, y, z] of [[145, 13, 0], [524, 420, -9], [219, 686, 121], [899, 1010, 240]]) {
      const [sx, sy] = projectPlanPoint([x, y], z, camera);
      approx((mul(matrix, x, y, z, 0) + 1) * view.w / 2 + view.x, sx);
      approx((1 - mul(matrix, x, y, z, 1)) * view.h / 2 + view.y, sy);
      approx(mul(matrix, x, y, z, 2), 1 - 2 * (isoCameraDepth([x, y], z, camera) - far) / (near - far));
      assert.equal(mul(matrix, x, y, z, 3), 1, 'orthographic projection has no perspective divide');
    }
  }
});

test('#1472 GL depth test lets the nearer of overlapping points cover the farther', () => {
  const camera = isoCameraFor(0), matrix = isoViewClipMatrix(camera, view, far, near);
  const bottom = [284, 198, 0];
  const angle = camera.rotDeg * Math.PI / 180;
  const distance = 90;
  const top = [
    bottom[0] + distance * Math.sin(angle),
    bottom[1] + distance * Math.cos(angle),
    distance * camera.floorScaleY / Math.sin(camera.tiltDeg * Math.PI / 180),
  ];
  for (const row of [0, 1]) approx(mul(matrix, ...bottom, row), mul(matrix, ...top, row));
  assert.ok(mul(matrix, ...top, 2) < mul(matrix, ...bottom, 2));
});

test('#1472 an unmeasured or invalid camera frame never reaches the GL pass', () => {
  const camera = isoCameraFor(0);
  assert.throws(() => isoViewClipMatrix(camera, { ...view, w: 0 }, far, near));
  assert.throws(() => isoViewClipMatrix(camera, { ...view, y: NaN }, far, near));
  assert.throws(() => isoViewClipMatrix(camera, view, near, near));
});
