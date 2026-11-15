import { floorMinusBodies, geometryArea, polyclipPathD } from './physical-geometry';
import { geometryAreaMinusStairs } from './stairs';
import type { RoomCfg, SpaceModel } from './types';
import { lruRead, lruWrite } from './card-runtime';
import { geometryWork } from './geometry-work';
import type { Geom } from 'polyclip-ts';

export type CleanFloorResult = {
  floor: number[][];
  geom: Geom | null;
  path: string;
  /** Clean-floor area minus stairs, computed on the first read (#669). */
  readonly area: number;
};

type StairAreaFn = (source: Geom, stairs: SpaceModel['stairs'] | undefined) => number;
export interface CleanFloorData { floor: number[][]; geom: Geom | null; path: string; area?: number }
const retainedArea = new WeakMap<CleanFloorResult, { value?: number }>();
/** #1454: do not invoke the lazy stair subtraction while encoding a frame. */
export function cleanFloorData(result: CleanFloorResult): CleanFloorData {
  const area = retainedArea.get(result)?.value;
  return { floor: result.floor, geom: result.geom, path: result.path, ...(area === undefined ? {} : { area }) };
}
export function cleanFloorFromData(data: CleanFloorData, stairs: SpaceModel['stairs'] | undefined,
  areaMinusStairs: StairAreaFn = geometryAreaMinusStairs): CleanFloorResult {
  const memo = { value: data.area };
  const subject = (data.geom || [[[...data.floor, data.floor[0]]]]) as Geom;
  const result: CleanFloorResult = {
    floor: data.floor, geom: data.geom, path: data.path,
    get area() { return memo.value ??= areaMinusStairs(subject, stairs); },
  };
  retainedArea.set(result, memo);
  return result;
}

export function cleanFloorForRoom(input: {
  room: RoomCfg;
  floor: number[][];
  space?: SpaceModel;
  /** The floor's content key (#744, floor-geometry-key.ts); it starts with the floor id. */
  floorKey(spaceId: string): string;
  resizePreview: boolean;
  cache: Map<string, CleanFloorResult>;
  physicalBodies(space: SpaceModel): number[][][];
  /** Test seam (#669): the stair subtraction behind `area`. */
  areaMinusStairs?: StairAreaFn;
  /** #769: called once per real build (a miss), never on a hit. */
  onBuild?: () => void;
}): CleanFloorResult {
  const { room, floor, space } = input;
  if (!space) return {
    floor, geom: null, path: '', area: geometryArea([[[...floor, floor[0]]]]),
  };
  const roomKey = room.id || `#${space.rooms.indexOf(room)}`;
  const key = `${input.floorKey(space.id)}|${roomKey}`;
  if (!input.resizePreview) {
    const cached = lruRead(input.cache, key);
    if (cached.hit) return cached.value;
  }
  geometryWork('cleanFloorGeometry');
  input.onBuild?.();
  const xs = floor.map((point) => point[0]);
  const ys = floor.map((point) => point[1]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const candidates = input.physicalBodies(space).filter((body) => {
    const bx = body.map((point) => point[0]);
    const by = body.map((point) => point[1]);
    return Math.max(...bx) >= box[0] && Math.min(...bx) <= box[2]
      && Math.max(...by) >= box[1] && Math.min(...by) <= box[3];
  });
  const geom = candidates.length ? floorMinusBodies(floor, candidates) : null;
  const stairs = space.stairs;
  const areaMinusStairs: StairAreaFn = input.areaMinusStairs ?? geometryAreaMinusStairs;
  // #669/#1454: subtraction stays lazy through a cache/worker round trip.
  const result = cleanFloorFromData({ floor, geom, path: geom ? polyclipPathD(geom) : '' }, stairs, areaMinusStairs);
  if (!input.resizePreview) lruWrite(input.cache, key, result, 600);
  return result;
}
