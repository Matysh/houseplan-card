/**
 * Pure geometry/model helpers for houseplan spaces — no Lit/DOM imports, so they
 * are directly unit-tested. Shared by the static renderer (space-render.ts) and
 * mirror the full card's private math.
 */
import { declump } from './logic';
import type { ServerConfig, SpaceModel, RoomCfg, DevItem } from './types';

export const NORM_W = 1000; // width of the render space for normalized configs

export type Pt = { x: number; y: number };
export type Layout = Record<string, { s?: string; x: number; y: number } | undefined>;

/** Build render-space models (NORM_W × NORM_W/aspect) from a server config. */
export function spaceModels(cfg: ServerConfig | null): SpaceModel[] {
  if (!cfg || !Array.isArray(cfg.spaces)) return [];
  return cfg.spaces.map((s: any) => {
    const H = NORM_W / s.aspect;
    const scale = (r: any): RoomCfg => ({
      id: r.id,
      name: r.name,
      area: r.area ?? null,
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
      bg: s.plan_url ? { href: s.plan_url, x: 0, y: 0, w: NORM_W, h: H } : null,
      rooms: (s.rooms || []).map(scale),
    } as SpaceModel;
  });
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
    const aspect = cfg.spaces.find((x: any) => x.id === d.space)?.aspect || 1;
    return { x: saved.x * NORM_W, y: saved.y * (NORM_W / aspect) };
  }
  if (defPos[d.id]) return defPos[d.id];
  const vb = model.vb;
  return { x: vb[0] + vb[2] / 2, y: vb[1] + vb[3] / 2 };
}

/** Saved room-label position (layout key rl_<roomId>) or the room centre. */
export function labelPos(r: RoomCfg, spaceId: string, layout: Layout, cfg: ServerConfig): Pt {
  const saved = layout['rl_' + (r.id || '')];
  if (saved && saved.s === spaceId) {
    const aspect = cfg.spaces.find((x: any) => x.id === spaceId)?.aspect || 1;
    return { x: saved.x * NORM_W, y: saved.y * (NORM_W / aspect) };
  }
  const c = roomCenter(r);
  return { x: c[0], y: c[1] };
}
