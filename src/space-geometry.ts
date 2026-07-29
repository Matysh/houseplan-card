/**
 * Pure geometry/model helpers for houseplan spaces — no Lit/DOM imports, so they
 * are directly unit-tested. Shared by the static renderer (space-render.ts) and
 * mirror the full card's private math.
 */
import { declump, contentUrl } from './logic';
import type { ServerConfig, SpaceModel, RoomCfg, DevItem } from './types';

export const NORM_W = 1000; // side of the render space — the canvas is square

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

export type Pt = { x: number; y: number };
export type Layout = Record<string, { s?: string; x: number; y: number } | undefined>;

/** Build render-space models (NORM_W × NORM_W) from a server config. */
export function spaceModels(cfg: ServerConfig | null): SpaceModel[] {
  if (!cfg || !Array.isArray(cfg.spaces)) return [];
  return cfg.spaces.map((s: any) => {
    const H = NORM_W; // square canvas
    const scale = (r: any): RoomCfg => ({
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
    });
    return {
      id: s.id,
      title: s.title,
      vb: [s.view_box[0] * NORM_W, s.view_box[1] * H, s.view_box[2] * NORM_W, s.view_box[3] * H],
      bg: s.plan_url ? { href: contentUrl(s.plan_url), ...fitInSquare(s.plan_aspect, NORM_W) } : null,
      rooms: (s.rooms || []).map(scale),
    } as SpaceModel;
  });
}

/**
 * What the plan actually occupies, padded by `pad` of the larger side.
 *
 * The canvas is a square big enough for any house, so a small hand-drawn plan
 * used to open as a speck in the middle of it. Zooming to the CONTENT instead
 * of the canvas is what people expect — but only when there is no background
 * image: with one, the image is the plan, and cropping to the rooms would hide
 * the parts of it nobody has outlined yet.
 *
 * Returns null when there is nothing drawn, so the caller keeps the full canvas.
 */
export function contentBounds(
  space: SpaceModel, pad = 0.05, extra?: ReadonlyArray<readonly [number, number]>,
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  // Only points within a bounded envelope around the canvas command the
  // opening view. The server bounds what it ACCEPTS now (±4 normalised,
  // HP-1501-01), but a store may already hold an absurd coordinate from
  // before that door existed — and one 1e100 vertex framed the space so wide
  // the plan was a dot for every client. An out-of-envelope point is still
  // rendered wherever it is; it just does not decide the frame. This applies
  // to ROOM GEOMETRY and device positions alike (HP-1500-03, HP-1501-01).
  const lo = -NORM_W * 0.25, hi = NORM_W * 1.25;
  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < lo || x > hi || y < lo || y > hi) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const r of space.rooms || []) {
    if (r.poly) for (const p of r.poly) add(p[0], p[1]);
    else if (r.x != null && r.y != null) {
      add(r.x, r.y);
      add(r.x + (r.w || 0), r.y + (r.h || 0));
    }
  }
  // things that live outside any room still count as content — a gate sensor
  // by the fence, a camera on a pole (the card passes device positions here)
  for (const p of extra || []) add(p[0], p[1]);
  if (minX > maxX || minY > maxY) return null;
  // A single marker (or a collinear row of them) has no area, and an SVG
  // viewBox with a zero axis draws nothing at all (HP-1500-03). An axis with
  // essentially no span — nothing there but icons — opens up to a floor:
  // enough canvas around a lone marker to see where it stands. A REAL thin
  // shape (a 100-unit corridor) keeps its tight frame; only the degenerate
  // case is padded, so the threshold sits at about an icon's size.
  const FLOOR = NORM_W * 0.2;
  const DEGENERATE = NORM_W * 0.03;
  if (maxX - minX < DEGENERATE) { const c = (minX + maxX) / 2; minX = c - FLOOR / 2; maxX = c + FLOOR / 2; }
  if (maxY - minY < DEGENERATE) { const c = (minY + maxY) / 2; minY = c - FLOOR / 2; maxY = c + FLOOR / 2; }
  const m = Math.max(maxX - minX, maxY - minY) * pad;
  const x = minX - m, y = minY - m;
  return { x, y, w: (maxX - minX) + m * 2, h: (maxY - minY) + m * 2 };
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
  const minDist = (iconPct / 100) * NORM_W * 1.3;
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
    ds.forEach((d, i) => (map[d.id] = pts[i]));
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
  const vb = model.vb;
  return { x: vb[0] + vb[2] / 2, y: vb[1] + vb[3] / 2 };
}

/** Saved room-label position (layout key rl_<roomId>) or the room centre. */
export function labelPos(r: RoomCfg, spaceId: string, layout: Layout, cfg: ServerConfig): Pt {
  const saved = layout['rl_' + (r.id || '')];
  if (saved && saved.s === spaceId) {
    return { x: saved.x * NORM_W, y: saved.y * NORM_W };
  }
  const c = roomCenter(r);
  return { x: c[0], y: c[1] };
}
