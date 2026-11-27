import { Vector3, type Camera } from 'three';
import type { ViewRect } from './iso-projection';

export interface FloorDetail extends ViewRect { width: number; height: number }
export const FLOOR_DETAIL_DELAY_MS = 160;
const MAX_EDGE = 2048;

/** One bounded tile in world coordinates. The quiet camera is the only consumer. */
export function plan3dFloorDetail(camera: Camera, bounds: ViewRect,
  pixels: { width: number; height: number }, baseDensity: number): FloorDetail | null {
  const corners: Vector3[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    const near = new Vector3(x, y, -1).unproject(camera), far = new Vector3(x, y, 1).unproject(camera);
    const drop = near.y - far.y;
    if (!(drop > 0 && near.y >= 0)) return null;
    const point = near.lerp(far, near.y / drop);
    if (!Number.isFinite(point.x + point.z)) return null;
    corners.push(point);
  }
  const left = Math.min(...corners.map(p => p.x)), right = Math.max(...corners.map(p => p.x));
  const top = Math.min(...corners.map(p => p.z)), bottom = Math.max(...corners.map(p => p.z));
  const padX = (right - left) * .08, padY = (bottom - top) * .08;
  const x = Math.max(bounds.x, left - padX), y = Math.max(bounds.y, top - padY);
  const w = Math.min(bounds.x + bounds.w, right + padX) - x;
  const h = Math.min(bounds.y + bounds.h, bottom + padY) - y;
  if (!(w > 0 && h > 0)) return null;
  // Measure the closest perspective corners rather than assuming the average
  // floor density. Keep one texture even on large or high-DPI screens.
  let density = 0;
  for (const a of corners) {
    const screen = a.clone().project(camera);
    for (const b of [a.clone().add(new Vector3(1, 0, 0)), a.clone().add(new Vector3(0, 0, 1))]) {
      b.project(camera);
      density = Math.max(density, Math.hypot((screen.x - b.x) * pixels.width / 2, (screen.y - b.y) * pixels.height / 2));
    }
  }
  const scale = Math.min(MAX_EDGE / Math.max(w, h), density * 1.25);
  if (!Number.isFinite(scale) || !(scale > 1.4 * baseDensity)) return null;
  return { x, y, w, h, width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) };
}

/** Keep the full-plan image outside the high-resolution rectangle. No pixels
 * are drawn twice, so transparent and overlapping decor keeps its opacity. */
export function floorOutsideDetail(bounds: ViewRect, tile: ViewRect): ViewRect[] {
  const right = tile.x + tile.w, bottom = tile.y + tile.h;
  return [
    { x: bounds.x, y: bounds.y, w: bounds.w, h: tile.y - bounds.y },
    { x: bounds.x, y: bottom, w: bounds.w, h: bounds.y + bounds.h - bottom },
    { x: bounds.x, y: tile.y, w: tile.x - bounds.x, h: tile.h },
    { x: right, y: tile.y, w: bounds.x + bounds.w - right, h: tile.h },
  ].filter(rect => rect.w > 0 && rect.h > 0);
}

/** The base is the sanitizer's own SVG. Retarget just its root viewport;
 * reuse the exact composited nodes and embedded image bytes without extra I/O. */
export async function floorDetailSvg(source: Blob, tile: FloorDetail): Promise<Blob | null> {
  if (source.type !== 'image/svg+xml' || ![tile.x, tile.y, tile.w, tile.h, tile.width, tile.height].every(Number.isFinite))
    return null;
  const prefix = await source.slice(0, 4096).text();
  const end = prefix.indexOf('>');
  if (!/^<svg(?:\s|>)/.test(prefix) || end < 0) return null;
  const head = prefix.slice(0, end).replace(/ (?:width|height|viewBox|preserveAspectRatio)="[^"]*"/g, '');
  const skip = new TextEncoder().encode(prefix.slice(0, end + 1)).byteLength;
  const box = `${tile.x} ${tile.y} ${tile.w} ${tile.h}`;
  return new Blob([`${head} width="${tile.width}" height="${tile.height}" viewBox="${box}" preserveAspectRatio="none">`,
    source.slice(skip)], { type: source.type });
}
