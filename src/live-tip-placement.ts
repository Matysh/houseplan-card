/** Screen-space rectangles shared by the tooltip and its measured obstacles. */
export type TipRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type DeviceTooltipPlacementInput = {
  preferred: { x: number; y: number };
  size: { width: number; height: number };
  /** Intersection of the visible stage and viewport, in the same coordinates. */
  bounds: TipRect;
  /** Visible diagnostic badges and the source marker; never route lines. */
  blockers: readonly TipRect[];
  gap?: number;
  edge?: number;
};

const validRect = (rect: TipRect): boolean =>
  [rect.left, rect.top, rect.right, rect.bottom, rect.width, rect.height].every(Number.isFinite)
  && rect.right >= rect.left && rect.bottom >= rect.top && rect.width >= 0 && rect.height >= 0;

/**
 * Find the closest complete, unobscured tooltip position without changing its size.
 * Null means that no placement satisfies the bounds and clearance, or measurements
 * are not ready. Nothing is retained: a later resize/badge update can restore it.
 */
export function placeDeviceTooltip(input: DeviceTooltipPlacementInput): { left: number; top: number } | null {
  const { preferred, size, bounds, blockers, gap = 8, edge = 8 } = input;
  if (![preferred.x, preferred.y, size.width, size.height, gap, edge].every(Number.isFinite)
      || size.width <= 0 || size.height <= 0 || gap < 0 || edge < 0
      || !validRect(bounds) || blockers.some((rect) => !validRect(rect))) return null;

  const minLeft = bounds.left + edge;
  const maxLeft = bounds.right - edge - size.width;
  const minTop = bounds.top + edge;
  const maxTop = bounds.bottom - edge - size.height;
  if (![minLeft, maxLeft, minTop, maxTop].every(Number.isFinite)
      || maxLeft < minLeft || maxTop < minTop) return null;

  // Expand each obstacle into the open rectangle forbidden to the tooltip's
  // top-left corner. Touching its boundary leaves exactly the requested gap.
  const forbidden = blockers
    .filter((rect) => rect.right > rect.left && rect.bottom > rect.top)
    .map((rect) => ({
      left: rect.left - gap - size.width,
      right: rect.right + gap,
      top: rect.top - gap - size.height,
      bottom: rect.bottom + gap,
    }));
  const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
  const xs = new Set([minLeft, maxLeft, clamp(preferred.x, minLeft, maxLeft)]);
  const ys = new Set([minTop, maxTop, clamp(preferred.y, minTop, maxTop)]);
  for (const rect of forbidden) {
    xs.add(clamp(rect.left, minLeft, maxLeft));
    xs.add(clamp(rect.right, minLeft, maxLeft));
    ys.add(clamp(rect.top, minTop, maxTop));
    ys.add(clamp(rect.bottom, minTop, maxTop));
  }

  // Feasible regions have axis-aligned edges at these coordinates. Their nearest
  // point is a projected preferred coordinate or an edge intersection, so the
  // cross product also finds pockets that four directional guesses would miss.
  const columns = [...xs].sort((a, b) => a - b);
  const rows = [...ys].sort((a, b) => a - b);
  let best: { left: number; top: number } | null = null;
  let bestDistance = Infinity;
  for (const top of rows) {
    for (const left of columns) {
      if (forbidden.some((rect) => left > rect.left && left < rect.right
          && top > rect.top && top < rect.bottom)) continue;
      const distance = Math.hypot(left - preferred.x, top - preferred.y);
      // Sorted coordinates break exact ties topmost, then leftmost, independently
      // of DOM/blocker order. Keep subpixels so rounding cannot reintroduce overlap.
      if (!best || distance < bestDistance) {
        best = { left, top };
        bestDistance = distance;
      }
    }
  }
  return best;
}
