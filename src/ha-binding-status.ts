/**
 * Home Assistant registry authority for plan bindings.
 *
 * `hass.entities` is not a reliable source for disabled entries on every HA
 * frontend/version/account. This module owns one full registry fetch and one
 * pair of update subscriptions per HA connection, shared by every House Plan
 * card on the page. Consumers receive an explicit status; missing data is
 * never guessed to mean disabled.
 */

export type HaDisabledReason = 'device' | 'entity' | 'all_entities';

export type HaBindingStatus =
  | { kind: 'active'; enabledEntityIds: string[]; allEntityIds: string[] }
  | { kind: 'ha_disabled'; reason: HaDisabledReason; enabledEntityIds: []; allEntityIds: string[] }
  | { kind: 'orphaned'; reason: 'device_missing' | 'entity_missing'; enabledEntityIds: []; allEntityIds: string[] }
  | { kind: 'unverified'; reason: 'registry_unavailable'; enabledEntityIds: []; allEntityIds: string[] };

export interface HaRegistrySnapshot {
  /** Increases only when the shared registry picture/access status changes. */
  revision: number;
  /** Both full registry commands succeeded. */
  authoritative: boolean;
  access: 'pending' | 'full' | 'limited';
  devices: Record<string, any>;
  entities: Record<string, any>;
  lastSuccess: number;
  error?: string;
}

interface RegistryCacheEntry {
  revision: number;
  authoritative: boolean;
  access: HaRegistrySnapshot['access'];
  devices: Record<string, any>;
  entities: Record<string, any>;
  lastSuccess: number;
  error?: string;
  loading?: Promise<void>;
  listeners: Set<() => void>;
  refs: number;
  reloadTimer?: number;
  unsubDevice?: () => void;
  unsubEntity?: () => void;
  subscribing?: Promise<void>;
  /** Last live frontend registry projection observed beside a full snapshot. */
  liveDevices?: Record<string, any>;
  liveEntities?: Record<string, any>;
  /** Authoritative rows plus newly observed live rows, memoized per identity. */
  projectedRevision?: number;
  projectedDevices?: Record<string, any>;
  projectedEntities?: Record<string, any>;
}

const registryCaches = new WeakMap<object, RegistryCacheEntry>();
const registryObjectIds = new WeakMap<object, number>();
let nextRegistryObjectId = 1;
const BINDING_STATUS_LS = 'houseplan.ha-binding-status.v1';
const BINDING_STATUS_MAX = 1500;
const BINDING_STATUS_TTL_MS = 90 * 24 * 60 * 60 * 1000;

interface CachedBindingStatus {
  kind: 'active' | 'ha_disabled';
  reason?: HaDisabledReason;
  ts: number;
}

let bindingStatusMemo: Record<string, CachedBindingStatus> | null = null;

function connectionKey(hass: any): object | null {
  const key = hass?.connection || hass;
  return key && (typeof key === 'object' || typeof key === 'function') ? key : null;
}

function newEntry(): RegistryCacheEntry {
  return {
    revision: 0,
    authoritative: false,
    access: 'pending',
    devices: {},
    entities: {},
    lastSuccess: 0,
    listeners: new Set(),
    refs: 0,
  };
}

function entryOf(hass: any): RegistryCacheEntry | null {
  const key = connectionKey(hass);
  if (!key) return null;
  let entry = registryCaches.get(key);
  if (!entry) {
    entry = newEntry();
    registryCaches.set(key, entry);
  }
  return entry;
}

function recordsById(rows: unknown, idKey: 'id' | 'entity_id'): Record<string, any> | null {
  const list = Array.isArray(rows)
    ? rows
    : rows && typeof rows === 'object' && Array.isArray((rows as any).entries)
      ? (rows as any).entries
      : null;
  if (!list) return null;
  const out: Record<string, any> = {};
  for (const row of list) {
    const id = row?.[idKey];
    if (typeof id === 'string' && id) out[id] = row;
  }
  return out;
}

function errorText(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as any;
    return String(e.message || e.code || e.error || 'registry_unavailable');
  }
  return String(error || 'registry_unavailable');
}

