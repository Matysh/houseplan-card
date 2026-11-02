import { fitView } from './logic';
import { canonicalView, type FrameRect, type PlanRotation } from './view-frame';
import type { CameraState } from './viewport-transition';

export interface ScreenCameraTarget {
  camera: CameraState;
  fit: FrameRect;
  fitPixelsPerUnit: number;
  pixelsPerUnit: number;
  size: readonly [number, number];
}

/** The camera still covers the full stage. Only its fit and centre use the
 * unobscured rectangle; the panel band includes its gap to the stage edge. */
export function screenFreeArea(width: number, height: number,
  panel: { side: 'right' | 'bottom'; rect: FrameRect } | null): FrameRect {
  const full = { x: 0, y: 0, w: width, h: height };
  if (!panel) return full;
  const r = panel.rect;
  if (r.x >= width || r.y >= height || r.x + r.w <= 0 || r.y + r.h <= 0) return full;
  return panel.side === 'right' ? { ...full, w: Math.max(0, r.x) }
    : { ...full, h: Math.max(0, r.y) };
}

/** Uses the existing canonical/projected bounds, never a second geometry walk. */
export function screenCameraTarget(vb: number[], display: FrameRect, rotation: PlanRotation,
  size: readonly [number, number], free: FrameRect, multiplier: number): ScreenCameraTarget | null {
  const [width, height] = size;
  const bounds = rotation ? display : { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  if (![width, height, free.w, free.h, bounds.w, bounds.h, multiplier].every(n => Number.isFinite(n) && n > 0)) return null;
  const fit = fitView(vb, width / height);
  const displayFit = rotation ? fitView([display.x, display.y, display.w, display.h], width / height) : fit;
  const fitPixelsPerUnit = Math.min(free.w / bounds.w, free.h / bounds.h);
  const pixelsPerUnit = fitPixelsPerUnit * multiplier;
  const zoom = displayFit.w * pixelsPerUnit / width;
  const w = width / pixelsPerUnit, h = height / pixelsPerUnit;
  const displayed = { x: bounds.x + bounds.w / 2 + (width / 2 - free.x - free.w / 2) / pixelsPerUnit - w / 2,
    y: bounds.y + bounds.h / 2 + (height / 2 - free.y - free.h / 2) / pixelsPerUnit - h / 2, w, h };
  return { camera: { zoom, viewBox: canonicalView(displayed,
    { x: vb[0], y: vb[1], w: vb[2], h: vb[3] }, display, rotation, zoom, fit) },
    fit, fitPixelsPerUnit, pixelsPerUnit, size };
}

/** Canonical centres share the quarter-turn metric. No layout reads. */
export function onScreenReference(current: CameraState, reference: ScreenCameraTarget, busy = false): boolean {
  if (busy || !current.viewBox.w || !reference.camera.viewBox.w) return false;
  const a = current.viewBox, b = reference.camera.viewBox;
  const scale = b.w / a.w;
  return Math.abs(scale - 1) <= 0.0001
    && Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2) * reference.pixelsPerUnit <= 1;
}

export function screenZoomBadge(current: CameraState, reference: ScreenCameraTarget): { percent: number; hidden: boolean } {
  const percent = Math.round(reference.pixelsPerUnit * reference.camera.viewBox.w / current.viewBox.w / reference.fitPixelsPerUnit * 100);
  return { percent, hidden: percent === 100 };
}
