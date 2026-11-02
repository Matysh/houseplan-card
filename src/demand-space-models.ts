import { NORM_W, planRect, spaceModels } from './space-geometry';
import { stairList } from './stairs';
import { physicalFloorFingerprint } from './floor-geometry-key';
import type { RoomCfg, ServerConfig, SpaceModel } from './types';
import { registerWallGraph } from './wall-graph-source';

/** Navigation/registry joins read cheap metadata. Scaled polygons and bodies
 * belong to the floor consumer that actually asks for them, not the cfg epoch. */
export class DemandSpaceModels {
  readonly work = { builds: 0 };
  private readonly floors = new Map<string, { key: string; model: SpaceModel }>();
  constructor(private readonly build = spaceModels, private readonly limit = 8) {}

  read(config: ServerConfig): SpaceModel[] {
    const ids = new Set(config.spaces.map(space => space.id));
    for (const id of this.floors.keys()) if (!ids.has(id)) this.floors.delete(id);
    return config.spaces.map(raw => {
      let resolved: SpaceModel | undefined;
      let roomIndex: Map<string | undefined, RoomCfg> | undefined;
      let stairs: SpaceModel['stairs'] | undefined, bg: SpaceModel['bg'] | undefined;
      const full = (): SpaceModel => {
        if (resolved) return resolved;
        const key = physicalFloorFingerprint(raw), previous = this.floors.get(raw.id);
        this.floors.delete(raw.id);
        if (previous?.key === key) resolved = previous.model;
        else { resolved = this.build({ ...config, spaces: [raw] })[0]; this.work.builds++; }
        this.floors.set(raw.id, { key, model: resolved });
        while (this.floors.size > this.limit) this.floors.delete(this.floors.keys().next().value!);
        return resolved;
      };
      const fullRoom = (id: string | undefined): RoomCfg => {
        roomIndex ??= new Map(full().rooms.map(room => [room.id,room]));
        return roomIndex.get(id) || { id, name: '', area: null };
      };
      const metadata = new Map((raw.rooms || []).map(room => [room.id,room]));
      const roomRecords = raw.plan_graph
        ? raw.plan_graph.rooms.map(owner => metadata.get(owner.room) || {id:owner.room})
        : raw.rooms || [];
      const rooms = roomRecords.map((room): RoomCfg => ({
        id: room.id, name: room.name, area: room.area ?? null,
        open_to: room.open_to || undefined, settings: room.settings || undefined,
        get x() { return fullRoom(room.id).x; }, get y() { return fullRoom(room.id).y; },
        get w() { return fullRoom(room.id).w; }, get h() { return fullRoom(room.id).h; },
        get poly() { return fullRoom(room.id).poly; },
        get wall_ids() { return fullRoom(room.id).wall_ids; },
      }));
      if(raw.plan_graph)registerWallGraph(rooms,undefined,raw.plan_graph,NORM_W);
      return {
        id: raw.id, title: raw.title, rooms, led_strips: raw.led_strips,
        ...(raw.plan_graph ? { plan_graph: raw.plan_graph } : {}),
        get cellCm() { return full().cellCm; }, get vb() { return full().vb; },
        get bg() {
          if (bg === undefined) bg = raw.plan_url ? { href: raw.plan_url, ...planRect(raw, NORM_W) } : null;
          return bg;
        },
        get wall_segments() { return full().wall_segments; },
        get partitions() { return full().partitions; },
        get wall_columns() { return full().wall_columns; },
        get stairs() { return stairs ??= stairList(raw.stairs); },
      };
    });
  }
  clear(): void { this.floors.clear(); }
}
