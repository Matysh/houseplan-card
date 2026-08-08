/**
 * One semantic projection for every device face.
 *
 * Interactive plan, static space card and the device editor preview consume
 * this object. Renderers are deliberately dumb: they never choose another
 * entity, reclassify a state or format a value on their own.
 */
import {
  climateTempFor, humFor, isHumEntity, isTempEntity, lqiFor,
  resolvedDeviceStateEntities, resolvedLightSources, tempFor,
} from './devices';
import {
  combineVisualSamples, entityVisualSample, entityVisualSamplesForDevice,
  isDevicePowerSwitch,
  type DeviceActivity, type DeviceVisualState, type EntityVisualSample,
} from './device-visual';
import {
  coverEntityOf, hassValue, lightColorOf, lqiColor, normalizeDeviceDisplay, stateIcon, valueWithUnit,
  type DeviceDisplayMode,
} from './logic';
import type { DevItem } from './types';

export type PresentationSourceKind =
  | 'cover' | 'light' | 'controls' | 'device_role' | 'primary' | 'none';

export type PresentationSourceRole =
  | 'cover' | 'light' | 'control' | 'forced_light' | 'device_role' | 'primary' | 'critical';

export type ValueFallbackReason =
  | 'value_no_state' | 'value_ambiguous_sources' | 'value_non_scalar' | 'value_virtual';

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

export interface ResolvedPresentationSource {
  eid: string;
  role: PresentationSourceRole;
  name: string;
  state: string;
  stateText: string;
  integrationDomain: string | null;
  sample: EntityVisualSample;
}

export interface ResolvedValueSource {
  kind: 'temperature' | 'humidity' | 'entity';
  eid: string;
  attribute?: string;
  text: string;
}

export interface PresentationExplanation {
  reason: PresentationReason;
  notices: PresentationReason[];
}

export interface PresentationActivityRuntime {
  sources: string;
  flashTs: number;
  flashKind: 'event' | 'transition' | null;
  gen: number;
}

export interface ResolvePresentationOptions {
  liveStates: boolean;
  showTemperature: boolean;
  showSignal: boolean;
  /** User-hidden markers show their real design inside the editor preview. */
  designPreview?: boolean;
  activityRuntime?: PresentationActivityRuntime | null;
  /** The preview needs real source facts even for a static face. Plan surfaces
   * may skip that work because the static projection cannot consume it. */
  sourceDetails?: boolean;
  now?: number;
}

export interface ResolvedDevicePresentation {
  binding: string;
  sourceKind: PresentationSourceKind;
  visualSources: ResolvedPresentationSource[];
  criticalSources: ResolvedPresentationSource[];
  valueSource: ResolvedValueSource | null;
  sourceSignature: string;

  visual: DeviceVisualState;
  display: DeviceDisplayMode;
  icon: string;
  valueText: string | null;
  valueFullText: string | null;
  fallbackReason: ValueFallbackReason | null;
  activity: DeviceActivity;
  activityGeneration: number;

  classes: string[];
  tempText: string | null;
  humText: string | null;
  lqiText: string | null;
  lqiColor: string | null;
  lightColor: string | null;
  scale: number;
  angle: number;
  rippleScale: number;
  rippleColor: string | null;

  userHidden: boolean;
  effectiveHidden: boolean;
  haDisabled: boolean;
  disabledReason: string | null;
  orphaned: boolean;
  vacuumLive: boolean;
  explanation: PresentationExplanation;
}

export interface ResolvedPresentationSources {
  sourceKind: PresentationSourceKind;
  visualSources: ResolvedPresentationSource[];
  criticalSources: ResolvedPresentationSource[];
  samples: EntityVisualSample[];
}

const ACTIVITY_WINDOW_MS = 3300;
const EMPTY_SOURCES: ResolvedPresentationSources = {
  sourceKind: 'none', visualSources: [], criticalSources: [], samples: [],
};

function sourceName(hass: any, eid: string): string {
  const reg = hass?.entities?.[eid];
  const st = hass?.states?.[eid];
  return String(reg?.name || reg?.original_name || st?.attributes?.friendly_name || eid);
}