function notify(entry: RegistryCacheEntry): void {
  for (const listener of [...entry.listeners]) {
    try { listener(); } catch { /* one card cannot break the shared cache */ }
  }
}

async function loadFullRegistries(hass: any, entry: RegistryCacheEntry): Promise<void> {
  if (entry.loading || !hass?.callWS) return entry.loading;
  entry.loading = (async () => {
    try {
      const [deviceRows, entityRows] = await Promise.all([
        hass.callWS({ type: 'config/device_registry/list' }),
        hass.callWS({ type: 'config/entity_registry/list' }),
      ]);
      const devices = recordsById(deviceRows, 'id');
      const entities = recordsById(entityRows, 'entity_id');
      if (!devices || !entities) throw new Error('invalid_registry_response');
      entry.devices = devices;
      entry.entities = entities;
      entry.authoritative = true;
      entry.access = 'full';
      entry.lastSuccess = Date.now();
      entry.error = undefined;
    } catch (error) {
      // Keep the last successful full picture. Access becomes limited so new
      // decisions use current frontend/state evidence, while cached disabled
      // bindings remain safely hidden until a successful refresh.
      entry.authoritative = false;
      entry.access = 'limited';
      entry.error = errorText(error);
    } finally {
      entry.revision++;
      entry.loading = undefined;
      notify(entry);
    }
  })();
  return entry.loading;
}

function scheduleReload(hass: any, entry: RegistryCacheEntry): void {
  if (entry.reloadTimer !== undefined) return;
  entry.reloadTimer = globalThis.setTimeout(() => {
    entry.reloadTimer = undefined;
    void loadFullRegistries(hass, entry);
  }, 80);
}

async function ensureSubscriptions(hass: any, entry: RegistryCacheEntry): Promise<void> {
  if (entry.subscribing || (entry.unsubDevice && entry.unsubEntity)) return entry.subscribing;
  const subscribe = hass?.connection?.subscribeEvents;
  if (typeof subscribe !== 'function') return;
  entry.subscribing = (async () => {
    try {
      if (!entry.unsubDevice) {
        entry.unsubDevice = await subscribe.call(
          hass.connection,
          () => scheduleReload(hass, entry),
          'device_registry_updated',
        );
      }
      if (!entry.unsubEntity) {
        entry.unsubEntity = await subscribe.call(
          hass.connection,
          () => scheduleReload(hass, entry),
          'entity_registry_updated',
        );
      }
    } catch {
      // Some limited accounts cannot subscribe to registry events. Their hass
      // projection remains reactive; a connection-ready refresh retries full
      // access without turning this into a per-state-tick fetch.
    } finally {
      if (entry.refs === 0) {
        entry.unsubDevice?.();
        entry.unsubEntity?.();
        entry.unsubDevice = undefined;
        entry.unsubEntity = undefined;
      }
      entry.subscribing = undefined;
    }
  })();
  return entry.subscribing;
}

/** Start sharing the page-level registry authority. Returns a release hook. */
export function acquireHaRegistries(hass: any, listener: () => void): () => void {
  const entry = entryOf(hass);
  if (!entry) return () => undefined;
  const wasUnused = entry.refs === 0;
  entry.refs++;
  entry.listeners.add(listener);
  // The first card owns the page fetch. Additional full/static cards only
  // attach listeners; a remount after the last release refreshes stale data.
  if (entry.access === 'pending' || wasUnused) void loadFullRegistries(hass, entry);
  void ensureSubscriptions(hass, entry);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.listeners.delete(listener);
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs > 0) return;
    entry.unsubDevice?.();
    entry.unsubEntity?.();
    entry.unsubDevice = undefined;
    entry.unsubEntity = undefined;
    if (entry.reloadTimer !== undefined) globalThis.clearTimeout(entry.reloadTimer);
    entry.reloadTimer = undefined;
  };
}

/** Retry after a websocket reconnect or an account/permission change. */
export function refreshHaRegistries(hass: any): void {
  const entry = entryOf(hass);
  if (!entry) return;
  scheduleReload(hass, entry);
  void ensureSubscriptions(hass, entry);
}

