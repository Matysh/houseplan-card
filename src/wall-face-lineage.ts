import { distToSegment } from './logic';

interface WallFaceCarrier {
  id: string;
  a: readonly number[];
  b: readonly number[];
}

/** Provisional promotion hints; coordinates share the caller's model scale. */
export function selectWallFaceLineage(
  ring: readonly number[][],
  partitions: readonly WallFaceCarrier[],
  activePartitionIds: ReadonlySet<string>,
  epsilon: number,
): string[] {
  return ring.map((a, index) => {
    const b = ring[(index + 1) % ring.length];
    const carriers = partitions.filter((partition) => {
      const length = Math.hypot(partition.b[0] - partition.a[0], partition.b[1] - partition.a[1]);
      if (!(length > epsilon)) return false;
      const ux = (partition.b[0] - partition.a[0]) / length;
      const uy = (partition.b[1] - partition.a[1]) / length;
      const along = (point: readonly number[]) => (
        (point[0] - partition.a[0]) * ux + (point[1] - partition.a[1]) * uy
      );
      return distToSegment(a, [partition.a[0], partition.a[1], partition.b[0], partition.b[1]]) <= epsilon
        && distToSegment(b, [partition.a[0], partition.a[1], partition.b[0], partition.b[1]]) <= epsilon
        && along(a) >= -epsilon && along(a) <= length + epsilon
        && along(b) >= -epsilon && along(b) <= length + epsilon;
    });
    carriers.sort((left, right) => (
      Number(activePartitionIds.has(right.id)) - Number(activePartitionIds.has(left.id))
      || Math.hypot(left.b[0] - left.a[0], left.b[1] - left.a[1])
        - Math.hypot(right.b[0] - right.a[0], right.b[1] - right.a[1])
      || left.id.localeCompare(right.id)
    ));
    return carriers[0]?.id || '';
  });
}

/**
 * A partially consumed partition keeps its ID on a residual, so that ID cannot
 * also be promoted into the room catalogue. Clear only those provisional hints;
 * the model barrier owns fresh identity allocation. Empty slots preserve edges.
 */
export function settleWallFaceLineage(
  lineage: readonly string[],
  remainingPartitionIds: ReadonlySet<string>,
): string[] {
  return lineage.map((id) => remainingPartitionIds.has(id) ? '' : id);
}
