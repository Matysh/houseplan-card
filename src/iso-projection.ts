export type PlanPoint = readonly [number, number];
export type ScenePoint = readonly [number, number];

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
}

export const ISO_CAMERA: Readonly<IsoCamera> = Object.freeze({
  rotDeg: 0,
  tiltDeg: 20,
  xyScale: 1,
  zScale: 1,
  origin: Object.freeze([500, 500]) as PlanPoint,
});

export const ISO_WALL_HEIGHT = 64;

function finiteCamera(camera: IsoCamera): boolean {
  return [camera.rotDeg, camera.tiltDeg, camera.xyScale, camera.zScale,
    camera.origin[0], camera.origin[1]].every(Number.isFinite)
    && Math.abs(camera.xyScale) > 1e-12 && Math.abs(Math.cos(camera.tiltDeg * Math.PI / 180)) > 1e-12;
}

export function projectPlanPoint(
  point: PlanPoint, zUnits: number, camera: IsoCamera = ISO_CAMERA,
): ScenePoint {
  if (!finiteCamera(camera) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])
      || !Number.isFinite(zUnits)) throw new Error('invalid isometric projection input');
  const rot = camera.rotDeg * Math.PI / 180;
  const tilt = camera.tiltDeg * Math.PI / 180;
  const dx = point[0] - camera.origin[0], dy = point[1] - camera.origin[1];
  const rx = (dx * Math.cos(rot) - dy * Math.sin(rot)) * camera.xyScale;
  const ry = (dx * Math.sin(rot) + dy * Math.cos(rot)) * camera.xyScale;
  return [
    camera.origin[0] + rx,
    camera.origin[1] + ry * Math.cos(tilt) - zUnits * camera.zScale * Math.sin(tilt),
  ];
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

export function isoFloorMatrix(camera: IsoCamera = ISO_CAMERA): readonly [number, number, number, number, number, number] {
  if (!finiteCamera(camera)) throw new Error('invalid isometric camera');
  const rot = camera.rotDeg * Math.PI / 180;
  const tilt = camera.tiltDeg * Math.PI / 180;
  const a = camera.xyScale * Math.cos(rot);
  const c = -camera.xyScale * Math.sin(rot);
  const b = camera.xyScale * Math.sin(rot) * Math.cos(tilt);
  const d = camera.xyScale * Math.cos(rot) * Math.cos(tilt);
  const e = camera.origin[0] - a * camera.origin[0] - c * camera.origin[1];
  const f = camera.origin[1] - b * camera.origin[0] - d * camera.origin[1];
  return [a, b, c, d, e, f];
}

export function isoFloorMatrixCss(camera: IsoCamera = ISO_CAMERA): string {
  return `matrix(${isoFloorMatrix(camera).map((value) => Number(value.toFixed(12))).join(' ')})`;
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
  if (!(rect.w >= 0) || !(rect.h >= 0) || !Number.isFinite(wallHeight))
    throw new Error('invalid isometric frame');
  const corners: PlanPoint[] = [
    [rect.x, rect.y], [rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y + rect.h], [rect.x, rect.y + rect.h],
  ];
  const points = corners.flatMap((point) => [
    projectPlanPoint(point, 0, camera), projectPlanPoint(point, wallHeight, camera),
  ]);
  const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

