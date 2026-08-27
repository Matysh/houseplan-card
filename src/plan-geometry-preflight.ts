/**
 * Pure production-geometry preparation and the explicit Optimize preflight.
 *
 * This module deliberately owns no Lit, DOM or Home Assistant state. The card
 * uses the same preparation helpers for its renderer, so the safety check
 * cannot quietly drift into a second, simplified geometry algorithm.
 */
import { distToSegment, roomPoly, sharedBoundary } from './logic';
import { resolveOpenCuts, type OpenSpanEntry } from './open-spans';
import {
  partitionOpeningCut,
  partitionOpeningHasCompositeRoomWall,
  resolvePartitionOpeningCompat,
  type ResolvedPartitionOpening,
} from './partition-openings';
import { physicalBodyParts, type PartitionOpeningCut } from './physical-geometry';
import {
  floorFootprintGeometry,
  wallBodiesGeometry,
  wallIntervals,
  type WallEntry,
} from './wall-thickness';
import {
  GRID_PITCH,
  GRID_STEP_N,
  NORM_W,
  spaceModels,
} from './space-geometry';
import type { OpeningCfg, ServerConfig, SpaceModel } from './types';
import { contentFingerprint } from './visual-continuity';

export interface GeometryOpeningProjection extends OpeningCfg {
  rx: number;
  ry: number;
  rlen: number;
  partitionHost?: ResolvedPartitionOpening;
}

export interface RoomOpeningGeometryInput {
  x: number;
  y: number;
  angle: number;
  length: number;
}

export interface SpacePhysicalGeometryInputs {
  space: SpaceModel;
  walls: WallEntry[];
  openCuts: number[][];
  openings: GeometryOpeningProjection[];
  roomOpenings: RoomOpeningGeometryInput[];
  partitionCuts: PartitionOpeningCut[];
  physicalBodies: number[][][];
  wallKeyPitch: number;
  cellCm: number;
  gridPitch: number;
  coordScale: number;
}

/**
 * #295: a PRIVACY-SAFE marker of the caught exception. The result deliberately
 * carries the error CLASS, never the message: messages can leak entity ids,
 * file paths or user data, and the existing preflight contract (unit «null,
 * exceptions and floor failure are bounded…») forbids them in the payload.
 */
export function preflightErrorDetail(error: unknown): string {
  if (error instanceof Error) return error.name || 'Error';
  return typeof error;
}

export type OptimizeGeometryFailureReason =
  | 'prepare-exception'
  | 'wall-null'
  | 'wall-degraded-extra'
  | 'wall-failed-core'
  | 'wall-exception'
  | 'floor-null'
  | 'floor-exception';

export type OptimizeSpaceGeometryStatus = 'ok' | 'failed' | 'not-applicable';

export interface OptimizeSpaceGeometryCheck {
  spaceId: string;
  displayName: string;
  status: OptimizeSpaceGeometryStatus;
  reason?: OptimizeGeometryFailureReason;
  /**
   * #295: the caught exception's CLASS (never the message — privacy contract)
   * for the *-exception reasons. Non-exception reasons are self-describing
   * and leave it unset. Diagnostic payloads carry it; user strings do not.
   */
  detail?: string;
}

export interface OptimizeGeometryPreflightResult {
  fingerprint: string;
  spaces: OptimizeSpaceGeometryCheck[];
  failures: Array<OptimizeSpaceGeometryCheck & {
    status: 'failed'; reason: OptimizeGeometryFailureReason;
  }>;
  ok: boolean;
}

export interface CheckOptimizeGeometryOptions {
  fallbackSpaceName?: (oneBasedIndex: number) => string;
  prepareSpace?: typeof prepareSpacePhysicalGeometryInputs;
  wallPass?: typeof wallBodiesGeometry;
  floorPass?: typeof floorFootprintGeometry;
  fingerprint?: typeof contentFingerprint;
  /** Internal reuse seam: receives the exact successful wall pass without
   * adding private plan geometry to the serializable preflight result. */
  captureWallGeometry?: (
    input: SpacePhysicalGeometryInputs,
    geometry: ReturnType<typeof wallBodiesGeometry>,
  ) => void;
}

