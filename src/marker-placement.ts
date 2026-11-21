/** Recover an explicit placement proved by one current room; never write layout. */
export interface MarkerPlacementConfig {
  spaces?: readonly {
    id: string;
    rooms?: readonly { id: string; area?: string | null }[];
    led_strips?: readonly { marker?: string | null }[];
  }[];
  markers?: { id?: string; binding?: string; space?: string | null; area?: string | null; room_id?: string | null }[];
}
export function repairMarkerSpacesInPlace(config: MarkerPlacementConfig): number {
  const areas = new Map<string, string | null>(), rooms = new Map<string, string | null>();
  const add = (index: Map<string, string | null>, key: string, owner: string) =>
    index.set(key, index.has(key) ? null : owner);
  // Index even duplicate room/Area evidence as ambiguous, in linear time.
  const strips = new Map<string, Set<string>>();
  for (const space of config.spaces || []) {
    for (const room of space.rooms || []) {
      if (room.area) add(areas, room.area, space.id);
      add(rooms, room.id, space.id);
    }
    for (const strip of space.led_strips || []) if (strip.marker) {
      const owners = strips.get(strip.marker) || new Set<string>();
      owners.add(space.id); strips.set(strip.marker, owners);
    }
  }
  const existingSpaces = new Set((config.spaces || []).map(space => space.id));
  let changed = 0;
  for (const marker of config.markers || []) {
    // Absence means follow the registry, and must remain absence.
    if (typeof marker.space !== 'string' || !marker.space) continue;
    // Only HA markers with an explicit Area already render on that Area’s floor.
    // Virtual/manual placements prefer their live explicit floor; do not move them.
    if (existingSpaces.has(marker.space) && (marker.binding === 'virtual' || !marker.area)) continue;
    const target = marker.area ? areas.get(marker.area)
      : marker.area === null && marker.room_id ? rooms.get(marker.room_id) : undefined;
    // A strip owns its floor; repairing metadata must not separate the pair.
    const owners = strips.get(marker.id || '');
    if (target && marker.space !== target && (!owners || owners.size === 1 && owners.has(target))) {
      marker.space = target;
      changed++;
    }
  }
  return changed;
}
