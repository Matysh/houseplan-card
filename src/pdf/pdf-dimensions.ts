import { formatLength } from '../logic';

export interface DimensionEdge {
  a: readonly [number, number];
  b: readonly [number, number];
  text: string;
  short: boolean;
  angle: number;
  mid: readonly [number, number];
}

const samePoint = (a: readonly number[], b: readonly number[], epsilon: number): boolean =>
  Math.hypot(a[0] - b[0], a[1] - b[1]) <= epsilon;

/** Remove only redundant collinear vertices; physical lengths remain exact. */
export function compactRing(input: readonly number[][], epsilon = 1e-7): number[][] {
  const ring = input.map((point) => [Number(point[0]), Number(point[1])])
    .filter((point) => point.every(Number.isFinite));
  if (ring.length > 1 && samePoint(ring[0], ring[ring.length - 1], epsilon)) ring.pop();
  if (ring.length < 3) return ring;
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const previous = ring[(i - 1 + ring.length) % ring.length];
    const point = ring[i];
    const next = ring[(i + 1) % ring.length];
    const cross = (point[0] - previous[0]) * (next[1] - point[1])
      - (point[1] - previous[1]) * (next[0] - point[0]);
    const scale = Math.max(1, Math.hypot(point[0] - previous[0], point[1] - previous[1]),
      Math.hypot(next[0] - point[0], next[1] - point[1]));
    if (Math.abs(cross) > epsilon * scale) out.push(point);
  }
  return out.length >= 3 ? out : ring;
}

export function readableAngle(a: readonly number[], b: readonly number[]): number {
  let angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  return angle;
}

export function dimensionEdges(
  ring: readonly number[][],
  cmPerUnit: number,
  imperial: boolean,
): DimensionEdge[] {
  const compact = compactRing(ring);
  return compact.map((a, index) => {
    const b = compact[(index + 1) % compact.length];
    const cm = Math.hypot(b[0] - a[0], b[1] - a[1]) * cmPerUnit;
    return {
      a: [a[0], a[1]], b: [b[0], b[1]], text: formatLength(cm, imperial), short: cm < 30,
      angle: readableAngle(a, b), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    };
  });
}

/** Stable clockwise edge order used by numbered PDF callouts. */
export function stableDimensionEdges(
  ring: readonly number[][],
  cmPerUnit: number,
  imperial: boolean,
): DimensionEdge[] {
  let compact = compactRing(ring);
  if (signedRingArea(compact) < 0) compact = [...compact].reverse();
  if (compact.length) {
    let first = 0;
    for (let index = 1; index < compact.length; index++) {
      if (compact[index][0] < compact[first][0]
          || (compact[index][0] === compact[first][0] && compact[index][1] < compact[first][1])) {
        first = index;
      }
    }
    compact = [...compact.slice(first), ...compact.slice(0, first)];
  }
  return dimensionEdges(compact, cmPerUnit, imperial);
}

export function signedRingArea(ring: readonly number[][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

export function ringCentroid(ring: readonly number[][]): readonly [number, number] {
  if (!ring.length) return [0, 0];
  const area = signedRingArea(ring);
  if (Math.abs(area) < 1e-9) {
    return [ring.reduce((sum, p) => sum + p[0], 0) / ring.length,
      ring.reduce((sum, p) => sum + p[1], 0) / ring.length];
  }
  let x = 0, y = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const cross = a[0] * b[1] - b[0] * a[1];
    x += (a[0] + b[0]) * cross;
    y += (a[1] + b[1]) * cross;
  }
  return [x / (6 * area), y / (6 * area)];
}

export function edgeNormal(
  a: readonly number[], b: readonly number[], toward: readonly number[],
): readonly [number, number] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  let nx = -dy / length, ny = dx / length;
  const midX = (a[0] + b[0]) / 2, midY = (a[1] + b[1]) / 2;
  if ((toward[0] - midX) * nx + (toward[1] - midY) * ny < 0) {
    nx = -nx; ny = -ny;
  }
  return [nx, ny];
}

/** Normal pointing away from the ring centroid, used by external dimensions. */
export function outsideNormal(
  a: readonly number[], b: readonly number[], centroid: readonly number[],
): readonly [number, number] {
  const inward = edgeNormal(a, b, centroid);
  return [-inward[0], -inward[1]];
}

export const PDF_SCALE_SERIES = [20, 25, 50, 75, 100, 150, 200, 250, 500] as const;

export function choosePdfScale(
  widthCm: number, heightCm: number, availableWidthMm: number, availableHeightMm: number,
): number {
  for (const scale of PDF_SCALE_SERIES) {
    if (widthCm * 10 / scale <= availableWidthMm
        && heightCm * 10 / scale <= availableHeightMm) return scale;
  }
  return Math.max(500, Math.ceil(Math.max(
    widthCm * 10 / availableWidthMm, heightCm * 10 / availableHeightMm,
  ) / 50) * 50);
}
