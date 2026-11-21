import { isoCameraDepth, isoPlaneMatrix, type IsoCamera, type ViewRect } from './iso-projection';

/**
 * Send the already accepted SVG/HTML view to the GPU, not to a second fitted
 * camera. Coordinates are unprojected plan X/Y and physical height in the same
 * units as the existing isometric geometry. The matrix is column-major.
 */
export function isoViewClipMatrix(
  camera: IsoCamera,
  view: ViewRect,
  minDepth: number,
  maxDepth: number,
): readonly number[] {
  const { x, y, w, h } = view;
  const depthSpan = maxDepth - minDepth;
  if (![x, y, w, h, minDepth, maxDepth, depthSpan].every(Number.isFinite)
      || w <= 0 || h <= 0 || depthSpan <= 0) {
    throw new Error('invalid isometric GL viewport');
  }
  const [a, b, c, d, e, f] = isoPlaneMatrix(0, camera);
  const zToY = isoPlaneMatrix(1, camera)[5] - f;
  // SVG paints higher depth last. WebGL's default LESS test has the opposite
  // direction: a higher canonical depth must give a lower clip-space Z.
  const sx = 2 / w;
  const sy = -2 / h;
  const sz = -2 / depthSpan;
  return [
    sx * a, sy * b, sz * isoCameraDepth([1, 0], 0, camera), 0,
    sx * c, sy * d, sz * isoCameraDepth([0, 1], 0, camera), 0,
    0,      sy * zToY, sz * isoCameraDepth([0, 0], 1, camera), 0,
    sx * (e - x) - 1, sy * (f - y) + 1, 1 - sz * minDepth, 1,
  ];
}
