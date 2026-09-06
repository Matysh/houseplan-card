/**
 * Lossless current-writer normalisation (#477).
 *
 * This module owns no UI and never mutates its inputs.  A wall-chain finish
 * can therefore build and validate the complete candidate before the live
 * config, history or pending-write fingerprint sees any of it.
 */
import { reconcileCoincidentPartitions } from './coincident-partitions';
import type {
  OpeningCfg, PartitionCfg, RoomCfg, SpaceModel, WallColumnCfg,
} from './types';
import type { WallEntry } from './wall-thickness';
import {
  applyOpeningMoves, mergeCollinearPartitions, spaceMergeGeometry,
} from './wall-merge';

export interface WallChainFinalizerOptions {
  pitch: number;
  cellCm: number;
  gridPitch: number;
  coordScale: number;
}

export interface WallChainFinalizerReport {
  partitionsMerged: number;
  partitionsReconciled: number;
  openingsRehosted: number;
  changed: boolean;
}

export interface WriterFixedPointSpace extends Record<string, unknown> {
  rooms?: RoomCfg[];
  partitions?: PartitionCfg[];
  openings?: OpeningCfg[];
  walls?: WallEntry[];
  wall_columns?: WallColumnCfg[];
}

export interface WallChainFinalizerResult {
  space: WriterFixedPointSpace;
  report: WallChainFinalizerReport;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Ids from the active chain after all deterministic merge remaps. */
function survivingSeedIds(
  partitions: readonly PartitionCfg[],
  seedIds: readonly string[],
  moves: readonly { fromId: string; toId: string }[],
): string[] {
  const present = new Set(partitions.map((partition) => partition.id));
  const mapped = new Map(moves.map((move) => [move.fromId, move.toId]));
  return [...new Set(seedIds
    .map((id) => mapped.get(id) || id)
    .filter((id) => present.has(id)))]
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Canonicalise only the connected partition component touched by one finished
 * wall chain.  Full-space maintenance remains the responsibility of Optimize.
 */
export function finalizeWallChainSpace(
  rawSpace: WriterFixedPointSpace,
  model: Pick<SpaceModel, 'rooms' | 'partitions' | 'wall_columns'>,
  openCuts: number[][],
  seedIds: readonly string[],
  options: WallChainFinalizerOptions,
): WallChainFinalizerResult {
  const space = clone(rawSpace);
  const seeds = [...new Set(seedIds.filter((id) => typeof id === 'string' && id))];
  const emptyReport: WallChainFinalizerReport = {
    partitionsMerged: 0,
    partitionsReconciled: 0,
    openingsRehosted: 0,
    changed: false,
  };
  if (!seeds.length || !Array.isArray(space?.partitions)) {
    return { space, report: emptyReport };
  }

  const before = JSON.stringify(space);
  const merged = mergeCollinearPartitions(space.partitions as PartitionCfg[], {
    pitch: options.pitch,
    seedIds: seeds,
    geometry: spaceMergeGeometry(space),
  });
  if (merged.merged) space.partitions = merged.partitions;
  const mergedOpenings = (Array.isArray(space.openings) ? space.openings : []) as OpeningCfg[];
  if (merged.merged) {
    applyOpeningMoves(mergedOpenings, merged.partitions, merged.openingMoves, {
      coordScale: options.coordScale,
      cellCm: options.cellCm,
      gridPitch: options.gridPitch,
    });
  }

  const surviving = survivingSeedIds(merged.partitions, seeds, merged.openingMoves);
  const mergedModel = {
    rooms: model.rooms,
    wall_columns: model.wall_columns,
    partitions: merged.partitions.map((partition) => ({
      ...partition,
      a: [partition.a[0] * options.coordScale, partition.a[1] * options.coordScale],
      b: [partition.b[0] * options.coordScale, partition.b[1] * options.coordScale],
    })),
  };
  const reconciled = reconcileCoincidentPartitions(
    space,
    mergedModel,
    space.walls as WallEntry[] | undefined,
    openCuts,
    {
      ...options,
      partitionIds: surviving,
    },
  );
  // A no-op finish must be byte-equivalent: in particular it must not turn an
  // authored empty array into an absent field merely because the shared
  // reconciliation helper returns canonical empty collections.  Adopt those
  // collections only when the proof actually consumed a partition.
  if (reconciled.partitionsReconciled) {
    if (reconciled.walls.length) space.walls = reconciled.walls;
    else delete space.walls;
    if (reconciled.partitions.length) space.partitions = reconciled.partitions;
    else delete space.partitions;
    if (reconciled.openings.length) space.openings = reconciled.openings;
    else delete space.openings;
  }

  return {
    space,
    report: {
      partitionsMerged: merged.merged,
      partitionsReconciled: reconciled.partitionsReconciled,
      openingsRehosted: reconciled.openingsRehosted,
      changed: JSON.stringify(space) !== before,
    },
  };
}