function sourceStateText(hass: any, eid: string): string {
  const st = hass?.states?.[eid];
  if (!st) return '';
  if (typeof hass?.formatEntityState === 'function') {
    try {
      const text = hass.formatEntityState(st);
      if (typeof text === 'string' && text) return text;
    } catch { /* older/custom HA formatter: use raw state */ }
  }
  return String(st.state ?? '');
}

function sourceOf(
  hass: any, eid: string, role: PresentationSourceRole, sample?: EntityVisualSample,
): ResolvedPresentationSource {
  return {
    eid,
    role,
    name: sourceName(hass, eid),
    state: String(hass?.states?.[eid]?.state ?? ''),
    stateText: sourceStateText(hass, eid),
    integrationDomain: hass?.entities?.[eid]?.platform || null,
    sample: sample || entityVisualSample(hass, eid),
  };
}

/** Resolve the effective visual role once; every surface uses this graph. */
export function resolvePresentationSources(hass: any, device: DevItem): ResolvedPresentationSources {
  // User-hidden is a renderer concern. It must not erase the source graph used
  // by the design preview. HA-disabled devices already carry no active entities.
  const d = device.hidden && device.userHidden ? { ...device, hidden: false } : device;
  let sourceKind: PresentationSourceKind = 'none';
  let visualSources: ResolvedPresentationSource[] = [];

  const cover = d.tapAction === 'cover' ? coverEntityOf(d.entities) : null;
  const lights = resolvedLightSources(hass, [d]);
  if (cover) {
    sourceKind = 'cover';
    visualSources = [sourceOf(hass, cover, 'cover')];
  } else if (lights.length) {
    sourceKind = lights.some((source) => source.via === 'controls') ? 'controls' : 'light';
    visualSources = lights.map((source) => sourceOf(
      hass,
      source.eid,
      source.via === 'controls' ? 'control'
        : source.via === 'forced' ? 'forced_light' : 'light',
    ));
  } else {
    const ids = resolvedDeviceStateEntities(hass, d.entities);
    if (ids.length) {
      sourceKind = 'device_role';
      const samples = entityVisualSamplesForDevice(hass, ids, d.entities);
      visualSources = ids.map((eid, index) => sourceOf(hass, eid, 'device_role', samples[index]));
    } else if (d.primary) {
      sourceKind = 'primary';
      visualSources = [sourceOf(hass, d.primary, 'primary')];
    }
  }

  const criticalSources: ResolvedPresentationSource[] = [];
  for (const eid of d.entities || []) {
    const sample = entityVisualSample(hass, eid);
    if (sample.status !== 'alarm' || visualSources.some((source) => source.eid === eid)) continue;
    criticalSources.push(sourceOf(hass, eid, 'critical', sample));
  }
  return {
    sourceKind,
    visualSources,
    criticalSources,
    samples: [...visualSources, ...criticalSources].map((source) => source.sample),
  };
}

function firstClimateTemperature(hass: any, d: DevItem): { eid: string; text: string } | null {
  if (d.marker?.use_climate_temp !== true) return null;
  for (const eid of d.entities) {
    if (!eid.startsWith('climate.')) continue;
    const n = Number(hass?.states?.[eid]?.attributes?.current_temperature);
    if (!Number.isFinite(n)) continue;
    // A derived plan reading is deliberately compact and shares the same
    // one-decimal contract as the satellite temperature badge.
    return { eid, text: `${Math.round(n * 10) / 10}°` };
  }
  return null;
}

function firstTemperature(hass: any, d: DevItem): { eid: string; text: string } | null {
  if (d.icon !== 'mdi:thermometer' && d.icon !== 'mdi:air-filter') return null;
  for (const eid of d.entities) {
    if (!isTempEntity(hass, eid)) continue;
    const n = Number(hass?.states?.[eid]?.state);
    if (!Number.isFinite(n)) continue;
    return { eid, text: `${Math.round(n * 10) / 10}°` };
  }
  return null;
}

