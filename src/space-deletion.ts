/** Pure frontend preflight/candidate for an authoritative backend space delete. */

export interface SpaceDeletionDependencyReport {
  markerIds: string[];
  count: number;
}

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
  return { markerIds, count: markerIds.length };
}

export function createSpaceDeletionCandidate(
  configIn: any,
  layoutIn: Record<string, any>,
  spaceId: string,
): { config: any; layout: Record<string, any>; dependencies: SpaceDeletionDependencyReport } {
  const dependencies = collectSpaceMarkerDependencies(configIn, layoutIn, spaceId);
  const config = clone(configIn);
  const layout = clone(layoutIn || {});
  if (dependencies.count) return { config, layout, dependencies };

  const space = (config.spaces || []).find((item: any) => item?.id === spaceId);
  const roomIds = new Set(
    (space?.rooms || []).map((room: any) => String(room?.id || '')).filter(Boolean),
  );
  config.spaces = (config.spaces || []).filter((item: any) => item?.id !== spaceId);
  for (const marker of config.markers || []) {
    if (marker?.removed !== true) continue;
    if (marker.space === spaceId) delete marker.space;
    if (typeof marker.room_id === 'string' && roomIds.has(marker.room_id)) delete marker.room_id;
  }
  for (const [key, position] of Object.entries(layout)) {
    if ((position as any)?.s === spaceId) delete layout[key];
  }
  return { config, layout, dependencies };
}
