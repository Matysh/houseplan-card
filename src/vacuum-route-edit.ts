/**
 * Editor-only half of vacuum map routing (#162).
 *
 * Adding, re-targeting and deleting routes only ever happens in the device
 * editor, so these helpers live in the lazy editor graph: the View card must
 * not pay for code it can never run (docs/ARCHITECTURE.md, #367).
 */
import type { Marker } from './types';
import { FitParams, fitFromMatrix, initialFit, VacRoom } from './vacuum';

/** The marker's vacuum block exactly as the config stores it. */
export type MarkerVacuumCfg = NonNullable<Marker['vacuum']>;
import {
  Affine, VacuumMapRoute, VacuumRouteMarkerCfg, effectiveRoutes, normalizeRouteMatrix,
} from './vacuum-routes';

/** A route which exists only in the editor until a real space is confirmed. */
export interface VacuumRouteDraft {
  markerId: string;
  source: string;
  mapId: string;
  space: string;
}

/**
 * Begin the add-route transaction without creating an invalid persisted row.
 * Only the very first route may inherit the dock floor; every later map must
 * be assigned explicitly by the user (#162 §9.2, #441).
 */
export function beginVacuumRouteDraft(
  markerId: string, routes: readonly VacuumMapRoute[], dockSpace: string,
  source: string, mapId: string,
): VacuumRouteDraft {
  return { markerId, source, mapId, space: routes.length ? '' : dockSpace };
}

/** Unknown/deleted spaces are represented as no selection, never persisted. */
export function chooseVacuumRouteSpace(
  draft: VacuumRouteDraft, space: string, spaceIds: ReadonlySet<string>,
): VacuumRouteDraft {
  return { ...draft, space: spaceIds.has(space) ? space : '' };
}

/** Materialise exactly one valid route, or refuse to produce a candidate. */
export function commitVacuumRouteDraft(
  routes: VacuumMapRoute[], draft: VacuumRouteDraft,
  spaceIds: ReadonlySet<string>, id: string,
): VacuumMapRoute[] | null {
  if (!draft.source || !spaceIds.has(draft.space)
      || routes.some((route) => route.source === draft.source && route.map_id === draft.mapId)) {
    return null;
  }
  return addRoute(routes, {
    source: draft.source, map_id: draft.mapId, space: draft.space,
  }, id);
}

/** A marker-local id that no existing route uses. */
export function newRouteId(existing: Iterable<string>, seed: () => number = Math.random): string {
  const taken = new Set(existing);
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const id = 'vr_' + Math.floor(seed() * 0xffffff).toString(36).padStart(5, '0');
    if (!taken.has(id)) return id;
  }
  return 'vr_' + Date.now().toString(36);
}

export function addRoute(
  routes: VacuumMapRoute[], route: Omit<VacuumMapRoute, 'id'>, id: string,
): VacuumMapRoute[] {
  return [...routes, { ...route, id, calibration: route.calibration ?? null }];
}

export function removeRoute(routes: VacuumMapRoute[], routeId: string): VacuumMapRoute[] {
  return routes.filter((route) => route.id !== routeId);
}

/**
 * Re-target a route to another space.
 *
 * A new space is a NEW identity, not an edited one: the calibration was solved
 * against the old space's geometry and the recorded runs were filed under the
 * old id, so both must go rather than silently apply to a different floor.
 */
export function changeRouteSpace(
  routes: VacuumMapRoute[], routeId: string, space: string, newId: string,
): VacuumMapRoute[] {
  return routes.map((route) => (route.id === routeId
    ? { ...route, id: newId, space, calibration: null } : route));
}

export function saveRouteCalibration(
  routes: VacuumMapRoute[], routeId: string, matrix: Affine,
): VacuumMapRoute[] {
  return routes.map((route) => (route.id === routeId ? { ...route, calibration: matrix } : route));
}

/**
 * Turn a legacy `calibration` dictionary into explicit routes — all of it.
 *
 * Converting only the map the user happens to be looking at would drop the
 * other floors' calibrations on the first routing edit, so this is all or
 * nothing: without an exact source there is no conversion at all and the
 * caller must ask for one first (spec 7.3).
 */
