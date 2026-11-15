/** Disposable, optional, origin-local derived data. Never stores a plan or HA
 * states. A single IDB transaction publishes both levels and their pointer;
 * consequently an interrupted publication has no visible staging generation. */
export const FLOOR_CACHE_DB = 'houseplan-derived-floors-v1';
export const CACHE_LIMITS = { preview: 2 * 1024 ** 2, geometry: 8 * 1024 ** 2,
  scope: 32 * 1024 ** 2, global: 64 * 1024 ** 2, floors: 8, readMs: 100 } as const;
export interface CacheAddress { scope: string; floor: string; key: string }
export interface CachePayload { text: string; checksum: string; bytes: number }
export interface CacheGeneration {
  address: CacheAddress; generation: string; created: number;
  preview: CachePayload; geometry: CachePayload;
}
interface Meta { id: string; scope: string; floor: string; key: string; generation: string; used: number; bytes: number }
const encoder = new TextEncoder();
const AREA_RESERVE = 1024 ** 2;
const validAddress = (address: CacheAddress) => !!address.scope && address.scope.length <= 2048
  && address.floor.length > 0 && address.floor.length <= 256 && address.key.length > 0 && address.key.length <= 256;
export function payloadBytes(text: string): number { return encoder.encode(text).byteLength; }
export function cacheAddressId(address: CacheAddress): string { return JSON.stringify([address.scope, address.floor, address.key]); }
const validPayload = (value: CachePayload, limit: number) => !!value && typeof value.text === 'string'
  && /^[a-f0-9]{64}$/.test(value.checksum) && value.bytes > 0 && value.bytes <= limit
  && payloadBytes(value.text) === value.bytes;
