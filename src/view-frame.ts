import { fitView } from './logic';
import { cameraTargetAtAnchor, type CameraState } from './viewport-transition';
/** Logical presentation positions, in degrees. The ISO camera selects its own azimuth. */
export const PLAN_ROTATIONS = [0, 45, 90, 135, 180, 225, 270, 315] as const;
export type PlanRotation = typeof PLAN_ROTATIONS[number];
export type FlatPlanRotation = 0 | 90 | 180 | 270;
export type PlanProjection = 'flat' | 'iso';
export type FramePoint = readonly [number, number];
export interface FrameRect { x: number; y: number; w: number; h: number; }
export const PLAN_ROTATION_STORAGE = 'houseplan_card_rotation_v1';
export const PLAN_ROTATION_EVENT = 'houseplan-plan-rotation';
export const PLAN_ROTATION_ORIGIN: FramePoint = Object.freeze([500, 500]);

export const validFlatPlanRotation = (value: unknown): value is FlatPlanRotation =>
  value === 0 || value === 90 || value === 180 || value === 270;
export const validPlanRotation = (value: unknown): value is PlanRotation =>
  validFlatPlanRotation(value) || value === 45 || value === 135 || value === 225 || value === 315;
export const planRotation = (value: unknown): PlanRotation => validPlanRotation(value) ? value : 0;
/** For halfway positions the nearest quarter clockwise wins, including 315° → 0°. */
export const flatPlanRotation = (value: unknown): FlatPlanRotation =>
  ((Math.round(planRotation(value) / 90) * 90) % 360) as FlatPlanRotation;
export const planRotationForProjection = (value: unknown, projection: PlanProjection): PlanRotation =>
  projection === 'iso' ? planRotation(value) : flatPlanRotation(value);
export const stepPlanRotation = (value: PlanRotation, direction: -1 | 1, projection: PlanProjection = 'flat'): PlanRotation =>
  ((planRotationForProjection(value, projection) + direction * (projection === 'iso' ? 45 : 90) + 360) % 360) as PlanRotation;
export const inversePlanRotation = (value: PlanRotation): PlanRotation =>
  ((360 - value) % 360) as PlanRotation;

/** Exact basis at the cardinal angles, including zero entries. */
export function rotationBasis(degrees: number): readonly [number, number] {
  const turn = (degrees % 360 + 360) % 360;
  if (turn === 0) return [1, 0];
  if (turn === 90) return [0, 1];
  if (turn === 180) return [-1, 0];
  if (turn === 270) return [0, -1];
  const angle = degrees * Math.PI / 180;
  return [Math.cos(angle), Math.sin(angle)];
}

export function turnVector([x, y]: FramePoint, rotation: number): [number, number] {
  switch (rotation) {
    case 0: return [x, y];
    case 90:
    case -270: return [-y, x];
    case 180:
    case -180: return [-x, -y];
    case 270:
    case -90: return [y, -x];
    default: {
      const [cos, sin] = rotationBasis(rotation);
      return [x * cos - y * sin, x * sin + y * cos];
    }
  }
}

/** Rotate a camera offset in a compressed scene: D × R × inverse(D).
 * Plan geometry still uses turnVector; this is only the camera-space basis. */
export function turnSceneVector(point: FramePoint, rotation: number, floorScaleY = 1): [number, number] {
  if (!(Number.isFinite(floorScaleY) && floorScaleY > 1e-12)) throw new Error('invalid scene depth scale');
  const [x, y] = turnVector([point[0], point[1] / floorScaleY], rotation);
  return [x, y * floorScaleY];
}

export function turnPoint(
  point: FramePoint, rotation: PlanRotation, origin: FramePoint = PLAN_ROTATION_ORIGIN,
): [number, number] {
  if (!rotation) return [point[0], point[1]];
  const [x, y] = turnVector([point[0] - origin[0], point[1] - origin[1]], rotation);
  return [origin[0] + x, origin[1] + y];
}

