import {isoCameraFor, projectPlanPoint, unprojectFloorPoint, type IsoCamera, type ViewRect} from './iso-projection';
import {fitView} from './logic';
import {canonicalView, inversePlanRotation, planRotation, presentationViewport, turnPoint,
  type FrameRect, type PlanRotation} from './view-frame';
import type {CameraState} from './viewport-transition';

export type ViewPlane = Readonly<IsoCamera> | null;

/** Passive SVG already contains the captured projection. Lazy geometry is not
 * evidence of Flat; an ISO packet with hidden borders is Flat by contract.
 * Without a preview, the still-presented live camera remains the authority. */
export function presentedViewPlane(preview: {projection:'flat'|'iso';rotation:number} | null,
  showBorders: boolean, live: ViewPlane): ViewPlane {
  return preview ? preview.projection === 'iso' && showBorders
    ? isoCameraFor(planRotation(preview.rotation)) : null : live;
}

/** The frame which actually presented a canonical viewport. Bounds include
 * extrusion, so their centre is deliberately not the projected floor centre. */
export interface ProjectionViewFrame {
  base: number[];
  display: FrameRect;
  rotation: PlanRotation;
  plane: ViewPlane;
  size: readonly [number, number];
}

/** Placeholder fit dimensions are scene units, never an observed pixel size.
 * Only an accepted stage (or its trusted warm memo) can establish a camera. */
export function acceptedViewFrame(view: ViewRect | null, frame: ProjectionViewFrame,
  pixels: readonly [number,number] | null | undefined): ProjectionViewFrame | null {
  if (!view || !pixels || ![...pixels,view.w,view.h].every(value=>Number.isFinite(value)&&value>0)) return null;
  return {...frame,size:[pixels[0],pixels[1]]};
}

/** A changed fit is a new camera basis even when both frames are Flat.
 * Quarter-turn commands deliberately orbit the plan; stage resizing already
 * has a physical-camera owner and must not be applied a second time here. */
export function shouldRebaseViewFrame(from: ProjectionViewFrame, to: ProjectionViewFrame): boolean {
  if (!!from.plane !== !!to.plane) return true;
  return from.rotation === to.rotation && (from.base.length !== to.base.length
    || from.base.some((value,index)=>value !== to.base[index])
    || (['x','y','w','h'] as const).some(key=>from.display[key] !== to.display[key]));
}

export function presentedView(view: ViewRect, zoom: number, frame: ProjectionViewFrame): ViewRect {
  return presentationViewport(view, frame.base, frame.display, frame.rotation, zoom,
    frame.size, null, frame.plane?.floorScaleY ?? 1);
}

/** Decode the last presented frame, but use the latest viewport after live pan. */
export function physicalViewCamera(view: ViewRect, zoom: number, frame: ProjectionViewFrame) {
  const shown = presentedView(view, zoom, frame);
  const center = [shown.x + shown.w / 2, shown.y + shown.h / 2] as const;
  const point = frame.plane ? unprojectFloorPoint(center, frame.plane)
    : turnPoint(center, inversePlanRotation(frame.rotation));
  return {centerX: point[0], centerY: point[1], pixelsPerUnit: frame.size[0] / shown.w};
}

/** Encode a physical floor camera through the same canonical/display authority
 * used by rendering. Stage changes preserve pixels per displayed scene unit. */
export function canonicalPhysicalCamera(
  camera: {centerX: number; centerY: number; pixelsPerUnit: number}, frame: ProjectionViewFrame,
): CameraState {
  const [width, height] = frame.size, aspect = width / height;
  const fit = fitView(frame.base, aspect);
  const displayFit = fitView([frame.display.x, frame.display.y, frame.display.w, frame.display.h], aspect);
  const point = [camera.centerX, camera.centerY] as const;
  const [x, y] = frame.plane ? projectPlanPoint(point, 0, frame.plane) : turnPoint(point, frame.rotation);
  const w = width / camera.pixelsPerUnit, h = height / camera.pixelsPerUnit;
  const zoom = (frame.rotation ? displayFit : fit).w / w;
  const viewBox = canonicalView({x: x-w/2, y:y-h/2, w, h},
    {x:frame.base[0], y:frame.base[1], w:frame.base[2], h:frame.base[3]}, frame.display,
    frame.rotation, zoom, fit, frame.plane?.floorScaleY ?? 1);
  return {zoom, viewBox};
}
