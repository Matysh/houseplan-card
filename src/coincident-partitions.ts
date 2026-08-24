/**
 * Lossless explicit-Optimize reconciliation for an independent partition that
 * is exactly the same centred physical wall as one solid shared room edge.
 * Runtime renderers never call this module and it never mutates its inputs.
 */
import {
  materializePartitionOpening,
  partitionOpeningHasCompositeRoomWall,
  resolvePartitionOpeningCompat,
} from './partition-openings';
import {
  openingWallIndex,
  resolveOpeningWallAssociation,
  setWallThickness,
  wallKey,
  wallCmToUnits,
  wallIntervals,
  type WallEntry,
  type WallInterval,
} from './wall-thickness';
import type { OpeningCfg, PartitionCfg, SpaceModel } from './types';

export interface CoincidentPartitionResult {
  walls: WallEntry[];
  partitions: PartitionCfg[];
  openings: OpeningCfg[];
  partitionsReconciled: number;
  openingsRehosted: number;
}

export interface CoincidentPartitionOptions {
  pitch: number;
  cellCm: number;
  gridPitch: number;
  coordScale: number;
}

const samePoint = (a: readonly number[], b: readonly number[], eps: number): boolean => (
  Math.hypot(a[0] - b[0], a[1] - b[1]) <= eps
);

const sameSegment = (
  a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[],
  eps: number,
): boolean => (
  (samePoint(a, c, eps) && samePoint(b, d, eps))
  || (samePoint(a, d, eps) && samePoint(b, c, eps))
);

const segmentProjection = (
  point: readonly number[], a: readonly number[], ux: number, uy: number,
): number => (point[0] - a[0]) * ux + (point[1] - a[1]) * uy;

const collinearOverlap = (
  a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[],
  eps: number,
): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (!(length > eps)) return 0;
  const ux = dx / length, uy = dy / length;
  const cross = (point: readonly number[]) => Math.abs(
    (point[0] - a[0]) * uy - (point[1] - a[1]) * ux
  );
  if (cross(c) > eps || cross(d) > eps) return 0;
  const lo = Math.max(0, Math.min(
    segmentProjection(c, a, ux, uy), segmentProjection(d, a, ux, uy),
  ));
  const hi = Math.min(length, Math.max(
    segmentProjection(c, a, ux, uy), segmentProjection(d, a, ux, uy),
  ));
  return Math.max(0, hi - lo);
};

const openingGeometry = (
  opening: OpeningCfg,
  partitions: readonly PartitionCfg[],
  options: CoincidentPartitionOptions,
): { center: [number, number]; angle: number; length: number } | null => {
  if (opening.host) {
    const resolved = resolvePartitionOpeningCompat(
      opening, partitions, options.coordScale, options.cellCm, options.gridPitch,
    ).resolved;
    return resolved ? {
      center: resolved.center,
      angle: resolved.angle,
      length: resolved.length,
    } : null;
  }
  const x = Number(opening.x) * options.coordScale;
  const y = Number(opening.y) * options.coordScale;
  const angle = Number(opening.angle);
  const length = Number(opening.length) * options.coordScale;
  return [x, y, angle, length].every(Number.isFinite) && length > 0
    ? { center: [x, y], angle, length }
    : null;
};

const openingsOverlap = (
  first: { center: [number, number]; angle: number; length: number },
  second: { center: [number, number]; angle: number; length: number },
  eps: number,
): boolean => {
  const rad = first.angle * Math.PI / 180;
  const ux = Math.cos(rad), uy = Math.sin(rad);
  const otherRad = second.angle * Math.PI / 180;
  const vx = Math.cos(otherRad), vy = Math.sin(otherRad);
  if (Math.abs(ux * vy - uy * vx) > 1e-6) return false;
  const dx = second.center[0] - first.center[0];
  const dy = second.center[1] - first.center[1];
  if (Math.abs(dx * uy - dy * ux) > eps) return false;
  const along = dx * ux + dy * uy;
  return Math.max(-first.length / 2, along - second.length / 2)
    < Math.min(first.length / 2, along + second.length / 2) - eps;
};

const rawPartitionKnown = (partition: any): boolean => {
  const known = new Set(['id', 'a', 'b', 'cm']);
  return Object.keys(partition || {}).every((key) => known.has(key));
};

