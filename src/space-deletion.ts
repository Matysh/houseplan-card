/** Pure frontend preflight/candidate for an authoritative backend space delete. */
import { removeMarkerAreaSnapshots } from './device-area-relocation';
import { deletePlanMarkerRecords, removeMarkerControlReferences } from './devices';
import type { LedStripModel, Marker } from './types';

export interface SpaceDeletionDependencyReport {
  markerIds: string[];
  count: number;
  /**
   * Markers that live on ANOTHER floor but route one of their robot maps here
   * (#162). They do not block the deletion — the dock is not in this space —
   * but the user has to be told how many map assignments disappear with it.
   */
  routeMarkerIds: string[];
  routeCount: number;
}

/** Just enough of a marker to answer "does it route a map into this space?". */
interface RouteCarrier {
  id?: unknown;
  space?: unknown;
  room_id?: unknown;
  removed?: unknown;
  vacuum?: { map_routes?: Array<{ id?: unknown; space?: unknown }> | null } | null;
}

/** Ids of routes this marker points at the space being deleted. */
const routesIntoSpace = (marker: RouteCarrier, spaceId: string): string[] =>
  (marker?.vacuum?.map_routes || [])
    .filter((route) => route && route.space === spaceId && typeof route.id === 'string')
    .map((route) => String(route.id));

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function collectSpaceMarkerDependencies(
  config: any,
  layout: Record<string, any>,
  spaceId: string,
): SpaceDeletionDependencyReport {
  const space = (config?.spaces || []).find((item: any) => item?.id === spaceId);
  const roomIds = new Set(
    (space?.rooms || []).map((room: { id?: unknown }) => String(room?.id || '')).filter(Boolean),
  );
  const markerIds = [...new Set<string>((config?.markers || [])
    .filter((marker: RouteCarrier) => marker?.removed !== true && typeof marker?.id === 'string')
    .filter((marker: RouteCarrier) => marker.space === spaceId
      || (typeof marker.room_id === 'string' && roomIds.has(marker.room_id))
      || layout?.[String(marker.id)]?.s === spaceId)
    .map((marker: RouteCarrier) => String(marker.id)))]
    .sort((a: string, b: string) => a.localeCompare(b));
  const routeMarkerIds = (config?.markers || [] as RouteCarrier[])
    .filter((marker: RouteCarrier) => marker?.removed !== true && typeof marker?.id === 'string')
    .filter((marker: RouteCarrier) => !markerIds.includes(String(marker.id)))
    .filter((marker: RouteCarrier) => routesIntoSpace(marker, spaceId).length > 0)
    .map((marker: RouteCarrier) => String(marker.id))
    .sort((a: string, b: string) => a.localeCompare(b));
  return {
    markerIds, count: markerIds.length,
    routeMarkerIds, routeCount: routeMarkerIds.length,
  };
}

/**
 * Confirm text for a space delete: the base warning, plus how many robot map
 * assignments go with it (#162). Composed here so the count cannot quietly
 * fall out of the dialog when the wording changes.
 */
export function spaceDeletionMessage(
  base: string, routesTemplate: string, routeCount: number,
): string {
  return routeCount ? `${base} ${routesTemplate.replace('{count}', String(routeCount))}` : base;
}

/** #819: how many of the blocking markers are hidden — the confirmation names them apart. */
export const hiddenDependencyCount = (
  config: { markers?: readonly Pick<Marker, 'id' | 'removed' | 'hidden'>[] | null } | null | undefined,
  markerIds: readonly string[],
): number => new Set((config?.markers || [])
  .filter((marker) => marker?.removed !== true && marker?.hidden === true && markerIds.includes(marker.id))
  .map((marker) => marker.id)).size;

/** The part of a configuration the #819 mirror touches; the rest passes through. */
interface MarkerDeletionConfig {
  spaces?: ({ led_strips?: (Pick<LedStripModel, 'marker' | 'active'> | null)[] | null } | null)[];
  markers?: Marker[];
  settings?: { marker_area_snapshot?: unknown } | null;
}

