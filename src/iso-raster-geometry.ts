import type { LiveViewBox } from './live-viewport';
import { viewportExposure, type ViewportExposureLimits } from './viewport-exposure';

export interface RasterViewport extends ViewportExposureLimits {
  stageSize: readonly [width: number, height: number];
  dpr: number;
}

export interface IsoRasterFrame {
  bounds: LiveViewBox;
  width: number;
  height: number;
}

export const ISO_FRAME_PIXELS = 8_300_000;
export const ISO_UNDERLAY_PIXELS = 1_200_000;
const restoreDensity = .8;
const epsilon = 1e-6;

export function rasterIntersection(a: LiveViewBox, b: LiveViewBox): LiveViewBox | undefined {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : undefined;
}

export function rasterCovers(bounds: LiveViewBox, view: LiveViewBox, content = view): boolean {
  const visible = rasterIntersection(view, content);
  return !visible || (bounds.x <= visible.x + epsilon && bounds.y <= visible.y + epsilon &&
    bounds.x + bounds.w + epsilon >= visible.x + visible.w && bounds.y + bounds.h + epsilon >= visible.y + visible.h);
}

export function rasterSize({ stageSize: [w, h], dpr }: RasterViewport, budget = ISO_FRAME_PIXELS): readonly [number, number] {
  const scale = Math.min(dpr, Math.sqrt(budget / (w * h)));
  const width = Math.max(1, Math.min(budget, Math.floor(w * scale + epsilon)));
  return [width, Math.max(1, Math.min(Math.floor(budget / width), Math.floor(h * scale + epsilon)))];
}

export function rasterDensity(frame: IsoRasterFrame, view: LiveViewBox, limits: RasterViewport): number {
  const [w, h] = limits.stageSize;
  return Math.min(frame.width * view.w / (limits.dpr * w * frame.bounds.w),
    frame.height * view.h / (limits.dpr * h * frame.bounds.h));
}

function dimensions(bounds: LiveViewBox, view: LiveViewBox, limits: RasterViewport, budget: number): IsoRasterFrame {
  const [w, h] = limits.stageSize;
  const [width, height] = rasterSize({
    stageSize: [w * bounds.w / view.w, h * bounds.h / view.h], dpr: limits.dpr,
  }, budget);
  return { bounds, width, height };
}

/** Prefer a native-resolution visible frame. Spend the remaining pixel budget on reserve. */
export function planIsoRaster(view: LiveViewBox, limits: RasterViewport, budget = ISO_FRAME_PIXELS,
  underlay = false, margin = .1, density = 1): IsoRasterFrame | undefined {
  const content = limits.content;
  const visible = content ? rasterIntersection(view, content) : view;
  if (!visible) return;
  const [w, h] = limits.stageSize;
  const resolution = density < 1 ? { ...limits, dpr: limits.dpr * density } : limits;
  const pixels = w * h * resolution.dpr ** 2 * visible.w / view.w * visible.h / view.h;
  let bounds = visible;
  if (pixels > budget / restoreDensity ** 2 && underlay) {
    // A very large screen may only fit a sharp central portion. The rest of
    // the camera is covered by the same-plan underlay until the exact frame.
    const portion = Math.sqrt(budget / (pixels * restoreDensity ** 2));
    bounds = { x: visible.x + visible.w * (1 - portion) / 2, y: visible.y + visible.h * (1 - portion) / 2,
      w: visible.w * portion, h: visible.h * portion };
  } else if (pixels < budget) {
    const spare = Math.min(margin, (Math.sqrt(budget / pixels) - 1) / 2);
    const exposed = viewportExposure(view, limits, spare);
    bounds = content ? rasterIntersection(exposed, content)! : exposed;
    // The viewport reserve includes empty stage. Limit excess pixels on a
    // long, narrow plan as well as on one that fills the stage.
    const covered = dimensions(bounds, view, resolution, budget);
    if (rasterDensity(covered, view, limits) >= restoreDensity) return covered;
    bounds = visible;
  }
  return dimensions(bounds, view, resolution, budget);
}

export function planIsoUnderlay(view: LiveViewBox, limits: RasterViewport): IsoRasterFrame {
  return dimensions(limits.content ?? view, view, limits, ISO_UNDERLAY_PIXELS);
}

/** The underlay never contributes alpha inside the current scene frame. */
export function rasterUnderlayClip(bounds: LiveViewBox, coverage: LiveViewBox): string {
  const cut = rasterIntersection(bounds, coverage);
  if (!cut) return 'none';
  const x1 = (cut.x - bounds.x) * 100 / bounds.w, y1 = (cut.y - bounds.y) * 100 / bounds.h;
  const x2 = (cut.x + cut.w - bounds.x) * 100 / bounds.w, y2 = (cut.y + cut.h - bounds.y) * 100 / bounds.h;
  const gap = (x: number, y: number) => x + '% ' + y + '%';
  const cutPoints = [gap(x1, y1), gap(x2, y1), gap(x2, y2), gap(x1, y2), gap(x1, y1)];
  return 'polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ' + cutPoints.join(', ') + ', 0 0)';
}

const area = (view: LiveViewBox | undefined) => view ? view.w * view.h : 0;

export function rasterImproves(previous: IsoRasterFrame, candidate: IsoRasterFrame, view: LiveViewBox,
  limits: RasterViewport): boolean {
  const oldDensity = rasterDensity(previous, view, limits);
  const newDensity = rasterDensity(candidate, view, limits);
  const oldVisible = rasterIntersection(previous.bounds, view);
  const newVisible = rasterIntersection(candidate.bounds, view);
  if (!newVisible) return false;
  if (oldVisible && rasterIntersection(oldVisible, newVisible)
    && Math.min(newDensity, 1) < Math.min(oldDensity, 1) - .01) return false;
  // During compression, reduce oversampling without softening pixels. A
  // candidate that covers more plan should also keep the current sharp area.
  const sharper = newDensity > oldDensity + .01 && oldDensity < .99;
  const lessCompressed = newDensity >= .99 && oldDensity > newDensity * 1.15;
  const fillsMore = area(newVisible) > area(oldVisible) + epsilon;
  const keepsCoverage = !oldVisible || rasterCovers(candidate.bounds, oldVisible);
  return (keepsCoverage && (sharper || fillsMore || lessCompressed)) ||
    (sharper && area(newVisible) >= area(oldVisible) - epsilon);
}

/** Device pixel blur proportional to resampling, applied in surface coordinates. */
export function rasterSmoothing(density: number): number {
  if (!Number.isFinite(density) || density <= 0) return 0;
  const sigma = Math.min(3, Math.max(0, (1 / density - 1.35) * .55, (density - 1.35) * .28));
  return Math.round(sigma * 10) / 10;
}