function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
}
function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('floor-cache:aborted')); });
}
export class FloorCacheStore {
  private readonly factory?: IDBFactory;
  private connection: Promise<IDBDatabase | null> | null = null;
  private closed = false;
  readonly metrics = { reads: 0, hits: 0, timeouts: 0, errors: 0, writes: 0, readMs: [] as number[] };
  constructor(factory?: IDBFactory) {
    try { this.factory = factory ?? globalThis.indexedDB; }
    catch { this.metrics.errors++; }
  }
  preopen(): void { void this.open(); }
  private open(): Promise<IDBDatabase | null> {
    if (this.closed || !this.factory) return Promise.resolve(null);
    return this.connection ||= new Promise(resolve => {
      try {
        const opening = this.factory!.open(FLOOR_CACHE_DB, 1);
        let failed = false;
        opening.onupgradeneeded = () => {
          for (const name of ['meta', 'preview', 'geometry', 'area'])
            if (!opening.result.objectStoreNames.contains(name)) opening.result.createObjectStore(name);
        };
        opening.onerror = opening.onblocked = () => { failed = true; this.metrics.errors++; resolve(null); };
        opening.onsuccess = () => {
          const db = opening.result;
          db.onversionchange = () => { db.close(); this.closed = true; };
          if (this.closed || failed) { db.close(); resolve(null); } else resolve(db);
        };
      } catch { this.metrics.errors++; resolve(null); }
    });
  }
  private async bounded<T>(read: () => Promise<T | null>): Promise<T | null> {
    const start = performance.now(); this.metrics.reads++;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([read(), new Promise<null>(resolve => {
        timer = setTimeout(() => { this.metrics.timeouts++; resolve(null); }, CACHE_LIMITS.readMs);
      })]);
    } catch { this.metrics.errors++; return null; }
    finally { clearTimeout(timer); this.metrics.readMs.push(performance.now() - start);
      if (this.metrics.readMs.length > 100) this.metrics.readMs.shift(); }
  }
  /** Small L1 and L2 are independent reads; no large payload gates L1. */
  read(address: CacheAddress, level: 'preview' | 'geometry'): Promise<CachePayload | null> {
    return this.bounded(async () => {
      const db = await this.open(); if (!db || this.closed || !validAddress(address)) return null;
      const id = cacheAddressId(address), tx = db.transaction(['meta', level], 'readonly');
      const [meta, row] = await Promise.all([request<Meta | undefined>(tx.objectStore('meta').get(id)),
        request<{ generation: string; payload: CachePayload } | undefined>(tx.objectStore(level).get(id))]);
      if (!meta || !row || row.generation !== meta.generation || meta.scope !== address.scope
        || meta.floor !== address.floor || meta.key !== address.key
        || !validPayload(row.payload, CACHE_LIMITS[level])) return null;
      this.metrics.hits++;
      void this.touch(meta);
      return row.payload;
    });
  }
  private async touch(meta: Meta): Promise<void> {
    try {
      const db = await this.open(); if (!db || this.closed) return;
      const tx = db.transaction('meta', 'readwrite'), completed = done(tx), store = tx.objectStore('meta');
      const current: Meta | undefined = await request(store.get(meta.id));
      if (current?.generation === meta.generation) store.put({ ...current, used: Date.now() }, meta.id);
      await completed;
    } catch { /* eviction/versionchange cannot affect a returned read */ }
  }
  async publish(value: CacheGeneration, isCurrent: () => boolean): Promise<boolean> {
    if (!validAddress(value.address) || !validPayload(value.preview, CACHE_LIMITS.preview)
      || !validPayload(value.geometry, CACHE_LIMITS.geometry) || !isCurrent()) return false;
    try {
      const db = await this.open(); if (!db || this.closed || !isCurrent()) return false;
      const tx = db.transaction(['meta', 'preview', 'geometry'], 'readwrite'), completed = done(tx);
      const metaStore = tx.objectStore('meta'), rows: Meta[] = await request(metaStore.getAll());
      if (!isCurrent()) { tx.abort(); await completed.catch(() => {}); return false; }
      const id = cacheAddressId(value.address), bytes = value.preview.bytes + value.geometry.bytes;
      const next: Meta = { id, ...value.address, generation: value.generation, used: Date.now(), bytes };
      const remove = (row: Meta) => {
        for (const store of ['meta', 'preview', 'geometry']) tx.objectStore(store).delete(row.id);
      };
      // One complete generation per floor bucket. Transaction serialization
      // protects a concurrent reader/writer in another tab without a lease.
      const retained = rows.filter(row => {
        if (row.scope === next.scope && row.floor === next.floor) { remove(row); return false; }
        return true;
      }).sort((a, b) => a.used - b.used);
      const scopeRows = () => retained.filter(row => row.scope === next.scope);
      const total = (all: Meta[]) => all.reduce((n, row) => n + row.bytes, 0);
      // Reserve a hard 1 MiB for the bounded scalar store, including keys and
      // metadata, so these entries also fit within both payload caps.
      while (scopeRows().length >= CACHE_LIMITS.floors || total(scopeRows()) + bytes > CACHE_LIMITS.scope - AREA_RESERVE
        || total(retained) + bytes > CACHE_LIMITS.global - AREA_RESERVE) {
        const restrictScope = scopeRows().length >= CACHE_LIMITS.floors || total(scopeRows()) + bytes > CACHE_LIMITS.scope - AREA_RESERVE;
        const index = retained.findIndex(row => !restrictScope || row.scope === next.scope);
        if (index < 0) { tx.abort(); await completed.catch(() => {}); return false; }
        remove(retained.splice(index, 1)[0]);
      }
      metaStore.put(next, id);
      for (const level of ['preview', 'geometry'] as const)
        tx.objectStore(level).put({ generation: value.generation, payload: value[level] }, id);
      await completed; this.metrics.writes++; return true;
    } catch { this.metrics.errors++; return false; }
  }
  async area(address: CacheAddress): Promise<number | null | undefined> {
    return (await this.bounded(async () => {
      const db = await this.open(); if (!db || this.closed || !validAddress(address)) return null;
      const value = await request(db.transaction('area').objectStore('area').get(cacheAddressId(address)));
      return value && value.scope === address.scope && value.key === address.key
        && (value.value === null || Number.isFinite(value.value) && value.value >= 0) ? value : null;
    }))?.value;
  }
  async publishArea(address: CacheAddress, value: number | null, isCurrent: () => boolean): Promise<void> {
    try {
      const db = await this.open(); if (!db || this.closed || !validAddress(address) || !isCurrent()
        || value !== null && (!Number.isFinite(value) || value < 0)) return;
      const tx = db.transaction('area', 'readwrite'), completed = done(tx), store = tx.objectStore('area');
      // Small scalar entries have their own hard bound; never retain an
      // unlimited history of fingerprints when the source is edited often.
      const keys = await request(store.getAllKeys());
      if (!isCurrent()) { tx.abort(); await completed.catch(() => {}); return; }
      for (const key of keys.slice(0, Math.max(0, keys.length - 255))) store.delete(key);
      const payload = { scope: address.scope, key: address.key, value };
      if (payloadBytes(JSON.stringify([cacheAddressId(address), payload])) <= 4096) store.put(payload, cacheAddressId(address));
      await completed;
    } catch { this.metrics.errors++; }
  }
  close(): void { this.closed = true; void this.connection?.then(db => db?.close()); }
}
