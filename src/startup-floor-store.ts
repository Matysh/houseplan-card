import { validFloorPreview, type FloorFitPacket } from './floor-cache-preview';

/** Render-only, foreign to the configuration/geometry stores. An individual
 * generation can be evicted without changing the source or another view. */
export const STARTUP_FLOOR_DB = 'houseplan-static-view-v1';
export const STARTUP_VECTOR_LIMIT = 2 * 1024 ** 2;
export const STARTUP_IMAGE_LIMIT = 4 * 1024 ** 2;
const TOTAL_LIMIT = 32 * 1024 ** 2;
const VARIANTS = 8;
// A larger optional image can outlast the geometry store's 100 ms on busy
// mounts. This time never gates live readiness: a late candidate retires.
const READ_MS = 250;
export interface StartupAddress { scope: string; floor: string; variant: string; revision: string }
export interface StartupFloorView {
  image: Blob;
  /** Physical stage size in CSS pixels; CSS/DPR participates in the address. */
  size: readonly [number, number];
  /** The view plane and device scale owned by this already accepted paint. */
  view: { x: number; y: number; w: number; h: number };
  zoom: number;
  /** Persisted cold camera preference, deliberately not part of the IDB key. */
  zoomHint: number | null;
  fit: FloorFitPacket;
}
interface Row extends StartupAddress, StartupFloorView { key: string; floorScope: string; used: number }
interface Entry { key: string; floorScope: string; revision: string; bytes: number; used: number }

const identity = (a: StartupAddress) => JSON.stringify([a.scope, a.floor, a.variant]);
const floorScope = (a: StartupAddress) => JSON.stringify([a.scope, a.floor]);
const validAddress = (a: StartupAddress) => !!a.scope && a.scope.length <= 2048 && typeof a.floor === 'string'
  && !!a.floor && a.floor.length <= 256 && /^[a-f0-9]{64}$/.test(a.variant) && /^[a-f0-9]{64}$/.test(a.revision);
const saneNumber = (n: number) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 10_000_000;
function validPacket(p?: StartupFloorView): p is StartupFloorView {
  return !!p && p.image instanceof Blob && (p.image.type === 'image/svg+xml'
    || p.image.type === 'image/webp' && p.fit?.projection === 'iso')
    && p.image.size > 0 && p.image.size <= STARTUP_IMAGE_LIMIT
    && Array.isArray(p.size) && p.size.length === 2 && p.size.every(n => saneNumber(n) && n > 0 && n <= 16384)
    && !!p.view && [p.view.x, p.view.y, p.view.w, p.view.h].every(saneNumber)
    && p.view.w > 0 && p.view.h > 0 && saneNumber(p.zoom) && p.zoom > 0
    && (p.zoomHint === null || saneNumber(p.zoomHint) && p.zoomHint > 0)
    && validFloorPreview({ version: 1, fitKey: '0'.repeat(64), fit: p.fit, shapes: [] });
}

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });
}
function complete(transaction: IDBTransaction): Promise<boolean> {
  return new Promise(resolve => {
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = transaction.onabort = () => resolve(false);
  });
}

export class StartupFloorStore {
  private database?: Promise<IDBDatabase | null>;
  private closed = false;
  private _readStatus: 'idle' | 'hit' | 'miss' | 'timeout' | 'error' = 'idle';
  constructor(private readonly getFactory = () => globalThis.indexedDB) {}

  get readStatus() { return this._readStatus; }
  preopen(): void { void this.open(); }

  private open(): Promise<IDBDatabase | null> {
    if (this.closed) return Promise.resolve(null);
    return this.database ??= new Promise(resolve => {
      try {
        const open = this.getFactory()?.open(STARTUP_FLOOR_DB, 1);
        if (!open) { resolve(null); return; }
        let failed = false;
        open.onblocked = open.onerror = () => { failed = true; resolve(null); };
        open.onupgradeneeded = () => {
          open.result.createObjectStore('views');
          open.result.createObjectStore('sizes');
        };
        open.onsuccess = () => {
          const db = open.result;
          if (this.closed || failed) { db.close(); resolve(null); return; }
          db.onversionchange = () => this.close();
          resolve(db);
        };
      } catch { resolve(null); }
    });
  }

  async read(address: StartupAddress): Promise<StartupFloorView | null> {
    if (!validAddress(address)) return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      const found = await Promise.race([this.readRow(address), new Promise<null>(resolve => {
        timer = setTimeout(() => { timedOut = true; resolve(null); }, READ_MS);
      })]);
      this._readStatus = timedOut ? 'timeout' : found ? 'hit' : 'miss';
      if (found) void this.touch(found);
      return found ? { image: found.image, size: found.size, view: found.view, zoom: found.zoom,
        zoomHint: found.zoomHint, fit: found.fit } : null;
    } catch { this._readStatus = 'error'; return null; }
    finally { clearTimeout(timer); }
  }
  private async readRow(address: StartupAddress): Promise<Row | null> {
    const db = await this.open();
    if (!db || this.closed) return null;
    const row: Row | undefined = await request(db.transaction('views').objectStore('views').get(identity(address)));
    return row && validPacket(row) && row.key === identity(address) && row.floorScope === floorScope(address)
      && row.scope === address.scope && row.floor === address.floor && row.variant === address.variant
      && row.revision === address.revision ? row : null;
  }
  private async touch(row: Row): Promise<void> {
    try {
      const db = await this.open(); if (!db || this.closed) return;
      const sizes = db.transaction('sizes', 'readwrite').objectStore('sizes');
      const current = await request<Entry | undefined>(sizes.get(row.key));
      // Eviction/replacement is authoritative; never recreate a missing entry.
      if (current?.revision === row.revision) sizes.put({ ...current, used: Date.now() }, row.key);
    } catch { /* read is already complete */ }
  }

  async write(address: StartupAddress, packet: StartupFloorView, current: () => boolean): Promise<boolean> {
    if (!validAddress(address) || !validPacket(packet) || !current()) return false;
    try {
      const db = await this.open(); if (!db || this.closed || !current()) return false;
      const tx = db.transaction(['views', 'sizes'], 'readwrite'), committed = complete(tx);
      const views = tx.objectStore('views'), sizes = tx.objectStore('sizes'), key = identity(address);
      const scope = floorScope(address), used = Date.now();
      const rows = (await request<Entry[]>(sizes.getAll())).filter(row => row.key !== key)
        .sort((a, b) => a.used - b.used || a.key.localeCompare(b.key));
      if (!current()) { tx.abort(); return false; }
      const remove = (row: Entry) => { sizes.delete(row.key); views.delete(row.key); rows.splice(rows.indexOf(row), 1); };
      while (rows.filter(row => row.floorScope === scope).length >= VARIANTS) {
        remove(rows.find(row => row.floorScope === scope)!);
      }
      let bytes = packet.image.size + rows.reduce((sum, row) => sum + row.bytes, 0);
      while (bytes > TOTAL_LIMIT && rows.length) { bytes -= rows[0].bytes; remove(rows[0]); }
      const { image, size, view, zoom, zoomHint, fit } = packet;
      const { scope: owner, floor, variant, revision } = address;
      views.put({ scope: owner, floor, variant, revision, image, size, view, zoom, zoomHint, fit,
        key, floorScope: scope, used }, key);
      sizes.put({ key, floorScope: scope, revision: address.revision, bytes: packet.image.size, used } satisfies Entry, key);
      return await committed;
    } catch { return false; }
  }

  close(): void {
    this.closed = true;
    void this.database?.then(db => db?.close());
  }
}
