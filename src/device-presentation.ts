/**
 * One semantic projection for every device face.
 *
 * Interactive plan, static space card and the device editor preview consume
 * this object. Renderers are deliberately dumb: they never choose another
 * entity, reclassify a state or format a value on their own.
 */
import {
  climateTempFor, humFor, isHumEntity, isTempEntity, lqiFor,
  persistedExternalControls, resolvedDeviceStateEntities, resolvedLightSources, tempFor,
  type ResolvedLightSource,
} from './devices';
import {
  combineVisualSamples, entityVisualSample, entityVisualSamplesForDevice,
  isApplianceLifecycleEntity, isDevicePowerSwitch,
  type DeviceActivity, type DeviceAvailability, type DeviceVisualState, type EntityVisualSample,
} from './device-visual';
import {
  hassValue, lightColorOf, lqiColor, normalizeDeviceDisplay, stateIcon, valueWithUnit,
  type DeviceDisplayMode,
} from './logic';
import { resolveToggleIntent, toggleCoverEntity } from './device-toggle';
import type { DevItem } from './types';
import { safeStoredColor } from './color';
import { resolveDeviceValueBadge, type ResolvedValueBadge } from './device-value-badge';
import {
  DEVICE_PULSE_DEFAULT_SCALE, resolveDevicePulse, type ResolvedDevicePulse,
} from './device-pulse';
import { isManualVirtualLightMarker } from './virtual-light-state';
import {
  resolveDevicePresentationPolicy, resolvePresentationReason,
  type BindingPresentationLifecycle, type PresentationReason, type ValueFallbackReason,
} from './device-presentation-policy';

export type { PresentationReason, ValueFallbackReason } from './device-presentation-policy';

export type PresentationSourceKind =
  | 'cover' | 'light' | 'controls' | 'device_role' | 'primary' | 'none';

export type PresentationSourceRole =
  | 'cover' | 'light' | 'control' | 'forced_light' | 'device_role'
  | 'lifecycle' | 'power_gate' | 'primary' | 'critical';

export type DeviceLockState = 'locked' | 'unlocked' | null;
export type DeviceLqiBand = 'low' | 'mid' | 'high';
export type DeviceA11yState =
  | 'neutral' | 'working' | 'open' | 'locked' | 'unlocked' | 'alarm' | 'unavailable';

export function markerLqiBand(lqi: number): DeviceLqiBand {
  if (lqi <= 40) return 'low';
  if (lqi < 180) return 'mid';
  return 'high';
}

/** Colour is continuous; the separate band remains semantic/a11y metadata. */
export function markerLqiColor(lqi: number): string {
  return lqiColor(lqi);
}

export function deviceA11yState(presentation: Pick<
  ResolvedDevicePresentation, 'visual' | 'lockState' | 'display'
>): DeviceA11yState {
  if (presentation.display === 'static_icon') return 'neutral';
  if (presentation.visual.status === 'alarm') return 'alarm';
  if (presentation.visual.availability === 'unavailable') return 'unavailable';
  if (presentation.lockState) return presentation.lockState;
  if (presentation.visual.status === 'working') return 'working';
  if (presentation.visual.status === 'open') return 'open';
  return 'neutral';
}

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
  /** Absolute deadline avoids reviving a frozen CSS animation after tab resume. */
  expiresAt?: number;
  /** Alarm owns the timeline and baselines source changes while it is active. */
  alarmActive?: boolean;
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
  /** Whole-plan light graph; needed for passive sources driven from another marker. */
  lightDevices?: readonly DevItem[];
  /** Pre-resolved whole-plan graph. Render/activity passes must build it once. */
  lightSources?: readonly ResolvedLightSource<DevItem>[];
  /** Registry view must match the action resolver, including disabled rows. */
  registryHass?: any;
  now?: number;
  reducedMotion?: boolean;
}

export interface ResolvedDevicePresentation {
  binding: string;
  sourceKind: PresentationSourceKind;
  visualSources: ResolvedPresentationSource[];
  criticalSources: ResolvedPresentationSource[];
  valueSource: ResolvedValueSource | null;
  sourceSignature: string;
  /** Stable internal trace for the documented decision matrix. */
  decisionIds: readonly string[];

