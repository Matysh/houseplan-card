/** The room body and exterior shell share computed edges. Their independent
 * boolean histories can leave different floating tails on the same vertex.
 * Keep the exact path; only its failure gets one canonical-coordinate retry.
 * This never edits a stored room, wall, opening or caller-owned polygon. */
import { union } from './wall-boolean-cache';
import { COORDINATE_FACTOR } from './coordinate-canonicalization';
import { sameWallOperandTopology } from './wall-operand-topology';

type Multi = ReturnType<typeof union>;
type Ring = Multi[number][number];
type Bounds = [number, number, number, number];

const signedArea = (ring: Ring): number => {
  const [ox, oy] = ring[0];
  let twice = 0;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    twice += (a[0] - ox) * (b[1] - oy) - (b[0] - ox) * (a[1] - oy);
  }
  return twice / 2;
};

/** Every outer and its own holes must survive normalizing the rounded operand.
 * A split and simultaneous merge can preserve all counts yet move a hole into
 * another component, so compare boundary identity, not a topology histogram. */
export function canonicalComputedWallGeometry(geometry: Multi, coordScale: number): Multi {
  if (!(Number.isFinite(coordScale) && coordScale > 0)) throw new Error('invalid boolean scale');
  const quantum = coordScale / COORDINATE_FACTOR;
  if (!(Number.isFinite(quantum) && quantum > 0)) throw new Error('invalid boolean scale');
  const canonical = geometry.map(polygon => polygon.map(ring => {
    if (ring.length < 4) throw new Error('invalid boolean ring');
    const first = ring[0], last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) throw new Error('open boolean ring');
    const next: Ring = [];
    for (const point of ring) {
      if (point.length !== 2 || !point.every(Number.isFinite)) throw new Error('non-finite or invalid boolean point');
      const p: Ring[number] = [Math.round(point[0] / quantum) * quantum,
        Math.round(point[1] / quantum) * quantum];
      if (!p.every(Number.isFinite)) throw new Error('non-finite canonical boolean point');
      if (!next.length || p[0] !== next[next.length - 1][0] || p[1] !== next[next.length - 1][1]) next.push(p);
    }
    if (next.length < 4 || Math.sign(signedArea(next)) !== Math.sign(signedArea(ring))
        || signedArea(next) === 0) throw new Error('collapsed boolean ring');
    return next;
  }));
  const normalized = union(canonical);
  if (!sameWallOperandTopology(canonical, normalized)) throw new Error('changed boolean topology');
  return normalized;
}

/** A strictly separated pair of component bounding boxes certifies that the
 * original operands cannot meet. Rounding must not erase that certificate.
 * This is deliberately not a general cross-operand topology proof: overlapping
 * boxes say nothing about the contained polygons, which retain all other guards. */
function preserveCertifiedSeparation(body: Multi, shell: Multi, coordScale: number): void {
  const quantum = coordScale / COORDINATE_FACTOR;
  const boxes = (geometry: Multi): Array<{ original: Bounds; canonical: Bounds }> => geometry.map(polygon => {
    const outer = polygon[0];
    const original: Bounds = [Math.min(...outer.map(p => p[0])), Math.min(...outer.map(p => p[1])),
      Math.max(...outer.map(p => p[0])), Math.max(...outer.map(p => p[1]))];
    return { original, canonical: original.map(v => Math.round(v / quantum) * quantum) as Bounds };
  });
  const separated = (a: Bounds, b: Bounds): boolean =>
    a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1];
  const shellBoxes = boxes(shell);
  for (const a of boxes(body)) for (const b of shellBoxes)
    if (separated(a.original, b.original) && !separated(a.canonical, b.canonical))
      throw new Error('lost certified boolean separation');
}

/** Retain the original exception when either the bounded repair or its union
 * is unprovable. The caller's existing degraded/fail-closed policy still owns
 * that failure; this helper never converts an exception to empty geometry. */
export function unionWallShellGeometry(body: Multi, shell: Multi, coordScale: number,
  merge: typeof union = union,
): Multi {
  try { return merge(body, shell); }
  catch (original) {
    try {
      const canonicalBody = canonicalComputedWallGeometry(body, coordScale);
      const canonicalShell = canonicalComputedWallGeometry(shell, coordScale);
      preserveCertifiedSeparation(body, shell, coordScale);
      return merge(canonicalBody, canonicalShell);
    } catch { throw original; }
  }
}