/**
 * #819: the device dialog's «Delete» for every id, on one candidate — mirror
 * of `_delete_plan_markers` (websocket_api.py), pinned on both sides by
 * test/fixtures/space-delete-with-markers.json. The server does this inside
 * `houseplan/space/delete`; here it only proves the two agree.
 */
export function deletePlanMarkers(
  config: MarkerDeletionConfig, layout: Record<string, unknown>, markerIds: readonly string[],
): string[] {
  const dropped = new Set<string>();
  for (const id of [...markerIds].sort()) {
    const markers = config.markers || [];
    const target = markers.find((marker) => marker?.id === id && marker.removed !== true);
    if (!target) continue;
    const deletion = deletePlanMarkerRecords(markers, id, target.binding, target.binding === 'virtual');
    config.markers = deletion.markers;
    for (const removed of deletion.cleanupIds) dropped.add(removed);
  }
  if (!dropped.size) return [];
  config.markers = removeMarkerControlReferences(config.markers || [], dropped);
  for (const space of config.spaces || []) {
    for (const strip of space?.led_strips || []) {
      if (strip?.marker && dropped.has(strip.marker)) Object.assign(strip, { marker: null, active: true });
    }
  }
  if (config.settings?.marker_area_snapshot) {
    config.settings.marker_area_snapshot = removeMarkerAreaSnapshots(config.settings.marker_area_snapshot, dropped);
  }
  for (const id of dropped) delete layout[id];
  return [...dropped].sort();
}

export function createSpaceDeletionCandidate(
  configIn: any,
  layoutIn: Record<string, any>,
  spaceId: string,
  removeMarkers = false,
): {
  config: any; layout: Record<string, any>; // any-ok: #244 raw stored JSON in and out, as configIn; #819 adds only removedMarkers
  dependencies: SpaceDeletionDependencyReport; removedMarkers: string[];
} {
  const config = clone(configIn);
  const layout = clone(layoutIn || {});
  const spaces = config.spaces || [];
  const deletingLastSpace = spaces.length === 1 && spaces[0]?.id === spaceId;
  // #819: the markers go first (never the last space's — it detaches them),
  // and the #244 rule below then finds nothing in use.
  const removedMarkers = removeMarkers && !deletingLastSpace
    ? deletePlanMarkers(config, layout, collectSpaceMarkerDependencies(config, layout, spaceId).markerIds)
    : [];
  const dependencies = collectSpaceMarkerDependencies(config, layout, spaceId);
  if (dependencies.count && !deletingLastSpace) return { config, layout, dependencies, removedMarkers };

  const space = (config.spaces || []).find((item: any) => item?.id === spaceId);
  const roomIds = new Set(
    (space?.rooms || []).map((room: any) => String(room?.id || '')).filter(Boolean),
  );
  config.spaces = (config.spaces || []).filter((item: any) => item?.id !== spaceId);
  for (const marker of config.markers || []) {
    const markerOwnsPosition = typeof marker?.id === 'string'
      && layout?.[marker.id]?.s === spaceId;
    const referencesDeletedSpace = marker?.space === spaceId
      || (typeof marker?.room_id === 'string' && roomIds.has(marker.room_id))
      || markerOwnsPosition;
    if (deletingLastSpace && referencesDeletedSpace) {
      delete marker.space;
      delete marker.room_id;
      continue;
    }
    if (marker?.removed !== true) continue;
    if (marker.space === spaceId) delete marker.space;
    if (typeof marker.room_id === 'string' && roomIds.has(marker.room_id)) delete marker.room_id;
  }
  for (const [key, position] of Object.entries(layout)) {
    if ((position as { s?: unknown } | null)?.s === spaceId) delete layout[key];
  }
  // #162: a robot docked elsewhere keeps its dock and its other maps; only the
  // routes that pointed here go, in the same logical operation as the space.
  for (const marker of (config.markers || []) as RouteCarrier[]) {
    const routes = marker?.vacuum?.map_routes;
    if (!Array.isArray(routes) || !marker.vacuum) continue;
    const kept = routes.filter((route) => route?.space !== spaceId);
    if (kept.length !== routes.length) marker.vacuum.map_routes = kept;
  }
  return { config, layout, dependencies, removedMarkers };
}
