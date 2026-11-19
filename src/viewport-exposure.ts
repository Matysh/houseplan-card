import type { LiveViewBox } from './live-viewport';

export interface ViewportExposureLimits {
  /** World-space bounds including visible overflow. An editor grid is unbounded. */
  content?: LiveViewBox;
  pixelArea?: number;
}

const maxSurfacePixels = 32_000_000;
const right = (box: LiveViewBox) => box.x + box.w;
const bottom = (box: LiveViewBox) => box.y + box.h;

export function viewportExposure(view: LiveViewBox, limits: ViewportExposureLimits, margin = .5): LiveViewBox {
  const scale = limits.pixelArea && limits.pixelArea > 0
    ? Math.min(1 + 2 * margin, Math.max(1, Math.sqrt(maxSurfacePixels / limits.pixelArea)))
    : 1 + 2 * margin;
  const extraX = view.w * (scale - 1) / 2, extraY = view.h * (scale - 1) / 2;
  const bounds = limits.content;
  const x = Math.min(view.x, Math.max(view.x - extraX, bounds?.x ?? -Infinity));
  const y = Math.min(view.y, Math.max(view.y - extraY, bounds?.y ?? -Infinity));
  const x2 = Math.max(right(view), Math.min(right(view) + extraX, bounds ? right(bounds) : Infinity));
  const y2 = Math.max(bottom(view), Math.min(bottom(view) + extraY, bounds ? bottom(bounds) : Infinity));
  return { x, y, w: x2 - x, h: y2 - y };
}

export function exposureClip(basis: LiveViewBox, coverage: LiveViewBox): string {
  const x = (coverage.x - basis.x) / basis.w * 100, y = (coverage.y - basis.y) / basis.h * 100;
  const w = coverage.w / basis.w * 100, h = coverage.h / basis.h * 100;
  const percent = (value: number) => Math.round(value * 1e6) / 1e6;
  return 'inset(' + [y, 100 - x - w, 100 - y - h, x].map(value => percent(value) + '%').join(' ') + ')';
}

/** The target already contains every accepted wheel notch. Look one farther
 * when zooming out so freshly uncovered content cannot overtake the raster. */
export function forecastExposure(view: LiveViewBox, target: LiveViewBox): LiveViewBox {
  const growth = target.w - view.w;
  if (growth <= view.w * 1e-6) return target;
  const ahead = target.w * .15 / growth;
  return {
    x: target.x + (target.x - view.x) * ahead,
    y: target.y + (target.y - view.y) * ahead,
    w: target.w * 1.15,
    h: target.h * 1.15,
  };
}

export function viewportNeedsAnchor(anchor: LiveViewBox, coverage: LiveViewBox, current: LiveViewBox,
  limits: ViewportExposureLimits, forecast = current): boolean {
  const scale = anchor.w / current.w;
  if (scale >= 2 || scale <= .5) return true;
  const content = limits.content;
  const outside = (lower: boolean, perceived: number, horizon: number, boundary: number,
    contentEdge: number, available: number, desiredSafety: number) => {
    const direction = lower ? -1 : 1;
    if ((contentEdge - boundary) * direction <= 1e-6) return false;
    const requested = Math.max((perceived - boundary) * direction, (horizon - boundary) * direction);
    const safety = Math.min(desiredSafety, available * .5);
    return requested > -safety + 1e-6;
  };
  return outside(true, current.x, forecast.x, coverage.x, content?.x ?? -Infinity,
    anchor.x - coverage.x, forecast.w * .1)
    || outside(true, current.y, forecast.y, coverage.y, content?.y ?? -Infinity,
      anchor.y - coverage.y, forecast.h * .1)
    || outside(false, right(current), right(forecast), right(coverage), content ? right(content) : Infinity,
      right(coverage) - right(anchor), forecast.w * .1)
    || outside(false, bottom(current), bottom(forecast), bottom(coverage), content ? bottom(content) : Infinity,
      bottom(coverage) - bottom(anchor), forecast.h * .1);
}
