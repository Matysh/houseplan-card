/** Pure host resolution shared by editor, renderers and backend-facing projections. */
import { wallCmToUnits, type WallInterval } from './wall-thickness';
import type {
  OpeningCfg, PartitionCfg, PartitionOpeningHost,
} from './types';

export type PartitionOpeningOrphanReason =
  | 'invalid-host'
  | 'missing-partition'
  | 'invalid-position'
  | 'invalid-length'
  | 'does-not-fit'
  | 'does-not-fit-jamb';

export interface ResolvedPartitionOpening {
  opening: OpeningCfg;
  host: PartitionOpeningHost;
  partition: PartitionCfg;
  center: [number, number];
  angle: number;
  length: number;
  depth: number;
  t: number;
  axis: { a: [number, number]; b: [number, number]; ux: number; uy: number; length: number };
}

export interface PartitionOpeningResolution {
  resolved: ResolvedPartitionOpening | null;
  reason: PartitionOpeningOrphanReason | null;
}

const finitePoint = (point: readonly number[] | null | undefined): point is readonly [number, number] =>
  !!point && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);

/** Physical jamb reserve at either endpoint of one independent wall. */
export function partitionOpeningJambMargin(
  partition: PartitionCfg, cellCm = 5, gridPitch = 5,
): number {
  return wallCmToUnits(partition.cm, cellCm, gridPitch) / 2;
}

/** Resolve explicit host identity. There is intentionally no nearest-wall fallback. */
export function resolvePartitionOpening(
  opening: OpeningCfg,
  partitions: readonly PartitionCfg[],
  lengthScale = 1,
  cellCm = 5,
  gridPitch = 5,
  jambMargin = 0,
): PartitionOpeningResolution {
  const host = opening.host;
  if (!host || host.kind !== 'partition' || typeof host.id !== 'string' || !host.id)
    return { resolved: null, reason: 'invalid-host' };
  const partition = partitions.find((item) => item.id === host.id);
  if (!partition) return { resolved: null, reason: 'missing-partition' };
  if (!finitePoint(partition.a) || !finitePoint(partition.b) || !Number.isFinite(host.t)
      || host.t < 0 || host.t > 1) return { resolved: null, reason: 'invalid-position' };
  const dx = partition.b[0] - partition.a[0];
  const dy = partition.b[1] - partition.a[1];
  const axisLength = Math.hypot(dx, dy);
  const length = Number(opening.length) * lengthScale;
  if (!(axisLength > 1e-9) || !(length > 0) || !Number.isFinite(length))
    return { resolved: null, reason: 'invalid-length' };
  const along = host.t * axisLength;
  if (along - length / 2 < jambMargin - 1e-9
      || along + length / 2 > axisLength - jambMargin + 1e-9)
    return { resolved: null, reason: 'does-not-fit' };
  const ux = dx / axisLength, uy = dy / axisLength;
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle >= 90) angle -= 180;
  else if (angle < -90) angle += 180;
  return {
    reason: null,
    resolved: {
      opening,
      host,
      partition,
      center: [partition.a[0] + dx * host.t, partition.a[1] + dy * host.t],
      angle,
      length,
      depth: wallCmToUnits(partition.cm, cellCm, gridPitch),
      t: host.t,
      axis: {
        a: [partition.a[0], partition.a[1]],
        b: [partition.b[0], partition.b[1]],
        ux, uy, length: axisLength,
      },
    },
  };
}

/** Explicit zero-margin policy for render, hit-test and legacy round-trip. */
export function resolvePartitionOpeningCompat(
  opening: OpeningCfg,
  partitions: readonly PartitionCfg[],
  lengthScale = 1,
  cellCm = 5,
  gridPitch = 5,
): PartitionOpeningResolution {
  return resolvePartitionOpening(opening, partitions, lengthScale, cellCm, gridPitch, 0);
}

/** Strict write policy. Compat/read callers intentionally keep using the
 * zero-margin resolver above so an existing near-end opening never disappears. */
export function resolvePartitionOpeningStrict(
  opening: OpeningCfg,
  partitions: readonly PartitionCfg[],
  lengthScale = 1,
  cellCm = 5,
  gridPitch = 5,
): PartitionOpeningResolution {
  const host = opening.host;
  const partition = host?.kind === 'partition'
    ? partitions.find((item) => item.id === host.id)
    : undefined;
  if (!partition) return resolvePartitionOpeningCompat(
    opening, partitions, lengthScale, cellCm, gridPitch,
  );
  const result = resolvePartitionOpening(
    opening, partitions, lengthScale, cellCm, gridPitch,
    partitionOpeningJambMargin(partition, cellCm, gridPitch),
  );
  return result.reason === 'does-not-fit'
    ? { resolved: null, reason: 'does-not-fit-jamb' }
    : result;
}

