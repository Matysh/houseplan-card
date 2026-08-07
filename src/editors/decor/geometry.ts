import type { DecorShape, DecorStyle } from './types';

export interface DecorBox {
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
}

export interface SnapSegment {
  a: number[];
  b: number[];
}

export interface SnapGeometry {
  points: number[][];
  segments: SnapSegment[];
}

export interface SnapResult {
  point: number[];
  target: number[] | null;
  kind: 'grid' | 'point' | 'edge';
}

export const DEFAULT_DECOR_STYLE: DecorStyle = {
  color: '#607d8b',
  opacity: 1,
  // The old default was 3 render units. On the default 5 cm/cell plan this
  // is 3.6 cm, retained so a new canonical object looks familiar.
  widthCm: 3.6,
  fill: false,
  fillColor: '#607d8b',
  fillOpacity: 0.25,
};

export const clamp01 = (value: unknown, fallback = 1): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
};

export const normalizeAngle = (value: unknown): number => {
  let n = Number(value);
  if (!Number.isFinite(n)) return 0;
  n = ((n % 360) + 360) % 360;
  return n > 180 ? n - 360 : n;
};

/**
 * Axis-aligned boxes keep their stored top-left on the lattice. For an
 * oriented resize, however, resizeDecorBox has already derived this top-left
 * from the fixed opposite corner. Snapping it again translates the whole box
 * and breaks the fixed-corner contract.
 */
export function resizedBoxTopLeft(
  box: Pick<DecorBox, 'x' | 'y'>,
  angle: unknown,
  grid: (point: number[]) => number[],
): number[] {
  return normalizeAngle(angle) ? [box.x, box.y] : grid([box.x, box.y]);
}

/** A rectangle/ellipse must have two non-zero axes; a line only needs length. */
export function validDecorDraft(
  kind: 'line' | 'rect' | 'ellipse',
  a: number[], b: number[], minSize: number,
): boolean {
  const dx = Math.abs(b[0] - a[0]), dy = Math.abs(b[1] - a[1]);
  if (kind === 'line') return Math.hypot(dx, dy) >= minSize;
  return dx >= minSize && dy >= minSize;
}

/** Render units represented by a physical number of centimetres. */
export const decorCmToUnits = (cm: unknown, cellCm: number, gridPitch: number): number => {
  const n = Number(cm);
  const cell = Number.isFinite(cellCm) && cellCm > 0 ? cellCm : 5;
  return Number.isFinite(n) && n > 0 ? (n / cell) * gridPitch : 0;
};

/** Physical centimetres represented by render units. */
export const decorUnitsToCm = (units: unknown, cellCm: number, gridPitch: number): number => {
  const n = Number(units);
  const cell = Number.isFinite(cellCm) && cellCm > 0 ? cellCm : 5;
  return Number.isFinite(n) && gridPitch > 0 ? (n / gridPitch) * cell : 0;
};

/** Canonical width wins; legacy width remains pixel-identical until edited. */
export const decorStrokeCm = (
  shape: Pick<DecorShape, 'width_cm' | 'width'> | null | undefined,
  cellCm: number,
  gridPitch: number,
  fallback = DEFAULT_DECOR_STYLE.widthCm,
): number => {
  const canonical = Number(shape?.width_cm);
  if (Number.isFinite(canonical) && canonical > 0) return canonical;
  const legacy = Number(shape?.width);
  if (Number.isFinite(legacy) && legacy > 0) return decorUnitsToCm(legacy, cellCm, gridPitch);
  return fallback;
};

export const decorStrokeUnits = (
  shape: Pick<DecorShape, 'width_cm' | 'width'> | null | undefined,
  cellCm: number,
  gridPitch: number,
  fallback = DEFAULT_DECOR_STYLE.widthCm,
): number => {
  const canonical = Number(shape?.width_cm);
  if (Number.isFinite(canonical) && canonical > 0)
    return decorCmToUnits(canonical, cellCm, gridPitch);
  const legacy = Number(shape?.width);
  if (Number.isFinite(legacy) && legacy > 0) return legacy;
  return decorCmToUnits(fallback, cellCm, gridPitch);
};

