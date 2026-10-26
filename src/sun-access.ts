/** Sun-only room topology. Never edits the physical plan or artificial-light barriers. */
import { pointInPolygon } from './logic';

export interface SunRoom { id: string; poly: number[][]; sunTransparent?: boolean }
type Span = { a: number[]; b: number[]; plus: SunRoom | null; minus: SunRoom | null };
export interface SunAccess {
  outside: ReadonlySet<string>;
  roomAt: (point: number[]) => SunRoom | null;
}

const area = (poly: number[][]): number => Math.abs(poly.reduce((sum, p, i) => {
  const q = poly[(i + 1) % poly.length];
  return sum + p[0] * q[1] - q[0] * p[1];
}, 0));

/** Stay inside the nearest face, even when a neighbouring room is very thin. */
function faceProbe(x: number, y: number, limit: number, rooms: SunRoom[]): number {
  let clearance2 = Infinity;
  const roundoff2 = (Number.EPSILON * Math.max(1, Math.abs(x), Math.abs(y)) * 32) ** 2;
  for (const room of rooms) for (let i = 0; i < room.poly.length; i++) {
    const a = room.poly[i], b = room.poly[(i + 1) % room.poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
    if (!length2) continue;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length2));
    const distance2 = (x - a[0] - dx * t) ** 2 + (y - a[1] - dy * t) ** 2;
    if (distance2 > roundoff2) clearance2 = Math.min(clearance2, distance2);
  }
  return Math.min(limit, Math.sqrt(clearance2) / 4);
}

/** Split a boundary at all canonical vertices, including partial common walls. */
function spans(a: number[], b: number[], rooms: SunRoom[], roomAt: SunAccess['roomAt']): Span[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  if (!(len > 1e-8)) return [];
  const stops = [0, 1];
  for (const room of rooms) for (const p of room.poly) {
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len);
    if (t > 0 && t < 1 && Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len < 1e-7) stops.push(t);
  }
  stops.sort((x, y) => x - y);
  const out: Span[] = [];
  for (let i = 1; i < stops.length; i++) {
    const lo = stops[i - 1], hi = stops[i];
    if ((hi - lo) * len <= 1e-7) continue;
    const mid = (lo + hi) / 2;
    const x = a[0] + dx * mid, y = a[1] + dy * mid;
    const probe = faceProbe(x, y, Math.min(1e-4, (hi - lo) * len * 1e-4), rooms);
    out.push({ a: [a[0] + dx * lo, a[1] + dy * lo], b: [a[0] + dx * hi, a[1] + dy * hi],
      plus: roomAt([x + dy / len * probe, y - dx / len * probe]),
      minus: roomAt([x - dy / len * probe, y + dx / len * probe]) });
  }
  return out;
}

/** Seed against the COMPLETE plan first, then flood flagged neighbours only. */
export function resolveSunAccess(rooms: SunRoom[]): SunAccess {
  const outside = new Set<string>();
  // The innermost contour owns nested islands; order must never choose the host.
  const ordered = rooms.filter(r => r.poly.length >= 3)
    .map(room => ({ room, area: area(room.poly) }))
    .sort((a, b) => a.area - b.area || (a.room.id < b.room.id ? -1 : a.room.id > b.room.id ? 1 : 0));
  const roomAt = (point: number[]): SunRoom | null => ordered.find(r => pointInPolygon(point, r.room.poly))?.room ?? null;
  if (!rooms.some(r => r.sunTransparent)) return { outside, roomAt };
  const neighbours = new Map<string, Set<string>>();
  for (const room of rooms.filter(r => r.sunTransparent)) for (let i = 0; i < room.poly.length; i++) {
    for (const span of spans(room.poly[i], room.poly[(i + 1) % room.poly.length], rooms, roomAt)) {
      const { plus, minus } = span;
      if (plus?.id === minus?.id) continue;
      if (plus?.sunTransparent && !minus) outside.add(plus.id);
      if (minus?.sunTransparent && !plus) outside.add(minus.id);
      if (!plus?.sunTransparent || !minus?.sunTransparent) continue;
      for (const [a, b] of [[plus.id, minus.id], [minus.id, plus.id]]) {
        if (!neighbours.has(a)) neighbours.set(a, new Set());
        neighbours.get(a)!.add(b);
      }
    }
  }
  const queue = [...outside];
  for (let i = 0; i < queue.length; i++) for (const id of neighbours.get(queue[i]) ?? []) {
    if (outside.has(id)) continue;
    outside.add(id); queue.push(id);
  }
  return { outside, roomAt };
}

/** Omit only contour axes owned solely by the excluded solar area. */
export function sunBarrierLines(rooms: SunRoom[], access: SunAccess, barriers: number[][], contour: number[][]): number[][] {
  if (!access.outside.size) return barriers;
  return barriers.flatMap(line => {
    const isContour = contour.some(c => c.every((v, i) => Math.abs(v - line[i]) < 1e-7));
    if (!isContour) return [line]; // independent physical walls retain their shadows
    return spans(line.slice(0, 2), line.slice(2, 4), rooms, access.roomAt)
      .filter(s => [s.plus, s.minus].some(r => r && !access.outside.has(r.id)))
      .map(s => [...s.a, ...s.b]);
  });
}
