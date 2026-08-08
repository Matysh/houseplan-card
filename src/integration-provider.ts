/** Home Assistant integration provenance for the device preview. */
import type { HaRegistrySnapshot } from './ha-binding-status';

export interface IntegrationProvider {
  domain: string;
  label: string;
  configEntryId?: string;
  configEntryTitle?: string;
  confidence: 'registry-owner' | 'entity-platform' | 'identifier-fallback';
}

export interface IntegrationMetadataSnapshot {
  revision: number;
  loaded: boolean;
  configEntries: Record<string, any>;
  manifests: Record<string, any>;
}

interface MetadataCache {
  revision: number;
  loaded: boolean;
  configEntries: Record<string, any>;
  manifests: Record<string, any>;
  listeners: Set<() => void>;
  refs: number;
  loading?: Promise<void>;
  loadedAt?: number;
  subscribing?: Promise<void>;
  unsubscribe?: () => void;
}

const caches = new WeakMap<object, MetadataCache>();

function connectionKey(hass: any): object | null {
  const key = hass?.connection || hass;
  return key && (typeof key === 'object' || typeof key === 'function') ? key : null;
}

function cacheOf(hass: any): MetadataCache | null {
  const key = connectionKey(hass);
  if (!key) return null;
  let cache = caches.get(key);
  if (!cache) {
    cache = {
      revision: 0,
      loaded: false,
      configEntries: {},
      manifests: {},
      listeners: new Set(),
      refs: 0,
    };
    caches.set(key, cache);
  }
  return cache;
}

function notify(cache: MetadataCache): void {
  cache.revision++;
  for (const listener of [...cache.listeners]) {
    try { listener(); } catch { /* one preview cannot break the shared metadata cache */ }
  }
}

async function loadMetadata(hass: any, cache: MetadataCache): Promise<void> {
  if (cache.loading || typeof hass?.callWS !== 'function') return cache.loading;
  // Keep provider metadata between dialog openings. A short-lived page cache
  // avoids two admin WS calls on every open while a periodic refresh still
  // covers changes that happened while no preview owned the subscription.
  if (cache.loaded && cache.loadedAt && Date.now() - cache.loadedAt < 5 * 60_000) return;
  cache.loading = (async () => {
    const [entriesResult, manifestsResult] = await Promise.allSettled([
      hass.callWS({ type: 'config_entries/get' }),
      hass.callWS({ type: 'manifest/list' }),
    ]);
    if (entriesResult.status === 'fulfilled' && Array.isArray(entriesResult.value)) {
      cache.configEntries = Object.fromEntries(
        entriesResult.value
          .filter((entry: any) => typeof entry?.entry_id === 'string')
          .map((entry: any) => [entry.entry_id, entry]),
      );
    }
    if (manifestsResult.status === 'fulfilled' && Array.isArray(manifestsResult.value)) {
      cache.manifests = Object.fromEntries(
        manifestsResult.value
          .filter((manifest: any) => typeof manifest?.domain === 'string')
          .map((manifest: any) => [manifest.domain, manifest]),
      );
    }
    cache.loaded = true;
    cache.loadedAt = Date.now();
    cache.loading = undefined;
    notify(cache);
  })().catch(() => {
    cache.loaded = true;
    cache.loadedAt = Date.now();
    cache.loading = undefined;
    notify(cache);
  });
  return cache.loading;
}

async function ensureSubscription(hass: any, cache: MetadataCache): Promise<void> {
  if (cache.unsubscribe || cache.subscribing) return cache.subscribing;
  const subscribe = hass?.connection?.subscribeMessage;
  if (typeof subscribe !== 'function') return;
  cache.subscribing = (async () => {
    try {
      cache.unsubscribe = await subscribe.call(
        hass.connection,
        (updates: any) => {
          const rows = Array.isArray(updates)
            ? updates
            : Array.isArray(updates?.entries) ? updates.entries : updates ? [updates] : [];
          let changed = false;
          const entries = { ...cache.configEntries };
          for (const update of rows) {
            const entry = update?.entry || update?.data?.entry
              || (typeof update?.entry_id === 'string' ? update : null);
            const id = entry?.entry_id;
            if (typeof id !== 'string') continue;
            const type = update?.type || update?.action || update?.data?.action;
            if (type === 'removed' || type === 'remove') delete entries[id];
            else entries[id] = entry;
            changed = true;
          }
          if (!changed) return;
          cache.configEntries = entries;
          notify(cache);
        },
        { type: 'config_entries/subscribe' },
      );
    } catch {
      // Admin-gated preview still degrades safely when a HA version/account
      // does not expose the metadata subscription.
    } finally {
      if (cache.refs === 0) {
        cache.unsubscribe?.();
        cache.unsubscribe = undefined;
      }
      cache.subscribing = undefined;
    }
  })();
  return cache.subscribing;
}

