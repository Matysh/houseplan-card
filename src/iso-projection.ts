export type PlanPoint = readonly [number, number];
export type ScenePoint = readonly [number, number];
export type IsoAffineMatrix = readonly [number, number, number, number, number, number];

export interface IsoCamera {
  rotDeg: number;
  tiltDeg: number;
  xyScale: number;
  zScale: number;
  origin: PlanPoint;
}

export interface ViewRect { x: number; y: number; w: number; h: number; }

export interface IsoFrameInput {
  rect: ViewRect;
  wallHeight: number;
  openingHeight?: number;
  floorDepth?: number;
  raisedHeight?: number;
}

export const ISO_CAMERA: Readonly<IsoCamera> = Object.freeze({
  rotDeg: 4,
  tiltDeg: 20,
  xyScale: 1,
  zScale: 1,
  origin: Object.freeze([500, 500]) as PlanPoint,
});

export const ISO_WALL_HEIGHT = 64;
export const ISO_FLOOR_EDGE_HEIGHT = 10;
/** Nominal Stage 3 offset; callers scale it with the same wall-height policy. */
export const ISO_OVERLAY_VISUAL_OFFSET = 4;
export const ISO_RAISED_OVERLAY_HEIGHT = ISO_WALL_HEIGHT + ISO_OVERLAY_VISUAL_OFFSET;

function finiteCamera(camera: IsoCamera): boolean {
  return [camera.rotDeg, camera.tiltDeg, camera.xyScale, camera.zScale,
    camera.origin[0], camera.origin[1]].every(Number.isFinite)
    && Math.abs(camera.xyScale) > 1e-12 && Math.abs(Math.cos(camera.tiltDeg * Math.PI / 180)) > 1e-12;
}

export function projectPlanPoint(
  point: PlanPoint, zUnits: number, camera: IsoCamera = ISO_CAMERA,
): ScenePoint {
  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1]))
    throw new Error('invalid isometric projection input');
  return applyIsoMatrix(point, isoPlaneMatrix(zUnits, camera));
}

export function unprojectFloorPoint(
  point: ScenePoint, camera: IsoCamera = ISO_CAMERA,
): PlanPoint {
  if (!finiteCamera(camera) || !Number.isFinite(point[0]) || !Number.isFinite(point[1]))
    throw new Error('invalid isometric projection input');
  const rot = camera.rotDeg * Math.PI / 180;
  const tilt = camera.tiltDeg * Math.PI / 180;
  const rx = (point[0] - camera.origin[0]) / camera.xyScale;
  const ry = (point[1] - camera.origin[1]) / (camera.xyScale * Math.cos(tilt));
  return [
    camera.origin[0] + rx * Math.cos(rot) + ry * Math.sin(rot),
    camera.origin[1] - rx * Math.sin(rot) + ry * Math.cos(rot),
  ];
}

/**
 * Canonical plan-plane affine matrix at one logical height. Floor SVG, raised
 * plates and individual point projection all use this exact transform.
 */
export function isoPlaneMatrix(
  zUnits = 0, camera: IsoCamera = ISO_CAMERA,
): IsoAffineMatrix {
  if (!finiteCamera(camera) || !Number.isFinite(zUnits))
    throw new Error('invalid isometric camera');
  const rot = camera.rotDeg * Math.PI / 180;
  const tilt = camera.tiltDeg * Math.PI / 180;
  const a = camera.xyScale * Math.cos(rot);
  const c = -camera.xyScale * Math.sin(rot);
  const b = camera.xyScale * Math.sin(rot) * Math.cos(tilt);
  const d = camera.xyScale * Math.cos(rot) * Math.cos(tilt);
  const e = camera.origin[0] - a * camera.origin[0] - c * camera.origin[1];
  const f = camera.origin[1] - b * camera.origin[0] - d * camera.origin[1]
    - zUnits * camera.zScale * Math.sin(tilt);
  return [a, b, c, d, e, f];
}

export function isoFloorMatrix(camera: IsoCamera = ISO_CAMERA): IsoAffineMatrix {
  return isoPlaneMatrix(0, camera);
}

export function applyIsoMatrix(point: PlanPoint, matrix: IsoAffineMatrix): ScenePoint {
  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])
      || !matrix.every(Number.isFinite)) throw new Error('invalid isometric affine input');
  const [a, b, c, d, e, f] = matrix;
  return [a * point[0] + c * point[1] + e, b * point[0] + d * point[1] + f];
}

export function isoPlaneMatrixCss(zUnits = 0, camera: IsoCamera = ISO_CAMERA): string {
  return `matrix(${isoPlaneMatrix(zUnits, camera)
    .map((value) => Number(value.toFixed(12))).join(' ')})`;
}

export function isoFloorMatrixCss(camera: IsoCamera = ISO_CAMERA): string {
  return isoPlaneMatrixCss(0, camera);
}

export function isoRaisedOverlayHeight(
  wallHeight: number, visualOffset: number,
): number {
  if (!Number.isFinite(wallHeight) || !Number.isFinite(visualOffset)
      || wallHeight < 0 || visualOffset < 0)
    throw new Error('invalid raised overlay height');
  return wallHeight + visualOffset;
}

export function clientToScenePoint(
  client: PlanPoint,
  stageRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  view: ViewRect,
): ScenePoint {
  if (!(stageRect.width > 0) || !(stageRect.height > 0) || !(view.w > 0) || !(view.h > 0))
    throw new Error('invalid client/scene frame');
  return [
    view.x + ((client[0] - stageRect.left) / stageRect.width) * view.w,
    view.y + ((client[1] - stageRect.top) / stageRect.height) * view.h,
  ];
}

export function projectedFrame(
  input: IsoFrameInput, camera: IsoCamera = ISO_CAMERA,
): ViewRect {
  const { rect, wallHeight } = input;
  const openingHeight = input.openingHeight ?? wallHeight;
  const floorDepth = input.floorDepth ?? 0;
  const raisedHeight = input.raisedHeight ?? wallHeight;
  if (!(rect.w >= 0) || !(rect.h >= 0) || !Number.isFinite(wallHeight)
      || !Number.isFinite(openingHeight) || !Number.isFinite(floorDepth)
      || !Number.isFinite(raisedHeight) || wallHeight < 0 || openingHeight < 0
      || floorDepth < 0 || raisedHeight < 0)
    throw new Error('invalid isometric frame');
  const corners: PlanPoint[] = [
    [rect.x, rect.y], [rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y + rect.h], [rect.x, rect.y + rect.h],
  ];
  const top = Math.max(wallHeight, openingHeight, raisedHeight);
  const points = corners.flatMap((point) => [
    projectPlanPoint(point, -floorDepth, camera), projectPlanPoint(point, top, camera),
  ]);
  const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
