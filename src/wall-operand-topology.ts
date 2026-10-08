/** Boundary identity for the rare, bounded wall-shell retry. Component order,
 * ring direction/start, exact straight-edge subdivisions and zero-area retraces
 * are representation details of a filled polygon (not a wiregraph). An outer
 * and its own holes must otherwise remain literally intact. */
type Point = readonly number[];
type Ring = readonly Point[];
type Geometry = readonly (readonly Ring[])[];
type Decimal = { coefficient: bigint; power: number };

const same = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1];

export function sameWallOperandTopology(before: Geometry, after: Geometry): boolean {
  // polyclip interprets a Number through its decimal string (BigNumber(number)).
  // Prove collinearity in that same representation, with exact integer math:
  // no epsilon, cancellation-rounded determinant, or second coordinate snap.
  const decimals = new Map<number, Decimal>();
  const decimal = (value: number): Decimal => {
    let result = decimals.get(value);
    if (!result) {
      const [mantissa, exponent = '0'] = value.toString().split('e');
      const dot = mantissa.indexOf('.');
      result = { coefficient: BigInt(mantissa.replace('.', '')),
        power: Number(exponent) - (dot < 0 ? 0 : mantissa.length - dot - 1) };
      decimals.set(value, result);
    }
    return result;
  };
  const collinear = (a: Point, b: Point, c: Point): boolean => {
    // A→B→C and A→C have identical winding off this exact line, including
    // backtracking: the oppositely directed overlap cancels without material.
    if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) return true;
    const parts = [a[0], a[1], b[0], b[1], c[0], c[1]].map(decimal);
    const power = Math.min(...parts.map(part => part.power));
    const [ax, ay, bx, by, cx, cy] = parts.map(part =>
      part.coefficient * 10n ** BigInt(part.power - power));
    return (bx - ax) * (cy - ay) === (by - ay) * (cx - ax);
  };
  const ringKey = (ring: Ring): string | null => {
    if (ring.length < 4 || !ring.every(p => p.length === 2 && p.every(Number.isFinite))
        || !same(ring[0], ring[ring.length - 1])) return null;
    const points = ring.slice(0, -1).filter((p, i) => i === 0 || !same(p, ring[i - 1]));
    if (points.length > 1 && same(points[0], points[points.length - 1])) points.pop();
    let changed = true;
    while (changed && points.length >= 3) {
      changed = false;
      for (let i = 0; i < points.length; i++) {
        if (!collinear(points[(i + points.length - 1) % points.length], points[i],
          points[(i + 1) % points.length])) continue;
        points.splice(i, 1); changed = true; break;
      }
    }
    if (points.length < 3) return null;
    const keys = points.map(p => JSON.stringify(p)), least = keys.reduce((a, b) => a < b ? a : b);
    let best: string | null = null;
    for (let start = 0; start < keys.length; start++) {
      if (keys[start] !== least) continue;
      for (const direction of [1, -1]) {
        const key = Array.from({ length: keys.length }, (_, step) =>
          keys[(start + direction * step + keys.length) % keys.length]).join(';');
        if (best === null || key < best) best = key;
      }
    }
    return best;
  };
  const topology = (geometry: Geometry): string | null => {
    const polygons: string[] = [];
    for (const polygon of geometry) {
      if (!polygon.length) return null;
      const rings = polygon.map(ringKey);
      if (rings.some(ring => ring === null)) return null;
      // Never flatten all rings together: holes belong to this specific outer.
      polygons.push(JSON.stringify([rings[0], rings.slice(1).sort()]));
    }
    return JSON.stringify(polygons.sort());
  };
  const expected = topology(before);
  return expected !== null && expected === topology(after);
}
