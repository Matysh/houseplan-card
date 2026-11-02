/**
 * A boolean operation can return a numerically collinear ring with a long
 * edge and two nearly identical vertices. Its fill is invisible but SVG/PDF
 * still stroke that edge inside solid masonry (#1076).
 *
 * This is a paint projection only: never round, repair or mutate model rings.
 * Triangulate relative to the first vertex to avoid world-coordinate area
 * cancellation. The error bound follows the local floating-point scale, not
 * a physical area/coordinate epsilon, so genuine narrow holes remain holes.
 */
const exactPaintRings=new WeakMap<object,boolean>();
/** A direct arrangement proves its final binary64 ring exactly. It must not
 * lose a real narrow hole to the legacy floating roundoff heuristic. */
export function registerExactPaintRing(ring:object,nonzero:boolean):void{exactPaintRings.set(ring,nonzero);}
/** A coordinate-preserving open/closed ring copy retains the exact proof. */
export function inheritExactPaintRing<T extends object>(source:object,copy:T):T{
  const proof=exactPaintRings.get(source);if(proof!==undefined)exactPaintRings.set(copy,proof);return copy;
}
export function hasPaintableRingArea(ring: readonly (readonly number[])[]): boolean {
  const proven=exactPaintRings.get(ring);if(proven!==undefined)return proven;
  if (ring.length < 3) return false;
  const [ox, oy] = ring[0];
  let twiceArea = 0, products = 0, extent = 0;
  for (const [x, y] of ring) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    extent = Math.max(extent, Math.abs(x - ox), Math.abs(y - oy));
  }
  for (let i = 1; i + 1 < ring.length; i++) {
    const a = (ring[i][0] - ox) * (ring[i + 1][1] - oy);
    const b = (ring[i][1] - oy) * (ring[i + 1][0] - ox);
    twiceArea += a - b;
    products += Math.abs(a) + Math.abs(b);
  }
  const roundoff = 32 * Number.EPSILON * Math.max(products, extent * extent);
  return Math.abs(twiceArea) > roundoff;
}