function firstHumidity(hass: any, d: DevItem): { eid: string; text: string } | null {
  if (!d.primary || !isHumEntity(hass, d.primary)) return null;
  const n = Number(hass?.states?.[d.primary]?.state);
  if (!Number.isFinite(n)) return null;
  return { eid: d.primary, text: `${Math.round(n)}%` };
}

function validStateValue(hass: any, eid: string): { text: string; fallback: ValueFallbackReason | null } {
  const state = hass?.states?.[eid];
  if (!state || state.state == null || String(state.state).trim() === '') {
    return { text: '', fallback: 'value_no_state' };
  }
  const raw = state.state;
  if (!['string', 'number', 'boolean'].includes(typeof raw)) {
    return { text: '', fallback: 'value_non_scalar' };
  }
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'unknown' || normalized === 'unavailable') {
    return { text: '', fallback: 'value_no_state' };
  }
  const formatted = hassValue(hass, eid);
  if (!formatted) return { text: '', fallback: 'value_no_state' };
  const unit = String(state.attributes?.unit_of_measurement || '');
  return { text: valueWithUnit(formatted, unit), fallback: null };
}

function resolveValue(
  hass: any,
  d: DevItem,
  sources: ResolvedPresentationSources,
  showTemperature: boolean,
): { source: ResolvedValueSource | null; text: string | null; fallback: ValueFallbackReason | null } {
  if (d.virtual) return { source: null, text: null, fallback: 'value_virtual' };
  if (showTemperature) {
    const climate = firstClimateTemperature(hass, d);
    if (climate) {
      return {
        source: { kind: 'temperature', eid: climate.eid, attribute: 'current_temperature', text: climate.text },
        text: climate.text,
        fallback: null,
      };
    }
    const temp = firstTemperature(hass, d);
    if (temp) {
      return { source: { kind: 'temperature', eid: temp.eid, text: temp.text }, text: temp.text, fallback: null };
    }
    const hum = firstHumidity(hass, d);
    if (hum) {
      return { source: { kind: 'humidity', eid: hum.eid, text: hum.text }, text: hum.text, fallback: null };
    }
  }
  if (sources.visualSources.length !== 1) {
    return {
      source: null,
      text: null,
      fallback: sources.visualSources.length ? 'value_ambiguous_sources' : 'value_no_state',
    };
  }
  const eid = sources.visualSources[0].eid;
  const value = validStateValue(hass, eid);
  if (value.fallback) return { source: null, text: null, fallback: value.fallback };
  return { source: { kind: 'entity', eid, text: value.text }, text: value.text, fallback: null };
}

function signatureOf(
  d: DevItem,
  sources: ResolvedPresentationSources,
  valueSource: ResolvedValueSource | null,
): string {
  const binding = d.marker?.binding
    || (d.bindingKind && d.bindingRef ? `${d.bindingKind}:${d.bindingRef}` : d.virtual ? 'virtual' : '');
  const rows = [
    ...sources.visualSources.map((source) => `${source.role}:${source.eid}`),
    ...sources.criticalSources.map((source) => `critical:${source.eid}`),
  ].sort();
  const value = valueSource ? `${valueSource.kind}:${valueSource.eid}:${valueSource.attribute || ''}` : 'none';
  return [binding, sources.sourceKind, ...rows, `value:${value}`].join('\n');
}

/** Formal signature used to decide whether a witnessed event window survives. */
export function presentationSourceSignature(
  hass: any,
  d: DevItem,
  showTemperature = true,
  resolved?: ResolvedPresentationSources,
): string {
  const sources = resolved || resolvePresentationSources(hass, d);
  const value = resolveValue(hass, d, sources, showTemperature);
  return signatureOf(d, sources, value.source);
}

