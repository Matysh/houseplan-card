import type { ResolvedDevicePresentation } from './device-presentation';
import type { DevItem } from './types';

/** Immutable render-only projection of one HA tick. */
export interface RenderDeviceSnapshot {
  readonly sourceSequence: number;
  readonly capturedAt: number;
  /** Minimal function-free HA-compatible projection used by pure resolvers. */
  readonly hass: Readonly<{
    states: Readonly<Record<string, any>>;
    entities: Readonly<Record<string, any>>;
    devices: Readonly<Record<string, any>>;
    config?: any;
    locale?: any;
    themes?: any;
  }>;
  readonly devices: readonly DevItem[];
  /** Devices with captured vacuum facts, sharing the same cloned roster rows. */
  readonly vacuumDevices: readonly DevItem[];
  readonly positions: ReadonlyMap<string, Readonly<{ x: number; y: number }>>;
  /** Two variants per device: `${id}:1` with LQI and `${id}:0` without it. */
  readonly presentations: ReadonlyMap<string, ResolvedDevicePresentation>;
  /** Extra resolved render facts (for example a vacuum puck/trail frame). */
  readonly facts: ReadonlyMap<string, unknown>;
  /** Exact state rows whose identity may invalidate the painted frame. */
  readonly entityIds: readonly string[];
}

/**
 * Resolve device positions only when a plan model exists to own them.
 *
 * A snapshot without a renderable plan still carries its immutable HA facts,
 * but there is no geometry against which a position can be resolved. Keeping
 * the map empty also preserves the stricter contract of the geometry helpers:
 * they continue to require a real SpaceModel.
 */
export function renderDeviceSnapshotPositions(
  hasRenderablePlan: boolean,
  devices: readonly DevItem[],
  resolve: (device: DevItem) => { x: number; y: number },
): ReadonlyMap<string, { x: number; y: number }> {
  if (!hasRenderablePlan) return new Map();
  return new Map(devices.map((device) => [device.id, resolve(device)]));
}

function cloneFact<T>(value: T, stack = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;
  const object = value as unknown as object;
  const found = stack.get(object);
  if (found) return found as T;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    stack.set(object, out);
    for (const item of value) out.push(cloneFact(item, stack));
    return Object.freeze(out) as T;
  }
  const out: Record<string, unknown> = {};
  stack.set(object, out);
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    // Registry/state facts are data. Functions belong to live HA and never
    // cross the render-snapshot boundary.
    if (typeof item !== 'function') out[key] = cloneFact(item, stack);
  }
  return Object.freeze(out) as T;
}

/** Runtime-immutable ReadonlyMap facade: Object.freeze(new Map()) still allows set(). */
function readonlyMap<K, V>(entries: Iterable<readonly [K, V]>): ReadonlyMap<K, V> {
  const source = new Map(entries);
  let view: ReadonlyMap<K, V>;
  view = Object.freeze({
    get size() { return source.size; },
    get: (key: K) => source.get(key),
    has: (key: K) => source.has(key),
    entries: () => source.entries(),
    keys: () => source.keys(),
    values: () => source.values(),
    forEach: (callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown) =>
      source.forEach((value, key) => callback.call(thisArg, value, key, view)),
    [Symbol.iterator]: () => source[Symbol.iterator](),
  });
  return view;
}

export function createRenderDeviceSnapshot(options: {
  sourceSequence: number;
  hass: any;
  devices: readonly DevItem[];
  presentations: ReadonlyMap<string, ResolvedDevicePresentation>;
  positions?: ReadonlyMap<string, { x: number; y: number }>;
  facts?: ReadonlyMap<string, unknown>;
  entityIds?: Iterable<string>;
  deviceIds?: Iterable<string>;
  areaIds?: Iterable<string>;
  capturedAt?: number;
}): RenderDeviceSnapshot {
  // Copy only the registry/state rows that can contribute to this plan. This
  // is a render-data projection, not a frozen clone of Home Assistant runtime.
  const entityIds = new Set(options.entityIds || []);
  const deviceIds = new Set(options.deviceIds || []);
  const areaIds = new Set(options.areaIds || []);
  for (const device of options.devices) {
    for (const entityId of device.entities || []) entityIds.add(entityId);
    if (device.primary) entityIds.add(device.primary);
    for (const entityId of device.controls || []) entityIds.add(entityId);
    if (device.marker?.vacuum?.source) entityIds.add(device.marker.vacuum.source);
    if (device.bindingKind === 'device' && device.bindingRef) deviceIds.add(device.bindingRef);
    if (device.bindingKind === 'entity' && device.bindingRef) entityIds.add(device.bindingRef);
  }
  const projectedEntities: Record<string, any> = {};
  const projectedDevices: Record<string, any> = {};
  for (const [entityId, registry] of Object.entries<any>(options.hass?.entities || {})) {
    const device = registry?.device_id ? options.hass?.devices?.[registry.device_id] : null;
    if (entityIds.has(entityId) || (registry?.device_id && deviceIds.has(registry.device_id))
        || areaIds.has(registry?.area_id) || areaIds.has(device?.area_id)) {
      entityIds.add(entityId);
      projectedEntities[entityId] = registry;
      if (registry?.device_id) deviceIds.add(registry.device_id);
    }
  }
  for (const deviceId of deviceIds) {
    const device = options.hass?.devices?.[deviceId];
    if (device) projectedDevices[deviceId] = device;
  }
  const projectedStates: Record<string, any> = {};
  for (const entityId of entityIds) {
    const state = options.hass?.states?.[entityId];
    if (state) projectedStates[entityId] = state;
  }
  const hass = Object.freeze({
    states: cloneFact(projectedStates),
    entities: cloneFact(projectedEntities),
    devices: cloneFact(projectedDevices),
    config: cloneFact(options.hass?.config),
    locale: cloneFact(options.hass?.locale),
    themes: cloneFact(options.hass?.themes),
  });
  const devices = cloneFact([...options.devices]);
  const vacuumDevices = Object.freeze(devices.filter((device) =>
    options.facts?.has(`vacuum:${device.id}`)));
  return Object.freeze({
    sourceSequence: options.sourceSequence,
    capturedAt: options.capturedAt ?? Date.now(),
    hass,
    devices,
    vacuumDevices,
    positions: readonlyMap([...(options.positions || [])].map(([id, point]) =>
      [id, Object.freeze({ x: point.x, y: point.y })] as const)),
    presentations: readonlyMap([...options.presentations].map(([key, presentation]) =>
      [key, cloneFact(presentation)] as const)),
    facts: readonlyMap([...(options.facts || [])].map(([key, fact]) =>
      [key, cloneFact(fact)] as const)),
    entityIds: Object.freeze([...entityIds]),
  });
}

export const presentationSnapshotKey = (deviceId: string, showLqi: boolean): string =>
  `${deviceId}:${showLqi ? 1 : 0}`;