/** Current shared picture; limited mode follows the live hass projection. */
export function haRegistrySnapshot(hass: any): HaRegistrySnapshot {
  const entry = entryOf(hass);
  if (!entry) {
    return {
      revision: 0,
      authoritative: false,
      access: 'limited',
      devices: hass?.devices || {},
      entities: hass?.entities || {},
      lastSuccess: 0,
      error: 'registry_unavailable',
    };
  }
  let devices = hass?.devices || {};
  let entities = hass?.entities || {};
  if (entry.authoritative) {
    const projectionChanged = entry.liveDevices !== devices || entry.liveEntities !== entities;
    const hadProjection = entry.liveDevices !== undefined || entry.liveEntities !== undefined;
    if (projectionChanged) {
      entry.liveDevices = devices;
      entry.liveEntities = entities;
      entry.projectedRevision = undefined;
      // Registry subscriptions are not guaranteed for every HA account/version.
      // A changed live projection is therefore also a cheap retry signal. The
      // additive projection below makes newly discovered rows usable at once;
      // the debounced full reload then reconciles disabled_by flips/removals.
      if (hadProjection) scheduleReload(hass, entry);
    }
    if (entry.projectedRevision !== entry.revision
        || !entry.projectedDevices || !entry.projectedEntities) {
      const projectedDevices = { ...entry.devices };
      const projectedEntities = { ...entry.entities };
      for (const [id, row] of Object.entries<any>(devices)) {
        if (!Object.prototype.hasOwnProperty.call(projectedDevices, id)) projectedDevices[id] = row;
      }
      for (const [id, row] of Object.entries<any>(entities)) {
        if (!Object.prototype.hasOwnProperty.call(projectedEntities, id)) projectedEntities[id] = row;
      }
      entry.projectedDevices = projectedDevices;
      entry.projectedEntities = projectedEntities;
      entry.projectedRevision = entry.revision;
    }
    devices = entry.projectedDevices;
    entities = entry.projectedEntities;
  }
  return {
    revision: entry.revision,
    authoritative: entry.authoritative,
    access: entry.access,
    devices,
    entities,
    lastSuccess: entry.lastSuccess,
    error: entry.error,
  };
}

function objectIdentity(value: any): number {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return 0;
  let id = registryObjectIds.get(value);
  if (!id) {
    id = nextRegistryObjectId++;
    registryObjectIds.set(value, id);
  }
  return id;
}

/** O(1) rebuild key on normal state ticks; registry updates replace identity/revision. */
export function haRegistryBuildSignature(hass: any, snapshot = haRegistrySnapshot(hass)): string {
  return [
    snapshot.revision,
    snapshot.access,
    objectIdentity(snapshot.devices),
    objectIdentity(snapshot.entities),
  ].join(':');
}

export function isRegistryEntryEnabled(entry: any): boolean {
  return !!entry && entry.disabled_by == null;
}

/** Hass-shaped projection containing registry metadata but only active rows. */
export function activeRegistryHass(hass: any, snapshot = haRegistrySnapshot(hass)): any {
  const devices: Record<string, any> = {};
  const entities: Record<string, any> = {};
  const states: Record<string, any> = {};
  for (const [id, device] of Object.entries<any>(snapshot.devices || {})) {
    if (isRegistryEntryEnabled(device)) devices[id] = device;
  }
  for (const [eid, entity] of Object.entries<any>(snapshot.entities || {})) {
    if (!isRegistryEntryEnabled(entity)) continue;
    // In limited mode an absent parent row is not evidence that the parent is
    // disabled: HA may expose the entity/state but omit the device registry.
    // Only an explicitly present disabled parent may suppress the entity.
    const parent = entity.device_id ? snapshot.devices?.[entity.device_id] : null;
    if (snapshot.authoritative && entity.device_id && !parent) continue;
    if (parent && !isRegistryEntryEnabled(parent)) continue;
    entities[eid] = entity;
  }
  for (const [eid, state] of Object.entries<any>(hass?.states || {})) {
    const entity = snapshot.entities?.[eid];
    if (snapshot.authoritative && !entity) continue;
    if (entity && !isRegistryEntryEnabled(entity)) continue;
    const parent = entity?.device_id ? snapshot.devices?.[entity.device_id] : null;
    if (snapshot.authoritative && entity?.device_id && !parent) continue;
    if (parent && !isRegistryEntryEnabled(parent)) continue;
    states[eid] = state;
  }
  return { ...hass, devices, entities, states };
}

