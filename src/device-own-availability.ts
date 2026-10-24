import type { DevItem } from './types';
import type { DeviceAvailability } from './device-visual';

/** Physical HA evidence, independent of selected state/value/control sources. */
export type OwnDeviceAvailability = 'available' | 'unavailable' | 'unknown';

export function resolveDeviceOwnAvailability(
  hass: { states?: Record<string, { state?: unknown } | undefined> } | null | undefined,
  device: DevItem,
): OwnDeviceAvailability {
  if (device.virtual || device.bindingKind === 'virtual' || device.marker?.binding === 'virtual'
      || device.bindingStatus && device.bindingStatus.kind !== 'active') return 'unknown';
  const own = device.entities;
  if (!own.length) return 'unknown';
  let allUnavailable = true;
  for (const eid of own) {
    // buildDevices owns this active roster. Exact-entity markers have only
    // that row; diagnostic siblings outside it are not physical evidence here.
    const raw = hass?.states?.[eid]?.state;
    const state = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (state && state !== 'unknown' && state !== 'unavailable') return 'available';
    if (state !== 'unavailable') allUnavailable = false;
  }
  return allUnavailable ? 'unavailable' : 'unknown';
}

/** Existing controller source eligibility; this makes no second HA-state scan. */
export function controllerSourceAvailability(
  own: OwnDeviceAvailability, device: DevItem,
): DeviceAvailability {
  if (own === 'available') return 'available';
  if (device.virtual || device.bindingKind === 'virtual' || device.marker?.binding === 'virtual') return 'available';
  const activeEntityless = device.entities.length === 0
    && !(device.bindingStatus?.allEntityIds?.length)
    && device.bindingStatus?.kind === 'active'
    && (device.bindingKind === 'device' || device.marker?.binding?.startsWith('device:'));
  return activeEntityless ? 'available' : 'unavailable';
}
