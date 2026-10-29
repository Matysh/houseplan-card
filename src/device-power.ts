import type { DevItem } from './types';
import type { resolveDeviceOwnAvailability } from './device-own-availability';

type DevicePowerHass = Parameters<typeof resolveDeviceOwnAvailability>[0];
import { resolvedDeviceStateEntities } from './devices';
import { isDevicePowerSwitch } from './device-visual';

const poweredDomains = new Set(['light', 'switch', 'fan', 'climate', 'media_player',
  'humidifier', 'water_heater', 'remote']);

/** The same permitted own roster and native role resolver, independently of
 * the selected visual/control source. Composite Power excludes feature toggles.
 */
export function deviceOwnPowerOff(
  hass: DevicePowerHass, device: DevItem, registryHass: unknown = hass,
): boolean {
  if (device.virtual || device.bindingKind === 'virtual') return false;
  const own = device.entities;
  const roles = resolvedDeviceStateEntities(registryHass, own);
  const eligible = roles.length ? roles : own;
  const gates = eligible.filter(eid => isDevicePowerSwitch(registryHass, eid));
  const power = gates.length ? gates : eligible.filter(eid => poweredDomains.has(eid.split('.')[0]));
  return power.length > 0 && power.every(eid =>
    String(hass?.states?.[eid]?.state ?? '').trim().toLowerCase() === 'off');
}
