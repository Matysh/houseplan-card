/** #977: ordinary activity only. Never an action/light/availability source. */
import { entityVisualSample, applianceLifecycleVisualSample, isApplianceLifecycleEntity,
  type EntityVisualSample } from './device-visual';
import type { DevItem, Marker, MarkerStateSource } from './types';

interface RegistryEntity {
  readonly device_id?: string | null;
  readonly disabled_by?: unknown;
  readonly name?: string | null;
  readonly original_name?: string | null;
}
interface StateRow {
  readonly state?: unknown;
  readonly attributes?: Readonly<Record<string, unknown>>;
}
export interface StateSourceHass {
  readonly entities?: Readonly<Record<string, RegistryEntity | undefined>>;
  readonly devices?: Readonly<Record<string, { readonly disabled_by?: unknown } | undefined>>;
  readonly states?: Readonly<Record<string, StateRow | undefined>>;
  readonly formatEntityState?: (state: StateRow) => string;
}
export type StateSourceFailure = 'pending' | 'missing' | 'foreign' | 'disabled' | 'unknown' | 'invalid' | 'virtual';
export interface ResolvedMarkerStateSource {
  readonly entityId: string;
  readonly name: string;
  readonly state: string;
  readonly stateText: string;
  readonly failure: StateSourceFailure | null;
  readonly explicitStates: boolean;
  readonly protected: boolean;
  readonly sample: EntityVisualSample;
  readonly alarmSample?: EntityVisualSample;
  /** Excludes state values: a real edge must survive until activity-runtime sees it. */
  readonly signature: string;
}
export const STATE_SOURCE_MAX_STATES = 32;
export const STATE_SOURCE_MAX_LENGTH = 255;
const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const UNKNOWN = new Set(['', 'unknown', 'unavailable', '__missing__']);

export function normalizeMarkerStateSource(raw: unknown): MarkerStateSource | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  if (typeof source.entity_id !== 'string' || !ENTITY_ID.test(source.entity_id)) return null;
  if (source.active_states === undefined) return { ...source, entity_id: source.entity_id };
  if (!Array.isArray(source.active_states)) return null;
  const states: string[] = [];
  for (const value of source.active_states) {
    if (typeof value !== 'string') return null;
    const state = value.trim();
    if (!state || [...state].length > STATE_SOURCE_MAX_LENGTH || /[\r\n]/.test(value)
        || UNKNOWN.has(state.toLowerCase())) return null;
    if (!states.includes(state)) states.push(state);
  }
  if (!states.length || states.length > STATE_SOURCE_MAX_STATES) return null;
  return { ...source, entity_id: source.entity_id, active_states: states };
}

function bindingOf(device: Pick<DevItem, 'marker' | 'bindingKind' | 'bindingRef' | 'virtual'>): string {
  return device.marker?.binding || (device.virtual ? 'virtual' : `${device.bindingKind}:${device.bindingRef}`);
}

/** O(1), rechecked on every resolution, even for imported/copied config. */
export function stateSourceOwnership(binding: string, eid: string, registry: StateSourceHass): StateSourceFailure | null {
  if (binding === 'virtual') return 'virtual';
  const entity = registry.entities?.[eid];
  const ownEntity = binding.startsWith('entity:') ? binding.slice(7) : '';
  const owner = binding.startsWith('device:') ? binding.slice(7) : registry.entities?.[ownEntity]?.device_id;
  if (eid !== ownEntity) {
    if (!registry.entities) return 'pending';
    if (!entity) return 'missing';
    if (!owner || entity.device_id !== owner) return 'foreign';
  }
  const parent = entity?.device_id ? registry.devices?.[entity.device_id] : undefined;
  if (entity?.disabled_by != null || parent?.disabled_by != null) return 'disabled';
  return null;
}

