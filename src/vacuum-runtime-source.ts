/** Bind every live consumer to the exact source of one observed map route. */
import type { VacTelemetry } from './vacuum';
import {
  effectiveRoutes, observedMapIds, resolveRoute,
  type VacuumMapRoute, type VacuumRouteMarkerCfg, type VacuumRouteResolution,
} from './vacuum-routes';

export interface VacuumSourceObservation {
  mapId: string;
  /** A map-only source may still own a proven server path. */
  telemetry: VacTelemetry | null;
}

export interface VacuumRuntimeSource {
  source: string | null;
  mapId: string | null;
  telemetry: VacTelemetry | null;
  routes: VacuumMapRoute[];
  resolution: VacuumRouteResolution;
  unavailable: boolean;
}

/** read() admits only existing, enabled, available source states. Root remains
 * discovery/legacy evidence; it cannot supply coordinates for another route. */
export function resolveVacuumRuntimeSource(input: {
  markerId: string;
  marker: VacuumRouteMarkerCfg | null | undefined;
  dockSpace: string;
  rootSource: string | null;
  spaceIds: Set<string> | null;
  read: (source: string) => VacuumSourceObservation | undefined;
}): VacuumRuntimeSource {
  const routes = effectiveRoutes(input.markerId, input.marker, input.dockSpace, input.rootSource);
  const root = input.marker?.source || input.rootSource;
  const observations = new Map<string, VacuumSourceObservation>();
  const observed = observedMapIds(routes, [root], (source) => {
    const observation = input.read(source);
    if (!observation) return undefined;
    observations.set(source, observation);
    return observation.mapId;
  });
  const resolution = resolveRoute({ routes, observed, spaceIds: input.spaceIds });
  const explicit = Array.isArray(input.marker?.map_routes);
  const source = resolution.kind === 'ready' || resolution.kind === 'needs_calibration'
    ? resolution.route.source : !explicit && root && observations.has(root) ? root : null;
  const observation = source ? observations.get(source) : null;
  const expected = explicit ? routes.map((route) => route.source) : root ? [root] : [];
  return { source, mapId: observation?.mapId ?? null, telemetry: observation?.telemetry ?? null,
    routes, resolution, unavailable: expected.length > 0 && expected.every((id) => !observations.has(id)) };
}