export interface SpacePhysicalGeometryResult extends OptimizeSpaceGeometryCheck {
  fingerprint: string;
  ok: boolean;
}

/** Fingerprint only fields capable of changing canonical physical geometry. */
export function spacePhysicalGeometryFingerprint(spaceConfig: any): string {
  return contentFingerprint({
    id: spaceConfig?.id ?? '',
    cell_cm: spaceConfig?.cell_cm,
    rooms: spaceConfig?.rooms || [],
    walls: spaceConfig?.walls || [],
    wall_segments: spaceConfig?.wall_segments || [],
    open_spans: spaceConfig?.open_spans || [],
    openings: spaceConfig?.openings || [],
    partitions: spaceConfig?.partitions || [],
    room_drafts: spaceConfig?.room_drafts || [],
    wall_columns: spaceConfig?.wall_columns || [],
  });
}

/** Strict one-space barrier backed by the exact same pass as Optimize. */
export function checkSpacePhysicalGeometry(
  config: ServerConfig | any,
  spaceId: string,
  options: CheckOptimizeGeometryOptions = {},
): SpacePhysicalGeometryResult {
  const allSpaces = Array.isArray(config?.spaces) ? config.spaces : [];
  const raw = allSpaces.find((space: any) => String(space?.id || '') === String(spaceId || ''));
  const fingerprint = spacePhysicalGeometryFingerprint(raw);
  if (!raw) {
    return {
      spaceId: String(spaceId || ''), displayName: '', status: 'failed',
      reason: 'prepare-exception', fingerprint, ok: false,
    };
  }
  const result = checkOptimizeGeometry(
    { ...config, spaces: [raw] },
    { ...options, fingerprint: () => fingerprint },
  );
  const space = result.spaces[0] || {
    spaceId: String(spaceId || ''), displayName: '', status: 'failed' as const,
    reason: 'prepare-exception' as const,
  };
  return { ...space, fingerprint, ok: space.status !== 'failed' };
}

/** Resolve explicit spans and the legacy open_to fallback exactly as the card. */
export function geometryOpenCuts(
  spaceConfig: any,
  space: Pick<SpaceModel, 'rooms'>,
  gridPitch = GRID_PITCH,
  coordScale = NORM_W,
): number[][] {
  return resolveOpenCuts(
    space.rooms,
    spaceConfig?.open_spans as OpenSpanEntry[] | undefined,
    coordScale,
    gridPitch * 0.02,
  );
}

/**
 * Group open cuts by the two rooms that own their shared boundary. Wall
 * masonry has historically consumed this filtered/ordered projection rather
 * than the raw span array; both renderer and preflight share it here.
 */
export function geometryOpenPairs(
  roomsInput: readonly any[],
  cuts: readonly number[][],
  gridPitch = GRID_PITCH,
): Array<{ a: any; b: any; segs: number[][] }> {
  if (!cuts.length) return [];
  const rooms = roomsInput.filter((room) => room?.id);
  const eps = gridPitch * 0.02;
  const result: Array<{ a: any; b: any; segs: number[][] }> = [];
  for (let left = 0; left < rooms.length; left++) {
    for (let right = left + 1; right < rooms.length; right++) {
      const a = rooms[left], b = rooms[right];
      const polygonA = roomPoly(a), polygonB = roomPoly(b);
      if (!polygonA || !polygonB) continue;
      const shared = sharedBoundary(polygonA, polygonB, eps);
      if (!shared.length) continue;
      const segs = cuts.filter((cut) => {
        const midpoint = [(cut[0] + cut[2]) / 2, (cut[1] + cut[3]) / 2];
        return shared.some((segment) => distToSegment(midpoint, segment) < eps * 4);
      }).map((cut) => [...cut]);
      if (segs.length) result.push({ a, b, segs });
    }
  }
  return result;
}

