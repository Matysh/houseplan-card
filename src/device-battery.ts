/** Read-only own-device battery diagnostics, independent of face/action sources. */

export type DeviceBatteryState = 'normal' | 'warning' | 'low' | 'unknown';

export interface ResolvedDeviceBattery {
  readonly state: DeviceBatteryState;
  readonly sourceEntityId: string;
}

/** #817: the selected source and its own value, for text; no reading means no text. */
export type DeviceBatteryReading =
  | { readonly kind: 'percent'; readonly value: number; readonly sourceEntityId: string }
  | { readonly kind: 'binary'; readonly low: boolean; readonly sourceEntityId: string };

interface BatteryEntityRegistryEntry {
  readonly device_id?: unknown;
  readonly device_class?: unknown;
  readonly original_device_class?: unknown;
  readonly disabled_by?: unknown;
}

interface BatteryDeviceRegistryEntry {
  readonly disabled_by?: unknown;
}

interface BatteryStateRow {
  readonly state?: unknown;
  readonly attributes?: { readonly device_class?: unknown };
}

export interface DeviceBatteryHass {
  readonly states?: Readonly<Record<string, BatteryStateRow | undefined>>;
  readonly entities?: Readonly<Record<string, BatteryEntityRegistryEntry | undefined>>;
  readonly devices?: Readonly<Record<string, BatteryDeviceRegistryEntry | undefined>>;
}

export interface DeviceBatteryDevice {
  readonly bindingKind?: 'device' | 'entity' | 'virtual';
  readonly bindingRef?: string;
  readonly virtual?: boolean;
  readonly bindingStatus?: { readonly kind: string };
  readonly marker?: { readonly binding?: string; readonly removed?: boolean };
}

type EntityRegistry = NonNullable<DeviceBatteryHass['entities']>;
type BatteryOwnershipIndex = ReadonlyMap<string, readonly string[]>;

export interface DeviceBatteryContext {
  /** Captured active rows only; full-registry stale states never provide charge. */
  readonly states: NonNullable<DeviceBatteryHass['states']>;
  /** Full available metadata includes disabled battery sources for identity. */
  readonly entities: EntityRegistry;
  readonly devices: NonNullable<DeviceBatteryHass['devices']>;
  readonly entityIdsByDevice: BatteryOwnershipIndex;
}

const EMPTY_RECORD = Object.freeze({});
const EMPTY_IDS: readonly string[] = Object.freeze([]);
const ownershipCache = new WeakMap<EntityRegistry, BatteryOwnershipIndex>();

const batteryDomain = (entityId: string): 'sensor' | 'binary_sensor' | null => {
  if (entityId.startsWith('sensor.')) return 'sensor';
  if (entityId.startsWith('binary_sensor.')) return 'binary_sensor';
  return null;
};

function ownershipIndex(entities: EntityRegistry): BatteryOwnershipIndex {
  const cached = ownershipCache.get(entities);
  if (cached) return cached;
  const index = new Map<string, string[]>();
  for (const [entityId, registry] of Object.entries(entities)) {
    if (!batteryDomain(entityId) || typeof registry?.device_id !== 'string' || !registry.device_id) continue;
    const siblings = index.get(registry.device_id) || [];
    siblings.push(entityId);
    index.set(registry.device_id, siblings);
  }
  // HA entity IDs are ASCII. Code-point sorting is independent of locale and
  // registry response order; source values never participate in this order.
  for (const siblings of index.values()) Object.freeze(siblings.sort());
  ownershipCache.set(entities, index);
  return index;
}

/** Build once per frame; ownership is reused across state-only HA updates. */
export function createDeviceBatteryContext(
  activeHass: DeviceBatteryHass | null | undefined,
  registryHass: DeviceBatteryHass | null | undefined = activeHass,
): DeviceBatteryContext {
  const entities = registryHass?.entities || EMPTY_RECORD;
  return Object.freeze({
    states: activeHass?.states || EMPTY_RECORD,
    entities,
    devices: registryHass?.devices || EMPTY_RECORD,
    entityIdsByDevice: ownershipIndex(entities),
  });
}

