import {
  climateTempFor, humFor, isHumEntity, isTempEntity, lqiFor, resolvedLightSources, tempFor,
} from './devices';
import { isRegistryEntryEnabled } from './ha-binding-status';
import { hassValue, valueWithUnit } from './logic';
import type {
  DevItem, MarkerValueBadge, ValueBadgePosition, ValueBadgeSource,
} from './types';

export const VALUE_BADGE_ATTRIBUTES: Record<string, readonly string[]> = {
  climate: ['current_temperature', 'temperature', 'current_humidity', 'humidity'],
  water_heater: ['current_temperature', 'temperature'],
  cover: ['current_position'],
  valve: ['current_position'],
  fan: ['percentage'],
  humidifier: ['current_humidity', 'humidity'],
  light: ['brightness'],
  media_player: ['volume_level'],
  vacuum: ['battery_level', 'fan_speed'],
  lawn_mower: ['battery_level', 'fan_speed'],
};

export interface ResolvedValueBadge {
  configured: boolean;
  enabled: boolean;
  source: ValueBadgeSource | null;
  sourceLabel: string;
  text: string;
  fullText: string;
  position: ValueBadgePosition;
  availability: 'available' | 'unavailable' | 'missing';
  isLqi: boolean;
  tone: 'temperature' | 'humidity' | 'lqi' | 'default';
  /** Why the configured source could not produce a scalar value. */
  failure: 'missing' | 'non_scalar' | null;
}

export interface ValueBadgeCandidate {
  key: string;
  source: ValueBadgeSource;
  label: string;
  technical: string;
  value: string;
  available: boolean;
}

export interface ResolveValueBadgeOptions {
  showTemperature: boolean;
  showSignal: boolean;
  display: string;
  effectiveHidden: boolean;
  /** Canonical marker:* states already projected by presentation/light graph. */
  markerStates?: readonly { ref: string; on: boolean; name: string }[];
}

export function valueBadgeTitle(badge: ResolvedValueBadge | null | undefined): string {
  if (!badge) return '';
  return badge.sourceLabel ? `${badge.sourceLabel}: ${badge.fullText}` : badge.fullText;
}

interface CandidateCacheEntry {
  states: object | null;
  entities: object | null;
  devices: object | null;
  signature: string;
  result: ValueBadgeCandidate[];
}

/**
 * The device dialog renders on every HA state frame.  Candidate discovery is
 * plan-wide (derived marker values need the light graph), so keep the result
 * while the HA registry/state snapshots and the relevant marker wiring are
 * unchanged. Home Assistant replaces these snapshots on state/registry
 * updates; the structural signature also catches local draft edits made in
 * place before the next HA frame.
 */
const CANDIDATE_CACHE = new WeakMap<object, CandidateCacheEntry>();

function candidateSignature(d: DevItem, lightDevices: readonly DevItem[]): string {
  const devicePart = (item: DevItem): string => [
    item.id, item.primary, item.hidden ? 1 : 0, item.userHidden ? 1 : 0,
    item.entities.join(','), (item.controls || []).join(','),
    item.marker?.binding || '', item.marker?.is_light === true ? 1 : 0,
    item.marker?.light_entity || '',
    (item.marker?.controls || []).join(','),
  ].join('|');
  return `${devicePart(d)}\n${lightDevices.map(devicePart).join('\n')}`;
}

export function valueBadgeSourceKey(source: ValueBadgeSource | null | undefined): string {
  if (!source) return '';
  if (source.kind === 'entity_state') return `state:${source.entity_id}`;
  if (source.kind === 'entity_attribute') return `attr:${source.entity_id}:${source.attribute}`;
  if (source.kind === 'derived_marker_state') return `marker:${source.ref}`;
  if (source.kind === 'derived_lqi') return 'derived:lqi';
  return '';
}

export function valueBadgeSourceFromKey(key: string): ValueBadgeSource | null {
  if (key === 'derived:lqi') return { kind: 'derived_lqi' };
  if (key.startsWith('state:')) return { kind: 'entity_state', entity_id: key.slice(6) };
  if (key.startsWith('attr:')) {
    const rest = key.slice(5);
    const split = rest.lastIndexOf(':');
    if (split > 0) return {
      kind: 'entity_attribute', entity_id: rest.slice(0, split), attribute: rest.slice(split + 1),
    };
  }
  if (key.startsWith('marker:marker:')) {
    return { kind: 'derived_marker_state', ref: key.slice(7) as `marker:${string}` };
  }
  return null;
}

function entityName(hass: any, entityId: string): string {
  const reg = hass?.entities?.[entityId];
  const st = hass?.states?.[entityId];
  return String(reg?.name || reg?.original_name || st?.attributes?.friendly_name || entityId);
}