const columnBlocks = (
  partition: PartitionCfg,
  columns: readonly any[],
  options: CoincidentPartitionOptions,
  eps: number,
): boolean => {
  const dx = partition.b[0] - partition.a[0];
  const dy = partition.b[1] - partition.a[1];
  const length = Math.hypot(dx, dy);
  if (!(length > eps)) return true;
  const ux = dx / length, uy = dy / length;
  const wallHalf = wallCmToUnits(partition.cm, options.cellCm, options.gridPitch) / 2;
  return columns.some((column) => {
    const centre = column?.center;
    if (!Array.isArray(centre) || centre.length < 2) return true;
    const along = segmentProjection(centre, partition.a, ux, uy);
    const across = Math.abs(
      (centre[0] - partition.a[0]) * uy - (centre[1] - partition.a[1]) * ux
    );
    // A rotated square fits inside its circumcircle; using it here is a
    // deliberately conservative ambiguity guard, never an auto-delete test.
    const radius = wallCmToUnits(Number(column.cm), options.cellCm, options.gridPitch)
      * (column.shape === 'square' ? Math.SQRT1_2 : 0.5);
    if (!Number.isFinite(radius) || !(radius > 0)) return true;
    return along >= -radius - eps && along <= length + radius + eps
      && across <= wallHalf + radius + eps;
  });
};

/**
 * Reconcile every independently provable candidate in deterministic id order.
 * A candidate which fails any check is left byte-equivalent.
 */
