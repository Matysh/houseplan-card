/**
 * Pure geometry/model helpers for houseplan spaces — no Lit/DOM imports, so they
 * are directly unit-tested. Shared by the static renderer (space-render.ts) and
 * mirror the full card's private math.
 */
import { declump, contentUrl } from './logic';
import type { ServerConfig, SpaceModel, RoomCfg, DevItem, OpeningCfg } from './types';
import { boxCorners, normalizeAngle } from './editors/decor/geometry';
import { canonicalColumnAngle } from './physical-geometry';
import { gridVisualScale } from './grid-scale';

export const NORM_W = 1000; // side of the render space — the canvas is square

export type StaticPassageOpening = OpeningCfg & {
  type: 'passage'; rx: number; ry: number; rlen: number;
};

/** Static keeps the legacy wall output of doors/windows/gates. Only a passage
 * is negative architectural space on this surface. */
export function staticPassageOpenings(
  openings: readonly any[] | null | undefined,
  coordScale = NORM_W,
): StaticPassageOpening[] {
  const result: StaticPassageOpening[] = [];
  for (const [index, opening] of (openings || []).entries()) {
    if (opening?.type !== 'passage') continue;
    const projected: StaticPassageOpening = {
      ...opening,
      id: String(opening.id || `passage-${index}`),
      type: 'passage',
      rx: Number(opening.x) * coordScale,
      ry: Number(opening.y) * coordScale,
      rlen: Number(opening.length) * coordScale,
    };
    if ([projected.rx, projected.ry, projected.rlen, projected.angle]
      .every(Number.isFinite) && projected.rlen > 0) result.push(projected);
  }
  return result;
}

/**
 * Where a plan image sits inside the square canvas (v1.48.0).
 *
 * The canvas has no proportions of its own any more; the image keeps its own
 * and is centred, so a wide plan gets margins above and below and a tall one
 * gets them at the sides. `ratio` is the image's width/height; without it we
 * assume square, which is only ever a brief guess before the file loads.
 */
export function fitInSquare(ratio: number | null | undefined, side: number) {
  const r = Number(ratio);
  const a = Number.isFinite(r) && r > 0 ? r : 1;
  const w = a >= 1 ? side : side * a;
  const h = a >= 1 ? side / a : side;
  return { x: (side - w) / 2, y: (side - h) / 2, w, h };
}

/** Per-axis backdrop scale bounds — mirrors validation.py (docs/BACKDROP.md). */
export const PLAN_SCALE_MIN = 0.01;
export const PLAN_SCALE_MAX = 100;

/**
 * WHERE THE BACKDROP IMAGE SITS (docs/BACKDROP.md).
 *
 * `fitInSquare` is only the DEFAULT placement: the image centred in the square
 * canvas at its own proportions. On top of it a space may carry an optional
 * transform produced by the Background editor:
 *
 *   plan_x, plan_y — offset of the image's top-left corner from that default,
 *                    in NORMALISED units (the very units rooms, openings and
 *                    decor use, bounded by ±CANVAS_LIMIT);
 *   plan_scale     — legacy uniform fallback for both sides;
 *   plan_scale_x/y — canonical independent multipliers;
 *   plan_angle     — rotation around the transformed rectangle centre.
 *
 * All transform fields are OPTIONAL and their absence is exactly the pre-v1.58.0
 * behaviour, so every plan written before renders bit-identically and there is
 * no migration to run.
 */
export type PlanRect = Rect & { angle?: number };