  visual: DeviceVisualState;
  lockState: DeviceLockState;
  display: DeviceDisplayMode;
  icon: string;
  valueText: string | null;
  valueFullText: string | null;
  fallbackReason: ValueFallbackReason | null;
  activity: DeviceActivity;
  activityGeneration: number;
  pulse: ResolvedDevicePulse;

  classes: string[];
  tempText: string | null;
  humText: string | null;
  valueBadge: ResolvedValueBadge | null;
  lqiText: string | null;
  lqiColor: string | null;
  lqiBand: DeviceLqiBand | null;
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
  decisionIds: readonly string[];
  visualSources: ResolvedPresentationSource[];
  criticalSources: ResolvedPresentationSource[];
  samples: EntityVisualSample[];
}

const ACTIVITY_WINDOW_MS = 3300;
const EMPTY_SOURCES: ResolvedPresentationSources = {
  sourceKind: 'none', decisionIds: ['source.skipped_static_fast_path'],
  visualSources: [], criticalSources: [], samples: [],
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

/**
 * Availability of the physical controller itself (#251).
 *
 * HA exposes entity states rather than one device state. Controls are not
 * controller evidence: a live battery/LQI/update sibling is, while an
 * event-only `unknown` entity is not. A virtual controller has no physical HA
 * binding which can go offline, so it is available by definition.
 */
export function controllerAvailability(hass: any, d: DevItem): DeviceAvailability {
  if (d.virtual || d.bindingKind === 'virtual' || d.marker?.binding === 'virtual') {
    return 'available';
  }
  const live = (d.entities || []).some((eid) => {
    const state = String(hass?.states?.[eid]?.state ?? '').trim().toLowerCase();
    return state !== '' && state !== 'unknown' && state !== 'unavailable';
  });
  return live ? 'available' : 'unavailable';
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
export function resolvePresentationSources(
  hass: any, device: DevItem, lightDevices: readonly DevItem[] = [device],
  planLightSources?: readonly ResolvedLightSource<DevItem>[],
  registryHass: any = hass,
): ResolvedPresentationSources {
  // User-hidden is a renderer concern. It must not erase the source graph used
  // by the design preview. HA-disabled devices already carry no active entities.
  const d = device.hidden && device.userHidden ? { ...device, hidden: false } : device;
  let sourceKind: PresentationSourceKind = 'none';
  let visualSources: ResolvedPresentationSource[] = [];
  const decisionIds: string[] = [];

  // A cover remains the device's visual state source even when tap_action is
  // More info. Resolve the same exact cover role/capability path as the toggle
  // adapter without changing the persisted action selected by the user.
  const coverDevice = [...d.entities, ...(d.allEntities || [])]
    .some((eid) => eid.startsWith('cover.'))
    ? { ...d, tapAction: 'cover' as const }
    : d;
  const cover = toggleCoverEntity(resolveToggleIntent({
    hass,
    devices: lightDevices,
    device: coverDevice,
    lightSources: planLightSources,
    registryHass,
  }));
  // A target owns Glow and room statistics, while a controller still needs to
  // present the aggregate state of what it controls. Resolve the controller
  // locally for ordinary entity refs, then project marker:* targets from the
  // plan-wide graph. Filtering the global graph only by source owner would
  // make a wall switch lose its yellow working state as soon as its target was
  // represented by a separate plan marker.
  const localLights = resolvedLightSources(hass, [d]);
  const persistedControls = persistedExternalControls(
    d.marker?.binding, d.marker?.controls ?? d.controls, d.entities,
  );
  const markerRefs = new Set(persistedControls.filter((ref) => ref.startsWith('marker:')));
  // The global graph is needed only for incoming links to an Always marker or
  // for outgoing marker:* aliases. Ordinary devices stay on the O(1) local
  // path instead of resolving the complete plan once per rendered marker.
  const needsGlobalGraph = d.marker?.is_light === true || markerRefs.size > 0;
  const globalLights = needsGlobalGraph
    ? planLightSources || resolvedLightSources(hass, lightDevices)
    : localLights;
  // Keep controller projections local, but take sources owned by this marker
  // from the plan-wide graph. This matters for passive sources: their `on`
  // state is derived from incoming marker:* links and cannot be known from an
  // isolated marker. Fall back to the local owned source for design previews
  // whose temporary marker is not present in `lightDevices`.
  const globalOwned = globalLights.filter((source) =>
    source.device.id === d.id && source.via !== 'controls'
  );
  const localOwned = localLights.filter((source) => source.via !== 'controls');
  const ownedLights = globalOwned.length ? globalOwned : localOwned;
  // In #107's exact manual mode, outgoing controls remain saved and active in
  // the plan graph, but they do not own this marker's face. Its icon/status is
  // the same canonical manual source used by Glow, room fill and statistics.
  const manualVirtualFace = isManualVirtualLightMarker(d.marker);
  const lights = manualVirtualFace ? [...ownedLights] : [
    ...localLights.filter((source) => source.via === 'controls'),
    ...ownedLights,
  ];
  if (markerRefs.size) {
    for (const source of globalLights) {
      if (!markerRefs.has(source.key)) continue;
      const aliasesExisting = source.stateEids.length > 0 && lights.some((existing) =>
        existing.stateEids.some((eid) => source.stateEids.includes(eid)),
      );
      if (!aliasesExisting && !lights.some((existing) => existing.key === source.key)) {
        lights.push({ ...source, via: 'controls', castsGlow: false });
      }
    }
  }
  // A cover-only device still gets cover visuals even when its click action is
  // More info. On a mixed device, however, an unrelated cover capability must
  // not hijack a primary/owned light unless the legacy explicit cover action
  // (or the primary entity itself) says that the marker represents the cover.
  const resolvedDeviceRole = resolvedDeviceStateEntities(registryHass, d.entities);
  const coverOwnsFace = !!cover && (
    d.tapAction === 'cover'
    || d.primary?.startsWith('cover.')
    || resolvedDeviceRole.some((eid) => eid.startsWith('cover.'))
  );
  if (cover && !coverOwnsFace) decisionIds.push('source.cover_capability_bypassed');
  if (coverOwnsFace) {
    sourceKind = 'cover';
    decisionIds.push('source.cover');
    visualSources = [sourceOf(hass, cover, 'cover')];
  } else if (lights.length) {
    sourceKind = !manualVirtualFace && lights.some((source) => source.via === 'controls')
      ? 'controls' : 'light';
    if (manualVirtualFace) decisionIds.push('source.manual_virtual_light');
    else decisionIds.push(sourceKind === 'controls' ? 'source.controls' : 'source.owned_light');
    if (sourceKind === 'controls' && (d.virtual || d.bindingKind === 'virtual')) {
      decisionIds.push('source.virtual_controller');
    }
    visualSources = lights.map((source) => {
      const role = source.via === 'controls' ? 'control'
        : source.via === 'forced' ? 'forced_light' : 'light';
      if (!source.passive) return sourceOf(hass, source.eid, role);
      const state = source.on ? 'on' : 'off';
      return {
        eid: source.key,
        role,
        name: device.name,
        state,
        stateText: state,
        integrationDomain: null,
        sample: {
          eid: source.key, state, availability: 'available' as const,
          status: source.on ? 'working' as const : 'neutral' as const,
          activity: 'none' as const, edge: 'none' as const,
        },
      };
    });
  } else {
    // Registry metadata is authoritative when present, but a few integrations
    // (and early HA startup snapshots) expose live states before the entity
    // registry arrives. Keep the historical whole-device role in that case
    // instead of silently downgrading the same entity to a generic primary.
    const resolvedIds = resolvedDeviceStateEntities(registryHass, d.entities);
    const ids = resolvedIds.length
      ? resolvedIds
      : d.entities.filter((eid) => !!hass?.states?.[eid]);
    if (ids.length) {
      sourceKind = 'device_role';
      decisionIds.push('source.device_role');
      // Registry metadata chooses the role, while the live hass snapshot owns
      // its state. Keep those authorities together for composite lifecycle
      // classification even during a frozen/partial registry projection.
      const visualHass = registryHass === hass
        ? hass : { ...registryHass, states: hass?.states || {} };
      const samples = entityVisualSamplesForDevice(visualHass, ids, d.entities);
      const hasLifecycle = ids.some((eid) => isApplianceLifecycleEntity(registryHass, eid));
      visualSources = samples.map((sample) => {
        const role: PresentationSourceRole = hasLifecycle
          ? isDevicePowerSwitch(registryHass, sample.eid) ? 'power_gate'
            : isApplianceLifecycleEntity(registryHass, sample.eid) ? 'lifecycle' : 'device_role'
          : 'device_role';
        return sourceOf(hass, sample.eid, role, sample);
      });
    } else if (d.primary) {
      sourceKind = 'primary';
      decisionIds.push('source.primary_fallback');
      visualSources = [sourceOf(hass, d.primary, 'primary')];
    } else {
      decisionIds.push('source.none');
    }
  }
  if (persistedControls.length > 0 && sourceKind !== 'controls'
      && sourceKind !== 'light' && sourceKind !== 'cover') {
    decisionIds.push('source.filtered_saved_controls');
  }

  const criticalSources: ResolvedPresentationSource[] = [];
  for (const eid of d.entities || []) {
    const sample = entityVisualSample(hass, eid);
    if (sample.status !== 'alarm' || visualSources.some((source) => source.eid === eid)) continue;
    criticalSources.push(sourceOf(hass, eid, 'critical', sample));
  }
  if (criticalSources.length) decisionIds.push('source.critical_sibling');
  return {
    sourceKind,
    decisionIds,
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
  // Passive marker sources deliberately use a `marker:*` identity. They are
  // presentation graph nodes, never HA entity ids. For a value face keep the
  // device's ordinary functional role as the value source instead of probing
  // `hass.states['marker:*']` or turning a sensor into an empty value.
  const realVisualSources = sources.visualSources.filter((source) => !source.eid.startsWith('marker:'));
  let valueEids = realVisualSources.map((source) => source.eid);
  const powerGate = realVisualSources.find((source) => source.role === 'power_gate');
  // Before #164 a composite appliance value face displayed its selected Power
  // entity. The added lifecycle source must not turn that existing value into
  // an ambiguous fallback.
  if (powerGate) valueEids = [powerGate.eid];
  if (!valueEids.length && sources.visualSources.some((source) => source.eid.startsWith('marker:'))) {
    valueEids = resolvedDeviceStateEntities(hass, d.entities);
    if (!valueEids.length && d.primary && hass?.states?.[d.primary]) valueEids = [d.primary];
  }
  valueEids = [...new Set(valueEids)];
  if (valueEids.length !== 1) {
    return {
      source: null,
      text: null,
      fallback: valueEids.length ? 'value_ambiguous_sources' : 'value_no_state',
    };
  }
  const eid = valueEids[0];
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

/** Activity runtime identity deliberately excludes the optional value badge
 * source: changing a displayed value must not restart or cancel a pulse. */
export function activitySourceSignature(
  hass: any,
  d: DevItem,
  resolved?: ResolvedPresentationSources,
): string {
  const sources = resolved || resolvePresentationSources(hass, d);
  return signatureOf(d, sources, null).replace(/\nvalue:none$/, '');
}

export function presentationClasses(presentation: Pick<
  ResolvedDevicePresentation,
  'visual' | 'lockState' | 'activity' | 'display' | 'effectiveHidden' | 'activityGeneration' | 'pulse'
>): string[] {
  if (presentation.effectiveHidden) return [];
  if (presentation.display === 'static_icon') return ['static-icon'];
  const classes: string[] = [];
  const { visual } = presentation;
  if (presentation.pulse.kind === 'alarm') classes.push('alarm');
  else if (visual.availability === 'unavailable') classes.push('unavail');
  else if (visual.status === 'working') classes.push('on');
  else if (visual.status === 'open') classes.push('open');
  if (presentation.lockState) classes.push(`lock-${presentation.lockState}`);
  // Keep the semantic class names as styling/debug hooks during the beta;
  // they no longer select a separate renderer or animation implementation.
  if (presentation.pulse.reason !== 'none' && presentation.pulse.reason !== 'alarm') {
    classes.push('activity-' + presentation.pulse.reason);
  }
  if (presentation.pulse.generation % 2 === 0) {
    classes.push('pulse-gen2');
    if (presentation.pulse.kind === 'short') classes.push('activity-gen2');
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
    ? EMPTY_SOURCES : resolvePresentationSources(
        hass, d, options.lightDevices || [d], options.lightSources,
        options.registryHass || hass,
      );
  const status = d.bindingStatus;
  const haDisabled = status?.kind === 'ha_disabled';
  const orphaned = status?.kind === 'orphaned';
  const lifecycle: BindingPresentationLifecycle = haDisabled ? 'ha_disabled'
    : orphaned ? 'orphaned' : 'active';
  const userHidden = d.userHidden === true || d.marker?.hidden === true;
  const combined = combineVisualSamples(sources.samples);
  const lockSource = sources.visualSources.find((source) => source.eid.startsWith('lock.'));
  const lockState: DeviceLockState = lockSource
    ? ['unlocked', 'open'].includes(lockSource.state.toLowerCase())
      ? 'unlocked'
      : lockSource.state.toLowerCase() === 'locked' ? 'locked' : null
    : null;
  // A controller mirrors target work, not target connectivity. Its faded
  // state describes only the bound controller; Glow/fill/statistics continue
  // to consume the unchanged target graph.
  // A configured controller remains a controller when every saved target is
  // currently filtered out by a plan tombstone. In that case the source graph
  // is deliberately empty/device-led, but falling back to the event primary
  // would undo #251 and can produce the impossible `unavail` + live LQI face.
  // Manual/owned light and cover faces keep their dedicated availability.
  const configuredController = !isManualVirtualLightMarker(d.marker)
    && persistedExternalControls(
      d.marker?.binding, d.marker?.controls ?? d.controls, d.entities,
    ).length > 0;
  const controllerFace = sources.sourceKind === 'controls'
    || (configuredController && sources.sourceKind !== 'light' && sources.sourceKind !== 'cover');
  const value = staticIcon && options.sourceDetails === false
    ? { source: null, text: null, fallback: null }
    : resolveValue(hass, d, sources, options.showTemperature);
  const sourceSignature = signatureOf(d, sources, value.source);
  const activitySignature = activitySourceSignature(hass, d, sources);
  const rt = options.activityRuntime;
  const now = options.now ?? Date.now();
  const shortExpiresAt = rt?.expiresAt || (rt?.flashTs ? rt.flashTs + ACTIVITY_WINDOW_MS : 0);
  const shortActivity = rt?.sources === activitySignature && rt.flashTs && rt.flashKind
      && shortExpiresAt > now ? rt.flashKind : null;
  const policy = resolveDevicePresentationPolicy({
    bindingLifecycle: lifecycle,
    userHidden,
    designPreview: options.designPreview === true,
    display,
    liveStates: options.liveStates,
    sourceVisual: combined,
    controllerFace,
    // Preserve the ordinary-marker O(1) fast path: controller evidence is
    // scanned only when this marker actually projects external controls.
    controllerAvailability: controllerFace ? controllerAvailability(hass, d) : 'available',
    shortActivity,
    valueAvailable: value.text != null,
    valueFallback: value.fallback,
    vacuumLiveRequested: d.marker?.vacuum?.live === true,
  });
  const { effectiveHidden, visual } = policy;

  const activity = display === 'icon_ripple' && !effectiveHidden
    && options.liveStates && visual.status !== 'alarm' ? visual.activity : 'none';
  const temp = policy.metrics && options.showTemperature
    ? (d.marker?.use_climate_temp === true ? climateTempFor(hass, d.entities)
      : (d.icon === 'mdi:thermometer' || d.icon === 'mdi:air-filter') ? tempFor(hass, d.entities) : null)
    : null;
  // Legacy inline humidity belongs only to a humidity-led marker. A random
  // diagnostic humidity sibling must not turn a composite device into a
  // humidity marker; users can still select that sibling explicitly through
  // the configurable value badge.
  const hum = policy.metrics && options.showTemperature
    && !!d.primary && isHumEntity(hass, d.primary)
    ? humFor(hass, d.entities) : null;
  const lqi = policy.metrics && options.showSignal && !d.virtual ? lqiFor(hass, d.entities) : null;
  const markerStateGraph = options.lightSources || (d.marker?.value_badge?.source?.kind === 'derived_marker_state'
    ? resolvedLightSources(hass, options.lightDevices || [d])
    : []);
  const valueBadge = resolveDeviceValueBadge(hass, d, {
    showTemperature: options.showTemperature,
    showSignal: options.showSignal,
    display,
    effectiveHidden,
    markerStates: markerStateGraph
      .filter((source) => source.key.startsWith('marker:'))
      .map((source) => ({ ref: source.key, on: source.on, name: source.device.name })),
  });
  const realVisualSource = sources.visualSources.find((source) => !source.eid.startsWith('marker:'));
  const actEid = sources.sourceKind === 'cover'
    ? realVisualSource?.eid
    : d.primary || realVisualSource?.eid;
  const state = actEid ? hass?.states?.[actEid] : null;
  const icon = policy.dynamicIcon
    ? stateIcon(d.icon, actEid?.split('.')[0], state?.attributes?.device_class, state?.state, !!d.marker?.icon)
    : d.icon;
  const lightColor = policy.liveColor
    ? sources.visualSources
        .filter((source) => !source.eid.startsWith('marker:'))
        .map((source) => lightColorOf(hass?.states?.[source.eid]))
        .find((color): color is string => !!color) || null
    : null;
  const scale = Number(d.marker?.size) > 0 ? Number(d.marker!.size) : 1;
  const angle = Number(d.marker?.angle) || 0;
  const rippleScale = Number(d.marker?.ripple_size) > 0
    ? Number(d.marker!.ripple_size) : DEVICE_PULSE_DEFAULT_SCALE;
  const configuredRippleColor = safeStoredColor(d.marker?.ripple_color, null);
  const rippleColor = staticIcon ? null : configuredRippleColor || lightColor || null;
  const pulse = resolveDevicePulse({
    display,
    visual,
    semanticActivity: combined.activity,
    shortReason: rt?.sources === activitySignature ? rt?.flashKind : null,
    shortGeneration: rt?.gen,
    shortExpiresAt: rt?.sources === activitySignature ? shortExpiresAt : null,
    now,
    liveStates: options.liveStates,
    effectiveHidden,
    bindingUnavailable: policy.bindingUnavailable,
    reducedMotion: options.reducedMotion,
    color: rippleColor,
    diameterScale: rippleScale,
  });
  const valueText = policy.face === 'value' ? value.text : null;
  const disabledReason = status?.kind === 'ha_disabled' ? status.reason : null;
  const reason = resolvePresentationReason({
    lifecycle,
    display,
    liveStates: options.liveStates,
    sourceKind: sources.sourceKind,
    primaryDomain: (d.primary || '').split('.')[0],
    visual,
    activity,
  });
  const notices: PresentationReason[] = [];
  if (options.designPreview && userHidden) notices.push('hidden_design_preview');
  if (!staticIcon && d.marker?.vacuum?.live === true) notices.push('vacuum_live_plan_only');
  const powerSource = sources.visualSources.some((source) =>
    source.role === 'power_gate' || isDevicePowerSwitch(hass, source.eid),
  );
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
    decisionIds: [
      ...sources.decisionIds,
      ...policy.decisionIds,
      ...(valueBadge ? ['diagnostics.value_badge'] : []),
      ...(lqi == null ? [] : [`diagnostics.lqi_${markerLqiBand(lqi)}`]),
      `pulse.${pulse.kind}_${pulse.reason}`,
    ],
    visual,
    lockState,
    display,
    icon,
    valueText,
    valueFullText: valueText,
    fallbackReason: display === 'value' && !valueText ? value.fallback : null,
    activity,
    activityGeneration: rt?.gen || 1,
    pulse,
    classes: [],
    tempText: temp == null ? null : String(temp),
    humText: hum == null ? null : String(hum),
    valueBadge,
    lqiText: lqi == null || valueBadge?.isLqi ? null : String(lqi),
    lqiColor: lqi == null ? null : markerLqiColor(lqi),
    lqiBand: lqi == null ? null : markerLqiBand(lqi),
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
    vacuumLive: policy.vacuumLive,
    explanation: { reason, notices },
  };
  return { ...presentation, classes: presentationClasses(presentation) };
}
