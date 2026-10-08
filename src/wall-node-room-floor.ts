/** Select-only locality for successful canonical room masonry. A remote hole
 * of one connected wall body cannot affect the floor inside this room. The
 * guard still performs the ordinary subtraction and judges its result. */
import type { Geom } from './wall-boolean-cache';
import { subtractLocalWallGeometry } from './wall-local-boolean';

type Multi = ReturnType<typeof subtractLocalWallGeometry>;
type Ring = Multi[number][number];
type Box = [number, number, number, number];

function ringBox(ring: Ring): Box | null {
  if (ring.length < 4) return null;
  const first = ring[0], last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return null;
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  let twiceArea = 0;
  for (let index = 0; index < ring.length; index++) {
    const p = ring[index], next = ring[(index + 1) % ring.length];
    if (p.length !== 2 || !p.every(Number.isFinite)) return null;
    box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]);
    box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]);
    twiceArea += (p[0] - first[0]) * (next[1] - first[1])
      - (next[0] - first[0]) * (p[1] - first[1]);
  }
  return Number.isFinite(twiceArea) && twiceArea !== 0 ? box : null;
}
const touches = (a: Box, b: Box): boolean => a[0] <= b[2] && b[0] <= a[2]
  && a[1] <= b[3] && b[1] <= a[3];
const asMulti = (geometry: Geom): Multi => !geometry.length ? []
  : typeof geometry[0][0][0] === 'number' ? [geometry as Multi[number]] : geometry as Multi;

/** Only the lazy Select producer supplies this operation, with fresh successful
 * pre-opening masonry, in the guard's coordinate units. Ambiguous rings retain
 * the complete historical subtraction rather than gaining an easier proof. */
export function subtractNodeRoomMasonry(subject: Geom, clipping: Geom): Multi {
  const own = asMulti(subject), clips = asMulti(clipping);
  const subjectBoxes: Box[] = [];
  for (const polygon of own) for (const ring of polygon) {
    const box = ringBox(ring);
    if (!box) return subtractLocalWallGeometry(subject, clipping);
    subjectBoxes.push(box);
  }
  const local: Multi = [];
  for (const polygon of clips) {
    const rings: Ring[] = [];
    for (let index = 0; index < polygon.length; index++) {
      const ring = polygon[index], box = ringBox(ring);
      if (!box) return subtractLocalWallGeometry(subject, clipping);
      if (index === 0 || subjectBoxes.some(ownBox => touches(ownBox, box))) rings.push(ring);
    }
    local.push(rings);
  }
  return subtractLocalWallGeometry(subject, local);
}