function explanationReason(
  d: DevItem,
  visual: DeviceVisualState,
  activity: DeviceActivity,
  sourceKind: PresentationSourceKind,
  liveStates: boolean,
  haDisabled: boolean,
  orphaned: boolean,
  display: ResolvedDevicePresentation['display'],
): PresentationReason {
  if (haDisabled) return 'ha_disabled';
  if (orphaned) return 'orphaned';
  if (display === 'static_icon') return 'static_icon';
  if (visual.status === 'alarm') return 'alarm';
  if (!liveStates) return 'live_states_disabled';
  if (visual.availability === 'unavailable') return 'unavailable';
  if (sourceKind === 'cover') return 'cover_icon_state';
  if (activity === 'presence') return 'presence';
  if (activity === 'event') return 'event';
  if (activity === 'transition') return 'transition';
  if (visual.status === 'working') {
    return display === 'icon_ripple' && activity !== 'none' ? 'working_activity' : 'working';
  }
  if (visual.status === 'open') return 'open';
  if ((d.primary || '').startsWith('media_player.')) return 'media_neutral';
  return 'neutral';
}

export function presentationClasses(presentation: Pick<
  ResolvedDevicePresentation,
  'visual' | 'activity' | 'display' | 'effectiveHidden' | 'activityGeneration'
>): string[] {
  if (presentation.effectiveHidden) return [];
  if (presentation.display === 'static_icon') return ['static-icon'];
  const classes: string[] = [];
  const { visual } = presentation;
  if (visual.status === 'alarm') classes.push('alarm');
  else if (visual.availability === 'unavailable') classes.push('unavail');
  else if (visual.status === 'working') classes.push('on');
  else if (visual.status === 'open') classes.push('open');
  if (presentation.display === 'icon_ripple' && visual.status !== 'alarm'
      && presentation.activity !== 'none') {
    classes.push('activity-' + presentation.activity);
    if (presentation.activity === 'event' && presentation.activityGeneration % 2 === 0) {
      classes.push('activity-gen2');
    }
  }
  return classes;
}

