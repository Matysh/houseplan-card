/** The existing HA owner index supplies eligibility, never names or state guesses. */
import { alertNumber, ALERT_TEXT_LIMIT, type MarkerThresholdAlert } from './marker-alert';
import { markerStateSourceCandidates, stateSourceOwnership, type StateSourceFailure, type StateSourceHass } from './marker-state-source';
import type { AlertRead } from './marker-alert-runtime';
import type { DevItem } from './types';

export interface AlertStateRow {
  state?: unknown;
  attributes?: Readonly<Record<string, unknown>>;
}
export interface MarkerAlertHass extends StateSourceHass {
  states?: Readonly<Record<string, AlertStateRow | undefined>>;
}
export interface AlertOption { value: string; label: string }
export interface AlertValueControl {
  kind: 'enum' | 'number' | 'text' | 'unknown' | 'unsupported';
  options: readonly AlertOption[];
}
export interface MarkerAlertField {
  key: string; entityId: string; attribute?: string; name: string;
  value: unknown; unit: string; control: AlertValueControl;
}
const BINARY = new Set(['binary_sensor', 'switch', 'input_boolean']);
const UNKNOWN = new Set(['', 'unknown', 'unavailable']);
const validText = (value: unknown): value is string => typeof value === 'string' && value.length > 0
  && [...value].length <= ALERT_TEXT_LIMIT && !/[\r\n]/.test(value);
const bindingOf = (device: DevItem) => device.marker?.binding
  || (device.virtual ? 'virtual' : `${device.bindingKind}:${device.bindingRef}`);

export function markerAlertOwnership(registry: StateSourceHass, device: DevItem, eid: string): StateSourceFailure | null {
  const binding = bindingOf(device);
  if (device.virtual || binding === 'virtual') return 'virtual';
  if (device.marker?.removed || device.bindingStatus?.kind !== 'active') return 'invalid';
  if (binding.startsWith('entity:') && binding.slice(7) !== eid) return 'foreign';
  return stateSourceOwnership(binding, eid, registry);
}

/** State enums are declared HA options. Attribute paths and guessed history do not exist. */
export function markerAlertValueControl(hass: MarkerAlertHass, eid: string, row: AlertStateRow | undefined, attribute?: string): AlertValueControl {
  const attrs = row?.attributes, raw = attribute === undefined ? row?.state : attrs?.[attribute];
  const domain = eid.split('.')[0];
  const binary = attribute === undefined && BINARY.has(domain);
  const enumerated = attribute === undefined && (binary || domain === 'select' || domain === 'input_select'
    || attrs?.device_class === 'enum' || Array.isArray(attrs?.options));
  if (enumerated) {
    const declared = binary ? ['on', 'off'] : Array.isArray(attrs?.options) ? attrs.options.filter(validText) : [];
    const options = [...new Set([...declared, 'unknown', 'unavailable'])].map(value => {
      let label = value;
      if (row && hass.formatEntityState) {
        try { label = hass.formatEntityState({ ...row, state: value }) || value; } catch { /* Literal HA option is the safe fallback. */ }
      }
      return { value, label };
    });
    return { kind: 'enum', options };
  }
  if (alertNumber(raw) !== null) return { kind: 'number', options: [] };
  if (raw == null || typeof raw === 'string' && UNKNOWN.has(raw)) return { kind: 'unknown', options: [] };
  return { kind: typeof raw === 'string' ? 'text' : 'unsupported', options: [] };
}

const sourceName = (registry: StateSourceHass, eid: string, row: AlertStateRow | undefined) => {
  const meta = registry.entities?.[eid];
  return String(meta?.name || meta?.original_name || row?.attributes?.friendly_name || eid);
};

export function readMarkerAlertSource(hass: MarkerAlertHass, registry: StateSourceHass, device: DevItem, rule: MarkerThresholdAlert): AlertRead {
  if (markerAlertOwnership(registry, device, rule.entity_id)) return { permitted: false };
  const row = hass.states?.[rule.entity_id];
  const control = markerAlertValueControl(hass, rule.entity_id, row, rule.attribute);
  let value = rule.attribute === undefined ? row?.state : row?.attributes?.[rule.attribute];
  if (control.kind === 'enum' && (rule.operator !== 'eq' && rule.operator !== 'ne'
      || typeof rule.value !== 'string' || !control.options.some(option => option.value === rule.value))) value = undefined;
  return { permitted: true, value, name: sourceName(registry, rule.entity_id, row),
    unit: rule.attribute === undefined && typeof row?.attributes?.unit_of_measurement === 'string' ? row.attributes.unit_of_measurement : '' };
}

/** Editor-only field inventory; the shared owner index is cached per registry. */
export function markerAlertFields(hass: MarkerAlertHass, registry: StateSourceHass, device: DevItem): readonly MarkerAlertField[] {
  const binding = bindingOf(device);
  const ids = binding.startsWith('entity:') ? [binding.slice(7)] : markerStateSourceCandidates(binding, registry);
  const fields: MarkerAlertField[] = [];
  for (const eid of ids) {
    if (markerAlertOwnership(registry, device, eid)) continue;
    const row = hass.states?.[eid], name = sourceName(registry, eid, row);
    const append = (attribute?: string) => fields.push({ key: JSON.stringify([eid, attribute ?? null]), entityId: eid,
      ...(attribute !== undefined ? { attribute } : {}), name,
      value: attribute === undefined ? row?.state : row?.attributes?.[attribute],
      unit: attribute === undefined && typeof row?.attributes?.unit_of_measurement === 'string' ? row.attributes.unit_of_measurement : '',
      control: markerAlertValueControl(hass, eid, row, attribute) });
    append();
    for (const [attribute, value] of Object.entries(row?.attributes || {})) {
      if (validText(attribute) && attribute.trim() && (typeof value === 'string' || typeof value === 'number' && Number.isFinite(value))) append(attribute);
    }
  }
  return fields;
}