export function decorStyleOf(
  shape: DecorShape | null | undefined,
  cellCm: number,
  gridPitch: number,
  fallback: DecorStyle = DEFAULT_DECOR_STYLE,
): DecorStyle {
  const fillable = shape?.kind === 'rect' || shape?.kind === 'ellipse';
  const source = shape as any;
  const color = /^#[0-9a-f]{6}$/i.test(String(source?.color || ''))
    ? String(source.color) : fallback.color;
  return {
    color,
    opacity: clamp01(source?.opacity, fallback.opacity),
    widthCm: decorStrokeCm(shape, cellCm, gridPitch, fallback.widthCm),
    fill: fillable ? source?.fill === true : false,
    fillColor: /^#[0-9a-f]{6}$/i.test(String(source?.fill_color || ''))
      ? String(source.fill_color) : (source?.fill ? color : fallback.fillColor),
    // Legacy fill was hard-coded to 0.25.
    fillOpacity: fillable && source?.fill
      ? clamp01(source?.fill_opacity, 0.25)
      : fallback.fillOpacity,
  };
}

/** Canonical persisted style. Legacy `width` is intentionally removed. */
export function decorStylePatch(style: DecorStyle, fillable: boolean): Record<string, unknown> {
  return {
    color: style.color,
    opacity: clamp01(style.opacity),
    width_cm: Math.max(0.1, Math.min(100, Number(style.widthCm) || 0.1)),
    ...(fillable ? {
      fill: style.fill,
      fill_color: style.fillColor,
      fill_opacity: clamp01(style.fillOpacity, 0.25),
    } : {}),
  };
}

export function boxCorners(box: DecorBox): number[][] {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const a = (normalizeAngle(box.angle) * Math.PI) / 180;
  const cs = Math.cos(a), sn = Math.sin(a);
  const rot = (x: number, y: number): number[] => {
    const dx = x - cx, dy = y - cy;
    return [cx + dx * cs - dy * sn, cy + dx * sn + dy * cs];
  };
  return [
    rot(box.x, box.y), rot(box.x + box.w, box.y),
    rot(box.x + box.w, box.y + box.h), rot(box.x, box.y + box.h),
  ];
}

export function boxAnchors(box: DecorBox): SnapGeometry {
  const c = boxCorners(box);
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const center = [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2];
  return {
    points: [...c, mid(c[0], c[1]), mid(c[1], c[2]), mid(c[2], c[3]), mid(c[3], c[0]), center],
    segments: c.map((p, i) => ({ a: p, b: c[(i + 1) % 4] })),
  };
}

