export type RectLike = Pick<DOMRectReadOnly, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;

export type FloatingViewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type FloatingPlacement = {
  left: number;
  top: number;
  side: 'top' | 'bottom';
  maxWidth: number;
  maxHeight: number;
};

/** Viewport used by fixed-position UI, including pinch-zoom/virtual-keyboard offsets. */
export function floatingViewport(win: Window): FloatingViewport {
  const visual = win.visualViewport;
  if (visual && Number.isFinite(visual.width) && Number.isFinite(visual.height)) {
    return {
      left: Number(visual.offsetLeft) || 0,
      top: Number(visual.offsetTop) || 0,
      width: Math.max(0, Number(visual.width) || 0),
      height: Math.max(0, Number(visual.height) || 0),
    };
  }
  return { left: 0, top: 0, width: win.innerWidth, height: win.innerHeight };
}

/**
 * Pure flip/shift calculation shared by every small dialog-owned surface.
 * Oversized surfaces are constrained to the safe viewport and pinned to its edge.
 */
export function placeFloatingSurface(
  anchor: RectLike,
  surface: RectLike,
  viewport: FloatingViewport,
  gap = 7,
  edge = 8,
): FloatingPlacement {
  const safeLeft = viewport.left + edge;
  const safeTop = viewport.top + edge;
  const safeRight = Math.max(safeLeft, viewport.left + viewport.width - edge);
  const safeBottom = Math.max(safeTop, viewport.top + viewport.height - edge);
  const maxWidth = Math.max(0, safeRight - safeLeft);
  const maxHeight = Math.max(0, safeBottom - safeTop);
  const width = Math.min(Math.max(0, surface.width), maxWidth);
  const height = Math.min(Math.max(0, surface.height), maxHeight);

  let left = anchor.left;
  if (left + width > safeRight) left = anchor.right - width;
  left = Math.min(Math.max(safeLeft, left), Math.max(safeLeft, safeRight - width));

  const below = anchor.bottom + gap;
  const above = anchor.top - gap - height;
  let side: 'top' | 'bottom' = 'bottom';
  let top = below;
  if (below + height > safeBottom && above >= safeTop) {
    side = 'top';
    // The trigger itself may be below the visual viewport while its dialog is
    // scrolled.  "Above the trigger" is then still off-screen, so shift the
    // surface back inside the same safe bounds used by the bottom branch.
    top = Math.min(Math.max(safeTop, above), Math.max(safeTop, safeBottom - height));
  } else {
    top = Math.min(Math.max(safeTop, below), Math.max(safeTop, safeBottom - height));
  }

  return {
    left: Math.round(left),
    top: Math.round(top),
    side,
    maxWidth: Math.round(maxWidth),
    maxHeight: Math.round(maxHeight),
  };
}

export function popoverSupported(win: Window): boolean {
  const prototype = (win as any).HTMLElement?.prototype;
  return typeof prototype?.showPopover === 'function'
    && typeof prototype?.hidePopover === 'function';
}