/** Only direct geometry edits opt a legacy record into the strict policy. */
export function partitionOpeningNeedsStrictValidation(
  previous: OpeningCfg | null | undefined,
  candidate: OpeningCfg,
): boolean {
  if (!previous) return true;
  return previous.length !== candidate.length
    || previous.host?.kind !== candidate.host?.kind
    || previous.host?.id !== candidate.host?.id
    || previous.host?.t !== candidate.host?.t;
}

export function partitionOpeningCut(resolved: ResolvedPartitionOpening): {
  hostId: string; a: [number, number]; b: [number, number]; depth: number;
} {
  const { center, length, axis, host } = resolved;
  const half = length / 2;
  return {
    hostId: host.id,
    a: [center[0] - axis.ux * half, center[1] - axis.uy * half],
    b: [center[0] + axis.ux * half, center[1] + axis.uy * half],
    depth: resolved.depth,
  };
}

export function partitionOpeningFace(
  resolved: ResolvedPartitionOpening,
  flipV = false,
): { ox: number; oy: number; cm: number; side: -1 | 1 } {
  const side = (flipV ? 1 : -1) as -1 | 1;
  const half = resolved.depth / 2;
  return {
    ox: -resolved.axis.uy * side * half,
    oy: resolved.axis.ux * side * half,
    cm: resolved.partition.cm,
    side,
  };
}

/** Candidate intervals for the existing room-wall placement resolver. */
export function partitionPlacementIntervals(
  partitions: readonly PartitionCfg[], cellCm: number, gridPitch: number,
): Array<WallInterval & { partitionHost: { kind: 'partition'; id: string } }> {
  return partitions.flatMap((partition) => {
    if (!finitePoint(partition.a) || !finitePoint(partition.b)
        || Math.hypot(partition.b[0] - partition.a[0], partition.b[1] - partition.a[1]) <= 1e-9)
      return [];
    return [{
      roomId: '',
      a: [partition.a[0], partition.a[1]],
      b: [partition.b[0], partition.b[1]],
      key: `partition:${partition.id}`,
      kind: 'outer' as const,
      cm: partition.cm,
      open: false,
      half: wallCmToUnits(partition.cm, cellCm, gridPitch) / 2,
      partitionHost: { kind: 'partition' as const, id: partition.id },
    }];
  });
}

/** Exact collinear coverage, used only for a computed composite room-wall cut. */
export function partitionOpeningHasCompositeRoomWall(
  resolved: ResolvedPartitionOpening,
  intervals: readonly WallInterval[],
  epsilon: number,
): boolean {
  const { center, length, axis } = resolved;
  const half = length / 2;
  const coverage = intervals.flatMap((interval) => {
    if (!interval.kind || interval.open) return [];
    const dx = interval.b[0] - interval.a[0], dy = interval.b[1] - interval.a[1];
    const span = Math.hypot(dx, dy);
    if (!(span > epsilon)) return [];
    const ux = dx / span, uy = dy / span;
    if (Math.abs(axis.ux * uy - axis.uy * ux) > 1e-6) return [];
    const lineDistance = Math.abs(
      (center[0] - interval.a[0]) * uy - (center[1] - interval.a[1]) * ux,
    );
    if (lineDistance > epsilon) return [];
    const along = (point: readonly number[]) =>
      (point[0] - center[0]) * axis.ux + (point[1] - center[1]) * axis.uy;
    const a = along(interval.a), b = along(interval.b);
    const lo = Math.max(-half, Math.min(a, b));
    const hi = Math.min(half, Math.max(a, b));
    return hi >= lo - epsilon ? [[lo, hi] as [number, number]] : [];
  });
  if (!coverage.length) return false;
  coverage.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let reached = -half;
  for (const [lo, hi] of coverage) {
    if (lo > reached + epsilon) return false;
    reached = Math.max(reached, hi);
    if (reached >= half - epsilon) return true;
  }
  return false;
}

export function hostedOpeningIntervalsOverlap(
  candidate: ResolvedPartitionOpening,
  others: readonly ResolvedPartitionOpening[],
  epsilon = 1e-9,
): boolean {
  const half = candidate.length / (2 * candidate.axis.length);
  const lo = candidate.t - half, hi = candidate.t + half;
  return others.some((other) => {
    if (other.host.id !== candidate.host.id || other.opening.id === candidate.opening.id) return false;
    const otherHalf = other.length / (2 * other.axis.length);
    return Math.max(lo, other.t - otherHalf) < Math.min(hi, other.t + otherHalf) - epsilon;
  });
}

/** Update compatibility fields after a host move without changing host semantics. */
export function materializePartitionOpening(
  opening: OpeningCfg, resolved: ResolvedPartitionOpening, coordScale: number,
): OpeningCfg {
  return {
    ...opening,
    x: resolved.center[0] / coordScale,
    y: resolved.center[1] / coordScale,
    angle: resolved.angle,
  };
}
