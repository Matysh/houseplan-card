import type { DevItem, ServerConfig } from './types';

/** An explicit room Save, not a standing exemption for its HA Area (#879). */
export interface CreatedAreaRoom { space: string; roomId: string; area: string | null }
interface Placement extends CreatedAreaRoom { ids: readonly string[] }
export interface RoomDiscoveryWrite { config: ServerConfig; placements: readonly Placement[] }

const auto = (device: DevItem): boolean => !device.marker && !device.virtual;
const knownWith = (config: ServerConfig, ids: readonly string[]): string[] =>
  [...new Set([...(config.settings.known_devices || []), ...ids])];

/** Owned by the lazy editor; nothing is acknowledged in live settings before Save succeeds. */
export class RoomDeviceDiscovery {
  private placements = new Set<Placement>();

  capture(rooms: readonly CreatedAreaRoom[], before: readonly DevItem[], after: readonly DevItem[],
    config: ServerConfig): void {
    const oldIds = new Set(before.filter(auto).map(device => device.id));
    for (const room of rooms) {
      const placement: Placement = { ...room, ids: after.filter(device => auto(device)
        && !oldIds.has(device.id) && device.space === room.space && device.area === room.area
        && (!device.bindingStatus || device.bindingStatus.kind === 'active')).map(device => device.id) };
      if (placement.ids.length && this.valid(placement, config)) this.placements.add(placement);
    }
  }

  private valid(placement: Placement, config: ServerConfig): boolean {
    if (!placement.area) return false;
    const matches = config.spaces.flatMap(space => (space.rooms || [])
      .filter(room => room.area === placement.area).map(room => ({ space: space.id, roomId: room.id })));
    return matches.length === 1 && matches[0].space === placement.space
      && matches[0].roomId === placement.roomId;
  }

  pendingIds(config: ServerConfig): ReadonlySet<string> {
    for (const placement of this.placements) if (!this.valid(placement, config)) this.placements.delete(placement);
    return new Set([...this.placements].flatMap(placement => placement.ids));
  }

  /** Add baseline only to the exact config carrying the rooms, never to a separate metadata write. */
  prepare(config: ServerConfig): RoomDiscoveryWrite {
    const ids = [...this.pendingIds(config)];
    return { config: ids.length ? { ...config, settings: { ...config.settings,
      known_devices: knownWith(config, ids) } } : config, placements: [...this.placements] };
  }

  accept(write: RoomDiscoveryWrite, live: ServerConfig | null): void {
    if (live && write.placements.length) live.settings = { ...live.settings,
      known_devices: knownWith(live, write.placements.flatMap(placement => placement.ids)) };
    this.reject(write);
  }

  reject(write: RoomDiscoveryWrite): void {
    // A late response cannot consume a different Save registered in the meantime.
    for (const placement of write.placements) this.placements.delete(placement);
  }
}