export function reconcileCoincidentPartitions(
  rawSpace: any,
  model: Pick<SpaceModel, 'rooms' | 'partitions' | 'room_drafts' | 'wall_columns'>,
  wallsInput: WallEntry[] | null | undefined,
  openCuts: number[][],
  options: CoincidentPartitionOptions,
): CoincidentPartitionResult {
  const walls0 = wallsInput || [];
  const partitions0 = (Array.isArray(rawSpace?.partitions) ? rawSpace.partitions : []) as PartitionCfg[];
  const openings0 = (Array.isArray(rawSpace?.openings) ? rawSpace.openings : []) as OpeningCfg[];
  if (!partitions0.length) return {
    walls: walls0,
    partitions: partitions0,
    openings: openings0,
    partitionsReconciled: 0,
    openingsRehosted: 0,
  };
  const eps = Math.max(options.gridPitch * 0.0002, 1e-9);
  const intervals = wallIntervals(
    model.rooms, walls0, openCuts,
    options.pitch, options.cellCm, options.gridPitch, options.coordScale,
  );
  const keyScale = options.coordScale > 0 ? options.coordScale : 1;
  const segmentKey = (a: readonly number[], b: readonly number[]) => wallKey(
    [a[0] / keyScale, a[1] / keyScale],
    [b[0] / keyScale, b[1] / keyScale],
    options.pitch,
  );
  const sharedByKey = new Map<string, WallInterval[]>();
  for (const interval of intervals) {
    if (interval.kind !== 'shared' || interval.open || !(interval.cm > 0)) continue;
    const key = segmentKey(interval.a, interval.b);
    const bucket = sharedByKey.get(key);
    if (bucket) bucket.push(interval);
    else sharedByKey.set(key, [interval]);
  }
  const modelById = new Map(model.partitions.map((partition) => [partition.id, partition]));
  let walls = walls0;
  let partitions = partitions0;
  let openings = openings0;
  let partitionsReconciled = 0;
  let openingsRehosted = 0;

  for (const rawPartition of [...partitions0].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!rawPartitionKnown(rawPartition)) continue;
    const partition = modelById.get(rawPartition.id);
    if (!partition || !Number.isFinite(partition.cm) || !(partition.cm > 0)) continue;
    if (!Array.isArray(partition.a) || !Array.isArray(partition.b)) continue;
    if (Math.hypot(
      partition.b[0] - partition.a[0], partition.b[1] - partition.a[1],
    ) <= eps) continue;

    const owners = (sharedByKey.get(segmentKey(partition.a, partition.b)) || [])
      .filter((interval) => sameSegment(
        interval.a, interval.b, partition.a, partition.b, eps,
      ));
    if (owners.length !== 2) continue;
    const byRoom = new Map<string, WallInterval>();
    for (const owner of owners) byRoom.set(owner.roomId, owner);
    if (byRoom.size !== 2) continue;
    const shared = [...byRoom.values()];
    if (shared.some((interval) => !sameSegment(
      interval.a, interval.b, partition.a, partition.b, eps,
    ))) continue;
    const sharedCms = new Set(shared.map((interval) => interval.cm));
    if (sharedCms.size !== 1) continue;
    const roomCm = shared[0].cm;

    const anotherPartition = model.partitions.some((other) => (
      other.id !== partition.id
      && collinearOverlap(partition.a, partition.b, other.a, other.b, eps) > eps
    ));
    if (anotherPartition) continue;
    const draftOverlap = model.room_drafts.some((draft) => (
      (draft.points || []).some((point, index) => index + 1 < draft.points.length
        && collinearOverlap(
          partition.a, partition.b, point, draft.points[index + 1], eps,
        ) > eps)
    ));
    if (draftOverlap || columnBlocks(partition, model.wall_columns, options, eps)) continue;

    const hosted = openings.filter((opening) => opening.host?.kind === 'partition'
      && opening.host.id === partition.id);
    const resolvedHosted = hosted.map((opening) => ({
      opening,
      resolved: resolvePartitionOpeningCompat(
        opening, model.partitions,
        options.coordScale, options.cellCm, options.gridPitch,
      ).resolved,
    }));
    if (resolvedHosted.some((item) => !item.resolved)) continue;
    if (resolvedHosted.some((item) => !partitionOpeningHasCompositeRoomWall(
      item.resolved!, shared, eps,
    ))) continue;

    const finalCm = Math.max(roomCm, partition.cm);
    const nextWalls = finalCm === roomCm ? walls : setWallThickness(
      walls, partition.a, partition.b, finalCm, options.pitch, options.coordScale,
    );
    const nextHosted = resolvedHosted.map(({ opening, resolved }) => {
      const materialized = materializePartitionOpening(
        opening, resolved!, options.coordScale,
      );
      const { host: _host, ...ordinary } = materialized;
      return ordinary as OpeningCfg;
    });
    const nextGeometries = nextHosted.map((opening) => openingGeometry(
      opening, model.partitions, options,
    ));
    if (nextGeometries.some((geometry) => !geometry)) continue;
    let overlap = false;
    for (let i = 0; i < nextGeometries.length; i++) {
      for (let j = i + 1; j < nextGeometries.length; j++) {
        if (openingsOverlap(nextGeometries[i]!, nextGeometries[j]!, eps)) overlap = true;
      }
    }
    const hostedIds = new Set(hosted.map((opening) => opening.id));
    for (const opening of openings) {
      if (hostedIds.has(opening.id)) continue;
      const geometry = openingGeometry(opening, model.partitions, options);
      if (geometry && nextGeometries.some((candidate) => openingsOverlap(candidate!, geometry, eps))) {
        overlap = true;
      }
    }
    if (overlap) continue;

    const index = openingWallIndex(
      model.rooms, nextWalls, openCuts,
      options.pitch, options.cellCm, options.gridPitch, options.coordScale,
    );
    const roomIds = new Set(shared.map((interval) => interval.roomId));
    const associationsOk = nextHosted.every((opening) => {
      const association = resolveOpeningWallAssociation(index, {
        x: opening.x * options.coordScale,
        y: opening.y * options.coordScale,
        angle: opening.angle,
        length: opening.length * options.coordScale,
      }, true);
      return !!association.negative?.full && !!association.positive?.full
        && roomIds.has(association.negative.roomId)
        && roomIds.has(association.positive.roomId)
        && association.negative.roomId !== association.positive.roomId;
    });
    if (!associationsOk) continue;

    walls = nextWalls;
    partitions = partitions.filter((item) => item.id !== partition.id);
    const replacement = new Map(nextHosted.map((opening) => [opening.id, opening]));
    openings = openings.map((opening) => replacement.get(opening.id) || opening);
    partitionsReconciled++;
    openingsRehosted += nextHosted.length;
  }

  return { walls, partitions, openings, partitionsReconciled, openingsRehosted };
}