function attrLabel(attribute: string): string {
  return attribute.replaceAll('_', ' ');
}

function numericPercent(value: unknown, scale = 1): string | null {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n * scale)} %` : null;
}

function formatAttribute(hass: any, entityId: string, attribute: string): string | null {
  const st = hass?.states?.[entityId];
  if (!st || !(attribute in (st.attributes || {}))) return null;
  const formatted = hassValue(hass, entityId, attribute);
  if (formatted?.formatted) return formatted.text;
  const raw = st.attributes?.[attribute];
  if (attribute === 'brightness') return numericPercent(raw, 100 / 255);
  if (attribute === 'volume_level') return numericPercent(raw, 100);
  if ([
    'current_position', 'percentage', 'current_humidity', 'humidity', 'battery_level',
  ].includes(attribute)) return numericPercent(raw);
  if (attribute === 'current_temperature' || attribute === 'temperature') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const unit = String(hass?.config?.unit_system?.temperature || '°C');
    return `${Math.round(n * 10) / 10} ${unit}`;
  }
  return formatted?.text || (['string', 'number', 'boolean'].includes(typeof raw) ? String(raw) : null);
}

function sourceTone(source: ValueBadgeSource): ResolvedValueBadge['tone'] {
  if (source.kind === 'derived_lqi') return 'lqi';
  if (source.kind === 'entity_attribute') {
    if (source.attribute.includes('temperature')) return 'temperature';
    if (source.attribute.includes('humidity')) return 'humidity';
  }
  return 'default';
}

export function resolveValueSource(
  hass: any, d: DevItem, source: ValueBadgeSource,
  markerStates: readonly { ref: string; on: boolean; name: string }[] = [],
): Omit<ResolvedValueBadge, 'configured' | 'enabled' | 'position'> {
  let text: string | null = null;
  let label = '';
  let availability: ResolvedValueBadge['availability'] = 'available';
  let failure: ResolvedValueBadge['failure'] = null;
  if (source.kind === 'entity_state') {
    label = entityName(hass, source.entity_id);
    const st = hass?.states?.[source.entity_id];
    if (!st) {
      availability = 'missing';
      failure = 'missing';
    } else if (!sourceRegistryEnabled(hass, source.entity_id)) {
      availability = 'unavailable';
      failure = 'missing';
    } else if (!['string', 'number', 'boolean'].includes(typeof st.state)) {
      availability = 'unavailable';
      failure = 'non_scalar';
    } else if (['unknown', 'unavailable'].includes(String(st.state).toLowerCase())) {
      availability = 'unavailable';
      failure = 'missing';
    }
    else {
      const value = hassValue(hass, source.entity_id);
      text = value ? valueWithUnit(value, String(st.attributes?.unit_of_measurement || '')) : null;
      if (!text) {
        availability = 'unavailable';
        failure = 'missing';
      }
    }
  } else if (source.kind === 'entity_attribute') {
    label = `${attrLabel(source.attribute)} · ${entityName(hass, source.entity_id)}`;
    const st = hass?.states?.[source.entity_id];
    const hasAttribute = !!st && source.attribute in (st.attributes || {});
    const raw = hasAttribute ? st.attributes?.[source.attribute] : undefined;
    if (!st) {
      availability = 'missing';
      failure = 'missing';
    } else if (!sourceRegistryEnabled(hass, source.entity_id)) {
      availability = 'unavailable';
      failure = 'missing';
    } else if (['unknown', 'unavailable'].includes(String(st.state).toLowerCase())) {
      availability = 'unavailable';
      failure = 'missing';
    } else if (!hasAttribute) {
      availability = 'unavailable';
      failure = 'missing';
    } else if (!['string', 'number', 'boolean'].includes(typeof raw)) {
      availability = 'unavailable';
      failure = 'non_scalar';
    }
    else {
      text = formatAttribute(hass, source.entity_id, source.attribute);
      if (text == null) {
        availability = 'unavailable';
        failure = 'missing';
      }
    }
  } else if (source.kind === 'derived_lqi') {
    label = 'LQI';
    const lqi = lqiFor(hass, d.entities);
    if (lqi == null) {
      availability = 'unavailable';
      failure = 'missing';
    }
    else text = String(lqi);
  } else {
    label = 'Light state';
    const match = markerStates.find((item) => item.ref === source.ref);
    if (!match) {
      availability = 'missing';
      failure = 'missing';
    }
    else {
      const state = match.on ? 'on' : 'off';
      const loc = hass?.localize?.(`state.default.${state}`);
      text = typeof loc === 'string' && loc ? loc : state;
      label = match.name || label;
    }
  }
  const unavailableText = hass?.localize?.('state.default.unavailable') || 'Unavailable';
  return {
    source,
    sourceLabel: label,
    text: text ?? '—',
    fullText: text ?? unavailableText,
    availability,
    isLqi: source.kind === 'derived_lqi',
    tone: sourceTone(source),
    failure,
  };
}

function legacySource(hass: any, d: DevItem): ValueBadgeSource | null {
  if (d.marker?.use_climate_temp === true) {
    const eid = d.entities.find((id) => id.startsWith('climate.')
      && Number.isFinite(Number(hass?.states?.[id]?.attributes?.current_temperature)));
    if (eid) return { kind: 'entity_attribute', entity_id: eid, attribute: 'current_temperature' };
    // This explicit legacy flag never fell through to a thermometer/humidity
    // heuristic. Preserve that contract when the climate attribute is absent.
    return null;
  }
  if (d.icon === 'mdi:thermometer' || d.icon === 'mdi:air-filter') {
    const eid = d.entities.find((id) => isTempEntity(hass, id)
      && Number.isFinite(Number(hass?.states?.[id]?.state)));
    if (eid) return { kind: 'entity_state', entity_id: eid };
  }
  if (d.primary && isHumEntity(hass, d.primary)
      && Number.isFinite(Number(hass?.states?.[d.primary]?.state))) {
    return { kind: 'entity_state', entity_id: d.primary };
  }
  return null;
}

export function resolveDeviceValueBadge(
  hass: any, d: DevItem, options: ResolveValueBadgeOptions,
): ResolvedValueBadge | null {
  const configured = d.marker?.value_badge != null;
  if (options.effectiveHidden || options.display === 'static_icon') return null;
  const stored = d.marker?.value_badge;
  if (configured) {
    if (!stored?.enabled) return null;
    // Delta validation prevents newly written enabled badges without a source,
    // but old/future documents must remain renderable and lossless. An
    // incomplete explicit badge is visible as an unavailable value instead of
    // silently disappearing from the plan.
    if (!stored.source) return {
      configured: true,
      enabled: true,
      source: null,
      sourceLabel: '',
      text: '—',
      fullText: hass?.localize?.('state.default.unavailable') || 'Unavailable',
      position: stored.position || 'right',
      availability: 'missing',
      isLqi: false,
      tone: 'default',
      failure: 'missing',
    };
    return {
      configured: true, enabled: true, position: stored.position || 'right',
      ...resolveValueSource(hass, d, stored.source, options.markerStates),
    };
  }
  if (!options.showTemperature || options.display === 'value') return null;
  const source = legacySource(hass, d);
  if (!source) return null;
  let legacyText: string | null = null;
  let tone: ResolvedValueBadge['tone'] = 'default';
  if (source.kind === 'entity_attribute' && source.attribute === 'current_temperature') {
    const n = climateTempFor(hass, d.entities);
    if (n != null) legacyText = `${n}°`;
    tone = 'temperature';
  } else if (d.icon === 'mdi:thermometer' || d.icon === 'mdi:air-filter') {
    const n = tempFor(hass, d.entities);
    if (n != null) legacyText = `${n}°`;
    tone = 'temperature';
  } else {
    const n = humFor(hass, d.entities);
    if (n != null) legacyText = `${n}%`;
    tone = 'humidity';
  }
  if (legacyText == null) return null;
  return {
    configured: false, enabled: true, source, position: 'right',
    sourceLabel: source.kind === 'entity_attribute'
      ? `${attrLabel(source.attribute)} · ${entityName(hass, source.entity_id)}`
      : source.kind === 'entity_state' ? entityName(hass, source.entity_id) : '',
    text: legacyText, fullText: legacyText, availability: 'available', isLqi: false, tone,
    failure: null,
  };
}

function sourceRegistryEnabled(hass: any, entityId: string): boolean {
  const reg = hass?.entities?.[entityId];
  if (reg && !isRegistryEntryEnabled(reg)) return false;
  const parent = reg?.device_id ? hass?.devices?.[reg.device_id] : null;
  return !parent || isRegistryEntryEnabled(parent);
}

function activeEntity(hass: any, entityId: string): boolean {
  return sourceRegistryEnabled(hass, entityId) && !!hass?.states?.[entityId];
}

export function valueBadgeCandidates(
  hass: any, d: DevItem, lightDevices: readonly DevItem[] = [d],
): ValueBadgeCandidate[] {
  const signature = candidateSignature(d, lightDevices);
  const cached = CANDIDATE_CACHE.get(d as object);
  if (cached
    && cached.states === (hass?.states || null)
    && cached.entities === (hass?.entities || null)
    && cached.devices === (hass?.devices || null)
    && cached.signature === signature) return cached.result;
  const entityIds = new Set<string>(d.entities);
  for (const ref of d.controls || []) if (!ref.startsWith('marker:')) entityIds.add(ref);
  const candidates: ValueBadgeCandidate[] = [];
  const lightGraph = resolvedLightSources(hass, lightDevices);
  const markerStates = lightGraph
    .filter((source) => source.key.startsWith('marker:'))
    .map((source) => ({ ref: source.key, on: source.on, name: source.device?.name || source.key }));
  const add = (source: ValueBadgeSource): void => {
    const key = valueBadgeSourceKey(source);
    if (candidates.some((item) => item.key === key)) return;
    const resolved = resolveValueSource(hass, d, source, markerStates);
    const technical = source.kind === 'entity_attribute'
      ? `${source.entity_id} · ${source.attribute}`
      : source.kind === 'entity_state' ? source.entity_id
      : source.kind === 'derived_marker_state' ? source.ref : 'LQI';
    candidates.push({
      key, source, label: resolved.sourceLabel, technical,
      value: resolved.text, available: resolved.availability === 'available',
    });
  };
  for (const entityId of [...entityIds].sort()) {
    if (!activeEntity(hass, entityId)) continue;
    const domain = entityId.split('.')[0];
    const reg = hass?.entities?.[entityId];
    if (domain === 'button' || domain === 'event' || reg?.entity_category === 'config') continue;
    add({ kind: 'entity_state', entity_id: entityId });
    const st = hass?.states?.[entityId];
    for (const attribute of VALUE_BADGE_ATTRIBUTES[domain] || []) {
      if (attribute in (st?.attributes || {})) add({ kind: 'entity_attribute', entity_id: entityId, attribute });
    }
  }
  const refs = new Set((d.marker?.controls || d.controls || []).filter((ref) => ref.startsWith('marker:')));
  if (d.marker?.is_light === true && d.marker.id) refs.add(`marker:${d.marker.id}`);
  const lightKeys = new Set(lightGraph.map((source) => source.key));
  for (const ref of [...refs].sort()) {
    if (lightKeys.has(ref as `marker:${string}`)) add({ kind: 'derived_marker_state', ref: ref as `marker:${string}` });
  }
  if (!d.virtual && lqiFor(hass, d.entities) != null) add({ kind: 'derived_lqi' });
  CANDIDATE_CACHE.set(d as object, {
    states: hass?.states || null,
    entities: hass?.entities || null,
    devices: hass?.devices || null,
    signature,
    result: candidates,
  });
  return candidates;
}

export function recommendedValueBadgeSource(
  hass: any, d: DevItem, candidates: readonly ValueBadgeCandidate[],
): ValueBadgeSource | null {
  const legacy = legacySource(hass, d);
  if (legacy && candidates.some((item) => item.key === valueBadgeSourceKey(legacy))) return legacy;
  const primary = d.primary && candidates.find((item) => item.key === `state:${d.primary}`);
  if (primary) return primary.source;
  const ranked = [
    (item: ValueBadgeCandidate) => item.technical.includes('temperature'),
    (item: ValueBadgeCandidate) => item.technical.includes('humidity'),
    (item: ValueBadgeCandidate) => item.technical.includes('battery'),
  ];
  for (const match of ranked) {
    const item = candidates.find(match);
    if (item) return item.source;
  }
  return candidates.find((item) => item.source.kind !== 'derived_lqi')?.source
    || candidates[0]?.source || null;
}

/** Pure persistence gate: opening/saving another field must not migrate legacy data. */
export function valueBadgeWriteFields(options: {
  touched: boolean;
  originalHas: boolean;
  original: MarkerValueBadge | null | undefined;
  enabled: boolean;
  source: ValueBadgeSource | null;
  position: ValueBadgePosition;
}): { value_badge?: MarkerValueBadge | null } {
  if (!options.touched) {
    return options.originalHas ? { value_badge: options.original } : {};
  }
  return {
    value_badge: {
      enabled: options.enabled,
      source: options.source,
      position: options.position,
    },
  };
}

/** Pure persistence gate for the value face; auto is represented by absence. */
export function valueSourceWriteFields(options: {
  touched: boolean;
  originalHas: boolean;
  original: ValueBadgeSource | null | undefined;
  source: ValueBadgeSource | null;
}): { value_source?: ValueBadgeSource | null } {
  if (!options.touched) {
    return options.originalHas ? { value_source: options.original } : {};
  }
  return options.source ? { value_source: options.source } : {};
}
