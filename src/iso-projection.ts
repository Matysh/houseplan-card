import { quarterBasis, validPlanRotation, type PlanRotation } from './view-frame';
import { ISO_LAB_CAMERA, ISO_VIEW_PROFILE } from './iso-lab-camera';
import { GRID_PITCH, GRID_VISUAL_REFERENCE_CELL_CM } from './canvas-constants';
export type PlanPoint = readonly [number, number];
export type ScenePoint = readonly [number, number];
export type IsoAffineMatrix = readonly [number, number, number, number, number, number];

export interface IsoCamera {
  rotDeg: number;
  tiltDeg: number;
  xyScale: number;
  zScale: number;
  origin: PlanPoint;
  /** Orthographic floor depth scale; omitted means an unsqueezed test camera. */
  floorScaleY?: number;
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
  rotDeg: ISO_LAB_CAMERA.yaw,
  tiltDeg: ISO_LAB_CAMERA.tiltDeg,
  xyScale: 1,
  zScale: 1,
  origin: Object.freeze([500, 500]) as PlanPoint,
  ...(ISO_LAB_CAMERA.floorScaleY !== 1 ? { floorScaleY: ISO_LAB_CAMERA.floorScaleY } : {}),
});

const quarterCameras = new Map<PlanRotation, Readonly<IsoCamera>>([[0, ISO_CAMERA]]);
export function isoCameraFor(rotation: PlanRotation): Readonly<IsoCamera> {
  if (!validPlanRotation(rotation)) throw new Error('invalid plan rotation');
  let camera = quarterCameras.get(rotation);
  if (!camera) { camera = Object.freeze({ ...ISO_CAMERA, rotDeg: ISO_CAMERA.rotDeg + rotation }); quarterCameras.set(rotation, camera); }
  return camera;
}
export function isoRotationBasis(camera: IsoCamera): readonly [number, number] {
  const rotation = (camera.rotDeg % 360 + 360) % 360;
  return validPlanRotation(rotation) ? quarterBasis(rotation)
    : [Math.cos(camera.rotDeg * Math.PI / 180), Math.sin(camera.rotDeg * Math.PI / 180)];
}

export const ISO_WALL_HEIGHT = 84;
// The cutaway represents half of a 280 cm wall. Callers apply gridVisualUnits
// to these reference-scale units for the current space's centimetres per cell.
const ISO_SECTION_WALL_HEIGHT = ISO_VIEW_PROFILE.sectionHeightCm * GRID_PITCH / GRID_VISUAL_REFERENCE_CELL_CM;
/** Physical section height, independent of the furniture recipe reference. */
export function isoDisplayWallHeight(): number {
  return ISO_SECTION_WALL_HEIGHT;
}
export const ISO_FLOOR_EDGE_HEIGHT = 10;
/** Low visual lift above the floor; callers scale it with the same grid policy. */
export const ISO_OVERLAY_VISUAL_OFFSET = 4;
export const ISO_RAISED_OVERLAY_HEIGHT = ISO_OVERLAY_VISUAL_OFFSET;

function finiteCamera(camera: IsoCamera): boolean {
  return [camera.rotDeg, camera.tiltDeg, camera.xyScale, camera.zScale,
    camera.origin[0], camera.origin[1]].every(Number.isFinite)
    && Math.abs(camera.xyScale) > 1e-12
    && Number.isFinite(camera.floorScaleY ?? 1) && (camera.floorScaleY ?? 1) > 1e-12;
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
  const [cos, sin] = isoRotationBasis(camera);
  const rx = (point[0] - camera.origin[0]) / camera.xyScale;
  const ry = (point[1] - camera.origin[1]) / camera.xyScale / (camera.floorScaleY ?? 1);
  return [
    camera.origin[0] + rx * cos + ry * sin,
    camera.origin[1] - rx * sin + ry * cos,
  ];
}

/**
 * Canonical plan-plane affine matrix at one logical height. Floor SVG, raised
 * plates and individual point projection all use this exact transform.
 *
 * The accepted orthographic camera compresses floor depth by sin(elevation).
 * Height rises straight up by z × cos(elevation), represented as sin(tilt).
 * Flat/editor/no-borders use their own exact quarter-turn matrix instead.
 */
export function isoPlaneMatrix(
  zUnits = 0, camera: IsoCamera = ISO_CAMERA,
): IsoAffineMatrix {
  if (!finiteCamera(camera) || !Number.isFinite(zUnits))
    throw new Error('invalid isometric camera');
  const [cos, sin] = isoRotationBasis(camera);
  const tilt = camera.tiltDeg * Math.PI / 180;
  const a = camera.xyScale * cos;
  const c = -camera.xyScale * sin;
  const b = camera.xyScale * sin * (camera.floorScaleY ?? 1);
  const d = camera.xyScale * cos * (camera.floorScaleY ?? 1);
  const e = camera.origin[0] - a * camera.origin[0] - c * camera.origin[1];
  const f = camera.origin[1] - b * camera.origin[0] - d * camera.origin[1]
    - zUnits * camera.zScale * Math.sin(tilt);
  return [a, b, c, d, e, f];
}

export function isoFloorMatrix(camera: IsoCamera = ISO_CAMERA): IsoAffineMatrix {
  return isoPlaneMatrix(0, camera);
}

/** Depth along the projector's null direction. Screen Y is
 * xyScale·floorScaleY·rotatedY − zScale·sin(tilt)·z; the perpendicular
 * coefficient pair orders two points which project to the same screen point. */
export function isoCameraDepth(point: PlanPoint, zUnits: number, camera: IsoCamera = ISO_CAMERA): number {
  if (!finiteCamera(camera) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])
      || !Number.isFinite(zUnits)) throw new Error('invalid isometric depth input');
  const [cos, sin] = isoRotationBasis(camera);
  return (point[0] * sin + point[1] * cos) * camera.zScale * Math.sin(camera.tiltDeg * Math.PI / 180)
    + zUnits * camera.xyScale * (camera.floorScaleY ?? 1);
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

/** Marker-local vectors use the floor basis, without translating its origin.
 * The inverse keeps the invisible minimum hit area screen-facing. */
export function isoFloorLinearCss(camera: IsoCamera = ISO_CAMERA, inverse = false): string {
  const [a, b, c, d] = isoFloorMatrix(camera);
  const det = a * d - b * c;
  const linear = inverse ? [d / det, -b / det, -c / det, a / det] : [a, b, c, d];
  return `matrix(${[...linear, 0, 0].join(',')})`;
}

/** Tile extrusion and relative paint layers on the same raised camera plane. */
export function isoTileDepthStyles(camera: IsoCamera): Record<string,string> {
  const [a,b,c,d]=isoFloorMatrix(camera),det=a*d-b*c;
  // On a shared height, increasing projected Y is nearer. A badge is
  // translated along one local axis from the core, so its side determines
  // the sign. Keep layer 1 for the core and preserve the old tie order.
  const badgeLayer = (delta: number) => delta < -1e-12 ? '0' : '2';
  return {'--hp-iso-edge-unit-x':String(-c/det*.22),
    '--hp-iso-edge-unit-y':String(a/det*.22),
    '--hp-iso-badge-right-layer':badgeLayer(b),
    '--hp-iso-badge-left-layer':badgeLayer(-b),
    '--hp-iso-badge-bottom-layer':badgeLayer(d),
    '--hp-iso-badge-top-layer':badgeLayer(-d)};
}

export function isoOverlayVisualHeight(visualOffset: number): number {
  if (!Number.isFinite(visualOffset) || visualOffset < 0)
    throw new Error('invalid isometric overlay height');
  return visualOffset;
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
