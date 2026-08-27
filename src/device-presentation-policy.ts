import type { DeviceAvailability, DeviceVisualState } from './device-visual';
import type { DeviceDisplayMode } from './logic';

export type PresentationReason =
  | 'neutral'
  | 'working'
  | 'working_activity'
  | 'open'
  | 'cover_icon_state'
  | 'presence'
  | 'event'
  | 'transition'
  | 'media_neutral'
  | 'unavailable'
  | 'alarm'
  | 'live_states_disabled'
  | 'value_no_state'
  | 'value_ambiguous_sources'
  | 'value_non_scalar'
  | 'value_virtual'
  | 'vacuum_live_plan_only'
  | 'hidden_design_preview'
  | 'composite_power_source'
  | 'activity_display_disabled'
  | 'static_icon'
  | 'ha_disabled'
  | 'orphaned';

export type BindingPresentationLifecycle =
  | 'active' | 'ha_disabled' | 'orphaned';

export type PresentationFace = 'icon' | 'value';
export type ValueFallbackReason =
  | 'value_no_state' | 'value_ambiguous_sources' | 'value_non_scalar' | 'value_virtual';

export interface DevicePresentationPolicyInput {
  bindingLifecycle: BindingPresentationLifecycle;
  userHidden: boolean;
  designPreview: boolean;
  display: DeviceDisplayMode;
  liveStates: boolean;
  sourceVisual: DeviceVisualState;
  controllerFace: boolean;
  controllerAvailability: DeviceAvailability;
  shortActivity: 'event' | 'transition' | null;
  valueAvailable: boolean;
  valueFallback: ValueFallbackReason | null;
  vacuumLiveRequested: boolean;
}

export interface DevicePresentationPolicyResult {
  effectiveHidden: boolean;
  bindingUnavailable: boolean;
  visual: DeviceVisualState;
  face: PresentationFace;
  dynamicIcon: boolean;
  metrics: boolean;
  liveColor: boolean;
  pulseEligible: boolean;
  vacuumLive: boolean;
  decisionIds: readonly string[];
}

const NEUTRAL_VISUAL: DeviceVisualState = {
  availability: 'available', status: 'neutral', activity: 'none',
};

/**
 * Ordered, side-effect-free policy for the final device face.
 *
 * HA/registry/light-graph discovery stays in device-presentation.ts. This
 * function consumes only resolved facts, so every priority can be exercised
 * without constructing a Home Assistant runtime or a renderer.
 */
