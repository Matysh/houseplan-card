/** Own-radio diagnostics; never expands a marker's functional/action roster. */
import { averageLqi } from './logic';

interface SignalEntity {
  readonly device_id?: string | null;
  readonly disabled_by?: unknown;
}
interface SignalState {
  readonly state?: unknown;
  readonly attributes?: Readonly<Record<string, unknown>>;
}
export interface DeviceSignalHass {
  readonly states?: Readonly<Record<string, SignalState | undefined>>;
  readonly entities?: Readonly<Record<string, SignalEntity | undefined>>;
  readonly devices?: Readonly<Record<string, { readonly disabled_by?: unknown } | undefined>>;
}
export interface DeviceSignalDevice {
  readonly entities: readonly string[];
  readonly bindingKind?: 'device' | 'entity' | 'virtual';
  readonly bindingRef?: string;
  readonly bindingStatus?: { readonly kind: string };
  readonly virtual?: boolean;
  readonly marker?: { readonly binding?: string; readonly removed?: boolean; readonly hide_signal?: unknown };
}
export interface DeviceSignalContext {
  readonly states: NonNullable<DeviceSignalHass['states']>;
  readonly entities: NonNullable<DeviceSignalHass['entities']>;
  readonly devices: NonNullable<DeviceSignalHass['devices']>;
  readonly entityIdsByDevice: ReadonlyMap<string, readonly string[]>;
}
const EMPTY = Object.freeze({});
const EMPTY_IDS: readonly string[] = Object.freeze([]);
const indices = new WeakMap<NonNullable<DeviceSignalHass['entities']>, ReadonlyMap<string, readonly string[]>>();

/** Metadata index is built once per registry identity, never per hover/frame. */
export function createDeviceSignalContext(
  activeHass: DeviceSignalHass | null | undefined,
  registryHass: DeviceSignalHass | null | undefined = activeHass,
): DeviceSignalContext {
  const entities: NonNullable<DeviceSignalHass['entities']> = registryHass?.entities || EMPTY;
  let index = indices.get(entities);
  if (!index) {
    const next = new Map<string, string[]>();
    for (const [id, entity] of Object.entries(entities)) {
      if (!entity?.device_id) continue;
      const siblings = next.get(entity.device_id) || [];
      siblings.push(id); next.set(entity.device_id, siblings);
    }
    for (const siblings of next.values()) Object.freeze(siblings.sort());
    index = next; indices.set(entities, index);
  }
  return { states: activeHass?.states || EMPTY, entities,
    devices: registryHass?.devices || EMPTY, entityIdsByDevice: index };
}

function bindingOf(device: DeviceSignalDevice): { kind: string; ref: string } | null {
  if (device.virtual || device.bindingKind === 'virtual' || device.marker?.removed
      || (device.bindingStatus && device.bindingStatus.kind !== 'active')) return null;
  const [kind, ...ref] = (device.marker?.binding || '').split(':');
  return { kind: device.bindingKind || kind, ref: device.bindingRef || ref.join(':') };
}

/** Exact registry ownership, not controls/via_device/names or a topology parent. */
export function deviceSignalPhysicalId(device: DeviceSignalDevice, context: DeviceSignalContext): string | null {
  const binding = bindingOf(device);
  if (!binding) return null;
  if (binding.kind === 'device') return binding.ref || null;
  if (binding.kind !== 'entity') return null;
  const entity = context.entities[binding.ref];
  const parent = entity?.device_id;
  return entity?.disabled_by == null && parent && context.devices[parent]
    && context.devices[parent]?.disabled_by == null ? parent : null;
}

/** Includes potential/missing rows so a sibling-only state tick invalidates. */
export function deviceSignalEntityIds(device: DeviceSignalDevice, context: DeviceSignalContext): readonly string[] {
  const binding = bindingOf(device);
  if (!binding) return EMPTY_IDS;
  if (binding.kind !== 'entity') return device.entities;
  const parent = deviceSignalPhysicalId(device, context);
  return parent ? context.entityIdsByDevice.get(parent) || EMPTY_IDS : EMPTY_IDS;
}

/** Existing canonical dedicated-sensor/attribute selection and average. */
export function lqiFor(hass: DeviceSignalHass, entityIds: readonly string[]): number | null {
  const values: number[] = [];
  for (const id of entityIds) {
    const state = hass.states?.[id];
    if (!state) continue;
    const unit = String(state.attributes?.unit_of_measurement || '').toLowerCase();
    if (/_(linkquality|lqi)$/.test(id) || unit === 'lqi') {
      const value = Number.parseFloat(String(state.state));
      if (!Number.isNaN(value)) values.push(value);
      continue;
    }
    const attribute = state.attributes?.linkquality ?? state.attributes?.lqi;
    if (attribute != null) {
      const value = Number.parseFloat(String(attribute));
      if (!Number.isNaN(value)) values.push(value);
    }
  }
  return averageLqi(values);
}

export function deviceLqi(
  hass: DeviceSignalHass, device: DeviceSignalDevice,
  context = createDeviceSignalContext(hass),
): number | null {
  const ids = deviceSignalEntityIds(device, context).filter((id) => {
    const registry = context.entities[id];
    if (registry?.disabled_by != null || (registry?.device_id
        && context.devices[registry.device_id]?.disabled_by != null)) return false;
    const state = context.states[id];
    return !!state && state.state !== 'unknown' && state.state !== 'unavailable';
  });
  return lqiFor(context, ids);
}

export function showMarkerSignalOf(marker: { hide_signal?: unknown } | null | undefined): boolean {
  return marker?.hide_signal !== true;
}
export function markerSignalFields(hidden: boolean): { hide_signal: true } | Record<string, never> {
  return hidden ? { hide_signal: true } : {};
}