function batteryBinding(device: DeviceBatteryDevice): { kind: 'device' | 'entity'; ref: string } | null {
  if (device.virtual || device.bindingKind === 'virtual' || device.marker?.removed
      || (device.bindingStatus && device.bindingStatus.kind !== 'active')) return null;
  const binding = device.marker?.binding;
  if (binding === 'virtual') return null;
  const separator = binding?.indexOf(':') ?? -1;
  const kind = device.bindingKind || (separator > 0 ? binding?.slice(0, separator) : undefined);
  const ref = device.bindingRef || (separator > 0 ? binding?.slice(separator + 1) : undefined);
  return (kind === 'device' || kind === 'entity') && ref ? { kind, ref } : null;
}

function isBatteryEntity(entityId: string, context: DeviceBatteryContext): boolean {
  if (!batteryDomain(entityId)) return false;
  const registry = context.entities[entityId];
  const deviceClass = context.states[entityId]?.attributes?.device_class
    || registry?.device_class || registry?.original_device_class;
  return deviceClass === 'battery';
}

/**
 * Include potential own sensor/binary sources, not only today's selected battery.
 * A state-only tick may introduce/change device_class or restore a missing row.
 * Returning these IDs never changes the marker's functional entity roster.
 */
export function deviceBatteryEntityIds(
  device: DeviceBatteryDevice,
  context: DeviceBatteryContext,
): readonly string[] {
  const binding = batteryBinding(device);
  if (!binding) return EMPTY_IDS;
  if (binding.kind === 'device') return context.entityIdsByDevice.get(binding.ref) || EMPTY_IDS;
  const parent = context.entities[binding.ref]?.device_id;
  const siblings = typeof parent === 'string' ? context.entityIdsByDevice.get(parent) || EMPTY_IDS : EMPTY_IDS;
  if (!batteryDomain(binding.ref) || siblings.includes(binding.ref)) return siblings;
  return Object.freeze([...siblings, binding.ref].sort());
}

function currentState(entityId: string, context: DeviceBatteryContext): unknown {
  const registry = context.entities[entityId];
  if (registry?.disabled_by != null) return undefined;
  const parentId = registry?.device_id;
  if (typeof parentId === 'string' && context.devices[parentId]?.disabled_by != null) return undefined;
  return context.states[entityId]?.state;
}

function batteryPercent(value: unknown): number | null {
  if (typeof value === 'string') {
    const text = value.trim();
    // Do not coerce empty, units, hexadecimal, booleans or arbitrary HA text to
    // a percentage. Decimal fractions retain their precision at the thresholds.
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
    value = Number(text);
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}

function numericBatteryState(value: unknown): DeviceBatteryState {
  const percent = batteryPercent(value);
  if (percent === null) return 'unknown';
  return percent >= 60 ? 'normal' : percent >= 20 ? 'warning' : 'low';
}

/** One selection rule for the indicator and the tooltip text. */
function batterySource(device: DeviceBatteryDevice, context: DeviceBatteryContext): string | null {
  const binding = batteryBinding(device);
  if (!binding) return null;
  if (binding.kind === 'entity' && isBatteryEntity(binding.ref, context)) return binding.ref;
  const candidates = deviceBatteryEntityIds(device, context).filter((entityId) => isBatteryEntity(entityId, context));
  return candidates.find((entityId) => batteryDomain(entityId) === 'sensor') || candidates[0] || null;
}

export function resolveDeviceBattery(
  device: DeviceBatteryDevice,
  context: DeviceBatteryContext,
): ResolvedDeviceBattery | null {
  const sourceEntityId = batterySource(device, context);
  if (!sourceEntityId) return null;
  const value = currentState(sourceEntityId, context);
  const state = batteryDomain(sourceEntityId) === 'sensor' ? numericBatteryState(value)
    : value === 'on' ? 'low' : value === 'off' ? 'normal' : 'unknown';
  return Object.freeze({ state, sourceEntityId });
}

/**
 * #817: the value behind the indicator, independent of whether the indicator
 * is shown. Unknown, unavailable, empty, non-numeric, out-of-range and
 * disabled sources give null, never a guessed normal charge.
 */
export function deviceBatteryReading(
  device: DeviceBatteryDevice,
  context: DeviceBatteryContext,
): DeviceBatteryReading | null {
  const sourceEntityId = batterySource(device, context);
  if (!sourceEntityId) return null;
  const value = currentState(sourceEntityId, context);
  if (batteryDomain(sourceEntityId) === 'sensor') {
    const percent = batteryPercent(value);
    return percent === null ? null : Object.freeze({ kind: 'percent', value: percent, sourceEntityId });
  }
  return value === 'on' || value === 'off'
    ? Object.freeze({ kind: 'binary', low: value === 'on', sourceEntityId }) : null;
}