export function convertLegacyRoutes(
  marker: VacuumRouteMarkerCfg | null | undefined,
  dockSpace: string,
  source: string,
  nextId: (taken: Set<string>) => string,
): VacuumMapRoute[] | null {
  if (!source) return null;
  const calibration = marker?.calibration;
  if (!calibration || typeof calibration !== 'object') return null;
  const taken = new Set<string>();
  const routes: VacuumMapRoute[] = [];
  for (const mapId of Object.keys(calibration)) {
    const matrix = normalizeRouteMatrix(calibration[mapId]);
    if (!matrix) continue;
    const id = nextId(taken);
    taken.add(id);
    routes.push({ id, source, map_id: mapId, space: dockSpace, calibration: matrix });
  }
  return routes.length ? routes : null;
}

/**
 * Where a solved matrix belongs.
 *
 * With explicit routes the matrix is the route's own property; an unmapped map
 * still falls back to the Stage 1 dictionary, because refusing to save a
 * calibration the user just solved would lose real work over bookkeeping.
 */
export function writeVacuumMatrix(
  vacuum: MarkerVacuumCfg | null | undefined,
  opts: { source: string; mapId: string; routeId?: string; matrix: Affine },
): MarkerVacuumCfg {
  const rounded = opts.matrix.map((n) => Number(n.toFixed(6))) as Affine;
  const routes = vacuum?.map_routes;
  if (Array.isArray(routes) && routes.length) {
    const target = routes.find((route) => route.id === opts.routeId)
      || routes.find((route) => route.source === opts.source && route.map_id === opts.mapId);
    if (target) {
      return { ...vacuum, map_routes: saveRouteCalibration(routes, target.id, rounded) };
    }
  }
  return {
    ...vacuum,
    source: opts.source,
    calibration: { ...(vacuum?.calibration || {}), [opts.mapId]: rounded },
  };
}

export interface VacuumFitPlan {
  space: string;
  routeId: string;
  params: FitParams;
}

/**
 * Which space the manual fit canvas opens on, and from which matrix.
 *
 * Calibration is solved against the geometry of the space the map is assigned
 * to — not the dock's space, which is where a multi-floor robot's fit used to
 * land regardless of the map on screen (#162).
 */
export function planVacuumFit(
  markerId: string,
  vacuum: MarkerVacuumCfg | null | undefined,
  opts: {
    routeId?: string; source: string; mapId: string; dockSpace: string; rooms: VacRoom[];
    viewBoxOf: (spaceId: string) => [number, number, number, number] | null;
  },
): VacuumFitPlan | null {
  const routes = effectiveRoutes(markerId, vacuum, opts.dockSpace, opts.source);
  const route = routes.find((item) => item.id === opts.routeId)
    || routes.find((item) => item.source === opts.source && item.map_id === opts.mapId)
    || null;
  const space = route?.space || opts.dockSpace;
  const viewBox = opts.viewBoxOf(space);
  if (!viewBox) return null;
  const stored = normalizeRouteMatrix(route ? route.calibration : vacuum?.calibration?.[opts.mapId]);
  const params = (stored && fitFromMatrix(stored)) || initialFit(opts.rooms, viewBox);
  return { space, routeId: route?.id || '', params };
}

/**
 * Which space a calibration is solved against, and which route stores it.
 *
 * Auto-calibration used to match the robot's rooms against the DOCK's rooms,
 * whatever map was on screen — for a multi-floor robot that is the wrong floor
 * half the time (#162, AC8).
 */
export function calibrationTarget(
  markerId: string,
  vacuum: MarkerVacuumCfg | null | undefined,
  dockSpace: string,
  source: string,
  mapId: string,
): { space: string; routeId: string } {
  const route = effectiveRoutes(markerId, vacuum, dockSpace, source)
    .find((item) => item.source === source && item.map_id === mapId);
  return { space: route?.space || dockSpace, routeId: route?.id || '' };
}