export function planRect(space: any, side = NORM_W): PlanRect {
  const base = fitInSquare(space?.plan_aspect, side);
  const raw = Number(space?.plan_scale);
  const k = Number.isFinite(raw) && raw > 0
    ? Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, raw))
    : 1;
  const kxRaw = Number(space?.plan_scale_x);
  const kyRaw = Number(space?.plan_scale_y);
  const kx = Number.isFinite(kxRaw) && kxRaw > 0
    ? Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, kxRaw)) : k;
  const ky = Number.isFinite(kyRaw) && kyRaw > 0
    ? Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, kyRaw)) : k;
  const dx = Number(space?.plan_x);
  const dy = Number(space?.plan_y);
  const angle = normalizeAngle(space?.plan_angle);
  return {
    x: base.x + (Number.isFinite(dx) ? clampCanvasN(dx) : 0) * side,
    y: base.y + (Number.isFinite(dy) ? clampCanvasN(dy) : 0) * side,
    w: base.w * kx,
    h: base.h * ky,
    ...(angle ? { angle } : {}),
  };
}

export type Pt = { x: number; y: number };
export type Layout = Record<string, { s?: string; x: number; y: number } | undefined>;

/** Build render-space models (NORM_W × NORM_W) from a server config. */
/** A stored view_box the render can trust: 4 finite numbers, positive sizes.
 *  The server refuses anything else NOW (HP-1502-01), but a store may already
 *  hold [0,0,0,0] or negative sizes from before — and a zero axis serialises
 *  into viewBox="0 0 0 0", which draws nothing on every client. Bad input
 *  falls back to the whole canvas rather than to a blank screen. */
function safeViewBox(vb: any): [number, number, number, number] {
  if (
    Array.isArray(vb) && vb.length === 4 && vb.every((n: any) => Number.isFinite(n))
    && vb[2] > 1e-6 && vb[3] > 1e-6
  ) return vb as [number, number, number, number];
  return [0, 0, 1, 1];
}

/** Legacy rectangle rooms, normalised: a negative size is the same rectangle
 *  drawn from the other corner; the maths downstream assumes w/h >= 0. */
function normRect(r: any): { x?: number; y?: number; w?: number; h?: number } {
  if (r.x == null || r.y == null) return { x: r.x, y: r.y, w: r.w, h: r.h };
  const w = Number(r.w) || 0, h = Number(r.h) || 0;
  return {
    x: w < 0 ? r.x + w : r.x,
    y: h < 0 ? r.y + h : r.y,
    w: Math.abs(w),
    h: Math.abs(h),
  };
}

export function spaceModels(cfg: ServerConfig | null): SpaceModel[] {
  if (!cfg || !Array.isArray(cfg.spaces)) return [];
  return cfg.spaces.map((s: any) => {
    const H = NORM_W; // square canvas
    const scale = (raw: any): RoomCfg => { const r = { ...raw, ...normRect(raw) }; return {
      id: r.id,
      name: r.name,
      area: r.area ?? null,
      // carried, not dropped: the static card renders from this model too, and
      // without them it ignored the room-level fill override and drew a room the
      // full card leaves transparent (HP-1454-07)
      open_to: r.open_to || undefined,
      settings: r.settings || undefined,
      x: r.x != null ? r.x * NORM_W : undefined,
      y: r.y != null ? r.y * H : undefined,
      w: r.w != null ? r.w * NORM_W : undefined,
      h: r.h != null ? r.h * H : undefined,
      poly: r.poly ? r.poly.map((p: number[]) => [p[0] * NORM_W, p[1] * H]) : undefined,
      wall_ids: Array.isArray(r.wall_ids) ? [...r.wall_ids] : undefined,
    }; };
    const vb = safeViewBox(s.view_box);
    return {
      id: s.id,
      title: s.title,
      // Missing remains the historical 5 cm for stored-config compatibility.
      cellCm: Number.isFinite(Number(s.cell_cm)) && Number(s.cell_cm) > 0
        ? Number(s.cell_cm) : 5,
      vb: [vb[0] * NORM_W, vb[1] * H, vb[2] * NORM_W, vb[3] * H],
      // the image's own placement — the centred default plus whatever the
      // backdrop frame has stored (plan_x/y, per-axis scale and angle)
      bg: s.plan_url ? { href: contentUrl(s.plan_url), ...planRect(s, NORM_W) } : null,
      rooms: (s.rooms || []).map(scale),
      wall_segments: (s.wall_segments || []).map((wall: any) => ({
        ...wall,
        id: String(wall.id),
        a: [Number(wall.a?.[0]) * NORM_W, Number(wall.a?.[1]) * H],
        b: [Number(wall.b?.[0]) * NORM_W, Number(wall.b?.[1]) * H],
        cm: Number(wall.cm),
      })),
      room_drafts: (s.room_drafts || []).map((d: any) => ({
        id: d.id,
        points: (d.points || []).map((p: number[]) => [p[0] * NORM_W, p[1] * H]),
        segments: (d.segments || []).map((sg: any) => ({
          ...(typeof sg.id === 'string' && sg.id ? { id: sg.id } : {}),
          cm: Number(sg.cm),
        })),
      })),
      partitions: (s.partitions || []).map((p: any) => ({
        id: p.id,
        a: [p.a[0] * NORM_W, p.a[1] * H],
        b: [p.b[0] * NORM_W, p.b[1] * H],
        cm: Number(p.cm),
      })),
      wall_columns: (s.wall_columns || []).map((c: any) => ({
        id: c.id,
        shape: c.shape === 'circle' ? 'circle' : 'square',
        center: [c.center[0] * NORM_W, c.center[1] * H],
        cm: Number(c.cm),
        ...(c.shape === 'circle' ? {} : { angle: canonicalColumnAngle(c.angle) }),
      })),
    } as SpaceModel;
  });
}

