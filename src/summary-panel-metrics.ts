import { union, type Geom } from 'polyclip-ts';
import { formatArea } from './area-format';
import { removedPlanBindings } from './devices';
import { geometryArea, floorMinusBodies } from './physical-geometry';
import { prepareSpacePhysicalGeometryInputs } from './plan-geometry-preflight';
import { GRID_PITCH, GRID_STEP_N, NORM_W } from './space-geometry';
import { hassValue, roomPoly, valueWithUnit } from './logic';
import { innerContourForRoom, multiWallNodesForGeometry, wallBodiesGeometry } from './wall-thickness';
import type { Marker, ServerConfig, SpaceModel, SummaryPanelSource } from './types';
import type { HaRegistrySnapshot } from './ha-binding-status';
import type { SummaryHass } from './summary-panel-host';

/** Count the unique real HA devices represented anywhere on the plan. */
export function representedHaDeviceIds(input: {
  registry: HaRegistrySnapshot;
  areaToSpace: Record<string, string>;
  spaceIds: ReadonlySet<string>;
  firstSpaceId: string;
  markers: readonly Marker[];
}): Set<string> | null {
  if (!input.registry.authoritative) return null;
  const out = new Set<string>();
  const removed = removedPlanBindings(input.markers);
  for (const device of Object.values(input.registry.devices || {})) {
    if (!device?.id || device.entry_type === 'service' || removed.devices.has(device.id)) continue;
    if (device.area_id && input.areaToSpace[device.area_id]) out.add(device.id);
  }
  for (const marker of input.markers || []) {
    if (marker.removed || marker.binding === 'virtual') continue;
    const separator = String(marker.binding || '').indexOf(':');
    if (separator < 1) continue;
    const kind = marker.binding.slice(0, separator);
    const ref = marker.binding.slice(separator + 1);
    const device = kind === 'device' ? input.registry.devices?.[ref] : null;
    const entity = kind === 'entity' ? input.registry.entities?.[ref] : null;
    const deviceId = kind === 'device' ? ref : entity?.device_id;
    const registryArea = kind === 'device' ? device?.area_id
      : entity?.area_id || (deviceId && input.registry.devices?.[deviceId]?.area_id);
    const manualRoomWithoutArea = typeof marker.room_id === 'string'
      && marker.room_id.length > 0 && marker.area === null;
    const area = manualRoomWithoutArea ? '' : marker.area || registryArea || '';
    const space = area && input.areaToSpace[area] || marker.space || input.firstSpaceId;
    if (deviceId && input.registry.devices?.[deviceId]
        && input.spaceIds.has(space)
        && (!removed.devices.has(deviceId) || kind === 'entity' && removed.liveEntities.has(ref))) {
      out.add(deviceId);
    }
  }
  return out;
}

function unionGeometry(current: Geom | null, next: Geom): Geom {
  if (!current?.length) return next;
  if (!next?.length) return current;
  return union(current, next);
}

/**
 * Wall masonry and junction topology of one space, computed once (#509).
 *
 * `innerContourForRoom` accepts both as optional arguments and, without them,
 * unions the whole space's masonry again for EVERY room: on the large-house
 * fixture that was 176 ms per room and 11 s for the panel's first frame. The
 * card has always passed them from its own render cache (`_innerContour`);
 * the panel now does the same, one pass per space instead of one per room.
 */
export function spaceWallGeometry(
  space: SpaceModel,
  prepared: ReturnType<typeof prepareSpacePhysicalGeometryInputs>,
): { roomGeom: unknown; multiWallNodes: ReturnType<typeof multiWallNodesForGeometry> } {
  const united = wallBodiesGeometry(
    space.rooms, prepared.walls, prepared.openCuts, [],
    GRID_STEP_N, prepared.cellCm, GRID_PITCH, NORM_W,
  );
  return {
    roomGeom: united.status === 'ok' || united.status === 'degraded-extra' ? united.roomGeom : undefined,
    multiWallNodes: multiWallNodesForGeometry(
      space.rooms, prepared.walls, prepared.openCuts,
      GRID_STEP_N, prepared.cellCm, GRID_PITCH, NORM_W,
    ),
  };
}

/** Canonical clean-floor union, in physical square metres, for every space. */
export function totalCleanFloorAreaM2(
  config: ServerConfig,
  models: readonly SpaceModel[],
  geometryOf: typeof spaceWallGeometry = spaceWallGeometry,
): number | null {
  try {
    let total = 0;
    for (const space of models) {
      const raw = config.spaces.find((item) => String(item?.id) === space.id);
      if (!raw) continue;
      const prepared = prepareSpacePhysicalGeometryInputs(raw, space);
      // Один проход на пространство, не на комнату (#509).
      const shared = geometryOf(space, prepared);
      let spaceFloor: Geom | null = null;
      for (const room of space.rooms) {
        if (!room.id) continue;
        const poly = roomPoly(room);
        if (!poly) continue;
        const inner = innerContourForRoom(
          space.rooms, room.id, prepared.walls, prepared.openCuts,
          GRID_STEP_N, prepared.cellCm, GRID_PITCH, NORM_W,
          shared.roomGeom, shared.multiWallNodes,
        ) || poly;
        const clean = floorMinusBodies(inner, prepared.physicalBodies) as Geom;
        spaceFloor = unionGeometry(spaceFloor, clean);
      }
      const cmPerUnit = prepared.cellCm / GRID_PITCH;
      total += geometryArea(spaceFloor) * cmPerUnit * cmPerUnit / 1e4;
    }
    return total;
  } catch {
    return null;
  }
}

export function summarySystemValue(
  source: SummaryPanelSource,
  values: { deviceCount: number | null; areaM2: number | null; now: Date },
  hass: SummaryHass | undefined,
  locale: string,
): string | null {
  if (source.type !== 'system') return null;
  if (source.key === 'device_count') return values.deviceCount === null ? null : String(values.deviceCount);
  if (source.key === 'total_area') {
    if (values.areaM2 === null) return null;
    return formatArea(values.areaM2, hass?.config?.unit_system?.length === 'mi');
  }
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      dateStyle: 'short', timeStyle: 'short', timeZone: hass?.config?.time_zone || undefined,
    }).format(values.now);
  } catch {
    return values.now.toLocaleString();
  }
}

export function summaryEntityValue(hass: SummaryHass | undefined, entityId: string): string | null {
  const state = hass?.states?.[entityId];
  if (!state) return null;
  const value = hassValue(hass, entityId);
  if (!value) return null;
  return valueWithUnit(value, String(state.attributes?.unit_of_measurement || ''));
}
