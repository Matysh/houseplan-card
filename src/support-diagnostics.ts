/** Lazy, opt-in observations. No writes, DOM snapshots, files or HA requests. */
import type { HouseplanEditorHostPort } from './houseplan-editor-runtime';
import type { DevItem, ValueBadgeSource } from './types';
import type { ResolvedDevicePresentation } from './device-presentation';
import type { RenderDeviceSnapshot } from './render-device-snapshot';
import { presentationSnapshotKey } from './render-device-snapshot';
import { resolvedLightSources } from './devices';
import { projectedTapAction, resolveToggleIntent } from './device-toggle';
import { roomFillModeOf, roomGlowOf, spaceDisplayOf, displayIsNeutral } from './logic';
import { contentFingerprint } from './visual-continuity';
import { sunRaysOn } from './sun';
import { planVacuumOverlay, type VacuumMapRoute, type VacuumRouteResolution } from './vacuum-routes';
import { vacRoomNameKey, vacTrailMode, type VacTelemetry } from './vacuum';
import { diagnoseVacuumTrails } from './vacuum-trail-diagnostics';
import type { VacuumServerBook } from './vacuum-trail-material';

type Host = HouseplanEditorHostPort & {
  readonly _renderDeviceSnapshot: RenderDeviceSnapshot | null;
  readonly _summary?: { supportFacts(): Record<string, unknown> };
};
type Row = Record<string, unknown>;
interface VacuumFrame {
  source: string | null; telemetry: VacTelemetry | null;
  routes: VacuumMapRoute[]; resolution: VacuumRouteResolution;
  runtime: { trail: unknown; moving: boolean } | null;
  server: VacuumServerBook[string] | null;
}

export interface SupportDiagnosticInput {
  schema: 1; config_rev: number; layout_rev: number; age_ms: number;
  devices: Row[]; vacuums: Row[]; environment: Row; limited: boolean;
}

export function supportValueShape(value: unknown): string {
  if (value == null || value === '' || value === 'unknown' || value === 'unavailable') return 'missing';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isFinite(value) ? 'numeric' : 'missing';
  if (typeof value === 'string') {
    if (['on', 'off', 'open', 'closed', 'locked', 'unlocked', 'cleaning', 'returning', 'docked', 'paused', 'idle'].includes(value)) return 'known_enum';
    return Number.isFinite(Number(value)) ? 'numeric' : 'text';
  }
  return 'non_scalar';
}

/** Exact contiguous local fragment ranges under the shared browser cap. */
export function supportPathSample(raw: unknown, budget = { points: 4096, fragments: 256 }): Row {
  const paths: unknown[][] = Array.isArray(raw) ? raw : [];
  let total = 0, kept = 0, invalid = 0;
  const fragments: Row[] = [];
  let visited = 0;
  for (let f = 0; f < Math.min(paths.length, 1024); f++) {
    const path = paths[f];
    if (!Array.isArray(path)) continue;
    total += path.length;
    let current: { fragment: number; start: number; end: number; points: number[][] } | null = null;
    for (let i = 0; i < path.length && visited < 8192; i++) {
      visited++;
      const pair: unknown = path[i];
      if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(n => typeof n === 'number' && Number.isFinite(n))) {
        invalid++; current = null; continue;
      }
      if (budget.points <= 0 || (!current && budget.fragments <= 0)) { current = null; continue; }
      if (!current) {
        current = { fragment: f, start: i, end: i, points: [] };
        fragments.push(current); budget.fragments--;
      }
      current.points.push([pair[0], pair[1]]);
      current.end = i + 1; budget.points--; kept++;
    }
  }
  const limited = visited < total || paths.length > 1024;
  return { status: Array.isArray(raw) ? 'available' : 'unavailable', raw_points: total,
    valid_points: visited - invalid, invalid_points: invalid, kept_points: kept,
    total_fragments: paths.length, scan_limited: limited, truncated: limited || kept < visited - invalid, fragments };
}

function resolvedSource(p: ResolvedDevicePresentation): ValueBadgeSource | null {
  const source = p.valueSource;
  if (!source) return null;
  if (source.kind === 'derived_lqi') return { kind: 'derived_lqi' };
  if (source.kind === 'derived_marker_state') return { kind: 'derived_marker_state', ref: source.eid as `marker:${string}` };
  return source.attribute ? { kind: 'entity_attribute', entity_id: source.eid, attribute: source.attribute }
    : { kind: 'entity_state', entity_id: source.eid };
}

