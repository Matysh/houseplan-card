/** Current painted SVG inverse, never a cached camera view (#871). */
export interface ScreenAffine {
  a: number; b: number; c: number; d: number; e: number; f: number;
  is2D?: boolean;
}

export function vacuumScreenPoint(
  matrix: ScreenAffine | null, x: number, y: number,
): readonly [number, number] | null {
  if (!matrix || matrix.is2D === false
    || ![matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f, x, y].every(Number.isFinite)) return null;
  const { a, b, c, d, e, f } = matrix;
  const det = a * d - b * c;
  if (!Number.isFinite(det) || det === 0) return null;
  const px = x - e, py = y - f;
  const point: [number, number] = [(d * px - c * py) / det, (a * py - b * px) / det];
  return point.every(Number.isFinite) ? point : null;
}

/** Read all geometry before writing endpoints; one CTM per route SVG/frame.
 * Return whether a matching active pair remains, even if its current matrix
 * is temporarily unavailable. The existing single RAF can retry next frame.
 */
export function syncVacuumTips(root: ParentNode): boolean {
  const pucks = new Map<string, Element>();
  for (const puck of root.querySelectorAll('.vacpuck[data-mid]')) {
    if (puck.isConnected) pucks.set(puck.getAttribute('data-mid')!, puck);
  }
  const writes: { line: SVGLineElement; point: readonly [number, number] }[] = [];
  let paired = false;
  for (const svg of root.querySelectorAll<SVGSVGElement>('.vactrail')) {
    if (!svg.isConnected) continue;
    const matrix = svg.getScreenCTM();
    const centres = new Map<string, readonly [number, number] | null>();
    for (const line of svg.querySelectorAll<SVGLineElement>('line.tip[data-mid]')) {
      const mid = line.getAttribute('data-mid')!;
      const puck = pucks.get(mid);
      if (!puck || !line.isConnected) continue;
      paired = true;
      if (!centres.has(mid)) {
        const box = puck.getBoundingClientRect();
        centres.set(mid, box.width > 0 && box.height > 0
          ? vacuumScreenPoint(matrix, box.left + box.width / 2, box.top + box.height / 2) : null);
      }
      const point = centres.get(mid);
      if (point) writes.push({ line, point });
    }
  }
  for (const { line, point } of writes) {
    const x = String(point[0]), y = String(point[1]);
    if (line.getAttribute('x2') !== x) line.setAttribute('x2', x);
    if (line.getAttribute('y2') !== y) line.setAttribute('y2', y);
  }
  return paired;
}