/* =====================================================================
 * INFINITE CANVAS (docs/CANVAS.md)
 * ===================================================================== */

/** Sane coordinate range in NORMALISED units — mirrors validation.py.
 *  Not a frame: insurance against a stored 1e100 (HP-1500-03/HP-1501-01). */
export const CANVAS_LIMIT = 5000;
/** The same range in RENDER units. */
export const SANE_LIMIT = CANVAS_LIMIT * NORM_W;

/** Grid points across the plan width — the lattice the editor snaps to.
 *  It is derived from NORM_W alone, so it is the SAME step for every plan and
 *  it did NOT change when the canvas became infinite (docs/CANVAS.md §9). */
export const GRID_N = 240;
/** One grid step in RENDER units. */
export const GRID_PITCH = NORM_W / GRID_N;
/** One grid step in NORMALISED units — what the config and the layout store. */
export const GRID_STEP_N = 1 / GRID_N;

/** Snap a RENDER-unit coordinate to the editor's grid (docs/CANVAS.md §9). */
export function snapR(v: number): number {
  if (!Number.isFinite(v)) return v;
  // integer node index first, then back — dividing by 1000/240 directly turns
  // an exact 500 into 500.00000000000006 and every equality downstream lies
  const q = (Math.round((v * GRID_N) / NORM_W) * NORM_W) / GRID_N;
  return Math.abs(q - v) <= GRID_PITCH * 1e-9 ? v : q;
}
/** …and a point. Used for AUTO placements (a device with no saved position, a
 *  room label nobody has dragged) so that "everything is on the grid" holds for
 *  what the card puts there itself, not only for what the user drags. */
export function snapPt(p: { x: number; y: number }): { x: number; y: number } {
  return { x: snapR(p.x), y: snapR(p.y) };
}

/** Clamp a RENDER-unit coordinate to the sane canvas range (docs/CANVAS.md §9).
 *  This is the ONLY bound any editor gesture may impose: the plan has no edges
 *  any more, only a garbage limit that mirrors validation.py. */
export function clampCanvasR(v: number): number {
  return Number.isFinite(v) ? Math.min(SANE_LIMIT, Math.max(-SANE_LIMIT, v)) : 0;
}
/** The same range in NORMALISED units. */
export function clampCanvasN(v: number): number {
  return Number.isFinite(v) ? Math.min(CANVAS_LIMIT, Math.max(-CANVAS_LIMIT, v)) : 0;
}

/** Zoom-out floor: three times the content frame and no further (CANVAS.md §5). */
export const MIN_ZOOM = 1 / 3;
/** How far past the content frame panning may go, in screens (CANVAS.md §5). */
export const PAN_SLACK = 1;

