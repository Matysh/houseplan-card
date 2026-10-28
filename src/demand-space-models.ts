import { NORM_W, planRect, spaceModels } from './space-geometry';
import { stairList } from './stairs';
import { physicalFloorFingerprint } from './floor-geometry-key';
import type { RoomCfg, ServerConfig, SpaceModel } from './types';

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
      const rooms = (raw.rooms || []).map((room, index): RoomCfg => ({
        id: room.id, name: room.name, area: room.area ?? null,
        open_to: room.open_to || undefined, settings: room.settings || undefined,
        get x() { return full().rooms[index].x; }, get y() { return full().rooms[index].y; },
        get w() { return full().rooms[index].w; }, get h() { return full().rooms[index].h; },
        get poly() { return full().rooms[index].poly; },
        get wall_ids() { return full().rooms[index].wall_ids; },
      }));
      return {
        id: raw.id, title: raw.title, rooms, led_strips: raw.led_strips,
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
