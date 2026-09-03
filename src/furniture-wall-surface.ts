/** Physical wall faces used by the furniture magnet (#445). */
import {
  inwardNormal, roomWallProfile,
  type WallEntry,
} from './wall-thickness';
import { NORM_W } from './space-geometry';
import type { RoomCfg, SpaceModel } from './types';

export type FurnitureWallSurfaceOwner = 'room' | 'physical';

/**
 * A finite surface on which furniture BACK may lie.
 *
 * Room faces are one-sided: `normal` points from masonry into the owning room.
 * Independent partitions/columns are already physical polygons, so their faces
 * are bidirectional (`normal = null`) and must never receive another offset.
 */
export interface FurnitureWallSurface {
  a: [number, number];
  b: [number, number];
  axisA: [number, number];
  axisB: [number, number];
  normal: [number, number] | null;
  owner: FurnitureWallSurfaceOwner;
  stableId: string;
  roomId?: string;
}

const finitePoint = (point: unknown): point is readonly [number, number] => (
  Array.isArray(point) && point.length >= 2
  && Number.isFinite(point[0]) && Number.isFinite(point[1])
);

const segmentIdentity = (a: readonly number[], b: readonly number[]): string => {
  const print = (point: readonly number[]) => `${point[0].toFixed(9)},${point[1].toFixed(9)}`;
  const pa = print(a), pb = print(b);
  return pa <= pb ? `${pa}|${pb}` : `${pb}|${pa}`;
};

/** Build every room-facing atomic surface, including zero/virtual intervals. */
export function roomFurnitureWallSurfaces(
  rooms: RoomCfg[],
  walls: WallEntry[] | null | undefined,
  openCuts: number[][],
  pitch: number,
  cellCm: number,
  gridPitch: number,
  coordScale = 1,
): FurnitureWallSurface[] {
  const out: FurnitureWallSurface[] = [];
  for (const room of rooms || []) {
    const roomId = typeof room?.id === 'string' ? room.id : '';
    if (!roomId) continue;
    const profile = roomWallProfile(
      rooms, roomId, walls, openCuts, pitch, cellCm, gridPitch, coordScale,
    );
    if (!profile) continue;
    for (let index = 0; index < profile.poly.length; index++) {
      const rawA = profile.poly[index];
      const rawB = profile.poly[(index + 1) % profile.poly.length];
      if (!finitePoint(rawA) || !finitePoint(rawB)) continue;
      const dx = rawB[0] - rawA[0], dy = rawB[1] - rawA[1];
      if (!(Math.hypot(dx, dy) > 1e-9)) continue;
      const normal = inwardNormal(profile.poly, index);
      const rawHalf = Number(profile.offsets[index]);
      const half = Number.isFinite(rawHalf) && rawHalf > 0 ? rawHalf : 0;
      const axisA: [number, number] = [rawA[0], rawA[1]];
      const axisB: [number, number] = [rawB[0], rawB[1]];
      out.push({
        a: [axisA[0] + normal[0] * half, axisA[1] + normal[1] * half],
        b: [axisB[0] + normal[0] * half, axisB[1] + normal[1] * half],
        axisA,
        axisB,
        normal,
        owner: 'room',
        stableId: `room:${roomId}:${segmentIdentity(axisA, axisB)}`,
        roomId,
      });
    }
  }
  return out;
}

/** Convert already-physical independent body faces without applying an offset. */
export function physicalFurnitureWallSurfaces(
  bodies: readonly number[][][],
): FurnitureWallSurface[] {
  const out: FurnitureWallSurface[] = [];
  const seen = new Set<string>();
  for (const body of bodies || []) {
    if (!Array.isArray(body) || body.length < 2) continue;
    for (let index = 0; index < body.length; index++) {
      const rawA = body[index];
      const rawB = body[(index + 1) % body.length];
      if (!finitePoint(rawA) || !finitePoint(rawB)) continue;
      if (!(Math.hypot(rawB[0] - rawA[0], rawB[1] - rawA[1]) > 1e-9)) continue;
      const a: [number, number] = [rawA[0], rawA[1]];
      const b: [number, number] = [rawB[0], rawB[1]];
      const stableId = `physical:${segmentIdentity(a, b)}`;
      if (seen.has(stableId)) continue;
      seen.add(stableId);
      out.push({
        a, b,
        axisA: [...a],
        axisB: [...b],
        normal: null,
        owner: 'physical',
        stableId,
      });
    }
  }
  return out;
}

/** Minimal runtime surface source; kept structural to avoid importing the editor. */
export interface FurnitureWallSurfaceSource {
  _cfgEpoch: number;
  _cellCm: number;
  _gridPitch: number;
  _wallKeyPitch: number;
  _spaceWalls: WallEntry[];
  _spaceModel: () => SpaceModel | undefined;
  _openCuts: () => number[][];
  _rawPhysicalBodiesR: () => number[][][];
}

const sourceCache = new WeakMap<object, {
  key: string; value: readonly FurnitureWallSurface[];
}>();

/** One immutable candidate list per host geometry/config epoch. */
export function furnitureWallSurfacesFor(
  source: FurnitureWallSurfaceSource,
): readonly FurnitureWallSurface[] {
  const space = source._spaceModel();
  if (!space) return [];
  const key = [
    space.id, source._cfgEpoch, source._cellCm,
    source._gridPitch, source._wallKeyPitch,
  ].join('|');
  const cached = sourceCache.get(source);
  if (cached?.key === key) return cached.value;
  const value = [
    ...roomFurnitureWallSurfaces(
      space.rooms, source._spaceWalls, source._openCuts(),
      source._wallKeyPitch, source._cellCm, source._gridPitch, NORM_W,
    ),
    ...physicalFurnitureWallSurfaces(source._rawPhysicalBodiesR()),
  ];
  sourceCache.set(source, { key, value });
  return value;
}
