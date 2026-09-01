import { pointStrictlyInside } from './logic';
import type {
  DevItem, Marker, MarkerAreaBinding, MarkerAreaSnapshot,
  RoomCfg, SpaceModel,
} from './types';

export type { MarkerAreaBinding, MarkerAreaSnapshot } from './types';

export const MARKER_AREA_SNAPSHOT_LIMIT = 20_000;

export interface AreaRelocationLayoutEntry {
  s?: string;
  x: number;
  y: number;
}

export type AreaRelocationLayout = Record<string, AreaRelocationLayoutEntry | undefined>;

export type AreaRelocationReason =
  | 'unchanged'
  | 'new-without-layout'
  | 'backfill-same-room'
  | 'backfill-stale-room'
  | 'backfill-cross-space'
  | 'backfill-ambiguous'
  | 'area-changed'
  | 'target-unresolved'
  | 'registry-unverified';

export interface AreaRelocationDecision {
  id: string;
  binding: MarkerAreaBinding | null;
  area: string | null;
  relocate: boolean;
  updateSnapshot: boolean;
  removeSnapshot: boolean;
  reason: AreaRelocationReason;
}

export interface AreaRelocationResolution {
  decisions: AreaRelocationDecision[];
  relocateIds: Set<string>;
}

export interface ResolveAreaRelocationsOptions {
  devices: readonly DevItem[];
  model: readonly SpaceModel[];
  layout: AreaRelocationLayout;
  snapshot: unknown;
  authoritative: boolean;
  /** Stored layout coordinates are normalised; model room coordinates are render units. */
  coordinateScale?: number;
}

const validText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 500;

function validBinding(value: unknown): value is MarkerAreaBinding {
  return validText(value) && (value.startsWith('device:') || value.startsWith('entity:'))
    && value.indexOf(':') < value.length - 1;
}

/** Defensive read boundary for old/foreign config that bypassed backend validation. */
export function markerAreaSnapshotOf(value: unknown): MarkerAreaSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: MarkerAreaSnapshot = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)
    .slice(-MARKER_AREA_SNAPSHOT_LIMIT)) {
    if (!validText(id) || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const binding = (raw as { binding?: unknown }).binding;
    const area = (raw as { area?: unknown }).area;
    if (validBinding(binding) && validText(area)) result[id] = { binding, area };
  }
  return result;
}

/** Remove lifecycle metadata together with markers that no longer exist. */
export function removeMarkerAreaSnapshots(
  value: unknown, markerIds: Iterable<string>,
): MarkerAreaSnapshot {
  const next = markerAreaSnapshotOf(value);
  for (const markerId of markerIds) delete next[markerId];
  return next;
}

function explicitPlacement(marker: Marker | undefined): boolean {
  if (!marker) return false;
  if (typeof marker.area === 'string' && marker.area.length > 0) return true;
  return marker.area === null
    && typeof marker.space === 'string' && marker.space.length > 0
    && typeof marker.room_id === 'string' && marker.room_id.length > 0;
}

/** Exact registry binding eligible for automatic Area following. */
export function registryFollowingBinding(device: DevItem): MarkerAreaBinding | null {
  if (device.virtual || device.bindingStatus?.kind === 'unverified') return null;
  if ((device.bindingKind !== 'device' && device.bindingKind !== 'entity')
      || !validText(device.bindingRef)) return null;
  const binding = `${device.bindingKind}:${device.bindingRef}` as MarkerAreaBinding;
  const marker = device.marker;
  if (marker?.removed || explicitPlacement(marker)) return null;
  if (marker && marker.binding !== binding) return null;
  // Markerless entity items are automatic/composite light groups. Direct
  // standalone entities always have a persisted marker with the exact binding.
  if (device.bindingKind === 'entity' && !marker) return null;
  return binding;
}

function roomPolygon(room: RoomCfg): number[][] | null {
  if (Array.isArray(room.poly) && room.poly.length >= 3) return room.poly;
  const { x, y, w, h } = room;
  if (![x, y, w, h].every(Number.isFinite) || Number(w) <= 0 || Number(h) <= 0) return null;
  return [[x!, y!], [x! + w!, y!], [x! + w!, y! + h!], [x!, y! + h!]];
}

function containingRooms(
  space: SpaceModel, point: number[],
): RoomCfg[] {
  return space.rooms.filter((room) => {
    const polygon = roomPolygon(room);
    return !!polygon && pointStrictlyInside(point, polygon);
  });
}

function unresolved(id: string, reason: AreaRelocationReason): AreaRelocationDecision {
  return {
    id, binding: null, area: null, relocate: false,
    updateSnapshot: false, removeSnapshot: false, reason,
  };
}

/**
 * Resolve registry Area transitions once per authoritative device/model rebuild.
 * The function has no stores, DOM, HA calls or writes and is shared by both
 * interactive and Hosted Static placement projections.
 */
