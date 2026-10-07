/** Exact booleans on canonical wall components. Distant disconnected rooms
 * cannot affect a local patch; do not send them through the sweep repeatedly.
 * Touching bounding boxes remain eligible (no epsilon/geometry relaxation). */
import { union, intersection, difference, type Geom } from 'polyclip-ts';

type Multi = ReturnType<typeof union>;
type Polygon = Multi[number];
type Box = [number, number, number, number];
const boxes = new WeakMap<Polygon, Box>();
const boxOf = (polygon: Polygon): Box => {
  const cached = boxes.get(polygon); if (cached) return cached;
  const out: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of polygon) for (const [x, y] of ring) {
    out[0] = Math.min(out[0], x); out[1] = Math.min(out[1], y);
    out[2] = Math.max(out[2], x); out[3] = Math.max(out[3], y);
  }
  boxes.set(polygon, out); return out;
};
const touches = (a: Box, b: Box): boolean => a[0] <= b[2] && b[0] <= a[2]
  && a[1] <= b[3] && b[1] <= a[3];
// Existing clipping outputs are canonical. A single raw polygon still goes
// through the original library, including its validation and ring ordering.
const multi = (geom: Geom): Multi => !geom.length ? []
  : typeof geom[0][0][0] === 'number' ? union(geom) : geom as Multi;

export function unionLocalWallGeometry(subject: Geom, clipping: Geom): Multi {
  let out = [...multi(subject)];
  for (const polygon of multi(clipping)) {
    const box = boxOf(polygon), near = out.filter(p => touches(boxOf(p), box));
    const far = out.filter(p => !touches(boxOf(p), box));
    out = [...far, ...(near.length ? union(near, [polygon]) : [polygon])];
  }
  // Match the clipping library's deterministic component order.
  return out.sort((a, b) => a[0][0][0] - b[0][0][0] || a[0][0][1] - b[0][0][1]);
}

function nearby(subject: Multi, clipping: Geom): Multi {
  return multi(clipping).filter(p => subject.some(s => touches(boxOf(s), boxOf(p))));
}
export function intersectLocalWallGeometry(subject: Geom, clipping: Geom): Multi {
  const own = multi(subject), near = nearby(own, clipping);
  return own.length && near.length ? intersection(own, near) : [];
}
export function subtractLocalWallGeometry(subject: Geom, clipping: Geom): Multi {
  const own = multi(subject), near = nearby(own, clipping);
  return own.length && near.length ? difference(own, near) : own;
}