/** Project stored openings into render units; invalid hosted records stay inert. */
export function geometryOpenings(
  spaceConfig: any,
  space: Pick<SpaceModel, 'partitions'>,
  cellCm: number,
  gridPitch = GRID_PITCH,
  coordScale = NORM_W,
): GeometryOpeningProjection[] {
  const raw = Array.isArray(spaceConfig?.openings) ? spaceConfig.openings : [];
  return raw.flatMap((opening: OpeningCfg) => {
    const fallback: GeometryOpeningProjection = {
      ...opening,
      rx: Number(opening.x) * coordScale,
      ry: Number(opening.y) * coordScale,
      rlen: Number(opening.length) * coordScale,
    };
    // A contour-wall host is stable identity metadata. Its materialised
    // x/y/angle remain the room-opening projection until the graph renderer;
    // only partition hosts need spatial resolution here.
    if (!opening.host || opening.host.kind === 'wall') return [fallback];
    const resolution = resolvePartitionOpeningCompat(
      opening, space.partitions, coordScale, cellCm, gridPitch,
    );
    if (!resolution.resolved) return [];
    return [{
      ...opening,
      rx: resolution.resolved.center[0],
      ry: resolution.resolved.center[1],
      rlen: resolution.resolved.length,
      angle: resolution.resolved.angle,
      partitionHost: resolution.resolved,
    }];
  });
}

export function geometryPartitionOpeningCuts(
  openings: readonly GeometryOpeningProjection[],
  accept: (opening: OpeningCfg) => boolean = () => true,
): PartitionOpeningCut[] {
  return openings.flatMap((opening) => (
    opening.host && opening.partitionHost && accept(opening)
      ? [partitionOpeningCut(opening.partitionHost)]
      : []
  ));
}

/**
 * Room masonry is cut by a hosted opening only for the exact composite wall
 * rule used by the production card. Ordinary openings always remain inputs.
 */
export function geometryRoomOpeningInputs(
  openings: readonly GeometryOpeningProjection[],
  space: Pick<SpaceModel, 'rooms'>,
  walls: readonly WallEntry[],
  openCuts: number[][],
  wallKeyPitch: number,
  cellCm: number,
  gridPitch = GRID_PITCH,
  coordScale = NORM_W,
): RoomOpeningGeometryInput[] {
  const intervals = wallIntervals(
    space.rooms, [...walls], openCuts,
    wallKeyPitch, cellCm, gridPitch, coordScale,
  );
  return openings.flatMap((opening) => {
    const input = {
      x: opening.rx,
      y: opening.ry,
      angle: Number(opening.angle) || 0,
      length: opening.rlen,
    };
    if (!opening.host || opening.host.kind === 'wall') return [input];
    if (!opening.partitionHost) return [];
    return partitionOpeningHasCompositeRoomWall(
      opening.partitionHost, intervals, gridPitch * 0.0002,
    ) ? [input] : [];
  });
}

/** Prepare every argument consumed by the production boolean passes. */
export function prepareSpacePhysicalGeometryInputs(
  spaceConfig: any,
  space: SpaceModel,
): SpacePhysicalGeometryInputs {
  const wallKeyPitch = GRID_STEP_N;
  const gridPitch = GRID_PITCH;
  const coordScale = NORM_W;
  const cellCm = Number.isFinite(Number(space.cellCm)) && Number(space.cellCm) > 0
    ? Number(space.cellCm) : 5;
  const walls = Array.isArray(spaceConfig?.walls)
    ? spaceConfig.walls as WallEntry[] : [];
  const cuts = geometryOpenCuts(spaceConfig, space, gridPitch, coordScale);
  const openCuts = geometryOpenPairs(space.rooms, cuts, gridPitch)
    .flatMap((pair) => pair.segs);
  const openings = geometryOpenings(
    spaceConfig, space, cellCm, gridPitch, coordScale,
  );
  const partitionCuts = geometryPartitionOpeningCuts(openings);
  const physicalBodies = physicalBodyParts(
    space, cellCm, gridPitch, gridPitch * 0.0002, partitionCuts,
  ).all;
  const roomOpenings = geometryRoomOpeningInputs(
    openings, space, walls, openCuts,
    wallKeyPitch, cellCm, gridPitch, coordScale,
  );
  return {
    space, walls, openCuts, openings, roomOpenings, partitionCuts,
    physicalBodies, wallKeyPitch, cellCm, gridPitch, coordScale,
  };
}