export function resolveDeviceAreaRelocations(
  options: ResolveAreaRelocationsOptions,
): AreaRelocationResolution {
  const decisions: AreaRelocationDecision[] = [];
  const relocateIds = new Set<string>();
  if (!options.authoritative) return { decisions, relocateIds };

  const snapshot = markerAreaSnapshotOf(options.snapshot);
  const liveIds = new Set<string>();
  const liveBindings = new Set<MarkerAreaBinding>();
  for (const device of options.devices) {
    if (validText(device.id)) liveIds.add(device.id);
    if (validText(device.marker?.id)) liveIds.add(device.marker.id);
    if ((device.bindingKind === 'device' || device.bindingKind === 'entity')
        && validText(device.bindingRef)) {
      liveBindings.add(`${device.bindingKind}:${device.bindingRef}`);
    }
    if (validBinding(device.marker?.binding)) liveBindings.add(device.marker.binding);
  }
  for (const [id, entry] of Object.entries(snapshot)) {
    if (!liveIds.has(id) && !liveBindings.has(entry.binding)) decisions.push({
      ...unresolved(id, 'registry-unverified'), removeSnapshot: true,
    });
  }
  const scale = Number.isFinite(options.coordinateScale) && Number(options.coordinateScale) > 0
    ? Number(options.coordinateScale) : 1000;
  const targets = new Map<string, Array<{ space: SpaceModel; room: RoomCfg }>>();
  for (const space of options.model) for (const room of space.rooms) {
    if (!room.area) continue;
    const entries = targets.get(room.area) || [];
    entries.push({ space, room });
    targets.set(room.area, entries);
  }

  for (const device of options.devices) {
    const previous = snapshot[device.id];
    const binding = registryFollowingBinding(device);
    if (!binding) {
      if (previous) decisions.push({
        ...unresolved(device.id, 'registry-unverified'), removeSnapshot: true,
      });
      continue;
    }
    const area = validText(device.area) ? device.area : null;
    if (!area) {
      decisions.push({
        id: device.id, binding, area: null, relocate: false,
        updateSnapshot: false, removeSnapshot: false, reason: 'registry-unverified',
      });
      continue;
    }
    const target = targets.get(area);
    if (!target || target.length !== 1) {
      decisions.push({
        id: device.id, binding, area, relocate: false,
        updateSnapshot: false, removeSnapshot: false, reason: 'target-unresolved',
      });
      continue;
    }

    if (previous?.binding === binding) {
      const relocate = previous.area !== area;
      if (relocate) relocateIds.add(device.id);
      decisions.push({
        id: device.id, binding, area, relocate, updateSnapshot: relocate,
        removeSnapshot: false, reason: relocate ? 'area-changed' : 'unchanged',
      });
      continue;
    }

    const saved = options.layout[device.id];
    if (!saved) {
      decisions.push({
        id: device.id, binding, area, relocate: false, updateSnapshot: true,
        removeSnapshot: false, reason: 'new-without-layout',
      });
      continue;
    }
    const [{ space: targetSpace, room: targetRoom }] = target;
    if (saved.s && saved.s !== targetSpace.id) {
      relocateIds.add(device.id);
      decisions.push({
        id: device.id, binding, area, relocate: true, updateSnapshot: true,
        removeSnapshot: false, reason: 'backfill-cross-space',
      });
      continue;
    }
    if (saved.s !== targetSpace.id || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) {
      decisions.push({
        id: device.id, binding, area, relocate: false, updateSnapshot: true,
        removeSnapshot: false, reason: 'backfill-ambiguous',
      });
      continue;
    }
    const rooms = containingRooms(targetSpace, [saved.x * scale, saved.y * scale]);
    const source = rooms.length === 1 ? rooms[0] : null;
    const sameRoom = source === targetRoom
      || (!!source?.id && !!targetRoom.id && source.id === targetRoom.id);
    const staleRoom = !!source?.area && source.area !== area;
    const relocate = !sameRoom && staleRoom;
    if (relocate) relocateIds.add(device.id);
    decisions.push({
      id: device.id, binding, area, relocate, updateSnapshot: true,
      removeSnapshot: false,
      reason: relocate ? 'backfill-stale-room'
        : sameRoom ? 'backfill-same-room' : 'backfill-ambiguous',
    });
  }
  return { decisions, relocateIds };
}

/** Apply baseline/cleanup decisions and only the relocations whose delete committed. */
export function applyAreaRelocationResolution(
  value: unknown,
  resolution: AreaRelocationResolution,
  committedRelocations: ReadonlySet<string> = new Set(),
): MarkerAreaSnapshot {
  const next = markerAreaSnapshotOf(value);
  for (const decision of resolution.decisions) {
    if (decision.removeSnapshot) {
      delete next[decision.id];
      continue;
    }
    if (!decision.updateSnapshot || !decision.binding || !decision.area) continue;
    if (decision.relocate && !committedRelocations.has(decision.id)) continue;
    next[decision.id] = { binding: decision.binding, area: decision.area };
  }
  return next;
}