export function turnRect(
  rect: FrameRect, rotation: PlanRotation, origin: FramePoint = PLAN_ROTATION_ORIGIN,
): FrameRect {
  if (!rotation) return { ...rect };
  const corners = [[rect.x, rect.y], [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]] as const;
  const points = corners.map(point => turnPoint(point, rotation, origin));
  const [cos, sin] = rotationBasis(rotation);
  return { x: Math.min(...points.map(p => p[0])), y: Math.min(...points.map(p => p[1])),
    w: Math.abs(cos) * rect.w + Math.abs(sin) * rect.h,
    h: Math.abs(sin) * rect.w + Math.abs(cos) * rect.h };
}

export function turnMatrix(rotation: PlanRotation, origin: FramePoint = PLAN_ROTATION_ORIGIN): string {
  const [c, s] = rotationBasis(rotation);
  return `matrix(${c} ${s} ${-s || 0} ${c} ${origin[0] - c * origin[0] + s * origin[1]} ${origin[1] - s * origin[0] - c * origin[1]})`;
}

/** One route for all HTML anchors. SVG uses turnMatrix with the same origin. */
export function framePercent(point: FramePoint, view: FrameRect, rotation: PlanRotation = 0): [number, number] {
  const p = turnPoint(point, rotation);
  return [(p[0] - view.x) / view.w * 100, (p[1] - view.y) / view.h * 100];
}

export function frameStyle(point: FramePoint, view: FrameRect, rotation: PlanRotation): string {
  const [left, top] = framePercent(point, view, rotation);
  return `left:${left.toFixed(2)}%;top:${top.toFixed(2)}%`;
}

const center = (rect: FrameRect): [number, number] => [rect.x + rect.w / 2, rect.y + rect.h / 2];

/**
 * Derive the displayed camera from the canonical camera. Re-fitting the rotated
 * bounds changes presentation scale, never the saved numbers. 2.5D supplies its
 * own projected bounds: vertical extrusion remains screen-up on every side.
 */
export function presentationView(
  canonical: FrameRect, canonicalBase: FrameRect, displayBase: FrameRect,
  rotation: number, zoom: number, displayFit: FrameRect,
  floorScaleY = 1,
): FrameRect {
  if (!rotation) return canonical;
  const c = center(canonical), base = center(canonicalBase), display = center(displayBase);
  const delta = turnSceneVector([c[0] - base[0], c[1] - base[1]], rotation, floorScaleY);
  const w = displayFit.w / zoom, h = displayFit.h / zoom;
  return { x: display[0] + delta[0] - w / 2, y: display[1] + delta[1] - h / 2, w, h };
}

/** Invert only a proposed display camera; the canonical size comes from its fit. */
export function canonicalView(
  displayed: FrameRect, canonicalBase: FrameRect, displayBase: FrameRect,
  rotation: number, zoom: number, canonicalFit: FrameRect,
  floorScaleY = 1,
): FrameRect {
  if (!rotation) return displayed;
  const c = center(displayed), base = center(canonicalBase), display = center(displayBase);
  const delta = turnSceneVector([c[0] - display[0], c[1] - display[1]], -rotation, floorScaleY);
  const w = canonicalFit.w / zoom, h = canonicalFit.h / zoom;
  return { x: base[0] + delta[0] - w / 2, y: base[1] + delta[1] - h / 2, w, h };
}

/** Rebase a physical camera onto a new fit without re-fitting its contents.
 * Its scalar zoom may legitimately exceed the ordinary user-command limits. */
export function physicalPlanCamera(
  camera: { centerX: number; centerY: number; pixelsPerUnit: number },
  vb: number[], display: FrameRect, rotation: PlanRotation, width: number, height: number,
): CameraState {
  const fit = fitView(vb, width / height);
  const displayFit = rotation ? fitView([display.x, display.y, display.w, display.h], width / height) : fit;
  const zoom = displayFit.w * camera.pixelsPerUnit / width;
  const w = fit.w / zoom, h = fit.h / zoom;
  return { zoom, viewBox: { x: camera.centerX - w / 2, y: camera.centerY - h / 2, w, h } };
}

