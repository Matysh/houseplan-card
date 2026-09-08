/** Pure physical projection and rigid two-reference calibration for #485. */
export const RADAR_UNIT_TO_CM = Object.freeze({
  mm: .1, cm: 1, m: 100, in: 2.54, ft: 30.48,
});

export interface RadarFitResult {
  headingDeg: number;
  mirror: boolean;
  rmsCm: number;
  errorsCm: readonly [number, number];
}

type Point = readonly [number, number];

export function radarLengthCm(value: number, unit: keyof typeof RADAR_UNIT_TO_CM): number {
  const result = value * RADAR_UNIT_TO_CM[unit];
  if (!Number.isFinite(result) || Math.abs(result) > 10_000) throw new Error('invalid_radar');
  return result;
}

export function projectRadarLocal(
  mount: Point,
  headingDeg: number,
  mirror: boolean,
  cellCm: number,
  localCm: Point,
): Point {
  if (![...mount, headingDeg, cellCm, ...localCm].every(Number.isFinite)
      || cellCm <= 0 || Math.hypot(...localCm) > 10_000) throw new Error('invalid_radar');
  const theta = headingDeg * Math.PI / 180;
  const sign = mirror ? -1 : 1;
  const scale = 240 * cellCm;
  return [
    mount[0] + (sign * localCm[0] * Math.cos(theta) + localCm[1] * Math.sin(theta)) / scale,
    mount[1] + (sign * localCm[0] * Math.sin(theta) - localCm[1] * Math.cos(theta)) / scale,
  ];
}

export function solveRadarTwoPoint(
  mount: Point,
  localPoints: readonly [Point, Point],
  planPoints: readonly [Point, Point],
  cellCm: number,
): RadarFitResult {
  if (![...mount, cellCm, ...localPoints.flat(), ...planPoints.flat()].every(Number.isFinite)
      || cellCm <= 0 || localPoints.some((point) => Math.hypot(...point) < 50)) {
    throw new Error('invalid_selection');
  }
  const denominator = Math.hypot(...localPoints[0]) * Math.hypot(...localPoints[1]);
  const cosine = (localPoints[0][0] * localPoints[1][0]
    + localPoints[0][1] * localPoints[1][1]) / denominator;
  const angle = Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
  if (angle < 20 || angle > 160) throw new Error('invalid_selection');
  const scale = 240 * cellCm;
  const targets = planPoints.map((point) => [
    (point[0] - mount[0]) * scale,
    -(point[1] - mount[1]) * scale,
  ] as const);
  const candidates: RadarFitResult[] = [];
  for (const mirror of [false, true]) {
    const inputs = localPoints.map(([x, y]) => [mirror ? -x : x, y] as const);
    const dot = inputs.reduce((sum, point, index) => sum
      + point[0] * targets[index][0] + point[1] * targets[index][1], 0);
    const cross = inputs.reduce((sum, point, index) => sum
      + point[0] * targets[index][1] - point[1] * targets[index][0], 0);
    const rotation = Math.atan2(cross, dot);
    const errors = inputs.map(([x, y], index) => {
      const rx = x * Math.cos(rotation) - y * Math.sin(rotation);
      const ry = x * Math.sin(rotation) + y * Math.cos(rotation);
      return Math.hypot(rx - targets[index][0], ry - targets[index][1]);
    }) as [number, number];
    const radialOk = localPoints.every((point, index) => {
      const actual = Math.hypot(...point);
      const expected = Math.hypot(...targets[index]);
      return Math.abs(actual - expected) <= Math.max(20, .15 * expected);
    });
    const rmsCm = Math.sqrt((errors[0] ** 2 + errors[1] ** 2) / 2);
    if (radialOk && rmsCm <= 20 && Math.max(...errors) <= 30) {
      candidates.push({
        headingDeg: ((-rotation * 180 / Math.PI) % 360 + 360) % 360,
        mirror, rmsCm, errorsCm: errors,
      });
    }
  }
  candidates.sort((a, b) => a.rmsCm - b.rmsCm);
  if (!candidates.length) throw new Error('invalid_selection');
  if (candidates.length > 1 && Math.abs(candidates[0].rmsCm - candidates[1].rmsCm) < 10) {
    throw new Error('ambiguous_sources');
  }
  return candidates[0];
}

export function radarMedianSample(samples: readonly Point[]): Point {
  if (samples.length < 3) throw new Error('insufficient_samples');
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const point: Point = [median(samples.map((sample) => sample[0])),
    median(samples.map((sample) => sample[1]))];
  if (samples.some((sample) => Math.hypot(sample[0] - point[0], sample[1] - point[1]) > 15)) {
    throw new Error('bad_fit');
  }
  return point;
}
