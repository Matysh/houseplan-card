/** Room-air CO₂ is a measurement, not a marker icon or any sensor with ppm. */
import { isRegistryEntryEnabled } from './ha-binding-status';

export interface RoomCo2Hass {
  states?: Record<string, {
    state?: unknown;
    attributes?: { device_class?: unknown; unit_of_measurement?: unknown };
  } | undefined>;
  entities?: Record<string, { device_id?: string | null; disabled_by?: unknown } | undefined>;
  devices?: Record<string, { disabled_by?: unknown } | undefined>;
}

/** Availability is separate: an unavailable CO₂ sensor remains selectable. */
export function isCo2Entity(hass: RoomCo2Hass, entityId: string): boolean {
  const attributes = hass.states?.[entityId]?.attributes;
  const entity = hass.entities?.[entityId];
  return entityId.startsWith('sensor.')
    && attributes?.device_class === 'carbon_dioxide'
    && attributes.unit_of_measurement === 'ppm'
    && isRegistryEntryEnabled(entity)
    && (!entity?.device_id || isRegistryEntryEnabled(hass.devices?.[entity.device_id]));
}

/** Keep raw precision until the room/source result is rounded, exactly once. */
export function co2Value(hass: RoomCo2Hass, entityId: string): number | null {
  if (!isCo2Entity(hass, entityId)) return null;
  const state = hass.states?.[entityId]?.state;
  if (typeof state !== 'string' && typeof state !== 'number') return null;
  const text = String(state).trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Text for an already resolved (once-rounded) room reading. */
export const roomCo2Text = (value: number): string => `${value} ppm`;
export const ROOM_CO2_PREVIEW = 850;

/** One physical source gets one stable valid sibling, independent of registry order. */
export function co2For(hass: RoomCo2Hass, entityIds: readonly string[]): number | null {
  for (const entityId of [...entityIds].sort()) {
    const value = co2Value(hass, entityId);
    if (value !== null) return value;
  }
  return null;
}

// Metadata-only index. State changes still read the current state; neither a
// room render nor an explicit source rescans the whole registry for each room.
const deviceIndexes = new WeakMap<object, ReadonlyMap<string, readonly string[]>>();

export function co2DeviceValue(hass: RoomCo2Hass, deviceId: string): number | null {
  const entities = hass.entities;
  if (!entities) return null;
  let index = deviceIndexes.get(entities);
  if (!index) {
    const next = new Map<string, string[]>();
    for (const [entityId, entity] of Object.entries(entities)) {
      if (!entity?.device_id) continue;
      const siblings = next.get(entity.device_id) || [];
      siblings.push(entityId);
      next.set(entity.device_id, siblings);
    }
    index = next;
    deviceIndexes.set(entities, index);
  }
  const value = co2For(hass, index.get(deviceId) || []);
  return value === null ? null : Math.round(value);
}