function safeDisplayName(
  spaceConfig: any,
  index: number,
  fallback: (oneBasedIndex: number) => string,
): { spaceId: string; displayName: string } {
  const title = typeof spaceConfig?.title === 'string' ? spaceConfig.title.trim() : '';
  const id = spaceConfig?.id == null ? '' : String(spaceConfig.id).trim();
  return {
    spaceId: id,
    displayName: title || id || fallback(index + 1),
  };
}

/**
 * Fail-closed renderability check for the exact config returned by Optimize.
 * Geometry values never escape this call; the dialog retains only bounded
 * statuses, names and the candidate fingerprint.
 */
export function checkOptimizeGeometry(
  config: ServerConfig | any,
  options: CheckOptimizeGeometryOptions = {},
): OptimizeGeometryPreflightResult {
  const fingerprint = (options.fingerprint || contentFingerprint)(config);
  const rawSpaces = Array.isArray(config?.spaces) ? config.spaces : [];
  const fallback = options.fallbackSpaceName || ((index: number) => `Space ${index}`);
  const prepare = options.prepareSpace || prepareSpacePhysicalGeometryInputs;
  const buildWalls = options.wallPass || wallBodiesGeometry;
  const buildFloor = options.floorPass || floorFootprintGeometry;
  const spaces: OptimizeSpaceGeometryCheck[] = [];

  for (let index = 0; index < rawSpaces.length; index++) {
    const raw = rawSpaces[index];
    const identity = safeDisplayName(raw, index, fallback);
    let input: SpacePhysicalGeometryInputs;
    try {
      const model = spaceModels({ ...config, spaces: [raw] } as ServerConfig)[0];
      if (!model) throw new Error('missing space model');
      input = prepare(raw, model);
    } catch (error) {
      spaces.push({
        ...identity, status: 'failed', reason: 'prepare-exception',
        detail: preflightErrorDetail(error),
      });
      continue;
    }

    const hasWallPass = input.walls.length > 0 || input.physicalBodies.length > 0;
    if (!input.space.rooms.length && !hasWallPass) {
      spaces.push({ ...identity, status: 'not-applicable' });
      continue;
    }

    let united: ReturnType<typeof wallBodiesGeometry> | null = null;
    if (hasWallPass) {
      try {
        united = buildWalls(
          input.space.rooms, input.walls, input.openCuts, input.roomOpenings,
          input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordScale,
          input.physicalBodies,
        );
      } catch (error) {
        spaces.push({
          ...identity, status: 'failed', reason: 'wall-exception',
          detail: preflightErrorDetail(error),
        });
        continue;
      }
      if (united == null) {
        spaces.push({ ...identity, status: 'failed', reason: 'wall-null' });
        continue;
      }
      if (united.status === 'degraded-extra') {
        spaces.push({ ...identity, status: 'failed', reason: 'wall-degraded-extra' });
        continue;
      }
      if (united.status === 'failed-core') {
        spaces.push({ ...identity, status: 'failed', reason: 'wall-failed-core' });
        continue;
      }
      options.captureWallGeometry?.(input, united);
    }

    if (input.space.rooms.length && united?.paperGeom == null) {
      let floor: ReturnType<typeof floorFootprintGeometry>;
      try {
        floor = buildFloor(
          input.space.rooms, input.walls, input.openCuts,
          input.wallKeyPitch, input.cellCm, input.gridPitch, input.coordScale,
        );
      } catch (error) {
        spaces.push({
          ...identity, status: 'failed', reason: 'floor-exception',
          detail: preflightErrorDetail(error),
        });
        continue;
      }
      if (floor == null) {
        spaces.push({ ...identity, status: 'failed', reason: 'floor-null' });
        continue;
      }
    }
    spaces.push({ ...identity, status: 'ok' });
  }

  const failures = spaces.filter((space): space is typeof space & {
    status: 'failed'; reason: OptimizeGeometryFailureReason;
  } => space.status === 'failed');
  return { fingerprint, spaces, failures, ok: failures.length === 0 };
}
