import { floorMinusBodies, geometryArea, polyclipPathD } from './physical-geometry';
import { geometryAreaMinusStairs } from './stairs';
import type { RoomCfg, SpaceModel } from './types';
import { lruRead, lruWrite } from './card-runtime';
import type { Geom } from 'polyclip-ts';

export type CleanFloorResult = {
  floor: number[][];
  geom: Geom | null;
  path: string;
  area: number;
};

export function cleanFloorForRoom(input: {
  room: RoomCfg;
  floor: number[][];
  space?: SpaceModel;
  configEpoch: number;
  resizePreview: boolean;
  cache: Map<string, CleanFloorResult>;
  physicalBodies(space: SpaceModel): number[][][];
}): CleanFloorResult {
  const { room, floor, space } = input;
  if (!space) return {
    floor, geom: null, path: '', area: geometryArea([[[...floor, floor[0]]]]),
  };
  const roomKey = room.id || `#${space.rooms.indexOf(room)}`;
  const key = `${space.id}|${input.configEpoch}|${roomKey}`;
  if (!input.resizePreview) {
    const cached = lruRead(input.cache, key);
    if (cached.hit) return cached.value;
  }
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
  const result = {
    floor,
    geom,
    path: geom ? polyclipPathD(geom) : '',
    area: geometryAreaMinusStairs(geom || [[[...floor, floor[0]]]], space.stairs),
  };
  if (!input.resizePreview) lruWrite(input.cache, key, result, 600);
  return result;
}