/** Rendering uses the observed stage size; it never asks layout for a new one. */
export function presentationViewport(
  view: FrameRect, vb: number[], display: FrameRect, rotation: number, zoom: number,
  size: readonly [number, number] | null,
  visual: { stageWidth: number; stageHeight: number } | null,
  floorScaleY = 1,
): FrameRect {
  if (!rotation) return view;
  const aspect = visual ? visual.stageWidth / visual.stageHeight
    : size ? size[0] / size[1] : view.w / view.h;
  if (visual) zoom = fitView(vb, aspect).w / view.w;
  return presentationView(view, { x: vb[0], y: vb[1], w: vb[2], h: vb[3] }, display,
    rotation, zoom, fitView([display.x, display.y, display.w, display.h], aspect), floorScaleY);
}

/** Pointer anchoring and clamping meet at the canonical/display boundary. */
export function planZoomTarget(
  anchor: CameraState, zoom: number, vb: number[], display: FrameRect, rotation: number,
  width: number, height: number, sx: number, sy: number,
  clamp: (view: FrameRect, fit: FrameRect) => FrameRect,
  floorScaleY = 1,
): { target: CameraState; fit: FrameRect } | null {
  const fit = fitView(vb, width / height);
  const displayed = presentationViewport(anchor.viewBox, vb, display, rotation, anchor.zoom, [width, height], null, floorScaleY);
  const displayFit = rotation ? fitView([display.x, display.y, display.w, display.h], width / height) : fit;
  const target = cameraTargetAtAnchor({ zoom: anchor.zoom, viewBox: displayed }, zoom, displayFit, width, height, sx, sy);
  if (!target) return null;
  target.viewBox = clamp(canonicalView(target.viewBox, { x: vb[0], y: vb[1], w: vb[2], h: vb[3] },
    display, rotation, zoom, fit, floorScaleY), fit);
  return { target, fit };
}

export function homeArrowPosition(base: number[], view: FrameRect | null, rotation: number, floorScaleY = 1) {
  if (!view?.w || !view.h) return null;
  const [x, y, w, h] = base;
  if (!(x + w <= view.x || x >= view.x + view.w || y + h <= view.y || y >= view.y + view.h)) return null;
  const toward = turnSceneVector([x + w / 2 - view.x - view.w / 2, y + h / 2 - view.y - view.h / 2], rotation, floorScaleY);
  const angle = Math.atan2(toward[1], toward[0]);
  return { left: 50 + Math.cos(angle) * 38, top: 50 + Math.sin(angle) * 38, angle: angle * 180 / Math.PI };
}

export function effectivePlanRotation(
  cardValue: unknown, deviceValue: unknown, kiosk = false,
): PlanRotation {
  return !kiosk && validPlanRotation(deviceValue) ? deviceValue : validFlatPlanRotation(cardValue) ? cardValue : 0;
}

type RotationStorage = Pick<Storage, 'getItem' | 'setItem'>;
const browserStorage = (): RotationStorage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

/** Shared by both card types, with a memory fallback when browser storage fails. */
export class PlanRotationPreference {
  private values: Record<string, PlanRotation> = Object.create(null);
  private loaded = false;
  constructor(private readonly storage: () => RotationStorage | null = browserStorage) {}
  reload(): void {
    this.loaded = true;
    try {
      const storage = this.storage();
      if (!storage) return;
      const raw = storage.getItem(PLAN_ROTATION_STORAGE);
      const value: unknown = raw ? JSON.parse(raw) : {};
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      const values: Record<string, PlanRotation> = Object.create(null);
      for (const [key, rotation] of Object.entries(value)) if (validPlanRotation(rotation)) values[key] = rotation;
      this.values = values;
    } catch { /* Keep this screen's last working choice. */ }
  }
  get(spaceId: string, cardValue: unknown, kiosk = false): PlanRotation {
    if (!this.loaded) this.reload();
    return effectivePlanRotation(cardValue, this.values[spaceId], kiosk);
  }
  set(spaceId: string, value: PlanRotation): void {
    if (!this.loaded) this.reload();
    this.values[spaceId] = value;
    try { this.storage()?.setItem(PLAN_ROTATION_STORAGE, JSON.stringify(this.values)); } catch { /* Memory remains usable. */ }
  }
}

export const devicePlanRotation = new PlanRotationPreference();