function valueObservation(source: ValueBadgeSource | null, outcome: string,
  states: Record<string, { state?: unknown; attributes?: Record<string, unknown> }>): Row {
  let shape = 'missing', attributePresent: boolean | undefined;
  if (source?.kind === 'derived_lqi') shape = outcome === 'value' ? 'numeric' : 'missing';
  else if (source?.kind === 'derived_marker_state') shape = outcome === 'value' ? 'known_enum' : 'missing';
  else if (source) {
    const state = states[source.entity_id];
    if (source.kind === 'entity_attribute') {
      attributePresent = !!state?.attributes && Object.prototype.hasOwnProperty.call(state.attributes, source.attribute);
      shape = supportValueShape(state?.attributes?.[source.attribute]);
    } else shape = supportValueShape(state?.state);
  }
  return { source, shape, outcome, ...(attributePresent !== undefined ? { attribute_present: attributePresent } : {}) };
}

const family = (value: unknown): string => typeof value === 'string'
  && ['dreame_vacuum', 'xiaomi_cloud_map_extractor', 'valetudo', 'roborock', 'mqtt', 'zha', 'esphome'].includes(value)
  ? value : value ? 'other' : 'unknown';

/** Observational explanation of the actual shared overlay planner. */
export function vacuumSupportReasons(device: DevItem, frame: VacuumFrame | undefined,
  renderSpace: string, sourceStatus: string): { reasons: string[]; plan: ReturnType<typeof planVacuumOverlay> | null } {
  const reasons: string[] = [];
  if (device.hidden) reasons.push('hidden');
  if (displayIsNeutral(device.marker?.display === 'ripple' ? 'icon_ripple' : device.marker?.display || 'badge')) reasons.push('static_display');
  if (device.marker?.vacuum?.live === false) reasons.push('live_disabled');
  const mode = vacTrailMode(device.marker?.vacuum);
  if (mode === 'never') reasons.push('mode_never');
  if (mode === 'cleaning' && frame?.runtime?.moving === false) reasons.push('stopped');
  const sourceReason = ({ missing: 'source_missing', disabled: 'source_disabled', unavailable: 'source_unavailable',
    unverified: 'source_unverified' } as Record<string, string>)[sourceStatus];
  if (sourceReason) reasons.push(sourceReason);
  if (!frame) return { reasons: [...reasons, 'runtime_unavailable'], plan: null };
  if (!frame.telemetry) reasons.push('no_telemetry');
  const resolution = frame.resolution;
  if (['unmapped', 'ambiguous', 'missing_space', 'needs_calibration'].includes(resolution.kind)) reasons.push(resolution.kind);
  const plan = planVacuumOverlay({ resolution, routes: frame.routes, renderSpace,
    rootSource: device.marker?.vacuum?.source, serverCurrent: frame.server?.current,
    serverPrevious: frame.server?.previous, explicitRoutes: Array.isArray(device.marker?.vacuum?.map_routes) });
  if (resolution.kind === 'ready' && resolution.route.space !== renderSpace) reasons.push('foreign_space');
  if (resolution.kind === 'ready' && frame.server?.current && !plan.currentRunMatches) {
    reasons.push(frame.server.current.route_id ? 'run_route_mismatch' : 'run_source_mismatch');
  }
  return { reasons, plan };
}

