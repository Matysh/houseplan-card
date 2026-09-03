/**
 * Multi-floor vacuum: which map belongs to which space (#162).
 *
 * Until now one robot meant one space: the dock's `marker.space` decided both
 * where the dock icon sits and the only space where the overlay could ever be
 * rendered, while `marker.vacuum.calibration` was keyed by map id alone. A
 * robot with two maps therefore had nowhere to put the second floor.
 *
 * This module owns the whole map->space authority as pure functions, so the
 * card, the editor and the backend recorder all read the same rules instead of
 * each guessing a floor. Nothing here touches the DOM, `hass` or storage.
 */

import { FitParams, fitFromMatrix, initialFit, VacRoom } from './vacuum';

export type Affine = [number, number, number, number, number, number];

/** One saved answer to "this exact map of this exact source lives here". */
export interface VacuumMapRoute {
  id: string;
  source: string;
  map_id: string;
  space: string;
  calibration?: Affine | null;
}

export interface VacuumRouteMarkerCfg {
  source?: string | null;
  calibration?: Record<string, number[]> | null;
  map_routes?: VacuumMapRoute[] | null;
}

export const VAC_ROUTE_LIMIT = 32;
export const VAC_ROUTE_ID_MAX = 128;
export const VAC_ROUTE_SOURCE_MAX = 255;
export const VAC_ROUTE_MAP_ID_MAX = 255;
export const VAC_ROUTE_ERROR = 'invalid_vacuum_map_route';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Six finite numbers, or nothing. A five-number matrix is not "almost fine". */
export function normalizeRouteMatrix(raw: unknown): Affine | null {
  if (!Array.isArray(raw) || raw.length !== 6 || !raw.every(isFiniteNumber)) return null;
  return [raw[0], raw[1], raw[2], raw[3], raw[4], raw[5]] as Affine;
}

/** `domain.object_id` — the same shape the source picker already accepts. */
export function isEntityIdLike(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z_]+\.[a-zA-Z0-9_]+$/.test(value);
}

export interface RouteValidationIssue {
  code: typeof VAC_ROUTE_ERROR;
  markerId: string;
  routeId: string;
  reason:
    | 'not_object' | 'id' | 'duplicate_id' | 'source' | 'map_id' | 'space'
    | 'unknown_space' | 'duplicate_identity' | 'calibration' | 'limit';
}

const issue = (
  markerId: string, routeId: string, reason: RouteValidationIssue['reason'],
): RouteValidationIssue => ({ code: VAC_ROUTE_ERROR, markerId, routeId, reason });

/**
 * Shape/uniqueness/reference checks for one marker's routes.
 *
 * `spaceIds` null means "spaces are not known here" — the referential check is
 * then skipped instead of failing every route, because an import preview runs
 * before the target spaces exist.
 */
export function validateMarkerRoutes(
  markerId: string, routes: unknown, spaceIds: Set<string> | null,
): RouteValidationIssue[] {
  if (routes == null) return [];
  if (!Array.isArray(routes)) return [issue(markerId, '', 'not_object')];
  const problems: RouteValidationIssue[] = [];
  if (routes.length > VAC_ROUTE_LIMIT) problems.push(issue(markerId, '', 'limit'));
  const seenIds = new Set<string>();
  const seenIdentity = new Set<string>();
  for (const raw of routes) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      problems.push(issue(markerId, '', 'not_object'));
      continue;
    }
    const route = raw as Record<string, unknown>;
    const id = typeof route.id === 'string' ? route.id : '';
    if (!id || id.length > VAC_ROUTE_ID_MAX) { problems.push(issue(markerId, id, 'id')); continue; }
    if (seenIds.has(id)) problems.push(issue(markerId, id, 'duplicate_id'));
    seenIds.add(id);
    if (!isEntityIdLike(route.source) || (route.source as string).length > VAC_ROUTE_SOURCE_MAX) {
      problems.push(issue(markerId, id, 'source'));
    }
    // An empty map id is a real id (see vacMapIdFromAttrs): only the type and
    // the length are checked here.
    if (typeof route.map_id !== 'string' || route.map_id.length > VAC_ROUTE_MAP_ID_MAX) {
      problems.push(issue(markerId, id, 'map_id'));
    }
    if (typeof route.space !== 'string' || !route.space) {
      problems.push(issue(markerId, id, 'space'));
    } else if (spaceIds && !spaceIds.has(route.space)) {
      problems.push(issue(markerId, id, 'unknown_space'));
    }
    if (route.calibration != null && normalizeRouteMatrix(route.calibration) === null) {
      problems.push(issue(markerId, id, 'calibration'));
    }
    if (typeof route.source === 'string' && typeof route.map_id === 'string') {
      const identity = route.source + ' ' + route.map_id;
      if (seenIdentity.has(identity)) problems.push(issue(markerId, id, 'duplicate_identity'));
      seenIdentity.add(identity);
    }
  }
  return problems;
}