/** Hass-shaped projection with the full rows when they are authoritative. */
export function fullRegistryHass(hass: any, snapshot = haRegistrySnapshot(hass)): any {
  return { ...hass, devices: snapshot.devices || {}, entities: snapshot.entities || {} };
}

function entityIdsForDevice(entities: Record<string, any>, deviceId: string): string[] {
  const out: string[] = [];
  for (const [eid, entity] of Object.entries<any>(entities || {})) {
    if (entity?.device_id === deviceId) out.push(eid);
  }
  return out;
}

function readStatusCache(): Record<string, CachedBindingStatus> {
  if (bindingStatusMemo) return bindingStatusMemo;
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(BINDING_STATUS_LS) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const now = Date.now();
    const out: Record<string, CachedBindingStatus> = {};
    for (const [binding, value] of Object.entries<any>(parsed)) {
      if (!value || (value.kind !== 'active' && value.kind !== 'ha_disabled')) continue;
      if (!Number.isFinite(value.ts) || now - value.ts > BINDING_STATUS_TTL_MS) continue;
      out[binding] = value;
    }
    bindingStatusMemo = out;
    return bindingStatusMemo;
  } catch {
    return {};
  }
}

export function cachedHaBindingStatus(binding: string): CachedBindingStatus | null {
  return readStatusCache()[binding] || null;
}

/** Persist only authoritative statuses of saved bindings; never marker data/state. */
export function cacheHaBindingStatuses(statuses: Map<string, HaBindingStatus>): void {
  if (typeof localStorage === 'undefined' || !statuses.size) return;
  const cache = readStatusCache();
  const now = Date.now();
  for (const [binding, status] of statuses) {
    if (status.kind === 'active') cache[binding] = { kind: 'active', ts: now };
    else if (status.kind === 'ha_disabled') {
      cache[binding] = { kind: 'ha_disabled', reason: status.reason, ts: now };
    }
  }
  const trimmed = Object.fromEntries(
    Object.entries(cache)
      .sort((a, b) => b[1].ts - a[1].ts)
      .slice(0, BINDING_STATUS_MAX),
  );
  bindingStatusMemo = trimmed;
  try { localStorage.setItem(BINDING_STATUS_LS, JSON.stringify(trimmed)); } catch { /* quota/private mode */ }
}