/** Create the complete renderer-ready face projection. */
export function resolveDevicePresentation(
  hass: any,
  d: DevItem,
  options: ResolvePresentationOptions,
): ResolvedDevicePresentation {
  const display = normalizeDeviceDisplay(d.marker?.display);
  const staticIcon = display === 'static_icon';
  const sources = staticIcon && options.sourceDetails === false
    ? EMPTY_SOURCES : resolvePresentationSources(hass, d);
  const status = d.bindingStatus;
  const haDisabled = status?.kind === 'ha_disabled';
  const orphaned = status?.kind === 'orphaned';
  const userHidden = d.userHidden === true || d.marker?.hidden === true;
  const effectiveHidden = haDisabled || (userHidden && !options.designPreview);
  const combined = combineVisualSamples(sources.samples);
  let visual = combined;
  if (effectiveHidden) visual = { availability: 'available', status: 'neutral', activity: 'none' };
  else if (staticIcon) visual = { availability: 'available', status: 'neutral', activity: 'none' };
  else if (combined.status !== 'alarm' && !options.liveStates) {
    visual = { availability: 'available', status: 'neutral', activity: 'none' };
  }

  const value = staticIcon && options.sourceDetails === false
    ? { source: null, text: null, fallback: null }
    : resolveValue(hass, d, sources, options.showTemperature);
  const sourceSignature = signatureOf(d, sources, value.source);
  const rt = options.activityRuntime;
  const now = options.now ?? Date.now();
  if (!staticIcon && !effectiveHidden && options.liveStates && combined.status !== 'alarm'
      && rt?.sources === sourceSignature && rt.flashTs && rt.flashKind
      && now - rt.flashTs < ACTIVITY_WINDOW_MS) {
    visual = { ...visual, activity: rt.flashKind };
  }

  const activity = display === 'icon_ripple' && !effectiveHidden
    && options.liveStates && visual.status !== 'alarm' ? visual.activity : 'none';
  const temp = !staticIcon && !effectiveHidden && options.showTemperature
    ? (d.marker?.use_climate_temp === true ? climateTempFor(hass, d.entities)
      : (d.icon === 'mdi:thermometer' || d.icon === 'mdi:air-filter') ? tempFor(hass, d.entities) : null)
    : null;
  const hum = !staticIcon && !effectiveHidden && options.showTemperature && d.primary && isHumEntity(hass, d.primary)
    ? humFor(hass, d.entities) : null;
  const lqi = !staticIcon && !effectiveHidden && options.showSignal && !d.virtual ? lqiFor(hass, d.entities) : null;
  const actEid = sources.sourceKind === 'cover'
    ? sources.visualSources[0]?.eid
    : d.primary || sources.visualSources[0]?.eid;
  const state = actEid ? hass?.states?.[actEid] : null;
  const icon = options.liveStates && !staticIcon && !effectiveHidden
    ? stateIcon(d.icon, actEid?.split('.')[0], state?.attributes?.device_class, state?.state, !!d.marker?.icon)
    : d.icon;
  const lightColor = options.liveStates && !staticIcon && !effectiveHidden
    ? resolvedLightSources(hass, [{ ...d, hidden: false }])
        .map((source) => lightColorOf(hass?.states?.[source.eid]))
        .find((color): color is string => !!color) || null
    : null;
  const scale = Number(d.marker?.size) > 0 ? Number(d.marker!.size) : 1;
  const angle = Number(d.marker?.angle) || 0;
  const rippleScale = Number(d.marker?.ripple_size) > 0 ? Number(d.marker!.ripple_size) : 3;
  const rippleColor = staticIcon ? null : d.marker?.ripple_color || lightColor || null;
  const valueText = display === 'value' && !effectiveHidden ? value.text : null;
  const disabledReason = status?.kind === 'ha_disabled' ? status.reason : null;
  const reason = explanationReason(
    d, visual, activity, sources.sourceKind, options.liveStates, haDisabled, orphaned, display,
  );
  const notices: PresentationReason[] = [];
  if (options.designPreview && userHidden) notices.push('hidden_design_preview');
  if (!staticIcon && d.marker?.vacuum?.live === true) notices.push('vacuum_live_plan_only');
  const powerSource = sources.visualSources.length === 1
    && isDevicePowerSwitch(hass, sources.visualSources[0].eid);
  const uncategorisedSwitches = d.entities.filter((eid) =>
    eid.startsWith('switch.') && !hass?.entities?.[eid]?.entity_category,
  ).length;
  if (powerSource && uncategorisedSwitches > 1) notices.push('composite_power_source');
  if (display !== 'icon_ripple' && display !== 'static_icon'
      && combined.status !== 'alarm' && combined.activity !== 'none') {
    notices.push('activity_display_disabled');
  }

  const presentation: ResolvedDevicePresentation = {
    binding: d.marker?.binding
      || (d.bindingKind && d.bindingRef ? `${d.bindingKind}:${d.bindingRef}` : d.virtual ? 'virtual' : ''),
    sourceKind: sources.sourceKind,
    visualSources: sources.visualSources,
    criticalSources: sources.criticalSources,
    valueSource: value.source,
    sourceSignature,
    visual,
    display,
    icon,
    valueText,
    valueFullText: valueText,
    fallbackReason: display === 'value' && !valueText ? value.fallback : null,
    activity,
    activityGeneration: rt?.gen || 1,
    classes: [],
    tempText: temp == null ? null : String(temp),
    humText: hum == null ? null : String(hum),
    lqiText: lqi == null ? null : String(lqi),
    lqiColor: lqi == null ? null : lqiColor(lqi),
    lightColor,
    scale,
    angle,
    rippleScale,
    rippleColor,
    userHidden,
    effectiveHidden,
    haDisabled,
    disabledReason,
    orphaned,
    vacuumLive: !staticIcon && d.marker?.vacuum?.live === true,
    explanation: { reason, notices },
  };
  return { ...presentation, classes: presentationClasses(presentation) };
}

/** Local preview-only activity; does not touch the witnessed runtime map. */
export function presentationWithDemoActivity(
  source: ResolvedDevicePresentation,
  generation: number,
): ResolvedDevicePresentation {
  if (source.display !== 'icon_ripple') return source;
  const out: ResolvedDevicePresentation = {
    ...source,
    activity: 'event',
    activityGeneration: generation,
    classes: [],
  };
  return { ...out, classes: presentationClasses(out) };
}