/** Deterministic id for a route that exists only as legacy calibration data. */
export function legacyRouteId(markerId: string, source: string, mapId: string): string {
  return 'legacy:' + markerId + ' ' + source + ' ' + mapId;
}

/**
 * The routes a marker effectively has right now.
 *
 * Legacy configs are read, never rewritten: every `calibration[map_id]` shows
 * up as a route into the dock space, so a plan that predates #162 keeps
 * rendering byte for byte until the user edits routing explicitly.
 */
export function effectiveRoutes(
  markerId: string,
  marker: VacuumRouteMarkerCfg | null | undefined,
  dockSpace: string,
  discoveredSource?: string | null,
): VacuumMapRoute[] {
  const explicit = marker?.map_routes;
  if (Array.isArray(explicit) && explicit.length) {
    return explicit
      .filter((route) => route && typeof route.id === 'string' && route.id)
      .map((route) => ({
        id: route.id,
        source: String(route.source ?? ''),
        map_id: String(route.map_id ?? ''),
        space: String(route.space ?? ''),
        calibration: normalizeRouteMatrix(route.calibration),
      }));
  }
  const source = (typeof marker?.source === 'string' && marker.source)
    ? marker.source
    : (discoveredSource || '');
  if (!source) return [];
  const calibration = marker?.calibration;
  if (!calibration || typeof calibration !== 'object') return [];
  const out: VacuumMapRoute[] = [];
  for (const mapId of Object.keys(calibration)) {
    const matrix = normalizeRouteMatrix(calibration[mapId]);
    if (!matrix) continue;
    out.push({
      id: legacyRouteId(markerId, source, mapId),
      source, map_id: mapId, space: dockSpace, calibration: matrix,
    });
  }
  return out;
}

export type VacuumRouteResolution =
  | { kind: 'ready'; route: VacuumMapRoute }
  | { kind: 'needs_calibration'; route: VacuumMapRoute }
  | { kind: 'unmapped'; source: string; mapId: string }
  | { kind: 'ambiguous'; routeIds: string[] }
  | { kind: 'missing_space'; route: VacuumMapRoute }
  | { kind: 'none' };

export interface RouteResolveInput {
  routes: VacuumMapRoute[];
  /** Observed map id per source, exactly as the map-id contract computes it. */
  observed: Map<string, string> | Record<string, string>;
  spaceIds: Set<string> | null;
}

const observedOf = (
  observed: RouteResolveInput['observed'], source: string,
): string | undefined => (
  observed instanceof Map ? observed.get(source) : observed?.[source]
);

/**
 * Pick the one route the robot is on right now — or refuse to pick.
 *
 * Order of the route list must never decide a floor: two plausible routes are
 * `ambiguous`, not "the first one". A guessed floor is worse than no robot,
 * because the plan stops being a statement of fact.
 */
export function resolveRoute(input: RouteResolveInput): VacuumRouteResolution {
  const matched: VacuumMapRoute[] = [];
  let sawTelemetry = false;
  let fallbackSource = '';
  let fallbackMapId = '';
  for (const route of input.routes) {
    const observed = observedOf(input.observed, route.source);
    if (observed === undefined) continue;
    sawTelemetry = true;
    if (!fallbackSource) { fallbackSource = route.source; fallbackMapId = observed; }
    if (observed === route.map_id) matched.push(route);
  }
  if (matched.length > 1) {
    return { kind: 'ambiguous', routeIds: matched.map((route) => route.id).sort() };
  }
  if (matched.length === 1) {
    const route = matched[0];
    if (input.spaceIds && !input.spaceIds.has(route.space)) return { kind: 'missing_space', route };
    const matrix = normalizeRouteMatrix(route.calibration);
    return matrix ? { kind: 'ready', route: { ...route, calibration: matrix } }
      : { kind: 'needs_calibration', route };
  }
  if (sawTelemetry) return { kind: 'unmapped', source: fallbackSource, mapId: fallbackMapId };
  const entries = input.observed instanceof Map
    ? [...input.observed.entries()]
    : Object.entries(input.observed || {});
  if (entries.length) {
    const pick = entries.slice().sort((a, b) => a[0].localeCompare(b[0]))[0];
    return { kind: 'unmapped', source: pick[0], mapId: pick[1] };
  }
  return { kind: 'none' };
}

export type LegacyRunAdoption =
  | { kind: 'adopted'; route: VacuumMapRoute }
  | { kind: 'orphan_run' }
  | { kind: 'ambiguous_run'; routeIds: string[] };