/** One source of truth for device/entity binding availability. */
export function resolveHaBindingStatus(
  hass: any,
  binding: string,
  snapshot = haRegistrySnapshot(hass),
): HaBindingStatus {
  if (!binding || binding === 'virtual') {
    return { kind: 'active', enabledEntityIds: [], allEntityIds: [] };
  }
  const split = binding.indexOf(':');
  if (split < 1) return { kind: 'unverified', reason: 'registry_unavailable', enabledEntityIds: [], allEntityIds: [] };
  const kind = binding.slice(0, split);
  const ref = binding.slice(split + 1);
  if ((kind !== 'device' && kind !== 'entity') || !ref) {
    return { kind: 'unverified', reason: 'registry_unavailable', enabledEntityIds: [], allEntityIds: [] };
  }

  const devices = snapshot.devices || {};
  const entities = snapshot.entities || {};
  if (snapshot.authoritative) {
    if (kind === 'device') {
      const device = devices[ref];
      if (!device) return { kind: 'orphaned', reason: 'device_missing', enabledEntityIds: [], allEntityIds: [] };
      const allEntityIds = entityIdsForDevice(entities, ref);
      if (!isRegistryEntryEnabled(device)) {
        return { kind: 'ha_disabled', reason: 'device', enabledEntityIds: [], allEntityIds };
      }
      const enabledEntityIds = allEntityIds.filter((eid) => isRegistryEntryEnabled(entities[eid]));
      if (allEntityIds.length && !enabledEntityIds.length) {
        return { kind: 'ha_disabled', reason: 'all_entities', enabledEntityIds: [], allEntityIds };
      }
      return { kind: 'active', enabledEntityIds, allEntityIds };
    }
    const entity = entities[ref];
    // YAML platforms without a unique_id (notably Xiaomi Cloud Map
    // Extractor cameras) legitimately have a live state but no registry row.
    // A disabled row still wins, otherwise that exact live state is positive
    // evidence of existence even under an authoritative registry snapshot.
    if (entity && !isRegistryEntryEnabled(entity)) {
      return { kind: 'ha_disabled', reason: 'entity', enabledEntityIds: [], allEntityIds: [ref] };
    }
    if (entity?.device_id && !devices[entity.device_id]) {
      return { kind: 'orphaned', reason: 'device_missing', enabledEntityIds: [], allEntityIds: [ref] };
    }
    if (entity?.device_id && !isRegistryEntryEnabled(devices[entity.device_id])) {
      return { kind: 'ha_disabled', reason: 'device', enabledEntityIds: [], allEntityIds: [ref] };
    }
    if (!entity && !hass?.states?.[ref]) {
      return { kind: 'orphaned', reason: 'entity_missing', enabledEntityIds: [], allEntityIds: [] };
    }
    return { kind: 'active', enabledEntityIds: [ref], allEntityIds: [ref] };
  }

  // Limited fallback: only positive evidence is authoritative. A missing row
  // is not orphaned/disabled; it becomes unverified unless a live exact state
  // or the last authoritative disabled status resolves it safely.
  const cached = cachedHaBindingStatus(binding);
  if (kind === 'device') {
    const device = devices[ref];
    const allEntityIds = entityIdsForDevice(entities, ref);
    if (device?.disabled_by != null) {
      return { kind: 'ha_disabled', reason: 'device', enabledEntityIds: [], allEntityIds };
    }
    const enabledEntityIds = allEntityIds.filter((eid) => {
      const entity = entities[eid];
      return entity?.disabled_by == null && (!entity.device_id || devices[entity.device_id]?.disabled_by == null);
    });
    if (allEntityIds.length && !enabledEntityIds.length
        && allEntityIds.every((eid) => entities[eid]?.disabled_by != null)) {
      return { kind: 'ha_disabled', reason: 'all_entities', enabledEntityIds: [], allEntityIds };
    }
    // A last authoritative disabled result remains the conservative answer
    // until another authoritative fetch clears it. A shortened live registry
    // row cannot prove that every formerly disabled child was re-enabled.
    if (cached?.kind === 'ha_disabled') {
      return {
        kind: 'ha_disabled', reason: cached.reason || 'device',
        enabledEntityIds: [], allEntityIds,
      };
    }
    if (device || enabledEntityIds.some((eid) => !!hass?.states?.[eid])) {
      return { kind: 'active', enabledEntityIds, allEntityIds };
    }
  } else {
    const entity = entities[ref];
    if (entity?.disabled_by != null) {
      return { kind: 'ha_disabled', reason: 'entity', enabledEntityIds: [], allEntityIds: [ref] };
    }
    if (entity?.device_id && devices[entity.device_id]?.disabled_by != null) {
      return { kind: 'ha_disabled', reason: 'device', enabledEntityIds: [], allEntityIds: [ref] };
    }
    if (cached?.kind === 'ha_disabled') {
      return {
        kind: 'ha_disabled', reason: cached.reason || 'entity',
        enabledEntityIds: [], allEntityIds: [ref],
      };
    }
    if (entity || hass?.states?.[ref]) {
      return { kind: 'active', enabledEntityIds: [ref], allEntityIds: [ref] };
    }
  }

  return { kind: 'unverified', reason: 'registry_unavailable', enabledEntityIds: [], allEntityIds: [] };
}

export function haRegistryDiagnostics(hass: any): {
  access: HaRegistrySnapshot['access']; authoritative: boolean; revision: number;
  lastSuccess: number; error?: string;
} {
  const snapshot = haRegistrySnapshot(hass);
  return {
    access: snapshot.access,
    authoritative: snapshot.authoritative,
    revision: snapshot.revision,
    lastSuccess: snapshot.lastSuccess,
    error: snapshot.error,
  };
}
