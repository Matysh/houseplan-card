/** Select-only exact local signature. The caller certifies the clipping operand
 * by its complete canonical value and reuses only a successful intersection.
 * Every rightward ray from any subject point can meet only the retained edges:
 * their directed MULTISET preserves winding and boundary contact throughout the
 * subject bbox. Edges arbitrarily far RIGHT still matter for enclosure. Shape
 * checks here do not establish canonicality; there is no epsilon or snapping.
 */
import type { Geom } from './wall-boolean-cache';

type Ring = number[][];
const LIMIT = 500_000;
function rings(geometry: Geom): Ring[] | null {
  if (!Array.isArray(geometry)) return null;
  if (!geometry.length) return [];
  const polygons = (typeof geometry[0]?.[0]?.[0] === 'number' ? [geometry] : geometry) as Ring[][];
  const result: Ring[] = [];
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) return null;
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4 || !ring.every(point =>
        Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) return null;
      const first = ring[0], last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) return null;
      result.push(ring);
    }
  }
  return result;
}

export function wallIntersectionSignature(subject: Geom, canonicalClipping: Geom): string | null {
  try { return wallIntersectionSignatureFromKey(subject, canonicalClipping, JSON.stringify(subject)); }
  catch { return null; }
}

/** Internal same-call port: subjectKey must be the freshly serialized complete
 * subject supplied by WallBooleanBaseline.apply, never a caller identity cache.
 * The public pure entrypoint above owns serialization for independent callers. */
export function wallIntersectionSignatureFromKey(subject: Geom, canonicalClipping: Geom, subjectKey: string): string | null {
  try {
    const subjectRings = rings(subject), clippingRings = rings(canonicalClipping);
    if (!subjectRings?.length || !clippingRings) return null;
    if (subjectKey.length > LIMIT) return null;
    let minX = Infinity, minY = Infinity, maxY = -Infinity;
    // Include every component AND hole, including raw subject rings whose
    // ownership will be interpreted by the original successful boolean.
    for (const ring of subjectRings) for (const point of ring) {
      minX = Math.min(minX, point[0]); minY = Math.min(minY, point[1]); maxY = Math.max(maxY, point[1]);
    }
    const edges: string[] = [];
    let characters = subjectKey.length + 1;
    for (const ring of clippingRings) for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1], b = ring[i];
      if (Math.max(a[0], b[0]) < minX || Math.max(a[1], b[1]) < minY || Math.min(a[1], b[1]) > maxY) continue;
      const edge = JSON.stringify([a, b]);
      characters += edge.length + 1;
      if (characters > LIMIT) return null;
      edges.push(edge); // Deliberately no Set: winding depends on multiplicity.
    }
    return `${subjectKey}:${edges.sort().join(';')}`;
  } catch { return null; }
}