/** Outlier vote tuning — see docs/CANVAS.md §4.1. */
export const OUTLIER_K = 10;          // "an order of magnitude further"
export const MIN_VOTERS = 4;          // fewer items: nobody to be far FROM
export const MIN_SPREAD = NORM_W * 0.05;  // ~a small room: floor for the scale
export const OUTLIER_MAX_SHARE = 1 / 3;   // more than this: not strays, a wide plan

/** A degenerate axis (a lone marker) is grown to this, so the SVG paints. */
export const DEGENERATE = NORM_W * 0.03;
export const FLOOR = NORM_W * 0.2;

export type Rect = { x: number; y: number; w: number; h: number };
/** One drawn/placed object, as its own bounding box (render units). */
export type ContentItem = { minX: number; minY: number; maxX: number; maxY: number };

/** Bounding box of a point cloud, as a ContentItem. */
export function itemOf(pts: ReadonlyArray<readonly [number, number] | number[]>): ContentItem | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    const x = Number(p[0]), y = Number(p[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return minX > maxX ? null : { minX, minY, maxX, maxY };
}

/** The room's own bounding box as a content item (polygon or legacy rect). */
export function roomItem(r: RoomCfg): ContentItem | null {
  if (r.poly && r.poly.length) return itemOf(r.poly);
  if (r.x == null || r.y == null) return null;
  return itemOf([[r.x, r.y], [r.x + (r.w || 0), r.y + (r.h || 0)]]);
}

/**
 * Every object of a space that counts as content (docs/CANVAS.md §4):
 * the rooms, the backdrop image rectangle, plus whatever the caller adds
 * (devices, openings, decor — the model does not carry those).
 */
export function contentItems(
  space: SpaceModel,
  extra?: ReadonlyArray<ContentItem | readonly [number, number]>,
): ContentItem[] {
  const out: ContentItem[] = [];
  for (const r of space.rooms || []) { const it = roomItem(r); if (it) out.push(it); }
  // The backdrop image is ONE OF the objects of the space, exactly like a room
  // (docs/BACKDROP.md §4): cropping to the outlined rooms would hide the parts
  // of the picture nobody has drawn over yet, and — since v1.58.0 — the
  // rectangle here is the MOVED and SCALED one, so «Вписать всё» follows the
  // picture wherever the owner has dragged it.
  if (space.bg) {
    const pts = boxCorners(space.bg);
    const item = itemOf(pts);
    if (item) out.push(item);
  }
  for (const e of extra || []) {
    if (Array.isArray(e)) { const it = itemOf([e as any]); if (it) out.push(it); }
    else out.push(e as ContentItem);
  }
  return out;
}

const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Rank-based quantile of an ALREADY SORTED array (nearest-rank, clamped). */
const quantile = (sorted: number[], q: number): number => {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i];
};

const boxOf = (items: ContentItem[]): Rect | null => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const it of items) {
    if (it.minX < minX) minX = it.minX;
    if (it.minY < minY) minY = it.minY;
    if (it.maxX > maxX) maxX = it.maxX;
    if (it.maxY > maxY) maxY = it.maxY;
  }
  if (minX > maxX || minY > maxY) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

/** Pad by `pad` of the longer side and lift a degenerate axis off zero. */
function padRect(b: Rect, pad: number): Rect {
  let { x, y, w, h } = b;
  // A single marker (or a collinear row of them) has no area, and an SVG
  // viewBox with a zero axis draws nothing at all (HP-1500-03). Only the
  // DEGENERATE case is inflated — a real 100-unit corridor keeps its frame.
  if (w < DEGENERATE) { x = x + w / 2 - FLOOR / 2; w = FLOOR; }
  if (h < DEGENERATE) { y = y + h / 2 - FLOOR / 2; h = FLOOR; }
  const m = Math.max(w, h) * pad;
  return { x: x - m, y: y - m, w: w + m * 2, h: h + m * 2 };
}

