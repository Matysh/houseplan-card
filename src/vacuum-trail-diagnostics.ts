/** Read-only path diagnostics, separate from the card and editor monoliths. */
import type { HouseplanEditorHostPort } from './houseplan-editor-runtime';
import type { DevItem } from './types';
import { displayIsNeutral, normalizeDeviceDisplay } from './logic';
import { readVacTelemetry, trimVacPathTarget, vacTrailMode } from './vacuum';
import { effectiveRoutes, observedMapIds, planVacuumOverlay, resolveRoute } from './vacuum-routes';
import { VAC_RENDER_POINT_BUDGET } from './vacuum-path-geometry';
import { selectVacuumTrail } from './vacuum-trail-material';
import { vacuumTrailSvg } from './vacuum-trail-render';

export interface VacuumTrailDiagnostic {
  source: string; reason: string; raw: number; stored: number; rendered: number;
  receivedAt?: number; final: boolean;
}
type Host = Pick<HouseplanEditorHostPort, '_vacSrvTrails' | '_vacRt' | '_vacTrailFormat'
  | '_devices' | '_isVacDev' | '_vacSource' | '_vacObservedMapId' | '_model'
  | '_space' | '_vacGeometryCache' | '_cellCm' | '_gridPitch' | 'hass'>;

export function diagnoseVacuumTrail(host: Host, device: DevItem): VacuumTrailDiagnostic {
  const run = host._vacSrvTrails[device.id]?.current;
  const source = host._vacSource(device);
  const telemetry = source ? readVacTelemetry(host.hass?.states[source]?.attributes) : null;
  const chosen = selectVacuumTrail(telemetry, run ?? null, host._vacRt.get(device.id)?.material ?? [], host._vacTrailFormat);
  const raw = run?.quality?.raw_points ?? chosen.path.reduce((n, p) => n + p.length, 0);
  let rendered = 0, limited = false, budget = VAC_RENDER_POINT_BUDGET;
  // Same current-before-previous / roster order and space quota as View.
  for (const d of host._devices) {
    if (d.hidden || !host._isVacDev(d) || displayIsNeutral(normalizeDeviceDisplay(d.marker?.display))) continue;
    const src = host._vacSource(d), tele = src ? readVacTelemetry(host.hass?.states[src]?.attributes) : null;
    if (!src || !tele) continue;
    const routes = effectiveRoutes(d.id, d.marker?.vacuum ?? null, d.space, src);
    const resolution = resolveRoute({ routes,
      observed: observedMapIds(routes, [src], (source) => host._vacObservedMapId(d, source)),
      spaceIds: new Set(host._model.map((s) => s.id)) });
    const server = host._vacSrvTrails[d.id];
    const plan = planVacuumOverlay({ resolution, routes, renderSpace: host._space,
      rootSource: d.marker?.vacuum?.source ?? null, serverCurrent: server?.current ?? null,
      serverPrevious: server?.previous ?? null, explicitRoutes: Array.isArray(d.marker?.vacuum?.map_routes) });
    const moving = host._vacRt.get(d.id)?.moving ?? false, mode = vacTrailMode(d.marker?.vacuum);
    if (!plan.live || !(mode === 'always' || (mode === 'cleaning' && moving))) continue;
    const current = selectVacuumTrail(tele, plan.currentRunMatches ? server?.current ?? null : null,
      host._vacRt.get(d.id)?.material ?? [], host._vacTrailFormat);
    const path = moving && !current.native && current.allowTip && current.source !== 'local'
      ? trimVacPathTarget(current.path) : current.path;
    const frame = vacuumTrailSvg(host._vacGeometryCache, path, plan.live, host._cellCm / host._gridPitch, budget);
    budget -= frame.count;
    if (d.id === device.id) { rendered = frame.count; limited = frame.limited; }
  }
  return { source: chosen.source, reason: limited ? 'limited' : chosen.reason, raw,
    stored: chosen.path.reduce((n, p) => n + p.length, 0), rendered,
    receivedAt: run?.received_at, final: run?.final_status === 'confirmed' };
}