export function collectSupportDiagnostics(host: Host): SupportDiagnosticInput {
  const snapshot = host._renderDeviceSnapshot;
  const devices = [...(snapshot?.devices || [])].slice(0, 2000);
  const hass = snapshot?.hass || host._renderPlanHass;
  const states = hass?.states || {};
  const lightSources = resolvedLightSources(hass, devices, null, host._virtualLights);
  const observations: Row[] = [];
  let limited = !snapshot || (snapshot.devices.length > 2000);
  for (const d of devices) {
    const p = snapshot?.presentations.get(presentationSnapshotKey(d.id, true))
      || snapshot?.presentations.get(presentationSnapshotKey(d.id, false));
    if (!p) { limited = true; continue; }
    const action = projectedTapAction(d.tapAction, d.primary?.split('.')[0]);
    const intent = action === 'toggle' ? resolveToggleIntent({ hass, registryHass: host._fullRegistryHass,
      devices, device: d, lightSources, virtualLights: host._virtualLights }) : null;
    const row: Row = { id: d.id, binding: p.binding || 'unknown', area: d.area || null, space: d.space || null,
      room: d.marker?.room_id ?? null, primary: d.primary || null, entities: d.entities.slice(0, 512),
      binding_status: d.bindingStatus?.kind || 'unknown', placement: d.marker?.room_id ? 'explicit_room' : d.area ? 'area' : 'unmapped',
      display: p.display, source_kind: p.sourceKind, sources: p.visualSources.map(s => s.eid).slice(0, 512),
      availability: p.visual.availability, status: p.visual.status, activity: p.activity,
      pulse_kind: p.pulse.kind, pulse_reason: p.pulse.reason, tap_action: action,
      hidden: p.effectiveHidden, ha_disabled: p.haDisabled, orphaned: p.orphaned, vacuum_live: p.vacuumLive,
      face: valueObservation(resolvedSource(p), p.fallbackReason ? 'fallback' : p.valueText !== null ? 'value' : 'icon', states),
      badge: valueObservation(p.valueBadge?.source || null,
        !p.valueBadge ? 'none' : p.valueBadge.availability === 'available' ? 'value' : 'unavailable', states),
    };
    if (intent) row.action = { kind: intent.kind, reason: intent.noneReason, next: intent.nextEffect,
      targets: intent.targets.map(t => t.entityId).slice(0, 512),
      skipped: intent.skippedTargets.slice(0, 512).map(t => ({ ref: t.entityId || t.ref || null, reason: t.reason })) };
    if (d.entities.length > 512 || p.visualSources.length > 512 || (intent?.targets.length || 0) > 512) limited = true;
    observations.push(row);
  }
  const diagnostics = diagnoseVacuumTrails({ _devices: devices, _vacSrvTrails: host._vacSrvTrails,
    _vacRt: host._vacRt, _vacTrailFormat: host._vacTrailFormat, _isVacDev: d => host._isVacDev(d),
    _vacSource: d => host._vacSource(d, hass), _vacObservedMapId: (d, source) => host._vacObservedMapId(d, source),
    _model: host._model, _space: host._space, _vacGeometryCache: host._vacGeometryCache,
    _cellCm: host._cellCm, _gridPitch: host._gridPitch, hass });
  const vacuums: Row[] = [];
  const budget = { points: 4096, fragments: 256 };
  for (const d of devices) {
    if (!host._isVacDev(d)) continue;
    if (vacuums.length >= 32) { limited = true; break; }
    const frame = snapshot?.facts.get(`vacuum:${d.id}`) as VacuumFrame | undefined;
    const source = host._vacSourceResolution(d, false, hass);
    const { reasons, plan } = vacuumSupportReasons(d, frame, host._space, source.status);
    const diagnostic = diagnostics.get(d.id);
    if (diagnostic?.reason === 'limited') reasons.push('budget_limited');
    if (!diagnostic?.stored) reasons.push('no_path');
    if (!reasons.length && diagnostic?.rendered) reasons.push('drawable');
    const active = frame?.resolution.kind === 'ready' ? frame.resolution.route : null;
    const candidates = [...source.candidates].sort((a, b) => Number(b.entityId === source.entityId) - Number(a.entityId === source.entityId));
    const targetRooms = host._model.find(s => s.id === (active?.space || d.space))?.rooms || [];
    const byName = new Map(targetRooms.map(r => [vacRoomNameKey(r.name), r]));
    if (candidates.length > 16 || (frame?.telemetry?.rooms.length || 0) > 256) limited = true;
    const row: Row = { marker: d.id, source: source.entityId, source_status: source.status,
      ...(frame?.runtime ? { moving: frame.runtime.moving } : {}),
      live: d.marker?.vacuum?.live !== false, mode: vacTrailMode(d.marker?.vacuum), reasons,
      candidates: candidates.slice(0, 16).map(c => ({ source: c.entityId, status: host._vacCandidateStatus(c.entityId, c, hass), same_device: d.entities.includes(c.entityId),
        selected: source.entityId === c.entityId, family: family(c.platform),
        has_position: c.hasPosition, has_rooms: c.hasRooms, has_path: c.hasPath, has_map_id: c.hasMapId })),
    };
    if (frame) Object.assign(row, { resolution: frame.resolution.kind, space: active?.space ?? null,
      route: active?.id ?? null, map_id: active?.map_id ?? null, current_matches: plan?.currentRunMatches ?? false,
      previous_visible: !!plan?.previous,
      local: supportPathSample(frame.runtime?.trail, budget),
      rooms: (frame.telemetry?.rooms || []).slice(0, 256).map(room => {
        return { id: room.id, anchor: [room.cx, room.cy], plan_room: byName.get(vacRoomNameKey(room.name))?.id ?? null,
          ...([room.x0, room.y0, room.x1, room.y1].every(v => typeof v === 'number' && Number.isFinite(v))
            ? { bounds: [room.x0, room.y0, room.x1, room.y1] } : {}) };
      }),
      ...(frame.telemetry?.pos ? { position: [frame.telemetry.pos.x, frame.telemetry.pos.y] } : {}) });
    if (diagnostic) Object.assign(row, { raw: diagnostic.raw, stored: diagnostic.stored, rendered: diagnostic.rendered,
      trail_source: diagnostic.source, trail_reason: diagnostic.reason });
    vacuums.push(row);
  }
  const rooms: Row[] = [], resources: Row[] = [];
  for (const space of host._serverCfg?.spaces || []) {
    const disp = spaceDisplayOf(space);
    for (const room of space.rooms || []) {
      if (rooms.length >= 2000) { limited = true; break; }
      rooms.push({ space: space.id, room: room.id ?? null, fill: roomFillModeOf(disp.fill, room),
        glow: roomGlowOf(disp.glow, room), sun_rays: sunRaysOn(host._settings, space.settings),
        fill_origin: room.settings?.fill_mode != null && room.settings.fill_mode !== 'glow' ? 'room' : space.settings?.fill_mode != null ? 'space' : 'default',
        glow_origin: typeof room.settings?.glow === 'boolean' || room.settings?.fill_mode === 'glow' ? 'room'
          : typeof space.settings?.glow_enabled === 'boolean' || space.settings?.fill_mode === 'glow' ? 'space' : 'default' });
    }
    if (space.plan_url) resources.push({ kind: 'plan', space: space.id, status: 'unobserved' });
    for (const item of space.decor || []) {
      if (resources.length >= 2000) { limited = true; break; }
      if (item.kind === 'image') resources.push({ kind: 'decor_image', space: space.id, decor: item.id,
        asset: item.asset_id ?? null, status: host._decorAssets.has(item.asset_id) ? 'present' : 'unobserved' });
    }
  }
  const accepted = !!snapshot && snapshot.geometry === host._cfgEpoch && host._loadOk
    && contentFingerprint(host._serverCfg) === host._adoption.currentConfigFingerprint();
  const input: SupportDiagnosticInput = { schema: 1, config_rev: host._cfgRev, layout_rev: host._layoutRev,
    age_ms: snapshot ? Date.now() - snapshot.capturedAt : 0, devices: observations, vacuums,
    environment: { mode: host._mode, projection: host._effectiveProjection(), space: host._space || null,
      accepted, write_pending: host._writesPending > 0 || host._saveConfigDebounced.pending() || host._dirtyPos.size > 0 || host._sentPos.size > 0,
      recovery: accepted ? 'live' : 'holding', resources, rooms,
      panel: host._summary?.supportFacts() || { status: 'runtime_not_loaded' } }, limited };
  // Drop bounded observations, never slice JSON or silently lose whole config.
  while (new TextEncoder().encode(JSON.stringify(input)).byteLength > 512 * 1024) {
    input.limited = true;
    if (input.devices.length) input.devices.splice(Math.floor(input.devices.length / 2));
    else if (input.vacuums.length) input.vacuums.pop();
    else { input.environment.resources = []; input.environment.rooms = []; input.environment.panel = { status: 'runtime_not_loaded' }; break; }
  }
  return input;
}
