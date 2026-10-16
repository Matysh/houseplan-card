/** Read the renderer's already-cut masonry union, not room/partition axes. */
import type { ContactPoint, ContactWall } from './device-contact-geometry';

export type ContactMasonry = readonly (readonly (readonly (readonly number[])[])[])[];
export function deviceContactWalls(masonry: ContactMasonry, zero: readonly number[][] = []): ContactWall[] {
  const result = new Map<string, ContactWall>();
  const key = (a: readonly number[], b: readonly number[]) => {
    const p = a.map((v) => +v.toFixed(7)).join(','), q = b.map((v) => +v.toFixed(7)).join(',');
    return p < q ? `${p}|${q}` : `${q}|${p}`;
  };
  for (const polygon of masonry) polygon.forEach((closed, ringIndex) => {
    const ring = closed.length > 1 && closed[0][0] === closed[closed.length - 1][0]
      && closed[0][1] === closed[closed.length - 1][1] ? closed.slice(0, -1) : [...closed];
    const area = ring.reduce((sum, a, i) => { const b = ring[(i + 1) % ring.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
    if ((area > 0) !== (ringIndex === 0)) ring.reverse();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      if (!(length > 1e-7) || ![...a, ...b].every(Number.isFinite)) continue;
      const id = `body:${key(a, b)}`;
      result.set(id, { id, a: [a[0], a[1]], b: [b[0], b[1]], normal: [dy / length, -dx / length] });
    }
  });
  for (const line of zero) {
    if (line.length !== 4 || !line.every(Number.isFinite)) continue;
    const a: ContactPoint = [line[0], line[1]], b: ContactPoint = [line[2], line[3]];
    const id = `zero:${key(a, b)}`;
    result.set(id, { id, a, b, normal: null });
  }
  return [...result.values()].sort((a, b) => a.id.localeCompare(b.id));
}
