import { floorMinusBodies, geometryArea, polyclipPathD } from './physical-geometry';
import { geometryAreaMinusStairs } from './stairs';
import type { RoomCfg, SpaceModel } from './types';
import { lruRead, lruWrite } from './card-runtime';
import type { Geom } from 'polyclip-ts';

export type CleanFloorResult = {
  floor: number[][];
  geom: Geom | null;
  path: string;
  /** Clean-floor area minus stairs, computed on the first read (#669). */
  readonly area: number;
};

type StairAreaFn = (source: Geom, stairs: SpaceModel['stairs'] | undefined) => number;

export function cleanFloorForRoom(input: {
  room: RoomCfg;
  floor: number[][];
  space?: SpaceModel;
  configEpoch: number;
  resizePreview: boolean;
  cache: Map<string, CleanFloorResult>;
  physicalBodies(space: SpaceModel): number[][][];
  /** Test seam (#669): the stair subtraction behind `area`. */
  areaMinusStairs?: StairAreaFn;
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
  const subject = (geom || [[[...floor, floor[0]]]]) as Geom;
  const stairs = space.stairs;
  const areaMinusStairs: StairAreaFn = input.areaMinusStairs ?? geometryAreaMinusStairs;
  let area: number | undefined;
  const result: CleanFloorResult = {
    floor,
    geom,
    path: geom ? polyclipPathD(geom) : '',
    // #669: four render paths read only `path`; the room tooltip and the PDF
    // read the area. Subtracting up to 250 stair footprints per room belongs
    // to that first read, not to every render of the floor.
    get area() {
      if (area === undefined) area = areaMinusStairs(subject, stairs);
      return area;
    },
  };
  if (!input.resizePreview) lruWrite(input.cache, key, result, 600);
  return result;
}