export function resolveDevicePresentationPolicy(
  input: DevicePresentationPolicyInput,
): DevicePresentationPolicyResult {
  const decisions: string[] = [];
  const bindingUnavailable = input.bindingLifecycle === 'ha_disabled'
    || input.bindingLifecycle === 'orphaned';

  let effectiveHidden = false;
  if (input.bindingLifecycle === 'ha_disabled') {
    effectiveHidden = true;
    decisions.push('lifecycle.ha_disabled_hidden');
  } else if (input.userHidden && !input.designPreview) {
    effectiveHidden = true;
    decisions.push('lifecycle.user_hidden');
  } else if (input.userHidden) {
    decisions.push('lifecycle.user_hidden_preview');
  } else if (input.bindingLifecycle === 'orphaned') {
    decisions.push('lifecycle.orphaned_diagnostic');
  } else {
    decisions.push('lifecycle.active');
  }

  const staticIcon = input.display === 'static_icon';
  let visual = input.controllerFace
    ? { ...input.sourceVisual, availability: input.controllerAvailability }
    : input.sourceVisual;
  decisions.push(input.controllerFace
    ? input.controllerAvailability === 'available'
      ? 'availability.controller_available'
      : 'availability.controller_unavailable'
    : 'availability.source');

  if (effectiveHidden) {
    visual = NEUTRAL_VISUAL;
    decisions.push('face.hidden');
  } else if (staticIcon) {
    visual = NEUTRAL_VISUAL;
    decisions.push('face.static');
  } else if (input.sourceVisual.status !== 'alarm' && !input.liveStates) {
    visual = NEUTRAL_VISUAL;
    decisions.push('face.live_states_disabled');
  } else {
    decisions.push('face.dynamic');
  }

  if (!staticIcon && !effectiveHidden && input.liveStates
      && input.sourceVisual.status !== 'alarm' && input.shortActivity) {
    visual = { ...visual, activity: input.shortActivity };
    decisions.push(`activity.short_${input.shortActivity}`);
  }

  if (visual.status === 'alarm') decisions.push('status.alarm');
  else if (visual.availability === 'unavailable') decisions.push('status.unavailable');
  else if (visual.status === 'working') decisions.push('status.working');
  else if (visual.status === 'open') decisions.push('status.open');
  else decisions.push('status.neutral');

  const face: PresentationFace = input.display === 'value'
    && !effectiveHidden && input.valueAvailable ? 'value' : 'icon';
  decisions.push(face === 'value' ? 'content.value' : input.display === 'value'
    ? 'content.value_fallback_icon' : 'content.icon');
  if (input.display === 'value' && !input.valueAvailable && input.valueFallback) {
    decisions.push(`content.${input.valueFallback}`);
  }

  const dynamicIcon = input.liveStates && !staticIcon && !effectiveHidden;
  const metrics = !staticIcon && !effectiveHidden;
  const pulseEligible = !effectiveHidden && !bindingUnavailable && !staticIcon
    && visual.availability === 'available'
    && (visual.status === 'alarm' || (input.liveStates && input.display === 'icon_ripple'));
  const vacuumLive = metrics && input.vacuumLiveRequested;
  decisions.push(dynamicIcon ? 'diagnostics.dynamic_icon' : 'diagnostics.base_icon');
  decisions.push(metrics ? 'diagnostics.metrics_enabled' : 'diagnostics.metrics_suppressed');
  decisions.push(pulseEligible ? 'activity.pulse_eligible' : 'activity.pulse_suppressed');
  decisions.push(vacuumLive ? 'diagnostics.vacuum_live' : 'diagnostics.vacuum_static');

  return {
    effectiveHidden,
    bindingUnavailable,
    visual,
    face,
    dynamicIcon,
    metrics,
    liveColor: dynamicIcon,
    pulseEligible,
    vacuumLive,
    decisionIds: decisions,
  };
}

export interface PresentationReasonInput {
  lifecycle: BindingPresentationLifecycle;
  display: DeviceDisplayMode;
  liveStates: boolean;
  sourceKind: 'cover' | 'light' | 'controls' | 'device_role' | 'primary' | 'none';
  primaryDomain: string;
  visual: DeviceVisualState;
  activity: 'none' | 'event' | 'presence' | 'transition' | 'running';
}

/** The single explanation priority, kept beside the face policy it describes. */
export function resolvePresentationReason(input: PresentationReasonInput): PresentationReason {
  if (input.lifecycle === 'ha_disabled') return 'ha_disabled';
  if (input.lifecycle === 'orphaned') return 'orphaned';
  if (input.display === 'static_icon') return 'static_icon';
  if (input.visual.status === 'alarm') return 'alarm';
  if (!input.liveStates) return 'live_states_disabled';
  if (input.visual.availability === 'unavailable') return 'unavailable';
  if (input.sourceKind === 'cover') return 'cover_icon_state';
  if (input.activity === 'presence') return 'presence';
  if (input.activity === 'event') return 'event';
  if (input.activity === 'transition') return 'transition';
  if (input.visual.status === 'working') {
    return input.display === 'icon_ripple' && input.activity !== 'none'
      ? 'working_activity' : 'working';
  }
  if (input.visual.status === 'open') return 'open';
  if (input.primaryDomain === 'media_player') return 'media_neutral';
  return 'neutral';
}
