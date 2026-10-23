/** Read-only path diagnostics, separate from the card and editor monoliths. */
import type { HouseplanEditorHostPort } from './houseplan-editor-runtime';
import type { DevItem } from './types';
import type { I18nKey } from './i18n';
import { displayIsNeutral, normalizeDeviceDisplay } from './logic';
import { vacTrailMode, type VacPath } from './vacuum';
import { planVacuumOverlay, type VacuumRouteResolution } from './vacuum-routes';
import { VAC_RENDER_POINT_BUDGET } from './vacuum-path-geometry';
import { currentVacuumTrailFrame, selectVacuumTrail } from './vacuum-trail-material';

export interface VacuumTrailDiagnostic {
  source: string; reason: string; raw: number; stored: number; rendered: number;
  receivedAt?: number; final: boolean; display: I18nKey;
}
type Host = Pick<HouseplanEditorHostPort, '_vacSrvTrails' | '_vacTrailFormat'
  | '_devices' | '_isVacDev' | '_vacRuntimeSource'
  | '_space' | '_vacGeometryCache' | '_cellCm' | '_gridPitch'> & {
    readonly _vacRt: ReadonlyMap<string, { moving: boolean; material: VacPath }>;
  };

function routeDisplayReason(resolution: VacuumRouteResolution, unavailable: boolean): I18nKey | null {
  switch (resolution.kind) {
    case 'ready': return null;
    case 'needs_calibration': return 'vac.route_warn_needs_calibration';
    case 'ambiguous': return 'vac.route_warn_ambiguous';
    case 'missing_space': return 'vac.route_warn_missing_space';
    default: return unavailable ? 'vac.source_status_unavailable' : 'vac.trail_display_route';
  }
}

function modeDisplayReason(host: Host, device: DevItem, moving: boolean): I18nKey | null {
  const mode = vacTrailMode(device.marker?.vacuum);
  if (device.hidden || !host._isVacDev(device) || device.marker?.vacuum?.live === false
    || displayIsNeutral(normalizeDeviceDisplay(device.marker?.display)) || mode === 'never') {
    return 'vac.trail_display_mode';
  }
  return mode === 'cleaning' && !moving ? 'vac.trail_display_stopped' : null;
}

function initialDiagnostic(
  host: Host, device: DevItem, selected: ReturnType<Host['_vacRuntimeSource']>,
): VacuumTrailDiagnostic {
  const run = host._vacSrvTrails[device.id]?.current;
  const chosen = selectVacuumTrail(selected.telemetry, run ?? null, host._vacRt.get(device.id)?.material ?? [], host._vacTrailFormat);
  const raw = run?.quality?.raw_points ?? chosen.path.reduce((n, p) => n + p.length, 0);
  const stored = run?.quality?.stored_points ?? chosen.path.reduce((n, p) => n + p.length, 0);
  const targetMoving = host._vacRt.get(device.id)?.moving ?? false;
  const display: I18nKey = modeDisplayReason(host, device, targetMoving)
    ?? routeDisplayReason(selected.resolution, selected.unavailable)
    ?? (selected.resolution.kind === 'ready' && selected.resolution.route.space !== host._space
      ? 'vac.trail_display_space' : 'vac.path_none');
  return { source: chosen.source, reason: chosen.reason, raw, stored, rendered: 0,
    display, receivedAt: run?.received_at, final: run?.final_status === 'confirmed' };
}

/** One traversal for a support snapshot of several robots, not N² UI calls. */
export function diagnoseVacuumTrails(host: Host): Map<string, VacuumTrailDiagnostic> {
  const results = new Map<string, VacuumTrailDiagnostic>();
  let budget = VAC_RENDER_POINT_BUDGET;
  // Same current-before-previous / roster order and space quota as View.
  for (const d of host._devices) {
    if (!host._isVacDev(d)) continue;
    const runtime = host._vacRuntimeSource(d);
    const result = initialDiagnostic(host, d, runtime);
    results.set(d.id, result);
    const moving = host._vacRt.get(d.id)?.moving ?? false;
    if (modeDisplayReason(host, d, moving)) continue;
    const { source, telemetry, routes, resolution } = runtime;
    if (!source) continue;
    const server = host._vacSrvTrails[d.id];
    const plan = planVacuumOverlay({ resolution, routes, renderSpace: host._space,
      rootSource: d.marker?.vacuum?.source ?? null, serverCurrent: server?.current ?? null,
      serverPrevious: server?.previous ?? null, explicitRoutes: Array.isArray(d.marker?.vacuum?.map_routes) });
    if (!plan.live) continue;
    const { frame } = currentVacuumTrailFrame({ telemetry,
      server: plan.currentRunMatches ? server?.current ?? null : null,
      local: host._vacRt.get(d.id)?.material ?? [], serverFormat: host._vacTrailFormat,
      moving, matrix: plan.live, cache: host._vacGeometryCache,
      cmPerUnit: host._cellCm / host._gridPitch, budget });
    budget -= frame.count;
    result.rendered = frame.count;
    if (frame.limited) result.reason = 'limited';
    const retained = result.source === 'native'
      && ['stale', 'coordinates_unverified', 'unsupported', 'run_unverified'].includes(result.reason);
    result.display = frame.count > 0 ? retained ? 'vac.trail_display_retained' : 'vac.trail_display_visible'
        : server?.current && !plan.currentRunMatches ? 'vac.trail_display_run'
        : frame.limited ? 'vac.path_limited'
        : result.reason === 'empty_integration' ? 'vac.path_empty_integration'
        : result.raw > 0 || result.stored > 0 ? 'vac.trail_display_points' : 'vac.path_none';
  }
  return results;
}

export function diagnoseVacuumTrail(host: Host, device: DevItem): VacuumTrailDiagnostic {
  return diagnoseVacuumTrails(host).get(device.id)
    ?? initialDiagnostic(host, device, host._vacRuntimeSource(device));
}
