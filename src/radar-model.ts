/** Pure #485 presence-radar client model. No HA state interpretation lives here. */
import type { I18nKey } from './i18n';
import type { Marker, MarkerRadar } from './types';

export function isMarkerRadarV1(value: unknown): value is MarkerRadar {
  return !!value && typeof value === 'object'
    && (value as { version?: unknown }).version === 1;
}

export function radarMarkerLiveInSpace(marker: Marker, space: string): boolean {
  const radar = marker.radar;
  return marker.space === space && marker.hidden !== true && marker.removed !== true
    && isMarkerRadarV1(radar) && radar.enabled === true && radar.show_live !== false;
}

const RADAR_HEALTH_KEYS: Partial<Record<string, I18nKey>> = {
  ok: 'radar.health_ok', off: 'radar.health_off', stale: 'radar.health_stale',
  position_unavailable: 'radar.health_position_unavailable',
  unavailable: 'radar.health_unavailable', needs_setup: 'radar.health_needs_setup',
  inconsistent: 'radar.health_inconsistent', unknown: 'radar.health_unknown',
};

export function radarHealthI18nKey(radar: MarkerRadar, health?: string): I18nKey {
  if (radar.enabled !== true) return 'radar.health_disabled';
  return RADAR_HEALTH_KEYS[health || ''] || 'radar.health_unknown';
}

export interface RadarLiveTarget {
  slot: string;
  x: number;
  y: number;
  reported_at: number;
  expires_at: number;
  pair_quality: 'bounded_latest' | 'coherent';
  included: boolean;
  smooth?: boolean;
  reason?: string | null;
}

export interface RadarLiveRange {
  id: string; x: number; y: number; radius: number;
  heading_deg?: number; fov_deg?: number | null;
  reported_at: number; expires_at: number;
  segments?: readonly (readonly (readonly [number, number])[])[];
}

export interface RadarLiveZone { id: string; state: boolean | number | null }

export interface RadarLiveFrame {
  server_session_id: string;
  marker_id: string;
  source_generation?: string;
  calibration_revision?: string;
  seq: number;
  reported_at?: number;
  expires_at?: number;
  health: string;
  reported_presence?: boolean | null;
  complete: boolean;
  targets: RadarLiveTarget[];
  ranges: RadarLiveRange[];
  zones: RadarLiveZone[];
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function normalizeRadarFrame(value: unknown): RadarLiveFrame | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.marker_id !== 'string' || typeof raw.server_session_id !== 'string'
      || !Number.isSafeInteger(raw.seq) || typeof raw.health !== 'string') return null;
  const targets = Array.isArray(raw.targets) ? raw.targets.slice(0, 256).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.slot !== 'string' || !finite(item.x) || !finite(item.y)
        || !finite(item.expires_at) || !finite(item.reported_at)
        || (item.pair_quality !== 'bounded_latest' && item.pair_quality !== 'coherent')) return [];
    return [{ ...item, included: item.included === true,
      smooth: item.smooth === true } as RadarLiveTarget];
  }) : [];
  const ranges = Array.isArray(raw.ranges) ? raw.ranges.slice(0, 64).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== 'string' || !finite(item.x) || !finite(item.y)
        || !finite(item.radius) || !finite(item.expires_at) || !finite(item.reported_at)) return [];
    const segments = Array.isArray(item.segments) ? item.segments.slice(0, 64).flatMap((segment) => {
      if (!Array.isArray(segment)) return [];
      const points = segment.slice(0, 181).flatMap((point) => (
        Array.isArray(point) && point.length === 2 && finite(point[0]) && finite(point[1])
          ? [[point[0], point[1]] as const] : []
      ));
      return points.length >= 2 ? [points] : [];
    }) : undefined;
    return [{ ...item, ...(segments ? { segments } : {}) } as unknown as RadarLiveRange];
  }) : [];
  const zones = Array.isArray(raw.zones) ? raw.zones.slice(0, 64).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== 'string') return [];
    const state = item.state;
    return state === null || typeof state === 'boolean' || finite(state)
      ? [{ id: item.id, state } as RadarLiveZone] : [];
  }) : [];
  return {
    server_session_id: raw.server_session_id,
    marker_id: raw.marker_id,
    source_generation: typeof raw.source_generation === 'string' ? raw.source_generation : undefined,
    calibration_revision: typeof raw.calibration_revision === 'string' ? raw.calibration_revision : undefined,
    seq: raw.seq as number,
    reported_at: finite(raw.reported_at) ? raw.reported_at : undefined,
    expires_at: finite(raw.expires_at) ? raw.expires_at : undefined,
    health: raw.health,
    reported_presence: typeof raw.reported_presence === 'boolean' ? raw.reported_presence : null,
    complete: raw.complete === true,
    targets, ranges, zones,
  };
}

export function radarFrameAccepts(previous: RadarLiveFrame | undefined,
                                  next: RadarLiveFrame): boolean {
  if (!previous) return true;
  if (next.server_session_id !== previous.server_session_id) return true;
  if (next.source_generation !== previous.source_generation
      || next.calibration_revision !== previous.calibration_revision) return true;
  return next.seq > previous.seq;
}

export function radarFrameExpired(frame: RadarLiveFrame, nowMs = Date.now()): boolean {
  return finite(frame.expires_at) && frame.expires_at * 1000 <= nowMs;
}

/** Remaining lease at receipt. Subsequent expiry uses a monotonic clock so a
 * wall-clock correction cannot resurrect or prematurely erase an observation. */
export function radarFrameLeaseMs(frame: RadarLiveFrame, wallNowMs = Date.now()): number | null {
  if (!finite(frame.expires_at)) return null;
  if (!finite(frame.reported_at)) return Math.max(0, frame.expires_at * 1000 - wallNowMs);
  const fullLease = Math.max(0, (frame.expires_at - frame.reported_at) * 1000);
  const transportAge = Math.max(0, wallNowMs - frame.reported_at * 1000);
  return Math.max(0, fullLease - transportAge);
}

export function radarArcPath(range: RadarLiveRange): string | null {
  const fov = finite(range.fov_deg) && range.fov_deg! > 0 ? Math.min(360, range.fov_deg!) : null;
  if (!fov) return null;
  if (fov >= 359.999) {
    return `M ${range.x - range.radius} ${range.y} A ${range.radius} ${range.radius} 0 1 0 ${range.x + range.radius} ${range.y} A ${range.radius} ${range.radius} 0 1 0 ${range.x - range.radius} ${range.y}`;
  }
  const center = (range.heading_deg || 0) - 90;
  const a = (center - fov / 2) * Math.PI / 180;
  const b = (center + fov / 2) * Math.PI / 180;
  const ax = range.x + Math.cos(a) * range.radius;
  const ay = range.y + Math.sin(a) * range.radius;
  const bx = range.x + Math.cos(b) * range.radius;
  const by = range.y + Math.sin(b) * range.radius;
  return `M ${ax} ${ay} A ${range.radius} ${range.radius} 0 ${fov > 180 ? 1 : 0} 1 ${bx} ${by}`;
}
