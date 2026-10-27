/** HA dialog targets are independent of measurements, icon state and controls. */
import { DEVICE_STATE_DOMAINS, resolvedDeviceStateEntities } from './devices';
import { isControllable } from './logic';
import type { DevItem } from './types';

interface EntityRow {
  readonly device_id?: string | null;
  readonly disabled_by?: unknown;
  readonly hidden?: boolean;
  readonly entity_category?: string | null;
  readonly name?: string | null;
}
export interface MoreInfoHass {
  readonly entities?: Readonly<Record<string, EntityRow | undefined>>;
  readonly devices?: Readonly<Record<string, { readonly disabled_by?: unknown } | undefined>>;
  readonly states?: Readonly<Record<string, { readonly state?: unknown; readonly attributes?: Readonly<Record<string, unknown>> } | undefined>>;
}
type MoreInfoDevice = Pick<DevItem, 'marker' | 'bindingKind' | 'bindingRef' | 'virtual' | 'primary' | 'entities' | 'bindingStatus'>;
export type MoreInfoFailure = 'virtual' | 'invalid' | 'missing' | 'foreign' | 'disabled' | 'unverified';
export interface MoreInfoTarget {
  entityId?: string;
  failure?: MoreInfoFailure;
  explicit: boolean;
}
const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

function bindingOf(device: MoreInfoDevice): string {
  return device.marker?.binding || (device.virtual ? 'virtual' : `${device.bindingKind}:${device.bindingRef || ''}`);
}

/** Ownership precedes state/name reads; YAML entity bindings need no registry row. */
export function moreInfoEntityFailure(binding: string, entityId: string, registry: MoreInfoHass): MoreInfoFailure | undefined {
  if (binding === 'virtual') return 'virtual';
  if (!ENTITY_ID.test(entityId)) return 'invalid';
  const row = registry.entities?.[entityId];
  if (binding.startsWith('entity:')) {
    if (entityId !== binding.slice(7)) return 'foreign';
  } else if (binding.startsWith('device:') && binding.slice(7)) {
    const owner = binding.slice(7);
    const parent = registry.devices?.[owner];
    if (!parent) return 'missing';
    if (parent.disabled_by != null) return 'disabled';
    if (!row) return 'missing';
    if (row.device_id !== owner) return 'foreign';
  } else return 'invalid';
  if (row?.disabled_by != null) return 'disabled';
  if (row?.device_id) {
    const parent = registry.devices?.[row.device_id];
    if (!parent) return 'missing';
    if (parent.disabled_by != null) return 'disabled';
  }
  return undefined;
}

/** Bounded by the already-built own roster, never a full HA registry scan. */
export function moreInfoEntityCandidates(device: MoreInfoDevice, registry: MoreInfoHass): string[] {
  const binding = bindingOf(device);
  const ids = binding.startsWith('entity:') ? [binding.slice(7)] : device.entities;
  return [...new Set(ids)].filter(id => !moreInfoEntityFailure(binding, id, registry));
}

export function resolveDeviceMoreInfoTarget(hass: MoreInfoHass, registry: MoreInfoHass, device: MoreInfoDevice): MoreInfoTarget {
  const binding = bindingOf(device);
  const exact = binding.startsWith('entity:') ? binding.slice(7) : '';
  const raw = exact ? null : device.marker?.more_info_entity;
  const explicit = raw != null;
  if (binding === 'virtual') return { failure: 'virtual', explicit };
  if (device.bindingStatus && device.bindingStatus.kind !== 'active') {
    return { failure: device.bindingStatus.kind === 'ha_disabled' ? 'disabled' : 'unverified', explicit };
  }
  let entityId: string | undefined;
  if (exact) entityId = exact;
  else if (explicit) {
    if (typeof raw !== 'string' || !ENTITY_ID.test(raw)) return { failure: 'invalid', explicit };
    entityId = raw;
  } else {
    const own = moreInfoEntityCandidates(device, registry);
    const role = resolvedDeviceStateEntities({ entities: registry.entities, states: hass.states }, own);
    entityId = role[0] && DEVICE_STATE_DOMAINS.includes(role[0].split('.')[0])
      ? role.find(isControllable) || role[0] : device.primary;
  }
  if (!entityId) return { failure: 'missing', explicit };
  const failure = moreInfoEntityFailure(binding, entityId, registry);
  if (failure) return { failure, explicit };
  // Missing state can mean read denial. unavailable/unknown states are real HA dialogs.
  if (!hass.states?.[entityId]) return { failure: 'missing', explicit };
  return { entityId, explicit };
}