/** Resize an oriented box about the opposite corner. */
export function resizeDecorBox(
  orig: DecorBox,
  sgx: number,
  sgy: number,
  px: number,
  py: number,
  keepAspect: boolean,
  step: number,
  minSize: number,
): DecorBox {
  const a = (normalizeAngle(orig.angle) * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a);
  const vx = -Math.sin(a), vy = Math.cos(a);
  const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
  const flx = sgx > 0 ? -orig.w / 2 : orig.w / 2;
  const fly = sgy > 0 ? -orig.h / 2 : orig.h / 2;
  const fx = cx + flx * ux + fly * vx;
  const fy = cy + flx * uy + fly * vy;
  const rx = px - fx, ry = py - fy;
  let w = (rx * ux + ry * uy) * (sgx > 0 ? 1 : -1);
  let h = (rx * vx + ry * vy) * (sgy > 0 ? 1 : -1);
  let proportionalScale: number | null = null;
  if (keepAspect) {
    const kx = w / Math.max(orig.w, minSize);
    const ky = h / Math.max(orig.h, minSize);
    proportionalScale = Math.max(
      minSize / Math.max(orig.w, minSize),
      minSize / Math.max(orig.h, minSize),
      kx, ky,
    );
    w = orig.w * proportionalScale;
    h = orig.h * proportionalScale;
  }
  if (step > 0) {
    if (keepAspect) {
      const wCells = Math.max(1, Math.round(orig.w / step));
      const hCells = Math.max(1, Math.round(orig.h / step));
      const aligned = Math.abs(orig.w - wCells * step) < 1e-6
        && Math.abs(orig.h - hCells * step) < 1e-6;
      if (aligned) {
        // A proportional box can keep BOTH dimensions on the grid only at a
        // common scale increment. For a 36×18-cell sofa that increment is
        // 1/18; snapping just the dominant side would leave the depth halfway
        // between cells. Shift remains the independent-axis escape hatch.
        const gcd = (a: number, b: number): number => {
          let x = Math.abs(a), y = Math.abs(b);
          while (y) [x, y] = [y, x % y];
          return Math.max(1, x);
        };
        const scaleStep = 1 / gcd(wCells, hCells);
        const minimumScale = Math.max(minSize / orig.w, minSize / orig.h);
        const scale = Math.max(
          minimumScale,
          Math.round((proportionalScale ?? 1) / scaleStep) * scaleStep,
        );
        w = orig.w * scale;
        h = orig.h * scale;
      } else {
        // Legacy off-grid boxes cannot satisfy exact ratio + two-axis grid at
        // once. Preserve their ratio and snap the visually dominant side.
        const dominantW = orig.w >= orig.h;
        if (dominantW) {
          w = Math.round(w / step) * step;
          h = w * (orig.h / Math.max(orig.w, minSize));
        } else {
          h = Math.round(h / step) * step;
          w = h * (orig.w / Math.max(orig.h, minSize));
        }
      }
    } else {
      w = Math.round(w / step) * step;
      h = Math.round(h / step) * step;
    }
  }
  w = Math.max(minSize, w);
  h = Math.max(minSize, h);
  const ncx = fx + (sgx > 0 ? w / 2 : -w / 2) * ux + (sgy > 0 ? h / 2 : -h / 2) * vx;
  const ncy = fy + (sgx > 0 ? w / 2 : -w / 2) * uy + (sgy > 0 ? h / 2 : -h / 2) * vy;
  return { x: ncx - w / 2, y: ncy - h / 2, w, h, angle: normalizeAngle(orig.angle) || undefined };
}

const closestOnSegment = (p: number[], a: number[], b: number[]): number[] => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) return [...a];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d2));
  return [a[0] + dx * t, a[1] + dy * t];
};

/**
 * Light magnetism that never violates the grid invariant. Candidate points and
 * edge projections are quantised through the caller's `grid` function before
 * they can win.
 */
export function snapDecorPoint(
  raw: number[], geometry: SnapGeometry, tolerance: number,
  grid: (point: number[]) => number[],
): SnapResult {
  const base = grid(raw);
  let best: { p: number[]; d: number; kind: 'point' | 'edge'; target: number[] } | null = null;
  for (const target of geometry.points) {
    const p = grid(target);
    const d = Math.hypot(p[0] - raw[0], p[1] - raw[1]);
    if (d <= tolerance && (!best || d < best.d)) best = { p, d, kind: 'point', target };
  }
  for (const edge of geometry.segments) {
    const target = closestOnSegment(raw, edge.a, edge.b);
    const p = grid(target);
    const d = Math.hypot(p[0] - raw[0], p[1] - raw[1]);
    if (d <= tolerance && (!best || d < best.d)) best = { p, d, kind: 'edge', target };
  }
  return best
    ? { point: best.p, target: best.target, kind: best.kind }
    : { point: base, target: null, kind: 'grid' };
}

export function mergeSnapGeometry(parts: ReadonlyArray<SnapGeometry>): SnapGeometry {
  return {
    points: parts.flatMap((p) => p.points),
    segments: parts.flatMap((p) => p.segments),
  };
}