export interface ContentFrame {
  /** The main mass, padded — the opening view. */
  core: Rect | null;
  /** Everything, padded — what "show the far objects" fits. */
  all: Rect | null;
  /** How many items the core deliberately leaves out. */
  outliers: number;
}

/**
 * The content frame (docs/CANVAS.md §4). Pure and rank-based: one absurd
 * coordinate can move neither the median nor the 75th percentile, so it
 * cannot decide the frame — but it is never DELETED either, it is simply
 * not a voter, and "show everything" still reaches it.
 */
export function contentFrame(
  items: ReadonlyArray<ContentItem>,
  opts: { pad?: number; k?: number; minSpread?: number } = {},
): ContentFrame {
  const pad = opts.pad ?? 0.05;
  const k = opts.k ?? OUTLIER_K;
  const minSpread = opts.minSpread ?? MIN_SPREAD;
  // Step 1 — corruption, not content: anything past the range the backend
  // itself accepts is dropped outright (it is not reachable by "show all"
  // either, because it is not a coordinate anybody meant).
  const sane = items.filter((it) =>
    Number.isFinite(it.minX) && Number.isFinite(it.minY)
    && Number.isFinite(it.maxX) && Number.isFinite(it.maxY)
    && Math.abs(it.minX) <= SANE_LIMIT && Math.abs(it.maxX) <= SANE_LIMIT
    && Math.abs(it.minY) <= SANE_LIMIT && Math.abs(it.maxY) <= SANE_LIMIT);
  if (!sane.length) return { core: null, all: null, outliers: 0 };
  const all = boxOf(sane)!;
  if (sane.length < MIN_VOTERS) {
    const r = padRect(all, pad);
    return { core: r, all: r, outliers: 0 };
  }
  const cx = sane.map((it) => (it.minX + it.maxX) / 2);
  const cy = sane.map((it) => (it.minY + it.maxY) / 2);
  const mx = median(cx), my = median(cy);
  const d = sane.map((_, i) => Math.max(Math.abs(cx[i] - mx), Math.abs(cy[i] - my)));
  const spread = Math.max(quantile([...d].sort((p, q) => p - q), 0.75), minSpread);
  const far = d.map((v) => v > k * spread);
  const n = far.filter(Boolean).length;
  // Majority veto: a plan whose objects are simply spread out has no strays.
  const keep = n && n <= sane.length * OUTLIER_MAX_SHARE ? sane.filter((_, i) => !far[i]) : sane;
  const core = boxOf(keep) || all;
  return {
    core: padRect(core, pad),
    all: padRect(all, pad),
    outliers: keep === sane ? 0 : n,
  };
}

/**
 * What the plan actually occupies, padded by `pad` of the larger side —
 * the MAIN MASS only (docs/CANVAS.md §4.1). Returns null when nothing is
 * drawn, so the caller can fall back to the stored view_box hint.
 *
 * Kept as the narrow entry point used by the renderers; `contentFrame`
 * is the one that also reports the outliers and the fit-everything box.
 */
export function contentBounds(
  space: SpaceModel, pad = 0.05, extra?: ReadonlyArray<readonly [number, number]>,
): Rect | null {
  return contentFrame(contentItems(space, extra), { pad }).core;
}

/** The rectangle a renderer frames a space with: content, else the stored
 *  view_box HINT, else the legacy unit square (docs/CANVAS.md §4). */