/** Lazy metadata ownership while at least one device preview is connected. */
export function acquireIntegrationMetadata(hass: any, listener: () => void): () => void {
  const cache = cacheOf(hass);
  if (!cache) return () => undefined;
  cache.refs++;
  cache.listeners.add(listener);
  void loadMetadata(hass, cache);
  void ensureSubscription(hass, cache);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    cache.listeners.delete(listener);
    cache.refs = Math.max(0, cache.refs - 1);
    if (cache.refs) return;
    cache.unsubscribe?.();
    cache.unsubscribe = undefined;
  };
}

export function integrationMetadataSnapshot(hass: any): IntegrationMetadataSnapshot {
  const cache = cacheOf(hass);
  return cache
    ? {
        revision: cache.revision,
        loaded: cache.loaded,
        configEntries: cache.configEntries,
        manifests: cache.manifests,
      }
    : { revision: 0, loaded: false, configEntries: {}, manifests: {} };
}

function localizedIntegrationName(hass: any, domain: string): string {
  if (typeof hass?.localize !== 'function') return '';
  try {
    const key = `component.${domain}.title`;
    const value = hass.localize(key);
    return typeof value === 'string' && value !== key ? value : '';
  } catch {
    return '';
  }
}

export function integrationDisplayName(
  hass: any,
  domain: string,
  metadata = integrationMetadataSnapshot(hass),
  configEntryTitle?: string,
): string {
  const manifest = metadata.manifests[domain];
  return localizedIntegrationName(hass, domain)
    || String(manifest?.name || '')
    || String(configEntryTitle || '')
    || domain.replace(/_/g, ' ');
}

function provider(
  hass: any,
  domain: string,
  confidence: IntegrationProvider['confidence'],
  metadata: IntegrationMetadataSnapshot,
  configEntryId?: string,
): IntegrationProvider | null {
  const cleanDomain = String(domain || '').trim();
  if (!cleanDomain) return null;
  const entry = configEntryId ? metadata.configEntries[configEntryId] : null;
  return {
    domain: cleanDomain,
    label: integrationDisplayName(hass, cleanDomain, metadata, entry?.title),
    configEntryId,
    configEntryTitle: entry?.title,
    confidence,
  };
}

function uniqueProviders(rows: Array<IntegrationProvider | null>): IntegrationProvider[] {
  const rank = { 'registry-owner': 0, 'entity-platform': 1, 'identifier-fallback': 2 } as const;
  const seen = new Set<string>();
  return rows
    .filter((row): row is IntegrationProvider => !!row)
    .sort((a, b) => rank[a.confidence] - rank[b.confidence]
      || a.label.localeCompare(b.label) || a.domain.localeCompare(b.domain))
    .filter((row) => {
      const key = `${row.domain}\n${row.configEntryId || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function resolveEntityProvider(
  hass: any,
  entityId: string,
  registry: HaRegistrySnapshot,
  metadata = integrationMetadataSnapshot(hass),
): IntegrationProvider | null {
  const entity = registry.entities?.[entityId] || hass?.entities?.[entityId];
  if (!entity) return null;
  const entryId = entity.config_entry_id || undefined;
  const entryDomain = entryId ? metadata.configEntries[entryId]?.domain : '';
  return provider(hass, entity.platform || entryDomain, 'entity-platform', metadata, entryId);
}

export function resolveBindingProviders(
  hass: any,
  binding: string,
  registry: HaRegistrySnapshot,
  metadata = integrationMetadataSnapshot(hass),
): IntegrationProvider[] {
  if (binding === 'virtual') {
    return [{ domain: 'houseplan', label: 'House Plan', confidence: 'registry-owner' }];
  }
  const split = binding.indexOf(':');
  if (split < 1) return [];
  const kind = binding.slice(0, split);
  const ref = binding.slice(split + 1);
  if (kind === 'entity') {
    const item = resolveEntityProvider(hass, ref, registry, metadata);
    return item ? [item] : [];
  }
  if (kind !== 'device') return [];
  const device = registry.devices?.[ref] || hass?.devices?.[ref];
  if (!device) return [];
  const ids = [
    device.config_entry_id,
    ...(Array.isArray(device.config_entries) ? device.config_entries : []),
  ].filter((id): id is string => typeof id === 'string' && !!id);
  const owners = ids.map((id) => {
    const entry = metadata.configEntries[id];
    return provider(hass, entry?.domain, 'registry-owner', metadata, id);
  });
  if (owners.some(Boolean)) return uniqueProviders(owners);

  const entityProviders: Array<IntegrationProvider | null> = [];
  for (const [eid, entity] of Object.entries<any>(registry.entities || {})) {
    if (entity?.device_id !== ref || entity?.disabled_by != null) continue;
    entityProviders.push(resolveEntityProvider(hass, eid, registry, metadata));
  }
  if (entityProviders.some(Boolean)) return uniqueProviders(entityProviders);

  const identifiers = Array.isArray(device.identifiers) ? device.identifiers : [];
  return uniqueProviders(identifiers.map((identifier: any) => {
    const domain = Array.isArray(identifier) ? identifier[0] : null;
    return provider(hass, domain, 'identifier-fallback', metadata);
  }));
}
