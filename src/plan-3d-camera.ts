import { Box3, OrthographicCamera, PerspectiveCamera, Vector3, WebGLCoordinateSystem, type Camera } from 'three';
import { isoFloorMatrix, isoPerspectiveCamera, isoRotationBasis, applyIsoMatrix, type IsoCamera, type ViewRect } from './iso-projection';

/** Plan X/Y are horizontal; height above the plan is Three's Y. */
export function planWorldPoint(x: number, y: number, height: number): Vector3 {
  return new Vector3(x, height, y);
}

/** The crop changes NDC but not the physical lens. Bound each visible
 * piece before projection so concave plans need not use one large box
 * with empty corners that may extend behind the perspective lens. */
export function plan3dPaintBounds(camera: Camera, source: ViewRect, boxes: Iterable<Box3>): ViewRect | null {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const p = new Vector3();
  for (const box of boxes) {
    if (box.isEmpty()) continue;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        p.set(x, y, z).project(camera);
        if (!Number.isFinite(p.x + p.y + p.z) || p.z < -1 || p.z > 1) return null;
        const px = source.x + (p.x + 1) * source.w / 2;
        const py = source.y + (1 - p.y) * source.h / 2;
        left = Math.min(left, px); right = Math.max(right, px);
        top = Math.min(top, py); bottom = Math.max(bottom, py);
      }
  }
  const w = right - left, h = bottom - top;
  if (!(w > 0 && h > 0) || !Number.isFinite(left + top + right + bottom)) return null;
  // Keep antialiased lines outside the exact mesh projected box.
  const pad = Math.max(w, h) * .02;
  return { x: left - pad, y: top - pad, w: w + pad * 2, h: h + pad * 2 };
}

/** The preset controls pose. Changing the view rectangle crops its image and
 * leaves the lens and world coordinates intact, including on a pinch or pan. */
export function plan3dCamera(
  preset: Readonly<IsoCamera>,
  lensBounds: ViewRect,
  contentBounds: ViewRect,
  sectionHeight: number,
  view: ViewRect,
): OrthographicCamera | PerspectiveCamera {
  const calibrated = isoPerspectiveCamera(preset, lensBounds, contentBounds, sectionHeight);
  const [cos, sin] = isoRotationBasis(calibrated);
  const vertical = Math.sin(calibrated.tiltDeg * Math.PI / 180);
  const ground = calibrated.floorScaleY ?? 1;
  const x = lensBounds.x + lensBounds.w / 2;
  const y = lensBounds.y + lensBounds.h / 2;
  const extent = Math.hypot(
    Math.max(lensBounds.w / 2, Math.abs(contentBounds.x - x), Math.abs(contentBounds.x + contentBounds.w - x)),
    Math.max(lensBounds.h / 2, Math.abs(contentBounds.y - y), Math.abs(contentBounds.y + contentBounds.h - y)),
  ) + Math.abs(sectionHeight) * 2 + 1;

  if (calibrated.perspective) {
    const [screenX, screenY] = calibrated.perspective.center;
    const distance = 1 / (calibrated.perspective.rate * ground);
    const height = ground * distance / vertical;
    const near = distance / 16;
    const far = distance + extent;
    const camera = new PerspectiveCamera(40, view.w / view.h, near, far);
    camera.position.set(x + sin * distance, height, y + cos * distance);
    camera.lookAt(planWorldPoint(x, y, height));
    // Shift the principal point with a horizontal optical axis. Tilting the
    // camera down would make apparent width depend on world height.
    const left = (view.x - screenX) * near / distance;
    const right = left + view.w * near / distance;
    const top = -(view.y - screenY + ground * distance) * near / (vertical * distance);
    const bottom = top - view.h * near / (vertical * distance);
    camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far, WebGLCoordinateSystem);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld(true);
    return camera;
  }

  const [screenX, screenY] = applyIsoMatrix([x, y], isoFloorMatrix(preset));
  const left = view.x - screenX;
  const top = screenY - view.y;
  const camera = new OrthographicCamera(left, left + view.w, top, top - view.h, 0.01, extent * 3);
  const distance = extent * 1.5;
  camera.position.set(x + sin * vertical * distance, ground * distance, y + cos * vertical * distance);
  camera.lookAt(planWorldPoint(x, y, 0));
  camera.updateMatrixWorld(true);
  return camera;
}
