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

export function valueBadgeSourceKey(source: ValueBadgeSource | null | undefined): string {
  if (!source) return '';
  if (source.kind === 'entity_state') return `state:${source.entity_id}`;
  if (source.kind === 'entity_attribute') return `attr:${source.entity_id}:${source.attribute}`;
  if (source.kind === 'derived_marker_state') return `marker:${source.ref}`;
  return 'derived:lqi';
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

function resolveSource(
  hass: any, d: DevItem, source: ValueBadgeSource,
  markerStates: readonly { ref: string; on: boolean; name: string }[] = [],
): Omit<ResolvedValueBadge, 'configured' | 'enabled' | 'position'> {
  let text: string | null = null;
  let label = '';
  let availability: ResolvedValueBadge['availability'] = 'available';
  if (source.kind === 'entity_state') {
    label = entityName(hass, source.entity_id);
    const st = hass?.states?.[source.entity_id];
    if (!st) availability = 'missing';
    else if (!sourceRegistryEnabled(hass, source.entity_id)) availability = 'unavailable';
    else if (['unknown', 'unavailable'].includes(String(st.state).toLowerCase())) availability = 'unavailable';
    else {
      const value = hassValue(hass, source.entity_id);
      text = value ? valueWithUnit(value, String(st.attributes?.unit_of_measurement || '')) : null;
      if (!text) availability = 'unavailable';
    }
  } else if (source.kind === 'entity_attribute') {
    label = `${attrLabel(source.attribute)} · ${entityName(hass, source.entity_id)}`;
    const st = hass?.states?.[source.entity_id];
    if (!st) availability = 'missing';
    else if (!sourceRegistryEnabled(hass, source.entity_id)) availability = 'unavailable';
    else {
      text = formatAttribute(hass, source.entity_id, source.attribute);
      if (text == null) availability = 'unavailable';
    }
  } else if (source.kind === 'derived_lqi') {
    label = 'LQI';
    const lqi = lqiFor(hass, d.entities);
    if (lqi == null) availability = 'unavailable';
    else text = String(lqi);
  } else {
    label = 'Light state';
    const match = markerStates.find((item) => item.ref === source.ref);
    if (!match) availability = 'missing';
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
  };
}

function legacySource(hass: any, d: DevItem): ValueBadgeSource | null {
  if (d.marker?.use_climate_temp === true) {
    const eid = d.entities.find((id) => id.startsWith('climate.')
      && Number.isFinite(Number(hass?.states?.[id]?.attributes?.current_temperature)));
    if (eid) return { kind: 'entity_attribute', entity_id: eid, attribute: 'current_temperature' };
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
    if (!stored?.enabled || !stored.source) return null;
    return {
      configured: true, enabled: true, position: stored.position || 'right',
      ...resolveSource(hass, d, stored.source, options.markerStates),
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
    const resolved = resolveSource(hass, d, source, markerStates);
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
