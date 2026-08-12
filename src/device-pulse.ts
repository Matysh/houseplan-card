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

const ALARM_COLOR = '#f25a4a';
const ALARM_DIAMETER_SCALE = 3;

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
    ? Math.max(1, Number(options.diameterScale)) : 3;
  const color = options.color || null;
  if (effectiveHidden || bindingUnavailable || display === 'static_icon') {
    return noPulse(generation, color, diameterScale);
  }

  // Alarm is a safety signal, not ordinary activity. It is visible for every
  // dynamic display and is deliberately independent of live-state styling.
  if (visual.status === 'alarm') {
    return {
      kind: 'alarm', reason: 'alarm', generation, expiresAt: null,
      color: ALARM_COLOR, diameterScale: ALARM_DIAMETER_SCALE, animated: !reducedMotion,
      reducedMotionIndicator: 'none',
    };
  }
  if (!liveStates || display !== 'icon_ripple') return noPulse(generation, color, diameterScale);

  const now = options.now ?? Date.now();
  const expiresAt = options.shortExpiresAt || null;
  if (options.shortReason && expiresAt != null && expiresAt > now) {
    return {
      kind: 'short', reason: options.shortReason, generation, expiresAt,
      color: reducedMotion ? null : color,
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
      color: reducedMotion ? null : color,
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
    color: reducedMotion ? null : source.color,
    diameterScale: reducedMotion ? 1 : source.diameterScale,
    animated: !reducedMotion,
    reducedMotionIndicator: reducedMotion ? 'dot' : 'none',
  };
}