/**
 * Where a run recorded before #162 belongs (spec 11.3.1).
 *
 * Such a run stores only `{map_id, started, ended, points}` — it carries no
 * source at all. The one surviving witness of the subscription that wrote it
 * is the marker's root `vacuum.source`, so that is what narrows the
 * candidates; when the root source is gone, there is no second witness and
 * only the map id is compared. Two candidates mean the run is not drawn, not
 * that the first one wins.
 */
export function adoptLegacyRun(
  run: { map_id?: unknown; route_id?: unknown } | null | undefined,
  routes: VacuumMapRoute[],
  rootSource: string | null | undefined,
): LegacyRunAdoption {
  if (!run || typeof run.map_id !== 'string') return { kind: 'orphan_run' };
  const mapId = run.map_id;
  const root = typeof rootSource === 'string' ? rootSource : '';
  let candidates = routes.filter((route) => route.map_id === mapId);
  if (root) candidates = candidates.filter((route) => route.source === root);
  if (candidates.length === 1) return { kind: 'adopted', route: candidates[0] };
  if (candidates.length === 0) return { kind: 'orphan_run' };
  return { kind: 'ambiguous_run', routeIds: candidates.map((route) => route.id).sort() };
}

/** Every source worth reading telemetry from, routes plus discovery. */
export function observedMapIds(
  routes: VacuumMapRoute[],
  extraSources: Array<string | null | undefined>,
  read: (source: string) => string | undefined,
): Record<string, string> {
  const sources = new Set<string>();
  for (const route of routes) if (route.source) sources.add(route.source);
  for (const extra of extraSources) if (extra) sources.add(extra);
  const observed: Record<string, string> = {};
  for (const source of [...sources].sort()) {
    const mapId = read(source);
    if (mapId !== undefined) observed[source] = mapId;
  }
  return observed;
}

/** The route a stored run belongs to: its own id first, adoption for old data. */
export function runRoute(
  run: { map_id?: unknown; route_id?: unknown } | null | undefined,
  routes: VacuumMapRoute[],
  rootSource: string | null | undefined,
): VacuumMapRoute | null {
  if (!run) return null;
  const routeId = typeof run.route_id === 'string' ? run.route_id : '';
  if (routeId) return routes.find((route) => route.id === routeId) || null;
  const adopted = adoptLegacyRun(run, routes, rootSource);
  return adopted.kind === 'adopted' ? adopted.route : null;
}

export interface VacuumOverlayInput {
  resolution: VacuumRouteResolution;
  routes: VacuumMapRoute[];
  /** The space being drawn right now — not the dock's space. */
  renderSpace: string;
  rootSource?: string | null;
  serverCurrent?: { map_id?: unknown; route_id?: unknown } | null;
  serverPrevious?: { map_id?: unknown; route_id?: unknown } | null;
  /** False for a config that still has only legacy `calibration` (see below). */
  explicitRoutes: boolean;
}

export interface VacuumOverlayPlan {
  /** Matrix for the live puck and the current trail here, or null. */
  live: Affine | null;
  /** Whether the stored current run belongs to the route being drawn. */
  currentRunMatches: boolean;
  /** Matrix for the previous run here, or null. */
  previous: Affine | null;
}

/**
 * What, if anything, this robot draws in the space currently on screen.
 *
 * The dock never moves: it stays in `marker.space` and is drawn by the
 * ordinary device path. Everything live belongs to the active route's space
 * instead, which is what lets floor 2 show the robot while the dock stays on
 * floor 1.
 *
 * The previous run belongs to the space of its own route, so it keeps showing
 * where the robot has been after it moved to another map. Legacy configs
 * (`explicitRoutes: false`) keep the older, narrower rule — previous run only
 * for the map that is active now — because until the user edits routing at
 * all, #162 promises the picture does not change.
 */
export function planVacuumOverlay(input: VacuumOverlayInput): VacuumOverlayPlan {
  const active = input.resolution.kind === 'ready' ? input.resolution.route : null;
  const live = active && active.space === input.renderSpace
    ? normalizeRouteMatrix(active.calibration) : null;
  const currentRoute = runRoute(input.serverCurrent, input.routes, input.rootSource);
  const currentRunMatches = !!active && !!currentRoute && currentRoute.id === active.id;
  const previousRoute = runRoute(input.serverPrevious, input.routes, input.rootSource);
  const previousAllowed = !!previousRoute
    && previousRoute.space === input.renderSpace
    && (input.explicitRoutes || (!!active && previousRoute.id === active.id));
  const previous = previousAllowed ? normalizeRouteMatrix(previousRoute!.calibration) : null;
  return { live, currentRunMatches, previous };
}
