/** Pure frontend preflight/candidate for an authoritative backend space delete. */

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

/** Ids of routes this marker points at the space being deleted. */
const routesIntoSpace = (marker: any, spaceId: string): string[] =>
  (marker?.vacuum?.map_routes || [])
    .filter((route: any) => route && route.space === spaceId && typeof route.id === 'string')
    .map((route: any) => route.id);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function collectSpaceMarkerDependencies(
  config: any,
  layout: Record<string, any>,
  spaceId: string,
): SpaceDeletionDependencyReport {
  const space = (config?.spaces || []).find((item: any) => item?.id === spaceId);
  const roomIds = new Set(
    (space?.rooms || []).map((room: any) => String(room?.id || '')).filter(Boolean),
  );
  const markerIds = [...new Set<string>((config?.markers || [])
    .filter((marker: any) => marker?.removed !== true && typeof marker?.id === 'string')
    .filter((marker: any) => marker.space === spaceId
      || (typeof marker.room_id === 'string' && roomIds.has(marker.room_id))
      || layout?.[marker.id]?.s === spaceId)
    .map((marker: any) => marker.id))]
    .sort((a: string, b: string) => a.localeCompare(b));
  const routeMarkerIds = (config?.markers || [])
    .filter((marker: any) => marker?.removed !== true && typeof marker?.id === 'string')
    .filter((marker: any) => !markerIds.includes(marker.id))
    .filter((marker: any) => routesIntoSpace(marker, spaceId).length > 0)
    .map((marker: any) => marker.id)
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

export function createSpaceDeletionCandidate(
  configIn: any,
  layoutIn: Record<string, any>,
  spaceId: string,
): { config: any; layout: Record<string, any>; dependencies: SpaceDeletionDependencyReport } {
  const dependencies = collectSpaceMarkerDependencies(configIn, layoutIn, spaceId);
  const config = clone(configIn);
  const layout = clone(layoutIn || {});
  const spaces = config.spaces || [];
  const deletingLastSpace = spaces.length === 1 && spaces[0]?.id === spaceId;
  if (dependencies.count && !deletingLastSpace) return { config, layout, dependencies };

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
    if ((position as any)?.s === spaceId) delete layout[key];
  }
  // #162: a robot docked elsewhere keeps its dock and its other maps; only the
  // routes that pointed here go, in the same logical operation as the space.
  for (const marker of config.markers || []) {
    const routes = marker?.vacuum?.map_routes;
    if (!Array.isArray(routes)) continue;
    const kept = routes.filter((route: any) => route?.space !== spaceId);
    if (kept.length !== routes.length) marker.vacuum.map_routes = kept;
  }
  return { config, layout, dependencies };
}
