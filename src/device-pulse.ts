import type { DeviceActivity, DeviceVisualState } from './device-visual';
import type { DeviceDisplayMode } from './logic';

export type DevicePulseKind = 'none' | 'alarm' | 'short' | 'continuous';
export type DevicePulseReason = 'none' | 'alarm' | 'event' | 'presence' | 'transition' | 'running';

export interface ResolvedDevicePulse {
  kind: DevicePulseKind;
  reason: DevicePulseReason;
  generation: number;
  expiresAt: number | null;
  color: string | null;
  diameterScale: number;
  animated: boolean;
  reducedMotionIndicator: 'none' | 'dot';
}

export interface ResolveDevicePulseOptions {
  display: DeviceDisplayMode;
  visual: DeviceVisualState;
  semanticActivity: DeviceActivity;
  shortReason?: 'event' | 'transition' | null;
  shortGeneration?: number;
  shortExpiresAt?: number | null;
  now?: number;
  liveStates: boolean;
  effectiveHidden: boolean;
  bindingUnavailable?: boolean;
  reducedMotion?: boolean;
  color?: string | null;
  diameterScale?: number;
}

export const DEVICE_ACTIVITY_BLUE = '#0C82F0';
export const DEVICE_ACTIVITY_AMBER = '#F0A00C';
export const DEVICE_ACTIVITY_GREEN = '#1DC21D';
export const DEVICE_ALERT_RED = '#F0410C';
export const DEVICE_PULSE_DEFAULT_SCALE = 1.5;

const ALARM_DIAMETER_SCALE = DEVICE_PULSE_DEFAULT_SCALE;

function semanticPulseColor(
  visual: DeviceVisualState,
  semanticActivity: DeviceActivity,
): string {
  if (semanticActivity === 'presence') return DEVICE_ACTIVITY_GREEN;
  if (semanticActivity === 'running' || visual.status === 'working' || visual.status === 'open') {
    return DEVICE_ACTIVITY_AMBER;
  }
  return DEVICE_ACTIVITY_BLUE;
}

function noPulse(
  generation: number,
  color: string | null,
  diameterScale: number,
): ResolvedDevicePulse {
  // Keep the configured presentation parameters even while there is no live
  // effect. The editor preview can then demonstrate the exact saved colour
  // and diameter without inventing a second settings resolver.
  return {
    kind: 'none', reason: 'none', generation, expiresAt: null,
    color, diameterScale, animated: false, reducedMotionIndicator: 'none',
  };
}

/**
 * The only visual projection for activity around a device marker. Semantic
 * state classification remains in device-visual; this resolver only decides
 * which of the three public effects is allowed by the selected display mode.
 */
export function resolveDevicePulse(options: ResolveDevicePulseOptions): ResolvedDevicePulse {
  const {
    display, visual, semanticActivity, liveStates, effectiveHidden,
    bindingUnavailable = false, reducedMotion = false,
  } = options;
  const generation = Math.max(1, Math.trunc(options.shortGeneration || 1));
  const diameterScale = Number.isFinite(options.diameterScale)
    ? Math.max(1, Number(options.diameterScale)) : DEVICE_PULSE_DEFAULT_SCALE;
  const color = options.color || semanticPulseColor(visual, semanticActivity);
  if (effectiveHidden || bindingUnavailable || visual.availability === 'unavailable'
      || display === 'static_icon') {
    return noPulse(generation, color, diameterScale);
  }

  // Alarm is a safety signal, not ordinary activity. It is visible for every
  // dynamic display and is deliberately independent of live-state styling.
  if (visual.status === 'alarm') {
    return {
      kind: 'alarm', reason: 'alarm', generation, expiresAt: null,
      color: DEVICE_ALERT_RED, diameterScale: ALARM_DIAMETER_SCALE, animated: !reducedMotion,
      reducedMotionIndicator: 'none',
    };
  }
  if (!liveStates || display !== 'icon_ripple') return noPulse(generation, color, diameterScale);

  const now = options.now ?? Date.now();
  const expiresAt = options.shortExpiresAt || null;
  if (options.shortReason && expiresAt != null && expiresAt > now) {
    return {
      kind: 'short', reason: options.shortReason, generation, expiresAt,
      color,
      diameterScale: reducedMotion ? 1 : diameterScale,
      animated: !reducedMotion,
      reducedMotionIndicator: reducedMotion ? 'dot' : 'none',
    };
  }

  if (semanticActivity === 'presence'
      || semanticActivity === 'transition'
      || semanticActivity === 'running') {
    return {
      kind: 'continuous', reason: semanticActivity, generation, expiresAt: null,
      color,
      diameterScale: reducedMotion ? 1 : diameterScale,
      animated: !reducedMotion,
      reducedMotionIndicator: reducedMotion ? 'dot' : 'none',
    };
  }
  return noPulse(generation, color, diameterScale);
}

/** Preview-only effect projection. It never mutates the witnessed runtime. */
export function withDemoPulse(
  source: ResolvedDevicePulse,
  kind: 'short' | 'continuous',
  generation: number,
  reducedMotion: boolean,
  expiresAt: number | null = null,
): ResolvedDevicePulse {
  return {
    kind,
    reason: kind === 'short' ? 'event' : 'running',
    generation: Math.max(1, Math.trunc(generation)),
    expiresAt: kind === 'short' ? expiresAt : null,
    color: source.color,
    diameterScale: reducedMotion ? 1 : source.diameterScale,
    animated: !reducedMotion,
    reducedMotionIndicator: reducedMotion ? 'dot' : 'none',
  };
}
