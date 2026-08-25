export interface DeletionWallInterval {
  a: readonly number[];
  b: readonly number[];
  key: string;
  kind: 'shared' | 'outer' | null;
  cm: number;
  open: boolean;
}

export interface DeletionPartition {
  id: string;
  a: readonly number[];
  b: readonly number[];
  cm: number;
}

export interface DeletionOpening {
  id: string;
  x: number;
  y: number;
  angle: number;
  host?: { kind: 'partition' | 'wall'; id: string; t: number };
}

export interface RoomDeletionMaterialization {
  interval: DeletionWallInterval;
  /** Existing exact compatible wall, otherwise the caller creates one. */
  reusePartitionId: string | null;
}

export interface RoomDeletionPlan {
  materialize: RoomDeletionMaterialization[];
  openingIntervals: Map<string, string>;
  removeOpeningIds: string[];
}

function pointDistanceToSegment(
  point: readonly number[], a: readonly number[], b: readonly number[],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length2 = dx * dx + dy * dy;
  const t = length2 > 0 ? Math.max(0, Math.min(1,
    ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2)) : 0;
  return Math.hypot(a[0] + dx * t - point[0], a[1] + dy * t - point[1]);
}

function sameAxisAngle(left: number, right: number, tolerance = 0.5): boolean {
  let delta = Math.abs(left - right) % 180;
  if (delta > 90) delta = 180 - delta;
  return delta <= tolerance;
}

function containsInterval(
  partition: DeletionPartition, interval: DeletionWallInterval, epsilon: number,
): boolean {
  if (Math.abs(partition.cm - interval.cm) > 1e-6) return false;
  const angle = Math.atan2(
    partition.b[1] - partition.a[1], partition.b[0] - partition.a[0],
  ) * 180 / Math.PI;
  const intervalAngle = Math.atan2(
    interval.b[1] - interval.a[1], interval.b[0] - interval.a[0],
  ) * 180 / Math.PI;
  return sameAxisAngle(angle, intervalAngle, 0.001)
    && pointDistanceToSegment(interval.a, partition.a, partition.b) <= epsilon
    && pointDistanceToSegment(interval.b, partition.a, partition.b) <= epsilon;
}

/**
 * Pure consequences of deleting one room. Explicitly hosted independent-wall
 * openings never belong to the room and therefore always survive.
 */
export function planRoomDeletion(
  intervals: readonly DeletionWallInterval[],
  partitions: readonly DeletionPartition[],
  openings: readonly DeletionOpening[],
  epsilon: number,
): RoomDeletionPlan {
  const exclusive = intervals.filter((interval) =>
    interval.kind === 'outer' && !interval.open && interval.cm > 0);
  const materialize = exclusive.map((interval): RoomDeletionMaterialization => ({
    interval,
    reusePartitionId: partitions.find((partition) =>
      containsInterval(partition, interval, epsilon))?.id || null,
  }));
  const openingIntervals = new Map<string, string>();
  for (const opening of openings) {
    if (opening.host?.kind === 'partition') continue;
    const candidates = intervals.map((interval) => {
      const angle = Math.atan2(
        interval.b[1] - interval.a[1], interval.b[0] - interval.a[0],
      ) * 180 / Math.PI;
      return {
        interval,
        distance: sameAxisAngle(opening.angle, angle)
          ? pointDistanceToSegment([opening.x, opening.y], interval.a, interval.b)
          : Infinity,
      };
    }).filter((candidate) => candidate.distance <= epsilon)
      .sort((left, right) => left.distance - right.distance
        || left.interval.key.localeCompare(right.interval.key));
    const owner = candidates[0]?.interval;
    if (owner?.kind === 'outer' && !owner.open && owner.cm > 0) {
      openingIntervals.set(opening.id, owner.key);
    }
  }
  return {
    materialize,
    openingIntervals,
    removeOpeningIds: [...openingIntervals.keys()].sort((a, b) => a.localeCompare(b)),
  };
}

export function parameterOnPartition(
  point: readonly number[], partition: Pick<DeletionPartition, 'a' | 'b'>,
): number {
  const dx = partition.b[0] - partition.a[0];
  const dy = partition.b[1] - partition.a[1];
  const length2 = dx * dx + dy * dy;
  return length2 > 0 ? Math.max(0, Math.min(1,
    ((point[0] - partition.a[0]) * dx + (point[1] - partition.a[1]) * dy) / length2)) : 0;
}