export function spaceFrame(
  space: SpaceModel,
  extra?: ReadonlyArray<ContentItem | readonly [number, number]>,
  pad = 0.05,
): Rect {
  const f = contentFrame(contentItems(space, extra), { pad });
  if (f.core) return f.core;
  const vb = space.vb && space.vb.length === 4 && space.vb[2] > 0 && space.vb[3] > 0
    ? space.vb : [0, 0, NORM_W, NORM_W];
  return { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
}

/** Middle of the content (fallback anchor for a device with no position). */
export function spaceCenter(space: SpaceModel): Pt {
  const r = spaceFrame(space);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/**
 * The BASE UNIT one icon-percent is measured against, in render units
 * (docs/CANVAS.md §6). It is both the icon's own footprint and the
 * auto-placement spacing, so the two can never drift apart.
 *
 * For any plan that fits the old square this is exactly NORM_W — which is
 * what `vb.w` was for every plan the card itself ever wrote (the editor only
 * ever stored `view_box: [0,0,1,1]`), so sizes and layouts are bit-identical
 * to the pre-infinite-canvas card. A plan drawn three canvases wide gets a
 * proportionally bigger unit, which is what keeps its markers from
 * degenerating into dots once the frame is the content (see `iconCqw`).
 * Rooms only — deterministic, so the full card and the static card agree.
 *
 * The MAIN MASS only, by the very same vote the frame uses (§4.1). A single
 * room dragged into the far corner is already rejected from `contentFrame.core`
 * — but it used to keep its distance in this numerator, so the plan the user
 * actually looks at grew icons ~91x too big while the frame stayed correct
 * (DEV-2C947-03). What is out of the frame is out of the icon unit: one notion
 * of "the plan", not two.
 */
export function iconUnit(space: SpaceModel): number {
  const items: ContentItem[] = [];
  for (const r of space.rooms || []) { const it = roomItem(r); if (it) items.push(it); }
  // pad 0: this is a UNIT, not a viewport — the frame's 5 % breathing room has
  // no business inflating the icons. Degenerate axes are still lifted off zero,
  // which cannot matter here (FLOOR < NORM_W).
  const b = contentFrame(items, { pad: 0 }).core;
  // The historical NORM_W floor is a VISUAL size, not a physical distance.
  // A physically equivalent plan at a finer cell size stores proportionally
  // larger coordinates, so its floor must grow by the same factor. Without
  // this, icons and room labels shrink whenever one side of the plan is below
  // the old 1000-unit threshold (issue #239).
  const visualFloor = NORM_W * gridVisualScale(space.cellCm ?? 5);
  if (!b) return visualFloor;
  return Math.max(visualFloor, Math.min(SANE_LIMIT, Math.max(b.w, b.h)));
}

/**
 * `--icon-size` in cqw (docs/CANVAS.md §6) — the ONE expression both
 * renderers use.
 *
 * An icon is a percentage of the PLAN, not of the viewport: it scales with
 * the plan as you zoom, exactly as it did before the infinite canvas (owner,
 * 2026-08-03). In render units the marker always occupies
 * `iconPct/100 * iconUnit`, whatever the frame or the zoom happens to be;
 * dividing by the width of the visible view turns that into a percentage of
 * the container, which is what `cqw` means.
 *
 * The only thing the infinite canvas changed here is the numerator: it used
 * to be `vb.w`, the stored view_box, and a plan drawn past the old square
 * kept a 1000-unit numerator while its frame grew to tens of thousands —
 * markers would shrink to invisible dots. `iconUnit` is that same 1000 for
 * an ordinary plan and grows with an outsized one.
 */
export function iconCqw(
  iconPct: number, space: SpaceModel, viewW: number, kioskIcon = 1,
): number {
  const w = Number(viewW);
  const k = Number.isFinite(kioskIcon) && kioskIcon > 0 ? kioskIcon : 1;
  // No view yet (first paint, zero-width stage): fall back to the plain
  // percentage rather than to Infinity/NaN — the frame arrives a tick later.
  if (!Number.isFinite(w) || w <= 0) return iconPct * k;
  return (iconPct * iconUnit(space) * k) / w;
}

/** Grid step multipliers offered to the adaptive grid (docs/CANVAS.md §7). */
export const GRID_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/**
 * Adaptive grid density: which multiple of the base pitch is still legible
 * at the current scale, and which coarser one carries the accent dots.
 * `null` = even the coarsest step is sub-pixel, draw no grid at all.
 */
export function gridLevels(
  pitch: number, pxPerUnit: number, minPx = 7,
): { fine: number; coarse: number } | null {
  if (!(pitch > 0) || !(pxPerUnit > 0) || !Number.isFinite(pxPerUnit)) return null;
  const fine = GRID_STEPS.find((m) => pitch * m * pxPerUnit >= minPx);
  if (fine === undefined) return null;
  const coarse = GRID_STEPS.find((m) => m >= fine * 5) ?? fine * 5;
  return { fine, coarse };
}

/** Bounding rectangle of a room (rect or polygon) in render units. */
export function roomBounds(r: RoomCfg): { x: number; y: number; w: number; h: number } {
  if (r.poly && r.poly.length) {
    const xs = r.poly.map((p) => p[0]);
    const ys = r.poly.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  return { x: r.x ?? 0, y: r.y ?? 0, w: r.w ?? 0, h: r.h ?? 0 };
}

/** Geometric centre of a room (label anchor). */
export function roomCenter(r: RoomCfg): number[] {
  if (r.poly) {
    const n = r.poly.length;
    return [r.poly.reduce((a, p) => a + p[0], 0) / n, r.poly.reduce((a, p) => a + p[1], 0) / n];
  }
  return [r.x! + r.w! / 2, r.y! + Math.min(r.w!, r.h!) * 0.1];
}

/** Auto grid positions for a single space's area devices (identical to the full card). */
export function defaultPositions(devs: DevItem[], model: SpaceModel, iconPct: number): Record<string, Pt> {
  const map: Record<string, Pt> = {};
  // NOT a bare NORM_W any more (docs/CANVAS.md §6): on a plan wider than the
  // old square the icons are proportionally larger in render units, so the
  // declump distance has to grow with the plan or auto-placed markers overlap.
  const minDist = (iconPct / 100) * iconUnit(model) * 1.3;
  for (const r of model.rooms) {
    if (!r.area) continue;
    const ds = devs.filter((d) => d.area === r.area);
    if (!ds.length) continue;
    const b = roomBounds(r);
    const pad = Math.min(b.w, b.h) * 0.1;
    const iw = b.w - pad * 2;
    const ih = b.h - pad * 2;
    const cols = Math.max(1, Math.round(Math.sqrt((ds.length * iw) / Math.max(ih, 1))));
    const cw = iw / cols;
    const ch = ih / Math.max(Math.ceil(ds.length / cols), 1);
    const pts = ds.map((_, i) => ({
      x: b.x + pad + cw * ((i % cols) + 0.5),
      y: b.y + pad + ch * (Math.floor(i / cols) + 0.5),
    }));
    declump(pts, b, minDist, pad * 0.5);
    ds.forEach((d, i) => (map[d.id] = snapPt(pts[i])));
  }
  return map;
}

/** Marker position in render units: saved layout → default grid → space centre. */
export function markerPos(d: DevItem, layout: Layout, cfg: ServerConfig, defPos: Record<string, Pt>, model: SpaceModel): Pt {
  const saved = layout[d.id];
  if (saved && saved.s === d.space) {
    return { x: saved.x * NORM_W, y: saved.y * NORM_W };
  }
  if (defPos[d.id]) return defPos[d.id];
  // no saved position, no room to auto-place in: the middle of what IS drawn,
  // not the middle of a canvas that no longer has edges (docs/CANVAS.md)
  return snapPt(spaceCenter(model));
}

/** Saved room-label position (layout key rl_<roomId>) or the room centre. */
export function labelPos(r: RoomCfg, spaceId: string, layout: Layout, cfg: ServerConfig): Pt {
  const saved = layout['rl_' + (r.id || '')];
  if (saved && saved.s === spaceId) {
    return { x: saved.x * NORM_W, y: saved.y * NORM_W };
  }
  // never dragged: the centroid, put on the nearest node (docs/CANVAS.md §9)
  const c = roomCenter(r);
  return snapPt({ x: c[0], y: c[1] });
}