const ownerCache = new WeakMap<NonNullable<StateSourceHass['entities']>, Map<string, string[]>>();
/** Only editor candidate enumeration scans registry, once per registry identity. */
export function markerStateSourceCandidates(binding: string, registry: StateSourceHass): string[] {
  if (binding === 'virtual') return [];
  const entities = registry.entities;
  const ownEntity = binding.startsWith('entity:') ? binding.slice(7) : '';
  const owner = binding.startsWith('device:') ? binding.slice(7) : entities?.[ownEntity]?.device_id;
  let index = entities && ownerCache.get(entities);
  if (entities && !index) {
    index = new Map();
    for (const [eid, row] of Object.entries(entities)) {
      if (!row?.device_id) continue;
      const list = index.get(row.device_id) || [];
      list.push(eid); index.set(row.device_id, list);
    }
    for (const list of index.values()) list.sort();
    ownerCache.set(entities, index);
  }
  const ids = new Set(owner ? index?.get(owner) || [] : []);
  if (ownEntity) ids.add(ownEntity);
  return [...ids].filter(eid => ENTITY_ID.test(eid) && !stateSourceOwnership(binding, eid, registry)).sort();
}

export function resolveMarkerStateSource(
  hass: StateSourceHass, registry: StateSourceHass, device: DevItem, protectedFace: boolean,
): ResolvedMarkerStateSource | null {
  const raw = device.marker?.state_source;
  if (raw == null) return null;
  const source = normalizeMarkerStateSource(raw);
  const binding = bindingOf(device);
  const eid = source?.entity_id || '';
  let failure: StateSourceFailure | null = source ? stateSourceOwnership(binding, eid, registry) : 'invalid';
  // Fail closed before reading another device's state or even its friendly name.
  const row = !failure ? hass.states?.[eid] : undefined;
  const state = row?.state == null ? '' : String(row.state);
  if (!failure && !row) failure = 'missing';
  if (!failure && UNKNOWN.has(state.trim().toLowerCase())) failure = 'unknown';
  const meta = !failure ? registry.entities?.[eid] : undefined;
  const name = String(meta?.name || meta?.original_name || row?.attributes?.friendly_name || eid);
  let stateText = state;
  if (row && hass.formatEntityState) {
    try { stateText = hass.formatEntityState(row) || state; } catch { /* raw HA state remains usable */ }
  }
  let sample: EntityVisualSample = { eid, state, availability: 'available', status: 'neutral', activity: 'none', edge: 'none' };
  let alarmSample: EntityVisualSample | undefined;
  if (!failure) {
    const visualHass = { ...hass, entities: registry.entities };
    const canonical = isApplianceLifecycleEntity(visualHass, eid)
      ? applianceLifecycleVisualSample(visualHass, eid) : entityVisualSample(visualHass, eid);
    if (canonical.status === 'alarm') alarmSample = canonical;
    if (source?.active_states) {
      if (source.active_states.includes(state)) sample = { ...sample, status: 'working', activity: 'running' };
    } else {
      sample = canonical;
      // Ordinary activity cannot create a new door/lock/alarm face.
      if (sample.status === 'open' || sample.status === 'alarm') sample = { ...sample, status: 'neutral' };
    }
  }
  return { entityId: eid, name, state, stateText, failure, explicitStates: !!source?.active_states,
    protected: protectedFace, sample, ...(alarmSample ? { alarmSample } : {}),
    signature: JSON.stringify([binding, eid, registry.entities?.[eid]?.device_id || '', source?.active_states,
      protectedFace, failure && failure !== 'unknown' ? failure : null]),
  };
}

export interface MarkerStateSourceDraft {
  stateSource?: Marker['state_source'];
  stateSourceTouched?: boolean;
}
export function markerStateSourceFields(draft: MarkerStateSourceDraft): Pick<Marker, 'state_source'> {
  if (draft.stateSourceTouched) {
    const source = normalizeMarkerStateSource(draft.stateSource);
    return source ? { state_source: source } : {};
  }
  return draft.stateSource === undefined ? {} : { state_source: draft.stateSource };
}
